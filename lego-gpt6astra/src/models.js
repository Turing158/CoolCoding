import { palette as p } from './kit.js';

export function createCar(batch, { color = p.red, type = 'car' } = {}) {
  const root = batch.node();
  const wheels = [];
  const long = type === 'van';
  const length = long ? 3.15 : 2.9;
  batch.box(0, .47, 0, length - .17, .23, 1.32, p.black, root, 0, true);
  batch.box(0, .77, 0, length, .51, 1.42, color, root, 0, true);
  batch.box(.87, 1.00, 0, .93, .16, 1.35, color, root, 0, true);
  batch.box(-.30, 1.24, 0, long ? 1.93 : 1.26, .68, 1.25, color, root, 0, true);
  for (const side of [-1, 1]) {
    batch.box(-.30, 1.31, side * .632, long ? 1.7 : 1.05, .40, .022, p.glass, root);
    batch.box(-.30, 1.31, side * .65, .07, .46, .035, color, root);
    batch.box(-.52, 1.01, side * .728, .22, .036, .035, p.cream, root, 2);
    batch.box(.40, 1.17, side * .79, .19, .1, .16, color, root, 1, true);
  }
  const windscreen = batch.box(long ? .69 : .35, 1.30, 0, .09, .46, 1.13, p.glass, root);
  windscreen.rotation.z = -.18;
  batch.box(long ? -1.24 : -.92, 1.3, 0, .035, .43, 1.1, p.glass, root);
  batch.box(-.3, 1.61, 0, long ? 1.98 : 1.40, .13, 1.30, long ? p.cream : color, root, 0, true);
  batch.studs(-.3, 1.68, 0, long ? 3 : 2, 2, long ? p.cream : color, root, 1);
  batch.studs(.97, 1.085, 0, 1, 2, color, root, 1);
  batch.studs(-1.21, 1.04, 0, 1, 2, color, root, 2);
  for (const x of [-1.01, 1.01]) {
    for (const z of [-.73, .73]) {
      const wheel = batch.node(root, [x, .4, z]);
      batch.cylinder(0, 0, 0, .37, .25, p.black, wheel, [Math.PI / 2, 0, 0]);
      batch.cylinder(0, 0, Math.sign(z) * .135, .215, .03, p.cream, wheel, [Math.PI / 2, 0, 0]);
      batch.cylinder(0, 0, Math.sign(z) * .157, .11, .035, p.metal, wheel, [Math.PI / 2, 0, 0]);
      batch.box(0, 0, Math.sign(z) * .18, .3, .055, .025, p.roadDark, wheel, 2);
      wheels.push(wheel);
    }
  }
  for (const z of [-.46, .46]) {
    batch.box(length / 2 + .015, .88, z, .06, .22, .32, p.ivory, root, 0, true);
    batch.box(-length / 2 - .016, .87, z, .045, .18, .25, p.red, root);
  }
  batch.box(length / 2 + .04, .59, 0, .09, .17, 1.23, p.cream, root, 0, true);
  batch.box(-length / 2 - .04, .56, 0, .09, .12, 1.20, p.cream, root, 1);
  batch.box(length / 2 + .024, .81, 0, .04, .15, .42, p.roadDark, root, 1);
  if (long) {
    batch.brick(-.6, 1.86, 0, 1.12, .31, 1.12, p.tan, root);
    batch.box(-.6, 1.88, 0, .10, .34, 1.15, p.brown, root, 1);
  }
  return { root, wheels, height: long ? 2.1 : 1.8, halfX: length / 2 + .1, halfZ: .9 };
}

export function createTransit(batch, type = 'bus') {
  const root = batch.node();
  const tram = type === 'tram';
  const color = tram ? p.orange : p.yellow;
  const length = tram ? 4.4 : 4.05;
  const wheels = [];
  batch.box(0, .43, 0, length - .18, .25, 1.47, p.roadDark, root, 0, true);
  batch.box(0, 1.02, 0, length, .96, 1.65, color, root, 0, true);
  batch.box(0, 1.82, 0, length - .04, .77, 1.60, tram ? p.cream : color, root, 0, true);
  batch.box(0, 2.29, 0, length + .08, .21, 1.72, tram ? p.cream : p.ivory, root, 0, true);
  batch.box(0, 1.39, 0, length + .015, .13, 1.68, tram ? p.cream : p.ivory, root, 1);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = -length / 2 + .44 + i * (length - .84) / 4;
      batch.box(x, 1.87, side * .816, .55, .57, .025, p.glass, root, 0, true);
      if (i === 1 || i === 3) {
        batch.cylinder(x + .05, 1.72, side * .842, .095, .14, p.skin, root, [Math.PI / 2, 0, 0], 2);
        batch.box(x + .05, 1.60, side * .842, .17, .1, .022, i === 1 ? p.blue : p.red, root, 2);
      }
    }
    batch.box(.65, 1.37, side * .839, .03, 1.5, .027, p.brown, root, 1);
    batch.box(1.26, 1.37, side * .839, .03, 1.5, .027, p.brown, root, 1);
    batch.box(.96, .82, side * .839, .53, .37, .023, tram ? p.cream : p.yellow, root);
    batch.box(0, .68, side * .844, length - .6, .085, .025, tram ? p.brown : p.cream, root, 2);
  }
  for (const end of [-1, 1]) {
    batch.box(end * (length / 2 + .013), 1.88, 0, .035, .64, 1.39, p.glass, root, 0, true);
    batch.box(end * (length / 2 + .04), 2.14, 0, .018, .10, .85, p.black, root, 1);
    batch.box(end * (length / 2 + .048), 2.14, 0, .012, .045, .39, p.yellow, root, 2);
    batch.box(end * (length / 2 + .06), .64, 0, .13, .18, 1.57, p.cream, root, 0, true);
    for (const z of [-.54, .54]) batch.box(end * (length / 2 + .03), 1.01, z, .06, .21, .28, end === 1 ? p.ivory : p.red, root, 0, true);
  }
  for (const x of [-1.32, 1.32]) {
    for (const z of [-.79, .79]) {
      const wheel = batch.node(root, [x, .4, z]);
      batch.cylinder(0, 0, 0, tram ? .27 : .37, .22, p.black, wheel, [Math.PI / 2, 0, 0]);
      batch.cylinder(0, 0, Math.sign(z) * .13, .18, .027, p.metal, wheel, [Math.PI / 2, 0, 0]);
      batch.box(0, 0, Math.sign(z) * .15, .27, .05, .02, p.roadDark, wheel, 2);
      wheels.push(wheel);
    }
  }
  batch.studs(0, 2.4, 0, 6, 2, tram ? p.cream : p.ivory, root, 1);
  if (tram) {
    batch.box(0, 2.49, 0, 1.33, .13, .88, p.roadDark, root);
    for (const z of [-.22, .22]) {
      batch.rod([-.5, 2.55, z], [0, 2.97, z], .045, p.brown, root);
      batch.rod([.5, 2.55, z], [0, 2.97, z], .045, p.brown, root);
      batch.rod([0, 2.97, z], [-.38, 3.38, z], .045, p.brown, root);
      batch.rod([0, 2.97, z], [.38, 3.38, z], .045, p.brown, root);
    }
    batch.box(0, 3.39, 0, .85, .065, .68, p.roadDark, root);
  }
  return { root, wheels, height: tram ? 3.5 : 2.5, halfX: length / 2 + .15, halfZ: .94 };
}

export function createPerson(batch, { shirt = p.red, trousers = p.navy, hat = null, scale = 1, accessory = null } = {}) {
  const root = batch.node();
  root.scale.setScalar(scale);
  const legs = [];
  const arms = [];
  batch.box(0, .55, 0, .45, .15, .28, trousers, root, 0, true);
  for (const side of [-1, 1]) {
    const leg = batch.node(root, [side * .125, .51, 0]);
    batch.box(0, -.20, 0, .20, .4, .27, trousers, leg, 0, true);
    batch.box(0, -.39, .055, .21, .1, .35, trousers, leg, 0, true);
    legs.push(leg);
    const arm = batch.node(root, [side * .3, .98, 0], [0, 0, side * .15]);
    batch.cylinder(0, -.18, 0, .10, .37, shirt, arm);
    batch.part('hand', [0, -.4, .028], [1, 1, 1], p.skin, arm, [0, 0, side < 0 ? Math.PI : 0], 1);
    batch.cylinder(0, -.36, 0, .078, .1, p.skin, arm);
    arms.push(arm);
  }
  batch.part('torso', [0, .84, 0], [.56, .48, .32], shirt, root);
  batch.box(0, .88, .167, .032, .32, .013, p.cream, root, 2);
  batch.box(-.10, .94, .17, .10, .073, .013, p.cream, root, 2);
  batch.cylinder(0, 1.09, 0, .11, .10, p.skin, root);
  const head = batch.node(root, [0, 1.31, 0]);
  batch.cylinder(0, 0, 0, .22, .35, p.skin, head);
  batch.cylinder(0, .213, 0, .112, .074, p.skin, head);
  for (const x of [-.075, .075]) batch.part('sphere', [x, .025, .201], [.045, .054, .031], p.black, head, [0, 0, 0], 1);
  batch.part('smile', [0, -.046, .216], [1, 1, 1], p.black, head, [0, 0, Math.PI], 1);
  if (hat) {
    batch.part('sphere', [0, .17, -.005], [.47, .23, .46], hat, head);
    batch.box(0, .156, .14, .47, .065, .4, hat, head, 0, true);
    batch.cylinder(0, .292, 0, .045, .03, hat, head, [0, 0, 0], 2);
  } else {
    batch.box(0, .18, -.025, .44, .12, .39, p.chocolate, head, 0, true);
    batch.box(0, .10, -.171, .43, .18, .085, p.chocolate, head, 1, true);
  }
  if (accessory === 'coffee') {
    arms[1].rotation.x = -.5;
    batch.cylinder(0, -.41, .12, .079, .17, p.white, arms[1]);
    batch.cylinder(0, -.313, .12, .085, .025, p.brown, arms[1]);
  } else if (accessory === 'tool') {
    batch.box(0, -.42, .14, .055, .04, .43, p.metal, arms[1]);
    batch.part('hand', [0, -.42, .38], [1.3, 1.3, 1.3], p.metal, arms[1], [Math.PI / 2, 0, 0], 1);
  } else if (accessory === 'bag') {
    batch.box(0, -.54, .07, .19, .24, .22, p.tan, arms[1], 1, true);
  }
  return { root, head, arms, legs, halfX: .42 * scale, halfZ: .34 * scale, height: 1.65 * scale };
}

export function createTree(batch, x, z, { scale = 1, leaf = p.green, kind = 'broad' } = {}) {
  const root = batch.node(batch.root, [x, .20, z]);
  root.scale.setScalar(scale);
  batch.brick(0, .10, 0, 1.12, .24, 1.12, p.tan, root, 2);
  batch.brick(0, .26, 0, 1.0, .13, 1.0, p.deepGreen, root, 1);
  for (let i = 0; i < 4; i++) batch.brick(0, .55 + i * .37, 0, .37, .38, .37, i % 2 ? p.brown : p.chocolate, root, -1);
  if (kind === 'pine') {
    for (let i = 0; i < 4; i++) {
      const width = 1.80 - i * .35;
      batch.part('cone', [0, 1.56 + i * .48, 0], [width, .94, width], i % 2 ? p.deepGreen : leaf, root);
      batch.studs(0, 1.34 + i * .48, 0, Math.max(1, 3 - i), Math.max(1, 3 - i), leaf, root, 2);
    }
  } else {
    batch.rod([0, 1.1, 0], [.65, 2.5, .12], .13, p.brown, root);
    batch.rod([0, 1.3, 0], [-.55, 2.35, -.25], .12, p.brown, root);
    const clusters = [[-.50,2.35,0,1.68,.43,1.68], [.54,2.49,.1,1.68,.46,1.68], [0,2.83,-.18,1.68,.48,1.68], [-.45,2.83,-.22,1.12,.25,1.12], [.05,3.17,-.10,1.12,.28,1.12]];
    clusters.forEach(([cx, cy, cz, w, h, d], i) => batch.brick(cx, cy, cz, w, h, d, i % 2 ? leaf : p.leaf, root));
  }
  return { x, z, halfX: .59 * scale, halfZ: .59 * scale };
}

export function createPlanter(batch, x, z, { width = 1.6, color = p.cream, flowers = false, rotation = 0 } = {}) {
  const root = batch.node(batch.root, [x, .19, z], [0, rotation, 0]);
  batch.brick(0, .18, 0, width, .37, .75, color, root, -1);
  batch.box(0, .39, 0, width + .10, .11, .83, color, root);
  batch.box(0, .43, 0, width - .14, .025, .60, p.brown, root);
  const count = Math.max(2, Math.floor(width / .43));
  for (let i = 0; i < count; i++) {
    const cx = (i - (count - 1) / 2) * .40;
    if (flowers) {
      batch.cylinder(cx, .62, 0, .025, .34, p.deepGreen, root);
      batch.box(cx + .07, .62, .04, .22, .06, .17, p.green, root, 2);
      const color = [p.white, p.yellow, p.pink][i % 3];
      for (let j = 0; j < 5; j++) {
        const angle = j * Math.PI * 2 / 5;
        batch.cylinder(cx + Math.cos(angle) * .105, .85, Math.sin(angle) * .105, .081, .056, color, root, [0, 0, 0], 1);
      }
      batch.cylinder(cx, .89, 0, .06, .06, p.yellow, root, [0, 0, 0], 1);
    } else {
      batch.brick(cx, .66 + (i % 2) * .08, 0, .52, .44, .55, i % 2 ? p.leaf : p.green, root);
    }
  }
  return { x, z, halfX: width / 2 + .1, halfZ: .44, yaw: rotation };
}

export function createLamp(batch, x, z, height = 2.8) {
  const root = batch.node(batch.root, [x, .20, z]);
  batch.cylinder(0, .1, 0, .18, .2, p.navy, root);
  batch.cylinder(0, height / 2, 0, .055, height, p.navy, root);
  batch.box(0, height - .08, 0, .44, .07, .44, p.navy, root);
  batch.box(0, height + .17, 0, .28, .40, .28, p.ivory, root, 0, true);
  for (const dx of [-.16, .16]) for (const dz of [-.16, .16]) batch.box(dx, height + .16, dz, .033, .46, .033, p.navy, root, 2);
  batch.part('roof', [0, height + .45, 0], [.5, .16, .5], p.navy, root);
  return { x, z, halfX: .20, halfZ: .20 };
}

export function createBench(batch, x, z, rotation = 0) {
  const root = batch.node(batch.root, [x, .20, z], [0, rotation, 0]);
  for (const dx of [-.7, .7]) {
    batch.box(dx, .28, 0, .095, .56, .48, p.navy, root);
    batch.box(dx, .83, -.22, .075, .74, .07, p.navy, root);
  }
  for (let i = 0; i < 3; i++) batch.box(0, .57, -.23 + i * .22, 1.95, .10, .18, p.tan, root);
  for (let i = 0; i < 2; i++) batch.box(0, .89 + i * .23, -.27, 1.95, .18, .1, p.tan, root);
  return { x, z, halfX: 1, halfZ: .38, yaw: rotation };
}

export function createCone(batch, x, z) {
  batch.box(x, .27, z, .42, .11, .42, p.black, batch.root, 1);
  batch.part('cone', [x, .57, z], [.31, .56, .31], p.orange, batch.root, [0, 0, 0], 1);
  batch.cylinder(x, .61, z, .093, .085, p.cream, batch.root, [0, 0, 0], 2);
  return { x, z, halfX: .23, halfZ: .23 };
}
