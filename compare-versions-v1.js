'use strict';
const $=id=>document.getElementById(id),FEN='r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8';
const variants={18:{name:'Stockfish 18.0.8 Lite',file:'stockfish-18-lite-single.js'},19:{name:'Stockfish 19.0.1 Lite',file:'stockfish-19-lite-single.js'}};
const order=[19,18,18,19],results=[];let worker=null,stage='',index=0,active=false,timeout=null,stats=null,alive=0;
const status=s=>$('status').textContent=s,failmsg=s=>$('error').textContent=s;
const n=v=>Number(v).toLocaleString('fr-FR');
try{const saved=localStorage.getItem('chessEngineVersion');if(saved==='18'||saved==='19')$('choice').value=saved;}catch{}
function cleanup(){alive++;clearTimeout(timeout);if(worker){worker.terminate();worker=null;}stage='';active=false;$('start').disabled=false;$('stop').disabled=true;}
function fail(reason){cleanup();failmsg('Erreur : '+reason);status('Comparaison arrêtée. Tu peux relancer.');}
function alarm(reason,delay=24000){clearTimeout(timeout);timeout=setTimeout(()=>fail(reason),delay);}
function paint(){
 $('rows').replaceChildren();
 if(!results.length){$('rows').textContent='Aucun résultat';return;}
 for(const r of results){
  const tr=document.createElement('tr');
  for(const val of [r.version+' · essai '+r.pass,n(r.nps),String(r.depth),r.move]){
   const td=document.createElement('td');td.textContent=val;tr.appendChild(td);
  }
  $('rows').appendChild(tr);
 }
}
function next(){
 if(!active)return;
 if(index>=order.length){
  const avg=v=>{const a=results.filter(r=>r.version===v);return Math.round(a.reduce((s,r)=>s+r.nps,0)/a.length);};
  $('summary').textContent='Moyenne : Stockfish 18 = '+n(avg(18))+' NPS ; Stockfish 19 = '+n(avg(19))+' NPS. Le plus rapide ici : Stockfish '+(avg(18)>avg(19)?'18':'19')+'.';
  $('copy').disabled=false;cleanup();status('Comparaison terminée. Pour la force aux échecs, conserve plutôt la version la plus récente (19) sauf problème.');
  return;
 }
 const version=order[index],pass=results.filter(x=>x.version===version).length+1;
 stats={version,pass,nps:0,nodes:0,depth:0,move:'—'};
 stage='boot';status('Chargement '+variants[version].name+' · essai '+(index+1)+'/4…');
 try{
  worker=new Worker('./'+variants[version].file);
  const myWorker=worker;
  worker.onerror=e=>{if(active&&worker===myWorker)fail('Stockfish '+version+' : '+(e.message||'worker inaccessible'));};
  worker.onmessageerror=()=>fail('Message moteur non lisible.');
  worker.onmessage=e=>{if(!active||worker!==myWorker)return;
   for(const line of String(e.data||'').split(/\r?\n/)){
    const s=line.trim();if(!s)continue;
    if(s==='uciok'&&stage==='boot'){
      stage='ready';myWorker.postMessage('setoption name Hash value 32');myWorker.postMessage('setoption name Threads value 1');myWorker.postMessage('isready');alarm('Moteur '+version+' ne répond pas à isready.');
    }else if(s==='readyok'&&stage==='ready'){
      stage='search';status(variants[version].name+' · essai '+(index+1)+'/4 : calcul 8 s en cours…');
      myWorker.postMessage('ucinewgame');myWorker.postMessage('position fen '+FEN);myWorker.postMessage('go movetime 8000');alarm('Stockfish '+version+' ne termine pas son calcul.',22000);
    }else if(stage==='search'&&s.startsWith('info ')){
      let x=s.match(/\bnps (\d+)/);if(x)stats.nps=Number(x[1]);
      x=s.match(/\bnodes (\d+)/);if(x)stats.nodes=Number(x[1]);
      x=s.match(/\bdepth (\d+)/);if(x)stats.depth=Number(x[1]);
    }else if(stage==='search'&&s.startsWith('bestmove ')){
      clearTimeout(timeout);stats.move=s.split(/\s+/)[1]||'?';results.push(stats);paint();
      myWorker.terminate();worker=null;stage='';index++;next();return;
    }
   }
  };
  alarm('Stockfish '+version+' ne démarre pas.',25000);
  myWorker.postMessage('uci');
 }catch(e){fail('Impossible de charger '+version+' : '+e.message);}
}
$('start').onclick=()=>{if(active)return;results.length=0;index=0;failmsg('');$('summary').textContent='';$('copy').disabled=true;paint();active=true;$('start').disabled=true;$('stop').disabled=false;next();};
$('stop').onclick=()=>{cleanup();status('Test interrompu.');};
$('apply').onclick=()=>{const choice=$('choice').value;if(!['18','19'].includes(choice))return;try{localStorage.setItem('chessEngineVersion',choice);status('Stockfish '+choice+' sélectionné. Recharge la page principale pour appliquer.');}catch(e){failmsg('Enregistrement impossible : '+e.message);}};
$('copy').onclick=async()=>{const txt='Comparatif Stockfish (iPhone, 1 thread, Hash 32 Mio, 8s)\n'+results.map(r=>r.version+' passe '+r.pass+' : '+r.nps+' NPS, profondeur '+r.depth+', '+r.nodes+' nœuds, coup '+r.move).join('\n')+'\n'+$('summary').textContent;try{await navigator.clipboard.writeText(txt);status('Résultats copiés.');}catch{status(txt);}};
