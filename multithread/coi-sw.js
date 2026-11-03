/* Benchmark-only service worker: isolate this subfolder and proxy official stockfish npm assets. */
'use strict';
const CDN='https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/';
const SCOPE=new URL(self.registration.scope);
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
 event.respondWith((async()=>{
  const name=url.pathname.slice((SCOPE.pathname+'engine/').length);
  const engine=url.pathname.startsWith(SCOPE.pathname+'engine/')&&/^(stockfish-19-lite\.js|stockfish-19-lite\.wasm)$/.test(name);
  let response;
  if(engine){
   response=await fetch(CDN+name,{mode:'cors',cache:'force-cache'});
  }else response=await fetch(req);
  if(!response.ok)return response;
  const headers=new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy','same-origin');
  headers.set('Cross-Origin-Embedder-Policy','require-corp');
  if(engine)headers.set('Content-Type',name.endsWith('.wasm')?'application/wasm':'text/javascript; charset=utf-8');
  // Avoid carrying invalid cross-origin content encodings into a rewrapped response.
  headers.delete('content-encoding');
  headers.delete('content-length');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 })().catch(e=>new Response('Chargement impossible : '+String(e),{status:502,headers:{'Content-Type':'text/plain'}})));
});
