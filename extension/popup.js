'use strict';
const $=id=>document.getElementById(id);
chrome.storage.local.get({topic:'',relayUrl:'',enabled:true,playerColor:'auto'},settings=>{
 $('topic').value=settings.topic||'';
 $('relayUrl').value=settings.relayUrl||'';
 $('enabled').checked=!!settings.enabled;
 $('playerColor').value=settings.playerColor||'auto';
 $('status').textContent='Réglages chargés. Ouvre un échiquier pris en charge.';
});
function save(){
 const topic=$('topic').value.trim();
 chrome.storage.local.set({topic,relayUrl:$('relayUrl').value.trim(),enabled:$('enabled').checked,playerColor:$('playerColor').value},()=>{
  $('status').textContent=topic.length<32?'Renseigne le canal secret de l’iPhone.':'Paramètres enregistrés. Détection automatique active sur les onglets compatibles.';
 });
}
$('topic').addEventListener('input',save);
$('relayUrl').addEventListener('input',save);
$('enabled').addEventListener('change',save);

$('playerColor').addEventListener('change',save);


$('link-test').addEventListener('click',()=>{
 const topic=$('topic').value.trim(),raw=$('relayUrl').value.trim();
 let address;
 try{const u=new URL(raw);if(u.protocol!=='https:')throw Error('URL HTTPS obligatoire');address='wss://'+u.host;}catch{
  $('status').textContent='Indique une URL HTTPS Cloudflare valide.';return;
 }
 if(!/^[A-Za-z0-9_-]{32,100}$/.test(topic)){$('status').textContent='Canal secret trop court (32 caractères minimum).';return;}
 $('status').textContent='Connexion de test à Cloudflare…';
 const ws=new WebSocket(address+'/ws/'+encodeURIComponent(topic)+'?role=pc');
 const id=crypto.randomUUID(),fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 const timeout=setTimeout(()=>{ws.close();$('status').textContent='Aucune réponse après 30 s. Vérifie Safari et Stockfish.';},30000);
 ws.onopen=()=>{ws.send(JSON.stringify({type:'chess-fen',requestId:id,fen}));$('status').textContent='FEN test envoyée : attends la réponse de l’iPhone…';};
 ws.onmessage=e=>{
  try{
   const m=JSON.parse(e.data);
   if(m.type==='relay-error'){$('status').textContent='Relais : '+m.error;clearTimeout(timeout);ws.close();}
   if(m.type==='chess-result'&&m.requestId===id&&m.fen===fen){
    clearTimeout(timeout);$('status').textContent='Test réussi ! iPhone → PC : '+m.move+' ('+(m.evaluation||'')+').';ws.close();
   }
  }catch{}
 };
 ws.onerror=()=>{$('status').textContent='Connexion au Worker impossible.';clearTimeout(timeout);};
});
