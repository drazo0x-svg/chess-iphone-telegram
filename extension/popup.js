'use strict';
const $=id=>document.getElementById(id);
chrome.storage.local.get({topic:'',enabled:true,playerColor:'auto'},settings=>{
 $('topic').value=settings.topic||'';
 $('enabled').checked=!!settings.enabled;
 $('playerColor').value=settings.playerColor||'auto';
 $('status').textContent='Réglages chargés. Ouvre un échiquier pris en charge.';
});
function save(){
 const topic=$('topic').value.trim();
 chrome.storage.local.set({topic,enabled:$('enabled').checked,playerColor:$('playerColor').value},()=>{
  $('status').textContent=topic.length<12?'Renseigne le canal ntfy de l’iPhone.':'Paramètres enregistrés. Détection automatique active sur les onglets compatibles.';
 });
}
$('topic').addEventListener('input',save);
$('enabled').addEventListener('change',save);

$('playerColor').addEventListener('change',save);

$('link-test').addEventListener('click',()=>{
 const topic=$('topic').value.trim();
 if(!/^[A-Za-z0-9_-]{12,100}$/.test(topic)){$('status').textContent='Canal incorrect ou trop court : copie celui de Safari.';return;}
 $('status').textContent='Envoi d’une position de test vers l’iPhone…';
 const requestId=crypto.randomUUID();
 chrome.runtime.sendMessage({
  type:'ANALYZE',topic,requestId,
  fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
 },response=>{
   if(chrome.runtime.lastError||!response?.ok){
     $('status').textContent='Échec du relais : '+(response?.error||chrome.runtime.lastError?.message||'erreur inconnue');
     return;
   }
   $('status').textContent='Position test envoyée. Sur Safari, tu dois voir « Stockfish calcule… » puis un coup sous « Dernier coup ». Si rien ne change, compare les deux canaux ntfy.';
 });
});
