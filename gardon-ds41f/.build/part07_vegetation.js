/* ------------------------------------------------------------------ */
/* 25.  Deterministic RNG for build-time scattering                     */
/* ------------------------------------------------------------------ */

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* 26.  Shared vegetation uniforms — every plant reads the same clock   */
/* ------------------------------------------------------------------ */

const VEGU = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(0.6, 0.35) },
  uWindAmp: { value: 0.35 },
  uLeafA: { value: C(0x8fc46a) },       // spring green
  uLeafB: { value: C(0x6aa84f) },       // summer green
  uAutumn: { value: C(0xd08a34) },      // autumn turn target
  uAutumnAmt: { value: 0 },             // 0 = green, 1 = fully turned
  uTurnSpread: { value: 0.35 },         // within-species staggering
  uCanopy: { value: 1 },                // clump scale
  uLeafSize: { value: 1 },              // individual leaf scale
  uBlossom: { value: 0 },
  uBlossomCol: { value: C(0xf7c8d8) },
  uFlowerAmt: { value: 0 },
  uFlowerCol: { value: C(0xf2e2a0) },
  uGrassAmt: { value: 1 },
  uGrassCol: { value: C(0x93c96f) },
  uGrassTint2: { value: C(0x6d9c4c) },
  uSnowAmt: { value: 0 },
  uSnowCol: { value: C(0xf7faff) },
  uFrost: { value: 0 },
  uDaylight: { value: 1 },
  uLampWarm: { value: 0 }
};

/**
 * Every plant material shares the global season/clock uniforms by reference,
 * so one update drives the whole garden. Only genuinely per-material knobs
 * (a flower's own petal colour and its bloom amount) are passed as overrides
 * with their own uniform objects.
 */
function vegUniforms(overrides) {
  const u = {};
  for (const k in VEGU) u[k] = VEGU[k];
  if (overrides) for (const k in overrides) u[k] = overrides[k];
  return u;
}

/* ------------------------------------------------------------------ */
/* 27.  Voxel clump template builder                                    */
/* ------------------------------------------------------------------ */

const BOX1 = new THREE.BoxGeometry(1, 1, 1);

/** deterministic scatter of voxels inside a sphere-ish blob */
function blobPoints(vox, R, rnd, dens, squash) {
  squash = squash || 1;
  const pts = [];
  const n = Math.max(1, Math.ceil(R / vox));
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      for (let k = -n; k <= n; k++) {
        const x = i * vox, y = j * vox * squash, z = k * vox;
        const d = Math.sqrt(x * x + y * y + z * z) / R;
        if (d > 1) continue;
        if (rnd() > dens * (0.46 + 0.54 * (1 - d))) continue;
        pts.push([x + (rnd() - 0.5) * vox * 0.6, y + (rnd() - 0.5) * vox * 0.6, z + (rnd() - 0.5) * vox * 0.6]);
      }
    }
  }
  return pts;
}

/**
 * One leaf clump template: a small pile of voxels baked into a single
 * geometry. Each instance is a whole clump, so the whole canopy costs a
 * few hundred instances instead of tens of thousands.
 */
function clumpGeometry(vox, R, seed, dens, squash, sizeMul) {
  const rnd = rng(seed);
  const pts = blobPoints(vox, R, rnd, dens, squash);
  const s = vox * (sizeMul || 1);
  const chunks = [];
  for (const p of pts) {
    const jitter = 0.62 + rnd() * 0.72;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(p[0], p[1], p[2]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 0.8, rnd() * TAU, rnd() * 0.8)),
      new THREE.Vector3(s * jitter, s * jitter, s * jitter));
    const v = 0.80 + rnd() * 0.42;
    chunks.push({ geo: BOX1, matrix: m, color: new THREE.Color(v, v, v) });
  }
  const g = mergeChunks(chunks);
  return g;
}

/* ------------------------------------------------------------------ */
/* 28.  Species definitions                                             */
/* ------------------------------------------------------------------ */

const SPECIES = {
  cherry: {
    name: '樱花', trunk: 0.15, h: [1.55, 2.05], trunkFrac: 0.44, canopyR: 0.72,
    clumps: 10, vox: 0.062, clumpR: 0.235, dens: 0.60, squash: 0.88, sizeMul: 1.15,
    blossom: 1.0, turn: 0.00, turnSpread: 0.10, bark: C(0x6d5142), leafScale: 1.05,
    branches: 3, tier: 1.0
  },
  oak: {
    name: '橡树', trunk: 0.20, h: [1.85, 2.35], trunkFrac: 0.40, canopyR: 0.85,
    clumps: 12, vox: 0.075, clumpR: 0.30, dens: 0.66, squash: 0.80, sizeMul: 1.20,
    blossom: 0.0, turn: 0.02, turnSpread: 0.13, bark: C(0x6a5240), leafScale: 1.15,
    branches: 4, tier: 1.0
  },
  maple: {
    name: '枫树', trunk: 0.16, h: [1.55, 2.15], trunkFrac: 0.42, canopyR: 0.88,
    clumps: 11, vox: 0.070, clumpR: 0.26, dens: 0.62, squash: 0.86, sizeMul: 1.10,
    blossom: 0.0, turn: -0.055, turnSpread: 0.16, bark: C(0x74564a), leafScale: 1.10,
    branches: 4, tier: 1.0
  },
  birch: {
    name: '白桦', trunk: 0.12, h: [1.95, 2.45], trunkFrac: 0.52, canopyR: 0.60,
    clumps: 8, vox: 0.060, clumpR: 0.215, dens: 0.58, squash: 0.95, sizeMul: 1.05,
    blossom: 0.0, turn: -0.030, turnSpread: 0.20, bark: C(0xd9d3c4), leafScale: 0.95,
    branches: 3, tier: 0.9
  },
  pine: {
    name: '松树', trunk: 0.14, h: [2.15, 2.75], trunkFrac: 0.22, canopyR: 0.52,
    clumps: 9, vox: 0.070, clumpR: 0.26, dens: 0.62, squash: 0.62, sizeMul: 1.25,
    blossom: 0.0, turn: 0.30, turnSpread: 0.06, bark: C(0x5c4636), leafScale: 0.85,
    branches: 2, tier: 1.35, evergreen: true
  },
  willow: {
    name: '垂柳', trunk: 0.15, h: [1.75, 2.15], trunkFrac: 0.46, canopyR: 0.90,
    clumps: 10, vox: 0.062, clumpR: 0.235, dens: 0.54, squash: 0.66, sizeMul: 1.10,
    blossom: 0.0, turn: 0.05, turnSpread: 0.18, bark: C(0x6f5b45), leafScale: 1.0,
    branches: 4, tier: 0.85
  },
  shrub: {
    name: '灌木', trunk: 0.0, h: [0.42, 0.72], trunkFrac: 0.0, canopyR: 0.30,
    clumps: 4, vox: 0.070, clumpR: 0.20, dens: 0.66, squash: 0.80, sizeMul: 1.0,
    blossom: 0.0, turn: -0.02, turnSpread: 0.22, bark: C(0x6b5a44), leafScale: 1.0,
    branches: 0, tier: 0.8
  }
};

/* ------------------------------------------------------------------ */
/* 29.  Tree skeleton: trunk + branches, plus clump placements          */
/* ------------------------------------------------------------------ */

function makeTree(spec, seed) {
  const rnd = rng(seed);
  const H = lerp(spec.h[0], spec.h[1], rnd());
  const trunkChunks = [];
  const clumps = [];

  const tw = spec.trunk;
  const trunkTop = H * spec.trunkFrac;
  if (tw > 0) {
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      const y0 = t0 * trunkTop, y1 = t1 * trunkTop;
      const w0 = tw * (1 - t0 * 0.34), w1 = tw * (1 - t1 * 0.34);
      const lean = soff(seed + i * 2.3) * 0.035;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(lean * t0, (y0 + y1) / 2, lean * t0 * 0.6),
        new THREE.Quaternion(),
        new THREE.Vector3(w0, (y1 - y0) * 1.02, w1));
      const v = 0.85 + rnd() * 0.3;
      trunkChunks.push({ geo: BOX1, matrix: m, color: spec.bark.clone().multiplyScalar(v) });
    }
    // root flare
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + rnd();
      trunkChunks.push({
        geo: BOX1,
        matrix: new THREE.Matrix4().compose(
          new THREE.Vector3(Math.cos(a) * tw * 0.7, tw * 0.35, Math.sin(a) * tw * 0.7),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a),
          new THREE.Vector3(tw * 1.1, tw * 0.9, tw * 1.1)),
        color: spec.bark.clone().multiplyScalar(0.78 + rnd() * 0.2)
      });
    }
    // branches fanning out to the clump anchors
    for (let i = 0; i < spec.branches; i++) {
      const a = (i / spec.branches) * TAU + rnd() * 0.9;
      const baseY = trunkTop * (0.72 + rnd() * 0.26);
      const reach = spec.canopyR * (0.55 + rnd() * 0.35);
      const tipY = trunkTop + (H - trunkTop) * (0.30 + rnd() * 0.4);
      const ex = Math.cos(a) * reach, ez = Math.sin(a) * reach;
      const len = Math.hypot(ex, tipY - baseY, ez);
      const mx = ex * 0.5, mz = ez * 0.5, my = (baseY + tipY) / 2;
      const pitch = Math.atan2(tipY - baseY, Math.hypot(ex, ez));
      const yaw = Math.atan2(ex, ez);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
      trunkChunks.push({
        geo: BOX1,
        matrix: new THREE.Matrix4().compose(new THREE.Vector3(mx, my, mz), q, new THREE.Vector3(tw * 0.62, len, tw * 0.62)),
        color: spec.bark.clone().multiplyScalar(0.86 + rnd() * 0.22)
      });
    }
  }

  // ---- clump anchors: a spreading crown -----------------------------
  const cN = spec.clumps;
  const baseY = tw > 0 ? trunkTop * 0.95 : H * 0.35;
  const topY = tw > 0 ? H : H * 1.05;
  for (let i = 0; i < cN; i++) {
    const u = i / (cN - 1 || 1);
    // profile: narrower at the crown top and slightly narrower at the base
    const prof = Math.pow(Math.sin(Math.PI * (0.16 + u * 0.80)), 0.62);
    const rad = spec.canopyR * prof;
    const a = i * 2.39996 + seed * 0.7 + rnd() * 0.55;
    const rr = rad * (0.34 + rnd() * 0.66);
    const y = lerp(baseY, topY, u) + (rnd() - 0.5) * 0.09;
    clumps.push({
      x: Math.cos(a) * rr,
      y: y,
      z: Math.sin(a) * rr,
      s: (0.62 + rnd() * 0.62) * spec.leafScale * (0.72 + 0.45 * prof),
      turn: clamp((1 - u) * 0.75 + rnd() * 0.5, 0, 1.4),   // lower, outer clumps change first
      tint: rnd(),
      phase: rnd() * TAU,
      kind: i
    });
  }
  // a couple of clumps right at the top so the crown closes
  clumps.push({ x: (rnd() - 0.5) * 0.12, y: topY + spec.clumpR * 0.35, z: (rnd() - 0.5) * 0.12, s: 0.85 * spec.leafScale, turn: 1.0, tint: rnd(), phase: rnd() * TAU, kind: 99 });

  return { trunkGeo: mergeChunks(trunkChunks), clumps: clumps, height: H, topY: topY };
}

/* ------------------------------------------------------------------ */
/* 30.  Placement masks: keep plants out of the paths and buildings     */
/* ------------------------------------------------------------------ */

const MASK = { paths: [], circles: [], cell: 0.9, w: 0, h: 0, grid: null, ox: 0, oz: 0 };

function buildPlacementMask() {
  // dense polyline samples for every walkable path
  MASK.paths.length = 0;
  const addCurve = (c, closed) => {
    const L = c.getLength();
    const n = Math.max(8, Math.round(L / 0.30));
    for (let i = 0; i <= n; i++) {
      const p = c.getPointAt(closed ? (i % n) / n : i / n);
      MASK.paths.push(p.x, p.z);
    }
  };
  addCurve(PATHS.walk, false);
  addCurve(PATHS.spur, false);
  addCurve(PATHS.bridgeApproach, false);
  addCurve(PATHS.island, true);
  addCurve(PATHS.plaza, true);

  MASK.circles = [
    { x: POI.greenhouse.x, z: POI.greenhouse.z, r: 2.6 },
    { x: POI.bookhouse.x, z: POI.bookhouse.z, r: 2.1 },
    { x: POI.kiosk.x, z: POI.kiosk.z, r: 1.9 },
    { x: POI.gazebo.x, z: POI.gazebo.z, r: 1.9 },
    { x: POI.dock.x, z: POI.dock.z, r: 1.9 },
    { x: BRIDGE_A.x, z: BRIDGE_A.y, r: 1.1 },
    { x: (BRIDGE_A.x + BRIDGE_B.x) / 2, z: (BRIDGE_A.y + BRIDGE_B.y) / 2, r: 1.4 },
    { x: BRIDGE_B.x, z: BRIDGE_B.y, r: 1.1 },
    { x: WORLD.island.x + 0.55, z: WORLD.island.z - 0.42, r: 0.7 }
  ];
}

function distToPath(x, z) {
  let best = 1e9;
  const P = MASK.paths;
  for (let i = 0; i < P.length; i += 2) {
    const dx = x - P[i], dz = z - P[i + 1];
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
/** true when a plant may grow here */
function plantable(x, z, pad, allowWater) {
  const pad2 = pad === undefined ? 0.34 : pad;
  if (Math.abs(x) > LIFE.half || Math.abs(z) > LIFE.half) return false;
  const h = terrainHeight(x, z);
  if (!allowWater && h < WORLD.waterY + 0.10) return false;
  if (distToPath(x, z) < 0.52 + pad2) return false;
  for (const c of MASK.circles) {
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz < (c.r + pad2) * (c.r + pad2)) return false;
  }
  if (distToStream(x, z) < 0.60 + pad2) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* 31.  Build the whole planting scheme                                 */
/* ------------------------------------------------------------------ */

const VEG = {
  group: null, leaf: null, blossom: null, grass: null, flowers: null,
  hydrangea: null, lotus: null, snow: null, shrubs: null,
  leafState: null, clumpTemplates: [], treeAnchors: [], snowSites: [],
  counts: {}
};

const LEAF_INST_CAP = 1400;
const GRASS_CAP = 3400;
const FLOWER_CAP = 1450;
const SNOW_CAP = 3400;

const TREE_ZONES = [
  { cx: -9.6, cz: -6.6, r: 2.9, n: 3, sp: ['cherry', 'cherry', 'birch'] },
  { cx: -11.2, cz: -2.2, r: 2.6, n: 2, sp: ['cherry', 'willow'] },
  { cx: -9.9, cz: 1.6, r: 3.1, n: 3, sp: ['willow', 'birch', 'shrub'] },
  { cx: -8.6, cz: 8.6, r: 3.2, n: 3, sp: ['oak', 'birch', 'shrub'] },
  { cx: -3.2, cz: 9.8, r: 3.6, n: 3, sp: ['birch', 'oak', 'shrub'] },
  { cx: 2.4, cz: 10.2, r: 3.4, n: 3, sp: ['oak', 'maple', 'shrub'] },
  { cx: 8.8, cz: 8.2, r: 3.0, n: 3, sp: ['maple', 'oak', 'shrub'] },
  { cx: 10.6, cz: 3.4, r: 2.8, n: 2, sp: ['maple', 'shrub'] },
  { cx: 9.8, cz: -2.6, r: 3.0, n: 3, sp: ['maple', 'birch', 'shrub'] },
  { cx: 8.4, cz: -7.9, r: 3.2, n: 4, sp: ['maple', 'maple', 'oak', 'shrub'] },
  { cx: 2.8, cz: -9.9, r: 4.4, n: 4, sp: ['pine', 'pine', 'maple', 'birch'] },
  { cx: -3.6, cz: -9.2, r: 3.4, n: 3, sp: ['pine', 'birch', 'shrub'] },
  { cx: -11.8, cz: 6.0, r: 2.6, n: 2, sp: ['oak', 'shrub'] },
  { cx: 11.4, cz: 10.0, r: 2.4, n: 2, sp: ['birch', 'pine'] },
  { island: true, n: 2, sp: ['pine', 'cherry'] }
];

function buildVegetation() {
  buildPlacementMask();

  VEG.group = new THREE.Group();
  VEG.group.name = 'vegetation';
  scene.add(VEG.group);

  // ---- clump templates ---------------------------------------------
  // Kept deliberately chunky: a clump reads as a tiny voxel thicket, and the
  // whole canopy stays around half a million triangles.
  VEG.clumpTemplates = [
    clumpGeometry(0.086, 0.235, 1001, 0.78, 0.88, 1.15),
    clumpGeometry(0.095, 0.255, 1002, 0.80, 0.84, 1.10),
    clumpGeometry(0.088, 0.215, 1003, 0.76, 0.95, 1.05),
    clumpGeometry(0.100, 0.290, 1004, 0.80, 0.78, 1.18)
  ];

  // ---- tree instances ----------------------------------------------
  const leafInst = [];
  const blossomInst = [];
  const trunkChunks = [];
  const snowSites = [];

  const placeTree = (x, z, spId, seed) => {
    const spec = SPECIES[spId];
    const tree = makeTree(spec, seed);
    const gy = terrainHeight(x, z);
    const yaw = hash1(seed * 1.7) * TAU;
    const tilt = (hash1(seed * 2.3) - 0.5) * 0.09;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, tilt * 0.6, 'YXZ'));
    const base = new THREE.Vector3(x, gy, z);

    trunkChunks.push({
      geo: tree.trunkGeo,
      matrix: new THREE.Matrix4().compose(base, q, new THREE.Vector3(1, 1, 1))
    });

    for (const c of tree.clumps) {
      const wx = x + (c.x * cos + c.z * sin);
      const wz = z + (-c.x * sin + c.z * cos);
      const inst = {
        x: wx, y: gy + c.y, z: wz,
        s: c.s, turn: c.turn, tint: c.tint, phase: c.phase,
        yaw: yaw + c.phase * 0.4, spec: spId, kind: c.kind
      };
      leafInst.push(inst);
      if (spec.blossom > 0 && c.kind % 2 === 0 && c.y > gy + tree.height * 0.45) {
        blossomInst.push({ x: wx, y: gy + c.y, z: wz, s: c.s * spec.blossom, tint: c.tint, phase: c.phase, yaw: yaw });
      }
      // snow collects on the top clumps of each tree
      if (c.y > gy + tree.height * 0.72) {
        snowSites.push({ x: wx, y: gy + c.y + 0.10 * c.s, z: wz, s: 0.30 * c.s, w: 0.55 + 0.45 * hash1(seed + c.kind), nx: 0, ny: 1, nz: 0 });
      }
    }
    VEG.treeAnchors.push({ x: x, z: z, gy: gy, h: tree.height, spec: spId, r: spec.canopyR * 1.25 });

    // the tree's own contribution to ground snow
    for (let i = 0; i < 3; i++) {
      const a = hash1(seed + i * 5.1) * TAU;
      const rr = 0.3 + hash1(seed + i * 2.7) * 1.1;
      const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      snowSites.push({ x: px, y: terrainHeight(px, pz) + 0.06, z: pz, s: 0.34, w: 0.7, nx: 0, ny: 1, nz: 0 });
    }
  };

  let seed = 700;
  for (const zone of TREE_ZONES) {
    const cx = zone.island ? WORLD.island.x : zone.cx;
    const cz = zone.island ? WORLD.island.z : zone.cz;
    const rr = zone.island ? 0.55 : zone.r;
    for (let i = 0; i < zone.n; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 46 && !placed; attempt++) {
        const a = rng(seed * 31 + attempt * 7 + i * 3)() * TAU;
        const rad = Math.sqrt(rng(seed * 17 + attempt * 13 + i)()) * rr;
        const x = cx + Math.cos(a) * rad;
        const z = cz + Math.sin(a) * rad;
        const spId = zone.sp[i % zone.sp.length];
        const sp = SPECIES[spId];
        const pad = spId === 'shrub' ? 0.5 : 0.85;
        if (!plantable(x, z, pad, false)) continue;
        if (slopeAt(x, z) > 1.35) continue;
        // keep trees apart
        let tooClose = false;
        for (const t of VEG.treeAnchors) {
          if (Math.hypot(t.x - x, t.z - z) < (spId === 'shrub' ? 0.75 : 0.95)) { tooClose = true; break; }
        }
        if (tooClose) continue;
        placeTree(x, z, spId, seed + i * 97 + attempt * 5);
        placed = true;
      }
      seed++;
    }
  }

  // a few lone shrubs and saplings sprinkled through the meadow
  const rnd = rng(4242);
  for (let i = 0; i < 60; i++) {
    const x = (rnd() * 2 - 1) * (LIFE.half - 0.6);
    const z = (rnd() * 2 - 1) * (LIFE.half - 0.6);
    const h = terrainHeight(x, z);
    if (h < WORLD.waterY + 0.16) continue;
    if (!plantable(x, z, 0.34, false)) continue;
    let close = false;
    for (const t of VEG.treeAnchors) if (Math.hypot(t.x - x, t.z - z) < 0.55) { close = true; break; }
    if (close) continue;
    placeTree(x, z, 'shrub', 5000 + i * 13);
  }

  // ---- leaf instanced mesh -----------------------------------------
  const leafGeo = VEG.clumpTemplates[0];
  const leafMat = makeLeafMaterial();
  VEG.leafMats = [leafMat];
  const leafCount = Math.min(leafInst.length, LEAF_INST_CAP);
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;
  leafMesh.frustumCulled = false;
  leafMesh.name = 'leaves';
  VEG.group.add(leafMesh);
  VEG.leaf = leafMesh;

  const iTurn = new Float32Array(leafCount);
  const iTint = new Float32Array(leafCount);
  const iPhase = new Float32Array(leafCount);
  const iSpec = new Float32Array(leafCount);
  const iY = new Float32Array(leafCount);
  const iS = new Float32Array(leafCount);
  VEG.leafState = { x: new Float32Array(leafCount), y: new Float32Array(leafCount), z: new Float32Array(leafCount), s: new Float32Array(leafCount), turn: iTurn, phase: iPhase, spec: iSpec, tint: iTint, base: new Float32Array(leafCount), anim: new Float32Array(leafCount) };

  const dummy = new THREE.Object3D();
  for (let i = 0; i < leafCount; i++) {
    const it = leafInst[i];
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(it.phase * 0.2, it.yaw, it.phase * 0.15);
    dummy.scale.setScalar(it.s);
    dummy.updateMatrix();
    leafMesh.setMatrixAt(i, dummy.matrix);
    iTurn[i] = it.turn;
    iTint[i] = it.tint;
    iPhase[i] = it.phase;
    iSpec[i] = it.spec === 'pine' ? 1 : (it.spec === 'shrub' ? 2 : 0);
    iY[i] = it.y;
    iS[i] = it.s;
    const L = VEG.leafState;
    L.x[i] = it.x; L.y[i] = it.y; L.z[i] = it.z; L.s[i] = it.s; L.base[i] = it.s;
  }
  leafMesh.instanceMatrix.needsUpdate = true;
  leafGeo.setAttribute('aTurn', new THREE.InstancedBufferAttribute(iTurn, 1));
  leafGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(iTint, 1));
  leafGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(iPhase, 1));
  leafGeo.setAttribute('aSpec', new THREE.InstancedBufferAttribute(iSpec, 1));

  // ---- blossom instanced mesh (cherry) ------------------------------
  const blosCount = Math.min(blossomInst.length, 420);
  if (blosCount > 0) {
    const bGeo = cloneInstancedGeo(VEG.clumpTemplates[2]);
    const bMat = makeBlossomMaterial();
    VEG.blossomMat = bMat;
    const bMesh = new THREE.InstancedMesh(bGeo, bMat, blosCount);
    bMesh.castShadow = false;
    bMesh.receiveShadow = true;
    bMesh.frustumCulled = false;
    bMesh.name = 'blossom';
    VEG.group.add(bMesh);
    VEG.blossom = bMesh;
    const bTint = new Float32Array(blosCount), bPh = new Float32Array(blosCount);
    for (let i = 0; i < blosCount; i++) {
      const it = blossomInst[i];
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(it.phase * 0.3, it.yaw, it.phase * 0.2);
      dummy.scale.setScalar(it.s);
      dummy.updateMatrix();
      bMesh.setMatrixAt(i, dummy.matrix);
      bTint[i] = it.tint; bPh[i] = it.phase;
    }
    bMesh.instanceMatrix.needsUpdate = true;
    bGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(bTint, 1));
    bGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(bPh, 1));
  }

  // ---- trunks -------------------------------------------------------
  const trunkGeo = mergeChunks(trunkChunks);
  const trunkMesh = new THREE.Mesh(trunkGeo, MAT.wood);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  trunkMesh.name = 'trunks';
  VEG.group.add(trunkMesh);
  VEG.trunks = trunkMesh;

  // ---- grass tufts --------------------------------------------------
  buildGrass();

  // ---- flowers ------------------------------------------------------
  buildFlowers();

  // ---- hydrangeas ---------------------------------------------------
  buildHydrangeas();

  // ---- lotus pads ---------------------------------------------------
  buildLotus();

  // ---- snow layer ---------------------------------------------------
  collectSnowSites(snowSites);
  buildSnow();

  // shadow roles: leaves and trunks cast, everything small only receives
  VEG.leaf.castShadow = true; VEG.leaf.receiveShadow = true;
  VEG.trunks.castShadow = true; VEG.trunks.receiveShadow = true;
  if (VEG.blossom) { VEG.blossom.castShadow = false; VEG.blossom.receiveShadow = true; }
  VEG.grass.castShadow = false;
  VEG.hydrangea.castShadow = true;
  VEG.lotus.castShadow = false;
  VEG.snow.castShadow = false;
  for (const m of VEG.flowerGroup.children) m.castShadow = false;

  // assemble the lists the per-frame updater expects (never accessed before this)
  VEG.flowerMats = VEG.flowerGroup.children.map(m => m.material.userData.u);
  VEG.hydrangeaU = VEG.hydrangea.material.userData.u;
  VEG.lotusU = VEG.lotus.material.userData.u;
  VEG.blossomU = VEG.blossom ? VEG.blossom.material.userData.u : null;
  VEG.leafU = leafMat.userData.u;
  VEG.grassU = VEG.grass.material.userData.u;
  VEG.snowU = VEG.snow.material.userData.u;

  VEG.counts = {
    leaves: leafCount, blossom: blosCount, grass: VEG.counts.grass || 0,
    flowers: VEG.counts.flowers || 0, snow: VEG.counts.snow || 0,
    trees: VEG.treeAnchors.length
  };
}

/** deep-copy a geometry so each instanced mesh owns its own attributes */
function cloneInstancedGeo(g) {
  const c = g.clone();
  c.attributes = {};
  for (const k in g.attributes) c.setAttribute(k, g.attributes[k].clone());
  if (g.index) c.setIndex(g.index.clone());
  return c;
}

/* ------------------------------------------------------------------ */
/* 32.  Instanced-material factory: one shader hook, four flavours      */
/*                                                                    */
/*  Each material keeps its own uniform object at mat.userData.u so     */
/*  the season loop can drive flower, blossom and snow schedules        */
/*  independently while still sharing the global clock.                 */
/* ------------------------------------------------------------------ */

function makeLeafMaterial() {
  const u = vegUniforms({});
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0.0, flatShading: true, vertexColors: true });
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aTurn;
        attribute float aTint;
        attribute float aPhase;
        attribute float aSpec;
        uniform float uTime, uCanopy, uAutumnAmt, uTurnSpread, uWindAmp, uDaylight, uFrost, uLeafSize;
        uniform vec2 uWind;
        uniform vec3 uLeafA, uLeafB, uAutumn;
        varying float vTint;
        varying float vSpec;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        {
          // staggered autumn turn: outer, lower, earlier-turning clumps go first
          float piece = clamp(aTurn * 0.55 + aTint * 0.45, 0.0, 1.0);
          float turnAmt = clamp((uAutumnAmt * (1.0 + uTurnSpread * 1.5) - piece * uTurnSpread * 1.5) * 1.7, 0.0, 1.0);
          turnAmt = smoothstep(0.0, 1.0, turnAmt);
          vec3 base = mix(uLeafA, uLeafB, clamp(aTint * 0.7 + 0.15, 0.0, 1.0));
          vec3 col = mix(base, uAutumn, turnAmt);
          // evergreens only shift a little
          col = mix(col, base * 0.84, step(0.5, aSpec) * step(aSpec, 1.5) * 0.55);
          // winter dulls the remaining foliage
          col = mix(col, col * vec3(0.86, 0.88, 0.84), clamp(uFrost * 0.35, 0.0, 1.0));
          col *= 0.86 + 0.24 * uDaylight;
          vColor *= col * (0.88 + 0.24 * aTint);
          vTint = aTint;
          vSpec = aSpec;
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // canopy density and leaf size shrink each crown from within, so the
          // same persistent instances go from lush to bare without respawning
          float crown = uLeafSize * (0.45 + 0.55 * uCanopy);
          // evergreens keep their needles through the winter
          crown = mix(crown, max(crown, 0.62), step(0.5, aSpec) * step(aSpec, 1.5));
          transformed *= crown;
          float sway = sin(uTime * 0.9 + aPhase + transformed.x * 0.6 + transformed.z * 0.4) * 0.5
                     + sin(uTime * 1.7 + aPhase * 2.1) * 0.22;
          float amp = uWindAmp * 0.028 * (0.4 + aTint);
          transformed.x += sway * amp * uWind.x * max(transformed.y, 0.0) * 3.0;
          transformed.z += sway * amp * uWind.y * max(transformed.y, 0.0) * 3.0;
        }`);
  };
  m.customProgramCacheKey = () => 'leafV1';
  return m;
}

function makeBlossomMaterial() {
  const u = vegUniforms({});
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.0, flatShading: true, vertexColors: true });
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aTint;
        attribute float aPhase;
        uniform float uTime, uBlossom, uWindAmp, uDaylight;
        uniform vec2 uWind;
        uniform vec3 uBlossomCol;
        varying float vTint;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        {
          vec3 c = mix(uBlossomCol, uBlossomCol * vec3(1.06, 1.02, 1.0), aTint);
          c *= 0.88 + 0.20 * uDaylight;
          vColor *= c;
          vTint = aTint;
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float sway = sin(uTime * 1.2 + aPhase) * 0.5 + sin(uTime * 2.3 + aPhase * 1.7) * 0.25;
          float amp = uWindAmp * 0.03;
          transformed.x += sway * amp * uWind.x * max(transformed.y, 0.0) * 3.0;
          transformed.z += sway * amp * uWind.y * max(transformed.y, 0.0) * 3.0;
        }`);
  };
  m.customProgramCacheKey = () => 'blossomV1';
  return m;
}

function makeGrassMaterial() {
  const u = vegUniforms({});
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide, vertexColors: true });
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aBend;
        attribute float aPhase;
        attribute float aTint;
        uniform float uTime, uWindAmp, uGrassAmt, uDaylight;
        uniform vec2 uWind;
        uniform vec3 uGrassCol, uGrassTint2;
        varying float vBend;
        varying float vTint;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        {
          vec3 c = mix(uGrassTint2, uGrassCol, clamp(aBend * 0.7 + aTint * 0.3, 0.0, 1.0));
          c *= 0.85 + 0.25 * uDaylight;
          vColor *= c;
          vBend = aBend; vTint = aTint;
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float b = clamp(transformed.y, 0.0, 1.0);
          float gust = sin(uTime * 1.35 + aPhase + transformed.x * 1.2) * 0.55
                     + sin(uTime * 2.7 + aPhase * 1.7) * 0.25;
          float amp = uWindAmp * 0.11 * (0.5 + aTint * 0.8) * b * b;
          transformed.x += gust * amp * uWind.x;
          transformed.z += gust * amp * uWind.y;
          transformed.y *= uGrassAmt;
        }`);
  };
  m.customProgramCacheKey = () => 'grassV1';
  return m;
}

function makeFlowerMaterial(opts) {
  opts = opts || {};
  const u = vegUniforms({
    uFlowerCol: { value: (opts.color || C(0xf0e0a0)).clone() },
    uFlowerAmt: { value: 0 }
  });
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0, flatShading: true, vertexColors: true });
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aBloom;      // how early this species opens
        attribute float aTint;
        attribute float aPhase;
        attribute float aIsPetal;    // 1 on the flower head, 0 on the stem
        uniform float uTime, uFlowerAmt, uDaylight, uWindAmp, uFrost;
        uniform vec2 uWind;
        uniform vec3 uFlowerCol, uBlossomCol;
        varying float vVital;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        {
          float open = smoothstep(aBloom - 0.16, aBloom + 0.10, uFlowerAmt);
          vec3 stem = vec3(0.30, 0.44, 0.22);
          vec3 petal = uFlowerCol * (0.82 + 0.36 * aTint);
          vec3 c = mix(stem, petal, aIsPetal * open);
          c *= 0.86 + 0.24 * uDaylight;
          c = mix(c, c * 0.55 + vec3(0.30, 0.32, 0.34) * 0.5, uFrost * 0.28 * (1.0 - aIsPetal));
          vColor *= c;
          vVital = open;
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float open = smoothstep(aBloom - 0.16, aBloom + 0.10, uFlowerAmt);
          transformed *= mix(0.30, 1.0, open);
          transformed.y *= mix(0.35, 1.0, open);
          float gust = sin(uTime * 1.6 + aPhase) * 0.5 + sin(uTime * 3.1 + aPhase * 2.0) * 0.2;
          float amp = uWindAmp * 0.035 * max(transformed.y, 0.0);
          transformed.x += gust * amp * uWind.x;
          transformed.z += gust * amp * uWind.y;
        }`);
  };
  m.customProgramCacheKey = () => 'flower_' + (opts.key || 'species');
  return m;
}

function makeSnowMaterial() {
  const u = vegUniforms({});
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.0, flatShading: true, vertexColors: true });
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aWeight;
        attribute float aTint;
        uniform float uSnowAmt, uFrost, uDaylight, uTime;
        varying float vSnow;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        {
          vec3 c = mix(vec3(0.86, 0.89, 0.90), vec3(1.0, 1.0, 1.0), aTint);
          c *= 0.80 + 0.30 * uDaylight;
          vColor *= c;
          vSnow = aWeight;
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // the pile grows upward from its base and fades in slowly
          float grow = uSnowAmt * (0.45 + aWeight * 0.9) + uFrost * aWeight * 0.22;
          grow = smoothstep(0.03, 0.78, grow);
          if (grow < 0.02) {
            // fully collapsed: park the instance far outside the frustum
            transformed = vec3(0.0, -9999.0, 0.0);
          } else {
            transformed.y *= grow;
            transformed.xz *= grow;
          }
        }`);
  };
  m.customProgramCacheKey = () => 'snowV1';
  return m;
}