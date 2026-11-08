import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {createAssetResolver} from '../server/lib/asset-resolver.mjs';

test('an upstream 401 is reported as authentication-required, not an absent archive file', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '2x2-asset-auth-'));
  t.after(() => fs.rmSync(temp, {recursive:true,force:true}));
  const upstream = createServer((_req,res) => {
    res.writeHead(401,{'Content-Type':'application/json'});
    res.end('{"errors":[{"message":"Authentication required"}]}');
  });
  await new Promise(resolve => upstream.listen(0,'127.0.0.1',resolve));
  t.after(async () => {
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  });
  const previousAya = process.env.AYA_ASSET_FALLBACK_URL;
  const previousRoblox = process.env.ROBLOX_ASSET_FETCH;
  process.env.AYA_ASSET_FALLBACK_URL = 'http://127.0.0.1:' + upstream.address().port;
  process.env.ROBLOX_ASSET_FETCH = '0';
  t.after(() => {
    if(previousAya === undefined) delete process.env.AYA_ASSET_FALLBACK_URL;
    else process.env.AYA_ASSET_FALLBACK_URL = previousAya;
    if(previousRoblox === undefined) delete process.env.ROBLOX_ASSET_FETCH;
    else process.env.ROBLOX_ASSET_FETCH = previousRoblox;
  });
  const resolver = createAssetResolver({
    serverDir:path.join(temp,'server'),
    siteDir:path.join(temp,'site')
  });
  assert.equal(await resolver.resolve('999123456'),null);
  assert.equal(resolver.getFailureReason('999123456'),'upstream_auth_required');
});

test('local bytes remain preferred over failing upstream endpoints', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '2x2-asset-local-'));
  t.after(() => fs.rmSync(temp,{recursive:true,force:true}));
  const lib = path.join(temp,'server/native/asset-library');
  fs.mkdirSync(lib,{recursive:true});
  fs.writeFileSync(path.join(lib,'123456.mesh'),Buffer.from([1,2,3]));
  const resolver = createAssetResolver({
    serverDir:path.join(temp,'server'),siteDir:path.join(temp,'site')
  });
  assert.equal(resolver.lookup('123456').ext,'.mesh');
  assert.equal(resolver.getFailureReason('123456'),null);
});

test('trusted AyaEX upstream receives configured server key (not browser credentials)', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '2x2-asset-key-'));
  t.after(() => fs.rmSync(temp,{recursive:true,force:true}));
  let incomingKey;
  const upstream = createServer((req,res) => {
    incomingKey = req.headers.accesskey;
    res.writeHead(200,{'Content-Type':'application/octet-stream'});
    res.end(Buffer.from([1,2,3,4]));
  });
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{upstream.closeAllConnections(); await new Promise(resolve=>upstream.close(resolve));});
  const oldAya = process.env.AYA_ASSET_FALLBACK_URL;
  const oldKey = process.env.AYA_ASSET_FALLBACK_ACCESS_KEY;
  const oldRoblox = process.env.ROBLOX_ASSET_FETCH;
  process.env.AYA_ASSET_FALLBACK_URL = 'http://127.0.0.1:' + upstream.address().port;
  process.env.AYA_ASSET_FALLBACK_ACCESS_KEY = 'test-only-asset-key';
  process.env.ROBLOX_ASSET_FETCH = '0';
  t.after(()=>{
    if(oldAya===undefined) delete process.env.AYA_ASSET_FALLBACK_URL; else process.env.AYA_ASSET_FALLBACK_URL=oldAya;
    if(oldKey===undefined) delete process.env.AYA_ASSET_FALLBACK_ACCESS_KEY; else process.env.AYA_ASSET_FALLBACK_ACCESS_KEY=oldKey;
    if(oldRoblox===undefined) delete process.env.ROBLOX_ASSET_FETCH; else process.env.ROBLOX_ASSET_FETCH=oldRoblox;
  });
  const resolver = createAssetResolver({serverDir:path.join(temp,'server'),siteDir:path.join(temp,'site')});
  const hit = await resolver.resolve('8833991');
  assert.ok(hit);
  assert.equal(incomingKey,'test-only-asset-key');
  assert.deepEqual(fs.readFileSync(hit.file),Buffer.from([1,2,3,4]));
});
