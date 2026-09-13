/* ============================================================
   雨夜便利店 · 街角  ——  三渲二微缩场景 (Three.js r160)
   纯观赏场景：拖拽旋转 / 滚轮缩放 / 右键平移，无任何 UI。
   默认帧率上限 30 FPS（可用 ?fps=60 覆盖），降低 CPU/GPU 占用。
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from './libs/OrbitControls.js';

window.__errors = [];
window.addEventListener('error', e => window.__errors.push(String(e.message || e)));

/* ---------------- 基础常量 ---------------- */
const params = new URLSearchParams(location.search);
const FPS = Math.max(10, Math.min(60, parseInt(params.get('fps') || '30', 10) || 30));
window.__fpsCap = FPS;

const GY = 0.16;            // 人行道高度
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

/* ---------------- 渲染器 / 场景 / 相机 ---------------- */
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0e1430, 42, 115);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(18.6, 12.2, 21.2);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.3, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.85;
controls.minDistance = 7;
controls.maxDistance = 42;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = 1.45;
controls.update();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------- 通用材质 / 几何工具 ---------------- */
const gradTex = (() => {
  const t = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const matCache = new Map();
function toon(color, opts = {}) {
  const key = 'T' + color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradTex, ...opts });
  matCache.set(key, m);
  return m;
}
function phong(color, opts = {}) {
  const key = 'P' + color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshPhongMaterial({ color, ...opts });
  matCache.set(key, m);
  return m;
}
function basic(color, opts = {}) {
  const key = 'B' + color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, ...opts });
  matCache.set(key, m);
  return m;
}

/* 描边材质（反转法线外壳），按厚度缓存 */
const outlineMats = new Map();
function outlineMat(t) {
  if (!outlineMats.has(t)) {
    outlineMats.set(t, new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uT: { value: t } },
      vertexShader: `
        uniform float uT;
        void main(){
          vec3 p = position + normal * uT;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `void main(){ gl_FragColor = vec4(0.035, 0.05, 0.10, 1.0); }`
    }));
  }
  return outlineMats.get(t);
}
function outline(mesh, t = 0.032) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat(t));
  o.castShadow = false; o.receiveShadow = false;
  mesh.add(o);
  return mesh;
}

function downSpot(color, intensity, dist, x, y, z, angle = 1.05, pen = 0.7) {
  const s = new THREE.SpotLight(color, intensity, dist, angle, pen, 1.55);
  s.position.set(x, y, z);
  s.target.position.set(x, 0, z);
  scene.add(s, s.target);
  return s;
}

const geoCache = new Map();
function geoBox(w, h, d) {
  const k = w + '_' + h + '_' + d;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

function box(w, h, d, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geoBox(w, h, d), mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.recv !== false;
  (o.parent || scene).add(m);
  if (o.ol) outline(m, o.ol);
  return m;
}
function cyl(rt, rb, h, seg, mat, x = 0, y = 0, z = 0, o = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  if (o.flat) mat.flatShading = true;
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.recv !== false;
  (o.parent || scene).add(m);
  if (o.ol) outline(m, o.ol);
  return m;
}
function plane(w, h, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  m.castShadow = false; m.receiveShadow = !!o.recv;
  m.renderOrder = o.ro || 0;
  (o.parent || scene).add(m);
  return m;
}

/* ---------------- Canvas 贴图 ---------------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function radialTex(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.32)') {
  return canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    gr.addColorStop(0, inner); gr.addColorStop(0.45, mid); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}
const TEX_GLOW = radialTex();

/* ---------------- 底座 ---------------- */
{
  const ped = box(22.5, 1.5, 22.5, toon(0x171a26), 0, -0.76, 0, { ol: 0.05 });
  ped.castShadow = false;
  box(22.5, 0.05, 22.5, toon(0x232b3d), 0, -0.02, 0, { cast: false });
  // 底座下方暗色光晕，把模型"压"在虚空里
  const under = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTex('rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)'),
    transparent: true, opacity: 0.65, depthWrite: false
  }));
  under.scale.set(34, 34, 1); under.position.set(0, -1.9, 0); under.renderOrder = -1;
  scene.add(under);
}

/* ---------------- 路面 / 人行道 ---------------- */
const asphaltTex = canvasTex(256, 256, (g) => {
  g.fillStyle = '#39424f'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${180 + Math.random() * 60 | 0},${190 + Math.random() * 50 | 0},210,${Math.random() * 0.07})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
  }
}, [7, 7]);
const roadMat = new THREE.MeshPhongMaterial({
  color: 0x465061, specular: 0x6e82ab, shininess: 95, map: asphaltTex
});
function sidewalkTex(rx, rz) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#a7adb8'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(90,98,112,0.55)'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
    }
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(70,78,92,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  }, [rx, rz]);
}
const sideMatA = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex, map: sidewalkTex(6, 1.6) });
const sideMatB = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex, map: sidewalkTex(1.6, 6) });
const sideMatC = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex, map: sidewalkTex(12, 1.6) });

// 车行道（前路 + 侧路，L 形街角）
box(22, 0.06, 6, roadMat, 0, 0.03, 5, { cast: false });
box(2.8, 0.06, 13, roadMat, 9.6, 0.03, -4.5, { cast: false });
// 人行道
box(19.2, GY, 3, sideMatA, -1.4, GY / 2, 0.5, { cast: false, ol: 0.03 });       // 店前
box(0.8, GY, 10, sideMatB, 7.8, GY / 2, -6, { cast: false });                    // 侧路人行道
box(22, GY, 3, sideMatC, 0, GY / 2, 9.5, { cast: false, ol: 0.03 });             // 对街
// 停车位地坪 / 小巷地面
box(3.0, GY, 3.6, phong(0x39424f, { specular: 0x6d80a6, shininess: 60 }), 5.9, GY / 2, -2.8, { cast: false });
box(2.4, GY, 10, phong(0x333b49, { specular: 0x5d6f94, shininess: 55 }), 3.2, GY / 2, -6, { cast: false });

/* --- 道路标线 --- */
const lineMat = phong(0xd9e2ec, { specular: 0xffffff, shininess: 90, emissive: 0x2a3038 });
for (let x = -10.3; x < 8; x += 1.35) box(0.72, 0.012, 0.13, lineMat, x, 0.072, 5, { cast: false });
for (let z = -10.3; z < 1.2; z += 1.35) box(0.13, 0.012, 0.72, lineMat, 9.6, 0.072, z, { cast: false });
box(2.5, 0.012, 0.34, lineMat, 9.65, 0.072, 1.62, { cast: false });               // 停止线
for (const cx of [-3.35, -2.55, -1.75, -0.95])                                    // 反光斑马线
  box(0.5, 0.014, 5.4, lineMat, cx, 0.072, 5, { cast: false });
// 排水沟 + 雨水箅（贴路缘）
box(18.8, 0.02, 0.3, basic(0x11151d), -1.4, 0.066, 2.15, { cast: false });
const grateMat = phong(0x39424f, { specular: 0x7f93bd, shininess: 80 });
for (let x = -10.4; x < 8; x += 1.3) box(0.55, 0.028, 0.22, grateMat, x, 0.074, 2.15, { cast: false });
box(2.0, 0.02, 0.26, basic(0x11151d), 3.2, GY + 0.004, -1.28, { cast: false });
// 井盖
cyl(0.42, 0.42, 0.018, 24, phong(0x252c38, { specular: 0x8fa3cc, shininess: 85 }), -6.5, 0.075, 5.1, { cast: false });
cyl(0.36, 0.36, 0.018, 24, phong(0x252c38, { specular: 0x8fa3cc, shininess: 85 }), 9.55, 0.075, -3.1, { cast: false });
// 停车位划线
const pLine = basic(0xd9e2ec);
box(0.09, 0.012, 2.9, pLine, 4.75, GY + 0.012, -2.85, { cast: false });
box(0.09, 0.012, 2.9, pLine, 6.35, GY + 0.012, -2.85, { cast: false });
box(1.7, 0.012, 0.09, pLine, 5.55, GY + 0.012, -4.3, { cast: false });
box(1.4, 0.07, 0.14, toon(0x8a929e), 5.55, GY + 0.035, -1.7, { cast: false });    // 车轮挡

/* ---------------- 积水洼（自定义着色器：湿反射 + 雨滴涟漪） ---------------- */
const puddleVert = `
  varying vec2 vUv; varying vec3 vW;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w; }`;
const puddleFrag = `
  uniform float uTime,uSeed,uStrX,uStrW,uStrDir,uStrAmt,uTintAmt;
  uniform vec3 uDeep,uSky,uStrCol,uTint;
  varying vec2 vUv; varying vec3 vW;
  float hash(float n){ return fract(sin(n)*43758.5453123); }
  void main(){
    vec2 c = vUv - 0.5;
    float r = length(c)*2.0;
    vec3 V = normalize(cameraPosition - vW);
    float grz = pow(1.0 - clamp(abs(V.y),0.0,1.0), 1.6);
    vec3 col = mix(uDeep, uSky*1.55, clamp(grz*0.9,0.0,1.0));
    float sx = vUv.x - uStrX;
    float band = exp(-(sx*sx)/(uStrW*uStrW));
    float along = pow(uStrDir > 0.5 ? (1.0 - vUv.y) : vUv.y, 1.7);
    col += uStrCol * band * along * uStrAmt;
    for(int i=0;i<3;i++){
      float tt = uTime*0.5 + uSeed*3.7 + float(i)*13.73;
      float k = floor(tt);
      float ph = fract(tt);
      vec2 rc = (vec2(hash(k*1.31+uSeed+float(i)*31.7), hash(k*2.17+uSeed+float(i)*47.9)) - 0.5)*0.85;
      float d = length(c - rc);
      float rr = ph*0.5;
      float ring = smoothstep(0.055, 0.0, abs(d - rr)) * (1.0 - ph);
      col += vec3(0.42,0.55,0.8) * ring * 0.55;
    }
    col *= mix(1.0, 0.5, smoothstep(0.8, 1.0, r));
    col = mix(col, uTint, uTintAmt);
    gl_FragColor = vec4(col, 1.0);
  }`;
const puddles = [];
function puddle(x, z, sx, sz, opt = {}) {
  const uni = {
    uTime: { value: 0 }, uSeed: { value: Math.random() * 10 },
    uDeep: { value: new THREE.Color(0x18222f) }, uSky: { value: new THREE.Color(0x33456a) },
    uStrX: { value: opt.strX ?? 0.5 }, uStrW: { value: opt.strW ?? 0.3 },
    uStrDir: { value: opt.strDir ?? 1 }, uStrAmt: { value: opt.strAmt ?? 0.4 },
    uStrCol: { value: new THREE.Color(opt.strCol ?? 0xdfe8f5) },
    uTint: { value: new THREE.Color(opt.tint ?? 0x000000) }, uTintAmt: { value: opt.tintAmt ?? 0 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, vertexShader: puddleVert, fragmentShader: puddleFrag,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(sx, sz, 1);
  m.position.set(x, opt.y ?? 0.068, z);
  m.renderOrder = 2;
  scene.add(m);
  puddles.push(m);
  return m;
}
puddle(-5.6, 4.7, 2.5, 1.7, { strCol: 0xffd9a0, strAmt: 0.55, strX: 0.46, strW: 0.34 });
puddle(-2.1, 6.7, 1.5, 1.2, { strCol: 0xdfe8f5, strAmt: 0.4 });
puddle(9.35, 4.3, 1.7, 1.4, { strCol: 0xdfe8f5, strAmt: 0.35, tint: 0x933636, tintAmt: 0.18 });
puddle(-2.9, 0.6, 0.95, 0.6, { y: GY + 0.012, strCol: 0xbfe0ff, strAmt: 0.5, strW: 0.26 });
puddle(-4.6, 9.05, 1.25, 0.8, { y: GY + 0.012, strCol: 0xffd9a3, strAmt: 0.6, strDir: -1, strW: 0.3 });
puddle(3.2, -3.3, 0.85, 0.55, { y: GY + 0.012, strCol: 0x7f95c9, strAmt: 0.25 });
puddle(5.3, -2.7, 0.7, 0.5, { y: GY + 0.012, strCol: 0xdfe8f5, strAmt: 0.3 });
puddle(-6.8, 1.55, 0.75, 0.5, { y: GY + 0.012, strCol: 0xffd9a0, strAmt: 0.35, strW: 0.26 });
const trafficPuddle = puddles[2];
/* 雨水箅位置修正：贴在路缘排水的路面上 */


/* ============================================================
   便利店主体
   ============================================================ */
const storeGroup = new THREE.Group(); scene.add(storeGroup);
const cream = toon(0xe3ddcf), tealDark = toon(0x124c52), trimDark = toon(0x333a48);
const wallIn = toon(0xf0e9da);
const glassMat = new THREE.MeshPhongMaterial({
  color: 0xa9c4e6, transparent: true, opacity: 0.16, shininess: 130,
  specular: 0x9db8e8, depthWrite: false, side: THREE.DoubleSide
});

/* 外壳墙体 */
box(0.3, 4.2, 10, cream, -10.85, 2.1, -6, { ol: 0.04 });               // 左墙
box(13, 4.2, 0.3, cream, -4.5, 2.1, -10.85, { ol: 0.04 });             // 后墙
box(0.3, 4.2, 10, cream, 1.85, 2.1, -6, { ol: 0.04 });                 // 右墙
/* 正面：上下横带 + 壁柱 + 竖框 */
box(13, 1.0, 0.3, cream, -4.5, 3.7, -1.15, { ol: 0.035 });             // 门楣带
box(13, 0.55, 0.3, tealDark, -4.5, 0.275, -1.15, { cast: false });     // 踢脚带
box(0.8, 2.65, 0.3, cream, -10.6, 1.875, -1.15, { ol: 0.03 });
box(0.14, 2.65, 0.3, cream, 1.93, 1.875, -1.15, { ol: 0.03 });
for (const mx of [-7.6, -5.0, -2.4, -0.66]) box(0.12, 2.65, 0.3, trimDark, mx, 1.875, -1.15, { cast: false });
box(1.8, 0.6, 0.3, cream, 0.3, 2.9, -1.15, { ol: 0.03 });              // 门楣
box(0.14, 2.05, 0.3, trimDark, 1.27, 1.575, -1.15, { cast: false });   // 门边柱
/* 玻璃橱窗（左侧通长 + 右侧小窗） */
const winSpans = [[-10.16, -7.68], [-7.52, -5.08], [-4.92, -2.48], [-2.32, -0.72]];
for (const [x0, x1] of winSpans) {
  const w = x1 - x0;
  plane(w, 2.6, glassMat, (x0 + x1) / 2, 1.875, -1.14, { ro: 5 });
}
plane(0.5, 2.05, glassMat, 1.6, 1.575, -1.14, { ro: 5 });
/* 门框 / 门上传感器 */
box(1.9, 0.12, 0.34, trimDark, 0.3, 2.62, -1.15, { cast: false });
box(0.1, 2.0, 0.34, trimDark, -0.58, 1.55, -1.15, { cast: false });
box(0.1, 2.0, 0.34, trimDark, 1.18, 1.55, -1.15, { cast: false });
const sensorBox = box(0.34, 0.1, 0.12, toon(0x2b303c), 0.3, 2.5, -0.98, { cast: false });
const ledMat = basic(0x57ff9a);
box(0.05, 0.03, 0.02, ledMat, 0.42, 2.52, -0.91, { cast: false });

/* --- 招牌（Canvas 文字贴图 + 闪烁） --- */
const signTex = canvasTex(2048, 200, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#0d8d84'); gr.addColorStop(1, '#0a6e74');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, h - 26, w, 26);
  // 太阳 logo
  g.fillStyle = '#ffd45e';
  g.beginPath(); g.arc(150, h / 2, 52, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffd45e'; g.lineWidth = 10;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    g.beginPath();
    g.moveTo(150 + Math.cos(a) * 64, h / 2 + Math.sin(a) * 64);
    g.lineTo(150 + Math.cos(a) * 84, h / 2 + Math.sin(a) * 84);
    g.stroke();
  }
  g.fillStyle = '#ffffff';
  g.font = 'bold 108px "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif';
  g.fillText('ヒカリマート', 260, h / 2 + 40);
  g.font = 'bold 44px "Yu Gothic", "Meiryo", sans-serif';
  g.fillStyle = '#ffe9a8';
  g.fillText('HIKARI MART', 1310, h / 2 - 12);
  g.fillStyle = '#ff8f5e';
  g.font = 'bold 52px "Yu Gothic", "Meiryo", sans-serif';
  g.fillText('24時間営業', 1310, h / 2 + 52);
});
const signMat = new THREE.MeshBasicMaterial({ map: signTex });
const signSideMat = toon(0x0b5b60);
const signMats = [signSideMat, signSideMat, signSideMat, signSideMat, signMat, signSideMat];
{
  const m = new THREE.Mesh(geoBox(11, 1.05, 0.42), signMats);
  m.position.set(-4.5, 5.32, -1.0);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  outline(m, 0.04);
}
box(11.3, 0.18, 0.5, tealDark, -4.5, 4.72, -1.0, { cast: false });
box(11.3, 0.12, 0.5, tealDark, -4.5, 5.92, -1.0, { cast: false });
const signGlow = plane(11.6, 2.0, new THREE.MeshBasicMaterial({
  map: TEX_GLOW, color: 0x4fe3d5, transparent: true, opacity: 0.30,
  blending: THREE.AdditiveBlending, depthWrite: false
}), -4.5, 5.32, -0.72, { ro: 6 });
/* 门楣上小 logo */
const logoTex = canvasTex(512, 96, (g, w, h) => {
  g.fillStyle = '#124c52'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffd45e'; g.font = 'bold 56px "Yu Gothic", "Meiryo", sans-serif';
  g.fillText('ヒカリマート', 24, 66);
  g.fillStyle = '#ffffff'; g.font = 'bold 30px "Yu Gothic", "Meiryo", sans-serif';
  g.fillText('24H', 420, 62);
});
plane(2.6, 0.5, new THREE.MeshBasicMaterial({ map: logoTex }), 0.3, 3.72, -0.99, { ro: 1 });

/* --- 屋檐雨棚 --- */
const awningGroup = new THREE.Group(); scene.add(awningGroup);
box(12.3, 0.1, 2.2, toon(0x14545c), -4.5, 3.5, 0.1, { rx: 0.09, parent: awningGroup, ol: 0.035 });
box(12.3, 0.06, 0.14, toon(0xffd45e), -4.5, 3.41, 1.18, { rx: 0.09, parent: awningGroup, cast: false });
for (const rx2 of [-9.5, -6.5, -2.5, 1.5]) {
  cyl(0.022, 0.022, 2.0, 6, toon(0x3a414d), rx2, 3.75, 0.1, { rx: 1.266, parent: awningGroup, cast: false });
}
/* 屋顶 */
box(13.3, 0.15, 10.3, toon(0x8f8878), -4.5, 4.275, -5.9, { recv: true });
box(13.3, 0.5, 0.2, cream, -4.5, 4.55, -1.0, { ol: 0.03 });
box(0.2, 0.4, 10.3, cream, -11.05, 4.5, -5.9, { cast: false });
box(0.2, 0.4, 10.3, cream, 2.05, 4.5, -5.9, { cast: false });
// 屋顶设备
for (const [ax, az] of [[-8, -4], [0.5, -8]]) {
  box(1.0, 0.55, 0.7, toon(0x9aa2ac), ax, 4.63, az, { ol: 0.03 });
  cyl(0.26, 0.26, 0.05, 20, toon(0x4a515c), ax, 4.93, az + 0.36, { rx: Math.PI / 2, cast: false });
}
cyl(0.1, 0.1, 0.7, 10, toon(0x7d848e), -1.5, 4.65, -3, { cast: false });

/* --- 自动门（两扇滑动玻璃） --- */
const doorL = plane(0.88, 1.98, glassMat, -0.15, 1.56, -1.08, { ro: 5 });
const doorR = plane(0.88, 1.98, glassMat, 0.75, 1.56, -1.08, { ro: 5 });
// 门上贴纸（跟随左门扇滑动）
const doorSticker = canvasTex(128, 128, (g) => {
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = 'bold 40px "Yu Gothic", sans-serif'; g.fillText('ひっかけ', 8, 60);
  g.font = 'bold 30px "Yu Gothic", sans-serif'; g.fillText('注意', 30, 100);
});
plane(0.34, 0.34, new THREE.MeshBasicMaterial({ map: doorSticker, transparent: true }), 0, 0.54, 0.05, { parent: doorL, ro: 6 });
/* 门口地垫 */
const matTex = canvasTex(256, 128, (g) => {
  g.fillStyle = '#2c3038'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#4d565f'; g.lineWidth = 6; g.strokeRect(10, 10, 236, 108);
  g.fillStyle = '#9aa3ad'; g.font = 'bold 44px "Yu Gothic", sans-serif';
  g.textAlign = 'center'; g.fillText('いらっしゃいませ', 128, 78);
});
box(1.75, 0.03, 0.85, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex, map: matTex }), 0.3, GY + 0.015, 0.45, { cast: false });

/* --- 营业时间牌 --- */
const hourTex = canvasTex(256, 384, (g) => {
  g.fillStyle = '#f2f3f5'; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#0a6e74'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#ffffff'; g.font = 'bold 36px "Yu Gothic", sans-serif';
  g.fillText('営業時間', 48, 44);
  g.fillStyle = '#222'; g.font = 'bold 30px "Yu Gothic", sans-serif';
  g.fillText('24時間', 70, 130); g.fillText('年中無休', 60, 180);
  g.fillStyle = '#c0392b'; g.fillRect(24, 220, 208, 44);
  g.fillStyle = '#ffffff'; g.font = 'bold 26px "Yu Gothic", sans-serif';
  g.fillText('アルバイト募集中', 34, 250);
  g.fillStyle = '#555'; g.font = '22px "Yu Gothic", sans-serif';
  g.fillText('ハイタッチ実施中', 30, 330);
});
box(0.5, 0.75, 0.06, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex, map: hourTex }), -0.95, GY + 0.38, -0.62, { ry: 0.06, ol: 0.02 });
box(0.4, 0.05, 0.3, trimDark, -0.95, GY + 0.02, -0.62, { cast: false });

/* ============================================================
   店内（透过橱窗可见）
   ============================================================ */
const interior = new THREE.Group(); scene.add(interior);
const floorTexIn = canvasTex(256, 256, (g) => {
  g.fillStyle = '#cdc6b8'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,112,98,0.5)'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
  }
}, [7, 5]);
box(12.7, 0.04, 9.7, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex, map: floorTexIn }), -4.5, 0.16, -6, { cast: false, recv: true });
box(12.7, 0.08, 9.7, new THREE.MeshToonMaterial({ color: 0xf3eee2, emissive: 0x2b2115, gradientMap: gradTex }), -4.5, 3.8, -6);
const panelMat = basic(0xfff4dd);
for (const px of [-7.5, -4.5, -1.5]) for (const pz of [-3.4, -6.6])
  box(1.9, 0.05, 0.85, panelMat, px, 3.74, pz, { cast: false });

/* --- 货架（中岛）+ 商品 --- */
const shelfBackMat = new THREE.MeshToonMaterial({ color: 0xe8e3d6, emissive: 0x241d13, gradientMap: gradTex });
function makeGondola(cx, cz) {
  const g = new THREE.Group(); g.position.set(cx, GY + 0.02, cz); interior.add(g);
  box(3.8, 0.14, 0.9, toon(0xd8d2c4), 0, 0.07, 0, { parent: g, cast: false });
  box(3.8, 2.0, 0.07, shelfBackMat, 0, 1.07, 0, { parent: g, cast: false });
  for (const side of [-1, 1]) for (const sy of [0.5, 1.0, 1.5]) {
    box(3.8, 0.045, 0.42, toon(0xf0ebe0), 0, sy - 0.023, side * 0.24, { parent: g, cast: false });
  }
  box(3.8, 0.05, 0.5, toon(0x9fb7bd), 0, 2.07, 0, { parent: g, cast: false });
}
for (const gz of [-3.9, -6.1, -8.3]) for (const gx of [-7.8, -3.2]) makeGondola(gx, gz);

const prodPalette = [0xe74c3c, 0xe67e22, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6,
  0xecf0f1, 0xe84393, 0x00b894, 0xffd45e, 0xd63031, 0x0984e3, 0xff8f5e];
const prodList = [];   // {p:[x,y,z], s:[w,h,d], c}
for (const gz of [-3.9, -6.1, -8.3]) for (const gx0 of [-9.7, -5.1]) {
  for (const side of [-1, 1]) for (const sy of [0.5, 1.0, 1.5]) {
    let x = gx0 + 0.25;
    while (x < gx0 + 3.5) {
      const w = rand(0.11, 0.2), h = rand(0.17, 0.32), d = rand(0.09, 0.13);
      prodList.push({
        p: [x + w / 2, GY + 0.02 + sy + h / 2, gz + side * (0.24 + d / 2 - 0.01)],
        s: [w, h, d], c: pick(prodPalette)
      });
      x += w + rand(0.02, 0.06);
    }
    prodList.push({ p: [gx0 + 1.9, GY + 0.02 + sy + 0.03, gz + side * 0.46], s: [2.4, 0.05, 0.02], c: 0xf7f7f2 });
  }
}
/* 饮料柜 ×3 */
function makeCooler(cx) {
  const cz = -10.28;
  box(2.0, 2.3, 0.72, toon(0xdfe6ee), cx, GY + 0.02 + 1.15, cz, { ol: 0.03 });
  box(1.66, 1.9, 0.5, basic(0xe7eef8), cx, GY + 0.02 + 1.15, cz + 0.1, { cast: false });
  for (const sy of [0.55, 1.05, 1.55])
    box(1.66, 0.04, 0.44, toon(0xc9d2dc), cx, GY + 0.02 + sy, cz + 0.1, { cast: false });
  plane(0.92, 1.86, glassMat, cx - 0.5, GY + 0.02 + 1.15, cz + 0.37, { ro: 5 });
  plane(0.92, 1.86, glassMat, cx + 0.5, GY + 0.02 + 1.15, cz + 0.37, { ro: 5 });
  box(0.06, 1.9, 0.1, trimDark, cx, GY + 0.02 + 1.15, cz + 0.38, { cast: false });
  box(1.94, 0.08, 0.1, trimDark, cx, GY + 0.02 + 2.32, cz + 0.37, { cast: false });
  for (const sy of [0.55, 1.05, 1.55]) for (let i = 0; i < 12; i++) {
    bottleList.push({
      p: [cx - 0.72 + i * 0.131, GY + 0.02 + sy + 0.125, cz + 0.1 + rand(-0.06, 0.06)],
      c: pick([0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xe84393, 0xecf0f1, 0x9b59b6, 0xff8f5e])
    });
  }
  // 柜顶灯箱
  box(1.9, 0.3, 0.08, basic(0xfff3d8), cx, GY + 0.02 + 2.48, cz + 0.32, { cast: false });
}
const bottleList = [];
makeCooler(-9.3); makeCooler(-7.15); makeCooler(-5.0);

/* 便当柜（开放型）+ 饭团柜 */
const bentoList = [];
{
  const cx = -1.7, cz = -10.28;
  box(3.0, 1.8, 0.78, toon(0xdfe6ee), cx, GY + 0.02 + 0.9, cz, { ol: 0.03 });
  box(2.8, 1.5, 0.06, basic(0xe7eef8), cx, GY + 0.02 + 0.95, cz + 0.32, { cast: false });
  for (const sy of [0.4, 0.8, 1.2]) {
    box(2.8, 0.04, 0.6, toon(0xc9d2dc), cx, GY + 0.02 + sy, cz + 0.05, { cast: false });
    for (let i = 0; i < 7; i++) for (let k = 0; k < 2; k++) {
      bentoList.push({
        p: [cx - 1.15 + i * 0.38, GY + 0.02 + sy + 0.05, cz + 0.02 + k * 0.24 - 0.1],
        c: pick([0xe74c3c, 0xf1c40f, 0x2ecc71, 0x0984e3, 0xe67e22, 0xecf0f1])
      });
    }
  }
  box(2.9, 0.26, 0.08, basic(0xfff3d8), cx, GY + 0.02 + 1.88, cz + 0.3, { cast: false });
}
const onigiriList = [];
{
  const cx = 0.75, cz = -10.28;
  box(1.1, 1.8, 0.72, toon(0xdfe6ee), cx, GY + 0.02 + 0.9, cz, { ol: 0.03 });
  for (const sy of [0.5, 0.95, 1.4]) {
    box(0.95, 0.04, 0.55, toon(0xc9d2dc), cx, GY + 0.02 + sy, cz + 0.03, { cast: false });
    for (let i = 0; i < 6; i++) {
      onigiriList.push({ p: [cx - 0.38 + i * 0.15, GY + 0.02 + sy + 0.09, cz + 0.03], r: rand(0, 3) });
    }
  }
}

/* 实例化商品网格 */
function buildInstances(list, geo, mat) {
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const col = new THREE.Color();
  list.forEach((it, i) => {
    P.set(it.p[0], it.p[1], it.p[2]);
    S.set(it.s ? it.s[0] : 1, it.s ? it.s[1] : 1, it.s ? it.s[2] : 1);
    Q.setFromEuler(new THREE.Euler(0, it.r || 0, 0));
    M4.compose(P, Q, S);
    mesh.setMatrixAt(i, M4);
    mesh.setColorAt(i, col.set(it.c));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}
buildInstances(prodList, geoBox(1, 1, 1), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex }));
buildInstances(bottleList, new THREE.CylinderGeometry(0.045, 0.045, 0.21, 8), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex }));
buildInstances(bentoList, new THREE.BoxGeometry(0.26, 0.08, 0.19), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex }));
buildInstances(onigiriList, new THREE.CylinderGeometry(0.075, 0.075, 0.15, 3), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex }));

/* --- 收银台 + 咖啡机 + 关东煮 + 炸物柜 --- */
{
  const counterMat = toon(0xe9e4d6), counterSide = toon(0x9c7b5c);
  box(1.95, 1.0, 0.72, counterMat, 0.7, GY + 0.02 + 0.5, -2.38, { ol: 0.03 });
  box(1.95, 0.06, 0.8, counterSide, 0.7, GY + 0.02 + 1.02, -2.38, { cast: false });
  // 收银机
  box(0.42, 0.3, 0.36, toon(0x3a4150), 1.15, GY + 1.2, -2.42, { ol: 0.02 });
  plane(0.3, 0.2, basic(0xbfe8c8), 1.15, GY + 1.42, -2.3, { rx: -0.35, ro: 1 });
  // 咖啡机
  box(0.38, 0.5, 0.36, toon(0x4a4f5c), -0.15, GY + 1.3, -2.42, { ol: 0.02 });
  box(0.3, 0.1, 0.2, basic(0xffe9c4), -0.15, GY + 1.2, -2.28, { cast: false });
  cyl(0.045, 0.035, 0.09, 10, toon(0xf2ede2), -0.05, GY + 1.11, -2.24, { cast: false });
  // 烟草柜背板
  box(0.8, 1.6, 0.3, toon(0x8f8b80), 1.4, GY + 0.02 + 0.8, -3.35, { cast: false });
  // 蓝色地面导视
  const guideMat = basic(0x3f8fd8);
  box(0.14, 0.012, 1.6, guideMat, 0.3, GY + 0.045, -1.7, { cast: false });
  box(0.14, 0.012, 1.2, guideMat, -1.4, GY + 0.045, -3.1, { cast: false });
  cyl(0.3, 0.3, 0.012, 20, basic(0xf1c40f), 0.7, GY + 0.045, -3.4, { cast: false });
  // 购物篮
  for (let i = 0; i < 4; i++)
    box(0.44, 0.09, 0.32, i % 2 ? toon(0xd8536a) : toon(0x5a6270), 1.5, GY + 0.06 + i * 0.095, -1.75, { ry: 0.08 * i, cast: false });
}
/* 关东煮柜台 */
const odenItems = [];
{
  const ox = -1.05, oz = -2.5;
  box(1.05, 0.95, 0.8, toon(0x9c8b74), ox, GY + 0.02 + 0.475, oz, { ol: 0.025 });
  box(0.92, 0.34, 0.66, basic(0xffb864), ox, GY + 0.02 + 0.85, oz, { cast: false });
  plane(1.0, 0.72, glassMat, ox, GY + 0.02 + 1.08, oz, { rx: 0, ro: 5 });
  box(1.05, 0.06, 0.8, toon(0x7c6e5a), ox, GY + 0.02 + 1.28, oz, { cast: false });
  for (let i = 0; i < 6; i++) {
    const px = ox - 0.36 + (i % 3) * 0.36, pz = oz - 0.16 + Math.floor(i / 3) * 0.32;
    if (i % 2) cyl(0.05, 0.05, 0.09, 10, toon(0xf5f2e8), px, GY + 1.02, pz, { cast: false });
    else box(0.11, 0.09, 0.11, toon(0x6b4a2f), px, GY + 1.0, pz, { cast: false });
    odenItems.push([px, pz]);
  }
  // 价格小旗
  for (const [px, pz] of odenItems.slice(0, 3)) {
    box(0.015, 0.18, 0.015, toon(0xf2ede2), px, GY + 1.2, pz, { cast: false });
    box(0.09, 0.06, 0.004, basic(0xd8536a), px + 0.04, GY + 1.26, pz, { cast: false });
  }
}
/* 炸物柜 */
{
  const fx = -2.1, fz = -2.5;
  box(0.75, 0.85, 0.7, toon(0x9c8b74), fx, GY + 0.02 + 0.425, fz, { ol: 0.025 });
  plane(0.68, 0.5, glassMat, fx, GY + 0.02 + 0.95, fz, { ro: 5 });
  for (let i = 0; i < 8; i++)
    cyl(0.06, 0.055, 0.05, 6, toon(0xb3762f), fx - 0.22 + (i % 4) * 0.15, GY + 0.02 + 0.9 + Math.floor(i / 4) * 0.11, fz + rand(-0.1, 0.1), { flat: true, cast: false });
}
/* 杂志架 */
{
  const mx = -4.3, mz = -2.0;
  box(1.5, 1.5, 0.35, toon(0x8f8b80), mx, GY + 0.02 + 0.75, mz, { ol: 0.025 });
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
    box(0.2, 0.3, 0.03, toon(pick(prodPalette)), mx - 0.6 + i * 0.24, GY + 0.02 + 0.45 + r * 0.42, mz + 0.19, { rx: -0.15, cast: false });
  }
}
/* 冰淇淋冷柜 */
{
  const ix = -8.6, iz = -2.2;
  box(1.6, 0.82, 0.68, toon(0xe8e4da), ix, GY + 0.02 + 0.41, iz, { ol: 0.03 });
  plane(1.5, 0.6, glassMat, ix, GY + 0.02 + 0.86, iz, { rx: -Math.PI / 2, ro: 5 });
  for (let i = 0; i < 8; i++)
    box(0.13, 0.14, 0.1, toon(pick([0xe84393, 0x3498db, 0xf1c40f, 0x2ecc71])), ix - 0.6 + (i % 4) * 0.28, GY + 0.02 + 0.88, iz - 0.15 + Math.floor(i / 4) * 0.3, { cast: false });
}
/* ATM */
{
  const ax = -10.45, az = -3.4;
  box(0.5, 1.6, 0.95, toon(0x5f7288), ax, GY + 0.02 + 0.8, az, { ol: 0.025 });
  plane(0.36, 0.26, basic(0xbfe8f5), ax + 0.26, GY + 0.02 + 1.15, az, { ry: Math.PI / 2, ro: 1 });
}
/* 店内海报（发光灯箱） */
function posterTex(title, sub, bg, fg, accent) {
  return canvasTex(256, 340, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, 340);
    g.fillStyle = accent; g.beginPath(); g.arc(128, 110, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = fg; g.font = 'bold 44px "Yu Gothic", sans-serif';
    g.textAlign = 'center'; g.fillText(title, 128, 232);
    g.font = 'bold 30px "Yu Gothic", sans-serif'; g.fillText(sub, 128, 282);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(24, 306, 208, 6);
  });
}
const lightboxMat = (t) => new THREE.MeshBasicMaterial({ map: t });
plane(0.75, 1.0, lightboxMat(posterTex('新発売', 'おにぎり ¥110', '#e8622e', '#fff8ec', '#ffd45e')), -10.69, 2.1, -5.6, { ry: Math.PI / 2, ro: 1 });
plane(0.75, 1.0, lightboxMat(posterTex('コーヒー', 'ホット / アイス', '#4a352a', '#ffe9c4', '#d8536a')), -10.69, 2.1, -7.2, { ry: Math.PI / 2, ro: 1 });
plane(0.9, 0.7, lightboxMat(posterTex('フェア', 'ポイント20倍', '#0a6e74', '#ffffff', '#ffd45e')), 1.69, 2.25, -4.6, { ry: -Math.PI / 2, ro: 1 });
/* 后场门 */
{
  box(0.07, 2.05, 0.95, toon(0xf0ede6), 1.72, GY + 0.02 + 1.02, -8.6, { ol: 0.02 });
  box(0.03, 0.08, 0.6, toon(0x8a929e), 1.68, GY + 1.1, -8.6, { cast: false });
  plane(0.3, 0.12, basic(0x4a515c), 1.67, GY + 1.6, -8.6, { ry: -Math.PI / 2, ro: 1 });
}

/* ============================================================
   邻楼 / 小巷 / 停车区
   ============================================================ */
const neighborMat = toon(0x4a5266), neighborDark = toon(0x3a4152);
box(3.0, 5.6, 6.4, neighborMat, 5.9, 2.8, -7.8, { ol: 0.045 });        // 邻楼
box(3.2, 0.5, 0.2, neighborDark, 5.9, 5.75, -4.68, { ol: 0.03 });
box(3.2, 0.5, 6.4, neighborDark, 5.9, 5.75, -7.8, { cast: false });
/* 邻楼窗 */
box(0.9, 1.1, 0.08, trimDark, 5.35, 3.5, -4.63, { cast: false });
plane(0.74, 0.94, basic(0x1a2438), 5.35, 3.5, -4.58, { ro: 1 });
box(0.9, 1.1, 0.08, trimDark, 6.55, 2.5, -4.63, { cast: false });
plane(0.74, 0.94, basic(0xffd9a0), 6.55, 2.5, -4.58, { ro: 1 });
box(0.74, 0.05, 0.02, toon(0x6b4a2f), 6.55, 2.62, -4.56, { cast: false });
/* 空调外机 + 水箱 + 水管 */
box(0.75, 0.55, 0.35, toon(0x9aa2ac), 4.75, 1.05, -4.62, { ol: 0.025 });
cyl(0.24, 0.24, 0.04, 18, toon(0x4a515c), 4.75, 1.05, -4.44, { rx: Math.PI / 2, cast: false });
cyl(0.55, 0.55, 0.95, 16, toon(0x9aa2ac), 5.9, 6.45, -7.6, { ol: 0.03 });
for (const [lx, lz] of [[5.5, -7.2], [6.3, -8.0]]) box(0.08, 0.5, 0.08, toon(0x5a6270), lx, 5.85, lz, { cast: false });
cyl(0.05, 0.05, 4.6, 8, toon(0x8a929e), 7.28, 2.4, -5.4, { cast: false });
cyl(0.05, 0.05, 4.6, 8, toon(0x8a929e), 7.28, 2.4, -6.1, { cast: false });
/* 竖版霓虹招牌（偶发闪烁） */
const neonTex = canvasTex(128, 512, (g) => {
  g.fillStyle = '#241522'; g.fillRect(0, 0, 128, 512);
  g.strokeStyle = '#ff5fa2'; g.lineWidth = 6; g.strokeRect(10, 10, 108, 492);
  g.fillStyle = '#ff9ec6'; g.font = 'bold 64px "Yu Gothic", sans-serif';
  g.textAlign = 'center';
  g.fillText('ス', 64, 100); g.fillText('ナ', 64, 190); g.fillText('ッ', 64, 280);
  g.fillText('ク', 64, 370);
  g.fillStyle = '#5ee8ff'; g.font = 'bold 84px "Yu Gothic", sans-serif';
  g.fillText('潮', 64, 478);
});
const neonMat = new THREE.MeshBasicMaterial({ map: neonTex });
box(0.44, 2.1, 0.2, neonMat, 7.12, 3.5, -4.5, { ol: 0.03 });
const neonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: TEX_GLOW, color: 0xff5fa2, transparent: true, opacity: 0.35,
  blending: THREE.AdditiveBlending, depthWrite: false
}));
neonGlow.scale.set(2.4, 3.4, 1); neonGlow.position.set(7.12, 3.5, -4.3); scene.add(neonGlow);
/* 公告栏 */
const boardTex = canvasTex(256, 180, (g) => {
  g.fillStyle = '#6b5642'; g.fillRect(0, 0, 256, 180);
  g.fillStyle = '#e8e2d2'; g.fillRect(14, 14, 108, 70); g.fillRect(134, 14, 108, 70);
  g.fillRect(14, 96, 108, 70); g.fillRect(134, 96, 108, 70);
  g.fillStyle = '#c0392b'; g.fillRect(20, 20, 96, 14);
  g.fillStyle = '#2980b9'; g.fillRect(140, 20, 96, 14);
  g.fillStyle = '#8a8378'; g.font = '16px "Yu Gothic", sans-serif';
  g.fillText('お知らせ', 30, 56); g.fillText('募集', 156, 56);
  g.fillText('地図', 30, 140); g.fillText('チラシ', 150, 140);
});
box(1.25, 0.9, 0.12, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex, map: boardTex }), 5.6, 1.8, -4.55, { ol: 0.025 });
/* 邻楼墙上小海报 */
plane(0.6, 0.85, lightboxMat(posterTex('募集', 'アルバイト', '#2c3e50', '#ecf0f1', '#e67e22')), 4.42, 2.6, -6.4, { ry: -Math.PI / 2, ro: 1 });

/* --- 小巷内容 --- */
box(2.4, 2.4, 0.15, toon(0x30364a), 3.2, 1.2, -10.9, { cast: false });       // 巷底围墙
box(0.72, 0.5, 0.32, toon(0x9aa2ac), 2.32, 0.95, -5.5, { ol: 0.025 });       // 空调外机×2
cyl(0.2, 0.2, 0.04, 18, toon(0x4a515c), 2.32, 0.95, -5.33, { rx: Math.PI / 2, cast: false });
box(0.72, 0.5, 0.32, toon(0x9aa2ac), 2.32, 2.0, -7.5, { ol: 0.025 });
cyl(0.2, 0.2, 0.04, 18, toon(0x4a515c), 2.32, 2.0, -7.33, { rx: Math.PI / 2, cast: false });
box(0.4, 0.6, 0.16, toon(0x7d848e), 2.16, 1.35, -3.5, { cast: false });      // 电表箱
box(0.4, 0.6, 0.16, toon(0x7d848e), 2.16, 1.35, -4.2, { cast: false });
cyl(0.04, 0.04, 3.6, 8, toon(0x8a929e), 2.1, 1.96, -9.6, { cast: false });   // 落水管
for (let i = 0; i < 3; i++)                                                   // 纸箱
  box(0.55, 0.3, 0.42, toon(0xa8845a), 3.6, GY + 0.16 + i * 0.31, -8.6, { ry: rand(-0.2, 0.2), cast: false });
/* 巷内壁灯 */
cyl(0.09, 0.12, 0.12, 12, basic(0xffe2b0), 4.34, 2.7, -4.9, { rx: Math.PI / 2, cast: false });
const alleyLight = downSpot(0xffc98a, 3.2, 4.5, 4.12, 2.62, -4.9, 0.95, 0.6);

/* --- 自行车 ×2 --- */
function makeBike(x, z, rot, col) {
  const g = new THREE.Group(); g.position.set(x, GY + 0.02, z); g.rotation.y = rot; scene.add(g);
  const dark = toon(0x2b2f38);
  for (const wx of [-0.46, 0.46]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.024, 8, 22), dark);
    wheel.rotation.y = Math.PI / 2; wheel.position.set(wx, 0.27, 0);
    wheel.castShadow = true; g.add(wheel);
  }
  const frame = toon(col);
  const tube = (a, b, r = 0.018) => {
    const v = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 6), frame);
    m.position.copy(a).addScaledVector(v, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
    m.castShadow = true; g.add(m);
  };
  const A = new THREE.Vector3(-0.42, 0.28, 0), B = new THREE.Vector3(0.1, 0.62, 0),
    C = new THREE.Vector3(0.42, 0.28, 0), D = new THREE.Vector3(-0.05, 0.72, 0),
    E = new THREE.Vector3(0.16, 0.95, 0), F = new THREE.Vector3(0.42, 0.72, 0);
  tube(A, B); tube(B, C); tube(A, D); tube(D, B); tube(D, E); tube(E, F); tube(F, C);
  box(0.3, 0.05, 0.1, dark, -0.08, 0.78, 0, { parent: g, cast: false });               // 车座
  box(0.06, 0.06, 0.4, dark, 0.44, 1.0, 0, { parent: g, cast: false });                // 车把
  box(0.26, 0.2, 0.26, toon(0xcfd6dd), 0.52, 0.82, 0, { parent: g, ol: 0.015 });       // 车筐
}
makeBike(6.85, -2.55, 0.06, 0x2e86a8);
makeBike(6.85, -3.35, -0.04, 0xc0504a);
box(1.4, 0.05, 0.05, toon(0x8a929e), 6.85, GY + 0.36, -2.2, { cast: false });
box(1.4, 0.05, 0.05, toon(0x8a929e), 6.85, GY + 0.36, -3.0, { cast: false });
/* 停车标志 P */
const pTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#1a5fb4'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff'; g.font = 'bold 92px Arial'; g.textAlign = 'center';
  g.fillText('P', 64, 98);
});
box(0.05, 2.0, 0.05, toon(0x8a929e), 7.1, GY + 1.0, -1.5, { cast: false });
box(0.42, 0.42, 0.03, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex, map: pTex }), 7.1, GY + 1.85, -1.5, { ol: 0.015 });

/* ============================================================
   街道设施
   ============================================================ */
/* --- 电线杆 + 电线 --- */
const poleX = 3.2, poleZ = -0.25;
cyl(0.095, 0.115, 6.8, 10, toon(0x747a80), poleX, 3.4, poleZ, { ol: 0.025 });
cyl(0.3, 0.3, 0.12, 12, toon(0x5a6270), poleX, 0.1, poleZ, { cast: false });
box(0.5, 0.7, 0.4, toon(0x8f959b), poleX + 0.32, 4.5, poleZ, { ol: 0.03 });   // 变压器
cyl(0.16, 0.16, 0.1, 12, toon(0x5a6270), poleX + 0.32, 5.0, poleZ, { cast: false });
box(1.1, 0.07, 0.07, toon(0x4a515c), poleX, 6.28, poleZ, { cast: false });
box(0.07, 0.07, 0.9, toon(0x4a515c), poleX, 6.0, poleZ, { cast: false });
box(0.3, 0.4, 0.2, toon(0x9aa2ac), poleX + 0.14, 1.6, poleZ + 0.12, { cast: false });
function wire(a, b, sag, r = 0.016, col = 0x171a22) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, r, 5), basic(col));
  m.castShadow = false; scene.add(m);
  return m;
}
const PT = new THREE.Vector3(poleX, 6.32, poleZ);
wire(PT, new THREE.Vector3(-13.2, 5.6, 1.1), 0.75);
wire(PT.clone().add(new THREE.Vector3(0, 0.28, 0.14)), new THREE.Vector3(-13.2, 6.0, -2.1), 0.9);
wire(PT.clone().add(new THREE.Vector3(0.14, 0.14, 0)), new THREE.Vector3(9.55, 4.55, 9.7), 0.55);
wire(PT.clone().add(new THREE.Vector3(0, -0.2, 0)), new THREE.Vector3(6.1, 5.9, -4.5), 0.45);
wire(PT.clone().add(new THREE.Vector3(0.12, -0.34, 0)), new THREE.Vector3(4.3, 6.7, -12.6), 0.7);

/* --- 路灯 --- */
const lampX = -4.5, lampZ = 9.5;
cyl(0.07, 0.09, 5.5, 10, toon(0x6a7076), lampX, 2.75, lampZ, { ol: 0.025 });
cyl(0.2, 0.24, 0.14, 12, toon(0x5a6270), lampX, 0.12, lampZ, { cast: false });
const armLamp = cyl(0.05, 0.05, 1.35, 8, toon(0x6a7076), lampX, 5.42, 8.9, { rx: Math.PI / 2 - 0.18, cast: false });
box(0.72, 0.15, 0.38, toon(0x3a4150), lampX, 5.52, 8.3, { ol: 0.02 });
plane(0.6, 0.3, basic(0xffe9c0), lampX, 5.44, 8.3, { rx: Math.PI / 2, ro: 1 });
const lampGlowCone = new THREE.Mesh(
  new THREE.ConeGeometry(1.9, 5.3, 24, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd9a3, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
);
lampGlowCone.position.set(lampX, 2.85, 8.3); lampGlowCone.renderOrder = 7; scene.add(lampGlowCone);
const lampPool = plane(5.2, 5.2, new THREE.MeshBasicMaterial({
  map: TEX_GLOW, color: 0xffd9a3, transparent: true, opacity: 0.2,
  blending: THREE.AdditiveBlending, depthWrite: false
}), lampX, 0.02, 8.3, { rx: -Math.PI / 2, ro: 3 });
const spot = new THREE.SpotLight(0xffd9a3, 16, 15, 0.62, 0.5, 1.5);
spot.position.set(lampX, 5.45, 8.3);
spot.target.position.set(lampX, 0, 8.3);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.bias = -0.0004;
scene.add(spot, spot.target);

/* --- 交通信号灯 --- */
const tl = { x: 9.6, z: 9.75 };
cyl(0.07, 0.09, 4.5, 10, toon(0x4a515c), tl.x, 2.25, tl.z, { ol: 0.025 });
cyl(0.18, 0.22, 0.12, 12, toon(0x3a4150), tl.x, 0.1, tl.z, { cast: false });
box(0.54, 1.42, 0.36, toon(0x2f3542), tl.x, 4.1, tl.z, { ol: 0.03 });
const tlMats = {
  r: basic(0x220a0a), y: basic(0x221c08), g: basic(0x0a2214)
};
const lampCols = { r: 0xff4d4d, y: 0xffd23f, g: 0x39e07f };
[['r', 4.6], ['y', 4.1], ['g', 3.6]].forEach(([k, y]) => {
  cyl(0.125, 0.125, 0.05, 16, tlMats[k], tl.x, y, tl.z + 0.19, { rx: Math.PI / 2, cast: false });
  box(0.3, 0.05, 0.14, toon(0x2f3542), tl.x, y + 0.14, tl.z + 0.2, { cast: false });
});
const tlGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: TEX_GLOW, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false
}));
tlGlow.scale.set(1.1, 1.1, 1); tlGlow.position.set(tl.x, 3.6, tl.z + 0.35); scene.add(tlGlow);
/* 路口凸面镜 */
{
  const mx2 = 7.82, mz2 = 1.3;
  cyl(0.045, 0.055, 2.3, 8, toon(0x8a929e), mx2, GY + 1.15, mz2, { cast: false });
  const mir = cyl(0.3, 0.3, 0.05, 20, phong(0xbfd4e8, { specular: 0xffffff, shininess: 140 }), mx2, GY + 2.2, mz2, { rx: Math.PI / 2, ry: -2.35, ol: 0.02 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 24), toon(0xe8a13c));
  rim.position.set(0, 0.03, 0); rim.castShadow = false; mir.add(rim);
}

/* --- 护栏 --- */
{
  const railMat = toon(0xb9c0c9);
  box(18.2, 0.05, 0.05, railMat, -1.5, GY + 0.62, 8.14, { cast: false });
  box(18.2, 0.05, 0.05, railMat, -1.5, GY + 0.4, 8.14, { cast: false });
  for (let x = -10.5; x < 7.7; x += 1.4) box(0.06, 0.62, 0.06, railMat, x, GY + 0.32, 8.14, { cast: false });
}
/* --- 人行横道标志 --- */
const crossTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#1a5fb4'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(64, 22); g.lineTo(108, 100); g.lineTo(20, 100); g.closePath(); g.fill();
  g.fillStyle = '#1a5fb4';
  g.beginPath(); g.arc(64, 58, 9, 0, Math.PI * 2); g.fill();
  g.fillRect(52, 68, 24, 18);
});
box(0.05, 2.3, 0.05, toon(0x8a929e), -4.15, GY + 1.15, 0.9, { cast: false });
box(0.42, 0.42, 0.03, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex, map: crossTex }), -4.15, GY + 2.15, 0.9, { ol: 0.015 });

/* --- 自动贩卖机 --- */
const vendTex = canvasTex(512, 880, (g, w, h) => {
  g.fillStyle = '#e8ebee'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, 110);
  g.fillStyle = '#ffffff'; g.font = 'bold 58px "Yu Gothic", sans-serif';
  g.fillText('つめた〜い', 30, 76);
  const cols = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e84393', '#9b59b6', '#ff8f5e', '#0984e3'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const x = 34 + c * 68, y = 150 + r * 92;
    g.fillStyle = cols[(r * 4 + c) % 8];
    g.fillRect(x, y, 52, 66);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y + 40, 52, 12);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + 66, 52, 8);
  }
  g.fillStyle = '#2b3038'; g.fillRect(330, 150, 150, 380);
  g.fillStyle = '#4a515c'; g.fillRect(348, 170, 114, 300);
  g.fillStyle = '#12151c'; g.fillRect(348, 560, 114, 60);
  g.fillStyle = '#f1c40f'; g.font = 'bold 30px Arial'; g.fillText('¥', 395, 600);
  g.fillStyle = '#dfe3e8'; g.fillRect(30, 560, 270, 70);
  g.fillStyle = '#9aa3ad'; g.font = 'bold 34px "Yu Gothic", sans-serif';
  g.fillText('あたたか〜い', 44, 606);
  g.fillStyle = '#c0392b'; g.fillRect(30, 680, 460, 120);
  g.fillStyle = '#ffffff'; g.font = 'bold 44px "Yu Gothic", sans-serif';
  g.fillText('ヒカリマート', 60, 752);
});
const vendMat = new THREE.MeshBasicMaterial({ map: vendTex });
const vendSideMat = toon(0xe8ebee);
const vendMats = [vendSideMat, vendSideMat, vendSideMat, vendSideMat, vendMat, vendSideMat];
{
  const m = new THREE.Mesh(geoBox(1.15, 1.85, 0.72), vendMats);
  m.position.set(-2.9, GY + 0.94, -0.52);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  outline(m, 0.035);
}
box(1.15, 0.16, 0.76, toon(0x333a48), -2.9, GY + 0.08, -0.52, { cast: false });
const vendLight = downSpot(0xbfe0ff, 3.0, 3.6, -2.9, 1.75, -0.2, 1.0, 0.65);
const vendGlow = plane(2.4, 1.6, new THREE.MeshBasicMaterial({
  map: TEX_GLOW, color: 0x9fc8ff, transparent: true, opacity: 0.22,
  blending: THREE.AdditiveBlending, depthWrite: false
}), -2.9, GY + 0.015, 0.35, { rx: -Math.PI / 2, ro: 3 });
/* 贩卖机旁垃圾桶 */
cyl(0.27, 0.24, 0.78, 14, toon(0x6a7076), -3.85, GY + 0.39, -0.45, { ol: 0.02 });
cyl(0.28, 0.28, 0.05, 14, toon(0x3a4150), -3.85, GY + 0.8, -0.45, { cast: false });
cyl(0.2, 0.18, 0.6, 14, toon(0x2e6da8), -4.35, GY + 0.3, -0.45, { ol: 0.02 });

/* --- 雨伞架 + 雨伞 --- */
box(0.5, 0.09, 0.5, toon(0x3a4150), 1.78, GY + 0.05, -0.45, { ol: 0.02 });
function closedUmbrella(x, z, tilt, col) {
  const g = new THREE.Group(); g.position.set(x, GY + 0.4, z); g.rotation.z = tilt; scene.add(g);
  cyl(0.028, 0.045, 0.75, 8, toon(col), 0, 0, 0, { parent: g, cast: false });
  cyl(0.012, 0.012, 0.2, 6, toon(0x2b2f38), 0, -0.45, 0, { parent: g, cast: false });
}
closedUmbrella(1.66, -0.55, 0.09, 0xc0504a);
closedUmbrella(1.9, -0.38, -0.07, 0x2e6da8);
{ // 靠墙撑开的一把
  const g = new THREE.Group(); g.position.set(2.0, GY + 0.5, -0.78); g.rotation.z = 0.68; g.rotation.x = 0.15; scene.add(g);
  const cano = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.28, 10, 1, true), toon(0x4a6fa8));
  cano.material.side = THREE.DoubleSide; cano.castShadow = true; g.add(cano);
  cyl(0.012, 0.012, 1.1, 6, toon(0x2b2f38), 0, -0.5, 0, { parent: g, cast: false });
}

/* --- 猫 --- */
let catTail;
{
  const g = new THREE.Group(); g.position.set(-2.02, GY + 0.02, -0.32); g.rotation.y = 0.5; scene.add(g);
  const black = toon(0x1c1e24, { flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), black);
  body.scale.set(1, 1.1, 1.25); body.position.y = 0.17; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), black);
  head.position.set(0, 0.36, 0.1); head.castShadow = true; g.add(head);
  for (const ex of [-0.05, 0.05]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), black);
    ear.position.set(ex, 0.45, 0.09); g.add(ear);
  }
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), toon(0xe8e6df));
  chest.position.set(0, 0.3, 0.19); g.add(chest);
  catTail = new THREE.Group(); catTail.position.set(0, 0.14, -0.18); g.add(catTail);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.12, -0.08),
    new THREE.Vector3(0.16, 0.3, -0.04), new THREE.Vector3(0.1, 0.42, 0.04)
  ]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 12, 0.022, 6), black);
  tail.castShadow = true; catTail.add(tail);
}

/* ============================================================
   灯光
   ============================================================ */
scene.add(new THREE.HemisphereLight(0x35426b, 0x1a1c28, 0.58));
const moon = new THREE.DirectionalLight(0x9fb6ff, 0.72);
moon.position.set(-11, 17, -9);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -15; moon.shadow.camera.right = 15;
moon.shadow.camera.top = 15; moon.shadow.camera.bottom = -15;
moon.shadow.camera.near = 2; moon.shadow.camera.far = 50;
moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02;
scene.add(moon);
/* 路口冷色补光，避免侧路死黑 */
const cornerFill = new THREE.PointLight(0x7f9fd8, 6, 14, 1.8);
cornerFill.position.set(9.4, 5.6, 4.6); scene.add(cornerFill);
const shopLight1 = downSpot(0xffdcae, 44, 16, -5.5, 3.45, -5.5, 1.25, 0.55);
const shopLight2 = downSpot(0xffdcae, 40, 15, 0.3, 3.35, -3.2, 1.25, 0.55);
const shopLight3 = downSpot(0xffe2b8, 26, 12, -2.5, 3.25, -2.2, 1.25, 0.55);
/* 打向后墙货柜的补光（开启投影，避免光锥穿过天花板漏到屋顶） */
const backFill = new THREE.SpotLight(0xffe2b8, 30, 14, 0.85, 0.6, 1.55);
backFill.position.set(-4.5, 3.0, -2.4);
backFill.target.position.set(-4.5, 1.0, -10.2);
backFill.castShadow = true;
backFill.shadow.mapSize.set(1024, 1024);
backFill.shadow.bias = -0.0003;
scene.add(backFill, backFill.target);
/* 橱窗光洒 */
const spillTex = canvasTex(64, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
});
plane(10.5, 3.2, new THREE.MeshBasicMaterial({
  map: spillTex, color: 0xffd9a0, transparent: true, opacity: 0.13,
  blending: THREE.AdditiveBlending, depthWrite: false
}), -4.6, GY + 0.02, 0.7, { rx: -Math.PI / 2, ro: 3 });

/* --- 星空 / 月亮 --- */
{
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 90; i++) {
    const a = rand(0, Math.PI * 2), r2 = rand(30, 60), y = rand(12, 42);
    sp.push(Math.cos(a) * r2, y, Math.sin(a) * r2);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xbfd0f0, size: 0.14, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  scene.add(stars);
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTex('rgba(225,235,255,1)', 'rgba(200,215,255,0.35)'),
    transparent: true, opacity: 0.95, depthWrite: false, fog: false
  }));
  moonSprite.scale.set(6, 6, 1); moonSprite.position.set(-20, 24, -26); scene.add(moonSprite);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX_GLOW, color: 0x9fb6ff, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  halo.scale.set(18, 18, 1); halo.position.copy(moonSprite.position); scene.add(halo);
}

/* ============================================================
   动效：降雨 / 玻璃水痕 / 檐滴水 / 门 / 闪烁 / 信号灯
   ============================================================ */

/* --- 降雨（着色器驱动，零 CPU 更新） --- */
{
  const N = 620, H = 15;
  const base = new Float32Array(N * 2 * 3);
  const end = new Float32Array(N * 2);
  const spd = new Float32Array(N * 2);
  const len = new Float32Array(N * 2);
  const slx = new Float32Array(N * 2);
  const slz = new Float32Array(N * 2);
  let i = 0;
  const insideBuilding = (x, z) =>
    (x > -11.3 && x < 2.2 && z > -11.3 && z < 1.35) ||
    (x > 4.2 && x < 7.6 && z > -11.3 && z < -4.4);
  while (i < N) {
    const x = rand(-12.5, 12.5), z = rand(-12.5, 12.5);
    if (insideBuilding(x, z)) continue;
    const s = rand(9, 14), l = rand(0.2, 0.36), wx = rand(-0.55, -0.3), wz = rand(-0.1, 0.1);
    for (let v = 0; v < 2; v++) {
      base.set([x, rand(0.2, H), z], (i * 2 + v) * 3);
      end[i * 2 + v] = v; spd[i * 2 + v] = s; len[i * 2 + v] = l;
      slx[i * 2 + v] = wx; slz[i * 2 + v] = wz;
    }
    i++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  geo.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  geo.setAttribute('aSpd', new THREE.BufferAttribute(spd, 1));
  geo.setAttribute('aLen', new THREE.BufferAttribute(len, 1));
  geo.setAttribute('aSlx', new THREE.BufferAttribute(slx, 1));
  geo.setAttribute('aSlz', new THREE.BufferAttribute(slz, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 7, 0), 30);
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uH: { value: H } },
    vertexShader: `
      attribute vec3 aBase; attribute float aEnd,aSpd,aLen,aSlx,aSlz;
      uniform float uTime,uH;
      varying float vA;
      void main(){
        vec3 p = aBase;
        p.y = mod(aBase.y - uTime*aSpd, uH);
        p.x += aEnd*aSlx; p.z += aEnd*aSlz; p.y -= aEnd*aLen;
        vA = aEnd > 0.5 ? 0.05 : 0.22;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){ gl_FragColor = vec4(0.62,0.72,0.92, vA); }`
  });
  const rain = new THREE.LineSegments(geo, rainMat);
  rain.renderOrder = 20; rain.frustumCulled = false;
  scene.add(rain);
  window.__rainMat = rainMat;
}

/* --- 玻璃雨水滑落 --- */
{
  const streaks = [];
  const wins = [[-10.16, -0.72], [1.34, 1.86]];
  for (const [x0, x1] of wins) {
    const n = Math.max(2, Math.round((x1 - x0) / 1.0));
    for (let k = 0; k < n; k++) streaks.push({ x: rand(x0 + 0.1, x1 - 0.1), seed: Math.random() });
  }
  const geos = [];
  for (const s of streaks) {
    const g = new THREE.PlaneGeometry(0.032, 0.3);
    g.translate(s.x, 0, -1.0);
    const cnt = g.attributes.position.count;
    const seed = new Float32Array(cnt).fill(s.seed);
    const y0 = new Float32Array(cnt).fill(0.6);
    const wh = new Float32Array(cnt).fill(2.5);
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aY0', new THREE.BufferAttribute(y0, 1));
    g.setAttribute('aWH', new THREE.BufferAttribute(wh, 1));
    geos.push(g);
  }
  const merged = mergeGeos(geos);
  const gmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSeed,aY0,aWH; uniform float uTime; varying vec2 vUv; varying float vF;
      void main(){
        vUv = uv;
        float sp = 0.045 + fract(aSeed*7.31)*0.05;
        float y = aY0 + fract(aSeed + uTime*sp) * aWH;
        vec3 p = position; p.y = y + uv.y*0.3;
        vF = fract(aSeed + uTime*sp);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv; varying float vF;
      void main(){
        float a = smoothstep(0.0,0.25,vUv.y) * smoothstep(1.0,0.65,vUv.y);
        a *= (0.25 + 0.75*vUv.y) * 0.5 * smoothstep(0.0,0.15,vF);
        gl_FragColor = vec4(0.78,0.86,0.98, a);
      }`
  });
  const m = new THREE.Mesh(merged, gmat);
  m.renderOrder = 9; m.frustumCulled = false;
  scene.add(m);
  window.__glassMat = gmat;
}
function mergeGeos(list) {
  // 简单合并：仅 position/uv + 自定义 float 属性
  const attrs = ['position', 'uv', 'aSeed', 'aY0', 'aWH', 'normal'];
  const out = new THREE.BufferGeometry();
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  for (const name of attrs) {
    if (!list[0].attributes[name]) continue;
    const item = list[0].attributes[name].itemSize;
    const arr = new Float32Array(total * item);
    let off = 0;
    for (const g of list) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, item));
  }
  const idx = []; let base = 0;
  for (const g of list) {
    const ix = g.index ? g.index.array : null;
    if (ix) for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base);
    base += g.attributes.position.count;
  }
  out.setIndex(idx);
  return out;
}

/* --- 屋檐滴水 --- */
const drips = [];
const dripSpots = [[-7.5, 1.12], [-3.0, 1.12], [1.7, 1.12]];
const dripMat = new THREE.MeshBasicMaterial({ color: 0xb9d4f2, transparent: true, opacity: 0.85 });
for (const [dx, dz] of dripSpots) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.24, 6), dripMat.clone());
  m.visible = false; scene.add(m);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.085, 20),
    new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.set(dx, GY + 0.02, dz); ring.renderOrder = 4;
  scene.add(ring);
  drips.push({ x: dx, z: dz, mesh: m, ring, t: rand(0.2, 1.6), active: false, vy: 0, ringT: 1 });
}
/* 关东煮蒸汽 */
const steams = [];
for (let i = 0; i < 3; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX_GLOW, color: 0xfff2e0, transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  s.scale.set(0.5, 0.5, 1);
  const base2 = odenItems[i % odenItems.length];
  s.position.set(base2[0], GY + 1.3, base2[1]);
  scene.add(s);
  steams.push({ s, t: rand(0, 1), bx: base2[0], bz: base2[1] });
}

/* --- 状态机：门 / 闪烁 / 信号灯 --- */
const doorState = { phase: 'closed', t: rand(4, 9), cur: 0 };
const flick = { sign: { next: 2.5, until: 0, mode: 0 }, neon: { next: 4, until: 0, mode: 0 } };
const tlState = { seq: [['g', 4.6], ['y', 1.2], ['r', 2.9]], i: 2, t: 2.0 };
const tlTarget = new THREE.Color(0x39e07f);

/* ---------------- 主循环 ---------------- */
const clock = new THREE.Clock();
let elapsed = 0;
let lastT = performance.now();
const MIN_DT = 1 / FPS - 0.002;

/* 仅自动化测试时启用（?still=1）：完全停掉渲染循环，按需单帧步进，CPU 占用趋近于零 */
if (params.has('still')) {
  window.__state = () => ({
    elapsed: +elapsed.toFixed(2),
    door: doorState.phase,
    signal: tlState.seq[tlState.i][0],
    signFlicker: flick.sign.mode,
    neonFlicker: flick.neon.mode,
    errors: window.__errors
  });
  window.__step = (dt = 1 / 30) => {
    lastT = performance.now();
    update(dt);
    renderer.render(scene, camera);
    window.__sceneReady = true;
    return window.__state();
  };
} else {
  function tick(now) {
    window.__frames = (window.__frames || 0) + 1;
    const dt = (now - lastT) / 1000;
    if (dt >= MIN_DT) {
      lastT = now;
      update(Math.min(dt, 0.1));
      renderer.render(scene, camera);
      if (!window.__sceneReady) window.__sceneReady = true;
    }
    // 可见时走 rAF（受 FPS 上限约束）；窗口被遮挡时降频到约 10fps，进一步降低占用
    if (document.hidden) setTimeout(() => tick(performance.now()), 100);
    else requestAnimationFrame(tick);
  }
  tick(performance.now());
}

// 仅自动化测试时启用的画面读回（对正常访问无任何影响）
if (params.has('test') || params.has('still')) {
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 1280; bgCanvas.height = 720;
  const bgCtx = bgCanvas.getContext('2d');
  window.__cam = (px, py, pz, tx = 0, ty = 1.2, tz = 0) => {
    camera.position.set(px, py, pz);
    controls.target.set(tx, ty, tz);
    controls.update();
    return 'ok';
  };
  window.__toggleLight = (i) => {
    const L = [shopLight1, shopLight2, shopLight3, alleyLight, vendLight, spot, moon, backFill, cornerFill];
    L[i].visible = !L[i].visible;
    return L.map(x => x.visible);
  };
  window.__pick = (x, z, y = 30) => {
    const rc = new THREE.Raycaster();
    rc.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0));
    const targets = [];
    scene.traverse(o => { if (o.isMesh && o.matrixWorld) targets.push(o); });
    const hits = rc.intersectObjects(targets, false);
    return hits.slice(0, 3).map(h => ({
      y: +h.point.y.toFixed(2),
      mat: h.object.material && h.object.material.type,
      col: h.object.material && h.object.material.color ? h.object.material.color.getHexString() : null
    }));
  };
  window.__shot = () => {
    renderer.render(scene, camera);
    const g = bgCtx.createRadialGradient(640, 130, 60, 640, 400, 900);
    g.addColorStop(0, '#1b2445'); g.addColorStop(0.42, '#10162e');
    g.addColorStop(0.78, '#080b1a'); g.addColorStop(1, '#05070f');
    bgCtx.fillStyle = g; bgCtx.fillRect(0, 0, 1280, 720);
    bgCtx.drawImage(renderer.domElement, 0, 0, 1280, 720);
    return bgCanvas.toDataURL('image/png');
  };
}

function update(dt) {
  elapsed += dt;
  const t = elapsed;

  // 降雨 / 玻璃水痕 / 涟漪
  window.__rainMat.uniforms.uTime.value = t;
  window.__glassMat.uniforms.uTime.value = t;
  for (const p of puddles) p.material.uniforms.uTime.value = t;

  // 自动门
  const D = doorState;
  D.t -= dt;
  if (D.phase === 'closed' && D.t <= 0) { D.phase = 'opening'; D.t = 0.8; }
  else if (D.phase === 'opening' && D.t <= 0) { D.phase = 'open'; D.t = rand(2.2, 3.4); }
  else if (D.phase === 'open' && D.t <= 0) { D.phase = 'closing'; D.t = 0.8; }
  else if (D.phase === 'closing' && D.t <= 0) { D.phase = 'closed'; D.t = rand(6, 14); }
  let k = 0;
  if (D.phase === 'opening') k = 1 - Math.max(D.t, 0) / 0.8;
  else if (D.phase === 'open') k = 1;
  else if (D.phase === 'closing') k = Math.max(D.t, 0) / 0.8;
  k = k * k * (3 - 2 * k);
  doorL.position.x = -0.15 - 1.0 * k;
  doorR.position.x = 0.75 + 0.78 * k;
  ledMat.color.setHex(Math.floor(t * 1.6) % 2 ? 0x57ff9a : 0x1a4a2c);

  // 招牌闪烁
  const F = flick.sign;
  let sf = 1;
  if (F.mode === 0 && t > F.next) { F.mode = 1; F.until = t + rand(0.2, 0.45); }
  else if (F.mode === 1) {
    sf = Math.sin(t * 90) > 0 ? 1 : 0.28;
    if (Math.random() < 0.06) sf = 0.55;
    if (t > F.until) { F.mode = 0; F.next = t + rand(3.5, 9); sf = 1; }
  }
  signMat.color.setScalar(0.18 + 0.82 * sf);
  signGlow.material.opacity = 0.3 * sf;

  // 霓虹闪烁
  const N2 = flick.neon;
  let nf = 1;
  if (N2.mode === 0 && t > N2.next) { N2.mode = 1; N2.until = t + rand(0.35, 0.9); }
  else if (N2.mode === 1) {
    nf = Math.sin(t * 60 + 2) > -0.2 ? 1 : 0.12;
    if (t > N2.until) { N2.mode = 0; N2.next = t + rand(5, 12); nf = 1; }
  }
  neonMat.color.setScalar(0.15 + 0.85 * nf);
  neonGlow.material.opacity = 0.35 * nf;

  // 贩卖机微脉动
  vendMat.color.setScalar(0.94 + 0.06 * Math.sin(t * 2.1));

  // 交通信号灯
  const S = tlState;
  S.t -= dt;
  if (S.t <= 0) { S.i = (S.i + 1) % S.seq.length; S.t = S.seq[S.i][1]; }
  const cur = S.seq[S.i][0];
  for (const key of ['r', 'y', 'g']) tlMats[key].color.setHex(key === cur ? lampCols[key] : (key === 'r' ? 0x220a0a : key === 'y' ? 0x221c08 : 0x0a2214));
  const gy = cur === 'r' ? 4.6 : cur === 'y' ? 4.1 : 3.6;
  tlGlow.position.y = gy;
  tlGlow.material.color.setHex(lampCols[cur]);
  tlGlow.material.opacity = 0.4 + 0.12 * Math.sin(t * 3);
  tlTarget.setHex(lampCols[cur]).multiplyScalar(0.38);
  trafficPuddle.material.uniforms.uTint.value.lerp(tlTarget, 1 - Math.exp(-dt * 2.5));

  // 屋檐滴水
  for (const d of drips) {
    if (d.active) {
      d.vy += 7.5 * dt;
      d.mesh.position.y -= d.vy * dt;
      if (d.mesh.position.y <= GY + 0.12) {
        d.active = false; d.mesh.visible = false; d.ringT = 0; d.t = rand(0.5, 1.9);
      }
    } else {
      d.t -= dt;
      if (d.t <= 0) { d.active = true; d.vy = 0; d.mesh.visible = true; d.mesh.position.set(d.x, 3.32, d.z); }
    }
    if (d.ringT < 1) {
      d.ringT = Math.min(1, d.ringT + dt * 3.2);
      const e = 1 - d.ringT;
      d.ring.scale.setScalar(1 + (1 - e) * 2.6);
      d.ring.material.opacity = e * 0.5;
    } else d.ring.material.opacity = 0;
  }

  // 关东煮蒸汽
  for (const st of steams) {
    st.t = (st.t + dt * 0.5) % 1;
    const e = st.t;
    st.s.position.set(st.bx + Math.sin(e * 9 + st.bx * 7) * 0.05, GY + 1.25 + e * 0.85, st.bz);
    st.s.material.opacity = 0.13 * Math.sin(e * Math.PI);
    st.s.scale.setScalar(0.35 + e * 0.5);
  }

  // 猫尾巴
  if (catTail) catTail.rotation.z = Math.sin(t * 1.3) * 0.1;

  // 平移范围限制
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -8, 8);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.2, 5);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -8, 9);
  controls.update();
}

