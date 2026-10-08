// Headless matches for 2-4 computer players.
// usage: node tools/ai-bench/sim.js <games> <W> <H> <level,level[,level[,level]]> [power]
// e.g.   node tools/ai-bench/sim.js 40 25 25 hard,medium
//        node tools/ai-bench/sim.js 24 25 25 hard,medium,medium,medium
// Seats rotate each game so every level plays from every corner equally often.
const fs=require('fs');
const src=process.env.AI_SRC||require('path').join(__dirname,'..','..','game','block-claim.html');
let code=fs.readFileSync(src,'utf8');
if(src.endsWith('.html')) code=code.slice(code.indexOf('/* ---------- computer opponent (BEGIN-AI)'), code.indexOf('/* (END-AI) */'));
eval(code+';globalThis.cpuPick=cpuPick;globalThis.cpuSpots=cpuSpots;');
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
function fill(c,W,H,players){
  const N=W*H, has={}; for(const v of c) if(v) has[v]=true;
  if(!players.every(q=>has[q])) return N;
  const seen=new Uint8Array(N); let disputed=0;
  for(let s=0;s<N;s++){ if(c[s]||seen[s]) continue; const st=[s],cells=[]; seen[s]=1; let mask=0;
    while(st.length){const k=st.pop(); cells.push(k); const x=k%W; for(const m of [x>0?k-1:-1,x<W-1?k+1:-1,k-W,k+W]){ if(m<0||m>=N) continue; const v=c[m]; if(v) mask|=1<<v; else if(!seen[m]){seen[m]=1;st.push(m);} } }
    if(mask&&!(mask&(mask-1))){ const o=Math.log2(mask); cells.forEach(k=>c[k]=o); } else disputed+=cells.length; }
  return disputed;
}
function genGold4(W,H,seed){ // 4-way mirrored set of 8 + centre
  const r=mulberry(seed), s=new Set(); s.add(Math.floor(H/2)*W+Math.floor(W/2));
  while(s.size<9){ const x=Math.floor(r()*W), y=Math.floor(r()*H); if(x*2===W-1||y*2===H-1) continue;
    const pts=[[x,y],[W-1-x,y],[x,H-1-y],[W-1-x,H-1-y]]; if(pts.some(([a,b])=>Math.min(a+b,W-1-a+b,a+H-1-b,W-1-a+H-1-b)<6)) continue; pts.forEach(([a,b])=>s.add(b*W+a)); }
  return [...s];
}
function play(W,H,levels,seed,gold){
  const rnd=mulberry(seed), c=new Array(W*H).fill(0), players=levels.map((_,i)=>i+1);
  const lives={}, out={}; players.forEach(q=>{lives[q]=3; out[q]=false;});
  let turn=1, moves=0, tmax=0;
  while(moves<4000){
    const a=1+Math.floor(rnd()*6), b=1+Math.floor(rnd()*6);
    const ctx={W,H,cells:c,gold,scoring:'fill',noFit:'out',lives,players,out};
    const t0=Date.now();
    let s; const lv=levels[turn-1];
    if(lv==='random'){ const sp=cpuSpots(Int8Array.from(c),W,H,turn,a,b); s=sp.length?sp[Math.floor(rnd()*sp.length)]:null; }
    else s=cpuPick(ctx,turn,[a,b],lv,rnd);
    tmax=Math.max(tmax,Date.now()-t0);
    if(!s){ lives[turn]--; if(lives[turn]<=0) out[turn]=true; }
    else { for(let j=s.y;j<s.y+s.h;j++) for(let i=s.x;i<s.x+s.w;i++) c[j*W+i]=turn; }
    const disputed=fill(c,W,H,players); moves++;
    if(players.every(q=>out[q])) break;
    if(disputed===0) break;
    if(gold){ const g={}; for(const k of gold) if(c[k]) g[c[k]]=(g[c[k]]||0)+1; const taken=Object.values(g).reduce((x,y)=>x+y,0);
      if(Object.values(g).some(v=>v*2>gold.length)||taken===gold.length) break; }
    const i0=players.indexOf(turn); let nx=turn;
    for(let i=1;i<=players.length;i++){ const q=players[(i0+i)%players.length]; if(!out[q]){ nx=q; break; } }
    turn=nx;
  }
  const sc={}; players.forEach(q=>sc[q]=0);
  if(gold){ for(const k of gold) if(c[k]) sc[c[k]]++; } else for(const v of c) if(v) sc[v]++;
  return {sc,tmax,moves};
}
const [n,W,H,lvArg,pw]=process.argv.slice(2);
const levels=lvArg.split(','), P=levels.length;
const wins={}, share={}; levels.forEach(l=>{wins[l]=wins[l]||0; share[l]=share[l]||0;});
let tm=0, mv=0;
for(let g=0;g<+n;g++){
  const rot=levels.map((_,i)=>levels[(i+g)%P]);           // rotate seats
  const r=play(+W,+H,rot,5000+g,pw?genGold4(+W,+H,90+g):null);
  const best=Math.max(...Object.values(r.sc)), winners=Object.keys(r.sc).filter(q=>r.sc[q]===best);
  winners.forEach(q=>wins[rot[q-1]]+=1/winners.length);
  const tot=Object.values(r.sc).reduce((a,b)=>a+b,0)||1;
  Object.keys(r.sc).forEach(q=>share[rot[q-1]]+=r.sc[q]/tot/ +n);
  tm=Math.max(tm,r.tmax); mv+=r.moves;
}
const counts={}; levels.forEach(l=>counts[l]=(counts[l]||0)+1);
console.log(`${W}x${H}${pw?' power':''} [${levels.join(', ')}] x${n}: `+
  Object.keys(wins).map(l=>`${l} wins ${wins[l].toFixed(1)}${counts[l]>1?` (${counts[l]} seats)`:''}, share ${(share[l]*100).toFixed(0)}%`).join(' | ')+
  `  slowest ${tm}ms  avg moves ${(mv/n).toFixed(0)}`);
