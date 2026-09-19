/**
 * store.js —— 便利店（建筑外壳 + 南立面玻璃幕墙 + 完整店内陈设）
 *
 * 坐标约定（单位：米）
 *   +X  → 画面右侧      +Z  → 朝向街道（观察者一侧）
 *   y=0 → 路面标高      y=walkY → 人行道台面
 *
 * 设计要点：
 *  - 南立面（z = shopMaxZ）是一整面落地玻璃幕墙，从街上可以清楚看到店内；
 *  - 店内暖色明亮：两组中央货架、靠墙饮料柜、收银台、咖啡机、关东煮柜台、
 *    冰淇淋柜、便当冷藏柜、杂志架、香烟柜、后场门与储物柜等一应俱全；
 *  - 玻璃用极低不透明度 + clearcoat，既有玻璃质感又不遮挡视线；
 *  - 静态部件按材质合并（makeBank），整间店只产生二十余个 draw call。
 */

import * as THREE from 'three';
import {
  LAYOUT as S,
  makeBank,
  toonMat,
  glowMat,
  makeGlow,
  getStripeTexture,
  getShopSignTexture,
  getShopSignSideTexture,
  getLightBoxTexture,
  getPosterTexture,
  getMagazineTexture,
  getDrinkRowTexture,
  getShelfGoodsTexture,
  getFloorGuideTexture,
  getWallTileTexture,
  makeRng,
} from './kit.js';

/* ------------------------------------------------------------------ */
/* 店内可用空间                                                         */
/* ------------------------------------------------------------------ */

export const INTERIOR = {
  x0: S.shopMinX + 0.06,
  x1: S.shopMaxX - 0.06,
  z0: S.shopMinZ + 0.05, // 后墙内侧
  z1: S.shopMaxZ - 0.05, // 玻璃内侧
  floorY: S.walkY + 0.06,
  ceilY: S.walkY + S.shopHeight - 0.4,
};

/* ------------------------------------------------------------------ */
/* 材质                                                               */
/* ------------------------------------------------------------------ */

const M = {};
let materialsReady = false;

function buildMaterials() {
  if (materialsReady) return;
  materialsReady = true;

  const floorTex = getWallTileTexture();
  floorTex.repeat.set(10, 6);
  floorTex.needsUpdate = true;

  const wallTex = getWallTileTexture();
  wallTex.repeat.set(6, 3);
  wallTex.needsUpdate = true;

  // 室内表面：偏暖的米白，在暖光下发亮，和室外冷灰形成对比
  M.floor = toonMat({ color: 0xc9c4b8, map: floorTex });
  M.wallInner = toonMat({ color: 0xe4dccc, map: wallTex });
  M.ceiling = toonMat({ color: 0xe8e2d4 });

  // 铝合金门窗框（亮）与外墙（暗），拉开室内外的明度对比
  M.frame = toonMat({ color: 0x9aa0a8 });
  M.frameDark = toonMat({ color: 0x2c3037 });
  M.wallOuter = toonMat({ color: 0x8e8a80 });
  M.wallOuterDark = toonMat({ color: 0x44423d });
  M.green = toonMat({ color: 0x187a4f, emissive: 0x0a3b26, emissiveIntensity: 0.9 });
  M.canopy = toonMat({ color: 0xf2f0e5, map: getStripeTexture() });

  M.darkPlastic = toonMat({ color: 0x2b2f35 });
  M.chrome = toonMat({ color: 0xc9cfd7 });
  M.white = toonMat({ color: 0xf4f4f0 });
  M.counterTop = toonMat({ color: 0xeae4d6 });
  M.shelfBoard = toonMat({ color: 0xf2eee4 });
  M.red = toonMat({ color: 0xc4432f, emissive: 0x3a0f08, emissiveIntensity: 0.6 });
  M.steel = toonMat({ color: 0x9ca4ae });

  M.goods1 = toonMat({ color: 0xbfb8a8, map: getShelfGoodsTexture(1) });
  M.goods2 = toonMat({ color: 0xbfb8a8, map: getShelfGoodsTexture(2) });
  M.goods3 = toonMat({ color: 0xbfb8a8, map: getShelfGoodsTexture(5) });
  M.drinks = toonMat({
    color: 0xc6c0b4,
    map: getDrinkRowTexture(),
    emissive: 0x2a2622,
    emissiveIntensity: 1,
  });
  M.magazine = toonMat({ color: 0xb8b2a6, map: getMagazineTexture() });
  // 店内灯箱 / 海报：用带自发光的卡通材质而非纯发光材质，
  // 这样它们能接受店内暖光的照射，有明暗层次，不会变成一片死白。
  M.poster0 = toonMat({ color: 0xa8a49c, map: getPosterTexture(0), emissive: 0x2e2a24, emissiveIntensity: 1 });
  M.poster1 = toonMat({ color: 0xa8a49c, map: getPosterTexture(1), emissive: 0x2e2a24, emissiveIntensity: 1 });
  M.poster2 = toonMat({ color: 0xa8a49c, map: getPosterTexture(2), emissive: 0x2e2a24, emissiveIntensity: 1 });
  M.poster3 = toonMat({ color: 0xa8a49c, map: getPosterTexture(3), emissive: 0x2e2a24, emissiveIntensity: 1 });

  M.ceilingLamp = glowMat(0xfff4dd);
  M.fridgeInner = glowMat(0xfff7e9);
  M.freezerGlow = glowMat(0xcfeaff);
  M.ovenGlow = glowMat(0xffca8a);
  M.bentoGlow = glowMat(0xffe0b0);

  M.signFront = glowMat(0xffffff, { map: getShopSignTexture() });
  M.signSide = glowMat(0xffffff, { map: getShopSignSideTexture() });
  M.lightBox0 = glowMat(0xffffff, { map: getLightBoxTexture(0) });
  M.lightBox1 = glowMat(0xffffff, { map: getLightBoxTexture(1) });
  M.lightBox2 = glowMat(0xffffff, { map: getLightBoxTexture(2) });

  // 玻璃：非常淡的一层，几乎不遮挡视线，主要靠高光/清漆提供玻璃质感
  M.glass = new THREE.MeshPhysicalMaterial({
    color: 0xf2faff,
    metalness: 0.0,
    roughness: 0.04,
    transparent: true,
    opacity: 0.055,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    specularIntensity: 1,
  });

  M.glassFridge = new THREE.MeshPhysicalMaterial({
    color: 0xf4fbff,
    metalness: 0.0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
}

/* ------------------------------------------------------------------ */
/* 店内陈设                                                             */
/* ------------------------------------------------------------------ */

/** 一组货架（沿 X 方向排布，正面朝向街道 +Z） */
function addShelf(bank, I, spec) {
  const { x0, x1, z0, z1, goodsMat, goodsKey, tiers, backPanel = true } = spec;
  const w = x1 - x0;
  const d = z1 - z0;
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  const h = tiers[tiers.length - 1] + 0.34;

  if (backPanel) {
    bank.add(
      'shelfBoard',
      new THREE.BoxGeometry(w, h, 0.05).translate(mx, I.floorY + h / 2, mz - d / 2 + 0.03),
      M.shelfBoard,
      { outline: true, outlineWidth: 0.012 }
    );
  }
  for (const ty of tiers) {
    bank.add(
      'shelfBoard',
      new THREE.BoxGeometry(w, 0.035, d).translate(mx, I.floorY + ty, mz),
      M.shelfBoard,
      { outline: true, outlineWidth: 0.01 }
    );
    const gh = 0.3;
    // 商品体块（贴图让远看就是一排排整齐的商品）
    bank.add(
      goodsKey,
      new THREE.BoxGeometry(w - 0.08, gh, d - 0.1).translate(mx, I.floorY + ty + gh / 2 + 0.02, mz),
      goodsMat,
      { outline: false, castShadow: false, receiveShadow: false }
    );
    // 层板前沿的红色价签条
    bank.add(
      'redFlat',
      new THREE.BoxGeometry(w - 0.05, 0.035, 0.02).translate(mx, I.floorY + ty - 0.012, mz + d / 2 + 0.004),
      M.red,
      { outline: false, castShadow: false }
    );
  }
  for (const sx of [x0, x1]) {
    bank.add(
      'shelfBoard',
      new THREE.BoxGeometry(0.04, h, d).translate(sx, I.floorY + h / 2, mz),
      M.shelfBoard,
      { outline: true, outlineWidth: 0.01 }
    );
  }
}

function buildInterior(bank, env) {
  const I = INTERIOR;
  const W = I.x1 - I.x0;
  const D = I.z1 - I.z0;
  const cx = (I.x0 + I.x1) / 2;
  const cz = (I.z0 + I.z1) / 2;
  const rng = makeRng(20250912);

  /* ---------------- 地板 ---------------- */
  bank.add(
    'floor',
    new THREE.BoxGeometry(W, 0.06, D).translate(cx, I.floorY - 0.03, cz),
    M.floor,
    { outline: false, receiveShadow: true, castShadow: false }
  );

  // 地面导视带：从门口笔直通向后场
  bank.add(
    'guide',
    new THREE.PlaneGeometry(0.32, 2.6)
      .rotateX(-Math.PI / 2)
      .translate(S.doorCenterX, I.floorY + 0.004, I.z1 - 1.4),
    toonMat({ color: 0xffffff, map: getFloorGuideTexture() }),
    { outline: false, castShadow: false, receiveShadow: false }
  );

  /* ---------------- 天花 ---------------- */
  bank.add(
    'ceiling',
    new THREE.BoxGeometry(W + 0.16, 0.1, D + 0.16).translate(cx, I.ceilY + 0.05, cz),
    M.ceiling,
    { outline: true, outlineWidth: 0.012, castShadow: false, receiveShadow: false }
  );

  // 天花板日光灯
  for (const lz of [I.z1 - 0.5, cz, I.z0 + 0.5]) {
    for (const lx of [-3.1, -1.8, -0.5, 0.8]) {
      bank.add(
        'ceilingLamp',
        new THREE.BoxGeometry(0.86, 0.05, 0.22).translate(lx, I.ceilY - 0.03, lz),
        M.ceilingLamp,
        { outline: false, castShadow: false, receiveShadow: false }
      );
    }
  }

  /* ---------------- 围护墙 ---------------- */
  // 后墙
  bank.add(
    'wallInner',
    new THREE.BoxGeometry(W + 0.2, S.shopHeight, 0.1).translate(cx, S.walkY + S.shopHeight / 2, I.z0 - 0.05),
    M.wallInner,
    { outline: true, outlineWidth: 0.014 }
  );
  // 左墙
  bank.add(
    'wallInner',
    new THREE.BoxGeometry(0.1, S.shopHeight, D + 0.2).translate(I.x0 - 0.05, S.walkY + S.shopHeight / 2, cz),
    M.wallInner,
    { outline: true, outlineWidth: 0.014 }
  );
  // 右墙
  bank.add(
    'wallInner',
    new THREE.BoxGeometry(0.1, S.shopHeight, D + 0.2).translate(I.x1 + 0.05, S.walkY + S.shopHeight / 2, cz),
    M.wallInner,
    { outline: true, outlineWidth: 0.014 }
  );

  /* ---------------- 后墙：后场门 / 储物柜 ---------------- */
  const doorW = 0.95;
  const doorCx = -0.9;
  bank.add(
    'frameDark',
    new THREE.BoxGeometry(doorW + 0.12, 2.02, 0.05).translate(doorCx, I.floorY + 1.01, I.z0 + 0.01),
    M.frameDark,
    { outline: true, outlineWidth: 0.014 }
  );
  bank.add(
    'white',
    new THREE.BoxGeometry(doorW, 1.9, 0.06).translate(doorCx, I.floorY + 0.98, I.z0 + 0.04),
    M.white,
    { outline: true, outlineWidth: 0.012 }
  );
  // 门上的绿色标牌
  bank.add(
    'signGreenFlat',
    new THREE.PlaneGeometry(0.42, 0.1).translate(doorCx, I.floorY + 1.62, I.z0 + 0.075),
    M.green,
    { outline: false, castShadow: false }
  );
  bank.add(
    'chrome',
    new THREE.BoxGeometry(0.045, 0.1, 0.05).translate(doorCx + 0.36, I.floorY + 1.0, I.z0 + 0.085),
    M.chrome,
    { outline: true, outlineWidth: 0.01 }
  );

  // 储物柜（门右边）
  for (let i = 0; i < 2; i++) {
    const lx = -0.24 + i * 0.26;
    bank.add(
      'steel',
      new THREE.BoxGeometry(0.24, 1.88, 0.42).translate(lx, I.floorY + 0.94, I.z0 + 0.23),
      M.steel,
      { outline: true, outlineWidth: 0.012 }
    );
    bank.add(
      'frameDarkFlat',
      new THREE.PlaneGeometry(0.16, 1.56).translate(lx, I.floorY + 0.99, I.z0 + 0.445),
      M.frameDark,
      { outline: false, castShadow: false }
    );
  }

  /* ---------------- 中央货架两组（面向街道） ---------------- */
  addShelf(bank, I, {
    x0: -2.95,
    x1: -1.72,
    z0: -1.92,
    z1: -1.44,
    goodsMat: M.goods1,
    goodsKey: 'goods1',
    tiers: [0.3, 0.66, 1.02, 1.38],
  });
  addShelf(bank, I, {
    x0: -2.95,
    x1: -1.72,
    z0: -3.04,
    z1: -2.56,
    goodsMat: M.goods2,
    goodsKey: 'goods2',
    tiers: [0.3, 0.66, 1.02, 1.38],
  });

  /* ---------------- 饮料柜（靠左墙，面向店内 +X） ---------------- */
  const frX0 = I.x0;
  const frD = 0.62;
  const frZ0 = -3.36;
  const frZ1 = -2.06;
  const frH = 2.05;
  const frCx = (frZ0 + frZ1) / 2;
  const frLen = frZ1 - frZ0;

  bank.add(
    'white',
    new THREE.BoxGeometry(frD, frH, frLen).translate(frX0 + frD / 2, I.floorY + frH / 2, frCx),
    M.white,
    { outline: true, outlineWidth: 0.014 }
  );
  // 发光内胆
  bank.add(
    'fridgeInner',
    new THREE.PlaneGeometry(frLen - 0.1, frH - 0.3)
      .rotateY(Math.PI / 2)
      .translate(frX0 + frD + 0.002, I.floorY + frH / 2, frCx),
    M.fridgeInner,
    { outline: false, castShadow: false, receiveShadow: false }
  );
  // 五层饮料
  for (const ty of [0.4, 0.73, 1.06, 1.39, 1.72]) {
    bank.add(
      'drinks',
      new THREE.PlaneGeometry(frLen - 0.14, 0.3)
        .rotateY(Math.PI / 2)
        .translate(frX0 + frD + 0.008, I.floorY + ty, frCx),
      M.drinks,
      { outline: false, castShadow: false, receiveShadow: false }
    );
  }
  // 三扇玻璃门 + 门框
  for (let i = 0; i < 3; i++) {
    const zz = frZ0 + (frLen / 3) * (i + 0.5);
    bank.add(
      'glassFridge',
      new THREE.PlaneGeometry(frLen / 3 - 0.07, frH - 0.26)
        .rotateY(Math.PI / 2)
        .translate(frX0 + frD + 0.04, I.floorY + frH / 2, zz),
      M.glassFridge,
      { outline: false, castShadow: false, receiveShadow: false }
    );
    for (const dz of [-frLen / 6 + 0.035, frLen / 6 - 0.035]) {
      bank.add(
        'chrome',
        new THREE.BoxGeometry(0.03, frH - 0.24, 0.05).translate(
          frX0 + frD + 0.04,
          I.floorY + frH / 2,
          zz + dz
        ),
        M.chrome,
        { outline: true, outlineWidth: 0.008 }
      );
    }
  }
  // 柜顶绿色灯箱
  bank.add(
    'green',
    new THREE.BoxGeometry(0.5, 0.22, frLen).translate(frX0 + 0.3, I.floorY + frH + 0.12, frCx),
    M.green,
    { outline: true, outlineWidth: 0.012 }
  );
  bank.add(
    'lightBox2',
    new THREE.PlaneGeometry(frLen - 0.1, 0.21)
      .rotateY(Math.PI / 2)
      .translate(frX0 + 0.56, I.floorY + frH + 0.12, frCx),
    M.lightBox2,
    { outline: false, castShadow: false }
  );

  /* ---------------- 便当 / 饭团冷藏柜（后墙前） ---------------- */
  const bX0 = -1.62;
  const bX1 = -0.5;
  const bZ0 = -3.6;
  const bZ1 = -3.16;
  bank.add(
    'white',
    new THREE.BoxGeometry(bX1 - bX0, 0.9, bZ1 - bZ0).translate((bX0 + bX1) / 2, I.floorY + 0.45, (bZ0 + bZ1) / 2),
    M.white,
    { outline: true, outlineWidth: 0.014 }
  );
  bank.add(
    'bentoGlow',
    new THREE.PlaneGeometry(bX1 - bX0 - 0.1, bZ1 - bZ0 - 0.1)
      .rotateX(-Math.PI / 2)
      .translate((bX0 + bX1) / 2, I.floorY + 0.915, (bZ0 + bZ1) / 2),
    M.bentoGlow,
    { outline: false, castShadow: false, receiveShadow: false }
  );
  // 柜内便当
  for (let i = 0; i < 5; i++) {
    bank.add(
      'goods3',
      new THREE.BoxGeometry(0.17, 0.08, 0.22).translate(
        bX0 + 0.12 + i * 0.21,
        I.floorY + 0.96,
        (bZ0 + bZ1) / 2
      ),
      M.goods3,
      { outline: false, castShadow: false, receiveShadow: false }
    );
  }
  bank.add(
    'frame',
    new THREE.BoxGeometry(bX1 - bX0 + 0.05, 0.05, bZ1 - bZ0 + 0.05).translate(
      (bX0 + bX1) / 2,
      I.floorY + 0.93,
      (bZ0 + bZ1) / 2
    ),
    M.frame,
    { outline: true, outlineWidth: 0.01 }
  );

  /* ---------------- 收银台（右侧靠后） ---------------- */
  const cTop = 0.95;
  const cX0 = 0.28;
  const cX1 = 1.62;
  const cZ0 = -3.52;
  const cZ1 = -2.72;
  bank.add(
    'counterTop',
    new THREE.BoxGeometry(cX1 - cX0, cTop, cZ1 - cZ0).translate(
      (cX0 + cX1) / 2,
      I.floorY + cTop / 2,
      (cZ0 + cZ1) / 2
    ),
    M.counterTop,
    { outline: true, outlineWidth: 0.014 }
  );
  bank.add(
    'frameDark',
    new THREE.BoxGeometry(cX1 - cX0 + 0.03, 0.05, cZ1 - cZ0 + 0.03).translate(
      (cX0 + cX1) / 2,
      I.floorY + cTop + 0.012,
      (cZ0 + cZ1) / 2
    ),
    M.frameDark,
    { outline: true, outlineWidth: 0.01 }
  );

  // 收银机
  bank.add(
    'darkPlastic',
    new THREE.BoxGeometry(0.42, 0.16, 0.32).translate(0.62, I.floorY + cTop + 0.1, -3.16),
    M.darkPlastic,
    { outline: true, outlineWidth: 0.012 }
  );
  bank.add(
    'darkPlastic',
    new THREE.BoxGeometry(0.36, 0.26, 0.05).rotateX(-0.42).translate(0.62, I.floorY + cTop + 0.3, -3.28),
    M.darkPlastic,
    { outline: true, outlineWidth: 0.012 }
  );
  bank.add(
    'lightBox1',
    new THREE.PlaneGeometry(0.27, 0.17).rotateX(-0.42).translate(0.62, I.floorY + cTop + 0.3, -3.255),
    M.lightBox1,
    { outline: false, castShadow: false }
  );

  // 咖啡机
  bank.add(
    'darkPlastic',
    new THREE.BoxGeometry(0.4, 0.58, 0.38).translate(1.22, I.floorY + cTop + 0.29, -3.24),
    M.darkPlastic,
    { outline: true, outlineWidth: 0.012 }
  );
  bank.add(
    'chrome',
    new THREE.BoxGeometry(0.34, 0.22, 0.3).translate(1.22, I.floorY + cTop + 0.2, -3.24),
    M.chrome,
    { outline: true, outlineWidth: 0.01 }
  );
  bank.add(
    'ovenGlow',
    new THREE.PlaneGeometry(0.16, 0.06).translate(1.22, I.floorY + cTop + 0.46, -3.045),
    M.ovenGlow,
    { outline: false, castShadow: false }
  );
  // 咖啡杯架
  bank.add(
    'white',
    new THREE.BoxGeometry(0.16, 0.3, 0.16).translate(1.5, I.floorY + cTop + 0.15, -3.3),
    M.white,
    { outline: true, outlineWidth: 0.01 }
  );

  // 香烟柜（收银台后墙上方）
  bank.add(
    'frameDark',
    new THREE.BoxGeometry(1.35, 1.05, 0.18).translate(0.95, I.floorY + 1.72, I.z0 + 0.14),
    M.frameDark,
    { outline: true, outlineWidth: 0.014 }
  );
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 10; c++) {
      const gx = 0.33 + c * 0.124;
      const gy = I.floorY + 1.34 + r * 0.185;
      const pick = rng();
      bank.add(
        pick > 0.5 ? 'goods1' : 'goods2',
        new THREE.BoxGeometry(0.09, 0.13, 0.03).translate(gx, gy, I.z0 + 0.24),
        pick > 0.5 ? M.goods1 : M.goods2,
        { outline: false, castShadow: false, receiveShadow: false }
      );
    }
  }

  /* ---------------- 关东煮柜台 ---------------- */
  const oX0 = 0.5;
  const oX1 = 1.6;
  const oZ0 = -2.32;
  const oZ1 = -1.74;
  const oCx = (oX0 + oX1) / 2;
  const oCz = (oZ0 + oZ1) / 2;
  bank.add(
    'steel',
    new THREE.BoxGeometry(oX1 - oX0, 0.82, oZ1 - oZ0).translate(oCx, I.floorY + 0.41, oCz),
    M.steel,
    { outline: true, outlineWidth: 0.012 }
  );
  bank.add(
    'chrome',
    new THREE.BoxGeometry(oX1 - oX0 + 0.06, 0.05, oZ1 - oZ0 + 0.06).translate(oCx, I.floorY + 0.845, oCz),
    M.chrome,
    { outline: true, outlineWidth: 0.01 }
  );
  for (let i = 0; i < 5; i++) {
    const gx = oX0 + 0.12 + i * 0.22;
    bank.add(
      'ovenGlow',
      new THREE.PlaneGeometry(0.17, 0.36).rotateX(-Math.PI / 2).translate(gx, I.floorY + 0.872, oCz),
      M.ovenGlow,
      { outline: false, castShadow: false }
    );
    bank.add(
      'chrome',
      new THREE.BoxGeometry(0.02, 0.07, 0.38).translate(gx + 0.1, I.floorY + 0.9, oCz),
      M.chrome,
      { outline: false, castShadow: false }
    );
  }
  // 关东煮灯箱（吊在柜台上方）
  bank.add(
    'lightBox0',
    new THREE.PlaneGeometry(0.56, 0.26).translate(oCx, I.floorY + 1.46, oCz + 0.02),
    M.lightBox0,
    { outline: false, castShadow: false }
  );
  bank.add(
    'chrome',
    new THREE.CylinderGeometry(0.008, 0.008, 0.55, 6).translate(oCx, I.floorY + 1.83, oCz),
    M.chrome,
    { outline: false, castShadow: false }
  );

  /* ---------------- 冰淇淋 / 冷冻柜 ---------------- */
  const iX0 = 0.32;
  const iX1 = 1.6;
  const iZ0 = -1.56;
  const iZ1 = -1.08;
  const iCx = (iX0 + iX1) / 2;
  const iCz = (iZ0 + iZ1) / 2;
  bank.add(
    'white',
    new THREE.BoxGeometry(iX1 - iX0, 0.84, iZ1 - iZ0).translate(iCx, I.floorY + 0.42, iCz),
    M.white,
    { outline: true, outlineWidth: 0.014 }
  );
  bank.add(
    'freezerGlow',
    new THREE.PlaneGeometry(iX1 - iX0 - 0.12, iZ1 - iZ0 - 0.12)
      .rotateX(-Math.PI / 2)
      .translate(iCx, I.floorY + 0.853, iCz),
    M.freezerGlow,
    { outline: false, castShadow: false, receiveShadow: false }
  );
  bank.add(
    'frame',
    new THREE.BoxGeometry(iX1 - iX0 + 0.05, 0.05, iZ1 - iZ0 + 0.05).translate(iCx, I.floorY + 0.88, iCz),
    M.frame,
    { outline: true, outlineWidth: 0.01 }
  );
  bank.add(
    'lightBox1',
    new THREE.PlaneGeometry(0.42, 0.24).translate(iCx, I.floorY + 0.5, iZ1 + 0.006),
    M.lightBox1,
    { outline: false, castShadow: false }
  );

  /* ---------------- 杂志架（左前，面向街道） ---------------- */
  const mgX0 = -3.78;
  const mgX1 = -3.14;
  const mgXc = (mgX0 + mgX1) / 2;
  const mgZ0 = -1.66;
  const mgZ1 = -1.24;
  bank.add(
    'frameDark',
    new THREE.BoxGeometry(mgX1 - mgX0, 1.32, mgZ1 - mgZ0).translate(mgXc, I.floorY + 0.66, (mgZ0 + mgZ1) / 2),
    M.frameDark,
    { outline: true, outlineWidth: 0.012 }
  );
  for (let i = 0; i < 4; i++) {
    bank.add(
      'magazine',
      new THREE.PlaneGeometry(mgX1 - mgX0 - 0.1, 0.26).translate(mgXc, I.floorY + 0.28 + i * 0.31, mgZ1 + 0.012),
      M.magazine,
      { outline: false, castShadow: false }
    );
  }

  /* ---------------- 海报 / 灯箱 ---------------- */
  // 后墙海报
  bank.add(
    'poster0',
    new THREE.PlaneGeometry(0.6, 0.84).translate(-2.5, I.floorY + 2.1, I.z0 + 0.07),
    M.poster0,
    { outline: false, castShadow: false }
  );
  bank.add(
    'poster1',
    new THREE.PlaneGeometry(0.46, 0.66).translate(1.62, I.floorY + 2.2, I.z0 + 0.07),
    M.poster1,
    { outline: false, castShadow: false }
  );
  // 左墙海报（饮料柜上方）
  bank.add(
    'poster2',
    new THREE.PlaneGeometry(0.74, 0.5).rotateY(Math.PI / 2).translate(I.x0 + 0.07, I.floorY + 2.5, -2.7),
    M.poster2,
    { outline: false, castShadow: false }
  );
  // 右墙海报
  bank.add(
    'poster3',
    new THREE.PlaneGeometry(0.6, 0.42).rotateY(-Math.PI / 2).translate(I.x1 - 0.07, I.floorY + 2.3, -2.1),
    M.poster3,
    { outline: false, castShadow: false }
  );

  // 悬挂灯箱（垂直于玻璃，双面，位于视线之上不遮挡货架）
  for (const [ry, off] of [
    [Math.PI / 2, 0.006],
    [-Math.PI / 2, -0.006],
  ]) {
    bank.add(
      'lightBox0',
      new THREE.PlaneGeometry(0.8, 0.3).rotateY(ry).translate(-1.35 + off, I.floorY + 2.36, -1.6),
      M.lightBox0,
      { outline: false, castShadow: false, receiveShadow: false }
    );
  }
  bank.add(
    'frameDarkFlat',
    new THREE.BoxGeometry(0.05, 0.05, 0.8).translate(-1.35, I.floorY + 2.38, -1.6),
    M.frameDark,
    { outline: false, castShadow: false }
  );

  /* ---------------- 店内垃圾桶 ---------------- */
  bank.add(
    'steel',
    new THREE.CylinderGeometry(0.14, 0.12, 0.62, 10).translate(0.05, I.floorY + 0.31, -1.22),
    M.steel,
    { outline: true, outlineWidth: 0.01 }
  );
  bank.add(
    'frameDark',
    new THREE.CylinderGeometry(0.155, 0.12, 0.15, 10).translate(0.05, I.floorY + 0.68, -1.22),
    M.frameDark,
    { outline: true, outlineWidth: 0.01 }
  );

  /* ---------------- 店内灯光（暖色，但保持明暗层次） ---------------- */
  // 卖场不用“均匀铺满”的打法：靠后的主光 + 两盏辅助光，
  // 让货架侧面、柜体下方出现明确的暗部，避免整间店糊成一片白。
  // （three r155+ 为物理光照单位，点光按平方反比衰减）
  const inner = new THREE.PointLight(0xffdcae, 1.9, 7.5, 2);
  inner.position.set(cx, I.ceilY - 0.5, -2.4);
  env.extraLights.push(inner);

  const inner2 = new THREE.PointLight(0xffcf9a, 1.1, 5.5, 2);
  inner2.position.set(-2.9, I.ceilY - 0.6, -1.9);
  env.extraLights.push(inner2);

  const inner3 = new THREE.PointLight(0xffe6c4, 1.0, 5.0, 2);
  inner3.position.set(0.8, I.ceilY - 0.6, -3.0);
  env.extraLights.push(inner3);

  const inner4 = new THREE.PointLight(0xffd9a4, 0.9, 4.5, 2);
  inner4.position.set(1.1, 1.5, -1.5);
  env.extraLights.push(inner4);
}

/* ------------------------------------------------------------------ */
/* 建筑外壳 / 南立面                                                    */
/* ------------------------------------------------------------------ */

function buildFacade(bank, env) {
  const y0 = S.walkY;
  const h = S.shopHeight;
  const frontZ = S.shopMaxZ;
  const backZ = S.shopMinZ;
  const gB = S.glassBottom;
  const gT = S.glassTop;
  const x0 = S.shopMinX;
  const x1 = S.shopMaxX;
  const doorX0 = S.doorCenterX - S.doorHalf;
  const doorX1 = S.doorCenterX + S.doorHalf;

  /* --- 屋顶板 --- */
  bank.add(
    'wallOuter',
    new THREE.BoxGeometry(x1 - x0 + 0.36, 0.18, frontZ - backZ + 0.2).translate(
      (x0 + x1) / 2,
      y0 + h + 0.09,
      (frontZ + backZ) / 2
    ),
    M.wallOuter,
    { outline: true, outlineWidth: 0.016 }
  );
  // 屋顶的女儿墙压顶
  bank.add(
    'wallOuter',
    new THREE.BoxGeometry(x1 - x0 + 0.4, 0.06, frontZ - backZ + 0.24).translate(
      (x0 + x1) / 2,
      y0 + h + 0.2,
      (frontZ + backZ) / 2
    ),
    M.wallOuter,
    { outline: true, outlineWidth: 0.012 }
  );

  /* --- 左右侧墙 --- */
  for (const wx of [x0 - 0.06, x1 + 0.06]) {
    bank.add(
      'wallOuter',
      new THREE.BoxGeometry(0.12, h + 0.18, frontZ - backZ + 0.12).translate(
        wx,
        y0 + (h + 0.18) / 2,
        (frontZ + backZ) / 2
      ),
      M.wallOuter,
      { outline: true, outlineWidth: 0.016 }
    );
  }

  /* --- 下裙墙（避开门口） --- */
  for (const [sx0, sx1] of [
    [x0, doorX0],
    [doorX1, x1],
  ]) {
    bank.add(
      'wallOuterDark',
      new THREE.BoxGeometry(sx1 - sx0, gB, 0.18).translate((sx0 + sx1) / 2, y0 + gB / 2, frontZ + 0.03),
      M.wallOuterDark,
      { outline: true, outlineWidth: 0.014 }
    );
    // 裙墙上的踢脚亮条
    bank.add(
      'frame',
      new THREE.BoxGeometry(sx1 - sx0 - 0.02, 0.04, 0.2).translate(
        (sx0 + sx1) / 2,
        y0 + gB + 0.005,
        frontZ + 0.03
      ),
      M.frame,
      { outline: true, outlineWidth: 0.008 }
    );
  }

  /* --- 玻璃幕墙（门洞两侧的固定扇） --- */
  const glassSpans = [
    [x0 + 0.06, doorX0 - 0.02],
    [doorX1 + 0.02, x1 - 0.06],
  ];
  for (const [gx0, gx1] of glassSpans) {
    bank.add(
      'glass',
      new THREE.PlaneGeometry(gx1 - gx0, gT - gB).translate(
        (gx0 + gx1) / 2,
        y0 + (gB + gT) / 2,
        frontZ + 0.012
      ),
      M.glass,
      { outline: false, castShadow: false, receiveShadow: false }
    );
  }

  /* --- 门窗框 --- */
  for (const mx of [x0 + 0.06, doorX0 - 0.03, doorX1 + 0.03, x1 - 0.06]) {
    bank.add(
      'frame',
      new THREE.BoxGeometry(0.07, gT - gB + 0.06, 0.16).translate(mx, y0 + (gB + gT) / 2, frontZ + 0.025),
      M.frame,
      { outline: true, outlineWidth: 0.012 }
    );
  }
  // 固定扇中间的横档
  for (const [gx0, gx1] of glassSpans) {
    bank.add(
      'frame',
      new THREE.BoxGeometry(gx1 - gx0, 0.05, 0.14).translate(
        (gx0 + gx1) / 2,
        y0 + gB + (gT - gB) * 0.66,
        frontZ + 0.025
      ),
      M.frame,
      { outline: true, outlineWidth: 0.01 }
    );
  }
  // 玻璃上沿横梁（整条）
  bank.add(
    'frame',
    new THREE.BoxGeometry(x1 - x0 + 0.06, 0.12, 0.18).translate((x0 + x1) / 2, y0 + gT + 0.06, frontZ + 0.025),
    M.frame,
    { outline: true, outlineWidth: 0.012 }
  );

  /* --- 门头招牌 --- */
  const signY = y0 + gT + 0.5;
  const sx0 = x0 - 0.1;
  const sx1 = x1 + 0.1;
  const signD = 0.26;
  bank.add(
    'green',
    new THREE.BoxGeometry(sx1 - sx0, 0.66, signD).translate((sx0 + sx1) / 2, signY, frontZ + signD / 2 - 0.02),
    M.green,
    { outline: true, outlineWidth: 0.016 }
  );

  // 正面灯箱面
  const front = new THREE.Mesh(new THREE.PlaneGeometry(sx1 - sx0 - 0.05, 0.58), M.signFront);
  front.position.set((sx0 + sx1) / 2, signY, frontZ + signD - 0.012);
  env.signMeshes.push(front);
  // 左右侧面灯箱
  const sideR = new THREE.Mesh(new THREE.PlaneGeometry(signD - 0.03, 0.58), M.signSide);
  sideR.rotation.y = Math.PI / 2;
  sideR.position.set(sx1 - 0.004, signY, frontZ + signD / 2 - 0.02);
  env.signMeshes.push(sideR);

  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(signD - 0.03, 0.58), M.signSide);
  sideL.rotation.y = -Math.PI / 2;
  sideL.position.set(sx0 + 0.004, signY, frontZ + signD / 2 - 0.02);
  env.signMeshes.push(sideL);

  // 招牌顶部的青色霓虹描边
  bank.add(
    'neonCyan',
    new THREE.BoxGeometry(sx1 - sx0 + 0.02, 0.028, 0.028).translate(
      (sx0 + sx1) / 2,
      signY + 0.345,
      frontZ + signD - 0.018
    ),
    glowMat(0x7fe6ff),
    { outline: false, castShadow: false, receiveShadow: false }
  );
  // 招牌底部的暖色灯带
  bank.add(
    'ceilingLamp',
    new THREE.BoxGeometry(sx1 - sx0 - 0.4, 0.05, 0.1).translate(
      (sx0 + sx1) / 2,
      y0 + gT + 0.14,
      frontZ + signD + 0.14
    ),
    M.ceilingLamp,
    { outline: false, castShadow: false, receiveShadow: false }
  );

  return { signY, frontZ, y0, h, gB, gT, doorX0, doorX1, sx0, sx1, signD };
}

/* ------------------------------------------------------------------ */
/* 雨棚 / 屋檐                                                          */
/* ------------------------------------------------------------------ */

function buildCanopy(bank, env) {
  const y0 = S.walkY;
  const yTop = y0 + S.glassTop + 0.18;
  const zFront = S.shopMaxZ + 1.2;
  const zBack = S.shopMaxZ - 0.06;
  const x0 = S.shopMinX - 0.22;
  const x1 = S.shopMaxX + 0.22;
  const depth = zFront - zBack;
  const tilt = Math.atan2(0.2, depth);

  const roof = new THREE.BoxGeometry(x1 - x0, 0.07, depth);
  roof.rotateX(-tilt);
  roof.translate((x0 + x1) / 2, yTop + 0.07, (zFront + zBack) / 2);
  bank.add('canopy', roof, M.canopy, { outline: true, outlineWidth: 0.012 });

  // 前檐横梁 + 品牌绿饰条
  bank.add(
    'frameDark',
    new THREE.BoxGeometry(x1 - x0, 0.14, 0.1).translate((x0 + x1) / 2, yTop - 0.01, zFront),
    M.frameDark,
    { outline: true, outlineWidth: 0.012 }
  );
  bank.add(
    'green',
    new THREE.BoxGeometry(x1 - x0, 0.1, 0.05).translate((x0 + x1) / 2, yTop - 0.16, zFront + 0.006),
    M.green,
    { outline: true, outlineWidth: 0.012 }
  );

  // 雨棚支柱
  for (const px of [x0 + 0.18, x1 - 0.18]) {
    bank.add(
      'frame',
      new THREE.CylinderGeometry(0.035, 0.035, yTop - y0 - 0.06, 8).translate(
        px,
        y0 + (yTop - y0 - 0.06) / 2,
        zFront - 0.08
      ),
      M.frame,
      { outline: true, outlineWidth: 0.01 }
    );
  }

  // 棚下灯管
  bank.add(
    'ceilingLamp',
    new THREE.BoxGeometry(x1 - x0 - 0.6, 0.05, 0.09).translate(
      (x0 + x1) / 2,
      yTop - 0.15,
      zFront - 0.52
    ),
    M.ceilingLamp,
    { outline: false, castShadow: false, receiveShadow: false }
  );

  // 棚下暖色光晕
  for (let i = 0; i < 3; i++) {
    const s = makeGlow(0xffd9a0, 1.7, 0.3);
    s.position.set(-2.1 + i * 1.9, yTop - 0.12, zFront - 0.68);
    env.glowGroup.add(s);
  }

  return { zFront, x0, x1, yTop };
}

/* ------------------------------------------------------------------ */
/* 自动门                                                               */
/* ------------------------------------------------------------------ */

function buildDoor() {
  const y0 = S.walkY;
  const gB = S.glassBottom;
  const gT = S.glassTop;
  const z = S.shopMaxZ + 0.01;
  const half = S.doorHalf;
  const group = new THREE.Group();

  const makeLeaf = (dir) => {
    const g = new THREE.Group();
    const w = half;

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, gT - gB - 0.1), M.glass);
    glass.position.set(0, (gB + gT) / 2, 0);
    g.add(glass);

    const parts = [
      new THREE.BoxGeometry(w, 0.07, 0.09).translate(0, gB + 0.035, 0),
      new THREE.BoxGeometry(w, 0.07, 0.09).translate(0, gT - 0.035, 0),
      new THREE.BoxGeometry(w, 0.08, 0.08).translate(0, gB + (gT - gB) * 0.52, 0),
      new THREE.BoxGeometry(0.07, gT - gB, 0.09).translate(-w / 2 + 0.035, (gB + gT) / 2, 0),
      new THREE.BoxGeometry(0.07, gT - gB, 0.09).translate(w / 2 - 0.035, (gB + gT) / 2, 0),
    ];
    for (const gg of parts) {
      const m = new THREE.Mesh(gg, M.frame);
      m.castShadow = true;
      g.add(m);
    }

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), M.chrome);
    handle.position.set(dir * (w / 2 - 0.17), 1.45, 0.075);
    g.add(handle);

    return g;
  };

  const left = makeLeaf(1);
  const right = makeLeaf(-1);
  left.position.set(-half / 2, 0, z);
  right.position.set(half / 2, 0, z);
  group.add(left, right);
  group.position.x = S.doorCenterX;

  // 门顶感应器
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.14), M.frameDark);
  sensor.position.set(S.doorCenterX, y0 + gT + 0.17, z + 0.05);
  group.add(sensor);
  const sensorEye = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.03), glowMat(0xff6b5a));
  sensorEye.position.set(S.doorCenterX, y0 + gT + 0.125, z + 0.125);
  group.add(sensorEye);

  const state = { t: 0, timer: 3.4, open: 0 };

  function update(dt, enabled) {
    if (enabled) {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.open = state.open > 0.5 ? 0 : 1;
        state.timer = state.open > 0.5 ? 3.4 : 2.6 + Math.random() * 3.8;
      }
    } else {
      state.open = 0;
      state.timer = 3.4;
    }
    state.t = THREE.MathUtils.damp(state.t, state.open, 1.9, dt);
    const slide = state.t * (half - 0.07);
    left.position.x = -half / 2 - slide;
    right.position.x = half / 2 + slide;
    return state.t;
  }

  return { group, update, state };
}

/* ------------------------------------------------------------------ */
/* 主入口                                                               */
/* ------------------------------------------------------------------ */

export function createStore() {
  buildMaterials();

  const env = { signMeshes: [], glowGroup: new THREE.Group(), extraLights: [] };
  const bank = makeBank();

  buildInterior(bank, env);
  const facade = buildFacade(bank, env);
  const canopy = buildCanopy(bank, env);

  const root = new THREE.Group();
  root.add(bank.build());

  const door = buildDoor();
  root.add(door.group);

  for (const m of env.signMeshes) root.add(m);
  root.add(env.glowGroup);
  for (const l of env.extraLights) root.add(l);

  return {
    root,
    door,
    facade,
    canopy,
    signMeshes: env.signMeshes,
    materials: M,
    interior: INTERIOR,
    interiorLights: env.extraLights,
  };
}
