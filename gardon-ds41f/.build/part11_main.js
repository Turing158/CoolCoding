/* ------------------------------------------------------------------ */
/* 49.  Clouds — soft, high, slowly drifting puffs                      */
/* ------------------------------------------------------------------ */

const CLOUDS = { mesh: null, items: [], mat: null, count: 14 };

function buildClouds() {
  const chunks = [];
  const r = rng(2024);
  const lobes = 9;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * TAU;
    const rr = i === 0 ? 0 : 0.34 + r() * 0.40;
    const s = (i === 0 ? 0.52 : 0.30) + r() * 0.26;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * rr, (r() - 0.5) * 0.08, Math.sin(a) * rr * 0.64),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 0.2, r() * TAU, r() * 0.2)),
      new THREE.Vector3(s * 1.5, s * 0.46, s * 0.95));
    const v = 0.96 + r() * 0.04;
    chunks.push({ geo: BOX1, matrix: m, color: new THREE.Color(v, v, v) });
  }
  const tmpl = mergeChunks(chunks);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1.0, metalness: 0, flatShading: true,
    transparent: true, opacity: 0.55, depthWrite: false, fog: true
  });
  const mesh = new THREE.InstancedMesh(tmpl, mat, CLOUDS.count);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  mesh.name = 'clouds';
  scene.add(mesh);
  CLOUDS.mesh = mesh; CLOUDS.mat = mat;
  for (let i = 0; i < CLOUDS.count; i++) {
    CLOUDS.items.push({
      x: (hash1(i * 3.3) * 2 - 1) * 22,
      z: (hash1(i * 7.7) * 2 - 1) * 22,
      y: 10.5 + hash1(i * 5.1) * 4.5,
      s: 0.85 + hash1(i * 9.3) * 1.1,
      speed: 0.09 + hash1(i * 2.7) * 0.10,
      dir: hash1(i * 4.9) > 0.5 ? 1 : -1,
      phase: hash1(i * 6.1) * TAU
    });
  }
  return mesh;
}

const _cloudDummy = new THREE.Object3D();
function updateClouds(t) {
  for (let i = 0; i < CLOUDS.count; i++) {
    const c = CLOUDS.items[i];
    const x = c.x + c.dir * t * c.speed;
    const span = 44;
    const wrapped = ((x + span) % (span * 2) + span * 2) % (span * 2) - span;
    _cloudDummy.position.set(wrapped, c.y + Math.sin(t * 0.12 + c.phase) * 0.2, c.z);
    _cloudDummy.rotation.set(0, t * 0.015 * c.dir + c.phase, 0);
    _cloudDummy.scale.setScalar(c.s);
    _cloudDummy.updateMatrix();
    CLOUDS.mesh.setMatrixAt(i, _cloudDummy.matrix);
  }
  CLOUDS.mesh.instanceMatrix.needsUpdate = true;
  CLOUDS.mesh.visible = S.daylight > 0.05;
  if (!CLOUDS.mesh.visible) return;
  const warm = clamp(1 - smoothstep(4, 26, S.sunElev), 0, 1);
  CLOUDS.mat.color.copy(C(0xffffff)).lerp(DAY.sunCol, warm * 0.85).multiplyScalar(0.34 + 0.68 * S.daylight);
  CLOUDS.mat.opacity = 0.16 + 0.42 * S.daylight;
}

/* ------------------------------------------------------------------ */
/* 50.  Assemble the whole world                                        */
/* ------------------------------------------------------------------ */

function buildWorld() {
  buildMaterials();
  buildHeightGrid();
  DESK.y = WORLD.trayBottom - 0.34;
  DESK.size = WORLD.half * 2 + 4.6;

  buildGround();
  buildWater();

  buildPaths();
  buildDesk();
  buildWalkways();
  buildDeskProps();

  buildGreenhouse();
  buildBookhouse();
  buildKiosk();
  buildGazebo();
  buildDock();
  buildBridge();
  buildIsland();
  scene.add(BUILDINGS.group);

  buildVegetation();

  buildPeople();
  buildBoat();

  // drifting particles: allocated once, only switched on and off
  VEG.petals = new DriftField(300, {
    name: 'petals', area: 11.5, top: 3.4, bottom: 0.1, speed: 0.26, sway: 0.5,
    spin: 1.8, size: 0.052, soft: 0.55, colorA: C(0xf6bdd0), colorB: C(0xfdf1f3), seed: 111
  });
  VEG.leaves = new DriftField(260, {
    name: 'fallingleaves', area: 12.0, top: 3.2, bottom: 0.1, speed: 0.36, sway: 0.8,
    spin: 2.6, size: 0.056, soft: 0.30, colorA: C(0xd8a03c), colorB: C(0xb0542c), seed: 222
  });
  VEG.snowflakes = new DriftField(380, {
    name: 'snowfall', area: 12.5, top: 4.2, bottom: 0.1, speed: 0.22, sway: 0.66,
    spin: 0.9, size: 0.030, soft: 0.85, colorA: C(0xffffff), colorB: C(0xdcecf6), seed: 333
  });
  buildRain(420);
  buildDrips();
  buildClouds();
  buildButterflies(12);
  buildBirds(7);
  buildFireflies(46);
  buildKnobs();
  buildMist();

  scene.fog = new THREE.FogExp2(DAY.fog.getHex(), 0.008);
}

/* ------------------------------------------------------------------ */
/* 51.  Season → shader uniforms                                        */
/*                                                                    */
/*  The colour ramps are built once at load time; the per-frame path    */
/*  only copies values into the live uniforms, so nothing is allocated  */
/*  while the garden is running.                                        */
/* ------------------------------------------------------------------ */

const LEAF_RAMP_A = [[0.02, C(0xb3dc8e)], [0.22, C(0x9ecb74)], [0.42, C(0x8fbe62)],
  [0.56, C(0xa8b45c)], [0.70, C(0xb0a070)], [0.84, C(0xa89e86)], [0.96, C(0xa8ac96)]];
const LEAF_RAMP_B = [[0.02, C(0x7fb85e)], [0.24, C(0x549b45)], [0.44, C(0x4a8b40)],
  [0.58, C(0x6d8a44)], [0.72, C(0x8a7f56)], [0.86, C(0x8a8274)], [0.96, C(0x8a8f80)]];
const AUTUMN_RAMP = [[0.44, C(0xd8c04c)], [0.52, C(0xdca83a)], [0.60, C(0xd07a2e)],
  [0.67, C(0xb0542c)], [0.74, C(0x94452c)], [0.88, C(0x7a5340)], [0.98, C(0x6f4d3c)]];
const AUTUMN_AMT = [[0.48, 0.0], [0.545, 0.20], [0.60, 0.60],
  [0.66, 0.88], [0.72, 1.0], [0.86, 1.0], [0.94, 0.62], [1.0, 0.34]];
const C_NIGHT_SKY = C(0x24344f);
const C_NIGHT_SUN = C(0x8fa6cc);
const C_NIGHT_WATER = C(0x5f7fa8);
const C_SHALLOW = C(0xa8dbe8);
const C_MIST = C(0xe9eff3);

function updateSeasonUniforms(t) {
  // ---- foliage -------------------------------------------------------
  curveColor(S.phase, LEAF_RAMP_A, VEGU.uLeafA.value);
  curveColor(S.phase, LEAF_RAMP_B, VEGU.uLeafB.value);
  curveColor(S.phase, AUTUMN_RAMP, VEGU.uAutumn.value);
  // the turn creeps in from the outside of each crown, species by species
  VEGU.uAutumnAmt.value = curveNum(S.phase, AUTUMN_AMT);
  VEGU.uTurnSpread.value = 0.30;
  VEGU.uCanopy.value = S.canopy;
  VEGU.uLeafSize.value = S.leafSize;
  VEGU.uDaylight.value = clamp(0.30 + 0.78 * S.daylight, 0, 1.1);

  // ---- ground cover --------------------------------------------------
  VEGU.uGrassCol.value.copy(S.grassTint);
  VEGU.uGrassTint2.value.copy(S.grassTint).multiplyScalar(0.64);
  VEGU.uGrassAmt.value = clamp(S.grassLush * 1.18, 0.10, 1.22);

  // ---- flowers, blossom, snow, frost ---------------------------------
  const flowerAmt = clamp(S.flowerBloom, 0, 1);
  for (const u of VEG.flowerMats) u.uFlowerAmt.value = flowerAmt;
  VEG.hydrangeaU.uFlowerAmt.value = clamp(S.hydrangea, 0, 1);
  VEG.lotusU.uFlowerAmt.value = clamp(S.lotus, 0, 1);
  const bloom = clamp(S.blossom * 1.15 - 0.03, 0, 1);
  if (VEG.blossomU) VEG.blossomU.uBlossom.value = bloom;
  VEGU.uBlossom.value = bloom;
  VEGU.uBlossomCol.value.copy(S.blossomCol);
  VEGU.uSnowAmt.value = clamp(S.snow - 0.04, 0, 1.2);
  VEGU.uFrost.value = clamp(S.frost, 0, 1);

  // ---- falling particles ---------------------------------------------
  VEG.petals.update(dtLast, t,
    clamp(S.petal, 0, 1) * clamp(1 - S.ice * 1.8, 0, 1) * clamp(0.5 + 0.6 * S.daylight, 0, 1.1) * QUALITY.particles,
    VEGU.uWind.value);
  VEG.leaves.update(dtLast, t,
    clamp(S.leafDrop, 0, 1) * clamp(1 - S.snow * 1.35, 0, 1) * QUALITY.particles,
    VEGU.uWind.value);
  VEG.snowflakes.update(dtLast, t,
    clamp((S.snow - 0.30) * 1.6, 0, 1) * QUALITY.particles,
    VEGU.uWind.value);

  // ---- water and mist -------------------------------------------------
  WATER_U.uIce.value = clamp(S.ice, 0, 1);
  WATER_U.uMelt.value = clamp(S.iceMelt * S.drip * 1.3, 0, 1);
  WATER_U.uSnow.value = clamp(S.snow * 1.0 - 0.06, 0, 1);
  WATER_U.uWave.value = lerp(0.3, 1.0, clamp(S.stream, 0, 1)) * (1 - 0.5 * S.ice);
  WATER_U.uFlow.value = S.stream;
  WATER_U.uSunDir.value.copy(SUN_DIR);
  WATER_U.uDaylight.value = clamp(0.20 + 0.98 * S.daylight, 0, 1.25);
  // after dark the lake reflects the night sky, never the sunset
  WATER_U.uSky.value.copy(DAY.zenith).lerp(DAY.horizon, 0.45);
  WATER_U.uSky.value.lerp(C_NIGHT_SKY, S.night * 0.85);
  WATER_U.uSunCol.value.copy(DAY.sunCol).lerp(C_NIGHT_SUN, S.night * 0.9);
  WATER_U.uShallow.value.copy(C_SHALLOW).lerp(C_NIGHT_WATER, S.night * 0.9);
  WATER_U.uFogColor.value.copy(DAY.fog);
  if (GROUND.stream) GROUND.stream.visible = S.stream > 0.015;

  MIST_U.uAmount.value = clamp(S.mist * clamp(0.35 + 0.80 * (1 - S.daylight), 0.4, 1.2), 0, 1.1);
  MIST_U.uColor.value.copy(C_MIST).lerp(DAY.horizon, 0.42);
  MIST_U.uSunCol.value.copy(DAY.sunCol);
  MIST_U.uDaylight.value = S.daylight;

  updateFogUniforms();
  syncDriftFog();

  // ---- lamps wake up as the light goes, and in the cold ---------------
  // a dusk ramp that crosses before full darkness, so lamps ease on gradually
  const dusk = 1 - smoothstep(0, 0.72, S.daylight);
  const glowAmt = clamp(S.lampWarm * (0.06 + 1.15 * dusk) + dusk * 0.10, 0, 1.25);
  for (const mesh of BILLBOARDS) {
    mesh.material.opacity = clamp(glowAmt * (mesh.material.userData.base || 1), 0, 1);
  }
  // the lamps themselves also take over the night lighting of the garden
  if (BUILDINGS.lampGreenhouse) {
    BUILDINGS.lampGreenhouse.material.color.setRGB(
      0.35 + 0.65 * glowAmt, 0.30 + 0.60 * glowAmt, 0.22 + 0.52 * glowAmt);
  }
  if (BUILDINGS.lampWarmLight) BUILDINGS.lampWarmLight.intensity = 3.0 * S.night * glowAmt;
  if (BUILDINGS.lampBookLight) BUILDINGS.lampBookLight.intensity = 2.2 * S.night * glowAmt;
  if (BUILDINGS.lampKioskLight) BUILDINGS.lampKioskLight.intensity = 1.8 * S.night * glowAmt;
  if (DESKPROPS.candleFlame) {
    const f = 0.30 + 0.7 * S.night;
    DESKPROPS.candleFlame.material.opacity = f;
    DESKPROPS.candleFlame.scale.setScalar(0.88 + 0.24 * f + Math.sin(t * 9.1) * 0.035);
  }
  if (DESKPROPS.steamMat) {
    DESKPROPS.steamMat.uniforms.uTime.value = t * 0.55;
    DESKPROPS.steamMat.uniforms.uAmount.value = 0.5 + 0.5 * clamp(1 - S.temperature / 26, 0, 1);
  }
  BUILDINGS.lampGlowAmount = glowAmt;
}

const FOG_BASE = 0.008, FOG_MIST = 0.034;
function updateFogUniforms() {
  scene.fog.color.copy(DAY.fog);
  scene.fog.density = FOG_BASE + S.mist * FOG_MIST;
}
function syncDriftFog() {
  const dens = scene.fog.density;
  WATER_U.uFogColor.value.copy(DAY.fog);
  WATER_U.uFogDensity.value = dens;
  MIST_U.uFogColor.value.copy(DAY.fog);
  MIST_U.uFogDensity.value = dens;
  for (const f of [VEG.petals, VEG.leaves, VEG.snowflakes]) {
    if (!f) continue;
    f.mat.uniforms.uFogColor.value.copy(DAY.fog);
    f.mat.uniforms.uFogDensity.value = dens;
  }
  if (RAIN.field) {
    RAIN.field.mat.uniforms.uFogColor.value.copy(DAY.fog);
    RAIN.field.mat.uniforms.uFogDensity.value = dens;
  }
}

/* ------------------------------------------------------------------ */
/* 52.  The day / night clock                                           */
/* ------------------------------------------------------------------ */

const DAYCLOCK = { frac: 0.35, secondsPerDay: 200, speed: 1 };

function updateDayClock(dt) {
  DAYCLOCK.frac = (DAYCLOCK.frac + dt / DAYCLOCK.secondsPerDay * DAYCLOCK.speed) % 1;
}

/* ------------------------------------------------------------------ */
/* 53.  Simulation step                                                 */
/* ------------------------------------------------------------------ */

let dtLast = 1 / 60;
let simTime = 0;
let seasonSmooth = SEASON.phase;

function stepSimulation(dt) {
  simTime += dt;
  dtLast = dt;

  if (!SEASON.paused) {
    SEASON.phase = (SEASON.phase + dt / QUALITY.cycle * SEASON.timeScale) % 1;
    updateDayClock(dt);
  }
  // smooth whatever the user did to the scrubber or the knobs
  let dp = SEASON.phase - seasonSmooth;
  dp -= Math.round(dp);
  seasonSmooth = ((seasonSmooth + dp * (1 - Math.exp(-3.4 * dt))) % 1 + 1) % 1;

  updateSeasonState(seasonSmooth, DAYCLOCK.frac);
  updateSkyAndLight();
  updateWind(simTime);
  updateSeasonUniforms(simTime);

  updateGroundColorsThrottled(dt);
  updateMist(dt, simTime);

  updatePeople(dt);
  updateBoat(dt);
  updateButterflies(dt, simTime);
  updateBirds(dt, simTime);
  updateFireflies(dt, simTime);
  updateClouds(simTime);
  updateRain(dt, simTime);
  updateDrips(dt, simTime);

  updateKnobs(dt);
  controls.autoRotate = QUALITY.autoRotate;
  controls.autoRotateSpeed = 0.34 * QUALITY.orbitSpeed * (QUALITY.autoRotate ? 1 : 0);
  controls.update();

  for (const h of BILLBOARDS) h.quaternion.copy(camera.quaternion);
}

let groundAccum = 0;
function updateGroundColorsThrottled(dt) {
  groundAccum += dt;
  // the ground only shifts a few times a second — plenty, and much cheaper
  if (groundAccum < 0.12) return;
  groundAccum = 0;
  updateGroundColors();
}

/* ------------------------------------------------------------------ */
/* 54.  Loop with a real frame-rate cap                                 */
/* ------------------------------------------------------------------ */

let rafId = 0;
let lastFrameTime = 0;
let frameAccum = 0;
let lastInteraction = performance.now();

function markInteraction() {
  lastInteraction = performance.now();
  if (QUALITY.idlePause) frameAccum = 0;
}

function loop(now) {
  rafId = requestAnimationFrame(loop);
  if (!lastFrameTime) lastFrameTime = now;
  let elapsed = now - lastFrameTime;
  lastFrameTime = now;
  if (elapsed > 250) elapsed = 250;              // returning from a background tab
  frameAccum += elapsed;

  // idle pause: stop drawing and simulating when nobody is looking
  if (QUALITY.idlePause && now - lastInteraction > 12000) {
    frameAccum = 0;
    return;
  }

  const cap = QUALITY.maxFPS;
  if (cap > 0) {
    const minDelta = 1000 / cap;
    if (frameAccum < minDelta * 0.94) return;
    frameAccum -= minDelta;
    if (frameAccum < 0) frameAccum = 0;
  } else {
    frameAccum = 0;
  }

  const dt = Math.min(0.05, Math.max(0.0005, elapsed / 1000));
  stepSimulation(dt);
  renderScene();
  fpsCounter.tick(now);

  // a ready flag other tooling can poll (used by the offline capture harness)
  window.__frames = (window.__frames || 0) + 1;
  window.__lastFps = fpsCounter.fps;
}

/* ------------------------------------------------------------------ */
/* 55.  Diagnostics                                                     */
/* ------------------------------------------------------------------ */

const fpsCounter = {
  frames: 0, last: 0, fps: 0,
  tick(now) {
    this.frames++;
    if (now - this.last >= 500) {
      this.fps = this.frames * 1000 / (now - this.last);
      this.frames = 0;
      this.last = now;
    }
  }
};

let showDiag = true;
const diagEl = document.getElementById('diag');
let diagTick = 0;

function paintDiagnostics(dt) {
  if (!showDiag) return;
  diagTick += dt;
  if (diagTick < 0.4) return;
  diagTick = 0;
  const info = renderer.info;
  const tri = info.render.triangles >= 1000
    ? (info.render.triangles / 1000).toFixed(0) + 'k' : String(info.render.triangles);
  const plants = VEG.counts.leaves + VEG.counts.grass + VEG.counts.flowers + VEG.counts.snow;
  diagEl.innerHTML =
    '<b>' + fpsCounter.fps.toFixed(0) + '</b> fps · ' + tri + ' tri<br>' +
    info.render.calls + ' calls · ' + plants + ' 株实例<br>' +
    '雪 ' + S.snow.toFixed(2) + ' · 冰 ' + S.ice.toFixed(2) + ' · 雾 ' + S.mist.toFixed(2) + '<br>' +
    '花瓣 ' + S.petal.toFixed(2) + ' · 落叶 ' + S.leafDrop.toFixed(2) + ' · 风 ' + VEGU.uWindAmp.value.toFixed(2);
}

function renderScene() {
  if (QUALITY.autoExposure) {
    renderer.toneMappingExposure = damp(renderer.toneMappingExposure, DAY.exposure, 1.1, dtLast);
  }
  renderer.render(scene, camera);
  paintDiagnostics(dtLast);
}

/* ------------------------------------------------------------------ */
/* 56.  UI                                                              */
/* ------------------------------------------------------------------ */

const ui = {};
let inputSpeed = null, inputWeather = null;

function fmtTime(frac) {
  const h = (frac * 24) % 24;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
}

function updateReadouts() {
  const p = SEASON.phase;
  ui.seasonName.textContent = SEASON_NAMES[seasonIndexOf(p)];
  ui.tempChip.textContent = S.temperature.toFixed(1) + '℃';
  ui.clockChip.textContent = fmtTime(DAYCLOCK.frac);
  ui.dayChip.textContent = '昼 ' + S.dayLength.toFixed(1) + 'h';
  ui.yearFill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  ui.yearCursor.style.left = (p * 100).toFixed(2) + '%';
  ui.speedVal.textContent = SEASON.timeScale.toFixed(2) + '×';
  if (inputSpeed) inputSpeed.value = Math.round(SEASON.timeScale / 3 * 300);
  if (inputWeather) inputWeather.value = Math.round(SEASON.weather / 1.5 * 150);
}

function hintFade() {
  const h = document.getElementById('knobHint');
  if (h) h.classList.add('fade');
}

function setOrbit(v) {
  QUALITY.autoRotate = v;
  document.getElementById('btnOrbit').classList.toggle('on', v);
  const seg = document.getElementById('segOrbit');
  if (seg) for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', (+b.dataset.v === 1) === v);
}

function applyPreset(v) {
  QUALITY.preset = v;
  Object.assign(QUALITY, PRESETS[v]);
  const rs = Math.round(PRESETS[v].renderScale * 100);
  document.getElementById('rScale').value = rs;
  document.getElementById('vScale').textContent = rs + '%';
  document.getElementById('selShadow').value = String(PRESETS[v].shadowSize);
  const ps = Math.round(PRESETS[v].particles * 100);
  document.getElementById('rPart').value = ps;
  document.getElementById('vPart').textContent = ps + '%';
  document.getElementById('selFps').value = String(PRESETS[v].maxFPS);
  document.getElementById('swGlow').classList.toggle('on', !!PRESETS[v].bloom);
  applyQuality();
  frameAccum = 0;
}

function installUI() {
  ui.seasonName = document.getElementById('seasonName');
  ui.tempChip = document.getElementById('tempChip');
  ui.clockChip = document.getElementById('clockChip');
  ui.dayChip = document.getElementById('dayChip');
  ui.yearBar = document.getElementById('yearBar');
  ui.yearFill = document.getElementById('yearFill');
  ui.yearCursor = document.getElementById('yearCursor');
  ui.speedVal = document.getElementById('speedVal');
  inputSpeed = document.getElementById('speedRange');
  inputWeather = document.getElementById('weatherRange');

  const marks = document.getElementById('yearMarks');
  for (let i = 1; i < 4; i++) {
    const el = document.createElement('i');
    el.style.left = (i * 25) + '%';
    marks.appendChild(el);
  }

  const btnPlay = document.getElementById('btnPlay');
  btnPlay.addEventListener('click', () => {
    SEASON.paused = !SEASON.paused;
    btnPlay.textContent = SEASON.paused ? '继续' : '暂停';
    btnPlay.classList.toggle('on', SEASON.paused);
    markInteraction();
  });

  const btnOrbit = document.getElementById('btnOrbit');
  btnOrbit.addEventListener('click', () => { setOrbit(!QUALITY.autoRotate); markInteraction(); });

  inputSpeed.addEventListener('input', () => {
    SEASON.timeScale = inputSpeed.value / 300 * 3;
    updateReadouts();
  });
  inputWeather.addEventListener('input', () => {
    SEASON.weather = inputWeather.value / 150 * 1.5;
    updateReadouts();
  });

  // ---- season scrubber ----------------------------------------------
  let scrubbing = false;
  const scrubTo = (e) => {
    const r = ui.yearBar.getBoundingClientRect();
    SEASON.phase = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
    markInteraction();
    updateReadouts();
  };
  ui.yearBar.addEventListener('pointerdown', (e) => {
    scrubbing = true;
    try { ui.yearBar.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    scrubTo(e);
  });
  ui.yearBar.addEventListener('pointermove', (e) => { if (scrubbing) scrubTo(e); });
  ui.yearBar.addEventListener('pointerup', (e) => {
    scrubbing = false;
    try { ui.yearBar.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  ui.yearBar.addEventListener('pointercancel', () => { scrubbing = false; });

  // ---- settings panel -------------------------------------------------
  const panel = document.getElementById('panel');
  document.getElementById('gear').addEventListener('click', () => {
    panel.classList.toggle('open');
    markInteraction();
  });

  const segPreset = document.getElementById('segPreset');
  segPreset.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    for (const x of segPreset.querySelectorAll('button')) x.classList.toggle('on', x === b);
    applyPreset(+b.dataset.v);
  });

  const selFps = document.getElementById('selFps');
  selFps.addEventListener('change', () => { QUALITY.maxFPS = +selFps.value; frameAccum = 0; });

  const rScale = document.getElementById('rScale'), vScale = document.getElementById('vScale');
  rScale.addEventListener('input', () => {
    QUALITY.renderScale = rScale.value / 100;
    vScale.textContent = rScale.value + '%';
    applyQuality();
  });

  const selShadow = document.getElementById('selShadow');
  selShadow.addEventListener('change', () => {
    QUALITY.shadowSize = +selShadow.value;
    QUALITY.shadowsOn = QUALITY.shadowSize > 0;
    applyQuality();
  });

  const rPart = document.getElementById('rPart'), vPart = document.getElementById('vPart');
  rPart.addEventListener('input', () => {
    QUALITY.particles = rPart.value / 100;
    vPart.textContent = rPart.value + '%';
  });

  const bindSwitch = (id, initial, fn) => {
    const el = document.getElementById(id);
    el.classList.toggle('on', !!initial);
    el.addEventListener('click', () => {
      const v = !el.classList.contains('on');
      el.classList.toggle('on', v);
      fn(v);
      markInteraction();
    });
  };
  bindSwitch('swIdle', QUALITY.idlePause, v => { QUALITY.idlePause = v; frameAccum = 0; });
  bindSwitch('swExpo', QUALITY.autoExposure, v => { QUALITY.autoExposure = v; });
  bindSwitch('swGlow', QUALITY.bloom, v => {
    QUALITY.bloom = v;
    if (skyMat) skyMat.uniforms.uBloom.value = v ? 1 : 0;
  });
  bindSwitch('swDiag', showDiag, v => {
    showDiag = v;
    diagEl.style.display = v ? '' : 'none';
  });

  const segOrbit = document.getElementById('segOrbit');
  segOrbit.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    setOrbit(+b.dataset.v === 1);
    markInteraction();
  });

  const rOrbit = document.getElementById('rOrbit'), vOrbit = document.getElementById('vOrbit');
  rOrbit.addEventListener('input', () => {
    QUALITY.orbitSpeed = rOrbit.value / 100;
    vOrbit.textContent = (rOrbit.value / 100).toFixed(1) + '×';
  });

  const rCycle = document.getElementById('rCycle'), vCycle = document.getElementById('vCycle');
  rCycle.addEventListener('input', () => {
    QUALITY.cycle = +rCycle.value;
    vCycle.textContent = rCycle.value + 's';
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); btnPlay.click(); }
    else if (e.code === 'KeyR') setOrbit(!QUALITY.autoRotate);
    else if (e.code === 'KeyH') {
      const el = document.getElementById('hud');
      el.style.display = el.style.display === 'none' ? '' : 'none';
    }
  });

  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'touchstart']) {
    window.addEventListener(ev, markInteraction, { passive: true });
  }
  controls.addEventListener('start', markInteraction);
  controls.addEventListener('change', markInteraction);
}

/* ------------------------------------------------------------------ */
/* 57.  Boot                                                            */
/* ------------------------------------------------------------------ */

function bootFail(msg) {
  const b = document.getElementById('boot');
  if (b) {
    b.innerHTML = '<div class="box"><h2>无法启动</h2><p style="max-width:70vw;line-height:1.7">' +
      String(msg).replace(/</g, '&lt;') + '</p></div>';
  }
  if (window.__report) window.__report('init: ' + msg);
}

/**
 * Debug / capture hooks so a screenshot run can freeze an exact moment:
 *   ?phase=0..1  &hour=0..24  &t  &cam=distance,elevation,azimuth  &hideui=1
 *   &hide=name,name  &bench=N   &noorbit=1
 */
function applyDebugQuery() {
  const q = new URLSearchParams(location.search);
  if (q.has('phase')) {
    SEASON.phase = clamp(parseFloat(q.get('phase')) || 0, 0, 0.9999);
    seasonSmooth = SEASON.phase;                    // no settle-in when capturing
  }
  if (q.has('bench')) {
    const r = window.__bench(parseInt(q.get('bench'), 10) || 120);
    window.__benchNote = 'bench ' + r.msPerFrame + ' ms/frame (~' + r.fpsEquiv + ' fps)';
    window.__note = window.__benchNote;
    window.__paint();
  }
  if (q.has('hour')) DAYCLOCK.frac = clamp((parseFloat(q.get('hour')) || 12) / 24, 0, 0.9999);
  else if (q.has('day')) DAYCLOCK.frac = clamp(parseFloat(q.get('day')) || 0.35, 0, 0.9999);
  if (q.has('t')) {
    const st = parseFloat(q.get('t'));
    DAYCLOCK.secondsPerDay = 1e9;                       // freeze the clock
    DAYCLOCK.frac = clamp(((st % 86400) + 86400) % 86400 / 86400, 0, 0.9999);
  }
  if (q.has('cam')) {
    const a = q.get('cam').split(',').map(Number);
    if (a.length >= 2) {
      const d = a[0], el = a[1] * PI / 180, az = (a.length > 2 ? a[2] : 40) * PI / 180;
      camera.position.set(
        controls.target.x + Math.cos(el) * Math.sin(az) * d,
        controls.target.y + Math.sin(el) * d,
        controls.target.z + Math.cos(el) * Math.cos(az) * d);
    }
  }
  if (q.has('hide')) {
    for (const n of q.get('hide').split(',')) HIDE.add(n);
    scene.traverse(o => { if (HIDE.has(o.name)) o.visible = false; });
  }
  if (q.has('hideui')) {
    for (const id of ['title', 'hud', 'gear', 'panel', 'knobHint', 'diag', 'boot']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
  }
  if (q.has('noorbit')) QUALITY.autoRotate = false;
  if (q.has('noselect')) {
    // keep the page from stealing focus in scripted capture runs
    window.addEventListener('keydown', e => e.stopPropagation(), true);
  }
}

const BILLBOARDS = [];
function collectBillboards() {
  for (const key of ['haloGreenhouse', 'haloKiosk']) {
    if (BUILDINGS[key]) BILLBOARDS.push(BUILDINGS[key]);
  }
  if (BUILDINGS.haloBook) for (const h of BUILDINGS.haloBook) BILLBOARDS.push(h);
  if (DESKPROPS.candleHalo) BILLBOARDS.push(DESKPROPS.candleHalo);
}

function init() {
  installUI();
  buildWorld();
  collectBillboards();
  updateSeasonState(SEASON.phase, DAYCLOCK.frac);
  updateSkyAndLight();
  updateSeasonUniforms(0);
  updateGroundColors();
  applyQuality();
  resize();
  window.addEventListener('resize', () => { resize(); markInteraction(); });
  installKnobInput();
  installDiagnosticHooks();
  applyDebugQuery();
  // the debug query may have moved the season, so refresh everything from it
  updateSeasonState(SEASON.phase, DAYCLOCK.frac);
  updateSkyAndLight();
  updateSeasonUniforms(0);
  updateGroundColors();
  updateReadouts();

  // warm-up frames so every shader is compiled before the curtain lifts
  renderer.render(scene, camera);

  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.add('gone');
    setTimeout(() => { if (boot.parentNode) boot.remove(); }, 900);
  }
  setTimeout(hintFade, 9000);

  lastFrameTime = 0;
  frameAccum = 0;
  rafId = requestAnimationFrame(loop);
}

/**
 * Offline-capture helpers. They only exist under ?debug=1, so a normal visit
 * pays nothing for them.
 */
function installDiagnosticHooks() {
  if (!window.__dbg) return;
  // expose internals for the offline test harness
  window.__x = {
    THREE: THREE, scene: scene, SEASON: SEASON, S: S, QUALITY: QUALITY,
    DAYCLOCK: DAYCLOCK, VEG: VEG, PEOPLE: PEOPLE, BOAT: BOAT, BIRDS: BIRDS,
    BUTTERFLIES: BUTTERFLIES, FIREFLIES: FIREFLIES, BUILDINGS: BUILDINGS,
    camera: camera, controls: controls, renderer: renderer, sunLight: sunLight,
    skyMat: skyMat, VEGU: VEGU, WATER_U: WATER_U, MIST_U: MIST_U,
    seasonSmooth: () => seasonSmooth
  };
  /**
   * Synchronous benchmark: ?bench=N runs N full simulation+render frames back
   * to back and reports the average frame cost. Headless browsers throttle
   * requestAnimationFrame, so this is how the real budget gets measured
   * without a live display.
   */
  window.__bench = function (n) {
    n = n || 120;
    const gl = renderer.getContext();
    stepSimulation(1 / 60);
    renderScene();
    gl.finish();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { stepSimulation(1 / 60); renderScene(); }
    gl.finish();
    const ms = (performance.now() - t0) / n;
    return { n: n, msPerFrame: +ms.toFixed(2), fpsEquiv: +(1000 / ms).toFixed(1) };
  };
  window.__benchNote = '';
  window.__note = '';

  /**
   * Continuity audit: walk the whole year at fine resolution and report the
   * largest single-step change in every season channel. A cyclical, smooth
   * model keeps all of these small, including across the wrap at 1 -> 0.
   */
  window.__sweep = function (steps) {
    steps = steps || 2000;
    const keys = ['temperature', 'maxSun', 'dayLength', 'canopy', 'leafSize', 'leafOut',
      'blossom', 'flowerBloom', 'hydrangea', 'lotus', 'butterfly', 'bird', 'firefly',
      'stream', 'ice', 'iceMelt', 'snow', 'frost', 'drip', 'mud', 'mist', 'petal',
      'rainChance', 'leafDrop', 'lampWarm'];
    const colKeys = ['leafTall', 'leafSmall', 'grassTint', 'blossomCol'];
    const prev = {}, max = {};
    const save = (S, k) => (S[k] && S[k].isColor)
      ? [S[k].r, S[k].g, S[k].b] : S[k];
    const keep = phaseKeep();
    updateSeasonState(0, DAYCLOCK.frac);
    for (const k of keys) { prev[k] = save(S, k); max[k] = 0; }
    for (const k of colKeys) { prev[k] = save(S, k); max[k] = 0; }
    for (let i = 1; i <= steps; i++) {
      updateSeasonState(i / steps, DAYCLOCK.frac);
      for (const k of keys.concat(colKeys)) {
        const a = prev[k], b = save(S, k);
        const d = typeof b === 'number' ? Math.abs(b - a)
          : Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]));
        if (d > max[k]) max[k] = d;
        prev[k] = b;
      }
    }
    restoreKeep(keep);
    const out = {};
    for (const k of keys.concat(colKeys)) out[k] = +max[k].toFixed(6);
    out._steps = steps;
    out._maxOverall = +Math.max.apply(null, Object.keys(out)
      .filter(k => k[0] !== '_').map(k => out[k])).toFixed(6);
    return out;
  };

  setInterval(() => {
    window.__note = (window.__benchNote ? window.__benchNote + ' | ' : '') +
      'frames=' + (window.__frames || 0) +
      ' calls=' + renderer.info.render.calls +
      ' tri=' + (renderer.info.render.triangles / 1000).toFixed(0) + 'k' +
      ' p=' + S.phase.toFixed(2) + ' snow=' + S.snow.toFixed(2) +
      ' ice=' + S.ice.toFixed(2) + ' canopy=' + S.canopy.toFixed(2);
    window.__paint();
  }, 700);
}

/* Run after the first paint so the loading card is actually visible. */
try {
  init();
} catch (e) {
  bootFail((e && e.message) ? e.message : String(e));
  if (window.__report) window.__report('init: ' + (e && e.stack ? e.stack : e));
  console.error(e);
}
