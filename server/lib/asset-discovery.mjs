// Asset reference discovery shared by offline seed and runtime tools.
// Roblox binary RBXL/RBXM files require a proper decoder for full coverage;
// this intentionally limits binary scanning to printable/UTF-16 strings.
export const validAssetId = id => typeof id === 'string' && /^[1-9][0-9]{0,15}$/.test(id) && Number.isSafeInteger(Number(id));

const patterns = [
  /rbxassetid:\/\/([1-9][0-9]{0,15})(?!\d)/gi,
  /https?:\/\/(?:www\.)?roblox\.com\/asset\/?\?[^"'<\s]{0,256}?\bid=([1-9][0-9]{0,15})(?!\d)/gi,
  /https?:\/\/assetdelivery\.roblox\.com\/v[12]\/asset\/?\?[^"'<\s]{0,256}?\bid=([1-9][0-9]{0,15})(?!\d)/gi,
  /https?:\/\/(?:www\.)?projectpizza\.net\/(?:api\/)?asset\/?\?[^"'<\s]{0,256}?\bid=([1-9][0-9]{0,15})(?!\d)/gi,
  /h?rbxasset:\/\/(?:\.\.\/|\.\/)*shareddata\/(?:assets|SBCR)\/([1-9][0-9]{0,15})(?![A-Za-z0-9._/-])/gi,
];

const xmlHead = /^\s*(?:<\?xml[^>]*>\s*)?<roblox(?:\s|>)/i;
export function isXmlRoblox(bytes) {
  return xmlHead.test(Buffer.from(bytes).subarray(0,1024).toString('utf8').replace(/^\uFEFF/,''));
}
export function looksLikeRobloxModel(bytes) {
  const b=Buffer.from(bytes);
  return isXmlRoblox(b) || b.subarray(0,16).toString('latin1').startsWith('<roblox!');
}
function collect(text, ids) {
  for (const pattern of patterns) {
    pattern.lastIndex=0;
    let found;
    while ((found=pattern.exec(text))!==null) {
      if (validAssetId(found[1])) ids.add(found[1]);
    }
  }
}
export function scanResourceReferences(bytes, {maxBytes=128*1024*1024} = {}) {
  const b=Buffer.from(bytes);
  if(b.length>maxBytes)return {references:[],coverage:'skipped_oversize'};
  const xml=isXmlRoblox(b), text=b.toString(xml?'utf8':'latin1');
  const refs=new Set();
  // Literal references only. Computed Lua expressions are never executed.
  for(const match of text.matchAll(/h?rbxasset:\/\/[^\x00-\x1f<>"'\r\n]{1,1024}/gi)) {
    // In Lua an enclosing quote terminates the literal; in XML a tag does.
    // Preserve internal spaces in genuine historical filenames.
    const value=match[0].trim().replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
    refs.add(value);
  }
  return {references:[...refs].sort(),coverage:xml?'xml_literals':'binary_strings_partial'};
}
export function scanAssetReferences(bytes, {maxBytes=128*1024*1024} = {}) {
  const b=Buffer.from(bytes);
  if (b.length>maxBytes) return {ids:[],coverage:'skipped_oversize',bytes:b.length};
  const xml=isXmlRoblox(b);
  const ids=new Set();
  // Latin1 preserves ASCII bytes in older Roblox formats.
  collect(b.toString(xml?'utf8':'latin1'), ids);
  if (!xml && b.length <= 32*1024*1024) {
    // Some RBXM string tables use UTF-16LE. This is heuristic and not
    // a replacement for parsing compressed binary property streams.
    let wide='';
    for (let i=0;i+1<b.length;i+=2) {
      const low=b[i],high=b[i+1];
      wide+= high===0 && low>=32 && low<127 ? String.fromCharCode(low) : ' ';
    }
    collect(wide,ids);
  }
  return {ids:[...ids].sort((a,b)=>Number(a)-Number(b)),coverage:xml?'xml_text':'binary_strings_partial',bytes:b.length};
}
