/* 2x2 effects: no network dependencies. UI audio begins only after a user gesture. */
(() => {
  'use strict';
  const key = '2x2.experience.v1';
  const defaults = { sound: true, volume: 0.22, effects: true, motion: true };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch {}
  const prefs = { ...defaults };
  for (const name of ['sound','effects','motion']) if (typeof saved[name] === 'boolean') prefs[name] = saved[name];
  if (Number.isFinite(saved.volume)) prefs.volume = Math.max(0, Math.min(1, saved.volume));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let audio, unlocked = false, welcomed = false, lastHover = 0, lastClick = 0;
  const interactive = 'a[href],button,input[type=checkbox],input[type=radio],select,[role=tab]';
  function tone(freq, start, length, level, type = 'sine', endFreq = freq) {
    if (!audio || audio.state !== 'running') return;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), start + length);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * prefs.volume), start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(start); oscillator.stop(start + length + 0.015);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function sound(kind) {
    if (!prefs.sound || !unlocked || !audio || document.hidden) return;
    const t = audio.currentTime;
    if (kind === 'hover') tone(1450,t,.024,.09,'sine',1100);
    else if (kind === 'click') { tone(640,t,.045,.18,'triangle',420); tone(1550,t,.025,.055); }
    else if (kind === 'open') { tone(420,t,.08,.14,'triangle'); tone(630,t+.045,.1,.12,'triangle'); }
    else if (kind === 'notice') { tone(800,t,.1,.14); tone(1200,t+.1,.14,.12); }
    else if (kind === 'start') { tone(330,t,.12,.13,'triangle'); tone(440,t+.07,.12,.13,'triangle'); tone(660,t+.15,.2,.13,'triangle'); }
    else if (kind === 'error') { tone(220,t,.12,.12,'triangle',150); tone(180,t+.13,.12,.1,'triangle',130); }
  }
  async function unlock(event) {
    if (!event.isTrusted || !prefs.sound) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      audio ||= new Audio();
      if (audio.state !== 'running') await audio.resume();
      unlocked = audio.state === 'running';
      if (unlocked && !welcomed) { welcomed = true; sound('start'); }
    } catch { /* Browsers without audio keep the entire interface usable. */ }
  }
  document.addEventListener('pointerdown', unlock, { passive:true });
  document.addEventListener('keydown', unlock);
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch' || !unlocked) return;
    const target = event.target.closest(interactive);
    if (!target || target.disabled || target.contains(event.relatedTarget)) return;
    const now = performance.now();
    if (now - lastHover > 95) { lastHover = now; sound('hover'); }
  });
  document.addEventListener('click', event => {
    const target = event.target.closest(interactive);
    if (!target || target.disabled || target.matches('.SoundToggle')) return;
    const now=performance.now();
    if(now-lastClick<50)return;
    lastClick=now;
    sound(target.matches('.PlayButton,#AuthSubmit') ? 'start' : 'click');
  });

  const speaker = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8c3 2 3 6 0 8"/><path class="SoundSlash" d="M3 3l18 18"/></svg>';
  function syncControls() {
    document.documentElement.dataset.effects = prefs.effects ? 'on' : 'off';
    document.documentElement.dataset.motion = prefs.motion && !reduced.matches ? 'on' : 'off';
    for (const button of document.querySelectorAll('.SoundToggle')) {
      button.setAttribute('aria-pressed', String(prefs.sound));
      button.title = button.getAttribute('aria-label') = prefs.sound ? 'Mute interface sounds' : 'Enable interface sounds';
      button.querySelector('.SoundSlash').style.display = prefs.sound ? 'none' : '';
    }
    for (const name of ['sound','effects','motion']) {
      const input = document.querySelector(`[data-experience="${name}"]`);
      if(input) input.checked = prefs[name];
    }
    const volume = document.querySelector('[data-experience="volume"]');
    if(volume) volume.value = Math.round(prefs.volume*100);
  }
  function update(next) {
    Object.assign(prefs,next);
    try { localStorage.setItem(key,JSON.stringify(prefs)); } catch {}
    syncControls();
    refreshAnimation();
  }
  function addControls() {
    const bar = document.querySelector('.TopBar');
    if (bar && !bar.querySelector('.SoundToggle')) {
      const button=document.createElement('button');
      button.type='button'; button.className='IconButton SoundToggle'; button.innerHTML=speaker;
      button.addEventListener('click',async event=>{update({sound:!prefs.sound});if(prefs.sound){await unlock(event);sound('notice');}});
      bar.append(button);
    }
    for(const element of document.querySelectorAll('[data-experience]:not([data-bound])')) {
      element.dataset.bound='true';
      element.addEventListener(element.type==='range'?'input':'change', event=>{
        const name=element.dataset.experience;
        update({[name]:name==='volume'?Number(element.value)/100:element.checked});
        if(name==='volume') { if(event.isTrusted) unlock(event); }
        else if(name==='sound' && prefs.sound) unlock(event);
      });
      if(element.type==='range')element.addEventListener('change',()=>sound('notice'));
    }
    syncControls();
  }

  // A small WebGL fragment shader: halftone nebula, warped horizon and an arcade grid.
  // It is deliberately confined to brand panels, at <=30fps and capped resolution.
  const vertex = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const fragment = `precision mediump float;
    uniform vec2 u_res; uniform float u_time; uniform vec2 u_pointer;
    void main(){
      vec2 uv=gl_FragCoord.xy/u_res;vec2 p=uv-.5;p.x*=u_res.x/u_res.y;
      float t=u_time*.13;vec2 offset=(u_pointer-.5)*.06;
      vec2 q=p+offset;
      float flow=sin(q.x*4.+t)*cos(q.y*5.-t*.7);
      float cloud=sin(q.x*3.3+q.y*2.+t)+cos(q.y*4.-q.x*2.-t*.8);
      vec3 col=vec3(.055,.035,.15);
      col+=vec3(.34,.025,.48)*exp(-length(q-vec2(.22,.18)) * 2.5)*(.65+.25*cloud);
      col+=vec3(.02,.18,.40)*exp(-length(q-vec2(-.4,-.1))*3.0)*(.8+.2*flow);
      float horizon=-.12+.025*sin(q.x*4.+t);
      float ground=1.-smoothstep(horizon-.015,horizon+.04,q.y);
      float depth=max(.045,horizon-q.y);
      vec2 grid=vec2(q.x/depth*.8,1./depth*.35+t);
      vec2 edge=abs(fract(grid)-.5);
      float lines=smoothstep(.455,.497,max(edge.x,edge.y));
      col+=vec3(.1,.52,.67)*lines*ground*.23*smoothstep(.0,.35,depth);
      float glow=exp(-abs(q.y-horizon)*65.);
      col+=vec3(.34,.06,.48)*glow*.55;
      vec2 dots=fract(gl_FragCoord.xy/5.)-.5;
      float halftone=1.-smoothstep(.14,.26,length(dots));
      col+=vec3(.24,.07,.28)*halftone*.2*(.7+flow*.3);
      float vignette=1.-smoothstep(.25,.95,length(p));
      col*=.6+.4*vignette;
      gl_FragColor=vec4(col,1.);
    }`;
  const renderers = new Set();
  let raf=0,lastFrame=-100,phase=0,lastTime=0;
  function attachShader(host) {
    if(host.dataset.shaderBound)return;
    host.dataset.shaderBound='true';
    const canvas=document.createElement('canvas');canvas.className='ShaderCanvas';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
    let gl;
    try { gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:false,powerPreference:'low-power'}); } catch {}
    if(!gl){canvas.remove();return;}
    function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw new Error('Shader not available');}return shader;}
    let vs,fs,program,buffer;
    try {
      vs=compile(gl.VERTEX_SHADER,vertex);fs=compile(gl.FRAGMENT_SHADER,fragment);
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader not available');
      gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
    } catch {canvas.remove();gl.getExtension('WEBGL_lose_context')?.loseContext();return;}
    const res=gl.getUniformLocation(program,'u_res'),time=gl.getUniformLocation(program,'u_time'),pointer=gl.getUniformLocation(program,'u_pointer');
    const state={host,canvas,gl,visible:true,lost:false,pointer:[.5,.5],draw(t){
      if(!host.isConnected||!this.visible||this.lost||!host.offsetWidth||host.getClientRects().length===0||host.closest('[hidden],.hidden'))return;
      const dpr=Math.min(devicePixelRatio||1,1.3),w=Math.max(1,Math.round(host.clientWidth*dpr)),h=Math.max(1,Math.round(host.clientHeight*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      gl.useProgram(program);gl.uniform2f(res,w,h);gl.uniform1f(time,t);gl.uniform2f(pointer,...this.pointer);gl.drawArrays(gl.TRIANGLES,0,6);
    }};
    host.addEventListener('pointermove',event=>{if(!prefs.motion||reduced.matches)return;const r=host.getBoundingClientRect();state.pointer=[(event.clientX-r.left)/r.width,1-(event.clientY-r.top)/r.height];},{passive:true});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();state.lost=true;canvas.style.display='none';});
    canvas.addEventListener('webglcontextrestored',()=>{renderers.delete(state);canvas.remove();delete host.dataset.shaderBound;attachShader(host);});
    if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{state.visible=entries[0].isIntersecting;refreshAnimation();});observer.observe(host);}
    renderers.add(state);state.draw(phase);refreshAnimation();
  }
  function tick(now){
    raf=0;
    if(document.hidden||!prefs.effects)return;
    if(now-lastFrame>32){if(lastTime)phase+=Math.min((now-lastTime)/1000,.1);lastTime=now;lastFrame=now;for(const r of renderers)if(r.visible&&!r.lost)r.draw(phase);}
    if(prefs.motion&&!reduced.matches&&[...renderers].some(r=>r.visible&&!r.lost))raf=requestAnimationFrame(tick);
  }
  function refreshAnimation(){
    if(raf)cancelAnimationFrame(raf);raf=0;lastTime=0;
    if(!prefs.effects||document.hidden)return;
    for(const r of renderers)r.draw(phase);
    if(prefs.motion&&!reduced.matches&&[...renderers].some(r=>r.visible&&!r.lost))raf=requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange',()=>{refreshAnimation();if(document.hidden)audio?.suspend().catch(()=>{});else if(unlocked)audio?.resume().catch(()=>{});});
  reduced.addEventListener('change',()=>{syncControls();refreshAnimation();});
  window.addEventListener('resize',refreshAnimation,{passive:true});
  window.addEventListener('storage',event=>{if(event.key!==key)return;try{const data=JSON.parse(event.newValue||'{}');for(const name of ['sound','effects','motion'])if(typeof data[name]==='boolean')prefs[name]=data[name];if(Number.isFinite(data.volume))prefs.volume=Math.max(0,Math.min(1,data.volume));syncControls();refreshAnimation();}catch{}});
  let queued=false;
  function scan(){queued=false;addControls();for(const host of document.querySelectorAll('.HeroArt,.BrandBanner,.LoadingOverlay'))if(!host.dataset.shaderBound)attachShader(host);}
  const observer=new MutationObserver(records=>{
    let changed=false;
    for(const record of records)for(const node of record.addedNodes){
      if(node.nodeType!==1)continue;
      if(node.matches('.Toast'))sound('notice');
      if(node.matches('.Modal'))sound('open');
      if(node.matches('.Error')&&node.textContent.trim())sound('error');
      if(!node.matches('.ShaderCanvas,.SoundToggle,.SoundToggle *'))changed=true;
    }
    if(changed&&!queued){queued=true;queueMicrotask(scan);}
  });
  observer.observe(document.body,{childList:true,subtree:true});
  scan();
})();
