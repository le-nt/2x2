import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLaunch } from '../server/lib/launcher.mjs';
const places = new Map([['crossroads', {}]]);
test('unknown and unconfigured places fail explicitly', () => {
  assert.equal(resolveLaunch({}, 'missing', places).status, 404);
  assert.equal(resolveLaunch({}, 'crossroads', places).status, 503);
  assert.equal(resolveLaunch({nativeClient:{origin:'https://play.example.com'}}, 'crossroads', places).status,503);
});
test('native launch maps string IDs without guessing', () => {
  assert.deepEqual(resolveLaunch({nativeClient:{origin:'https://play.example.com',placeIds:{crossroads:42}}},'crossroads',places),{status:200,url:'https://play.example.com/games/start?placeId=42',placeId:'crossroads',nativePlaceId:'42'});
});
test('rejects unsafe origins and malformed IDs', () => {
  for(const origin of ['javascript:alert(1)','https://u:p@host','https://host/path','https://host/?x=1']) assert.equal(resolveLaunch({nativeClient:{origin,placeIds:{crossroads:42}}},'crossroads',places).status,503);
  for(const id of [0,-1,'1&admin=1','NaN']) assert.equal(resolveLaunch({nativeClient:{origin:'https://host',placeIds:{crossroads:id}}},'crossroads',places).status,503);
});
