'use strict';
(async()=>{
 const $=id=>document.getElementById(id),status=s=>$('status').textContent=s;
 const WORKGROUPS=1024,LANES=64,ITERS=128,DISPATCHES=4;
 const PER_DISPATCH=WORKGROUPS*LANES*ITERS*32;
 let adapter,device,bindGroup,pipeline,output,latest='';
 if(!navigator.gpu){$('gpu').textContent='❌ WebGPU indisponible. Ouvre la page dans Chrome récent.';return;}
 try{
  adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter)throw Error('Aucun GPU compatible WebGPU.');
  const info=adapter.info||{};
  $('gpu').textContent='✅ GPU actif : '+([info.vendor,info.architecture,info.device].filter(Boolean).join(' · ')||'Modèle non divulgué')+(adapter.isFallbackAdapter?' (logiciel)':'');
  if(adapter.isFallbackAdapter)throw Error('Adaptateur logiciel : test annulé.');
  device=await adapter.requestDevice();
  device.lost.then(reason=>{status('GPU indisponible : '+reason.message);$('run').disabled=true;});
  const shader=device.createShaderModule({code:"@group(0) @binding(0) var<storage,read_write> output:array<vec4<f32>>;\n@compute @workgroup_size(64)\nfn main(@builtin(global_invocation_id) gid:vec3<u32>) {\n let idx=gid.x;\n let seed=f32(idx%1009u)*0.00019;\n var a=vec4<f32>(0.2+seed,0.3+seed,0.4+seed,0.5+seed);\n var b=vec4<f32>(0.41,0.43,0.47,0.53)+a*0.05;\n var c=vec4<f32>(0.21,0.23,0.27,0.29)+b*0.05;\n var d=vec4<f32>(0.12,0.14,0.16,0.18)+c*0.05;\n for(var i:u32=0u;i<128u;i=i+1u){\n  a=fma(a,b,vec4<f32>(0.001));\n  b=fma(b,c,vec4<f32>(0.001));\n  c=fma(c,d,vec4<f32>(0.001));\n  d=fma(d,a,vec4<f32>(0.001));\n }\n output[idx]=a+b+c+d;\n}"});
  const errors=(await shader.getCompilationInfo()).messages.filter(m=>m.type==='error');
  if(errors.length)throw Error('Shader : '+errors.map(m=>m.message).join('; '));
  pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:shader,entryPoint:'main'}});
  output=device.createBuffer({size:WORKGROUPS*LANES*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
  bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:output}}]});
  $('run').disabled=false;status('Prêt ! Ferme les autres logiciels utilisant le GPU.');
 }catch(e){status('❌ '+e.message);return;}
 async function batch(){
  const enc=device.createCommandEncoder();
  for(let n=0;n<DISPATCHES;n++){const pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.dispatchWorkgroups(WORKGROUPS);pass.end();}
  device.queue.submit([enc.finish()]);
  await device.queue.onSubmittedWorkDone();
 }
 $('run').onclick=async()=>{
  $('run').disabled=true;$('copy').disabled=true;latest='';$('score').textContent='Calcul en cours…';
  let count=0,elapsed=0;
  try{
   await batch();
   const start=performance.now();
   while(elapsed<10000){
    await batch();count++;elapsed=performance.now()-start;
    $('progress').value=Math.min(10,elapsed/1000);
    status('Calcul WebGPU : '+(elapsed/1000).toFixed(1)+' s · '+count+' lots terminés');
   }
   const read=device.createBuffer({size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
   const enc=device.createCommandEncoder();enc.copyBufferToBuffer(output,0,read,0,16);device.queue.submit([enc.finish()]);
   await read.mapAsync(GPUMapMode.READ);
   const value=new Float32Array(read.getMappedRange().slice(0))[0];read.unmap();read.destroy();
   if(!Number.isFinite(value))throw Error('Résultat GPU invalide');
   const operations=count*DISPATCHES*PER_DISPATCH;
   const rate=operations/(elapsed/1000)/1e9;
   $('score').textContent=rate.toLocaleString('fr-FR',{maximumFractionDigits:2})+' GFLOP/s';
   $('details').textContent=(operations/1e9).toFixed(2)+' milliards d’opérations FP32 nominales · '+(elapsed/1000).toFixed(2)+' s · '+count+' lots terminés. Sortie shader vérifiée : '+value.toFixed(6);
   latest='WebGPU | '+([adapter.info?.vendor,adapter.info?.device].filter(Boolean).join(' ')||'GPU inconnu')+' | '+rate.toFixed(2)+' GFLOP/s | '+(elapsed/1000).toFixed(2)+' s | '+count+' lots';
   status('✅ Terminé ! Copie le résultat et envoie-le ici.');$('copy').disabled=false;
  }catch(e){status('❌ '+e.message);$('score').textContent='Test interrompu';}
  finally{$('run').disabled=false;}
 };
 $('copy').onclick=()=>navigator.clipboard.writeText(latest).then(()=>status('✅ Résultat copié !')).catch(()=>status('Copie impossible : recopie le score affiché.'));
})();