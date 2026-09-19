import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials } from './materials.js';
import { createTemple } from './temple.js';
import { createEnvironment } from './environment.js';
import { QUALITY, readOptions } from './config.js';
import { FrameScheduler, layerProgress, smoothStep } from './motion.js';
import { disposeScene } from './kit.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const options = readOptions(location.search);
const errors = [];
window.addEventListener('error', (event) => errors.push(event.message));
window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));

function showError(error) {
  console.error(error);
  $('#loading').hidden = true;
  const element = document.createElement('section');
  element.className = 'fatal-error';
  element.setAttribute('role', 'alert');
  const heading = document.createElement('h2');
  heading.textContent = '暂时无法打开三维场景';
  const message = document.createElement('p');
  message.textContent = '请使用支持 WebGL 的浏览器并开启硬件加速，然后刷新页面。项目须通过启动命令提供的 HTTP 地址访问。';
  const detail = document.createElement('p');
  detail.textContent = String(error.message || error);
  element.append(heading, message, detail);
  $('#app').append(element);
}

function start() {
  const viewport = $('#viewport');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.info.autoReset = false;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '可交互的祈年殿。拖动旋转，滚轮缩放，右键平移。方向键平移，R 复位，E 拆解，空格切换自动环绕。');
  viewport.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .3, 500);
  const materials = createMaterials();
  Object.values(materials).forEach((material) => { material.envMapIntensity = .5; });
  materials.gold.envMapIntensity = 1.1;
  materials.roof.envMapIntensity = .7;
  const temple = createTemple(materials);
  scene.add(temple.root);
  const environment = createEnvironment(scene, materials);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 8.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = .12;
  controls.enablePan = true;
  controls.minDistance = 15;
  controls.maxDistance = 215;
  controls.maxPolarAngle = Math.PI / 2 - .018;
  controls.minPolarAngle = .07;
  controls.rotateSpeed = .65;
  controls.zoomSpeed = .8;
  controls.panSpeed = .72;
  controls.autoRotate = false;
  controls.autoRotateSpeed = .23;
  controls.listenToKeyEvents(renderer.domElement);

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(scene, camera);
  const ao = new SSAOPass(scene, camera, 1, 1, 12);
  ao.kernelRadius = 1.05;
  ao.minDistance = .001;
  ao.maxDistance = .07;
  composer.addPass(renderPass);
  composer.addPass(ao);
  composer.addPass(new OutputPass());

  let quality = options.quality;
  let view = 'perspective';
  let size = { width: 0, height: 0, mobile: false };
  let cameraMotion = null;
  let labels = options.annotations;
  let toastTimer;
  let resizeTimer;
  let frameMilliseconds = 0;
  let initialFrame = true;
  let shadowDirty = true;
  let disposed = false;
  let userInteracting = false;
  const notes = $('#notes-dialog');
  const anchorElements = [...document.querySelectorAll('.annotation')];
  const anchorPoint = new THREE.Vector3();
  const diagnostics = $('#diagnostics');
  diagnostics.hidden = !options.test;

  function tell(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  function fitDistance() {
    const aspect = size.width / size.height;
    const available = size.mobile ? .9 : .68;
    const widthFit = 37 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect * available);
    return Math.max(size.mobile ? 108 : 70, widthFit);
  }

  function poseFor(preset = view, exploded = temple.exploder.target) {
    const target = new THREE.Vector3(0, exploded ? 19.5 : 8.2, 0);
    let direction;
    if (preset === 'front') direction = new THREE.Vector3(0, .19, 1);
    else if (preset === 'top') direction = new THREE.Vector3(.18, 1, .4);
    else direction = new THREE.Vector3(.4, .29, .89);
    direction.normalize();
    let distance = fitDistance();
    if (exploded) distance = Math.max(distance * 1.12, 91);
    if (preset === 'top') distance *= 1.13;
    return { target, position: direction.multiplyScalar(distance).add(target) };
  }

  function moveCamera(pose, duration = 1.25) {
    cameraMotion = {
      fromPosition: camera.position.clone(), fromTarget: controls.target.clone(),
      position: pose.position, target: pose.target, elapsed: 0,
      duration: reducedMotion ? .65 : duration,
    };
  }

  function updateCamera(dt) {
    if (!cameraMotion) return false;
    cameraMotion.elapsed = Math.min(cameraMotion.elapsed + dt, cameraMotion.duration);
    const t = smoothStep(cameraMotion.elapsed / cameraMotion.duration);
    camera.position.lerpVectors(cameraMotion.fromPosition, cameraMotion.position, t);
    controls.target.lerpVectors(cameraMotion.fromTarget, cameraMotion.target, t);
    if (t === 1) cameraMotion = null;
    return true;
  }

  function updateViewButtons(preset) {
    document.querySelectorAll('[data-view]').forEach((button) => {
      const selected = button.dataset.view === preset;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function wake(frames = 12) {
    if (options.test) scheduler.arm(frames);
    else scheduler.invalidate();
  }

  function setView(preset) {
    view = preset;
    updateViewButtons(preset);
    moveCamera(poseFor(preset));
    wake();
  }

  function setExploded(exploded) {
    temple.exploder.setTarget(exploded);
    $('#explode-button').setAttribute('aria-pressed', String(exploded));
    $('#explode-label').textContent = exploded ? '重组祈年殿' : '拆解祈年殿';
    $('#action-caption').textContent = exploded ? '再一次，看每个构件回到自己的位置' : '让屋檐之下的巧思，一层层展开';
    $('#intro-copy').replaceChildren();
    $('#intro-copy').append(exploded ? '从汉白玉台基，到鎏金宝顶。' : '一座祈年殿，六百年天地之间。');
    $('#intro-copy').append(document.createElement('br'));
    $('#intro-copy').append(exploded ? '看见层层相承的结构，读懂营造的智慧。' : '循着一片蓝瓦，走进中国古建的秩序之美。');
    moveCamera(poseFor(view, exploded), 1.8);
    wake();
    if (options.test) tell('测试按有限帧推进；可点“运行 24 帧”继续动画');
  }

  function setOrbit(value) {
    controls.autoRotate = value;
    $('#orbit-button').setAttribute('aria-pressed', String(value));
    wake();
  }

  function updateAnnotations() {
    const p = temple.exploder.progress;
    const anchors = {
      roof: [5.3, 19.55 + 18.2 * layerProgress(p, 0), 1.5],
      frame: [-6.9, 9.8 + 8.6 * layerProgress(p, .19), 6.4],
      terrace: [11.2, 2.9 + 3.5 * layerProgress(p, .4), 8.1],
    };
    for (const element of anchorElements) {
      anchorPoint.set(...anchors[element.dataset.anchor]).project(camera);
      const x = (anchorPoint.x * .5 + .5) * size.width;
      const y = (-anchorPoint.y * .5 + .5) * size.height;
      element.style.transform = `translate(${Math.min(size.width - 150, Math.max(size.mobile ? 20 : size.width * .36, x))}px, ${y}px)`;
      element.hidden = anchorPoint.z > 1 || anchorPoint.z < -1 || y < 95 || y > size.height - 120;
    }
  }

  function updateDiagnostics() {
    if (!options.test) return;
    const paused = scheduler.remaining <= 0;
    const data = {
      ready: !initialFrame,
      threeRevision: THREE.REVISION,
      frameCount: scheduler.frameCount,
      batchFrames: scheduler.batchCount,
      batchLimit: scheduler.batchLimit,
      remaining: scheduler.remaining,
      paused,
      fpsLimit: scheduler.fps,
      canvas: { width: renderer.domElement.width, height: renderer.domElement.height, cssWidth: size.width, cssHeight: size.height },
      pixelRatio: renderer.getPixelRatio(),
      quality,
      ambientOcclusion: ao.enabled,
      explosionProgress: Number(temple.exploder.progress.toFixed(6)),
      explosionTarget: temple.exploder.target,
      autoRotate: controls.autoRotate,
      camera: camera.position.toArray().map((n) => Number(n.toFixed(4))),
      target: controls.target.toArray().map((n) => Number(n.toFixed(4))),
      distance: Number(camera.position.distanceTo(controls.target).toFixed(4)),
      azimuth: Number(controls.getAzimuthalAngle().toFixed(6)),
      frameCpuMilliseconds: Number(frameMilliseconds.toFixed(2)),
      drawCalls: renderer.info.render.calls,
      submittedTriangles: renderer.info.render.triangles,
      geometryBuffers: renderer.info.memory.geometries,
      textureCount: renderer.info.memory.textures,
      architecture: temple.stats,
      errors: [...errors],
      remoteRequests: performance.getEntriesByType('resource').filter((entry) => /^https?:/.test(entry.name) && new URL(entry.name).origin !== location.origin).map((entry) => entry.name),
    };
    $('#diagnostic-summary').textContent = `${paused ? '已暂停' : '有限绘制中'} · ${scheduler.fps} FPS 上限 · 本批 ${scheduler.batchCount}/${scheduler.batchLimit} 帧\n解构 ${(temple.exploder.progress * 100).toFixed(1)}% · ${temple.stats.instances.toLocaleString()} 个实例`;
    $('#diagnostic-data').textContent = JSON.stringify(data, null, 2);
  }

  const scheduler = new FrameScheduler({
    fps: options.fps,
    test: options.test,
    frames: options.frames,
    render(dt) {
      if (disposed) return false;
      const startTime = performance.now();
      const interactive = !notes.open;
      const movingStructure = interactive && temple.exploder.update(dt);
      const movingCamera = interactive && updateCamera(dt);
      const oldAutoRotate = controls.autoRotate;
      const oldDamping = controls.enableDamping;
      if (movingCamera || !interactive) controls.autoRotate = false;
      if (movingCamera) controls.enableDamping = false;
      const movingControls = controls.update(dt);
      controls.autoRotate = oldAutoRotate;
      controls.enableDamping = oldDamping;
      // Clamp the target to a useful volume, even after repeated keyboard panning.
      const priorTarget = controls.target.clone();
      controls.target.clamp(new THREE.Vector3(-45, .4, -45), new THREE.Vector3(45, 50, 45));
      camera.position.add(controls.target.clone().sub(priorTarget));
      // Responsive framing must not put the hall inside distant atmospheric fog.
      const focusDistance = camera.position.distanceTo(controls.target);
      scene.fog.near = focusDistance + 26;
      scene.fog.far = focusDistance + 145;
      if (movingStructure || shadowDirty) {
        renderer.shadowMap.needsUpdate = true;
        shadowDirty = false;
      }
      renderer.info.reset();
      composer.render(dt);
      $('#structure-progress').style.width = `${temple.exploder.progress * 100}%`;
      $('#compass-needle').setAttribute('transform', `rotate(${controls.getAzimuthalAngle() * -180 / Math.PI} 32 32)`);
      if (labels) updateAnnotations();
      if (initialFrame) {
        initialFrame = false;
        $('#loading').hidden = true;
        viewport.dataset.ready = 'true';
      }
      frameMilliseconds = performance.now() - startTime;
      viewport.dataset.frames = String(scheduler.frameCount);
      updateDiagnostics();
      return interactive && (temple.exploder.active || cameraMotion !== null || controls.autoRotate || movingControls || userInteracting);
    },
    onPause: updateDiagnostics,
  });

  function resize(initial = false) {
    const rect = viewport.getBoundingClientRect();
    const oldFit = size.width ? fitDistance() : 0;
    size = { width: Math.round(rect.width), height: Math.round(rect.height), mobile: rect.width <= 900 };
    camera.aspect = size.width / size.height;
    camera.setViewOffset(size.width, size.height, size.mobile ? 0 : -size.width * .137, size.mobile ? -size.height * .17 : -size.height * .018, size.width, size.height);
    camera.updateProjectionMatrix();
    const preset = QUALITY[quality];
    const pixelBudget = quality === 'high' ? 3300000 : quality === 'eco' ? 1200000 : 2200000;
    const ratio = Math.min(devicePixelRatio || 1, preset.pixelRatio, Math.sqrt(pixelBudget / (size.width * size.height)));
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.width, size.height, false);
    composer.setPixelRatio(ratio);
    composer.setSize(size.width, size.height);
    ao.setSize(Math.max(1, Math.round(size.width * ratio * preset.aoScale)), Math.max(1, Math.round(size.height * ratio * preset.aoScale)));
    if (initial) {
      const pose = poseFor();
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
    } else if (oldFit) {
      camera.position.sub(controls.target).multiplyScalar(fitDistance() / oldFit).add(controls.target);
      cameraMotion = null;
    }
    controls.update(0);
    shadowDirty = true;
    scheduler.interact();
  }

  function setQuality(value) {
    quality = value;
    const preset = QUALITY[value];
    ao.enabled = preset.ao;
    $('#ao-toggle').checked = ao.enabled;
    if (environment.sun.shadow.mapSize.width !== preset.shadowSize) {
      environment.sun.shadow.mapSize.setScalar(preset.shadowSize);
      environment.sun.shadow.map?.dispose();
      environment.sun.shadow.map = null;
    }
    shadowDirty = true;
    resize();
    wake(2);
  }

  $('#quality-select').value = quality;
  if (![...$('#fps-select').options].some((option) => Number(option.value) === options.fps)) {
    $('#fps-select').add(new Option(`${options.fps} FPS`, String(options.fps)));
  }
  $('#fps-select').value = String(options.fps);
  ao.enabled = QUALITY[quality].ao;
  $('#ao-toggle').checked = ao.enabled;
  environment.sun.shadow.mapSize.setScalar(QUALITY[quality].shadowSize);

  $('#explode-button').addEventListener('click', () => setExploded(!temple.exploder.target));
  $('#orbit-button').addEventListener('click', () => setOrbit(!controls.autoRotate));
  $('#reset-button').addEventListener('click', () => setView('perspective'));
  $('#overview-button').addEventListener('click', () => {
    if (temple.exploder.target) setExploded(false);
    setView('perspective');
  });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  for (const [selector, factor] of [['#zoom-in', .8], ['#zoom-out', 1.25]]) {
    $(selector).addEventListener('click', () => {
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
      moveCamera({ position: controls.target.clone().add(offset), target: controls.target.clone() }, .5);
      wake(6);
    });
  }
  $('#annotation-button').addEventListener('click', () => {
    labels = !labels;
    $('#annotation-button').setAttribute('aria-pressed', String(labels));
    $('#annotations').classList.toggle('is-visible', labels);
    scheduler.interact();
  });
  $('#annotation-button').setAttribute('aria-pressed', String(labels));
  $('#annotations').classList.toggle('is-visible', labels);

  $('#settings-button').addEventListener('click', () => {
    const panel = $('#settings-panel');
    panel.hidden = !panel.hidden;
    $('#settings-button').setAttribute('aria-expanded', String(!panel.hidden));
  });
  $('#quality-select').addEventListener('change', (event) => setQuality(event.target.value));
  $('#fps-select').addEventListener('change', (event) => {
    scheduler.fps = Number(event.target.value);
    wake(2);
  });
  $('#ao-toggle').addEventListener('change', (event) => {
    ao.enabled = event.target.checked;
    wake(2);
  });
  $('#notes-button').addEventListener('click', () => notes.showModal());
  $('#close-notes').addEventListener('click', () => notes.close());
  notes.addEventListener('click', (event) => {
    if (event.target === notes) {
      const rect = notes.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) notes.close();
    }
  });
  notes.addEventListener('close', () => wake(1));
  $('#notes-explode').addEventListener('click', () => {
    notes.close();
    setExploded(true);
  });
  $('#test-step').addEventListener('click', () => scheduler.arm(1));
  $('#test-run').addEventListener('click', () => scheduler.arm(24));

  controls.addEventListener('start', () => {
    cameraMotion = null;
    userInteracting = true;
    updateViewButtons('');
    if (options.test) scheduler.arm(12);
    else scheduler.invalidate();
  });
  controls.addEventListener('change', () => scheduler.invalidate());
  controls.addEventListener('end', () => {
    userInteracting = false;
    scheduler.interact();
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (event.buttons) scheduler.interact();
  });
  renderer.domElement.addEventListener('keydown', (event) => {
    if (event.key === 'r' || event.key === 'R' || event.key === 'Home') { event.preventDefault(); setView('perspective'); }
    else if (event.key === 'e' || event.key === 'E') { event.preventDefault(); setExploded(!temple.exploder.target); }
    else if (event.code === 'Space') { event.preventDefault(); setOrbit(!controls.autoRotate); }
    else if (event.key.startsWith('Arrow')) wake(6);
    else if (event.key === '+' || event.key === '=') $('#zoom-in').click();
    else if (event.key === '-') $('#zoom-out').click();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      $('#settings-panel').hidden = true;
      $('#settings-button').setAttribute('aria-expanded', 'false');
    }
  });
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => resize(), 100);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scheduler.suspend();
    else scheduler.resume();
  });
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    scheduler.suspend();
    tell('图形上下文暂时中断，恢复后继续显示');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    shadowDirty = true;
    scheduler.resume();
    wake(1);
  });

  resize(true);
  scheduler.invalidate();
  if (options.still) controls.autoRotate = false;

  // Dispose GPU buffers on navigation and Vite hot replacement.
  function dispose() {
    if (disposed) return;
    disposed = true;
    scheduler.suspend();
    clearTimeout(toastTimer);
    clearTimeout(resizeTimer);
    controls.dispose();
    ao.dispose();
    ao.ssaoMaterial.dispose();
    ao.noiseTexture.dispose();
    composer.passes.forEach((pass) => { if (pass !== ao && pass.dispose) pass.dispose(); });
    composer.dispose();
    disposeScene(scene);
    environment.sky.dispose();
    renderer.dispose();
  }
  window.addEventListener('pagehide', (event) => { if (!event.persisted) dispose(); });
  if (import.meta.hot) import.meta.hot.dispose(dispose);
}

try {
  start();
} catch (error) {
  showError(error);
}
