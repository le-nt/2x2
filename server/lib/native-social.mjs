// Legacy LuaWebService protocol backed by this deployment's local identities.
// Groups deliberately report non-membership until a group backend is supported.
// Roblox user IDs and purchases are never inferred from local IDs.
const socialPath='/native/Game/LuaWebService/HandleSocialRequest.ashx';
const passPath='/native/Game/GamePass/GamePassHandler.ashx';
const escapeXml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const reply=(res,status,body,type='text/plain')=>{
  res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'});
  res.end(body);return true;
};
const value=(res,type,data)=>reply(res,200,`<Value Type="${type}">${escapeXml(data)}</Value>`,'application/xml');
const id=(params,key)=>{
  const values=params.getAll(key);
  return values.length===1&&/^[1-9][0-9]{0,9}$/.test(values[0])&&Number(values[0])<=2147483647?Number(values[0]):null;
};
export function createNativeSocial({db}){
  db.exec(`CREATE TABLE IF NOT EXISTS native_game_passes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pass_id INTEGER NOT NULL CHECK(pass_id BETWEEN 1 AND 2147483647),
    granted_at INTEGER NOT NULL,
    PRIMARY KEY(user_id,pass_id)
  );`);
  return function route(req,res,url,{service,user}){
    const pass=url.pathname===passPath;
    if(!pass&&url.pathname!==socialPath)return false;
    if(req.method!=='GET')return reply(res,405,'Use GET.');
    const q=url.searchParams,player=id(q,pass?'UserID':'playerid');
    if(!player)return reply(res,400,'Invalid local player.');
    if(!service&&user?.id!==player)return reply(res,403,'Worker credentials required.');
    if(!db.prepare('SELECT id FROM users WHERE id=?').get(player))return reply(res,404,'Unknown local player.');
    const methods=q.getAll(pass?'Action':'method');
    if(methods.length!==1)return reply(res,400,'Provide one method.');
    const method=methods[0];
    if(pass){
      const passId=id(q,'PassID');
      if(method!=='HasPass'||!passId)return reply(res,400,'Invalid pass query.');
      return value(res,'boolean',!!db.prepare('SELECT 1 FROM native_game_passes WHERE user_id=? AND pass_id=?').get(player,passId));
    }
    if(method==='IsFriendsWith'||method==='IsBestFriendsWith'){
      const other=id(q,'userid');
      if(!other)return reply(res,400,'Invalid friend query.');
      // This deployment has accepted friendships, but no best-friend designation.
      const friend=method==='IsFriendsWith'&&player!==other&&!!db.prepare(`SELECT 1 FROM friendships WHERE status='accepted'
        AND ((requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?))`).get(player,other,other,player);
      return value(res,'boolean',friend);
    }
    if(!['IsInGroup','GetGroupRank','GetGroupRole'].includes(method))return reply(res,400,'Unknown social method.');
    const group=id(q,'groupid');
    if(!group)return reply(res,400,'Invalid group query.');
    if(method==='IsInGroup')return value(res,'boolean',false);
    if(method==='GetGroupRank')return value(res,'integer',0);
    // LuaWebService's string overload returns the raw response, unlike bool/int.
    return reply(res,200,'Guest');
  };
}
