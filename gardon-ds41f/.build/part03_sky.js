/* ------------------------------------------------------------------ */
/* 9.  Renderer · scene · camera · controls                            */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({
  canvas: canvas, antialias: true, stencil: false, powerPreference: 'high-performance'
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(36, 1, 0.4, 260);
camera.position.set(19.5, 14.5, 22.0);

/* ------------------------------------------------------------------ */
/* 9b. Orbit controls (self-contained, damped, clamped)                 */
/* ------------------------------------------------------------------ */

class OrbitControls extends THREE.EventDispatcher {
  constructor(cam, dom) {
    super();
    this.camera = cam;
    this.domElement = dom;
    this.target = new THREE.Vector3();
    this.enableDamping = true;
    this.dampingFactor = 0.06;
    this.rotateSpeed = 0.62;
    this.zoomSpeed = 0.9;
    this.minDistance = 5;
    this.maxDistance = 46;
    this.minPolarAngle = 0.20;
    this.maxPolarAngle = 1.44;
    this.autoRotate = false;
    this.autoRotateSpeed = 0.34;
    this.enabled = true;
    this._sph = new THREE.Spherical();
    this._dSph = new THREE.Spherical(0, 0, 0);
    this._offset = new THREE.Vector3();
    this._pointers = [];
    this._state = 0;             // 0 none, 1 rotate, 2 zoom
    this._prev = new Map();
    this._pinchDist = 0;
    this.update(true);
    this._bind();
  }
  _bind() {
    const d = this.domElement;
    const onDown = (e) => {
      if (!this.enabled) return;
      // synthetic or already-released pointers have nothing to capture
      try { d.setPointerCapture(e.pointerId); } catch (err) { /* nothing to capture */ }
      this._pointers.push(e.pointerId);
      this._prev.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.length === 1) this._state = 1;
      else if (this._pointers.length === 2) {
        this._state = 2;
        const a = this._prev.get(this._pointers[0]), b = this._prev.get(this._pointers[1]);
        this._pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      this.dispatchEvent({ type: 'start' });
    };
    const onMove = (e) => {
      if (!this._prev.has(e.pointerId)) return;
      const p = this._prev.get(e.pointerId);
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (!this.enabled) return;
      const h = d.clientHeight || 1;
      if (this._state === 1) {
        const k = TAU * this.rotateSpeed / h;
        this._dSph.theta -= dx * k;
        this._dSph.phi -= dy * k;
      } else if (this._state === 2 && this._pointers.length === 2) {
        const a = this._prev.get(this._pointers[0]), b = this._prev.get(this._pointers[1]);
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this._pinchDist > 0) this._dSph.radius *= this._pinchDist / dist;
        this._pinchDist = dist;
      }
      this.dispatchEvent({ type: 'change' });
    };
    const onUp = (e) => {
      this._prev.delete(e.pointerId);
      this._pointers = this._pointers.filter(id => id !== e.pointerId);
      if (this._pointers.length === 0) this._state = 0;
      try { d.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
      this.dispatchEvent({ type: 'end' });
    };
    d.addEventListener('pointerdown', onDown);
    d.addEventListener('pointermove', onMove);
    d.addEventListener('pointerup', onUp);
    d.addEventListener('pointercancel', onUp);
    d.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const scale = Math.pow(0.95, -Math.sign(e.deltaY) * this.zoomSpeed * (e.deltaMode === 1 ? 1 : 0.5) * 2);
      this._dSph.radius *= scale;
      this.dispatchEvent({ type: 'change' });
    }, { passive: false });
    d.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  update(force) {
    const off = this._offset.copy(this.camera.position).sub(this.target);
    this._sph.setFromVector3(off);
    this._sph.theta += this._dSph.theta;
    this._sph.phi += this._dSph.phi;
    this._sph.radius *= this._dSph.radius === 0 ? 1 : this._dSph.radius;
    if (this.autoRotate && this._state === 0) this._sph.theta -= this.autoRotateSpeed * 0.0022;
    this._sph.phi = clamp(this._sph.phi, this.minPolarAngle, this.maxPolarAngle);
    this._sph.radius = clamp(this._sph.radius, this.minDistance, this.maxDistance);
    off.setFromSpherical(this._sph);
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
    const damp = this.enableDamping ? 1 - Math.pow(1 - this.dampingFactor, 60) : 1;
    this._dSph.theta *= 1 - damp;
    this._dSph.phi *= 1 - damp;
    this._dSph.radius = lerp(this._dSph.radius, 1, damp);
    if (Math.abs(this._dSph.radius - 1) < 1e-4) this._dSph.radius = 1;
  }
}

const controls = new OrbitControls(camera, canvas);
controls.target.set(0.2, 0.55, 0.2);
controls.autoRotate = true;

/* ------------------------------------------------------------------ */
/* 10.  Quality tiers                                                   */
/* ------------------------------------------------------------------ */

const QUALITY = {
  preset: 1,
  autoRotate: true,
  maxFPS: 60,
  renderScale: 1.0,
  shadowSize: 2048,
  particles: 1.0,
  shadowsOn: true,
  bloom: true,
  autoExposure: true,
  idlePause: false,
  orbitSpeed: 0.7,
  cycle: 480
};
const PRESETS = [
  { renderScale: 0.70, shadowSize: 1024, particles: 0.55, shadowsOn: true, bloom: false, maxFPS: 30 },
  { renderScale: 1.00, shadowSize: 2048, particles: 1.00, shadowsOn: true, bloom: true, maxFPS: 60 },
  { renderScale: 1.35, shadowSize: 4096, particles: 1.35, shadowsOn: true, bloom: true, maxFPS: 0 }
];

function applyQuality() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr * QUALITY.renderScale);
  const wantShadows = QUALITY.shadowsOn && QUALITY.shadowSize > 0;
  renderer.shadowMap.enabled = wantShadows;
  if (sunLight) {
    sunLight.castShadow = wantShadows;
    if (wantShadows) {
      const size = QUALITY.shadowSize;
      if (sunLight.shadow.mapSize.x !== size) {
        sunLight.shadow.mapSize.set(size, size);
        if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
      }
    }
  }
  if (typeof skyMat !== 'undefined' && skyMat) skyMat.uniforms.uBloom.value = QUALITY.bloom ? 1 : 0;
  resize();
}

/* ------------------------------------------------------------------ */
/* 11.  Sky dome (procedural gradient + sun + stars + horizon bloom)    */
/* ------------------------------------------------------------------ */

const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uZenith: { value: C(0x7fb2dd) },
    uHorizon: { value: C(0xf2e5d4) },
    uGround: { value: C(0xd9cbb6) },
    uSunCol: { value: C(0xffd9a0) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3) },
    uSunI: { value: 1 },
    uNight: { value: 0 },
    uBloom: { value: 1 },
    uWarm: { value: 0 },
    uSeed: { value: 12.34 }
  },
  vertexShader: `
    varying vec3 vDir;
    void main(){
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 uZenith, uHorizon, uGround, uSunCol, uSunDir;
    uniform float uSunI, uNight, uBloom, uWarm, uSeed;
    varying vec3 vDir;

    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.58));
      col = mix(col, uGround, smoothstep(0.02, -0.30, h));

      float sd = max(dot(d, normalize(uSunDir)), 0.0);
      col += uSunCol * (pow(sd, 320.0) * 2.0 + pow(sd, 14.0) * 0.30 * uSunI
                        + pow(sd, 3.0) * 0.10 * uSunI * (0.5 + uWarm));

      if (uNight > 0.02) {
        vec2 g = floor(d.xz / max(abs(d.y), 0.12) * 34.0);
        float s = h21(g + uSeed);
        float tw = 0.5 + 0.5 * sin(uSeed * 6.0 + s * 40.0);
        float star = smoothstep(0.9962, 1.0, s) * tw;
        col += vec3(0.75, 0.82, 1.0) * star * uNight * smoothstep(0.02, 0.35, h) * 2.4;
      }

      float band = exp(-pow((h - 0.06) * 4.2, 2.0));
      col += uSunCol * band * 0.10 * uBloom * (0.4 + uWarm);

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 20), skyMat);
sky.frustumCulled = false;
sky.renderOrder = -100;
scene.add(sky);

/* ------------------------------------------------------------------ */
/* 12.  Lighting rig                                                   */
/* ------------------------------------------------------------------ */

const hemiLight = new THREE.HemisphereLight(0xcfe2f5, 0x8d7c63, 0.6);
scene.add(hemiLight);

const ambLight = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(ambLight);

const sunLight = new THREE.DirectionalLight(0xfff2dd, 2.0);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(QUALITY.shadowSize, QUALITY.shadowSize);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 140;
sunLight.shadow.camera.left = -17;
sunLight.shadow.camera.right = 17;
sunLight.shadow.camera.top = 17;
sunLight.shadow.camera.bottom = -17;
sunLight.shadow.bias = -0.0009;
sunLight.shadow.normalBias = 0.028;
sunLight.shadow.radius = 2.2;
scene.add(sunLight);
scene.add(sunLight.target);
sunLight.target.position.set(0, 0, 0);

const moonLight = new THREE.DirectionalLight(0x9db8e8, 0.0);
moonLight.position.set(-20, 22, -14);
scene.add(moonLight);

// gentle warm bounce from the window side so shaded faces never go flat
const bounceLight = new THREE.DirectionalLight(0xffe6c4, 0.22);
bounceLight.position.set(14, 7, 20);
scene.add(bounceLight);

/* ------------------------------------------------------------------ */
/* 13.  Sky & light animation                                          */
/* ------------------------------------------------------------------ */

const SUN_DIR = new THREE.Vector3();
const DAY = {
  zenith: new THREE.Color(), horizon: new THREE.Color(), ground: new THREE.Color(),
  sunCol: new THREE.Color(), fog: new THREE.Color(), exposure: 1
};

function updateSkyAndLight() {
  const el = S.sunElev * PI / 180;
  const az = S.sunAz * PI / 180;
  SUN_DIR.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();

  const day = S.daylight;
  const low = 1 - smoothstep(2, 26, S.sunElev);      // low-sun warmth

  DAY.zenith.copy(C(0x16203a)).lerp(C(0x74aede), smoothstep(0, 0.55, day));
  DAY.horizon.copy(C(0x243149)).lerp(C(0xf6ead6), smoothstep(0, 0.42, day));
  DAY.horizon.lerp(C(0xffd3a0), low * day * 0.6);
  DAY.ground.copy(C(0x1b2130)).lerp(C(0xdcccb4), day);
  DAY.sunCol.copy(C(0xff8a45)).lerp(C(0xfff3e0), smoothstep(0, 24, S.sunElev));
  DAY.fog.copy(DAY.horizon).lerp(DAY.ground, 0.32);

  skyMat.uniforms.uZenith.value.copy(DAY.zenith);
  skyMat.uniforms.uHorizon.value.copy(DAY.horizon);
  skyMat.uniforms.uGround.value.copy(DAY.ground);
  skyMat.uniforms.uSunCol.value.copy(DAY.sunCol);
  skyMat.uniforms.uSunDir.value.copy(SUN_DIR);
  skyMat.uniforms.uSunI.value = clamp(S.daylight, 0, 1);
  skyMat.uniforms.uNight.value = S.night;
  skyMat.uniforms.uWarm.value = low * day;

  sunLight.position.copy(SUN_DIR).multiplyScalar(46);
  sunLight.color.copy(DAY.sunCol);
  sunLight.intensity = 0.05 + 2.15 * day * smoothstep(-3.0, 6.0, S.sunElev);

  moonLight.intensity = 0.55 * S.night;
  moonLight.position.set(-SUN_DIR.x * 34, 30, -SUN_DIR.z * 34);

  hemiLight.color.copy(DAY.zenith).lerp(C(0xffffff), 0.25);
  hemiLight.groundColor.copy(DAY.ground);
  hemiLight.intensity = 0.26 + 0.72 * day;

  ambLight.intensity = 0.11 + 0.06 * day;
  bounceLight.intensity = 0.10 + 0.22 * day;

  DAY.exposure = lerp(1.34, 1.02, day);
}

/* ------------------------------------------------------------------ */
/* 14.  Resize                                                         */
/* ------------------------------------------------------------------ */

let viewW = 1, viewH = 1;
function resize() {
  viewW = Math.max(1, window.innerWidth);
  viewH = Math.max(1, window.innerHeight);
  camera.aspect = viewW / viewH;
  camera.updateProjectionMatrix();
  renderer.setSize(viewW, viewH, false);
}
