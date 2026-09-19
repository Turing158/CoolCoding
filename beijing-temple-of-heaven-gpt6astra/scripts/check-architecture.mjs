import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTemple } from '../src/temple.js';
import { roofProfile } from '../src/roofs.js';
import { readOptions, ROOFS } from '../src/config.js';
import { layerProgress } from '../src/motion.js';

// The real geometry and animation run under Node; this check does not start WebGL.
const materialNames = ['roof', 'roofRib', 'roofEdge', 'underRoof', 'red', 'deepRed', 'gold', 'mutedGold', 'jade', 'blue', 'paint', 'marble', 'white', 'marbleShade', 'shutter', 'plaque', 'carving'];
const materials = Object.fromEntries(materialNames.map((name) => [name, new THREE.MeshStandardMaterial()]));
const temple = createTemple(materials);
assert.equal(THREE.REVISION, '160');
assert.equal(temple.columns.length, 28);
assert.equal(temple.roofs.length, 3);
assert.equal(temple.terraces.length, 3);
assert.ok(temple.stats.instances > 3000, 'Repeated details must be instanced');

let geometryCount = 0;
const uniqueGeometries = new Set();
temple.root.traverse((object) => {
  if (!object.isMesh) return;
  const positions = object.geometry.attributes.position;
  if (!uniqueGeometries.has(object.geometry.uuid)) {
    uniqueGeometries.add(object.geometry.uuid);
    for (const value of positions.array) assert.ok(Number.isFinite(value), `${object.name}: nonfinite vertex`);
    for (const value of object.geometry.attributes.normal.array) assert.ok(Number.isFinite(value), `${object.name}: nonfinite normal`);
    object.geometry.computeBoundingBox();
    geometryCount++;
  }
  if (object.isInstancedMesh) {
    for (const value of object.instanceMatrix.array) assert.ok(Number.isFinite(value), 'Invalid instance transform');
  }
});

for (const spec of ROOFS) {
  const points = roofProfile(spec, 100);
  assert.ok(points[2].y < points[0].y, 'The eave must turn slightly upward');
  const middle = points[50];
  const linearY = (points[0].y + points[100].y) / 2;
  assert.ok(Math.abs(middle.y - linearY) > .4, 'The roof must be curved, not conical');
  for (let i = 1; i < points.length; i++) assert.ok(points[i].x < points[i - 1].x, 'No self-intersecting radial profile');
}

const originals = [];
temple.root.traverse((object) => {
  originals.push({ object, position: object.position.clone(), matrix: object.isInstancedMesh ? object.instanceMatrix.array.slice() : null });
});

const { exploder } = temple;
exploder.setTarget(true);
exploder.update(.9);
assert.ok(layerProgress(exploder.progress, 0) > 0);
assert.equal(layerProgress(exploder.progress, .4), 0, 'Top and foundation should start at different times');
const beforeReverse = originals.map(({ object }) => object.position.clone());
exploder.setTarget(false);
originals.forEach(({ object }, i) => assert.ok(object.position.equals(beforeReverse[i]), 'Reversing target must not teleport'));
exploder.update(.01);
originals.forEach(({ object }, i) => assert.ok(object.position.distanceTo(beforeReverse[i]) < .2, 'Reverse motion must be continuous'));

for (let cycle = 0; cycle < 12; cycle++) {
  exploder.setTarget(true);
  while (exploder.active) exploder.update(1 / 30);
  assert.equal(exploder.progress, 1);
  temple.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(temple.root);
  assert.ok(bounds.max.y > 42 && bounds.max.y < 46, 'Exploded layers must separate to the intended height');
  assert.ok(bounds.min.y >= -.01, 'No moving component should sink below the plaza');
  exploder.setTarget(false);
  while (exploder.active) exploder.update(1 / 30);
  assert.equal(exploder.progress, 0);
  for (const { object, position, matrix } of originals) {
    assert.ok(object.position.equals(position), `${object.name}: exact original position must be restored`);
    if (matrix) assert.deepEqual(object.instanceMatrix.array, matrix, `${object.name}: instances drifted`);
  }
}
assert.equal(readOptions('?test=1').fps, 6);
assert.equal(readOptions('?test=1').frames, 12);
assert.equal(readOptions('?fps=NaN&frames=-7').fps, 30);
assert.equal(readOptions('?fps=1000&frames=100000').frames, 240);
assert.equal(readOptions('?quality=__proto__').quality, 'balanced');

console.log(`Three.js r${THREE.REVISION}: ${geometryCount} unique geometry buffers, ${temple.stats.instances} instances, ${Math.round(temple.stats.triangles).toLocaleString()} architectural triangles.`);
console.log('PASS: 3 curved/eave-upturned roofs, 3 marble terraces, 28 pillars, finite vertices and normals, bounded exploded height.');
console.log('PASS: staggered motion, mid-animation reversal, 12 complete explode/reassemble cycles with exact transform restoration.');
console.log('PASS: diagnostic URL input clamping. No WebGL context or animation loop was started.');
