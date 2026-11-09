// Server-only Open Cloud asset delivery. No credentials are returned to the browser.
const ID = /^[1-9][0-9]{0,15}$/;
const MAX = 32 * 1024 * 1024;
const positive = value => /^(?:[1-9][0-9]{0,15})$/.test(String(value)) && Number.isSafeInteger(Number(value));
export function retryAfterMs(headers, now=Date.now()) {
  const value=headers.get('retry-after');
  if(value!==null && /^\d+(?:\.\d+)?$/.test(value.trim()))return Math.min(Number.MAX_SAFE_INTEGER,Number(value)*1000);
  const date=value===null?NaN:Date.parse(value),server=Date.parse(headers.get('date')||'');
  return Number.isFinite(date)?Math.max(0,date-(Number.isFinite(server)?server:now)):60000;
}
export function trustedAssetCdn(url) {
  return url.protocol === 'https:' && !url.username && !url.password &&
    (url.hostname === 'assetdelivery.roblox.com' || url.hostname === 'apis.roblox.com' ||
     url.hostname === 'contentdelivery.roblox.com' ||
     url.hostname === 'rbxcdn.com' || url.hostname.endsWith('.rbxcdn.com'));
}
function errorForStatus(status) {
  if (status === 401 || status === 403) return 'upstream_auth_required';
  if (status === 404) return 'upstream_not_found';
  if (status === 429) return 'upstream_rate_limited';
  return 'upstream_http_' + status;
}
async function waitForTransfer(promise,signal) {
  if(signal.aborted)throw signal.reason;
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    promise.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
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
async function fetchDelivery(id, {provider,key=process.env.ROBLOX_OPEN_CLOUD_API_KEY,version=null,
  fetchImpl=fetch, maxBytes=MAX, timeoutMs=12000,beforeRequest=()=>0,onRateLimit=()=>{},lookupVersion=()=>null,sharedTransfers=null} = {}) {
  if (typeof id !== 'string' || !ID.test(id) || !Number.isSafeInteger(Number(id)))
    return {reason:'invalid_id'};
  if(version!==null && !positive(version))return {reason:'invalid_version'};
  if(provider==='opencloud' && !key)return {reason:'open_cloud_not_configured'};
  const suffix=version!==null?'/version/'+version:'';
  const endpoint=new URL(provider==='opencloud'?'https://apis.roblox.com/asset-delivery-api/v1/assetId/'+id+suffix:
    provider==='legacy_v1_location'?'https://assetdelivery.roblox.com/v1/assetId/'+id+suffix:
    'https://assetdelivery.roblox.com/v1/asset?id='+id+(version!==null?'&version='+version:''));
  const metadata={provider,assetId:id,requestedVersion:version===null?null:Number(version),assetVersionNumber:null,assetTypeId:null,
    endpoint:endpoint.href,identityVerified:false,versionVerified:false};
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),timeoutMs);
  let transferKey=null,transferPromise=null,completeTransfer=null;
  try {
    let url=endpoint;
    for (let hop=0;hop<5;hop++) {
      if (!trustedAssetCdn(url)) return {reason:'untrusted_redirect'};
      const cooling=beforeRequest(url);
      if(cooling>0)return {reason:'upstream_rate_limited',retryAfterMs:cooling,retryScope:url.hostname};
      // Credentials are only ever sent to the official Open Cloud endpoint.
      const headers = provider==='opencloud' && url.href===endpoint.href ? {'x-api-key':key} : {};
      const response=await fetchImpl(url.href,{headers,redirect:'manual',signal:controller.signal});
      const limited=()=>{
        const delay=retryAfterMs(response.headers);onRateLimit(url.hostname,delay);
        return {reason:'upstream_rate_limited',status:429,retryAfterMs:delay,retryScope:url.hostname};
      };
      if(response.status===429){await response.body?.cancel().catch(()=>{});return limited();}
      if(!response.ok && ![301,302,303,307,308].includes(response.status)){await response.body?.cancel().catch(()=>{});return {reason:errorForStatus(response.status),status:response.status};}
      for(const [header,field] of [['roblox-assetid','assetId'],['roblox-assetversionnumber','assetVersionNumber'],['roblox-assettypeid','assetTypeId']]) {
        const raw=response.headers.get(header);if(raw===null)continue;
        if(!positive(raw) || (field==='assetId' && raw!==id) ||
          (field==='assetVersionNumber' && version!==null && Number(raw)!==Number(version)) ||
          (metadata[field]!==null && field!=='assetId' && metadata[field]!==Number(raw))) {
          await response.body?.cancel().catch(()=>{});return {reason:'asset_identity_mismatch'};
        }
        metadata[field]=field==='assetId'?raw:Number(raw);
        if(field==='assetId')metadata.identityVerified=true;
        if(field==='assetVersionNumber')metadata.versionVerified=true;
      }
      if(response.ok || [301,302,303,307,308].includes(response.status)) {
        const cached=metadata.identityVerified && metadata.versionVerified?lookupVersion(metadata):null;
        if(cached){await response.body?.cancel().catch(()=>{});return {cached,metadata};}
        if(sharedTransfers && !transferKey && metadata.identityVerified && metadata.versionVerified) {
          const key=id+'.v'+metadata.assetVersionNumber;
          const existing=sharedTransfers.get(key);
          if(existing) {
            const bytes=await waitForTransfer(existing,controller.signal);
            if(bytes){await response.body?.cancel().catch(()=>{});return {bytes,metadata};}
          }
          transferKey=key;transferPromise=new Promise(resolve=>{completeTransfer=resolve;});sharedTransfers.set(key,transferPromise);
        }
      }
      if ([301,302,303,307,308].includes(response.status)) {
        const location=response.headers.get('location');
        if (!location) return {reason:'redirect_without_location'};
        await response.body?.cancel().catch(()=>{});
        url=new URL(location,url);
        continue;
      }
      if (!response.ok) {await response.body?.cancel().catch(()=>{});return {reason:errorForStatus(response.status),status:response.status};}
      const result=await readBytes(response,maxBytes);
      if (!result.bytes) return result;
      const type=(response.headers.get('content-type')||'').toLowerCase();
      const prefix=result.bytes.subarray(0,256).toString('utf8').trimStart();
      if ((type.includes('json') || prefix.startsWith('{')) && ['apis.roblox.com','assetdelivery.roblox.com'].includes(url.hostname)) {
        let json;try{json=JSON.parse(result.bytes.toString('utf8'));}catch{return {reason:'unexpected_json'};}
        // Legacy/Open Cloud endpoints can return HTTP 200 with an error envelope.
        if(Array.isArray(json?.errors) && json.errors.length) {
          const status=Number(json.errors[0]?.code);
          if(status===429)return limited();
          return {reason:[401,403,404].includes(status)?errorForStatus(status):'upstream_error_envelope',status:Number.isInteger(status)?status:undefined};
        }
        if(json?.assetTypeId!==undefined && Number(json.assetTypeId)>0) {
          if(!positive(json.assetTypeId) || metadata.assetTypeId!==null && metadata.assetTypeId!==Number(json.assetTypeId))return {reason:'asset_identity_mismatch'};
          metadata.assetTypeId=Number(json.assetTypeId);
        }
        if(json?.assetId!==undefined && String(json.assetId)!==id)return {reason:'asset_identity_mismatch'};
        if(json?.assetVersionNumber!==undefined && (!positive(json.assetVersionNumber) ||
          version!==null && Number(json.assetVersionNumber)!==Number(version) ||
          metadata.assetVersionNumber!==null && Number(json.assetVersionNumber)!==metadata.assetVersionNumber))return {reason:'asset_identity_mismatch'};
        if(json?.assetId!==undefined)metadata.identityVerified=true;
        if(json?.assetVersionNumber!==undefined){metadata.assetVersionNumber=Number(json.assetVersionNumber);metadata.versionVerified=true;}
        // Delivery descriptors return signed CDN locations, never browser credentials.
        const location=json?.location || json?.locations?.[0]?.location;
        if (typeof location!=='string') return {reason:'missing_asset_location'};
        url=new URL(location,url);
        continue;
      }
      if (/^<(?:!doctype html|html\b)/i.test(prefix))return {reason:'unexpected_html'};
      if(prefix.startsWith('{') && !['apis.roblox.com','assetdelivery.roblox.com'].includes(url.hostname)) {
        try{const document=JSON.parse(result.bytes.toString('utf8'));if(Array.isArray(document?.errors)||typeof document?.error==='string')return {reason:'upstream_error_envelope'};}catch{}
      }
      if(version!==null && !metadata.versionVerified)return {reason:'asset_version_unverified'};
      completeTransfer?.(result.bytes);
      return {bytes:result.bytes,metadata};
    }
    return {reason:'too_many_redirects'};
  } catch(error) {
    return {reason:error.name==='AbortError'||error.name==='TimeoutError'?'upstream_timeout':'upstream_network_error'};
  } finally {
    clearTimeout(timeout);completeTransfer?.(null);
    if(transferKey && sharedTransfers.get(transferKey)===transferPromise)sharedTransfers.delete(transferKey);
  }
}

export function fetchRobloxOpenCloudAsset(id,options={}) {
  return fetchDelivery(id,{...options,provider:'opencloud'});
}
export function fetchRobloxLegacyAsset(id,{endpoint='location',...options}={}) {
  if(!['location','bytes'].includes(endpoint))return Promise.resolve({reason:'invalid_endpoint'});
  return fetchDelivery(id,{...options,provider:endpoint==='location'?'legacy_v1_location':'legacy_v1_bytes'});
}
