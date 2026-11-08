// Server-only Open Cloud asset delivery. No credentials are returned to the browser.
const ID = /^[1-9][0-9]{0,15}$/;
const MAX = 32 * 1024 * 1024;
export function trustedAssetCdn(url) {
  return url.protocol === 'https:' && !url.username && !url.password &&
    (url.hostname === 'assetdelivery.roblox.com' || url.hostname === 'apis.roblox.com' ||
     url.hostname === 'rbxcdn.com' || url.hostname.endsWith('.rbxcdn.com'));
}
function errorForStatus(status) {
  if (status === 401 || status === 403) return 'upstream_auth_required';
  if (status === 404) return 'upstream_not_found';
  if (status === 429) return 'upstream_rate_limited';
  return 'upstream_http_' + status;
}
async function readBytes(response, maxBytes) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (!Number.isFinite(declared) || declared > maxBytes) return {reason:'content_too_large'};
  if (!response.body) return {reason:'empty_body'};
  const chunks=[]; let length=0;
  try {
    for await (const chunk of response.body) {
      length += chunk.byteLength;
      if (length > maxBytes) { await response.body.cancel().catch(()=>{}); return {reason:'content_too_large'}; }
      chunks.push(Buffer.from(chunk));
    }
  } catch { return {reason:'stream_failed'}; }
  if (!length) return {reason:'empty_body'};
  return {bytes:Buffer.concat(chunks,length)};
}
export async function fetchRobloxOpenCloudAsset(id, {key=process.env.ROBLOX_OPEN_CLOUD_API_KEY,
  fetchImpl=fetch, maxBytes=MAX, timeoutMs=12000} = {}) {
  if (typeof id !== 'string' || !ID.test(id) || !Number.isSafeInteger(Number(id)))
    return {reason:'invalid_id'};
  if (!key) return {reason:'open_cloud_not_configured'};
  const endpoint = new URL('https://apis.roblox.com/asset-delivery-api/v1/assetId/' + id);
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),timeoutMs);
  try {
    let url=endpoint;
    for (let hop=0;hop<5;hop++) {
      if (!trustedAssetCdn(url)) return {reason:'untrusted_redirect'};
      // Credentials are only ever sent to the official Open Cloud endpoint.
      const headers = url.href===endpoint.href ? {'x-api-key':key} : {};
      const response=await fetchImpl(url.href,{headers,redirect:'manual',signal:controller.signal});
      if ([301,302,303,307,308].includes(response.status)) {
        const location=response.headers.get('location');
        if (!location) return {reason:'redirect_without_location'};
        url=new URL(location,url);
        continue;
      }
      if (!response.ok) return {reason:errorForStatus(response.status),status:response.status};
      const result=await readBytes(response,maxBytes);
      if (!result.bytes) return result;
      const type=(response.headers.get('content-type')||'').toLowerCase();
      const prefix=result.bytes.subarray(0,256).toString('utf8').trimStart();
      if (type.includes('json') || prefix.startsWith('{')) {
        let json;try{json=JSON.parse(result.bytes.toString('utf8'));}catch{return {reason:'unexpected_json'};}
        // Some delivery responses return signed CDN locations rather than bytes.
        const location=json?.location || json?.locations?.[0]?.location;
        if (typeof location!=='string') return {reason:'missing_asset_location'};
        url=new URL(location,url);
        continue;
      }
      if (/^<(?:!doctype html|html\b)/i.test(prefix))return {reason:'unexpected_html'};
      return {bytes:result.bytes};
    }
    return {reason:'too_many_redirects'};
  } catch(error) {
    return {reason:error.name==='AbortError'?'upstream_timeout':'upstream_network_error'};
  } finally {clearTimeout(timeout);}
}
