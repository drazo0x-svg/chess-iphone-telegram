'use strict';
const $=id=>document.getElementById(id);
const DEFAULT_RELAY='https://chess-iphone-telegram.ptitfilsson.workers.dev';
let source=null,engine=null,ready=false,busy=false,queued=null,running=null,latestEval='',active=false,engineTimeout=null;
let diagnostics=[];
function diag(message){diagnostics.push(message);if(diagnostics.length>12)diagnostics.shift();const element=document.getElementById('diagnostics');if(element)element.textContent=diagnostics.join('\n');}
const seen=new Set();
try{const saved=JSON.parse(localStorage.getItem('chessConfig')||'{}');for(const k of ['topic','seconds'])if(saved[k])$(k).value=saved[k];if($('seconds').value==='5')$('seconds').value='8';$('relay').value=DEFAULT_RELAY;}catch{$('relay').value=DEFAULT_RELAY;}
const status=s=>$('status').textContent=s;
function persist(){const o={};for(const k of ['topic','seconds','relay'])o[k]=$(k).value.trim();localStorage.setItem('chessConfig',JSON.stringify(o));}
function validateFen(f){const t=f.trim().split(/\s+/);if(t.length!==6||!/^[wb]$/.test(t[1])||!/^(?:-|K?Q?k?q?)$/.test(t[2])||!/^(?:-|[a-h][36])$/.test(t[3])||!/^\d+$/.test(t[4])||!/^\d+$/.test(t[5])||Number(t[5])<1)throw Error('FEN invalide (6 champs requis)');const rows=t[0].split('/');if(rows.length!==8||rows.some(r=>!r||!/^[prnbqkPRNBQK1-8]+$/.test(r)||[...r].reduce((n,c)=>n+(/[1-8]/.test(c)?+c:1),0)!==8))throw Error('Rangs FEN invalides');const pieces=t[0];if([...pieces].filter(x=>x==='K').length!==1||[...pieces].filter(x=>x==='k').length!==1)throw Error('Il faut exactement deux rois, un de chaque couleur');}

function relayEndpoint(){
 const raw=$('relay').value.trim();
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))return null;
  if(u.username||u.password||u.search||u.hash)return null;
  return (u.protocol==='https:'?'wss:':'ws:')+'//'+u.host;
 }catch{return null;}
}
function publishResult(task,move,evaluation){
 if(!task.requestId)return status('Analyse locale terminée.');
 if(!source||source.readyState!==WebSocket.OPEN)return status('Calcul local terminé, mais PC déconnecté.');
 source.send(JSON.stringify({type:'chess-result',requestId:task.requestId,fen:task.fen,move,evaluation}));
 status('Résultat transmis à Chrome par Cloudflare.');
}
let reconnectTimer=null;
function connectRelay(){
 const endpoint=relayEndpoint(),topic=$('topic').value.trim();
 if(!endpoint||!/^[A-Za-z0-9_-]{32,100}$/.test(topic)){
  status('Indique URL HTTPS du Worker Cloudflare et un canal secret de 32 caractères minimum.');
  active=false;return;
 }
 const old=source;if(old){old.onclose=null;old.close();}
 status('Connexion au relais Cloudflare…');
 const sock=new WebSocket(endpoint+'/ws/'+encodeURIComponent(topic)+'?role=phone');
 source=sock;
 sock.onopen=()=>{diag('Relais Cloudflare connecté.');status('Relais connecté. Stockfish attend une position.');engineInit();};
 sock.onmessage=e=>{
  let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.type==='relay-error'){status('Relais : '+m.error);return;}
  if(m.type==='peer'){diag('PC '+(m.online?'connecté':'déconnecté'));return;}
  if(m.type!=='chess-fen'||!m.fen||!m.requestId||seen.has(m.requestId))return;
  if(m.sent&&Math.abs(Date.now()-m.sent)>120000)return;
  seen.add(m.requestId);if(seen.size>150)seen.clear();
  diag('Position reçue : '+m.requestId.slice(0,8));
  analyze(m.fen,m.requestId);
 };
 sock.onerror=()=>diag('Échec réseau WebSocket.');
 sock.onclose=()=>{if(source!==sock)return;source=null;if(active){status('Connexion Cloudflare interrompue : reconnexion…');clearTimeout(reconnectTimer);reconnectTimer=setTimeout(connectRelay,3000);}};
}
let engineKind='wasm',fallbackTried=false;
function engineReset(){
 if(engine)try{engine.terminate();}catch{}
 clearTimeout(engineTimeout);
 engine=null;ready=false;busy=false;running=null;
}
function fallback(reason){
 diag('WASM indisponible : '+reason);
 if(engineKind==='asm'||fallbackTried){
  engineReset();
  status('Stockfish ne démarre pas. Vérifie le diagnostic et recharge Safari.');
  return;
 }
 fallbackTried=true;
 engineReset();
 engineKind='asm';
 status('Mode de secours : chargement Stockfish JavaScript (sans WASM)…');
 engineInit();
}
function processEngineLine(line){
 if(!line)return;
 if(line==='uciok'){
  diag('UCI initialisé ('+engineKind+').');
  const configuredHash=Number(localStorage.getItem('chessOptimalHash'));
  const hash=[16,32,64].includes(configuredHash)?configuredHash:16;
  engine.postMessage('setoption name Threads value 1');
  engine.postMessage('setoption name Hash value '+hash);
  diag('Réglage : Hash '+hash+' Mio, 1 thread.');
  engine.postMessage('isready');
  return;
 }
 if(line==='readyok'){
  clearTimeout(engineTimeout);
  ready=true;
  diag('Stockfish prêt ('+engineKind+').');
  status(active?'Stockfish prêt, écoute active.':'Stockfish prêt.');
  if(queued&&!busy){
   const q=queued;queued=null;analyze(q.fen,q.requestId);
  }
  return;
 }
 if(line.startsWith('info ')&&line.includes(' score ')){
  const m=line.match(/ score (cp|mate) (-?\d+)/);
  if(m)latestEval=m[1]==='cp'?(+m[2]/100).toFixed(2):'mat '+m[2];
 }
 if(line.startsWith('bestmove ')){
  busy=false;
  const task=running;running=null;
  if(!task)return;
  const move=line.match(/^bestmove\s+(\S+)/)?.[1];
  if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)){
   diag('Réponse brute du moteur : '+line);
   status(move==='(none)'?'Aucun coup légal dans cette position (mat, pat ou FEN incorrecte).':'Réponse Stockfish illisible : '+line);
   return;
  }
  const nice=move.slice(0,2)+' → '+move.slice(2,4)+(move.length>4?' = '+move.slice(4):'');
  // A more recent position has arrived: do not transmit a stale move.
  if(!queued){
   $('result').textContent=nice;
   $('details').textContent=task.fen;
   status('Calcul terminé, transmission vers Chrome…');
   publishResult(task,move,latestEval||'—');
  }else{
   diag('Résultat ancien ignoré ; analyse de la nouvelle position.');
  }
  if(queued){
   const next=queued;queued=null;
   setTimeout(()=>analyze(next.fen,next.requestId),0);
  }
 }
}
function engineInit(){
 if(engine)return;
 try{
  const preferredVersion=localStorage.getItem('chessEngineVersion')==='18'?'18':'19';
  const file=engineKind==='asm'?'stockfish-19-asm.js':preferredVersion==='18'?'stockfish-18-lite-single.js':'stockfish-19-lite-single.js';
  diag('Chargement : '+file);
  status('Initialisation de Stockfish '+(engineKind==='asm'?'JavaScript':'WebAssembly')+'…');
  const worker=new Worker('./'+file);
  engine=worker;
  worker.onerror=e=>{
   if(engine!==worker)return;
   const detail=(e.message||'Erreur inconnue')+(e.filename?' dans '+e.filename:'');
   diag('Erreur Worker : '+detail);
   fallback(detail);
  };
  worker.onmessageerror=()=>{if(engine===worker)fallback('Erreur de message du moteur');};
  worker.onmessage=e=>{
   if(engine!==worker)return;
   const lines=String(e.data||'').split(/\r?\n/);
   for(const line of lines)processEngineLine(line.trim());
  };
  engineTimeout=setTimeout(()=>{
   if(!ready&&engine===worker)fallback('Démarrage sans réponse UCI après 20 secondes');
  },20000);
  worker.postMessage('uci');
 }catch(error){fallback(error.message||String(error));}
}

function analyze(fen,requestId=null){try{validateFen(fen);}catch(e){status(e.message);return;}engineInit();if(!ready||busy){queued={fen,requestId};status(!ready?'En attente de Stockfish : initialisation du moteur en cours…':'Stockfish termine la précédente analyse…');return;}busy=true;running={fen,requestId};latestEval='';status('Stockfish calcule sur cet iPhone…');engine.postMessage('ucinewgame');engine.postMessage('position fen '+fen);engine.postMessage('go movetime '+(Number($('seconds').value)||8)*1000);}
$('generate').onclick=()=>{const v=new Uint8Array(24);crypto.getRandomValues(v);$('topic').value='chess-'+Array.from(v,x=>x.toString(16).padStart(2,'0')).join('');persist();status('Copie ce même canal dans ton extension Chrome.');};
$('start').onclick=()=>{persist();active=true;connectRelay();};
$('stop').onclick=()=>{active=false;clearTimeout(reconnectTimer);if(source){source.onclose=null;source.close();source=null;}status('Écoute arrêtée.');};
$('test').onclick=()=>{persist();analyze($('fen').value.trim());};
$('reset-engine').onclick=()=>{
 if(source){source.onclose=null;source.close();source=null;active=false;clearTimeout(reconnectTimer);}
 engineReset();queued=null;latestEval='';engineKind='wasm';fallbackTried=false;
 diag('Réinitialisation demandée.');
 status('Moteur réinitialisé. Appuie sur Démarrer l’écoute pour relancer.');
};
