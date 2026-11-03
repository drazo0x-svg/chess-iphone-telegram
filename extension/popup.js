'use strict';const $=id=>document.getElementById(id),notice=t=>$('status').textContent=t;
chrome.storage.local.get(['topic','fen'],o=>{if(o.topic)$('topic').value=o.topic;if(o.fen)$('fen').value=o.fen;});
const save=()=>chrome.storage.local.set({topic:$('topic').value.trim(),fen:$('fen').value.trim()});
for(const x of ['topic','fen'])$(x).addEventListener('input',save);
function readBoard(){
 const root=document.querySelector('wc-chess-board,chess-board,.board,cg-board');if(!root)return {error:'Échiquier non reconnu : colle la FEN manuellement.'};
 const board=root.matches('cg-board')?root:(root.querySelector('cg-board')||root),pieces=[];
 for(const el of board.querySelectorAll('piece,.piece')){
  const cls=typeof el.className==='string'?el.className:'';
  let type,color,m=cls.match(/(?:^|\s)([wb])([pnbrqk])(?:\s|$)/i);
  if(m){color=m[1].toLowerCase();type=m[2].toLowerCase();}
  else {m=cls.match(/(?:^|\s)(white|black)\s+(pawn|knight|bishop|rook|queen|king)(?:\s|$)/i);if(!m)continue;color=m[1].toLowerCase()==='white'?'w':'b';type={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}[m[2].toLowerCase()];}
  const s=cls.match(/(?:^|\s)square-([1-8])([1-8])(?:\s|$)/);if(!s)continue;
  pieces.push({f:+s[1],r:+s[2],p:color==='w'?type.toUpperCase():type});
 }
 if(!pieces.length)return {error:'Lecture automatique non disponible sur cet échiquier. Colle une FEN du site.'};
 if(pieces.filter(x=>x.p==='K').length!==1||pieces.filter(x=>x.p==='k').length!==1)return {error:'Lecture incomplète : rois non détectés.'};
 const g=Array.from({length:8},()=>Array(8).fill(''));for(const x of pieces)g[8-x.r][x.f-1]=x.p;
 return {placement:g.map(row=>{let o='',n=0;for(const p of row){if(!p)n++;else{if(n)o+=n;n=0;o+=p;}}return o+(n?n:'');}).join('/')};
}
$('scan').onclick=async()=>{try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const out=await chrome.scripting.executeScript({target:{tabId:tab.id},func:readBoard});const res=out[0].result;if(res.error)return notice(res.error);const old=$('fen').value.trim().split(/\s+/);$('fen').value=[res.placement,old[1]||'w',old[2]||'-',old[3]||'-',old[4]||'0',old[5]||'1'].join(' ');save();notice('Pièces lues. Vérifie le trait, les roques et en passant : ils ne sont pas détectés.');}catch(e){notice('Lecture indisponible : '+e.message);}};
let responseSource=null;
$('send').onclick=async()=>{
 const topic=$('topic').value.trim(),fen=$('fen').value.trim();
 if(!/^[a-zA-Z0-9_-]{12,100}$/.test(topic))return notice('Canal invalide.');
 if(!/^[prnbqkPRNBQK1-8/]+ [wb] (?:-|K?Q?k?q?) (?:-|[a-h][36]) \\d+ \\d+$/.test(fen))return notice('FEN invalide.');
 save();
 if(responseSource){responseSource.close();responseSource=null;}
 const requestId=crypto.randomUUID(),started=Date.now();
 $('answer').textContent='Stockfish réfléchit sur ton iPhone…';
 try{
  responseSource=new EventSource('https://ntfy.sh/'+encodeURIComponent(topic+'-result')+'/sse?since=all');
  responseSource.onmessage=e=>{
   try{
    const event=JSON.parse(e.data);if(event.event!=='message')return;
    const msg=JSON.parse(event.message);
    if(msg.type!=='chess-result'||msg.requestId!==requestId||msg.fen!==fen||!msg.move||Date.now()-started>120000)return;
    const m=msg.move;
    $('answer').textContent='♟ '+m.slice(0,2)+' → '+m.slice(2,4)+(m.length>4?' = '+m.slice(4):'')+' · Éval. '+msg.evaluation;
    notice('Réponse reçue depuis Stockfish sur ton iPhone.');
    responseSource.close();responseSource=null;
   }catch(err){console.warn('Réponse ignorée',err);}
  };
  responseSource.onerror=()=>notice('Connexion au retour en cours. Vérifie le réseau et Safari.');
  const r=await fetch('https://ntfy.sh/'+encodeURIComponent(topic),{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({type:'chess-fen',fen,requestId,sent:Date.now()})});
  if(!r.ok)throw Error('HTTP '+r.status);
  notice('Position envoyée : attends le calcul de ton iPhone (Safari au premier plan).');
 }catch(e){notice('Échec : '+e.message);$('answer').textContent='Aucun résultat.';if(responseSource){responseSource.close();responseSource=null;}}
};
