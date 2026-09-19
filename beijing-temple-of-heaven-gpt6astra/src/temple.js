import { Group } from 'three';
import { Exploder } from './motion.js';
import { createRoofs } from './roofs.js';
import { createTerraces } from './terraces.js';
import { createTimber } from './timber.js';

export function createTemple(materials) {
  const root = new Group();
  root.name = 'hall-of-prayer-for-good-harvests';
  const exploder = new Exploder();
  const terraces = createTerraces(root, materials, exploder);
  const columns = createTimber(root, materials, exploder);
  const roofs = createRoofs(root, materials, exploder);
  const stats = { meshes: 0, instanceBatches: 0, instances: 0, triangles: 0, columns: columns.length, roofs: roofs.length, terraces: terraces.length };
  root.traverse((object) => {
    if (!object.isMesh) return;
    stats.meshes++;
    if (object.isInstancedMesh) {
      stats.instanceBatches++;
      stats.instances += object.count;
    }
    const triangles = (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    stats.triangles += triangles * (object.isInstancedMesh ? object.count : 1);
  });
  return { root, exploder, stats, columns, roofs, terraces };
}
