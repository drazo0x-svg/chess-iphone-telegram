'use strict';
const $=id=>document.getElementById(id);
const FEN='r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8';
const HASHES=[16,32,64],SEARCH_MS=8000, num=x=>Number(x).toLocaleString('fr-FR');
let worker=null,phase='idle',active=false,ready=false,finished=[],current=null,timeout=null,picked=null,runToken=0;
const state=s=>$('state').textContent=s;
const err=s=>$('error').textContent=s;
function halt(){
 active=false;runToken++;clearTimeout(timeout);
 if(worker){worker.terminate();worker=null;}
 phase='idle';ready=false;current=null;
 $('run').disabled=false;$('stop').disabled=true;
}
function failure(message){halt();err('Erreur : '+message);state('Test interrompu. Tu peux réessayer.');}
function render(){
 $('results').innerHTML='';
 if(!finished.length){$('results').textContent='Aucun résultat';return;}
 for(const r of finished){
  const tr=document.createElement('tr');
  for(const txt of [r.hash+' Mio',num(r.nps),String(r.depth),num(r.nodes)]){
   const td=document.createElement('td');td.textContent=txt;tr.appendChild(td);
  }
  $('results').appendChild(tr);
 }
}
function engineMessage(event){
 const lines=String(event.data||'').split(/\r?\n/);
 for(const s0 of lines){
  const s=s0.trim();if(!s)continue;
  if(s==='uciok'&&phase==='boot'){
   worker.postMessage('setoption name Threads value 1');
   worker.postMessage('isready');phase='bootready';
  }else if(s==='readyok'&&phase==='bootready'){
   clearTimeout(timeout);ready=true;phase='idle';runNext();
  }else if(s==='readyok'&&phase==='setup'){
   clearTimeout(timeout);phase='search';
   state('Test '+(finished.length+1)+'/3 : '+current.hash+' Mio, calcul en cours pendant 8 s…');
   worker.postMessage('ucinewgame');
   worker.postMessage('position fen '+FEN);
   worker.postMessage('go movetime '+SEARCH_MS);
   timeout=setTimeout(()=>failure('Le moteur ne termine pas son analyse (Safari a peut-être été suspendu).'),SEARCH_MS+14000);
  }else if(s.startsWith('info ')&&phase==='search'){
   const n=s.match(/\bnps (\d+)/),d=s.match(/\bdepth (\d+)/),nodes=s.match(/\bnodes (\d+)/);
   if(n)current.nps=Number(n[1]);
   if(d)current.depth=Number(d[1]);
   if(nodes)current.nodes=Number(nodes[1]);
  }else if(s.startsWith('bestmove ')&&phase==='search'){
   clearTimeout(timeout);
   current.move=s.split(/\s+/)[1]||'?';finished.push(current);
   render();phase='idle';runNext();
  }
 }
}
function runNext(){
 if(!active)return;
 if(finished.length===HASHES.length){
  const sorted=[...finished].sort((a,b)=>b.depth-a.depth||b.nps-a.nps);
  picked=sorted[0].hash;
  state('Comparatif terminé. Tu peux appliquer le réglage choisi.');
  $('winner').textContent='Meilleur essai : Hash '+picked+' Mio (profondeur '+sorted[0].depth+').';
  $('apply').disabled=false;$('copy').disabled=false;
  halt();return;
 }
 current={hash:HASHES[finished.length],nps:0,depth:0,nodes:0,move:'—'};
 phase='setup';
 worker.postMessage('setoption name Hash value '+current.hash);
 worker.postMessage('isready');
 timeout=setTimeout(()=>failure('Stockfish ne confirme pas le réglage Hash.'),12000);
 state('Configuration de Hash '+current.hash+' Mio…');
}
$('run').onclick=()=>{
 if(active)return;
 err('');finished=[];picked=null;current=null;render();
 $('winner').textContent='—';$('apply').disabled=true;$('copy').disabled=true;
 $('run').disabled=true;$('stop').disabled=false;active=true;
 state('Chargement de Stockfish 19 Lite WASM…');
 try{
  worker=new Worker('./stockfish-19-lite-single.js');
  worker.onerror=e=>failure('Chargement moteur : '+(e.message||'échec du Worker'));
  worker.onmessageerror=()=>failure('Message moteur illisible.');
  worker.onmessage=engineMessage;
  phase='boot';
  timeout=setTimeout(()=>failure('Stockfish ne répond pas après 25 secondes.'),25000);
  worker.postMessage('uci');
 }catch(e){failure(e.message||String(e));}
};
$('stop').onclick=()=>{halt();state('Test arrêté.');};
$('apply').onclick=()=>{
 if(![16,32,64].includes(picked))return;
 try{
  localStorage.setItem('chessOptimalHash',String(picked));
  state('Hash '+picked+' Mio enregistré pour l’application iPhone. Recharge la page principale pour l’activer.');
 }catch(e){err('Impossible de sauvegarder : '+e.message);}
};
$('copy').onclick=async()=>{
 const text='Stockfish 19 Lite WASM / 1 thread / 8 secondes par réglage\n'+finished.map(r=>r.hash+' Mio : '+r.nps+' NPS / profondeur '+r.depth+' / '+r.nodes+' nœuds').join('\n')+'\nMeilleur : '+picked+' Mio';
 try{await navigator.clipboard.writeText(text);state('Résultats copiés : colle-les dans ChatGPT.');}
 catch(e){state('Copie impossible. Voici les résultats : '+text);}
};
