'use strict';
const $=id=>document.getElementById(id);
chrome.storage.local.get({topic:'',enabled:true,initialTurn:'w'},settings=>{
 $('topic').value=settings.topic||'';
 $('enabled').checked=!!settings.enabled;
 $('initialTurn').value=settings.initialTurn||'w';
 $('status').textContent='Réglages chargés. Ouvre un échiquier pris en charge.';
});
function save(){
 const topic=$('topic').value.trim();
 chrome.storage.local.set({topic,enabled:$('enabled').checked,initialTurn:$('initialTurn').value},()=>{
  $('status').textContent=topic.length<12?'Renseigne le canal ntfy de l’iPhone.':'Paramètres enregistrés. Détection automatique active sur les onglets compatibles.';
 });
}
$('topic').addEventListener('input',save);
$('enabled').addEventListener('change',save);
$('initialTurn').addEventListener('change',save);
