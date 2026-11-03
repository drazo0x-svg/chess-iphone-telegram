'use strict';
/* Respect the ntfy.sh per-IP request rate: prevent rapid polling and honour Retry-After. */
const nextAllowed = new Map();
const lastChecks = new Map();
const POLL_INTERVAL = 12000;
function cooldownResponse(topic) {
 const remaining = (nextAllowed.get(topic) || 0) - Date.now();
 return remaining > 0 ? {ok:false,rateLimited:true,retryAfterSeconds:Math.ceil(remaining/1000),error:'ntfy limite temporairement les requêtes'} : null;
}
function throttled(topic, response) {
 const wait = Number(response.headers.get('Retry-After'));
 const sec = Number.isFinite(wait) && wait > 0 ? wait : 60;
 nextAllowed.set(topic, Date.now()+Math.min(Math.max(sec,10),86400)*1000);
 return {ok:false,rateLimited:true,retryAfterSeconds:Math.ceil(((nextAllowed.get(topic) || 0)-Date.now())/1000),error:'ntfy HTTP 429 : réessaie après le délai indiqué'};
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(!['ANALYZE','CHECK'].includes(msg?.type))return;
 const topic=msg.topic;
 if(!/^[A-Za-z0-9_-]{12,100}$/.test(topic)){respond({ok:false,error:'Canal ntfy invalide'});return;}
 const limited=cooldownResponse(topic);
 if(limited){respond(limited);return;}
 (async()=>{
  if(msg.type==='ANALYZE'){
   const response=await fetch('https://ntfy.sh/'+encodeURIComponent(topic),{
    method:'POST',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({type:'chess-fen',fen:msg.fen,requestId:msg.requestId,sent:Date.now()})
   });
   if(response.status===429)return throttled(topic,response);
   if(!response.ok)throw Error('Publication ntfy HTTP '+response.status);
   // Do not immediately issue a GET after POST.
   lastChecks.set(topic,Date.now());
   return {ok:true};
  }
  if(Date.now()-(lastChecks.get(topic)||0)<POLL_INTERVAL)return {ok:true,notYet:true,result:null};
  lastChecks.set(topic,Date.now());
  const response=await fetch('https://ntfy.sh/'+encodeURIComponent(topic+'-result')+'/json?poll=1&since=2m',{cache:'no-store'});
  if(response.status===429)return throttled(topic,response);
  if(!response.ok)throw Error('Lecture ntfy HTTP '+response.status);
  const raw=await response.text(),messages=[];
  for(const line of raw.trim().split('\n')){
   if(!line)continue;
   try{
    const wrapper=JSON.parse(line);
    if(wrapper.event!=='message')continue;
    const item=JSON.parse(wrapper.message);
    if(item.type==='chess-result'&&item.requestId===msg.requestId&&item.fen===msg.fen)messages.push(item);
   }catch{}
  }
  return {ok:true,result:messages.at(-1)||null};
 })().then(respond).catch(e=>respond({ok:false,error:String(e.message||e)}));
 return true;
});
