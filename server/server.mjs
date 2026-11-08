// 2x2 server: access-token gate, JSON API (node:sqlite) and the static site.
// Every response carries COOP/COEP/CORP so the emulator gets SharedArrayBuffer, and .wasm/.zip get the right types.
// Usage: node server.mjs [port]      (see README.md)
import http from "node:http";
import { createNative } from "./lib/native.mjs";
import { createAssetResolver } from "./lib/asset-resolver.mjs";
import { createAds } from "./lib/ads.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./lib/config.mjs";
import { openDb } from "./lib/db.mjs";
import { createApi } from "./lib/api.mjs";
import { createAdmin } from "./lib/admin.mjs";
import { gatePage } from "./lib/gate.mjs";
import { createGame } from "./lib/game.mjs";
import { hmac, safeEqual, sha256, parseCookies, cookie, RateLimiter } from "./lib/auth.mjs";
import { clientIp as netClientIp, startHttps, printBanner } from "./lib/net.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "site");
const { cfg, created, file: cfgFile } = loadConfig(here);
const port = Number(process.argv[2] || process.env.PORT || cfg.port || 8080);
// RBX_DATA_DIR lets tests use a throwaway database; the real one lives in server/data.
const db = openDb(process.env.RBX_DATA_DIR ? path.resolve(process.env.RBX_DATA_DIR) : path.join(here, "data"));
const catalog = JSON.parse(fs.readFileSync(path.join(here, "catalog.json"), "utf8"));
const places = new Map(JSON.parse(fs.readFileSync(path.join(root, "data", "maps.json"), "utf8")).maps.map((m) => [m.id, m]));
const secure = !!cfg.secureCookies;
const api = createApi({ db, cfg, catalog, places, secure });
const admin = createAdmin({ db, cfg, secure, serverDir:here });
const game = createGame({ db, root }); // game agent: avatar overlay zips, multiplayer servers

const GATE_COOKIE = "rbxgate";
const gateValue = hmac(cfg.secret, "gate:" + cfg.accessToken);
const gateLimiter = new RateLimiter(10, 15 * 60000);

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".wasm": "application/wasm",
  ".zip": "application/zip", ".png": "image/png", ".gif": "image/gif", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
  ".webp": "image/webp", ".avif": "image/avif", ".jpeg": "image/jpeg",
  ".wav": "audio/wav", ".mp3": "audio/mpeg",
};
// A CSP for our own pages. The emulator (emu*/) and the game page are left alone so they can use workers/wasm freely.
const CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; " +
  "connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'";

function baseHeaders(res) {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
}

function clientIp(req) {
  return netClientIp(req, cfg.trustProxy);
}

function safeNext(n) {
  n = String(n || "/");
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/";
}

function readForm(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 4096) req.destroy(); });
    req.on("end", () => resolve(new URLSearchParams(data)));
    req.on("error", () => resolve(new URLSearchParams()));
  });
}

function sendGate(res, status, opts) {
  const body = gatePage(opts);
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": CSP });
  res.end(body);
}

function grantGate(res, next) {
  res.writeHead(303, {
    "Set-Cookie": cookie(GATE_COOKIE, gateValue, { maxAge: 180 * 86400, secure }),
    Location: safeNext(next), "Cache-Control": "no-store",
  });
  res.end();
}

function rawSessionUser(cookies) {
  const tok = cookies.rbxsess;
  if (!tok) return { user: null, sessionHash: null };
  const h = sha256(tok);
  const user = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`).get(h, Date.now());
  return { user: user || null, sessionHash: user ? h : null };
}
function qAppeal(actionId,userId){
  return db.prepare("SELECT status,response,created_at,reviewed_at FROM admin_appeals WHERE action_id=? AND user_id=?").get(actionId,userId)||null;
}
function sessionUser(cookies) {
  const result=rawSessionUser(cookies);
  return result.user && admin.latestNotice(result.user.id) ? {user:null,sessionHash:null} : result;
}
async function readSmallJson(req) {
  const parts=[];let size=0;
  for await(const part of req){size+=part.length;if(size>4096)throw Error("Request too large.");parts.push(part);}
  const result=JSON.parse(Buffer.concat(parts).toString("utf8")||"{}");
  if(!result||Array.isArray(result)||typeof result!=="object")throw Error("Invalid request.");
  return result;
}
function sameOriginJson(req) {
  if(!/^application\/json\b/i.test(req.headers["content-type"]||""))return false;
  try {
    const origin=new URL(req.headers.origin);
    const allowed=[req.headers.host];
    if(cfg.trustProxy)allowed.push(...String(req.headers["x-forwarded-host"]||"").split(",").map(x=>x.trim()));
    return allowed.includes(origin.host);
  }catch{return false;}
}

const assetResolver = createAssetResolver({serverDir:here,siteDir:root,publicOrigin:cfg.native?.publicOrigin || ''});
const ads = createAds({siteDir:root});
const native = createNative({ db, cfg, root, port, assetResolver, sessionUser, isGated: cookies => safeEqual(cookies[GATE_COOKIE] || "", gateValue) });

function serveStatic(req, res, urlPath) {
  if (urlPath.endsWith("/")) urlPath += "index.html";
  const file = path.join(root, path.normalize(urlPath));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain" }).end("not found"); return; }
    const ext = path.extname(file).toLowerCase();
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const cache = ext === ".zip" || ext === ".wasm" || rel.startsWith("img/catalog/") ? "private, max-age=86400" : "no-cache";
    const headers = {
      "Content-Type": types[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": cache,
      "Last-Modified": st.mtime.toUTCString(),
    };
    if (ext === ".html" && !/^emu/.test(rel) && rel !== "play.html" && rel !== "native-test.html") headers["Content-Security-Policy"] = CSP;
    const ims = Date.parse(req.headers["if-modified-since"] || "");
    if (ims && ims >= Math.floor(st.mtimeMs / 1000) * 1000) { res.writeHead(304, { "Cache-Control": cache }).end(); return; }
    res.writeHead(200, headers);
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

async function handler(req, res) {
  baseHeaders(res);
  let url, urlPath;
  try {
    url = new URL(req.url, "http://x");
    urlPath = decodeURIComponent(url.pathname);
  } catch { res.writeHead(400).end(); return; }
  const cookies = parseCookies(req.headers.cookie);
  const ip = clientIp(req);
  const gated = safeEqual(cookies[GATE_COOKIE] || "", gateValue);

  if (urlPath === "/__lock" && req.method === "POST") {
    if (req.headers["sec-fetch-site"] === "cross-site") { res.writeHead(403).end(); return; }
    const current = sessionUser(cookies);
    if (current.sessionHash) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(current.sessionHash);
    res.writeHead(303, { Location: "/", "Cache-Control": "no-store", "Set-Cookie": [cookie(GATE_COOKIE, "", { maxAge: 0, secure }), cookie("rbxsess", "", { maxAge: 0, secure })] }).end(); return;
  }
  if (url.pathname.startsWith('/native/')) {
    console.log('[worker-auth-check]', JSON.stringify({
      path: url.pathname,
      hasWorkerKey: Boolean(req.headers.accesskey),
      workerAccepted: native.machine(req, url)
    }));
  }
  // Only the worker's narrow asset/heartbeat endpoints accept its separate server credential.
  if (native.machine(req, url)) {
    try { return await native.route(req, res, url, null, null); }
    catch { if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" }).end('{"error":"Worker request failed."}'); else res.destroy(); return; }
  }
  if (urlPath === "/api/asset" && cfg.native?.accessKey && req.headers.accesskey === cfg.native.accessKey) {
    return assetResolver.handle(req,res,url);
  }
  // ---- Gate ----
  if (urlPath === "/__gate" && req.method === "POST") {
    const form = await readForm(req);
    const next = safeNext(form.get("next"));
    if (gateLimiter.blocked(ip)) return sendGate(res, 429, { next, error: "Too many tries. Wait a few minutes and try again." });
    if (safeEqual(String(form.get("token") || "").trim(), cfg.accessToken)) { gateLimiter.reset(ip); return grantGate(res, next); }
    gateLimiter.hit(ip);
    return sendGate(res, 401, { next, error: "The password you typed is incorrect." });
  }
  // Shareable link: /?key=TOKEN sets the cookie and strips the key from the address bar.
  if (req.method === "GET" && url.searchParams.has("key")) {
    if (!gateLimiter.blocked(ip) && safeEqual(url.searchParams.get("key").trim(), cfg.accessToken)) {
      url.searchParams.delete("key");
      return grantGate(res, url.pathname + url.search);
    }
    gateLimiter.hit(ip);
  }
  if (!gated) {
    const wantsHtml = /text\/html/.test(req.headers.accept || "") || urlPath.endsWith("/") || urlPath.endsWith(".html");
    if (wantsHtml && req.method === "GET") return sendGate(res, 401, { next: safeNext(url.pathname + url.search) });
    res.writeHead(401, { "Content-Type": "text/plain", "Cache-Control": "no-store" }).end("2x2: access token required");
    return;
  }

  // Account-enforcement interstitial: suspended users may view their notice and log out,
  // but cannot access gameplay or authenticated APIs until enforcement ends.
  const rawAccount = rawSessionUser(cookies);
  const notice = rawAccount.user ? admin.latestNotice(rawAccount.user.id) : null;
  if (urlPath === "/api/not-approved" && req.method === "GET") {
    res.writeHead(rawAccount.user?200:401,{"Content-Type":"application/json","Cache-Control":"no-store"});
    const appeal=notice?qAppeal(notice.id,rawAccount.user.id):null;
    res.end(JSON.stringify({notice:notice||null,username:rawAccount.user?.username||null,appeal}));

    return;
  }
  if(urlPath==="/api/not-approved/appeal"&&req.method==="POST"){
    if(!sameOriginJson(req)){res.writeHead(403).end();return;}
    if(!rawAccount.user||!notice){res.writeHead(403).end();return;}
    try {
      const input=await readSmallJson(req);
      const message=String(input.message||"").trim();
      if(message.length<12||message.length>2000){res.writeHead(400,{"Content-Type":"application/json"}).end('{"error":"Appeal must be 12–2000 characters."}');return;}
      const existing=qAppeal(notice.id,rawAccount.user.id);
      if(existing){res.writeHead(409,{"Content-Type":"application/json"}).end('{"error":"An appeal has already been submitted for this action."}');return;}
      db.prepare("INSERT INTO admin_appeals(action_id,user_id,message,created_at) VALUES (?,?,?,?)").run(notice.id,rawAccount.user.id,message,Date.now());
      res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"}).end('{"ok":true}');return;
    } catch(e){res.writeHead(400,{"Content-Type":"application/json"}).end(JSON.stringify({error:"Could not submit appeal."}));return;}
  }
  if (urlPath === "/api/not-approved/ack" && req.method === "POST") {
    if(!sameOriginJson(req)){res.writeHead(403).end();return;}
    if(!rawAccount.user || !notice || notice.kind!=="warning"){res.writeHead(403).end();return;}
    db.prepare("INSERT OR IGNORE INTO admin_ack(action_id,user_id,acknowledged_at) VALUES (?,?,?)").run(notice.id,rawAccount.user.id,Date.now());
    res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"}).end('{"ok":true}');
    return;
  }
  if (notice) {
    if (urlPath === "/api/logout" && req.method === "POST") {
      if(!sameOriginJson(req)){res.writeHead(403).end();return;}
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(rawAccount.sessionHash);
      res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":cookie("rbxsess","",{maxAge:0,secure})}).end('{"ok":true}');
      return;
    }
    const allowed=urlPath==="/not-approved.html"||urlPath==="/js/not-approved.js";
    if(!allowed) {
      const wantsHtml=req.method==="GET" && (urlPath==="/"||urlPath.endsWith(".html")||urlPath==="/cs"||/text\/html/.test(req.headers.accept||""));
      if(wantsHtml){res.writeHead(302,{Location:"/not-approved.html","Cache-Control":"no-store"}).end();return;}
      if(urlPath.startsWith("/api/")||urlPath.startsWith("/native/")) {
        res.writeHead(403,{"Content-Type":"application/json","Cache-Control":"no-store"}).end('{"error":"Account moderation notice pending.","notApproved":true}');return;
      }
    }
  }
  if (urlPath === "/api/site/banner" && req.method === "GET") {
    const row=db.prepare("SELECT message,enabled,updated_at FROM site_banner WHERE id=1").get();
    res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});
    res.end(JSON.stringify({banner:row&&row.enabled?{message:row.message,updatedAt:row.updated_at}:null}));
    return;
  }
  if (urlPath.startsWith("/native/") || urlPath.startsWith("/api/native/")) {
    const { user, sessionHash } = sessionUser(cookies);
    try { return await native.route(req, res, url, user, sessionHash); }
    catch (error) { console.error("[2x2 native]", error.message); if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" }).end('{"error":"Native request failed."}'); else res.destroy(); return; }
  }
  // Numeric legacy asset IDs are resolved locally; no arbitrary external proxy.
  if (urlPath === "/api/asset" || urlPath === "/asset" || urlPath === "/asset/") {
    return assetResolver.handle(req, res, url);
  }
  // ---- API ----
  if (urlPath.startsWith("/api/admin/")) {
    const { user, sessionHash } = sessionUser(cookies);
    return admin.handle(req, res, url, user, sessionHash, cookies, ip);
  }
  if (ads(req,res,url)) return;
  if (urlPath.startsWith("/api/")) {
    const { user, sessionHash } = sessionUser(cookies);
    return api({ req, res, url, user, sessionHash, ip });
  }
  if (urlPath === "/cs" || urlPath === "/cs/") { res.writeHead(302, { Location: "/admin.html", "Cache-Control": "no-store" }).end(); return; }
  if (game(req, res, urlPath)) return;
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
  serveStatic(req, res, urlPath);
}

const server = http.createServer(handler);
// Listens on every interface (LAN included). Optional HTTPS listener: see lib/net.mjs and README.md.
const httpsPort = Number(process.env.RBX_HTTPS_PORT || cfg.httpsPort || 0);
server.listen(port, () => {
  printBanner({ port, httpsPort, token: cfg.accessToken, cfgFile, created });
});
function onUpgrade(req, socket, head) {
  try { if (!native.upgrade(req, socket, head, parseCookies(req.headers.cookie))) socket.destroy(); }
  catch { socket.destroy(); }
}
server.on("upgrade", onUpgrade);
const tlsServer = startHttps({ ...cfg, httpsPort }, here, handler);
tlsServer?.on("upgrade", onUpgrade);
server.on("close", () => native.close());
