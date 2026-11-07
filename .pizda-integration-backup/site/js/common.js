// Shared helpers for every 2x2 page: API calls, the logged-in user, the header/footer, place catalog + thumbnails, and talking to the desktop shell when we run inside one of its windows.
// play.html depends on: RB.mount, RB.catalog, RB.map, RB.param, RB.playerName, RB.esc.
const RB = {
  // Apps the desktop knows how to open. url is relative to the site root.
  apps: {
    games:     { title: "Games",         url: "games.html",     icon: "img/icons/games.svg",     w: 900, h: 640 },
    profile:   { title: "My Profile",    url: "profile.html",   icon: "img/icons/profile.svg",   w: 860, h: 620 },
    friends:   { title: "Friends",       url: "friends.html",   icon: "img/icons/friends.svg",   w: 820, h: 580 },
    forums:    { title: "Forums",        url: "forums.html",    icon: "img/icons/forums.svg",    w: 900, h: 620 },
    catalog:   { title: "Catalog",       url: "catalog.html",   icon: "img/icons/catalog.svg",   w: 920, h: 660 },
    avatar:    { title: "Avatar",        url: "avatar.html",    icon: "img/icons/avatar.svg",    w: 900, h: 660 },
    guestbook: { title: "Guestbook",     url: "guestbook.html", icon: "img/icons/guestbook.svg", w: 760, h: 620 },
    settings:  { title: "Settings",      url: "settings.html",  icon: "img/icons/settings.svg",  w: 640, h: 560 },
    about:     { title: "About",         url: "about.html",     icon: "img/icons/about.svg",     w: 640, h: 560 },
    play:      { title: "2x2 Native Player", url: "native-play.html",      icon: "img/icons/play.svg",      w: 860, h: 700 },
    // Opens as its own desktop window (not inside Internet Explorer).
    chat:      { title: "RBXChat",       url: "chat.html?app=1", icon: "@chat",     w: 800, h: 520, window: true },
  },

  // ---------- Desktop integration ----------
  desktop() {
    try { return window.parent !== window && window.parent.RBDesktop ? window.parent.RBDesktop : null; } catch { return null; }
  },
  // Opens an app: a new desktop window when embedded, a plain navigation otherwise.
  open(app, url) {
    const d = RB.desktop();
    url = url || RB.apps[app]?.url || "index.html";
    if (d) d.open(app, url); else location.href = url;
  },

  // ---------- API ----------
  async api(path, { method = "GET", body } = {}) {
    const opts = { method, headers: {}, credentials: "same-origin" };
    if (method !== "GET") { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body || {}); }
    let r;
    try { r = await fetch("api/" + path.replace(/^\/?(api\/)?/, ""), opts); }
    catch { throw Object.assign(new Error("Can't reach the 2x2 server."), { status: 0 }); }
    let data = {};
    try { data = await r.json(); } catch { /* not JSON */ }
    if (!r.ok) throw Object.assign(new Error(data.error || `Request failed (${r.status})`), { status: r.status, data });
    return data;
  },

  // The logged-in user (cached per page load). Also keeps localStorage "rb.name" in sync for the game page.
  async me(refresh) {
    if (!RB._me || refresh) {
      RB._me = RB.api("me").then((d) => {
        if (d.user) RB.setPlayerName(d.user.username);
        RB._bonus = d.bonus;
        return d;
      });
    }
    return (await RB._me).user;
  },
  async refreshMe() {
    const u = await RB.me(true);
    RB.renderAuth(u);
    RB.desktop()?.refreshUser?.();
    return u;
  },

  // Item catalog + BrickColors (cached per page).
  async items() {
    if (!RB._items) {
      RB._items = RB.api("catalog").then((d) => {
        d.byId = new Map(d.items.map((i) => [i.id, i]));
        d.byFile = {};
        for (const i of d.items) (d.byFile[i.type] ||= {})[i.file] = i;
        d.color = new Map(d.colors.map((c) => [c.id, c]));
        return d;
      });
    }
    return RB._items;
  },

  // ---------- Places ----------
  async catalog() {
    if (!RB._catalog) RB._catalog = fetch("data/maps.json").then((r) => r.json());
    return RB._catalog;
  },
  async map(id) {
    const cat = await RB.catalog();
    return cat.maps.find((m) => m.id === id);
  },
  // maps.json plus live counts: visits (classic + RBXBanland), rbxVisits, mine, playing (usernames).
  async places() {
    const cat = await RB.catalog();
    let live = { visits: {}, mine: {}, playing: {} };
    try { live = await RB.api("places"); } catch { /* logged out */ }
    return cat.maps.map((m) => ({ ...m, rbxVisits: live.visits[m.id] || 0, visits: m.visits + (live.visits[m.id] || 0),
      mine: live.mine[m.id] || 0, playing: live.playing[m.id] || [] }));
  },
  // Records a visit, then opens the game in a "RobloxApp.exe" window (or navigates when not on the desktop).
  async play(m) {
    const d = RB.desktop();
    const mobilePopup = !d && matchMedia("(pointer: coarse)").matches ? window.open("about:blank", "_blank") : null;
    let res = null;
    try { res = await RB.api(`places/${encodeURIComponent(m.id)}/visit`, { method: "POST" }); } catch { /* still let them play */ }
    if (res?.reward) RB.refreshMe();
    const url = "native-play.html?id=" + encodeURIComponent(m.id);
    if (d) d.play(m.id, m.name, url);
    else if (mobilePopup) mobilePopup.location.replace(url);
    else location.href = url;
    return res;
  },

  // Loads js/sky.js on demand and mounts the shader sky into a host element. Resolves to its controls, or null (no WebGL).
  sky(host, opts) {
    return new Promise((resolve) => {
      if (!host) return resolve(null);
      const go = () => { try { resolve(window.RBSky ? RBSky.mount(host, opts) : null); } catch { resolve(null); } };
      if (window.RBSky) return go();
      const s = document.createElement("script");
      s.src = "js/sky.js"; s.onload = go; s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  },

  // ---------- Small utilities ----------
  param(name) { return new URLSearchParams(location.search).get(name) || ""; },
  esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
  num(n) { return Number(n || 0).toLocaleString("en-US"); },
  date(ms) { return new Date(ms).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }); },
  datetime(ms) {
    return new Date(ms).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  },
  ago(ms) {
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return "just now";
    const units = [[60, "minute"], [3600, "hour"], [86400, "day"], [2592000, "month"], [31536000, "year"]];
    let [div, name] = units[0];
    for (const u of units) if (s >= u[0]) [div, name] = u;
    const n = Math.floor(s / div);
    return `${n} ${name}${n === 1 ? "" : "s"} ago`;
  },
  // User text: escape, then turn newlines into <br> and http(s) links into anchors that open a new tab.
  rich(s) {
    return RB.esc(s).replace(/https?:\/\/[^\s<>"']+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>`)
      .replace(/\n/g, "<br>");
  },
  userLink(name, cls = "") {
    return `<a${cls ? ` class="${cls}"` : ""} href="profile.html?u=${encodeURIComponent(name)}">${RB.esc(name)}</a>`;
  },
  playerName() {
    try { return localStorage.getItem("rb.name") || "Player"; } catch { return "Player"; }
  },
  setPlayerName(name) {
    try { localStorage.setItem("rb.name", name); } catch { /* storage blocked */ }
  },

  // Real screenshot (site/img/thumbs/<id>.png, when maps.json says "thumb": true) layered over a drawn
  // baseplate scene, so a missing/broken screenshot still shows something.
  thumb(map, w = 160, h = 100) {
    const art = RB.thumbArt(map, w, h);
    if (!map.thumb) return art;
    return `<span class="ThumbWrap">${art}<img class="ThumbShot" src="img/thumbs/${encodeURIComponent(map.id)}.png" alt="${RB.esc(map.name)}" loading="lazy" onerror="this.remove()"></span>`;
  },
  thumbArt(map, w = 160, h = 100) {
    const hue = map.hue;
    const studs = [];
    for (let y = 62; y < 100; y += 9) {
      for (let x = (y / 9) % 2 ? 6 : 1; x < 160; x += 12) studs.push(`<circle cx="${x}" cy="${y}" r="2.6"/>`);
    }
    return `<svg viewBox="0 0 160 100" width="${w}" height="${h}" role="img" aria-label="${RB.esc(map.name)}">
      <defs><linearGradient id="s${map.id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${hue},55%,62%)"/><stop offset="1" stop-color="hsl(${hue},60%,88%)"/></linearGradient></defs>
      <rect width="160" height="58" fill="url(#s${map.id})"/>
      <rect y="56" width="160" height="44" fill="hsl(${(hue + 140) % 360},38%,42%)"/>
      <g fill="hsl(${(hue + 140) % 360},38%,52%)">${studs.join("")}</g>
      <rect x="62" y="34" width="36" height="24" fill="hsl(${(hue + 40) % 360},70%,48%)" stroke="#000" stroke-width="1"/>
      <rect x="72" y="22" width="16" height="12" fill="#f5cd2f" stroke="#000" stroke-width="1"/>
      <text x="6" y="14" font-family="Arial" font-size="9" font-weight="bold" fill="#fff" stroke="#123" stroke-width="2" paint-order="stroke">${RB.esc(map.era)}</text>
    </svg>`;
  },

  // ---------- Header / footer ----------
  studs() { return `<span class="studs" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`; },
  logo(href = "home.html") {
    return `<a id="Logo" href="${href}" aria-label="2x2 home"><img src="img/logo.png" alt="" width="68" height="63"><span class="word">2x2</span><span class="beta">beta!</span></a>`;
  },
  nav: [
    ["home.html", "Home"], ["games.html", "Discover"], ["catalog.html", "Catalog"], ["avatar.html", "Avatar"],
    ["forums.html", "Community"], ["friends.html", "Friends"], ["guestbook.html", "Guestbook"], ["settings.html", "Settings"],
  ],
  header(current) {
    const items = RB.nav.map(([href, label]) =>
      `<li><a href="${href}"${label === current ? ' class="current" aria-current="page"' : ""}>${label}</a></li>`).join("");
    return `
      <div id="Banner">
        ${RB.logo()}
        <div id="Authentication"><span class="Loading">Loading&hellip;</span></div>
      </div>
      <nav class="Navigation" aria-label="Main"><ul>${items}</ul></nav>`;
  },
  renderAuth(u) {
    const el = document.getElementById("Authentication");
    if (!el) return;
    el.innerHTML = u
      ? `<div>Logged in as ${RB.userLink(u.username)} | <a href="#" id="LogoutLink">Log out</a></div>
         <div class="Currency"><span class="Robux" title="Robux" data-count="${u.robux | 0}" data-prefix="R$ ">R$ ${RB.num(u.robux)}</span> <span class="Tix" title="Tickets" data-count="${u.tix | 0}" data-prefix="Tix ">Tix ${RB.num(u.tix)}</span></div>`
      : `<div><a href="index.html" target="_top">Log in</a> | <a href="index.html" target="_top">Sign up</a></div>`;
    document.getElementById("LogoutLink")?.addEventListener("click", (e) => { e.preventDefault(); RB.logout(); });
    // Balances tick up the first time they appear on a page.
    if (u && !RB._counted) { RB._counted = true; RB.countUp(el); }
  },
  // Counts [data-count] numbers up from zero (skipped for reduced motion).
  countUp(root) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.querySelectorAll("[data-count]").forEach((n) => {
      const to = Number(n.dataset.count), pre = n.dataset.prefix || "", t0 = performance.now(), dur = 900;
      if (!to) return;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        n.textContent = pre + RB.num(Math.round(to * e));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },
  async logout() {
    try { await RB.api("logout", { method: "POST" }); } catch { /* ignore */ }
    try { localStorage.removeItem("rb.name"); } catch { /* ignore */ }
    const d = RB.desktop();
    if (d) d.loggedOut(); else location.href = "index.html";
  },
  footer() {
    return `
      <div id="Footer">
        <div class="FooterMark"><img src="img/logo.png" alt="" width="30" height="28"><span class="word">2x2</span></div>
        <div class="FooterNav"><a href="games.html">Discover</a> | <a href="forums.html">Community</a> | <a href="guestbook.html">Guestbook</a> | <a href="about.html">About</a></div>
        <p>2x2 is a private, non-commercial fan project. Classic places are presented on the web; gameplay uses a separately installed Windows client.</p>
        <p>Roblox is a trademark of Roblox Corporation. 2x2 is not affiliated with, endorsed by or connected to Roblox Corporation.</p>
      </div>`;
  },

  // Shows the page header/footer. Synchronous (play.html calls it); the user box fills in when /api/me answers.
  mount(current) {
    document.documentElement.classList.toggle("rb-embedded", window.parent !== window);
    if (document.getElementById("PlayContainer")) document.documentElement.classList.add("rb-play");
    const h = document.getElementById("Header");
    if (h) h.innerHTML = RB.header(current);
    const f = document.getElementById("FooterSlot");
    if (f) f.innerHTML = RB.footer();
    // Shader sky in the banner (skipped inside desktop windows, where many pages can be open at once).
    if (!document.documentElement.classList.contains("rb-embedded")) RB.sky(document.getElementById("Banner"), { mode: "banner" });
    RB.me().then(RB.renderAuth, () => RB.renderAuth(null));
    // Links with data-app open (or focus) another desktop window instead of navigating this one.
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-app]");
      if (!a) return;
      e.preventDefault();
      RB.open(a.dataset.app, a.getAttribute("href"));
    });
  },

  // mount() + require a logged-in user. Resolves to the user, or null after showing a login prompt.
  async page(current, { auth = true } = {}) {
    RB.mount(current);
    let u = null;
    try { u = await RB.me(); } catch (e) { RB.fatal(e.message); return null; }
    if (!u && auth) {
      RB.fatal(`Log in to see this page. <p><a class="Button Green" href="index.html" target="_top">Go to log in</a></p>`, "Login required", true);
      return null;
    }
    return u;
  },
  fatal(msg, title = "Error", html = false) {
    const main = document.getElementById("Main") || document.querySelector("main") || document.body;
    main.innerHTML = `<div class="StandardBox"><div class="StandardBoxHeader">${RB.esc(title)}</div><div class="BoxBody">${html ? msg : RB.esc(msg)}</div></div>`;
  },

  // A small message box. Resolves when closed.
  alert(message, { title = "2x2", html = false } = {}) {
    return RB._modal(html ? message : RB.esc(message), title, [["OK", true]]);
  },
  confirm(message, { title = "2x2", ok = "OK", cancel = "Cancel" } = {}) {
    return RB._modal(RB.esc(message), title, [[ok, true], [cancel, false]]);
  },
  _modal(bodyHtml, title, buttons) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "Modal";
      wrap.innerHTML = `<div class="ModalBox" role="alertdialog" aria-modal="true">
        <div class="StandardBoxHeader">${RB.esc(title)}</div>
        <div class="ModalBody">${bodyHtml}</div>
        <div class="ModalButtons">${buttons.map(([label], i) => `<button class="Button${i === 0 ? " Green" : ""}" data-i="${i}" type="button">${RB.esc(label)}</button>`).join(" ")}</div></div>`;
      document.body.appendChild(wrap);
      wrap.querySelector("button").focus();
      const done = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
      const onKey = (e) => { if (e.key === "Escape") done(buttons[buttons.length - 1][1]); };
      document.addEventListener("keydown", onKey);
      wrap.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-i]");
        if (b) done(buttons[b.dataset.i][1]);
      });
    });
  },

  // Old-school odometer hit counter markup.
  counter(n, digits = 7) {
    return `<span class="HitCounter" title="${RB.num(n)} visitors">${String(n).padStart(digits, "0").split("").map((d) => `<span>${d}</span>`).join("")}</span>`;
  },

  pager(page, pages, href) {
    if (pages <= 1) return "";
    const out = [];
    if (page > 1) out.push(`<a href="${href(page - 1)}">&laquo; Previous</a>`);
    out.push(`<span>Page ${page} of ${pages}</span>`);
    if (page < pages) out.push(`<a href="${href(page + 1)}">Next &raquo;</a>`);
    return `<div class="Pager">${out.join(" ")}</div>`;
  },

  // Small rendered avatar for lists (uses avatar.js when loaded, a coloured silhouette otherwise).
  async avatarThumb(el, avatar, size = 60) {
    if (!window.RBAvatar) return;
    try { RBAvatar.render(el, avatar, await RB.items(), { scale: size / 6.4, angle: -18, still: true }); } catch { /* ignore */ }
  },
};

// Stagger-in: tag a container's children with an index so CSS can drop them in one after another.
// Runs whenever content is rendered into #Main or a grid (pages set innerHTML after load).
(() => {
  const tag = (main) => {
    [...main.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 8)));
    // Boxes inside Left/Right columns count up across the whole page so they drop in as one sequence.
    let n = 0;
    for (const col of main.querySelectorAll(".Columns > .Left, .Columns > .Right")) {
      for (const b of col.children) if (b.classList.contains("StandardBox") && !b.style.getPropertyValue("--i")) b.style.setProperty("--i", Math.min(n++, 10));
    }
    for (const el of main.querySelectorAll(".GameList, .ItemGrid, .FriendGrid")) {
      [...el.children].forEach((c, i) => { if (!c.style.getPropertyValue("--i")) c.style.setProperty("--i", Math.min(i, 14)); });
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    const main = document.getElementById("Main");
    if (!main) return;
    main.classList.add("rb-build");
    new MutationObserver(() => tag(main)).observe(main, { childList: true, subtree: true });
    tag(main);
  });
})();

// Thumbnails tilt toward the mouse and carry a moving glare (CSS reads --rx/--ry/--gx/--gy).
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let cur = null;
  const reset = (el) => { for (const v of ["--rx", "--ry"]) el.style.removeProperty(v); };
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const t = e.target.closest ? e.target.closest(".GameThumbnail") : null;
    if (cur && cur !== t) { reset(cur); cur = null; }
    if (!t) return;
    cur = t;
    const r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    t.style.setProperty("--ry", ((px - .5) * 14).toFixed(1) + "deg");
    t.style.setProperty("--rx", ((.5 - py) * 11).toFixed(1) + "deg");
    t.style.setProperty("--gx", (px * 100).toFixed(0) + "%");
    t.style.setProperty("--gy", (py * 100).toFixed(0) + "%");
  });
  document.addEventListener("pointerleave", () => { if (cur) { reset(cur); cur = null; } }, true);
})();
