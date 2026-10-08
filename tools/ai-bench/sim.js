const fs=require('fs'); const path=require('path');
const game=fs.readFileSync(path.join(__dirname,'..','..','game','block-claim.html'),'utf8');
const ai=game.slice(game.indexOf('/* ---------- computer opponent (BEGIN-AI)'), game.indexOf('/* (END-AI) */'));
eval(ai+';globalThis.cpuPick=cpuPick;globalThis.cpuSpots=cpuSpots;');
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
function fill(c,W,H){ // fill regions touched by one side; return disputed count
  const N=W*H; let has1=false,has2=false; for(const v of c){if(v===1)has1=true;if(v===2)has2=true;}
  if(!has1||!has2) return N;
  const seen=new Uint8Array(N); let disputed=0;
  for(let s=0;s<N;s++){ if(c[s]||seen[s]) continue; const st=[s],cells=[]; seen[s]=1; let t1=false,t2=false;
    while(st.length){const k=st.pop(); cells.push(k); const x=k%W; for(const m of [x>0?k-1:-1,x<W-1?k+1:-1,k-W,k+W]){ if(m<0||m>=N) continue; const v=c[m]; if(v===1)t1=true; else if(v===2)t2=true; else if(!v&&!seen[m]){seen[m]=1;st.push(m);} } }
    if(t1&&!t2) cells.forEach(k=>c[k]=1); else if(t2&&!t1) cells.forEach(k=>c[k]=2); else disputed+=cells.length; }
  return disputed;
}
function play(W,H,lv1,lv2,seed,gold){
  const rnd=mulberry(seed), c=new Array(W*H).fill(0), lives={1:3,2:3}, out={1:false,2:false}, lv={1:lv1,2:lv2};
  let turn=1, moves=0, tmax=0;
  while(moves<2000){
    const a=1+Math.floor(rnd()*6), b=1+Math.floor(rnd()*6);
    const ctx={W,H,cells:c,gold,scoring:'fill',noFit:'out',lives};
    const t0=Date.now();
    let s;
    if(lv[turn]==='random'){ const sp=cpuSpots(Int8Array.from(c),W,H,turn,a,b); s=sp.length?sp[Math.floor(rnd()*sp.length)]:null; }
    else s=cpuPick(ctx,turn,[a,b],lv[turn],rnd);
    tmax=Math.max(tmax,Date.now()-t0);
    if(!s){ lives[turn]--; if(lives[turn]<=0) out[turn]=true; }
    else { for(let j=s.y;j<s.y+s.h;j++) for(let i=s.x;i<s.x+s.w;i++) c[j*W+i]=turn; }
    const disputed=fill(c,W,H); moves++;
    if(out[1]&&out[2]) break;
    if(disputed===0) break;
    if(gold){ let g1=0,g2=0; for(const k of gold){ if(c[k]===1)g1++; else if(c[k]===2)g2++; } if(g1*2>gold.length||g2*2>gold.length||g1+g2===gold.length) break; }
    const o=turn===1?2:1; if(!out[o]) turn=o;
  }
  let s1=0,s2=0; if(gold){ for(const k of gold){ if(c[k]===1)s1++; else if(c[k]===2)s2++; } } else for(const v of c){ if(v===1)s1++; else if(v===2)s2++; }
  return {s1,s2,tmax,moves};
}
function match(A,B,n,W,H,goldFn){
  let wA=0,wB=0,t=0,tm=0,mv=0;
  for(let i=0;i<n;i++){
    const gold=goldFn?goldFn(i):null; const aFirst=i%2===0;
    const r=aFirst?play(W,H,A,B,1000+i,gold):play(W,H,B,A,1000+i,gold);
    const sa=aFirst?r.s1:r.s2, sb=aFirst?r.s2:r.s1;
    if(sa>sb)wA++; else if(sb>sa)wB++; else t++; tm=Math.max(tm,r.tmax); mv+=r.moves;
  }
  console.log(`${W}x${H}${goldFn?' power':''}  ${A} vs ${B}: ${wA}-${wB} (ties ${t})  slowest move ${tm}ms  avg moves ${(mv/n).toFixed(0)}`);
}
const n=+process.argv[2]||30;
if(process.argv[3]!=='more'){match('easy','random',n,25,25); match('medium','easy',n,25,25); match('hard','medium',n,25,25);}
const goldFn=(W,H)=>i=>{ const r=mulberry(77+i), s=new Set(); s.add(Math.floor(H/2)*W+Math.floor(W/2)); while(s.size<7){ const k=Math.floor(r()*W*H), m=W*H-1-k; const x=k%W,y=(k/W)|0; if(x+y<6||(W-1-x)+(H-1-y)<6||k===m) continue; s.add(k); s.add(m);} return [...s].slice(0,7); };
if(process.argv[3]==='more'){
  match('hard','medium',12,42,59);
  match('medium','easy',20,25,25,goldFn(25,25)); match('hard','medium',20,25,25,goldFn(25,25));
}
