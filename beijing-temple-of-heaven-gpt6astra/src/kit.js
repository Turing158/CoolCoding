import * as THREE from 'three';

export const geometries = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  sphere: new THREE.SphereGeometry(1, 10, 7),
};

export function seededRandom(seed = 1430) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function mesh(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

export function ring(parent, radius, tube, height, material, segments = 160) {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 6, segments), material, [0, height, 0], [Math.PI / 2, 0, 0]);
}

export function layer(root, exploder, name, lift, delay, horizontal = [0, 0]) {
  const group = new THREE.Group();
  group.name = name;
  root.add(group);
  exploder.registerObject(group, [horizontal[0], lift, horizontal[1]], delay);
  return group;
}

/** One draw call per geometry/material pair, with optional radial separation. */
export class InstanceBatch {
  constructor(parent, { exploder, radial = 0, delay = 0, shadows = true } = {}) {
    this.parent = parent;
    this.exploder = exploder;
    this.radial = radial;
    this.delay = delay;
    this.shadows = shadows;
    this.buckets = new Map();
    this.dummy = new THREE.Object3D();
  }

  add(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], color = null) {
    const key = `${geometry.uuid}:${material.uuid}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { geometry, material, items: [] });
    this.dummy.position.set(...position);
    this.dummy.scale.set(...scale);
    this.dummy.rotation.set(rotation[0], rotation[1], rotation[2], 'YXZ');
    this.dummy.updateMatrix();
    this.buckets.get(key).items.push({ matrix: this.dummy.matrix.clone(), color });
  }

  box(material, position, scale, rotation = [0, 0, 0], color = null) {
    this.add(geometries.box, material, position, scale, rotation, color);
  }

  cylinder(material, position, radius, height, rotation = [0, 0, 0]) {
    this.add(geometries.cylinder, material, position, [radius, height, radius], rotation);
  }

  sphere(material, position, scale) {
    this.add(geometries.sphere, material, position, Array.isArray(scale) ? scale : [scale, scale, scale]);
  }

  radialBox(material, angle, radius, y, scale, extraRotation = [0, 0, 0]) {
    this.box(material, [Math.sin(angle) * radius, y, Math.cos(angle) * radius], scale, [extraRotation[0], angle + extraRotation[1], extraRotation[2]]);
  }

  finish() {
    const meshes = [];
    for (const bucket of this.buckets.values()) {
      const item = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.items.length);
      item.name = `${this.parent.name}-instances`;
      item.castShadow = this.shadows;
      item.receiveShadow = true;
      const offsets = new Float32Array(bucket.items.length * 3);
      bucket.items.forEach((entry, index) => {
        item.setMatrixAt(index, entry.matrix);
        if (entry.color) item.setColorAt(index, entry.color);
        const x = entry.matrix.elements[12];
        const z = entry.matrix.elements[14];
        const length = Math.hypot(x, z) || 1;
        offsets[index * 3] = x / length * this.radial;
        offsets[index * 3 + 2] = z / length * this.radial;
      });
      item.instanceMatrix.setUsage(this.radial ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
      item.computeBoundingSphere();
      this.parent.add(item);
      if (this.radial && this.exploder) this.exploder.registerInstances(item, offsets, this.delay);
      meshes.push(item);
    }
    this.buckets.clear();
    return meshes;
  }
}

export function disposeScene(scene) {
  const geoms = new Set();
  const materials = new Set();
  const textures = new Set();
  scene.traverse((object) => {
    if (object.geometry) geoms.add(object.geometry);
    const values = Array.isArray(object.material) ? object.material : [object.material];
    for (const value of values) if (value) materials.add(value);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  geoms.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
}
