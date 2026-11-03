import { DurableObject } from "cloudflare:workers";

const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
});
const validRoom = s => /^[A-Za-z0-9_-]{32,100}$/.test(s);
const validFen = s => typeof s==="string" && s.length<=120 && /^[prnbqkPRNBQK1-8/]+ [wb] (?:-|K?Q?k?q?) (?:-|[a-h][36]) \d+ \d+$/.test(s);
const validId = s => typeof s==="string" && /^[a-zA-Z0-9_-]{8,80}$/.test(s);
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if(url.pathname==="/health") return json({ok:true,service:"chess-iphone-relay",version:1});
    const room=url.pathname.match(/^\/ws\/([A-Za-z0-9_-]+)$/)?.[1];
    if(!room || !validRoom(room)) return json({error:"Invalid room: 32+ random characters required"},400);
    const role=url.searchParams.get("role");
    if(role!=="pc"&&role!=="phone") return json({error:"role must be pc or phone"},400);
    if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket") return json({error:"WebSocket required"},426);
    const objectId=env.CHESS_ROOMS.idFromName(room);
    return env.CHESS_ROOMS.get(objectId).fetch(new Request("https://internal/ws?role="+role,{headers:request.headers}));
  }
};
export class ChessRoom extends DurableObject {
  async fetch(request){
    const role=new URL(request.url).searchParams.get("role");
    if(role!=="pc"&&role!=="phone")return json({error:"Invalid role"},400);
    const connected=this.ctx.getWebSockets(role);
    if(connected.length>=3)return json({error:"Too many connected clients"},429);
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];
    this.ctx.acceptWebSocket(server,[role]);
    server.send(JSON.stringify({type:"connected",role,peers:this.ctx.getWebSockets(role==="pc"?"phone":"pc").length}));
    for(const peer of this.ctx.getWebSockets(role==="pc"?"phone":"pc")){
      try{peer.send(JSON.stringify({type:"peer",role,online:true}));}catch{}
    }
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(socket,message){
    if(typeof message!=="string"||message.length>3000){socket.close(1009,"Message too large");return;}
    const role=this.ctx.getTags(socket)[0];
    let m;
    try{m=JSON.parse(message);}catch{return;}
    if(m?.type==="ping"){socket.send(JSON.stringify({type:"pong"}));return;}
    if(role==="pc"){
      if(m?.type!=="chess-fen"||!validId(m.requestId)||!validFen(m.fen))return;
      const peers=this.ctx.getWebSockets("phone");
      if(!peers.length){socket.send(JSON.stringify({type:"relay-error",error:"iPhone not connected"}));return;}
      const body=JSON.stringify({type:"chess-fen",requestId:m.requestId,fen:m.fen,sent:Date.now()});
      for(const peer of peers)try{peer.send(body);}catch{}
    }else{
      if(m?.type!=="chess-result"||!validId(m.requestId)||!validFen(m.fen)||typeof m.move!=="string"||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m.move))return;
      const body=JSON.stringify({type:"chess-result",requestId:m.requestId,fen:m.fen,move:m.move,evaluation:String(m.evaluation||"").slice(0,40)});
      for(const peer of this.ctx.getWebSockets("pc"))try{peer.send(body);}catch{}
    }
  }
  async webSocketClose(socket,code,reason,clean){
    const role=this.ctx.getTags(socket)[0];
    for(const peer of this.ctx.getWebSockets(role==="pc"?"phone":"pc")){
      try{peer.send(JSON.stringify({type:"peer",role,online:false}));}catch{}
    }
  }
  async webSocketError(socket,error){try{socket.close(1011,"Connection error");}catch{}}
}
