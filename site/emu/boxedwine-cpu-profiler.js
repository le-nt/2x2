/* 2x2 optional browser profiler. Measurements are JS wall times, NOT GPU execution times. */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('cpuProfile') !== '1') return;
  if (window.__rbCpuProfiler) return;
  const now = () => performance.now();
  const t0 = now();
  const metrics = new Map();
  let enabled = true;
  const originals = [];
  const MAX_SAMPLES = 4096;
  function track(name, ms) {
    if (!enabled) return;
    let m = metrics.get(name);
    if (!m) { m = { count: 0, total: 0, max: 0, samples: [] }; metrics.set(name, m); }
    m.count++; m.total += ms; if (ms > m.max) m.max = ms;
    if (m.samples.length < MAX_SAMPLES) m.samples.push(ms);
    else if (m.count % 16 === 0) m.samples[(m.count / 16) % MAX_SAMPLES | 0] = ms;
  }
  function wrapCallback(fn, group) {
    if (typeof fn !== 'function') return fn;
    return function (...args) {
      const start = now();
      try { return fn.apply(this, args); }
      finally { track(group, now() - start); }
    };
  }
  function replace(obj, key, make) {
    if (!obj || typeof obj[key] !== 'function') return;
    const previous = obj[key];
    try {
      obj[key] = make(previous);
      originals.push(() => { if (obj[key] !== previous) obj[key] = previous; });
    } catch (e) { console.warn('[2X2 CPU] Could not wrap', key, e.message); }
  }
  replace(window, 'requestAnimationFrame', orig => function (cb) {
    return orig.call(this, wrapCallback(cb, 'raf.callback'));
  });
  // Emscripten often uses timer scheduling rather than requestAnimationFrame.
  replace(window, 'setTimeout', orig => function (cb, ...rest) {
    if (typeof cb === 'function') cb = wrapCallback(cb, 'timer.callback');
    return orig.call(this, cb, ...rest);
  });
  const wasm = window.WebAssembly;
  if (wasm) {
    ['compile', 'compileStreaming', 'instantiate', 'instantiateStreaming'].forEach(key => {
      replace(wasm, key, orig => function (...args) {
        const start = now(); let result;
        try { result = orig.apply(this, args); }
        catch (e) { track('wasm.' + key + '.sync', now() - start); throw e; }
        // Async wall time includes waiting/scheduling. It is NOT pure compilation CPU.
        if (result && typeof result.then === 'function') {
          return result.then(v => { track('wasm.' + key + '.elapsed', now() - start); return v; }, e => {
            track('wasm.' + key + '.elapsed', now() - start); throw e;
          });
        }
        track('wasm.' + key + '.sync', now() - start);
        return result;
      });
    });
    ['Module', 'Instance'].forEach(key => {
      // No attempt to wrap constructors: altering constructor semantics can break the emulator.
    });
  }
  const glMethods = [
    'bufferData', 'bufferSubData', 'texImage2D', 'texSubImage2D', 'compressedTexImage2D',
    'drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced',
    'readPixels', 'blitFramebuffer', 'finish', 'flush', 'compileShader', 'linkProgram'
  ];
  for (const proto of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
    if (!proto) continue;
    for (const key of glMethods) {
      if (!Object.prototype.hasOwnProperty.call(proto, key)) continue;
      replace(proto, key, orig => function (...args) {
        const start = now();
        try { return orig.apply(this, args); }
        finally { track('webgl.' + key, now() - start); }
      });
    }
  }
  let longTasks = 0;
  let longTaskMs = 0;
  let observer = null;
  if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) { longTasks++; longTaskMs += entry.duration; track('browser.longtask', entry.duration); }
    });
    try { observer.observe({ type: 'longtask', buffered: true }); } catch { observer = null; }
  }
  function report() {
    const secs = ((now() - t0) / 1000).toFixed(1);
    const items = [...metrics].map(([name, m]) => {
      const s = [...m.samples].sort((a,b) => a-b);
      return { name, count: m.count, totalMs: Math.round(m.total), meanMs: +(m.total/m.count).toFixed(3),
        p95Ms: +(s[Math.floor((s.length - 1)*.95)] || 0).toFixed(3), maxMs: +m.max.toFixed(3) };
    }).sort((a,b) => b.totalMs - a.totalMs);
    console.groupCollapsed(`[2X2 CPU] ${secs}s | long tasks ${longTasks} (${Math.round(longTaskMs)}ms) | ${items.length} categories`);
    console.table(items);
    console.info('Interpretation: raf/timer are callback times (may overlap WebGL); WebGL is JS call time, not GPU execution; WASM async elapsed includes wait time. Guest execution and JIT compilation inside WASM cannot be separated without native instrumentation.');
    console.groupEnd();
    return items;
  }
  const ticker = window.setInterval(report, 10000);
  window.__rbCpuProfiler = {
    report,
    snapshot: () => Object.fromEntries([...metrics].map(([k,v])=>[k,{...v,samples:undefined}])),
    stop() { enabled = false; clearInterval(ticker); observer?.disconnect(); for (const undo of originals.reverse()) undo(); }
  };
  console.info('[2X2 CPU] profiler active; report every 10s. Run __rbCpuProfiler.report() for immediate results.');
})();
