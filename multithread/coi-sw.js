/* Benchmark-only isolation for a locally hosted official Stockfish build. */
'use strict';
const SCOPE=new URL(self.registration.scope);
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
 event.respondWith((async()=>{
  const response=await fetch(req,{cache:'no-store'});
  if(!response.ok)return response;
  const headers=new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy','same-origin');
  headers.set('Cross-Origin-Embedder-Policy','require-corp');
  if(url.pathname.endsWith('.wasm'))headers.set('Content-Type','application/wasm');
  // Avoid carrying invalid cross-origin content encodings into a rewrapped response.
  headers.delete('content-encoding');
  headers.delete('content-length');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 })().catch(e=>new Response('Chargement impossible : '+String(e),{status:502,headers:{'Content-Type':'text/plain'}})));
});
