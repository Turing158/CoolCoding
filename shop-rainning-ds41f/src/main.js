/**
 * main.js —— 雨夜便利店街角 · 微缩三维模型
 *
 *  - 三渲二（Cel-shading）风格的夜景街角
 *  - 第三视角轨道相机：自由拖拽 / 旋转 / 缩放
 *  - 场景内部没有任何 UI；所有可调参数集中在画面左上角的可折叠设置条
 *  - 帧率上限默认 40 FPS，避免占满 CPU；阴影质量 / 渲染倍率等均可调
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LAYOUT as S } from './kit.js';
import { createSky, createLights, SHADOW_PRESETS } from './environment.js';
import { createStore } from './store.js';
import { createStreet } from './street.js';
import { createEffects } from './effects.js';
import { createUI } from './ui.js';

/* ------------------------------------------------------------------ */
/* 渲染器 / 场景 / 相机                                                 */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setClearColor(0x070a12, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x121a2e, 0.042);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);

/* 模型整体略微下沉，让底座在画面里处于视觉中心偏下 */
const MODEL = new THREE.Group();
scene.add(MODEL);

/* ------------------------------------------------------------------ */
/* 组装场景                                                             */
/* ------------------------------------------------------------------ */

const sky = createSky(scene);
const lights = createLights(scene);

const store = createStore();
const street = createStreet();

MODEL.add(store.root);
MODEL.add(street.root);

const effects = createEffects(scene, { store, street, env: { lights, sky } });

/* 用固定种子生成的细节再补一点环境氛围光晕 */
lights.setShadowQuality(2);

/* ------------------------------------------------------------------ */
/* 相机控制                                                             */
/* ------------------------------------------------------------------ */

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.35, 0.95, -0.55);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.75;
controls.panSpeed = 0.6;
controls.screenSpacePanning = false;
controls.minDistance = 4.2;
controls.maxDistance = 26;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI * 0.487; // 不允许穿到地面以下
controls.autoRotateSpeed = 0.55;

/* 相机取景：围绕便利店街角，保持“可收藏的微缩模型”那种紧凑构图 */
const VIEWS = {
  hero: { pos: [7.4, 4.3, 7.9], target: [-1.15, 1.15, -1.15] },
  front: { pos: [-1.2, 2.5, 6.6], target: [-1.2, 1.25, -0.8] },
  top: { pos: [3.0, 11.0, 6.6], target: [-1.0, 0.3, -0.9] },
  // 小巷侧：从巷口斜看进去，同时保留店面的暖光
  alley: { pos: [6.3, 3.4, 4.0], target: [1.2, 1.0, -1.8] },
};

function applyView(name, instant = false) {
  const v = VIEWS[name];
  if (!v) return;
  const from = {
    pos: camera.position.clone(),
    target: controls.target.clone(),
  };
  const to = {
    pos: new THREE.Vector3(...v.pos),
    target: new THREE.Vector3(...v.target),
  };
  if (instant) {
    camera.position.copy(to.pos);
    controls.target.copy(to.target);
    controls.update();
    return;
  }
  // 简单的缓动过渡
  const start = performance.now();
  const dur = 900;
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / dur);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    camera.position.lerpVectors(from.pos, to.pos, e);
    controls.target.lerpVectors(from.target, to.target, e);
    controls.update();
    if (t < 1) requestAnimationFrame(step);
  };
  step();
}

applyView('hero', true);

/* ------------------------------------------------------------------ */
/* 尺寸与渲染倍率                                                       */
/* ------------------------------------------------------------------ */

const settings = {
  fpsLimit: 40,
  shadowQuality: 2,
  renderScale: 100,
  outline: true,
  reflection: true,
  wetShine: true,
  rainAmount: 100,
  splash: true,
  autoDoor: true,
  flicker: true,
  autoRotate: false,
};

let renderScaleValue = 1;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr * renderScaleValue);
  renderer.setSize(w, h, false);
}

window.addEventListener('resize', resize);

function setRenderScale(percent) {
  renderScaleValue = percent / 100;
  resize();
}

/* ------------------------------------------------------------------ */
/* 描边开关                                                             */
/* ------------------------------------------------------------------ */

const outlineObjects = [];
MODEL.traverse((o) => {
  if (o.userData && o.userData.isOutline) outlineObjects.push(o);
});

function setOutline(enabled) {
  for (const o of outlineObjects) o.visible = enabled;
}

/**
 * 湿润高光开关。
 * 关闭时把玻璃的清漆高光、路面与金属的高光压下去，
 * 画面会明显变得“干、哑”，用来对比雨夜的湿润质感。
 */
function setWetShine(enabled) {
  // 玻璃：保留通透度，只改清漆（高光）强度
  for (const g of [store.materials.glass, store.materials.glassFridge]) {
    g.clearcoat = enabled ? 1 : 0.15;
    g.clearcoatRoughness = enabled ? 0.04 : 0.5;
    g.roughness = enabled ? 0.05 : 0.45;
    g.needsUpdate = true;
  }
  // 路面 / 地砖：湿润时更暗更亮泽（粗糙度降低）
  for (const m of [street.materials.asphalt, street.materials.tile, street.materials.alleyFloor]) {
    m.roughness = enabled ? 0.42 : 0.95;
    m.needsUpdate = true;
  }
  // 湿地倒影与静态水洼的强度由 effects 统一控制
  effects.setWetShine(enabled);
}

/* ------------------------------------------------------------------ */
/* 设置条                                                               */
/* ------------------------------------------------------------------ */

const ui = createUI({
  settings,
  shadowPresets: SHADOW_PRESETS,
  onChange(patch) {
    Object.assign(settings, patch);

    if ('fpsLimit' in patch) {
      /* 由主循环读取，无需额外处理 */
    }
    if ('shadowQuality' in patch) {
      const preset = lights.setShadowQuality(patch.shadowQuality);
      renderer.shadowMap.needsUpdate = true;
      ui.setStats(`阴影：${preset.name}`);
    }
    if ('renderScale' in patch) {
      setRenderScale(patch.renderScale);
    }
    if ('outline' in patch) {
      setOutline(patch.outline);
    }
    if ('reflection' in patch) {
      effects.setReflection(patch.reflection);
    }
    if ('rainAmount' in patch) {
      effects.setRainAmount(patch.rainAmount / 100);
    }
    if ('splash' in patch) {
      effects.setRipples(patch.splash);
    }
    if ('autoDoor' in patch) {
      effects.setDoor(patch.autoDoor);
    }
    if ('flicker' in patch) {
      effects.setFlicker(patch.flicker);
    }
    if ('wetShine' in patch) {
      setWetShine(patch.wetShine);
    }
  },
  onView(name) {
    applyView(name);
  },
  onReset() {
    applyView('hero');
    controls.autoRotate = false;
    settings.autoRotate = false;
    ui.setAutoRotate(false);
    ui.reset();
  },
  onAutoRotate(on) {
    controls.autoRotate = on;
    settings.autoRotate = on;
  },
});

// 初始化一次
setRenderScale(settings.renderScale);
setOutline(settings.outline);
setWetShine(settings.wetShine);
lights.setShadowQuality(settings.shadowQuality);
effects.setRainAmount(settings.rainAmount / 100);

/* ------------------------------------------------------------------ */
/* 主循环：帧率限制 + 自适应画质                                        */
/* ------------------------------------------------------------------ */

let lastTime = performance.now();
let accumulator = 0;
let frames = 0;
let fpsTimer = 0;
let measuredFps = 0;
let running = true;
/** 真正执行了 renderer.render 的次数（用于验证限帧是否生效） */
let renderCount = 0;
let skippedByLimit = 0;
let loopCalls = 0;
let simSteps = 0;

/** 固定时间步长，保证动效不因限帧而变速 */
const FIXED_STEP = 1 / 60;
let simTime = 0;
let simAccum = 0;
let lastSimTime = performance.now();

/* 诊断参数：?test=1 自动跑一段并输出；?still=1 冻结动画 */
const params = new URLSearchParams(location.search);
const TEST_MODE = params.get('test') === '1';
const STILL = params.get('still') === '1';
const forcedFps = Number(params.get('fps') || 0);
const forcedView = params.get('view');

if (forcedFps > 0) {
  settings.fpsLimit = forcedFps;
  ui.set('fpsLimit', forcedFps);
}

if (forcedView && VIEWS[forcedView]) {
  applyView(forcedView, true);
}

/* 诊断用：?cam=x,y,z&look=x,y,z 直接指定相机，便于离线取景检查 */
const camParam = params.get('cam');
const lookParam = params.get('look');
if (camParam && lookParam) {
  const c = camParam.split(',').map(Number);
  const l = lookParam.split(',').map(Number);
  if (c.length === 3 && l.length === 3 && c.every(Number.isFinite) && l.every(Number.isFinite)) {
    camera.position.set(c[0], c[1], c[2]);
    controls.target.set(l[0], l[1], l[2]);
    controls.update();
  }
}

/* 诊断模式：把运行时状态写进 document.title，便于无头浏览器用 --dump-dom 读取 */
let errorCount = 0;
const pageErrors = [];
window.addEventListener('error', (e) => {
  errorCount++;
  pageErrors.push(String(e.message || e.error));
});
window.addEventListener('unhandledrejection', (e) => {
  errorCount++;
  pageErrors.push('unhandledrejection: ' + String(e.reason));
});

function publishDiagnostics() {
  if (!TEST_MODE) return;
  const info = {
    ok: errorCount === 0,
    errors: pageErrors.slice(0, 5),
    errorCount,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    programs: renderer.info.programs?.length ?? 0,
    fps: Number(measuredFps.toFixed(1)),
    outlineCount: outlineObjects.length,
    objects: (() => {
      let n = 0;
      scene.traverse(() => n++);
      return n;
    })(),
  };
  window.__dshStats = info;
  const el = document.getElementById('diag') || (() => {
    const d = document.createElement('pre');
    d.id = 'diag';
    d.style.display = 'none';
    document.body.appendChild(d);
    return d;
  })();
  el.textContent = JSON.stringify(info);
  document.title = 'DIAG ' + JSON.stringify(info);
}

function loop(now) {
  requestAnimationFrame(loop);
  loopCalls++;
  if (!running) return;

  const rawDt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  /* --- FPS 统计 ---
     注意：必须在限帧的提前 return 之前累加墙钟时间，否则 fpsTimer 只会统计到
     “真正渲染的那几帧”的间隔，读数会变成 vsync 频率而不是实际渲染帧率。 */
  frames++;
  fpsTimer += rawDt;
  if (fpsTimer >= 0.5) {
    measuredFps = frames / fpsTimer;
    frames = 0;
    fpsTimer = 0;
    reportStats();
  }

  /* --- 帧率限制 --- */
  const limit = settings.fpsLimit > 0 ? settings.fpsLimit : 0;
  if (limit > 0) {
    accumulator += rawDt;
    const interval = 1 / limit;
    if (accumulator < interval) {
      skippedByLimit++;
      return;
    }
    // 只消耗一个间隔，避免攒帧后突然连跑
    accumulator = Math.min(accumulator - interval, interval);
  }

  /* --- 固定步长推进模拟 ---
     用“自上次真正渲染以来经过的时间”推进，而不是单帧的 rawDt：
     被限帧跳过的那些 rAF 回调同样要计入，否则动画会以 1/limit 的比例慢放。
     注意 rAF 的 now 是毫秒，必须换算成秒后再与 FIXED_STEP 比较。 */
  if (!STILL) {
    simAccum += (now - lastSimTime) / 1000;
    lastSimTime = now;
    // 后台切回前台时可能出现巨大的时间跨度，钳制一下避免动效瞬移
    if (simAccum > 0.25) simAccum = 0.25;
    let steps = 0;
    while (simAccum >= FIXED_STEP && steps < 6) {
      simAccum -= FIXED_STEP;
      simTime += FIXED_STEP;
      simSteps++;
      effects.update(FIXED_STEP, simTime);
      steps++;
    }
    if (steps === 6) simAccum = 0;
  }

  controls.update();

  /* --- 天空 / 云层随相机轻微视差 --- */
  sky.sky.position.set(camera.position.x * 0.6, 0, camera.position.z * 0.6);

  renderer.render(scene, camera);
  renderCount++;
}

/** 更新左下角的运行状态读数 */
function reportStats() {
  if (TEST_MODE) {
    publishDiagnostics();
    return;
  }
  const shadow = SHADOW_PRESETS[settings.shadowQuality].name;
  ui.setStats(
    `${measuredFps.toFixed(0)} / ${settings.fpsLimit} FPS · 阴影 ${shadow} · 绘制 ${renderer.info.render.calls} · 三角面 ${(
      renderer.info.render.triangles / 1000
    ).toFixed(1)}k`
  );
}

resize();
lastTime = performance.now();
requestAnimationFrame(loop);

/* 标签页不可见时暂停渲染，避免后台空转 */
document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  lastTime = performance.now();
  lastSimTime = performance.now();
  simAccum = 0;
  if (running) requestAnimationFrame(loop);
});

/* 暴露给诊断用 */
window.__dsh = {
  scene,
  camera,
  renderer,
  controls,
  settings,
  store,
  street,
  effects,
  lights,
  ready: true,
  get renderCount() {
    return renderCount;
  },
  get skippedByLimit() {
    return skippedByLimit;
  },
  get loopCalls() {
    return loopCalls;
  },
  get simSteps() {
    return simSteps;
  },
  get measuredFps() {
    return measuredFps;
  },
};