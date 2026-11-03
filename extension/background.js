'use strict';
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(!['ANALYZE','CHECK'].includes(msg?.type))return;
 const topic=msg.topic;
 if(!/^[A-Za-z0-9_-]{12,100}$/.test(topic)){respond({ok:false,error:'Canal ntfy invalide'});return;}
 (async()=>{
  if(msg.type==='ANALYZE'){
   const r=await fetch('https://ntfy.sh/'+encodeURIComponent(topic),{
    method:'POST',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({type:'chess-fen',fen:msg.fen,requestId:msg.requestId,sent:Date.now()})
   });
   if(!r.ok)throw Error('Publication ntfy HTTP '+r.status);
   return {ok:true};
  }
  const r=await fetch('https://ntfy.sh/'+encodeURIComponent(topic+'-result')+'/json?poll=1&since=1m',{cache:'no-store'});
  if(!r.ok)throw Error('Lecture ntfy HTTP '+r.status);
  const text=await r.text(),messages=[];
  for(const line of text.trim().split('\n')){
   if(!line)continue;
   try{const wrapper=JSON.parse(line);if(wrapper.event!=='message')continue;const item=JSON.parse(wrapper.message);
    if(item.type==='chess-result'&&item.requestId===msg.requestId&&item.fen===msg.fen)messages.push(item);
   }catch{}
  }
  return {ok:true,result:messages.at(-1)||null};
 })().then(respond).catch(e=>respond({ok:false,error:String(e.message||e)}));
 return true;
});
