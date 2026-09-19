import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const palette = {
  cream: '#f0e7cf', ivory: '#faf1d9', white: '#f6f3df', tan: '#cdae7d', sand: '#ddc9a0',
  brick: '#aa6748', rust: '#bc7250', brown: '#654535', chocolate: '#4e3b32',
  road: '#566163', roadDark: '#414e51', navy: '#294950', glass: '#436b75',
  green: '#519157', leaf: '#79a653', lime: '#a2be69', deepGreen: '#346b4a',
  red: '#d94838', orange: '#ed843f', yellow: '#f2c548', blue: '#548fa6',
  mint: '#8ab6a7', pink: '#d79c9a', black: '#2e3736', metal: '#9fa9a2', skin: '#f8cf51',
};

const geometries = new Map();
const materials = new Map();

function geometryFor(type) {
  if (geometries.has(type)) return geometries.get(type);
  let geometry;
  switch (type) {
    case 'soft': geometry = new RoundedBoxGeometry(1, 1, 1, 1, 0.07); break;
    case 'cylinder': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); break;
    case 'stud': geometry = new THREE.CylinderGeometry(0.145, 0.16, 0.10, 10); break;
    case 'cone': geometry = new THREE.CylinderGeometry(0.03, 0.5, 1, 8); break;
    case 'sphere': geometry = new THREE.SphereGeometry(0.5, 10, 7); break;
    case 'hand': geometry = new THREE.TorusGeometry(0.07, 0.024, 5, 10, Math.PI * 1.48); break;
    case 'smile': geometry = new THREE.TorusGeometry(0.064, 0.011, 4, 10, Math.PI); break;
    case 'torso': {
      geometry = new THREE.BoxGeometry(1, 1, 1);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        if (positions.getY(i) > 0) positions.setX(i, positions.getX(i) * 0.7);
      }
      geometry.computeVertexNormals();
      break;
    }
    case 'roof': {
      geometry = new THREE.BufferGeometry();
      const vertices = [-.5,-.5,-.5, .5,-.5,-.5, 0,.5,-.5, -.5,-.5,.5, .5,-.5,.5, 0,.5,.5];
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);
      geometry = geometry.toNonIndexed();
      geometry.computeVertexNormals();
      break;
    }
    default: geometry = new THREE.BoxGeometry(1, 1, 1);
  }
  geometries.set(type, geometry);
  return geometry;
}

function plasticMaterial(type) {
  const key = type === 'stud' ? 'stud' : 'plastic';
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      roughness: key === 'stud' ? 0.30 : 0.4,
      metalness: 0.025,
      envMapIntensity: 0.45,
    }));
  }
  return materials.get(key);
}

// Build with ordinary transform nodes, then draw thousands of parts in a few instanced batches.
// Dynamic batches retain the same instance slots for the entire lifetime of the scene.
export class LegoBatch {
  constructor({ dynamic = false } = {}) {
    this.root = new THREE.Group();
    this.group = new THREE.Group();
    this.dynamic = dynamic;
    this.buckets = new Map();
    this.meshes = [];
    this.partCount = 0;
  }

  node(parent = this.root, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const node = new THREE.Object3D();
    node.position.set(...position);
    node.rotation.set(...rotation);
    parent.add(node);
    return node;
  }

  part(type, position, scale, color, parent = this.root, rotation = [0, 0, 0], detail = 0) {
    const node = this.node(parent, position, rotation);
    node.scale.set(...scale);
    const key = `${type}:${detail}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { type, detail, records: [] });
    this.buckets.get(key).records.push({ node, color: new THREE.Color(color) });
    this.partCount++;
    return node;
  }

  box(x, y, z, w, h, d, color, parent = this.root, detail = 0, soft = false) {
    return this.part(soft ? 'soft' : 'box', [x, y, z], [w, h, d], color, parent, [0, 0, 0], detail);
  }

  cylinder(x, y, z, radius, height, color, parent = this.root, rotation = [0, 0, 0], detail = 0) {
    return this.part('cylinder', [x, y, z], [radius * 2, height, radius * 2], color, parent, rotation, detail);
  }

  studs(x, y, z, nx, nz, color, parent = this.root, detail = 1, pitch = 0.56) {
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        this.part('stud', [x + (ix - (nx - 1) / 2) * pitch, y + 0.05, z + (iz - (nz - 1) / 2) * pitch], [1, 1, 1], color, parent, [0, 0, 0], detail);
      }
    }
  }

  brick(x, y, z, w, h, d, color, parent = this.root, studLevel = 1) {
    this.box(x, y, z, w - 0.024, h - 0.018, d - 0.024, color, parent);
    if (studLevel >= 0) this.studs(x, y + h / 2, z, Math.max(1, Math.floor(w / .55)), Math.max(1, Math.floor(d / .55)), color, parent, studLevel);
  }

  rod(a, b, radius, color, parent = this.root, detail = 0) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const node = this.cylinder(...start.clone().add(end).multiplyScalar(.5).toArray(), radius, start.distanceTo(end), color, parent, [0, 0, 0], detail);
    node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    return node;
  }

  finish() {
    this.root.updateMatrixWorld(true);
    for (const bucket of this.buckets.values()) {
      const mesh = new THREE.InstancedMesh(geometryFor(bucket.type), plasticMaterial(bucket.type), bucket.records.length);
      mesh.name = `${this.dynamic ? 'moving' : 'static'}-${bucket.type}-detail-${bucket.detail}`;
      mesh.userData.detail = bucket.detail;
      mesh.castShadow = !this.dynamic && bucket.detail < 2;
      mesh.receiveShadow = true;
      if (this.dynamic) {
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
      }
      bucket.records.forEach((record, i) => {
        mesh.setMatrixAt(i, record.node.matrixWorld);
        mesh.setColorAt(i, record.color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      if (!this.dynamic) mesh.computeBoundingSphere();
      this.group.add(mesh);
      this.meshes.push({ mesh, records: bucket.records });
    }
    return this.group;
  }

  update() {
    if (!this.dynamic) return;
    this.root.updateMatrixWorld(true);
    for (const { mesh, records } of this.meshes) {
      if (!mesh.visible) continue;
      for (let i = 0; i < records.length; i++) mesh.setMatrixAt(i, records[i].node.matrixWorld);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  setDetail(level) {
    for (const { mesh } of this.meshes) mesh.visible = mesh.userData.detail <= level;
  }
}

export function seededRandom(seed = 158) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let signAtlas;
const signEntries = [
  ['GARAGE', '#f5e8c7', '#b45c47'], ['BRICK & BEAN', '#f6ecd7', '#3d6358'],
  ['POST OFFICE', '#f9edcf', '#ae7150'], ['CENTRAL PARK', '#faf0d4', '#56775c'],
  ['03  |  TRAM', '#f5ecce', '#c57743'], ['01', '#f7efd8', '#6a7873'],
  ['02', '#f7efd8', '#aa8b64'], ['03', '#f7efd8', '#b8794b'], ['04', '#f7efd8', '#6f8d59'],
  ['SLOW SUNDAYS', '#fbf2d9', '#598061'], ['BUS STOP', '#3f534b', '#eadbb7'],
  ['OPEN', '#faf1d7', '#b46347'], ['P', '#f8f0d7', '#537a91'],
  ['FRESH COFFEE', '#f8edda', '#544c3b'], ['STACKED', '#514f3d', '#f0e3c8'],
  ['4 LITTLE WORLDS', '#6a715e', '#f1e8d3'],
];

export function sign(text, width, height, position, rotation = [0, 0, 0]) {
  if (typeof document === 'undefined') return new THREE.Group();
  if (!signAtlas) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    signEntries.forEach(([label, foreground, background], index) => {
      const x = (index % 4) * 256;
      const y = Math.floor(index / 4) * 128;
      context.fillStyle = background;
      context.fillRect(x, y, 256, 128);
      context.strokeStyle = `${foreground}88`;
      context.lineWidth = 2;
      context.strokeRect(x + 7, y + 7, 242, 114);
      context.fillStyle = foreground;
      context.font = `600 ${label.length > 9 ? 24 : label.length > 3 ? 32 : 70}px 'Segoe UI', sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, x + 128, y + 66, 230);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    signAtlas = new THREE.MeshBasicMaterial({ map: texture, toneMapped: true });
  }
  const index = Math.max(0, signEntries.findIndex(([label]) => text === label));
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (index % 4 + .012 + uv.getX(i) * .976) / 4, (3 - Math.floor(index / 4) + .016 + uv.getY(i) * .968) / 4);
  }
  const mesh = new THREE.Mesh(geometry, signAtlas);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}

export function createBlobTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(35,43,31,0.24)');
  gradient.addColorStop(.5, 'rgba(35,43,31,0.12)');
  gradient.addColorStop(1, 'rgba(35,43,31,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
