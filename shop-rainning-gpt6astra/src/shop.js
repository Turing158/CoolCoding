import * as THREE from 'three';
import { palette as P, material, basic, box, cylinder, sphere, tube, torus, group, plane, label, imageMaterial, glow, groundGlow, pointLight, random } from './kit.js';
import { brand, posters, magazineTextures, floorTexture } from './textures.js';

const warmWhite = material('#f0e7c9', { emissive: '#e8b97a', emissiveIntensity: .17 });
const shelfWhite = material('#d8d8bd', { emissive: '#e8c785', emissiveIntensity: .13 });
const packages = ['#ce816b', '#e2c57d', '#83aaa0', '#e4daba', '#839aad', '#b49aa8'];
const shelfTicket = basic('#ede1ac');
export const shopStats = { products: 0 };

function bottle(parent, x, y, z, color, h = .22) {
  cylinder(parent, .042, h * .7, [x, y + h * .35, z], color, .037, 8);
  cylinder(parent, .021, h * .27, [x, y + h * .82, z], '#d9e6cc', .019, 8);
  cylinder(parent, .024, .025, [x, y + h * .98, z], color, .024, 8);
  cylinder(parent, .043, h * .27, [x, y + h * .40, z], '#eee7c7', .043, 8);
  shopStats.products++;
}

function onigiri(parent, x, y, z, flavor = '#ca9374') {
  const shape = new THREE.Shape();
  shape.moveTo(-.078, 0); shape.lineTo(.078, 0); shape.quadraticCurveTo(.103, .003, .087, .028); shape.lineTo(.012, .152); shape.quadraticCurveTo(0, .174, -.014, .151); shape.lineTo(-.09, .027); shape.quadraticCurveTo(-.1, .005, -.078, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: .062, bevelEnabled: false });
  const object = new THREE.Mesh(geo, warmWhite); object.position.set(x, y, z); object.userData.mergeStatic = true; parent.add(object);
  box(parent, [.055, .092, .067], [x, y + .045, z + .031], '#273d3c', false);
  box(parent, [.031, .017, .004], [x, y + .123, z + .066], flavor, false);
  shopStats.products++;
}

function bento(parent, x, y, z) {
  box(parent, [.25, .045, .19], [x, y + .022, z], '#374743', true);
  box(parent, [.11, .021, .147], [x - .055, y + .054, z], '#eeebcb', false);
  sphere(parent, .019, [x - .055, y + .07, z], '#b7615c', [1, .45, 1]);
  for (let j = 0; j < 3; j++) sphere(parent, .03, [x + .062, y + .055, z - .055 + j * .05], j === 2 ? '#849067' : '#ba895b', [1, .55, .74]);
  shopStats.products++;
}

function shelf(parent, position, width = 2.02, kind = 'snacks', rotation = 0) {
  const rack = group(parent, position, rotation);
  box(rack, [width, .18, .6], [0, .12, 0], P.teal, true);
  box(rack, [width, 1.25, .055], [0, .8, -.265], shelfWhite);
  for (const x of [-width / 2 + .035, width / 2 - .035]) box(rack, [.055, 1.64, .58], [x, .83, 0], shelfWhite);
  for (let row = 0; row < 4; row++) {
    const y = .22 + row * .36;
    box(rack, [width, .042, .61], [0, y, .018], shelfWhite, true);
    box(rack, [width, .055, .022], [0, y - .023, .324], '#b1966e', false);
    const count = kind === 'bento' ? 6 : 10;
    for (let col = 0; col < count; col++) {
      const x = (col - (count - 1) / 2) * ((width - .16) / count);
      box(rack, [.085, .039, .004], [x, y - .02, .338], shelfTicket, false);
      box(rack, [.045, .007, .005], [x, y - .025, .342], '#5f746f', false);
      for (let depth = 0; depth < 2; depth++) {
        const z = .19 - depth * .215;
        if (kind === 'onigiri') onigiri(rack, x, y + .024, z - .025);
        else if (kind === 'bento') bento(rack, x, y + .024, z);
        else if (kind === 'drinks') bottle(rack, x, y + .024, z, packages[(col + row) % packages.length], .25);
        else {
          const h = .18 + random() * .07;
          const packet = box(rack, [.115, h, .095], [x, y + h / 2 + .025, z], packages[(Math.floor(col / 2) + row) % packages.length], false, true);
          packet.rotation.z = (random() - .5) * .13;
          box(rack, [.072, .045, .006], [x, y + .13, z + .05], '#f2e8c6', false);
          box(rack, [.093, .011, .1], [x, y + h + .018, z], '#cebd9c', false);
          shopStats.products++;
        }
      }
    }
  }
  const title = { snacks: 'お菓子・スナック', bento: 'できたて お弁当', onigiri: 'おにぎり・パン', drinks: 'ドリンク' }[kind];
  box(rack, [width, .17, .06], [0, 1.65, -.21], P.cream);
  label(rack, title, width - .04, .13, [0, 1.65, -.171], { size: 76, color: kind === 'bento' ? '#a15d45' : '#3b7971', emissive: .2 });
  return rack;
}

function refrigerator(parent, position, index) {
  const fridge = group(parent, position);
  box(fridge, [1.18, 2.4, .58], [0, 1.2, 0], '#566971');
  box(fridge, [1.06, 2.02, .046], [0, 1.14, .306], material('#cee4d5', { emissive: '#9ecdbd', emissiveIntensity: .28 }), false);
  box(fridge, [.97, .1, .36], [0, 2.15, .13], basic('#e5f3d5'), false);
  for (let row = 0; row < 5; row++) {
    const y = .25 + row * .365;
    box(fridge, [1.02, .028, .38], [0, y, .31], '#bdcdbf', false);
    for (let col = 0; col < 8; col++) bottle(fridge, (col - 3.5) * .12, y + .018, .36, packages[(col + index * 2 + row) % 6], .25);
    box(fridge, [.98, .034, .016], [0, y - .014, .51], '#ecddba', false);
  }
  for (let side of [-1, 1]) box(fridge, [.036, 2.14, .046], [side * .548, 1.19, .545], '#9bafb1');
  box(fridge, [.027, 2.05, .047], [0, 1.17, .55], '#899da1');
  for (const x of [-.073, .073]) box(fridge, [.019, .42, .035], [x, 1.12, .589], '#e5e6d6');
  const gl = material('#bed8d3', { transparent: true, opacity: .055, depthWrite: false });
  plane(fridge, 1.035, 2.06, [0, 1.18, .567], gl);
  label(fridge, index === 2 ? 'お酒・ビール' : 'つめたい飲みもの', 1.05, .15, [0, 2.30, .31], { color: '#477d7b', bg: '#e2e9cc', size: 64, emissive: .3 });
  for (let i = 0; i < 9; i++) box(fridge, [.057, .048, .012], [(i - 4) * .1, .078, .301], '#283d46', false);
}

function coffeeMachine(parent, position) {
  const coffee = group(parent, position);
  box(coffee, [.39, .57, .37], [0, .29, 0], '#303d46', true, true);
  box(coffee, [.33, .22, .024], [0, .44, .197], '#cad0bb');
  box(coffee, [.2, .07, .012], [0, .47, .215], basic('#9bc9aa'), false);
  box(coffee, [.31, .19, .2], [0, .14, .108], '#17262d');
  box(coffee, [.36, .025, .34], [0, .04, .09], '#8b9b9d');
  cylinder(coffee, .045, .1, [0, .105, .19], '#f2e5c3', .051);
  cylinder(coffee, .073, .145, [-.086, .65, 0], '#6b5244', .073);
  cylinder(coffee, .078, .025, [-.086, .729, 0], '#293b41');
  cylinder(coffee, .062, .13, [.09, .65, 0], '#7e6350');
  label(coffee, 'COFFEE', .27, .047, [0, .35, .216], { width: 256, height: 64, size: 41, bg: '#303d46', color: '#e5d0a2' });
}

function checkout(parent) {
  const counter = group(parent, [1.42, .43, -.88]);
  box(counter, [1.22, .9, 2.14], [0, .46, 0], '#d1af7f');
  box(counter, [1.24, .08, 2.19], [0, .94, 0], '#f1dfb5');
  box(counter, [.035, .72, 2.1], [.626, .50, 0], '#bc9870');
  for (let i = 0; i < 7; i++) box(counter, [.012, .74, .012], [.65, .49, -.9 + i * .30], '#987c61', false);
  box(counter, [.37, .055, .29], [-.16, 1.01, -.19], '#313c43');
  tube(counter, [[-.16, 1.025, -.2], [-.16, 1.22, -.26]], .035, '#42575e');
  const screen = box(counter, [.36, .24, .05], [-.16, 1.28, -.25], '#3b4e55'); screen.rotation.x = -.17;
  box(counter, [.29, .165, .008], [-.16, 1.29, -.216], basic('#a1d0b0'), false);
  box(counter, [.12, .1, .17], [.13, 1.035, -.05], '#e2d4b4');
  coffeeMachine(counter, [.02, .98, -.7]);
  // A warm, glazed oden tray with dividers and individual ingredients.
  box(counter, [.69, .1, .54], [0, 1.045, .68], '#9aa8a0');
  box(counter, [.61, .012, .46], [0, 1.1, .68], '#9c6d3e', false);
  for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 2; iz++) {
    sphere(counter, .052, [-.21 + ix * .21, 1.132, .55 + iz * .24], ix === 0 ? '#e4d5a2' : '#c8a974', [1, .6, .8]);
    sphere(counter, .045, [-.14 + ix * .20, 1.133, .59 + iz * .20], '#eee0b3', [1, .8, 1]);
  }
  for (const x of [-.11, .11]) box(counter, [.013, .027, .45], [x, 1.12, .68], '#c5c9b5', false);
  box(counter, [.61, .027, .014], [0, 1.12, .68], '#c5c9b5', false);
  for (const x of [-.36, .36]) box(counter, [.022, .4, .035], [x, 1.26, .68], '#d3d9c4');
  box(counter, [.77, .046, .6], [0, 1.47, .68], '#debe88');
  plane(counter, .7, .32, [0, 1.3, .969], material('#f0dfac', { opacity: .09, transparent: true, depthWrite: false }));
  label(counter, 'おでん', .52, .15, [0, .78, 1.079], { bg: '#a65e47', color: '#f6e5bd', width: 384, height: 96, size: 73 });
  for (let i = 0; i < 4; i++) cylinder(counter, .039, .13, [.41, 1.055 + i * .016, -.59], '#e8dfc9', .049);
}

function magazineRack(parent) {
  const rack = group(parent, [-4.40, .43, .77]);
  box(rack, [1.07, .07, .44], [0, .055, 0], '#536b6b');
  box(rack, [1.03, .68, .06], [0, .43, -.17], '#9aab9e');
  for (let row = 0; row < 2; row++) {
    box(rack, [1.04, .05, .23], [0, .20 + row * .37, .03 - row * .08], '#cad0b5');
    for (let i = 0; i < 4; i++) {
      const p = plane(rack, .225, .30, [(i - 1.5) * .253, .36 + row * .33, .15 - row * .08], imageMaterial(magazineTextures[(i + row) % 4], .16));
      p.rotation.x = -.16;
    }
    tube(rack, [[-.53, .255 + row * .35, .167 - row * .08], [.53, .255 + row * .35, .167 - row * .08]], .011, '#607970');
  }
}

function roofDetails(parent) {
  const roof = group(parent);
  box(roof, [7.95, .2, 6.33], [-1.35, 3.56, -1.59], '#8296a1', true, true);
  box(roof, [7.78, .052, 6.15], [-1.35, 3.69, -1.59], '#647987', false);
  for (const x of [-5.25, 2.55]) box(roof, [.085, .17, 6.3], [x, 3.74, -1.59], '#94a5a8');
  for (const z of [-4.73, 1.56]) box(roof, [7.88, .17, .085], [-1.35, 3.74, z], '#97a8ac');
  for (let i = 0; i < 9; i++) box(roof, [.016, .008, 6.08], [-4.8 + i * .87, 3.722, -1.59], '#4b6375', false);
  const ac = group(roof, [-2.5, 3.76, -2.05]);
  box(ac, [1.82, .18, 1.22], [0, .07, 0], '#465d6c');
  box(ac, [1.65, .5, 1.05], [0, .38, 0], '#a0b1af');
  box(ac, [1.74, .07, 1.13], [0, .66, 0], '#c1cbc0');
  for (const x of [-.43, .43]) {
    cylinder(ac, .315, .022, [x, .709, 0], '#304654', .315, 32);
    for (const radius of [.12, .2, .29]) torus(ac, radius, .009, [x, .728, 0], '#8caaa8', [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; tube(ac, [[x, .731, 0], [x + Math.cos(a) * .29, .731, Math.sin(a) * .29]], .007, '#aac0b7'); }
    cylinder(ac, .045, .03, [x, .74, 0], '#afc0b1');
  }
  for (let i = 0; i < 11; i++) box(ac, [1.35, .016, .016], [0, .21 + i * .031, .536], '#577480', false);
  tube(roof, [[-1.7, 3.86, -2.05], [-.8, 3.86, -2.05], [-.62, 3.80, -3.7], [-.62, 3.32, -4.8]], .055, '#b0b8ab', true);
  cylinder(roof, .14, .48, [-4.27, 3.98, -3.72], '#9eb0b3');
  cylinder(roof, .24, .063, [-4.27, 4.25, -3.72], '#c0ccbf');
  box(roof, [.82, .13, 1.10], [.86, 3.8, -3.23], '#a3b3ad');
  box(roof, [.67, .025, .91], [.86, 3.88, -3.23], '#405c6a');
  for (let i = 0; i < 4; i++) box(roof, [.015, .025, .91], [.62 + i * .16, 3.91, -3.23], '#9eaea9', false);
  // Roof puddles are restrained and stay on the roof membrane.
  for (let i = 0; i < 7; i++) {
    const p = plane(roof, .55 + random() * .75, .2 + random() * .3, [-4.7 + random() * 6.8, 3.727, -4.35 + random() * 5.3], basic('#9cadbb', .095), [-Math.PI / 2, 0, random() * 3]);
    p.geometry = new THREE.CircleGeometry(.5, 24); p.scale.set(1.2 + random(), .5 + random(), 1);
  }
}

export function createShop(scene) {
  const shop = group(scene);
  shop.name = 'AMAYORI convenience store';
  box(shop, [7.65, .17, 5.96], [-1.35, .346, -1.59], '#8a8f85');
  plane(shop, 7.47, 5.80, [-1.35, .439, -1.59], imageMaterial(floorTexture, .12), [-Math.PI / 2, 0, 0]);
  // Solid exterior walls use unwrapped diffuse light so indoor point lights
  // cannot create toon-ramp light leaks on their outward-facing surfaces.
  const wallMaterial = new THREE.MeshLambertMaterial({ color: '#c7cbb9' });
  box(shop, [7.65, 2.94, .17], [-1.35, 1.9, -4.56], wallMaterial);
  box(shop, [.17, 2.94, 5.89], [-5.12, 1.9, -1.59], wallMaterial);
  box(shop, [7.7, .25, .2], [-1.35, .55, 1.34], '#6f8b89');
  box(shop, [.2, .25, 5.84], [2.43, .55, -1.59], '#6f8b89');
  // Ceramic plinth seams give the storefront a crafted, architectural scale.
  for (let i = 0; i < 25; i++) box(shop, [.01, .19, .006], [-5.1 + i * .305, .56, 1.444], '#aec0b1', false);
  for (let i = 0; i < 19; i++) box(shop, [.006, .19, .01], [2.533, .56, -4.45 + i * .31], '#aec0b1', false);
  box(shop, [7.65, .12, 5.94], [-1.35, 2.96, -1.59], warmWhite);
  const frontPosts = [-5.06, -2.48, .16, 2.43];
  for (const x of frontPosts) box(shop, [.095, 2.31, .105], [x, 1.74, 1.4], '#9bafa9');
  for (const y of [.66, 2.77]) box(shop, [7.54, .066, .09], [-1.35, y, 1.41], '#c9d1ba');
  const glassMat = material('#b9e2dc', { transparent: true, opacity: .072, depthWrite: false, side: THREE.DoubleSide });
  for (const [x, w] of [[-3.77, 2.49], [-1.16, 2.56]]) plane(shop, w, 2.07, [x, 1.705, 1.404], glassMat);
  for (const z of [-4.48, -2.61, -.7, 1.34]) box(shop, [.095, 2.23, .075], [2.43, 1.73, z], '#a9b8ac');
  for (const y of [.66, 2.77]) box(shop, [.095, .066, 5.85], [2.43, y, -1.59], '#c9d1ba');
  for (const [z, w] of [[-3.54, 1.80], [-1.65, 1.84], [.32, 1.96]]) plane(shop, w, 2.07, [2.434, 1.705, z], glassMat, [0, Math.PI / 2, 0]);
  // A thin safety stripe, sill and a couple of paper posters leave the views open.
  for (const x of [-3.77, -1.16]) {
    box(shop, [2.48, .027, .005], [x, 1.48, 1.413], basic('#b5d3c8', .39), false);
    box(shop, [2.48, .009, .005], [x, 1.43, 1.414], basic('#e2d9b4', .3), false);
  }
  plane(shop, .46, .61, [-4.72, 1.36, 1.465], posters.coffee);
  plane(shop, .52, .69, [-.23, 1.55, 1.466], posters.onigiri);
  plane(shop, .45, .60, [2.487, 1.35, -.57], posters.soda, [0, Math.PI / 2, 0]);
  box(shop, [2.13, .10, .13], [1.30, 2.8, 1.48], '#778b87');
  box(shop, [.17, .045, .11], [1.3, 2.865, 1.52], '#243e41');
  sphere(shop, .023, [1.3, 2.855, 1.583], basic('#80ddc1'));
  const doors = [];
  for (const side of [-1, 1]) {
    const door = group(shop, [1.30 + side * .51, 0, 1.438]);
    door.userData.dynamic = true; door.userData.homeX = door.position.x;
    for (const x of [-.49, .49]) box(door, [.046, 2.10, .045], [x, 1.70, 0], '#c4cebd');
    for (const y of [.66, 2.74]) box(door, [1.02, .05, .055], [0, y, 0], '#c4cebd');
    plane(door, .94, 2.02, [0, 1.70, .005], glassMat);
    box(door, [.024, .35, .045], [-side * .39, 1.46, .04], '#e2dbc0');
    box(door, [.91, .075, .007], [0, 1.66, .025], basic('#72b3a7', .72), false);
    label(door, '自動', .19, .1, [-side * .15, 1.66, .032], { width: 128, height: 64, size: 47, bg: '#72b3a7', color: '#edf1d7' });
    doors.push(door);
  }
  box(shop, [2.12, .035, .40], [1.30, .459, 1.40], '#a3a997');
  const signMaterial = new THREE.MeshBasicMaterial({
    map: brand, color: new THREE.Color().setRGB(1.40, 1.34, 1.21), side: THREE.DoubleSide,
  });
  box(shop, [7.99, .72, .34], [-1.35, 3.18, 1.54], '#c1cbb8', true, true);
  plane(shop, 7.95, .68, [-1.35, 3.18, 1.719], signMaterial);
  box(shop, [.34, .72, 6.13], [2.48, 3.18, -1.55], '#c1cbb8');
  plane(shop, 5.90, .68, [2.657, 3.18, -1.54], signMaterial, [0, Math.PI / 2, 0]);
  // The little projecting lightbox adds a warm accent at the shop's corner.
  box(shop, [.105, .045, .54], [2.64, 2.54, .98], '#516f72');
  box(shop, [.18, .59, .39], [2.73, 2.22, .98], '#c5b99d', true, true);
  label(shop, '酒', .32, .33, [2.825, 2.30, .98], { width: 192, height: 192, size: 140, bg: '#c77b64', color: '#fff0c7', emissive: .45 }, [0, Math.PI / 2, 0]);
  label(shop, 'たばこ', .34, .12, [2.826, 2.053, .98], { width: 384, height: 128, size: 87, bg: '#eed7aa', color: '#8e5d4b', emissive: .24 }, [0, Math.PI / 2, 0]);
  glow(shop, [2.91, 2.24, .98], '#e7a878', .7, .85, .12);
  // Shallow awning with exposed ribs and a luminous underside.
  box(shop, [8.00, .10, .62], [-1.35, 2.825, 1.56], '#a5bcb3');
  box(shop, [7.55, .027, .09], [-1.35, 2.766, 1.80], basic('#ffe0a0'), false);
  box(shop, [.1, .027, 5.70], [2.58, 2.77, -1.5], basic('#ffe0ab'), false);
  for (const x of [-4.94, -2.48, .2, 2.28]) box(shop, [.033, .045, .49], [x, 2.762, 1.54], '#d5d7b8', false);
  glow(shop, [-1.35, 3.18, 1.76], '#97dfc2', 9, .85, .13);
  groundGlow(shop, [-1.35, .252, 2.15], '#f5bc73', 7.5, 3.1, .32);
  groundGlow(shop, [3.2, .252, -.9], '#e4bb71', 2.9, 5.3, .20);
  roofDetails(shop);
  // Interior: three refrigerated doors and a completely stocked shop floor.
  for (let i = 0; i < 3; i++) refrigerator(shop, [-4.31 + i * 1.30, .44, -4.13], i);
  box(shop, [1.24, 2.35, .09], [.18, 1.62, -4.42], '#cad0b7');
  label(shop, 'お弁当・お惣菜', 1.12, .17, [.18, 2.61, -4.363], { size: 74, color: '#aa704f', emissive: .3 });
  shelf(shop, [-3.70, .44, -.25], 1.97, 'onigiri');
  shelf(shop, [-1.37, .44, -.75], 1.89, 'snacks');
  shelf(shop, [-3.14, .44, -2.31], 2.48, 'drinks');
  shelf(shop, [.17, .44, -3.87], 1.15, 'bento');
  checkout(shop); magazineRack(shop);
  box(shop, [.77, 2.21, .07], [1.58, 1.56, -4.414], '#91a79a');
  box(shop, [.82, .055, .085], [1.58, 2.69, -4.35], '#bcc9b2');
  label(shop, 'STAFF ONLY', .48, .12, [1.58, 2.20, -4.367], { width: 512, height: 128, size: 63, bg: '#c4ceae', color: '#566f67' });
  box(shop, [.025, .15, .045], [1.86, 1.45, -4.34], '#cfd3b9');
  // Upright freezer in the front corner, with two framed glass lids.
  box(shop, [1.08, .68, .63], [-2.36, .78, .82], '#c7d9ce');
  box(shop, [1.13, .066, .68], [-2.36, 1.15, .82], '#e1e5cd');
  for (const x of [-2.64, -2.09]) {
    box(shop, [.48, .016, .53], [x, 1.191, .82], '#84b8b0', false);
    box(shop, [.034, .025, .12], [x + .17, 1.211, .82], '#e5e2c7', false);
  }
  label(shop, 'ICE CREAM', .76, .16, [-2.36, .87, 1.141], { width: 768, height: 128, size: 70, bg: '#c7d9ce', color: '#437c78' });
  // Ceiling panels remain geometrically inside the store and visible at low angles.
  for (const x of [-3.6, -1.0, 1.25]) for (const z of [-3.0, .05]) {
    box(shop, [.93, .053, .24], [x, 2.874, z], '#9cafa4');
    box(shop, [.87, .016, .18], [x, 2.838, z], basic('#fff1bd'), false);
  }
  pointLight(shop, [-3.4, 2.42, -.45], '#ffe1aa', 9, 6);
  pointLight(shop, [.95, 2.42, -.45], '#ffe2ad', 9, 6);
  pointLight(shop, [-1.8, 2.40, -3.3], '#ffdf9f', 7, 5);
  pointLight(shop, [1.0, 2.55, 2.15], '#ffc980', 4, 4.6);
  plane(shop, .64, .87, [-5.022, 1.80, -2.20], posters.community, [0, Math.PI / 2, 0]);
  label(shop, 'お会計 →', 1.13, .19, [.48, 2.50, .26], { bg: '#eee2b7', color: '#5d8672', size: 90, emissive: .32 });
  // Interior floor guidance in front of the register.
  label(shop, 'レジはこちら', .63, .19, [.70, .450, .18], { bg: '#b89865', color: '#fff0c7', size: 61 }, [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) box(shop, [.44, .006, .035], [.5, .452, -.2 - i * .3], '#bca56a', false);
  // Rain gutter and downpipe.
  box(shop, [8.16, .083, .075], [-1.35, 3.75, 1.67], '#455f73');
  tube(shop, [[-5.4, 3.75, 1.64], [-5.48, 3.6, 1.52], [-5.48, .51, 1.52], [-5.59, .28, 1.74]], .049, '#809c9e', true);
  for (const y of [.85, 2.36]) box(shop, [.035, .07, .14], [-5.47, y, 1.48], '#bbc1ad');
  return { doors, signMaterial, root: shop };
}
