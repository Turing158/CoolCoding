import * as THREE from 'three';
import { random, plane } from './kit.js';
import { REFLECTION_QUALITY } from './settings-config.js';

export function createWeather(scene, reducedMotion) {
  const weather = new THREE.Group();
  weather.name = 'Rain, eave drips and water rings';
  scene.add(weather);
  const uniforms = { uTime: { value: 7.4 }, uIntensity: { value: reducedMotion ? .45 : 1 } };
  const count = matchMedia('(max-width: 700px)').matches ? 500 : 820;
  const positions = [], seeds = [], ends = [];
  for (let i = 0; i < count; i++) {
    const x = random() * 13.55 - 6.775, y = random() * 8.2, z = random() * 13.55 - 6.775;
    const seed = random();
    for (let j = 0; j < 2; j++) { positions.push(x, y, z); seeds.push(seed); ends.push(j); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
  const rainMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      attribute float aEnd;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        vec3 p = position;
        float fall = mod(position.y - uTime * (5.3 + aSeed * 3.3), 8.2);
        p.y = fall + aEnd * (.12 + aSeed * .15);
        p.x = position.x + (fall - 4.1) * .053 + aEnd * .014;
        p.z = position.z + (fall - 4.1) * .022;
        float inside = step(-5.42, p.x) * step(p.x, 2.72) * step(-4.83, p.z) * step(p.z, 1.9);
        float sheltered = inside * (1.0 - step(3.82, p.y));
        vAlpha = (.14 + aSeed * .23) * (1.0 - sheltered) * smoothstep(.13, .45, p.y);
        vAlpha *= (1.0 - smoothstep(6.5, 6.98, abs(p.x))) * (1.0 - smoothstep(6.5, 6.98, abs(p.z)));
        float warmth = (1.0 - smoothstep(0.0, 3.5, distance(p.xz, vec2(-2., 2.2)))) * .62;
        vColor = mix(vec3(.54, .72, .83), vec3(1., .86, .61), warmth);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      varying float vAlpha;
      varying vec3 vColor;
      void main() { gl_FragColor = vec4(vColor, vAlpha * uIntensity); }
    `,
  });
  const rain = new THREE.LineSegments(geometry, rainMaterial);
  rain.frustumCulled = false; weather.add(rain);

  const dropsGeo = new THREE.BufferGeometry(), dp = [], ds = [], de = [];
  for (let i = 0; i < 35; i++) {
    const x = -5.30 + random() * 7.95;
    for (let end = 0; end < 2; end++) { dp.push(x, 0, 1.899); ds.push(i / 35); de.push(end); }
  }
  dropsGeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  dropsGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(ds, 1));
  dropsGeo.setAttribute('aEnd', new THREE.Float32BufferAttribute(de, 1));
  const drips = new THREE.LineSegments(dropsGeo, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      uniform float uTime; attribute float aSeed; attribute float aEnd; varying float vAlpha;
      void main() {
        float p = fract(uTime * (.65 + aSeed * .25) + aSeed * 7.);
        vec3 pt = position; pt.y = 2.76 - p * p * 2.47 + aEnd * (.03 + p * .15);
        vAlpha = smoothstep(.04, .19, p) * .56;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pt, 1.);
      }
    `,
    fragmentShader: `varying float vAlpha; void main() { gl_FragColor = vec4(.76, .87, .87, vAlpha); }`,
  }));
  drips.frustumCulled = false; weather.add(drips);

  const ringBase = new THREE.PlaneGeometry(1, 1);
  ringBase.rotateX(-Math.PI / 2);
  const ringGeo = new THREE.InstancedBufferGeometry();
  ringGeo.index = ringBase.index; ringGeo.attributes.position = ringBase.attributes.position; ringGeo.attributes.uv = ringBase.attributes.uv;
  const centers = [], phases = [], sizes = [];
  for (let i = 0; i < 87; i++) {
    let x = random() * 13.3 - 6.65, z = random() * 13.3 - 6.65;
    if (x > -5.4 && x < 2.7 && z > -4.85 && z < 1.83) { i--; continue; }
    const y = x < 3.8 && z < 2.66 ? .279 : .177;
    centers.push(x, y, z); phases.push(random()); sizes.push(.23 + random() * .62);
  }
  // Drops striking the flat roof are a quiet detail when viewed from above.
  for (let i = 0; i < 13; i++) { centers.push(-4.8 + random() * 7.0, 3.738, -4.35 + random() * 5.55); phases.push(random()); sizes.push(.2 + random() * .27); }
  ringGeo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(new Float32Array(centers), 3));
  ringGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(phases), 1));
  ringGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(sizes), 1));
  ringGeo.instanceCount = phases.length;
  const rings = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime; attribute vec3 aCenter; attribute float aPhase; attribute float aSize;
      varying vec2 vUv; varying float vFade;
      void main() {
        float t = fract(uTime * .56 + aPhase);
        vec3 p = aCenter + position * (.08 + t * aSize);
        vUv = uv; vFade = pow(1. - t, 1.7) * smoothstep(0., .08, t);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }
    `,
    fragmentShader: `
      varying vec2 vUv; varying float vFade;
      void main() {
        float r = length((vUv - .5) * 2.);
        float ring = smoothstep(.86, .91, r) - smoothstep(.94, .99, r);
        float inner = (smoothstep(.53, .56, r) - smoothstep(.58, .61, r)) * .3;
        gl_FragColor = vec4(.60, .77, .82, (ring + inner) * vFade * .36);
      }
    `,
  }));
  rings.frustumCulled = false; weather.add(rings);

  const streakMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      float hash(float x) { return fract(sin(x * 173.31) * 3451.32); }
      void main() {
        float col = floor(vUv.x * 41.);
        float rand = hash(col);
        float x = fract(vUv.x * 41.) - .5 + sin(vUv.y * 19. + col) * .035;
        float tip = fract(rand * 7. + uTime * (.046 + rand * .058));
        float trail = tip - (1. - vUv.y);
        float line = (1. - smoothstep(.016, .055, abs(x))) * smoothstep(-.008, .008, trail) * (1. - smoothstep(.0, .28, trail));
        float drop = (1. - smoothstep(.017, .037, length(vec2(x * .42, trail * 12.))));
        gl_FragColor = vec4(.76, .85, .82, (line * .19 + drop * .26) * step(.22, rand));
      }
    `,
  });
  for (const [x, w] of [[-3.77, 2.49], [-1.16, 2.56]]) plane(weather, w, 2.07, [x, 1.705, 1.42], streakMaterial);
  for (const [z, w] of [[-3.54, 1.80], [-1.65, 1.84], [.32, 1.96]]) plane(weather, w, 2.07, [2.452, 1.705, z], streakMaterial, [0, Math.PI / 2, 0]);
  weather.traverse(o => { o.layers.set(1); o.userData.dynamic = true; });
  const fullRingCount = ringGeo.instanceCount;
  let activeCount = count;
  return {
    update(time) { uniforms.uTime.value = time; },
    setAmount(amount) {
      const density = THREE.MathUtils.clamp(amount / 100, 0, 1);
      activeCount = Math.round(count * density);
      weather.visible = density > 0;
      geometry.setDrawRange(0, activeCount * 2);
      dropsGeo.setDrawRange(0, Math.round(35 * density) * 2);
      ringGeo.instanceCount = Math.round(fullRingCount * density);
    },
    get count() { return activeCount; },
    root: weather,
  };
}

// A single cached reflection serves every puddle. The mirrored orthographic
// camera uses a general oblique clip plane, so the plinth is never reflected.
export function createWetRoad(scene, renderer, camera) {
  const target = new THREE.WebGLRenderTarget(768, 768, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  target.texture.name = 'Cached rainwater reflections';
  const mirrorCamera = camera.clone(); mirrorCamera.layers.set(0);
  const bias = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
  const texMatrix = new THREE.Matrix4();
  const height = .168;
  const uniforms = { tReflection: { value: target.texture }, textureMatrix: { value: texMatrix }, uTime: { value: 0 } };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(13.84, 13.84), new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      uniform mat4 textureMatrix; varying vec4 vProjected; varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.); vWorld = world.xyz;
        vProjected = textureMatrix * world;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D tReflection; uniform float uTime;
      varying vec4 vProjected; varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      void main() {
        float street = max(smoothstep(2.79,3.02,vWorld.z), smoothstep(3.93,4.2,vWorld.x));
        if (street < .01) discard;
        float n = noise(vWorld.xz * 1.0) * .58 + noise(vWorld.xz * 2.9) * .25 + noise(vWorld.xz * 9.) * .17;
        float pools = smoothstep(.30,.65,n);
        vec2 uv = vProjected.xy / vProjected.w;
        vec2 distortion = vec2(sin(vWorld.z * 54. + uTime * 1.1), cos(vWorld.x * 39. - uTime * 1.3)) * .0009;
        vec3 col = texture2D(tReflection, uv + distortion).rgb * .53;
        col += texture2D(tReflection, uv + distortion + vec2(.0017,0.)).rgb * .235;
        col += texture2D(tReflection, uv + distortion - vec2(.0017,0.)).rgb * .235;
        float sheen = smoothstep(.38,.5,n) - smoothstep(.5,.56,n);
        col = mix(col, vec3(.26,.39,.47), .12) + sheen * .025;
        float alpha = street * (.09 + pools * .47);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  }));
  water.name = 'Broken, rippling reflections on wet asphalt';
  water.rotation.x = -Math.PI / 2; water.position.y = height; water.renderOrder = 2;
  scene.add(water);
  const point = new THREE.Vector3(), look = new THREE.Vector3(), direction = new THREE.Vector3();
  const clipPlane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const inverse = new THREE.Matrix4();
  let updates = 0, quality = 'medium', width = 768, viewHeight = 768;
  function resizeTarget() {
    const aspect = width / viewHeight;
    const size = REFLECTION_QUALITY[quality].size;
    target.setSize(quality === 'off' ? 1 : Math.max(1, Math.round(size * Math.min(1, aspect))), quality === 'off' ? 1 : Math.max(1, Math.round(size / Math.max(1, aspect))));
  }
  return {
    update(time, refresh = true) {
      uniforms.uTime.value = time;
      if (!refresh || quality === 'off') return false;
      camera.updateMatrixWorld();
      mirrorCamera.copy(camera, false); mirrorCamera.layers.set(0);
      point.copy(camera.position); point.y = 2 * height - point.y;
      camera.getWorldDirection(direction);
      look.copy(camera.position).add(direction); look.y = 2 * height - look.y;
      mirrorCamera.position.copy(point); mirrorCamera.up.set(0, -1, 0); mirrorCamera.lookAt(look);
      mirrorCamera.updateMatrixWorld();
      mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);
      texMatrix.copy(bias).multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
      clipPlane.set(new THREE.Vector3(0, 1, 0), -height).applyMatrix4(mirrorCamera.matrixWorldInverse);
      clip.set(clipPlane.normal.x, clipPlane.normal.y, clipPlane.normal.z, clipPlane.constant);
      inverse.copy(mirrorCamera.projectionMatrix).invert();
      q.set(Math.sign(clip.x), Math.sign(clip.y), 1, 1).applyMatrix4(inverse);
      clip.multiplyScalar(2 / clip.dot(q));
      const m = mirrorCamera.projectionMatrix.elements;
      m[2] = clip.x - m[3]; m[6] = clip.y - m[7]; m[10] = clip.z - m[11]; m[14] = clip.w - m[15];
      const previousTarget = renderer.getRenderTarget();
      water.visible = false;
      renderer.setRenderTarget(target); renderer.render(scene, mirrorCamera);
      renderer.setRenderTarget(previousTarget); water.visible = true;
      updates++;
      return true;
    },
    resize(nextWidth, nextHeight) {
      width = nextWidth; viewHeight = nextHeight;
      resizeTarget();
    },
    setQuality(nextQuality) {
      if (!Object.hasOwn(REFLECTION_QUALITY, nextQuality)) return;
      quality = nextQuality;
      water.visible = quality !== 'off';
      resizeTarget();
    },
    get enabled() { return quality !== 'off'; },
    get interval() { return REFLECTION_QUALITY[quality].interval; },
    get resolution() { return [target.width, target.height]; },
    get updates() { return updates; },
    dispose() { target.dispose(); water.geometry.dispose(); water.material.dispose(); },
  };
}
