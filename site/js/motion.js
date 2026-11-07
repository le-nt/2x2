/* 2x2 motion layer. No dependencies. Honors prefers-reduced-motion and Settings -> "interface motion"
   (html[data-motion="off"], set by effects.js). Everything degrades to the plain static layout. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const on = () => !reduced.matches && root.dataset.motion !== 'off';
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Scroll reveal (shelves, cards, tiles, boxes) ---------- */
  const REVEAL = '.Shelf, .StandardBox, .Game, .Tile, .Item, .Post, .Friend, .GbEntry, .Stat, .ProfileHero, .Strip h2, .PageHead, .BrandBanner';
  let io = null;
  const batch = new Map();
  function flush() {
    batch.forEach((entries, parent) => {
      entries.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left || a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      entries.forEach((el, i) => {
        el.style.setProperty('--d', Math.min(i, 10) * 55 + 'ms');
        el.classList.add('rv-in');
        setTimeout(() => { el.classList.add('rv-done'); el.removeAttribute('data-rv'); el.classList.remove('rv-in', 'rv-done'); el.style.removeProperty('--d'); }, 900 + i * 55);
      });
    });
    batch.clear();
  }
  let flushTimer = 0;
  function setupReveal() {
    if (!on() || !('IntersectionObserver' in window)) return;
    root.classList.add('rv-on');
    io = new IntersectionObserver((list) => {
      for (const e of list) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const key = e.target.parentElement || document.body;
        if (!batch.has(key)) batch.set(key, []);
        batch.get(key).push(e.target);
      }
      clearTimeout(flushTimer); flushTimer = setTimeout(flush, 16);
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    scan(document);
    // Safety net: never leave anything hidden if observation stalls.
    setTimeout(() => $$('[data-rv]').forEach((el) => { if (!el.classList.contains('rv-in')) { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) { io.unobserve(el); el.removeAttribute('data-rv'); } } }), 2500);
  }
  function scan(ctx) {
    if (!io) return;
    const found = ctx.nodeType === 1 && ctx.matches(REVEAL) ? [ctx, ...$$(REVEAL, ctx)] : $$(REVEAL, ctx);
    for (const el of found) {
      if (el.dataset.rvSeen) continue;
      el.dataset.rvSeen = '1';
      el.setAttribute('data-rv', '');
      io.observe(el);
    }
  }
  const mo = new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) { scan(n); countWallet(n); }
  });

  /* ---------- Card tilt + light follow ---------- */
  let tiltEl = null;
  function resetTilt(el) { el.classList.remove('tilting'); el.style.removeProperty('--tx'); el.style.removeProperty('--ty'); }
  document.addEventListener('pointermove', (e) => {
    if (!on() || e.pointerType === 'touch') return;
    const card = e.target.closest && e.target.closest('.Game');
    if (tiltEl && tiltEl !== card) { resetTilt(tiltEl); tiltEl = null; }
    if (!card) return;
    tiltEl = card;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.classList.add('tilting');
    card.style.setProperty('--ty', ((px - 0.5) * 9).toFixed(2) + 'deg');
    card.style.setProperty('--tx', ((0.5 - py) * 7).toFixed(2) + 'deg');
    const t = card.querySelector('.GameThumbnail');
    if (t) { const tr = t.getBoundingClientRect(); t.style.setProperty('--mx', ((e.clientX - tr.left) / tr.width * 100).toFixed(1) + '%'); t.style.setProperty('--my', ((e.clientY - tr.top) / tr.height * 100).toFixed(1) + '%'); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (tiltEl) { resetTilt(tiltEl); tiltEl = null; } }, true);

  /* ---------- Wallet count-up ---------- */
  function countWallet(ctx) {
    if (!on()) return;
    for (const span of $$('.Wallet span', ctx.nodeType === 1 ? ctx : document)) {
      if (span.dataset.counted) continue;
      const target = parseInt(span.textContent.replace(/[^\d]/g, ''), 10);
      span.dataset.counted = '1';
      if (!Number.isFinite(target) || target < 2) continue;
      const t0 = performance.now(), dur = 900;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
        span.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (k < 1) requestAnimationFrame(step);
      };
      span.textContent = '0';
      requestAnimationFrame(step);
    }
  }

  /* ---------- Landing: the 2x2 brick scene ---------- */
  function setupScene() {
    const art = document.querySelector('.HeroArt'), scene = art && art.querySelector('.Scene');
    if (!scene) return;
    const base = { rx: -30, ry: -36 };
    let tx = base.rx, ty = base.ry, cx = tx, cy = ty, drag = null, vel = 0, raf = 0, idle = 0;
    const apply = () => { scene.style.setProperty('--rx', cx.toFixed(2) + 'deg'); scene.style.setProperty('--ry', cy.toFixed(2) + 'deg'); };
    function loop(t) {
      raf = 0;
      if (!on()) { cx = base.rx; cy = base.ry; apply(); return; }
      if (!drag) {
        if (Math.abs(vel) > 0.02) { ty += vel; vel *= 0.94; }       // inertia after a drag
        else if (!art.matches(':hover')) { ty = base.ry + Math.sin(t / 2600) * 9; tx = base.rx + Math.sin(t / 3400) * 2.5; } // slow idle sway
      }
      cx += (tx - cx) * 0.085; cy += (ty - cy) * 0.085;
      apply();
      raf = requestAnimationFrame(loop);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    art.addEventListener('pointermove', (e) => {
      if (!on() || e.pointerType === 'touch') return;
      const r = art.getBoundingClientRect();
      if (drag) { ty += (e.clientX - drag.x) * 0.45; tx = Math.max(-62, Math.min(-8, tx - (e.clientY - drag.y) * 0.25)); vel = (e.clientX - drag.x) * 0.12; drag = { x: e.clientX, y: e.clientY, moved: true }; return; }
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      ty = base.ry + nx * 26; tx = base.rx - ny * 12;
    });
    art.addEventListener('pointerleave', () => { if (!drag) { tx = base.rx; ty = base.ry; } });
    art.addEventListener('pointerdown', (e) => { if (!on()) return; drag = { x: e.clientX, y: e.clientY, moved: false }; art.classList.add('dragging'); art.setPointerCapture?.(e.pointerId); });
    const end = (e) => {
      const moved = drag && drag.moved;
      drag = null; art.classList.remove('dragging');
      if (!moved) { const b = e.target.closest && e.target.closest('.Brick'); if (b) pop(b); }
    };
    art.addEventListener('pointerup', end);
    art.addEventListener('pointercancel', () => { drag = null; art.classList.remove('dragging'); });
    function pop(b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 650); }
    // Bricks land one after another; once the last has dropped, give them a little "snap" ripple.
    setTimeout(() => $$('.Brick', scene).forEach((b, i) => setTimeout(() => on() && pop(b), i * 90)), 1900);
    reduced.addEventListener?.('change', kick);
    kick();
  }

  /* ---------- Optional Sunny Day icon credit hook ---------- */
  window.__toyLoaded = (img) => { root.classList.add('has-toys'); img.parentNode.classList.add('has-toy'); };

  function init() {
    setupReveal();
    setupScene();
    countWallet(document);
    $$('.Toy').forEach((i) => i.complete && i.naturalWidth && window.__toyLoaded(i));
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
