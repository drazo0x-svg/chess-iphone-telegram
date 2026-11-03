'use strict';
const $=id=>document.getElementById(id);
let source=null,engine=null,ready=false,busy=false,queued=null,running=null,latestEval='',active=false;
const seen=new Set();
try{const saved=JSON.parse(localStorage.getItem('chessConfig')||'{}');for(const k of ['topic','seconds'])if(saved[k])$(k).value=saved[k];}catch{}
const status=s=>$('status').textContent=s;
function persist(){const o={};for(const k of ['topic','seconds'])o[k]=$(k).value.trim();localStorage.setItem('chessConfig',JSON.stringify(o));}
function validateFen(f){const t=f.trim().split(/\s+/);if(t.length!==6||!/^[wb]$/.test(t[1])||!/^(?:-|K?Q?k?q?)$/.test(t[2])||!/^(?:-|[a-h][36])$/.test(t[3])||!/^\d+$/.test(t[4])||!/^\d+$/.test(t[5])||Number(t[5])<1)throw Error('FEN invalide (6 champs requis)');const rows=t[0].split('/');if(rows.length!==8||rows.some(r=>!r||!/^[prnbqkPRNBQK1-8]+$/.test(r)||[...r].reduce((n,c)=>n+(/[1-8]/.test(c)?+c:1),0)!==8))throw Error('Rangs FEN invalides');const pieces=t[0];if([...pieces].filter(x=>x==='K').length!==1||[...pieces].filter(x=>x==='k').length!==1)throw Error('Il faut exactement deux rois, un de chaque couleur');}
async function publishResult(task,move,evaluation){
 if(!task.requestId)return status('Analyse locale terminée.');
 const topic=$('topic').value.trim();
 const payload={type:'chess-result',requestId:task.requestId,fen:task.fen,move,evaluation,sent:Date.now()};
 try{
  const response=await fetch('https://ntfy.sh/'+encodeURIComponent(topic+'-result'),{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)});
  if(!response.ok)throw Error('HTTP '+response.status);
  status('Coup renvoyé à Chrome. Ouvre le popup de l’extension pour le voir.');
 }catch(error){status('Calcul terminé, mais envoi vers Chrome impossible : '+error.message);}
}
function engineInit(){if(engine)return;try{engine=new Worker('./stockfish-19-lite-single.js');engine.onerror=e=>{ready=false;status('Erreur moteur Stockfish. Vérifie les fichiers JS et WASM dans GitHub. '+(e.message||''));};engine.onmessage=e=>{const line=String(e.data).trim();if(line==='uciok')engine.postMessage('isready');if(line==='readyok'){ready=true;status(active?'Moteur prêt, écoute active.':'Moteur prêt.');if(queued&&!busy){const q=queued;queued=null;analyze(q.fen,q.requestId);}}if(line.startsWith('info ')&&line.includes(' score ')){const x=line.match(/ score (cp|mate) (-?\d+)/);if(x)latestEval=x[1]==='cp'?((+x[2]/100).toFixed(2)):'mat '+x[2];}if(line.startsWith('bestmove ')){busy=false;const task=running;running=null;if(!task)return;const move=line.split(/\s+/)[1];const nice=move?.length>=4?move.slice(0,2)+' → '+move.slice(2,4)+(move.length>4?' = '+move.slice(4):''):move;$('result').textContent=nice;$('details').textContent=task.fen;
status('Calcul terminé, transmission vers Chrome…');publishResult(task,move,latestEval||'—');
if(queued){const q=queued;queued=null;setTimeout(()=>analyze(q.fen,q.requestId),0);}}};engine.postMessage('uci');}catch(e){status('Impossible de démarrer Stockfish : '+e.message);}}
function analyze(fen,requestId=null){try{validateFen(fen);}catch(e){status(e.message);return;}engineInit();if(!ready||busy){queued={fen,requestId};status('En attente de Stockfish ou de la précédente analyse.');return;}busy=true;running={fen,requestId};latestEval='';status('Stockfish calcule sur cet iPhone…');engine.postMessage('ucinewgame');engine.postMessage('position fen '+fen);engine.postMessage('go movetime '+(Number($('seconds').value)||5)*1000);}
$('generate').onclick=()=>{const v=new Uint8Array(24);crypto.getRandomValues(v);$('topic').value='chess-'+Array.from(v,x=>x.toString(16).padStart(2,'0')).join('');persist();status('Copie ce même canal dans ton extension Chrome.');};
$('start').onclick=()=>{persist();const topic=$('topic').value.trim();if(!/^[a-zA-Z0-9_-]{12,100}$/.test(topic))return status('Canal invalide : au moins 12 caractères.');if(source)source.close();active=true;engineInit();source=new EventSource('https://ntfy.sh/'+encodeURIComponent(topic)+'/sse?since=10s');source.onopen=()=>status('Écoute du canal active.');source.onerror=()=>status('ntfy déconnecté : reconnexion automatique en cours.');source.onmessage=e=>{try{const env=JSON.parse(e.data);if(env.event!=='message')return;const m=JSON.parse(env.message);if(m.type!=='chess-fen'||!m.fen||!m.requestId||seen.has(m.requestId)||Math.abs(Date.now()-m.sent)>120000)return;seen.add(m.requestId);if(seen.size>100)seen.clear();analyze(m.fen,m.requestId);}catch(e){console.warn('Message ignoré',e);}};};
$('stop').onclick=()=>{active=false;if(source){source.close();source=null;}status('Écoute arrêtée.');};
$('test').onclick=()=>{persist();analyze($('fen').value.trim());};