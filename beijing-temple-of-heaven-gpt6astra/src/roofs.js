import * as THREE from 'three';
import { ROOFS, TAU } from './config.js';
import { InstanceBatch, layer, mesh, ring, seededRandom } from './kit.js';

/** The slight dip inside the lip creates a genuine upturned eave. */
export function roofProfile(spec, divisions = 36) {
  return Array.from({ length: divisions + 1 }, (_, index) => {
    const t = index / divisions;
    const lip = t < .25 ? .16 * Math.sin(t * Math.PI * 4) : 0;
    return new THREE.Vector2(
      spec.radius - (spec.radius - spec.innerRadius) * t,
      spec.eave + spec.rise * Math.pow(t, 1.82) - lip,
    );
  });
}

export function createRibGeometry(points, radius) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const crossSegments = 5;
  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dr = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dr, dy);
    const normalY = -dr / length;
    const normalR = dy / length;
    const width = Math.max(.024, .079 * point.x / radius);
    for (let side = 0; side <= crossSegments; side++) {
      const angle = side / crossSegments * Math.PI;
      const height = Math.sin(angle) * width;
      positions.push(Math.cos(angle) * width, point.y + .018 + height * normalY, point.x + height * normalR);
      uvs.push(side / crossSegments, index / (points.length - 1));
      if (index < points.length - 1 && side < crossSegments) {
        const a = index * (crossSegments + 1) + side;
        const b = a + crossSegments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createRoofs(root, materials, exploder) {
  const random = seededRandom(210);
  const groups = [];
  ROOFS.forEach((spec, index) => {
    const group = layer(root, exploder, spec.name, spec.lift, spec.delay);
    groups.push(group);
    const profile = roofProfile(spec);
    const surface = new THREE.LatheGeometry(profile, 192);
    const roofMaterial = materials.roof.clone();
    if (roofMaterial.map) {
      roofMaterial.map = roofMaterial.map.clone();
      roofMaterial.map.repeat.set(spec.ribs / 4, index === 2 ? 1.45 : .8);
      roofMaterial.map.needsUpdate = true;
      roofMaterial.bumpMap = roofMaterial.map;
    }
    const roof = mesh(group, surface, roofMaterial);
    roof.name = `curved-surface-${index + 1}`;
    const underside = profile.map((point) => new THREE.Vector2(point.x, point.y - .15)).reverse();
    const underMaterial = materials.underRoof.clone();
    underMaterial.side = THREE.DoubleSide;
    mesh(group, new THREE.LatheGeometry(underside, 160), underMaterial);
    ring(group, spec.radius - .025, .1, spec.eave - .1, materials.roofEdge);
    ring(group, spec.radius - .025, .035, spec.eave - .205, materials.mutedGold);
    const rib = createRibGeometry(profile, spec.radius);
    const batch = new InstanceBatch(group);
    const tileEnd = new THREE.CylinderGeometry(.078, .082, .13, 9);
    for (let i = 0; i < spec.ribs; i++) {
      const angle = i / spec.ribs * TAU;
      const color = new THREE.Color().setHSL(.577 + random() * .018, .39 + random() * .12, .76 + random() * .12);
      batch.add(rib, materials.roofRib, [0, 0, 0], [1, 1, 1], [0, angle, 0], color);
      batch.add(tileEnd, materials.roofEdge, [Math.sin(angle) * (spec.radius + .017), spec.eave - .057, Math.cos(angle) * (spec.radius + .017)], [1, 1, 1], [Math.PI / 2, 0, -angle]);
    }
    // Radial rafters are visible below the curving eave rather than painted on it.
    const rafterCount = index === 0 ? 96 : 72;
    const rafterLength = index === 2 ? 2.05 : 2.6;
    for (let i = 0; i < rafterCount; i++) {
      const angle = i / rafterCount * TAU;
      batch.radialBox(materials.jade, angle, spec.radius - rafterLength / 2 - .12, spec.eave - .19, [.11, .14, rafterLength], [.075, 0, 0]);
      batch.radialBox(materials.mutedGold, angle, spec.radius - .21, spec.eave - .19, [.12, .13, .16]);
    }
    batch.finish();

    if (index === 2) {
      const top = spec.eave + spec.rise;
      const finial = [
        [0, top - .1], [.48, top - .1], [.59, top + .03], [.61, top + .16],
        [.46, top + .25], [.39, top + .38], [.49, top + .53], [.53, top + .78],
        [.44, top + 1.02], [.26, top + 1.2], [.17, top + 1.34], [.16, top + 1.54],
        [.08, top + 1.75], [0, top + 1.87],
      ].map(([r, y]) => new THREE.Vector2(r, y));
      const goldenTop = mesh(group, new THREE.LatheGeometry(finial, 64), materials.gold);
      goldenTop.name = 'gilded-finial';
      ring(group, .51, .045, top + .13, materials.gold, 64);
      ring(group, .39, .042, top + .43, materials.gold, 64);
    }
  });
  return groups;
}
