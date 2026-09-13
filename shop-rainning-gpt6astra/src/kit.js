import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const palette = {
  ink: '#162337', asphalt: '#354458', concrete: '#6d7c8b', stone: '#8b9aab',
  cream: '#e9dec0', ivory: '#f4eed7', mint: '#72bcb0', teal: '#267e79',
  coral: '#e99679', blue: '#5b8ca9', navy: '#2c435c', yellow: '#d9b972',
  steel: '#586a7e', pale: '#afbdbe', wood: '#bc9070', dark: '#202d3b',
};

const ramp = new THREE.DataTexture(new Uint8Array([90, 151, 209, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;
const materialCache = new Map();
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const roundBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.035);
const edgeMaterial = new THREE.LineBasicMaterial({ color: '#142334', transparent: true, opacity: 0.49 });

export function material(color, options = {}) {
  const key = JSON.stringify([color, options]);
  if (!materialCache.has(key)) {
    const config = { color, gradientMap: ramp, ...options };
    materialCache.set(key, new THREE.MeshToonMaterial(config));
  }
  return materialCache.get(key);
}

export function basic(color, opacity = 1) {
  const key = `basic:${color}:${opacity}`;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1, opacity, depthWrite: opacity === 1,
    toneMapped: false, side: THREE.DoubleSide,
  }));
  return materialCache.get(key);
}

export function mesh(parent, geometry, mat, position = [0, 0, 0], outline = false) {
  const object = new THREE.Mesh(geometry, typeof mat === 'string' ? material(mat) : mat);
  object.position.set(...position);
  object.castShadow = !object.material.transparent && !object.material.isMeshBasicMaterial;
  object.receiveShadow = !object.material.transparent && !object.material.isMeshBasicMaterial;
  object.userData.mergeStatic = true;
  parent.add(object);
  if (outline) {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 32), edgeMaterial);
    edges.userData.mergeStatic = true;
    object.add(edges);
  }
  return object;
}

export function box(parent, size, position, mat, outline = true, rounded = false) {
  const object = mesh(parent, rounded ? roundBox : unitBox, mat, position, outline);
  object.scale.set(...size);
  return object;
}

export function cylinder(parent, radius, height, position, mat, radiusTop = radius, segments = 12, outline = false) {
  return mesh(parent, new THREE.CylinderGeometry(radiusTop, radius, height, segments), mat, position, outline);
}

export function sphere(parent, radius, position, mat, scale = [1, 1, 1]) {
  const object = mesh(parent, new THREE.SphereGeometry(radius, 12, 8), mat, position);
  object.scale.set(...scale);
  return object;
}

export function tube(parent, points, radius, mat, curved = false) {
  const pts = points.map(p => new THREE.Vector3(...p));
  const curve = curved ? new THREE.CatmullRomCurve3(pts) : new THREE.LineCurve3(pts[0], pts[1]);
  return mesh(parent, new THREE.TubeGeometry(curve, curved ? 24 : 1, radius, 6, false), mat);
}

export function line(parent, points, color = '#25374b', opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
  const m = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  const result = new THREE.Line(geometry, m);
  parent.add(result);
  return result;
}

export function torus(parent, radius, thickness, position, mat, rotation = [0, 0, 0], arc = Math.PI * 2) {
  const object = mesh(parent, new THREE.TorusGeometry(radius, thickness, 6, 32, arc), mat, position);
  object.rotation.set(...rotation);
  return object;
}

export function group(parent, position = [0, 0, 0], rotationY = 0) {
  const result = new THREE.Group();
  result.position.set(...position);
  result.rotation.y = rotationY;
  parent.add(result);
  return result;
}

export function plane(parent, w, h, position, mat, rotation = [0, 0, 0]) {
  const object = mesh(parent, new THREE.PlaneGeometry(w, h), mat, position);
  object.rotation.set(...rotation);
  object.castShadow = false;
  return object;
}

export function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function imageMaterial(texture, emissive = 0) {
  const m = new THREE.MeshStandardMaterial({
    map: texture, roughness: 0.8, metalness: 0,
    emissive: emissive ? '#ffffff' : '#000000', emissiveMap: texture, emissiveIntensity: emissive,
    side: THREE.DoubleSide,
  });
  return m;
}

export const japaneseFont = '"Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif';

export function textTexture(text, { bg = '#f3ead4', color = '#236e68', width = 768, height = 192, size = 90, sub = '', border = false } = {}) {
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (border) { ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.strokeRect(10, 10, w - 20, h - 20); }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${size}px ${japaneseFont}`;
    ctx.fillText(text, w / 2, h * (sub ? .41 : .52));
    if (sub) { ctx.font = `500 ${Math.round(size * .25)}px ${japaneseFont}`; ctx.fillText(sub, w / 2, h * .83); }
  });
}

export function label(parent, text, w, h, position, options = {}, rotation = [0, 0, 0]) {
  return plane(parent, w, h, position, imageMaterial(textTexture(text, options), options.emissive ?? .18), rotation);
}

let seed = 58342;
export function random() {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

const glowTexture = canvasTexture(128, 128, (ctx, w) => {
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.65)');
  g.addColorStop(.25, 'rgba(255,255,255,0.22)');
  g.addColorStop(.65, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
});

export function glow(parent, position, color, width, height = width, opacity = .4) {
  const m = new THREE.SpriteMaterial({ map: glowTexture, color, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(m);
  sprite.position.set(...position); sprite.scale.set(width, height, 1);
  parent.add(sprite);
  return sprite;
}

export function groundGlow(parent, position, color, width, depth, opacity = .25) {
  const m = new THREE.MeshBasicMaterial({ map: glowTexture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  return plane(parent, width, depth, position, m, [-Math.PI / 2, 0, 0]);
}

export function pointLight(parent, position, color, intensity = 6, distance = 5) {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.set(...position); parent.add(light);
  return light;
}

// Static architecture, products and contour lines become a few material batches.
// Animated meshes retain their own transforms and are never included in a batch.
export function mergeStaticMeshes(root) {
  root.updateMatrixWorld(true);
  const batches = new Map();
  const remove = [];
  const edgeGeometries = [];
  root.traverse(object => {
    if (!object.userData.mergeStatic) return;
    let cursor = object;
    while (cursor) {
      if (cursor.userData.dynamic) return;
      cursor = cursor.parent;
    }
    if (object.isLineSegments && object.material === edgeMaterial) {
      edgeGeometries.push(object.geometry.clone().applyMatrix4(object.matrixWorld));
      remove.push(object); return;
    }
    if (!object.isMesh || Array.isArray(object.material)) return;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    if (!batches.has(key)) batches.set(key, { material: object.material, cast: object.castShadow, receive: object.receiveShadow, geometries: [] });
    let geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (geometry.index) geometry = geometry.toNonIndexed();
    for (const attr of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'uv'].includes(attr)) geometry.deleteAttribute(attr);
    }
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    geometry.clearGroups();
    batches.get(key).geometries.push(geometry);
    remove.push(object);
  });
  for (const object of remove) object.removeFromParent();
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries, false);
    batch.geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    const result = new THREE.Mesh(geometry, batch.material);
    result.castShadow = batch.cast; result.receiveShadow = batch.receive;
    result.name = 'Static material batch'; root.add(result);
  }
  if (edgeGeometries.length) {
    const edges = new THREE.LineSegments(mergeGeometries(edgeGeometries, false), edgeMaterial);
    edges.name = 'Ink contours'; root.add(edges);
    edgeGeometries.forEach(g => g.dispose());
  }
  return batches.size;
}
