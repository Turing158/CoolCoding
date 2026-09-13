import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createShop, shopStats } from './shop.js';
import { createStreet } from './street.js';
import { createWeather, createWetRoad } from './weather.js';
import { mergeStaticMeshes } from './kit.js';
import { createSettingsBar } from './settings.js';
import { defaultSettings, normalizeSettings, SHADOW_QUALITY, RENDER_SCALE } from './settings-config.js';
import './style.css';

const host = document.querySelector('#world');
const params = new URLSearchParams(location.search);
const testMode = params.has('test');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches && !(testMode && params.get('motion') === '1');
const requestedFPS = Number(params.get('fps'));
const defaults = defaultSettings({ reducedMotion, narrow: matchMedia('(max-width: 700px)').matches });
if (testMode) defaults.fps = 8;
if (params.has('fps') && Number.isFinite(requestedFPS) && requestedFPS > 0) defaults.fps = Math.min(60, Math.max(1, Math.round(requestedFPS)));
// Browser inspections have their own preferences and cannot overwrite a user's choices.
const storageKey = testMode ? 'amayori.settings.inspection.v1' : 'amayori.settings.v1';
let storedSettings = null, storageAvailable = true;
try {
  const raw = localStorage.getItem(storageKey);
  try { storedSettings = raw ? JSON.parse(raw) : null; } catch { /* Recover from malformed saved preferences. */ }
} catch { storageAvailable = false; }
const settings = normalizeSettings(storedSettings, defaults);
if (testMode || params.has('fps')) settings.fps = defaults.fps;
let fps = settings.fps;
const requestedLimit = Number(params.get('frames'));
const frameLimit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : testMode ? 24 : Infinity;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power', stencil: false });
renderer.setClearColor('#151e2c', 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = settings.exposure / 100;
renderer.shadowMap.enabled = SHADOW_QUALITY[settings.shadows] > 0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('role', 'img');
renderer.domElement.setAttribute('aria-label', '可交互的雨夜便利店微缩模型。左键拖拽旋转，滚轮缩放，右键拖拽平移。方向键旋转，加减键缩放，Home 复位。');
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#151e2c');
scene.fog = new THREE.FogExp2('#263951', .012);
const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, .1, 100);
camera.position.set(18, 14.8, 21);
camera.layers.enable(1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.4, 0);
controls.enableDamping = !testMode && !reducedMotion;
controls.dampingFactor = .14;
controls.rotateSpeed = .55;
controls.panSpeed = .62;
controls.zoomSpeed = .7;
controls.minZoom = .64;
controls.maxZoom = 3.4;
controls.minPolarAngle = THREE.MathUtils.degToRad(23);
controls.maxPolarAngle = THREE.MathUtils.degToRad(83);
controls.screenSpacePanning = true;
controls.update(); controls.saveState();

scene.add(new THREE.HemisphereLight('#a9c7e9', '#5f627f', 1.42));
const moon = new THREE.DirectionalLight('#a3c5eb', 2.10);
moon.position.set(-3, 12, 7); moon.castShadow = renderer.shadowMap.enabled;
const initialShadowSize = SHADOW_QUALITY[settings.shadows] || 512;
moon.shadow.mapSize.set(initialShadowSize, initialShadowSize);
Object.assign(moon.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: .5, far: 35 });
moon.shadow.normalBias = .035; moon.shadow.bias = -.00035;
moon.shadow.radius = 3;
moon.target.position.set(0, 0, 0);
scene.add(moon, moon.target);
const rim = new THREE.DirectionalLight('#aaa9d7', .67);
rim.position.set(5, 7, -7); scene.add(rim);

const street = createStreet(scene);
const shop = createShop(scene);
const staticBatches = mergeStaticMeshes(scene);

// A soft studio shadow anchors the entire square model in its quiet backdrop.
const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
const sctx = shadowCanvas.getContext('2d');
const gradient = sctx.createRadialGradient(64, 64, 8, 64, 64, 64);
gradient.addColorStop(0, '#080f1cdc'); gradient.addColorStop(.5, '#080f1c99'); gradient.addColorStop(1, '#080f1c00');
sctx.fillStyle = gradient; sctx.fillRect(0, 0, 128, 128);
const shadowTex = new THREE.CanvasTexture(shadowCanvas);
const studioShadow = new THREE.Mesh(new THREE.PlaneGeometry(23, 21), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
studioShadow.rotation.x = -Math.PI / 2; studioShadow.position.set(.3, -.61, .4); scene.add(studioShadow);
studioShadow.visible = renderer.shadowMap.enabled;

const weather = createWeather(scene, reducedMotion);
weather.setAmount(settings.rain);
const wetRoad = createWetRoad(scene, renderer, camera);
wetRoad.setQuality(settings.reflections);
const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(640, 400), settings.bloom / 100, .45, 1.08);
bloom.enabled = settings.bloom > 0;
composer.addPass(bloom);
// A barely perceptible vignette belongs to the image, not to an interface.
const vignette = new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){vec4 col=texture2D(tDiffuse,vUv); float d=length((vUv-.5)*vec2(.9,1.));
    col.rgb*=1.-smoothstep(.20,.75,d)*.25;gl_FragColor=col;}`,
});
composer.addPass(vignette);
composer.addPass(new OutputPass());

let disposed = false, paused = false, hidden = document.hidden, contextLost = false;
let timer = null, raf = null, stillTimer = null, scheduledStill = false;
let settingsBar = null;
let rendering = false, controlsChangedDuringFrame = false;
const requestedTime = Number(params.get('time'));
let frames = 0, automaticFrames = 0, simulatedTime = params.has('time') && Number.isFinite(requestedTime) ? requestedTime : 7.4, previousTick = performance.now();
let needsReflection = true, lastReflection = -10, lastFrameTime = 0;
let lastFrameCost = 0, maxFrameCost = 0;
let lastAutomaticTick = 0, minimumAutomaticInterval = Infinity;
const errors = [];
window.addEventListener('error', event => errors.push(event.message));

function updateWorld(time) {
  weather.update(time);
  // Ten seconds of calm between gently opening, holding and closing the door.
  const phase = time % 18;
  let open = 0;
  if (phase >= 9 && phase < 10.4) open = THREE.MathUtils.smoothstep(phase, 9, 10.4);
  else if (phase >= 10.4 && phase < 12.4) open = 1;
  else if (phase >= 12.4 && phase < 13.9) open = 1 - THREE.MathUtils.smoothstep(phase, 12.4, 13.9);
  shop.doors.forEach((door, i) => { door.position.x = door.userData.homeX + (i ? 1 : -1) * open * .85; });
  const flicker = reducedMotion ? 0 : Math.pow(Math.max(0, Math.sin(time * .68) * Math.sin(time * 5.61)), 22);
  const signBrightness = 1 - flicker * .08;
  shop.signMaterial.color.setRGB(1.40 * signBrightness, 1.34 * signBrightness, 1.21 * signBrightness);
  const signal = time % 32;
  street.trafficLights[0].color.set(signal < 17 ? '#8ae0b9' : '#385d5a');
  street.trafficLights[1].color.set(signal >= 17 && signal < 20 ? '#edc681' : '#64584b');
  street.trafficLights[2].color.set(signal >= 20 ? '#e69a88' : '#694a4c');
}

function cancelScheduled() {
  if (timer !== null) { clearTimeout(timer); timer = null; }
  if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
  if (stillTimer !== null) { clearTimeout(stillTimer); stillTimer = null; scheduledStill = false; }
}

function publishState() {
  settingsBar?.updateStatus({ paused, hidden });
  if (testMode && window.__rainyCorner) host.dataset.diagnostics = JSON.stringify(window.__rainyCorner.diagnostics());
}

function setPaused(nextPaused) {
  paused = nextPaused;
  cancelScheduled();
  if (!paused) {
    automaticFrames = 0;
    lastAutomaticTick = 0;
    minimumAutomaticInterval = Infinity;
    previousTick = performance.now();
    schedule();
  } else requestStill();
  publishState();
}

function applySettings(patch, { persist = true } = {}) {
  const previous = { ...settings };
  const next = normalizeSettings({ ...settings, ...patch }, defaults);
  Object.assign(settings, next);
  if (previous.fps !== next.fps) {
    fps = next.fps;
    cancelScheduled();
    lastAutomaticTick = 0;
    minimumAutomaticInterval = Infinity;
  }
  if (previous.shadows !== next.shadows) {
    const size = SHADOW_QUALITY[next.shadows];
    const enabled = size > 0;
    const wasEnabled = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = enabled;
    moon.castShadow = enabled;
    studioShadow.visible = enabled;
    moon.shadow.map?.dispose();
    moon.shadow.map = null;
    moon.shadow.mapPass?.dispose();
    moon.shadow.mapPass = null;
    moon.shadow.mapSize.set(size || 512, size || 512);
    moon.shadow.normalBias = size <= 512 ? .055 : .035;
    renderer.shadowMap.needsUpdate = enabled;
    if (wasEnabled !== enabled) {
      const materials = new Set();
      scene.traverse(object => {
        const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        list.forEach(mat => materials.add(mat));
      });
      for (const mat of materials) if (mat.isMeshToonMaterial || mat.isMeshLambertMaterial || mat.isMeshStandardMaterial) mat.needsUpdate = true;
    }
    needsReflection = true;
  }
  if (previous.reflections !== next.reflections) { wetRoad.setQuality(next.reflections); needsReflection = true; }
  if (previous.rain !== next.rain) weather.setAmount(next.rain);
  bloom.enabled = next.bloom > 0;
  bloom.strength = next.bloom / 100;
  renderer.toneMappingExposure = next.exposure / 100;
  if (previous.resolution !== next.resolution) resize();
  settingsBar?.sync(settings);
  if (persist) {
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); storageAvailable = true; }
    catch { storageAvailable = false; }
    settingsBar?.setStorageAvailable(storageAvailable);
  }
  publishState();
  if (Object.keys(settings).some(key => previous[key] !== next[key])) requestStill();
}

function renderFrame(advance = false) {
  if (disposed || hidden || contextLost) return;
  const start = performance.now();
  rendering = true;
  controlsChangedDuringFrame = false;
  if (advance) {
    if (lastAutomaticTick) minimumAutomaticInterval = Math.min(minimumAutomaticInterval, start - lastAutomaticTick);
    lastAutomaticTick = start;
    const dt = Math.min((start - previousTick) / 1000, .25);
    simulatedTime += dt * (reducedMotion ? .55 : 1); automaticFrames++;
  }
  previousTick = start;
  controls.update();
  updateWorld(simulatedTime);
  const refresh = wetRoad.enabled && (needsReflection || start - lastReflection > wetRoad.interval);
  renderer.info.reset();
  if (wetRoad.update(simulatedTime, refresh)) { lastReflection = start; needsReflection = false; }
  composer.render();
  lastFrameTime = performance.now();
  lastFrameCost = lastFrameTime - start;
  maxFrameCost = Math.max(maxFrameCost, lastFrameCost);
  frames++;
  rendering = false;
  if (advance && automaticFrames >= frameLimit) { paused = true; cancelScheduled(); }
  if (paused && controlsChangedDuringFrame && controls.enableDamping) requestStill();
  publishState();
}

function schedule() {
  if (disposed || paused || hidden || contextLost || rendering || timer !== null || raf !== null) return;
  const delay = Math.max(0, 1000 / fps - (performance.now() - lastFrameTime));
  timer = setTimeout(() => {
    timer = null;
    raf = requestAnimationFrame(() => {
      raf = null;
      if (!paused && !hidden && !contextLost) renderFrame(true);
      schedule();
    });
  }, delay);
}

function requestStill() {
  if (scheduledStill || disposed || hidden || contextLost) return;
  if (!paused) { schedule(); return; }
  scheduledStill = true;
  stillTimer = setTimeout(() => {
    stillTimer = null;
    scheduledStill = false;
    if (!disposed && !hidden && !contextLost) renderFrame(false);
  }, Math.max(0, 1000 / fps - (performance.now() - lastFrameTime)));
}

controls.addEventListener('change', () => {
  needsReflection = true;
  if (rendering) controlsChangedDuringFrame = true;
  else requestStill();
});

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  const availableHeight = Math.max(160, h - (settingsBar?.getInset() || 0));
  const aspect = w / availableHeight;
  // Resolution is capped independently of high-DPI display size.
  const scale = RENDER_SCALE[settings.resolution];
  const resolutionBudget = testMode ? 1150000 : Math.min(3400000, 1850000 * scale * scale);
  const pixelRatio = Math.min(Math.min(devicePixelRatio || 1, 1.4) * scale, 2, Math.sqrt(resolutionBudget / (w * h)));
  renderer.setPixelRatio(pixelRatio); renderer.setSize(w, h);
  composer.setPixelRatio(pixelRatio); composer.setSize(w, h);
  bloom.setSize(Math.round(w * pixelRatio * .60), Math.round(h * pixelRatio * .60));
  const viewHeight = Math.max(16.3, 20.8 / aspect);
  camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
  camera.top = viewHeight / 2;
  camera.bottom = camera.top - viewHeight * h / availableHeight;
  camera.updateProjectionMatrix();
  wetRoad.resize(w, h); needsReflection = true; requestStill();
}
window.addEventListener('resize', resize);
function onVisibilityChange() {
  hidden = document.hidden;
  if (hidden) cancelScheduled();
  else { previousTick = performance.now(); needsReflection = true; if (paused) requestStill(); else schedule(); }
  publishState();
}
document.addEventListener('visibilitychange', onVisibilityChange);
renderer.domElement.addEventListener('webglcontextlost', event => {
  event.preventDefault(); contextLost = true; cancelScheduled();
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  contextLost = false; renderer.shadowMap.needsUpdate = true; needsReflection = true;
  if (paused) requestStill(); else schedule();
});

function resetView() { controls.reset(); needsReflection = true; requestStill(); }
renderer.domElement.addEventListener('dblclick', resetView);
renderer.domElement.addEventListener('keydown', event => {
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  let changed = true;
  if (event.key === 'ArrowLeft') spherical.theta -= .10;
  else if (event.key === 'ArrowRight') spherical.theta += .10;
  else if (event.key === 'ArrowUp') spherical.phi = Math.max(controls.minPolarAngle, spherical.phi - .075);
  else if (event.key === 'ArrowDown') spherical.phi = Math.min(controls.maxPolarAngle, spherical.phi + .075);
  else if (['+', '='].includes(event.key)) camera.zoom = Math.min(controls.maxZoom, camera.zoom * 1.1);
  else if (['-', '_'].includes(event.key)) camera.zoom = Math.max(controls.minZoom, camera.zoom / 1.1);
  else if (event.key === 'Home') { event.preventDefault(); resetView(); return; }
  else changed = false;
  if (changed) {
    event.preventDefault(); camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    camera.updateProjectionMatrix(); controls.update(); needsReflection = true; requestStill();
  }
});

// Diagnostic state is separate from the user-facing settings bar.
window.__rainyCorner = {
  pause() { setPaused(true); return this.diagnostics(); },
  resume() { if (!disposed) setPaused(false); },
  step(time = simulatedTime) { paused = true; cancelScheduled(); simulatedTime = time; needsReflection = true; renderFrame(false); return this.diagnostics(); },
  reset: resetView,
  setView(position, target = [0, 1.4, 0], zoom = 1) {
    camera.position.set(...position); controls.target.set(...target); camera.zoom = zoom;
    camera.updateProjectionMatrix(); controls.update(); needsReflection = true; requestStill();
  },
  diagnostics() {
    return {
      ready: true, paused, hidden, contextLost, reducedMotion, fpsCap: fps, frameLimit: Number.isFinite(frameLimit) ? frameLimit : null,
      frames, automaticFrames, simulatedTime: +simulatedTime.toFixed(3), reflectionUpdates: wetRoad.updates,
      lastFrameMs: +lastFrameCost.toFixed(1), maxFrameMs: +maxFrameCost.toFixed(1),
      minimumAutomaticIntervalMs: Number.isFinite(minimumAutomaticInterval) ? +minimumAutomaticInterval.toFixed(1) : null,
      drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      staticBatches, productCount: shopStats.products, rainCount: weather.count,
      settings: { ...settings },
      shadows: { enabled: renderer.shadowMap.enabled, size: moon.shadow.map?.width || 0 },
      reflections: { enabled: wetRoad.enabled, resolution: wetRoad.resolution },
      weatherVisible: weather.root.visible, bloomEnabled: bloom.enabled, exposure: renderer.toneMappingExposure,
      canvas: { width: renderer.domElement.width, height: renderer.domElement.height },
      camera: { position: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom },
      doors: shop.doors.map(d => +d.position.x.toFixed(3)), errors,
    };
  },
};

settingsBar = createSettingsBar({
  settings, defaults, onChange: applySettings,
  onToggleMotion: () => setPaused(!paused),
  onResetView: resetView,
  onResetSettings: () => applySettings(defaults),
  onLayout: resize,
});
settingsBar.setStorageAvailable(storageAvailable);
publishState();
resize();
renderer.shadowMap.needsUpdate = true;
updateWorld(simulatedTime);
renderFrame(false);
host.dataset.ready = 'true';
previousTick = performance.now();
if (!paused) schedule();

if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true; cancelScheduled(); controls.dispose();
  window.removeEventListener('resize', resize);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  settingsBar.dispose();
  scene.traverse(object => {
    if (object.geometry) object.geometry.dispose();
    const mats = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    mats.forEach(mat => mat.dispose());
  });
  wetRoad.dispose(); composer.dispose(); renderer.dispose(); renderer.domElement.remove();
});
