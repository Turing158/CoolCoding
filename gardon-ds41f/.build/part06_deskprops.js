/* ------------------------------------------------------------------ */
/* 23.  Desk-top still life: poetry books, postcards, vase, teacup      */
/* ------------------------------------------------------------------ */

const DESK = { y: -1.0, size: 30.6, group: null, props: new THREE.Group() };
const DESKPROPS = { vaseFlowers: [], steam: null, steamMat: null, candleFlame: null };

/** a soft additive halo that the season loop can fade in and out */
function makeGlowMaterial(base, hex) {
  const m = new THREE.MeshBasicMaterial({
    map: makeLampTexture(), color: hex === undefined ? 0xffd9a0 : hex,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    opacity: 0, side: THREE.DoubleSide, toneMapped: false
  });
  m.userData.base = base === undefined ? 1 : base;
  return m;
}

function buildDeskProps() {
  const Y = DESK.y;
  const G = DESK.props;
  G.name = 'deskprops';
  scene.add(G);

  const book = new VoxBatch(null);
  const paper = new VoxBatch(null);

  /* ---- a small stack of poetry collections ------------------------ */
  const stack = [
    { x: -11.4, z: 13.4, w: 5.0, d: 6.6, t: 0.55, yaw: 0.10, col: C(0x7d8f6b) },
    { x: -11.6, z: 13.2, w: 4.7, d: 6.3, t: 0.48, yaw: -0.06, col: C(0xa8564a) },
    { x: -11.3, z: 13.5, w: 4.5, d: 6.0, t: 0.42, yaw: 0.04, col: C(0x4f6b86) }
  ];
  let sy = Y + 0.16;
  for (const s of stack) {
    book.add(s.w, s.t, s.d, s.x, sy + s.t / 2, s.z, s.col, s.yaw);
    book.add(s.w * 0.94, s.t * 0.66, s.d * 0.97, s.x + 0.08, sy + s.t / 2, s.z + 0.03, C(0xf2e8d4), s.yaw);
    sy += s.t + 0.02;
  }
  paper.add(0.20, 0.02, 1.6, -10.0, sy + 0.01, 12.2, C(0xd9a0a8), 0.22);

  /* ---- an open journal, pages gently curved ------------------------ */
  const ox = -5.2, oz = 13.9;
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(3.5, 4.8, 10, 10);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i);
      pos.setZ(i, -Math.abs(py) * 0.10 - Math.pow(Math.abs(px) / 1.75, 2) * 0.12);
    }
    g.rotateX(-PI / 2);
    g.computeVertexNormals();
    const n = pos.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = 0.96; col[i * 3 + 1] = 0.92; col[i * 3 + 2] = 0.82; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, MAT.paper);
    m.position.set(ox + s * 1.78, Y + 0.36, oz);
    m.rotation.order = 'YXZ';
    m.rotation.y = s * 0.10;
    m.rotation.z = s * -0.045;
    m.castShadow = false;
    m.receiveShadow = true;
    G.add(m);
  }
  book.add(7.6, 0.26, 5.2, ox, Y + 0.22, oz, C(0x8a6b4f), 0.0);
  book.add(7.8, 0.06, 5.4, ox, Y + 0.10, oz, C(0x6f5540), 0.0);
  book.add(0.16, 0.16, 4.2, ox + 0.25, Y + 0.46, oz - 0.2, C(0xd8a24a), 0.34);
  book.add(0.11, 0.11, 0.5, ox + 0.25, Y + 0.46, oz - 2.3, C(0x2f2a26), 0.34);

  /* ---- scattered postcards ---------------------------------------- */
  const cards = [
    { x: 0.6, z: 14.4, yaw: -0.22, v: 0 },
    { x: 2.4, z: 13.4, yaw: 0.31, v: 1 },
    { x: 1.4, z: 12.4, yaw: 0.82, v: 2 },
    { x: -1.2, z: 13.2, yaw: -0.55, v: 3 },
    { x: 3.6, z: 14.9, yaw: 1.15, v: 1 }
  ];
  for (const c of cards) {
    const g = new THREE.PlaneGeometry(2.6, 1.7);
    g.rotateX(-PI / 2);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = 1; col[i * 3 + 1] = 1; col[i * 3 + 2] = 1; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, map: makePostcardTexture(c.v), roughness: 0.94, metalness: 0.0, side: THREE.DoubleSide
    });
    const m = new THREE.Mesh(g, mat);
    m.rotation.order = 'YXZ';
    m.rotation.y = c.yaw;
    m.rotation.x = 0.012 + hash1(c.v * 3.1) * 0.012;
    m.position.set(c.x, Y + 0.42, c.z);
    m.castShadow = false;
    m.receiveShadow = true;
    G.add(m);
  }

  /* ---- a small stoneware vase with a few stems -------------------- */
  {
    const vx = 8.2, vz = 12.9;
    book.add(1.5, 0.16, 1.5, vx, Y + 0.46, vz, C(0xb8b0a2));
    book.add(1.05, 1.5, 1.05, vx, Y + 1.28, vz, C(0xa8c0bc));
    book.add(1.25, 0.28, 1.25, vx, Y + 2.10, vz, C(0xc3d6d0));
    book.add(0.62, 0.22, 0.62, vx, Y + 2.33, vz, C(0x8fa8a4));
    for (let i = 0; i < 5; i++) {
      const a = i * 1.31 + 0.4;
      const lean = 0.28 + hash1(i * 7.3) * 0.24;
      const h = 2.2 + hash1(i * 2.9) * 1.4;
      book.add(0.09, h, 0.09, vx + Math.cos(a) * 0.16 * (1 + lean), Y + 2.3 + h / 2, vz + Math.sin(a) * 0.16 * (1 + lean), C(0x6f8f56));
      book.add(0.34, 0.30, 0.34, vx + Math.cos(a) * 0.16 * (1 + lean * 2.2), Y + 2.3 + h, vz + Math.sin(a) * 0.16 * (1 + lean * 2.2), i % 2 ? C(0xe8c0cf) : C(0xf3e2d0));
    }
  }

  /* ---- teacup on a saucer, with a wisp of steam -------------------- */
  {
    const cx = 12.3, cz = 13.7;
    book.add(2.3, 0.10, 2.3, cx, Y + 0.43, cz, C(0xeee7dc));
    book.add(1.7, 0.08, 1.7, cx, Y + 0.50, cz, C(0xf7f2e8));
    book.add(1.35, 0.85, 1.35, cx, Y + 0.94, cz, C(0xf9f4ea));
    book.add(1.15, 0.10, 1.15, cx, Y + 1.31, cz, C(0x8f6b4a));
    book.add(0.30, 0.44, 0.14, cx + 0.78, Y + 0.98, cz, C(0xf9f4ea));
    book.add(0.14, 0.44, 0.14, cx + 0.66, Y + 0.98, cz, C(0xf9f4ea));
    book.add(0.14, 0.06, 1.5, cx - 1.35, Y + 0.43, cz + 0.5, C(0xd8d8d4), 0.6);

    const steamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uAmount: { value: 1 }, uColor: { value: C(0xffffff) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime, uAmount; uniform vec3 uColor; varying vec2 vUv;
        void main(){
          float s = 0.0;
          for(int i=0;i<4;i++){
            float fi = float(i);
            float y = fract(vUv.y * 0.75 - uTime * (0.10 + fi * 0.012) + fi * 0.25);
            float w = 0.045 + fi * 0.022 + y * 0.09;
            float x = vUv.x - 0.5 - sin((y * 3.0 + fi) * 3.0) * 0.05 * (0.3 + y);
            s += smoothstep(w, 0.0, abs(x)) * smoothstep(1.0, 0.15, y) * smoothstep(0.0, 0.22, y);
          }
          float a = clamp(s, 0.0, 1.0) * uAmount * 0.26;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
        }`
    });
    const steam = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9), steamMat);
    steam.position.set(cx, Y + 2.28, cz);
    steam.renderOrder = 9;
    G.add(steam);
    DESKPROPS.steam = steam;
    DESKPROPS.steamMat = steamMat;
  }

  /* ---- reading glasses ------------------------------------------- */
  {
    const gx = 5.6, gz = 15.6;
    book.add(1.5, 0.05, 0.22, gx, Y + 0.42, gz, C(0x4a4038), 0.2);
    for (const s of [-0.36, 0.36]) book.add(0.62, 0.05, 0.62, gx + s, Y + 0.42, gz - 0.5, C(0x3f3830), 0.2);
  }

  /* ---- a small brass candle holder --------------------------------- */
  {
    const cx = 12.9, cz = 15.9;
    book.add(0.8, 0.10, 0.8, cx, Y + 0.43, cz, C(0xb08a52));
    book.add(0.20, 0.36, 0.20, cx, Y + 0.66, cz, C(0xc9a466));
    book.add(0.42, 0.12, 0.42, cx, Y + 0.90, cz, C(0xb08a52));
    book.add(0.30, 0.90, 0.30, cx, Y + 1.41, cz, C(0xf3ecd8));
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.52), new THREE.MeshBasicMaterial({
      color: 0xffcf7a, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    flame.position.set(cx, Y + 2.16, cz);
    flame.renderOrder = 9;
    G.add(flame);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), makeGlowMaterial(0.85, 0xffbe72));
    halo.position.copy(flame.position);
    halo.renderOrder = 8;
    G.add(halo);
    DESKPROPS.candleFlame = flame;
    DESKPROPS.candleHalo = halo;
  }

  const bookMesh = new THREE.Mesh(book.build(), MAT.paint);
  bookMesh.castShadow = true; bookMesh.receiveShadow = true;
  G.add(bookMesh);
  const paperMesh = new THREE.Mesh(paper.build(), MAT.paper);
  paperMesh.castShadow = false; paperMesh.receiveShadow = true;
  G.add(paperMesh);
}

/* ------------------------------------------------------------------ */
/* 24.  The three physical brass knobs on the desk                      */
/* ------------------------------------------------------------------ */

const KNOBS = [];
const KNOB_DEFS = [
  { id: 'speed', label: '流速', sub: 'SEASON SPEED', x: -3.4, z: 14.5, from: 0, to: 3 },
  { id: 'season', label: '季节', sub: 'SEASON', x: 0.6, z: 14.9, from: 0, to: 1 },
  { id: 'weather', label: '天气', sub: 'WEATHER', x: 4.5, z: 15.3, from: 0, to: 1.5 }
];

function makeLabelTexture(label, sub) {
  return canvasTex('label_' + sub, 256, (g, s) => {
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(120,100,72,0.35)'; g.lineWidth = 4; g.strokeRect(6, 6, s - 12, s - 12);
    g.fillStyle = '#6b5b45';
    g.font = '600 74px "PingFang SC","Microsoft YaHei",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, s / 2, s * 0.40);
    g.fillStyle = '#9a8a70';
    g.font = '500 26px system-ui,sans-serif';
    g.fillText(sub, s / 2, s * 0.68);
  });
}

function buildKnobs() {
  const Y = DESK.y;
  const grp = new THREE.Group();
  grp.name = 'knobs';
  scene.add(grp);

  const brass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.72, flatShading: true });
  const plate = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.35, flatShading: true });

  for (const d of KNOB_DEFS) {
    const kg = new THREE.Group();
    kg.position.set(d.x, Y, d.z);

    const body = new VoxBatch(null);
    const R = 0.92, HGT = 0.46;
    const gold = C(0xc9a25e), goldDark = C(0x9a7740), goldLight = C(0xe2c489);
    // engraved plate under the knob
    body.add(2.5, 0.06, 2.5, 0, 0.03, -1.9, C(0xdccfae));
    // knob base ring
    body.add(R * 2.1, 0.12, R * 2.1, 0, 0.10, 0, goldDark);
    body.add(R * 1.9, 0.16, R * 1.9, 0, 0.22, 0, gold);
    // the turned body
    const ribs = 14;
    for (let i = 0; i < ribs; i++) {
      const a = i / ribs * TAU;
      body.add(0.13, 0.26, 0.13, Math.cos(a) * R * 0.86, 0.40, Math.sin(a) * R * 0.86, i % 2 ? gold : goldLight);
    }
    body.add(R * 1.55, 0.20, R * 1.55, 0, 0.50, 0, goldLight);
    body.add(R * 1.15, 0.10, R * 1.15, 0, 0.64, 0, gold);
    // pointer notch: a small dark inlay on the top so its rotation is readable
    body.add(0.14, 0.06, R * 0.95, 0, 0.70, R * 0.42, goldDark);
    body.add(0.10, 0.05, 0.36, 0, 0.71, R * 0.22, goldDark);

    const bm = new THREE.Mesh(body.build(), brass);
    bm.castShadow = true; bm.receiveShadow = true;
    kg.add(bm);

    // tick marks around the base
    const ticks = new VoxBatch(null);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      ticks.add(0.07, 0.03, 0.20, Math.cos(a) * (R + 0.28), 0.03, Math.sin(a) * (R + 0.28), C(0xb9a279), a);
    }
    const tm = new THREE.Mesh(ticks.build(), plate);
    tm.receiveShadow = true;
    kg.add(tm);

    // engraved label plate
    const lg = new THREE.PlaneGeometry(1.7, 1.7);
    const n = lg.attributes.position.count;
    const lc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { lc[i * 3] = 1; lc[i * 3 + 1] = 1; lc[i * 3 + 2] = 1; }
    lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    const lmat = new THREE.MeshStandardMaterial({ map: makeLabelTexture(d.label, d.sub), roughness: 0.85, metalness: 0.0 });
    const lm = new THREE.Mesh(lg, lmat);
    lm.rotation.x = -PI / 2;
    lm.position.set(0, 0.055, -1.9);
    kg.add(lm);

    grp.add(kg);
    KNOBS.push({ def: d, group: kg, y: Y + 0.72, spin: kg.children[0], value: 0, angle: 0, targetAngle: 0 });
  }
  return grp;
}

/** visual rotation follows the value with a light spring, always smooth */
function updateKnobs(dt) {
  for (const k of KNOBS) {
    let ang;
    if (k.def.id === 'season') {
      ang = -SEASON.phase * TAU;
      k.value = SEASON.phase;
    } else if (k.def.id === 'speed') {
      ang = (SEASON.timeScale / 3) * TAU * 1.25;
      k.value = SEASON.timeScale;
    } else {
      ang = (SEASON.weather / 1.5) * TAU * 1.25;
      k.value = SEASON.weather;
    }
    // take the short way around so a year wrap never spins the knob backwards
    let delta = ang - k.angle;
    delta -= Math.round(delta / TAU) * TAU;
    if (k.def.id !== 'season') k.angle += delta;
    else k.angle = ang;
    k.spin.rotation.y = k.angle;
  }
}

/* ---- pointer interaction with the knobs --------------------------- */

const knobRay = new THREE.Raycaster();
const knobPlane = new THREE.Plane();
const knobHit = new THREE.Vector3();
const knobNDC = new THREE.Vector2();
let dragging = null;

function pickKnob(clientX, clientY) {
  knobNDC.x = (clientX / window.innerWidth) * 2 - 1;
  knobNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  knobRay.setFromCamera(knobNDC, camera);
  for (const k of KNOBS) {
    knobPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(k.def.x, k.y, k.def.z));
    if (!knobRay.ray.intersectPlane(knobPlane, knobHit)) continue;
    const dx = knobHit.x - k.def.x, dz = knobHit.z - k.def.z;
    if (dx * dx + dz * dz < 1.55 * 1.55) return k;
  }
  return null;
}

function installKnobInput() {
  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const k = pickKnob(e.clientX, e.clientY);
    if (!k) return;
    e.stopPropagation();
    e.preventDefault();
    // recompute on the plane through the pointer height so the drag feels physical
    knobPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()),
      new THREE.Vector3(k.def.x, k.y, k.def.z));
    knobNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    knobNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    knobRay.setFromCamera(knobNDC, camera);
    knobRay.ray.intersectPlane(knobPlane, knobHit);
    dragging = {
      knob: k,
      lastAngle: Math.atan2(knobHit.x - k.def.x, knobHit.z - k.def.z),
      startAngle: k.angle,
      accum: 0
    };
    controls.enabled = false;
    document.getElementById('stage').classList.add('dragging');
    hintFade();
  };
  const onMove = (e) => {
    if (!dragging) {
      const k = pickKnob(e.clientX, e.clientY);
      document.getElementById('stage').style.cursor = k ? 'ew-resize' : '';
      return;
    }
    e.stopPropagation();
    const k = dragging.knob;
    knobNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    knobNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    knobRay.setFromCamera(knobNDC, camera);
    if (!knobRay.ray.intersectPlane(knobPlane, knobHit)) return;
    const a = Math.atan2(knobHit.x - k.def.x, knobHit.z - k.def.z);
    let d = a - dragging.lastAngle;
    d -= Math.round(d / TAU) * TAU;
    dragging.lastAngle = a;
    dragging.accum += d;
    const d0 = k.def;
    if (k.def.id === 'speed') {
      const v = clamp(SEASON.timeScale + d / TAU * (d0.to - d0.from), 0, 3);
      SEASON.timeScale = v;
      if (inputSpeed) inputSpeed.value = Math.round(v / 3 * 300);
    } else if (k.def.id === 'season') {
      SEASON.phase = (SEASON.phase + d / TAU + 1) % 1;
      userSeasonTouch = 1.2;
    } else {
      const v = clamp(SEASON.weather + d / TAU * (d0.to - d0.from), 0, 1.5);
      SEASON.weather = v;
      if (inputWeather) inputWeather.value = Math.round(v / 1.5 * 150);
    }
    updateReadouts();
  };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = null;
    controls.enabled = true;
    document.getElementById('stage').classList.remove('dragging');
  };
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onUp, true);
}

let userSeasonTouch = 0;