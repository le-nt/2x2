// Forwards the public website to the authentic ASP.NET 2016 recreation.
// The Node application remains the owner of 2x2's sessions, APIs and native runtime.
// Disabled until RBX_2016_WEBSITE_URL is configured. Never silently falls back
// to the old frontend when the new site is unavailable.
import http from "node:http";
import https from "node:https";

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
]);

export function createWebsiteProxy(rawUrl = process.env.RBX_2016_WEBSITE_URL) {
  if (!rawUrl) return null;
  const target = new URL(rawUrl);
  if (!["http:", "https:"].includes(target.protocol)) throw Error("2016 website origin must be HTTP(S)");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)) {
    throw Error("2016 website must bind to loopback; front it with 2x2 Node server");
  }
  if (target.username || target.password || target.search || target.hash || target.pathname !== "/") {
    throw Error("2016 website URL must be a bare local origin, e.g. http://127.0.0.1:8090");
  }
  const transport = target.protocol === "https:" ? https : http;
  return function proxyWebsite(req, res) {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(key) && key !== "host") headers[key] = value;
    }
    headers.host = target.host;
    headers["x-forwarded-host"] = req.headers.host || "";
    headers["x-forwarded-proto"] = req.socket.encrypted ? "https" : "http";
    const upstream = transport.request(target.origin + req.url, {
      method: req.method,
      headers,
      timeout: 30000,
    }, response => {
      const out = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (!HOP_BY_HOP.has(key) && key !== "x-frame-options" &&
            key !== "content-security-policy" && key !== "cross-origin-opener-policy" &&
            key !== "cross-origin-embedder-policy" && key !== "cross-origin-resource-policy") out[key] = value;
      }
      // Preserve gate/wasm isolation headers already set by 2x2.
      if (!res.headersSent) res.writeHead(response.statusCode || 502, out);
      response.pipe(res);
    });
    upstream.on("timeout", () => upstream.destroy(Error("2016 website timeout")));
    upstream.on("error", error => {
      console.error("[2016 website proxy]", error.message);
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        res.end("2016 website unavailable; existing 2x2 API and native services are unaffected.");
      } else res.destroy();
    });
    req.pipe(upstream);
  };
}

export function isLegacyRuntimePath(pathname) {
  return pathname === "/play.html" || pathname === "/native-test.html" ||
    pathname === "/not-approved.html" ||
    pathname.startsWith("/native-client/") || pathname.startsWith("/native-client.") ||
    // Only the legacy game client's exact assets bypass ASP.NET. The 2016
    // recreation owns /CSS, /Scripts, /images and their MVC/handler routes.
    pathname.startsWith("/js/native-") ||
    pathname === "/js/common.js" || pathname === "/js/effects.js" ||
    pathname === "/js/motion.js" || pathname === "/js/not-approved.js" ||
    ["/css/site.css", "/css/retro.css", "/css/modern.css", "/css/r16.css",
      "/native-test.css", "/img/logo-2x2.png", "/img/mark.svg"].includes(pathname) ||
    pathname.startsWith("/img/catalog/") ||
    pathname.startsWith("/data/") || pathname.startsWith("/emu/");
}
