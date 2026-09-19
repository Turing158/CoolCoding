/* ------------------------------------------------------------------ */
/* 6.  World layout constants                                          */
/* ------------------------------------------------------------------ */

const WORLD = {
  half: 13,            // diorama half-size in metres
  cell: 0.46,          // terrain sampling cell (voxel grain)
  quant: 0.115,        // vertical voxel stepping for the terraced ground
  waterY: -0.30,       // lake surface
  lake: { x: 0.4, z: -0.9, rx: 5.35, rz: 4.85 },
  island: { x: -1.7, z: 1.15, r: 1.05 },
  bedDepth: 1.30,
  trayBottom: -1.72,
  trayTop: -0.66
};
const BOUNDS = new THREE.Box3(
  new THREE.Vector3(-WORLD.half, WORLD.trayBottom - 0.02, -WORLD.half),
  new THREE.Vector3(WORLD.half, 3.6, WORLD.half)
);
/** inset bound used for living creatures so they never clip the tray rim */
const LIFE = { half: WORLD.half - 1.15 };

/* Points of interest — one fixed spatial layout, reused all year round */
const POI = {
  greenhouse: { x: -7.55, z: -5.55 },
  bookhouse: { x: 7.35, z: -5.85 },
  kiosk: { x: 6.25, z: 3.85 },
  dock: { x: 5.15, z: 1.45 },
  gazebo: { x: -9.60, z: 3.20 },
  plaza: { x: -3.9, z: -1.9 }
};
/** the bridge: west shore -> island, short and low over the water */
const BRIDGE_A = new THREE.Vector2(-5.90, 5.05);   // west/south shore end
const BRIDGE_B = new THREE.Vector2(-2.42, 1.86);   // island end

/** the little brook that feeds the lake: fixed channel, dug into the terrain */
const STREAM_PTS = [
  new THREE.Vector2(5.2, -11.4), new THREE.Vector2(3.9, -9.6),
  new THREE.Vector2(2.6, -8.1), new THREE.Vector2(1.6, -6.8),
  new THREE.Vector2(1.05, -5.7), new THREE.Vector2(0.75, -4.9)
];
function distToStream(x, z) {
  let best = 1e9;
  for (let i = 0; i < STREAM_PTS.length - 1; i++) {
    const a = STREAM_PTS[i], b = STREAM_PTS[i + 1];
    const abx = b.x - a.x, aby = b.y - a.y;
    const t = clamp(((x - a.x) * abx + (z - a.y) * aby) / (abx * abx + aby * aby || 1e-6), 0, 1);
    const dx = x - (a.x + abx * t), dz = z - (a.y + aby * t);
    const d = Math.hypot(dx, dz);
    if (d < best) best = d;
  }
  return best;
}
function streamProgress(x, z) {
  let best = 1e9, bt = 0;
  for (let i = 0; i < STREAM_PTS.length - 1; i++) {
    const a = STREAM_PTS[i], b = STREAM_PTS[i + 1];
    const abx = b.x - a.x, aby = b.y - a.y;
    const t = clamp(((x - a.x) * abx + (z - a.y) * aby) / (abx * abx + aby * aby || 1e-6), 0, 1);
    const dx = x - (a.x + abx * t), dz = z - (a.y + aby * t);
    const d = Math.hypot(dx, dz);
    if (d < best) { best = d; bt = (i + t) / (STREAM_PTS.length - 1); }
  }
  return bt;
}

/* ------------------------------------------------------------------ */
/* 7.  Terrain field                                                    */
/* ------------------------------------------------------------------ */

function lakeMetric(x, z) {
  const dx = (x - WORLD.lake.x) / WORLD.lake.rx;
  const dz = (z - WORLD.lake.z) / WORLD.lake.rz;
  return Math.sqrt(dx * dx + dz * dz);
}
function knoll(x, z, cx, cz, r, h) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return h * (1 - smootherstep(0, 1, clamp(d, 0, 1)));
}
/** raw ground height (metres) at any point — deterministic, stateless */
function terrainHeight(x, z) {
  let h = terrainHeightNoStream(x, z);

  // carve the brook channel down from the north-east ridge
  const ds = distToStream(x, z);
  if (ds < 1.15) {
    const t = streamProgress(x, z);
    const cut = 1 - smootherstep(0.22, 1.10, ds);
    const target = lerp(h, WORLD.waterY - 0.03, clamp(0.14 + t * 0.8, 0, 0.95));
    if (target < h) h = lerp(h, target, cut * 0.94);
  }

  // the island is a small mound that may never spill outside the lake
  const di = Math.hypot(x - WORLD.island.x, z - WORLD.island.z) / WORLD.island.r;
  if (di < 1.6) {
    const inside = lakeMetric(x, z) < 0.90 ? 1 : 0;
    if (inside) {
      const isl = 1 - smootherstep(0.52, 1.45, di);
      const target = WORLD.waterY + 0.34;
      if (target > h) h += (target - h) * clamp(isl * 1.5, 0, 1);
    }
  }
  return h;
}
function terrainHeightNoStream(x, z) {
  let h = 0.06;
  h += (fbm(x * 0.195 + 41.3, z * 0.195 + 17.9, 3) - 0.5) * 0.86;
  h += (fbm(x * 0.56 + 7.1, z * 0.56 + 3.4, 2) - 0.5) * 0.16;
  h += knoll(x, z, POI.greenhouse.x, POI.greenhouse.z, 4.4, 0.86);
  h += knoll(x, z, POI.bookhouse.x, POI.bookhouse.z, 3.7, 0.70);
  h += knoll(x, z, POI.gazebo.x, POI.gazebo.z, 3.0, 0.42);
  h += knoll(x, z, 3.5, -10.3, 5.2, 0.62);
  h += knoll(x, z, -10.0, 8.8, 4.6, 0.36);

  // carve the lake basin
  const m = lakeMetric(x, z);
  const inLake = 1 - smootherstep(0.68, 1.07, m);
  if (inLake > 0.001) {
    const bed = WORLD.waterY - WORLD.bedDepth * (0.32 + 0.68 * smoothstep(1.04, 0.20, m));
    h = lerp(h, bed, inLake);
  }
  return h;
}
function isWater(x, z) { return terrainHeight(x, z) < WORLD.waterY - 0.015; }
/** 0 at the waterline, 1 at the deepest point of the lake */
function waterDepthNorm(x, z) { return clamp((WORLD.waterY - terrainHeight(x, z)) / 1.05, 0, 1); }
function slopeAt(x, z) {
  const e = 0.3;
  const dx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const dz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}
/** how sun-facing a spot is: +1 leans toward the sun, -1 is a shaded corner */
function sunFacing(x, z) {
  const e = 0.36;
  const gx = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e);
  const gz = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
  return clamp(-(gx * 0.60 + gz * -0.80), -1, 1);
}
/** shallow shelter value: hollows and the foot of a bank collect snow and frost */
function shelterAt(x, z) {
  const e = 0.5;
  const avg = (terrainHeight(x + e, z) + terrainHeight(x - e, z) + terrainHeight(x, z + e) + terrainHeight(x, z - e)) * 0.25;
  return clamp((avg - terrainHeight(x, z)) * 2.2, -0.4, 1);
}

/* ------------------------------------------------------------------ */
/* 8.  Season engine                                                    */
/*                                                                    */
/*  One cyclic parameter drives the whole year. Every channel reads it  */
/*  through its own shifted, differently shaped window, so foliage,     */
/*  ground cover, weather, water and light all turn at separate times   */
/*  and the seasons overlap instead of switching.                       */
/* ------------------------------------------------------------------ */

const SEASON = { phase: 0.13, timeScale: 1, weather: 1, paused: false };

/** find the bracketing keyframe pair for a cyclic parameter */
function curveSeg(p, stops) {
  p = p - Math.floor(p);
  const n = stops.length;
  let a, b, t;
  if (p <= stops[0][0]) {
    a = stops[n - 1]; b = stops[0];
    const span = (1 - a[0]) + b[0];
    t = span <= 1e-6 ? 1 : (p + 1 - a[0]) / span;
  } else if (p >= stops[n - 1][0]) {
    a = stops[n - 1]; b = stops[0];
    const span = (1 - a[0]) + b[0];
    t = span <= 1e-6 ? 1 : (p - a[0]) / span;
  } else {
    a = stops[0]; b = stops[1];
    for (let i = 0; i < n - 1; i++) {
      if (p >= stops[i][0] && p <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    t = (p - a[0]) / (b[0] - a[0] || 1e-6);
  }
  return [a, b, smootherstep(0, 1, t)];
}
function curveNum(p, stops) {
  const s = curveSeg(p, stops);
  return lerp(s[0][1], s[1][1], s[2]);
}
function curveColor(p, stops, out) {
  const s = curveSeg(p, stops);
  return out.copy(s[0][1]).lerp(s[1][1], s[2]);
}

/* ---- season channel definitions (single source of truth) ---------- */

const CH = {
  // calendar channels
  temp:      [[0.02, 11.5], [0.30, 26.5], [0.55, 13.0], [0.80, -3.5]],
  maxSun:    [[0.02, 51], [0.30, 74], [0.55, 46], [0.80, 27]],
  dayLength: [[0.02, 12.7], [0.30, 15.1], [0.55, 11.4], [0.80, 9.1]],

  // ground cover runs slightly ahead of the calendar
  grassLush: [[0.06, 0.55], [0.20, 0.92], [0.42, 1.0], [0.58, 0.72], [0.70, 0.34], [0.80, 0.16], [0.92, 0.12]],

  // foliage: bud, leaf out, full canopy, colour turn, leaf fall, bare
  canopy:    [[0.02, 0.34], [0.09, 0.68], [0.18, 0.93], [0.34, 1.0], [0.50, 0.97],
              [0.60, 0.84], [0.68, 0.56], [0.75, 0.30], [0.82, 0.17], [0.93, 0.13]],
  leafSize:  [[0.03, 0.72], [0.12, 0.95], [0.30, 1.0], [0.55, 0.98], [0.70, 0.84], [0.82, 0.62]],
  leafOut:   [[0.05, 0.0], [0.09, 0.35], [0.15, 0.80], [0.24, 1.0], [0.55, 1.0], [0.66, 0.55], [0.74, 0.15]],

  // blossom & flowers
  blossom:   [[0.02, 0.10], [0.06, 0.72], [0.11, 1.0], [0.16, 0.62], [0.21, 0.20], [0.27, 0.03]],
  flowerBloom:[[0.03, 0.06], [0.10, 0.46], [0.20, 0.86], [0.30, 1.0], [0.48, 0.92], [0.56, 0.58], [0.64, 0.22], [0.70, 0.04]],
  hydrangea: [[0.18, 0.05], [0.26, 0.55], [0.34, 1.0], [0.44, 0.95], [0.52, 0.55], [0.60, 0.12], [0.66, 0.0]],
  lotus:     [[0.16, 0.0], [0.24, 0.45], [0.34, 1.0], [0.46, 0.92], [0.54, 0.45], [0.60, 0.06], [0.64, 0.0]],

  // fauna
  butterfly: [[0.12, 0.0], [0.20, 0.45], [0.30, 1.0], [0.46, 0.95], [0.54, 0.45], [0.60, 0.05], [0.64, 0.0]],
  bird:      [[0.06, 0.15], [0.16, 0.85], [0.34, 1.0], [0.52, 0.72], [0.62, 0.18], [0.68, 0.0], [0.90, 0.0]],
  firefly:   [[0.16, 0.0], [0.24, 0.5], [0.34, 1.0], [0.46, 0.6], [0.54, 0.10], [0.58, 0.0], [0.95, 0.0]],

  // water, snow and winter behaviour
  stream:    [[0.06, 1.0], [0.62, 1.0], [0.76, 0.30], [0.85, 0.0], [0.93, 0.10], [0.99, 0.55]],
  ice:       [[0.06, 0.0], [0.66, 0.0], [0.78, 0.12], [0.86, 0.48], [0.94, 0.92], [1.0, 1.0]],
  iceMelt:   [[0.06, 0.0], [0.88, 0.0], [0.95, 0.22], [1.0, 0.62]],
  snow:      [[0.04, 0.0], [0.58, 0.0], [0.70, 0.06], [0.80, 0.44], [0.88, 0.90], [0.95, 1.0], [1.0, 0.42]],
  frost:     [[0.05, 0.0], [0.66, 0.0], [0.76, 0.30], [0.86, 0.72], [0.96, 0.60], [1.0, 0.22]],
  drip:      [[0.04, 0.06], [0.80, 0.10], [0.92, 0.45], [0.99, 1.0], [1.0, 0.9]],
  mud:       [[0.03, 0.72], [0.14, 0.34], [0.42, 0.06], [0.80, 0.14], [1.0, 0.55]],

  // weather
  mist:      [[0.05, 0.22], [0.30, 0.05], [0.55, 0.15], [0.72, 0.48], [0.86, 0.60], [0.95, 0.34]],
  petal:     [[0.05, 0.12], [0.10, 1.0], [0.15, 0.78], [0.20, 0.24], [0.26, 0.02]],
  rainChance:[[0.26, 0.05], [0.34, 0.22], [0.44, 0.18], [0.52, 0.05], [0.72, 0.0]],
  leafDrop:  [[0.50, 0.0], [0.56, 0.22], [0.64, 1.0], [0.72, 0.52], [0.78, 0.06]],
  lampWarm:  [[0.10, 0.55], [0.30, 0.12], [0.55, 0.38], [0.75, 0.90], [0.90, 0.95]],

  // colour ramps -------------------------------------------------------
  // big trees: green -> golden -> brick, turning from the leaf tips inward
  leafTall:  [[0.01, C(0x9ec97a)], [0.20, C(0x6aa84f)], [0.38, C(0x4f9142)], [0.50, C(0x6f9a3c)],
              [0.56, C(0xd8ac3c)], [0.62, C(0xcf7a2e)], [0.68, C(0xb0542c)], [0.73, C(0x8e4630)],
              [0.80, C(0x6d5548)], [0.92, C(0x6a5a4e)]],
  // small trees & shrubs shift about 4% later
  leafSmall: [[0.05, C(0xa8d183)], [0.24, C(0x74ad55)], [0.42, C(0x578f42)], [0.54, C(0x8aa23e)],
              [0.60, C(0xe0bc46)], [0.66, C(0xd98b30)], [0.72, C(0xc05a2c)], [0.77, C(0x9a4a2e)],
              [0.84, C(0x70564a)], [0.95, C(0x6d5b4f)]],
  grassTint: [[0.04, C(0x9ed077)], [0.20, C(0x86bd5e)], [0.38, C(0x74ae52)], [0.52, C(0x9aa85a)],
              [0.62, C(0xc0a95e)], [0.72, C(0xa8926a)], [0.82, C(0x9b937f)], [0.94, C(0x9aa088)]],
  blossomCol:[[0.02, C(0xf3b9cd)], [0.10, C(0xfad2dd)], [0.18, C(0xfdeef0)], [0.30, C(0xf6e6ea)]],
  winterCol: [[0.90, C(0x8f9a86)], [1.0, C(0x93a08a)], [0.06, C(0x9dae8c)]]
};

/* ---- live season state -------------------------------------------- */

const S = {
  phase: 0, weights: [0.25, 0.25, 0.25, 0.25],
  temperature: 12, dayLength: 12.6, maxSun: 50, soilWarmth: 0.5,
  sunElev: 0, sunAz: 0, dayFrac: 0.5, daylight: 1, night: 0, dawn: 0,
  canopy: 1, leafSize: 1, leafOut: 1, leafTall: new THREE.Color(), leafSmall: new THREE.Color(),
  grassLush: 1, grassTint: new THREE.Color(),
  blossom: 1, blossomCol: new THREE.Color(),
  flowerBloom: 1, hydrangea: 0, lotus: 0,
  butterfly: 1, bird: 1, firefly: 0,
  stream: 1, ice: 0, iceMelt: 0, snow: 0, frost: 0, drip: 0, mud: 0.2,
  mist: 0.1, petal: 0.5, rainChance: 0.1, leafDrop: 0, lampWarm: 0.3,
  meltBias: 0.5
};

function seasonWeights(p, shift) {
  const q = p - (shift || 0);
  const w = [
    seasonWindow(q, 0.00, 0.175),
    seasonWindow(q, 0.25, 0.165),
    seasonWindow(q, 0.50, 0.170),
    seasonWindow(q, 0.75, 0.160)
  ];
  const s = w[0] + w[1] + w[2] + w[3] || 1;
  return [w[0] / s, w[1] / s, w[2] / s, w[3] / s];
}
function seasonWindow(p, center, width) {
  let d = p - center; d -= Math.floor(d + 0.5);
  return Math.exp(-(d * d) / (2 * width * width));
}

function updateSeasonState(p, dayFrac) {
  S.phase = p - Math.floor(p);
  S.weights = seasonWeights(S.phase, 0);

  // calendar
  S.temperature = curveNum(S.phase, CH.temp);
  S.maxSun = curveNum(S.phase, CH.maxSun);
  S.dayLength = curveNum(S.phase, CH.dayLength);
  S.soilWarmth = smoothstep(-4, 14, S.temperature);

  // sun position for this moment of the day
  const halfSpan = (S.dayLength / 24) * 0.5;
  const u = (dayFrac - 0.5) / halfSpan;
  S.sunElev = S.maxSun * Math.cos(clamp(u, -1.2, 1.2) * PI * 0.5);
  S.sunAz = -96 + 192 * clamp(u * 0.5 + 0.5, 0, 1);
  S.dayFrac = dayFrac;
  S.daylight = clamp(smoothstep(-4.5, 4.5, S.sunElev) * (0.52 + 0.48 * smoothstep(6, 34, S.sunElev)), 0, 1);
  S.night = 1 - S.daylight;
  S.dawn = smoothstep(-6, 3, S.sunElev) * (1 - smoothstep(4, 22, S.sunElev));

  // flora
  S.canopy = curveNum(S.phase, CH.canopy);
  S.leafSize = curveNum(S.phase, CH.leafSize);
  S.leafOut = curveNum(S.phase, CH.leafOut);
  curveColor(S.phase, CH.leafTall, S.leafTall);
  curveColor(S.phase, CH.leafSmall, S.leafSmall);
  S.grassLush = curveNum(S.phase, CH.grassLush);
  curveColor(S.phase, CH.grassTint, S.grassTint);
  S.blossom = curveNum(S.phase, CH.blossom);
  curveColor(S.phase, CH.blossomCol, S.blossomCol);
  S.flowerBloom = curveNum(S.phase, CH.flowerBloom);
  S.hydrangea = curveNum(S.phase, CH.hydrangea);
  S.lotus = curveNum(S.phase, CH.lotus);

  // fauna
  S.butterfly = curveNum(S.phase, CH.butterfly);
  S.bird = curveNum(S.phase, CH.bird);
  S.firefly = curveNum(S.phase, CH.firefly);

  // water & winter
  S.stream = curveNum(S.phase, CH.stream);
  S.ice = curveNum(S.phase, CH.ice);
  S.iceMelt = curveNum(S.phase, CH.iceMelt);
  S.snow = curveNum(S.phase, CH.snow);
  S.frost = curveNum(S.phase, CH.frost);
  S.drip = curveNum(S.phase, CH.drip);
  S.mud = curveNum(S.phase, CH.mud);

  // weather
  S.mist = curveNum(S.phase, CH.mist);
  S.petal = curveNum(S.phase, CH.petal);
  S.rainChance = curveNum(S.phase, CH.rainChance) * SEASON.weather;
  S.leafDrop = curveNum(S.phase, CH.leafDrop);
  S.lampWarm = curveNum(S.phase, CH.lampWarm);

  // a slow breathing factor keeps every cyclic value from snapping at the wrap
  S.meltBias = 0.5 + 0.5 * Math.sin(S.phase * TAU);
  return S;
}