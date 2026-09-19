/* ------------------------------------------------------------------ */
/* 19.  Paths — one shared set of curves used for walking and for       */
/*      laying the gravel walkways, so feet always land on stone.       */
/* ------------------------------------------------------------------ */

const PATHS = {};
function buildPaths() {
  const gy = (x, z) => terrainHeight(x, z);

  // the winding garden walk: greenhouse -> plaza -> lake shore -> kiosk -> book-house
  const walkPts = [
    [-9.6, -7.4], [-7.4, -6.2], [-5.6, -4.6], [-4.2, -3.0], [-3.8, -1.4],
    [-3.2, 0.9], [-2.4, 2.9], [-1.2, 4.6], [0.8, 5.6], [3.0, 5.4],
    [4.9, 4.5], [6.0, 3.2], [6.2, 1.0], [6.5, -1.6], [6.9, -3.8], [7.3, -5.6]
  ];
  // side spur up to the gazebo
  const spurPts = [
    [-3.2, 0.9], [-5.6, 1.4], [-7.4, 2.1], [-8.7, 2.8], [-9.5, 3.2]
  ];
  // spur to the bridge
  const bridgePts = [
    [-2.4, 2.9], [-3.8, 3.7], [-5.0, 4.5], [-5.90, 5.05]
  ];

  const mk = (pts, closed) => new THREE.CatmullRomCurve3(
    pts.map(p => new THREE.Vector3(p[0], gy(p[0], p[1]), p[1])), closed, 'catmullrom', 0.5);

  PATHS.walk = mk(walkPts, false);
  PATHS.spur = mk(spurPts, false);
  PATHS.bridgeApproach = mk(bridgePts, false);
  PATHS.loop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.4, 0, 6.6), new THREE.Vector3(2.4, 0, 7.4),
    new THREE.Vector3(6.2, 0, 5.6), new THREE.Vector3(7.6, 0, 1.6),
    new THREE.Vector3(6.6, 0, -2.6), new THREE.Vector3(2.6, 0, -5.2),
    new THREE.Vector3(-2.2, 0, -4.8), new THREE.Vector3(-5.6, 0, -1.6),
    new THREE.Vector3(-6.4, 0, 3.0)
  ], true, 'catmullrom', 0.5);
  // the painter's short round, tightly around the plaza
  PATHS.plaza = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.6, 0, -3.4), new THREE.Vector3(-3.0, 0, -4.2),
    new THREE.Vector3(-2.6, 0, -1.4), new THREE.Vector3(-5.0, 0, -0.2)
  ], true, 'catmullrom', 0.5);

  // the boat's lane: dock -> a slow circuit of the open water -> back again
  PATHS.boatLane = new THREE.CatmullRomCurve3([
    new THREE.Vector3(5.15, 0, 1.45), new THREE.Vector3(4.4, 0, -0.2),
    new THREE.Vector3(4.2, 0, -2.0), new THREE.Vector3(2.6, 0, -3.6),
    new THREE.Vector3(0.6, 0, -4.3), new THREE.Vector3(-0.4, 0, -2.4),
    new THREE.Vector3(0.6, 0, -0.2), new THREE.Vector3(2.8, 0, 0.6),
    new THREE.Vector3(4.4, 0, 1.5)
  ], true, 'catmullrom', 0.5);
  PATHS.boatLane.closed = true;

  // island circuit
  PATHS.island = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.42, 0, 1.86), new THREE.Vector3(-1.7, 0, 1.95),
    new THREE.Vector3(-1.1, 0, 1.5), new THREE.Vector3(-1.2, 0, 0.7),
    new THREE.Vector3(-2.0, 0, 0.5), new THREE.Vector3(-2.5, 0, 1.1)
  ], true, 'catmullrom', 0.5);
}

/* ------------------------------------------------------------------ */
/* 20.  Walkways: flat stone slabs laid along the paths                 */
/* ------------------------------------------------------------------ */

function buildWalkways() {
  const chunks = [];
  const slab = new THREE.BoxGeometry(1, 1, 1);
  const stones = [
    C(0xcfc7b6), C(0xc4bcab), C(0xdad3c2), C(0xb9b2a2), C(0xd2c9b8)
  ];
  const mortar = C(0xa89f8e);

  const layPath = (curve, width, step, seedBase, closeLoop) => {
    const total = curve.getLength();
    const count = Math.max(4, Math.round(total / step));
    for (let i = 0; i < count; i++) {
      const t = closeLoop ? i / count : i / (count - 1);
      const p = curve.getPointAt(clamp(t, 0, 1));
      const tan = curve.getTangentAt(clamp(t, 0, 1));
      const yaw = Math.atan2(tan.x, tan.z);
      const jitter = hash1(seedBase + i * 3.1);
      const w = width * (0.82 + jitter * 0.34);
      const d = width * 0.66;
      const yy = terrainHeight(p.x, p.z);
      const rot = (jitter - 0.5) * 0.22;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(p.x, yy + 0.035, p.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + rot),
        new THREE.Vector3(w, 0.10, d));
      chunks.push({ geo: slab, matrix: m, color: stones[(i + (seedBase | 0)) % stones.length] });
      // occasional edge pebbles
      if (jitter > 0.72) {
        const sx = -tan.z, sz = tan.x;
        const side = jitter > 0.86 ? 1 : -1;
        const off = width * 0.62;
        const px = p.x + sx * off * side, pz = p.z + sz * off * side;
        const m2 = new THREE.Matrix4().compose(
          new THREE.Vector3(px, terrainHeight(px, pz) + 0.04, pz),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + 0.4),
          new THREE.Vector3(0.14, 0.09, 0.14));
        chunks.push({ geo: slab, matrix: m2, color: mortar.clone().lerp(stones[i % 5], 0.4) });
      }
    }
  };

  layPath(PATHS.walk, 0.58, 0.40, 11, false);
  layPath(PATHS.spur, 0.50, 0.42, 37, false);
  layPath(PATHS.bridgeApproach, 0.48, 0.42, 59, false);
  layPath(PATHS.island, 0.36, 0.38, 83, true);

  // a small paved forecourt in front of each building
  const forecourt = (x, z, w, d, seed, yaw) => {
    const n = Math.max(2, Math.round(w / 0.5)), m = Math.max(2, Math.round(d / 0.5));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const px = x + (i - (n - 1) / 2) * 0.48;
        const pz = z + (j - (m - 1) / 2) * 0.48;
        const h = hash2(seed + i, j);
        const mm = new THREE.Matrix4().compose(
          new THREE.Vector3(px, terrainHeight(px, pz) + 0.03, pz),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (yaw || 0) + (h - 0.5) * 0.2),
          new THREE.Vector3(0.46, 0.09, 0.46));
        chunks.push({ geo: slab, matrix: mm, color: stones[(i * 3 + j) % 5] });
      }
    }
  };
  forecourt(POI.greenhouse.x + 0.9, POI.greenhouse.z + 2.3, 2.6, 1.4, 5);
  forecourt(POI.bookhouse.x - 0.6, POI.bookhouse.z + 2.1, 2.0, 1.4, 21);
  forecourt(POI.kiosk.x, POI.kiosk.z + 1.6, 1.9, 1.2, 44);

  const geo = mergeChunks(chunks);
  const mesh = new THREE.Mesh(geo, MAT.stone);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = 'walkways';
  scene.add(mesh);
  return mesh;
}

/* ------------------------------------------------------------------ */
/* 21.  The oak desk, the tray rim and the desk-top props               */
/* ------------------------------------------------------------------ */

function buildDesk() {
  const H = WORLD.half;
  const deskY = WORLD.trayBottom - 0.34;
  const grp = new THREE.Group();
  grp.name = 'desk';

  // --- desk top -------------------------------------------------------
  const topChunks = [];
  const board = new THREE.BoxGeometry(1, 1, 1);
  const plankW = 0.62, deskSize = H * 2 + 4.6;
  const planks = Math.ceil(deskSize / plankW);
  for (let i = 0; i < planks; i++) {
    const z = -deskSize / 2 + plankW * (i + 0.5);
    const tint = 0.86 + hash1(i * 5.7) * 0.22;
    const col = PAL.oakLight.clone().multiplyScalar(tint);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(0, deskY - 0.12, z),
      new THREE.Quaternion(),
      new THREE.Vector3(deskSize, 0.24, plankW * 0.985));
    topChunks.push({ geo: board, matrix: m, color: col });
    // a groove line between planks
    const g = new THREE.Matrix4().compose(
      new THREE.Vector3(0, deskY - 0.005, z + plankW * 0.5),
      new THREE.Quaternion(),
      new THREE.Vector3(deskSize, 0.012, 0.026));
    topChunks.push({ geo: board, matrix: g, color: PAL.oakDark.clone().multiplyScalar(0.8) });
  }
  // desk frame underneath
  topChunks.push({ geo: board, matrix: new THREE.Matrix4().compose(new THREE.Vector3(0, deskY - 0.30, 0), new THREE.Quaternion(), new THREE.Vector3(deskSize * 0.98, 0.14, deskSize * 0.98)), color: PAL.oakMid.clone().multiplyScalar(0.72) });
  const deskGeo = mergeChunks(topChunks);
  const desk = new THREE.Mesh(deskGeo, MAT.oak);
  desk.receiveShadow = true;
  desk.castShadow = false;
  grp.add(desk);

  // --- the sand tray ------------------------------------------------
  const rim = [];
  const t = 0.30, hgt = Math.abs(WORLD.trayTop - WORLD.trayBottom) + 0.30;
  const midY = (WORLD.trayTop + WORLD.trayBottom) / 2 - 0.05;
  const sides = [
    { x: 0, z: -H - t / 2, sx: H * 2 + t * 2, sz: t },
    { x: 0, z: H + t / 2, sx: H * 2 + t * 2, sz: t },
    { x: -H - t / 2, z: 0, sx: t, sz: H * 2 },
    { x: H + t / 2, z: 0, sx: t, sz: H * 2 }
  ];
  for (const s of sides) {
    rim.push({ geo: board, matrix: new THREE.Matrix4().compose(new THREE.Vector3(s.x, midY, s.z), new THREE.Quaternion(), new THREE.Vector3(s.sx, hgt, s.sz)), color: PAL.oakMid });
  }
  // a darker inlay lip just inside the rim
  for (const s of sides) {
    const inx = s.x * (1 - t / (H * 2 + t * 2) * 0);
    rim.push({
      geo: board,
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(s.x * (1 - 0.02), WORLD.trayTop + 0.06, s.z * (1 - 0.02)),
        new THREE.Quaternion(),
        new THREE.Vector3(s.sx * 0.995, 0.09, s.sz * 1.15)),
      color: PAL.oakDark.clone().multiplyScalar(0.9)
    });
  }
  const rimMesh = new THREE.Mesh(mergeChunks(rim), MAT.oak);
  rimMesh.castShadow = true;
  rimMesh.receiveShadow = true;
  grp.add(rimMesh);

  // --- desk legs ------------------------------------------------------
  const legChunks = [];
  const legOff = deskSize / 2 - 0.9;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      legChunks.push({
        geo: board,
        matrix: new THREE.Matrix4().compose(
          new THREE.Vector3(sx * legOff, deskY - 2.4, sz * legOff),
          new THREE.Quaternion(),
          new THREE.Vector3(0.42, 4.4, 0.42)),
        color: PAL.oakMid.clone().multiplyScalar(0.8)
      });
    }
  }
  const legs = new THREE.Mesh(mergeChunks(legChunks), MAT.oak);
  legs.castShadow = false;
  grp.add(legs);

  scene.add(grp);
  return { group: grp, deskY: deskY, deskSize: deskSize };
}

/** builds a flat item lying on the desk surface */
function deskQuad(w, d, x, z, yaw, color, mat, y, tilt) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-PI / 2 + (tilt || 0));
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  m.castShadow = false;
  m.receiveShadow = true;
  if (mat.vertexColors) {
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* 21b.  Snow caps: everything that quietly collects snow in winter     */
/* ------------------------------------------------------------------ */

const SNOWCAPS = [];
function addSnowCap(x, y, z, sx, sz, yaw, weight) {
  SNOWCAPS.push({ x: x, y: y, z: z, sx: sx, sz: sz, yaw: yaw || 0, w: weight === undefined ? 1 : weight });
}

/* ------------------------------------------------------------------ */
/* 22.  Buildings                                                       */
/* ------------------------------------------------------------------ */

const BUILDINGS = { group: new THREE.Group() };
BUILDINGS.group.name = 'buildings';

function groundY(x, z) { return terrainHeight(x, z); }

/* ---- glass greenhouse --------------------------------------------- */
function buildGreenhouse() {
  const x = POI.greenhouse.x, z = POI.greenhouse.z;
  const y = groundY(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const frame = new VoxBatch(BOUNDS);
  const glass = new VoxBatch(BOUNDS);
  const W = 1.85, D = 1.35, H = 1.15, RH = 0.72;      // half-extents + wall height

  // stone footing
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const px = i * W / 2.2, pz = j * D / 2.2;
      if (Math.abs(i) === 2 && Math.abs(j) === 2) continue;
      frame.add(W / 2.1, 0.16, D / 2.1, px, 0.05, pz, PAL.stone);
    }
  }
  frame.add(W * 2 + 0.18, 0.10, D * 2 + 0.18, 0, 0.16, 0, PAL.stoneDark);

  // corner posts and rails
  const px = [-W, W], pz = [-D, D];
  for (const a of px) for (const b of pz) frame.add(0.09, H, 0.09, a, 0.21 + H / 2, b, PAL.plaster);
  for (const a of px) {
    frame.add(0.08, 0.07, D * 2, a, 0.21 + H - 0.02, 0, PAL.plaster);
    frame.add(0.08, 0.07, D * 2, a, 0.21 + 0.38, 0, PAL.plaster);
  }
  for (const b of pz) {
    frame.add(W * 2, 0.07, 0.08, 0, 0.21 + H - 0.02, b, PAL.plaster);
    frame.add(W * 2, 0.07, 0.08, 0, 0.21 + 0.02, b, PAL.plaster);
  }
  // gable + ridge
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const w = W * 2 * (1 - t) + 0.16;
    frame.add(w, 0.07, 0.07, 0, 0.21 + H + t * RH, D, PAL.plaster);
    frame.add(w, 0.07, 0.07, 0, 0.21 + H + t * RH, -D, PAL.plaster);
  }
  frame.add(0.09, 0.07, D * 2, 0, 0.21 + H + RH, 0, PAL.plaster);
  // glazing bars
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const gx = i * W / 3.4;
    frame.add(0.05, H, 0.05, gx, 0.21 + H / 2, D, PAL.plaster);
    frame.add(0.05, H, 0.05, gx, 0.21 + H / 2, -D, PAL.plaster);
  }
  // glass panels
  const gcol = PAL.glass;
  for (const b of pz) {
    glass.add(W * 2, H - 0.06, 0.035, 0, 0.21 + H / 2, b, gcol);
    // gable glass
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      glass.add(W * 2 * (1 - t) * 0.97, RH / steps * 1.02, 0.03, 0, 0.21 + H + (t + 0.5 / steps) * RH, b, gcol);
    }
  }
  for (const a of px) glass.add(0.035, H - 0.06, D * 2, a, 0.21 + H / 2, 0, gcol);
  // roof glass
  const slope = Math.atan2(RH, W);
  glass.add(Math.hypot(W, RH) * 1.0, 0.03, D * 2, -W / 2, 0.21 + H + RH / 2, 0, gcol, 0);
  glass.add(Math.hypot(W, RH) * 1.0, 0.03, D * 2, W / 2, 0.21 + H + RH / 2, 0, gcol, 0);

  // door frame
  frame.add(0.055, 0.62, 0.055, -0.22, 0.21 + 0.31, D + 0.01, PAL.woodDark);
  frame.add(0.055, 0.62, 0.055, 0.22, 0.21 + 0.31, D + 0.01, PAL.woodDark);
  frame.add(0.52, 0.06, 0.055, 0, 0.21 + 0.62, D + 0.01, PAL.woodDark);

  const fm = new THREE.Mesh(frame.build(), MAT.paint);
  fm.castShadow = true; fm.receiveShadow = true;
  g.add(fm);
  const gm = new THREE.Mesh(glass.build(), MAT.glass);
  gm.castShadow = false; gm.receiveShadow = false; gm.renderOrder = 3;
  g.add(gm);

  // planting benches inside
  const bench = new VoxBatch(BOUNDS);
  for (const b of [-0.5, 0.5]) {
    bench.add(W * 1.6, 0.06, 0.34, 0, 0.62, b * D, PAL.wood);
    bench.add(0.06, 0.30, 0.06, -W * 0.7, 0.45, b * D, PAL.woodDark);
    bench.add(0.06, 0.30, 0.06, W * 0.7, 0.45, b * D, PAL.woodDark);
  }
  const bm = new THREE.Mesh(bench.build(), MAT.wood);
  bm.castShadow = false; bm.receiveShadow = true;
  g.add(bm);

  // warm lamp inside
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0b0 }));
  lamp.position.set(0, 0.21 + H - 0.18, 0);
  g.add(lamp);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), makeGlowMaterial(1.0, 0xffd9a0));
  halo.position.copy(lamp.position);
  halo.renderOrder = 8;
  g.add(halo);
  BUILDINGS.haloGreenhouse = halo;
  BUILDINGS.lampGreenhouse = lamp;

  // a warm point light so the greenhouse really warms its corner after dark
  const warmLight = new THREE.PointLight(0xffc98a, 0, 5.4, 2.0);
  warmLight.position.set(0, 0.21 + H - 0.15, 0);
  g.add(warmLight);
  BUILDINGS.lampWarmLight = warmLight;

  BUILDINGS.group.add(g);

  // snow ledges
  addSnowCap(x, y + 0.21 + H + RH + 0.02, z, W * 1.5, D * 1.5, 0, 1);
  addSnowCap(x, y + 0.21 + H - 0.03, z + D, W * 1.9, 0.16, 0, 0.7);
  addSnowCap(x, y + 0.21 + H - 0.03, z - D, W * 1.9, 0.16, 0, 0.7);
  return g;
}

/* ---- wooden book-house (书屋) -------------------------------------- */
function buildBookhouse() {
  const x = POI.bookhouse.x, z = POI.bookhouse.z;
  const y = groundY(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const b = new VoxBatch(BOUNDS);
  const bd = new VoxBatch(BOUNDS);
  const W = 1.05, D = 0.85, H = 1.05;

  // plinth
  b.add(W * 2 + 0.34, 0.18, D * 2 + 0.34, 0, 0.09, 0, PAL.stone);
  // floor
  bd.add(W * 2, 0.09, D * 2, 0, 0.22, 0, PAL.wood);
  // walls: log courses
  const courses = 7;
  for (let i = 0; i < courses; i++) {
    const yy = 0.27 + i * (H / courses);
    const tint = 0.92 + hash1(i * 4.1) * 0.14;
    const col = PAL.wood.clone().multiplyScalar(tint);
    b.add(W * 2, H / courses * 0.86, 0.14, 0, yy + H / courses / 2, -D, col);
    b.add(0.14, H / courses * 0.86, D * 2, -W, yy + H / courses / 2, 0, col);
    b.add(0.14, H / courses * 0.86, D * 2, W, yy + H / courses / 2, 0, col);
    // front wall with a gap for the door
    b.add(W * 1.2, H / courses * 0.86, 0.14, -W * 0.4, yy + H / courses / 2, D, col);
    b.add(W * 0.42, H / courses * 0.86, 0.14, W * 0.72, yy + H / courses / 2, D, col);
  }
  // door and window openings
  b.add(0.10, 0.72, 0.10, -W * 0.62, 0.27 + 0.36, D + 0.02, PAL.woodDark);
  b.add(0.10, 0.72, 0.10, -W * 0.02, 0.27 + 0.36, D + 0.02, PAL.woodDark);
  b.add(0.70, 0.09, 0.10, -W * 0.32, 0.27 + 0.74, D + 0.02, PAL.woodDark);
  bd.add(0.62, 0.66, 0.05, -W * 0.32, 0.27 + 0.34, D - 0.03, PAL.woodDark.clone().multiplyScalar(0.6));
  // window on the right wall
  bd.add(0.03, 0.30, 0.34, W + 0.07, 0.27 + H * 0.62, 0.05, C(0xffd79a));

  // gable roof
  const RH = 0.52, over = 0.20;
  const slopeLen = Math.hypot(W + over, RH) * 0.62;
  for (const s of [-1, 1]) {
    b.add(slopeLen * 2 * 0.98, 0.10, D * 2 + over * 2, s * (W + over) * 0.5, 0.27 + H + RH * 0.5, 0, PAL.roof);
  }
  // ridge
  b.add(0.16, 0.14, D * 2 + over * 2, 0, 0.27 + H + RH + 0.04, 0, PAL.roofMoss);
  // gable triangles
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    b.add((W * 2 + 0.1) * (1 - t), RH / 5 * 1.02, 0.10, 0, 0.27 + H + (t + 0.5 / 5) * RH, -D - 0.02, PAL.plaster);
  }
  // chimney
  b.add(0.26, 0.62, 0.26, -W * 0.55, 0.27 + H + RH * 0.5, -D * 0.5, PAL.stoneDark);
  b.add(0.34, 0.09, 0.34, -W * 0.55, 0.27 + H + RH * 0.5 + 0.35, -D * 0.5, PAL.stone);

  // step and a little sign
  b.add(0.80, 0.10, 0.30, -W * 0.32, 0.22, D + 0.2, PAL.stone);
  b.add(0.06, 0.40, 0.06, W * 0.9, 0.27 + H * 0.5, D + 0.32, PAL.woodDark);
  b.add(0.46, 0.20, 0.05, W * 0.9, 0.27 + H * 0.78, D + 0.32, C(0xe8d7b4));

  const bm = new THREE.Mesh(b.build(), MAT.paint);
  bm.castShadow = true; bm.receiveShadow = true;
  g.add(bm);
  const dm = new THREE.Mesh(bd.build(), MAT.paint);
  dm.castShadow = false; dm.receiveShadow = false;
  g.add(dm);

  // warm window glow
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.36), makeGlowMaterial(1.0, 0xffd0a0));
  win.position.set(W + 0.09, 0.27 + H * 0.62, 0.05);
  win.rotation.y = 0.02;
  win.renderOrder = 8;
  g.add(win);
  const win2 = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.38), makeGlowMaterial(1.0, 0xffd0a0));
  win2.position.set(-W * 0.32, 0.27 + 0.34, D + 0.10);
  win2.renderOrder = 8;
  g.add(win2);
  BUILDINGS.haloBook = [win, win2];
  const warmLight = new THREE.PointLight(0xffc07a, 0, 4.6, 2.0);
  warmLight.position.set(W + 0.35, 0.27 + H * 0.62, 0.05);
  g.add(warmLight);
  BUILDINGS.lampBookLight = warmLight;

  BUILDINGS.group.add(g);
  addSnowCap(x, y + 0.27 + H + RH + 0.06, z, W * 1.35, D * 1.35, 0, 1);
  addSnowCap(x, y + 0.27 + H + 0.10, z - D - 0.15, W * 1.5, 0.2, 0, 0.55);
  return g;
}

/* ---- little coffee kiosk ------------------------------------------ */
function buildKiosk() {
  const x = POI.kiosk.x, z = POI.kiosk.z;
  const y = groundY(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const b = new VoxBatch(BOUNDS);
  const H = 1.0, W = 0.9, D = 0.62;
  b.add(W * 2 + 0.2, 0.10, D * 2 + 0.2, 0, 0.05, 0, PAL.stone);
  // counter body
  b.add(W * 2, H, D * 2, 0, 0.10 + H / 2, 0, PAL.plaster);
  b.add(W * 2 + 0.16, 0.09, D * 2 + 0.16, 0, 0.10 + H, 0, PAL.woodDark);
  // panelled front
  for (let i = -1; i <= 1; i++) b.add(0.42, 0.5, 0.05, i * 0.5, 0.10 + H * 0.48, D + 0.01, PAL.wood);
  // posts
  for (const a of [-W, W]) for (const c of [-D, D]) b.add(0.08, 1.55, 0.08, a, 0.10 + H + 0.55, c, PAL.wood);
  // striped awning
  const stripe = C(0xf2ede0), stripe2 = C(0xc9705c);
  for (let i = 0; i < 9; i++) {
    const t = (i / 8 - 0.5) * 2;
    b.add(W * 2 / 8.6, 0.06, D * 2.3, t * W * 0.94, 0.10 + H + 1.12, 0.06, i % 2 ? stripe2 : stripe);
  }
  b.add(W * 2 + 0.16, 0.10, D * 2 + 0.16, 0, 0.10 + H + 1.22, 0, PAL.woodDark);

  // espresso machine
  b.add(0.44, 0.30, 0.30, -0.30, 0.10 + H + 0.16, 0, C(0xb9bcc0));
  b.add(0.10, 0.12, 0.10, -0.30, 0.10 + H + 0.03, 0.18, C(0x6d6f72));
  // cups and a little vase on the counter
  b.add(0.09, 0.09, 0.09, 0.34, 0.10 + H + 0.09, 0.06, C(0xf6f2ea));
  b.add(0.09, 0.09, 0.09, 0.52, 0.10 + H + 0.09, -0.10, C(0xf6f2ea));
  b.add(0.11, 0.20, 0.11, 0.72, 0.10 + H + 0.14, 0.10, C(0xa8c8c0));

  // menu board
  b.add(0.58, 0.42, 0.05, 0, 0.10 + H + 0.72, D + 0.10, C(0x4d4033));
  for (let i = 0; i < 4; i++) b.add(0.36 - i * 0.06, 0.026, 0.02, -0.04, 0.10 + H + 0.86 - i * 0.09, D + 0.13, C(0xf0e6d2));

  const bm = new THREE.Mesh(b.build(), MAT.paint);
  bm.castShadow = true; bm.receiveShadow = true;
  g.add(bm);

  // stools
  const st = new VoxBatch(BOUNDS);
  for (const sx of [-0.55, 0.0, 0.55]) {
    st.add(0.28, 0.05, 0.28, sx, 0.46, D + 0.55, PAL.wood);
    for (const a of [-0.1, 0.1]) for (const c of [-0.1, 0.1])
      st.add(0.04, 0.45, 0.04, sx + a, 0.22, D + 0.55 + c, PAL.woodDark);
  }
  // hanging lantern under the awning
  st.add(0.14, 0.18, 0.14, -0.55, 0.10 + H + 0.92, 0.1, C(0xffdca8));
  const sm = new THREE.Mesh(st.build(), MAT.paint);
  sm.castShadow = true; sm.receiveShadow = true;
  g.add(sm);

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.0), makeGlowMaterial(1.0, 0xffca86));
  glow.position.set(-0.55, 0.10 + H + 0.92, 0.1);
  glow.renderOrder = 8;
  g.add(glow);
  BUILDINGS.haloKiosk = glow;
  const warmLight = new THREE.PointLight(0xffc07a, 0, 4.2, 2.0);
  warmLight.position.set(-0.55, 0.10 + H + 0.80, 0.1);
  g.add(warmLight);
  BUILDINGS.lampKioskLight = warmLight;

  BUILDINGS.group.add(g);
  addSnowCap(x, y + 0.10 + H + 1.27, z, W * 1.15, D * 1.2, 0, 1);
  return g;
}

/* ---- lakeside gazebo ---------------------------------------------- */
function buildGazebo() {
  const x = POI.gazebo.x, z = POI.gazebo.z;
  const y = groundY(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const b = new VoxBatch(BOUNDS);
  const R = 1.15, H = 1.30;
  // octagonal deck
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    b.add(0.52, 0.10, 0.30, Math.cos(a) * R * 0.86, 0.06, Math.sin(a) * R * 0.86, PAL.wood, -a);
  }
  b.add(R * 1.9, 0.08, R * 1.9, 0, 0.0, 0, PAL.stoneDark);
  // posts
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + PI / 8;
    b.add(0.09, H, 0.09, Math.cos(a) * R, 0.11 + H / 2, Math.sin(a) * R, PAL.wood);
  }
  // railing + bench inside
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    if (i === 2) continue;
    b.add(0.46, 0.06, 0.06, Math.cos(a) * R * 0.96, 0.60, Math.sin(a) * R * 0.96, PAL.wood, -a);
  }
  b.add(0.9, 0.07, 0.30, 0, 0.42, -0.5, PAL.wood);
  b.add(0.9, 0.07, 0.30, 0, 0.42, 0.5, PAL.wood);
  // roof: two stacked octagonal tiers
  const r1 = coneGeo(R * 1.28, 0.34, 8, false, 0.02);
  const rm = new THREE.Mesh(r1, MAT.paint);
  const rc = new Float32Array(r1.attributes.position.count * 3);
  for (let i = 0; i < r1.attributes.position.count; i++) { rc[i * 3] = PAL.roof.r; rc[i * 3 + 1] = PAL.roof.g; rc[i * 3 + 2] = PAL.roof.b; }
  r1.setAttribute('color', new THREE.BufferAttribute(rc, 3));
  rm.position.set(0, 0.11 + H + 0.17, 0);
  rm.castShadow = true;
  g.add(rm);
  b.add(0.18, 0.22, 0.18, 0, 0.11 + H + 0.42, 0, PAL.roofMoss);

  const bm = new THREE.Mesh(b.build(), MAT.paint);
  bm.castShadow = true; bm.receiveShadow = true;
  g.add(bm);
  BUILDINGS.group.add(g);
  addSnowCap(x, y + 0.11 + H + 0.34, z, R * 1.15, R * 1.15, 0, 1);
  return g;
}

/* ---- dock ---------------------------------------------------------- */
function buildDock() {
  const x = POI.dock.x, z = POI.dock.z;
  const b = new VoxBatch(BOUNDS);
  const dirx = 0.62, dirz = 0.78;
  const len = 2.3;
  const shoreY = groundY(x, z);
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const px = x + dirx * t * len, pz = z + dirz * t * len;
    const yy = lerp(shoreY + 0.06, WORLD.waterY + 0.22, smootherstep(0, 1, t));
    b.add(1.10, 0.08, 0.24, px, yy, pz, PAL.wood, Math.atan2(dirx, dirz));
  }
  // support posts down into the water
  for (let i = 2; i < 12; i += 3) {
    const t = i / 11;
    const px = x + dirx * t * len, pz = z + dirz * t * len;
    const yy = lerp(shoreY + 0.06, WORLD.waterY + 0.22, smootherstep(0, 1, t));
    for (const s of [-1, 1]) {
      const ox = -dirz * s * 0.44, oz = dirx * s * 0.44;
      b.add(0.13, Math.max(0.4, yy - WORLD.waterY + 0.9), 0.13, px + ox, yy - 0.5, pz + oz, PAL.woodDark);
    }
  }
  const m = new THREE.Mesh(b.build(), MAT.wood);
  m.castShadow = true; m.receiveShadow = true;
  BUILDINGS.group.add(m);
  addSnowCap(x + dirx * len * 0.4, shoreY + 0.14, z + dirz * len * 0.4, 0.9, 0.4, Math.atan2(dirx, dirz), 1);
  return m;
}

/* ---- arched wooden bridge ----------------------------------------- */
function buildBridge() {
  const A = BRIDGE_A, B = BRIDGE_B;
  const g = new THREE.Group();
  const b = new VoxBatch(BOUNDS);
  const N = 16;
  const ax = A.x, az = A.y, bx = B.x, bz = B.y;
  const yaw = Math.atan2(bx - ax, bz - az);
  const arc = (t) => Math.sin(t * PI) * 0.42;
  const deckY0 = 0.30;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const px = lerp(ax, bx, t), pz = lerp(az, bz, t);
    const yy = lerp(terrainHeight(ax, az), terrainHeight(bx, bz), t) + deckY0 + arc(t);
    b.add(1.05, 0.10, 0.30, px, yy, pz, PAL.wood, yaw + (hash1(i * 2.7) - 0.5) * 0.03);
    // railings
    for (const s of [-1, 1]) {
      const ox = Math.cos(yaw) * s * 0.50, oz = -Math.sin(yaw) * s * 0.50;
      b.add(0.08, 0.42, 0.08, px + ox, yy + 0.24, pz + oz, PAL.woodDark);
    }
  }
  // hand rails on top
  for (const s of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const p0 = new THREE.Vector3(lerp(ax, bx, t0), 0, lerp(az, bz, t0));
      const p1 = new THREE.Vector3(lerp(ax, bx, t1), 0, lerp(az, bz, t1));
      const y0 = lerp(terrainHeight(ax, az), terrainHeight(bx, bz), t0) + deckY0 + arc(t0) + 0.44;
      const y1 = lerp(terrainHeight(ax, az), terrainHeight(bx, bz), t1) + deckY0 + arc(t1) + 0.44;
      const mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2;
      const ox = Math.cos(yaw) * s * 0.50, oz = -Math.sin(yaw) * s * 0.50;
      const dx = p1.x - p0.x, dz = p1.z - p0.z, dy = y1 - y0;
      const len = Math.hypot(dx, dy, dz);
      const yaw2 = Math.atan2(dx, dz);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw2, 0, 'YXZ'));
      b.add(0.07, len, 0.07, mx + ox, (y0 + y1) / 2, mz + oz, PAL.woodDark, 0);
      void q;
    }
  }
  const m = new THREE.Mesh(b.build(), MAT.wood);
  m.castShadow = true; m.receiveShadow = true;
  BUILDINGS.group.add(m);
  addSnowCap(lerp(ax, bx, 0.5), terrainHeight(lerp(ax, bx, 0.5), lerp(az, bz, 0.5)) + 0.78, lerp(az, bz, 0.5), 0.9, 0.34, yaw, 1);
  return m;
}

/* ---- lake island: stone lantern + bench ---------------------------- */
function buildIsland() {
  const x = WORLD.island.x, z = WORLD.island.z;
  const b = new VoxBatch(BOUNDS);
  // stone lantern
  const lx = x + 0.55, lz = z - 0.42;
  const ly = groundY(lx, lz);
  b.add(0.22, 0.09, 0.22, lx, ly + 0.05, lz, PAL.stoneDark);
  b.add(0.12, 0.30, 0.12, lx, ly + 0.24, lz, PAL.stone);
  b.add(0.28, 0.08, 0.28, lx, ly + 0.42, lz, PAL.stone);
  b.add(0.19, 0.17, 0.19, lx, ly + 0.55, lz, C(0xf0e2c4));
  b.add(0.30, 0.08, 0.30, lx, ly + 0.67, lz, PAL.stoneDark);
  b.add(0.09, 0.09, 0.09, lx, ly + 0.75, lz, PAL.stone);
  // small bench
  const bx = x - 0.42, bz = z + 0.48;
  const by = groundY(bx, bz);
  b.add(0.60, 0.05, 0.20, bx, by + 0.26, bz, PAL.wood, 0.55);
  b.add(0.05, 0.24, 0.05, bx - 0.24, by + 0.14, bz + 0.07, PAL.woodDark);
  b.add(0.05, 0.24, 0.05, bx + 0.24, by + 0.14, bz - 0.07, PAL.woodDark);
  const m = new THREE.Mesh(b.build(), MAT.stone);
  m.castShadow = true; m.receiveShadow = true;
  BUILDINGS.group.add(m);
  addSnowCap(lx, ly + 0.72, lz, 0.26, 0.26, 0, 1);
  return m;
}