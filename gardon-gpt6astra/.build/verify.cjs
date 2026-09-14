const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const source = fs.readFileSync(path.join(__dirname,'garden.js'),'utf8');
const text = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const pulse=(p,c,w)=>smooth(Math.cos(TAU*w),1,Math.cos(TAU*(p-c)));
const seasonSource=source.slice(source.indexOf('function seasonAt(p)'),source.indexOf('function material('));
const sample=new Function('TAU','smooth','pulse','clamp',seasonSource+';return seasonAt;')(TAU,smooth,pulse,clamp);
const keys=Object.keys(sample(0)),epsilon=1e-6;
let maxSeamError=0,maxVelocityError=0,maxStep=0;
for(const k of keys){
 const err=Math.abs(sample(0)[k]-sample(1)[k]);maxSeamError=Math.max(maxSeamError,err);assert(err<1e-12,k+' value seam');
 const d0=(sample(epsilon)[k]-sample(-epsilon)[k])/(2*epsilon);
 const d1=(sample(1+epsilon)[k]-sample(1-epsilon)[k])/(2*epsilon);
 const derr=Math.abs(d0-d1);maxVelocityError=Math.max(maxVelocityError,derr);assert(derr<1e-7,k+' velocity seam');
}
let prev=sample(0);
for(let i=1;i<=28800;i++){
 const p=sample(i/28800);for(const k of keys){assert(Number.isFinite(p[k]),k+' finite');if(k!=='temperature'){assert(p[k]>=-1e-12&&p[k]<=1.000000001,k+' range');maxStep=Math.max(maxStep,Math.abs(p[k]-prev[k]));}}
 prev=p;
}
assert(!/<script[^>]+src=/i.test(text),'single-file JS');
assert(!/<link[^>]+rel=["']stylesheet/i.test(text),'single-file CSS');
assert(!/(?:fetch\(|XMLHttpRequest|new WebSocket|@import)/.test(source),'no runtime network');
assert(source.includes('dt/120'),'independent day loop');
assert(source.includes('state.speed/480'),'eight-minute year');
assert(source.includes('InstancedMesh'),'persistent instance batches');
const result={seasonalParameters:keys.length,sampledFrames:28800,periodSeconds:480,maxSeamError,maxVelocityError,maxFrameChange60FPS:maxStep,offline:true,seasonSamples:Object.fromEntries([['spring',.125],['summer',.385],['autumn',.63],['winter',.875]].map(([name,p])=>[name,sample(p)]))};
fs.writeFileSync(path.join(__dirname,'mathematical-verification.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,seasonSamples:undefined},null,2));
