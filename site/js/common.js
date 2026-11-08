// Shared helpers for every 2x2 page: API calls, the logged-in user, the site shell (top bar, side rail, footer),
// place catalog + thumbnails, toasts and dialogs.
// play.html depends on: RB.mount, RB.catalog, RB.map, RB.param, RB.playerName, RB.esc.
(() => {
  let t = "light";
  try { t = localStorage.getItem("rb.siteTheme") || t; } catch { /* storage blocked */ }
  // Preserve explicit dark/light preferences; older era values use the light 2016 remix.
  document.documentElement.dataset.theme = t === "dark" ? "dark" : "light";
})();

const RB = {
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
        // The server grants the daily bonus on the first /api/me of the day, which can happen on any page
        // (or on the landing page right before it redirects). Park it until a page can show it.
        if (d.bonus) { try { sessionStorage.setItem("rb.bonus", JSON.stringify(d.bonus)); } catch { /* ignore */ } }
        return d;
      });
    }
    return (await RB._me).user;
  },
  async refreshMe() {
    const u = await RB.me(true);
    RB.renderAuth(u);
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
  // Inventory metadata only. Missing/partial scans are explicitly unknown, never "no scripts".
  async capabilities() {
    if (!RB._capabilities) RB._capabilities = fetch("data/place-capabilities.json", {cache: "no-cache"})
      .then((r) => { if (!r.ok) throw new Error("No capability inventory"); return r.json(); })
      .then((d) => new Map((Array.isArray(d.places) ? d.places : []).map((p) => [p.id, p])))
      .catch(() => new Map());
    return RB._capabilities;
  },
  // maps.json plus live counts: visits (classic + 2x2), rbxVisits, mine, playing (usernames).
  async places() {
    const cat = await RB.catalog();
    let live = { visits: {}, mine: {}, playing: {} };
    try { live = await RB.api("places"); } catch { /* logged out */ }
    return cat.maps.map((m) => ({ ...m, rbxVisits: live.visits[m.id] || 0, visits: m.visits + (live.visits[m.id] || 0),
      mine: live.mine[m.id] || 0, playing: live.playing[m.id] || [] }));
  },
  // Records a visit, then opens the game page.
  async play(m) {
    const mobilePopup = matchMedia("(pointer: coarse)").matches ? window.open("about:blank", "_blank") : null;
    let res = null;
    try { res = await RB.api(`places/${encodeURIComponent(m.id)}/visit`, { method: "POST" }); } catch { /* still let them play */ }
    if (res?.reward) RB.refreshMe();
    const url = "play.html?id=" + encodeURIComponent(m.id);
    if (mobilePopup) mobilePopup.location.replace(url);
    else location.href = url;
    return res;
  },

  // ---------- Small utilities ----------
  param(name) { return new URLSearchParams(location.search).get(name) || ""; },
  esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
  num(n) { return Number(n || 0).toLocaleString("en-US"); },
  compact(n) {
    n = Number(n || 0);
    if (n < 1000) return String(n);
    const fmt = (v, s) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + s;
    return n < 1e6 ? fmt(n / 1e3, "K") : n < 1e9 ? fmt(n / 1e6, "M") : fmt(n / 1e9, "B");
  },
  date(ms) { return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); },
  datetime(ms) {
    return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
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

  // ---------- Icons (24px, stroke = currentColor) ----------
  icons: {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    games: '<rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="18" cy="13.7" r=".9" fill="currentColor"/>',
    catalog: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    avatar: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5"/>',
    friends: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.8-3.8 3.2-5.5 6.5-5.5s5.7 1.7 6.5 5.5"/><circle cx="17.5" cy="9.5" r="2.5"/><path d="M17.5 14.5c2.4 0 4 1.4 4.5 4.5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4V5Z"/>',
    forums: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/>',
    guestbook: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>',
    logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
    play: '<path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    cube: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    robux: '<path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4Z"/><rect x="9.2" y="9.2" width="5.6" height="5.6" rx=".8"/>',
    tix: '<path d="M3.5 7h17v3a2 2 0 0 0 0 4v3h-17v-3a2 2 0 0 0 0-4V7Z"/><path d="M9 7.5v9" stroke-dasharray="1.6 2"/>',
    profile: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18c1.2-2.4 3-3.4 5.5-3.4s4.3 1 5.5 3.4"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.8-3.8 3.2-5.5 6.5-5.5s5.7 1.7 6.5 5.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
  },
  icon(name, size = 22, cls = "") {
    if (name === "robux" || name === "tix") return `<img class="Icon CurrencyIcon ${name}${cls ? " " + cls : ""}" src="img/${name}.png" width="${size}" height="${size}" alt="" decoding="async">`;
    return `<svg class="Icon${cls ? " " + cls : ""}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RB.icons[name] || ""}</svg>`;
  },

  // ---------- Brand ----------
  // The 2x2 logo (site/img/logo-2x2.png).
  brick(size = 34) {
    return `<img class="BrickMark" src="img/logo-2x2.png" width="${size}" height="${size}" alt="" decoding="async">`;
  },
  // Use the bundled inline icons; the optional legacy PNG paths do not exist.
  navIcon(name) {
    return `<span class="NavIcon">${RB.icon(name)}</span>`;
  },
  logo(href = "home.html") {
    return `<a class="Logo" href="${href}" aria-label="2x2 home">${RB.brick(34)}<span class="Wordmark">2x2</span></a>`;
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
    return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" width="${w}" height="${h}" role="img" aria-label="${RB.esc(map.name)}">
      <defs><linearGradient id="s${map.id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${hue},55%,62%)"/><stop offset="1" stop-color="hsl(${hue},60%,88%)"/></linearGradient></defs>
      <rect width="160" height="58" fill="url(#s${map.id})"/>
      <rect y="56" width="160" height="44" fill="hsl(${(hue + 140) % 360},38%,42%)"/>
      <g fill="hsl(${(hue + 140) % 360},38%,52%)">${studs.join("")}</g>
      <rect x="62" y="34" width="36" height="24" rx="2" fill="#e2231a"/>
      <g fill="#f4574d"><circle cx="72" cy="31" r="4"/><circle cx="88" cy="31" r="4"/></g>
    </svg>`;
  },

  // One game card (shelves, grids, profile). `meta` overrides the default "era, visits" line.
  gameCard(m, meta) {
    const href = "game.html?id=" + encodeURIComponent(m.id);
    const live = m.playing && m.playing.length;
    return `<div class="Game"><a class="GameThumbnail" href="${href}" title="${RB.esc(m.name)}">${RB.thumb(m)}${live ? `<span class="Pill live">${m.playing.length} playing</span>` : ""}</a>
      <div class="GameDetails"><div class="GameName"><a href="${href}">${RB.esc(m.name)}</a></div>
      <div class="GameMeta">${meta ?? `<span>${RB.esc(m.era)}</span><span>${RB.compact(m.visits)} visits</span>`}</div></div></div>`;
  },

  // ---------- Shell: top bar, side rail, footer ----------
  nav: [
    ["home.html", "Home", "home"], ["games.html", "Games", "games"], ["catalog.html", "Catalog", "catalog"],
    ["avatar.html", "Avatar", "avatar"], ["friends.html", "Friends", "friends"], ["chat.html", "Chat", "chat"],
    ["forums.html", "Forums", "forums"], ["guestbook.html", "Guestbook", "guestbook"],
  ],
  header() {
    return `
      <div class="TopBar">
        <button class="NavToggle IconButton" type="button" aria-label="Open menu" aria-expanded="false">${RB.icon("menu")}</button>
        ${RB.logo()}
        <nav class="TopLinks" aria-label="Explore"><a href="games.html">Games</a><a href="catalog.html">Catalog</a><a href="avatar.html">Avatar</a><a href="forums.html">Community</a></nav>
        <form class="TopSearch" action="games.html" method="get" role="search">
          ${RB.icon("search", 18)}
          <input type="search" name="q" placeholder="Search" aria-label="Search games" maxlength="60" autocomplete="off">
        </form>
        <div id="Authentication"></div>
      </div>`;
  },
  sidebar(current) {
    const link = ([href, label, icon]) => `<a href="${href}"${label === current ? ' class="current" aria-current="page"' : ""}>${RB.navIcon(icon)}<span>${label}</span>${label === "Friends" ? '<b class="Badge" id="FriendBadge" hidden></b>' : ""}</a>`;
    return `<a class="RailUser" id="RailUser" href="profile.html" hidden><span class="RailInitial" id="RailInitial"></span><span class="RailName" id="RailName"></span></a>
      <nav aria-label="Main">${RB.nav.map(link).join("")}</nav>
      <a class="Button Primary RailPlay" href="games.html">Find a game</a>
      <div class="RailFoot">
        <a href="settings.html"${current === "Settings" ? ' class="current" aria-current="page"' : ""}>${RB.navIcon("settings")}<span>Settings</span></a>
        <a href="about.html"${current === "About" ? ' class="current" aria-current="page"' : ""}>${RB.navIcon("info")}<span>About 2x2</span></a>
      </div>
      <figure class="RailArtwork"><img src="img/ads/tree-perch.webp" width="160" height="145" alt="A classic Roblox character perched above the trees" loading="lazy"><figcaption>A little further from ordinary.</figcaption></figure>`;
  },
  renderAuth(u) {
    const el = document.getElementById("Authentication");
    if (!el) return;
    if (!u) {
      el.innerHTML = `<a class="Button" href="index.html">Log in</a><a class="Button Primary" href="index.html#signup">Sign up</a>`;
    } else {
      el.innerHTML = `
        <a class="Wallet robux" href="catalog.html" title="ROBUX">${RB.icon("robux", 22)}<span>${RB.num(u.robux)}</span></a>
        <a class="Wallet tix" href="catalog.html" title="Tickets">${RB.icon("tix", 22)}<span>${RB.num(u.tix)}</span></a>
        <div class="Account">
          <button class="AccountBtn" type="button" aria-haspopup="menu" aria-expanded="false">
            <span class="Initial UserHeadshot" aria-hidden="true">${RB.icon('avatar',20)}</span><span class="AccName">${RB.esc(u.username)}</span>${RB.icon("down", 16)}
          </button>
          <div class="Menu" role="menu" hidden>
            <a role="menuitem" href="profile.html">${RB.icon("profile", 18)}Profile</a>
            <a role="menuitem" href="settings.html">${RB.icon("settings", 18)}Settings</a>
            <a role="menuitem" href="about.html">${RB.icon("info", 18)}About 2x2</a>
            <form method="post" action="/__lock"><button role="menuitem" type="submit">Lock website</button></form>
            <button role="menuitem" type="button" id="LogoutLink">${RB.icon("logout", 18)}Log out</button>
          </div>
        </div>`;
      const btn = el.querySelector(".AccountBtn"), menu = el.querySelector(".Menu");
      const setOpen = (open) => { menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
      btn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(menu.hidden); });
      document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) setOpen(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { setOpen(false); btn.focus(); } });
      document.getElementById("LogoutLink").addEventListener("click", () => RB.logout());
      RB.headshot(el.querySelector('.UserHeadshot'),u.avatar,28);
    }
    const ru = document.getElementById("RailUser");
    if (ru) { ru.hidden = !u; if (u) { const av=document.getElementById("RailInitial");av.classList.add('UserHeadshot');RB.headshot(av,u.avatar,28);document.getElementById("RailName").textContent = u.username; } }
    const badge = document.getElementById("FriendBadge");
    if (badge) { badge.hidden = !(u && u.friendRequests); badge.textContent = u ? u.friendRequests : ""; }
  },
  async logout() {
    try { await RB.api("logout", { method: "POST" }); } catch { /* ignore */ }
    try { localStorage.removeItem("rb.name"); } catch { /* ignore */ }
    location.href = "index.html";
  },
  footer() {
    return `
      <footer class="Footer">
        <div class="FooterBrand">${RB.brick(22)}<b>2x2</b></div>
        <nav class="FooterNav" aria-label="Footer"><a href="games.html">Games</a><a href="forums.html">Forums</a><a href="guestbook.html">Guestbook</a><a href="chat.html">Chat</a><a href="about.html">About</a></nav>
        <p>2x2 is a private, non-commercial fan project. Classic places come from Novetus. Games use Project Pizda’s native WebAssembly client.
        ROBLOX is a trademark of Roblox Corporation. 2x2 is not affiliated with, endorsed by or connected to Roblox Corporation.
        <span class="ToyCredit"> Icons: <a href="https://www.iconshock.com/cartoon-icons/" target="_blank" rel="noopener">Sunny Day by Iconshock</a>.</span></p>
      </footer>`;
  },

  // Shows the page shell. Synchronous (play.html calls it); the account box fills in when /api/me answers.
  mount(current) {
    if(!document.getElementById('CommunityShellStyles')){
      const css=document.createElement('link');css.id='CommunityShellStyles';css.rel='stylesheet';css.href='css/community-shell.css';document.head.appendChild(css);
    }
    if (document.getElementById("PlayContainer")) document.documentElement.classList.add("Theater");
    const h = document.getElementById("Header");
    if (h) h.innerHTML = RB.header();
    // Display the latest server-controlled, text-only site announcement.
    if (h) {
      let bar=document.getElementById("SitewideAnnouncement");
      if(!bar){
        bar=document.createElement("div");bar.id="SitewideAnnouncement";bar.setAttribute("role","status");
        bar.style.cssText="display:none;text-align:center;padding:10px 22px;background:#5c3eaa;color:#fff;font:600 14px/1.5 Arial,sans-serif;border-bottom:1px solid #3b2878";
        h.insertAdjacentElement("afterend",bar);
      }
      fetch("/api/site/banner",{cache:"no-store",credentials:"same-origin"})
        .then(r=>r.ok?r.json():null).then(d=>{
          if(!d)return;
          bar.textContent=d.banner?.message||"";
          bar.style.display=d.banner?.message?"block":"none";
        }).catch(()=>{});
    }
    const s = document.getElementById("Sidebar");
    if (s) s.innerHTML = RB.sidebar(current);
    const f = document.getElementById("FooterSlot");
    if (f) f.innerHTML = RB.footer();
    RB.mountAds();
    // A moderation action can happen while the player is browsing. Check periodically
    // and send the affected signed-in user to the classic not-approved notice.
    if(!RB._noticeChecker){
      RB._noticeChecker=async()=>{
        if(location.pathname.endsWith("/not-approved.html"))return;
        try{
          const r=await fetch("/api/not-approved",{cache:"no-store",credentials:"same-origin"});
          if(!r.ok)return;
          const d=await r.json();
          if(d.notice)location.replace("/not-approved.html");
        }catch{}
      };
      RB._noticeChecker();
      RB._noticeInterval=setInterval(RB._noticeChecker,15000);
    }

    if (s && !document.getElementById("Scrim")) { const sc = document.createElement("div"); sc.id = "Scrim"; document.body.appendChild(sc); }
    const toggle = document.querySelector(".NavToggle");
    const setRail = (open) => { document.documentElement.classList.toggle("RailOpen", open); toggle?.setAttribute("aria-expanded", String(open)); };
    toggle?.addEventListener("click", () => setRail(!document.documentElement.classList.contains("RailOpen")));
    s?.addEventListener("click", (e) => { if (e.target.closest("a")) setRail(false); });
    document.getElementById("Scrim")?.addEventListener("click", () => setRail(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setRail(false); });

    RB.me().then((u) => {
      RB.renderAuth(u);
      if (!u) return;
      // One counted visit per browser session.
      try { if (!sessionStorage.getItem("rb.hit")) { RB.api("hits", { method: "POST" }).catch(() => {}); sessionStorage.setItem("rb.hit", "1"); } } catch { /* ignore */ }
      let bonus = null;
      try { bonus = JSON.parse(sessionStorage.getItem("rb.bonus") || "null"); sessionStorage.removeItem("rb.bonus"); } catch { /* ignore */ }
      if (bonus) RB.toast(`Daily bonus: +${RB.num(bonus.tix)} Tix and +${RB.num(bonus.robux)} Robux`, { title: `Welcome back, ${u.username}` });
    }, () => RB.renderAuth(null));
  },

  // mount() + require a logged-in user. Resolves to the user, or null after showing a login prompt.
  async page(current, { auth = true } = {}) {
    RB.mount(current);
    let u = null;
    try { u = await RB.me(); } catch (e) { RB.fatal(e.message); return null; }
    if (!u && auth) {
      RB.fatal(`Log in to see this page. <p><a class="Button Primary" href="index.html">Go to log in</a></p>`, "Login required", true);
      return null;
    }
    return u;
  },
  fatal(msg, title = "Something went wrong", html = false) {
    const main = document.getElementById("Main") || document.querySelector("main") || document.body;
    main.innerHTML = `<div class="StandardBox Notice"><h1 class="NoticeTitle">${RB.esc(title)}</h1><div class="BoxBody">${html ? msg : RB.esc(msg)}</div></div>`;
  },

  // ---------- Toast + dialogs ----------
  toast(message, { title = "", ms = 6000 } = {}) {
    let host = document.getElementById("Toasts");
    if (!host) { host = document.createElement("div"); host.id = "Toasts"; host.setAttribute("role", "status"); host.setAttribute("aria-live", "polite"); document.body.appendChild(host); }
    const t = document.createElement("div");
    t.className = "Toast";
    t.innerHTML = `${RB.brick(26)}<div>${title ? `<b>${RB.esc(title)}</b>` : ""}<span>${RB.esc(message)}</span></div><button type="button" class="IconButton" aria-label="Dismiss">${RB.icon("close", 16)}</button>`;
    host.appendChild(t);
    const gone = () => { t.classList.add("out"); setTimeout(() => t.remove(), 200); };
    t.querySelector("button").addEventListener("click", gone);
    setTimeout(gone, ms);
  },
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
      // Buttons are listed primary-first in `buttons`; show the dismiss button on the left, primary on the right.
      const btn = ([label], idx) => `<button class="Button${idx === 0 ? " Primary" : ""}" data-i="${idx}" type="button">${RB.esc(label)}</button>`;
      wrap.innerHTML = `<div class="ModalBox" role="alertdialog" aria-modal="true" aria-label="${RB.esc(title)}">
        <h2 class="ModalTitle">${RB.esc(title)}</h2>
        <div class="ModalBody">${bodyHtml}</div>
        <div class="ModalButtons">${buttons.map((b, i) => btn(b, i)).reverse().join("")}</div></div>`;
      document.body.appendChild(wrap);
      wrap.querySelector("button.Primary").focus();
      const done = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
      const onKey = (e) => { if (e.key === "Escape") done(buttons[buttons.length - 1][1]); };
      document.addEventListener("keydown", onKey);
      wrap.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-i]");
        if (b) done(buttons[b.dataset.i][1]);
        else if (e.target === wrap) done(buttons[buttons.length - 1][1]);
      });
    });
  },

  // A plain visitor count.
  counter(n) { return `<b class="Count" title="${RB.num(n)} visits">${RB.num(n)}</b>`; },

  pager(page, pages, href) {
    if (pages <= 1) return "";
    const out = [];
    out.push(page > 1 ? `<a class="Button" href="${href(page - 1)}">Previous</a>` : `<span class="Button" aria-disabled="true">Previous</span>`);
    out.push(`<span class="PageOf">Page ${page} of ${pages}</span>`);
    out.push(page < pages ? `<a class="Button" href="${href(page + 1)}">Next</a>` : `<span class="Button" aria-disabled="true">Next</span>`);
    return `<div class="Pager">${out.join("")}</div>`;
  },

  // Small rendered avatar for lists (uses avatar.js when loaded, a coloured silhouette otherwise).
  async headshot(el,avatar,size=64){
    if(!el)return;
    const stage=document.createElement('span');stage.className='UserHeadshotStage';
    stage.innerHTML=RB.icon('avatar',20);el.replaceChildren(stage);
    try{
      if(typeof RBAvatar==='undefined'){
        RB._avatarLoader ||= new Promise((resolve,reject)=>{
          const script=document.createElement('script');script.src='js/avatar.js';
          script.onload=resolve;script.onerror=reject;document.head.appendChild(script);
        });
        await RB._avatarLoader;
      }
      RBAvatar.headshot(stage,avatar,await RB.items(),size);
    }catch{/* Keep the neutral avatar silhouette when rendering is unavailable. */}
  },

  async mountAds(){
    const page=document.getElementById('Page');
    if(!page||page.dataset.adsMounted||document.documentElement.classList.contains('Theater')||document.body.classList.contains('Landing'))return;
    page.dataset.adsMounted='true';
    try{
      const payload=await RB.api('ads');
      const entries=(Array.isArray(payload.images)?payload.images:[]).filter(item=>
        item&&typeof item.src==='string'&&
        /^\/img\/(?:ads\/[^/]+|userads\/(?:skyscraper|banner|rectangle|feature)\/[^/]+|userads\/[^/]+)$/.test(item.src)&&
        ['skyscraper','banner','rectangle','feature'].includes(item.category));
      const groups={skyscraper:[],banner:[],rectangle:[],feature:[]};
      for(const entry of entries)groups[entry.category].push(entry);
      for(const list of Object.values(groups)){
        for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
      }
      const makeAd=(entry,category)=>{
        const ad=document.createElement('aside');
        ad.className='UserAd UserAd'+category;
        ad.setAttribute('aria-label','Community advertisement');
        const image=document.createElement('img');
        image.src=entry.src;
        image.alt='Archived Roblox community advertisement';
        image.loading='lazy';
        image.decoding='async';
        image.width=Number(entry.width)||({banner:728,rectangle:300,feature:800,skyscraper:160}[category]);
        image.height=Number(entry.height)||({banner:90,rectangle:250,feature:600,skyscraper:600}[category]);
        image.addEventListener('error',()=>{ad.hidden=true;},{once:true});
        const label=document.createElement('span');
        label.className='AdLabel';
        label.textContent='Advertisement';
        ad.append(image,label);
        return ad;
      };
      const main=page.querySelector('#Main');
      // Historical 728x90 leaderboard is above the place/game content.
      if(main&&groups.banner.length){
        const banner=makeAd(groups.banner[0],'banner');
        banner.classList.add('PlaceLeaderboard');
        main.prepend(banner);
      }
      // Rectangular ads belong alongside the place details, not stretched
      // vertically into skyscraper rail slots.
      if(main&&/\/game\.html$/i.test(location.pathname)){
        const info=main.querySelector('.PlaceInfo');
        const rectangle=groups.rectangle[0]||groups.feature[0];
        if(info&&rectangle)info.appendChild(makeAd(rectangle,rectangle.category));
      }
      if(groups.skyscraper.length){
        const content=document.createElement('div');
        content.className='PageContent';
        while(page.firstChild)content.appendChild(page.firstChild);
        const rail=(entry,side)=>{
          const ad=makeAd(entry,'skyscraper');
          ad.classList.add('SideAd','SideAd'+side);
          return ad;
        };
        const left=groups.skyscraper[0];
        const right=groups.skyscraper[1]||left;
        page.append(rail(left,'Left'),content,rail(right,'Right'));
        page.classList.add('AdLayout');
      }
    }catch(error){
      console.warn('[2x2 ads] Could not mount archive advertisements:',error);
    }
  },

  async avatarThumb(el, avatar, size = 60) {
    if (!window.RBAvatar) return;
    try { RBAvatar.render(el, avatar, await RB.items(), { scale: size / 6.4, angle: -18, still: true }); } catch { /* ignore */ }
  },
};
