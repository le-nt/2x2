// Native Node/SQLite administrator API for 2x2. No SvelteKit/Bun dependency.
// A website session + staff role + TOTP challenge are required for privileged actions.
import crypto from "node:crypto";
import { sha256, randomToken, cookie, verifyPassword, RateLimiter } from "./auth.mjs";

const ROLES = ["Unprivileged", "ForumModerator", "AssetManager", "Moderator", "Administrator", "SuperAdmin"];
const RANK = Object.fromEntries(ROLES.map((r, i) => [r, i]));
const MAX_BODY = 8192;
const ACTIONS = { Warn: 0, Ban_1Day: 86400000, Ban_3Day: 3 * 86400000,
  Ban_7Day: 7 * 86400000, Ban_14Day: 14 * 86400000, Delete: -1, Unban: 0 };
const FEATURES = { registration: "Allow new user registration", forumPosting: "Allow new forum threads and replies" };
const THROTTLE = new RateLimiter(12, 15 * 60000);

function code(secret, counter) {
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", secret).update(c).digest();
  const offset = mac[mac.length - 1] & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}
function totpMatches(secret, value, now = Date.now()) {
  if (!/^\d{6}$/.test(String(value ?? ""))) return false;
  const counter = Math.floor(now / 30000);
  return [-1, 0, 1].some(d => crypto.timingSafeEqual(Buffer.from(code(secret, counter + d)), Buffer.from(String(value))));
}
function newSecret() { return crypto.randomBytes(20).toString("hex"); }
function seal(secret, plain) {
  const key = crypto.createHash("sha256").update(String(secret)).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(x => x.toString("base64url")).join(".");
}
function unseal(secret, encrypted) {
  const [iv, tag, data] = String(encrypted).split(".").map(x => Buffer.from(x, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", crypto.createHash("sha256").update(String(secret)).digest(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
async function bodyJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw [413, "Request too large."];
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (!value || Array.isArray(value) || typeof value !== "object") throw Error();
    return value;
  } catch { throw [400, "Invalid JSON."]; }
}
function safeText(value, max = 500) {
  const out = String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ");
  if (!out || out.length > max) throw [400, "Required text is missing or too long."];
  return out;
}
function validId(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw [400, "Invalid user ID."];
  return n;
}
function sameOrigin(req, cfg) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const hosts = [req.headers.host];
    if (cfg.trustProxy) hosts.push(...String(req.headers["x-forwarded-host"] || "").split(",").map(x => x.trim()));
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && hosts.includes(parsed.host);
  } catch { return false; }
}
export function createAdmin({ db, cfg, secure }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_staff (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('ForumModerator','AssetManager','Moderator','Administrator','SuperAdmin')));
    CREATE TABLE IF NOT EXISTS admin_totp (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      secret TEXT NOT NULL, pending INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      web_session_hash TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_notes (id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      moderator_id INTEGER NOT NULL REFERENCES users(id), note TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_actions (id INTEGER PRIMARY KEY,
      target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL, reason TEXT NOT NULL, until_at INTEGER, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY,
      actor_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL,
      target TEXT NOT NULL, detail TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS site_features (key TEXT PRIMARY KEY, enabled INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_ack (action_id INTEGER PRIMARY KEY REFERENCES admin_actions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, acknowledged_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS site_banner (id INTEGER PRIMARY KEY CHECK(id=1), message TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
      updated_by INTEGER REFERENCES users(id), updated_at INTEGER NOT NULL);

    CREATE INDEX IF NOT EXISTS admin_audit_time ON admin_audit(created_at DESC);
    CREATE INDEX IF NOT EXISTS admin_actions_target ON admin_actions(target_id, created_at DESC);
  `);
  for (const [key] of Object.entries(FEATURES))
    db.prepare("INSERT OR IGNORE INTO site_features(key,enabled) VALUES (?,1)").run(key);
  const q = sql => db.prepare(sql);
  const audit = (actor, action, target, detail = "") =>
    q("INSERT INTO admin_audit(actor_id,action,target,detail,created_at) VALUES (?,?,?,?,?)").run(actor.id, action, String(target), detail, Date.now());
  const role = user => {
    if (!user) return "Unprivileged";
    if (user.username.toLowerCase() === "2x2" || user.id === 1 || (cfg.admins || []).some(a => a.toLowerCase() === user.username.toLowerCase()))
      return "SuperAdmin";
    return q("SELECT role FROM admin_staff WHERE user_id = ?").get(user.id)?.role || "Unprivileged";
  };
  const rank = user => RANK[role(user)] ?? 0;
  const send = (res, status, result) => {
    res.writeHead(status, {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
    res.end(JSON.stringify(result));
  };
  function authed(user, sessionHash, cookies) {
    if (!user || !sessionHash || !cookies.rbxcsa) return false;
    const row = q("SELECT * FROM admin_sessions WHERE token_hash = ? AND user_id = ? AND web_session_hash = ? AND expires_at > ?")
      .get(sha256(cookies.rbxcsa), user.id, sessionHash, Date.now());
    return Boolean(row);
  }
  function latestNotice(userId) {
    const a = q("SELECT id,action,reason,until_at,created_at FROM admin_actions WHERE target_id=? ORDER BY id DESC LIMIT 1").get(userId);
    if(!a || a.action==="Unban")return null;
    if(a.action==="Warn" || a.action==="Remind") {
      if(q("SELECT 1 FROM admin_ack WHERE action_id=? AND user_id=?").get(a.id,userId))return null;
      return {...a,kind:"warning"};
    }
    if(a.action==="Delete" || (a.action.startsWith("Ban_") && a.until_at>Date.now()))return {...a,kind:"ban"};
    return null;
  }
  function activeBan(userId) {
    const a = q("SELECT action, until_at FROM admin_actions WHERE target_id=? ORDER BY id DESC LIMIT 1").get(userId);
    return a && (a.action === "Delete" || (a.action.startsWith("Ban_") && a.until_at > Date.now())) ? a : null;
  }
  async function handle(req, res, url, user, sessionHash, cookies, ip) {
    try {
      if (!user) throw [401, "Sign in to 2x2 first."];
      const staffRole = role(user);
      if (rank(user) < 1) throw [403, "Staff access required."];
      const p = url.pathname.replace(/^\/api\/admin/, "");
      const method = req.method;
      const write = !["GET", "HEAD"].includes(method);
      if (write && (!sameOrigin(req,cfg) || !/^application\/json\b/i.test(req.headers["content-type"] || "")))
        throw [403, "Same-origin JSON request required."];
      const body = write ? await bodyJson(req) : {};
      const enrolled = q("SELECT pending FROM admin_totp WHERE user_id=?").get(user.id);
      const verified = authed(user, sessionHash, cookies);
      const requireRole = name => {
        if (!verified) throw [403, "Administrator authenticator verification required."];
        if (rank(user) < RANK[name]) throw [403, "Insufficient permission."];
      };
      const ok = payload => send(res,200,payload);
      if (p === "/status" && method === "GET")
        return ok({staffRole, enrolled: Boolean(enrolled && !enrolled.pending), verified,
          expiresAt: verified ? q("SELECT expires_at FROM admin_sessions WHERE token_hash=?").get(sha256(cookies.rbxcsa))?.expires_at : null});
      if (p === "/totp/setup" && method === "POST") {
        if (enrolled && !enrolled.pending) throw [409,"Authenticator is already enrolled."];
        if (THROTTLE.blocked("setup:"+user.id+":"+ip)) throw [429,"Too many attempts."];
        if (!await verifyPassword(String(body.password || ""), user.pw_hash)) {
          THROTTLE.hit("setup:"+user.id+":"+ip); throw [403,"Incorrect password."];
        }
        const secret = newSecret();
        q("INSERT INTO admin_totp(user_id,secret,pending) VALUES (?,?,1) ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,pending=1")
          .run(user.id,seal(cfg.secret,secret));
        const uri = "otpauth://totp/" + encodeURIComponent("2x2:"+user.username)
          + "?secret=" + Buffer.from(secret,"hex").toString("base64").replace(/=+$/,"")
          + "&issuer=2x2&algorithm=SHA1&digits=6&period=30";
        // Convert hexadecimal seed to RFC4648 Base32 as required by authenticator apps.
        const raw = Buffer.from(secret,"hex"); let bits=0, accumulator=0, base32="";
        for (const b of raw) { accumulator=(accumulator<<8)|b; bits+=8; while(bits>=5){bits-=5;base32+="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[(accumulator>>>bits)&31];}}
        if(bits)base32+="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[(accumulator<<(5-bits))&31];
        return ok({secret:base32,uri:uri.replace(/secret=[^&]*/,"secret="+base32)});
      }
      if ((p === "/totp/enroll" || p === "/totp/login") && method === "POST") {
        const key="totp:"+user.id+":"+ip;
        if (THROTTLE.blocked(key)) throw [429,"Too many verification attempts."];
        const row=q("SELECT secret,pending FROM admin_totp WHERE user_id=?").get(user.id);
        if (!row || (p === "/totp/enroll" ? !row.pending : !!row.pending))
          throw [400,"Authenticator setup state does not match."];
        let secret;
        try { secret=unseal(cfg.secret,row.secret); } catch { throw [500,"Authenticator secret could not be read."]; }
        if (!totpMatches(Buffer.from(secret,"hex"),body.code)) {
          THROTTLE.hit(key); throw [403,"Incorrect authenticator code."];
        }
        THROTTLE.reset(key);
        if (row.pending) q("UPDATE admin_totp SET pending=0 WHERE user_id=?").run(user.id);
        const token=randomToken(), expiry=Date.now()+6*3600000;
        q("DELETE FROM admin_sessions WHERE user_id=? OR expires_at < ?").run(user.id,Date.now());
        q("INSERT INTO admin_sessions(token_hash,user_id,web_session_hash,expires_at) VALUES (?,?,?,?)")
          .run(sha256(token),user.id,sessionHash,expiry);
        res.setHeader("Set-Cookie",cookie("rbxcsa",token,{maxAge:21600,secure}));
        audit(user,"ADMIN_LOGIN",user.id);
        return ok({ok:true,expiresAt:expiry});
      }
      if (p === "/logout" && method === "POST") {
        if(cookies.rbxcsa)q("DELETE FROM admin_sessions WHERE token_hash=?").run(sha256(cookies.rbxcsa));
        res.setHeader("Set-Cookie",cookie("rbxcsa","",{maxAge:0,secure}));
        return ok({ok:true});
      }

      if (p === "/banner" && method === "GET") {
        requireRole("Administrator");
        return ok({banner:q("SELECT message,enabled,updated_at FROM site_banner WHERE id=1").get()||{message:"",enabled:0}});
      }
      if (p === "/banner" && method === "POST") {
        requireRole("Administrator");
        if(typeof body.enabled!=="boolean")throw [400,"Enabled must be a boolean."];
        const message=String(body.message??"").trim().replace(/[\u0000-\u001f\u007f]/g," ");
        if(message.length>240 || (body.enabled&&!message))throw [400,"Banner text must be 1–240 characters when enabled."];
        q("INSERT INTO site_banner(id,message,enabled,updated_by,updated_at) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET message=excluded.message,enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=excluded.updated_at").run(message,body.enabled?1:0,user.id,Date.now());
        audit(user,"SITE_BANNER","site",JSON.stringify({enabled:body.enabled,message}));
        return ok({ok:true});
      }
      if (p === "/dashboard" && method === "GET") {
        requireRole("ForumModerator");
        return ok({userCount:q("SELECT COUNT(*) AS n FROM users").get().n,
          signUpsToday:q("SELECT COUNT(*) AS n FROM users WHERE created_at>=?").get(new Date().setHours(0,0,0,0)).n,
          activeBans:q("SELECT COUNT(*) AS n FROM (SELECT target_id, MAX(id) AS id FROM admin_actions GROUP BY target_id) latest JOIN admin_actions a ON a.id=latest.id WHERE a.action='Delete' OR (a.action LIKE 'Ban_%' AND a.until_at>?)").get(Date.now()).n,
          sessionExpires:q("SELECT expires_at FROM admin_sessions WHERE token_hash=?").get(sha256(cookies.rbxcsa))?.expires_at});
      }
      if (p === "/users" && method === "GET") {
        requireRole("Moderator");
        const search=String(url.searchParams.get("q")||"").trim().slice(0,60);
        const pattern="%"+search.replace(/[\\%_]/g,"\\$&")+"%";
        return ok({users:q("SELECT id,username,created_at,last_seen,tix,robux FROM users WHERE username LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 50").all(pattern)});
      }
      const userMatch=/^\/users\/(\d+)$/.exec(p);
      if(userMatch && method==="GET"){
        requireRole("Moderator");
        const id=validId(userMatch[1]);
        const target=q("SELECT id,username,created_at,last_seen,blurb,tix,robux FROM users WHERE id=?").get(id);
        if(!target)throw [404,"User not found."];
        return ok({user:target,ban:activeBan(id),
          history:q("SELECT a.action,a.reason,a.until_at,a.created_at,u.username AS actor FROM admin_actions a JOIN users u ON u.id=a.actor_id WHERE a.target_id=? ORDER BY a.id DESC LIMIT 30").all(id),
          notes:q("SELECT n.id,n.note,n.created_at,u.username AS author FROM admin_notes n JOIN users u ON u.id=n.moderator_id WHERE n.user_id=? ORDER BY n.id DESC LIMIT 50").all(id)});
      }
      const actionMatch=/^\/users\/(\d+)\/action$/.exec(p);
      if(actionMatch && method==="POST"){
        requireRole("Moderator");
        const id=validId(actionMatch[1]), target=q("SELECT id,username FROM users WHERE id=?").get(id);
        if(!target)throw [404,"User not found."];
        if(rank(target)>=rank(user) || id===user.id)throw [403,"Cannot moderate a peer, higher role, or yourself."];
        const action=String(body.action||"");
        if(!Object.hasOwn(ACTIONS,action))throw [400,"Unsupported moderation action."];
        const reason=safeText(body.reason,500);
        const until=ACTIONS[action]>0?Date.now()+ACTIONS[action]:null;
        db.exec("BEGIN IMMEDIATE");
        try{
          q("INSERT INTO admin_actions(target_id,actor_id,action,reason,until_at,created_at) VALUES (?,?,?,?,?,?)").run(id,user.id,action,reason,until,Date.now());
          if(action!=="Warn"&&action!=="Unban")q("DELETE FROM sessions WHERE user_id=?").run(id);
          audit(user,"MODERATION_"+action,id,reason);
          db.exec("COMMIT");
        }catch(e){db.exec("ROLLBACK");throw e;}
        return ok({ok:true,action,until});
      }
      const noteMatch=/^\/users\/(\d+)\/notes$/.exec(p);
      if(noteMatch&&method==="POST"){
        requireRole("Moderator");
        const id=validId(noteMatch[1]); if(!q("SELECT 1 FROM users WHERE id=?").get(id))throw [404,"User not found."];
        const note=safeText(body.note,2000);
        q("INSERT INTO admin_notes(user_id,moderator_id,note,created_at) VALUES (?,?,?,?)").run(id,user.id,note,Date.now());
        audit(user,"USER_NOTE",id,"Note added");return ok({ok:true});
      }
      if(p==="/forums"&&method==="GET"){
        requireRole("ForumModerator");
        const search=String(url.searchParams.get("q")||"").trim().slice(0,80).replace(/[^A-Za-z0-9 -]/g,"");
        return ok({threads:q("SELECT t.id,t.title,t.locked,t.pinned,t.created_at,b.name AS board,u.username AS author FROM threads t JOIN boards b ON b.id=t.board_id JOIN users u ON u.id=t.user_id WHERE t.title LIKE ? ORDER BY t.id DESC LIMIT 60").all("%"+search+"%")});
      }
      const forumParts=p.split("/");
      if(forumParts.length===3&&forumParts[1]==="forums"&&method==="POST"){
        requireRole("ForumModerator");
        const id=validId(forumParts[2]);
        if(typeof body.locked!=="boolean"||typeof body.pinned!=="boolean")throw [400,"Supply locked and pinned booleans."];
        const result=q("UPDATE threads SET locked=?, pinned=? WHERE id=?").run(body.locked?1:0,body.pinned?1:0,id);
        if(!result.changes)throw [404,"Thread not found."];
        audit(user,"FORUM_THREAD",id,JSON.stringify({locked:body.locked,pinned:body.pinned}));
        return ok({ok:true});
      }
      if(p==="/audit"&&method==="GET"){
        requireRole("Administrator");
        const page=Math.max(1,Math.min(1000,parseInt(url.searchParams.get("page"),10)||1));
        return ok({page,records:q("SELECT a.id,a.action,a.target,a.detail,a.created_at,u.username AS actor FROM admin_audit a JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 50 OFFSET ?").all((page-1)*50)});
      }
      if(p==="/features"&&method==="GET"){
        requireRole("SuperAdmin");
        return ok({features:q("SELECT key,enabled FROM site_features ORDER BY key").all().map(x=>({...x,enabled:Boolean(x.enabled),description:FEATURES[x.key]}))});
      }
      const feat=/^\/features\/([a-zA-Z]+)$/.exec(p);
      if(feat&&method==="POST"){
        requireRole("SuperAdmin");
        if(!Object.hasOwn(FEATURES,feat[1])||typeof body.enabled!=="boolean")throw [400,"Invalid feature flag."];
        q("UPDATE site_features SET enabled=? WHERE key=?").run(body.enabled?1:0,feat[1]);
        audit(user,"FEATURE_FLAG",feat[1],String(body.enabled));return ok({ok:true});
      }
      if(p==="/staff"&&method==="GET"){
        requireRole("SuperAdmin");
        return ok({staff:q("SELECT a.user_id,u.username,a.role FROM admin_staff a JOIN users u ON u.id=a.user_id ORDER BY u.username").all()});
      }
      if(p==="/staff"&&method==="POST"){
        requireRole("SuperAdmin");
        const id=validId(body.userId), next=String(body.role);
        if(!q("SELECT 1 FROM users WHERE id=?").get(id))throw [404,"User not found."];
        if(id===1||q("SELECT username FROM users WHERE id=?").get(id)?.username?.toLowerCase()==="2x2"||(cfg.admins||[]).some(a=>q("SELECT username FROM users WHERE id=?").get(id)?.username?.toLowerCase()===a.toLowerCase()))
          throw [403,"Bootstrap administrators are configured outside the database."];
        if(next==="Unprivileged"){
          q("DELETE FROM admin_staff WHERE user_id=?").run(id);
          q("DELETE FROM admin_sessions WHERE user_id=?").run(id);
        }else{
          if(!Object.hasOwn(RANK,next))throw [400,"Unknown role."];
          q("INSERT INTO admin_staff(user_id,role) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role").run(id,next);
          q("DELETE FROM admin_sessions WHERE user_id=?").run(id);
        }
        audit(user,"STAFF_ROLE",id,next);return ok({ok:true});
      }
      throw [404,"Admin endpoint not found."];
    }catch(e){
      const status=Array.isArray(e)?e[0]:500;
      if(status===500)console.error("[admin]",e);
      send(res,status,{error:Array.isArray(e)?e[1]:"Internal admin error."});
    }
  }
  return {handle,activeBan,latestNotice,role};
}
