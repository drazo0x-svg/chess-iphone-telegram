'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const FEN='r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8';
 const THREADS=[1,2,4,8,16],format=n=>Number(n).toLocaleString('fr-FR');
 let active=false,worker=null,latest=[],stopWanted=false,waiting=null;
 function status(t){$('status').textContent=t;}
 function clearEngine(){if(worker){worker.onmessage=null;worker.onerror=null;worker.terminate();worker=null;}}
 function cancel(reason){
  stopWanted=true;clearEngine();
  if(waiting){waiting.reject(Error(reason));waiting=null;}
 }
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function prepare(){
  const note=$('isolation');
  if(!('serviceWorker' in navigator)){note.textContent='❌ Ce navigateur ne prend pas en charge les Service Workers.';return;}
  try{
   const registration=await navigator.serviceWorker.register('./coi-sw.js',{scope:'./',updateViaCache:'none'});
   await navigator.serviceWorker.ready;
   if(!navigator.serviceWorker.controller){
    note.textContent='Configuration du navigateur : actualisation automatique…';
    let reloaded=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloaded){reloaded=true;location.reload();}},{once:true});
    if(registration.active&&!reloaded)setTimeout(()=>location.reload(),1300);
    return;
   }
   if(!crossOriginIsolated||typeof SharedArrayBuffer==='undefined'){
    note.textContent='❌ Isolation absente. Recharge la page avec Ctrl+F5, puis vérifie le navigateur.';
    return;
   }
   note.textContent='✅ Multithread autorisé · '+(navigator.hardwareConcurrency||'?')+' threads logiques détectés · Isolation active';
   $('run').disabled=false;status('Prêt : tests sur 1, 2, 4, 8 et 16 threads.');
  }catch(e){note.textContent='❌ Impossible d’activer le multithread : '+e.message;status('Vérifie que la page est ouverte en HTTPS.');}
 }
 async function runCase(threads){
  if(stopWanted)throw Error('Test arrêté.');
  clearEngine();
  return await new Promise((resolve,reject)=>{
   let phase='init',nodes=0,nps=0,depth=0,best='—',hasThreadOption=false,finished=false;
   const watchdog=setTimeout(()=>finish(Error('Stockfish sans réponse pour '+threads+' threads (45 s).')),45000);
   function finish(error,data){
    if(finished)return;finished=true;clearTimeout(watchdog);clearEngine();
    if(waiting)waiting=null;
    error?reject(error):resolve(data);
   }
   waiting={reject:e=>finish(e)};
   try{worker=new Worker('./engine/stockfish-19-lite.js');}catch(e){finish(e);return;}
   worker.onerror=e=>finish(Error('Erreur moteur : '+(e.message||'fichier moteur inaccessible')+' — ouvre /multithread/engine/stockfish-19-lite.js pour vérifier le fichier.'));
   worker.onmessageerror=()=>finish(Error('Réponse illisible du moteur WebAssembly.'));
   worker.onmessage=e=>{
    for(const raw of String(e.data||'').split(/\r?\n/)){
     const line=raw.trim();
     if(line.startsWith('option name Threads '))hasThreadOption=true;
     if(line==='uciok'&&phase==='init'){
      if(!hasThreadOption){finish(Error('Ce fichier Stockfish ne propose pas Threads : test interrompu pour éviter un faux score.'));return;}
      phase='ready';worker.postMessage('setoption name Threads value '+threads);
      worker.postMessage('setoption name Hash value 32');worker.postMessage('isready');
     }else if(line==='readyok'&&phase==='ready'){
      phase='search';status('Calcul en cours : '+threads+' thread'+(threads>1?'s':'')+' / 16 · 10 secondes…');
      worker.postMessage('ucinewgame');worker.postMessage('position fen '+FEN);worker.postMessage('go movetime 10000');
     }else if(phase==='search'&&line.startsWith('info ')){
      const a=line.match(/\bnodes (\d+)/),b=line.match(/\bnps (\d+)/),c=line.match(/\bdepth (\d+)/);
      if(a)nodes=Number(a[1]);if(b)nps=Number(b[1]);if(c)depth=Number(c[1]);
     }else if(phase==='search'&&line.startsWith('bestmove ')){
      phase='done';best=line.split(/\s+/)[1]||'?';
      if(!nodes||!nps){finish(Error('Aucun compteur UCI pour '+threads+' threads.'));return;}
      finish(null,{threads,nodes,nps,depth,best});
     }
    }
   };
   worker.postMessage('uci');
  });
 }
 function redraw(){
  const rows=$('rows');
  if(!latest.length){rows.innerHTML='<tr><td colspan="5">Aucun résultat</td></tr>';return;}
  rows.innerHTML=latest.map(r=>'<tr><td>'+r.threads+'</td><td>'+format(r.nodes)+'</td><td><strong>'+format(r.nps)+'</strong></td><td>'+r.depth+'</td><td>'+r.best+'</td></tr>').join('');
  const base=latest.find(x=>x.threads===1);
  const peak=latest[latest.length-1];
  $('summary').textContent=base&&peak.threads>1?'Gain '+peak.threads+' threads / 1 thread : ×'+(peak.nps/base.nps).toFixed(2):'';
 }
 function report(){
  const header='Benchmark Stockfish 19 Lite WASM · Ryzen 7 7800X3D (à confirmer) · Windows · Hash 32 Mio · 10 s par test';
  return [header,...latest.map(r=>r.threads+' threads | '+r.nps+' NPS | '+r.nodes+' nœuds | profondeur '+r.depth+' | coup '+r.best)].join('\n');
 }
 $('run').onclick=async()=>{
  if(active)return;active=true;stopWanted=false;latest=[];redraw();
  $('run').disabled=true;$('stop').disabled=false;$('copy').disabled=true;
  try{
   for(const threads of THREADS){
    status('Chargement Stockfish 19 Lite · '+threads+' threads…');
    const r=await runCase(threads);
    latest.push(r);redraw();$('copy').disabled=false;
    await sleep(300);
   }
   status('✅ Benchmark terminé. Copie les résultats et envoie-les dans la conversation.');
  }catch(e){status('⚠️ '+e.message+' · Résultats déjà mesurés conservés.');}
  finally{active=false;$('run').disabled=false;$('stop').disabled=true;clearEngine();}
 };
 $('stop').onclick=()=>{cancel('Benchmark arrêté volontairement.');$('stop').disabled=true;};
 $('copy').onclick=async()=>{
  try{await navigator.clipboard.writeText(report());status('Résultats copiés. Colle-les ici !');}
  catch(e){status('Copie indisponible : sélectionne les valeurs du tableau.');}
 };
 prepare();
})();