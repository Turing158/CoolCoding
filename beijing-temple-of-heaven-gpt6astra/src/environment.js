import * as THREE from 'three';
import { InstanceBatch, mesh, seededRandom } from './kit.js';
import { createSkyTexture } from './materials.js';

export function createEnvironment(scene, materials) {
  const sky = createSkyTexture();
  sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = sky;
  scene.environment = sky;
  scene.backgroundIntensity = 1;
  scene.fog = new THREE.Fog('#9abbd5', 95, 210);

  materials.paving.map.repeat.setScalar(2000 / 17.5);
  const ground = mesh(scene, new THREE.PlaneGeometry(2000, 2000), materials.paving, [0, .01, 0], [-Math.PI / 2, 0, 0]);
  ground.name = 'stone-plaza';
  ground.castShadow = false;

  const landscape = new THREE.Group();
  landscape.name = 'courtyard-cypresses';
  scene.add(landscape);
  const trees = new InstanceBatch(landscape);
  const random = seededRandom(338);
  const canopyGeometry = new THREE.IcosahedronGeometry(1, 1);
  const stone = new InstanceBatch(landscape);

  const positions = [
    [-25.5, -16, 7.4], [-30, -4, 8.3], [-27.5, 9, 6.6],
    [25.5, -18, 8.5], [30.5, -5, 7.7], [28.5, 11.5, 6.4],
    [-18.5, -29, 7.4], [16.5, -31, 6.7],
  ];
  for (const [x, z, height] of positions) {
    trees.cylinder(materials.trunk, [x, height * .28, z], .21, height * .56);
    for (let level = 0; level < 6; level++) {
      const y = height * (.26 + level * .11);
      const radius = height * (.19 - level * .022);
      for (let branch = 0; branch < 3; branch++) {
        const angle = branch / 3 * Math.PI * 2 + level * 1.31;
        const offset = radius * .34;
        const color = new THREE.Color().setHSL(.22 + random() * .07, .19 + random() * .08, .7 + random() * .2);
        trees.add(canopyGeometry, materials.foliage, [x + Math.sin(angle) * offset, y, z + Math.cos(angle) * offset], [radius * (.75 + random() * .22), height * .2, radius * .86], [0, angle, .12 * (random() - .5)], color);
      }
    }
    stone.box(materials.white, [x, .16, z], [5.7, .32, 5.7]);
    stone.box(materials.grass, [x, .335, z], [5.3, .08, 5.3]);
    for (let shrub = 0; shrub < 8; shrub++) {
      const angle = shrub / 8 * Math.PI * 2;
      trees.add(canopyGeometry, materials.foliage, [x + Math.sin(angle) * 2, .64, z + Math.cos(angle) * 2], [.52, .43, .5], [0, random() * 3, 0]);
    }
  }
  // Restrained perimeter: the hall remains the only substantial building.
  for (const side of [-1, 1]) {
    stone.box(materials.marbleShade, [side * 37, .55, -28], [.6, 1.1, 49]);
    stone.box(materials.white, [side * 37, 1.14, -28], [.76, .12, 49]);
  }
  stone.box(materials.marbleShade, [0, .55, -52], [74, 1.1, .6]);
  stone.box(materials.white, [0, 1.14, -52], [74, .12, .76]);
  // A broad, quiet central stone avenue anchors the south-facing stairs.
  stone.box(materials.marbleShade, [0, .023, 45], [7.9, .022, 48]);
  for (let step = 0; step < 28; step++) {
    stone.box(materials.marble, [0, .043, 22 + step * 1.7], [7.6, .03, 1.66]);
  }
  trees.finish();
  stone.finish();

  const hemisphere = new THREE.HemisphereLight('#dae8fb', '#829078', 1.25);
  scene.add(hemisphere);
  const ambient = new THREE.AmbientLight('#f2e7d2', .22);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff7e8', 2.75);
  sun.position.set(-28, 42, 32);
  sun.target.position.set(0, 8, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -34;
  sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 120;
  sun.shadow.normalBias = .055;
  sun.shadow.bias = -.00015;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  return { sun, sky };
}
