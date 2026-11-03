'use strict';
const $=id=>document.getElementById(id);
const fen='r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8';
const out=$('result'),status=$('status'),go=$('run'),copy=$('copy');
let latest='';
go.onclick=()=>{
 go.disabled=true;copy.disabled=true;latest='';out.textContent='Démarrage du moteur…';status.textContent='Chargement de Stockfish WebAssembly…';
 let worker;let phase='uci',nps=0,nodes=0,depth=0,move='',endTimer=null;
 try{worker=new Worker('./stockfish-19-lite-single.js');}
 catch(e){failure(e.message);return;}
 function cleanup(){if(endTimer)clearTimeout(endTimer);worker.terminate();go.disabled=false;}
 function failure(reason){cleanup();status.textContent='Échec : '+reason;out.textContent='Test non terminé.';}
 worker.onerror=e=>failure('Stockfish ne se charge pas : '+(e.message||'erreur WebWorker'));
 worker.onmessage=e=>{
  const s=String(e.data).trim();
  if(s==='uciok'&&phase==='uci'){phase='ready';worker.postMessage('setoption name Threads value 1');worker.postMessage('setoption name Hash value 16');worker.postMessage('isready');}
  else if(s==='readyok'&&phase==='ready'){
   phase='search';status.textContent='Calcul en cours pendant 10 secondes… Garde cet écran actif.';
   worker.postMessage('ucinewgame');worker.postMessage('position fen '+fen);worker.postMessage('go movetime 10000');
   endTimer=setTimeout(()=>{if(phase==='search')failure('Temps dépassé : moteur bloqué ou navigateur suspendu.');},25000);
  }
  else if(phase==='search'&&s.startsWith('info ')){
   const a=s.match(/\bnodes (\d+)/),b=s.match(/\bnps (\d+)/),c=s.match(/\bdepth (\d+)/);
   if(a)nodes=Number(a[1]);if(b)nps=Number(b[1]);if(c)depth=Number(c[1]);
   out.textContent='Profondeur '+depth+' · '+nodes.toLocaleString('fr-FR')+' nœuds · '+nps.toLocaleString('fr-FR')+' NPS';
  }else if(phase==='search'&&s.startsWith('bestmove ')){
   phase='done';move=s.split(/\s+/)[1]||'?';
   const device=navigator.userAgent.includes('iPhone')?'iPhone 16 Pro (à confirmer)':navigator.userAgent.includes('Windows')?'PC Windows (i5-1335U à confirmer)':'Navigateur inconnu';
   latest=device+' | Stockfish 19 Lite WASM | 1 thread | 10 s | '+nps+' NPS | '+nodes+' nœuds | profondeur '+depth+' | coup '+move;
   out.textContent=nps.toLocaleString('fr-FR')+' NPS\n'+nodes.toLocaleString('fr-FR')+' nœuds\nProfondeur '+depth+'\nCoup '+move;
   status.textContent='Test terminé sur '+device+'. Copie le résultat, puis refais le même test sur l’autre appareil.';
   copy.disabled=false;cleanup();
  }
 };
 worker.postMessage('uci');
};
copy.onclick=()=>{if(latest)navigator.clipboard.writeText(latest).then(()=>status.textContent='Résultat copié. Colle-le dans la conversation.').catch(()=>status.textContent='Copie indisponible. Sélectionne les valeurs affichées.'));};
