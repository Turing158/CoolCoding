/* ------------------------------------------------------------------ */
/* 15.  Ground: terraced voxel terrain with a baked material blend      */
/* ------------------------------------------------------------------ */

const GN = 56;                                   // grid cells across the diorama
const GSTEP = (WORLD.half * 2) / GN;
const GROUND = { mesh: null, geo: null, blend: null, snowAttr: null, grid: GN };

function buildGround() {
  const n = GN, half = WORLD.half;
  const vcount = (n + 1) * (n + 1);
  const pos = new Float32Array(vcount * 3);
  const bl = new Float32Array(vcount * 3);
  const sn = new Float32Array(vcount);           // snow / frost accumulation weight
  const uv = new Float32Array(vcount * 2);
  const col = new Float32Array(vcount * 3);

  // terrain heights, quantised into terraces so the ground reads as stacked voxels
  const hs = new Float32Array(vcount);
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i;
      const x = -half + i * GSTEP, z = -half + j * GSTEP;
      const raw = terrainHeight(x, z);
      // keep the lake bed smooth, terrace the dry land
      const wet = smoothstep(WORLD.waterY + 0.02, WORLD.waterY - 0.28, raw);
      const q = Math.round(raw / WORLD.quant) * WORLD.quant;
      const h = lerp(q, raw, wet * 0.85);
      hs[k] = h;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      uv[k * 2] = x / 2.2; uv[k * 2 + 1] = z / 2.2;
    }
  }

  // material blend from slope, height and distance to the water
  const grassP = new THREE.Color(), soilP = PAL.soil, rockP = PAL.stoneDark, pebbleP = C(0xb9b0a0);
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i;
      const x = pos[k * 3], z = pos[k * 3 + 2], h = hs[k];
      const e = GSTEP;
      const hx = hs[j * (n + 1) + Math.min(n, i + 1)] - hs[j * (n + 1) + Math.max(0, i - 1)];
      const hz = hs[Math.min(n, j + 1) * (n + 1) + i] - hs[Math.max(0, j - 1) * (n + 1) + i];
      const slope = Math.hypot(hx, hz) / (2 * e);

      const rel = h - WORLD.waterY;
      const shore = 1 - smoothstep(0.05, 0.42, rel);          // pebbly waterline
      const rock = smoothstep(0.75, 1.7, slope);
      const dry = smoothstep(1.9, 3.6, rel) * 0.22;           // thin soil on the ridge
      let y = clamp(0.10 + dry + smoothstep(1.1, 2.1, slope) * 0.38, 0, 1);   // soil
      let p = shore * 0.92;
      let r = rock * 0.85;
      let g = clamp(1 - y - p - r, 0, 1);
      const s = g + y + p + r;
      g /= s; y /= s; p /= s; r /= s;
      bl[k * 3] = p; bl[k * 3 + 1] = y; bl[k * 3 + 2] = r;

      // snow clings to flat, sheltered and shaded spots first
      const flat = 1 - smoothstep(0.3, 1.1, slope);
      const shade = clamp(-sunFacing(x, z) * 0.5 + 0.5, 0, 1);
      const shelter = shelterAt(x, z) * 0.5 + 0.5;
      let w = flat * (0.55 + 0.45 * shade) * (0.6 + 0.4 * shelter);
      w *= 1 - smoothstep(WORLD.waterY - 0.05, WORLD.waterY + 0.15, h) * 0;   // lake handled separately
      if (h < WORLD.waterY) w = 0;
      sn[k] = clamp(w, 0, 1);
    }
  }

  const index = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + (n + 1), d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  // skirt from the rim down to the tray so the block of earth has sides
  const base = vcount;
  const rim = [];
  for (let i = 0; i <= n; i++) rim.push(i);                                     // j = 0
  for (let j = 0; j <= n; j++) rim.push(j * (n + 1) + n);                       // i = n
  for (let i = n; i >= 0; i--) rim.push(n * (n + 1) + i);                       // j = n
  for (let j = n; j >= 0; j--) rim.push(j * (n + 1));                           // i = 0

  const spos = [], sbl = [], suv = [], scol = [], ssn = [];
  const pushV = (src) => {
    spos.push(pos[src * 3], pos[src * 3 + 1], pos[src * 3 + 2]);
    sbl.push(bl[src * 3], bl[src * 3 + 1], bl[src * 3 + 2]);
    suv.push(uv[src * 2], uv[src * 2 + 1]);
    ssn.push(sn[src]);
  };
  const trayTop = WORLD.trayTop, trayBot = WORLD.trayBottom;
  const pushB = (src) => {
    spos.push(pos[src * 3], trayBot, pos[src * 3 + 2]);
    sbl.push(bl[src * 3], 0.75, bl[src * 3 + 2]);   // mostly soil-coloured on the cut face
    suv.push(uv[src * 2], uv[src * 2 + 1]);
    ssn.push(0);
  };

  const total = vcount + rim.length * 2;
  // rebuild arrays at the final size
  const P = new Float32Array(total * 3), B = new Float32Array(total * 3),
        U = new Float32Array(total * 2), SN = new Float32Array(total), CL = new Float32Array(total * 3);
  P.set(pos, 0); B.set(bl, 0); U.set(uv, 0); SN.set(sn, 0);

  let w = vcount;
  const rimStart = [];
  for (let i = 0; i <= n; i++) { rimStart.push(w + i); }
  // top rim ring then bottom ring
  const topRing = [], botRing = [];
  for (let k = 0; k < rim.length; k++) {
    const src = rim[k];
    const ti = w++;
    P[ti * 3] = pos[src * 3]; P[ti * 3 + 1] = pos[src * 3 + 1]; P[ti * 3 + 2] = pos[src * 3 + 2];
    B[ti * 3] = bl[src * 3]; B[ti * 3 + 1] = bl[src * 3 + 1]; B[ti * 3 + 2] = bl[src * 3 + 2];
    U[ti * 2] = uv[src * 2]; U[ti * 2 + 1] = uv[src * 2 + 1];
    SN[ti] = sn[src];
    topRing.push(ti);
  }
  for (let k = 0; k < rim.length; k++) {
    const src = rim[k];
    const bi = w++;
    P[bi * 3] = pos[src * 3]; P[bi * 3 + 1] = trayBot; P[bi * 3 + 2] = pos[src * 3 + 2];
    B[bi * 3] = bl[src * 3]; B[bi * 3 + 1] = 0.85; B[bi * 3 + 2] = bl[src * 3 + 2];
    U[bi * 2] = uv[src * 2]; U[bi * 2 + 1] = uv[src * 2 + 1];
    SN[bi] = 0;
    botRing.push(bi);
  }
  for (let k = 0; k < topRing.length - 1; k++) {
    const a = topRing[k], b = topRing[k + 1], c = botRing[k], d = botRing[k + 1];
    index.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(CL, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.96, metalness: 0.0, side: THREE.FrontSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  scene.add(mesh);

  GROUND.mesh = mesh; GROUND.geo = geo;
  GROUND.blend = B; GROUND.snowAttr = SN;
  GROUND.count = total;
  GROUND.colorAttr = geo.attributes.color;
}

/** per-frame (throttled) recolor of the ground */
const _gc = new THREE.Color();
function updateGroundColors() {
  const B = GROUND.blend, SN = GROUND.snowAttr, CL = GROUND.colorAttr.array;
  const snowCol = C(0xf7faff);
  const frostCol = C(0xe8f1f6);
  const soilWet = PAL.soil.clone().lerp(C(0x4a3a2a), clamp(S.mud * 0.85, 0, 0.8));
  const pebble = C(0xb9b0a0).clone().lerp(soilWet, clamp(0.15 + S.mud * 0.5, 0, 1));
  const rock = PAL.stoneDark;
  const snowAmt = clamp(S.snow * 1.5 - 0.06, 0, 1);
  const frostAmt = S.frost * 0.35;
  const grass = S.grassTint;
  const n = GROUND.count;
  for (let k = 0; k < n; k++) {
    const p = B[k * 3], y = B[k * 3 + 1], r = B[k * 3 + 2];
    const g = clamp(1 - p - y - r, 0, 1);
    let cr = grass.r * g + soilWet.r * y + rock.r * r + pebble.r * p;
    let cg = grass.g * g + soilWet.g * y + rock.g * r + pebble.g * p;
    let cb = grass.b * g + soilWet.b * y + rock.b * r + pebble.b * p;
    const sw = clamp(SN[k] * snowAmt * 1.6 + frostAmt * (0.30 + SN[k]), 0, 1);
    if (sw > 0.001) {
      const sc = snowCol.r * snowAmt + frostCol.r * (1 - snowAmt);
      const sg = snowCol.g * snowAmt + frostCol.g * (1 - snowAmt);
      const sb = snowCol.b * snowAmt + frostCol.b * (1 - snowAmt);
      cr = lerp(cr, sc, sw); cg = lerp(cg, sg, sw); cb = lerp(cb, sb, sw);
    }
    CL[k * 3] = cr; CL[k * 3 + 1] = cg; CL[k * 3 + 2] = cb;
  }
  GROUND.colorAttr.needsUpdate = true;
  GROUND.geo.computeBoundingSphere();
}

/* ------------------------------------------------------------------ */
/* 16.  Shared GLSL snippets                                           */
/* ------------------------------------------------------------------ */

const GLSL_FOG = `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  vec3 applyFog(vec3 col, float depth){
    float f = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
    return mix(col, uFogColor, clamp(f, 0.0, 1.0));
  }`;

const GLSL_NOISE = `
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn2(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
               mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm2(vec2 p){
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++){ s += a * vn2(p); p *= 2.03; a *= 0.5; }
    return s;
  }`;

/* ------------------------------------------------------------------ */
/* 17.  Lake water surface — waves, shore transparency, freezing        */
/* ------------------------------------------------------------------ */

const WATER_U = {
  uTime: { value: 0 },
  uShallow: { value: C(0xa8dbe8) },
  uDeep: { value: C(0x1f6d94) },
  uSky: { value: C(0xbcd8ea) },
  uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3) },
  uSunCol: { value: C(0xfff0d8) },
  uIce: { value: 0 },
  uMelt: { value: 0 },
  uSnow: { value: 0 },
  uFlow: { value: 0.55 },
  uWave: { value: 1 },
  uIsland: { value: new THREE.Vector2(WORLD.island.x, WORLD.island.z) },
  uFogColor: { value: C(0xd8e2ea) },
  uFogDensity: { value: 0.014 },
  uDaylight: { value: 1 }
};

const waterMat = new THREE.ShaderMaterial({
  uniforms: WATER_U,
  transparent: true,
  depthWrite: true,
  side: THREE.DoubleSide,
  vertexShader: `
    uniform float uTime, uWave, uFlow;
    attribute float aDepth;
    attribute float aShore;
    attribute float aFlowDir;
    varying float vDepth;
    varying float vShore;
    varying vec3 vWorld;
    varying float vView;
    varying float vFlow;
    void main(){
      vDepth = aDepth; vShore = aShore; vFlow = aFlowDir;
      vec3 p = position;
      float t = uTime;
      float amp = uWave * (0.014 + aDepth * 0.020);
      p.y += sin(p.x * 2.05 + t * 1.25) * amp;
      p.y += sin(p.z * 1.65 - t * 0.95) * amp * 0.85;
      p.y += sin((p.x + p.z) * 3.30 + t * 2.10) * amp * 0.35;
      // flow along the stream pushes the surface downhill
      p.y += aFlowDir * uFlow * 0.010 * sin(uTime * 3.4 + p.z * 6.0);
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vWorld = wp.xyz;
      vec4 mv = viewMatrix * wp;
      vView = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: GLSL_FOG + GLSL_NOISE + `
    uniform vec3 uShallow, uDeep, uSky, uSunCol, uSunDir;
    uniform float uTime, uIce, uMelt, uSnow, uDaylight, uWave;
    uniform vec2 uIsland;
    varying float vDepth;
    varying float vShore;
    varying vec3 vWorld;
    varying float vView;
    varying float vFlow;

    vec3 waterNormal(vec2 p, float t){
      float e = 0.05;
      float h  = fbm2(p * 1.9 + vec2(t * 0.42, -t * 0.32));
      float hx = fbm2((p + vec2(e, 0.0)) * 1.9 + vec2(t * 0.42, -t * 0.32));
      float hz = fbm2((p + vec2(0.0, e)) * 1.9 + vec2(t * 0.42, -t * 0.32));
      float ripple = sin(p.x * 5.5 + t * 2.1) * 0.018 + sin(p.y * 4.8 - t * 1.8) * 0.018;
      return normalize(vec3(-(hx - h) / e * 0.22 - ripple, 1.0, -(hz - h) / e * 0.22));
    }

    void main(){
      if (vDepth < 0.004) discard;
      // shoreline wetness and depth gradient
      float shore = smoothstep(0.0, 0.14, vDepth);
      vec3 shallow = uShallow * (1.0 - 0.25 * smoothstep(0.0, 0.35, vView / 26.0));
      vec3 body = mix(shallow, uDeep, smoothstep(0.05, 0.85, vDepth));

      // ---- ice sheet: grows from the shore inward ---------------------
      // the gate guarantees open water whenever the season says so
      float iceGate = smoothstep(0.02, 0.16, uIce);
      float iceField = uIce * 1.55 - (1.0 - vDepth) * 0.62 - vShore * 0.42;
      iceField += (fbm2(vWorld.xz * 1.4) - 0.5) * 0.34;
      float ice = smoothstep(0.02, 0.20, iceField) * iceGate;
      // melt season pulls the ice back from the margins first
      ice *= 1.0 - smoothstep(0.0, 0.35, uMelt) * (1.0 - smoothstep(0.25, 0.85, vDepth)) * 1.25;
      ice = clamp(ice, 0.0, 1.0);

      vec3 col;
      float t = uTime;
      if (ice > 0.001) {
        vec2 ip = vWorld.xz;
        float crack = fbm2(ip * 2.20 + 5.0);
        float crack2 = fbm2(ip * 4.80 - 2.0);
        float c1 = smoothstep(0.47, 0.50, crack) * smoothstep(0.53, 0.50, crack);
        float c2 = smoothstep(0.46, 0.50, crack2) * smoothstep(0.54, 0.50, crack2);
        float cracks = clamp(c1 + c2 * 0.7, 0.0, 1.0) * (0.35 + uMelt * 1.4);

        vec3 iceCol = mix(vec3(0.74, 0.84, 0.90), vec3(0.58, 0.72, 0.82), crack * 0.8);
        iceCol = mix(iceCol, vec3(0.40, 0.53, 0.64), cracks * 0.75);
        // slush and melt water pooling on top
        float pool = smoothstep(0.46, 0.70, fbm2(ip * 0.95 + 11.0)) * uMelt;
        iceCol = mix(iceCol, vec3(0.32, 0.44, 0.52), pool * 0.55);
        iceCol = mix(iceCol, vec3(0.94, 0.97, 1.0), uSnow * 0.85);
        float sunLit = smoothstep(0.06, 0.55, uDaylight);
        float gloss = pow(max(dot(normalize(vec3(0.0, 1.0, 0.0)), normalize(uSunDir)), 0.0), 8.0);
        iceCol += uSunCol * gloss * 0.10 * sunLit;
        // faint ridged relief
        iceCol *= 0.94 + 0.12 * fbm2(ip * 2.6);
        col = iceCol;
      } else {
        vec3 nrm = waterNormal(vWorld.xz, t);
        float fres = pow(1.0 - clamp(dot(nrm, normalize(cameraPosition - vWorld)), 0.0, 1.0), 4.0);
        vec3 refl = mix(uSky, uSunCol, 0.20);
        // the lake stays blue; only grazing angles pick up the sky
        col = mix(body, refl, clamp(0.02 + fres * 0.70, 0.0, 0.82));
        vec3 vdir = normalize(cameraPosition - vWorld);
        // specular and caustics belong to the sun alone, so they vanish at night
        float sunLit = smoothstep(0.06, 0.55, uDaylight);
        float spec = pow(max(dot(reflect(-normalize(uSunDir), nrm), vdir), 0.0), 90.0);
        col += uSunCol * spec * 1.5 * sunLit * (1.0 - 0.5 * ice);
        // caustic shimmer near the shore
        float caust = fbm2(vWorld.xz * 2.2 + vec2(t * 0.35, t * 0.22));
        col += uSunCol * pow(caust, 2.0) * 0.09 * (1.0 - smoothstep(0.0, 0.4, vDepth)) * sunLit;
      }

      // stream water runs faster and slightly brighter
      if (vFlow > 0.5) {
        float run = fbm2(vec2(vWorld.x * 2.0, vWorld.z * 2.0 - uTime * 1.9));
        col += uSunCol * pow(run, 3.0) * 0.18 * uDaylight;
      }

      float alpha = mix(0.76, 0.96, smoothstep(0.0, 0.22, vDepth));
      alpha = mix(alpha, 1.0, ice);
      col = applyFog(col, vView);
      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});

function buildWater() {
  const lx = WORLD.lake.x, lz = WORLD.lake.z;
  const w = WORLD.lake.rx * 2 + 1.6, d = WORLD.lake.rz * 2 + 1.6;
  const segX = 66, segZ = 58;
  const nv = (segX + 1) * (segZ + 1);
  const pos = new Float32Array(nv * 3);
  const dep = new Float32Array(nv);
  const sh = new Float32Array(nv);
  const flow = new Float32Array(nv);
  const uv = new Float32Array(nv * 2);
  for (let j = 0; j <= segZ; j++) {
    for (let i = 0; i <= segX; i++) {
      const k = j * (segX + 1) + i;
      const x = lx - w / 2 + (i / segX) * w;
      const z = lz - d / 2 + (j / segZ) * d;
      const dn = waterDepthNorm(x, z);
      pos[k * 3] = x; pos[k * 3 + 1] = WORLD.waterY; pos[k * 3 + 2] = z;
      dep[k] = dn;
      sh[k] = 1 - smoothstep(0.0, 0.45, dn);
      uv[k * 2] = (x + WORLD.half) / (WORLD.half * 2);
      uv[k * 2 + 1] = (z + WORLD.half) / (WORLD.half * 2);
    }
  }
  const idx = [];
  for (let j = 0; j < segZ; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * (segX + 1) + i, b = a + 1, c = a + (segX + 1), dd = c + 1;
      idx.push(a, c, b, b, c, dd);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(dep, 1));
  geo.setAttribute('aShore', new THREE.BufferAttribute(sh, 1));
  geo.setAttribute('aFlowDir', new THREE.BufferAttribute(flow, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, waterMat);
  mesh.renderOrder = 2;
  mesh.name = 'lake';
  mesh.frustumCulled = false;
  scene.add(mesh);

  // ---- the brook that feeds the lake --------------------------------
  const pts = STREAM_PTS.map(p => new THREE.Vector3(p.x, 0, p.y));
  const curve = new THREE.CatmullRomCurve3(pts);
  const N = 40, M = 4;
  const spos = new Float32Array((N + 1) * (M + 1) * 3), sdep = new Float32Array((N + 1) * (M + 1)),
        ssh = new Float32Array((N + 1) * (M + 1)), sflow = new Float32Array((N + 1) * (M + 1)),
        suv = new Float32Array((N + 1) * (M + 1) * 2);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const c = curve.getPoint(t);
    const tg = curve.getTangent(t);
    const nx = -tg.z, nz = tg.x;
    const width = lerp(0.17, 0.58, smoothstep(0, 0.9, t));
    for (let j = 0; j <= M; j++) {
      const s = (j / M - 0.5) * 2;
      const x = c.x + nx * s * width, z = c.z + nz * s * width;
      const k = i * (M + 1) + j;
      const bed = terrainHeight(x, z);
      // the water surface follows the channel floor and levels off near the lake
      const y = Math.max(bed + 0.045, WORLD.waterY - 0.01);
      spos[k * 3] = x; spos[k * 3 + 1] = y; spos[k * 3 + 2] = z;
      sdep[k] = clamp((y - bed) / 0.35, 0.04, 1);
      ssh[k] = 1 - Math.abs(s) * 0.55;
      sflow[k] = 1;
      suv[k * 2] = s * 0.5 + 0.5; suv[k * 2 + 1] = t * 8;
    }
  }
  const sidx = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), dd = c + 1;
      sidx.push(a, c, b, b, c, dd);
    }
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  sgeo.setAttribute('uv', new THREE.BufferAttribute(suv, 2));
  sgeo.setAttribute('aDepth', new THREE.BufferAttribute(sdep, 1));
  sgeo.setAttribute('aShore', new THREE.BufferAttribute(ssh, 1));
  sgeo.setAttribute('aFlowDir', new THREE.BufferAttribute(sflow, 1));
  sgeo.setIndex(sidx);
  sgeo.computeBoundingSphere();
  const smesh = new THREE.Mesh(sgeo, waterMat);
  smesh.renderOrder = 2;
  smesh.name = 'stream';
  scene.add(smesh);
  GROUND.stream = smesh;
}

function updateWaterUniforms(dt) {
  WATER_U.uTime.value += dt * (0.55 + S.stream * 0.9);
  if (GROUND.stream) GROUND.stream.visible = S.stream > 0.015;
}

/* ---- a cheap height lookup for per-particle ground tests ---------- */
const HGRID = { n: 96, data: null, step: 0, ox: 0, oz: 0 };
function buildHeightGrid() {
  const n = HGRID.n;
  HGRID.step = (WORLD.half * 2) / n;
  HGRID.ox = -WORLD.half;
  HGRID.oz = -WORLD.half;
  const d = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      d[j * (n + 1) + i] = terrainHeight(HGRID.ox + i * HGRID.step, HGRID.oz + j * HGRID.step);
    }
  }
  HGRID.data = d;
}
/** bilinear sample of the cached terrain, clamped to the tray */
function terrainFast(x, z) {
  const n = HGRID.n, s = HGRID.step;
  const fx = clamp((x - HGRID.ox) / s, 0, n - 0.001);
  const fz = clamp((z - HGRID.oz) / s, 0, n - 0.001);
  const i = fx | 0, j = fz | 0;
  const tx = fx - i, tz = fz - j;
  const d = HGRID.data, w = n + 1;
  const a = d[j * w + i], b = d[j * w + i + 1], c = d[(j + 1) * w + i], e = d[(j + 1) * w + i + 1];
  return lerp(lerp(a, b, tx), lerp(c, e, tx), tz);
}

/* ------------------------------------------------------------------ */
/* 18.  Mist banks — a few soft sheets that drift over the water        */
/* ------------------------------------------------------------------ */

const MIST_U = {
  uTime: { value: 0 },
  uAmount: { value: 0 },
  uColor: { value: C(0xe8eef2) },
  uSunCol: { value: C(0xffe6c0) },
  uFogColor: { value: C(0xd8e2ea) },
  uFogDensity: { value: 0.014 },
  uDaylight: { value: 1 },
  uSeed: { value: 3.7 }
};
const mistMat = new THREE.ShaderMaterial({
  uniforms: MIST_U,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexShader: `
    uniform float uTime, uAmount, uSeed;
    varying vec2 vUv;
    varying float vView;
    varying vec3 vWorld;
    void main(){
      vUv = uv;
      vec3 p = position;
      // gentle billowing
      p.y += sin(p.x * 0.35 + uTime * 0.22 + uSeed) * 0.35;
      p.y += cos(p.z * 0.28 - uTime * 0.17) * 0.30;
      p.x += sin(p.z * 0.22 + uTime * 0.13) * 0.5;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vWorld = wp.xyz;
      vec4 mv = viewMatrix * wp;
      vView = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: GLSL_FOG + GLSL_NOISE + `
    uniform float uAmount, uTime, uDaylight;
    uniform vec3 uColor, uSunCol;
    varying vec2 vUv;
    varying float vView;
    varying vec3 vWorld;
    void main(){
      float m = fbm2(vWorld.xz * 0.30 + vec2(uTime * 0.05, -uTime * 0.035));
      m = smoothstep(0.30, 0.78, m);
      vec2 c = vUv - 0.5;
      float radial = 1.0 - smoothstep(0.16, 0.5, length(c));
      float a = m * radial * uAmount;
      a *= 1.0 - smoothstep(18.0, 60.0, vView);
      if (a < 0.004) discard;
      vec3 col = mix(uColor, uSunCol, 0.25 * uDaylight);
      col = applyFog(col, vView);
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * 0.85);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
const mistGroup = new THREE.Group();
function buildMist() {
  const layers = [
    { y: WORLD.waterY + 0.16, s: 22, seed: 1.7, amp: 1.0 },
    { y: WORLD.waterY + 0.55, s: 27, seed: 4.3, amp: 0.75 },
    { y: WORLD.waterY + 1.15, s: 32, seed: 8.1, amp: 0.55 }
  ];
  for (const L of layers) {
    const m = mistMat.clone();
    m.uniforms = THREE.UniformsUtils.clone(mistMat.uniforms);
    m.uniforms.uSeed.value = L.seed;
    m.userData.amp = L.amp;
    const g = new THREE.PlaneGeometry(L.s, L.s, 28, 28);
    g.rotateX(-PI / 2);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(WORLD.lake.x, L.y, WORLD.lake.z);
    mesh.renderOrder = 6;
    mesh.userData.spin = 0.006 + L.seed * 0.0012;
    mistGroup.add(mesh);
  }
  scene.add(mistGroup);
  GROUND.mistMats = mistGroup.children.map(m => m.material);
}
function updateMist(dt, t) {
  mistGroup.visible = MIST_U.uAmount.value > 0.01;
  if (!mistGroup.visible) return;
  GROUND.mistMats.forEach((m, i) => {
    const mh = mistGroup.children[i];
    m.uniforms.uTime.value = t;
    m.uniforms.uAmount.value = MIST_U.uAmount.value * mh.userData.amp *
      (0.75 + 0.25 * Math.sin(t * 0.11 + i * 2.1));
    m.uniforms.uColor.value.copy(MIST_U.uColor.value);
    m.uniforms.uSunCol.value.copy(MIST_U.uSunCol.value);
    m.uniforms.uFogColor.value.copy(MIST_U.uFogColor.value);
    m.uniforms.uFogDensity.value = MIST_U.uFogDensity.value;
    m.uniforms.uDaylight.value = MIST_U.uDaylight.value;
    mh.rotation.y += dt * mh.userData.spin;
  });
}