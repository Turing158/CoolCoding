import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTown, FLOOR_BASE, FLOOR_GAP, stories } from './scene.js';
import { createBlobTexture } from './kit.js';
import { bindUi } from './ui.js';

const query = new URLSearchParams(location.search);
const testMode = query.get('test') === '1';
const stillMode = query.get('still') === '1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const fpsValues = [6, 12, 24, 30, 45, 60];
const nearestFps = value => fpsValues.reduce((best, fps) => Math.abs(fps - value) < Math.abs(best - value) ? fps : best, 60);
const testFps = Math.min(12, nearestFps(query.has('fps') ? finite(query.get('fps'), 6) : 6));
const presets = {
  eco: { detail: 0, fps: 24, shadows: false, particles: false, dpr: 1, shadowSize: 512 },
  balanced: { detail: 2, fps: 60, shadows: true, particles: true, dpr: 1.35, shadowSize: 1024 },
  fine: { detail: 2, fps: 60, shadows: true, particles: true, dpr: 1.8, shadowSize: 2048 },
};
const defaults = { ...presets.balanced, preset: 'balanced', glass: 88, explode: 0, speed: 1, shell: true, rotate: false, solo: false, selected: 'all', paused: false, panel: innerWidth > 900, zen: false };
let saved = {};
if (!testMode) {
  try { saved = JSON.parse(localStorage.getItem('stacked-settings-v1') || '{}') || {}; } catch { /* Storage can be disabled by the browser. */ }
}
const state = { ...defaults };
for (const id of ['shell', 'particles', 'shadows']) if (typeof saved[id] === 'boolean') state[id] = saved[id];
if (Object.hasOwn(presets, saved.preset)) Object.assign(state, presets[saved.preset], { preset: saved.preset });
state.fps = nearestFps(finite(saved.fps ?? defaults.fps, defaults.fps));
state.detail = Math.round(clamp(finite(saved.detail ?? 2, 2), 0, 2));
state.glass = clamp(finite(saved.glass ?? 88, 88), 65, 100);
state.speed = clamp(finite(saved.speed ?? 1, 1), .25, 1.75);
if (reducedMotion) { state.paused = true; state.particles = false; state.fps = 24; }
if (query.has('fps')) state.fps = nearestFps(finite(query.get('fps'), 30));
if (testMode) state.fps = testFps;
if (testMode && !stillMode) state.paused = false;
if (stillMode) state.paused = true;

const errors = [];
function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  errors.push(message);
  document.getElementById('loading').hidden = true;
  document.getElementById('error').hidden = false;
  document.getElementById('error-message').textContent = message.includes('WebGL') ? '浏览器暂时无法启用 WebGL。请检查硬件加速设置，然后重新加载。' : `加载过程中遇到问题：${message}`;
}
addEventListener('error', event => showError(event.error || event.message));
addEventListener('unhandledrejection', event => showError(event.reason));

try {
  start();
} catch (error) {
  showError(error);
}

function start() {
  const sceneHost = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0xf3f1e9, 0);
  renderer.shadowMap.enabled = state.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '四层积木沙盘。左键旋转，右键平移，滚轮缩放。方向键平移，加减键缩放，R 复位。');
  sceneHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .12, 220);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.minDistance = 4.2;
  controls.maxDistance = 130;
  controls.minPolarAngle = .13;
  controls.maxPolarAngle = Math.PI * .495;
  controls.rotateSpeed = .55;
  controls.zoomSpeed = .9;
  controls.panSpeed = .7;
  controls.screenSpacePanning = true;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.autoRotateSpeed = .23;
  renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
  const hemi = new THREE.HemisphereLight(0xfffae9, 0x7f9180, 1.6);
  scene.add(hemi, new THREE.AmbientLight(0xfff7e9, .35));
  const keyLight = new THREE.DirectionalLight(0xfff5df, 2.65);
  keyLight.position.set(-20, 36, 24);
  keyLight.target.position.set(0, 10, 0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(state.shadowSize, state.shadowSize);
  Object.assign(keyLight.shadow.camera, { left: -26, right: 26, top: 28, bottom: -22, near: 1, far: 92 });
  keyLight.shadow.bias = -.0003;
  keyLight.shadow.normalBias = .035;
  keyLight.shadow.radius = 2;
  scene.add(keyLight, keyLight.target);
  const fillLight = new THREE.DirectionalLight(0xe5f2fb, 1.1);
  fillLight.position.set(22, 14, 12);
  scene.add(fillLight);
  const rim = new THREE.DirectionalLight(0xffeaca, .85);
  rim.position.set(-8, 22, -19);
  scene.add(rim);
  const town = createTown();
  scene.add(town.root);
  const blobTexture = createBlobTexture();
  const baseShadow = new THREE.Mesh(new THREE.PlaneGeometry(33, 27), new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, opacity: .85, depthWrite: false }));
  baseShadow.rotation.x = -Math.PI / 2;
  baseShadow.position.y = -.61;
  scene.add(baseShadow);
  const contactShadows = town.floors.map(floor => {
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, opacity: .71, depthWrite: false }), floor.visuals.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    floor.root.add(mesh);
    return mesh;
  });
  const shadowNode = new THREE.Object3D();
  let timer = null;
  let raf = null;
  let dirty = true;
  let rendering = false;
  let disposed = false;
  let visible = !document.hidden;
  let lastTime = 0;
  let deadline = 0;
  let totalFrames = 0;
  let cycleFrames = 0;
  let framesRemaining = testMode ? Math.round(clamp(finite(query.get('frames') ?? 12, 12), 1, 120)) : Infinity;
  let budgetComplete = false;
  let transition = null;
  let toastCapturePending = false;
  let photoOpen = false;
  let frameTimes = [];
  let measuredFps = 0;
  let cpuFrameMs = 0;
  let lastStats = 0;
  let size = { width: 0, height: 0 };
  const targetPosition = new THREE.Vector3();
  const homeDirection = new THREE.Vector3(25, 12, 39).normalize();
  const status = { ready: false, renderFrames: 0, testMode, limited: testMode, budgetComplete: false, requestedFps: state.fps, fps: 0, cpuFrameMs: 0, drawCalls: 0, triangles: 0, paused: state.paused, threeRevision: THREE.REVISION, errors };
  const diagnosticsNode = document.createElement('script');
  diagnosticsNode.type = 'application/json';
  diagnosticsNode.id = 'scene-diagnostics';
  document.body.appendChild(diagnosticsNode);
  let ui;

  const save = () => {
    if (testMode || stillMode || query.has('fps')) return;
    try {
      const { fps, preset, detail, glass, speed, shell, particles, shadows } = state;
      localStorage.setItem('stacked-settings-v1', JSON.stringify({ fps, preset, detail, glass, speed, shell, particles, shadows }));
    } catch { /* The scene remains usable with storage disabled. */ }
  };

  function cancelScheduled() {
    if (timer !== null) clearTimeout(timer);
    if (raf !== null) cancelAnimationFrame(raf);
    timer = raf = null;
  }

  function hasAnimation() {
    return (!state.paused || state.rotate || transition !== null) && !budgetComplete && !photoOpen;
  }

  function schedule() {
    if (disposed || !visible || timer !== null || raf !== null || rendering || (!dirty && !hasAnimation())) return;
    const delay = Math.max(0, deadline - performance.now() - 2);
    timer = setTimeout(() => {
      timer = null;
      raf = requestAnimationFrame(tick);
    }, delay);
  }

  function invalidate() {
    dirty = true;
    schedule();
  }

  function fitDistance() {
    const desktop = size.width > 900;
    const portraitTablet = !desktop && size.width > 520 && size.height > size.width;
    const availableWidth = desktop ? size.width - (size.width > 1150 ? 570 : 490) : size.width - 48;
    const availableHeight = size.height - (desktop ? 215 : portraitTablet ? 430 : 250);
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return Math.max((desktop ? 30.5 : 29) * size.height / (2 * halfFov * Math.max(availableHeight, 260)), 26 * size.height / (2 * halfFov * Math.max(availableWidth, 250)));
  }

  function cameraDestination(selected = state.selected) {
    if (selected === 'all') {
      const target = new THREE.Vector3(0, 10.65 + state.explode / 100 * 4.6, 0);
      const distance = fitDistance() * (1 + state.explode / 100 * .25);
      return { target, position: target.clone().addScaledVector(homeDirection, distance) };
    }
    const y = FLOOR_BASE + Number(selected) * (FLOOR_GAP + state.explode / 100 * 3.2);
    const target = new THREE.Vector3(0, y + 1.35, 0);
    const distance = Math.max(size.width > 900 ? 32 : 38, fitDistance() * (size.width > 900 ? .72 : .94));
    return { target, position: target.clone().addScaledVector(new THREE.Vector3(19, 11, 26).normalize(), distance) };
  }

  function goToView(instant = false) {
    const destination = cameraDestination();
    if (instant || testMode || reducedMotion || budgetComplete) {
      camera.position.copy(destination.position);
      controls.target.copy(destination.target);
      transition = null;
      controls.update();
    } else {
      transition = { from: camera.position.clone(), targetFrom: controls.target.clone(), ...destination, start: performance.now(), duration: 680 };
    }
    invalidate();
  }

  function resize() {
    const width = Math.max(1, sceneHost.clientWidth);
    const height = Math.max(1, sceneHost.clientHeight);
    const wasInitialized = size.width > 0;
    const oldWidth = size.width;
    size = { width, height };
    if (wasInitialized && (oldWidth > 900) !== (width > 900)) {
      state.panel = width > 900;
      ui?.update();
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, state.dpr));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const xOffset = width <= 900 ? -width * (width > 520 && height > width ? .08 : .06) : 0;
    const yOffset = width <= 520 ? -12 : width <= 900 ? 46 : 37;
    camera.setViewOffset(width, height, xOffset, yOffset, width, height);
    camera.updateProjectionMatrix();
    if (!wasInitialized || (oldWidth > 900) !== (width > 900)) goToView(true);
    else if (state.selected === 'all' && !state.zen) goToView(true);
    invalidate();
  }

  function setShadowQuality() {
    renderer.shadowMap.enabled = state.shadows;
    if (keyLight.shadow.mapSize.x !== state.shadowSize) {
      keyLight.shadow.map?.dispose();
      keyLight.shadow.map = null;
      keyLight.shadow.mapSize.set(state.shadowSize, state.shadowSize);
    }
    renderer.shadowMap.needsUpdate = state.shadows;
  }

  function applySettings(changed) {
    town.setDetail(state.detail);
    town.particlesEnabled = state.particles;
    town.shell.root.visible = state.shell;
    town.shell.setTransparency(state.glass);
    town.setExpansion(state.explode / 100);
    town.setView(state.selected, state.solo);
    baseShadow.visible = !town.solo;
    town.update(0, false);
    if (['detail', 'shadows', 'explode', 'solo', 'preset', 'selected'].includes(changed)) setShadowQuality();
    if (changed === 'preset') resize();
    if (changed === 'explode' || changed === 'solo') goToView();
    status.requestedFps = state.fps;
    ui?.update();
    save();
    invalidate();
  }

  const actions = {
    setting(id, value) {
      state[id] = value;
      if (id === 'fps' && testMode) {
        state.fps = Math.min(testFps, value);
        if (value > testFps) ui.toast(`实测期间保持 ${testFps} FPS 上限`);
      }
      if (['detail', 'shadows', 'particles'].includes(id)) state.preset = 'custom';
      if (id === 'fps') { frameTimes = []; deadline = performance.now(); }
      if (id === 'panel') { ui.update(); return; }
      applySettings(id);
    },
    preset(name) {
      Object.assign(state, presets[name], { preset: name });
      if (testMode) state.fps = testFps;
      applySettings('preset');
      ui.toast({ eco: '节能模式，让小城慢下来', balanced: '平衡模式，刚刚好', fine: '精细模式，放大看看积木颗粒' }[name]);
    },
    floor(selected) {
      state.selected = selected;
      // Choosing a layer reveals a detailed cutaway; the overview restores the complete tower.
      state.solo = selected !== 'all';
      applySettings('selected');
      ui.caption(selected === 'all' ? '四个小世界，住在同一段好时光里。' : stories[Number(selected)].caption);
      goToView();
    },
    pause() {
      state.paused = !state.paused;
      if (!state.paused && budgetComplete) {
        framesRemaining = testMode ? 12 : Infinity;
        cycleFrames = 0;
        budgetComplete = false;
        frameTimes = [];
      }
      lastTime = 0;
      ui.update();
      invalidate();
    },
    reset() {
      state.selected = 'all';
      state.explode = 0;
      state.solo = false;
      state.rotate = false;
      applySettings('explode');
      ui.caption('四个小世界，住在同一段好时光里。');
      goToView();
    },
    zen() {
      state.zen = !state.zen;
      ui.update();
      if (state.zen) document.getElementById('exit-zen').focus();
      else document.getElementById('zen').focus();
      invalidate();
    },
    capture() { toastCapturePending = true; invalidate(); },
    closeCapture() { photoOpen = false; lastTime = 0; deadline = performance.now(); invalidate(); },
  };
  ui = bindUi(state, actions);

  function updateContactShadows() {
    town.floors.forEach((floor, index) => {
      if (!floor.root.visible) return;
      floor.visuals.forEach(({ actor, person }, i) => {
        shadowNode.position.set(actor.x, (actor.baseY ?? (person ? .375 : .29)) + .004, actor.z);
        shadowNode.rotation.set(-Math.PI / 2, 0, actor.yaw);
        shadowNode.scale.set(actor.halfX * (person ? 2.2 : 2.8), actor.halfZ * (person ? 2.2 : 2.7), 1);
        shadowNode.updateMatrix();
        contactShadows[index].setMatrixAt(i, shadowNode.matrix);
      });
      contactShadows[index].instanceMatrix.needsUpdate = true;
    });
  }

  function updateCamera(now, dt) {
    if (transition) {
      const progress = clamp((now - transition.start) / transition.duration, 0, 1);
      const ease = 1 - (1 - progress) ** 3;
      camera.position.lerpVectors(transition.from, transition.position, ease);
      controls.target.lerpVectors(transition.targetFrom, transition.target, ease);
      if (progress === 1) transition = null;
    }
    controls.autoRotate = state.rotate && !budgetComplete;
    controls.update(dt);
    targetPosition.copy(controls.target);
    controls.target.x = clamp(controls.target.x, -16, 16);
    controls.target.z = clamp(controls.target.z, -14, 14);
    controls.target.y = clamp(controls.target.y, -.5, 31.5);
    targetPosition.sub(controls.target);
    camera.position.sub(targetPosition);
  }

  function tick(now) {
    raf = null;
    if (disposed || !visible) return;
    const interval = 1000 / state.fps;
    if (now < deadline - .85) { schedule(); return; }
    const cpuStart = performance.now();
    rendering = true;
    const dt = lastTime ? clamp((now - lastTime) / 1000, 0, .25) : 1 / state.fps;
    lastTime = now;
    const animating = !state.paused && !budgetComplete && !photoOpen;
    town.update(dt * state.speed, animating);
    updateContactShadows();
    updateCamera(now, dt);
    renderer.render(scene, camera);
    totalFrames++;
    dirty = false;
    rendering = false;
    const renderMs = performance.now() - cpuStart;
    cpuFrameMs = totalFrames === 1 ? renderMs : cpuFrameMs * .75 + renderMs * .25;
    frameTimes.push(now);
    while (frameTimes.length > 2 && now - frameTimes[0] > 1800) frameTimes.shift();
    measuredFps = frameTimes.length > 1 ? 1000 * (frameTimes.length - 1) / (now - frameTimes[0]) : 0;
    if (framesRemaining !== Infinity && !budgetComplete) {
      cycleFrames++;
      framesRemaining--;
      if (framesRemaining <= 0) {
        budgetComplete = true;
        state.paused = true;
        transition = null;
        ui.update();
        ui.toast(`低负载实测完成 · ${cycleFrames} 帧后已停止渲染`);
      }
    }
    Object.assign(status, {
      ready: true, renderFrames: totalFrames, cycleFrames, budgetComplete, fps: Number(measuredFps.toFixed(2)),
      cpuFrameMs: Number(cpuFrameMs.toFixed(2)), drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles, paused: state.paused, lastFrameMs: Number(renderMs.toFixed(2)),
    });
    if (now - lastStats > 700 || budgetComplete || state.paused) {
      ui.stats(measuredFps, cpuFrameMs, !hasAnimation());
      lastStats = now;
    }
    if (toastCapturePending) {
      toastCapturePending = false;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = renderer.domElement.width;
      exportCanvas.height = renderer.domElement.height;
      const exportContext = exportCanvas.getContext('2d');
      exportContext.fillStyle = '#f3f1e9';
      exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      exportContext.drawImage(renderer.domElement, 0, 0);
      exportCanvas.toBlob(blob => {
        if (!blob) { ui.toast('画面保存失败，请再试一次'); return; }
        photoOpen = true;
        cancelScheduled();
        status.lastCapture = { bytes: blob.size, width: exportCanvas.width, height: exportCanvas.height, type: blob.type };
        ui.showCapture(blob, `层间-${state.selected === 'all' ? '四层日常' : stories[Number(state.selected)].title}.png`);
        diagnosticsNode.textContent = JSON.stringify(window.__STACKED__.snapshot());
      }, 'image/png');
    }
    if (totalFrames === 1) ui.ready();
    // Keep an absolute cadence so 120/144 Hz displays can average 60 FPS without drifting down.
    // Drop a missed window after a long stall instead of trying to catch up with a burst of frames.
    deadline = deadline <= 0 || now - deadline > interval * 2 ? now + interval : deadline + interval;
    schedule();
    diagnosticsNode.textContent = JSON.stringify(window.__STACKED__.snapshot());
    diagnosticsNode.dataset.frame = String(totalFrames);
  }

  controls.addEventListener('change', () => { if (!rendering) invalidate(); });
  controls.addEventListener('start', () => { transition = null; });
  renderer.domElement.addEventListener('pointerdown', () => renderer.domElement.focus({ preventScroll: true }));
  addEventListener('keydown', event => {
    if (document.getElementById('photo-dialog').open) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); actions.pause(); }
    if (event.key.toLowerCase() === 'r' || event.key === 'Home') { event.preventDefault(); actions.reset(); }
    if (event.key.toLowerCase() === 'h' || (event.key === 'Escape' && state.zen)) actions.zen();
    if (event.key === 'Escape' && state.panel && size.width <= 900 && !state.zen) actions.setting('panel', false);
    if (event.target !== renderer.domElement) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).multiplyScalar(event.key === 'ArrowLeft' ? -.6 : .6);
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') right.set(0, event.key === 'ArrowUp' ? .55 : -.55, 0);
      controls.target.add(right);
      camera.position.add(right);
      controls.update();
      invalidate();
    }
    if (['+', '=', '-', '_'].includes(event.key)) {
      event.preventDefault();
      const direction = camera.position.clone().sub(controls.target);
      direction.setLength(clamp(direction.length() * (event.key === '-' || event.key === '_' ? 1.13 : .87), controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(direction);
      controls.update();
      invalidate();
    }
  });
  renderer.domElement.addEventListener('dblclick', actions.reset);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(sceneHost);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (!visible) cancelScheduled();
    else { lastTime = 0; deadline = performance.now(); invalidate(); }
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelScheduled();
    disposed = true;
    showError(new Error('WebGL 绘图上下文中断，请重新加载小城。'));
  });
  addEventListener('pagehide', event => {
    if (event.persisted) { visible = false; cancelScheduled(); return; }
    disposed = true;
    cancelScheduled();
    resizeObserver.disconnect();
    controls.dispose();
    renderer.dispose();
  });
  addEventListener('pageshow', event => {
    if (event.persisted) { visible = !document.hidden; lastTime = 0; deadline = performance.now(); invalidate(); }
  });

  // Bounded diagnostics: snapshots are read-only; stepping advances simulation without rendering a loop.
  window.__STACKED__ = Object.freeze({
    snapshot() {
      return {
        ...status, state: { ...state }, size: { ...size }, parts: town.partCount,
        actors: town.traffic.actors.map(({ id, level, x, z, yaw, travelled, stopped }) => ({ id, level, x, z, yaw, travelled, stopped })),
        camera: { position: camera.position.toArray(), target: controls.target.toArray(), distance: camera.position.distanceTo(controls.target) },
        collisions: town.traffic.validate(), particleCapacity: 72,
        activeParticles: town.floors.reduce((sum, floor) => sum + (floor.particles?.points.visible ? floor.particles.pool.active : 0), 0),
        visibleFloors: town.floors.filter(floor => floor.root.visible).map(floor => floor.index),
        controls: { rightButtonPans: controls.mouseButtons.RIGHT === THREE.MOUSE.PAN, minDistance: controls.minDistance, maxDistance: controls.maxDistance },
        scheduled: timer !== null || raf !== null, renderer: { pixelRatio: renderer.getPixelRatio(), geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures },
      };
    },
    audit() { return { placement: town.traffic.validate(), routes: town.traffic.auditRoutes(720) }; },
    advance(seconds = 1) {
      const duration = clamp(finite(seconds, 1), 0, 60);
      const steps = Math.ceil(duration * 40);
      for (let i = 0; i < steps; i++) town.traffic.step(duration / steps);
      town.update(0, false);
      invalidate();
      return { seconds: duration, issues: town.traffic.validate() };
    },
    renderOnce() { invalidate(); },
  });
  applySettings('preset');
  resize();
  renderer.shadowMap.needsUpdate = state.shadows;
  invalidate();
}
