(()=>{"use strict";
const $=id=>document.getElementById(id);
const fmt=ms=>new Date(ms).toLocaleString(undefined,{month:"numeric",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",second:"2-digit"});
async function post(path){const r=await fetch(path,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}"});if(!r.ok)throw Error("Request failed ("+r.status+")");return r.json();}
async function main(){
 const response=await fetch("/api/not-approved",{credentials:"same-origin",cache:"no-store"});
 if(!response.ok){location.replace("/index.html");return;}
 const {notice,username,appeal}=await response.json();
 if(!notice){location.replace("/home.html");return;}
 const titles={Warn:"Warning",Remind:"Reminder",Ban_1Day:"Banned for 1 Day",Ban_3Day:"Banned for 3 Days",Ban_7Day:"Banned for 7 Days",Ban_14Day:"Banned for 14 Days",Delete:"Account Deleted"};
 $("heading").textContent=titles[notice.action]||"Account Not Approved";
 $("reviewed").textContent=fmt(notice.created_at);
 $("moderatorReason").textContent=notice.reason||"Please follow the 2x2 Community Guidelines.";
 if(notice.kind==="warning"){
   $("duration").textContent="Please acknowledge this reminder before returning to 2x2.";
   $("ack").hidden=false;
 }else if(notice.action==="Delete"){
   $("duration").textContent="Your account has been disabled.";
 }else{
   $("duration").textContent="Your account has been disabled temporarily. You may reactivate it after "+fmt(notice.until_at)+".";
 }
 if(appeal){
   $("appealText").disabled=true;$("sendAppeal").disabled=true;
   $("appealStatus").textContent=appeal.status==="pending"?"Your appeal is awaiting review.":("Appeal reviewed: "+(appeal.response||"No additional information."));
 }else{
   $("sendAppeal").onclick=async()=>{
     const message=$("appealText").value.trim();
     if(message.length<12){$("appealStatus").textContent="Please explain your appeal in at least 12 characters.";return;}
     try{
       const r=await fetch("/api/not-approved/appeal",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({message})});
       const d=await r.json();if(!r.ok)throw Error(d.error||"Appeal failed");
       $("appealText").disabled=true;$("sendAppeal").disabled=true;
       $("appealStatus").textContent="Your appeal was submitted for review.";
     }catch(e){$("appealStatus").textContent=e.message;}
   };
 }
 $("ack").onclick=async()=>{try{await post("/api/not-approved/ack");location.replace("/home.html");}catch(e){$("error").textContent=e.message;}};
 $("logout").onclick=async()=>{try{await post("/api/logout");location.replace("/index.html");}catch(e){$("error").textContent=e.message;}};
}
main().catch(e=>{$("error").textContent="Could not load moderation notice: "+e.message;});
})();