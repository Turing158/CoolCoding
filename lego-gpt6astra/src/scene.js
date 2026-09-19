import * as THREE from 'three';
import { LegoBatch, palette as p, sign, seededRandom } from './kit.js';
import { TrafficSystem, PollenPool, roundedRoute, collider } from './motion.js';
import { createCar, createTransit, createPerson, createTree, createPlanter, createLamp, createBench, createCone } from './models.js';

export const FLOOR_GAP = 5.45;
export const FLOOR_BASE = .74;
export const stories = [
  { title: '车库进行时', caption: '拧好最后一颗螺丝，红色小车又要出发了。', color: '#a85c53' },
  { title: '转角好天气', caption: '咖啡刚刚煮好，黄色巴士准时路过转角。', color: '#a8804e' },
  { title: '电车慢时光', caption: '下一站是公园，今天可以走得慢一点。', color: '#c7723d' },
  { title: '云上花园', caption: '把车停好，把周末留给树影和好朋友。', color: '#69844c' },
];

function createFloor(index) {
  const root = new THREE.Group();
  root.name = `floor-${index + 1}`;
  root.position.y = FLOOR_BASE + index * FLOOR_GAP;
  const fixed = new LegoBatch();
  const moving = new LegoBatch({ dynamic: true });
  const color = [p.road, p.sand, p.green, p.green][index];
  fixed.box(0, -.26, 0, 18.25, .16, 14.25, p.tan);
  fixed.box(0, -.065, 0, 18.35, .32, 14.35, p.cream, fixed.root, 0, true);
  fixed.box(0, .135, 0, 17.95, .10, 13.95, color);
  fixed.studs(0, .145, 0, 31, 23, color, fixed.root, 2);
  // Separate lip tiles make the stacking seams readable at a distance.
  for (let i = 0; i < 16; i++) {
    const x = (i - 7.5) * 1.12;
    for (const z of [-7.14, 7.14]) fixed.box(x, -.045, z, 1.085, .21, .13, i % 4 === 0 ? p.ivory : p.cream, fixed.root, 1);
  }
  for (let i = 0; i < 12; i++) {
    const z = (i - 5.5) * 1.12;
    for (const x of [-9.14, 9.14]) fixed.box(x, -.045, z, .13, .21, 1.085, p.cream, fixed.root, 1);
  }
  root.add(sign(`0${index + 1}`, .62, .28, [-7.72, -.04, 7.22]));
  return { index, root, fixed, moving, visuals: [], particles: null };
}

function addObstacle(town, floor, name, shape) {
  return town.traffic.addObstacle(floor.index, collider(`${floor.index}-${name}`, shape.x, shape.z, shape.halfX, shape.halfZ, shape.yaw || 0));
}

function plant(town, floor, x, z, options = {}) {
  const body = createPlanter(floor.fixed, x, z, options);
  addObstacle(town, floor, `planter-${x}-${z}`, body);
}

function tree(town, floor, x, z, options = {}) {
  const body = createTree(floor.fixed, x, z, options);
  addObstacle(town, floor, `tree-${x}-${z}`, body);
}

function lamp(town, floor, x, z, height = 2.7) {
  addObstacle(town, floor, `lamp-${x}-${z}`, createLamp(floor.fixed, x, z, height));
}

function bench(town, floor, x, z, rotation = 0) {
  addObstacle(town, floor, `bench-${x}-${z}`, createBench(floor.fixed, x, z, rotation));
}

function vehicle(town, floor, config) {
  const model = config.type === 'bus' || config.type === 'tram' ? createTransit(floor.moving, config.type) : createCar(floor.moving, config);
  const actor = town.traffic.addActor({ ...model, ...config, level: floor.index, kind: 'vehicle' });
  floor.visuals.push({ actor, model, person: false });
  return actor;
}

function person(town, floor, config) {
  const model = createPerson(floor.moving, config);
  const actor = town.traffic.addActor({ halfX: .35 * (config.scale || 1), halfZ: .44 * (config.scale || 1), ...config, level: floor.index, kind: 'person' });
  floor.visuals.push({ actor, model, person: true });
  return actor;
}

function street(floor, route) {
  const batch = floor.fixed;
  batch.box(0, .215, 0, 16.85, .08, 12.85, p.road);
  batch.box(0, .292, 0, 10.4, .10, 6.50, p.sand);
  for (let ix = 0; ix < 18; ix++) {
    for (let iz = 0; iz < 10; iz++) {
      batch.box((ix - 8.5) * .56, .351, (iz - 4.5) * .56, .542, .032, .542, (ix + iz) % 6 === 0 ? p.cream : p.sand, batch.root, 1);
    }
  }
  for (const z of [-3.27, 3.27]) batch.box(0, .305, z, 10.6, .16, .13, p.ivory);
  for (const x of [-5.26, 5.26]) batch.box(x, .305, 0, .13, .16, 6.5, p.ivory);
  const pose = {};
  for (let d = 0; d < route.length; d += 1.45) {
    route.sample(d, pose);
    const dash = batch.box(pose.x, .266, pose.z, .55, .017, .055, p.cream, batch.root, 1);
    dash.rotation.y = pose.yaw;
  }
  for (const x of [-8.3, 8.3]) batch.box(x, .25, 0, .16, .20, 12.9, p.cream);
  for (const z of [-6.4, 6.4]) batch.box(0, .25, z, 16.6, .20, .16, p.cream);
  for (let i = 0; i < 6; i++) batch.box(-1.0 + i * .32, .271, 4.45, .18, .023, 1.68, p.cream, batch.root, 1);
  for (const z of [-5.8, 5.8]) {
    batch.box(6.7, .272, z, .6, .024, .37, p.roadDark, batch.root, 2);
    for (let i = 0; i < 5; i++) batch.box(6.45 + i * .11, .291, z, .034, .016, .3, p.metal, batch.root, 2);
  }
}

function garage(town, floor) {
  const batch = floor.fixed;
  const road = roundedRoute({ width: 12.6, depth: 8.9, radius: 2.0 });
  street(floor, road);
  // An open two-bay workshop, with real space between the structural colliders.
  batch.box(-.5, .45, -.8, 8.22, .19, 3.7, p.roadDark);
  for (let row = 0; row < 6; row++) {
    const y = .67 + row * .40;
    for (let col = 0; col < 8; col++) batch.brick(-4.09 + col * 1.025, y, -2.61, 1.02, .40, .28, row % 2 ? p.tan : p.sand, batch.root, -1);
    batch.brick(-4.59, y, -.85, .28, .40, 3.55, p.sand, batch.root, -1);
    batch.brick(3.59, y, -.85, .28, .40, 3.55, p.sand, batch.root, -1);
  }
  for (const x of [-4.58, -.50, 3.59]) {
    batch.brick(x, 1.63, 1.00, .34, 2.40, .34, p.rust, batch.root, -1);
    batch.box(x, .74, 1.19, .36, .65, .035, p.yellow, batch.root, 1);
    for (let i = 0; i < 3; i++) batch.box(x, .54 + i * .22, 1.215, .37, .07, .02, p.black, batch.root, 2);
    addObstacle(town, floor, `garage-pillar-${x}`, { x, z: 1, halfX: .19, halfZ: .19 });
  }
  batch.brick(-.5, 2.97, 1.00, 8.6, .50, .60, p.rust, batch.root, 1);
  batch.brick(-.5, 3.26, -.78, 8.68, .23, 4.16, p.cream, batch.root, 1);
  batch.box(-.5, 3.43, -.85, 8.13, .10, 3.34, p.deepGreen);
  batch.studs(-.5, 3.48, -.85, 14, 5, p.deepGreen, batch.root, 2);
  floor.root.add(sign('GARAGE', 2.35, .45, [-.5, 2.97, 1.312]));
  addObstacle(town, floor, 'garage-back', { x: -.5, z: -2.61, halfX: 4.25, halfZ: .17 });
  for (const x of [-4.59, 3.59]) addObstacle(town, floor, `garage-side-${x}`, { x, z: -.85, halfX: .17, halfZ: 1.77 });
  batch.box(-2.4, .78, -1.92, 2.6, .58, .76, p.red);
  batch.box(-2.4, 1.12, -1.92, 2.73, .12, .88, p.tan);
  addObstacle(town, floor, 'workbench', { x: -2.4, z: -1.92, halfX: 1.4, halfZ: .45 });
  for (let i = 0; i < 4; i++) {
    batch.box(-3.40 + i * .64, .79, -1.524, .55, .42, .036, p.rust, batch.root, 1);
    batch.box(-3.40 + i * .64, .92, -1.49, .24, .027, .035, p.metal, batch.root, 2);
    batch.rod([-3.3 + i * .61, 1.60, -2.41], [-3.3 + i * .61, 2.13, -2.41], .035, p.metal, batch.root, 2);
    batch.part('hand', [-3.3 + i * .61, 2.18, -2.41], [1.2, 1.2, 1.2], p.metal, batch.root, [0, 0, 0], 2);
  }
  batch.box(-2.4, 1.9, -2.445, 2.76, .98, .06, p.roadDark, batch.root, 1);
  for (let i = 0; i < 3; i++) batch.cylinder(2.91, .59 + i * .25, -1.86, .30, .23, p.black);
  addObstacle(town, floor, 'spare-tires', { x: 2.91, z: -1.86, halfX: .32, halfZ: .32 });
  vehicle(town, floor, { id: 'garage-red-car', color: p.red, route: road, distance: 2.1, speed: .78 });
  vehicle(town, floor, { id: 'garage-service-car', color: p.blue, x: 1.30, z: -.66, yaw: -Math.PI / 2, baseY: .54 });
  person(town, floor, { id: 'mechanic', x: -2.35, z: -.48, yaw: Math.PI, shirt: p.blue, hat: p.red, accessory: 'tool', baseY: .54 });
  person(town, floor, { id: 'car-owner', x: 2.85, z: .55, yaw: Math.PI / 2, shirt: p.yellow, trousers: p.brown, baseY: .54 });
  const walk = roundedRoute({ width: 7.2, depth: 1.12, radius: .52, z: 2.33 });
  person(town, floor, { id: 'garage-walker-a', route: walk, speed: .35, distance: .8, shirt: p.orange, trousers: p.navy, hat: p.cream });
  person(town, floor, { id: 'garage-walker-b', route: walk, speed: .35, distance: walk.length / 2 + .8, shirt: p.mint, accessory: 'bag' });
  plant(town, floor, -7.65, -5.53, { width: 1.05 });
  plant(town, floor, 7.65, 5.53, { width: 1.05, flowers: true });
  plant(town, floor, -7.8, .2, { width: 1.12, rotation: Math.PI / 2 });
  tree(town, floor, 7.98, -.4, { scale: .78 });
  for (const x of [-4.65, 4.45]) addObstacle(town, floor, `cone-${x}`, createCone(batch, x, 2.55));
  batch.box(-7.83, .9, 4.6, .10, 1.25, .10, p.navy);
  floor.root.add(sign('P', .58, .58, [-7.83, 1.71, 4.6]));
  addObstacle(town, floor, 'parking-sign', { x: -7.83, z: 4.6, halfX: .13, halfZ: .13 });
}

function house(town, floor, x, color, variant) {
  const batch = floor.fixed;
  const z = -.59;
  const width = 2.66;
  const depth = 3.1;
  const height = variant === 1 ? 3.62 : 3.38;
  batch.box(x, .47, z, 2.80, .23, 3.24, p.cream);
  for (let row = 0; row < 7; row++) {
    const y = .64 + row * (height - .4) / 7;
    for (let col = 0; col < 3; col++) {
      batch.brick(x + (col - 1) * .89, y, z, .883, (height - .4) / 7, depth, (row + col) % 4 === 0 ? p.rust : color, batch.root, -1);
    }
  }
  const front = z + depth / 2 + .014;
  batch.box(x, 1.12, front + .02, .65, 1.42, .08, p.chocolate);
  batch.box(x, 1.38, front + .075, .44, .71, .055, p.glass);
  batch.box(x + .20, .98, front + .11, .055, .055, .06, p.yellow, batch.root, 2);
  for (const side of [-1, 1]) {
    batch.box(x + side * .382, 1.15, front + .08, .10, 1.65, .13, p.cream);
    for (const y of [1.37, 2.65]) {
      const wx = x + side * .85;
      batch.box(wx, y, front + .03, .63, .91, .055, p.navy);
      batch.box(wx, y, front + .071, .49, .78, .025, p.glass);
      for (const offset of [-.35, .35]) batch.box(wx + offset, y, front + .11, .09, 1.04, .13, p.cream);
      for (const offset of [-.48, .48]) batch.box(wx, y + offset, front + .11, .73, .09, .13, p.cream);
      batch.box(wx, y, front + .108, .037, .90, .035, p.cream, batch.root, 1);
      batch.box(wx, y - .04, front + .108, .64, .037, .035, p.cream, batch.root, 1);
      if (y > 2) {
        batch.brick(wx, y - .59, front + .17, .78, .18, .34, p.deepGreen, batch.root, -1);
        for (const dx of [-.23, 0, .23]) batch.cylinder(wx + dx, y - .45, front + .16, .09, .10, variant ? p.pink : p.yellow, batch.root, [0, 0, 0], 2);
      }
    }
  }
  batch.box(x, 1.97, front + .12, 2.85, .14, .30, p.tan);
  batch.box(x, .45, front + .21, .95, .15, .45, p.sand);
  batch.box(x, height + .15, z, 2.85, .20, 3.31, p.cream);
  const roofColor = variant === 1 ? p.navy : p.brown;
  batch.part('roof', [x, height + .69, z], [3.07, 1.03, 3.46], roofColor);
  // Tile each slope with real studded courses instead of a featureless roof.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 4; row++) {
      const roofX = x + side * (.2 + row * .38);
      const roofY = height + 1.15 - row * .25;
      for (let col = 0; col < 6; col++) {
        const brick = batch.box(roofX, roofY, z + (col - 2.5) * .55, .44, .08, .532, roofColor, batch.root, 1);
        brick.rotation.z = -side * .59;
        if (row < 3) batch.part('stud', [roofX, roofY + .07, z + (col - 2.5) * .55], [.8, .8, .8], roofColor, batch.root, [0, 0, -side * .59], 2);
      }
    }
  }
  batch.brick(x + .72, height + .95, z - .67, .43, .72, .55, color, batch.root, 1);
  addObstacle(town, floor, `house-${x}`, { x, z, halfX: 1.42, halfZ: 1.61 });
  // Side windows reward orbiting around the display.
  for (const side of [-1, 1]) for (const y of [1.4, 2.7]) for (const wz of [-1.35, .2]) {
    batch.box(x + side * 1.341, y, wz, .055, .86, .66, p.cream, batch.root, 1);
    batch.box(x + side * 1.376, y, wz, .024, .71, .51, p.glass, batch.root, 1);
    batch.box(x + side * 1.391, y, wz, .013, .72, .031, p.cream, batch.root, 2);
  }
}

function oldTown(town, floor) {
  const batch = floor.fixed;
  const road = roundedRoute({ width: 12.6, depth: 8.9, radius: 2.1 });
  street(floor, road);
  house(town, floor, -2.9, p.brick, 0);
  house(town, floor, 0, p.rust, 1);
  house(town, floor, 2.9, p.tan, 2);
  floor.root.add(sign('BRICK & BEAN', 2.02, .31, [-2.9, 2.0, 1.257]));
  floor.root.add(sign('POST OFFICE', 1.98, .31, [0, 2.0, 1.257]));
  floor.root.add(sign('OPEN', .50, .26, [2.9, 1.61, 1.088]));
  for (let i = 0; i < 6; i++) {
    const awning = batch.box(-2.9 + (i - 2.5) * .38, 2.13, 1.30, .37, .1, .67, i % 2 ? p.cream : p.deepGreen, batch.root);
    awning.rotation.x = .14;
  }
  lamp(town, floor, -4.78, 2.63);
  lamp(town, floor, 4.78, 2.63);
  tree(town, floor, -8.24, -.15, { scale: .70, leaf: p.leaf });
  plant(town, floor, 8.31, -.2, { width: 1.12, rotation: Math.PI / 2, flowers: true });
  plant(town, floor, 7.62, 5.62, { width: 1.05 });
  plant(town, floor, -7.63, -5.62, { width: 1.05, flowers: true });
  batch.box(4.71, .89, -.55, .48, .95, .45, p.red, batch.root, 0, true);
  batch.box(4.71, 1.04, -.311, .32, .065, .028, p.chocolate, batch.root, 1);
  addObstacle(town, floor, 'postbox', { x: 4.71, z: -.55, halfX: .26, halfZ: .26 });
  batch.cylinder(7.95, 1.08, 4.95, .05, 1.7, p.navy);
  floor.root.add(sign('BUS STOP', .64, .51, [7.95, 2.01, 4.95]));
  addObstacle(town, floor, 'bus-stop-sign', { x: 7.95, z: 4.95, halfX: .1, halfZ: .1 });
  vehicle(town, floor, { id: 'yellow-bus', type: 'bus', route: road, distance: 5.8, speed: .72 });
  const walk = roundedRoute({ width: 7.3, depth: 1.12, radius: .52, z: 2.33 });
  person(town, floor, { id: 'coffee-walker', route: walk, distance: 1.4, speed: .30, shirt: p.cream, trousers: p.brown, accessory: 'coffee' });
  person(town, floor, { id: 'town-postman', route: walk, distance: walk.length / 2 + 1.4, speed: .30, shirt: p.blue, hat: p.navy, accessory: 'bag' });
  person(town, floor, { id: 'bus-passenger', x: 4.83, z: .63, yaw: 0, shirt: p.pink, trousers: p.navy });
  person(town, floor, { id: 'town-neighbor', x: -4.83, z: .20, yaw: Math.PI, shirt: p.green, trousers: p.tan, hat: p.cream });
}

function track(floor, route) {
  const batch = floor.fixed;
  const pose = {};
  const segments = 170;
  const step = route.length / segments;
  for (let i = 0; i < segments; i++) {
    route.sample(i * step, pose);
    const bed = batch.box(pose.x, .245, pose.z, step + .065, .13, 2.18, p.roadDark);
    bed.rotation.y = pose.yaw;
    if (i % 2 === 0) {
      const sleeper = batch.box(pose.x, .344, pose.z, .17, .095, 1.85, p.brown, batch.root, 1);
      sleeper.rotation.y = pose.yaw;
    }
    const nx = -pose.tz;
    const nz = pose.tx;
    for (const side of [-1, 1]) {
      const rail = batch.box(pose.x + nx * side * .58, .415, pose.z + nz * side * .58, step + .065, .067, .08, p.metal);
      rail.rotation.y = pose.yaw;
    }
  }
}

function tramPark(town, floor) {
  const batch = floor.fixed;
  const route = roundedRoute({ width: 12.55, depth: 8.8, radius: 2.2 });
  batch.box(0, .227, 0, 10.6, .085, 5.9, p.green);
  track(floor, route);
  batch.box(0, .29, .69, 7.25, .17, 2.23, p.sand);
  for (let ix = 0; ix < 12; ix++) for (let iz = 0; iz < 3; iz++) batch.box((ix - 5.5) * .56, .387, .69 + (iz - 1) * .56, .536, .034, .536, (ix + iz) % 3 ? p.sand : p.cream, batch.root, 1);
  batch.box(0, .39, 2.11, 6.4, .34, 1.12, p.cream);
  for (let i = 0; i < 23; i++) batch.box((i - 11) * .25, .57, 2.60, .17, .02, .17, p.yellow, batch.root, 2);
  for (const x of [-2.78, 2.78]) {
    batch.box(x, 1.90, 2.04, .12, 2.9, .12, p.deepGreen);
    addObstacle(town, floor, `station-post-${x}`, { x, z: 2.04, halfX: .09, halfZ: .09 });
  }
  batch.brick(0, 3.42, 2.04, 6.37, .20, 1.42, p.deepGreen, batch.root, 1);
  batch.box(0, 3.58, 2.04, 5.94, .12, 1.10, p.leaf);
  floor.root.add(sign('03  |  TRAM', 1.65, .41, [0, 3.06, 2.11]));
  tree(town, floor, -3.42, -1.67, { scale: 1.01, leaf: p.green });
  tree(town, floor, 3.45, -1.76, { scale: 1.0, leaf: p.leaf, kind: 'pine' });
  tree(town, floor, -8.24, -.1, { scale: .68, kind: 'pine' });
  plant(town, floor, 8.31, -.2, { width: 1.0, rotation: Math.PI / 2, flowers: true });
  bench(town, floor, 0, -1.22);
  plant(town, floor, -7.66, -5.52, { width: 1.08 });
  plant(town, floor, 7.66, 5.52, { width: 1.08, flowers: true });
  for (const x of [-4.83, 4.83]) {
    batch.cylinder(x, 2.13, -2.36, .07, 3.8, p.navy);
    batch.rod([x, 3.91, -2.36], [x, 3.91, -4.1], .055, p.navy);
    addObstacle(town, floor, `tram-pole-${x}`, { x, z: -2.36, halfX: .12, halfZ: .12 });
  }
  batch.rod([-4.83, 3.91, -4.1], [4.83, 3.91, -4.1], .017, p.chocolate, batch.root, 2);
  vehicle(town, floor, { id: 'orange-tram', type: 'tram', route, distance: 3.9, speed: .82 });
  const walk = roundedRoute({ width: 4.90, depth: 1.08, radius: .5, z: .66 });
  person(town, floor, { id: 'park-walker-a', route: walk, distance: 1.0, speed: .28, shirt: p.red, hat: p.navy });
  person(town, floor, { id: 'park-walker-b', route: walk, distance: walk.length / 2 + 1, speed: .28, shirt: p.yellow, trousers: p.brown });
  person(town, floor, { id: 'tram-waiter-a', x: -1.21, z: 2.26, shirt: p.mint, trousers: p.tan, yaw: 0, baseY: .57, accessory: 'bag' });
  person(town, floor, { id: 'tram-waiter-b', x: 1.18, z: 2.25, shirt: p.cream, trousers: p.navy, yaw: -.25, baseY: .57, accessory: 'coffee' });
}

function rooftop(town, floor) {
  const batch = floor.fixed;
  batch.box(0, .241, 3.77, 15.6, .10, 4.1, p.road);
  batch.box(0, .24, .59, 13.2, .14, 2.4, p.sand);
  for (let ix = 0; ix < 23; ix++) for (let iz = 0; iz < 4; iz++) batch.box((ix - 11) * .56, .323, .59 + (iz - 1.5) * .56, .54, .035, .54, (ix + iz) % 7 ? p.sand : p.cream, batch.root, 1);
  for (const x of [-6.9, -2.32, 2.32, 6.9]) batch.box(x, .302, 3.84, .055, .024, 3.14, p.cream, batch.root, 1);
  for (const x of [-4.64, 0, 4.64]) {
    batch.box(x, .31, 5.32, 1.9, .04, .06, p.cream, batch.root, 1);
    batch.box(x, .37, 2.22, 1.27, .15, .2, p.cream, batch.root, 1);
  }
  vehicle(town, floor, { id: 'rooftop-mint-car', color: p.mint, x: -4.65, z: 3.76, yaw: -.12 });
  vehicle(town, floor, { id: 'rooftop-yellow-van', color: p.yellow, type: 'van', x: 0, z: 3.76, yaw: .08 });
  vehicle(town, floor, { id: 'rooftop-blue-car', color: p.blue, x: 4.65, z: 3.76, yaw: -.12 });
  tree(town, floor, -6.15, -3.77, { scale: 1.19, leaf: p.deepGreen });
  tree(town, floor, -3.45, -4.17, { scale: .92, leaf: p.leaf, kind: 'pine' });
  tree(town, floor, .45, -4.0, { scale: 1.17, leaf: p.green });
  tree(town, floor, 5.89, -3.50, { scale: 1.18, leaf: p.leaf });
  tree(town, floor, 7.65, -.22, { scale: .74, leaf: p.green, kind: 'pine' });
  plant(town, floor, -7.62, .06, { width: 1.45, rotation: Math.PI / 2, flowers: true });
  plant(town, floor, -5.78, -1.19, { width: 1.42, flowers: true });
  plant(town, floor, 6.85, -5.43, { width: 1.53 });
  plant(town, floor, -1.30, -5.45, { width: 1.56, flowers: true });
  bench(town, floor, 3.62, -1.32);
  // Picnic table and a tiled, eight-panel brick parasol.
  batch.cylinder(-1.08, 1.45, -1.51, .05, 2.25, p.cream);
  batch.box(-1.08, .82, -1.51, 1.50, .15, 1.08, p.tan);
  for (const x of [-1.54, -.62]) batch.box(x, .55, -1.51, .11, .5, .66, p.brown);
  addObstacle(town, floor, 'picnic-table', { x: -1.08, z: -1.51, halfX: .77, halfZ: .56 });
  const umbrella = batch.node(batch.root, [-1.08, 2.62, -1.51]);
  for (let i = 0; i < 8; i++) {
    const panel = batch.part('roof', [0, 0, 0], [1.24, .23, 1.24], i % 2 ? p.cream : p.yellow, umbrella, [0, i * Math.PI / 4, .25]);
    panel.position.x = Math.sin(i * Math.PI / 4) * .48;
    panel.position.z = Math.cos(i * Math.PI / 4) * .48;
  }
  batch.cylinder(-1.08, 2.94, -1.51, .08, .10, p.tan);
  batch.cylinder(-1.3, .97, -1.48, .1, .16, p.cream, batch.root, [0, 0, 0], 2);
  batch.brick(-.68, .96, -1.51, .32, .12, .29, p.red, batch.root, -1);
  const walk = roundedRoute({ width: 11.45, depth: 1.12, radius: .53, z: .64 });
  person(town, floor, { id: 'roof-walker-a', route: walk, distance: 2.1, speed: .26, shirt: p.blue, hat: p.cream, accessory: 'coffee' });
  person(town, floor, { id: 'roof-walker-b', route: walk, distance: walk.length / 2 + 2.1, speed: .26, shirt: p.pink, trousers: p.tan, accessory: 'bag' });
  person(town, floor, { id: 'picnic-friend', x: -2.37, z: -1.24, yaw: Math.PI / 2, shirt: p.red, trousers: p.navy, hat: p.tan });
  person(town, floor, { id: 'roof-reader', x: 5.25, z: -1.10, yaw: 0, shirt: p.cream, trousers: p.brown });
  person(town, floor, { id: 'little-gardener', x: -4.38, z: -1.56, yaw: -1.1, scale: .81, shirt: p.yellow, trousers: p.blue, hat: p.orange });
  for (const x of [-8.35, 8.35]) {
    for (let i = 0; i < 9; i++) batch.box(x, .52, -5.65 + i * 1.32, .13, .57, .13, p.cream, batch.root, 1);
    batch.box(x, .79, -.35, .16, .12, 11.2, p.cream, batch.root, 1);
  }
  for (let i = 0; i < 13; i++) batch.box((i - 6) * 1.34, .52, -6.22, .13, .57, .13, p.cream, batch.root, 1);
  batch.box(0, .79, -6.22, 16.8, .12, .16, p.cream, batch.root, 1);
  floor.root.add(sign('SLOW SUNDAYS', 1.41, .42, [3.62, 1.31, -1.521]));
  floor.root.add(sign('CENTRAL PARK', 1.77, .42, [.48, .55, -5.81]));
}

function createShell() {
  const root = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({ color: '#d8ebe4', roughness: .17, metalness: .04, transparent: true, opacity: .055, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: .65 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: '#ecebd9', roughness: .28, metalness: .32, transparent: true, opacity: .64 });
  const height = FLOOR_GAP * 3 + 5.25;
  const width = 18.73;
  const depth = 14.72;
  const walls = [];
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(width, 1), material);
    wall.position.set(0, height / 2, side * depth / 2);
    wall.scale.y = height;
    wall.renderOrder = 4;
    root.add(wall);
    walls.push(wall);
    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, 1), material);
    sideWall.position.set(side * width / 2, height / 2, 0);
    sideWall.scale.y = height;
    sideWall.rotation.y = Math.PI / 2;
    sideWall.renderOrder = 4;
    root.add(sideWall);
    walls.push(sideWall);
  }
  const lid = new THREE.Mesh(new THREE.BoxGeometry(width, .085, depth), material);
  lid.position.y = height;
  lid.renderOrder = 4;
  root.add(lid);
  const posts = [];
  for (const x of [-width / 2, width / 2]) for (const z of [-depth / 2, depth / 2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.092, 1, .092), frameMaterial);
    post.position.set(x, height / 2, z);
    post.scale.y = height;
    root.add(post);
    posts.push(post);
  }
  const topFrame = new THREE.Group();
  const bottomFrame = new THREE.Group();
  for (const frame of [topFrame, bottomFrame]) {
    for (const z of [-depth / 2, depth / 2]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(width, .11, .12), frameMaterial);
      beam.position.z = z;
      frame.add(beam);
    }
    for (const x of [-width / 2, width / 2]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(.12, .11, depth), frameMaterial);
      beam.position.x = x;
      frame.add(beam);
    }
    root.add(frame);
  }
  topFrame.position.y = height;
  const shineMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide });
  const shines = [];
  for (const x of [-width / 2 + .18, width / 2 - .18]) {
    const shine = new THREE.Mesh(new THREE.PlaneGeometry(.035, 1), shineMaterial);
    shine.position.set(x, height / 2, depth / 2 + .015);
    shine.scale.y = height - .25;
    shine.renderOrder = 5;
    root.add(shine);
    shines.push(shine);
  }
  root.position.y = FLOOR_BASE - .32;
  return {
    root, material,
    setHeight(value) {
      walls.forEach(wall => { wall.scale.y = value; wall.position.y = value / 2; });
      posts.forEach(post => { post.scale.y = value; post.position.y = value / 2; });
      shines.forEach(shine => { shine.scale.y = value - .25; shine.position.y = value / 2; });
      lid.position.y = topFrame.position.y = value;
    },
    setTransparency(value) {
      material.opacity = (100 - value) / 100 * .46;
      frameMaterial.opacity = .34 + (100 - value) / 100 * 2;
      shineMaterial.opacity = .1 + (100 - value) / 100;
    },
  };
}

export function createTown() {
  const town = {
    root: new THREE.Group(), floors: [], traffic: new TrafficSystem(), partCount: 0,
    expansion: 0, selected: 'all', solo: false, detail: 2, particlesEnabled: true,
  };
  town.root.name = 'STACKED';
  const base = new LegoBatch();
  base.box(0, .06, 0, 19.1, .61, 15.13, p.cream, base.root, 0, true);
  base.box(0, -.26, 0, 18.5, .16, 14.62, p.tan, base.root, 0, true);
  for (const x of [-7.5, 7.5]) for (const z of [-5.5, 5.5]) base.cylinder(x, -.43, z, .55, .27, p.chocolate);
  base.box(0, .042, 7.586, 3.9, .29, .028, p.tan);
  town.displayBase = new THREE.Group();
  town.displayBase.add(base.finish());
  town.displayBase.add(sign('STACKED', 2.01, .25, [0, .03, 7.612]));
  town.root.add(town.displayBase);
  for (let i = 0; i < 4; i++) {
    const floor = createFloor(i);
    town.floors.push(floor);
    town.root.add(floor.root);
  }
  garage(town, town.floors[0]);
  oldTown(town, town.floors[1]);
  tramPark(town, town.floors[2]);
  rooftop(town, town.floors[3]);
  const random = seededRandom(9182);
  for (const floor of town.floors) {
    floor.root.add(floor.fixed.finish(), floor.moving.finish());
    town.partCount += floor.fixed.partCount + floor.moving.partCount;
    if (floor.index >= 2) {
      const pool = new PollenPool(36, random);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(pool.positions, 3).setUsage(THREE.DynamicDrawUsage));
      const material = new THREE.PointsMaterial({ color: '#fcf3bd', size: .057, transparent: true, opacity: .65, depthWrite: false, sizeAttenuation: true });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      floor.root.add(points);
      floor.particles = { pool, points };
    }
  }
  town.partCount += base.partCount;
  town.shell = createShell();
  town.root.add(town.shell.root);

  town.setDetail = level => {
    town.detail = level;
    town.floors.forEach(floor => { floor.fixed.setDetail(level); floor.moving.setDetail(level); });
  };
  town.setExpansion = expansion => {
    town.expansion = expansion;
    town.floors.forEach(floor => { floor.root.position.y = FLOOR_BASE + floor.index * (FLOOR_GAP + expansion * 3.2); });
    town.shell.setHeight(FLOOR_GAP * 3 + 5.25 + expansion * 9.6);
  };
  town.setView = (selected, solo) => {
    town.selected = selected;
    town.solo = solo && selected !== 'all';
    town.floors.forEach(floor => { floor.root.visible = !town.solo || floor.index === Number(selected); });
    town.displayBase.visible = !town.solo;
    if (town.solo) {
      town.shell.root.position.y = town.floors[Number(selected)].root.position.y - .32;
      town.shell.setHeight(5.55);
    } else {
      town.shell.root.position.y = FLOOR_BASE - .32;
      town.shell.setHeight(FLOOR_GAP * 3 + 5.25 + town.expansion * 9.6);
    }
  };
  town.update = (dt, animate = true) => {
    if (animate && dt > 0) town.traffic.step(dt);
    const time = town.traffic.time;
    for (const floor of town.floors) {
      if (!floor.root.visible) continue;
      for (const { actor, model, person } of floor.visuals) {
        model.root.position.set(actor.x, actor.baseY ?? (person ? .375 : .29), actor.z);
        model.root.rotation.y = actor.yaw + (person ? Math.PI / 2 : 0);
        if (person) {
          const gait = actor.route && !actor.stopped ? Math.sin(actor.travelled * 9) * .35 : 0;
          model.legs[0].rotation.x = gait;
          model.legs[1].rotation.x = -gait;
          model.arms[0].rotation.x = -gait * .68;
          model.arms[1].rotation.x = actor.accessory === 'coffee' ? -.5 : gait * .68;
          model.head.rotation.y = Math.sin(time * .45 + actor.x) * .065;
          if (actor.id === 'mechanic') model.arms[1].rotation.x = -.35 + Math.sin(time * 1.6) * .17;
        } else {
          model.wheels.forEach(wheel => { wheel.rotation.z = -actor.travelled / .37; });
        }
      }
      floor.moving.update();
      if (floor.particles) {
        const { pool, points } = floor.particles;
        points.visible = town.particlesEnabled && town.detail > 0;
        if (animate && points.visible) {
          pool.active = town.detail === 2 ? pool.capacity : 16;
          pool.step(dt);
          points.geometry.setDrawRange(0, pool.active);
          points.geometry.attributes.position.needsUpdate = true;
        }
      }
    }
  };
  town.update(0, false);
  return town;
}
