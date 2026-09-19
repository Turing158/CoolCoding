import * as THREE from 'three';
import { TAU } from './config.js';
import { InstanceBatch, layer, mesh, ring } from './kit.js';

function gongGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-.7, .11);
  shape.lineTo(-.7, .27);
  shape.lineTo(-.51, .27);
  shape.quadraticCurveTo(-.4, .02, -.17, .02);
  shape.lineTo(.17, .02);
  shape.quadraticCurveTo(.4, .02, .51, .27);
  shape.lineTo(.7, .27);
  shape.lineTo(.7, .11);
  shape.quadraticCurveTo(.53, -.17, .16, -.17);
  shape.lineTo(-.16, -.17);
  shape.quadraticCurveTo(-.53, -.17, -.7, .11);
  const geometry = new THREE.ExtrudeGeometry(shape, { steps: 1, depth: .19, bevelEnabled: false, curveSegments: 5 });
  geometry.translate(0, 0, -.095);
  return geometry;
}

function createColumns(root, materials, exploder) {
  const group = layer(root, exploder, 'red-columns', 6.35, .23);
  const batch = new InstanceBatch(group, { exploder, radial: 1.8, delay: .23 });
  const shaftGeometry = new THREE.CylinderGeometry(.23, .27, 1, 18);
  const rings = [
    { count: 12, radius: 8.03, bottom: 3.6, top: 9.46, offset: Math.PI / 12 },
    { count: 12, radius: 5.08, bottom: 3.6, top: 13.05, offset: Math.PI / 12 },
    { count: 4, radius: 2.23, bottom: 3.6, top: 17.0, offset: Math.PI / 4 },
  ];
  const records = [];
  for (const row of rings) {
    for (let i = 0; i < row.count; i++) {
      const angle = i / row.count * TAU + row.offset;
      const x = Math.sin(angle) * row.radius;
      const z = Math.cos(angle) * row.radius;
      const height = row.top - row.bottom;
      batch.add(shaftGeometry, materials.red, [x, row.bottom + height / 2, z], [1, height, 1]);
      batch.cylinder(materials.white, [x, 3.46, z], .4, .34);
      batch.cylinder(materials.marbleShade, [x, 3.67, z], .32, .12);
      for (const y of [row.bottom + .14, row.top - .15]) {
        batch.cylinder(materials.gold, [x, y, z], .276, .07);
      }
      batch.cylinder(materials.jade, [x, row.top - .34, z], .26, .32);
      batch.box(materials.paint, [x, row.top + .05, z], [.65, .31, .65], [0, angle, 0]);
      if (row.count === 4) {
        for (let band = 0; band < 13; band++) {
          batch.cylinder(materials.mutedGold, [x, 4.4 + band * .81, z], .25, .045);
        }
      }
      records.push({ x, z, bottom: row.bottom, top: row.top });
    }
  }
  batch.finish();
  return records;
}

function createWallsAndWindows(root, materials, exploder) {
  const wallGroup = layer(root, exploder, 'circular-wall', 5.2, .29);
  const windows = layer(root, exploder, 'doors-and-windows', 6.4, .29);
  const walls = new InstanceBatch(wallGroup, { exploder, radial: 3.65, delay: .29 });
  const frames = new InstanceBatch(windows, { exploder, radial: 5.5, delay: .29 });
  const panelAngle = TAU / 12;
  const lowerPanel = new THREE.CylinderGeometry(7.48, 7.48, .62, 12, 1, true, -panelAngle / 2 + .018, panelAngle - .036);
  const lintel = new THREE.CylinderGeometry(7.5, 7.5, .52, 12, 1, true, -panelAngle / 2, panelAngle);
  for (let bay = 0; bay < 12; bay++) {
    const angle = bay * panelAngle;
    walls.add(lowerPanel, materials.deepRed, [Math.sin(angle) * .001, 3.65, Math.cos(angle) * .001], [1, 1, 1], [0, angle, 0]);
    walls.add(lintel, materials.paint, [Math.sin(angle) * .001, 9.06, Math.cos(angle) * .001], [1, 1, 1], [0, angle, 0]);
    const doorRadius = 7.51;
    for (let leaf = 0; leaf < 4; leaf++) {
      const shift = (leaf - 1.5) * .84;
      const x = Math.sin(angle) * doorRadius + Math.cos(angle) * shift;
      const z = Math.cos(angle) * doorRadius - Math.sin(angle) * shift;
      frames.box(materials.shutter, [x, 6.3, z], [.8, 4.74, .16], [0, angle, 0]);
      frames.box(materials.red, [x - Math.cos(angle) * .39, 6.3, z + Math.sin(angle) * .39], [.075, 4.9, .23], [0, angle, 0]);
      frames.box(materials.red, [x, 8.7, z], [.86, .13, .24], [0, angle, 0]);
      frames.box(materials.red, [x, 5.24, z], [.83, .12, .24], [0, angle, 0]);
      frames.box(materials.mutedGold, [x + Math.sin(angle) * .12, 5.34, z + Math.cos(angle) * .12], [.73, .025, .025], [0, angle, 0]);
      if (bay === 0 || bay === 6) {
        for (let row = 0; row < 5; row++) {
          for (const side of [-1, 1]) {
            const offset = side * .265;
            frames.sphere(materials.gold, [x + Math.cos(angle) * offset + Math.sin(angle) * .108, 4.07 + row * .21, z - Math.sin(angle) * offset + Math.cos(angle) * .108], .025);
          }
        }
        frames.sphere(materials.gold, [x + Math.sin(angle) * .13, 5.59, z + Math.cos(angle) * .13], .058);
      }
    }
    walls.radialBox(materials.red, angle + panelAngle / 2, 7.51, 6.39, [.32, 5.31, .33]);
    walls.radialBox(materials.blue, angle, 7.52, 8.92, [3.55, .22, .23]);
    walls.radialBox(materials.mutedGold, angle, 7.66, 8.99, [3.6, .045, .08]);
  }
  walls.finish();
  frames.finish();

  const sign = layer(root, exploder, 'qiniandian-plaque', 8.3, .24, [0, 1.4]);
  mesh(sign, new THREE.BoxGeometry(2.86, 1.07, .13), materials.plaque, [0, 9.44, 8.75]);
  const signFrame = new InstanceBatch(sign);
  signFrame.box(materials.gold, [0, 10, 8.79], [3.02, .08, .2]);
  signFrame.box(materials.gold, [0, 8.89, 8.79], [3.02, .08, .2]);
  signFrame.box(materials.gold, [-1.48, 9.44, 8.79], [.07, 1.12, .2]);
  signFrame.box(materials.gold, [1.48, 9.44, 8.79], [.07, 1.12, .2]);
  signFrame.finish();
}

function createBracketTier(root, materials, exploder, spec, index, gong) {
  const group = layer(root, exploder, `dougong-tier-${index + 1}`, spec.lift, spec.delay);
  const batch = new InstanceBatch(group, { exploder, radial: .65, delay: spec.delay });
  const bandProfile = [
    [spec.radius - .18, spec.y - .43], [spec.radius + .15, spec.y - .43],
    [spec.radius + .15, spec.y - .04], [spec.radius - .18, spec.y - .04],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  mesh(group, new THREE.LatheGeometry(bandProfile, 128), materials.paint);
  ring(group, spec.radius + .15, .035, spec.y - .42, materials.mutedGold);
  ring(group, spec.radius + .15, .04, spec.y - .05, materials.mutedGold);
  for (let i = 0; i < spec.count; i++) {
    const angle = i / spec.count * TAU;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const r = spec.radius;
    batch.box(materials.red, [sin * r, spec.y + .08, cos * r], [.28, .35, .38], [0, angle, 0]);
    for (let level = 0; level < 3; level++) {
      const reach = r + level * .22;
      const y = spec.y + .27 + level * .2;
      const scale = .69 + level * .14;
      batch.add(gong, level % 2 ? materials.blue : materials.jade, [sin * reach, y, cos * reach], [scale, .73, 1], [0, angle, 0]);
      batch.add(gong, materials.jade, [sin * reach, y + .07, cos * reach], [.63 + level * .11, .72, 1], [0, angle + Math.PI / 2, 0]);
      for (const hand of [-1, 1]) {
        const offset = hand * .5 * scale;
        batch.box(materials.mutedGold, [sin * reach + cos * offset, y + .14, cos * reach - sin * offset], [.15, .095, .24], [0, angle, 0]);
      }
      batch.radialBox(materials.blue, angle, reach + .34, y + .17, [.25, .15, .3]);
      batch.radialBox(materials.mutedGold, angle, reach + .495, y + .17, [.19, .055, .017]);
    }
    batch.radialBox(materials.paint, angle, r + .72, spec.y + .84, [1.1, .17, .39]);
  }
  batch.finish();
}

export function createTimber(root, materials, exploder) {
  const columns = createColumns(root, materials, exploder);
  createWallsAndWindows(root, materials, exploder);
  const gong = gongGeometry();
  const specs = [
    { radius: 8.1, y: 9.13, count: 48, lift: 8.6, delay: .19 },
    { radius: 6.07, y: 12.98, count: 40, lift: 12.65, delay: .13 },
    { radius: 4.4, y: 16.78, count: 32, lift: 16.4, delay: .065 },
  ];
  specs.forEach((spec, index) => createBracketTier(root, materials, exploder, spec, index, gong));
  // Circular clerestories tie the roof levels into a continuous round hall.
  const drums = [
    { radius: 6.11, bottom: 12.32, top: 13.45, lift: 12.4, delay: .18 },
    { radius: 4.43, bottom: 16.19, top: 17.27, lift: 16.0, delay: .12 },
  ];
  drums.forEach((spec, index) => {
    const group = layer(root, exploder, `upper-drum-${index + 1}`, spec.lift, spec.delay);
    mesh(group, new THREE.CylinderGeometry(spec.radius, spec.radius, spec.top - spec.bottom, 128, 1, true), materials.paint, [0, (spec.top + spec.bottom) / 2, 0]);
    ring(group, spec.radius + .04, .07, spec.bottom + .12, materials.blue);
    ring(group, spec.radius + .04, .043, spec.bottom + .22, materials.mutedGold);
    const batch = new InstanceBatch(group);
    for (let bay = 0; bay < 24; bay++) {
      const angle = bay / 24 * TAU;
      batch.radialBox(materials.red, angle, spec.radius + .025, spec.bottom + .61, [.095, .7, .1]);
    }
    batch.finish();
  });
  const floor = layer(root, exploder, 'hall-floor', 3.6, .36);
  mesh(floor, new THREE.CylinderGeometry(8.15, 8.15, .12, 128), materials.marble, [0, 3.36, 0]);
  return columns;
}
