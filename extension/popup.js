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
$('send').onclick=async()=>{const topic=$('topic').value.trim(),fen=$('fen').value.trim();if(!/^[a-zA-Z0-9_-]{12,100}$/.test(topic))return notice('Canal invalide.');if(!/^[prnbqkPRNBQK1-8/]+ [wb] (?:-|K?Q?k?q?) (?:-|[a-h][36]) \d+ \d+$/.test(fen))return notice('FEN invalide.');save();try{const r=await fetch('https://ntfy.sh/'+encodeURIComponent(topic),{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({type:'chess-fen',fen,requestId:crypto.randomUUID(),sent:Date.now()})});if(!r.ok)throw Error('HTTP '+r.status);notice('FEN envoyée. Laisse Safari ouvert sur ton iPhone.');}catch(e){notice('Échec de transmission : '+e.message);}};