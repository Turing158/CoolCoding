/* ------------------------------------------------------------------ */
/* 33.  Grass tufts — instanced, bent by wind and squashed by snow      */
/* ------------------------------------------------------------------ */

function buildGrass() {
  // a blade tuft: three crossed tapered blades merged into one template
  const chunks = [];
  const rnd = rng(31337);
  for (let b = 0; b < 4; b++) {
    const a = (b / 4) * TAU + rnd() * 0.5;
    const h = 0.16 + rnd() * 0.16;
    const w = 0.032 + rnd() * 0.022;
    const g = new THREE.BoxGeometry(w, h, w * 0.55);
    const lean = (rnd() - 0.5) * 0.35;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * 0.035, h / 2, Math.sin(a) * 0.035),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(lean * Math.sin(a), a, lean * Math.cos(a))),
      new THREE.Vector3(1, 1, 1));
    const v = 0.8 + rnd() * 0.4;
    chunks.push({ geo: g, matrix: m, color: new THREE.Color(v, v, v) });
    // a small seed head on the taller blades
    if (b === 0) {
      const g2 = new THREE.BoxGeometry(w * 1.5, h * 0.30, w * 0.8);
      const m2 = new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(a) * 0.05, h * 0.94, Math.sin(a) * 0.05),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, a, lean)),
        new THREE.Vector3(1, 1, 1));
      const v2 = 1.05 + rnd() * 0.3;
      chunks.push({ geo: g2, matrix: m2, color: new THREE.Color(v2, v2 * 0.96, v2 * 0.8) });
    }
  }
  const tuft = mergeChunks(chunks);

  const sites = [];
  const rnd2 = rng(9031);
  const target = GRASS_CAP;
  let tries = 0;
  while (sites.length < target && tries < target * 26) {
    tries++;
    const x = (rnd2() * 2 - 1) * (WORLD.half - 0.35);
    const z = (rnd2() * 2 - 1) * (WORLD.half - 0.35);
    const h = terrainHeight(x, z);
    if (h < WORLD.waterY + 0.14) continue;
    // meadow density: lush on the flats, sparse on the slopes
    const slope = slopeAt(x, z);
    const lush = fbm(x * 0.30 + 5.5, z * 0.30 + 9.1, 3);
    const keep = (1 - smoothstep(0.55, 1.5, slope)) * (0.32 + lush * 0.95);
    if (rnd2() > keep) continue;
    if (distToPath(x, z) < 0.52) continue;
    let blocked = false;
    for (const c of MASK.circles) {
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < c.r * c.r * 0.9) { blocked = true; break; }
    }
    if (blocked) continue;
    if (distToStream(x, z) < 0.42) continue;
    sites.push({ x: x, z: z, y: h, s: 0.72 + rnd2() * 0.72, bend: rnd2(), phase: rnd2() * TAU, tint: rnd2() });
  }

  const mesh = new THREE.InstancedMesh(tuft, makeGrassMaterial(), sites.length);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'grass';
  VEG.group.add(mesh);
  VEG.grass = mesh;

  const dummy = new THREE.Object3D();
  const aBend = new Float32Array(sites.length);
  const aPhase = new Float32Array(sites.length);
  const aTint = new Float32Array(sites.length);
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    dummy.position.set(s.x, s.y - 0.015, s.z);
    dummy.rotation.set(0, hash2(i, 3) * TAU, 0);
    dummy.scale.set(s.s * 0.90, s.s * 0.74 * (0.8 + hash2(i, 7) * 0.6), s.s * 0.90);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    aBend[i] = s.bend; aPhase[i] = s.phase; aTint[i] = s.tint;
  }
  mesh.instanceMatrix.needsUpdate = true;
  tuft.setAttribute('aBend', new THREE.InstancedBufferAttribute(aBend, 1));
  tuft.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
  tuft.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 1));
  VEG.counts.grass = sites.length;
}

/* ------------------------------------------------------------------ */
/* 34.  Wild flowers — species open and close on their own schedule     */
/* ------------------------------------------------------------------ */

const FLOWER_SPECIES = [
  { name: '蒲公英', bloom: 0.05, col: C(0xf7e07a), head: 0.075, h: 0.24, cluster: 1, n: 1 },
  { name: '雏菊', bloom: 0.14, col: C(0xfbf7ee), head: 0.062, h: 0.20, cluster: 3, n: 3 },
  { name: '紫花地丁', bloom: 0.20, col: C(0x9b8ad0), head: 0.055, h: 0.15, cluster: 2, n: 4 },
  { name: '虞美人', bloom: 0.30, col: C(0xe8734f), head: 0.085, h: 0.32, cluster: 1, n: 2 },
  { name: '矢车菊', bloom: 0.36, col: C(0x7d9fd6), head: 0.070, h: 0.30, cluster: 2, n: 3 },
  { name: '金盏花', bloom: 0.44, col: C(0xf0a93c), head: 0.080, h: 0.26, cluster: 1, n: 2 },
  { name: '秋英', bloom: 0.52, col: C(0xe8a8c0), head: 0.072, h: 0.34, cluster: 2, n: 3 },
  { name: '野菊', bloom: 0.60, col: C(0xe8d270), head: 0.068, h: 0.28, cluster: 2, n: 4 },
  { name: '三色堇', bloom: 0.09, col: C(0xb6a0d8), head: 0.060, h: 0.14, cluster: 3, n: 3 },
  { name: '香雪球', bloom: 0.16, col: C(0xf6f0f6), head: 0.052, h: 0.16, cluster: 3, n: 4 }
];

function makeFlowerTemplate(spec, seed) {
  const rnd = rng(seed);
  const chunks = [];
  const stems = [];
  for (let i = 0; i < spec.n; i++) {
    const a = (i / spec.n) * TAU + rnd();
    const r = spec.cluster > 1 ? rnd() * 0.075 : 0.0;
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r;
    const h = spec.h * (0.72 + rnd() * 0.5);
    // stem
    const g = new THREE.BoxGeometry(0.016, h, 0.016);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(ox, h / 2, oz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.22, a, (rnd() - 0.5) * 0.22)),
      new THREE.Vector3(1, 1, 1));
    chunks.push({ geo: g, matrix: m, color: new THREE.Color(0.8, 0.9, 0.7), isPetal: 0 });
    // head
    const hp = spec.head * (0.8 + rnd() * 0.45);
    const gh = new THREE.BoxGeometry(hp, hp * 0.72, hp);
    const mh = new THREE.Matrix4().compose(
      new THREE.Vector3(ox * 1.25, h, oz * 1.25),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 0.6, rnd() * TAU, rnd() * 0.6)),
      new THREE.Vector3(1, 1, 1));
    chunks.push({ geo: gh, matrix: mh, color: new THREE.Color(1, 1, 1), isPetal: 1 });
    if (spec.cluster > 1) {
      // a leaf or two
      const gl = new THREE.BoxGeometry(0.05, 0.012, 0.09);
      const ml = new THREE.Matrix4().compose(
        new THREE.Vector3(ox + 0.03, h * 0.55, oz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0.5)),
        new THREE.Vector3(1, 1, 1));
      chunks.push({ geo: gl, matrix: ml, color: new THREE.Color(0.72, 0.86, 0.6), isPetal: 0 });
    }
  }
  return chunks;
}

function buildFlowers() {
  const all = [];
  const rnd = rng(6151);
  // one merged template per species so each species gets its own bloom schedule
  const perSpecies = [];
  for (let s = 0; s < FLOWER_SPECIES.length; s++) perSpecies.push([]);

  let tries = 0;
  const target = FLOWER_CAP;
  while (all.length < target && tries < target * 30) {
    tries++;
    const x = (rnd() * 2 - 1) * (WORLD.half - 0.5);
    const z = (rnd() * 2 - 1) * (WORLD.half - 0.5);
    const h = terrainHeight(x, z);
    if (h < WORLD.waterY + 0.16) continue;
    if (slopeAt(x, z) > 1.2) continue;
    if (distToPath(x, z) < 0.58) continue;
    if (distToStream(x, z) < 0.45) continue;
    let blocked = false;
    for (const c of MASK.circles) {
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < c.r * c.r) { blocked = true; break; }
    }
    if (blocked) continue;
    // flower patches: clumped, not uniformly sprinkled
    const patch = fbm(x * 0.55 + 21.3, z * 0.55 + 3.7, 3);
    if (patch < 0.44) continue;
    // species chosen by latitude/altitude band + noise so patches have identity
    const band = fbm(x * 0.22 + 60.1, z * 0.22 + 12.5, 2);
    const si = clamp(Math.floor((band * 0.7 + patch * 0.3) * FLOWER_SPECIES.length), 0, FLOWER_SPECIES.length - 1);
    all.push({ x: x, z: z, y: h, s: 0.85 + rnd() * 0.5, species: si, tint: rnd(), phase: rnd() * TAU });
    perSpecies[si].push(all[all.length - 1]);
  }

  const group = new THREE.Group();
  for (let s = 0; s < FLOWER_SPECIES.length; s++) {
    const list = perSpecies[s];
    if (!list.length) continue;
    const spec = FLOWER_SPECIES[s];
    const chunks = makeFlowerTemplate(spec, 200 + s * 37);
    const geo = mergeChunks(chunks);
    const mat = makeFlowerMaterial({ color: spec.col, key: 's' + s });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.name = 'flowers_' + spec.name;
    // mark which vertices are petals
    const isPetal = new Float32Array(geo.attributes.position.count);
    let o = 0;
    for (const c of chunks) {
      const n = c.geo.index ? c.geo.index.count : c.geo.attributes.position.count;
      const cnt = c.geo.index ? c.geo.toNonIndexed().attributes.position.count : n;
      for (let i = 0; i < cnt; i++) isPetal[o + i] = c.isPetal;
      o += cnt;
    }
    geo.setAttribute('aIsPetal', new THREE.BufferAttribute(isPetal, 1));

    const dummy = new THREE.Object3D();
    const bloom = new Float32Array(list.length), tint = new Float32Array(list.length), phase = new Float32Array(list.length);
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      dummy.position.set(it.x, it.y - 0.01, it.z);
      dummy.rotation.set(0, hash2(s * 31 + i, 5) * TAU, 0);
      dummy.scale.setScalar(it.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // each flower within a species opens a touch earlier or later
      bloom[i] = clamp(spec.bloom + (it.tint - 0.5) * 0.10, 0, 1);
      tint[i] = it.tint; phase[i] = it.phase;
    }
    mesh.instanceMatrix.needsUpdate = true;
    geo.setAttribute('aBloom', new THREE.InstancedBufferAttribute(bloom, 1));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 1));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    group.add(mesh);
  }
  VEG.group.add(group);
  VEG.flowers = group;
  VEG.flowerGroup = group;
  VEG.counts.flowers = all.length;
  VEG.flowerSpecies = perSpecies;
}

/* ------------------------------------------------------------------ */
/* 35.  Hydrangeas — the summer bushes near the greenhouse              */
/* ------------------------------------------------------------------ */

function buildHydrangeas() {
  const sites = [];
  const rnd = rng(777);
  const anchors = [
    { x: POI.greenhouse.x - 2.6, z: POI.greenhouse.z + 1.6 },
    { x: POI.greenhouse.x + 2.5, z: POI.greenhouse.z + 2.0 },
    { x: POI.bookhouse.x - 2.4, z: POI.bookhouse.z + 1.4 },
    { x: POI.kiosk.x - 1.9, z: POI.kiosk.z - 0.2 },
    { x: POI.gazebo.x + 1.8, z: POI.gazebo.z - 1.2 },
    { x: -2.0, z: 7.2 }, { x: 3.4, z: -6.6 }, { x: -7.0, z: 2.6 }
  ];
  for (const a of anchors) {
    for (let i = 0; i < 5; i++) {
      const x = a.x + (rnd() - 0.5) * 1.1;
      const z = a.z + (rnd() - 0.5) * 1.1;
      if (!plantable(x, z, 0.28, false)) continue;
      sites.push({ x: x, z: z, y: terrainHeight(x, z), s: 0.8 + rnd() * 0.5, tint: rnd(), phase: rnd() * TAU });
    }
  }
  if (!sites.length) return;

  // a rounded bush of voxels: foliage plus a ring of mop-head blooms
  const chunks = [];
  const r = rng(991);
  const pts = blobPoints(0.075, 0.30, r, 0.72, 0.85);
  for (const p of pts) {
    const v = 0.75 + r() * 0.35;
    chunks.push({
      geo: BOX1,
      matrix: new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1] + 0.26, p[2]),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * TAU, r())),
        new THREE.Vector3(0.075 * (0.8 + r() * 0.5), 0.075 * (0.8 + r() * 0.5), 0.075 * (0.8 + r() * 0.5))),
      color: new THREE.Color(v, v * 1.05, v * 0.85)
    });
  }
  const headCount = 16;
  for (let i = 0; i < headCount; i++) {
    const a = (i / headCount) * TAU;
    const lat = 0.25 + (i % 5) * 0.13;
    const rr = 0.30;
    const hx = Math.cos(a) * rr * Math.cos(lat);
    const hz = Math.sin(a) * rr * Math.cos(lat);
    const hy = 0.30 + Math.sin(lat) * rr;
    const s = 0.085 + r() * 0.035;
    chunks.push({
      geo: BOX1,
      matrix: new THREE.Matrix4().compose(new THREE.Vector3(hx, hy, hz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * TAU, r())),
        new THREE.Vector3(s, s * 0.85, s)),
      color: new THREE.Color(1, 1, 1),
      petal: 1
    });
  }
  // a small trunk
  chunks.push({
    geo: BOX1,
    matrix: new THREE.Matrix4().compose(new THREE.Vector3(0, 0.10, 0), new THREE.Quaternion(), new THREE.Vector3(0.07, 0.22, 0.07)),
    color: new THREE.Color(0.45, 0.34, 0.26)
  });

  const geo = mergeChunks(chunks);
  const mat = makeFlowerMaterial({ color: C(0x9fc4e8), key: 'hydrangea' });
  const mesh = new THREE.InstancedMesh(geo, mat, sites.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'hydrangea';
  VEG.group.add(mesh);
  VEG.hydrangea = mesh;

  const isPetal = new Float32Array(geo.attributes.position.count);
  let o = 0;
  for (const c of chunks) {
    const g2 = c.geo.index ? c.geo.toNonIndexed() : c.geo;
    const cnt = g2.attributes.position.count;
    for (let i = 0; i < cnt; i++) isPetal[o + i] = c.petal ? 1 : 0;
    o += cnt;
  }
  geo.setAttribute('aIsPetal', new THREE.BufferAttribute(isPetal, 1));

  const dummy = new THREE.Object3D();
  const bloom = new Float32Array(sites.length), tint = new Float32Array(sites.length), phase = new Float32Array(sites.length);
  for (let i = 0; i < sites.length; i++) {
    const it = sites[i];
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(0, hash2(i, 13) * TAU, 0);
    dummy.scale.setScalar(it.s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    bloom[i] = 0.24 + it.tint * 0.18;
    tint[i] = it.tint; phase[i] = it.phase;
  }
  mesh.instanceMatrix.needsUpdate = true;
  geo.setAttribute('aBloom', new THREE.InstancedBufferAttribute(bloom, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
}

/* ------------------------------------------------------------------ */
/* 36.  Water lilies and lotus pads                                     */
/* ------------------------------------------------------------------ */

function buildLotus() {
  const sites = [];
  const rnd = rng(5309);
  let tries = 0;
  while (sites.length < 64 && tries < 4000) {
    tries++;
    const a = rnd() * TAU;
    const rr = Math.sqrt(rnd()) * (WORLD.lake.rx * 0.82);
    const x = WORLD.lake.x + Math.cos(a) * rr;
    const z = WORLD.lake.z + Math.sin(a) * rr * (WORLD.lake.rz / WORLD.lake.rx);
    const d = waterDepthNorm(x, z);
    if (d < 0.05 || d > 0.72) continue;
    // keep clear of the island and the dock
    if (Math.hypot(x - WORLD.island.x, z - WORLD.island.z) < WORLD.island.r * 1.5) continue;
    if (Math.hypot(x - POI.dock.x, z - POI.dock.z) < 1.8) continue;
    if (distToStream(x, z) < 0.7) continue;
    let near = false;
    for (const s of sites) if (Math.hypot(s.x - x, s.z - z) < 0.42) { near = true; break; }
    if (near) continue;
    sites.push({ x: x, z: z, s: 0.7 + rnd() * 0.6, tint: rnd(), phase: rnd() * TAU, flower: rnd() < 0.45 });
  }
  if (!sites.length) return;

  // a flat pad built from a few overlapping voxel slabs + a small bud
  const chunks = [];
  const r = rng(6621);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU;
    const rr = 0.085;
    const px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
    const g = new THREE.BoxGeometry(0.12, 0.018, 0.09);
    chunks.push({
      geo: g,
      matrix: new THREE.Matrix4().compose(new THREE.Vector3(px, 0, pz),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a),
        new THREE.Vector3(1, 1, 1)),
      color: new THREE.Color(0.72 + r() * 0.2, 0.86 + r() * 0.14, 0.62 + r() * 0.15)
    });
  }
  chunks.push({
    geo: new THREE.BoxGeometry(0.16, 0.018, 0.16),
    matrix: new THREE.Matrix4(),
    color: new THREE.Color(0.78, 0.9, 0.66)
  });
  // bud
  chunks.push({
    geo: new THREE.BoxGeometry(0.055, 0.085, 0.055),
    matrix: new THREE.Matrix4().compose(new THREE.Vector3(0.10, 0.05, 0.06), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)),
    color: new THREE.Color(1, 1, 1),
    petal: 1
  });

  const geo = mergeChunks(chunks);
  const mat = makeFlowerMaterial({ color: C(0xf6dbe6), key: 'lotus' });
  const mesh = new THREE.InstancedMesh(geo, mat, sites.length);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'lotus';
  VEG.group.add(mesh);
  VEG.lotus = mesh;

  const isPetal = new Float32Array(geo.attributes.position.count);
  let o = 0;
  for (const c of chunks) {
    const g2 = c.geo.index ? c.geo.toNonIndexed() : c.geo;
    const cnt = g2.attributes.position.count;
    for (let i = 0; i < cnt; i++) isPetal[o + i] = c.petal ? 1 : 0;
    o += cnt;
  }
  geo.setAttribute('aIsPetal', new THREE.BufferAttribute(isPetal, 1));

  const dummy = new THREE.Object3D();
  const bloom = new Float32Array(sites.length), tint = new Float32Array(sites.length), phase = new Float32Array(sites.length);
  for (let i = 0; i < sites.length; i++) {
    const it = sites[i];
    dummy.position.set(it.x, WORLD.waterY + 0.012, it.z);
    dummy.rotation.set(0, hash2(i, 29) * TAU, 0);
    dummy.scale.setScalar(it.s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    bloom[i] = it.flower ? 0.30 + it.tint * 0.20 : 0.02;
    tint[i] = it.tint; phase[i] = it.phase;
  }
  mesh.instanceMatrix.needsUpdate = true;
  geo.setAttribute('aBloom', new THREE.InstancedBufferAttribute(bloom, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
}

/* ------------------------------------------------------------------ */
/* 37.  Snow accumulation                                              */
/* ------------------------------------------------------------------ */

function collectSnowSites(extra) {
  const list = VEG.snowSites;
  list.length = 0;
  for (const e of extra) list.push(e);
  // roofs, ledges and the dock
  for (const c of SNOWCAPS) {
    const n = Math.max(1, Math.round(c.sx / 0.16));
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const lx = (t - 0.5) * c.sx;
      const lz = (hash1(i * 3.7 + c.x) - 0.5) * c.sz;
      const wx = c.x + lx * Math.cos(c.yaw) + lz * Math.sin(c.yaw);
      const wz = c.z - lx * Math.sin(c.yaw) + lz * Math.cos(c.yaw);
      list.push({
        x: wx, y: c.y + 0.02, z: wz,
        s: 0.30 + hash1(i * 5.1 + c.z) * 0.16, w: c.w, nx: 0, ny: 1, nz: 0
      });
    }
  }
  // ground drifts in hollows and against north-facing banks
  const rnd = rng(8802);
  let tries = 0;
  const targetGround = 2400;
  let ground = 0;
  while (ground < targetGround && tries < targetGround * 14) {
    tries++;
    const x = (rnd() * 2 - 1) * (WORLD.half - 0.15);
    const z = (rnd() * 2 - 1) * (WORLD.half - 0.15);
    const h = terrainHeight(x, z);
    if (h < WORLD.waterY + 0.03) continue;
    if (slopeAt(x, z) > 1.7) continue;
    const shade = clamp(-sunFacing(x, z) * 0.5 + 0.5, 0, 1);
    const shelter = shelterAt(x, z) * 0.5 + 0.5;
    const keep = 0.20 + 0.62 * shade * (0.45 + 0.55 * shelter);
    if (rnd() > keep) continue;
    list.push({
      x: x, z: z, y: h + 0.012,
      s: 0.28 + rnd() * 0.22, w: clamp(0.35 + shade * 0.6 + shelter * 0.3, 0, 1.3),
      nx: 0, ny: 1, nz: 0
    });
    ground++;
  }
  // snow caught in tree forks
  for (const t of VEG.treeAnchors) {
    if (t.spec === 'shrub') continue;
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = hash1(t.x * 3.1 + i * 7.7) * TAU;
      const rr = 0.12 + hash1(t.z * 2.3 + i * 3.3) * 0.35;
      const px = t.x + Math.cos(a) * rr, pz = t.z + Math.sin(a) * rr;
      list.push({
        x: px, z: pz, y: t.gy + t.h * (0.42 + i * 0.14),
        s: 0.16 + hash1(i * 9.1 + t.x) * 0.10, w: 0.55,
        nx: Math.cos(a), ny: 0.25, nz: Math.sin(a)
      });
    }
  }
}

function buildSnow() {
  const list = VEG.snowSites;
  const cap = Math.min(list.length, SNOW_CAP);
  // one small voxel mound template
  const chunks = [];
  const r = rng(4477);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    const rr = i === 0 ? 0 : 0.055 + r() * 0.04;
    const s = i === 0 ? 0.13 : 0.07 + r() * 0.05;
    chunks.push({
      geo: BOX1,
      matrix: new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(a) * rr, s / 2, Math.sin(a) * rr),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 0.5, r() * TAU, r() * 0.5)),
        new THREE.Vector3(s, s * 0.75, s)),
      color: new THREE.Color(1, 1, 1)
    });
  }
  const tmpl = mergeChunks(chunks);

  const mesh = new THREE.InstancedMesh(tmpl, makeSnowMaterial(), cap);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'snow';
  VEG.group.add(mesh);
  VEG.snow = mesh;

  const dummy = new THREE.Object3D();
  const aW = new Float32Array(cap), aT = new Float32Array(cap);
  for (let i = 0; i < cap; i++) {
    const s = list[i];
    dummy.position.set(s.x, s.y, s.z);
    // align mounds to the surface they sit on
    dummy.rotation.set(0, hash2(i, 17) * TAU, 0);
    dummy.scale.set(s.s * 1.15, s.s * 2.4, s.s * 1.15);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    aW[i] = clamp(s.w, 0, 1.3);
    aT[i] = hash2(i, 23);
  }
  mesh.instanceMatrix.needsUpdate = true;
  tmpl.setAttribute('aWeight', new THREE.InstancedBufferAttribute(aW, 1));
  tmpl.setAttribute('aTint', new THREE.InstancedBufferAttribute(aT, 1));
  VEG.counts.snow = cap;
}