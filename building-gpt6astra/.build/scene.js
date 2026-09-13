/* SITE ATELIER · All models, textures, sound and motion are generated below.
 * World units describe a 1:87 tabletop model. No assets or network requests.
 * A single loop lane, reserved loading bay and height-separated crane corridors
 * keep independent animation systems out of each other's operating envelopes.
 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const BENCH = TEST && params.has('bench');
const TEST_LIMIT = BENCH ? 36 : 72;
const G = 1.35, PIT_Y = .06, TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const smooth = t => { t = clamp(t, 0, 1); return t*t*(3-2*t); };
let seed = 875103;
const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
const range = (a,b) => a+(b-a)*random();
const colors = {soil:'#bda17b',soilLight:'#c9b089',soilDark:'#977950',orange:'#e89c3e',yellow:'#ebbb52',ochre:'#cc842a',steel:'#566362',iron:'#343e3e',rubber:'#2c3330',glass:'#274a51',glassLight:'#79a5a6',cream:'#e8e3d2',white:'#e9ecdf',concrete:'#b0b5a4',darkConcrete:'#849186',green:'#586f5c',blue:'#4b737d',red:'#bc5a3e',wood:'#a38b5d'};
const state = {playing: TEST || !matchMedia('(prefers-reduced-motion: reduce)').matches, speed:1, time:0, night:false, orbit:false, labels:true, view:'overview', cap:TEST&&!BENCH?15:60, quality:'balanced', frames:0, drawn:0, dirty:true, audio:false, dropped:0};
let renderer, scene, camera, keyLight, fillLight, ambient, rimLight;
let disposed = false, rafId = 0, timerId = 0, lastWall = 0, lastDraw = 0, nextFrameTime = 0, uiTime = 0, frameSample = [], cpuSamples = [], testCompleted = false, timerToast = 0, transitioning = false;
const diagnostics = {revision:THREE.REVISION, testMode:TEST, testFrameLimit:TEST_LIMIT, frames:0, drawCalls:0, triangles:0, validation:null, errors:[], currentFps:0, renderCpuMs:0, externalResources:0};
window.addEventListener('error', e => diagnostics.errors.push(e.message));
function fail(error){ $('loading').hidden = true; $('error-panel').hidden = false; $('error-text').textContent = error.message || String(error); diagnostics.errors.push(String(error)); }
try {
 renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power',preserveDrawingBuffer:false});
} catch(error) { fail(error); return; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
$('world').appendChild(renderer.domElement);
scene = new THREE.Scene();
scene.background = new THREE.Color('#202923');
scene.fog = new THREE.FogExp2('#222c24', .0055);
camera = new THREE.PerspectiveCamera(37,innerWidth/innerHeight,.1,230);
ambient = new THREE.HemisphereLight('#d8e7da','#7c6444',1.85); scene.add(ambient);
keyLight = new THREE.DirectionalLight('#ffdea5',3.1); keyLight.position.set(-22,42,28); keyLight.castShadow=true;
keyLight.shadow.mapSize.set(1536,1536); keyLight.shadow.camera.left=-36; keyLight.shadow.camera.right=36; keyLight.shadow.camera.top=34; keyLight.shadow.camera.bottom=-31;
keyLight.shadow.camera.near=5; keyLight.shadow.camera.far=100; keyLight.shadow.normalBias=.06; keyLight.shadow.bias=-.00025; keyLight.shadow.radius=2;
keyLight.target.position.set(0,0,0); scene.add(keyLight,keyLight.target);
fillLight = new THREE.DirectionalLight('#b2d1dc',1.25); fillLight.position.set(28,18,-23); scene.add(fillLight);
rimLight = new THREE.DirectionalLight('#fff2cb',.75); rimLight.position.set(-18,9,-20); scene.add(rimLight);
const materials = {
 solid:new THREE.MeshStandardMaterial({roughness:.87,metalness:.03}),
 metal:new THREE.MeshStandardMaterial({roughness:.52,metalness:.52}),
 glass:new THREE.MeshStandardMaterial({roughness:.23,metalness:.38}),
 glow:new THREE.MeshBasicMaterial({toneMapped:false}),
 net:new THREE.MeshStandardMaterial({color:'#7e9b83',roughness:1,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false})
};
const geometry = {box:new THREE.BoxGeometry(1,1,1),cyl:new THREE.CylinderGeometry(.5,.5,1,10),cyl8:new THREE.CylinderGeometry(.5,.5,1,8),cone:new THREE.CylinderGeometry(.18,.5,1,4),sphere:new THREE.SphereGeometry(.5,8,5)};
const staticRoot = new THREE.Group(); staticRoot.name='Batched static site'; scene.add(staticRoot);
const batches = new Map(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), axisY = new THREE.Vector3(0,1,0), dummy = new THREE.Object3D(), colorTmp = new THREE.Color();
function group(parent=scene,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function queue(parent,kind,family,color,matrix){
 parent=parent||staticRoot; const key=parent.uuid+'|'+kind+'|'+family;
 if(!batches.has(key)) batches.set(key,{parent,kind,family,items:[]});
 batches.get(key).items.push({matrix:matrix.clone(),color});
}
function part(parent,color,x,y,z,w,h,d,angles=null,kind='box',family='solid'){
 dummy.position.set(x,y,z); dummy.scale.set(w,h,d); dummy.rotation.set(angles?.[0]||0,angles?.[1]||0,angles?.[2]||0); dummy.updateMatrix();queue(parent,kind,family,color,dummy.matrix);
}
function beam(parent,color,a,b,width=.1,depth=width,family='solid'){
 v1.set(...a);v2.set(...b).sub(v1); dummy.position.copy(v1).addScaledVector(v2,.5); dummy.scale.set(width,v2.length(),depth); dummy.quaternion.setFromUnitVectors(axisY,v2.normalize()); dummy.updateMatrix();queue(parent,'box',family,color,dummy.matrix);
}
function finishBatches(){
 for(const b of batches.values()){
  const mesh=new THREE.InstancedMesh(geometry[b.kind],materials[b.family],b.items.length);
  b.items.forEach((item,i)=>{mesh.setMatrixAt(i,item.matrix);mesh.setColorAt(i,colorTmp.set(item.color));});
  mesh.castShadow=b.family!=='glow';mesh.receiveShadow=b.family!=='glow';mesh.name='Instances · '+b.kind+' / '+b.items.length;
  mesh.computeBoundingSphere();b.parent.add(mesh);
 }
 batches.clear();
}
function flatMesh(geo,mat,x,y,z,rotX=0,parent=scene){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.x=rotX;m.receiveShadow=true;parent.add(m);return m;}
function canvasTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;}
function groundShadow(x,z,w,d,opacity=.23,y=G+.012){
 const texture=canvasTexture(64,64,(ctx)=>{const gradient=ctx.createRadialGradient(32,32,4,32,32,32);gradient.addColorStop(0,`rgba(30,29,21,${opacity})`);gradient.addColorStop(.45,`rgba(30,29,21,${opacity*.6})`);gradient.addColorStop(1,'rgba(30,29,21,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);});
 return flatMesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),x,y,z,-Math.PI/2);
}
const woodTexture=canvasTexture(1024,512,(ctx,w,h)=>{
 ctx.fillStyle='#514332';ctx.fillRect(0,0,w,h);
 for(let i=0;i<1800;i++){const y=range(0,h);ctx.strokeStyle=`rgba(${random()>.48?'25,21,16':'157,124,79'},${range(.025,.13)})`;ctx.lineWidth=range(.35,1.8);ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=w;x+=32)ctx.lineTo(x,y+Math.sin(x*.008+i*.72)*range(.3,2.4));ctx.stroke();}
 for(let j=1;j<6;j++){ctx.fillStyle='#211b152b';ctx.fillRect(0,h*j/6,w,2);ctx.fillStyle='#997d4830';ctx.fillRect(0,h*j/6+2,w,1);}
 for(let j=0;j<8;j++){let x=range(0,w),y=range(0,h);ctx.strokeStyle='#2923182a';ctx.lineWidth=1;for(let k=0;k<8;k++){ctx.beginPath();ctx.ellipse(x,y,8+k*9,2+k*1.1,-.015,0,TAU);ctx.stroke();}}
});
woodTexture.wrapS=woodTexture.wrapT=THREE.RepeatWrapping;woodTexture.repeat.set(1.3,1.4);
const tableMat=new THREE.MeshStandardMaterial({map:woodTexture,roughness:.69,metalness:.02,color:'#b09a7d'});
const tabletop=flatMesh(new THREE.BoxGeometry(78,1.55,57),tableMat,0,-1.675,1.2);tabletop.castShadow=true;
part(null,'#302b20',0,-2.6,1.2,73,.55,53);
for(const x of [-33,33])for(const z of [-21,23])part(null,'#282e27',x,-14,z,2.6,23,2.6);
part(null,'#202a23',0,-26.0,0,240,1,200);
part(null,'#26332c',0,10,-41,180,80,1);
for(let x=-72;x<80;x+=12)part(null,'#29372e',x,14,-40.38,.15,70,.1);
// The plinth sits directly on the desktop. Dirt panels leave a real open pit.
function roundedRect(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
const baseGeo=new THREE.ExtrudeGeometry(roundedRect(46.6,34.6,.6),{depth:.56,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.12,bevelThickness:.12,curveSegments:3});baseGeo.rotateX(-Math.PI/2);
const plinth=flatMesh(baseGeo,new THREE.MeshStandardMaterial({color:'#dbd7c3',roughness:.66}),0,-.77,0);plinth.castShadow=true;
groundShadow(0,0,54,42,.32,-.888);
function landRect(x0,x1,z0,z1){part(null,colors.soil,(x0+x1)/2,(G-.2)/2,(z0+z1)/2,x1-x0,G+.2,z1-z0);}
landRect(-23,-15.5,-17,17);landRect(-3.7,23,-17,17);landRect(-15.5,-3.7,-17,-6);landRect(-15.5,-3.7,5.5,17);
part(null,'#957a53',-9.6,(PIT_Y-.2)/2,-.25,11.8,PIT_Y+.2,11.5);
for(const z of [-17,17])for(let x=-22.5;x<23;x+=1.15){part(null,random()>.5?'#a9895d':'#af9067',x,.43,z,1.1,.33,.025);part(null,'#8f7959',x,.02,z,1.1,.25,.026);}
for(const x of [-23,23])for(let z=-16.5;z<17;z+=1.2)part(null,random()>.4?'#ae8e65':'#bb9b6c',x,.55,z,.028,.5,1.16);
// Soil grains stay clear of the circulation lane and building pads.
for(let i=0;i<800;i++){
 const x=range(-22.4,22.4),z=range(-16.5,16.5);
 if((x>-15.8&&x<-3.4&&z>-6.3&&z<5.8)||Math.abs(x)>17.0||Math.abs(z)>10.8)continue;
 if(x>-.6&&x<11&&z>-7&&z<4.2)continue;
 const sz=range(.045,.14);part(null,random()>.5?'#d0b48a':'#ae916a',x,G+.018,z,sz,.038,sz*.7);
}
// Visible terraced soil cuts, small soldier piles and edge protection.
for(let z=-5.7;z<5.4;z+=.65){for(const x of [-15.42,-3.78]){part(null,'#977b57',x,.48,z,.12,.84,.57);part(null,'#baa781',x,G-.12,z,.14,.28,.58);} }
for(let x=-15.3;x<-3.8;x+=.7){for(const z of [-5.91,5.41])part(null,'#a38861',x,.65,z,.64,1.2,.14);}
for(let i=0;i<85;i++){
 let x=range(-15,-4.2),z=range(-5.5,4.9);
 if(Math.hypot(x+11,z+1.8)<2.0||Math.hypot(x+6.6,z+1)<1.9)continue;
 let s=range(.07,.25);part(null,random()>.6?'#b19b76':'#806b4e',x,PIT_Y+s*.4,z,s,s*.8,s*.8,[0,range(0,2),0]);
}
const roadTex=canvasTexture(128,128,(ctx,w,h)=>{ctx.fillStyle='#8a8b79';ctx.fillRect(0,0,w,h);for(let i=0;i<2500;i++){ctx.fillStyle=random()>.45?'#c9c8ae24':'#343d3320';ctx.fillRect(random()*w,random()*h,1,1);}});roadTex.wrapS=roadTex.wrapT=THREE.RepeatWrapping;
const roadShape=roundedRect(41.6,29.6,4.8);const holePoints=roundedRect(34.4,22.4,1.2).getPoints(12).reverse();roadShape.holes.push(new THREE.Path(holePoints));
const roadGeo=new THREE.ShapeGeometry(roadShape,12);const roadPos=roadGeo.attributes.position;const roadUv=roadGeo.attributes.uv;for(let i=0;i<roadPos.count;i++)roadUv.setXY(i,roadPos.getX(i)/3,roadPos.getY(i)/3);
flatMesh(roadGeo,new THREE.MeshStandardMaterial({map:roadTex,roughness:.95}),0,G+.024,0,-Math.PI/2);
const roadSegments=[];
function lineRoad(x0,z0,x1,z1){roadSegments.push({type:'line',x0,z0,x1,z1,length:Math.hypot(x1-x0,z1-z0)});}
function arcRoad(cx,cz,a0,a1){roadSegments.push({type:'arc',cx,cz,a0,a1,r:3,length:3*Math.abs(a1-a0)});}
lineRoad(-8.5,13,16,13);arcRoad(16,10,Math.PI/2,0);lineRoad(19,10,19,-10);arcRoad(16,-10,0,-Math.PI/2);lineRoad(16,-13,-16,-13);arcRoad(-16,-10,-Math.PI/2,-Math.PI);lineRoad(-19,-10,-19,10);arcRoad(-16,10,Math.PI,Math.PI/2);lineRoad(-16,13,-8.5,13);
let ROAD_LENGTH=0;roadSegments.forEach(s=>{s.start=ROAD_LENGTH;ROAD_LENGTH+=s.length;});
const UNLOAD_S=roadSegments[6].start+17.8;
function roadAt(distance){
 distance=((distance%ROAD_LENGTH)+ROAD_LENGTH)%ROAD_LENGTH;const s=roadSegments.find(seg=>distance<=seg.start+seg.length+.00001)||roadSegments[roadSegments.length-1];const t=(distance-s.start)/s.length;
 if(s.type==='line'){const dx=s.x1-s.x0,dz=s.z1-s.z0;return {x:lerp(s.x0,s.x1,t),z:lerp(s.z0,s.z1,t),yaw:-Math.atan2(dz,dx)};}
 const a=lerp(s.a0,s.a1,t);return{x:s.cx+3*Math.cos(a),z:s.cz+3*Math.sin(a),yaw:-Math.atan2(-Math.cos(a),Math.sin(a))};
}
for(let s=1;s<ROAD_LENGTH;s+=2.8){const p=roadAt(s);part(null,'#d7d4b7',p.x,G+.032,p.z,1.1,.014,.075,[0,p.yaw,0]);}
for(let s=0;s<ROAD_LENGTH;s+=1.2){const p=roadAt(s),nx=Math.sin(p.yaw),nz=Math.cos(p.yaw);for(const side of [-1,1])part(null,'#d0bd86',p.x+nx*1.65*side,G+.034,p.z+nz*1.65*side,.77,.016,.035,[0,p.yaw,0]);}
for(const x of [12.4,13,13.6,14.2,14.8])part(null,'#dedcc8',x,G+.038,13,.35,.012,2.9);
// A paved pedestrian strip is physically separated from the vehicle lane.
part(null,'#c0b899',0,G+.035,15.55,39,.06,.77);
for(let x=-19;x<=19;x+=.8)part(null,'#a79c7d',x,G+.067,15.55,.024,.005,.72);

function signTexture(title,subtitle='',bg='#293f3e',fg='#eee7cc',width=512){return canvasTexture(width,192,(ctx,w,h)=>{ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.strokeStyle=fg+'88';ctx.lineWidth=2;ctx.strokeRect(10,10,w-20,h-20);ctx.fillStyle=fg;ctx.textAlign='center';ctx.font='bold 52px "Microsoft YaHei",sans-serif';ctx.fillText(title,w/2,94);ctx.font='20px "Segoe UI",sans-serif';ctx.letterSpacing='4px';ctx.fillText(subtitle,w/2,144);});}
function sign(title,subtitle,x,y,z,w=3,h=1.12,rotation=0,bg){const tex=signTexture(title,subtitle,bg);const m=flatMesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,roughness:.8,side:THREE.DoubleSide}),x,y,z);m.rotation.y=rotation;return m;}
function rail(x0,z0,x1,z1,y=G,h=.78,color=colors.orange){
 let count=Math.ceil(Math.hypot(x1-x0,z1-z0)/1.7);
 for(let i=0;i<=count;i++){const t=i/count;part(null,color,lerp(x0,x1,t),y+h/2,lerp(z0,z1,t),.075,h,.075);}
 for(const level of [.36,.74])beam(null,color,[x0,y+level,z0],[x1,y+level,z1],.055);
}
rail(-15.7,-6.2,-15.7,5.4);rail(-3.5,-6,-3.5,5.2);rail(-15.7,-6.2,-3.5,-6.2);rail(-15.6,5.65,-11.0,5.65);rail(-5.8,5.65,-3.5,5.65);
sign('基坑开挖区','EXCAVATION · KEEP CLEAR',-15.65,G+.65,.9,2,.68,Math.PI/2,'#94713b');
// Site perimeter. The front rail is low to preserve the eye-level view.
for(let x=-21;x<=21;x+=2.0){
 part(null,'#516c61',x,G+.66,-16.05,1.93,1.3,.10);part(null,'#bdc7ae',x-.97,G+.75,-16.05,.09,1.55,.13);
 if(x<10.5||x>17.5){part(null,'#d7d1b5',x,G+.32,16.12,1.85,.63,.36);for(let k=0;k<3;k++)part(null,'#d59c4d',x-.62+k*.58,G+.35,16.306,.30,.42,.015,[0,0,-.27]);}
}
for(let z=-15;z<=15;z+=2){for(const side of [-1,1]){part(null,'#526e62',side*22.12,G+.62,z,.12,1.24,1.9);part(null,'#c4cbb9',side*22.12,G+.75,z-.94,.17,1.5,.08);}}
sign('筑间 · 城市生长计划','BUILDING A LITTLE WORLD',1.5,G+.69,16.321,5.1,.87,0,'#344b3a');
sign('安全第一  预防为主','SAFETY FIRST',-2.5,G+.74,-15.975,5.6,.80,0,'#36534b');
for(const x of [10.6,17.9]){part(null,'#d9d8c0',x,G+1.5,16,.2,3,.2);part(null,'#e3b358',x,G+3.05,16,.35,.12,.35);}
sign('施工现场','AUTHORIZED PERSONNEL',14.25,G+3.05,16,7.35,.65,0,'#334f47');
function cone(x,z){part(null,'#293c34',x,G+.05,z,.42,.09,.42);part(null,'#d48944',x,G+.36,z,.30,.58,.30,null,'cone');part(null,'#e8d8ae',x,G+.39,z,.23,.11,.23,null,'cone');}
for(const p of [[10,14.9],[18.1,14.7],[-10.8,11.1],[-6.1,11.1],[16.9,4.9],[16.9,7.6],[-17.2,-6.6]])cone(...p);

// Tabletop studio objects: generated paper plans, tape, helmet, spirit level.
const blueprint=canvasTexture(1024,768,(ctx,w,h)=>{
 ctx.fillStyle='#254c63';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#91bcc433';ctx.lineWidth=1;
 for(let x=24;x<w;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=24;y<h;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 ctx.strokeStyle='#d3e2d4';ctx.lineWidth=3;ctx.strokeRect(48,45,930,675);ctx.strokeRect(94,104,560,480);ctx.strokeRect(113,123,522,442);
 for(let x=152;x<650;x+=96){for(let y=165;y<575;y+=94){ctx.strokeRect(x,y,63,65);ctx.fillStyle='#b4d4d0';ctx.fillRect(x-4,y-4,8,8);}}
 ctx.lineWidth=2;ctx.strokeRect(711,122,207,162);ctx.strokeRect(711,328,207,158);ctx.beginPath();ctx.moveTo(682,98);ctx.lineTo(682,586);ctx.moveTo(98,616);ctx.lineTo(651,616);ctx.stroke();
 for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(112+i*85,610);ctx.lineTo(125+i*85,623);ctx.stroke();}
 ctx.fillStyle='#d6e2d7';ctx.font='26px "Segoe UI"';ctx.fillText('SITE ATELIER / 01',93,681);ctx.font='16px "Segoe UI"';ctx.fillText('STRUCTURAL PLAN     1 : 87',672,658);ctx.fillText('CITY IN THE MAKING',711,527);
});
function paper(x,z,rot,w,h,mat){const m=flatMesh(new THREE.PlaneGeometry(w,h),mat,x,-.871,z,-Math.PI/2);m.rotation.z=rot;return m;}
paper(-25,13.5,-.21,11.5,8.1,new THREE.MeshStandardMaterial({color:'#d8d5bd',roughness:.95}));paper(-24.6,13.7,-.11,11.5,8.1,new THREE.MeshStandardMaterial({map:blueprint,roughness:.94})).position.y=-.858;
paper(-25.3,-4,.28,8.5,6.3,new THREE.MeshStandardMaterial({map:blueprint,roughness:.9}));
const pencil=group(scene,-26,-.75,20.3);pencil.rotation.y=-.27;part(pencil,'#d49b40',0,0,0,5,.12,.13);part(pencil,'#d3b68b',2.65,0,0,.32,.12,.13);part(pencil,'#303b35',2.86,0,0,.13,.10,.10);part(pencil,'#bbc3ad',-2.35,0,0,.28,.15,.16,null,'box','metal');
const helmet=group(scene,26.8,-.83,8.0);helmet.rotation.y=-.24;
for(let iz=-5;iz<=5;iz++)for(let ix=-6;ix<=6;ix++){
 const xx=ix*.32,zz=iz*.32;
 if((xx/2.15)**2+(zz/1.85)**2<1)part(helmet,'#deac46',xx,.115,zz,.32,.20,.32);
 const r=(xx/1.85)**2+((zz+.10)/1.58)**2;
 if(r<1){const h=Math.ceil(Math.sqrt(1-r)*1.47/.25)*.25;part(helmet,ix<-1?'#e4b653':'#edc262',xx,.23+h*.5,zz,.32,h,.32);}
}
part(helmet,'#f2cc75',0,1.72,-.15,.24,.15,1.65);for(let x=-1;x<=1;x+=2)part(helmet,'#a87a2f',x,.65,1.287,.35,.10,.025);
groundShadow(26.8,8,6,5,.2,-.886);
const tape=group(scene,1.3,-.84,23);tape.rotation.y=-.08;part(tape,'#2d352e',0,.57,0,1.95,1.05,1.68);part(tape,'#d5a042',-.10,.69,.04,1.61,.88,1.77);part(tape,'#283930',0,.76,.948,.83,.40,.05);part(tape,'#e3cf93',-4.6,.04,0,7.5,.043,.62,null,'box','metal');for(let x=-8.1;x<-1.0;x+=.2)part(tape,'#3e4637',x,.067,-.12,.025,.006,Math.round(x*10)%10===0?.34:.19);part(tape,'#bfc7b4',-8.43,.13,0,.07,.25,.72,null,'box','metal');
const level=group(scene,23.5,-.82,16.5);level.rotation.y=.14;part(level,'#aeb8a1',0,.25,0,7.2,.50,.80,null,'box','metal');part(level,'#d1aa55',0,.52,0,6.6,.10,.83);for(const x of [-3.4,3.4])part(level,'#323e33',x,.28,0,.5,.61,.92);part(level,'#344739',0,.585,0,1.5,.08,.54);part(level,'#b7d382',0,.64,0,1.14,.05,.31,null,'box','glow');part(level,'#e5e9bf',.09,.68,0,.19,.05,.24);for(const x of [-.25,.25])part(level,'#3e5c36',x,.675,0,.025,.012,.30);
// A small brass edition plate is attached to the front face of the plinth.
sign('筑 间','SITE ATELIER  /  01',-16,-.48,17.43,2.9,.41,0,'#6d6248');

// Reinforced concrete frame: slabs and columns meet at their surfaces.
const buildingBounds={x0:-.4,x1:10.45,z0:-6.55,z1:3.85,top:G+11.3};
part(null,'#aab09e',5.05,G+.12,-1.3,11.0,.24,10.9);
for(let floor=0;floor<4;floor++){
 const slabY=G+.31+floor*2.5;
 part(null,floor===0?'#bab9a2':'#c3c5b1',5.05,slabY,-1.3,10.8,.26,10.4);
 part(null,'#a5af9d',5.05,slabY-.06,3.912,10.78,.14,.04);
 for(const x of [.15,3.43,6.72,10.0])for(const z of [-6.2,-3.05,.1,3.52]){
  part(null,random()>.5?'#b2b8a5':'#a6b09f',x,slabY+1.38,z,.43,2.5,.43);
  if(floor===0)part(null,'#8b9989',x,slabY+.19,z,.65,.18,.65);
 }
 if(floor<3){for(const x of [.15,3.43,6.72,10])part(null,'#a7b09e',x,slabY+2.30,-1.34,.43,.37,10.1);}
 if(floor>0){
  rail(-.18,3.91,10.30,3.91,slabY+.13,.78,'#d4a454');
  rail(-.18,-6.48,-.18,3.91,slabY+.13,.78,'#d4a454');
  rail(10.30,-6.45,10.30,3.90,slabY+.13,.78,'#d4a454');
 }
 // Formwork edge bands are smaller than the concrete slab above them.
 if(floor===2){part(null,'#a79465',5.0,slabY-.26,3.73,10.6,.20,.24);for(let x=.2;x<10.2;x+=.42)part(null,'#7d7454',x,slabY-.25,3.872,.06,.2,.017);}
}
const roofY=G+.31+10;
part(null,'#c2c6b2',3.05,roofY,-1.3,6.8,.26,10.4);
part(null,'#b6bdab',8.38,roofY,-4.8,4.05,.26,3.4);
// Open roof bay: individual reinforcing bars, formwork and projecting starters.
part(null,'#a99058',8.35,roofY-.12,.42,3.8,.12,6.95);
for(let z=-2.8;z<=3.6;z+=.38)part(null,'#626f61',8.4,roofY+.11,z,3.75,.037,.037,null,'box','metal');
for(let x=6.65;x<=10.15;x+=.38)part(null,'#667362',x,roofY+.15,.4,.037,.037,6.65,null,'box','metal');
for(const x of [.15,3.43,6.72,10])for(const z of [-6.2,-3.05,.1,3.52])for(const dx of [-.14,.14])for(const dz of [-.14,.14])part(null,'#6b6c52',x+dx,roofY+.76,z+dz,.043,1.19,.043,null,'box','metal');
rail(-.25,-6.49,10.3,-6.49,roofY+.13,.78,'#d4a454');rail(-.25,-6.45,-.25,3.91,roofY+.13,.78,'#d4a454');rail(-.25,3.91,5.8,3.91,roofY+.13,.78,'#d4a454');
// Infilled lift core, temporary stairs and a pale green safety screen.
part(null,'#8d9b8b',7.95,G+5.22,-4.80,2.2,10.15,2.5);
for(let f=0;f<4;f++)part(null,'#394b42',7.93,G+1.25+f*2.5,-3.539,.87,1.56,.018);
for(let f=0;f<3;f++)for(let n=0;n<10;n++)part(null,'#b0b8a5',4.6,G+.46+f*2.5+n*.25,-5.9+n*.25,1.55,.22,.30);
for(let floor=1;floor<3;floor++){
 const mesh=flatMesh(new THREE.PlaneGeometry(5.0,1.04),materials.net,2.5,G+.99+floor*2.5,3.945);
 for(let x=.1;x<5;x+=.33)part(null,'#779377',x,G+.98+floor*2.5,3.955,.016,.99,.018);
}
const lift=group(scene,11.03,G,.35);for(const x of [-.39,.39])for(const z of [-.4,.4])part(lift,'#866f47',x,5.5,z,.073,11,.073);
for(let y=.5;y<11;y+=.55){for(const z of [-.4,.4]){part(lift,'#a58b57',0,y,z,.86,.052,.045);beam(lift,'#8c7956',[-.39,y,z],[.39,y+.55,z],.035);}}
part(lift,'#bc7840',0,5.1,.02,1.1,.12,1.12);part(lift,'#cf9b57',0,6.4,.02,1.1,.12,1.12);for(const x of [-.51,.51])for(const z of [-.50,.55])part(lift,'#c59b55',x,5.75,z,.08,1.3,.08);
sign('主体施工','STRUCTURE / ZONE 02',5,G+3.84,3.992,3.25,.71,0,'#455d50');
for(let i=0;i<18;i++){const x=.6+(i%6)*.42,z=4.62+Math.floor(i/6)*.26;part(null,'#ad7c48',x,G+.13,z,.37,.25,.22);}
for(const x of [1.5,11.8]){const z=x===1.5?7.5:-7.8;part(null,'#a9ad99',x,G+.22,z,2.2,.44,2.2);for(const dx of [-.78,.78])for(const dz of [-.78,.78])part(null,'#626e5e',x+dx,G+.5,z+dz,.2,.18,.2,null,'box','metal');}

// Prefabricated offices and workshop.
const office=group(scene,-10.55,G,-9.60);
part(office,'#aaa994',0,.08,0,9.2,.16,3.35);
for(let f=0;f<2;f++){
 const y=.18+f*2.08;
 part(office,'#dce0cf',0,y+.94,0,8.6,1.88,2.75);
 for(let x=-4.22;x<4.4;x+=.31)part(office,'#b8c7b5',x,y+.92,1.385,.027,1.81,.025);
 part(office,'#547b7c',0,y+1.91,0,8.78,.13,2.91);
 for(const x of [-3.20,-1.15,1.0,3.10]){
  part(office,'#879d92',x,y+1.02,1.408,1.11,.88,.035);
  part(office,'#305963',x,y+1.03,1.435,.99,.76,.025,null,'box','glass');
  part(office,'#e2e6d6',x,y+1.02,1.459,.047,.80,.023);
  part(office,'#b7c4b3',x,y+1.03,1.462,1.04,.045,.024);
  part(office,'#83a5a4',x-.23,y+1.25,1.451,.42,.16,.011);
 }
 if(f===0){part(office,'#5a716b',0,y+.65,1.463,.78,1.32,.045);part(office,'#b2c4b3',0,y+.94,1.491,.55,.48,.012);part(office,'#ddd7af',.23,y+.59,1.506,.05,.10,.035);}
 else{part(office,'#929f8a',0,y-.02,1.8,9.1,.12,.95);for(let x=-4.4;x<=4.4;x+=.66)part(office,'#d1d7c6',x,y+.42,2.23,.045,.87,.045);part(office,'#e0dec7',0,y+.88,2.23,9.05,.055,.055);}
}
part(office,'#597e7a',0,4.41,0,9.00,.18,3.10);
for(let x=-4.3;x<=4.3;x+=.24)part(office,'#77958a',x,4.517,0,.06,.045,3.05);
sign('项 目 部','SITE OFFICE',-10.55,G+4.02,-8.177,4.0,.52,0,'#3d6664');
for(let i=0;i<11;i++){const yy=G+.13+i*.195,zz=-7.3-i*.31;part(null,'#84998a',-15.95,yy,zz,1.05,.13,.33);}
beam(null,'#c3cbbc',[-16.48,G+.8,-7.15],[-16.48,G+2.85,-10.45],.055);beam(null,'#c3cbbc',[-15.42,G+.8,-7.15],[-15.42,G+2.85,-10.45],.055);
for(let i=0;i<6;i++)for(const x of [-16.48,-15.42])part(null,'#aebfab',x,G+.53+i*.38,-7.4-i*.61,.045,.8,.045);
for(const x of [-14.0,-7.2]){part(null,'#cbd2c0',x,G+2.95,-11.018,.93,.64,.34);for(let i=0;i<4;i++)part(null,'#7c9288',x-.3+i*.2,G+2.95,-11.196,.06,.42,.018);}
// Blue-green open-sided reinforcing shop with corrugated pitched roofing.
for(const x of [12.2,16.5])for(const z of [-4.1,2.6])part(null,'#737f68',x,G+1.5,z,.12,3,.12);
part(null,'#989e84',14.35,G+.07,-.75,4.75,.14,7.25);
for(const x of [13.22,15.49])part(null,'#5e8077',x,G+3.24,-.75,2.55,.14,7.4,[0,0,x<14? .12:-.12]);
for(let z=-4.35;z<=2.94;z+=.26){beam(null,'#7b9988',[11.95,G+3.09,z],[14.35,G+3.4,z],.045);beam(null,'#7b9988',[14.35,G+3.4,z],[16.78,G+3.09,z],.045);}
sign('钢筋加工棚','REBAR WORKSHOP',14.35,G+2.68,3.019,3.3,.58,0,'#44655b');
part(null,'#a1a58d',14.4,G+.8,-.8,2.2,.17,3.1);for(const x of [13.5,15.3])for(const z of [-2,.4])part(null,'#627760',x,G+.4,z,.12,.8,.12);
for(let i=0;i<9;i++)part(null,'#687360',14.4,G+.94,-1.9+i*.22,2.8,.045,.045,null,'box','metal');
part(null,'#b87440',14.8,G+1.17,-1.7,.8,.48,.7);part(null,'#4b5d4b',14.8,G+1.42,-1.7,.96,.09,.84);
// Pallets, individual stacked bricks, timber, bundled steel and concrete pipes.
function pallet(x,z,w=2.4,d=1.8){for(const dx of [-w*.35,w*.35])part(null,'#8c7851',x+dx,G+.10,z,.14,.2,d);for(let k=0;k<6;k++)part(null,'#b99b65',x-w*.44+k*w*.176,G+.24,z,w*.15,.12,d);}
pallet(14.05,8.9,2.5,1.65);
for(let level=0;level<4;level++)for(let ix=0;ix<5;ix++)for(let iz=0;iz<3;iz++)part(null,['#b98555','#c19561','#a46e45'][Math.floor(random()*3)],13.12+ix*.46,G+.4+level*.25,8.38+iz*.45,.43,.23,.42);
pallet(13.9,5.60,3.0,1.6);for(let i=0;i<10;i++)part(null,'#586552',13.9,G+.42+(i%2)*.10,5.02+Math.floor(i/2)*.27,3.6,.08,.08,null,'box','metal');
for(const x of [12.7,15.1])part(null,'#a99f71',x,G+.49,5.57,.06,.30,1.40);
pallet(9.6,8.4,2.1,2.7);for(let i=0;i<6;i++)part(null,random()>.5?'#d1b075':'#b59663',9.6,G+.4+i*.16,8.4,1.9,.135,2.5);
for(let iz=0;iz<2;iz++)for(let layer=0;layer<(iz===1?2:1);layer++){
 const x=15.6-layer*.05,z=10.12+iz*.63,y=G+.5+layer*.63;
 part(null,'#b7bba5',x,y,z,.61,1.6,.61,[0,0,Math.PI/2],'cyl');
 for(const side of [-1,1])part(null,'#536356',x+side*.808,y,z,.43,.014,.43,[0,0,Math.PI/2],'cyl');
}
for(const x of [6.1,6.65,7.2]){part(null,'#748776',x,G+.47,9.8,.47,.92,.47,null,'cyl8','metal');part(null,'#c1c4a4',x,G+.90,9.8,.48,.045,.48,null,'cyl8');}
// A dedicated spoil shoulder begins beyond the road envelope (x > -17.2).
for(let ix=0;ix<8;ix++)for(let iz=0;iz<10;iz++){
 const x=-16.92+ix*.46,z=5.8+iz*.44;const h=Math.max(.0,1.75-Math.hypot((ix-3.5)*.37,(iz-4.5)*.28)+range(-.2,.2));
 if(h>.15)part(null,['#b39b73','#bca17b','#a78e66','#c3ad82'][Math.floor(random()*4)],x,G+h*.5,z,.445,h,.425);
}
sign('土方临时堆场','SOIL STOCKPILE',-15.15,G+1.0,10.42,2.6,.72,0,'#746343');
for(const x of [-16.45,-13.85])part(null,'#8d8a68',x,G+.55,10.4,.065,1.1,.065);
// Low tool crates, generator, portable toilet and security hut.
part(null,'#536e5b',-2.1,G+.44,9.5,1.4,.88,1.25);part(null,'#8b9b77',-2.1,G+.94,9.5,1.55,.15,1.36);for(let i=0;i<5;i++)part(null,'#2f4838',-2.1,G+.21+i*.12,10.135,1.08,.055,.014);part(null,'#dcb765',-1.7,G+.74,10.146,.19,.15,.02);
part(null,'#638780',-18.0,G+1.23,-14.85,1.35,2.38,1.45);part(null,'#aac4ad',-18,G+2.48,-14.85,1.48,.14,1.58);part(null,'#496e67',-18,G+1.28,-14.115,.96,1.91,.034);part(null,'#d7e0c4',-18.32,G+1.15,-14.086,.04,.18,.044);
const security=group(scene,19.9,G,15.4);part(security,'#d4d9c4',0,.95,0,1.7,1.9,1.25);part(security,'#426363',0,1.26,.638,1.3,.62,.024,null,'box','glass');part(security,'#456a61',0,1.98,0,1.93,.15,1.5);sign('门卫','SECURITY',19.9,G+.41,16.041,1.24,.37,0,'#38584a');
const lampBulbs=[],siteLights=[];
function lamp(x,z,h=4.9){part(null,'#76816b',x,G+h/2,z,.09,h,.09);part(null,'#849375',x,G+.06,z,.5,.12,.5);beam(null,'#7b8b74',[x,G+h,z],[x+.65,G+h+.2,z],.07);part(null,'#4a5c47',x+.71,G+h+.14,z,.63,.17,.40);const bulb=new THREE.Mesh(new THREE.BoxGeometry(.56,.025,.34),new THREE.MeshBasicMaterial({color:'#fff1cd',toneMapped:false}));bulb.position.set(x+.71,G+h+.045,z);scene.add(bulb);lampBulbs.push(bulb);}
for(const p of [[-20.9,-12],[-20.9,11.9],[20.9,11.8],[20.9,-11.8],[-3,-13.8]])lamp(...p);
for(const p of [[-8,5,3],[6,8,3],[13,5,-5]]){const l=new THREE.PointLight('#ffc47f',0,20,2);l.position.set(...p);scene.add(l);siteLights.push(l);}
const pennantGeo=new THREE.BufferGeometry();pennantGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.24,0,0,.24,0,0,0,-.53,0],3));pennantGeo.computeVertexNormals();
function bunting(x0,z0,x1,z1,h,n){beam(null,'#847f61',[x0,G+h,z0],[x1,G+h,z1],.024);for(let i=0;i<n;i++){const t=(i+.5)/n,y=G+h-Math.sin(t*Math.PI)*.28;const mat=new THREE.MeshStandardMaterial({color:['#c8754c','#d3b862','#6d9490','#9aab7a'][i%4],side:THREE.DoubleSide,roughness:.9});const m=flatMesh(pennantGeo,mat,lerp(x0,x1,t),y,lerp(z0,z1,t));m.rotation.y=Math.atan2(z1-z0,x1-x0)*-1;m.rotation.x=.18;}}
bunting(-20.9,-12,-3,-13.8,4.9,25);
for(const x of [-2.3,-1.5,-.7]){part(null,'#e9c46c',x,G+.70,16.15,.33,.12,.12,null,'box','glow');}

// Articulated excavators. Local X is the machine's forward direction.
const excavators=[], hydraulicMaterial=new THREE.MeshStandardMaterial({color:'#adb8a5',metalness:.7,roughness:.38});
function makeRod(parent){const m=new THREE.Mesh(geometry.cyl,hydraulicMaterial);m.castShadow=true;parent.add(m);return m;}
function positionRod(m,a,b,r=.065){v1.set(...a);v2.set(...b).sub(v1);m.position.copy(v1).addScaledVector(v2,.5);m.scale.set(r,v2.length(),r);m.quaternion.setFromUnitVectors(axisY,v2.normalize());}
function excavator(x,z,y,scale=1,baseYaw=0,paint=colors.yellow){
 const root=group(scene,x,y,z);root.scale.setScalar(scale);root.rotation.y=baseYaw;
 for(const side of [-1,1]){
  part(root,'#333c33',0,.35,side*.91,2.9,.55,.59);
  for(let i=0;i<7;i++){part(root,'#444b3e',-1.22+i*.40,.365,side*.91,.48,.33,.49,[Math.PI/2,0,0],'cyl8');part(root,'#68715a',-1.22+i*.40,.365,side*1.219,.14,.022,.14,[Math.PI/2,0,0],'cyl8');}
  for(let i=0;i<12;i++){part(root,'#535b49',-1.39+i*.252,.655,side*.91,.15,.083,.65);part(root,'#30392f',-1.39+i*.252,.067,side*.91,.17,.067,.64);}
 }
 part(root,'#65715b',0,.71,0,1.85,.21,1.37);part(root,'#465440',0,.90,0,1.25,.22,1.25,null,'cyl');
 const turret=group(root,0,1.0,0);
 part(turret,paint,-.37,.24,0,2.25,.45,1.91);part(turret,paint,-1.11,.62,-.15,.61,.52,1.57);
 for(let i=0;i<5;i++)part(turret,'#615e3d',-1.43,.65,-.63+i*.22,.019,.15,.105);
 part(turret,'#2c4140',-.02,.83,.56,1.14,.87,.77,null,'box','glass');
 part(turret,'#bad0bc',.553,.92,.56,.025,.60,.64,null,'box','glass');
 part(turret,'#7aabaa',.03,.99,.959,.81,.45,.025,null,'box','glass');
 for(const xx of [-.61,.60])part(turret,paint,xx,.84,.58,.085,1.02,.92);
 part(turret,paint,-.01,1.34,.57,1.36,.13,1.07);part(turret,'#e7d5a1',.26,.76,.60,.24,.23,.27);part(turret,'#273c30',.25,.54,.61,.30,.27,.32);
 part(turret,'#657155',-.85,1.0,-.48,.10,.48,.10);part(turret,'#efe1b3',.64,.24,.88,.17,.17,.12,null,'box','glow');
 const boom=group(turret,.50,.60,-.41),stick=group(boom,2.55,0,0),bucket=group(stick,2.05,0,0);
 part(boom,paint,1.275,0,0,2.55,.31,.34);part(boom,'#bf8637',1.2,-.13,0,2.30,.085,.36);
 part(boom,'#6d7151',0,0,0,.46,.22,.46,[Math.PI/2,0,0],'cyl');part(boom,'#858761',2.55,0,0,.40,.23,.40,[Math.PI/2,0,0],'cyl');
 part(stick,paint,1.025,0,0,2.05,.255,.30);part(stick,'#766f45',2.05,0,0,.36,.32,.36,[Math.PI/2,0,0],'cyl');
 part(bucket,'#6b6c4d',.16,-.13,0,.79,.15,.95);part(bucket,'#8e8355',-.18,.14,0,.17,.55,.96);for(const side of [-1,1])part(bucket,'#aa945a',.13,.12,side*.447,.77,.48,.073);
 for(let i=0;i<5;i++)part(bucket,'#c9be91',.62,-.10,-.37+i*.18,.31,.14,.11,[0,0,-.11]);
 const soil=group(bucket,.14,.08,0);for(let i=0;i<8;i++)part(soil,'#b59b73',-.13+(i%3)*.19,.06+Math.floor(i/3)*.10,-.22+(i%2)*.38,.21,.18,.23);
 const ram1=makeRod(turret),ram2=makeRod(boom);
 const e={root,turret,boom,stick,bucket,soil,ram1,ram2,scale,baseYaw,worldY:y,paint};excavators.push(e);return e;
}
const loadingExcavator=excavator(-8.5,8.25,G,1,0,colors.yellow);
const pitExcavatorA=excavator(-11,-1.8,PIT_Y,.86,2.64,colors.orange);
const pitExcavatorB=excavator(-6.6,-1.0,PIT_Y,.73,-.93,'#e4af54');
function poseExcavator(e,reach,vertical,yaw,curl,hasSoil){
 e.turret.rotation.y=yaw; const dx=reach-.5,dy=vertical-1.6;const len1=2.55,len2=2.05,dist=clamp(Math.hypot(dx,dy),.55,4.58);
 const a=Math.atan2(dy,dx)+Math.acos(clamp((len1*len1+dist*dist-len2*len2)/(2*len1*dist),-1,1));
 const elbow=-Math.acos(clamp((dist*dist-len1*len1-len2*len2)/(2*len1*len2),-1,1));
 e.boom.rotation.z=a;e.stick.rotation.z=elbow;e.bucket.rotation.z=curl-a-elbow;
 e.soil.visible=hasSoil;
 positionRod(e.ram1,[.05,.66,-.41],[.5+1.43*Math.cos(a),.6+1.43*Math.sin(a),-.41],.084);
 positionRod(e.ram2,[1.14,.19,.02],[2.55+.84*Math.cos(elbow),.84*Math.sin(elbow),.02],.065);
}
function keySample(points,t){for(let i=0;i<points.length-1;i++){if(t<=points[i+1][0]){const a=points[i],b=points[i+1],f=smooth((t-a[0])/(b[0]-a[0]));return a.slice(1).map((v,k)=>lerp(v,b[k+1],f));}}return points.at(-1).slice(1);}
function updateExcavators(time){
 const loading=fleet.find(v=>v.type==='dump'&&v.stop==='load');
 if(loading){
  const t=((14-loading.remaining)%7)/7;
  const p=keySample([[0,3.70,-.66,Math.PI/2,.10],[.17,3.82,-.70,Math.PI/2,-.24],[.33,3.5,3.75,Math.PI/2,-.12],[.58,4.31,3.80,-Math.PI/2,-.05],[.72,4.31,3.45,-Math.PI/2,.44],[.81,4.31,3.7,-Math.PI/2,.05],[1,3.7,-.66,Math.PI/2,.10]],t);
  poseExcavator(loadingExcavator,...p,t>.17&&t<.73);
 }else{
  const t=(time%7)/7,p=keySample([[0,3.7,-.66,Math.PI/2,.1],[.28,3.8,-.72,Math.PI/2,-.22],[.54,3.0,2.45,Math.PI/2,.0],[.75,3.5,1.7,Math.PI/2+.21,.3],[1,3.7,-.66,Math.PI/2,.1]],t);
  poseExcavator(loadingExcavator,...p,t>.28&&t<.75);
 }
 for(const [e,offset] of [[pitExcavatorA,1.2],[pitExcavatorB,3.9]]){
  const t=((time+offset)%8)/8,p=keySample([[0,3.2,.64,0,.04],[.24,3.4,.60,0,-.27],[.50,2.55,2.65,.12,-.06],[.73,2.9,2.12,.30,.48],[1,3.2,.64,0,.04]],t);
  poseExcavator(e,...p,t>.24&&t<.73);
 }
}

// Shared truck chassis. Wheels rotate around their real axle, clear of the bed.
function truckChassis(paint,mixer=false){
 const root=group(),wheels=[];
 part(root,'#384838',-.10,.67,0,3.65,.25,1.45);part(root,'#68745a',-.35,.88,0,2.40,.16,1.56);
 for(const x of [1.17,-.46,-1.38]){
  const axle=group(root,x,.45,0);wheels.push(axle);
  for(const side of [-1,1]){
   part(axle,'#303a30',0,0,side*.91,.81,.38,.81,[Math.PI/2,0,0],'cyl');
   part(axle,'#9aa78b',0,0,side*1.108,.40,.035,.40,[Math.PI/2,0,0],'cyl8','metal');
   part(axle,'#667252',0,0,side*1.13,.29,.075,.028);part(axle,'#647354',0,0,side*1.133,.075,.29,.028);
  }
 }
 part(root,paint,1.21,1.25,0,1.24,1.04,1.72);part(root,'#324e4b',1.846,1.53,0,.033,.61,1.40,null,'box','glass');
 part(root,'#89afa5',1.87,1.71,-.31,.015,.15,.61,null,'box','glass');part(root,paint,1.2,1.96,0,1.45,.14,1.90);
 for(const side of [-1,1]){part(root,'#46665d',1.23,1.62,side*.873,.88,.53,.023,null,'box','glass');part(root,'#a8c4b1',1.42,1.79,side*.889,.40,.10,.010);part(root,'#71836c',1.78,1.54,side*1.033,.16,.25,.09);part(root,'#e4deab',1.869,1.01,side*.56,.035,.19,.28,null,'box','glow');part(root,'#d3cdb0',1.17,.77,side*.91,.68,.12,.19,null,'box','metal');}
 part(root,'#4e6049',1.876,1.24,0,.04,.25,.55);part(root,'#859378',1.943,.80,0,.14,.17,1.90);
 part(root,'#efd295',1.13,2.13,0,.36,.20,.33,null,'box','glow');part(root,'#a54c32',-1.946,.72,.64,.03,.18,.24,null,'box','glow');
 if(mixer)part(root,'#cabd88',.51,1.02,0,.26,.31,1.76);
 return{root,wheels};
}
function dumpTruck(paint,id){
 const base=truckChassis(paint);const bed=group(base.root,-.52,1.04,-.80);
 part(bed,paint,0,.08,.80,2.75,.15,1.73);part(bed,paint,0,.47,1.63,2.77,.71,.11);
 for(const x of [-1.34,1.34])part(bed,paint,x,.45,.8,.11,.72,1.67);
 for(const x of [-1.1,-.43,.23,.90])part(bed,'#b18340',x,.43,1.708,.075,.61,.029);
 const gate=group(bed,0,.84,.008);part(gate,paint,0,-.32,0,2.66,.67,.09);for(const x of [-.9,0,.9])part(gate,'#c49750',x,-.33,-.057,.075,.58,.025);
 const cargo=group(bed,0,.19,.80);for(let ix=0;ix<7;ix++)for(let iz=0;iz<4;iz++){const h=range(.29,.62);part(cargo,['#b8a27a','#c6af83','#a89269'][Math.floor(random()*3)],-1.10+ix*.365,h/2,-.59+iz*.395,.35,h,.37);}
 return{...base,bed,gate,cargo,type:'dump',id};
}
function mixerTruck(){
 const base=truckChassis('#d1d1ac',true),drum=group(base.root,-.55,1.71,0);
 part(drum,'#e2dfba',0,0,0,1.62,2.16,1.62,[0,0,Math.PI/2],'cyl');
 for(const x of [-1.04,1.04])part(drum,'#c2c7a4',x,0,0,1.43,.25,1.43,[0,0,Math.PI/2],'cyl8');
 for(let i=0;i<6;i++){const a=i*TAU/6;part(drum,'#567f76',0,Math.cos(a)*.807,Math.sin(a)*.807,1.77,.07,.25,[a,0,0]);}
 part(base.root,'#aeb698',-1.76,1.12,0,.68,.15,.50,[0,0,-.4]);part(base.root,'#7c8a6b',-2.03,.99,0,.35,.21,.50);
 for(const z of [-.64,.64])beam(base.root,'#849174',[-1.82,1.10,z],[-1.82,2.55,z],.065);
 for(let y=1.2;y<2.7;y+=.26)part(base.root,'#a2ad8a',-1.83,y,0,.055,.055,1.30);
 return{...base,drum,type:'mixer',id:'C-01'};
}
const truck1=dumpTruck('#d5aa50','D-01'),truck2=dumpTruck('#d78b4e','D-02'),mixer=mixerTruck();
const fleet=[Object.assign(truck1,{s:0,stop:'load',remaining:14,nextStop:'unload',fill:0,speed:2.4,travel:0,loads:0}),Object.assign(truck2,{s:UNLOAD_S,stop:'unload',remaining:10,nextStop:'load',fill:1,speed:2.4,travel:0,loads:0}),Object.assign(mixer,{s:ROAD_LENGTH*.43,stop:null,remaining:0,nextStop:null,fill:0,speed:2.1,travel:0,loads:0})];
function advanceFleet(list,dt){
 const distances=list.map(v=>v.s),steps=[];
 for(let i=0;i<list.length;i++){
  const v=list[i];if(v.stop){v.remaining=Math.max(0,v.remaining-dt);if(v.stop==='load')v.fill=clamp((14-v.remaining)/13.0,0,1);else v.fill=1-smooth((10-v.remaining-2)/5.5);if(v.remaining<=0){v.nextStop=v.stop==='load'?'unload':'load';if(v.stop==='unload')v.loads++;v.stop=null;}steps[i]=0;continue;}
  let gap=ROAD_LENGTH;for(let j=0;j<list.length;j++){if(i!==j){const ahead=(distances[j]-distances[i]+ROAD_LENGTH)%ROAD_LENGTH;gap=Math.min(gap,ahead);}}
  let step=Math.min(v.speed*dt,Math.max(0,gap-5.9));
  if(v.type==='dump'){
   const station=v.nextStop==='load'?0:UNLOAD_S,d=(station-v.s+ROAD_LENGTH)%ROAD_LENGTH;
   if(d<=step+.000001){step=d;v.stop=v.nextStop;v.remaining=v.stop==='load'?14:10;}
  }steps[i]=step;
 }
 list.forEach((v,i)=>{v.s=(v.s+steps[i])%ROAD_LENGTH;v.travel+=steps[i];});
}
function drawFleet(dt){
 advanceFleet(fleet,dt);
 for(const v of fleet){
  const p=roadAt(v.s);v.root.position.set(p.x,G+.06,p.z);v.root.rotation.y=p.yaw;
  v.wheels.forEach(ax=>ax.rotation.z=-v.travel/.405);
  if(v.type==='dump'){
   const elapsed=v.stop==='unload'?10-v.remaining:0;
   const tip=elapsed<2?smooth(elapsed/2):elapsed<7.8?1:1-smooth((elapsed-7.8)/2.2);
   v.bed.rotation.x=-.69*tip;v.gate.rotation.x=.95*tip;v.cargo.scale.y=Math.max(.001,v.fill);v.cargo.visible=v.fill>.005;
  }else v.drum.rotation.x=state.time*.6;
 }
}
// Compact loader moves only within its reserved soil apron, clear of the road.
const loader=group(scene,-12.15,G,10.35);loader.scale.setScalar(.85);const loaderBucket=group(loader,1.20,.40,0);
part(loader,'#ba9847',-.30,.64,0,1.76,.42,1.22);part(loader,'#dcba5c',-.75,.99,0,.80,.43,1.13);part(loader,'#345344',.17,1.25,0,.83,.81,.98,null,'box','glass');part(loader,'#ead08c',.17,1.72,0,1.06,.12,1.21);
for(const x of [-.79,.76])for(const z of [-.65,.65]){part(loader,'#344132',x,.41,z,.76,.32,.76,[Math.PI/2,0,0],'cyl8');part(loader,'#b7b88c',x,.41,z+Math.sign(z)*.18,.33,.04,.33,[Math.PI/2,0,0],'cyl8');}
for(const z of [-.53,.53])beam(loader,'#d3ad51',[.5,.86,z],[1.6,.42,z],.15);
part(loaderBucket,'#c1a255',.38,-.07,0,.93,.15,1.49);part(loaderBucket,'#b19a55',-.06,.20,0,.14,.54,1.50);for(const z of [-.70,.70])part(loaderBucket,'#d4b969',.39,.15,z,.97,.43,.10);

// Two lattice tower cranes: non-overlapping mast zones and separated heights.
const cranes=[];
function crane(x,z,height,jibLength,config){
 const root=group(scene,x,G+.44,z),paint='#d9ac42';
 for(const dx of [-.48,.48])for(const dz of [-.48,.48])part(root,paint,dx,height/2,dz,.105,height,.105);
 for(let y=.1;y<height-.2;y+=1.3){
  for(const side of [-1,1]){
   beam(root,paint,[-.48,y,side*.48],[.48,y+1.26,side*.48],.075);
   beam(root,paint,[side*.48,y,-.48],[side*.48,y+1.26,.48],.075);
   part(root,'#c6a759',0,y,side*.48,1.05,.068,.072);part(root,'#c6a759',side*.48,y,0,.072,.068,1.05);
  }
 }
 for(let y=.25;y<height;y+=.32)part(root,'#808564',-.19,y,-.14,.35,.035,.045);
 part(root,'#617859',0,height-.2,0,1.5,.25,1.5);part(root,'#89936a',0,height+.07,0,1.28,.29,1.28,null,'cyl');
 const head=group(root,0,height+.23,0);
 const tailLength=jibLength>10?4.2:3.2;
 for(const side of [-1,1]){
  part(head,paint,(jibLength-tailLength)/2,0,side*.39,jibLength+tailLength,.10,.11);
  part(head,paint,(jibLength-tailLength)/2,.78,side*.24,jibLength+tailLength,.09,.09);
  for(let p=-tailLength;p<jibLength-.4;p+=.95){beam(head,paint,[p,0,side*.39],[p+.47,.78,side*.24],.064);beam(head,paint,[p+.47,.78,side*.24],[p+.94,0,side*.39],.064);}
 }
 for(let p=-tailLength;p<jibLength;p+=.98)part(head,'#b89e55',p,.02,0,.07,.07,.86);
 part(head,'#9ea58d',-tailLength+.6,.53,0,1.13,.85,1.6);part(head,'#7e8b70',-tailLength+.6,.96,0,1.14,.12,1.62);
 part(head,'#c9ab66',-.12,1.17,0,.18,1.14,.18);beam(head,'#767f60',[-.12,1.65,0],[jibLength*.63,.81,0],.026);beam(head,'#767f60',[-.12,1.65,0],[-tailLength+.3,.84,0],.027);
 part(head,'#d4bf7c',.10,-.51,.89,1.43,1.08,1.10);part(head,'#355a54',.21,-.43,1.453,.99,.68,.025,null,'box','glass');part(head,'#84a79a',.42,-.21,1.472,.35,.14,.014);
 const trolley=group(head,config.sourceR,-.15,0);part(trolley,'#657659',0,0,0,.64,.21,1.01);for(const zz of [-.39,.39])part(trolley,'#4e624b',0,.13,zz,.32,.14,.32,[Math.PI/2,0,0],'cyl8');
 const cable=new THREE.Mesh(geometry.box,new THREE.MeshStandardMaterial({color:'#5c6b4d',roughness:.55,metalness:.4}));head.add(cable);cable.castShadow=true;
 const hook=group(head);part(hook,'#ddbd69',0,0,0,.37,.47,.33);for(const y of [-.12,.11])part(hook,'#6c7050',0,y,.178,.34,.068,.017,[0,0,-.25]);beam(hook,'#6a7860',[0,-.25,0],[0,-.52,0],.075);
 const load=group(hook,0,-1.2,0);
 for(const xx of [-.80,.80])for(const zz of [-.23,.23])beam(hook,'#8b9471',[0,-.4,0],[xx,-1.12,zz],.027);
 if(config.kind==='steel'){
  for(let i=0;i<9;i++)part(load,'#626f56',0,(i%3)*.075,(Math.floor(i/3)-1)*.17,2.8,.057,.08,null,'box','metal');
  for(const xx of [-.84,.84])part(load,'#b7ab71',xx,.10,0,.065,.29,.53);
 }else{
  part(load,'#bac0a0',0,.03,0,1.02,.68,1.02,null,'cone','metal');part(load,'#7c8c6d',0,.45,0,.86,.17,.86);part(load,'#778968',0,-.37,0,.3,.28,.3);for(const xx of [-.35,.35])for(const zz of [-.35,.35])part(load,'#83936f',xx,-.49,zz,.065,.35,.065);
 }
 const c={root,head,trolley,cable,hook,load,height,jibLength,worldBoomY:G+.44+height+.23,...config};cranes.push(c);return c;
}
crane(11.8,-7.8,20.0,14.6,{kind:'steel',sourceA:-Math.atan2(13.4,2.2),sourceR:Math.hypot(13.4,2.2),targetA:-Math.atan2(5.8,-6.8),targetR:Math.hypot(5.8,6.8),sourceY:G+2.0,targetY:roofY+1.7,safeY:19.35,period:36,offset:15});
crane(1.5,7.5,14.7,8.2,{kind:'concrete',sourceA:-Math.atan2(.6,5.1),sourceR:Math.hypot(.6,5.1),targetA:-Math.atan2(-6.7,1.9),targetR:Math.hypot(6.7,1.9),sourceY:G+2.2,targetY:roofY+2.14,safeY:15.25,period:30,offset:21});
function cranePose(c,t){
 const p=((t+c.offset)%c.period)/c.period;
 return keySample([[0,c.sourceA,c.sourceR,c.sourceY],[.1,c.sourceA,c.sourceR,c.sourceY],[.26,c.sourceA,c.sourceR,c.safeY],[.47,c.targetA,c.targetR,c.safeY],[.6,c.targetA,c.targetR,c.targetY],[.67,c.targetA,c.targetR,c.targetY],[.80,c.targetA,c.targetR,c.safeY],[.93,c.sourceA,c.sourceR,c.safeY],[1,c.sourceA,c.sourceR,c.sourceY]],p);
}
function updateCranes(t){for(const c of cranes){const [angle,radius,hookY]=cranePose(c,t);c.head.rotation.y=angle;c.trolley.position.x=radius;const cableLength=c.worldBoomY-hookY;c.cable.position.set(radius,-cableLength*.5-.05,0);c.cable.scale.set(.025,cableLength-.1,.025);c.hook.position.set(radius,-cableLength,0);c.load.rotation.y=-angle;}}

// 32 workers share one instanced mesh, including articulated arms and legs.
const workers=[];
function worker(x,z,role='work',y=G,heading=0,vest=colors.orange){workers.push({x,z,y,heading,role,vest,phase:range(0,TAU)});}
worker(1.1,1.4,'tie',roofY+.14,1);worker(4.9,-3.5,'tie',roofY+.14,-.6);worker(8.4,1.7,'tie',roofY+.16,0);
worker(3.2,2.6,'signal',roofY+.14,-.4);worker(5.1,-.6,'carry',G+5.44,0);worker(.9,2.5,'work',G+2.94,.4);
worker(9.1,-5.7,'work',G+.44,1.5);worker(2.1,2.3,'tie',G+.44,.8);
worker(-12.9,2.8,'tool',PIT_Y,-1.2);worker(-10,3.3,'survey',PIT_Y,.3);worker(-4.8,-4.8,'work',PIT_Y,1.6);
worker(-11.1,6.55,'signal',G,-.6);worker(-3,4.8,'survey',G,-1.4);
worker(13.0,-2,'tie',G,1.5);worker(15.92,.4,'tool',G,-1.5);worker(14.7,1.6,'carry',G,0);
worker(12.1,8.8,'carry',G,1.4);worker(15.7,4.3,'work',G,2.5);worker(7.0,6.65,'signal',G,-.3);
worker(-13.7,-7.3,'walk',G,-1.5,'#d4d6b8');worker(-9.4,-7.4,'work',G,1.8,'#d7d9ba');worker(-7.4,-7.15,'carry',G,0);
worker(-12.5,-7.65,'work',G+2.28,.5,'#cfcdac');worker(-8.3,-7.65,'work',G+2.28,-.6);
worker(9.3,15.6,'guard',G,-Math.PI/2,'#57766a');worker(17.7,15.6,'guard',G,0,'#5a7667');
worker(-4.2,15.5,'walk',G,0);worker(3.3,15.5,'carry',G,.4);worker(-16.1,-15.25,'work',G,.7);
worker(-2.2,-9.5,'survey',G,1.5);worker(11.7,6.1,'work',G,1.0);worker(-2.4,8.6,'tool',G,1.3);
const WORKER_PARTS=16;
const workerMesh=new THREE.InstancedMesh(geometry.box,materials.solid,workers.length*WORKER_PARTS);workerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);workerMesh.castShadow=true;workerMesh.receiveShadow=true;workerMesh.frustumCulled=false;scene.add(workerMesh);
const workerBase=new THREE.Matrix4(),workerPartMatrix=new THREE.Matrix4(),workerRootDummy=new THREE.Object3D();
function workerPart(index,color,x,y,z,w,h,d,rx=0,ry=0,rz=0){dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(w,h,d);dummy.updateMatrix();workerPartMatrix.multiplyMatrices(workerBase,dummy.matrix);workerMesh.setMatrixAt(index,workerPartMatrix);if(state.frames===0)workerMesh.setColorAt(index,colorTmp.set(color));}
function updateWorkers(t){
 workers.forEach((w,i)=>{
  const phase=t*2.5+w.phase,moving=['walk','carry','guard'].includes(w.role),stride=moving?Math.sin(phase)*.45:0;
  let x=w.x,z=w.z,heading=w.heading;
  if(w.role==='guard'){x+=Math.sin(t*.20+w.phase)*1.15;heading=Math.cos(t*.20+w.phase)>0?Math.PI/2:-Math.PI/2;}
  else if(w.role==='walk'){x+=Math.sin(t*.26+w.phase)*.7;heading=Math.cos(t*.26+w.phase)>0?Math.PI/2:-Math.PI/2;}
  else if(w.role==='carry'&&w.y===G){z+=Math.sin(t*.27+w.phase)*.42;}
  workerRootDummy.position.set(x,w.y+.012,z);workerRootDummy.rotation.set(0,heading,0);workerRootDummy.scale.setScalar(.87);workerRootDummy.updateMatrix();workerBase.copy(workerRootDummy.matrix);
  const bend=w.role==='tie'?.33:w.role==='tool'?.12:0;
  let leftArm=-.13+stride*.65,rightArm=.13-stride*.65;
  if(w.role==='signal'){leftArm=-1.75+Math.sin(phase*.6)*.38;rightArm=-.95+Math.sin(phase*.6+.4)*.24;}
  if(w.role==='tie'){leftArm=-.81+Math.sin(phase*1.2)*.19;rightArm=-.81-Math.sin(phase*1.2)*.19;}
  if(w.role==='tool'){leftArm=rightArm=-.6+Math.sin(phase*3)*.06;}
  if(w.role==='carry'){leftArm=rightArm=-1.1;}
  const o=i*WORKER_PARTS;
  workerPart(o,w.vest,0,.82,Math.sin(bend)*.10,.42,.52,.27,bend);
  workerPart(o+1,'#ddd7aa',0,1.20,Math.sin(bend)*.18,.28,.27,.27);
  workerPart(o+2,w.role==='guard'?'#d7dcbe':'#eed080',0,1.36,Math.sin(bend)*.18,.35,.13,.33);
  workerPart(o+3,w.role==='guard'?'#b6c4ad':'#f4dda0',0,1.29,.037+Math.sin(bend)*.18,.40,.043,.39);
  workerPart(o+4,'#445b50',-.118,.365,-Math.sin(stride)*.07,.16,.47,.18,stride);
  workerPart(o+5,'#41594d',.118,.365,Math.sin(stride)*.07,.16,.47,.18,-stride);
  workerPart(o+6,'#343d31',-.118,.077,-Math.sin(stride)*.18+.04,.20,.14,.30);
  workerPart(o+7,'#343d31',.118,.077,Math.sin(stride)*.18+.04,.20,.14,.30);
  workerPart(o+8,w.vest,-.30,.81,Math.sin(-leftArm)*.16,.16,.40,.18,leftArm);
  workerPart(o+9,w.vest,.30,.81,Math.sin(-rightArm)*.16,.16,.40,.18,rightArm);
  workerPart(o+10,'#decc9e',-.30,.83-.28*Math.cos(leftArm),.28*Math.sin(-leftArm),.15,.16,.17,leftArm);
  workerPart(o+11,'#decc9e',.30,.83-.28*Math.cos(rightArm),.28*Math.sin(-rightArm),.15,.16,.17,rightArm);
  workerPart(o+12,'#e8e3ac',-.12,.83,.148,.07,.43,.015);
  workerPart(o+13,'#e8e3ac',.12,.83,.148,.07,.43,.015);
  workerPart(o+14,'#d9d6a3',0,.66,.149,.40,.055,.017);
  if(w.role==='carry')workerPart(o+15,'#ba9f64',0,.80,.45,.81,.20,.30);
  else if(w.role==='tool')workerPart(o+15,'#7b8870',0,.36,.39,.09,.69,.11);
  else if(w.role==='signal')workerPart(o+15,'#ebd28e',.31,.95,.40,.07,.22,.07);
  else workerPart(o+15,'#d2c99b',0,.88,-.148,.39,.05,.013);
 });
 workerMesh.instanceMatrix.needsUpdate=true;if(state.frames===0)workerMesh.instanceColor.needsUpdate=true;
}
// Tripod survey instruments and hand tools, outside all vehicle envelopes.
for(const [x,z,y] of [[-9.3,3.35,PIT_Y],[-2.2,4.8,G],[-1.65,-9.7,G]]){
 for(let i=0;i<3;i++){const a=i*TAU/3;beam(null,'#d5b35f',[x,y+1.0,z],[x+.33*Math.cos(a),y+.03,z+.33*Math.sin(a)],.039);}
 part(null,'#e6c579',x,y+1.05,z,.25,.17,.26);part(null,'#456e5d',x,y+1.24,z,.33,.22,.28);part(null,'#264938',x,y+1.25,z+.158,.12,.10,.026);
}
const dustCount=48,dustPositions=new Float32Array(dustCount*3),dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3).setUsage(THREE.DynamicDrawUsage));
const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:'#d4bd93',size:.10,transparent:true,opacity:.44,depthWrite:false,sizeAttenuation:true}));dust.frustumCulled=false;scene.add(dust);
function updateDust(t){
 const unloading=fleet.find(v=>v.type==='dump'&&v.stop==='unload'&&v.remaining<7.8&&v.remaining>2.2);
 const loading=fleet.find(v=>v.type==='dump'&&v.stop==='load');const loadingPhase=loading?((14-loading.remaining)%7)/7:0;
 for(let i=0;i<dustCount;i++){
  const p=(t*.75+i*.137)%1,k=i*3;
  if(i<28&&unloading){dustPositions[k]=-18.0+p*1.2;dustPositions[k+1]=G+1.18-Math.pow(p,1.2)*.7;dustPositions[k+2]=7.8+Math.sin(i*13)*.76;}
  else if(i>=28&&i<40&&loadingPhase>.61&&loadingPhase<.79){const f=(t*2+i*.14)%1;dustPositions[k]=-8.15+Math.sin(i*12)*.20;dustPositions[k+1]=G+3.3-f*1.7;dustPositions[k+2]=12.67+Math.cos(i*9)*.17;}
  else{const e=i%2===0?pitExcavatorA:pitExcavatorB;dustPositions[k]=e.root.position.x+(i%2===0?-1.8:1.4)+Math.sin(i*17+t*.4)*.25;dustPositions[k+1]=PIT_Y+.18+p*.66;dustPositions[k+2]=e.root.position.z+(i%2===0?-1.7:1.8)+Math.cos(i*7)*.26;}
 }dust.geometry.attributes.position.needsUpdate=true;
}
const beacons=[];const beaconMaterial=new THREE.MeshBasicMaterial({color:'#ffd881',toneMapped:false});
for(const [x,z,y] of [[-10.8,11.0,G+.78],[-6.1,11.0,G+.78],[10.6,16,G+3.28],[17.9,16,G+3.28]]){const b=new THREE.Mesh(new THREE.BoxGeometry(.13,.16,.13),beaconMaterial);b.position.set(x,y,z);scene.add(b);beacons.push(b);}
finishBatches();

// Camera: a seated/standing observer at the worktable, with bounded orbit.
const focusData={
 overview:{target:[-3.8,5.0,.7],distance:84,yaw:.66,pitch:.43},
 pit:{target:[-10.7,1.7,1.2],distance:29,yaw:.46,pitch:.61,tag:'ZONE 01 / EARTHWORK',title:'向下，\n打好根基。',description:'铲斗落下，土方升起。挖掘机和渣土车默契接力，把地面之下的每一寸，都变成城市的起点。',details:[['主要设备','3 台挖掘机'],['运输循环','装土 → 运输 → 侧卸'],['作业方式','分区开挖 · 连续作业']]},
 structure:{target:[3.1,6.9,-.8],distance:38,yaw:.61,pitch:.29,tag:'ZONE 02 / STRUCTURE',title:'向上，\n城市生长。',description:'楼板一层层叠起，钢筋交织成秩序。高低两台塔吊在各自的空间里，将材料送到需要它们的地方。',details:[['主体结构','钢筋混凝土框架'],['垂直运输','2 台塔式起重机'],['正在进行','钢筋绑扎 · 物料吊运']]},
 office:{target:[-11.6,2.9,-8.8],distance:27,yaw:.38,pitch:.34,tag:'ZONE 03 / EVERYDAY LIFE',title:'忙碌，\n也有日常。',description:'彩旗轻悬，板房静立。有人核对图纸，有人搬来下一批材料。在建造之外，工地也有自己的生活。',details:[['临时设施','双层板房 · 门卫室'],['加工区域','钢筋加工棚'],['现场保障','巡逻 · 照明 · 安全围护']]}
};
const cam={target:new THREE.Vector3(),wantedTarget:new THREE.Vector3(),distance:78,wantedDistance:78,yaw:.66,wantedYaw:.66,pitch:.43,wantedPitch:.43};
let autoOrbitPhase=0;
function screenFactor(){return Math.max(1,1.53/(innerWidth/innerHeight))**.78;}
function resetCameraImmediate(){const f=focusData[state.view];cam.target.set(...f.target);cam.wantedTarget.copy(cam.target);cam.distance=cam.wantedDistance=f.distance*screenFactor();cam.yaw=cam.wantedYaw=f.yaw;cam.pitch=cam.wantedPitch=f.pitch;}
function updateCamera(dt,instant=false){
 if(state.orbit){cam.wantedYaw+=dt*.052;autoOrbitPhase+=dt;}
 const a=instant?1:1-Math.exp(-Math.max(.016,dt)*7.5);
 cam.target.lerp(cam.wantedTarget,a);cam.distance=lerp(cam.distance,cam.wantedDistance,a);cam.yaw=lerp(cam.yaw,cam.wantedYaw,a);cam.pitch=lerp(cam.pitch,cam.wantedPitch,a);
 transitioning=cam.target.distanceTo(cam.wantedTarget)>.008||Math.abs(cam.distance-cam.wantedDistance)>.01||Math.abs(cam.yaw-cam.wantedYaw)>.0005||Math.abs(cam.pitch-cam.wantedPitch)>.0005;
 const h=cam.distance*Math.cos(cam.pitch);camera.position.set(cam.target.x+h*Math.sin(cam.yaw),cam.target.y+cam.distance*Math.sin(cam.pitch),cam.target.z+h*Math.cos(cam.yaw));camera.lookAt(cam.target);camera.updateMatrixWorld();
 $('compass-needle').setAttribute('transform',`rotate(${-cam.yaw*180/Math.PI},20,30)`);
}
const markers=[{el:document.querySelector('[data-focus="pit"]'),p:new THREE.Vector3(-11.0,G+2.6,4.2),view:'pit'},{el:document.querySelector('[data-focus="structure"]'),p:new THREE.Vector3(5.0,roofY+2.2,1.0),view:'structure'},{el:document.querySelector('[data-focus="office"]'),p:new THREE.Vector3(-10.6,G+5.0,-9.6),view:'office'}];
const projected=new THREE.Vector3();
function updateMarkers(){
 const placed=[],small=innerWidth<=760,w=small?86:98,h=small?30:33,stem=small?16:22;
 for(const m of markers){
  projected.copy(m.p).project(camera);const x=(projected.x*.5+.5)*innerWidth,y=(-projected.y*.5+.5)*innerHeight;
  const selected=state.view==='overview'||state.view===m.view;let visible=state.labels&&selected&&projected.z<1&&x>70&&x<innerWidth-55&&y>110&&y<innerHeight-145;
  let left=clamp(x-16,16,innerWidth-w-66),top=y-stem-h,originalTop=top;
  if(visible){for(let n=0;n<3;n++){const collision=placed.find(r=>left<r.left+w+8&&left+w+8>r.left&&top<r.top+h+8&&top+h+8>r.top);if(!collision)break;top=collision.top-h-10;}if(top<110)visible=false;}
  m.el.style.display=visible?'flex':'none';m.el.style.transform=`translate(${left.toFixed(1)}px,${top.toFixed(1)}px)`;m.el.style.setProperty('--stem-height',(stem+originalTop-top)+'px');m.el.style.setProperty('--stem-left',clamp(x-left,12,w-12)+'px');
  if(visible)placed.push({left,top});
 }
}
function focusView(view,notify=false){
 state.view=view;state.orbit=false;$('orbit-btn').setAttribute('aria-pressed','false');
 const f=focusData[view];cam.wantedTarget.set(...f.target);cam.wantedDistance=f.distance*screenFactor();cam.wantedYaw=f.yaw;cam.wantedPitch=f.pitch;
 document.querySelectorAll('[data-view]').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
 $('intro').hidden=view!=='overview';$('context').hidden=view==='overview';
 if(view!=='overview'){$('context-tag').textContent=f.tag;$('context-title').textContent=f.title;$('context-description').textContent=f.description;$('context-details').replaceChildren(...f.details.map(([a,b])=>{const row=document.createElement('div'),key=document.createElement('span'),value=document.createElement('b');key.textContent=a;value.textContent=b;row.append(key,value);return row;}));}
 if(notify)toast('已回到沙盘全景');wake();
}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(timerToast);timerToast=setTimeout(()=>$('toast').classList.remove('show'),2800);}
function syncPlaying(){
 const paused=!state.playing;$('play-btn').setAttribute('aria-label',paused?'继续施工':'暂停施工');$('play-btn').setAttribute('aria-pressed',String(paused));$('play-icon').setAttribute('href',paused?'#i-play':'#i-pause');$('live-status').classList.toggle('paused',paused);$('live-status').querySelector('span').textContent=paused?'时间已暂停':'正在作业';document.body.classList.toggle('is-paused',paused);syncAudio();
}
let testEndFrame=TEST_LIMIT;
function togglePlay(){state.playing=!state.playing;if(TEST&&state.playing)testEndFrame=state.frames+36;syncPlaying();wake();}
function changeLight(night){
 state.night=night;$('day-btn').classList.toggle('active',!night);$('night-btn').classList.toggle('active',night);$('day-btn').setAttribute('aria-pressed',String(!night));$('night-btn').setAttribute('aria-pressed',String(night));
 scene.background.set(night?'#121e24':'#202923');scene.fog.color.set(night?'#14232a':'#222c24');
 ambient.color.set(night?'#9db8df':'#d8e7da');ambient.groundColor.set(night?'#354034':'#7c6444');ambient.intensity=night?1.1:1.85;
 keyLight.color.set(night?'#9ebee2':'#ffdea5');keyLight.intensity=night?1.15:3.1;fillLight.color.set(night?'#749aca':'#b2d1dc');fillLight.intensity=night?.70:1.25;rimLight.color.set(night?'#e9b671':'#fff2cb');rimLight.intensity=night?1.3:.75;
 renderer.toneMappingExposure=night?1.0:1.02;siteLights.forEach(l=>l.intensity=night?95:0);lampBulbs.forEach(l=>l.material.color.set(night?'#ffe0a2':'#c2c6a5'));renderer.shadowMap.needsUpdate=true;wake();
}
function toggleLabels(){state.labels=!state.labels;$('labels-btn').setAttribute('aria-pressed',String(state.labels));wake();}
function setQuality(value){
 state.quality=value;const ratios={low:.85,balanced:1.35,high:1.85};renderer.setPixelRatio(Math.min(devicePixelRatio||1,TEST?1:ratios[value]));renderer.shadowMap.enabled=value!=='low';
 const size=value==='high'?2048:1536;if(keyLight.shadow.mapSize.x!==size){keyLight.shadow.mapSize.set(size,size);if(keyLight.shadow.map){keyLight.shadow.map.dispose();keyLight.shadow.map=null;}}
 renderer.shadowMap.needsUpdate=true;wake();
}
let audioCtx=null,audioGain=null;
async function createAudio(){
 if(audioCtx){if(audioCtx.state==='suspended')await audioCtx.resume();return;}
 const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('当前浏览器不支持环境音');
 audioCtx=new Audio();audioGain=audioCtx.createGain();audioGain.gain.value=0;audioGain.connect(audioCtx.destination);
 const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*3,audioCtx.sampleRate),data=buffer.getChannelData(0);let brown=0;for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.014)/1.012;data[i]=brown*3.0;}
 const source=audioCtx.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=360;source.connect(filter);filter.connect(audioGain);source.start();
 const engine=audioCtx.createOscillator(),gain=audioCtx.createGain();engine.frequency.value=58;engine.type='sine';gain.gain.value=.075;engine.connect(gain);gain.connect(audioGain);engine.start();
 await audioCtx.resume();
}
function syncAudio(){if(audioGain&&audioCtx)audioGain.gain.setTargetAtTime((state.audio&&state.playing&&!document.hidden) ? .14 : 0,audioCtx.currentTime,.18);}
function openSettings(open){$('settings').hidden=!open;$('settings-btn').setAttribute('aria-expanded',String(open));if(open)$('fps-select').focus();}
let previousFocus=null;
function openHelp(open){$('help').hidden=!open;if(open){previousFocus=document.activeElement;$('close-help').focus();}else previousFocus?.focus();}
function capture(){
 renderer.render(scene,camera);const a=document.createElement('a');a.download='筑间-'+(state.night?'蓝调':'日光')+'-'+String(Math.floor(state.time)).padStart(4,'0')+'.png';a.href=renderer.domElement.toDataURL('image/png');a.click();toast('这一刻，已保存为图片');wake();
}
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>focusView(el.dataset.view)));
document.querySelectorAll('[data-focus]').forEach(el=>el.addEventListener('click',()=>focusView(el.dataset.focus)));
document.querySelectorAll('[data-speed]').forEach(el=>el.addEventListener('click',()=>{state.speed=Number(el.dataset.speed);document.querySelectorAll('[data-speed]').forEach(b=>{const on=b===el;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});toast('时间流速 · '+state.speed+'×');wake();}));
$('play-btn').onclick=togglePlay;$('day-btn').onclick=()=>changeLight(false);$('night-btn').onclick=()=>changeLight(true);
$('reset-btn').onclick=()=>focusView('overview',true);$('back-btn').onclick=()=>focusView('overview');$('labels-btn').onclick=toggleLabels;
$('orbit-btn').onclick=()=>{state.orbit=!state.orbit;$('orbit-btn').setAttribute('aria-pressed',String(state.orbit));if(TEST&&state.orbit)testEndFrame=state.frames+36;wake();};
$('capture-btn').onclick=capture;$('help-btn').onclick=()=>openHelp(true);$('close-help').onclick=$('help-done').onclick=()=>openHelp(false);
$('settings-btn').onclick=()=>openSettings($('settings').hidden);$('close-settings').onclick=()=>openSettings(false);
$('fps-select').onchange=e=>{state.cap=TEST?15:Number(e.target.value);toast(TEST?'实测模式保持 15 FPS 上限':'帧率上限已设为 '+state.cap+' FPS');wake();};
$('quality-select').onchange=e=>{setQuality(e.target.value);toast('已切换为'+({low:'轻量',balanced:'均衡',high:'精细'}[state.quality])+'画面');};
$('audio-switch').onchange=async e=>{try{if(e.target.checked)await createAudio();state.audio=e.target.checked;syncAudio();}catch(err){e.target.checked=false;state.audio=false;toast(err.message);}};
$('fullscreen-btn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前窗口不支持全屏，可在 Chrome 中打开');}};
$('help').addEventListener('click',e=>{if(e.target===$('help'))openHelp(false);});
document.addEventListener('pointerdown',e=>{if(!$('settings').hidden&&!$('settings').contains(e.target)&&!$('settings-btn').contains(e.target))openSettings(false);});
const pointers=new Map();let dragMoved=0,pinchDistance=0;
const canvas=renderer.domElement;
canvas.addEventListener('pointerdown',e=>{$('world').focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});dragMoved=0;state.orbit=false;$('orbit-btn').setAttribute('aria-pressed','false');if(pointers.size===2){const values=[...pointers.values()];pinchDistance=Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y);}});
canvas.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;const last=pointers.get(e.pointerId),dx=e.clientX-last.x,dy=e.clientY-last.y;dragMoved+=Math.abs(dx)+Math.abs(dy);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){const values=[...pointers.values()],d=Math.hypot(values[0].x-values[1].x,values[0].y-values[1].y);if(pinchDistance>0)cam.wantedDistance=clamp(cam.wantedDistance*pinchDistance/Math.max(d,1),18,210);pinchDistance=d;}
 else{cam.wantedYaw-=dx*.005;cam.wantedPitch=clamp(cam.wantedPitch+dy*.0035,.15,1.04);}wake();
});
function endPointer(e){pointers.delete(e.pointerId);if(pointers.size<2)pinchDistance=0;}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);
canvas.addEventListener('wheel',e=>{e.preventDefault();cam.wantedDistance=clamp(cam.wantedDistance*Math.exp(clamp(e.deltaY,-140,140)*.0012),18,210);wake();},{passive:false});
const raycaster=new THREE.Raycaster(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-G),hitPoint=new THREE.Vector3();
canvas.addEventListener('dblclick',e=>{raycaster.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);if(raycaster.ray.intersectPlane(groundPlane,hitPoint)){if(hitPoint.z<-6.8&&hitPoint.x<-3.5)focusView('office');else if(hitPoint.x<-3.5)focusView('pit');else focusView('structure');}});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){openSettings(false);openHelp(false);document.body.classList.remove('clean-ui');return;}
 if(!$('help').hidden){if(e.key==='Tab'){const items=[$('close-help'),$('help-done')],first=items[0],last=items[1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;
 if(document.activeElement.tagName==='BUTTON'&&e.key===' ')return;
 const key=e.key.toLowerCase();
 if(key===' '){e.preventDefault();togglePlay();}else if(key==='r')focusView('overview');else if(key==='l')toggleLabels();else if(key==='p')capture();else if(key==='h')document.body.classList.toggle('clean-ui');else if(key==='?'||key==='/')openHelp(true);
 else if(key==='arrowleft'){e.preventDefault();cam.wantedYaw-=.12;wake();}else if(key==='arrowright'){e.preventDefault();cam.wantedYaw+=.12;wake();}else if(key==='arrowup'){e.preventDefault();cam.wantedPitch=clamp(cam.wantedPitch+.07,.15,1.04);wake();}else if(key==='arrowdown'){e.preventDefault();cam.wantedPitch=clamp(cam.wantedPitch-.07,.15,1.04);wake();}else if(key==='+'||key==='='){cam.wantedDistance=clamp(cam.wantedDistance*.88,18,210);wake();}else if(key==='-'){cam.wantedDistance=clamp(cam.wantedDistance*1.12,18,210);wake();}
});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);cam.wantedDistance=focusData[state.view].distance*screenFactor();wake();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(rafId);clearTimeout(timerId);rafId=timerId=0;lastWall=0;}else wake();syncAudio();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.playing=false;syncPlaying();cancelAnimationFrame(rafId);clearTimeout(timerId);rafId=timerId=0;toast('图形上下文暂时中断，恢复后将继续显示');});
canvas.addEventListener('webglcontextrestored',()=>{renderer.shadowMap.needsUpdate=true;wake();});
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(rafId);clearTimeout(timerId);if(audioCtx)audioCtx.close();});

// Pure mathematical, bounded validation; no extra WebGL frames are rendered.
function rectanglesIntersect(p,q){
 const fx=Math.cos(p.yaw),fz=-Math.sin(p.yaw),sx=Math.sin(p.yaw),sz=Math.cos(p.yaw),dx=(q.x0+q.x1)/2-p.x,dz=(q.z0+q.z1)/2-p.z;
 for(const [ax,az] of [[1,0],[0,1],[fx,fz],[sx,sz]]){const a=2.14*Math.abs(ax*fx+az*fz)+1.15*Math.abs(ax*sx+az*sz),b=(q.x1-q.x0)/2*Math.abs(ax)+(q.z1-q.z0)/2*Math.abs(az);if(Math.abs(dx*ax+dz*az)>=a+b)return false;}return true;
}
function validate(){
 const obstacles=[{name:'pit',x0:-15.6,x1:-3.5,z0:-6.3,z1:5.7},{name:'structure',x0:-.5,x1:11.6,z0:-6.8,z1:4.1},{name:'office',x0:-16.6,x1:-6.1,z0:-11.1,z1:-7.1},{name:'workshop',x0:11.9,x1:16.9,z0:-4.5,z1:3.1},{name:'spoil',x0:-17.15,x1:-13.45,z0:5.55,z1:10.0},{name:'materials',x0:12.75,x1:16.5,z0:7.95,z1:11.10},{name:'crane2',x0:.4,x1:2.6,z0:6.4,z1:8.6}];
 let obstacleHits=0,pairHits=0,workerHits=0,minSeparation=Infinity,samples=0,nonfinite=0,lowestCraneSeparation=Infinity;
 const model=fleet.map(v=>({type:v.type,id:v.id,s:v.s,stop:v.stop,remaining:v.remaining,nextStop:v.nextStop,fill:v.fill,speed:v.speed,travel:0,loads:0}));
 for(let i=0;i<2400;i++){
  advanceFleet(model,.1);const positions=model.map(v=>roadAt(v.s));
  positions.forEach(p=>{for(const obstacle of obstacles)if(rectanglesIntersect(p,obstacle))obstacleHits++;if(!Number.isFinite(p.x+p.z+p.yaw))nonfinite++;});
  if(i%8===0){for(const w of workers){if(w.y>G+2.5)continue;let wx=w.x,wz=w.z;const t=i*.1;if(w.role==='guard')wx+=Math.sin(t*.20+w.phase)*1.15;else if(w.role==='walk')wx+=Math.sin(t*.26+w.phase)*.7;else if(w.role==='carry'&&w.y===G)wz+=Math.sin(t*.27+w.phase)*.42;const box={x0:wx-.30,x1:wx+.30,z0:wz-.30,z1:wz+.30};for(const p of positions)if(rectanglesIntersect(p,box))workerHits++;}}
  for(let a=0;a<positions.length;a++)for(let b=a+1;b<positions.length;b++){const d=Math.hypot(positions[a].x-positions[b].x,positions[a].z-positions[b].z);minSeparation=Math.min(minSeparation,d);if(d<4.5)pairHits++;}
  for(const c of cranes){const pose=cranePose(c,i*.1);if(pose.some(n=>!Number.isFinite(n)))nonfinite++;}
  samples++;
 }
 lowestCraneSeparation=cranes[0].safeY-1.3-(cranes[1].worldBoomY+.8);
 const hopperLandingClearance=cranes[1].targetY-1.865-(roofY+.13),hopperRebarClearance=cranes[1].safeY-1.865-(roofY+1.355);
 return {simulationSeconds:240,samples,vehicleObstacleIntersections:obstacleHits,vehiclePairIntersections:pairHits,vehicleWorkerIntersections:workerHits,minVehicleCenterDistance:Number(minSeparation.toFixed(3)),craneTransitClearance:Number(lowestCraneSeparation.toFixed(3)),hopperLandingClearance:Number(hopperLandingClearance.toFixed(3)),hopperRebarClearance:Number(hopperRebarClearance.toFixed(3)),nonfiniteTransforms:nonfinite,completedUnloads:model.filter(v=>v.type==='dump').map(v=>v.loads),workers:workers.length,passed:obstacleHits===0&&pairHits===0&&workerHits===0&&nonfinite===0&&lowestCraneSeparation>0&&hopperLandingClearance>0&&hopperRebarClearance>0};
}
diagnostics.validation=TEST?validate():null;
function updateReport(){
 diagnostics.frames=state.frames;diagnostics.drawCalls=renderer.info.render.calls;diagnostics.triangles=renderer.info.render.triangles;
 diagnostics.currentFps=frameSample.length?Math.round(1000/(frameSample.reduce((a,b)=>a+b,0)/frameSample.length)):0;
 diagnostics.renderCpuMs=cpuSamples.length?Number((cpuSamples.reduce((a,b)=>a+b,0)/cpuSamples.length).toFixed(2)):0;
 diagnostics.paused=!state.playing;diagnostics.night=state.night;diagnostics.selectedView=state.view;diagnostics.activeFrameCap=state.cap;diagnostics.pixelRatio=renderer.getPixelRatio();diagnostics.geometryCount=renderer.info.memory.geometries;diagnostics.textureCount=renderer.info.memory.textures;diagnostics.benchmark=BENCH;diagnostics.simulationTime=Number(state.time.toFixed(2));diagnostics.fleet=fleet.map(v=>({id:v.id,status:v.stop||'driving',fill:Number(v.fill.toFixed(2)),position:Number(v.s.toFixed(2))}));
 diagnostics.externalResources=performance.getEntriesByType('resource').filter(r=>/^https?:/.test(r.name)&&!r.name.startsWith(location.origin)).length;
 $('test-report').textContent=JSON.stringify(diagnostics,null,2);$('test-report').hidden=!params.has('report');
}
function updateUI(){
 const secs=8*3600+42*60+Math.floor(state.time),h=Math.floor(secs/3600)%24,m=Math.floor(secs/60)%60,s=secs%60;$('timecode').textContent=[h,m,s].map(v=>String(v).padStart(2,'0')).join(':');
 updateReport();$('fps-label').textContent=!state.playing?(TEST?'实测已暂停':'时间已暂停'):(diagnostics.currentFps?diagnostics.currentFps+' FPS':'运行中')+(TEST?' · 低负载':'');
 const notes=['一切井然有序地进行着','塔吊就位，城市继续生长','一铲一方，慢慢筑起未来'];$('activity-text').textContent=notes[Math.floor(state.time/16)%notes.length];
}
function wake(){if(disposed||document.hidden)return;state.dirty=true;if(!rafId&&!timerId){nextFrameTime=0;rafId=requestAnimationFrame(frame);}}
function scheduleFrame(){
 const delay=Math.max(0,nextFrameTime-performance.now()-1.5);
 if(delay>2)timerId=setTimeout(()=>{timerId=0;rafId=requestAnimationFrame(frame);},delay);
 else rafId=requestAnimationFrame(frame);
}
function frame(now){
 rafId=0;if(disposed||document.hidden)return;
 if(now+.15<nextFrameTime){scheduleFrame();return;}
 const interval=1000/state.cap;
 nextFrameTime=nextFrameTime>0&&now-nextFrameTime<interval*3?nextFrameTime+interval:now+interval;
 const start=performance.now(),dt=lastWall?Math.min((now-lastWall)/1000,.09):.016;lastWall=now;
 const animate=state.playing;const delta=animate?dt*state.speed:0;
 state.time+=delta;drawFleet(delta);updateExcavators(state.time);updateCranes(state.time);updateWorkers(state.time);updateDust(state.time);
 beacons.forEach((beacon,i)=>beacon.visible=Math.sin(state.time*3.6+i*1.3)>.0);
 loader.position.x=-12.15+Math.sin(state.time*.7)*.2;loaderBucket.rotation.z=Math.sin(state.time*1.0)*.075;
 updateCamera(dt,TEST);updateMarkers();
 if(state.frames%3===0||state.dirty)renderer.shadowMap.needsUpdate=true;
 renderer.render(scene,camera);state.frames++;state.drawn++;state.dirty=false;
 if(lastDraw&&animate){const ms=now-lastDraw;if(ms<300){frameSample.push(ms);if(frameSample.length>24)frameSample.shift();}}lastDraw=now;
 cpuSamples.push(performance.now()-start);if(cpuSamples.length>24)cpuSamples.shift();
 if(now-uiTime>700||state.frames<3){updateUI();uiTime=now;}
 if(TEST&&state.frames>=testEndFrame&&(state.playing||state.orbit)){state.playing=false;state.orbit=false;testCompleted=true;$('orbit-btn').setAttribute('aria-pressed','false');syncPlaying();updateUI();toast('低负载实测已暂停 · 未持续占用渲染');}
 if(state.frames===1){$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,720);}
 if(state.playing||state.orbit||transitioning)scheduleFrame();
 else{updateUI();lastWall=0;nextFrameTime=0;}
}
if(TEST&&params.has('time')){const snapshotTime=clamp(Number(params.get('time'))||0,0,240);for(let t=0;t<snapshotTime;t+=.1)advanceFleet(fleet,Math.min(.1,snapshotTime-t));state.time=snapshotTime;}
if(TEST&&params.has('still'))state.playing=false;
if(params.has('paused'))state.playing=false;
if(TEST&&Object.hasOwn(focusData,params.get('view')))state.view=params.get('view');
resetCameraImmediate();updateCamera(.016,true);syncPlaying();if(TEST)setQuality('balanced');if(state.view!=='overview')focusView(state.view);wake();
})();
