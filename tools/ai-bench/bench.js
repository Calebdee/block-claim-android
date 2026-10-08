// Pit computer levels against each other: node tools/ai-bench/bench.js hard medium 40 25 25 [power]
// usage: node bench.js A B n W H [power]
const fs=require('fs'); const src=fs.readFileSync(require('path').join(__dirname,'sim.js'),'utf8').split('const n=+process.argv[2]')[0];
eval(src);
const [A,B,n,W,H,pw]=process.argv.slice(2);
const goldFn=(W,H)=>i=>{ const r=mulberry(77+i), s=new Set(); s.add(Math.floor(H/2)*W+Math.floor(W/2)); while(s.size<7){ const k=Math.floor(r()*W*H), m=W*H-1-k; const x=k%W,y=(k/W)|0; if(x+y<6||(W-1-x)+(H-1-y)<6||k===m) continue; s.add(k); s.add(m);} return [...s].slice(0,7); };
match(A,B,+n,+W,+H,pw?goldFn(+W,+H):null);
