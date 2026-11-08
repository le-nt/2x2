// 2x2 native admin console: all sensitive decisions are enforced in server/lib/admin.mjs.
(() => {
"use strict";
const $=id=>document.getElementById(id);
const ROLES=["Unprivileged","ForumModerator","AssetManager","Moderator","Administrator","SuperAdmin"];
let state={role:"Unprivileged",target:null,verified:false,auditPage:1,page:"dashboard",enrolled:false};
const fmt=v=>v?new Date(v).toLocaleString():"—";
const el=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=String(text??"");if(cls)e.className=cls;return e};
function showMessage(msg,bad=false){const n=$("message");n.textContent=msg||"";n.className=bad?"error":"success";}
async function api(path,method="GET",body){
  const r=await fetch("/api/admin"+path,{method,credentials:"same-origin",headers:method==="GET"?{}:{"Content-Type":"application/json"},body:method==="GET"?undefined:JSON.stringify(body||{}),cache:"no-store"});
  const result=await r.json().catch(()=>({error:"Unexpected server response."}));
  if(!r.ok)throw Error(result.error||"Request failed ("+r.status+")");
  return result;
}
async function perform(fn){try{showMessage("");await fn();}catch(e){showMessage(e.message,true);}}
function can(role){return ROLES.indexOf(state.role)>=ROLES.indexOf(role);}
function showPage(name){
  state.page=name;$("title").textContent=({dashboard:"Dashboard",users:"User moderation",features:"Site features",staff:"Staff roles",audit:"Audit log"})[name]||"2x2 Administration";
  for(const p of ["dashboard","users","features","staff","audit"])$(p).hidden=p!==name;
  for(const b of document.querySelectorAll("#nav button"))b.classList.toggle("active",b.dataset.page===name);
}
async function init(){
  const status=await api("/status");
  state.role=status.staffRole;state.verified=status.verified;state.enrolled=status.enrolled;
  $("role").textContent="Staff role: "+state.role;
  $("nav").hidden=!state.verified;$("logout").hidden=!state.verified;$("auth").hidden=state.verified;
  $("setup").hidden=state.enrolled;
  $("authHelp").textContent=state.enrolled?"Enter your authenticator code to start a six-hour staff session.":"Verify your password, then enroll an authenticator app before using the admin panel.";
  for(const b of document.querySelectorAll("#nav button[data-min]"))b.hidden=!can(b.dataset.min);
  if(state.verified){showPage(state.page);await loadPage(state.page);}
  else for(const p of ["dashboard","users","features","staff","audit"])$(p).hidden=true;
}
async function loadPage(p){
  if(p==="dashboard"){
    const d=await api("/dashboard");
    $("metrics").replaceChildren();
    for(const [label,value] of [["Total users",d.userCount],["New accounts today",d.signUpsToday],["Active enforcement",d.activeBans]]){
      const c=el("div",label,"metric");c.append(el("b",value));$("metrics").append(c);
    }
    $("expiry").textContent="Session expires: "+fmt(d.sessionExpires);
  }else if(p==="users")await findUsers();
  else if(p==="features")await loadFlags();
  else if(p==="staff")await loadStaff();
  else if(p==="audit")await loadAudit();
}
async function findUsers(){
  const d=await api("/users?q="+encodeURIComponent($("userQuery").value.trim()));
  $("userResults").replaceChildren();
  for(const u of d.users){
    const tr=document.createElement("tr");
    for(const value of [u.username,u.id,fmt(u.created_at)])tr.append(el("td",value));
    const td=document.createElement("td"),b=el("button","Inspect");b.className="secondary";b.onclick=()=>perform(()=>viewUser(u.id));
    td.append(b);tr.append(td);$("userResults").append(tr);
  }
  if(!d.users.length)$("userResults").append(el("tr","No accounts found."));
}
async function viewUser(id){
  const d=await api("/users/"+id);
  state.target=d.user.id;$("userDetail").hidden=false;
  $("targetName").textContent=d.user.username+" (#"+d.user.id+")";
  $("targetFacts").textContent="Joined "+fmt(d.user.created_at)+" • Last seen "+fmt(d.user.last_seen)+" • R$ "+d.user.robux+" • Tx "+d.user.tix;
  $("banStatus").textContent=d.ban?"Active enforcement: "+d.ban.action+(d.ban.until_at?" until "+fmt(d.ban.until_at):""):"No active enforcement";
  $("history").replaceChildren();
  for(const a of d.history){
    const tr=document.createElement("tr");
    for(const v of [fmt(a.created_at),a.action,a.reason,a.actor])tr.append(el("td",v));
    $("history").append(tr);
  }
  $("notes").replaceChildren();
  for(const n of d.notes)$("notes").append(el("p",fmt(n.created_at)+" • "+n.author+": "+n.note));
}
async function moderate(){
  if(!state.target)throw Error("Select a user first.");
  const action=$("action").value,reason=$("reason").value.trim();
  if(!reason)throw Error("Enter a reason.");
  if(!confirm("Apply "+action+" to user #"+state.target+"? This will be audited."))return;
  await api("/users/"+state.target+"/action","POST",{action,reason});
  $("reason").value="";await viewUser(state.target);showMessage("Moderation action saved.");
}
async function addNote(){
  if(!state.target)throw Error("Select a user.");
  await api("/users/"+state.target+"/notes","POST",{note:$("note").value});
  $("note").value="";await viewUser(state.target);showMessage("Note added.");
}
async function loadFlags(){
  const d=await api("/features");$("flags").replaceChildren();
  for(const f of d.features){
    const line=el("div","","panel"),title=el("h3",f.description||f.key),detail=el("p","Key: "+f.key+" • "+(f.enabled?"Enabled":"Disabled"),"muted");
    const b=el("button",f.enabled?"Disable":"Enable",f.enabled?"secondary":"");
    b.onclick=()=>perform(async()=>{await api("/features/"+f.key,"POST",{enabled:!f.enabled});await loadFlags();showMessage("Feature flag updated.");});
    line.append(title,detail,b);$("flags").append(line);
  }
}
async function loadStaff(){
  const d=await api("/staff");$("staffList").replaceChildren();
  for(const s of d.staff){
    const tr=document.createElement("tr");
    for(const v of [s.username,"#"+s.user_id,s.role])tr.append(el("td",v));
    $("staffList").append(tr);
  }
}
async function saveStaff(){
  const userId=Number($("staffId").value),role=$("staffRole").value;
  if(!Number.isSafeInteger(userId)||userId<1)throw Error("Enter a valid user ID.");
  if(!confirm("Set user #"+userId+" to "+role+"?"))return;
  await api("/staff","POST",{userId,role});await loadStaff();showMessage("Staff role updated.");
}
async function loadAudit(){
  const d=await api("/audit?page="+state.auditPage);$("auditRows").replaceChildren();
  for(const a of d.records){
    const tr=document.createElement("tr");
    for(const v of [fmt(a.created_at),a.actor,a.action,a.target,a.detail])tr.append(el("td",v));
    $("auditRows").append(tr);
  }
  $("moreAudit").disabled=d.records.length<50;
}
$("generate").onclick=()=>perform(async()=>{
  const d=await api("/totp/setup","POST",{password:$("password").value});
  $("secretArea").hidden=false;$("secret").textContent=d.secret;
  $("password").value="";showMessage("Add the secret to an authenticator app, then enter its six-digit code.");
});
$("verify").onclick=()=>perform(async()=>{
  await api(state.enrolled?"/totp/login":"/totp/enroll","POST",{code:$("otp").value.trim()});
  $("otp").value="";$("secret").textContent="";$("secretArea").hidden=true;
  showMessage("Administrator session started.");await init();
});
$("logout").onclick=()=>perform(async()=>{await api("/logout","POST");state.page="dashboard";await init();});
for(const b of document.querySelectorAll("#nav button"))b.onclick=()=>perform(async()=>{showPage(b.dataset.page);await loadPage(b.dataset.page);});
$("findUsers").onclick=()=>perform(findUsers);
$("userQuery").addEventListener("keydown",e=>{if(e.key==="Enter")perform(findUsers);});
$("moderate").onclick=()=>perform(moderate);
$("addNote").onclick=()=>perform(addNote);
$("saveStaff").onclick=()=>perform(saveStaff);
$("moreAudit").onclick=()=>perform(async()=>{state.auditPage++;await loadAudit();});
perform(init);
})();
