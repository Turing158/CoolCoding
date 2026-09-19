/** names the debug hook can force off (see ?hide= in applyDebugQuery) */
const HIDE = new Set();

/* ------------------------------------------------------------------ */
/* 44.  Particle object pool                                            */
/*      Nothing is ever created or destroyed during the year: every     */
/*      particle is allocated once and only switched on and off.        */
/* ------------------------------------------------------------------ */

class ParticlePool {
  constructor(count, build) {
    this.count = count;
    this.items = new Array(count);
    for (let i = 0; i < count; i++) this.items[i] = build(i);
    this.cursor = 0;
  }
  /** returns the next item, round robin */
  next() {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.count;
    return it;
  }
  forEach(fn) { for (let i = 0; i < this.count; i++) fn(this.items[i], i); }
}

/* ------------------------------------------------------------------ */
/* 45.  Petals, leaves and snowflakes share one shader                  */
/* ------------------------------------------------------------------ */

const FALL_MAT = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: {
    uTime: { value: 0 },
    uColorA: { value: C(0xf7c8d8) },
    uColorB: { value: C(0xfdf0f2) },
    uDaylight: { value: 1 },
    uFogColor: { value: C(0xd8e2ea) },
    uFogDensity: { value: 0.012 },
    uSoft: { value: 1.0 }
  },
  vertexShader: `
    attribute float aSpin;
    attribute float aTint;
    attribute float aAlpha;
    varying float vTint;
    varying float vAlpha;
    varying float vView;
    varying vec3 vWorld;
    varying vec2 vUv;
    void main(){
      vUv = uv;
      vTint = aTint;
      vAlpha = aAlpha;
      // size lives in the instance matrix scale, spin is applied in view space
      float sc = length(instanceMatrix[0].xyz);
      vec3 local = position * sc;
      float c = cos(aSpin), s = sin(aSpin);
      vec2 turned = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
      vec4 wp = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      wp.xyz += right * turned.x + up * turned.y;
      vWorld = wp.xyz;
      vec4 mv = viewMatrix * wp;
      vView = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: GLSL_FOG + `
    uniform vec3 uColorA, uColorB;
    uniform float uDaylight, uSoft;
    varying float vTint, vAlpha, vView;
    varying vec3 vWorld;
    varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5;
      // a soft rounded petal / flake silhouette, feathered by uSoft
      float d = length(vec2(c.x, c.y * 0.82));
      float a = smoothstep(0.5, 0.5 - 0.30 * uSoft - 0.12, d);
      if (a < 0.02) discard;
      vec3 col = mix(uColorA, uColorB, vTint);
      col *= 0.72 + 0.42 * uDaylight;
      col = applyFog(col, vView);
      gl_FragColor = vec4(col, a * vAlpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});

/**
 * A generic drifting-particle system backed by an InstancedMesh and a pool.
 * Petals, autumn leaves and snow all use the same machinery with different
 * parameters, so the object count never changes across the seasons.
 */
class DriftField {
  constructor(count, opts) {
    this.count = count;
    this.opts = Object.assign({
      area: 12.0, top: 4.0, bottom: 0.0, speed: 0.5, sway: 0.4,
      spin: 1.4, size: 0.05, soft: 1.0, colorA: C(0xf7c8d8), colorB: C(0xfdf0f2)
    }, opts);
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mat = FALL_MAT.clone();
    this.mat.uniforms = THREE.UniformsUtils.clone(FALL_MAT.uniforms);
    this.mat.uniforms.uColorA.value = this.opts.colorA.clone();
    this.mat.uniforms.uColorB.value = this.opts.colorB.clone();
    this.mat.uniforms.uSoft.value = this.opts.soft;
    this.mesh = new THREE.InstancedMesh(geo, this.mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.visible = false;
    this.mesh.name = opts.name || 'drift';
    this.mat.transparent = true;
    this.mat.depthWrite = false;
    this.mat.side = THREE.DoubleSide;
    scene.add(this.mesh);

    this.aSize = new Float32Array(count);
    this.aSpin = new Float32Array(count);
    this.aTint = new Float32Array(count);
    this.aAlpha = new Float32Array(count);
    geo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(this.aSpin, 1));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(this.aTint, 1));
    geo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(this.aAlpha, 1));

    // pooled state, allocated once
    this.p = {
      x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count),
      vx: new Float32Array(count), vy: new Float32Array(count), vz: new Float32Array(count),
      rot: new Float32Array(count), spin: new Float32Array(count),
      seed: new Float32Array(count), life: new Float32Array(count), active: new Uint8Array(count)
    };
    const rnd = rng(opts.seed || 1234);
    for (let i = 0; i < count; i++) {
      this.p.seed[i] = rnd() * 100;
      this.p.spin[i] = (rnd() - 0.5) * this.opts.spin;
      this.aTint[i] = rnd();
      this.initialise(i, rnd, true);
    }
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dummy = new THREE.Object3D();
    this.amount = 0;
  }
  initialise(i, rnd, randomY) {
    const o = this.opts, p = this.p;
    p.x[i] = (rnd() * 2 - 1) * o.area;
    p.z[i] = (rnd() * 2 - 1) * o.area;
    p.y[i] = randomY ? lerp(o.bottom, o.top, rnd()) : o.top + rnd() * 0.4;
    p.vy[i] = -(o.speed * (0.65 + rnd() * 0.7));
    p.vx[i] = (rnd() - 0.5) * o.sway * 0.5;
    p.vz[i] = (rnd() - 0.5) * o.sway * 0.5;
    p.rot[i] = rnd() * TAU;
    p.life[i] = 0.6 + rnd() * 0.4;
    p.active[i] = 1;
  }
  /** target amount 0..1, forced partial fade for a smooth arrival/exit */
  update(dt, t, amount, wind) {
    this.amount = amount;
    const o = this.opts, p = this.p;
    const visible = amount > 0.008 && !HIDE.has(this.mesh.name);
    this.mesh.visible = visible;
    if (!visible) return;
    const live = Math.round(this.count * clamp(amount, 0, 1));
    const windX = wind ? wind.x : 0.4, windZ = wind ? wind.y : 0.2;
    for (let i = 0; i < this.count; i++) {
      const on = i < live;
      if (!on) { this.aAlpha[i] = 0; continue; }
      const gy = Math.max(terrainHeight(p.x[i], p.z[i]), WORLD.waterY);
      p.y[i] += p.vy[i] * dt;
      p.x[i] += (p.vx[i] + Math.sin(t * 0.8 + p.seed[i]) * o.sway * 0.55 + windX * o.sway) * dt;
      p.z[i] += (p.vz[i] + Math.cos(t * 0.66 + p.seed[i] * 1.3) * o.sway * 0.5 + windZ * o.sway) * dt;
      p.rot[i] += p.spin[i] * dt * (0.6 + 0.8 * Math.abs(p.vy[i]));

      // recycle deterministically: no allocation, no garbage
      if (p.y[i] < gy + 0.015 || p.x[i] < -o.area * 1.25 || p.x[i] > o.area * 1.25 ||
          p.z[i] < -o.area * 1.25 || p.z[i] > o.area * 1.25) {
        const s = p.seed[i];
        p.x[i] = (hash1(s + t * 0.017) * 2 - 1) * o.area;
        p.z[i] = (hash1(s * 1.7 + t * 0.013) * 2 - 1) * o.area;
        p.y[i] = o.top + hash1(s * 2.3 + t * 0.011) * 0.8;
        p.rot[i] = hash1(s * 3.1 + t * 0.019) * TAU;
      }
      this.dummy.position.set(p.x[i], p.y[i], p.z[i]);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(o.size * (0.7 + 0.6 * hash1(p.seed[i])));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.aSpin[i] = p.rot[i];
      // fade in the newest arrivals so nothing pops into view
      const rel = i / Math.max(1, live);
      this.aAlpha[i] = clamp(amount * 1.6 - rel * 0.6, 0, 1) * 0.95;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.aSpin.needsUpdate = true;
    this.mesh.geometry.attributes.aAlpha.needsUpdate = true;
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uDaylight.value = S.daylight;
  }
}

/* ------------------------------------------------------------------ */
/* 46.  Rain: pooled streaks with a short shower envelope               */
/* ------------------------------------------------------------------ */

const RAIN = { field: null, intensity: 0, nextShower: 20, shower: 0, showerDur: 0, active: false };

function buildRain(count) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = FALL_MAT.clone();
  mat.uniforms = THREE.UniformsUtils.clone(FALL_MAT.uniforms);
  mat.uniforms.uColorA.value = C(0xd8e8f2);
  mat.uniforms.uColorB.value = C(0xbcd4e4);
  mat.uniforms.uSoft.value = 0.25;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  mesh.visible = false;
  mesh.name = 'rain';
  scene.add(mesh);
  const aSpin = new Float32Array(count),
        aTint = new Float32Array(count), aAlpha = new Float32Array(count);
  geo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(aSpin, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 1));
  geo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(aAlpha, 1));
  const p = {
    x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count),
    seed: new Float32Array(count)
  };
  const rnd = rng(5150);
  for (let i = 0; i < count; i++) {
    p.x[i] = (rnd() * 2 - 1) * 13;
    p.z[i] = (rnd() * 2 - 1) * 13;
    p.y[i] = rnd() * 5;
    p.seed[i] = rnd() * 100;
    aTint[i] = rnd();
  }
  const dummy = new THREE.Object3D();
  RAIN.field = {
    mesh: mesh, mat: mat, p: p, dummy: dummy, count: count,
    aSpin: aSpin, aAlpha: aAlpha
  };
}

function updateRain(dt, t) {
  // showers come in short natural bursts, never a constant downpour
  RAIN.nextShower -= dt * clamp(S.rainChance * 3.0, 0, 3);
  if (RAIN.nextShower <= 0) {
    RAIN.active = !RAIN.active;
    if (RAIN.active) RAIN.showerDur = 16 + hash1(t * 0.37) * 22;
    RAIN.nextShower = RAIN.active ? RAIN.showerDur : 46 + hash1(t * 0.71) * 90;
  }
  const target = RAIN.active ? clamp(S.rainChance * 2.0, 0, 1) : 0;
  RAIN.intensity = damp(RAIN.intensity, target, 0.9, dt);
  const amount = RAIN.intensity * clamp(0.35 + 0.65 * S.daylight, 0, 1);
  const f = RAIN.field;
  f.mesh.visible = amount > 0.01 && !HIDE.has('rain');
  if (!f.mesh.visible) {
    // let the rain darken the daylight even when it has stopped
    return;
  }
  const live = Math.round(f.count * clamp(amount * 1.15, 0, 1));
  const windX = 0.5 * VEGU.uWind.value.x, windZ = 0.5 * VEGU.uWind.value.y;
  for (let i = 0; i < f.count; i++) {
    if (i >= live) { f.aAlpha[i] = 0; continue; }
    const p = f.p;
    p.y[i] -= (12 + hash1(p.seed[i]) * 6) * dt;
    p.x[i] += windX * 1.4 * dt;
    p.z[i] += windZ * 1.4 * dt;
    if (p.y[i] < -0.6) {
      p.y[i] = 5.6;
      p.x[i] = (hash1(p.seed[i] + t * 0.07) * 2 - 1) * 13;
      p.z[i] = (hash1(p.seed[i] * 1.3 + t * 0.05) * 2 - 1) * 13;
    }
    f.dummy.position.set(p.x[i], p.y[i], p.z[i]);
    f.dummy.scale.setScalar(0.030 + hash1(p.seed[i]) * 0.02);
    f.dummy.updateMatrix();
    f.mesh.setMatrixAt(i, f.dummy.matrix);
    f.aSpin[i] = 0.06;
    f.aAlpha[i] = amount * 0.55;
  }
  f.mesh.instanceMatrix.needsUpdate = true;
  geoNeeds(f.mesh.geometry, ['aSpin', 'aAlpha']);
  f.mat.uniforms.uDaylight.value = clamp(S.daylight * 0.85 + 0.15, 0, 1);
}

function geoNeeds(geo, names) {
  for (const n of names) if (geo.attributes[n]) geo.attributes[n].needsUpdate = true;
}

/* ------------------------------------------------------------------ */
/* 47.  Drips: meltwater falling from the eaves and branches            */
/* ------------------------------------------------------------------ */

const DRIPS = { mesh: null, mat: null, items: [], count: 90 };

function buildDrips() {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: C(0xdff0fa) }, uDaylight: { value: 1 }
    },
    vertexShader: `
      attribute float aAlpha;
      varying float vAlpha;
      void main(){
        vAlpha = aAlpha;
        float sc = length(instanceMatrix[0].xyz);
        vec4 wp = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        // stretch into a falling streak
        wp.xyz += right * (position.x * sc) + up * (position.y * sc * 3.4);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uDaylight;
      varying float vAlpha;
      void main(){
        if (vAlpha < 0.02) discard;
        vec3 c = uColor * (0.7 + 0.4 * uDaylight);
        gl_FragColor = vec4(c, vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const mesh = new THREE.InstancedMesh(geo, mat, DRIPS.count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  mesh.visible = false;
  scene.add(mesh);
  DRIPS.mesh = mesh; DRIPS.mat = mat;
  const aAlpha = new Float32Array(DRIPS.count);
  geo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(aAlpha, 1));
  DRIPS.aAlpha = aAlpha;

  // drip points: under every snow cap ledge, plus the eaves
  const rnd = rng(3003);
  for (let i = 0; i < DRIPS.count; i++) {
    const c = SNOWCAPS[i % Math.max(1, SNOWCAPS.length)];
    const a = rnd() * TAU;
    DRIPS.items.push({
      x: c ? c.x + Math.cos(a) * c.sx * 0.42 : (rnd() * 2 - 1) * 10,
      z: c ? c.z + Math.sin(a) * c.sz * 0.42 : (rnd() * 2 - 1) * 10,
      y0: c ? c.y : 1.2,
      fall: 0,
      speed: 1.6 + rnd() * 1.4,
      delay: rnd() * 3.2
    });
  }
}

function updateDrips(dt, t) {
  const amt = clamp(S.drip, 0, 1) * clamp(0.4 + 0.75 * S.daylight, 0, 1.2);
  DRIPS.mesh.visible = amt > 0.02;
  if (!DRIPS.mesh.visible) return;
  const dummy = new THREE.Object3D();
  const maxFall = 1.9;
  for (let i = 0; i < DRIPS.items.length; i++) {
    const d = DRIPS.items[i];
    const local = clamp(amt - (i % 7) * 0.06, 0, 1);
    d.fall += d.speed * dt * local;
    if (d.fall > maxFall + d.delay) d.fall = -d.delay;
    const y = d.y0 - clamp(d.fall, 0, maxFall);
    const wet = d.fall > 0 ? 1 : 0;
    dummy.position.set(d.x, y, d.z);
    dummy.scale.setScalar(0.022);
    dummy.updateMatrix();
    DRIPS.mesh.setMatrixAt(i, dummy.matrix);
    DRIPS.aAlpha[i] = wet * local * 0.85;
  }
  DRIPS.mesh.instanceMatrix.needsUpdate = true;
  DRIPS.aAlpha.needsUpdate = true;
  DRIPS.mat.uniforms.uDaylight.value = S.daylight;
}

/* ------------------------------------------------------------------ */
/* 48.  Wind: a slow, always-changing field that all plants share       */
/* ------------------------------------------------------------------ */

function updateWind(t) {
  const a = fbm(t * 0.021 + 3.1, t * 0.017 + 8.4, 3) * TAU * 2;
  VEGU.uWind.value.set(Math.cos(a), Math.sin(a));
  // gusty in autumn and during showers, calm on still winter mornings
  const gust = 0.30 + 0.25 * fbm(t * 0.13 + 11, 0, 2)
    + S.leafDrop * 0.30 + RAIN.intensity * 0.35 - S.frost * 0.12 + S.mist * 0.05;
  VEGU.uWindAmp.value = clamp(gust, 0.12, 1.25) * (0.55 + 0.7 * SEASON.weather);
}