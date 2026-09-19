/**
 * environment.js —— 大气与天气
 *
 * 包含：夜空穹顶、冷调月光 + 暖色室内光、持续降雨、地面积水波纹、
 *       湿滑路面的光带倒影（用加法混合的“光晕条”模拟，成本远低于平面反射）。
 */

import * as THREE from 'three';
import {
  LAYOUT as S,
  makeCanvas,
  canvasTexture,
  getSkyTexture,
  makeGlow,
  randRange,
  makeRng,
} from './kit.js';

/* ------------------------------------------------------------------ */
/* 夜空                                                                 */
/* ------------------------------------------------------------------ */

export function createSky(scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 16),
    new THREE.MeshBasicMaterial({
      map: getSkyTexture(),
      side: THREE.BackSide,
      fog: false,
      toneMapped: false,
      depthWrite: false,
    })
  );
  sky.renderOrder = -100;
  scene.add(sky);

  // 低垂的云层：几个巨大的深色球体压在天空下缘，营造雨夜的压迫感
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0x1c2340,
    transparent: true,
    opacity: 0.55,
    fog: false,
    toneMapped: false,
    depthWrite: false,
  });
  const clouds = new THREE.Group();
  const rng = makeRng(31337);
  for (let i = 0; i < 14; i++) {
    const s = randRange(rng, 10, 22);
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), cloudMat);
    const a = rng() * Math.PI * 2;
    const r = randRange(rng, 18, 34);
    m.position.set(Math.cos(a) * r, randRange(rng, 9, 15), Math.sin(a) * r);
    m.scale.set(1, 0.34, 1);
    clouds.add(m);
  }
  clouds.renderOrder = -90;
  scene.add(clouds);

  return { sky, clouds };
}

/* ------------------------------------------------------------------ */
/* 灯光                                                                 */
/* ------------------------------------------------------------------ */

export const SHADOW_PRESETS = [
  { name: '关', enabled: false, size: 0 },
  { name: '低', enabled: true, size: 512 },
  { name: '中', enabled: true, size: 1024 },
  { name: '高', enabled: true, size: 2048 },
];

export function createLights(scene) {
  // 环境光刻意压低：夜景的层次来自少量强光源的明确明暗分割，而不是整体照亮
  const hemi = new THREE.HemisphereLight(0x35496f, 0x0a0d16, 0.55);
  scene.add(hemi);

  // 月光：唯一投射阴影的光源。从右前上方来，正好照亮建筑朝向观察者的两个立面
  const moon = new THREE.DirectionalLight(0x93aee0, 0.62);
  moon.position.set(7.5, 10.5, 5.5);
  moon.target.position.set(0, 0.6, -1.0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  const cam = moon.shadow.camera;
  cam.left = -7.5;
  cam.right = 7.5;
  cam.top = 7.5;
  cam.bottom = -7.5;
  cam.near = 1;
  cam.far = 36;
  moon.shadow.bias = -0.0016;
  moon.shadow.normalBias = 0.022;
  scene.add(moon);
  scene.add(moon.target);

  // 补光（很弱）：从左侧勾出暗部轮廓，避免左半边完全糊死
  const fill = new THREE.DirectionalLight(0x2f4a78, 0.28);
  fill.position.set(-6, 4.5, 5);
  scene.add(fill);

  // 便利店内部的暖光：整条街最亮的光源，形成室内外的强烈反差
  // 放在卖场靠前偏左的位置，让货架与后墙的明暗层次被拉开
  // （three r155+ 使用物理光照单位，点光强度按平方反比衰减，故数值很小）
  const shopGlow = new THREE.PointLight(0xffc07a, 3.4, 8.5, 2);
  shopGlow.position.set(-1.6, 1.9, -1.7);
  scene.add(shopGlow);

  // 门口溢出的暖光，洒在店前的湿地上
  const shopGlow2 = new THREE.PointLight(0xffbe78, 1.6, 5.0, 2);
  shopGlow2.position.set(-0.45, 1.0, 0.6);
  scene.add(shopGlow2);

  // 路灯的冷白光
  const lampLight = new THREE.PointLight(0xc6dcff, 7, 10, 2);
  lampLight.position.set(1.72, 3.9, 1.05);
  scene.add(lampLight);

  // 自动贩卖机的冷光
  const vendingLight = new THREE.PointLight(0xbcd8ff, 1.1, 3.0, 2);
  vendingLight.position.set(2.72, 1.5, 0.8);
  scene.add(vendingLight);

  // 小巷壁灯：给巷子一点暖色，避免变成一条死黑的缝
  const alleyLight = new THREE.PointLight(0xffc98a, 1.6, 4.0, 2);
  alleyLight.position.set(S.shopMaxX - 0.25, S.walkY + 2.1, -0.2);
  scene.add(alleyLight);

  function setShadowQuality(level) {
    const preset = SHADOW_PRESETS[Math.max(0, Math.min(SHADOW_PRESETS.length - 1, level))];
    moon.castShadow = preset.enabled;
    if (preset.enabled && moon.shadow.mapSize.width !== preset.size) {
      moon.shadow.mapSize.set(preset.size, preset.size);
      if (moon.shadow.map) {
        moon.shadow.map.dispose();
        moon.shadow.map = null;
      }
    }
    return preset;
  }

  return { hemi, moon, fill, shopGlow, shopGlow2, lampLight, vendingLight, setShadowQuality };
}

/* ------------------------------------------------------------------ */
/* 雨                                                                   */
/* ------------------------------------------------------------------ */

const RAIN_VERT = /* glsl */ `
  attribute float aSpeed;
  attribute float aSize;
  attribute float aPhase;

  uniform float uTime;
  uniform float uHeight;
  uniform float uWind;

  varying float vFade;

  void main() {
    vec3 p = position;
    float fall = mod(uTime * aSpeed + aPhase, uHeight);
    p.y = uHeight - fall;
    p.x += uWind * fall * 0.28;
    p.z += uWind * fall * 0.1;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float dist = max(0.001, -mv.z);
    gl_PointSize = aSize * (420.0 / dist);

    // 接近地面时淡出，避免雨水“穿透”地板
    vFade = smoothstep(0.0, 1.6, p.y) * (0.55 + 0.45 * smoothstep(uHeight, uHeight * 0.45, p.y + fall * 0.0));
  }
`;

const RAIN_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vFade;

  void main() {
    // 窄而长的竖向雨丝，避免变成一团白色的点
    vec2 c = gl_PointCoord - vec2(0.5);
    float streak = 1.0 - smoothstep(0.0, 0.5, abs(c.x) * 14.0);
    float ends = smoothstep(0.5, 0.02, abs(c.y));
    float core = pow(streak, 2.2);
    float a = (core * 0.72 + streak * 0.28) * ends * vFade * uOpacity;
    if (a < 0.006) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function createRain(scene, { count = 2600, height = 8.2, spread = 5.2 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const rng = makeRng(6161);

  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = randRange(rng, -spread, spread);
    pos[i * 3 + 1] = 0;
    pos[i * 3 + 2] = randRange(rng, -spread, spread);
    speed[i] = randRange(rng, 9.5, 15.5);
    size[i] = randRange(rng, 0.75, 1.65);
    phase[i] = rng() * height;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height * 0.5, 0), spread * 2 + height);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: height },
      uWind: { value: 0.32 },
      uColor: { value: new THREE.Color(0xa8c2e8) },
      uOpacity: { value: 0.3 },
    },
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 20;
  scene.add(points);

  let amount = 1;

  function setAmount(ratio, isEnabled = true) {
    amount = isEnabled ? Math.max(0, Math.min(1.5, ratio)) : 0;
    const n = Math.floor(count * Math.min(1, amount));
    geo.setDrawRange(0, n);
    // 雨越大，雨丝越亮一点点；整体保持克制，避免糊成白幕
    mat.uniforms.uOpacity.value = amount <= 0 ? 0 : 0.26 + 0.1 * Math.min(1, amount);
    points.visible = n > 0;
  }

  function update(t) {
    if (!points.visible) return;
    mat.uniforms.uTime.value = t;
  }

  setAmount(1);

  return { points, material: mat, setAmount, update, get amount() { return amount; } };
}

/* ------------------------------------------------------------------ */
/* 地面积水波纹                                                         */
/* ------------------------------------------------------------------ */

const RIPPLE_VERT = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aPhase;
  attribute float aScale;

  uniform float uTime;
  uniform float uSpeed;

  varying float vT;
  varying vec2 vLocal;

  void main() {
    float t = fract(uTime * uSpeed + aPhase);
    vT = t;
    vLocal = position.xz * 2.0;
    // aOffset.y 已包含该点所在铺装面的高度，所以波纹始终贴着表面扩散
    float r = mix(0.05, aScale, t);
    vec3 p = vec3(position.x * r, 0.0, position.z * r) + aOffset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const RIPPLE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vT;
  varying vec2 vLocal;

  void main() {
    // vLocal 是 [-1,1] 的圆盘坐标，扩张的圆环在 r=1 处
    float d = length(vLocal);
    float ring = smoothstep(0.55, 0.94, d) * (1.0 - smoothstep(0.94, 1.0, d));
    // 环随扩散变淡
    float fade = pow(1.0 - vT, 1.6);
    float a = ring * fade * uOpacity;
    if (a < 0.008) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function createRipples(scene, { count = 110, surfaceY } = {}) {
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.rotateX(-Math.PI / 2);

  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);

  const offsets = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const scales = new Float32Array(count);
  const rng = makeRng(3131);

  for (let i = 0; i < count; i++) {
    let x;
    let z;
    const pick = rng();
    if (pick < 0.4) {
      x = randRange(rng, -3.4, 3.4);
      z = randRange(rng, 1.85, 3.6);
    } else if (pick < 0.56) {
      x = randRange(rng, 2.35, 3.6);
      z = randRange(rng, -0.7, 2.0);
    } else if (pick < 0.76) {
      // 人行道（店前）—— 这是画面主角所在的地面
      x = randRange(rng, -3.7, 1.5);
      z = randRange(rng, -0.8, 1.2);
    } else if (pick < 0.88) {
      x = randRange(rng, 1.5, 3.6);
      z = randRange(rng, -2.0, 1.2);
    } else {
      // 小巷
      x = randRange(rng, 1.55, 2.15);
      z = randRange(rng, -3.6, 1.1);
    }
    const y = (surfaceY ? surfaceY(x, z) : 0) + 0.012;
    offsets[i * 3 + 0] = x;
    offsets[i * 3 + 1] = y;
    offsets[i * 3 + 2] = z;
    phases[i] = rng();
    scales[i] = randRange(rng, 0.07, 0.19);
  }

  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 12);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 1.05 },
      uColor: { value: new THREE.Color(0xcfe2ff) },
      uOpacity: { value: 0.3 },
    },
    vertexShader: RIPPLE_VERT,
    fragmentShader: RIPPLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 12;
  scene.add(mesh);

  let enabled = true;

  function update(t, intensity = 1) {
    if (!enabled) return;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uOpacity.value = 0.14 + 0.2 * Math.min(1.4, intensity);
  }

  function setEnabled(v) {
    enabled = v;
    mesh.visible = v;
  }

  return { mesh, update, setEnabled };
}

/* ------------------------------------------------------------------ */
/* 湿路面倒影光带                                                       */
/* ------------------------------------------------------------------ */

let smearTexture = null;

/** 一条竖向的光带贴图：靠近光源处最亮，向下逐渐消散并带水波碎裂感 */
function getSmearTexture() {
  if (smearTexture) return smearTexture;
  const { canvas, ctx } = makeCanvas(64, 256);

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.24)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.07)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);

  // 横向软边
  const side = ctx.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.22, 'rgba(0,0,0,0)');
  side.addColorStop(0.78, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, 64, 256);

  // 水波碎纹：横向的断续暗带，让倒影不像一块塑料板
  ctx.globalCompositeOperation = 'destination-out';
  const rng = makeRng(707);
  for (let i = 0; i < 26; i++) {
    const y = Math.pow(rng(), 0.7) * 256;
    const h = 2 + rng() * 7;
    ctx.globalAlpha = 0.18 + rng() * 0.35;
    ctx.fillRect(0, y, 64, h);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  smearTexture = canvasTexture(canvas);
  return smearTexture;
}

/**
 * 在湿路面上铺一条灯光倒影。
 * @param {number} color 灯光颜色
 * @param {number} width 光带宽度（米）
 * @param {number} length 光带长度（米）
 * @param {number} opacity 强度
 * @param {number} y 铺设高度
 */
export function makeLightSmear(color, width, length, opacity = 0.55, y = 0.012) {
  const mat = new THREE.MeshBasicMaterial({
    map: getSmearTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: true,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
  mesh.rotation.x = -Math.PI / 2;
  // 贴图 v=0 在平面远端，这里让“最亮的一头”朝向光源一侧（-Z 方向）
  mesh.position.y = y;
  mesh.renderOrder = 11;
  mesh.userData.baseOpacity = opacity;
  return mesh;
}

/** 路面上的高光水洼：极低强度的冷色椭圆，强调湿润感 */
export function createPuddleSheen(scene, surfaceY) {
  const group = new THREE.Group();
  const mats = [];
  const rng = makeRng(9090);
  // [x, z, 宽, 高, 强度]
  const places = [
    [-2.6, 2.4, 1.5, 0.7, 0.3],
    [-1.0, 3.1, 1.1, 0.5, 0.22],
    [1.4, 2.7, 1.7, 0.62, 0.26],
    [3.1, 1.0, 1.0, 0.9, 0.22],
    [2.9, -1.6, 0.55, 1.5, 0.18],
    [-2.2, 0.95, 1.3, 0.42, 0.2],
    [-0.8, 0.8, 1.0, 0.5, 0.24],
    [-3.1, 1.4, 1.2, 0.55, 0.2],
    [0.4, 1.05, 0.9, 0.45, 0.2],
    [1.9, 0.3, 0.5, 1.2, 0.18],
  ];
  for (const [x, z, w, h, o] of places) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9fc0ee,
      transparent: true,
      opacity: o,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rng() * Math.PI;
    m.position.set(x, (surfaceY ? surfaceY(x, z) : 0) + 0.008, z);
    m.renderOrder = 10;
    mats.push({ mat, base: o });
    group.add(m);
  }
  scene.add(group);

  function setWetness(gain) {
    for (const e of mats) e.mat.opacity = Math.min(1, e.base * gain);
  }

  return { group, mats, setWetness };
}

/* ------------------------------------------------------------------ */
/* 屋簷滴水                                                             */
/* ------------------------------------------------------------------ */

/** 屋檐 / 雨棚边缘不断滴落的水滴 */
export function createDrips(scene, origins, { perOrigin = 3, speed = 3.1 } = {}) {
  const count = origins.length * perOrigin;
  const geo = new THREE.BufferGeometry();
  const base = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const rng = makeRng(1212);
  let i = 0;
  for (const o of origins) {
    for (let k = 0; k < perOrigin; k++) {
      base[i * 3 + 0] = o.x + randRange(rng, -0.03, 0.03);
      base[i * 3 + 1] = o.y;
      base[i * 3 + 2] = o.z + randRange(rng, -0.03, 0.03);
      phase[i] = rng();
      i++;
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.5, 1.5, 0), 8);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uColor: { value: new THREE.Color(0xdcecff) },
    },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      uniform float uSpeed;
      varying float vA;
      void main() {
        vec3 p = position;
        float cycle = 1.35;
        float t = fract(uTime / cycle + aPhase);
        float fall = t * t * 9.0;
        p.y -= fall;
        p.y = max(p.y, 0.05);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, 34.0 / max(0.001, -mv.z));
        vA = smoothstep(0.85, 0.3, t) * smoothstep(0.0, 0.12, t);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = (1.0 - smoothstep(0.15, 0.5, d)) * vA * 0.85;
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 21;
  scene.add(points);

  function update(t) {
    mat.uniforms.uTime.value = t;
  }

  return { points, update };
}

/* ------------------------------------------------------------------ */
/* 玻璃上的雨水流痕（贴在橱窗玻璃外表面）                                */
/* ------------------------------------------------------------------ */

export function createGlassStreaks(width, height) {
  const { canvas, ctx } = makeCanvas(256, 512);
  ctx.clearRect(0, 0, 256, 512);
  const rng = makeRng(555);

  // 少量细长的流痕：大部分是透明的，只在边缘有一点点高光
  for (let i = 0; i < 26; i++) {
    const x = rng() * 256;
    const w = 0.6 + rng() * 1.5;
    const y0 = rng() * 512;
    const len = 40 + rng() * 200;
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + len);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.2, `rgba(216,236,255,${0.06 + rng() * 0.1})`);
    grad.addColorStop(0.75, `rgba(216,236,255,${0.03 + rng() * 0.06})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y0, w, len);
  }

  // 静止的小水珠：稀疏的点状高光
  for (let i = 0; i < 42; i++) {
    const x = rng() * 256;
    const y = rng() * 512;
    const r = 0.8 + rng() * 2.4;
    const g2 = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g2.addColorStop(0, `rgba(255,255,255,${0.3 + rng() * 0.25})`);
    g2.addColorStop(0.5, 'rgba(200,225,255,0.1)');
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = canvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.renderOrder = 15;
  return { mesh, material: mat, texture: tex };
}
