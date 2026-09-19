/* =======================================================================
   湖畔花园的四季来信  ·  Letters of the Four Seasons from a Lakeside Garden
   A single-file, offline, procedural voxel diorama built on Three.js r160.
   Everything (geometry / material / texture) is generated in code.
   ======================================================================= */

/* ------------------------------------------------------------------ */
/* 1.  Math + deterministic noise helpers                              */
/* ------------------------------------------------------------------ */

const PI = Math.PI, TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1); return t * t * (3 - 2 * t); };
const smootherstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

/** deterministic hash -> [0,1) */
function hash1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); }
/** deterministic hash of two numbers -> [0,1) */
function hash2(a, b) { return hash1(a * 157.31 + b * 12.9898); }
/** signed deterministic offset in [-1,1] */
function soff(n) { return hash1(n) * 2 - 1; }

/** 2D value noise (smooth, deterministic, no tables to allocate) */
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct) {
  oct = oct || 3;
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return s;
}

/** exponential smoothing that is stable at any frame rate */
function damp(cur, target, lambda, dt) { return lerp(cur, target, 1 - Math.exp(-lambda * dt)); }

/* ------------------------------------------------------------------ */
/* 2.  Palette (authored in sRGB, converted to linear working space)   */
/* ------------------------------------------------------------------ */

const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();

const PAL = {
  oakLight: C(0xdcc09a), oakMid: C(0xc4a279), oakDark: C(0x9d7d55),
  soil: C(0x6d5741),
  grassSpring: C(0x93c96f), grassSummer: C(0x77b156), grassAutumn: C(0xbba86a), grassWinter: C(0xa9a08c),
  water: C(0x6fabc4), waterDeep: C(0x3f7f9c),
  glass: C(0xd2e8f0),
  wood: C(0xb08655), woodDark: C(0x8a6540),
  plaster: C(0xf4ead8), roof: C(0x9a6250), roofMoss: C(0x83936a),
  snow: C(0xf7faff), ice: C(0xd9eef8),
  bark: C(0x7d5f49), barkLight: C(0x9a7a5c),
  stone: C(0xada79c), stoneDark: C(0x8d887e),
  petalPink: C(0xf7c8d8), petalWhite: C(0xfdf3f4),
  warm: C(0xffcf8e), cool: C(0x9fc4e8)
};

const SEASON_NAMES = ['春 · Spring', '夏 · Summer', '秋 · Autumn', '冬 · Winter'];
/**
 * Where each season actually reads on the dial. These are deliberately not
 * evenly spaced: they follow the keyframes, so blossom and green arrive early,
 * the autumn turn holds for a while, and deep winter sits just before the wrap.
 */
const SEASON_EDGES = [0.985, 0.235, 0.510, 0.775];
function seasonIndexOf(p) {
  p = p - Math.floor(p);
  if (p >= SEASON_EDGES[0] || p < SEASON_EDGES[1]) return 0;   // spring wraps the year
  if (p < SEASON_EDGES[2]) return 1;
  if (p < SEASON_EDGES[3]) return 2;
  return 3;
}

/** snapshot / restore of the live season state, used by the continuity audit */
function phaseKeep() {
  const o = {};
  for (const k in S) {
    const v = S[k];
    o[k] = (v && v.isColor) ? v.clone() : (Array.isArray(v) ? v.slice() : v);
  }
  return o;
}
function restoreKeep(o) {
  for (const k in o) {
    const v = o[k];
    if (v && v.isColor) S[k].copy(v);
    else S[k] = v;
  }
}

/* ------------------------------------------------------------------ */
/* 3.  Geometry micro-kit (all blocky / voxel flavoured)               */
/* ------------------------------------------------------------------ */

const VOX = 12;                 // voxel units per world metre

/** clamp a blocky mesh into the diorama bounds – nothing may escape the sandbox */
function confineGeometry(geo, box) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      clamp(pos.getX(i), box.min.x, box.max.x),
      clamp(pos.getY(i), box.min.y, box.max.y),
      clamp(pos.getZ(i), box.min.z, box.max.z));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** walk a geometry's vertices through a matrix, in place */
function bakeMatrix(geo, m) {
  if (!m) return geo;
  geo.applyMatrix4(m);
  return geo;
}

/**
 * Merge a list of { geo, matrix } chunks into a single BufferGeometry.
 * Avoids pulling in BufferGeometryUtils so the file stays self-contained.
 */
function mergeChunks(chunks) {
  const prepared = [];
  for (const ch of chunks) {
    let g = ch.geo;
    if (ch.matrix) g = g.clone().applyMatrix4(ch.matrix);
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.uv) {
      const n = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    prepared.push({ g, color: ch.color, tint: ch.tint });
  }
  let total = 0;
  for (const p of prepared) total += p.g.attributes.position.count;

  const posA = new Float32Array(total * 3);
  const nrmA = new Float32Array(total * 3);
  const uvA = new Float32Array(total * 2);
  const colA = new Float32Array(total * 3);
  let o = 0;
  for (const p of prepared) {
    const g = p.g;
    const n = g.attributes.position.count;
    posA.set(g.attributes.position.array.subarray(0, n * 3), o * 3);
    if (g.attributes.normal) nrmA.set(g.attributes.normal.array.subarray(0, n * 3), o * 3);
    uvA.set(g.attributes.uv.array.subarray(0, n * 2), o * 2);
    const col = p.color || new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) { colA[(o + i) * 3] = col.r; colA[(o + i) * 3 + 1] = col.g; colA[(o + i) * 3 + 2] = col.b; }
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(posA, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrmA, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvA, 2));
  out.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  out.computeBoundingSphere();
  return out;
}

/**
 * Voxel batch builder: accumulates axis-aligned boxes in a plain array and
 * emits one merged, vertex-coloured geometry. This keeps draw calls low while
 * every building still reads as stacked cubes.
 */
class VoxBatch {
  constructor(bounds) { this.box = new THREE.BoxGeometry(1, 1, 1); this.chunks = []; this.bounds = bounds; }
  /** add a box: size in metres, centre position in metres, optional yaw */
  add(sx, sy, sz, x, y, z, color, yaw, tint) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw || 0);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
    this.chunks.push({ geo: this.box, matrix: m, color: color, tint: tint });
    return this;
  }
  /** stack of boxes; each entry [sx,sy,sz,x,y,z,color] */
  stack(list) { for (const e of list) this.add(e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7] || 0); return this; }
  build() {
    const g = mergeChunks(this.chunks);
    if (this.bounds) confineGeometry(g, this.bounds);
    return g;
  }
}

/** regular polygon prism, used for the gazebo roof and kiosk canopy */
function coneGeo(radius, height, segments, capTop, topRadius) {
  topRadius = topRadius === undefined ? 0 : topRadius;
  const g = new THREE.CylinderGeometry(topRadius, radius, height, segments, 1, false);
  if (!capTop && topRadius > 1e-4) {
    // build an open top instead of a lid
    const ng = new THREE.CylinderGeometry(topRadius, radius, height, segments, 1, true);
    ng.computeVertexNormals();
    return ng;
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* 4.  Procedural canvas textures (no external image files)            */
/* ------------------------------------------------------------------ */

const TEXCACHE = new Map();
function canvasTex(key, size, draw, opts) {
  if (TEXCACHE.has(key)) return TEXCACHE.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = (opts && opts.data) ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.needsUpdate = true;
  TEXCACHE.set(key, t);
  return t;
}

/** fine wood grain for the desk top */
function makeOakTexture() {
  return canvasTex('oak', 256, (g, s) => {
    g.fillStyle = '#dcc09a'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 1) {
      const n = fbm(y * 0.09, 0, 3);
      const v = 0.5 + n * 0.5;
      g.fillStyle = 'rgba(' + Math.round(196 * v + 40) + ',' + Math.round(168 * v + 34) + ',' + Math.round(128 * v + 26) + ',0.35)';
      g.fillRect(0, y, s, 1);
    }
    for (let k = 0; k < 26; k++) {
      const y = hash1(k * 3.7) * s;
      g.strokeStyle = 'rgba(140,110,78,' + (0.06 + hash1(k * 1.3) * 0.12).toFixed(3) + ')';
      g.lineWidth = 1 + hash1(k * 9.1) * 2;
      g.beginPath();
      for (let x = 0; x <= s; x += 8) {
        const yy = y + Math.sin(x * 0.02 + k) * 5 + fbm(x * 0.03, k * 5.1, 2) * 12;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
  });
}

/** blocky hand-made paper for the journal / postcards */
function makePaperTexture() {
  return canvasTex('paper', 128, (g, s) => {
    g.fillStyle = '#f6efe0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = hash1(i * 1.7) * s, y = hash1(i * 3.3 + 11) * s;
      const a = 0.03 + hash1(i * 5.9) * 0.06;
      g.fillStyle = 'rgba(150,132,104,' + a.toFixed(3) + ')';
      g.fillRect(x | 0, y | 0, 2, 2);
    }
    g.fillStyle = 'rgba(120,150,170,0.13)';
    for (let y = 10; y < s; y += 7) g.fillRect(4, y, s - 8, 1);
  });
}

/** tiny painted postcard motif */
function makePostcardTexture(variant) {
  return canvasTex('postcard' + variant, 64, (g, s) => {
    const skies = ['#cfe3ee', '#e8dfe6', '#dbe8d2', '#d8e6f0'];
    g.fillStyle = skies[variant % skies.length]; g.fillRect(0, 0, s, s);
    g.fillStyle = ['#9dc78a', '#d8b06e', '#cf9a86', '#a8c4d8'][variant % 4];
    g.beginPath(); g.moveTo(0, s * 0.66);
    for (let x = 0; x <= s; x += 4) g.lineTo(x, s * 0.62 + fbm(x * 0.1, variant * 3, 2) * 10);
    g.lineTo(s, s); g.lineTo(0, s); g.fill();
    g.fillStyle = '#f4f0e6';
    g.fillRect(6, 6, s - 12, s * 0.42 - 4);
    g.fillStyle = '#b9a98e';
    for (let i = 0; i < 4; i++) g.fillRect(10, 11 + i * 4, (s - 24) * (0.5 + hash1(variant * 7 + i) * 0.5), 1);
    g.strokeStyle = '#c9b79a'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, s - 3, s - 3);
  });
}

/** warm stained-glass window for the greenhouse / book-house lamps */
function makeLampTexture() {
  return canvasTex('lamp', 64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,232,190,1)');
    grd.addColorStop(0.35, 'rgba(255,206,140,0.72)');
    grd.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  });
}

/* ------------------------------------------------------------------ */
/* 5.  Shared material cache                                           */
/* ------------------------------------------------------------------ */

const MAT = {};
function buildMaterials() {
  MAT.oak = new THREE.MeshStandardMaterial({
    vertexColors: true, map: makeOakTexture(), roughness: 0.72, metalness: 0.0, flatShading: false
  });
  MAT.wood = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0, flatShading: true });
  MAT.stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.0, flatShading: true });
  MAT.paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.0, flatShading: true });
  MAT.fabric = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0.0, flatShading: true });
  MAT.paper = new THREE.MeshStandardMaterial({ vertexColors: true, map: makePaperTexture(), roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide });
  MAT.postcard = new THREE.MeshStandardMaterial({ vertexColors: true, map: makePostcardTexture(0), roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide });
  MAT.porcelain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.02, flatShading: true });
  MAT.glass = new THREE.MeshPhysicalMaterial({
    vertexColors: true, color: 0xffffff, roughness: 0.12, metalness: 0.0,
    transparent: true, opacity: 0.30, transmission: 0.0, side: THREE.DoubleSide,
    depthWrite: false, flatShading: true
  });
  MAT.leaf = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0, flatShading: true });
  MAT.glow = new THREE.MeshBasicMaterial({ map: makeLampTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff });
}