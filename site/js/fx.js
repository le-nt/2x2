// RBFx: sound + art layer for 2x2.
//   RBAudio : synthesized UI sounds (Web Audio, no sample files), the looping menu-theme music, and a sound dock.
//   RBArt   : random poster art: ad billboards (Home + Discover), poster loading screens, a lightbox and a drifting collage on the landing page.
// Everything is opt-out from the speaker dock (bottom-left) or Settings. Preferences live in localStorage "rb.fx".
// Load after common.js:  <script src="js/fx.js"></script>   (css/fx.css is loaded automatically if the page forgot it)
(() => {
  "use strict";
  const SCRIPT = document.currentScript && document.currentScript.src;
  const asset = (p) => (SCRIPT ? new URL("../" + p, SCRIPT).href : p);
  const EMBED = window.parent !== window;
  const PLAYPAGE = !!document.getElementById("PlayContainer") || /\/play\.html$/.test(location.pathname);
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  if (!document.querySelector('link[href$="css/fx.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet";
    l.href = SCRIPT ? new URL("../css/fx.css", SCRIPT).href : "css/fx.css"; document.head.appendChild(l);
  }

  // ---------- Preferences ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* blocked */ } },
  };
  const st = { music: true, sfx: true, art: true, mVol: 0.35, sVol: 0.7, mute: false };
  try { Object.assign(st, JSON.parse(store.get("rb.fx") || "{}")); } catch { /* defaults */ }
  const subs = new Set();
  const commit = () => { store.set("rb.fx", JSON.stringify(st)); subs.forEach((f) => f(st)); };

  // ---------- Synth ----------
  // Every sound is a function (ctx, out, t, opt). They take the context as an argument so they can also be rendered offline.
  const noiseBufs = new WeakMap();
  const noiseBuf = (c) => {
    let b = noiseBufs.get(c);
    if (!b) { b = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseBufs.set(c, b); }
    return b;
  };
  const envGain = (c, out, t, a, d, v) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(out); return g;
  };
  const tone = (c, out, t, { f = 440, f2, type = "sine", a = 0.004, d = 0.1, v = 0.2 }) => {
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    o.connect(envGain(c, out, t, a, d, v));
    o.start(t); o.stop(t + a + d + 0.03);
  };
  const noise = (c, out, t, { f = 2000, f2, q = 1, type = "bandpass", a = 0.005, d = 0.06, v = 0.1 }) => {
    const s = c.createBufferSource(); s.buffer = noiseBuf(c); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    s.connect(fl); fl.connect(envGain(c, out, t, a, d, v));
    s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.03);
  };
  const jit = (x, p = 0.04) => x * (1 + (Math.random() - 0.5) * 2 * p);

  const SOUNDS = {
    hover:   (c, o, t) => tone(c, o, t, { f: jit(1900), f2: 2300, d: 0.03, v: 0.035 }),
    card:    (c, o, t) => { noise(c, o, t, { f: 500, f2: 2600, q: 0.8, a: 0.012, d: 0.1, v: 0.07 }); tone(c, o, t, { f: jit(520), f2: 760, type: "triangle", d: 0.09, v: 0.04 }); },
    click:   (c, o, t) => { tone(c, o, t, { f: jit(760), f2: 300, type: "square", a: 0.002, d: 0.04, v: 0.07 }); noise(c, o, t, { f: 3500, type: "highpass", a: 0.001, d: 0.02, v: 0.06 }); },
    nav:     (c, o, t) => { tone(c, o, t, { f: 523, f2: 784, type: "triangle", d: 0.09, v: 0.13 }); tone(c, o, t + 0.05, { f: 1047, d: 0.13, v: 0.06 }); },
    confirm: (c, o, t) => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, o, t + i * 0.055, { f, type: "triangle", d: 0.15, v: 0.11 })); noise(c, o, t + 0.1, { f: 6000, type: "highpass", d: 0.12, v: 0.025 }); },
    cancel:  (c, o, t) => { tone(c, o, t, { f: 440, f2: 250, type: "triangle", d: 0.12, v: 0.12 }); tone(c, o, t + 0.06, { f: 330, f2: 190, type: "triangle", d: 0.12, v: 0.08 }); },
    tab:     (c, o, t) => { tone(c, o, t, { f: 1200, d: 0.03, v: 0.08 }); tone(c, o, t + 0.035, { f: 1560, d: 0.04, v: 0.07 }); },
    toggle:  (c, o, t) => { tone(c, o, t, { f: 600, f2: 920, d: 0.06, v: 0.11 }); noise(c, o, t, { f: 3000, type: "highpass", d: 0.015, v: 0.04 }); },
    focus:   (c, o, t) => tone(c, o, t, { f: 880, f2: 1100, d: 0.05, v: 0.045 }),
    type:    (c, o, t) => { noise(c, o, t, { f: jit(2600, 0.15), q: 2, a: 0.001, d: 0.014, v: 0.055 }); tone(c, o, t, { f: jit(1900, 0.1), d: 0.02, v: 0.025 }); },
    back:    (c, o, t) => { noise(c, o, t, { f: 1500, q: 2, a: 0.001, d: 0.018, v: 0.055 }); tone(c, o, t, { f: 1100, d: 0.025, v: 0.025 }); },
    open:    (c, o, t) => { noise(c, o, t, { f: 300, f2: 3200, q: 0.9, a: 0.03, d: 0.17, v: 0.09 }); tone(c, o, t, { f: 400, f2: 800, d: 0.15, v: 0.07 }); tone(c, o, t + 0.12, { f: 880, d: 0.1, v: 0.06 }); },
    close:   (c, o, t) => { noise(c, o, t, { f: 3200, f2: 300, q: 0.9, a: 0.02, d: 0.14, v: 0.07 }); tone(c, o, t, { f: 800, f2: 400, d: 0.12, v: 0.06 }); },
    success: (c, o, t) => { tone(c, o, t, { f: 1318.5, d: 0.5, v: 0.1 }); tone(c, o, t, { f: 1975.5, d: 0.35, v: 0.05 }); tone(c, o, t + 0.09, { f: 2637, d: 0.6, v: 0.035 }); tone(c, o, t, { f: 659, type: "triangle", d: 0.4, v: 0.05 }); },
    error:   (c, o, t) => { [0, 0.17].forEach((dt) => tone(c, o, t + dt, { f: 170, f2: 110, type: "square", a: 0.005, d: 0.14, v: 0.06 })); },
    coin:    (c, o, t) => { tone(c, o, t, { f: 988, type: "square", d: 0.06, v: 0.05 }); tone(c, o, t + 0.07, { f: 1319, type: "square", d: 0.32, v: 0.05 }); },
    sparkle: (c, o, t) => { for (let i = 0; i < 6; i++) tone(c, o, t + i * 0.035, { f: 2000 + Math.random() * 3200, d: 0.13, v: 0.035 }); noise(c, o, t, { f: 4000, type: "highpass", a: 0.04, d: 0.25, v: 0.025 }); },
    whoosh:  (c, o, t) => noise(c, o, t, { f: 200, f2: 2400, q: 0.7, a: 0.07, d: 0.25, v: 0.08 }),
    flip:    (c, o, t) => { noise(c, o, t, { f: 1600, f2: 450, q: 0.8, a: 0.01, d: 0.12, v: 0.07 }); tone(c, o, t, { f: 700, f2: 480, type: "triangle", d: 0.1, v: 0.06 }); },
    pop:     (c, o, t) => tone(c, o, t, { f: jit(520), f2: 1250, d: 0.07, v: 0.08 }),
    tick:    (c, o, t, p = 0.5) => tone(c, o, t, { f: 500 + p * 1100, d: 0.03, v: 0.07 }),
  };
  const GAP = { hover: 45, card: 90, type: 28, back: 28, tick: 40, focus: 80, pop: 60, error: 400, success: 400 };

  // ---------- Engine ----------
  const BOOST = 2.8; // the synth voices are written quiet; this is the make-up gain
  let ctx = null, master = null, unlocked = false;
  const last = {};
  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      if (!unlocked && !(navigator.userActivation && navigator.userActivation.hasBeenActive)) return null; // never start before a gesture
      ctx = new AC();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      master.connect(comp); comp.connect(ctx.destination);
      master.gain.value = st.sVol * BOOST;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  };
  const PARENT = (() => { try { return EMBED && window.parent.RBAudio; } catch { return null; } })();

  function sfx(name, arg) {
    if (PARENT) return PARENT.sfx(name, arg);
    if (!st.sfx || st.mute || !SOUNDS[name]) return;
    const now = performance.now();
    if (now - (last[name] || 0) < (GAP[name] || 0)) return;
    last[name] = now;
    const c = ensure();
    if (!c || c.state !== "running") return;
    master.gain.value = st.sVol * BOOST;
    try { SOUNDS[name](c, master, c.currentTime + 0.005, arg); } catch { /* never break the page over a blip */ }
  }

  // ---------- Music ----------
  let loadingMusic = false, music = null, wantPlay = false, fadeTimer = 0, gestureArmed = false;
  const musicAllowed = () => !EMBED && (!PLAYPAGE || loadingMusic) && st.music && !st.mute && !document.hidden;
  const fadeTo = (v, ms = 900, done) => {
    clearInterval(fadeTimer);
    const m = music, from = m.volume, t0 = performance.now();
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      m.volume = Math.max(0, Math.min(1, from + (v - from) * k));
      if (k >= 1) { clearInterval(fadeTimer); done && done(); }
    }, 40);
  };
  let musicReady = null;
  const initMusic = () => {
    if (music || EMBED) return;
    music = new Audio(asset("audio/menu-theme.mp3"));
    music.loop = true; music.preload = "auto"; music.volume = 0;
    const saved = parseFloat(store.get("rb.fx.t") || "0");
    // Seek to where the previous page left off *before* playing (seeking needs metadata, and on servers without Range support, the full file).
    musicReady = new Promise((res) => {
      let done = false;
      const finish = () => { if (!done) { done = true; res(); } };
      const seek = () => {
        if (!(saved > 1) || !isFinite(music.duration)) return;
        const t = saved % music.duration;
        if (Math.abs(music.currentTime - t) > 2) { try { music.currentTime = t; } catch { /* ignore */ } }
      };
      music.addEventListener("loadedmetadata", seek);
      music.addEventListener("canplaythrough", () => { seek(); setTimeout(finish, 80); }, { once: true });
      setTimeout(finish, 3500);
    });
    let lastSave = 0;
    music.addEventListener("timeupdate", () => { const n = Date.now(); if (n - lastSave > 1000) { lastSave = n; store.set("rb.fx.t", String(music.currentTime)); } });
    addEventListener("pagehide", () => store.set("rb.fx.t", String(music.currentTime)));
  };
  const armGesture = () => {
    if (gestureArmed) return; gestureArmed = true;
    const go = () => { gestureArmed = false; removeEventListener("pointerdown", go, true); removeEventListener("keydown", go, true); syncMusic(); };
    addEventListener("pointerdown", go, true); addEventListener("keydown", go, true);
  };
  function syncMusic() {
    if (EMBED) return;
    if (musicAllowed()) {
      initMusic();
      musicReady.then(() => { if (!musicAllowed()) return; return music.play().then(() => { wantPlay = true; fadeTo(st.mVol, 1600); }); }).catch(() => { armGesture(); }); // blocked until a click/key
    } else if (music && !music.paused) {
      fadeTo(0, 500, () => music.pause());
    }
  }
  const setMusicVol = () => { if (music && !music.paused) { clearInterval(fadeTimer); music.volume = st.mVol; } };
  document.addEventListener("visibilitychange", syncMusic);

  // ---------- Public state API ----------
  const API = {
    sfx, state: st,
    set(patch) { Object.assign(st, patch); if ("sVol" in patch && master) master.gain.value = st.sVol * BOOST; setMusicVol(); syncMusic(); commit(); },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    SOUNDS, GAP,
    get music() { return music; },
  };
  window.RBAudio = API;

  // ---------- Sound UI: dock + settings block ----------
  const ICON_ON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  let uid = 0;
  function controls() {
    const n = ++uid;
    const row = (key, label, volKey) => `
      <div class="fx-row">
        <label class="fx-sw"><input type="checkbox" data-k="${key}" id="fx${n}${key}"><span class="fx-knob"></span><span class="fx-lab">${label}</span></label>
        ${volKey ? `<input type="range" class="fx-vol" min="0" max="1" step="0.01" data-v="${volKey}" aria-label="${label} volume">` : ""}
      </div>`;
    const el = $el(`<div class="fx-controls">
      ${row("music", "Music", "mVol")}${row("sfx", "Sound effects", "sVol")}${row("art", "Poster art (ads, loading screens)")}
      <p class="fx-note"></p></div>`);
    const sync = () => {
      el.querySelectorAll("[data-k]").forEach((i) => { i.checked = !!st[i.dataset.k]; });
      el.querySelectorAll("[data-v]").forEach((i) => { i.value = st[i.dataset.v]; i.disabled = !st[i.dataset.v === "mVol" ? "music" : "sfx"]; });
      el.querySelector(".fx-note").textContent = PLAYPAGE ? "Music plays while the game loads, then rests." : (st.mute ? "Muted. Press M to unmute." : "♪ Roblox Main Menu Theme · press M to mute");
    };
    el.addEventListener("input", (e) => {
      const i = e.target;
      if (i.dataset.k) API.set({ [i.dataset.k]: i.checked });
      else if (i.dataset.v) { API.set({ [i.dataset.v]: parseFloat(i.value) }); if (i.dataset.v === "sVol") sfx("tick", parseFloat(i.value)); }
    });
    el.addEventListener("change", (e) => { if (e.target.dataset.k && e.target.checked) sfx("toggle"); });
    subs.add(sync); sync();
    return el;
  }
  API.controls = controls;

  function mountDock() {
    if (EMBED || document.getElementById("fxDock")) return;
    const dock = $el(`<div class="fx-dock" id="fxDock">
      <div class="fx-pop" id="fxPop" role="dialog" aria-label="Sound settings" hidden>
        <div class="fx-pop-h"><span>Sound</span><button type="button" class="fx-pop-x" aria-label="Close" data-sfx="close">&times;</button></div>
      </div>
      <button type="button" class="fx-btn" id="fxBtn" aria-expanded="false" aria-controls="fxPop" title="Sound settings (M to mute)" data-sfx="open"></button>
    </div>`);
    dock.querySelector(".fx-pop").appendChild(controls());
    document.body.appendChild(dock);
    const btn = dock.querySelector("#fxBtn"), pop = dock.querySelector("#fxPop");
    const paint = () => {
      const off = st.mute || (!st.music && !st.sfx);
      btn.innerHTML = off ? ICON_OFF : ICON_ON;
      btn.classList.toggle("is-off", off);
      btn.classList.toggle("is-live", !off && st.music && !PLAYPAGE);
    };
    subs.add(paint); paint();
    const toggle = (open) => { pop.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
    btn.addEventListener("click", () => toggle(pop.hidden));
    dock.querySelector(".fx-pop-x").addEventListener("click", () => toggle(false));
    document.addEventListener("pointerdown", (e) => { if (!pop.hidden && !dock.contains(e.target)) toggle(false); }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) toggle(false); });
  }

  // "M" mutes / unmutes everything (not while typing).
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "m" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (PARENT) return;
    const unmuting = st.mute; API.set({ mute: !st.mute });
    if (unmuting) sfx("toggle");
  });

  // ---------- Sound wiring: hover / click / type / modal / messages ----------
  addEventListener("pointerdown", () => { unlocked = true; ensure(); }, true);
  addEventListener("keydown", () => { unlocked = true; ensure(); }, true);
  addEventListener("touchstart", () => { unlocked = true; ensure(); }, { capture: true, passive: true });

  const HOVER_SEL = 'a[href], button, .Button, input:not([type=hidden]), select, textarea, summary, [role=tab], [role=button], [onclick], .GameThumbnail, .Game, .Item, .Friend, .PlayButton, .ItemGrid > *, .FriendGrid > *';
  const CARD_SEL = ".GameThumbnail, .Game, .Item, .Friend, .ItemGrid > *, .FriendGrid > *";
  let lastHover = null;
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    const el = e.target.closest && e.target.closest(HOVER_SEL);
    if (el === lastHover) return;
    lastHover = el;
    if (!el || el.disabled || el.closest("[data-sfx=off]")) return;
    if (el.matches("input[type=range]")) return;
    sfx(el.matches(CARD_SEL) && !el.matches("a.Button, button") ? "card" : "hover");
  }, true);

  const TEXTY = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]), textarea";
  function clickKind(el) {
    const ov = el.closest("[data-sfx]"); if (ov) return ov.dataset.sfx === "off" ? null : ov.dataset.sfx;
    if (el.matches("label")) return null; // the control it points at fires its own click
    if (el.matches("input[type=range], " + TEXTY)) return null;
    if (el.matches("input[type=checkbox], input[type=radio], select")) return "toggle";
    if (el.closest(".ModalButtons")) return el.classList.contains("Green") ? "confirm" : "cancel";
    if (el.matches(".PlayButton, .Button.Green, .Submit, [type=submit]")) return "confirm";
    if (el.matches(".Button.Red")) return "cancel";
    if (el.closest(".LoginTabs, [role=tab], .Tabs, .tabs")) return "tab";
    if (el.closest(".Navigation, #Logo, .FooterNav, .Pager, .BigLogo")) return "nav";
    if (el.matches("a[href]")) return "nav";
    return "click";
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("a[href], button, .Button, input, select, summary, [role=tab], [role=button], [onclick], .PlayButton");
    if (!el || el.disabled) return;
    const k = clickKind(el); if (k) sfx(k);
  }, true);

  // Give a navigation click a moment to be heard before the page unloads.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.dataset.app || a.hasAttribute("download") || (a.target && !["_self", "_top"].includes(a.target))) return;
    const href = a.getAttribute("href") || "";
    if (/^(#|javascript:|mailto:|tel:)/i.test(href) || a.origin !== location.origin) return;
    if (a.closest("[data-sfx=off]")) return;
    if (PARENT ? !PARENT.state.sfx : !(st.sfx && !st.mute && ctx && ctx.state === "running")) return;
    e.preventDefault();
    const w = a.target === "_top" ? window.top : window;
    setTimeout(() => { try { w.location.href = a.href; } catch { location.href = a.href; } }, 120);
  });

  document.addEventListener("focusin", (e) => { if (e.target.matches && e.target.matches(TEXTY) && !e.target.closest("[data-sfx=off]")) sfx("focus"); });
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat && e.key.length > 1) return;
    const t = e.target; if (!t.matches || !t.matches(TEXTY) || t.closest("[data-sfx=off]")) return;
    if (e.key === "Backspace" || e.key === "Delete") sfx("back");
    else if (e.key === "Enter" && t.tagName !== "TEXTAREA") sfx("click");
    else if (e.key.length === 1 || e.key === "Enter") sfx("type");
  }, true);
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches && t.matches("input[type=range]") && !t.closest(".fx-controls")) sfx("tick", (t.value - (t.min || 0)) / ((t.max || 100) - (t.min || 0)));
  });
  document.addEventListener("change", (e) => { if (e.target.matches && e.target.matches("select")) sfx("toggle"); });

  // Modals, status messages and chat lines appear via JS, so watch for them.
  const seenMsg = new WeakMap();
  const watch = () => {
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.removedNodes) if (n.nodeType === 1 && n.classList.contains("Modal")) sfx("close");
        for (const n of m.addedNodes) {
          const el = n.nodeType === 1 ? n : n.parentElement; if (!el) continue;
          if (n.nodeType === 1 && n.classList.contains("Modal")) { sfx("open"); continue; }
          const msg = el.closest && el.closest(".Error, .Success, .LoginError, .error, .success");
          if (msg && !el.closest(".fx-controls")) {
            const txt = msg.textContent.trim();
            if (txt && seenMsg.get(msg) !== txt) { seenMsg.set(msg, txt); sfx(/success/i.test(msg.className) ? "success" : "error"); }
            continue;
          }
          if (n.nodeType === 1 && n.matches(".line") && n.parentElement && n.parentElement.id === "Log") sfx("pop");
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  };

  // Balances counting up on a page = coins.
  if (typeof RB !== "undefined" && RB.countUp && !REDUCED) {
    const orig = RB.countUp;
    RB.countUp = function (root) { if (root && root.querySelector && root.querySelector("[data-count]")) setTimeout(() => sfx("coin"), 120); return orig.apply(this, arguments); };
  }

  // =====================================================================================
  // Art
  // =====================================================================================
  const ART = [
    { id: "zombies",    src: "img/art/zombies.webp",    title: "Zombies: Relentless Mutation", by: "Sleepernuts", w: 720, h: 900, tilt: -4 },
    { id: "bloxectomy", src: "img/art/bloxectomy.webp", title: "Bloxectomy: Subspace Annihilation", by: "Sleepernuts", w: 900, h: 900, tilt: 3 },
    { id: "playharder", src: "img/art/playharder.webp", title: "Play Harder", by: "Sleepernuts", w: 720, h: 900, tilt: -2 },
    { id: "angelic",    src: "img/art/angelic.webp",    title: "Start Something Angelic", by: "astrovue", w: 900, h: 859, tilt: 4 },
    { id: "sonic",      src: "img/art/sonic.webp",      title: "Start Something Sonic", by: "astrovue", w: 900, h: 859, tilt: -3 },
  ];
  ART.forEach((a) => { a.url = asset(a.src); });
  const byId = Object.fromEntries(ART.map((a) => [a.id, a]));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // A shuffle bag that survives page loads: every graphic shows once before any repeats, and never twice in a row.
  const ss = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } } };
  function pick(exclude) {
    let bag; try { bag = JSON.parse(ss.get("rb.art.bag") || "[]").filter((i) => byId[i]); } catch { bag = []; }
    const prev = exclude || ss.get("rb.art.last");
    if (!bag.length) { bag = shuffle(ART.map((a) => a.id)); if (bag[bag.length - 1] === prev) bag.unshift(bag.pop()); }
    let id = bag.pop();
    if (id === prev && bag.length) { const alt = bag.pop(); bag.push(id); id = alt; }
    ss.set("rb.art.bag", JSON.stringify(bag)); ss.set("rb.art.last", id);
    return byId[id];
  }
  function pickMany(n) { const o = shuffle(ART.slice()); return o.slice(0, n); }

  // Tilt + glare toward the pointer on any element that has [data-tilt].
  const tiltAttach = (host, amt = 12) => {
    if (REDUCED) return;
    host.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = host.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      host.style.setProperty("--ry", ((px - 0.5) * amt).toFixed(1) + "deg");
      host.style.setProperty("--rx", ((0.5 - py) * amt * 0.8).toFixed(1) + "deg");
      host.style.setProperty("--gx", (px * 100).toFixed(0) + "%");
      host.style.setProperty("--gy", (py * 100).toFixed(0) + "%");
    });
    host.addEventListener("pointerleave", () => { for (const v of ["--rx", "--ry"]) host.style.removeProperty(v); });
  };

  // ---- Lightbox ----
  let lb = null;
  function openLightbox(art) {
    if (lb) return;
    let cur = art;
    const el = $el(`<div class="fx-lb" role="dialog" aria-modal="true">
      <div class="fx-lb-card">
        <button type="button" class="fx-lb-x" aria-label="Close" data-sfx="close">&times;</button>
        <div class="fx-lb-art"><img alt=""><i class="fx-glare"></i></div>
        <div class="fx-lb-bar">
          <div class="fx-lb-meta"><b></b><span></span></div>
          <div class="fx-lb-btns"><button type="button" class="Button" data-act="shuf" data-sfx="flip">&#8635; Shuffle</button> <button type="button" class="Button Green" data-act="close" data-sfx="close">Close</button></div>
        </div>
      </div></div>`);
    const img = el.querySelector("img"), box = el.querySelector(".fx-lb-art");
    const paint = (a, anim) => {
      const apply = () => { img.src = a.url; img.alt = a.title; el.setAttribute("aria-label", a.title); el.querySelector("b").textContent = a.title; el.querySelector(".fx-lb-meta span").textContent = "Art by " + a.by; };
      if (!anim || REDUCED) return apply();
      box.classList.add("out");
      setTimeout(() => { apply(); box.classList.remove("out"); box.classList.add("in"); setTimeout(() => box.classList.remove("in"), 280); }, 170);
    };
    paint(cur);
    const close = () => { if (!lb) return; document.removeEventListener("keydown", onKey, true); el.classList.add("leaving"); const done = () => { el.remove(); lb = null; }; REDUCED ? done() : setTimeout(done, 160); };
    const shuf = () => { cur = pick(cur.id); paint(cur, true); };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); sfx("close"); close(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === " ") { e.preventDefault(); sfx("flip"); shuf(); }
    };
    el.addEventListener("click", (e) => {
      if (e.target === el || e.target.closest("[data-act=close], .fx-lb-x")) close();
      else if (e.target.closest("[data-act=shuf]")) shuf();
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(el); lb = el;
    tiltAttach(box, 10);
    sfx("open");
    el.querySelector("[data-act=close]").focus({ preventScroll: true });
  }

  // ---- Loading screens ----
  const TIPS = [
    "Click the game to give it the keyboard. WASD to move, Space to jump, right-drag to look around.",
    "Press M any time to mute the music and sound effects.",
    "Log in every day for free Tix and ROBUX. Playing places earns even more Tix.",
    "Dress up your character in Avatar, then show it off on your Profile.",
    "Big places take a while to parse. Try \"Quickest to Load\" in Discover for a faster start.",
    "Say hi in the Guestbook, or catch up with friends in Chat.",
    "Every place here is a real 2006 to 2008 classic, running right in your browser.",
    "Named for the 2x2 brick, the first piece anyone ever placed.",
    "Click the poster art in the corner of the landing page to see it full size.",
    "Right-click drag spins the camera. Scroll to zoom in and out.",
  ];
  function buildLoader({ foot = true, bar = true, cls = "" } = {}) {
    const a = pick();
    const el = $el(`<div class="fx-ld ${cls}" role="presentation">
      <img class="fx-ld-bg" alt="" src="${a.url}">
      <div class="fx-ld-stage">
        <div class="fx-ld-poster"><img alt="${a.title}" src="${a.url}"><i class="fx-glare"></i></div>
        <div class="fx-ld-side"><div class="fx-ld-word" aria-hidden="true">2x2</div><div class="fx-ld-title">${a.title}</div><div class="fx-ld-by">Art by ${a.by}</div></div>
      </div>
      ${foot ? `<div class="fx-ld-foot"><div class="fx-tip"><b>TIP</b><span></span></div>${bar ? '<div class="fx-bar"><i></i></div>' : ""}</div>` : ""}
    </div>`);
    const tipEl = el.querySelector(".fx-tip span"), fill = el.querySelector(".fx-bar i");
    let ti = Math.floor(Math.random() * TIPS.length), tt = 0, pct = 0;
    const showTip = () => { if (!tipEl) return; tipEl.classList.remove("in"); void tipEl.offsetWidth; tipEl.textContent = TIPS[ti++ % TIPS.length]; tipEl.classList.add("in"); };
    showTip(); if (tipEl) tt = setInterval(showTip, 5200);
    return {
      el, art: a,
      progress(p) { pct = Math.max(pct, Math.min(100, p)); if (fill) fill.style.width = pct + "%"; },
      error() { el.classList.add("is-error"); },
      stop() { clearInterval(tt); },
    };
  }

  // Full-page loader for slow pages: appears only if a "Loading..." placeholder is still there after 400 ms.
  function mountPageLoader() {
    if (EMBED || PLAYPAGE || document.querySelector(".Landing")) return;
    const pending = () => [...document.querySelectorAll(".Empty, .GeoCenter, #PlaceName")].some((n) => /^\s*Loading/i.test(n.textContent));
    if (!pending()) return;
    setTimeout(() => {
      if (!pending() || !st.art) return;
      const L = buildLoader({ cls: "fx-ld-page" });
      document.body.appendChild(L.el); document.documentElement.classList.add("fx-loading");
      sfx("whoosh");
      const shownAt = performance.now(); let p = 6;
      L.progress(p);
      const fake = setInterval(() => { p += (94 - p) * 0.035; L.progress(p); }, 100);
      const poll = setInterval(() => {
        const over = performance.now() - shownAt > 20000;
        if ((pending() && !over) || performance.now() - shownAt < 900) return;
        clearInterval(poll); clearInterval(fake); L.progress(100); sfx("pop");
        setTimeout(() => { L.el.classList.add("leaving"); L.stop(); document.documentElement.classList.remove("fx-loading"); setTimeout(() => L.el.remove(), REDUCED ? 0 : 520); }, 260);
      }, 120);
    }, 400);
  }

  // The game launcher (play.html): poster behind the launcher dialog, real progress from play.html's "rb-progress" events.
  function mountPlayLoader() {
    if (!PLAYPAGE || EMBED) return;
    const overlay = document.getElementById("Loading"), launcher = document.getElementById("Launcher");
    if (!overlay || !launcher || getComputedStyle(overlay).display === "none") return;
    const L = buildLoader({ cls: "fx-ld-play", bar: false });
    overlay.insertBefore(L.el, overlay.firstChild); overlay.classList.add("fx-on");
    const prog = launcher.querySelector(".LauncherProgress");
    // The tip line lives inside the launcher panel so the poster gets the whole top of the frame.
    const tip = L.el.querySelector(".fx-tip"); if (tip && prog) launcher.insertBefore(tip, prog);
    const ft = L.el.querySelector(".fx-ld-foot"); if (ft) ft.remove();
    if (prog) { prog.insertAdjacentHTML("beforeend", '<i class="fx-fill"></i>'); }
    const fill = prog && prog.querySelector(".fx-fill");
    let pct = 3; if (fill) fill.style.width = pct + "%";
    addEventListener("rb-progress", (e) => { pct = Math.max(pct, (e.detail && e.detail.pct) || 0); if (fill) fill.style.width = pct + "%"; });
    new MutationObserver(() => { if (launcher.classList.contains("error")) { L.error(); } }).observe(launcher, { attributes: true, attributeFilter: ["class"] });
    // Music plays during the load, then gets out of the way of the game.
    loadingMusic = true; syncMusic();
    new MutationObserver(() => { if (overlay.classList.contains("hidden")) { loadingMusic = false; L.stop(); syncMusic(); } }).observe(overlay, { attributes: true, attributeFilter: ["class"] });
  }

  // ---- Ad billboards (Home + Discover) ----
  const ADS = {
    playharder: { t: "ph",    head: "PLAY HARDER.",              sub: "Roblox now on PlayStation®2.",                 cta: "Play now",         href: "games.html?sort=popular", pos: "50% 38%" },
    angelic:    { t: "xp",    head: "start something Angelic",   sub: "Make it divine. Take it to the sky.",             cta: "Browse the Catalog", href: "catalog.html",            pos: "22% 55%", ac: "#6fb52c" },
    sonic:      { t: "xp",    head: "start something Sonic",     sub: "Discover new music taste. Take it wherever you go.", cta: "Join the chat",    href: "chat.html?app=1",         pos: "18% 62%", ac: "#ee3fa4" },
    zombies:    { t: "metal", head: "ZOMBIES",                   sub: "“Relentless Mutation.” Out now on CD and vinyl.", cta: "Talk metal in the Forums", href: "forums.html", pos: "62% 62%" },
    bloxectomy: { t: "metal", head: "BLOXECTOMY",                sub: "“Subspace Annihilation.” Pure noise.",    cta: "See the newest places", href: "games.html?sort=newest", pos: "50% 42%", ac: "#b35cff" },
  };
  const adHtml = (a, kind) => {
    const d = ADS[a.id];
    return `<span class="fx-ad-label">Advertisement</span>
      <a class="fx-ad-box" href="${d.href}" data-sfx="nav" aria-label="${d.head}. ${d.sub}">
        <span class="fx-ad-art"><img alt="" src="${a.url}" style="object-position:${d.pos}"></span>
        <span class="fx-ad-copy"><b>${d.head}</b><i>${d.sub}</i></span>
        <span class="fx-ad-cta">${d.cta} &raquo;</span>
        <span class="fx-ad-shine" aria-hidden="true"></span>
      </a>
      <span class="fx-ad-foot"><span>Ads by <u>2x2</u></span><span>Art by ${a.by}</span></span>`;
  };
  function makeAd(kind) {
    const slot = $el(`<div class="fx-ad fx-ad--${kind}"></div>`);
    const paint = (a) => { const d = ADS[a.id]; slot.className = `fx-ad fx-ad--${kind} fx-t-${d.t}`; slot.style.setProperty("--ac", d.ac || ""); slot.innerHTML = adHtml(a, kind); };
    paint(pick());
    // Like an ad network: the creative refreshes now and then.
    setInterval(() => {
      if (document.hidden || slot.matches(":hover") || !slot.isConnected) return;
      slot.classList.add("swap");
      setTimeout(() => { paint(pick()); slot.classList.add("swap"); requestAnimationFrame(() => requestAnimationFrame(() => slot.classList.remove("swap"))); }, REDUCED ? 0 : 280);
    }, 28000);
    return slot;
  }
  function mountBillboards() {
    if (EMBED || PLAYPAGE) return;
    const page = location.pathname.split("/").pop();
    const targets = page === "home.html" ? [
      { sel: ".HomeWelcome", where: "afterend", kind: "leader" },
      { sel: ".Columns > .Left", where: "beforeend", kind: "rect" },
    ] : page === "games.html" ? [
      { sel: "#Games > .PageTitle", where: "afterend", kind: "leader" },
      { sel: ".DisplayFilters", where: "beforeend", kind: "rect" },
    ] : [];
    if (!targets.length) return;
    const done = new Set();
    const tryMount = () => {
      for (const t of targets) {
        if (done.has(t.sel)) continue;
        const host = document.querySelector(t.sel); if (!host) continue;
        done.add(t.sel);
        const ad = makeAd(t.kind); ad.classList.add("swap");
        host.insertAdjacentElement(t.where, ad);
        requestAnimationFrame(() => requestAnimationFrame(() => ad.classList.remove("swap")));
      }
      if (done.size === targets.length) mo.disconnect();
    };
    const mo = new MutationObserver(tryMount);
    mo.observe(document.body, { childList: true, subtree: true });
    tryMount(); setTimeout(() => mo.disconnect(), 30000);
  }

  // ---- Landing collage ----
  function mountDrift() {
    const host = document.querySelector(".Landing");
    if (!host || EMBED || host.querySelector(".fx-drift")) return;
    const slots = [
      { l: "1.5%", t: "2.5%",  w: 15, d: 14, rot: -7, delay: 0 },
      { r: "3%",   t: "5%",  w: 15, d: 22, rot: 6,  delay: -2 },
      { l: "4%",   b: "5%",  w: 14, d: 18, rot: 5,  delay: -4 },
      { r: "5%",   b: "6%",  w: 16, d: 26, rot: -5, delay: -6 },
    ];
    const arts = pickMany(slots.length);
    const wrap = $el(`<div class="fx-drift" aria-hidden="false"></div>`);
    slots.forEach((s, i) => {
      const a = arts[i];
      const it = $el(`<button type="button" class="fx-it" aria-label="View ${a.title}" data-sfx="open">
        <span class="fx-bob"><span class="fx-frame"><img alt="" decoding="async" src="${a.url}"><i class="fx-glare"></i></span></span></button>`);
      Object.assign(it.style, { left: s.l || "auto", right: s.r || "auto", top: s.t || "auto", bottom: s.b || "auto" });
      it.style.setProperty("--w", s.w + "vmin"); it.style.setProperty("--d", s.d); it.style.setProperty("--r", s.rot + "deg"); it.style.setProperty("--delay", s.delay + "s");
      it.style.setProperty("--in", i * 140 + 300 + "ms");
      it.addEventListener("click", (e) => { e.preventDefault(); openLightbox(a); });
      tiltAttach(it, 16);
      wrap.appendChild(it);
    });
    host.insertBefore(wrap, host.firstChild);
    if (!REDUCED) {
      host.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        const r = host.getBoundingClientRect();
        wrap.style.setProperty("--mx", (((e.clientX - r.left) / r.width) - 0.5).toFixed(3));
        wrap.style.setProperty("--my", (((e.clientY - r.top) / r.height) - 0.5).toFixed(3));
      });
    }
    setTimeout(() => sfx("sparkle"), 700);
  }
  API.art = { list: ART, pick, open: (id) => openLightbox(byId[id] || pick()) };

  // ---------- Boot ----------
  const boot = () => {
    mountDock(); mountDrift(); mountBillboards(); mountPageLoader(); mountPlayLoader(); watch();
    const noart = (x) => document.documentElement.classList.toggle("fx-noart", !x.art); subs.add(noart); noart(st);
    syncMusic();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
