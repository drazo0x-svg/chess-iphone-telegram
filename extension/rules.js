'use strict';
/* Offline board-transition validator. No engine and no server interaction. */
(()=> {
 const files='abcdefgh', inBoard=(f,r)=>f>=0&&f<8&&r>=1&&r<=8;
 const coord=(f,r)=>files[f]+r, pos=s=>[files.indexOf(s[0]),Number(s[1])];
 const color=p=>p?(p===p.toUpperCase()?'w':'b'):null;
 const enemy=c=>c==='w'?'b':'w';
 const type=p=>p?.toLowerCase();
 const same=(a,b)=>{
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  return [...keys].every(k=>a[k]===b[k]);
 };
 function threatened(board,square,by){
  const [tf,tr]=pos(square);
  for(const [from,p] of Object.entries(board)){
   if(color(p)!==by)continue;
   const [f,r]=pos(from),dx=tf-f,dy=tr-r,af=Math.abs(dx),ar=Math.abs(dy),kind=type(p);
   if(kind==='p'){if(ar===1&&af===1&&dy===(by==='w'?1:-1))return true;continue;}
   if(kind==='n'){if(af*ar===2&&Math.max(af,ar)===2)return true;continue;}
   if(kind==='k'){if(Math.max(af,ar)===1)return true;continue;}
   const straight=(dx===0||dy===0),diagonal=af===ar;
   if(!((kind==='b'&&diagonal)||(kind==='r'&&straight)||(kind==='q'&&(straight||diagonal))))continue;
   const sx=Math.sign(dx),sy=Math.sign(dy);let x=f+sx,y=r+sy,clear=true;
   while(x!==tf||y!==tr){if(board[coord(x,y)]){clear=false;break;}x+=sx;y+=sy;}
   if(clear)return true;
  }
  return false;
 }
 function isLegalAfter(next,c){
  const kings=Object.entries(next).filter(([,p])=>p===(c==='w'?'K':'k'));
  return kings.length===1&&!threatened(next,kings[0][0],enemy(c));
 }
 function generate(old,expectedColor,ep){
  const out=[];
  const add=(from,to,next,kind,flags={})=>{
   if(isLegalAfter(next,expectedColor))out.push({from,to,color:expectedColor,piece:old[from],kind,...flags,next});
  };
  for(const [from,p] of Object.entries(old)){
   if(color(p)!==expectedColor)continue;
   const [f,r]=pos(from),kind=type(p),dir=expectedColor==='w'?1:-1;
   for(let x=0;x<8;x++)for(let y=1;y<=8;y++){
    if(x===f&&y===r)continue;
    const to=coord(x,y),target=old[to],dx=x-f,dy=y-r,adX=Math.abs(dx),adY=Math.abs(dy);
    if(target&&color(target)===expectedColor)continue;
    if(target&&type(target)==='k')continue;
    let valid=false,flags={};
    if(kind==='p'){
     if(dx===0&&!target&&dy===dir)valid=true;
     if(dx===0&&!target&&dy===2*dir&&r===(expectedColor==='w'?2:7)&&!old[coord(f,r+dir)])valid=true;
     if(adX===1&&dy===dir&&target)valid=true;
     if(adX===1&&dy===dir&&!target&&ep===to&&old[coord(x,r)]===(expectedColor==='w'?'p':'P')){
      valid=true;flags.enPassant=true;
     }
    }else if(kind==='n')valid=(adX===1&&adY===2)||(adX===2&&adY===1);
    else if(kind==='k')valid=Math.max(adX,adY)===1;
    else{
     const slide=(kind==='b'&&adX===adY)||(kind==='r'&&(dx===0||dy===0))||(kind==='q'&&(adX===adY||dx===0||dy===0));
     if(slide){valid=true;const sx=Math.sign(dx),sy=Math.sign(dy);for(let xx=f+sx,yy=r+sy;xx!==x||yy!==y;xx+=sx,yy+=sy)if(old[coord(xx,yy)]){valid=false;break;}}
    }
    if(!valid)continue;
    const next={...old};delete next[from];if(flags.enPassant)delete next[coord(x,r)];
    if(kind==='p'&&y===(expectedColor==='w'?8:1)){
     for(const promotion of ['q','r','b','n']){
      const promoted={...next,[to]:expectedColor==='w'?promotion.toUpperCase():promotion};
      add(from,to,promoted,kind,{...flags,promotion});
     }
    }else{next[to]=p;add(from,to,next,kind,flags);}
   }
   // Castling is validated from the actual starting squares; rights are tracked externally.
   if(kind==='k'&&from===(expectedColor==='w'?'e1':'e8')){
    const rank=expectedColor==='w'?1:8;
    if(!threatened(old,from,enemy(expectedColor)))for(const kingSide of [true,false]){
     const rookFrom=coord(kingSide?7:0,rank),rook=expectedColor==='w'?'R':'r';
     if(old[rookFrom]!==rook)continue;
     const path=kingSide?[5,6]:[3,2,1];
     if(path.some(x=>old[coord(x,rank)]))continue;
     const crossing=coord(kingSide?5:3,rank),target=coord(kingSide?6:2,rank);
     const stepped={...old};delete stepped[from];stepped[crossing]=p;
     if(!isLegalAfter(stepped,expectedColor))continue;
     const next={...old};delete next[from];delete next[rookFrom];next[target]=p;next[coord(kingSide?5:3,rank)]=rook;
     add(from,target,next,kind,{castle:true,rookFrom});
    }
   }
  }
  return out;
 }
 function match(before,after,ep,rights){
  const matches=[];
  for(const c of ['w','b'])for(const m of generate(before,c,ep)){
   if(m.castle&&!(rights||'').includes(c==='w'?(m.to[0]==='g'?'K':'Q'):(m.to[0]==='g'?'k':'q')))continue;
   if(same(m.next,after))matches.push(m);
  }
  return matches.length===1?matches[0]:null;
 }
 window.ChessTrainingTransitions={match};
})();
