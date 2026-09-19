import * as THREE from 'three';
import { TAU, TERRACES } from './config.js';
import { InstanceBatch, layer, mesh, ring } from './kit.js';

function postGeometry() {
  return new THREE.LatheGeometry([
    [.16, 0], [.16, .14], [.095, .18], [.095, .72], [.14, .75],
    [.14, .82], [.09, .87], [.135, .96], [.12, 1.04], [.07, 1.12], [0, 1.15],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 10);
}

function addStairs(batch, materials, spec, railBatch, post) {
  const count = 9;
  const run = 2.58;
  const tread = run / count;
  const rise = spec.height / count;
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2;
    const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const tangent = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
    for (let step = 0; step < count; step++) {
      const z = spec.radius + run - (step + .5) * tread - .36;
      const y = spec.bottom + (step + .5) * rise;
      // Full risers are grounded: no floating thin stair treads.
      const height = (step + 1) * rise;
      batch.radialBox(materials.marble, angle, z, spec.bottom + height / 2, [5.5, height, tread + .025]);
      batch.radialBox(materials.white, angle, z + tread / 2 - .025, y + rise / 2, [5.54, .035, .07]);
    }
    const rampRadius = spec.radius + run / 2 - .36;
    const rampPosition = direction.clone().multiplyScalar(rampRadius);
    const rampLength = Math.hypot(run, spec.height);
    if (side === 0 || side === 2) {
      batch.box(materials.carving, [rampPosition.x, spec.bottom + spec.height / 2 + .085, rampPosition.z], [1.06, .11, rampLength], [Math.atan2(spec.height, run), angle, 0]);
    }
    for (const hand of [-1, 1]) {
      const railCenter = direction.clone().multiplyScalar(rampRadius).addScaledVector(tangent, hand * 2.83);
      railBatch.box(materials.white, [railCenter.x, spec.bottom + spec.height / 2 + .8, railCenter.z], [.13, .14, rampLength + .13], [Math.atan2(spec.height, run), angle, 0]);
      for (let point = 0; point <= 4; point++) {
        const r = spec.radius + run - .36 - point / 4 * run;
        const p = direction.clone().multiplyScalar(r).addScaledVector(tangent, hand * 2.83);
        const base = spec.bottom + point / 4 * spec.height;
        railBatch.add(post, materials.white, [p.x, base, p.z], [1.1, .85, 1.1]);
      }
    }
  }
}

export function createTerraces(root, materials, exploder) {
  const post = postGeometry();
  const groups = [];
  TERRACES.forEach((spec, index) => {
    const top = spec.bottom + spec.height;
    const group = layer(root, exploder, `terrace-${index + 1}`, spec.lift, spec.delay);
    groups.push(group);
    const shape = [
      [0, spec.bottom], [spec.radius - .12, spec.bottom], [spec.radius + .03, spec.bottom + .08],
      [spec.radius + .03, spec.bottom + .22], [spec.radius - .12, spec.bottom + .29],
      [spec.radius - .17, top - .25], [spec.radius + .07, top - .19], [spec.radius + .09, top - .07],
      [spec.radius, top], [0, top],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const base = mesh(group, new THREE.LatheGeometry(shape, 192), materials.marble);
    base.name = `white-marble-base-${index + 1}`;
    ring(group, spec.radius - .04, .045, top - .25, materials.marbleShade);
    const ringFloor = mesh(group, new THREE.RingGeometry(spec.radius - .56, spec.radius - .49, 192), materials.marbleShade, [0, top + .008, 0], [-Math.PI / 2, 0, 0]);
    ringFloor.castShadow = false;
    const masonry = new InstanceBatch(group);
    for (let i = 0; i < 112; i++) {
      const angle = i / 112 * TAU;
      masonry.radialBox(materials.marbleShade, angle, spec.radius - .152, spec.bottom + spec.height / 2, [.017, spec.height - .45, .01]);
    }
    const rails = layer(root, exploder, `balustrade-${index + 1}`, spec.lift + 2.05, .32 + (2 - index) * .025);
    const railBatch = new InstanceBatch(rails, { exploder, radial: .55, delay: .35 });
    const radius = spec.radius - .43;
    const gap = Math.asin(2.93 / radius);
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const start = quadrant * Math.PI / 2 + gap;
      const end = (quadrant + 1) * Math.PI / 2 - gap;
      for (let bay = 0; bay <= spec.bays; bay++) {
        const angle = start + (end - start) * bay / spec.bays;
        railBatch.add(post, materials.white, [Math.sin(angle) * radius, top, Math.cos(angle) * radius]);
        if (bay === spec.bays) continue;
        const next = start + (end - start) * (bay + 1) / spec.bays;
        const middle = (angle + next) / 2;
        const chord = 2 * radius * Math.sin((next - angle) / 2);
        railBatch.radialBox(materials.white, middle, radius, top + .86, [chord - .06, .16, .16]);
        railBatch.radialBox(materials.white, middle, radius, top + .26, [chord - .08, .15, .14]);
        railBatch.radialBox(materials.marble, middle, radius, top + .4, [chord - .17, .19, .1]);
        for (const offset of [-.27, .27]) {
          railBatch.radialBox(materials.white, middle + offset * chord / radius, radius, top + .62, [.065, .36, .09]);
        }
        railBatch.radialBox(materials.white, middle, radius, top + .62, [.26, .06, .085], [0, 0, Math.PI / 4]);
        railBatch.radialBox(materials.white, middle, radius, top + .62, [.26, .06, .085], [0, 0, -Math.PI / 4]);
      }
    }
    addStairs(masonry, materials, spec, railBatch, post);
    masonry.finish();
    railBatch.finish();
  });
  return groups;
}
