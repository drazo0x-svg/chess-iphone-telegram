'use strict';
(()=>{
 if(window.__chessTrainingV2)return;window.__chessTrainingV2=true;
 const F='abcdefgh',start='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
 let topic='',relayUrl='',enabled=true,playerColor='auto',initialTurn='auto',board=null,prev=null,fen=null,request=null,seenFen='',status='Initialisation…';
 let observation=null,overlay=null,timer=null,pollTimer=null,checkInFlight=false,relaySocket=null,reconnectTimer=null,castling='KQkq',ep='-',half=0,full=1,ui=null;
 chrome.storage.local.get({topic:'',relayUrl:'',enabled:true,playerColor:'auto',initialTurn:'auto'},v=>{topic=v.topic;relayUrl=v.relayUrl||'';enabled=v.enabled;playerColor=v.playerColor||'auto';initialTurn='auto';setup();});
 chrome.storage.onChanged.addListener(ch=>{
  if(ch.topic)topic=ch.topic.newValue||'';
  if(ch.relayUrl)relayUrl=ch.relayUrl.newValue||'';
  if(ch.enabled)enabled=!!ch.enabled.newValue;
  if(ch.initialTurn)initialTurn='auto';
  if(ch.playerColor)playerColor=ch.playerColor.newValue||'auto';
  if(ch.topic||ch.relayUrl||ch.enabled||ch.initialTurn||ch.playerColor){prev=null;seenFen='';request=null;removeArrow();setup();}
 });
 function findBoard(){return document.querySelector('chess-board,wc-chess-board,.board, cg-board');}
 function playerSide(el){
  if(playerColor==='black')return 'b';
  if(playerColor==='white')return 'w';
  // Chess.com may apply "flipped" to the board itself or an enclosing wrapper.
  // Lichess uses "orientation-black".
  for(let node=el,depth=0;node&&depth<12;node=node.parentElement,depth++){
   if(node.matches?.('.flipped,.orientation-black,.board-flipped,[data-orientation="black"]'))return 'b';
   if(node.matches?.('.orientation-white,[data-orientation="white"]'))return 'w';
  }
  // Without reliable orientation metadata, fail closed instead of assuming White.
  return null;
 }
 function toPlacement(map){
  const rows=[];for(let r=8;r>=1;r--){let row='',n=0;for(let f=1;f<=8;f++){const p=map[F[f-1]+r];if(!p)n++;else{if(n)row+=n;n=0;row+=p;}}if(n)row+=n;rows.push(row);}return rows.join('/');
 }
 function scan(){
  const el=findBoard();if(!el)return null;
  const root=el.querySelector('cg-board')||el,items=root.querySelectorAll('piece,.piece'),map={};
  for(const e of items){
   const cls=typeof e.className==='string'?e.className:'';
   let type=null,color=null,coord=null,m;
   m=cls.match(/(?:^|\s)([wb])([pnbrqk])(?=\s|$)/i);
   if(m){color=m[1].toLowerCase();type=m[2].toLowerCase();}
   else {m=cls.match(/(?:^|\s)(white|black)(?:\s)+(pawn|knight|bishop|rook|queen|king)(?=\s|$)/i);
    if(m){color=m[1].toLowerCase()==='white'?'w':'b';type={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'}[m[2].toLowerCase()];}}
   if(!type)continue;
   m=cls.match(/(?:^|\s)square-([1-8])([1-8])(?=\s|$)/);
   if(m)coord=F[+m[1]-1]+m[2];
   // Lichess piece transforms use CSS translates relative to square size.
   if(!coord){
    const tr=e.style.transform||'',t=tr.match(/translate(?:3d)?\(\s*([\d.-]+)px\s*,\s*([\d.-]+)px/i);
    const size=root.getBoundingClientRect().width/8;
    if(t&&size>0){const x=Math.round(+t[1]/size),y=Math.round(+t[2]/size);if(x>=0&&x<8&&y>=0&&y<8){
     const blackBottom=root.closest('.orientation-black')||el.classList.contains('orientation-black');
     coord=F[blackBottom?7-x:x]+(blackBottom?y+1:8-y);
    }}
   }
   if(coord)map[coord]=color==='w'?type.toUpperCase():type;
  }
  if(Object.values(map).filter(p=>p==='K').length!==1||Object.values(map).filter(p=>p==='k').length!==1)return null;
  return {el,root,map,placement:toPlacement(map)};
 }
 function mover(oldMap,newMap){
  const gone=[],added=[];
  for(const key of new Set([...Object.keys(oldMap),...Object.keys(newMap)])){
   if(oldMap[key]!==newMap[key]){
    if(oldMap[key])gone.push({sq:key,p:oldMap[key]});
    if(newMap[key])added.push({sq:key,p:newMap[key]});
   }
  }
  const candidates=gone.filter(x=>added.some(y=>y.p===x.p||x.p.toLowerCase()==='p'&&y.p.toLowerCase()!=='k'&&((x.p===x.p.toUpperCase())===(y.p===y.p.toUpperCase()))));
  if(!candidates.length)return null;
  // Ignore captured piece removals by prioritizing the colour which appears at a destination.
  const picked=candidates.find(x=>added.some(y=>y.p===x.p&&y.sq!==x.sq))||candidates[0];
  const target=added.find(y=>y.p===picked.p&&y.sq!==picked.sq)||added.find(y=>(y.p===y.p.toUpperCase())===(picked.p===picked.p.toUpperCase())&&y.sq!==picked.sq);
  if(!target)return null;
  return {color:picked.p===picked.p.toUpperCase()?'w':'b',from:picked.sq,to:target.sq,piece:picked.p};
 }
 function updateRights(move,map){
  if(!move)return;
  if(move.piece==='K')castling=castling.replace(/[KQ]/g,'');
  if(move.piece==='k')castling=castling.replace(/[kq]/g,'');
  const remove={a1:'Q',h1:'K',a8:'q',h8:'k'};
  if(remove[move.from])castling=castling.replace(remove[move.from],'');
  for(const [square,right] of Object.entries(remove)){
   const rook=right===right.toUpperCase()?'R':'r';
   if(map[square]!==rook)castling=castling.replace(right,'');
  }
  ep='-';
  if(move.piece.toLowerCase()==='p'&&Math.abs(Number(move.from[1])-Number(move.to[1]))===2)ep=move.from[0]+((Number(move.from[1])+Number(move.to[1]))/2);
 }
 function position(){
  if(!enabled)return;
  const s=scan();if(!s){setStatus('Échiquier non reconnu');return;}
  if(board!==s.root){board=s.root;prev=null;request=null;seenFen='';removeArrow();}
  if(prev?.placement===s.placement)return;
  let turn=null,played=null;
  if(prev){
   const move=mover(prev.map,s.map);
   if(!move){prev=s;setStatus('Mouvement incertain : vérifie la position');removeArrow();return;}
   played=move.color;
   turn=move.color==='w'?'b':'w';updateRights(move,s.map);if(move.color==='b')full++;
   half=move.piece.toLowerCase()==='p'?0:half+1;
  }else{
   castling=''; // On ne peut pas deviner les droits de roque au milieu d'une partie.
   if(s.placement===start){castling='KQkq';turn='w';}
   else setStatus('Couleur au trait inconnue : détection au prochain coup');
  }
  prev=s;removeArrow();
  // No analysis on initial load or after the player's own move.
  // It is scheduled only after a recognised opponent move.
  if(!played){request=null;fen=null;return;}
  const ownSide=playerSide(s.el);
  if(!ownSide){request=null;fen=null;setStatus('Orientation inconnue : choisis ton camp dans l’extension.');return;}
  if(played===ownSide){
   request=null;fen=null;
   setStatus('Ton coup détecté : analyse ignorée.');
   return;
  }
  if(!turn){request=null;fen=null;return;}
  fen=[s.placement,turn,castling||'-',ep,half,full].join(' ');
  if(!topic||!enabled){setStatus('Configure Cloudflare et ton canal dans le popup');return;}
  if(fen===seenFen)return;
  seenFen=fen;
  send(fen);
 }

 function websocketBase(){
  try{
   const u=new URL(relayUrl.trim());
   if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))return null;
   if(u.username||u.password||u.search||u.hash)return null;
   return (u.protocol==='https:'?'wss:':'ws:')+'//'+u.host;
  }catch{return null;}
 }
 function disconnect(){
  clearTimeout(reconnectTimer);
  if(relaySocket){relaySocket.onclose=null;relaySocket.close();relaySocket=null;}
 }
 function connect(){
  disconnect();
  const base=websocketBase();
  if(!enabled||!base||!/^[A-Za-z0-9_-]{32,100}$/.test(topic)){
   setStatus('Configure le Worker Cloudflare et un canal secret de 32 caractères dans le popup.');
   return;
  }
  const sock=new WebSocket(base+'/ws/'+encodeURIComponent(topic)+'?role=pc');
  relaySocket=sock;
  setStatus('Connexion Cloudflare…');
  sock.onopen=()=>setStatus('Cloudflare connecté : attente d’une position.');
  sock.onmessage=e=>{
   let msg;try{msg=JSON.parse(e.data);}catch{return;}
   if(msg.type==='relay-error'){setStatus('Relais : '+msg.error);return;}
   if(msg.type==='peer'){setStatus(msg.online?'iPhone connecté au relais.':'iPhone déconnecté du relais.');return;}
   if(msg.type!=='chess-result')return;
   const r=request;
   if(!r||r.id!==msg.requestId||r.fen!==msg.fen||fen!==r.fen)return;
   const move=msg.move;
   if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))return;
   const current=scan(),turn=r.fen.split(' ')[1],from=move.slice(0,2),to=move.slice(2,4);
   const sourcePiece=current?.map[from],destinationPiece=current?.map[to];
   const sourceColor=sourcePiece?(sourcePiece===sourcePiece.toUpperCase()?'w':'b'):null;
   const destinationColor=destinationPiece?(destinationPiece===destinationPiece.toUpperCase()?'w':'b'):null;
   if(!current||current.placement!==r.fen.split(' ')[0]||sourceColor!==turn||
     destinationColor===turn||turn!==playerSide(current.el)){
    request=null;removeArrow();setStatus('Résultat refusé : position ou camp incohérent.');
    return;
   }
   request=null;showArrow(move);setStatus('Analyse : '+move.slice(0,2)+' → '+move.slice(2,4)+' · '+(msg.evaluation||''));
  };
  sock.onerror=()=>setStatus('Erreur réseau WebSocket Cloudflare.');
  sock.onclose=()=>{
   if(relaySocket!==sock)return;relaySocket=null;
   setStatus('Cloudflare déconnecté : tentative de reconnexion.');
   reconnectTimer=setTimeout(connect,3500);
  };
 }
 function send(currentFen){
  const id=crypto.randomUUID();
  request={id,fen:currentFen,started:Date.now()};
  if(!relaySocket||relaySocket.readyState!==WebSocket.OPEN){
   request=null;
   setStatus('Cloudflare non connecté : aucune position envoyée.');
   return;
  }
  relaySocket.send(JSON.stringify({type:'chess-fen',requestId:id,fen:currentFen}));
  setStatus('Position transmise à Stockfish sur iPhone…');
 }
 function check(){
  if(request&&Date.now()-request.started>90000){
   request=null;setStatus('Pas de réponse iPhone : Safari actif et Cloudflare connecté ?');
  }
 }
 function setStatus(message){
  status=message;
  if(!ui){ui=document.createElement('div');ui.id='chess-training-status';ui.style.cssText='position:fixed;right:14px;bottom:14px;background:#13243a;color:#fff;font:13px system-ui;padding:10px 13px;z-index:2147483647;border-radius:9px;box-shadow:0 2px 10px #0008;pointer-events:none;max-width:320px';document.documentElement.appendChild(ui);}
  ui.textContent='♟ '+message;
 }
 function removeArrow(){overlay?.remove();overlay=null;}
 function showArrow(move){
  if(!board)return;
  removeArrow();
  const square=board.getBoundingClientRect(),w=square.width/8,h=square.height/8;
  const reverse=playerSide(board)==='b';
  const center=pos=>{const file=F.indexOf(pos[0]),rank=+pos[1]-1;return {x:(reverse?7-file:file)+.5,y:(reverse?rank:7-rank)+.5};};
  const a=center(move.slice(0,2)),b=center(move.slice(2,4));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 800 800');
  svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:999999;';
  const defs=document.createElementNS(svg.namespaceURI,'defs');defs.innerHTML='<marker id="ct-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#f59e0b"/></marker>';svg.appendChild(defs);
  const mark=(pt,fill)=>{const r=document.createElementNS(svg.namespaceURI,'rect');r.setAttribute('x',String(Math.floor(pt.x)*100));r.setAttribute('y',String(Math.floor(pt.y)*100));r.setAttribute('width','100');r.setAttribute('height','100');r.setAttribute('fill',fill);r.setAttribute('opacity','.45');svg.appendChild(r);};
  mark(a,'#facc15');mark(b,'#4ade80');
  const line=document.createElementNS(svg.namespaceURI,'line');for(const [k,v] of Object.entries({x1:a.x*100,y1:a.y*100,x2:b.x*100,y2:b.y*100}))line.setAttribute(k,String(v));line.setAttribute('stroke','#f59e0b');line.setAttribute('stroke-width','15');line.setAttribute('stroke-linecap','round');line.setAttribute('marker-end','url(#ct-arrow)');svg.appendChild(line);
  overlay=document.createElement('div');overlay.style.cssText='position:fixed;pointer-events:none;z-index:2147483646';overlay.appendChild(svg);
  document.documentElement.appendChild(overlay);
  const align=()=>{if(!overlay||!board)return;const rect=board.getBoundingClientRect();Object.assign(overlay.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});};align();
  window.addEventListener('resize',align,{passive:true});window.addEventListener('scroll',align,{passive:true});
  setTimeout(()=>{window.removeEventListener('resize',align);window.removeEventListener('scroll',align);},90000);
 }
 function setup(){
  if(observation)observation.disconnect();
  connect();if(timer)clearInterval(timer);if(pollTimer)clearInterval(pollTimer);
  const root=document.querySelector('main')||document.body;
  if(!root)return;
  observation=new MutationObserver(()=>{if(!enabled)return;clearTimeout(window.__ctDebounce);window.__ctDebounce=setTimeout(position,420);});
  observation.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  timer=setInterval(position,1500);pollTimer=setInterval(check,12000);position();
 }
})();
