/* ------------------------------------------------------------------ */
/* 38.  Path agents: everything that moves stays on a fixed curve and   */
/*      is clamped inside the sand tray.                               */
/* ------------------------------------------------------------------ */

const _cv = new THREE.Vector3();

/** hard clamp into the diorama footprint */
function constrain(v) {
  v.x = clamp(v.x, -LIFE.half, LIFE.half);
  v.z = clamp(v.z, -LIFE.half, LIFE.half);
  return v;
}
function laneHeight(x, z) { return terrainHeight(x, z); }
function lakeHeight(x, z) { return WORLD.waterY; }

class PathAgent {
  constructor(curve, opts) {
    opts = opts || {};
    this.curve = curve;
    this.len = curve.getLength();
    this.t = opts.t || 0;
    this.speed = opts.speed || 0.35;
    this.baseSpeed = this.speed;
    this.points = opts.points || null;      // optional stop schedule
    this.stopIndex = -1;
    this.dwell = 0;
    this.yOffset = opts.yOffset || 0;
    this.onWater = !!opts.onWater;
    this.yawLerp = opts.yawLerp || 7.0;
    this.curYaw = 0;
    this.phase = opts.phase || 0;
    this.pos = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, 0, 1);
    this.paused = false;
    this.sample(0);
  }
  /** distance along the curve, 0..len */
  get distance() { return this.t * this.len; }
  setDistance(d) {
    d = ((d % this.len) + this.len) % this.len;
    this.t = d / this.len;
  }
  sample(advance) {
    if (advance) this.setDistance(this.distance + advance);
    this.curve.getPointAt(clamp(this.t, 0, 1), _cv);
    this.pos.set(_cv.x, 0, _cv.z);
    this.curve.getTangentAt(clamp(this.t, 0, 1), _cv);
    this.dir.copy(_cv);
  }
  /** returns the current action name ('' when walking) */
  update(dt, speedMul) {
    speedMul = speedMul === undefined ? 1 : speedMul;
    let action = '';
    if (this.dwell > 0) {
      this.dwell -= dt;
      action = this.points && this.stopIndex >= 0 ? this.points[this.stopIndex].action : 'idle';
      if (this.dwell <= 0) this.stopIndex = -1;
    } else {
      let advance = this.speed * speedMul * dt;
      // look ahead for a scheduled stop
      if (this.points) {
        for (let i = 0; i < this.points.length; i++) {
          if (i === this.stopIndex) continue;
          const pd = this.points[i].at * this.len;
          const cd = this.distance;
          let delta = pd - cd;
          delta -= Math.floor(delta / this.len + 0.5) * this.len;
          if (delta >= 0 && delta < advance + 0.02 && delta < this.len * 0.25) {
            advance = delta;
            this.stopIndex = i;
            this.dwell = this.points[i].dwell;
            break;
          }
        }
      }
      this.sample(advance);
    }
    this.phase += dt * (this.dwell > 0 ? 0.6 : 2.6) * speedMul;
    // face the way we are going
    const targetYaw = Math.atan2(this.dir.x, this.dir.z);
    let d = targetYaw - this.curYaw;
    d -= Math.round(d / TAU) * TAU;
    this.curYaw += d * clamp(dt * this.yawLerp, 0, 1);
    return action;
  }
}

/* ------------------------------------------------------------------ */
/* 39.  Voxel people                                                    */
/* ------------------------------------------------------------------ */

const PEOPLE = [];
const PEOPLE_DEFS = [
  { id: 'reader', coat: C(0x6d7f9c), pants: C(0x4c4a52), skin: C(0xe8c4a0), hair: C(0x4a3a30), path: 'island', speed: 0.16, scale: 0.62, prop: 'book' },
  { id: 'painter', coat: C(0xc98a6a), pants: C(0x5a5348), skin: C(0xeccaa8), hair: C(0x3d3128), path: 'plaza', speed: 0.14, scale: 0.64, prop: 'sketch' },
  { id: 'walker', coat: C(0x8fa87c), pants: C(0x4a4a52), skin: C(0xe4bd99), hair: C(0x5a4436), path: 'loop', speed: 0.30, scale: 0.63, prop: 'none' },
  { id: 'gardener', coat: C(0xa8b0c0), pants: C(0x6a6250), skin: C(0xdcb28c), hair: C(0x3a2e26), path: 'walk', speed: 0.20, scale: 0.61, prop: 'basket' }
];

function buildPerson(def) {
  const g = new THREE.Group();
  const skin = def.skin, coat = def.coat, pants = def.pants;
  const box = (w, h, d, x, y, z, col) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT.paint);
    const n = m.geometry.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    m.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // legs pivot at the hip
  const legL = new THREE.Group(); legL.position.set(-0.055, 0.34, 0);
  legL.add(box(0.072, 0.34, 0.078, 0, -0.17, 0, pants));
  legL.add(box(0.084, 0.055, 0.105, 0, -0.335, 0.015, C(0x3b3630)));
  const legR = new THREE.Group(); legR.position.set(0.055, 0.34, 0);
  legR.add(box(0.072, 0.34, 0.078, 0, -0.17, 0, pants));
  legR.add(box(0.084, 0.055, 0.105, 0, -0.335, 0.015, C(0x3b3630)));

  const torso = box(0.185, 0.34, 0.115, 0, 0.51, 0, coat);
  const collar = box(0.20, 0.045, 0.13, 0, 0.665, 0, coat.clone().multiplyScalar(1.1));
  const head = box(0.145, 0.145, 0.145, 0, 0.745, 0, skin);
  const hair = box(0.155, 0.06, 0.155, 0, 0.818, 0, def.hair);
  const hairB = box(0.155, 0.09, 0.045, 0, 0.775, -0.06, def.hair);

  const armL = new THREE.Group(); armL.position.set(-0.118, 0.645, 0);
  armL.add(box(0.058, 0.30, 0.062, 0, -0.15, 0, coat));
  armL.add(box(0.062, 0.055, 0.062, 0, -0.30, 0, skin));
  const armR = new THREE.Group(); armR.position.set(0.118, 0.645, 0);
  armR.add(box(0.058, 0.30, 0.062, 0, -0.15, 0, coat));
  armR.add(box(0.062, 0.055, 0.062, 0, -0.30, 0, skin));

  // scarf / apron detail
  if (def.id === 'gardener') g.add(box(0.20, 0.16, 0.125, 0, 0.46, 0, C(0xd8cfb8)));
  if (def.id === 'walker') g.add(box(0.22, 0.05, 0.14, 0, 0.675, 0, C(0xd9a0a8)));

  g.add(legL, legR, torso, collar, head, hair, hairB, armL, armR);

  // held props
  let prop = null;
  if (def.prop === 'book') {
    prop = new THREE.Group();
    prop.add(box(0.16, 0.02, 0.12, 0, 0, 0, C(0xe8dcc4)));
    prop.add(box(0.17, 0.03, 0.13, 0, -0.02, 0, C(0x8f5f4a)));
    prop.position.set(0, -0.30, 0.10);
    armR.add(prop);
  } else if (def.prop === 'sketch') {
    prop = new THREE.Group();
    prop.add(box(0.22, 0.005, 0.17, 0, 0, 0, C(0xf0e8d6)));
    prop.add(box(0.23, 0.02, 0.18, 0, -0.012, 0, C(0x7a6a52)));
    prop.position.set(0, -0.28, 0.12);
    prop.rotation.x = -0.5;
    armR.add(prop);
  } else if (def.prop === 'basket') {
    prop = new THREE.Group();
    prop.add(box(0.17, 0.11, 0.13, 0, 0, 0, C(0xc9a678)));
    prop.add(box(0.19, 0.02, 0.15, 0, 0.06, 0, C(0xb08e64)));
    prop.add(box(0.03, 0.09, 0.03, -0.05, 0.09, 0, C(0x8fa85c)));
    prop.add(box(0.03, 0.07, 0.03, 0.04, 0.08, 0.02, C(0xa8b86a)));
    prop.position.set(0, -0.32, 0.02);
    armL.add(prop);
  }

  g.scale.setScalar(def.scale);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legL: legL, legR: legR, armL: armL, armR: armR, head: head, torso: torso };
}

function buildPeople() {
  const grp = new THREE.Group();
  grp.name = 'people';
  scene.add(grp);

  const pathMap = { island: PATHS.island, plaza: PATHS.plaza, loop: PATHS.loop, walk: PATHS.walk };
  const stopMap = {
    reader: [{ at: 0.12, dwell: 9, action: 'read' }, { at: 0.62, dwell: 12, action: 'read' }],
    painter: [{ at: 0.25, dwell: 16, action: 'sketch' }, { at: 0.75, dwell: 11, action: 'sketch' }],
    walker: null,
    gardener: [{ at: 0.18, dwell: 8, action: 'tend' }, { at: 0.55, dwell: 10, action: 'tend' }, { at: 0.86, dwell: 6, action: 'tend' }]
  };

  for (const def of PEOPLE_DEFS) {
    const p = buildPerson(def);
    const agent = new PathAgent(pathMap[def.path], {
      speed: def.speed, t: hash1(def.id.length * 3.7) * 0.9,
      points: stopMap[def.id], phase: hash1(def.id.charCodeAt(0)) * TAU
    });
    grp.add(p.group);
    PEOPLE.push({ def: def, parts: p, agent: agent, action: '', bob: 0 });
  }
  return grp;
}

function updatePeople(dt) {
  for (const P of PEOPLE) {
    const a = P.agent;
    P.action = a.update(dt, 1);
    const x = a.pos.x, z = a.pos.z;
    const onIsland = a.curve === PATHS.island;
    const y = onIsland ? terrainHeight(x, z) : terrainHeight(x, z);
    P.parts.group.position.set(x, y, z);
    P.parts.group.rotation.y = a.curYaw;

    const walking = P.action === '';
    const cyc = a.phase;
    const speedN = walking ? 1 : 0;
    const swing = Math.sin(cyc * 3.1) * 0.55 * speedN;
    P.parts.legL.rotation.x = swing;
    P.parts.legR.rotation.x = -swing;
    P.parts.armL.rotation.x = -swing * 0.7;
    P.parts.armR.rotation.x = swing * 0.7;

    // vertical bob keeps the steps readable
    const bob = walking ? Math.abs(Math.sin(cyc * 1.55)) * 0.022 : 0;
    P.parts.group.position.y = y + bob;

    if (!walking) {
      // act: reading, sketching, tending
      const t = performance.now() * 0.001;
      if (P.action === 'read') {
        P.parts.armR.rotation.x = -1.15 + Math.sin(t * 0.7) * 0.05;
        P.parts.armL.rotation.x = -1.05 + Math.sin(t * 0.7 + 0.4) * 0.05;
        P.parts.head.rotation.x = 0.32 + Math.sin(t * 0.5) * 0.06;
      } else if (P.action === 'sketch') {
        P.parts.armR.rotation.x = -1.35 + Math.sin(t * 1.9) * 0.16;
        P.parts.armL.rotation.x = -1.20;
        P.parts.head.rotation.x = 0.36 + Math.sin(t * 1.9) * 0.05;
      } else if (P.action === 'tend') {
        P.parts.group.position.y = y - 0.10 + Math.sin(t * 1.4) * 0.008;
        P.parts.armR.rotation.x = -1.5 + Math.sin(t * 2.4) * 0.22;
        P.parts.armL.rotation.x = -1.3 + Math.sin(t * 2.4 + 1.2) * 0.20;
        P.parts.head.rotation.x = 0.42;
      }
      // face the island centre when the reader sits
      if (P.def.id === 'reader' && onIsland) {
        P.parts.group.rotation.y = Math.atan2(WORLD.island.x - x, WORLD.island.z - z) + PI;
      }
    } else {
      P.parts.head.rotation.x *= 0.9;
    }
    constrain(P.parts.group.position);
  }
}

/* ------------------------------------------------------------------ */
/* 40.  The little rowing boat                                          */
/* ------------------------------------------------------------------ */

const BOAT = { group: null, agent: null, moored: 0, bob: 0, state: 'sailing', wake: null };

function buildBoat() {
  const g = new THREE.Group();
  g.name = 'boat';
  const b = new VoxBatch(null);
  const hull = C(0xa8734a), hullDark = C(0x8a5a38), deck = C(0xc9a678), trim = C(0x6f8f9a);

  // hull: rows of decreasing width, like stacked planks
  const L = 1.15, W = 0.42;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const w = W * (1 - t * 0.12);
    const y = -0.06 + t * 0.20;
    b.add(L, 0.045, w, 0, y, 0, i % 2 ? hull : hullDark);
  }
  // bow and stern tapers
  b.add(0.20, 0.16, W * 0.5, L * 0.56, 0.06, 0, hull);
  b.add(0.20, 0.16, W * 0.9, -L * 0.56, 0.06, 0, hull);
  b.add(0.10, 0.14, 0.10, L * 0.62, 0.16, 0, trim);
  // gunwale
  for (const s of [-1, 1]) b.add(L * 1.02, 0.04, 0.055, 0, 0.20, s * W * 0.5, trim);
  // benches
  b.add(0.09, 0.04, W * 0.86, -0.32, 0.19, 0, deck);
  b.add(0.09, 0.04, W * 0.86, 0.26, 0.19, 0, deck);
  // an oar resting across
  b.add(0.90, 0.035, 0.05, 0.05, 0.235, 0.16, C(0xc9a678), 0.06);

  const m = new THREE.Mesh(b.build(), MAT.wood);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);

  // cargo: a lantern and a folded blanket
  const c = new VoxBatch(null);
  c.add(0.14, 0.14, 0.14, -0.5, 0.30, 0, C(0xf0dcae));
  c.add(0.20, 0.07, 0.26, 0.45, 0.25, -0.06, C(0xb08e7a));
  const cm = new THREE.Mesh(c.build(), MAT.paint);
  cm.castShadow = true;
  g.add(cm);

  scene.add(g);
  BOAT.group = g;
  BOAT.agent = new PathAgent(PATHS.boatLane, { speed: 0.30, t: 0.02, onWater: true, yawLerp: 1.6 });
  return g;
}

function updateBoat(dt) {
  const a = BOAT.agent;
  const free = clamp(1 - S.ice * 1.9, 0, 1);          // it heads home well before the lake sets solid
  const home = 0.02;

  if (free < 0.55) {
    // steer back to the berth along the lane, easing in as it arrives
    let d = home - a.t;
    d -= Math.round(d);
    const dist = Math.abs(d) * a.len;
    const arrive = clamp(dist / 1.8, 0.05, 1);
    a.setDistance(a.distance + Math.sign(d) * 0.30 * dt * arrive * (0.35 + free));
    a.phase += dt * 0.4;
    a.sample(0);
    const dirToShore = Math.atan2(POI.dock.x - a.pos.x, POI.dock.z - a.pos.z);
    let dd = dirToShore - a.curYaw;
    dd -= Math.round(dd / TAU) * TAU;
    a.curYaw += dd * clamp(dt * 1.2, 0, 1);
    BOAT.state = dist < 0.05 ? 'moored' : 'returning';
  } else {
    BOAT.state = 'sailing';
    a.speed = a.baseSpeed * free * (0.55 + 0.45 * clamp(S.stream, 0, 1));
    a.update(dt, 1);
  }
  if (BOAT.state === 'moored') a.speed = 0;

  BOAT.bob += dt * (1.4 + 0.8 * clamp(S.stream, 0, 1));
  const y = WORLD.waterY + 0.03 + Math.sin(BOAT.bob) * 0.014 + Math.sin(BOAT.bob * 0.63) * 0.008;
  BOAT.group.position.set(a.pos.x, y, a.pos.z);
  BOAT.group.rotation.y = a.curYaw;
  BOAT.group.rotation.z = Math.sin(BOAT.bob * 0.9) * 0.03 * clamp(S.stream, 0, 1);
  BOAT.group.rotation.x = Math.sin(BOAT.bob * 0.71 + 1.2) * 0.022;
  constrain(BOAT.group.position);
}

/* ------------------------------------------------------------------ */
/* 41.  Butterflies                                                     */
/* ------------------------------------------------------------------ */

const BUTTERFLIES = { group: null, list: [] };
const BUTTERFLY_COLORS = [C(0xf2d06a), C(0xe8a0b8), C(0xf6f0e2), C(0xe8934f), C(0xa8c8e8)];

function buildButterflies(n) {
  const grp = new THREE.Group();
  grp.name = 'butterflies';
  scene.add(grp);
  BUTTERFLIES.group = grp;
  const bodyGeo = new THREE.BoxGeometry(0.012, 0.012, 0.05);
  const wingGeo = new THREE.BoxGeometry(0.055, 0.006, 0.038);

  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const col = BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length];
    const mkMesh = (geo, color) => {
      const m = new THREE.Mesh(geo, MAT.paint.clone());
      m.material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9, metalness: 0, flatShading: true });
      m.castShadow = false;
      return m;
    };
    g.add(mkMesh(bodyGeo, C(0x4a4038)));
    const wl = mkMesh(wingGeo, col); wl.position.set(-0.033, 0.004, 0);
    const wr = mkMesh(wingGeo, col); wr.position.set(0.033, 0.004, 0);
    g.add(wl, wr);
    grp.add(g);
    const a = hash1(i * 3.7) * TAU;
    const r = 2.2 + hash1(i * 7.1) * 5.2;
    BUTTERFLIES.list.push({
      obj: g, wingL: wl, wingR: wr,
      // each butterfly circles a flower patch
      cx: Math.cos(a) * r * 0.7, cz: Math.sin(a) * r * 0.7,
      rx: 0.9 + hash1(i * 1.9) * 1.6, rz: 0.8 + hash1(i * 5.3) * 1.5,
      speed: 0.36 + hash1(i * 2.3) * 0.42,
      phase: hash1(i * 9.1) * TAU,
      hover: 0.30 + hash1(i * 4.7) * 0.55,
      flap: hash1(i * 6.1) * TAU,
      seed: i,
      active: 0
    });
    // keep their circles inside the tray
    const b = BUTTERFLIES.list[i];
    b.cx = clamp(b.cx, -LIFE.half + b.rx, LIFE.half - b.rx);
    b.cz = clamp(b.cz, -LIFE.half + b.rz, LIFE.half - b.rz);
  }
  return grp;
}

function updateButterflies(dt, t) {
  const amt = clamp(S.butterfly, 0, 1) * clamp(0.25 + 0.85 * S.daylight, 0, 1.1);
  BUTTERFLIES.group.visible = amt > 0.02;
  if (!BUTTERFLIES.group.visible) return;
  const n = BUTTERFLIES.list.length;
  for (let i = 0; i < n; i++) {
    const b = BUTTERFLIES.list[i];
    // staggered arrival and departure
    const local = clamp((amt - (b.seed / n) * 0.35) / 0.65, 0, 1);
    b.active = local;
    b.obj.visible = local > 0.02;
    if (!b.obj.visible) continue;
    const a = t * b.speed + b.phase;
    const x = b.cx + Math.cos(a) * b.rx;
    const z = b.cz + Math.sin(a * 1.37) * b.rz;
    const ground = terrainHeight(x, z);
    const y = Math.max(ground, WORLD.waterY) + b.hover + Math.sin(t * 1.9 + b.phase * 3) * 0.08;
    b.obj.position.set(x, y, z).multiplyScalar(1);
    constrain(b.obj.position);
    // face along the circle
    b.obj.rotation.y = Math.atan2(-Math.sin(a) * b.rx, Math.cos(a * 1.37) * b.rz * 1.37) + PI;
    b.obj.rotation.z = Math.sin(t * 2.2 + b.phase) * 0.22;
    const flap = Math.sin(t * 17 + b.flap) * 0.95 + 0.15;
    b.wingL.rotation.z = flap;
    b.wingR.rotation.z = -flap;
    const s = 0.75 + 0.35 * local;
    b.obj.scale.setScalar(s);
  }
}

/* ------------------------------------------------------------------ */
/* 42.  Migratory birds                                                 */
/* ------------------------------------------------------------------ */

const BIRDS = { group: null, list: [] };

function buildBirds(n) {
  const grp = new THREE.Group();
  grp.name = 'birds';
  scene.add(grp);
  BIRDS.group = grp;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: C(0x50555f), roughness: 0.9, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.070, 0.055, 0.20), mat);
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.085), mat);
    const wr = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.085), mat);
    wl.position.x = -0.20; wr.position.x = 0.20;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.055), mat);
    head.position.set(0, 0.035, 0.12);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.13), mat);
    tail.position.set(0, 0.008, -0.14);
    g.add(body, wl, wr, head, tail);
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    grp.add(g);
    BIRDS.list.push({
      obj: g, wl: wl, wr: wr,
      r: 6.5 + hash1(i * 2.1) * 4.5,
      cx: (hash1(i * 3.3) - 0.5) * 5,
      cz: (hash1(i * 4.7) - 0.5) * 5,
      speed: 0.11 + hash1(i * 5.9) * 0.10,
      y: 5.4 + hash1(i * 7.3) * 2.6,
      phase: hash1(i * 1.3) * TAU,
      flap: hash1(i * 8.9) * TAU,
      active: 0
    });
  }
  return grp;
}

function updateBirds(dt, t) {
  // birds thin out toward winter and gather again in spring
  const amt = clamp(S.bird, 0, 1);
  BIRDS.group.visible = amt > 0.02;
  if (!BIRDS.group.visible) return;
  const n = BIRDS.list.length;
  for (let i = 0; i < n; i++) {
    const b = BIRDS.list[i];
    const local = clamp((amt - (i / n) * 0.4) / 0.6, 0, 1);
    b.active = local;
    b.obj.visible = local > 0.03;
    if (!b.obj.visible) continue;
    const a = t * b.speed + b.phase;
    const x = b.cx + Math.cos(a) * b.r;
    const z = b.cz + Math.sin(a) * b.r * 0.78;
    const y = b.y + Math.sin(t * 0.6 + b.phase) * 0.45;
    b.obj.position.set(clamp(x, -LIFE.half, LIFE.half), y, clamp(z, -LIFE.half, LIFE.half));
    b.obj.rotation.y = Math.atan2(-Math.sin(a) * b.r, Math.cos(a) * b.r * 0.78) + PI;
    b.obj.rotation.z = -0.18;
    const flap = Math.sin(t * 6.4 + b.flap) * 0.65;
    b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
    b.obj.scale.setScalar(0.7 + 0.4 * local);
  }
}

/* ------------------------------------------------------------------ */
/* 43.  Fireflies — summer nights only                                  */
/* ------------------------------------------------------------------ */

const FIREFLIES = { group: null, list: [] };

function buildFireflies(n) {
  const grp = new THREE.Group();
  grp.name = 'fireflies';
  scene.add(grp);
  FIREFLIES.group = grp;
  const geo = new THREE.PlaneGeometry(0.075, 0.075);
  const mat = new THREE.MeshBasicMaterial({
    map: makeLampTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, color: C(0xffe9a8), side: THREE.DoubleSide
  });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  mesh.renderOrder = 9;
  grp.add(mesh);
  FIREFLIES.mesh = mesh;
  for (let i = 0; i < n; i++) {
    FIREFLIES.list.push({
      x: (hash1(i * 3.1) - 0.5) * LIFE.half * 1.7,
      z: (hash1(i * 5.7) - 0.5) * LIFE.half * 1.7,
      baseY: 0.25 + hash1(i * 7.9) * 1.2,
      ax: 0.5 + hash1(i * 2.3) * 1.4,
      az: 0.5 + hash1(i * 9.7) * 1.4,
      ay: 0.10 + hash1(i * 4.1) * 0.28,
      sx: 0.18 + hash1(i * 6.3) * 0.3,
      sz: 0.16 + hash1(i * 8.1) * 0.28,
      sy: 0.5 + hash1(i * 1.7) * 0.9,
      phase: hash1(i * 11.3) * TAU,
      pulse: 0.7 + hash1(i * 12.7) * 1.8
    });
  }
  return grp;
}

const _ffDummy = new THREE.Object3D();
function updateFireflies(dt, t) {
  const amt = clamp(S.firefly, 0, 1) * clamp(S.night * 2.2 - 0.15, 0, 1);
  FIREFLIES.group.visible = amt > 0.02;
  if (!FIREFLIES.group.visible) return;
  const list = FIREFLIES.list, mesh = FIREFLIES.mesh;
  const cam = camera.position;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    const x = f.x + Math.sin(t * f.sx + f.phase) * f.ax;
    const z = f.z + Math.cos(t * f.sz + f.phase * 1.3) * f.az;
    const gy = Math.max(terrainHeight(x, z), WORLD.waterY);
    const y = gy + f.baseY + Math.sin(t * f.sy + f.phase * 2.1) * f.ay;
    _ffDummy.position.set(
      clamp(x, -LIFE.half - 1, LIFE.half + 1), y, clamp(z, -LIFE.half - 1, LIFE.half + 1));
    _ffDummy.lookAt(cam.x, cam.y, cam.z);
    const pulse = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * f.pulse * 2.2 + f.phase * 3.7), 2.2);
    const s = (0.5 + pulse * 0.9) * (0.4 + 0.6 * amt);
    _ffDummy.scale.setScalar(s);
    _ffDummy.updateMatrix();
    mesh.setMatrixAt(i, _ffDummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.material.opacity = clamp(amt, 0, 1);
  mesh.material.transparent = true;
}