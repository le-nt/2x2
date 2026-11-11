import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createWebsiteProxy, isLegacyRuntimePath } from "../server/lib/website-2016.mjs";

const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

test("2016 frontend proxy passes requests and responses to the real upstream", async () => {
  const upstream = http.createServer((req, res) => {
    assert.equal(req.headers.host?.startsWith("127.0.0.1:"), true);
    res.writeHead(201, { "Content-Type": "text/plain", "X-Test-Upstream": "yes" });
    req.pipe(res);
  });
  const port = await listen(upstream);
  const proxy = http.createServer(createWebsiteProxy(`http://127.0.0.1:${port}`));
  const proxyPort = await listen(proxy);
  try {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/Games?sort=recent`, {
      method: "POST", body: "from=2x2", headers: { "Content-Type": "text/plain" },
    });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("x-test-upstream"), "yes");
    assert.equal(await response.text(), "from=2x2");
  } finally {
    await close(proxy);
    await close(upstream);
  }
});

test("proxy rejects arbitrary remote or credentialed upstreams", () => {
  assert.throws(() => createWebsiteProxy("https://example.com"), /loopback/);
  assert.throws(() => createWebsiteProxy("http://user:pass@127.0.0.1:8080"), /bare local origin/);
});

test("only legacy game runtime paths bypass the website", () => {
  for (const p of ["/play.html", "/native-client/UniversalClient.wasm", "/data/maps.json", "/emu/index.html", "/js/native-client.js", "/js/common.js", "/css/site.css"]) {
    assert.equal(isLegacyRuntimePath(p), true, p);
  }
  for (const p of ["/", "/Home", "/Games", "/Login", "/CSS/Base/CSS/FetchCSS", "/Scripts/modernizr.js", "/css/2016-site.css", "/images/roblox-logo.png"]) {
    assert.equal(isLegacyRuntimePath(p), false, p);
  }
});
