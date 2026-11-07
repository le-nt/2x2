// Explicit translation between classic string IDs and imported native-service place IDs.
export function resolveLaunch(config, placeId, places) {
  if (!places.has(placeId)) return { status: 404, error: 'Unknown place.' };
  const native = config.nativeClient || {};
  if (!native.origin) return { status: 503, error: 'The 2x2 game service has not been configured yet.' };
  let origin;
  try {
    origin = new URL(native.origin);
    if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw Error();
  } catch { return { status: 503, error: 'The game service origin is invalid. Use an HTTP(S) origin without a path.' }; }
  const id = native.placeIds?.[placeId];
  if (!/^[1-9][0-9]*$/.test(String(id ?? ''))) return { status: 503, error: 'This classic place has not been imported and mapped in the game service yet.' };
  const url = new URL('/games/start', origin);
  url.searchParams.set('placeId', String(id));
  return { status: 200, url: url.href, placeId, nativePlaceId: String(id) };
}
