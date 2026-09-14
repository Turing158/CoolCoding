/* 湖畔花园的四季来信 — all artwork, geometry, textures and audio are procedural.
 * The unwrapped year is deliberately never reset. Seasonal envelopes are C1
 * periodic functions; instance offsets remain fixed for the entire garden life.
 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
const mix = (a,b,t) => a+(b-a)*t;
const fract = x => x-Math.floor(x);
const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const pulse = (p,c,w) => smooth(Math.cos(TAU*w),1,Math.cos(TAU*(p-c)));
const damp = (a,b,r,dt) => mix(a,b,1-Math.exp(-r*dt));
let seed = 27182818;
const rand = () => {seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
const rnd = (a,b) => mix(a,b,rand());
const choose = a => a[Math.floor(rand()*a.length)];
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const query = new URLSearchParams(location.search);
const isTest = query.get('test')==='1';
const initialFPS = clamp(Number(query.get('fps'))||60,1,60);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {year:isTest&&query.has('season')?Number(query.get('season')):.125,yearVelocity:1/480,target:null,speed:1,weather:.5,weatherTarget:.5,day:isTest&&query.has('day')?Number(query.get('day')):.4,time:isTest&&query.has('time')?Number(query.get('time')):0,paused:query.get('paused')==='1',ice:0,fps:initialFPS,quiet:false,eco:initialFPS<30,frames:0,actualFPS:0,manualEcology:false};
const cameraLimits = {minRadius:4,maxRadius:36,panX:9.5,panZ:7.5};
const controls = {azimuth:.68,polar:.88,radius:24,targetAzimuth:.68,targetPolar:.88,targetRadius:24,targetX:0,targetZ:0,lastInput:performance.now(),dragging:false,top:false};
let renderer,scene,camera,frameTimer=0,rafID=0,lastFrame=0,lastUI=0,lastShadow=-10,needRender=true,disposed=false;
let sun,hemi,fillLight,windowLight,nightWindow,materials={},yearParams={},drawMs=0;
const view=$('garden-view');
const matrix=new THREE.Matrix4(),dummy=new THREE.Object3D(),tempColor=new THREE.Color(),camTarget=V(0,.8,0),raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
const up=V(0,1,0),tmpV=V(),tmpQ=new THREE.Quaternion();
const uniforms = {uYear:{value:state.year},uTime:{value:0},uDay:{value:1},uNight:{value:0},uSnow:{value:0},uIce:{value:0},uMelt:{value:0},uWeather:{value:.5},uAutumn:{value:0},uMist:{value:0}};
const buckets = new Map(), snowPatches=[], trees=[], lamps=[], glows=[], people=[], knobTargets=[], knobRotors=[], clouds=[];
const boxGeo=new THREE.BoxGeometry(1,1,1), cylinderGeo=new THREE.CylinderGeometry(.5,.5,1,12), coneGeo=new THREE.ConeGeometry(.5,1,8);
const shadowCasters=[];

function seasonAt(p){
 const warm=.5+.5*Math.cos(TAU*(p-.36));
 return {temperature:7.5+15*Math.cos(TAU*(p-.36)),warm,
  leaf:smooth(.28,.72,.5+.5*Math.cos(TAU*(p-.39))),
  blossom:pulse(p,.125,.17),flowers:pulse(p,.19,.22),summer:pulse(p,.385,.245),
  autumn:pulse(p,.65,.235),litter:pulse(p,.725,.23),
  snow:pulse(p,.875,.248),ice:pulse(p,.892,.191),frost:pulse(p,.826,.255),
  melt:pulse(p,.028,.148),mist:pulse(p,.73,.28),
  butterflies:pulse(p,.33,.27),birds:clamp(pulse(p,.20,.16)+pulse(p,.64,.17)),
  fireflies:pulse(p,.42,.23),dayLength:.50+.105*Math.cos(TAU*(p-.33)),
  solarHeight:.70+.25*Math.cos(TAU*(p-.33))};
}
function material(color,opts={}){return new THREE.MeshStandardMaterial({color,roughness:.88,metalness:0,...opts});}
function bucket(kind='box',mat=null){
 const key=kind+(mat?mat.uuid:'world');
 if(!buckets.has(key))buckets.set(key,{geometry:kind==='cylinder'?cylinderGeo:kind==='cone'?coneGeo:boxGeo,material:mat||materials.world,items:[]});
 return buckets.get(key);
}
function box(x,y,z,w,h,d,color,rot=0,mat=null){bucket('box',mat).items.push({x,y,z,w,h,d,color,ry:rot});}
function cyl(x,y,z,w,h,d,color,mat=null){bucket('cylinder',mat).items.push({x,y,z,w,h,d,color});}
function beam(a,b,thick,color,depth=thick){const mid=a.clone().add(b).multiplyScalar(.5);tmpV.copy(b).sub(a);const len=tmpV.length();const q=new THREE.Quaternion().setFromUnitVectors(up,tmpV.normalize());bucket().items.push({x:mid.x,y:mid.y,z:mid.z,w:thick,h:len,d:depth,color,q});}
function flushBuckets(){
 for(const b of buckets.values()){
  if(!b.items.length)continue;
  const m=new THREE.InstancedMesh(b.geometry,b.material,b.items.length);m.castShadow=true;m.receiveShadow=true;
  b.items.forEach((a,i)=>{dummy.position.set(a.x,a.y,a.z);dummy.scale.set(a.w,a.h,a.d);dummy.quaternion.identity();if(a.q)dummy.quaternion.copy(a.q);else dummy.rotation.y=a.ry||0;dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);m.setColorAt(i,tempColor.set(a.color));});
  m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;m.computeBoundingSphere();scene.add(m);shadowCasters.push(m);
 }
}
function directBox(group,x,y,z,w,h,d,col){const m=new THREE.Mesh(boxGeo,material(col));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=false;m.receiveShadow=true;group.add(m);return m;}
function mergedBoxes(parts,mat=materials.figure){
 const positions=[],normals=[],colors=[];
 const g=boxGeo.toNonIndexed(),p=g.attributes.position,n=g.attributes.normal;
 const v=V(),normal=V(),q=new THREE.Quaternion();
 for(const a of parts){tempColor.set(a.color);q.setFromEuler(new THREE.Euler(a.rx||0,a.ry||0,a.rz||0));
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).multiply(V(a.w,a.h,a.d)).applyQuaternion(q).add(V(a.x,a.y,a.z));positions.push(v.x,v.y,v.z);normal.fromBufferAttribute(n,i).applyQuaternion(q);normals.push(normal.x,normal.y,normal.z);colors.push(tempColor.r,tempColor.g,tempColor.b);}
 }
 g.dispose();const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeBoundingSphere();return new THREE.Mesh(geo,mat);
}
function label(text,x,y,z,w,h,{bg='#f3edd7',fg='#536e55',size=45,rotation=0,sub='',font='serif'}={}){
 const c=document.createElement('canvas');c.width=512;c.height=192;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,512,192);g.strokeStyle=fg;g.globalAlpha=.3;g.strokeRect(12,12,488,168);g.globalAlpha=1;g.textAlign='center';g.textBaseline='middle';g.fillStyle=fg;g.font=`${size}px ${font==='serif'?'Georgia, "SimSun", serif':'"Segoe UI", sans-serif'}`;g.fillText(text,256,sub?76:96);if(sub){g.font='18px Georgia, serif';g.fillText(sub,256,131);}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,roughness:.88}));m.position.set(x,y,z);m.rotation.y=rotation;scene.add(m);return m;
}
function shadowBlob(x,z,rx,rz,y=-1.15,opacity=.16){
 const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,3,32,32,31);gr.addColorStop(0,`rgba(45,62,37,${opacity})`);gr.addColorStop(.6,`rgba(45,62,37,${opacity*.55})`);gr.addColorStop(1,'rgba(45,62,37,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);const m=new THREE.Mesh(new THREE.PlaneGeometry(rx*2,rz*2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));m.rotation.x=-PI/2;m.position.set(x,y,z);scene.add(m);
}
function woodTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=512;const g=c.getContext('2d');g.fillStyle='#dac7a4';g.fillRect(0,0,512,512);
 for(let i=0;i<400;i++){const y=rand()*512;g.beginPath();g.moveTo(0,y);g.bezierCurveTo(160,y+rnd(-4,4),330,y+rnd(-5,5),512,y+rnd(-2,2));g.strokeStyle=rand()>.4?`rgba(137,104,65,${rnd(.015,.09)})`:`rgba(255,248,219,${rnd(.1,.25)})`;g.lineWidth=rnd(.2,1.2);g.stroke();}
 for(let i=0;i<9;i++){const yy=28+i*57;g.fillStyle='rgba(107,93,62,.035)';g.fillRect(0,yy,512,1);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.anisotropy=4;return t;
}

const CEL=.28, lakeCenter={x:1.0,z:-.05}, islandCenter={x:1.0,z:-.22};
function lakeField(x,z){const dx=(x-1)/3.55,dz=(z+.05)/2.69;return dx*dx+dz*dz+.065*Math.sin(x*2.0+z*.8)+.038*Math.sin(z*3.1-x*.4);}
function islandField(x,z){return ((x-1)/.87)**2+((z+.22)/.67)**2;}
function inLake(x,z){return lakeField(x,z)<1&&islandField(x,z)>1;}
function inStream(x,z){return z< -1.57&&z> -4.9&&Math.abs(x-(-1.49+.28*Math.sin(z*2.0)))<.24;}
function inTray(x,z,margin=0){const ax=Math.abs(x),az=Math.abs(z);return ax<7.0-margin&&az<5.04-margin&&(ax<6.55-margin||az<4.6-margin||((ax-(6.55-margin))**2+(az-(4.6-margin))**2<.45**2));}
const obstacles=[{x:-4.18,z:-2.65,rx:1.37,rz:1.11},{x:-4.46,z:1.13,rx:1.42,rz:1.14},{x:4.36,z:-3.46,rx:1.17,rz:.86}];
function inBuilding(x,z,margin=0){return obstacles.some(a=>Math.abs(x-a.x)<a.rx+margin&&Math.abs(z-a.z)<a.rz+margin);}
const outerNodes=[[-1.8,3.66],[-4.2,3.57],[-6.14,3.1],[-6.25,.0],[-6.04,-2.35],[-5.78,-4.24],[-3.12,-4.35],[-.55,-4.24],[2.26,-4.32],[5.94,-4.30],[6.22,-1.9],[6.18,.7],[5.64,3.51],[2.85,3.71],[.15,3.73]];
const outerCurve=new THREE.CatmullRomCurve3(outerNodes.map(([x,z])=>V(x,.135,z)),true,'catmullrom',.18);
const pathSamples=outerCurve.getSpacedPoints(470);
const spurLines=[[-4.5,3.6,-4.5,2.0],[-6.1,-1.42,-4.15,-1.42],[-2.2,3.65,-2.55,1.38],[-2.55,1.38,-2.39,.08],[-2.39,.08,-1.95,.02],[4.4,-2.3,5.8,-2.1]];
function pathDistance(x,z){let d=100;for(const p of pathSamples){const dd=(x-p.x)**2+(z-p.z)**2;if(dd<d)d=dd;}for(const a of spurLines){const dx=a[2]-a[0],dz=a[3]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));d=Math.min(d,(x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2);}return Math.sqrt(d);}
const terrainData=[],grassData=[],flowerData=[],leafData=[],blossomData=[],litterData=[];

function makeDesk(){
 const oak=material('#e5d1aa',{map:woodTexture(),roughness:.72});
 box(0,-1.51,0,21.8,.56,16.6,'#ffffff',0,oak);
 box(0,-1.83,0,21.55,.12,16.35,'#c7b591');
 for(const x of [-9,9])for(const z of [-6.7,6.7])box(x,-2.5,z,.45,1.2,.5,'#ccbb9b');
 shadowBlob(.35,.45,10,7.4,-1.214,.30);
 // A pale oak tray: several short courses keep a crisp miniature silhouette.
 box(0,-.64,0,14.54,.57,10.63,'#a59576');
 box(0,-.37,0,14.76,.13,10.86,'#e2d2ae');
 box(0,-.84,0,14.4,.12,10.47,'#797b62');
 box(0,-.74,0,14.65,.06,10.7,'#c2b08b');
 for(const x of [-7.22,7.22])box(x,-.11,0,.15,.42,10.76,'#e6d7b8');
 for(const z of [-5.28,5.28])box(0,-.11,z,14.4,.42,.15,'#e6d7b8');
 for(let i=0;i<36;i++){const x=-6.9+i*.39;box(x,-.55,5.324,.025,.32,.012,'#b6a581');}
 label('湖 畔 花 园',0,-.56,5.34,2.05,.35,{bg:'#e0d0aa',fg:'#6c7358',size:41,sub:'L A K E S I D E   ·   2 0 2 6'});
 // The room is only suggested: a clear window, slender mullions, linen curtain.
 const windowMat=material('#e3ece0',{roughness:.35,emissive:'#dbe9d5',emissiveIntensity:.28,transparent:true,opacity:.65});
 nightWindow=windowMat;
 box(-5.5,3.05,-7.45,8.4,7.35,.06,'#ffffff',0,windowMat);
 const frameMat=material('#f0ecdf',{roughness:.8});
 for(const x of [-9.78,-5.5,-1.22])box(x,3.05,-7.28,.16,7.7,.23,'#ffffff',0,frameMat);
 for(const y of [-.73,2.9,6.84])box(-5.5,y,-7.28,8.75,.15,.24,'#ffffff',0,frameMat);
 box(-5.5,-.77,-7.12,9,.18,.77,'#ddd1b5');
 const outside=material('#c0d0af',{transparent:true,opacity:.2,roughness:1});
 for(let i=0;i<24;i++){const x=rnd(-9.5,-1.5),y=rnd(-.6,.4);box(x,y,-7.64,rnd(.3,.8),rnd(.3,1.4),.1,'#ffffff',0,outside);}
 const curtain=material('#f5f2e6',{transparent:true,opacity:.55,side:THREE.DoubleSide});
 for(let i=0;i<8;i++)box(-10.25+i*.18,3.05,-7.12+Math.sin(i*1.8)*.13,.21,7.9,.06,'#ffffff',0,curtain);
 // Books and letters on the real desk.
 const books=[{x:-8.55,z:3.47,w:2.05,d:1.5,h:.27,c:'#748e7f',r:-.16},{x:-8.43,z:3.42,w:1.87,d:1.39,h:.26,c:'#cba998',r:.06},{x:-8.55,z:3.37,w:1.74,d:1.34,h:.21,c:'#dfd3b4',r:-.10}];
 let yy=-1.21;for(const b of books){box(b.x,yy+b.h/2,b.z,b.w,b.h,b.d,'#ede5cf',b.r);box(b.x,yy+.02,b.z,b.w+.06,.045,b.d+.04,b.c,b.r);box(b.x,yy+b.h,b.z,b.w+.06,.045,b.d+.04,b.c,b.r);box(b.x-Math.cos(b.r)*b.w/2,yy+b.h/2,b.z+Math.sin(b.r)*b.w/2,.06,b.h,b.d,b.c,b.r);yy+=b.h+.015;}
 const cover=label('草木集',-8.55,yy+.03,3.34,1.3,.95,{bg:'#dfd3b4',fg:'#6e7e61',size:49,sub:'POEMS FOR SLOW DAYS'});cover.rotation.set(-PI/2,0,.1);
 const post=label('DEAR, THE SEASONS',-6.96,-1.175,6.76,2.05,1.26,{bg:'#f3ecdb',fg:'#8c9075',size:23,sub:'Wish you were here.'});post.rotation.set(-PI/2,0,-.20);
 box(-6.31,-1.156,6.5,.36,.018,.39,'#b1bea0',.20);box(-6.31,-1.14,6.5,.25,.016,.27,'#eee6cd',.20);
 // Open poetry book, small pressed flower and a pencil.
 box(-3.92,-1.10,6.45,2.30,.15,1.53,'#afb895',.08);box(-4.48,-.998,6.45,1.08,.075,1.42,'#f6efdb',.08);box(-3.37,-.998,6.54,1.08,.075,1.42,'#f6efdb',.08);
 for(let k=0;k<8;k++){box(-4.48,-.954,6.0+k*.12,.65,.006,.013,'#c5c5af',.08);box(-3.37,-.954,6.09+k*.12,.69,.006,.013,'#c5c5af',.08);}
 beam(V(-3.24,-.94,6.25),V(-3.64,-.935,6.79),.013,'#889775');for(let i=0;i<6;i++)box(-3.32-i*.045,-.927,6.32+i*.063,.13,.012,.048,i%2?'#d7b2ab':'#a5b393',.5);
 beam(V(-2.23,-1.16,6.15),V(-1.78,-1.16,7.48),.048,'#819078');
 // Tea, a faceted ceramic vase, and stems reaching toward the window.
 makeCup(6.9,-1.19,5.65,1.2,'#ebe8d8');
 cyl(8.34,-1.15,-2.35,1.28,.12,1.28,'#ddd0b1');
 cyl(8.34,-.74,-2.35,.90,.77,.90,'#adb9a0');cyl(8.34,-.20,-2.35,.54,.37,.54,'#b6c1a9');cyl(8.34,-.005,-2.35,.58,.06,.58,'#d1d6c2');cyl(8.34,.022,-2.35,.39,.009,.39,'#697461');
 for(let k=0;k<7;k++){const dx=rnd(-.8,.8),dz=rnd(-.45,.45),h=rnd(1.2,2.35);beam(V(8.34,-.02,-2.35),V(8.34+dx,h,-2.35+dz),.033,'#839375');for(let j=0;j<3;j++){const t=.4+j*.15;box(8.34+dx*t+(j%2?.11:-.11),h*t,-2.35+dz*t,.27,.075,.12,'#9bad88',k*.8);}
  for(let j=0;j<6;j++)box(8.34+dx+rnd(-.15,.15),h+rnd(-.09,.14),-2.35+dz+rnd(-.15,.15),.17,.13,.17,choose(['#e5c7ae','#e2bdae','#f3ddc2']));
 }
 makePhysicalKnobs();
}
function makeCup(x,y,z,s=1,col='#ece7d5'){
 cyl(x,y+.03*s,z,.87*s,.055*s,.87*s,col);cyl(x,y+.18*s,z,.52*s,.30*s,.52*s,col);cyl(x,y+.337*s,z,.44*s,.017*s,.44*s,'#71523a');cyl(x,y+.347*s,z,.405*s,.007*s,.405*s,'#9c7851');
 const handle=new THREE.Mesh(new THREE.TorusGeometry(.15*s,.047*s,6,14),material(col));handle.position.set(x+.31*s,y+.20*s,z);scene.add(handle);
}
function makePhysicalKnobs(){
 box(2.20,-1.065,6.62,4.35,.27,1.45,'#b7b596');box(2.20,-.911,6.62,4.20,.055,1.31,'#e5dfc8');
 ['speed','season','weather'].forEach((name,i)=>{const x=.92+i*1.27,z=6.49;cyl(x,-.85,z,.73,.10,.73,'#a7af92');
  const rotor=new THREE.Group();rotor.position.set(x,-.71,z);const cap=new THREE.Mesh(new THREE.CylinderGeometry(.31,.33,.20,32),material('#f1ebd8',{roughness:.55}));cap.castShadow=true;rotor.add(cap);directBox(rotor,0,.106,-.205,.043,.017,.12,'#6d8569');scene.add(rotor);knobTargets.push(cap);cap.userData.dial=name;knobRotors.push({name,rotor});
  for(let j=0;j<11;j++){const a=-PI*.77+j*(PI*1.54/10);box(x+Math.sin(a)*.43,-.875,z-Math.cos(a)*.43,.018,.013,.052,'#8d9c7d',-a);}
  const text=label(['流 年','时 节','风 雨'][i],x,-.874,7.075,.69,.22,{bg:'#e5dfc8',fg:'#63795a',size:50});text.rotation.x=-PI/2;
 });
}

function buildTerrain(){
 for(let ix=-24;ix<=24;ix++)for(let iz=-17;iz<=17;iz++){
  const x=ix*CEL,z=iz*CEL;if(!inTray(x,z))continue;
  if(inLake(x,z)||inStream(x,z))continue;
  const isIsland=islandField(x,z)<1;const path=pathDistance(x,z)<.27&&!isIsland;
  const shore=lakeField(x,z)<1.16||Math.abs(islandField(x,z)-1)<.45;
  const height=isIsland?.18:.09+rnd(-.014,.014);
  if(path){box(x,height-.052,z,CEL*.98,.20,CEL*.98,choose(['#d6ccb0','#ded4ba','#c9c5a6','#e1d8bd']));if(rand()<.05)box(x+.06,height+.052,z+.03,.015,.005,.17,'#b2b799',.4);}
  else terrainData.push({x,y:height-.061,z,w:CEL*.998,h:.20,d:CEL*.998,seed:rand(),offset:rnd(-.045,.045),shore:shore?1:0,color:shore?choose(['#b1b798','#bebca0','#cac5a7']):choose(['#9db383','#a7ba8a','#aec091','#8fa878','#b6c49a'])});
  if(!inBuilding(x,z,.04)&&rand()<.69)snowPatches.push({x,y:height+.042,z,w:CEL*1.04,h:1,d:CEL*1.04,seed:rand(),threshold:shore?.34:rnd(.08,.44),shade:clamp((z+5)/10+.2*rand())});
  if(!path&&!shore&&!inBuilding(x,z,.17)&&rand()<.59){const cnt=rand()>.65?3:2;for(let k=0;k<cnt;k++)grassData.push({x:x+rnd(-.10,.10),y:height+.055,z:z+rnd(-.1,.1),w:rnd(.025,.04),h:rnd(.07,.19),d:rnd(.03,.045),seed:rand(),offset:rnd(-.04,.04),shore:0,color:choose(['#91aa70','#73905f','#a2b37b','#879f6b'])});}
  if(path&&rand()<.51){for(let j=0;j<2;j++)litterData.push({x:x+rnd(-.12,.12),y:height+.061,z:z+rnd(-.12,.12),w:rnd(.06,.12),h:.012,d:rnd(.035,.07),seed:rand(),offset:rnd(-.035,.035),color:choose(['#c09a4f','#bb8055','#b96850','#d2b169']),ry:rand()*PI});}
 }
 // Pebbled banks and reeds are broken into individual square pieces.
 for(let i=0;i<270;i++){const a=rnd(0,TAU),x=1+Math.cos(a)*rnd(3.45,3.64),z=-.05+Math.sin(a)*rnd(2.63,2.77);if(lakeField(x,z)>1.15||!inTray(x,z,.15)||inBuilding(x,z))continue;const s=rnd(.07,.18);box(x,.04,z,s,s*.75,s,choose(['#c5c7ac','#b6bfa5','#d5d2b5','#a4b09a']));}
 for(let i=0;i<120;i++){const a=rnd(0,TAU);if(a>2.4&&a<3.5)continue;const x=1+Math.cos(a)*3.49,z=-.05+Math.sin(a)*2.68;if(!inTray(x,z,.2)||inBuilding(x,z)||lakeField(x,z)<.94||lakeField(x,z)>1.07)continue;grassData.push({x,y:.06,z,w:.028,h:rnd(.25,.54),d:.03,seed:rand(),offset:rnd(-.03,.03),color:choose(['#86956e','#9ca777','#aaba8c'])});if(rand()<.4)box(x,.38,z,.055,.15,.06,'#8c8460');}
 // Low hand-painted pickets at the back and around the entrance.
 for(let i=0;i<25;i++){const x=-6.75+i*.56;box(x,.37,-4.86,.08,.60,.09,'#d7dbc0');snowPatches.push({x,y:.68,z:-4.86,w:.14,h:1,d:.17,seed:rand(),threshold:.09,shade:.55});}
 for(const y of [.23,.51])box(0,y,-4.86,13.5,.055,.075,'#d4d9bd');
 for(let i=0;i<15;i++){const z=-4.2+i*.58;box(6.73,.33,z,.075,.53,.08,'#d0d6b7');}
 for(const y of [.20,.45])box(6.73,y,-.15,.07,.05,8.4,'#ced6b4');
}

function roof(x,y,z,w,d,height,color){
 const steps=Math.round(w/.25),half=w/2;
 for(let i=0;i<steps;i++){const xx=-half+(i+.5)*w/steps;const rise=(1-Math.abs(xx)/half)*height;
  for(let j=0;j<Math.ceil(d/.28);j++){const zz=-d/2+(j+.5)*d/Math.ceil(d/.28);box(x+xx,y+rise,z+zz,w/steps+.018,.13,d/Math.ceil(d/.28)+.022,choose([color,color,'#a5b19a','#95a993']));snowPatches.push({x:x+xx,y:y+rise+.07,z:z+zz,w:w/steps+.022,h:1,d:d/Math.ceil(d/.28)+.026,seed:rand(),threshold:rnd(.02,.16),shade:xx>0?.9:.2});}
 }
 box(x,y+height+.06,z,.12,.14,d+.1,'#81977e');
}
function makeBookhouse(){
 const x=-4.17,z=-2.64;
 box(x,.21,z,2.72,.23,2.16,'#a39777');
 box(x,1.10,z,2.38,1.65,1.87,'#c4b293');
 for(let i=0;i<13;i++){const yy=.40+i*.121;box(x,yy,z+.941,2.4,.02,.019,'#b49e7e');box(x+1.198,yy,z,.014,.02,1.88,'#b29a77');}
 for(const xx of [-1.21,1.21])for(const zz of [-.96,.96])box(x+xx,1.14,z+zz,.13,1.87,.13,'#8f8d6f');
 box(x+.45,1.08,z+.964,.52,1.33,.055,'#778a71');box(x+.43,1.42,z+1.00,.36,.48,.023,'#dcc791');cyl(x+.62,1.04,z+1.015,.06,.05,.06,'#d7bb7b');
 addWindow(x-.57,1.29,z+.967,.75,.73,0);
 addWindow(x+1.213,1.30,z+.04,.94,.76,PI/2);
 roof(x,2.02,z,2.94,2.36,.78,'#849b89');
 box(x-.71,2.74,z-.54,.35,.76,.36,'#c4aa8b');box(x-.71,3.16,z-.54,.47,.12,.47,'#b5947c');snowPatches.push({x:x-.71,y:3.24,z:z-.54,w:.52,h:1,d:.50,seed:.2,threshold:.02,shade:.8});
 box(x,.27,z+1.20,2.76,.19,.49,'#b4a47f');box(x,.16,z+1.51,2.82,.08,.20,'#c5b18c');
 for(let i=0;i<15;i++)box(x-1.26+i*.18,.37,z+1.19,.165,.027,.48,'#c7b693');
 label('湖畔书屋',x-.25,1.97,z+1.063,1.48,.31,{bg:'#e7dfc7',fg:'#566d55',size:44,sub:''});
 // A little outdoor bookcase, the pages remaining through all four seasons.
 box(x-1.11,.77,z+1.1,.58,.81,.36,'#81896a');for(const yy of [.42,.69,.96,1.14])box(x-1.11,yy,z+1.16,.61,.035,.40,'#e0d3ad');
 for(let row=0;row<2;row++)for(let k=0;k<6;k++)box(x-1.34+k*.088,.53+row*.28,z+1.18,.057,rnd(.13,.22),.21,choose(['#b88c76','#839d8d','#cebb92','#98a47e','#8d9998']));
 addLamp(x+.97,1.54,z+1.07,.19);
 makeBench(-2.95,-1.42,.65,0);
}
function addWindow(x,y,z,w,h,rot){
 const n=V(Math.sin(rot),0,Math.cos(rot)),right=V(Math.cos(rot),0,-Math.sin(rot));
 box(x,y,z,w+.13,h+.13,.067,'#f2e2be',rot);
 const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),materials.window);m.position.set(x+n.x*.046,y,z+n.z*.046);m.rotation.y=rot;scene.add(m);
 for(const side of [-1,1])box(x+right.x*w*.49*side+n.x*.067,y,z+right.z*w*.49*side+n.z*.067,.04,h,.027,'#839580',rot);
 box(x+n.x*.074,y,z+n.z*.074,.036,h,.038,'#91a28a',rot);box(x+n.x*.075,y,z+n.z*.075,w,.038,.04,'#91a28a',rot);
 for(let i=0;i<3;i++)box(x+right.x*(-w*.33+i*w*.26),y-h*.24,z+right.z*(-w*.33+i*w*.26),.08,.22,.019,choose(['#b9b18e','#ae9984','#78918b']),rot);
 addGlow(x+n.x*.13,y,z+n.z*.13,w*1.85,h*1.9,.25);
}
function makeGlasshouse(){
 const x=-4.47,z=1.15,w=2.7,d=1.90,base=.25,wall=1.39,ridge=2.40;
 box(x,.16,z,w+.17,.19,d+.2,'#b5b696');
 for(let i=0;i<13;i++)box(x-w/2+.10+i*.207,.274,z,.19,.044,d,'#d1c6a6');
 const frame='#849f8d',glass=material('#d4e5d7',{transparent:true,opacity:.22,roughness:.16,metalness:.13,side:THREE.DoubleSide,depthWrite:false});
 const wallmat=glass;
 for(const zz of [-d/2,d/2]){
  box(x,base+wall/2,z+zz,w,wall,.025,'#ffffff',0,wallmat);
  for(let i=0;i<=5;i++)box(x-w/2+i*w/5,base+wall/2,z+zz,.043,wall+.09,.050,frame);
  for(const yy of [base,base+.64,base+wall])box(x,yy,z+zz,w+.06,.045,.054,frame);
 }
 for(const xx of [-w/2,w/2]){
  box(x+xx,base+wall/2,z,.025,wall,d,'#ffffff',0,wallmat);
  for(let j=0;j<=3;j++)box(x+xx,base+wall/2,z-d/2+j*d/3,.05,wall,.045,frame);
  for(const yy of [base,base+.65,base+wall])box(x+xx,yy,z,.05,.045,d,frame);
 }
 // Roof glazing uses the same persistent panes, with raised frame ribs.
 const rise=ridge-(base+wall),half=d/2,len=Math.hypot(half,rise);
 for(const sign of [-1,1]){
  const g=new THREE.Mesh(new THREE.PlaneGeometry(w,len),glass);g.position.set(x,(ridge+base+wall)/2,z+sign*d/4);g.rotation.x=sign<0?-PI/2+Math.atan2(rise,half):-PI/2-Math.atan2(rise,half);scene.add(g);
  for(let j=0;j<=5;j++){const xx=x-w/2+j*w/5;beam(V(xx,base+wall,z+sign*d/2),V(xx,ridge,z),.047,frame);}
  beam(V(x-w/2,(ridge+base+wall)/2,z+sign*d/4),V(x+w/2,(ridge+base+wall)/2,z+sign*d/4),.045,frame);
  for(let i=0;i<12;i++)snowPatches.push({x:x-w/2+(i+.5)*w/12,y:base+wall+.042,z:z+sign*d/2,w:w/12,h:1,d:.17,seed:rand(),threshold:rnd(.025,.13),shade:sign>0?.7:.2});
 }
 beam(V(x-w/2-.1,ridge,z),V(x+w/2+.1,ridge,z),.075,frame);
 for(const xx of [-w/2,w/2]){beam(V(x+xx,base+wall,z-d/2),V(x+xx,ridge,z),.056,frame);beam(V(x+xx,base+wall,z+d/2),V(x+xx,ridge,z),.056,frame);}
 // Open door and tiered planters, visible through the translucent glass.
 box(x+.18,.91,z+d/2+.024,.045,1.33,.06,frame);box(x+.71,.91,z+d/2+.024,.045,1.33,.06,frame);box(x+.445,1.56,z+d/2+.024,.57,.055,.06,frame);
 box(x+.62,.90,z+d/2+.16,.48,1.26,.031,'#d5e2ce',-.53,glass);box(x+.37,.96,z+d/2+.277,.035,.22,.039,'#9e9b70');
 for(const zz of [-.53,.39]){box(x,.70,z+zz,2.32,.08,.36,'#ada786');for(let i=0;i<8;i++){const px=x-1+i*.29;makePot(px,.75,z+zz,.14,choose(['#c6a087','#9cac88','#c4b899']));for(let j=0;j<3;j++)flowerData.push({x:px+rnd(-.065,.065),y:.99+rnd(0,.13),z:z+zz+rnd(-.08,.08),w:.07,h:.07,d:.07,seed:rand(),offset:rnd(-.025,.025),center:.24,width:.34,color:choose(['#edccab','#d3b4c7','#f0deac']),kind:0});}}
 label('THE GLASS GARDEN',x-.25,1.72,z+d/2+.052,1.38,.22,{bg:'#e7ead7',fg:'#647d65',size:29});
 addLamp(x,1.98,z,.23);makePot(x-1.45,.12,z+1.19,.30,'#cba88b');makePot(x-1.34,.12,z+1.56,.23,'#bfa686');
}
function makeCafe(){
 const x=4.37,z=-3.47;
 box(x,.21,z,2.35,.23,1.65,'#a3a487');box(x,.99,z,1.98,1.4,1.39,'#d1c3a2');
 for(let i=0;i<10;i++)box(x-.9+i*.2,.78,z+.707,.024,1.10,.035,'#bfb08d');
 box(x,1.31,z+.722,1.45,.56,.032,'#6d8377');box(x,.965,z+.93,2.1,.085,.52,'#a79473');
 box(x,1.91,z,2.32,.15,1.82,'#7c9582');for(let i=0;i<9;i++){box(x-1.05+i*.262,2.02,z,.248,.10,1.85,choose(['#97aa91','#a2b499','#8da48b']));snowPatches.push({x:x-1.05+i*.262,y:2.083,z,w:.27,h:1,d:1.87,seed:rand(),threshold:.05,shade:.8});}
 for(let i=0;i<10;i++){box(x-1.05+i*.231,1.84,z+1.03,.23,.075,.71,i%2?'#99ac8b':'#ebe4c9');box(x-1.05+i*.231,1.73,z+1.35,.23,.15,.045,i%2?'#99ac8b':'#ebe4c9');}
 for(const xx of [-1.06,1.06])box(x+xx,1.06,z+1.33,.052,1.44,.052,'#b7b393');
 label('湖 边 · CAFÉ',x,2.18,z+.885,1.39,.30,{bg:'#ebe2c8',fg:'#6c7c5c',size:35});
 for(let i=0;i<3;i++)makeCup(x-.56+i*.46,1.013,z+.96,.28,'#e7dfc4');
 box(x-.52,1.32,z+.72,.3,.27,.26,'#b8bcb2');box(x-.52,1.48,z+.72,.37,.09,.3,'#b5a797');
 addLamp(x+.69,1.54,z+.83,.17);
 // A tiny patio, outside the lake and away from the pedestrian loop.
 const tx=4.28,tz=-1.96;for(let i=-2;i<=2;i++)for(let j=-1;j<=1;j++)if(!inLake(tx+i*.24,tz+j*.24))box(tx+i*.24,.12,tz+j*.24,.23,.09,.23,'#d6cfb1');
 cyl(tx,.51,tz,.52,.067,.52,'#d6c9a4');cyl(tx,.32,tz,.05,.35,.05,'#879879');makeCup(tx+.05,.554,tz,.22,'#eae6cf');
 box(tx-.63,.34,tz,.34,.055,.32,'#b5b795');box(tx-.63,.54,tz-.14,.34,.40,.055,'#b5b795');box(tx+.62,.34,tz,.34,.055,.32,'#b5b795');box(tx+.62,.54,tz-.14,.34,.40,.055,'#b5b795');
 const parasol=new THREE.Group();parasol.position.set(tx+.34,0,tz-.05);directBox(parasol,0,.99,0,.041,1.8,.041,'#a2a383');
 const pgeo=new THREE.ConeGeometry(.85,.28,8,1,true);const pm=new THREE.Mesh(pgeo,material('#e7dcb9',{side:THREE.DoubleSide}));pm.position.y=1.94;parasol.add(pm);for(let k=0;k<8;k++){const a=k*TAU/8;const rib=new THREE.Mesh(boxGeo,material('#d2c9a7'));tmpV.set(Math.cos(a)*.86,-.27,Math.sin(a)*.86);rib.position.copy(tmpV).multiplyScalar(.5).add(V(0,2.08,0));rib.quaternion.setFromUnitVectors(up,tmpV.clone().normalize());rib.scale.set(.018,tmpV.length(),.018);parasol.add(rib);}scene.add(parasol);
}
function makePot(x,y,z,s,col){cyl(x,y+s*.45,z,s*1.12,s*.9,s*1.12,col);cyl(x,y+s*.94,z,s*1.25,s*.16,s*1.25,col);cyl(x,y+s*1.02,z,s*.93,.018,s*.93,'#877f5c');}
function makeBench(x,z,s=1,rot=0){
 const pts=[];const add=(px,py,pz,w,h,d,color)=>pts.push({x:px,y:py,z:pz,w,h,d,color});
 for(let i=0;i<3;i++)add(0,.32,-.14+i*.13,1.0,.06,.10,'#c5b58c');for(let i=0;i<2;i++)add(0,.52+i*.14,-.20,1.0,.10,.04,'#c9bc99');for(const xx of [-.36,.36]){add(xx,.19,.02,.055,.30,.38,'#7d8e78');add(xx,.46,-.20,.048,.51,.045,'#7d8e78');}
 const b=mergedBoxes(pts);b.position.set(x,.10,z);b.rotation.y=rot;b.scale.setScalar(s);b.castShadow=true;scene.add(b);
}
function makeBridges(){
 // An arched footbridge. The deck is sampled continuously by walking figures.
 const start=-2.47,end=.40,z=.015,n=22;
 for(let i=0;i<n;i++){const t=i/(n-1),x=mix(start,end,t),y=.18+.35*Math.sin(PI*t);box(x,y,z,.147,.08,.69,'#c0a67e');snowPatches.push({x,y:y+.043,z,w:.153,h:1,d:.72,seed:rand(),threshold:rnd(.20,.4),shade:.3});}
 for(const side of [-1,1]){
  for(let i=0;i<7;i++){const t=i/6,x=mix(start,end,t),y=.18+.35*Math.sin(PI*t);box(x,y+.29,z+side*.39,.06,.60,.06,'#b6a27e');if(i<6){const t2=(i+1)/6;beam(V(x,y+.52,z+side*.39),V(mix(start,end,t2),.18+.35*Math.sin(PI*t2)+.52,z+side*.39),.054,'#b4a17f');}}
  for(let i=0;i<3;i++)box(mix(start,end,i/2),.1,z+side*.26,.08,.43,.08,'#8c957d');
 }
 // A smaller crossing where the stream reaches the bookshop path.
 for(let i=0;i<7;i++)box(-1.43+(i-3)*.14,.20,-3.76,.13,.065,.60,'#c3b48c');
 for(const x of [-1.87,-.99])for(const z of [-4.03,-3.49])box(x,.35,z,.04,.34,.04,'#a69e7c');
 for(const z of [-4.03,-3.49])box(-1.43,.49,z,.93,.04,.04,'#b0a483');
 // Dock, on the sheltered southern shore.
 for(let j=0;j<11;j++)box(2.89,.13,2.94-j*.115,.80,.085,.102,'#bba27c');
 for(const x of [2.50,3.28])for(const z of [2.89,1.75]){box(x,.03,z,.09,.59,.09,'#a19171');box(x,.34,z,.115,.065,.115,'#d2c7a5');}
 box(3.13,.37,2.6,.035,.50,.035,'#899778');
 addLamp(3.13,.66,2.6,.14);
 // The island is reached by the same bridge throughout the year.
 makeBench(1.29,-.40,.53,PI);
 makeBench(-.57,3.19,.95,.0);
 for(let i=0;i<9;i++)box(-.5+i*.09,.13,-.2+i*.012,.085,.06,.35,'#c9c4a3');
}

function makeTree(x,z,h,r,species=0){
 const t={x,z,h,r,species,id:trees.length,offset:rnd(-.035,.035)};trees.push(t);
 const trunk='#888569',branch='#959174';
 const lean=rnd(-.12,.12);
 for(let i=0;i<11;i++){const yy=.15+i*h*.061;box(x+lean*i/11,yy,z,.18-i*.006,h*.073,.18-i*.006,i%3===0?'#9b9678':trunk);}
 for(let k=0;k<7;k++){
  const a=k*TAU/7+rnd(-.3,.3),start=V(x,.65+h*.24,z),end=V(x+Math.cos(a)*r*.76,h*(.63+rnd(-.04,.16)),z+Math.sin(a)*r*.65);
  const count=9;for(let i=0;i<count;i++){const u=i/(count-1),p=start.clone().lerp(end,u);box(p.x,p.y,p.z,.11-u*.035,.15,.10-u*.029,branch);if(i>4)snowPatches.push({x:p.x,y:p.y+.072,z:p.z,w:.14,h:1,d:.14,seed:rand(),threshold:rnd(.02,.16),shade:.7});}
 }
 const c=.27,cy=h*.77;
 for(let ix=-Math.ceil(r/c);ix<=Math.ceil(r/c);ix++)for(let iz=-Math.ceil(r*.86/c);iz<=Math.ceil(r*.86/c);iz++)for(let iy=-Math.ceil(r*.72/c);iy<=Math.ceil(r*.72/c);iy++){
  const dx=ix*c,dy=iy*c,dz=iz*c,ell=dx*dx/(r*r)+dy*dy/(r*r*.68)+dz*dz/(r*r*.78);
  if(ell>1.0+rnd(-.15,.12)||rand()<.16)continue;
  const px=x+dx+rnd(-.033,.033),py=cy+dy,pz=z+dz+rnd(-.025,.025),size=rnd(.22,.285),seed=rand();
  leafData.push({x:px,y:py,z:pz,w:size,h:size*.90,d:size,seed,offset:t.offset+rnd(-.021,.021),species,tip:clamp(ell),color:choose(species===3?['#689077','#769780','#668974']:['#8ead7f','#a0b987','#86a777','#a7bd8f'])});
  if(species===0&&rand()<.82){blossomData.push({x:px+rnd(-.07,.07),y:py+.045,z:pz+rnd(-.07,.07),w:size*rnd(.8,1.11),h:size*.73,d:size*rnd(.8,1.08),seed:rand(),offset:t.offset*.55+rnd(-.024,.024),center:.124,width:.168,color:choose(['#efd3c4','#e7bcb7','#f6dfcd','#ecc9bd','#f4ded1']),kind:0});}
  if(species===3&&iy>0&&rand()<.29)snowPatches.push({x:px,y:py+size*.5,z:pz,w:size*1.02,h:1,d:size,seed:rand(),threshold:rnd(.01,.20),shade:.8});
 }
 shadowBlob(x,z,r*.9,r*.8,.145,.10);
 for(let i=0;i<6;i++)box(x+rnd(-.30,.30),.17,z+rnd(-.30,.30),rnd(.08,.17),.09,rnd(.08,.17),'#9da887');
}
function makePlanting(){
 makeTree(-5.35,-3.98,3.45,1.05,0);
 makeTree(-2.45,-2.61,3.39,1.09,0);
 makeTree(.10,-3.38,2.87,.93,1);
 makeTree(2.12,-4.13,2.75,.83,3);
 makeTree(5.66,-2.72,3.12,1.01,1);
 makeTree(5.12,.29,3.29,1.02,0);
 makeTree(5.32,2.71,2.48,.84,2);
 makeTree(-2.68,2.41,2.86,.95,0);
 makeTree(-5.87,.02,2.7,.82,2);
 makeTree(-.45,4.15,1.83,.61,1);
 makeTree(1.02,-.38,2.35,.69,0);
 const beds=[{x:-3.37,z:2.86,rx:.57,rz:.29,type:0},{x:-5.26,z:2.80,rx:.63,rz:.31,type:1},{x:-2.50,z:-1.45,rx:.32,rz:.61,type:1},{x:4.93,z:1.53,rx:.49,rz:.76,type:2},{x:2.3,z:-3.28,rx:.62,rz:.25,type:2},{x:-.90,z:4.25,rx:.86,rz:.24,type:0},{x:5.17,z:4.15,rx:.70,rz:.23,type:1}];
 for(const b of beds){
  for(let i=0;i<65;i++){
   const a=rand()*TAU,rad=Math.sqrt(rand()),x=b.x+Math.cos(a)*rad*b.rx,z=b.z+Math.sin(a)*rad*b.rz;if(inLake(x,z)||inBuilding(x,z,.08)||pathDistance(x,z)<.30)continue;
   const h=rnd(.15,.33);grassData.push({x,y:.14,z,w:.035,h,d:.038,seed:rand(),offset:rnd(-.035,.025),color:'#82a073'});
   const type=b.type,center=type===2?.385:type===1?.195:.14,width=type===2?.205:.185,col=type===2?choose(['#b7b6cf','#aaaac8','#c9c0d2','#b8cace']):type===1?choose(['#e3bf9d','#ead8a0','#dbb1a3']):choose(['#f0d3be','#e5b7ad','#f0e2bb']);
   for(let k=0;k<(type===2?8:4);k++){const a=k*TAU/(type===2?8:4);flowerData.push({x:x+Math.cos(a)*.055,y:.16+h+(k%3)*.025,z:z+Math.sin(a)*.055,w:type===2?.088:.064,h:.07,d:type===2?.088:.063,seed:rand(),offset:rnd(-.05,.05),center,width,color:col,kind:type});}
   flowerData.push({x,y:.18+h,z,w:.055,h:.053,d:.055,seed:rand(),offset:rnd(-.03,.03),center,width,color:type===2?'#d7c9bf':'#d8bd7b',kind:type});
  }
 }
 // A succession of tiny early flowers along the thawing, sun-facing bank.
 for(let i=0;i<55;i++){const x=rnd(-1.7,1.7),z=rnd(2.67,3.3);if(inLake(x,z)||pathDistance(x,z)<.25)continue;flowerData.push({x,y:.24,z,w:.07,h:.08,d:.07,seed:rand(),offset:rnd(-.024,.024),center:.055,width:.137,color:choose(['#eeebd8','#eedbcc','#d6c3d0']),kind:0});grassData.push({x,y:.11,z,w:.026,h:.14,d:.026,seed:rand(),offset:rnd(-.015,.015),color:'#98ac7d'});}
 const lilyData=[];
 for(let i=0;i<32;i++){const x=rnd(1.5,3.4),z=rnd(-1.95,-.75);if(!inLake(x,z)||islandField(x,z)<1.5)continue;const s=rnd(.15,.28);lilyData.push({x,y:.014,z,w:s,h:.018,d:s*.85,seed:rand(),offset:rnd(-.04,.04),color:choose(['#86af85','#a0ba8c','#7ba786']),ry:rand()*PI});if(i%3===0)for(let k=0;k<5;k++)flowerData.push({x:x+Math.sin(k*TAU/5)*.044,y:.065+(k===4?.04:0),z:z+Math.cos(k*TAU/5)*.044,w:.07,h:.057,d:.05,seed:rand(),offset:rnd(-.06,.06),center:.43,width:.20,color:choose(['#ebd6c5','#e8c6be','#f1e5d4']),kind:3});}
 createEcoMesh(terrainData,'terrain');createEcoMesh(grassData,'grass');createEcoMesh(leafData,'leaf');createEcoMesh(blossomData,'bloom');createEcoMesh(flowerData,'bloom');createEcoMesh(litterData,'litter');createEcoMesh(lilyData,'lily');createEcoMesh(snowPatches,'snow');
}
const glColor = hex => {const c=new THREE.Color(hex);return `vec3(${c.r.toFixed(5)},${c.g.toFixed(5)},${c.b.toFixed(5)})`;};
const ecoGLSL=`
uniform float uYear,uTime,uDay,uSnow,uMelt;
attribute vec4 aData;
attribute vec3 aExtra;
attribute vec3 aBaseColor;
varying vec3 vEcoColor;
float pulse(float p,float center,float width){return smoothstep(cos(6.28318530718*width),1.,cos(6.28318530718*(p-center)));}
`;
function ecoTransform(kind){
 const lead=`vec3 transformed=vec3(position);float pp=uYear+aData.y;float warm=.5+.5*cos(6.28318530718*(pp-.39));float leaves=smoothstep(.28,.72,warm);vEcoColor=aBaseColor;`;
 if(kind==='leaf')return lead+`
  float evergreen=step(2.9,aExtra.y);float grow=mix(.016+.984*leaves,.90+.10*leaves,evergreen);
  transformed*=grow;transformed.x+=sin(uTime*.65+aData.x*31.)*.075*grow;transformed.z+=cos(uTime*.53+aData.x*17.)*.045*grow;
  float fall=pulse(pp+aExtra.x*.035,.645,.223)*(1.-evergreen);float youth=pulse(pp,.18,.18);
  vec3 leafGreen=mix(aBaseColor,${glColor('#a9be89')},youth*.37);
  vec3 autumnColor=mix(${glColor('#d5b569')},${glColor('#bd7957')},clamp(aExtra.y*.38+aData.x*.36,0.,1.));
  vEcoColor=mix(leafGreen,autumnColor,fall);`;
 if(kind==='bloom')return lead+`
  float bloom=pulse(pp,aData.z,aData.w);float open=smoothstep(.015,.84,bloom);float bud=.025+.975*open;
  transformed*=bud;transformed.x+=sin(uTime*.72+aData.x*20.)*.06*open;
  vEcoColor=mix(aBaseColor*.68,aBaseColor,.58+.42*open);`;
 if(kind==='grass')return lead+`
  float g=.19+.81*leaves;transformed.y=(position.y+.5)*g;transformed.x+=sin(uTime*.83+aData.x*39.)*.65*max(0.,position.y+.5)*g;
  float fall=pulse(pp,.715,.25);vEcoColor=mix(aBaseColor,${glColor('#b3ad82')},fall*.84);vEcoColor=mix(vEcoColor,${glColor('#9fa991')},uSnow*.50);`;
 if(kind==='terrain')return lead+`
  float fall=pulse(pp,.706,.26);float summer=pulse(pp,.37,.25);
  vEcoColor=mix(aBaseColor,aBaseColor*${glColor('#d6e4cf')},summer*.36*(1.-aExtra.x));
  vEcoColor=mix(vEcoColor,${glColor('#b6b48f')},fall*.52*(1.-aExtra.x*.7));
  vEcoColor=mix(vEcoColor,${glColor('#a7b4a4')},uSnow*.34);vEcoColor=mix(vEcoColor,${glColor('#9b8d6f')},uMelt*.55*aExtra.x);vEcoColor*=1.-uMelt*.11*aExtra.x;`;
 if(kind==='litter')return lead+`
  float fallen=pulse(pp,.731,.225);float amount=smoothstep(aData.x*.70,aData.x*.70+.26,fallen);transformed*=amount;
  vEcoColor=mix(aBaseColor,aBaseColor*.68,pulse(pp,.84,.12));`;
 if(kind==='lily')return lead+`
  float growth=pulse(pp,.40,.285);transformed*=smoothstep(.015,.68,growth)*(1.-uSnow);transformed.y+=sin(uTime*.53+aData.x*20.)*.35*(1.-uSnow);`;
 if(kind==='snow')return lead+`
  float localSnow=clamp(pulse(pp,.875,.248)*(.82+.29*aExtra.z)-uMelt*(1.-aExtra.z)*.18,0.,1.);
  float cover=smoothstep(aExtra.x*.69,aExtra.x*.69+.42,localSnow);
  float width=smoothstep(.00,.15,cover);transformed.xz*=width;transformed.y=(position.y+.5)*cover*.19;
  float wet=uMelt*(.35+.65*aData.x);vEcoColor=mix(${glColor('#eff1e5')},${glColor('#c1d2cd')},wet*.42);
  transformed.xz*=1.-wet*.24;`;
 return lead;
}
function createEcoMesh(data,kind){
 if(!data.length)return;
 const geo=boxGeo.clone(),a=new Float32Array(data.length*4),extra=new Float32Array(data.length*3),colors=new Float32Array(data.length*3);
 const mat=material('#ffffff',{roughness:kind==='snow'?.56:.89});
 const inject=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+ecoGLSL).replace('#include <begin_vertex>',ecoTransform(kind));shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vEcoColor;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= vEcoColor;');};
 mat.onBeforeCompile=inject;mat.customProgramCacheKey=()=>`eco_${kind}_r160`;
 const mesh=new THREE.InstancedMesh(geo,mat,data.length);mesh.castShadow=['leaf','bloom','snow'].includes(kind);mesh.receiveShadow=true;
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});depth.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+ecoGLSL).replace('#include <begin_vertex>',ecoTransform(kind));};depth.customProgramCacheKey=()=>`eco_depth_${kind}`;mesh.customDepthMaterial=depth;
 data.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.rotation.set(0,p.ry||0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);a.set([p.seed??rand(),p.offset||0,p.center||0,p.width||0],i*4);extra.set(kind==='snow'?[p.threshold||0,0,p.shade||0]:[p.tip||p.shore||0,p.species||0,0],i*3);tempColor.set(p.color||'#f2f2e9');colors.set([tempColor.r,tempColor.g,tempColor.b],i*3);});
 geo.setAttribute('aData',new THREE.InstancedBufferAttribute(a,4));geo.setAttribute('aExtra',new THREE.InstancedBufferAttribute(extra,3));geo.setAttribute('aBaseColor',new THREE.InstancedBufferAttribute(colors,3));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.6;scene.add(mesh);materials[kind]=mat;
}

function makeWater(){
 const geo=new THREE.PlaneGeometry(8.2,6.2);
 const vertex=`varying vec3 vWorld;varying vec2 vUv;void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
 const fragment=`
 precision highp float;uniform float uTime,uIce,uDay,uMelt,uWeather;varying vec3 vWorld;varying vec2 vUv;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){
  vec2 p=vWorld.xz;vec2 q=floor(p/.28+.5)*.28;
  vec2 lp=(q-vec2(1.,-.05))/vec2(3.55,2.69);
  float lake=dot(lp,lp)+.065*sin(q.x*2.+q.y*.8)+.038*sin(q.y*3.1-q.x*.4);
  vec2 ip=(q-vec2(1.,-.22))/vec2(.87,.67);float island=dot(ip,ip);
  if(lake>1.0||island<1.)discard;
  float depth=clamp((1.-lake)*1.8,0.,1.);
  float ripple=sin(p.x*5.1+p.y*3.7+uTime*.63)+sin(p.x*-4.7+p.y*6.3-uTime*.51);
  float caustic=pow(max(0.,sin(p.x*9.+sin(p.y*6.+uTime*.6))+sin(p.y*11.-uTime*.4)-.8),3.);
  vec3 color=mix(${glColor('#b5d0b4')},${glColor('#6ba99b')},depth*.88);
  color+=vec3(.012,.022,.017)*ripple*(1.-uIce);
  color+=vec3(.035,.065,.052)*caustic*(1.-uIce);
  float glint=pow(max(0.,sin(p.x*14.0+p.y*8.+uTime*.9)*cos(p.y*12.4-uTime*.65)),26.);
  float longGlint=pow(max(0.,sin(p.x*2.7+p.y*14.+uTime*.51)),34.)*smoothstep(.2,.85,noise(p*4.));
  color+=vec3(.27,.32,.27)*(glint*.75+longGlint*.24)*uDay*(1.-uIce);
  float edge=min((1.-lake)*1.14,max(0.,(island-1.)*.23));
  float ice=(1.-smoothstep(uIce-.04,uIce+.05,edge+noise(p*3.)*.09))*smoothstep(0.,.06,uIce);
  float line=min(abs(sin(p.x*2.8+p.y*.9+noise(p*1.2)*2.)),abs(sin(p.y*3.7-p.x*.4+noise(p*1.8))));
  float cracks=(1.-smoothstep(.0,.035+uMelt*.075,line));
  vec3 frost=mix(${glColor('#c4d9d3')},${glColor('#e1e9df')},noise(p*8.));
  frost=mix(frost,${glColor('#76a99e')},cracks*(.12+uMelt*.62));
  float pools=smoothstep(.61,.84,noise(p*1.8+vec2(.2,.8)))*uMelt;
  color=mix(color,frost,ice*(1.-pools*.75));
  color*=mix(.36,1.03,uDay);
  float rainRing=pow(max(0.,sin(length(fract(p*2.)-.5)*48.-uTime*7.)),14.)*uWeather*.014*(1.-uIce);color+=rainRing;
  gl_FragColor=vec4(color,.94);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;
 const mat=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide});
 const lake=new THREE.Mesh(geo,mat);lake.rotation.x=-PI/2;lake.position.set(1,-.001,-.05);lake.renderOrder=2;scene.add(lake);
 box(1,-.195,-.05,7.35,.06,5.59,'#8ab3a4');
 // A narrow, curved channel with directional caustics that return at the thaw.
 const pos=[],uvs=[],idx=[];for(let i=0;i<=70;i++){const z=mix(-4.95,-1.34,i/70),x=-1.49+.28*Math.sin(z*2.);for(const sign of [-1,1]){pos.push(x+sign*.23,-.008,z);uvs.push(sign<0?0:1,i/70);}if(i<70){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}}
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));sg.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));sg.setIndex(idx);sg.computeVertexNormals();
 const sm=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform float uTime,uIce,uDay;void main(){float f=(sin(vUv.y*110.-uTime*4.*(1.-uIce))*.5+.5);vec3 c=mix(${glColor('#80b4a2')},${glColor('#d5ded1')},uIce);c+=pow(f,7.)*.09*(1.-uIce);c*=mix(.4,1.,uDay);gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include'),side:THREE.DoubleSide});scene.add(new THREE.Mesh(sg,sm));
}

function addGlow(x,y,z,w,h,strength=1){
 const mat=new THREE.ShaderMaterial({uniforms:{...uniforms,uStrength:{value:strength}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);mv.xy+=position.xy;gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec2 vUv;uniform float uNight,uStrength;void main(){float d=length((vUv-.5)*2.);float a=pow(max(0.,1.-d),2.8)*uNight*uStrength;gl_FragColor=vec4(1.,.68,.32,a);}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
 const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);m.renderOrder=8;scene.add(m);glows.push(m);
}
function addLamp(x,y,z,s){
 box(x,y,z,s*.78,s*1.19,s*.78,'#f2dfac',0,materials.lantern);
 box(x,y+s*.70,z,s*1.09,s*.15,s*1.09,'#7f9179');box(x,y-s*.68,z,s*.91,s*.12,s*.91,'#89947c');
 for(const a of [-1,1])for(const b of [-1,1])box(x+a*s*.42,y,z+b*s*.42,s*.09,s*1.30,s*.09,'#84927b');
 addGlow(x,y,z,s*6,s*6,.64);lamps.push({x,y,z});
}
function makeGardenDetails(){
 for(const [x,z] of [[-.97,3.17],[4.92,2.25],[-2.49,-.75],[-5.80,2.25],[.70,-3.64]]){box(x,.57,z,.042,.97,.042,'#83937a');addLamp(x,1.14,z,.155);}
 // A painting left in the garden is also generated, with a miniature lake on it.
 const ex=4.36,ez=3.36;beam(V(ex-.22,.13,ez),V(ex,1.04,ez-.10),.038,'#b7a17a');beam(V(ex+.22,.13,ez),V(ex,1.04,ez-.10),.038,'#b7a17a');beam(V(ex,.13,ez-.34),V(ex,.89,ez-.12),.038,'#b7a17a');box(ex,.77,ez,.49,.36,.033,'#eee3c7');box(ex,.71,ez+.021,.40,.16,.010,'#a9c8b3');box(ex-.10,.84,ez+.025,.15,.12,.012,'#b4c29b');box(ex+.07,.82,ez+.026,.08,.17,.012,'#bcc89f');
 // Watering can, garden tools, a mailbox and a birdhouse.
 cyl(-3.19,.27,2.02,.23,.24,.23,'#9cae97');beam(V(-3.10,.25,2.02),V(-2.91,.39,2.04),.064,'#9cae97');
 box(-5.60,.48,3.87,.085,.73,.085,'#a6a484');box(-5.60,.92,3.87,.38,.27,.29,'#8fa58a');box(-5.60,1.078,3.87,.45,.07,.32,'#b6bc99');box(-5.60,.93,4.022,.27,.028,.019,'#d9d8be');box(-5.61,.865,4.027,.19,.057,.022,'#ece1c7');
 box(-.03,1.2,-3.14,.064,2.17,.064,'#9da087');box(-.03,2.36,-3.14,.37,.36,.35,'#c9b999');box(-.03,2.60,-3.14,.49,.11,.46,'#8da388');box(-.03,2.35,-2.958,.098,.11,.016,'#7c876f');
 const cloudMat=material('#fffef1',{transparent:true,opacity:.58,depthWrite:false,roughness:1});materials.cloud=cloudMat;
 for(let i=0;i<3;i++){const group=new THREE.Group();for(let k=0;k<7;k++){const block=new THREE.Mesh(boxGeo,cloudMat);block.scale.set(rnd(.30,.61),rnd(.13,.25),rnd(.23,.41));block.position.set((k-3)*.27,rnd(-.08,.09),rnd(-.12,.12));group.add(block);}group.position.set(-3+i*3.25,4.85+i*.42,-3.37-i*.19);group.scale.setScalar(i===1?.73:1);scene.add(group);clouds.push({group,x:group.position.x,y:group.position.y,z:group.position.z,phase:rand()*TAU});}
}

const particlePools={};
function makeParticles(kind,count){
 const positions=new Float32Array(count*3),seeds=new Float32Array(count*4);
 for(let i=0;i<count;i++){
  let x=rnd(-6.6,6.6),z=rnd(-4.7,4.7),y=rnd(.7,3.5);
  if(kind==='petal'||kind==='leaf'){const tree=choose(trees.filter(t=>t.species!==3));x=tree.x+rnd(-.7,.7);y=tree.h*.80+rnd(-.5,.3);z=tree.z+rnd(-.7,.7);}
  if(kind==='firefly'){x=rnd(-5.8,5.8);z=rnd(-3.8,3.9);y=rnd(.28,1.35);}
  if(kind==='drip'){x=-4.17+choose([-1.40,1.40]);z=-2.64+rnd(-1.15,1.15);y=2.02;}
  if(kind==='steam'){x=6.9+rnd(-.13,.13);z=5.65+rnd(-.12,.12);y=-.79;}
  positions.set([x,y,z],i*3);seeds.set([rand(),rand(),rand(),rand()],i*4);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,4));
 const type={snow:0,rain:1,petal:2,leaf:3,firefly:4,drip:5,steam:6}[kind];
 const pu={...uniforms,uAmount:{value:0},uType:{value:type},uPixelRatio:{value:1}};
 const vertex=`
 attribute vec4 aSeed;uniform float uTime,uAmount,uType,uPixelRatio,uWeather;varying float vAlpha,vSpin,vSeed;varying vec3 vTint;
 void main(){
  vec3 p=position;float life=fract(uTime*(.052+aSeed.z*.037)+aSeed.y);float a=sin(life*3.14159265);
  float amount=smoothstep(aSeed.x*.87,aSeed.x*.87+.13,uAmount)*smoothstep(0.,.04,uAmount);
  float size=3.5;
  if(uType<.5){p.y=.18+(1.-life)*5.0;p.x+=sin(life*6.28+aSeed.z*20.)*.36+life*.3*uWeather;p.z+=cos(life*6.28+aSeed.w*19.)*.23;vTint=vec3(.94,.96,.94);size=2.+aSeed.w*2.7;}
  else if(uType<1.5){life=fract(uTime*(.95+aSeed.z*.48)+aSeed.y);p.y=.12+(1.-life)*5.5;p.x+=life*.32;p.z+=life*.06;a=sin(life*3.14159265);vTint=vec3(.68,.79,.76);size=13.+aSeed.z*5.;}
  else if(uType<3.5){p.y=mix(position.y,.12,life);p.x+=sin(life*4.+aSeed.w*6.)*.45+life*.65;p.z+=cos(life*5.+aSeed.z*6.)*.40+life*.24;vTint=uType<2.5?mix(vec3(.96,.76,.72),vec3(.98,.88,.82),aSeed.w):mix(vec3(.75,.47,.26),vec3(.81,.67,.36),aSeed.w);size=uType<2.5?3.7+aSeed.z*2.4:4.+aSeed.z*3.;}
  else if(uType<4.5){p.x+=sin(uTime*.45+aSeed.y*31.)*.31;p.z+=cos(uTime*.39+aSeed.w*20.)*.33;p.y+=sin(uTime*.63+aSeed.z*15.)*.15;a=pow(.5+.5*sin(uTime*1.7+aSeed.y*29.),2.);vTint=vec3(.84,1.,.44);size=4.+aSeed.z*3.5;}
  else if(uType<5.5){life=fract(uTime*(.8+aSeed.z*.4)+aSeed.y);p.y=mix(position.y,.15,life*life);a=sin(life*3.14159);vTint=vec3(.76,.88,.84);size=2.4;}
  else{p.y+=life*.98;p.x+=sin(life*7.+aSeed.y*6.)*.12;p.z+=cos(life*5.)*.08;a=sin(life*3.14159)*.2;vTint=vec3(.93,.93,.85);size=13.+life*13.;}
  if(uType<5.5){p.x=clamp(p.x,-6.76,6.76);p.z=clamp(p.z,-4.78,4.78);}
  vAlpha=a*amount;vSpin=uTime*(aSeed.w+.15)+aSeed.y*6.28;vSeed=aSeed.w;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=size*uPixelRatio;
 }`;
 const fragment=`
 uniform float uType,uDay;varying float vAlpha,vSpin,vSeed;varying vec3 vTint;
 void main(){vec2 uv=gl_PointCoord-.5;float a=1.;
  if(uType<.5){float d=max(abs(uv.x),abs(uv.y));a=1.-smoothstep(.23,.49,d);}
  else if(uType<1.5){a=(1.-smoothstep(.02,.11,abs(uv.x)))*(1.-smoothstep(.15,.49,abs(uv.y)))*.47;}
  else if(uType<3.5){uv=mat2(cos(vSpin),-sin(vSpin),sin(vSpin),cos(vSpin))*uv;float d=length(uv*vec2(1.,1.5));a=1.-smoothstep(.25,.47,d);}
  else if(uType<4.5){float d=length(uv);a=pow(max(0.,1.-d*2.),2.);}
  else if(uType<5.5){a=1.-smoothstep(.15,.48,length(uv*vec2(1.5,1.)));}
  else{a=pow(max(0.,1.-length(uv)*2.),2.);}
  if(a*vAlpha<.003)discard;vec3 c=vTint*mix(.54,1.,uDay);if(uType>3.5&&uType<4.5)c=vTint;
  gl_FragColor=vec4(c,a*vAlpha);
 }`;
 const m=new THREE.Points(geo,new THREE.ShaderMaterial({uniforms:pu,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,blending:kind==='firefly'?THREE.AdditiveBlending:THREE.NormalBlending}));m.frustumCulled=false;m.renderOrder=kind==='firefly'?7:5;scene.add(m);particlePools[kind]={mesh:m,uniforms:pu,count};
}
function makeAtmosphere(){
 makeParticles('snow',620);makeParticles('rain',450);makeParticles('petal',255);makeParticles('leaf',215);makeParticles('firefly',48);makeParticles('drip',42);makeParticles('steam',22);
 const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const fragment=`varying vec2 vUv;uniform float uTime,uMist,uDay;float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5);}float n(vec2 p){vec2 f=fract(p),i=floor(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}void main(){if(uMist<.002)discard;vec2 uv=vUv*2.-1.;float edge=pow(max(0.,1.-dot(uv,uv)),1.8);float cloud=n(vUv*5.+vec2(uTime*.024,0.))*.65+n(vUv*12.-uTime*.014)*.35;float a=edge*smoothstep(.2,.8,cloud)*uMist*.32;gl_FragColor=vec4(mix(vec3(.59,.69,.70),vec3(.88,.91,.82),uDay),a);}`;
 const mat=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide});
 for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(12-i,7.6),mat);m.position.set(.4,.27+i*.30,.1);m.rotation.x=-PI/2;m.rotation.z=i*.43;m.renderOrder=6;scene.add(m);}
}

let butterflyMesh,birdMesh,butterflySeeds=[],birdSeeds=[],boat,boatOars=[],boatU=0,boatDocked=false,boatReturning=false,boatActivity=0,boatCruise=0,mooring;
const boatCurve=new THREE.CatmullRomCurve3([[2.22,1.64],[1.46,1.95],[.0,1.77],[-.78,1.18],[-.54,.68],[.14,.82],[1.45,1.10],[2.04,1.17]].map(([x,z])=>V(x-.31,.04,z)),true,'catmullrom',.25);
function makeWildlife(){
 butterflyMesh=new THREE.InstancedMesh(boxGeo,materials.world,18*3);butterflyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(butterflyMesh);butterflyMesh.frustumCulled=false;
 for(let i=0;i<18;i++){const c=choose([[-3.4,2.9],[4.98,1.4],[-.74,3.98],[1.06,-.3]]);butterflySeeds.push({x:c[0],z:c[1],seed:rand(),phase:rand()*TAU,color:choose(['#e6d29a','#dcc3b1','#d7d3b6','#d6bdac'])});for(let k=0;k<3;k++)butterflyMesh.setColorAt(i*3+k,tempColor.set(k===2?'#9a9472':butterflySeeds[i].color));}
 birdMesh=new THREE.InstancedMesh(boxGeo,materials.world,9*3);birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);birdMesh.frustumCulled=false;scene.add(birdMesh);
 for(let i=0;i<9;i++){birdSeeds.push({seed:rand(),phase:i*.28});for(let k=0;k<3;k++)birdMesh.setColorAt(i*3+k,tempColor.set(i%3?'#889185':'#b9b8a1'));}
}
function person({x,z,color,role,scale=1,rotation=0}){
 const g=new THREE.Group();g.position.set(x,.13,z);g.scale.setScalar(scale);g.rotation.y=rotation;
 const skin='#d9b294',hair=role==='reader'?'#837e64':'#847d65';
 const body=mergedBoxes([{x:0,y:.31,z:0,w:.195,h:.24,d:.13,color},{x:0,y:.491,z:.015,w:.14,h:.14,d:.13,color:skin},{x:0,y:.559,z:.007,w:.15,h:.065,d:.14,color:hair},{x:0,y:.49,z:-.049,w:.155,h:.14,d:.026,color:hair},{x:0,y:.406,z:.047,w:.147,h:.032,d:.055,color:'#ede1c2'}]);body.castShadow=true;g.add(body);
 const armL=new THREE.Group(),armR=new THREE.Group(),legL=new THREE.Group(),legR=new THREE.Group();
 for(const [a,sign] of [[armL,-1],[armR,1]]){a.position.set(sign*.124,.403,0);const m=mergedBoxes([{x:0,y:-.077,z:0,w:.06,h:.155,d:.085,color},{x:0,y:-.162,z:.015,w:.056,h:.046,d:.06,color:skin}]);a.add(m);g.add(a);}
 for(const [a,sign] of [[legL,-1],[legR,1]]){a.position.set(sign*.054,.197,0);a.add(mergedBoxes([{x:0,y:-.075,z:0,w:.067,h:.166,d:.075,color:'#6a7d75'},{x:0,y:-.166,z:.018,w:.080,h:.041,d:.12,color:'#817d65'}]));g.add(a);}
 if(role==='gardener'||role==='walker2'){g.add(mergedBoxes([{x:0,y:.604,z:0,w:.20,h:.04,d:.18,color:'#cfbd8f'},{x:0,y:.629,z:0,w:.15,h:.06,d:.13,color:'#d3c499'}]));}
 if(role==='reader'||role==='writer'){g.add(mergedBoxes([{x:0,y:.30,z:.18,w:.185,h:.03,d:.12,color:'#829b87'},{x:0,y:.324,z:.18,w:.167,h:.017,d:.105,color:'#eee6d2'}]));}
 if(role==='painter'){directBox(armR,0,-.22,.05,.018,.15,.02,'#a18b6d');g.add(mergedBoxes([{x:0,y:.58,z:-.005,w:.183,h:.061,d:.154,color:'#a6b7a5'}]));}
 scene.add(g);const p={group:g,x,z,armL,armR,legL,legR,role,phase:rand()*TAU};people.push(p);return p;
}
let safeWalk=[];
const pedestrianClearances=[{x:4.82,z:3.46,r:.38},{x:4.36,z:3.36,r:.31},{x:-.56,z:3.18,r:.31}];
function makePeople(){
 // Resolve the fixed route once, then use it for every frame in every season.
 safeWalk=pathSamples.slice(0,-1).map(p=>{const q=p.clone();for(const b of obstacles){const dx=q.x-b.x,dz=q.z-b.z;if(Math.abs(dx)<b.rx+.18&&Math.abs(dz)<b.rz+.18){const px=b.rx+.18-Math.abs(dx),pz=b.rz+.18-Math.abs(dz);if(px<pz)q.x+=Math.sign(dx||1)*px;else q.z+=Math.sign(dz||1)*pz;}}for(const t of [...trees.map(t=>({...t,r:.31})),...pedestrianClearances]){const dx=q.x-t.x,dz=q.z-t.z,d=Math.hypot(dx,dz);if(d<t.r){q.x=t.x+dx/(d||1)*t.r;q.z=t.z+dz/(d||1)*t.r;}}q.x=clamp(q.x,-6.55,6.55);q.z=clamp(q.z,-4.55,4.55);return q;});
 person({x:-1.8,z:3.65,color:'#b7997b',role:'walker',rotation:PI/2});
 person({x:3.8,z:3.66,color:'#8baca0',role:'walker2',rotation:-PI/2});
 person({x:-.56,z:3.18,color:'#9fae9e',role:'reader'});
 person({x:4.82,z:3.46,color:'#c4a792',role:'painter',rotation:-.52});
 person({x:-3.14,z:3.25,color:'#a1ae86',role:'gardener',rotation:PI});
 person({x:1.29,z:-.42,color:'#bca998',role:'writer',scale:.83,rotation:PI});
}
function sampleWalk(u,out){const a=fract(u)*safeWalk.length,i=Math.floor(a),t=a-i;return out.copy(safeWalk[i]).lerp(safeWalk[(i+1)%safeWalk.length],t);}
function makeBoat(){
 boat=new THREE.Group();const parts=[];const add=(x,y,z,w,h,d,color)=>parts.push({x,y,z,w,h,d,color});
 add(0,.07,0,.44,.07,.83,'#ae8b65');for(const s of [-1,1]){add(s*.23,.16,0,.056,.17,.77,'#b69b76');add(s*.21,.27,0,.081,.025,.80,'#dcc29b');}
 add(0,.15,.405,.39,.15,.069,'#b49a76');add(0,.15,-.405,.39,.15,.069,'#b49a76');add(0,.12,-.45,.26,.11,.07,'#ad936d');add(0,.19,-.18,.42,.056,.12,'#d3bc94');add(0,.19,.19,.42,.056,.12,'#d3bc94');
 boat.add(mergedBoxes(parts));for(const s of [-1,1]){const oar=new THREE.Group();oar.position.set(s*.23,.245,0);directBox(oar,s*.33,0,0,.75,.025,.028,'#bca57c');directBox(oar,s*.68,-.004,0,.21,.033,.11,'#ccb389');boat.add(oar);boatOars.push(oar);}scene.add(boat);boat.position.copy(boatCurve.getPointAt(0));
 const ropeGeo=new THREE.BufferGeometry();ropeGeo.setAttribute('position',new THREE.Float32BufferAttribute([2.5,.28,1.75,1.91,.25,1.64],3));mooring=new THREE.Line(ropeGeo,new THREE.LineBasicMaterial({color:'#c5b48d',transparent:true,opacity:1,depthWrite:false}));mooring.frustumCulled=false;scene.add(mooring);
}
function updateActors(dt,p,night){
 for(let i=0;i<people.length;i++){
  const a=people[i],t=state.time;
  if(a.role==='walker'||a.role==='walker2'){
   const u=t/143+(a.role==='walker2'?.52:.025);sampleWalk(u,a.group.position);sampleWalk(u+.001,tmpV);a.group.rotation.y=Math.atan2(tmpV.x-a.group.position.x,tmpV.z-a.group.position.z);
   const stride=Math.sin(t*4.5+a.phase);a.legL.rotation.x=stride*.41;a.legR.rotation.x=-stride*.41;a.armL.rotation.x=-stride*.27;a.armR.rotation.x=stride*.27;a.group.position.y=.14+Math.abs(Math.sin(t*4.5+a.phase))*.012;
  }else if(a.role==='reader'||a.role==='writer'){
   a.group.position.y=.25+Math.sin(t*.72+a.phase)*.003;a.legL.rotation.x=-1.02;a.legR.rotation.x=-1.02;a.armL.rotation.x=-.98+Math.sin(t*.75+a.phase)*.022;a.armR.rotation.x=-1.06+Math.sin(t*.52+a.phase)*.05;
  }else if(a.role==='painter'){
   a.armR.rotation.x=-1.08+Math.sin(t*.88)*.12;a.armR.rotation.z=Math.sin(t*.47)*.10;a.armL.rotation.x=-.43;a.group.rotation.y=-.52+Math.sin(t*.22)*.07;
  }else{
   const travel=.5+.5*Math.sin(t*.072),bend=pulse(t/38,.62,.31);a.group.position.set(-3.16+travel*.68,.14,3.21);a.group.rotation.y=PI-.23;a.group.rotation.x=bend*.20;a.armR.rotation.x=-.58-bend*.60+Math.sin(t*1.1)*.07;a.armL.rotation.x=-.23-bend*.43;a.legL.rotation.x=Math.sin(t*2.6)*.13*(1.-bend);a.legR.rotation.x=-a.legL.rotation.x;
  }
 }
 for(let i=0;i<butterflySeeds.length;i++){
  const b=butterflySeeds[i],amount=smooth(b.seed*.78,b.seed*.78+.21,p.butterflies),tt=state.time,ang=tt*.31+b.phase;
  let x=clamp(b.x+Math.sin(ang)*.48,-6.5,6.5),z=clamp(b.z+Math.sin(ang*1.23)*.40,-4.55,4.55);const y=.83+Math.sin(ang*.81)*.19;
  for(const tree of trees){const dx=x-tree.x,dz=z-tree.z,d=Math.hypot(dx,dz);if(d<.30){x=tree.x+(dx||.001)/(d||.001)*.30;z=tree.z+dz/(d||.001)*.30;}}
  for(let k=0;k<3;k++){const side=k===0?-1:1;dummy.position.set(x+(k===2?0:side*.055),y,z);dummy.rotation.set(0,-ang,k===2?0:side*(.25+Math.sin(tt*12+i)*.75));dummy.scale.set(k===2?.025:.103,k===2?.034:.013,k===2?.112:.144).multiplyScalar(amount);dummy.updateMatrix();butterflyMesh.setMatrixAt(i*3+k,dummy.matrix);}
 }
 butterflyMesh.instanceMatrix.needsUpdate=true;
 for(let i=0;i<birdSeeds.length;i++){
  const b=birdSeeds[i],a=state.time*.069+b.phase,amount=smooth(b.seed*.65,b.seed*.65+.34,p.birds),x=Math.cos(a)*5.15,z=Math.sin(a)*3.54,y=5.15+Math.sin(a*.67+i*.2)*.24;
  for(let k=0;k<3;k++){const side=k===0?-1:1;dummy.position.set(x+(k===2?0:side*.125),y,z);dummy.rotation.set(0,-a,k===2?0:side*Math.sin(state.time*5+i*.15)*.48);dummy.scale.set(k===2?.077:.19,k===2?.067:.025,k===2?.24:.095).multiplyScalar(amount);dummy.updateMatrix();birdMesh.setMatrixAt(i*3+k,dummy.matrix);}
 }
 birdMesh.instanceMatrix.needsUpdate=true;
 const yr=fract(state.year),mustDock=(yr>.672&&yr<.99)||p.ice>.06;
 boatReturning=mustDock&&!boatDocked;
 if(!state.paused||state.manualEcology){
  if(mustDock){if(boatU<.002)boatDocked=true;if(!boatDocked){const remaining=1-boatU,rate=Math.min(Math.max(1/34,remaining/5.5),Math.max(.0003,remaining*.95));boatU+=dt*rate;if(boatU>=.999){boatU=0;boatDocked=true;}}}
   else if(state.ice<.055&&!state.paused){boatDocked=false;boatCruise=damp(boatCruise,1/70,1.4,dt);boatU=fract(boatU+dt*boatCruise);}
 }
 boatActivity=damp(boatActivity,boatDocked?0:1,2.3,dt);if(boatDocked)boatCruise=0;
 const bp=boatCurve.getPointAt(boatU),bt=boatCurve.getTangentAt(boatU);boat.position.copy(bp);boat.position.y=.025+Math.sin(state.time*1.05)*.012*boatActivity;boat.rotation.y=Math.atan2(bt.x,bt.z);boat.rotation.z=Math.sin(state.time*.77)*.026*boatActivity;
 const dockingStroke=boatActivity*smooth(.12,1.05,Math.hypot(bp.x-1.91,bp.z-1.64));
 for(let i=0;i<2;i++){boatOars[i].rotation.y=(i?1:-1)*mix(PI/2,Math.sin(state.time*1.1)*.27,dockingStroke);}
 const rope=mooring.geometry.attributes.position;rope.setXYZ(1,bp.x+bt.z*.19,.25,bp.z-bt.x*.19);rope.needsUpdate=true;mooring.material.opacity=1-smooth(.04,.63,Math.hypot(bp.x-1.91,bp.z-1.64));
 for(const c of clouds){c.group.position.x=c.x+Math.sin(state.time*.026+c.phase)*1.1;c.group.position.z=c.z+Math.sin(state.time*.018+c.phase)*.28;c.group.position.y=c.y+Math.sin(state.time*.024)*.06;}
 materials.cloud.opacity=(.15+p.summer*.35)*(.5+.5*state.weather);
}

const roomLights=[];
const daylightColor=new THREE.Color('#f7f2da'),goldenColor=new THREE.Color('#ebc898'),moonColor=new THREE.Color('#adbfd0');
const windowDay=new THREE.Color('#e0e9d6'),windowNight=new THREE.Color('#657e81');
let currentDaylight=1,currentRain=0,currentSnowfall=0;
function updateEnvironment(dt){
 const p=seasonAt(state.year);yearParams=p;
 const sky=Math.cos(TAU*(state.day-.5))-Math.cos(PI*p.dayLength);
 const daylight=smooth(-.13,.20,sky),night=1-daylight,morning=pulse(state.day,.265,.17);
 currentDaylight=daylight;
 const shower=p.summer*pulse(state.day,.63,.075)*(.35+.65*pulse(state.time/227,.31,.42))*state.weather;
 currentRain=shower;
 currentSnowfall=(p.snow*.81+pulse(state.year,.764,.14)*.15)*state.weather*(.46+.54*pulse(state.time/73,.33,.38));
 state.ice=damp(state.ice,boatDocked?p.ice:Math.min(.06,p.ice),.30,dt);
 uniforms.uYear.value=state.year;uniforms.uTime.value=state.time;uniforms.uDay.value=daylight;uniforms.uNight.value=night;uniforms.uSnow.value=p.snow;uniforms.uIce.value=state.ice;uniforms.uMelt.value=p.melt;uniforms.uWeather.value=shower;uniforms.uAutumn.value=p.autumn;
 uniforms.uMist.value=state.weather*(p.mist*.55+.055)*(.18+morning*.82)+shower*.11;
 sun.position.set(-8+Math.sin((state.day-.5)*TAU)*9,4+Math.max(0,sky)*8*p.solarHeight,-4-Math.cos((state.day-.5)*TAU)*5);
 sun.intensity=(.13+daylight*2.85)*(1-shower*.30);
 sun.color.copy(goldenColor).lerp(daylightColor,smooth(.06,.76,sky)).lerp(goldenColor,p.autumn*.22).lerp(moonColor,night);
 hemi.intensity=.53+daylight*1.55;fillLight.intensity=.21+daylight*.44;
 windowLight.intensity=.45+night*.16;
 renderer.toneMappingExposure=.91+daylight*.12;
 materials.window.emissiveIntensity=.12+night*1.45;materials.lantern.emissiveIntensity=.15+night*2.05;
 nightWindow.color.copy(windowNight).lerp(windowDay,daylight);nightWindow.emissiveIntensity=.05+daylight*.27;
 roomLights.forEach((l,i)=>l.intensity=(.18+night*(i===0?5.5:3.3)));
 particlePools.snow.uniforms.uAmount.value=clamp(currentSnowfall);
 particlePools.rain.uniforms.uAmount.value=clamp(shower);
 particlePools.petal.uniforms.uAmount.value=p.blossom*(.46+state.weather*.48);
 particlePools.leaf.uniforms.uAmount.value=pulse(state.year,.662,.155)*(.38+state.weather*.51);
 particlePools.firefly.uniforms.uAmount.value=p.fireflies*night;
 particlePools.drip.uniforms.uAmount.value=p.melt*p.snow*(.44+.56*pulse(state.time/29,.3,.42));
 particlePools.steam.uniforms.uAmount.value=.90;
 updateAudio(p,night,shower);
}
function advance(dt){
 state.weather=damp(state.weather,state.weatherTarget,2.5,dt);
 if(!state.paused){state.time+=dt;state.day=fract(state.day+dt/120);}
 if(state.target!==null){
  // A critically damped follower preserves velocity when a dial is re-targeted.
  let left=dt;while(left>0){const h=Math.min(left,.0167),delta=state.target-state.year;state.yearVelocity+=(delta*3.8-3.9*state.yearVelocity)*h;state.yearVelocity=clamp(state.yearVelocity,-.09,.09);state.year+=state.yearVelocity*h;left-=h;}
  if(Math.abs(state.target-state.year)<.0001&&Math.abs(state.yearVelocity)<.0003){state.target=null;}
 }else if(!state.paused){state.yearVelocity=damp(state.yearVelocity,state.speed/480,3,dt);state.year+=state.yearVelocity*dt;}
 else state.yearVelocity=0;
}
let lastWidth=0,lastHeight=0,lastDPR=0;
function resize(){
 if(!renderer)return;
 const w=Math.max(1,view.clientWidth),h=Math.max(1,view.clientHeight),dpr=Math.min(devicePixelRatio,state.eco||isTest?1:1.55);
 if(w!==lastWidth||h!==lastHeight||dpr!==lastDPR){lastWidth=w;lastHeight=h;lastDPR=dpr;renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);for(const pool of Object.values(particlePools))pool.uniforms.uPixelRatio.value=dpr*clamp(w/1050,.74,1.3);needRender=true;}
}
function updateCamera(dt){
 if(!state.paused&&!controls.dragging&&!reducedMotion&&performance.now()-controls.lastInput>7500)controls.targetAzimuth+=dt*.013;
 controls.azimuth=damp(controls.azimuth,controls.targetAzimuth,8,dt);controls.polar=damp(controls.polar,controls.targetPolar,6,dt);controls.radius=damp(controls.radius,controls.targetRadius,7,dt);
 camTarget.x=damp(camTarget.x,controls.targetX,7,dt);camTarget.z=damp(camTarget.z,controls.targetZ,7,dt);
 const asp=lastWidth/lastHeight,frustum=controls.radius*.625*(asp<1.2?1.2/asp:1);
 camera.left=-frustum*asp/2;camera.right=frustum*asp/2;camera.top=frustum/2;camera.bottom=-frustum/2;camera.updateProjectionMatrix();
 const dist=34;camera.position.set(camTarget.x+dist*Math.sin(controls.polar)*Math.sin(controls.azimuth),camTarget.y+dist*Math.cos(controls.polar),camTarget.z+dist*Math.sin(controls.polar)*Math.cos(controls.azimuth));camera.lookAt(camTarget);
 $('compass-arrow').setAttribute('transform',`rotate(${-controls.azimuth*180/PI} 16 16)`);
}
function isCameraMoving(){return Math.abs(controls.targetAzimuth-controls.azimuth)>.0002||Math.abs(controls.targetPolar-controls.polar)>.0002||Math.abs(controls.targetRadius-controls.radius)>.001||Math.abs(controls.targetX-camTarget.x)>.001||Math.abs(controls.targetZ-camTarget.z)>.001;}
// Screen-space offsets projected onto the garden plane; sensitivity follows zoom.
function moveCameraTarget(screenX,screenY){
 const a=controls.azimuth,depth=screenY/Math.max(.2,Math.cos(controls.polar));
 controls.targetX=clamp(controls.targetX+Math.cos(a)*screenX-Math.sin(a)*depth,-cameraLimits.panX,cameraLimits.panX);
 controls.targetZ=clamp(controls.targetZ-Math.sin(a)*screenX-Math.cos(a)*depth,-cameraLimits.panZ,cameraLimits.panZ);
}
function panCamera(dx,dy){
 const units=(camera.top-camera.bottom)/Math.max(1,lastHeight);
 moveCameraTarget(-dx*units,dy*units);
}
function zoomCamera(factor,clientX,clientY){
 const before=controls.targetRadius,after=clamp(before*factor,cameraLimits.minRadius,cameraLimits.maxRadius);
 if(Number.isFinite(clientX)&&Number.isFinite(clientY)){
  const r=view.getBoundingClientRect(),asp=r.width/r.height,h=before*.625*(asp<1.2?1.2/asp:1),weight=1-after/before;
  moveCameraTarget(((clientX-r.left)/r.width-.5)*h*asp*weight,(.5-(clientY-r.top)/r.height)*h*weight);
 }
 controls.targetRadius=after;
}
function schedule(){
 if(disposed||document.hidden||frameTimer||rafID)return;
 const wait=Math.max(0,1000/state.fps-(performance.now()-lastFrame)-1);
 frameTimer=setTimeout(()=>{frameTimer=0;rafID=requestAnimationFrame(frame);},wait);
}
function wake(){needRender=true;if(!frameTimer&&!rafID){lastFrame=performance.now()-1000/state.fps;schedule();}}
let fpsStart=0,fpsFrames=0;
function frame(now){
 rafID=0;if(disposed||document.hidden)return;
 const dt=clamp((now-lastFrame)/1000,.001,.15);lastFrame=now;
 advance(dt);resize();updateCamera(dt);updateEnvironment(dt);updateActors(state.paused&&!state.manualEcology?0:dt,yearParams,1-currentDaylight);
 if(state.manualEcology&&state.target===null&&Math.abs(state.ice-yearParams.ice)<.003&&(!boatReturning||boatDocked))state.manualEcology=false;
 for(const k of knobRotors){const value=k.name==='speed'?Math.log2(state.speed)/2:k.name==='weather'?(state.weather*2-1):state.year*TAU/(PI*.8);k.rotor.rotation.y=-value*PI*.8;}
 if(now-lastShadow>700||needRender){renderer.shadowMap.needsUpdate=true;lastShadow=now;}
 const start=performance.now();renderer.render(scene,camera);drawMs=performance.now()-start;state.frames++;fpsFrames++;
 if(now-fpsStart>=2000){state.actualFPS=fpsFrames*1000/(now-fpsStart);fpsStart=now;fpsFrames=0;}
 if(now-lastUI>230||needRender||state.paused&&state.target===null){updateUI();lastUI=now;}
 needRender=false;
 if(!state.paused||state.target!==null||state.manualEcology||Math.abs(state.weather-state.weatherTarget)>.001||isCameraMoving())schedule();
}
function setSeason(p,announce=true){
 const diff=fract(p-fract(state.year)+.5)-.5;
 state.target=state.year+diff;
 state.manualEcology=true;
 controls.lastInput=performance.now();
 if(announce)toast('正在轻轻翻页，花园会慢慢走向新的时节。');
 wake();
}
function setSpeed(value){state.speed=clamp(value,.25,4);updateUI();wake();}
function setWeather(value){state.weatherTarget=clamp(value);updateUI();wake();}
function setPaused(paused){state.paused=paused;$('pause-button').setAttribute('aria-pressed',String(paused));$('pause-button').setAttribute('aria-label',paused?'继续时间':'暂停时间');$('pause-icon').innerHTML=paused?'<path d="m6 3 10 7-10 7Z"/>':'<path d="M6 4v12m8-12v12"/>';$('time-state').textContent=paused?'此刻，静止':'时间流动中';$('live-label').textContent=paused?'把这一刻，留久一点':'此刻，花园正在生长';$('live-dot').style.background=paused?'#b1b497':'#8fa27a';wake();}
function setFPS(fps){state.fps=clamp(fps,1,60);state.eco=state.fps<30;$('eco-button').setAttribute('aria-pressed',String(state.eco));resize();wake();}
const letters=[
 {name:'春生',en:'SPRING',note:'万物，慢慢醒来',poem:'风把花瓣寄给湖面，<br>湖面把春天寄给你。'},
 {name:'夏长',en:'SUMMER',note:'把日子，过成绿荫',poem:'蝉声还没有落款，<br>晚风已经翻过一页。'},
 {name:'秋酿',en:'AUTUMN',note:'每一片叶，都有归处',poem:'树把金色的信笺，<br>一封封，放在小径上。'},
 {name:'冬藏',en:'WINTER',note:'在安静里，等一场花开',poem:'雪替世界轻轻留白，<br>而春天，已在字里行间。'}
];
let letterIndex=-1,poemTimer=0,toastTimer=0;
function seasonIndex(p){return Math.floor(fract(p+.005)*4)%4;}
function updateUI(){
 const p=fract(state.year),i=seasonIndex(p),l=letters[i];
 if(letterIndex!==i){letterIndex=i;$('chapter').textContent=`LETTER 0${i+1}  /  ${l.en}`;$('season-name').textContent=l.name;$('season-note').textContent=l.note;$('season-poem').style.opacity=0;clearTimeout(poemTimer);poemTimer=setTimeout(()=>{$('season-poem').innerHTML=l.poem;$('season-poem').style.opacity=1;},300);document.querySelectorAll('.season-stop').forEach((e,k)=>{e.classList.toggle('active',k===i);e.setAttribute('aria-pressed',String(k===i));});}
 if(document.activeElement!==$('season-range'))$('season-range').value=Math.round(p*1000);
 $('season-range').setAttribute('aria-valuetext',`${l.name}，全年 ${Math.round(p*100)}%`);
 $('speed-dial').style.setProperty('--angle',`${Math.log2(state.speed)/2*145}deg`);$('season-dial').style.setProperty('--angle',`${state.year*360-145}deg`);$('weather-dial').style.setProperty('--angle',`${(state.weatherTarget*2-1)*145}deg`);
 $('speed-dial').setAttribute('aria-valuenow',state.speed.toFixed(2));$('speed-dial').setAttribute('aria-valuetext',`${state.speed.toFixed(2)} 倍速，${(8/state.speed).toFixed(1)} 分钟一年`);$('season-dial').setAttribute('aria-valuenow',Math.round(p*100));$('season-dial').setAttribute('aria-valuetext',`${l.name}，${Math.round(p*100)}%`);$('weather-dial').setAttribute('aria-valuenow',Math.round(state.weatherTarget*100));
 $('speed-output').textContent=`${state.speed>=1?state.speed.toFixed(state.speed%1<.01?0:1):state.speed.toFixed(2)} ×`;
 $('season-output').textContent=`${l.name[0]} · ${Math.round(p*100)}%`;$('weather-output').textContent=state.weatherTarget<.1?'晴和':state.weatherTarget<.37?'轻盈':state.weatherTarget<.68?'轻柔':state.weatherTarget<.88?'丰沛':'浓郁';
 $('year-note').textContent=state.speed===1?'一年，约八分钟':`一年，约 ${(8/state.speed).toFixed(1)} 分钟`;
 $('temperature').textContent=`${Math.round((yearParams.temperature??10)+(currentDaylight-.5)*3)}°`;
 const hrs=Math.floor(state.day*24),mins=Math.floor(fract(state.day*24)*60);$('clock-label').textContent=String(hrs).padStart(2,'0')+':'+String(mins).padStart(2,'0');
 $('weather-label').textContent=currentSnowfall>.13?'细雪，万籁静':currentRain>.16?'一阵雨，路过花园':currentDaylight<.2?'夜色，灯正暖':['微风，花正开','云影，水正清','叶落，秋正好','薄霜，等春来'][i];
 if(isTest){$('test-indicator').style.display='inline-block';$('test-indicator').textContent=`节能实测 · ${state.fps} FPS 上限`;}
 if(isTest&&$('qa-data'))$('qa-data').textContent=JSON.stringify(diagnostics());
 if(isTest&&$('qa-knobs')){$('qa-knobs').textContent=JSON.stringify(knobRotors.map(k=>{const p=k.rotor.getWorldPosition(V()).project(camera),r=view.getBoundingClientRect();return {name:k.name,x:r.left+(p.x*.5+.5)*r.width,y:r.top+(-p.y*.5+.5)*r.height};}));}
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3100);}

let pointer=null,pointers=new Map(),pinchDistance=0,rangeDragging=false;
function knobHit(e){const r=view.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(knobTargets,false)[0];return hit?hit.object.userData.dial:null;}
function dialValue(name){return name==='speed'?(Math.log2(state.speed)+2)/4:name==='weather'?state.weatherTarget:fract(state.target??state.year);}
function applyDial(name,value){if(name==='speed')setSpeed(Math.pow(2,clamp(value)*4-2));else if(name==='weather')setWeather(value);else setSeason(fract(value),false);}
function bindControls(){
 $('about-button').setAttribute('aria-label','关于这封信');
 document.querySelectorAll('.season-stop').forEach(b=>b.addEventListener('click',()=>setSeason(Number(b.dataset.season))));
 $('season-range').addEventListener('input',e=>{rangeDragging=true;setSeason(Number(e.target.value)/1000,false);});$('season-range').addEventListener('change',()=>{rangeDragging=false;$('season-range').blur();toast('花园正在慢慢翻向这一页。');});
 document.querySelectorAll('[data-dial]').forEach(el=>{
  let drag=null;
  el.addEventListener('pointerdown',e=>{drag={y:e.clientY,x:e.clientX,value:dialValue(el.dataset.dial)};el.setPointerCapture(e.pointerId);e.preventDefault();});
  el.addEventListener('pointermove',e=>{if(!drag)return;applyDial(el.dataset.dial,drag.value+(drag.y-e.clientY+e.clientX-drag.x)*.004);});
  const end=()=>{drag=null;};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);
  el.addEventListener('keydown',e=>{const name=el.dataset.dial;if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();let v=dialValue(name);if(e.key==='Home')v=0;else if(e.key==='End')v=.999;else v+=(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1)*(e.shiftKey?.1:.025);applyDial(name,v);}});
  el.addEventListener('wheel',e=>{e.preventDefault();applyDial(el.dataset.dial,dialValue(el.dataset.dial)-Math.sign(e.deltaY)*.025);},{passive:false});
 });
 view.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==2)return;
  e.preventDefault();
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});view.setPointerCapture(e.pointerId);controls.lastInput=performance.now();
  if(pointers.size===2){const ps=[...pointers.values()];pinchDistance=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);pointer=null;controls.dragging=true;return;}
  const mode=e.button===2?'pan':'orbit',name=mode==='pan'?null:knobHit(e);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,mode,name,value:name?dialValue(name):0};controls.dragging=true;view.style.cursor=name?'ns-resize':'grabbing';$('knob-tip').style.display='none';view.focus({preventScroll:true});wake();
 });
 view.addEventListener('pointermove',e=>{
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const ps=[...pointers.values()],distance=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);if(pinchDistance>0)zoomCamera(pinchDistance/Math.max(1,distance));pinchDistance=distance;controls.lastInput=performance.now();wake();return;}
  if(pointer&&pointer.id===e.pointerId){
   if(pointer.name){applyDial(pointer.name,pointer.value+(pointer.startY-e.clientY+e.clientX-pointer.startX)*.004);}
   else if(pointer.mode==='pan'){panCamera(e.clientX-pointer.x,e.clientY-pointer.y);}
   else{controls.targetAzimuth-=(e.clientX-pointer.x)*.006;controls.targetPolar=clamp(controls.targetPolar+(e.clientY-pointer.y)*.004,.32,1.20);}
   pointer.x=e.clientX;pointer.y=e.clientY;controls.lastInput=performance.now();wake();
  }else{
   const name=knobHit(e);view.style.cursor=name?'ns-resize':'grab';$('knob-tip').style.display=name?'block':'none';if(name){$('knob-tip').style.left=e.clientX+14+'px';$('knob-tip').style.top=e.clientY-29+'px';$('knob-tip').textContent={speed:'流年 · 上下拖动调节速度',season:'时节 · 上下拖动轻翻四季',weather:'风雨 · 上下拖动调节强度'}[name];}
  }
 });
 const end=e=>{pointers.delete(e.pointerId);if(pointer?.id===e.pointerId)pointer=null;if(pointers.size<2)pinchDistance=0;controls.dragging=pointers.size>0;controls.lastInput=performance.now();view.style.cursor='grab';$('knob-tip').style.display='none';};
 view.addEventListener('pointerup',end);view.addEventListener('pointercancel',end);view.addEventListener('lostpointercapture',end);view.addEventListener('pointerleave',()=>$('knob-tip').style.display='none');
 view.addEventListener('contextmenu',e=>e.preventDefault());
 view.addEventListener('wheel',e=>{e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?lastHeight:1);zoomCamera(Math.exp(delta*.001),e.clientX,e.clientY);controls.lastInput=performance.now();wake();},{passive:false});
 view.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;
  e.preventDefault();
  if(e.shiftKey&&e.key.startsWith('Arrow'))panCamera(e.key==='ArrowLeft'?48:e.key==='ArrowRight'?-48:0,e.key==='ArrowUp'?48:e.key==='ArrowDown'?-48:0);
  else{
   if(e.key==='ArrowLeft')controls.targetAzimuth+=.11;if(e.key==='ArrowRight')controls.targetAzimuth-=.11;
   if(e.key==='ArrowUp')controls.targetPolar=clamp(controls.targetPolar-.08,.32,1.2);if(e.key==='ArrowDown')controls.targetPolar=clamp(controls.targetPolar+.08,.32,1.2);
   if(e.key==='+'||e.key==='=')zoomCamera(.88);if(e.key==='-')zoomCamera(1/.88);
  }
  controls.lastInput=performance.now();wake();
 });
 $('pause-button').addEventListener('click',()=>setPaused(!state.paused));
 $('reset-view').addEventListener('click',()=>{controls.targetAzimuth=.68+Math.round((controls.azimuth-.68)/TAU)*TAU;controls.targetPolar=.88;controls.targetRadius=24;controls.targetX=0;controls.targetZ=0;controls.lastInput=performance.now();controls.top=false;wake();toast('回到窗边，看时间慢慢经过。');});
 $('view-top').addEventListener('click',()=>{controls.top=!controls.top;controls.targetPolar=controls.top?.40:.88;controls.targetRadius=controls.top?23:24;controls.targetX=0;controls.targetZ=0;controls.lastInput=performance.now();wake();});
 $('quiet-view').addEventListener('click',toggleQuiet);
 $('eco-button').addEventListener('click',()=>{setFPS(state.eco?60:24);toast(state.eco?'已开启节能模式 · 24 FPS':'已开启流畅模式 · 60 FPS 上限');});
 $('about-button').addEventListener('click',()=>$('about-dialog').showModal());$('close-about').addEventListener('click',()=>$('about-dialog').close());$('about-dialog').addEventListener('click',e=>{if(e.target===$('about-dialog')){const r=$('about-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about-dialog').close();}});
 document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!$('about-dialog').open){e.preventDefault();setPaused(!state.paused);}if(e.key==='Escape'&&state.quiet)toggleQuiet();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(frameTimer);frameTimer=0;cancelAnimationFrame(rafID);rafID=0;audioContext?.suspend();}else{lastFrame=performance.now();if(audioEnabled)audioContext?.resume();wake();}});
 addEventListener('resize',()=>{resize();wake();});new ResizeObserver(()=>{resize();wake();}).observe(view);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setPaused(true);toast('画面暂时休息了，正在等待图形环境恢复。');});renderer.domElement.addEventListener('webglcontextrestored',()=>{needRender=true;wake();toast('花园回来了。点击继续，让时间流动。');});
 $('sound-button').addEventListener('click',toggleAudio);
}
function toggleQuiet(){state.quiet=!state.quiet;document.body.classList.toggle('quiet',state.quiet);document.querySelectorAll('header,.intro,.controls,.footer').forEach(el=>{el.inert=state.quiet;el.setAttribute('aria-hidden',String(state.quiet));});$('quiet-view').setAttribute('aria-pressed',String(state.quiet));$('quiet-view').setAttribute('aria-label',state.quiet?'退出纯净观景模式':'进入纯净观景模式');controls.lastInput=performance.now();resize();wake();if(state.quiet)toast('留一会儿吧。按 Esc 返回。');}

let audioContext=null,audioEnabled=false,windGain=null,waterGain=null,padGain=null,birdTimer=0;
async function toggleAudio(){
 try{
  if(!audioContext){
   audioContext=new (window.AudioContext||window.webkitAudioContext)();const sr=audioContext.sampleRate,buffer=audioContext.createBuffer(1,sr*3,sr),samples=buffer.getChannelData(0);let n=17;for(let i=0;i<samples.length;i++){n=(n*16807)%2147483647;samples[i]=(n/1073741823.5-1)*.45;}
   const makeNoise=(type,freq,gain)=>{const source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audioContext.createBiquadFilter();filter.type=type;filter.frequency.value=freq;const vol=audioContext.createGain();vol.gain.value=gain;source.connect(filter).connect(vol).connect(audioContext.destination);source.start();return vol;};windGain=makeNoise('lowpass',470,.035);waterGain=makeNoise('bandpass',1200,.022);
   padGain=audioContext.createGain();padGain.gain.value=.003;padGain.connect(audioContext.destination);for(const f of [174.61,261.63,349.23]){const o=audioContext.createOscillator();o.type='sine';o.frequency.value=f;o.connect(padGain);o.start();}
  }
  audioEnabled=!audioEnabled;if(audioEnabled){await audioContext.resume();birdTimer=setInterval(()=>{if(document.hidden||!audioEnabled||currentDaylight<.4)return;const t=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(1700,t);osc.frequency.exponentialRampToValueAtTime(2800,t+.08);osc.frequency.exponentialRampToValueAtTime(1500,t+.22);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.012*yearParams.birds,t+.026);gain.gain.exponentialRampToValueAtTime(.0001,t+.26);osc.connect(gain).connect(audioContext.destination);osc.start(t);osc.stop(t+.29);osc.onended=()=>{osc.disconnect();gain.disconnect();};},4700);}else{clearInterval(birdTimer);await audioContext.suspend();}
  $('sound-button').setAttribute('aria-pressed',String(audioEnabled));$('sound-button').setAttribute('aria-label',audioEnabled?'关闭花园环境音':'开启花园环境音');$('sound-button').querySelector('span').textContent=audioEnabled?'正在聆听':'聆听花园';toast(audioEnabled?'风声、水声和远处的小鸟，都是这座花园的回信。':'声音已轻轻收好。');
 }catch(error){toast('当前浏览器暂时无法播放环境音，仍可静静观赏花园。');}
}
function updateAudio(p,night,rain){if(!audioContext||!audioEnabled)return;const t=audioContext.currentTime;windGain.gain.setTargetAtTime(.022+state.weather*.025+rain*.04,t,.8);waterGain.gain.setTargetAtTime(.024*(1-state.ice)*(.45+p.warm*.55),t,.9);padGain.gain.setTargetAtTime(.0025+night*.0015,t,1);}

function diagnostics(){
 const actors=people.map(p=>({role:p.role,x:+p.group.position.x.toFixed(3),z:+p.group.position.z.toFixed(3),inside:inTray(p.group.position.x,p.group.position.z,.1),buildingCollision:inBuilding(p.group.position.x,p.group.position.z,.03)}));
 const bp=boat.position;const constraints={actorsInside:actors.every(p=>p.inside),actorsClearOfBuildings:actors.every(p=>!p.buildingCollision),boatInside:inLake(bp.x,bp.z),boatDocked,boatReturning};
 return {revision:THREE.REVISION,year:state.year,phase:fract(state.year),season:letters[seasonIndex(state.year)].en,paused:state.paused,transitioning:state.target!==null,day:state.day,daylight:currentDaylight,time:state.time,rain:currentRain,snowfall:currentSnowfall,speed:state.speed,weather:state.weather,ice:state.ice,fpsLimit:state.fps,observedFPS:+state.actualFPS.toFixed(1),lastRenderCPUms:+drawMs.toFixed(2),frames:state.frames,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,plantInstances:terrainData.length+grassData.length+leafData.length+blossomData.length+flowerData.length+litterData.length,snowInstances:snowPatches.length,particleCapacity:Object.values(particlePools).reduce((s,p)=>s+p.count,0),constraints,actors,contextLost:renderer.getContext().isContextLost(),canvas:[lastWidth,lastHeight],camera:{azimuth:controls.azimuth,polar:controls.polar,radius:controls.radius,target:{x:camTarget.x,y:camTarget.y,z:camTarget.z}},networkResources:performance.getEntriesByType('resource').map(r=>r.name).filter(n=>/^https?:/i.test(n)),renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)};
}
function routeAudit(){
 const badWalk=[],badBoat=[];for(let i=0;i<2000;i++){const p=sampleWalk(i/2000,V());if(!inTray(p.x,p.z,.12)||inBuilding(p.x,p.z,.06)||inLake(p.x,p.z)||trees.some(t=>Math.hypot(t.x-p.x,t.z-p.z)<.265)||pedestrianClearances.some(t=>Math.hypot(t.x-p.x,t.z-p.z)<t.r-.025))badWalk.push(i);const b=boatCurve.getPointAt(i/2000),t=boatCurve.getTangentAt(i/2000),r=V(t.z,0,-t.x);for(const long of [-.44,.44])for(const wide of [-.25,.25]){const x=b.x+t.x*long+r.x*wide,z=b.z+t.z*long+r.z*wide;if(!inLake(x,z)||!inTray(x,z,.1)||(x>2.48&&x<3.32&&z>1.70&&z<3.0))badBoat.push({i,x,z});}}
 return {walkSamples:2000,boatCornerSamples:8000,invalidWalk:badWalk.slice(0,10),invalidBoat:badBoat.slice(0,10),walkErrorCount:badWalk.length,boatErrorCount:badBoat.length};
}
function initialize(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power',preserveDrawingBuffer:false});renderer.setClearColor(0xf3f2e9,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;view.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.fog=new THREE.Fog('#f3f2e9',37,69);camera=new THREE.OrthographicCamera(-10,10,8,-8,.1,100);
  materials.world=material('#ffffff');materials.figure=material('#ffffff',{vertexColors:true});materials.window=material('#d9d7b3',{emissive:'#e6c787',emissiveIntensity:.2,roughness:.4});materials.lantern=material('#eddfb1',{emissive:'#ffd390',emissiveIntensity:.15,roughness:.5});
  hemi=new THREE.HemisphereLight('#eef4df','#aaa78b',2.0);scene.add(hemi);sun=new THREE.DirectionalLight('#fff0d3',3.0);sun.position.set(-7,13,-8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;sun.shadow.camera.near=.2;sun.shadow.camera.far=48;sun.shadow.normalBias=.035;sun.shadow.bias=-.00012;sun.shadow.radius=3;sun.target.position.set(0,0,0);scene.add(sun,sun.target);
  fillLight=new THREE.DirectionalLight('#dceadc',.7);fillLight.position.set(8,7,9);scene.add(fillLight);windowLight=new THREE.DirectionalLight('#f5e7cb',.50);windowLight.position.set(-9,6,-8);scene.add(windowLight);
  for(const [x,y,z] of [[-4.47,1.3,1.15],[-4.1,1.35,-2.43],[4.34,1.3,-2.62]]){const l=new THREE.PointLight('#ffcc85',.1,4.0,2);l.position.set(x,y,z);scene.add(l);roomLights.push(l);}
  makeDesk();buildTerrain();makeWater();makeBookhouse();makeGlasshouse();makeCafe();makeBridges();makeGardenDetails();makePlanting();flushBuckets();makeAtmosphere();makePeople();makeBoat();makeWildlife();
  if(isTest){const qa=document.createElement('output');qa.id='qa-data';qa.hidden=true;document.body.appendChild(qa);const audit=document.createElement('output');audit.id='qa-audit';audit.hidden=true;audit.textContent=JSON.stringify(routeAudit());document.body.appendChild(audit);const knobs=document.createElement('output');knobs.id='qa-knobs';knobs.hidden=true;document.body.appendChild(knobs);}
  if(seasonAt(state.year).ice>.05){boatDocked=true;state.ice=seasonAt(state.year).ice;}
  resize();updateCamera(1);updateEnvironment(.016);updateActors(0,seasonAt(state.year),0);bindControls();setPaused(state.paused);$('eco-button').setAttribute('aria-pressed',String(state.eco));updateUI();
  window.garden=Object.freeze({diagnostics,sampleSeason:seasonAt,routeAudit,setSeason:p=>setSeason(p,false),setWeather,setSpeed,pause:()=>setPaused(true),play:()=>setPaused(false),setFPS,resetView:()=>$('reset-view').click(),
   setDay:p=>{state.day=fract(p);wake();},
   projectKnobs:()=>knobRotors.map(k=>{const p=k.rotor.getWorldPosition(V()).project(camera),r=view.getBoundingClientRect();return {name:k.name,x:r.left+(p.x*.5+.5)*r.width,y:r.top+(-p.y*.5+.5)*r.height};}),
   captureState:()=>({year:state.year,time:state.time,day:state.day,weather:state.weather,camera:{azimuth:controls.azimuth,polar:controls.polar,radius:controls.radius,target:{x:camTarget.x,y:camTarget.y,z:camTarget.z}}})
  });
  renderer.compile(scene,camera);renderer.render(scene,camera);$('loading').classList.add('done');setTimeout(()=>$('loading').remove(),1100);lastFrame=performance.now();fpsStart=lastFrame;wake();
  addEventListener('beforeunload',()=>{disposed=true;clearTimeout(frameTimer);cancelAnimationFrame(rafID);clearInterval(birdTimer);audioContext?.close();renderer.dispose();});
 }catch(error){
  console.error('Garden initialization failed:',error);$('loading').innerHTML='<p style="max-width:340px;text-align:center;line-height:2">花园需要浏览器的 WebGL 支持。<br>请在 Chrome 设置中开启图形加速，然后重新打开这封信。</p><p style="font-size:10px;letter-spacing:0">'+String(error.message).replace(/[<>]/g,'')+'</p>';$('loading').style.pointerEvents='auto';
 }
}
initialize();
})();
