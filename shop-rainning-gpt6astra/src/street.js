import * as THREE from 'three';
import { palette as P, material, basic, box, cylinder, sphere, tube, torus, group, plane, label, imageMaterial, textTexture, glow, groundGlow, pointLight, random } from './kit.js';
import { asphalt, posters, manholeTexture } from './textures.js';

function drain(parent, x, z, width = .66, depth = .25, rotate = false) {
  const grate = group(parent, [x, .16, z], rotate ? Math.PI / 2 : 0);
  box(grate, [width, .017, depth], [0, 0, 0], '#182b3a', false);
  for (let i = 0; i < 10; i++) box(grate, [.019, .014, depth - .025], [-width / 2 + .038 + (width - .07) * i / 9, .013, 0], '#6c848f', false);
  for (const z of [-depth / 2, depth / 2]) box(grate, [width, .021, .02], [0, .009, z], '#8b9b9d', false);
}

function roadStripe(parent, width, depth, x, z, color = '#cbd3c7') {
  return box(parent, [width, .007, depth], [x, .153, z], material(color, { emissive: '#8cabad', emissiveIntensity: .045 }), false);
}

function curb(parent, position, width, rotation = 0) {
  const curb = group(parent, position, rotation);
  const n = Math.round(width / .45);
  for (let i = 0; i < n; i++) box(curb, [width / n - .014, .19, .24], [-width / 2 + width / n * (i + .5), .012, 0], i % 4 === 0 ? '#a1aaa5' : '#7c939c', true, true);
}

function bicycle(parent, position) {
  const bike = group(parent, position, -.06);
  const mint = '#84afa0', chrome = '#b4c6bc', tire = '#223345';
  for (const x of [-.55, .55]) {
    torus(bike, .347, .032, [x, .373, 0], tire);
    torus(bike, .301, .014, [x, .373, 0], chrome);
    cylinder(bike, .034, .11, [x, .373, 0], chrome).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      tube(bike, [[x, .373, .018], [x + Math.cos(a) * .30, .373 + Math.sin(a) * .30, .018]], .004, '#859faf');
    }
    torus(bike, .391, .018, [x, .372, 0], mint, [0, 0, .08], Math.PI - .16);
  }
  const A = [-.55, .373, 0], B = [-.20, .86, 0], C = [-.03, .38, 0], D = [.35, .9, 0], E = [.55, .373, 0];
  for (const [p, q] of [[A, B], [B, C], [C, A], [B, D], [C, D], [D, E]]) tube(bike, [p, q], .024, mint);
  tube(bike, [[-.20, .79, 0], [-.24, .98, 0]], .018, chrome);
  box(bike, [.29, .048, .19], [-.255, .978, 0], '#645948', true, true);
  tube(bike, [[.35, .86, 0], [.31, 1.09, 0], [.44, 1.13, 0]], .018, chrome, true);
  tube(bike, [[.44, 1.13, -.21], [.44, 1.13, .21]], .019, chrome);
  for (const z of [-.21, .21]) tube(bike, [[.36, 1.13, z], [.50, 1.13, z]], .024, '#3a5155');
  torus(bike, .101, .015, [-.03, .38, .071], '#8c9b96');
  tube(bike, [[-.55, .373, .07], [-.03, .282, .07]], .011, '#869891');
  tube(bike, [[-.55, .39, .07], [-.03, .48, .07]], .011, '#869891');
  tube(bike, [[-.03, .38, .072], [.08, .25, .085]], .015, '#c3c9b3');
  box(bike, [.13, .035, .08], [.08, .25, .09], '#334950');
  tube(bike, [[-.07, .38, -.07], [-.26, .04, -.18]], .012, '#748c8f');
  tube(bike, [[.45, .71, .03], [.63, .95, .03]], .013, chrome);
  const basket = group(bike, [.66, 1.005, 0]);
  for (const y of [-.14, .13]) {
    for (const z of [-.17, .17]) tube(basket, [[-.21, y, z], [.21, y, z]], .009, chrome);
    for (const x of [-.21, .21]) tube(basket, [[x, y, -.17], [x, y, .17]], .009, chrome);
  }
  for (let i = 0; i < 7; i++) for (const z of [-.17, .17]) tube(basket, [[-.21 + i * .07, -.14, z], [-.21 + i * .07, .13, z]], .0045, '#a4b8ae');
  for (let i = 0; i < 5; i++) for (const x of [-.21, .21]) tube(basket, [[x, -.14, -.17 + i * .085], [x, .13, -.17 + i * .085]], .0045, '#a4b8ae');
  for (let i = 1; i < 4; i++) for (const z of [-.17, .17]) tube(basket, [[-.21, -.14 + i * .067, z], [.21, -.14 + i * .067, z]], .0045, '#a4b8ae');
  cylinder(bike, .055, .06, [.6, .76, .013], '#e7d3a0').rotation.x = Math.PI / 2;
  sphere(bike, .032, [-.93, .47, .02], '#cc7f66', [1, .6, .7]);
  box(bike, [.40, .022, .17], [-.58, .804, 0], '#839f93');
  for (const x of [-.69, -.48]) tube(bike, [[x, .78, -.05], [-.55, .38, -.05]], .008, chrome);
}

function vendingMachine(parent, position, coral = false) {
  const machine = group(parent, position, Math.PI / 2);
  const color = coral ? '#b66665' : '#8ab8ac';
  box(machine, [.94, 1.91, .63], [0, .995, 0], color, true, true);
  box(machine, [.91, .07, .68], [0, 1.969, 0], '#d9d4b8');
  box(machine, [.81, 1.02, .045], [0, 1.323, .337], '#253f50');
  box(machine, [.75, .92, .019], [0, 1.355, .365], basic(coral ? '#dcd4bb' : '#d2ebdf'), false);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const x = (col - 2) * .139, y = .985 + row * .27;
      const bottleColor = ['#81a9a8', '#deb47a', '#b06c61', '#9da56b', '#718faa'][(row + col) % 5];
      cylinder(machine, .035, .145, [x, y + .081, .393], bottleColor, .031, 8);
      cylinder(machine, .019, .044, [x, y + .172, .393], '#e1ddc4', .019, 8);
      box(machine, [.064, .047, .014], [x, y + .082, .427], '#e6e4d0', false);
      box(machine, [.071, .017, .024], [x, y - .034, .435], basic('#93d3c3'), false);
      box(machine, [.045, .008, .006], [x, y - .057, .453], '#547e7e', false);
    }
    box(machine, [.74, .035, .077], [0, .94 + row * .27, .392], '#96afa4', false);
  }
  label(machine, coral ? 'おいしい、ひと休み。' : 'つめた〜い', .80, .145, [0, 1.875, .344], { width: 768, height: 128, size: 74, color: coral ? '#9c5951' : '#3d8c8a', bg: '#f3eacb', emissive: .6 });
  box(machine, [.81, .055, .047], [0, 1.77, .384], basic('#fff0c5'), false);
  box(machine, [.21, .35, .026], [.277, .642, .337], '#294754');
  box(machine, [.15, .065, .01], [.277, .74, .356], basic('#b3d5b1'), false);
  box(machine, [.08, .015, .01], [.277, .625, .358], '#a3b4ac', false);
  cylinder(machine, .034, .02, [.277, .54, .36], '#c7c9b1').rotation.x = Math.PI / 2;
  box(machine, [.59, .17, .095], [-.061, .30, .338], '#2c4650');
  box(machine, [.49, .044, .022], [-.061, .25, .39], '#bccabe');
  label(machine, coral ? 'COFFEE' : 'SODA', .48, .20, [-.14, .628, .342], { width: 512, height: 192, size: 103, bg: color, color: '#f3e9c9', emissive: .16 });
  for (const x of [-.33, .33]) box(machine, [.12, .08, .4], [x, .065, 0], '#324b55');
  glow(machine, [0, 1.3, .39], coral ? '#f5c39b' : '#b8e5d7', 1.4, 1.5, .095);
  groundGlow(parent, [position[0] + .75, .257, position[2]], coral ? '#d0907e' : '#8bd9c2', 2.3, 1.8, .32);
}

function recyclingBin(parent, position, color = '#839daa', text = '缶・びん') {
  const bin = group(parent, position);
  box(bin, [.49, .72, .49], [0, .39, 0], '#a9b6ad', true, true);
  box(bin, [.515, .15, .515], [0, .80, 0], color, true, true);
  cylinder(bin, .105, .012, [0, .884, 0], '#273d4b', .105, 20);
  label(bin, text, .33, .13, [0, .54, .251], { width: 256, height: 128, size: 57, bg: '#d5d9c1', color: '#3b686a' });
  box(bin, [.1, .023, .027], [0, .22, .26], '#54717b', false);
}

function umbrellaStand(parent, position) {
  const rack = group(parent, position);
  box(rack, [.55, .055, .34], [0, .037, 0], '#375961');
  for (const x of [-.26, .26]) for (const z of [-.145, .145]) tube(rack, [[x, .05, z], [x, .52, z]], .013, '#abbcb4');
  for (const y of [.12, .46]) {
    for (const z of [-.15, .15]) tube(rack, [[-.27, y, z], [.27, y, z]], .014, '#b8c6b5');
    for (const x of [-.27, .27]) tube(rack, [[x, y, -.15], [x, y, .15]], .012, '#b8c6b5');
  }
  for (let i = 0; i < 4; i++) {
    const umb = group(rack, [-.19 + i * .13, .04, i % 2 * .1 - .05]);
    umb.rotation.z = (i - 1.4) * .055;
    cylinder(umb, .045, .44, [0, .28, 0], ['#a3c1bd', '#deaaa4', '#e0dac0', '#557997'][i], .065, 8);
    cylinder(umb, .01, .73, [0, .41, 0], '#aebfba');
    torus(umb, .044, .012, [.044, .78, 0], '#cccfbb', [0, 0, 0], Math.PI);
    tube(umb, [[.089, .78, 0], [.089, .733, 0]], .012, '#cccfbb');
    for (let s = 0; s < 6; s++) {
      const a = s * Math.PI / 3;
      tube(umb, [[Math.cos(a) * .042, .06, Math.sin(a) * .042], [Math.cos(a) * .066, .5, Math.sin(a) * .066]], .003, '#647e82');
    }
    cylinder(umb, .064, .033, [0, .35, 0], '#72918f', .064, 8);
  }
}

function aFrame(parent, position, rotation = 0) {
  const frame = group(parent, position, rotation);
  for (const x of [-.34, .34]) {
    tube(frame, [[x, .02, -.23], [x, 1.13, 0]], .03, '#a68f72');
    tube(frame, [[x, .02, .30], [x, 1.13, 0]], .03, '#bd9c71');
  }
  const board = box(frame, [.68, .87, .054], [0, .66, .128], '#ceb386'); board.rotation.x = .13;
  plane(frame, .57, .77, [0, .66, .164], posters.coffee, [.13, 0, 0]);
  tube(frame, [[-.36, .38, -.15], [-.36, .38, .21]], .012, '#405862');
}

function streetLamp(parent, position) {
  const lamp = group(parent, position);
  cylinder(lamp, .14, .13, [0, .08, 0], '#667b86', .13);
  cylinder(lamp, .071, 4.34, [0, 2.24, 0], '#455d74', .055);
  cylinder(lamp, .095, .44, [0, .38, 0], '#637783', .085);
  tube(lamp, [[0, 4.3, 0], [.03, 4.66, 0], [.27, 4.82, 0], [.63, 4.77, 0], [.76, 4.53, 0]], .053, '#617c8b', true);
  cylinder(lamp, .275, .145, [.76, 4.49, 0], '#3f566a', .145, 20);
  cylinder(lamp, .247, .033, [.76, 4.407, 0], basic('#ffe4aa'), .247, 20);
  glow(lamp, [.76, 4.34, 0], '#ffd999', 1.25, 1.25, .47);
  pointLight(lamp, [.76, 4.18, 0], '#ffd695', 15, 7.5);
  groundGlow(parent, [position[0] + .55, .164, position[2]], '#d7ad71', 4.1, 3.8, .25);
  for (const x of [-.095, .095]) for (const z of [-.095, .095]) cylinder(lamp, .018, .024, [x, .15, z], '#9aabab', .018, 6);
  label(lamp, '雨宿り通り', .51, .17, [0, 2.34, .086], { width: 512, height: 128, size: 70, bg: '#3c7177', color: '#e3e5cd' });
  box(lamp, [.12, .43, .05], [0, 1.61, .066], '#929f9b');
  label(lamp, '東町 3', .105, .27, [0, 1.65, .097], { width: 128, height: 256, size: 33, bg: '#d9dbbf', color: '#315c69' });
}

function guardrail(parent, position, length, rotation = 0) {
  const rail = group(parent, position, rotation);
  for (const x of [-length / 2 + .13, length / 2 - .13]) {
    cylinder(rail, .057, .73, [x, .37, 0], '#b9c5b8');
    cylinder(rail, .068, .027, [x, .745, 0], '#d5d3b8');
    cylinder(rail, .096, .048, [x, .03, 0], '#5e7781');
  }
  for (const y of [.33, .65]) tube(rail, [[-length / 2, y, 0], [length / 2, y, 0]], .032, '#d4d4b9');
  for (const x of [-length / 2 + .24, length / 2 - .24]) {
    box(rail, [.18, .065, .012], [x, .65, .035], '#d9c27f', false);
    box(rail, [.038, .064, .015], [x, .65, .044], basic('#ead799'), false);
  }
}

function trafficLight(parent) {
  const pole = group(parent, [5.92, .15, -.40]);
  cylinder(pole, .11, .12, [0, .06, 0], '#5d7782');
  cylinder(pole, .055, 3.63, [0, 1.9, 0], '#677f88');
  tube(pole, [[0, 3.55, 0], [-.65, 3.55, 0]], .044, '#6e878d');
  box(pole, [1.01, .38, .24], [-.64, 3.46, .04], '#354d5a', true, true);
  const lights = [];
  for (let i = 0; i < 3; i++) {
    const x = -1 + i * .36;
    cylinder(pole, .126, .13, [x, 3.46, .205], '#263f4b', .137, 20).rotation.x = Math.PI / 2;
    const m = basic(['#8dccae', '#695849', '#624947'][i]).clone();
    const bulb = cylinder(pole, .092, .015, [x, 3.46, .278], m, .092, 20); bulb.rotation.x = Math.PI / 2;
    lights.push(m);
    const visor = cylinder(pole, .132, .17, [x, 3.515, .264], '#314c5b', .132, 16); visor.rotation.x = Math.PI / 2; visor.scale.x = 1; visor.scale.z = .38;
  }
  label(pole, '東町三丁目', 1.18, .22, [-.65, 2.95, .04], { bg: '#ced9cd', color: '#416775', size: 77 });
  return lights;
}

function utilityPole(parent, position, height = 6.2, main = true) {
  const pole = group(parent, position);
  cylinder(pole, .115, height, [0, height / 2, 0], '#889597', .073, 12, true);
  cylinder(pole, .18, .15, [0, .08, 0], '#556d7b', .18);
  for (let i = 0; i < 7; i++) cylinder(pole, .12, .10, [0, .39 + i * .17, 0], i % 2 ? '#c4ad64' : '#384a53', .12);
  for (const y of [height - .55, height - 1.06]) {
    box(pole, [1.20, .065, .075], [0, y, 0], '#576c7c');
    for (const x of [-.51, 0, .51]) {
      cylinder(pole, .033, .24, [x, y + .1, 0], '#c4cec0');
      for (let i = 0; i < 3; i++) cylinder(pole, .063, .022, [x, y + .025 + i * .058, 0], '#b8c9c0', .063);
    }
  }
  for (const y of [1.5, 3.4, height - 1.15]) torus(pole, .113, .012, [0, y, 0], '#455e6f', [Math.PI / 2, 0, 0]);
  if (main) {
    cylinder(pole, .265, .76, [.32, height - 1.54, -.07], '#a2afa9', .265, 16, true);
    cylinder(pole, .288, .042, [.32, height - 1.95, -.07], '#c2c8b2');
    cylinder(pole, .278, .038, [.32, height - 1.14, -.07], '#c2c8b2');
    box(pole, [.66, .035, .15], [.27, height - 2, -.07], '#4e6574');
    for (const x of [.15, .45]) {
      cylinder(pole, .044, .17, [x, height - 1.08, -.07], '#b8c9bd');
      tube(pole, [[x, height - .98, -.07], [x + .12, height - .70, .06], [x - .2, height - .35, 0]], .016, '#293d4c', true);
    }
    torus(pole, .28, .019, [.02, height - 2.55, .15], '#263d4d');
    torus(pole, .31, .014, [.02, height - 2.55, .15], '#314b58');
    box(pole, [.3, .44, .20], [0, 2.27, .13], '#849b99');
    tube(pole, [[.14, 2.31, .13], [.17, 1.5, .13], [.18, .25, .11]], .014, '#374f5f', true);
  }
  label(pole, '東町\n3-12', .11, .31, [0, 1.73, .124], { width: 128, height: 256, size: 27, bg: '#dee0c6', color: '#3b6770' });
  return { x: position[0], z: position[2], y: position[1] + height };
}

function outdoorAC(parent, position, rotation = 0) {
  const ac = group(parent, position, rotation);
  box(ac, [1.17, .81, .43], [0, .48, 0], '#aab7ae', true, true);
  for (const x of [-.40, .40]) box(ac, [.15, .11, .50], [x, .04, 0], '#697e7d');
  cylinder(ac, .29, .014, [-.15, .49, .227], '#415d69', .29, 24).rotation.x = Math.PI / 2;
  for (const r of [.11, .19, .265]) torus(ac, r, .009, [-.15, .49, .242], '#aebfb4');
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    tube(ac, [[-.15, .49, .253], [-.15 + Math.cos(a) * .27, .49 + Math.sin(a) * .27, .253]], .007, '#bdc7b8');
  }
  cylinder(ac, .049, .027, [-.15, .49, .258], '#aebfb4').rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) box(ac, [.19, .014, .016], [.42, .24 + i * .059, .231], '#597882', false);
  tube(ac, [[.55, .38, -.04], [.70, .37, -.04], [.70, 1.58, -.12]], .035, '#c2c7b3', true);
}

function planter(parent, position, wide = false) {
  const planter = group(parent, position);
  box(planter, [wide ? .8 : .46, .35, .44], [0, .20, 0], '#758883', true, true);
  box(planter, [wide ? .73 : .39, .014, .37], [0, .38, 0], '#334c49', false);
  for (let i = 0; i < (wide ? 15 : 9); i++) {
    const x = (random() - .5) * (wide ? .65 : .32), z = (random() - .5) * .30;
    const h = .18 + random() * .28;
    tube(planter, [[x, .36, z], [x * 1.3, .36 + h, z * 1.4]], .008, '#677d67');
    const leaf = sphere(planter, .11, [x * 1.3, .41 + h, z * 1.4], i % 2 ? '#668e79' : '#83a08a', [.56, 1.2, .8]);
    leaf.rotation.z = (random() - .5) * 1.5;
  }
}

export function createStreet(scene) {
  const street = group(scene);
  street.name = 'Square miniature streetscape';
  // One continuous, beveled square plinth: no geometry spills beyond its edges.
  box(street, [14.0, .55, 14.0], [0, -.205, 0], '#34495d', true, true);
  box(street, [13.92, .10, 13.92], [0, -.49, 0], '#24374c', true, true);
  box(street, [14.015, .036, 14.015], [0, -.365, 0], '#667986', false, true);
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: .32, metalness: .21, color: '#b3c4d0' });
  box(street, [13.88, .085, 13.88], [0, .098, 0], roadMat, false);
  box(street, [10.75, .14, 9.54], [-1.575, .188, -2.08], '#738592', true, true);
  plane(street, 10.65, 9.47, [-1.575, .261, -2.08], material('#748997'), [-Math.PI / 2, 0, 0]);
  // Square pavement stones and a change of kerb direction establish the street corner.
  for (let x = -6.7; x < 3.7; x += .54) box(street, [.009, .004, 9.41], [x, .265, -2.1], '#4e687f', false);
  for (let z = -6.7; z < 2.55; z += .54) box(street, [10.58, .004, .009], [-1.57, .265, z], '#4e687f', false);
  curb(street, [-1.53, .21, 2.75], 10.82);
  curb(street, [3.92, .21, -2.04], 9.5, Math.PI / 2);
  box(street, [10.66, .016, .13], [-1.51, .148, 2.994], '#253e51', false);
  box(street, [.13, .016, 9.57], [4.16, .148, -2.07], '#253e51', false);
  for (const x of [-5.4, -2.6, .2, 3.16]) drain(street, x, 2.99);
  for (const z of [-5.4, -2.6, .25]) drain(street, 4.17, z, .66, .25, true);
  drain(street, -5.58, 1.85, .40, .32);
  // Reflective crosswalk and a single small parking bay.
  for (let i = 0; i < 7; i++) roadStripe(street, 2.39, .255, .87, 3.28 + i * .473);
  for (const x of [-6.09, -2.26]) roadStripe(street, .042, 2.05, x, 4.36, '#a6b5b2');
  roadStripe(street, 3.87, .042, -4.17, 5.4, '#a6b5b2');
  roadStripe(street, 3.87, .042, -4.17, 3.35, '#a6b5b2');
  label(street, 'P', .56, .68, [-4.13, .159, 4.22], { width: 256, height: 256, size: 192, bg: '#45586d', color: '#b6c4be' }, [-Math.PI / 2, 0, 0]);
  for (const x of [-5.81, -2.57]) box(street, [.24, .105, .47], [x, .205, 3.69], '#8c9897', true, true);
  for (let z = -5.8; z < 1.1; z += 1.77) roadStripe(street, .052, .8, 6.43, z, '#a4b9bd');
  roadStripe(street, 2.1, .11, 5.35, 2.74);
  label(street, '止まれ', 1.02, 1.41, [5.29, .163, .99], { width: 384, height: 512, size: 95, bg: '#3b4d64', color: '#bfc9c0' }, [-Math.PI / 2, 0, 0]);
  // Tactile paving and small raised dots, all modeled rather than overlaid UI.
  for (let i = 0; i < 5; i++) {
    const x = .57 + i * .31;
    box(street, [.30, .018, .32], [x, .28, 2.34], '#c6aa65', false);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) cylinder(street, .013, .011, [x - .104 + a * .068, .296, 2.24 + b * .066], '#ddc388', .013, 6);
  }
  const manhole = new THREE.Mesh(new THREE.CircleGeometry(.48, 48), imageMaterial(manholeTexture));
  manhole.rotation.x = -Math.PI / 2; manhole.position.set(4.95, .164, 4.45); street.add(manhole);
  torus(street, .489, .012, [4.95, .161, 4.45], '#8a9ca2', [Math.PI / 2, 0, 0]);
  torus(street, .535, .016, [4.95, .155, 4.45], '#253d53', [Math.PI / 2, 0, 0]);
  box(street, [1.88, .025, .72], [1.25, .284, 1.98], '#3b6265', true, true);
  label(street, 'いらっしゃいませ', 1.30, .29, [1.25, .300, 1.94], { width: 768, height: 192, size: 70, bg: '#3b6265', color: '#b4c8ad' }, [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 20; i++) box(street, [.016, .004, .58], [.38 + i * .092, .3, 1.98], basic('#a9b7a1', .07), false);
  bicycle(street, [-3.95, .27, 2.08]);
  umbrellaStand(street, [-.03, .265, 2.04]);
  aFrame(street, [3.12, .27, 1.87], -.33);
  vendingMachine(street, [3.13, .27, -2.65], false);
  vendingMachine(street, [3.13, .27, -3.76], true);
  recyclingBin(street, [3.21, .27, -4.92], '#78a49a');
  recyclingBin(street, [-5.83, .27, -.21], '#a89b80', 'もえるごみ');
  recyclingBin(street, [-5.83, .27, -.83], '#7495a6', 'ペットボトル');
  streetLamp(street, [-5.9, .15, 4.61]);
  guardrail(street, [-4.16, .15, 6.08], 3.55);
  guardrail(street, [6.31, .15, -2.04], 2.13, Math.PI / 2);
  const trafficLights = trafficLight(street);
  const p1 = utilityPole(street, [5.97, .15, -5.37], 6.30, true);
  const p2 = utilityPole(street, [-6.13, .26, -4.80], 5.76, false);
  for (let i = 0; i < 3; i++) {
    const offset = (i - 1) * .49;
    tube(street, [[p1.x + offset, p1.y - .37, p1.z], [2.7, 5.09 - i * .06, -5.2], [-2.7, 4.84 - i * .06, -5.0], [p2.x + offset, p2.y - .37, p2.z]], .014, '#253649', true);
  }
  tube(street, [[p1.x, p1.y - 1.07, p1.z], [2.5, 4.42, -5.11], [-2.4, 4.30, -4.99], [p2.x, p2.y - 1.06, p2.z]], .023, '#273b4d', true);
  tube(street, [[p2.x, 4.35, p2.z], [-5.76, 3.78, -3.55], [-5.24, 3.04, -2.98]], .012, '#2a4052', true);
  outdoorAC(street, [-5.63, .27, -2.69], -Math.PI / 2);
  outdoorAC(street, [-2.95, .26, -5.08], Math.PI);
  // Back-of-house details make the object rewarding to turn around.
  box(street, [1.05, 2.24, .052], [.58, 1.54, -4.66], '#617e84');
  for (let i = 0; i < 12; i++) box(street, [.95, .018, .016], [.58, .59 + i * .17, -4.697], '#839b97', false);
  box(street, [1.3, .09, .47], [.58, 2.76, -4.83], '#98aba7');
  box(street, [.034, .18, .044], [.93, 1.45, -4.72], '#bbc6b5');
  label(street, '搬入口', .53, .15, [.57, 2.40, -4.701], { width: 384, height: 128, size: 83, bg: '#acb9a5', color: '#42616b' }, [0, Math.PI, 0]);
  box(street, [.37, .61, .12], [-4.08, 1.39, -4.73], '#9aaba4');
  for (let i = 0; i < 3; i++) tube(street, [[-4.18 + i * .09, 1.41, -4.77], [-4.18 + i * .09, 2.53, -4.77], [-3.35, 2.53, -4.77]], .012, '#718e92', true);
  cylinder(street, .088, .05, [-4.08, 1.46, -4.81], '#405c69').rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const crate = group(street, [1.85, .29 + i * .27, -5.0], .05);
    box(crate, [.65, .23, .48], [0, .11, 0], '#557b76');
    for (let n = 0; n < 5; n++) box(crate, [.083, .12, .008], [-.25 + n * .126, .12, -.247], '#324f55', false);
  }
  const notice = group(street, [-5.243, 1.65, -.24], -Math.PI / 2);
  box(notice, [1.05, 1.34, .064], [0, 0, 0], '#526f75');
  plane(notice, .96, 1.24, [0, 0, .037], posters.community);
  for (const x of [-.43, .43]) sphere(notice, .013, [x, .56, .05], '#dcbd85');
  planter(street, [-5.79, .27, 1.25]);
  planter(street, [3.17, .27, -.95]);
  planter(street, [-5.86, .27, -5.59], true);
  // A small parking sign at the bend.
  cylinder(street, .033, 1.97, [3.54, 1.26, .61], '#a0b2ad');
  box(street, [.61, .55, .06], [3.54, 2.05, .61], '#577f92', true, true);
  label(street, 'P', .53, .43, [3.54, 2.06, .649], { width: 256, height: 256, size: 186, bg: '#4d8194', color: '#e3e8d3' });
  label(street, 'お客様専用', .58, .16, [3.54, 1.67, .634], { width: 512, height: 128, size: 72, bg: '#d9e0ce', color: '#4b7280' });
  // Reflector tabs, expansion joints and screws on the collectible base.
  for (const x of [-6.32, 6.32]) for (const z of [-6.97, 6.97]) {
    const bolt = cylinder(street, .027, .012, [x, -.22, z], '#98a7a8', .027, 8); bolt.rotation.x = Math.PI / 2;
  }
  return { root: street, trafficLights };
}
