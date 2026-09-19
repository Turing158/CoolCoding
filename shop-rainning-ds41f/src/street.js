/**
 * street.js —— 街道、底座与街角道具
 *
 * 坐标约定（单位：米）
 *   +X 右   +Z 朝向观察者   y=0 路面 / y=walkY 人行道台面
 *
 * 底座是一整块正方形，所有元素都落在上面：
 *   ┌──────────────────────────┬────┐
 *   │  便利店（-X 一侧）        │ 邻栋│   ← 街区台面
 *   ├──────────┬───────────────┤    │
 *   │          │  小巷（下沉）   │    │
 *   ├──────────┴───────────────┴────┤
 *   │        前 景 车 道             │
 *   └───────────────────────────────┘
 */

import * as THREE from 'three';
import {
  LAYOUT as S,
  makeBank,
  toonMat,
  glowMat,
  makeGlow,
  getAsphaltTexture,
  getTileTexture,
  getDrainTexture,
  getRoadSignTexture,
  getNoticeBoardTexture,
  getVendingTexture,
  getPosterTexture,
  makeRng,
  randRange,
} from './kit.js';

/* 街区与道路的范围（与 LAYOUT 保持一致，集中在此便于调整） */
export const GEO = {
  base: 8.0,
  baseT: 0.3,
  blockMinX: -3.9,
  blockMaxX: 3.3,
  blockMinZ: -3.9,
  blockMaxZ: 1.3,
  roadMaxZ: 3.74,
  roadMaxX: 3.74,
  walkY: S.walkY,
  shopMaxX: S.shopMaxX, // 1.5：小巷左边界
  alleyMaxX: 2.2, // 小巷右边界 = 邻栋左墙
  neighborMinX: 2.2,
  neighborMaxX: 3.3,
  neighborMinZ: -3.9,
  neighborMaxZ: 0.3,
  neighborH: 3.9,
  alleyFrontZ: 0.3, // 小巷开始下沉的位置
};

const M = {};
let ready = false;

/**
 * 求某点所在的硬质铺装表面的高度。
 * 效果层（水波纹、灯光倒影、水洼高光）必须贴着真实表面，否则会埋进台面里看不见。
 */
export function surfaceY(x, z) {
  const inBlock =
    x >= GEO.blockMinX && x <= GEO.blockMaxX && z >= GEO.blockMinZ && z <= GEO.blockMaxZ;
  if (!inBlock) return 0.0;
  // 小巷只在靠街的一段下沉（z > alleyFrontZ），再往北被后侧街区盖住
  if (x > S.shopMaxX && x < GEO.alleyMaxX && z > GEO.alleyFrontZ) return 0.03;
  return GEO.walkY;
}

function buildMaterials() {
  if (ready) return;
  ready = true;

  const asphalt = getAsphaltTexture();
  const tile = getTileTexture();

  M.asphalt = toonMat({ color: 0x2b2f3c, map: asphalt });
  M.tile = toonMat({ color: 0x7b7f8c, map: tile });
  M.alleyFloor = toonMat({ color: 0x55585f, map: tile });

  M.baseSide = toonMat({ color: 0x232630 });
  M.baseEdge = toonMat({ color: 0x5a6070 });
  M.curb = toonMat({ color: 0x8e9096 });
  M.curbTop = toonMat({ color: 0xacaca8 });

  M.paint = toonMat({ color: 0xdcdcd4 });
  M.paintDim = toonMat({ color: 0x9c9b92 });

  M.metal = toonMat({ color: 0x5c6169 });
  M.metalDark = toonMat({ color: 0x2a2e34 });
  M.steel = toonMat({ color: 0x868e98 });
  M.white = toonMat({ color: 0xd8dad6 });
  M.red = toonMat({ color: 0xa83a2b });
  M.yellow = toonMat({ color: 0xc79c28 });
  M.green = toonMat({ color: 0x2a6f4c });
  M.blue = toonMat({ color: 0x27568a });
  M.wood = toonMat({ color: 0x6b5038 });
  M.plastic = toonMat({ color: 0x33383f });

  M.drain = toonMat({ color: 0xffffff, map: getDrainTexture() });
  M.drain.map.repeat.set(6, 1);
  M.drain.map.rotation = Math.PI / 2;
  M.drain.map.center.set(0.5, 0.5);
  M.drain.map.needsUpdate = true;

  M.neighborWall = toonMat({ color: 0x75726b });
  M.neighborWall2 = toonMat({ color: 0x55534d });
  M.neighborTile = toonMat({ color: 0x8a8680, map: tile });
  M.neighborTile.map = tile.clone();
  M.neighborTile.map.repeat.set(4, 6);
  M.neighborTile.map.needsUpdate = true;

  M.vending = toonMat({
    color: 0xffffff,
    map: getVendingTexture(),
    emissive: 0xffffff,
    emissiveIntensity: 0.42,
  });

  M.sign = glowMat(0xffffff, { map: getRoadSignTexture() });
  M.notice = toonMat({ color: 0xffffff, map: getNoticeBoardTexture(), emissive: 0xffffff, emissiveIntensity: 0.12 });
  M.poster = glowMat(0xffffff, { map: getPosterTexture(1) });

  M.lampGlass = glowMat(0xfff3d6);
  M.signalOff = toonMat({ color: 0x23272c });
}

/* ------------------------------------------------------------------ */
/* 底座 / 路面 / 人行道                                                 */
/* ------------------------------------------------------------------ */

function buildGround(bank) {
  const B = GEO.base / 2;

  /* --- 底座本体 --- */
  bank.add(
    'baseSide',
    new THREE.BoxGeometry(GEO.base, GEO.baseT, GEO.base).translate(0, -GEO.baseT / 2, 0),
    M.baseSide,
    { outline: true, outlineWidth: 0.02, receiveShadow: false, castShadow: false }
  );
  // 底座顶面（露在路面之外的边缘，作为模型的地台边线）
  bank.add(
    'baseEdge',
    new THREE.BoxGeometry(GEO.base + 0.04, 0.02, GEO.base + 0.04).translate(0, -GEO.baseT - 0.01, 0),
    M.baseEdge,
    { outline: false, receiveShadow: false, castShadow: false }
  );

  /* --- 路面（前景车道 + 右侧车道，L 形） --- */
  const roadT = 0.04;
  // 前景车道
  bank.add(
    'asphalt',
    new THREE.BoxGeometry(GEO.base, roadT, GEO.roadMaxZ - GEO.blockMaxZ).translate(
      0,
      -roadT / 2,
      (GEO.blockMaxZ + GEO.roadMaxZ) / 2
    ),
    M.asphalt,
    { outline: false, receiveShadow: true, castShadow: false }
  );
  // 右侧车道
  bank.add(
    'asphalt',
    new THREE.BoxGeometry(GEO.roadMaxX - GEO.blockMaxX, roadT, GEO.blockMaxZ - -B).translate(
      (GEO.blockMaxX + GEO.roadMaxX) / 2,
      -roadT / 2,
      (GEO.blockMaxZ + -B) / 2
    ),
    M.asphalt,
    { outline: false, receiveShadow: true, castShadow: false }
  );
  // 外侧人行道边条（右 / 前）
  const borderT = 0.12;
  bank.add(
    'tile',
    new THREE.BoxGeometry(B - GEO.roadMaxX, borderT, GEO.base).translate(
      (GEO.roadMaxX + B) / 2,
      borderT / 2,
      0
    ),
    M.tile,
    { outline: true, outlineWidth: 0.012 }
  );
  bank.add(
    'tile',
    new THREE.BoxGeometry(GEO.base, borderT, B - GEO.roadMaxZ).translate(
      0,
      borderT / 2,
      (GEO.roadMaxZ + B) / 2
    ),
    M.tile,
    { outline: true, outlineWidth: 0.012 }
  );

  /* --- 街区台面（抬高的铺装） --- */
  const h = GEO.walkY;
  // 后半整块
  bank.add(
    'tile',
    new THREE.BoxGeometry(GEO.blockMaxX - GEO.blockMinX, h, GEO.alleyFrontZ - GEO.blockMinZ).translate(
      (GEO.blockMinX + GEO.blockMaxX) / 2,
      h / 2,
      (GEO.blockMinZ + GEO.alleyFrontZ) / 2
    ),
    M.tile,
    { outline: true, outlineWidth: 0.014 }
  );
  // 前半左块（便利店前）
  bank.add(
    'tile',
    new THREE.BoxGeometry(S.shopMaxX - GEO.blockMinX, h, GEO.blockMaxZ - GEO.alleyFrontZ).translate(
      (GEO.blockMinX + S.shopMaxX) / 2,
      h / 2,
      (GEO.alleyFrontZ + GEO.blockMaxZ) / 2
    ),
    M.tile,
    { outline: true, outlineWidth: 0.014 }
  );
  // 前半右块（邻栋前）
  bank.add(
    'tile',
    new THREE.BoxGeometry(GEO.blockMaxX - GEO.alleyMaxX, h, GEO.blockMaxZ - GEO.alleyFrontZ).translate(
      (GEO.alleyMaxX + GEO.blockMaxX) / 2,
      h / 2,
      (GEO.alleyFrontZ + GEO.blockMaxZ) / 2
    ),
    M.tile,
    { outline: true, outlineWidth: 0.014 }
  );
  // 小巷地面（下沉到接近路面高度，形成斜坡口）
  bank.add(
    'alleyFloor',
    new THREE.BoxGeometry(GEO.alleyMaxX - S.shopMaxX, 0.03, GEO.blockMaxZ - GEO.blockMinZ).translate(
      (S.shopMaxX + GEO.alleyMaxX) / 2,
      0.015,
      (GEO.blockMinZ + GEO.blockMaxZ) / 2
    ),
    M.alleyFloor,
    { outline: false, receiveShadow: true, castShadow: false }
  );
  // 小巷两侧的挡墙（把下沉的巷子与抬高的台面接起来，形成真实的通道感）
  for (const [wx, dir] of [
    [S.shopMaxX + 0.02, 1],
    [GEO.alleyMaxX - 0.02, -1],
  ]) {
    bank.add(
      'curb',
      new THREE.BoxGeometry(0.08, h, GEO.blockMaxZ - GEO.blockMinZ).translate(
        wx,
        h / 2,
        (GEO.blockMinZ + GEO.blockMaxZ) / 2
      ),
      M.curb,
      { outline: true, outlineWidth: 0.01 }
    );
  }
  // 巷子尽头的封口墙（避免透过巷子看到底座外面）
  bank.add(
    'neighborWall2',
    new THREE.BoxGeometry(GEO.alleyMaxX - S.shopMaxX, 2.6, 0.14).translate(
      (S.shopMaxX + GEO.alleyMaxX) / 2,
      1.3,
      GEO.blockMinZ + 0.1
    ),
    M.neighborWall2,
    { outline: true, outlineWidth: 0.014 }
  );

  /* --- 路缘石（沿街区边缘） --- */
  const curbW = 0.14;
  const curbH = h + 0.03;
  const curbSpans = [
    // 前景车道一侧（避开小巷口）
    { x: (GEO.blockMinX + S.shopMaxX) / 2, z: GEO.blockMaxZ - curbW / 2, w: S.shopMaxX - GEO.blockMinX, d: curbW },
    { x: (GEO.alleyMaxX + GEO.blockMaxX) / 2, z: GEO.blockMaxZ - curbW / 2, w: GEO.blockMaxX - GEO.alleyMaxX, d: curbW },
    // 右侧车道一侧
    { x: GEO.blockMaxX - curbW / 2, z: (GEO.blockMinZ + GEO.blockMaxZ) / 2, w: curbW, d: GEO.blockMaxZ - GEO.blockMinZ },
  ];
  for (const c of curbSpans) {
    bank.add(
      'curb',
      new THREE.BoxGeometry(c.w, curbH, c.d).translate(c.x, curbH / 2, c.z),
      M.curb,
      { outline: true, outlineWidth: 0.012 }
    );
  }
  // 小巷口两侧的斜坡缘石
  for (const [x0, x1] of [
    [S.shopMaxX - 0.02, S.shopMaxX + curbW],
    [GEO.alleyMaxX - curbW, GEO.alleyMaxX + 0.02],
  ]) {
    bank.add(
      'curb',
      new THREE.BoxGeometry(x1 - x0, 0.06, 0.36).translate((x0 + x1) / 2, 0.03, GEO.blockMaxZ - 0.1),
      M.curbTop,
      { outline: true, outlineWidth: 0.01 }
    );
  }

  /* --- 排水沟（沿路缘内侧） --- */
  const drainW = 0.24;
  bank.add(
    'drain',
    new THREE.BoxGeometry(S.shopMaxX - GEO.blockMinX - 0.2, 0.03, drainW).rotateX(-Math.PI / 2).translate(
      (GEO.blockMinX + S.shopMaxX) / 2,
      0.006,
      GEO.blockMaxZ + drainW / 2 + 0.02
    ),
    M.drain,
    { outline: false, receiveShadow: false, castShadow: false }
  );
  bank.add(
    'drain',
    new THREE.BoxGeometry(drainW, 0.03, GEO.blockMaxZ - GEO.blockMinZ - 0.3).rotateX(-Math.PI / 2).translate(
      GEO.blockMaxX + drainW / 2 + 0.02,
      0.006,
      (GEO.blockMinZ + GEO.blockMaxZ) / 2
    ),
    M.drain,
    { outline: false, receiveShadow: false, castShadow: false }
  );

  /* --- 路缘上的黄色盲道 / 黄线 --- */
  bank.add(
    'yellow',
    new THREE.BoxGeometry(S.shopMaxX - GEO.blockMinX - 0.4, 0.012, 0.1).translate(
      (GEO.blockMinX + S.shopMaxX) / 2,
      h + 0.006,
      GEO.blockMaxZ - 0.42
    ),
    M.yellow,
    { outline: false, receiveShadow: false, castShadow: false }
  );

  /* --- 斑马线（横越前景车道） --- */
  for (let i = 0; i < 7; i++) {
    bank.add(
      'paint',
      new THREE.BoxGeometry(0.32, 0.012, 1.9).translate(-1.1 + i * 0.58, 0.008, 2.5),
      M.paint,
      { outline: false, receiveShadow: false, castShadow: false }
    );
  }

  /* --- 停止线与车道分隔虚线 --- */
  bank.add(
    'paint',
    new THREE.BoxGeometry(0.24, 0.012, 2.0).translate(2.55, 0.008, 2.5),
    M.paint,
    { outline: false, receiveShadow: false, castShadow: false }
  );
  for (let i = 0; i < 6; i++) {
    bank.add(
      'paintDim',
      new THREE.BoxGeometry(0.12, 0.011, 0.7).translate(-3.4 + i * 1.1, 0.007, 1.62),
      M.paintDim,
      { outline: false, receiveShadow: false, castShadow: false }
    );
  }

  /* --- 停车位（右侧车道内） --- */
  const pX = GEO.blockMaxX + 0.05;
  for (const pz of [-2.4, -1.35]) {
    bank.add(
      'paint',
      new THREE.BoxGeometry(0.06, 0.012, 0.95).translate(pX, 0.008, pz),
      M.paint,
      { outline: false, receiveShadow: false, castShadow: false }
    );
    bank.add(
      'paint',
      new THREE.BoxGeometry(0.68, 0.012, 0.06).translate(pX + 0.32, 0.008, pz - 0.48),
      M.paint,
      { outline: false, receiveShadow: false, castShadow: false }
    );
    bank.add(
      'paint',
      new THREE.BoxGeometry(0.68, 0.012, 0.06).translate(pX + 0.32, 0.008, pz + 0.48),
      M.paint,
      { outline: false, receiveShadow: false, castShadow: false }
    );
  }

  /* --- 井盖 --- */
  bank.add(
    'metalDark',
    new THREE.CylinderGeometry(0.34, 0.34, 0.02, 14).translate(-2.2, 0.012, 2.9),
    M.metalDark,
    { outline: true, outlineWidth: 0.012, receiveShadow: false }
  );
  bank.add(
    'metalDark',
    new THREE.CylinderGeometry(0.26, 0.26, 0.02, 12).translate(1.9, GEO.walkY + 0.008, 0.7),
    M.metalDark,
    { outline: true, outlineWidth: 0.012, receiveShadow: false }
  );
}

/* ------------------------------------------------------------------ */
/* 邻栋建筑（小巷右侧）                                                 */
/* ------------------------------------------------------------------ */

function buildNeighbor(bank, env) {
  const x0 = GEO.neighborMinX;
  const x1 = GEO.neighborMaxX;
  const z0 = GEO.neighborMinZ;
  const z1 = GEO.neighborMaxZ;
  const h = GEO.neighborH;
  const y0 = GEO.walkY;

  // 主体
  bank.add(
    'neighborWall',
    new THREE.BoxGeometry(x1 - x0, h, z1 - z0).translate((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2),
    M.neighborWall,
    { outline: true, outlineWidth: 0.018 }
  );
  // 屋顶压顶
  bank.add(
    'neighborWall2',
    new THREE.BoxGeometry(x1 - x0 + 0.12, 0.18, z1 - z0 + 0.12).translate(
      (x0 + x1) / 2,
      y0 + h + 0.09,
      (z0 + z1) / 2
    ),
    M.neighborWall2,
    { outline: true, outlineWidth: 0.014 }
  );

  /* --- 面向街道的立面（z = z1） --- */
  const fz = z1 + 0.005;
  // 一层贴砖
  bank.add(
    'neighborTile',
    new THREE.BoxGeometry(x1 - x0 - 0.02, 1.5, 0.04).translate((x0 + x1) / 2, y0 + 0.75, fz),
    M.neighborTile,
    { outline: true, outlineWidth: 0.012 }
  );
  // 卷帘门（关闭的店铺）
  bank.add(
    'metal',
    new THREE.BoxGeometry(0.92, 1.6, 0.06).translate(x0 + 0.58, y0 + 0.8, fz + 0.03),
    M.metal,
    { outline: true, outlineWidth: 0.012 }
  );
  for (let i = 0; i < 9; i++) {
    bank.add(
      'metalDarkFlat',
      new THREE.BoxGeometry(0.88, 0.03, 0.02).translate(x0 + 0.58, y0 + 0.14 + i * 0.17, fz + 0.065),
      M.metalDark,
      { outline: false, castShadow: false }
    );
  }
  // 楼上窗户（两扇）
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const wx = x0 + 0.3 + c * 0.52;
      const wy = y0 + 2.0 + r * 0.85;
      bank.add(
        'metalDark',
        new THREE.BoxGeometry(0.4, 0.52, 0.06).translate(wx, wy, fz + 0.02),
        M.metalDark,
        { outline: true, outlineWidth: 0.012 }
      );
      bank.add(
        'windowGlow',
        new THREE.PlaneGeometry(0.32, 0.44).translate(wx, wy, fz + 0.055),
        glowMat(0x3d4a63, { transparent: true, opacity: 0.9 }),
        { outline: false, castShadow: false }
      );
    }
  }
  // 招牌（竖排小灯箱）—— 放在二层，避开下方的公告栏
  bank.add(
    'blue',
    new THREE.BoxGeometry(0.24, 0.86, 0.14).translate(x0 + 0.18, y0 + 2.72, fz + 0.09),
    M.blue,
    { outline: true, outlineWidth: 0.012 }
  );
  const nb = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.8), M.poster);
  nb.position.set(x0 + 0.18, y0 + 2.72, fz + 0.165);
  env.glows.push(nb);

  // 遮阳篷
  bank.add(
    'plastic',
    new THREE.BoxGeometry(1.0, 0.06, 0.5).rotateX(-0.22).translate(x0 + 0.6, y0 + 1.78, fz + 0.26),
    M.plastic,
    { outline: true, outlineWidth: 0.012 }
  );

  /* --- 小巷侧（x = x0）的杂乱细节 --- */
  const ax = x0 - 0.005;
  // 空调外机（两层，贴在邻栋靠巷一侧的墙上，不阻挡巷子通道）
  for (let i = 0; i < 2; i++) {
    const ay = y0 + 0.7 + i * 0.95;
    bank.add(
      'white',
      new THREE.BoxGeometry(0.3, 0.44, 0.6).translate(ax - 0.15, ay, -0.9),
      M.white,
      { outline: true, outlineWidth: 0.012 }
    );
    bank.add(
      'metalDarkFlat',
      new THREE.CircleGeometry(0.16, 12).rotateY(-Math.PI / 2).translate(ax - 0.305, ay, -0.9),
      M.metalDark,
      { outline: false, castShadow: false }
    );
  }
  // 落水管
  bank.add(
    'metal',
    new THREE.CylinderGeometry(0.055, 0.055, h - 0.3, 8).translate(ax - 0.07, y0 + (h - 0.3) / 2, 0.25),
    M.metal,
    { outline: true, outlineWidth: 0.01 }
  );
  // 后门 + 台阶
  bank.add(
    'metalDark',
    new THREE.BoxGeometry(0.06, 1.9, 0.8).translate(ax - 0.03, y0 + 0.95, -3.1),
    M.metalDark,
    { outline: true, outlineWidth: 0.012 }
  );
  bank.add(
    'curb',
    new THREE.BoxGeometry(0.4, 0.12, 0.9).translate(ax - 0.2, y0 + 0.06, -3.1),
    M.curbTop,
    { outline: true, outlineWidth: 0.01 }
  );
  // 巷子里的杂物：塑料筐（贴邻栋墙）
  for (let i = 0; i < 3; i++) {
    bank.add(
      'plastic',
      new THREE.BoxGeometry(0.22, 0.2, 0.3).translate(ax - 0.13, y0 + 0.1 + i * 0.21, -2.3),
      M.plastic,
      { outline: true, outlineWidth: 0.01 }
    );
  }
  bank.add(
    'blue',
    new THREE.CylinderGeometry(0.13, 0.1, 0.4, 10).translate(ax - 0.15, y0 + 0.2, -1.75),
    M.blue,
    { outline: true, outlineWidth: 0.01 }
  );
}

/* ------------------------------------------------------------------ */
/* 街角道具                                                             */
/* ------------------------------------------------------------------ */

/** 路灯（灯杆 + 悬臂 + 灯罩，带冷白光晕） */
function buildStreetLamp(x, z, ry) {
  const geoms = [];
  const y0 = GEO.walkY;
  const h = 3.7;
  geoms.push(new THREE.CylinderGeometry(0.09, 0.13, 0.3, 10).translate(x, y0 + 0.15, z));
  geoms.push(new THREE.CylinderGeometry(0.055, 0.075, h, 10).translate(x, y0 + h / 2, z));
  // 悬臂（弯向 -X 方向，用倾斜的圆柱近似）
  const armLen = 0.95;
  geoms.push(
    new THREE.CylinderGeometry(0.045, 0.045, armLen, 8)
      .rotateZ(Math.PI / 2 - 0.34)
      .translate(x - armLen / 2 * Math.cos(0.34), y0 + h + armLen / 2 * Math.sin(0.34) * 0.4, z)
  );
  const lampX = x - armLen * Math.cos(0.34);
  const lampY = y0 + h + 0.3;
  geoms.push(new THREE.BoxGeometry(0.42, 0.1, 0.26).translate(lampX, lampY, z));
  geoms.push(new THREE.BoxGeometry(0.34, 0.06, 0.2).translate(lampX, lampY - 0.05, z));
  // 灯头装饰环
  geoms.push(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10).translate(x, y0 + h - 0.05, z));
  return { geoms, lampX, lampY };
}

/** 电线杆 + 电线 */
function buildUtilityPole(bank, env, x, z) {
  const y0 = GEO.walkY;
  const h = 5.4;
  const geoms = [];
  geoms.push(new THREE.CylinderGeometry(0.1, 0.16, h, 10).translate(x, y0 + h / 2, z));
  // 横担（两层）
  const crossY = [y0 + h - 0.4, y0 + h - 1.0];
  for (const cy of crossY) {
    geoms.push(new THREE.BoxGeometry(1.5, 0.08, 0.09).translate(x, cy, z));
    for (let i = -1; i <= 1; i += 2) {
      for (const dx of [-0.55, 0.55]) {
        geoms.push(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8).translate(x + dx + i * 0.18, cy + 0.12, z));
      }
    }
  }
  // 变压器
  geoms.push(new THREE.CylinderGeometry(0.19, 0.19, 0.5, 10).translate(x + 0.32, y0 + h - 1.65, z + 0.06));
  // 爬梯与绝缘子箱
  geoms.push(new THREE.BoxGeometry(0.12, 1.1, 0.12).translate(x - 0.16, y0 + 2.6, z + 0.08));

  bank.add('metal', geoms, M.metal, { outline: true, outlineWidth: 0.014 });

  // 电线（悬链线）
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x1b1e26, toneMapped: false });
  const attach = [
    // 电线杆 → 邻栋屋顶
    { from: [x + 0.55, y0 + h - 0.28, z], to: [GEO.neighborMaxX - 0.35, y0 + GEO.neighborH + 0.2, GEO.neighborMaxZ - 0.3], sag: 0.55, r: 0.014 },
    { from: [x + 0.55, y0 + h - 0.88, z], to: [GEO.neighborMaxX - 0.35, y0 + GEO.neighborH + 0.05, GEO.neighborMaxZ - 0.3], sag: 0.75, r: 0.013 },
    // 电线杆 → 便利店屋顶
    { from: [x - 0.55, y0 + h - 0.28, z], to: [S.shopMinX + 0.6, GEO.walkY + S.shopHeight + 0.26, S.shopMaxZ - 1.4], sag: 0.6, r: 0.014 },
    { from: [x - 0.55, y0 + h - 0.88, z], to: [S.shopMinX + 0.6, GEO.walkY + S.shopHeight + 0.12, S.shopMaxZ - 1.4], sag: 0.8, r: 0.013 },
    // 越过前景车道的引线（暗示街区继续延伸）
    { from: [x - 0.1, y0 + h - 0.62, z], to: [GEO.blockMinX - 0.5, y0 + h - 0.35, GEO.roadMaxZ + 1.4], sag: 0.9, r: 0.012 },
    { from: [x + 0.3, y0 + h - 0.62, z], to: [GEO.blockMinX - 0.5, y0 + h - 0.9, GEO.roadMaxZ + 1.4], sag: 1.05, r: 0.012 },
  ];
  for (const a of attach) {
    const p0 = new THREE.Vector3(...a.from);
    const p1 = new THREE.Vector3(...a.to);
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const p = p0.clone().lerp(p1, t);
      p.y -= Math.sin(t * Math.PI) * a.sag;
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    env.wires.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, a.r, 5, false), wireMat));
  }
}

/** 交通信号灯（立在街角最右后方，悬臂伸向车道上空，不遮挡店面） */
function buildTrafficSignal(bank, env) {
  const y0 = 0.14;
  const px = 3.6;
  const pz = -1.35;
  const h = 3.5;

  bank.add(
    'metal',
    new THREE.CylinderGeometry(0.08, 0.12, h, 10).translate(px, y0 + h / 2, pz),
    M.metal,
    { outline: true, outlineWidth: 0.012 }
  );

  // 悬臂：沿 -X 伸向车道上空
  const armLen = 1.35;
  bank.add(
    'metal',
    new THREE.CylinderGeometry(0.055, 0.055, armLen, 8)
      .rotateZ(Math.PI / 2)
      .translate(px - armLen / 2, y0 + h - 0.12, pz),
    M.metal,
    { outline: true, outlineWidth: 0.01 }
  );
  // 斜撑
  bank.add(
    'metal',
    new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6)
      .rotateZ(-Math.PI / 4)
      .translate(px - 0.32, y0 + h - 0.44, pz),
    M.metal,
    { outline: true, outlineWidth: 0.008 }
  );

  // 灯箱（横向三灯，面向 +Z 车流方向）
  const headX = px - 1.05;
  const headY = y0 + h - 0.36;
  bank.add(
    'metalDark',
    new THREE.BoxGeometry(1.05, 0.3, 0.18).translate(headX, headY, pz),
    M.metalDark,
    { outline: true, outlineWidth: 0.012 }
  );
  // 遮光罩
  for (let i = 0; i < 3; i++) {
    const lx = headX - 0.34 + i * 0.34;
    bank.add(
      'metalDarkFlat',
      new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10).rotateX(Math.PI / 2).translate(lx, headY, pz + 0.13),
      M.metalDark,
      { outline: false, castShadow: false }
    );
  }
  // 三颗灯珠（可动效）
  for (let i = 0; i < 3; i++) {
    const lx = headX - 0.34 + i * 0.34;
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.075, 12), glowMat(0x2a3038));
    m.position.set(lx, headY, pz + 0.098);
    env.signals.push(m);
  }

  // 行人信号灯（挂在灯杆上，面向 +Z）
  bank.add(
    'metalDark',
    new THREE.BoxGeometry(0.26, 0.5, 0.14).translate(px, y0 + 2.05, pz + 0.06),
    M.metalDark,
    { outline: true, outlineWidth: 0.012 }
  );
  const pedTop = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), glowMat(0x2a3038));
  pedTop.position.set(px, y0 + 2.19, pz + 0.135);
  const pedBot = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), glowMat(0x2a3038));
  pedBot.position.set(px, y0 + 1.92, pz + 0.135);
  env.pedSignals.push(pedTop, pedBot);

  // 灯杆上的路牌（朝街道方向，位于画面右侧边缘）
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.23), M.sign);
  signMesh.rotation.y = -0.35;
  signMesh.position.set(px - 0.02, y0 + 2.85, pz + 0.2);
  env.glows.push(signMesh);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.16, 12), M.curbTop);
  base.position.set(px, 0.08, pz);
  env.smallProps.add(base);

  return { px, pz, headX, headY, y0, h };
}

/** 街角护栏（白色护栏 + 蓝色反光条） */
function buildGuardrail(bank, x0, z0, x1, z1, count) {
  const y0 = 0.14;
  const geoms = [];
  const posts = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    posts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
  }
  for (const [px, pz] of posts) {
    geoms.push(new THREE.CylinderGeometry(0.035, 0.035, 0.82, 8).translate(px, y0 + 0.41, pz));
    geoms.push(new THREE.SphereGeometry(0.05, 8, 6).translate(px, y0 + 0.84, pz));
  }
  // 横杆
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(z1 - z0, x1 - x0);
  for (const ry of [0.34, 0.68]) {
    geoms.push(
      new THREE.CylinderGeometry(0.028, 0.028, len, 6)
        .rotateZ(Math.PI / 2)
        .rotateY(-ang)
        .translate((x0 + x1) / 2, y0 + ry, (z0 + z1) / 2)
    );
  }
  bank.add('white', geoms, M.white, { outline: true, outlineWidth: 0.012 });

  // 蓝色反光片
  const refl = [];
  for (const [px, pz] of posts) {
    refl.push(new THREE.BoxGeometry(0.07, 0.16, 0.02).rotateY(-ang).translate(px, y0 + 0.5, pz + 0.04));
  }
  bank.add('blue', refl, M.blue, { outline: false, castShadow: false });
}

/** 自行车 */
function buildBicycle(bank, x, z, ry) {
  const g = [];
  const r = 0.33;
  const wheel = (wx) => {
    const parts = [];
    parts.push(
      new THREE.TorusGeometry(r, 0.026, 6, 18).rotateY(Math.PI / 2).translate(wx, r, 0)
    );
    // 辐条
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(
        new THREE.CylinderGeometry(0.006, 0.006, r * 1.9, 4)
          .rotateX(a)
          .translate(wx, r, 0)
      );
    }
    parts.push(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8).rotateZ(Math.PI / 2).translate(wx, r, 0));
    return parts;
  };
  g.push(...wheel(-0.52));
  g.push(...wheel(0.52));
  // 车架
  const tube = (x1, y1, x2, y2, rad = 0.022) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    return new THREE.CylinderGeometry(rad, rad, len, 6)
      .rotateZ(ang - Math.PI / 2)
      .translate((x1 + x2) / 2, (y1 + y2) / 2, 0);
  };
  g.push(tube(-0.52, r, 0.06, r + 0.62)); // 后下叉→座管
  g.push(tube(0.06, r + 0.62, 0.52, r)); // 上管→前叉
  g.push(tube(-0.52, r, 0.06, r + 0.1)); // 下叉
  g.push(tube(0.06, r + 0.1, 0.52, r)); // 下管
  g.push(tube(0.06, r + 0.1, 0.06, r + 0.66)); // 座管
  g.push(tube(0.52, r, 0.46, r + 0.72)); // 前叉
  // 车把
  g.push(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 6).rotateX(Math.PI / 2).translate(0.44, r + 0.76, 0));
  // 车座
  g.push(new THREE.BoxGeometry(0.26, 0.05, 0.13).translate(-0.03, r + 0.72, 0));
  // 前车筐
  g.push(new THREE.BoxGeometry(0.3, 0.22, 0.26).translate(0.56, r + 0.52, 0));
  for (let i = 0; i < 4; i++) {
    g.push(new THREE.BoxGeometry(0.3, 0.02, 0.02).translate(0.56, r + 0.44 + i * 0.06, 0.13));
  }
  // 挡泥板
  g.push(new THREE.TorusGeometry(r + 0.05, 0.03, 5, 10, Math.PI * 0.8).rotateY(Math.PI / 2).translate(-0.52, r, 0));
  g.push(new THREE.TorusGeometry(r + 0.05, 0.03, 5, 10, Math.PI * 0.8).rotateY(Math.PI / 2).translate(0.52, r, 0));
  // 脚撑
  g.push(tube(-0.42, r - 0.1, -0.5, 0.02, 0.015));
  // 车锁
  g.push(new THREE.TorusGeometry(0.07, 0.014, 5, 10).rotateY(Math.PI / 2).translate(-0.1, r + 0.2, 0.04));

  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, GEO.walkY, z);
  for (const gg of g) gg.applyMatrix4(m);
  bank.add('bikeMetal', g, M.metalDark, { outline: true, outlineWidth: 0.01 });
}

/** 自动贩卖机 */
function buildVendingMachine(bank, env, x, z, ry) {
  const y0 = GEO.walkY;
  const w = 1.0;
  const h = 1.86;
  const d = 0.72;
  const g = [];
  g.push(new THREE.BoxGeometry(w, h, d));
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y0 + h / 2, z);
  for (const gg of g) gg.applyMatrix4(m);
  bank.add('vendingBody', g, M.white, { outline: true, outlineWidth: 0.014 });

  // 发光面板
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.08), M.vending);
  panel.rotation.y = ry;
  panel.position.set(x, y0 + h / 2, z);
  const off = new THREE.Vector3(0, 0, d / 2 + 0.006).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
  panel.position.add(off);
  env.glows.push(panel);

  // 顶部灯箱光晕
  const gl = makeGlow(0xffe0b0, 1.6, 0.4);
  gl.position.set(x, y0 + h - 0.2, z);
  gl.position.add(off.clone().multiplyScalar(0.6));
  env.glowSprites.add(gl);

  // 侧面与顶部
  bank.add(
    'vendingBody',
    [new THREE.BoxGeometry(w + 0.05, 0.1, d + 0.05).applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y0 + h + 0.05, z))],
    M.metalDark,
    { outline: true, outlineWidth: 0.012 }
  );

  // 底部的饮料回收箱（放在机身旁）
  bank.add(
    'plastic',
    [
      new THREE.BoxGeometry(0.5, 0.5, 0.4).applyMatrix4(
        new THREE.Matrix4().makeRotationY(ry).setPosition(x - 0.82, y0 + 0.25, z + 0.1)
      ),
    ],
    M.plastic,
    { outline: true, outlineWidth: 0.012 }
  );
}

/** 雨伞架（店门口） */
function buildUmbrellaStand(bank, x, z) {
  const y0 = GEO.walkY;
  const g = [];
  g.push(new THREE.CylinderGeometry(0.16, 0.14, 0.5, 12).translate(x, y0 + 0.25, z));
  g.push(new THREE.TorusGeometry(0.16, 0.02, 5, 12).rotateX(Math.PI / 2).translate(x, y0 + 0.5, z));
  bank.add('steel', g, M.steel, { outline: true, outlineWidth: 0.01 });

  // 插着的雨伞
  const colors = [0x2b3a55, 0x5a3a3a, 0x2f4a3a, 0x3a3a4a];
  const rng = makeRng(4711);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng() * 0.6;
    const ux = x + Math.cos(a) * 0.07;
    const uz = z + Math.sin(a) * 0.07;
    const tilt = randRange(rng, 0.05, 0.16);
    const gg = [];
    gg.push(
      new THREE.CylinderGeometry(0.022, 0.022, 0.95, 6)
        .rotateZ(tilt)
        .rotateY(a)
        .translate(ux, y0 + 0.78, uz)
    );
    gg.push(
      new THREE.ConeGeometry(0.16, 0.5, 8)
        .rotateZ(tilt)
        .rotateY(a)
        .translate(ux + Math.sin(tilt) * -0.1, y0 + 0.95, uz)
    );
    bank.add(`umbrella${i}`, gg, toonMat({ color: colors[i % colors.length] }), {
      outline: true,
      outlineWidth: 0.01,
    });
  }
}

/** 垃圾桶 */
function buildTrashBin(bank, x, z, color) {
  const y0 = GEO.walkY;
  const g = [];
  g.push(new THREE.CylinderGeometry(0.19, 0.16, 0.72, 12).translate(x, y0 + 0.36, z));
  g.push(new THREE.CylinderGeometry(0.2, 0.19, 0.06, 12).translate(x, y0 + 0.75, z));
  g.push(new THREE.BoxGeometry(0.3, 0.06, 0.06).translate(x, y0 + 0.86, z));
  bank.add('binBody', g, toonMat({ color }), { outline: true, outlineWidth: 0.012 });
  // 开口
  bank.add(
    'metalDarkFlat',
    new THREE.BoxGeometry(0.22, 0.05, 0.02).translate(x, y0 + 0.7, z + 0.18),
    M.metalDark,
    { outline: false, castShadow: false }
  );
}

/** 空调外机（地面安装，面板上的风扇作为独立部件返回） */
function buildGroundAC(bank, x, z, ry) {
  const y0 = GEO.walkY;
  bank.add(
    'acBody',
    new THREE.BoxGeometry(0.5, 0.62, 0.34).translate(x, y0 + 0.34, z),
    M.white,
    { outline: true, outlineWidth: 0.012 }
  );
  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), M.metalDark);
  fan.rotation.y = ry;
  fan.position.set(x, y0 + 0.36, z);
  fan.position.add(new THREE.Vector3(0, 0, 0.18).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry));
  const grp = new THREE.Group();
  grp.add(fan);
  return grp;
}

/** 小巷：便利店右墙的杂项 + 一盏壁灯，让巷子不是一条死黑的缝 */
function buildAlley(bank, env) {
  // 便利店右墙外表面：侧墙中心在 x1+0.06、厚 0.12，所以外表面在 x1+0.12
  const wallX = S.shopMaxX + 0.12;
  const y0 = GEO.walkY;

  // 壁灯（伞形灯罩 + 发光面），挂在巷口靠外处，把光洒在巷子里
  bank.add(
    'metalDark',
    new THREE.BoxGeometry(0.14, 0.06, 0.14).translate(wallX + 0.07, y0 + 2.6, 0.66),
    M.metalDark,
    { outline: true, outlineWidth: 0.01 }
  );
  bank.add(
    'metalDark',
    new THREE.ConeGeometry(0.18, 0.16, 10).translate(wallX + 0.2, y0 + 2.48, 0.66),
    M.metalDark,
    { outline: true, outlineWidth: 0.01 }
  );
  const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), M.lampGlass);
  bulb.rotation.x = Math.PI / 2;
  bulb.position.set(wallX + 0.2, y0 + 2.4, 0.66);
  env.glows.push(bulb);
  const alleyGlow = makeGlow(0xffd9a0, 2.0, 0.42);
  alleyGlow.position.set(wallX + 0.24, y0 + 2.34, 0.66);
  env.glowSprites.add(alleyGlow);

  // 配电箱（贴墙）
  bank.add(
    'metal',
    new THREE.BoxGeometry(0.1, 0.46, 0.3).translate(wallX + 0.05, y0 + 1.42, 0.12),
    M.metal,
    { outline: true, outlineWidth: 0.01 }
  );

  // 沿墙的管线
  for (let i = 0; i < 3; i++) {
    bank.add(
      'metal',
      new THREE.CylinderGeometry(0.022, 0.022, 2.6, 6).translate(wallX + 0.035, y0 + 1.35, -0.9 - i * 0.07),
      M.metal,
      { outline: true, outlineWidth: 0.008 }
    );
  }

  // 后场门
  bank.add(
    'metal',
    new THREE.BoxGeometry(0.06, 1.92, 0.78).translate(wallX + 0.03, y0 + 0.96, -0.28),
    M.metal,
    { outline: true, outlineWidth: 0.012 }
  );
  bank.add(
    'metalDarkFlat',
    new THREE.PlaneGeometry(0.66, 1.78)
      .rotateY(-Math.PI / 2)
      .translate(wallX + 0.065, y0 + 0.94, -0.28),
    M.metalDark,
    { outline: false, castShadow: false }
  );

  // 叠放的塑料筐（贴便利店墙，留出通道）
  for (let i = 0; i < 3; i++) {
    bank.add(
      'blue',
      new THREE.BoxGeometry(0.24, 0.2, 0.3).translate(wallX + 0.14, y0 + 0.1 + i * 0.21, -1.35),
      M.blue,
      { outline: true, outlineWidth: 0.01 }
    );
  }
  // 拖把桶
  bank.add(
    'green',
    new THREE.CylinderGeometry(0.12, 0.09, 0.36, 10).translate(wallX + 0.13, y0 + 0.18, -1.95),
    M.green,
    { outline: true, outlineWidth: 0.01 }
  );
}

/* ------------------------------------------------------------------ */
/* 主入口                                                               */
/* ------------------------------------------------------------------ */

export function createStreet() {
  buildMaterials();

  const bank = makeBank();
  const env = {
    glows: [],
    glowSprites: new THREE.Group(),
    wires: new THREE.Group(),
    signals: [],
    pedSignals: [],
    smallProps: new THREE.Group(),
  };

  buildGround(bank);
  buildNeighbor(bank, env);
  buildAlley(bank, env);

  /* --- 路灯（街角右侧，照亮街角） --- */
  const lamp = buildStreetLamp(2.55, 1.12, 0);
  bank.add('metal', lamp.geoms, M.metal, { outline: true, outlineWidth: 0.014 });
  const lampGlow = makeGlow(0xcfe4ff, 3.4, 0.5);
  lampGlow.position.set(lamp.lampX, lamp.lampY - 0.12, 1.12);
  env.glowSprites.add(lampGlow);
  const lampHot = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.22), M.lampGlass);
  lampHot.rotation.x = Math.PI / 2;
  lampHot.position.set(lamp.lampX, lamp.lampY - 0.09, 1.12);
  env.glows.push(lampHot);

  /* --- 电线杆（街区左后角，避开店面中轴） --- */
  buildUtilityPole(bank, env, -3.3, -2.3);

  /* --- 交通信号灯 --- */
  buildTrafficSignal(bank, env);

  /* --- 护栏 --- */
  // 只放在右侧车道一侧和前景车道对面（不挡店面）
  buildGuardrail(bank, GEO.blockMaxX + 0.34, GEO.blockMinZ + 0.6, GEO.blockMaxX + 0.34, GEO.blockMaxZ - 0.5, 5);
  buildGuardrail(bank, GEO.blockMinX + 0.5, GEO.roadMaxZ + 0.24, -1.2, GEO.roadMaxZ + 0.24, 5);

  /* --- 自行车（停在店门左侧，面向街道） --- */
  buildBicycle(bank, -3.25, 0.72, 0.04);
  buildBicycle(bank, -2.6, 0.76, -0.06);

  /* --- 自动贩卖机（邻栋临街立面前；邻栋只有 1.1m 宽，放一台即可） --- */
  buildVendingMachine(bank, env, 2.75, 0.74, 0);

  /* --- 雨伞架、门口地垫、垃圾桶、空调外机 --- */
  buildUmbrellaStand(bank, -0.6, 0.1);

  // 便利店门口的地垫（深色橡胶垫 + 防滑条纹）
  const matCx = S.doorCenterX;
  const matZ = S.shopMaxZ + 0.62;
  bank.add(
    'matRubber',
    new THREE.BoxGeometry(1.5, 0.045, 0.9).translate(matCx, GEO.walkY + 0.022, matZ),
    M.plastic,
    { outline: true, outlineWidth: 0.012, receiveShadow: true }
  );
  for (let i = 0; i < 5; i++) {
    bank.add(
      'matStripe',
      new THREE.BoxGeometry(1.36, 0.012, 0.055).translate(
        matCx,
        GEO.walkY + 0.05,
        matZ - 0.34 + i * 0.17
      ),
      M.metalDark,
      { outline: false, castShadow: false, receiveShadow: false }
    );
  }

  buildTrashBin(bank, 0.6, 0.3, 0x3f6d55);
  buildTrashBin(bank, -3.55, 0.35, 0x8a8f96);
  env.smallProps.add(buildGroundAC(bank, 0.05, 0.35, Math.PI / 2));

  // 店门口的空调外机（挂在便利店右墙上）
  bank.add(
    'acBody',
    new THREE.BoxGeometry(0.34, 0.62, 0.72).translate(S.shopMaxX + 0.17, GEO.walkY + 0.5, -1.6),
    M.white,
    { outline: true, outlineWidth: 0.012 }
  );

  /* --- 公告栏 / 海报栏（贴在邻栋临街立面左侧，不挡小巷口） --- */
  bank.add(
    'noticeFrame',
    new THREE.BoxGeometry(0.72, 0.86, 0.07).translate(2.62, GEO.walkY + 1.9, GEO.neighborMaxZ + 0.04),
    M.metalDark,
    { outline: true, outlineWidth: 0.012 }
  );
  const notice = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.78), M.notice);
  notice.position.set(2.62, GEO.walkY + 1.9, GEO.neighborMaxZ + 0.085);
  env.glows.push(notice);

  /* --- 盆栽（店门口） --- */
  const potXZ = [
    [-3.62, 0.5],
    [-3.62, -0.1],
    [1.3, 0.55],
  ];
  for (const [px, pz] of potXZ) {
    bank.add(
      'pot',
      new THREE.CylinderGeometry(0.15, 0.11, 0.26, 10).translate(px, GEO.walkY + 0.13, pz),
      M.wood,
      { outline: true, outlineWidth: 0.01 }
    );
    const rng = makeRng(Math.round(px * 100 + pz * 37));
    for (let i = 0; i < 5; i++) {
      bank.add(
        'leaf',
        new THREE.SphereGeometry(randRange(rng, 0.09, 0.15), 7, 6).translate(
          px + randRange(rng, -0.1, 0.1),
          GEO.walkY + 0.3 + randRange(rng, 0, 0.22),
          pz + randRange(rng, -0.1, 0.1)
        ),
        M.green,
        { outline: true, outlineWidth: 0.008 }
      );
    }
  }

  /* --- 路牌（立在街角右前，位于画面边缘） --- */
  bank.add(
    'metal',
    new THREE.CylinderGeometry(0.045, 0.045, 2.4, 8).translate(3.0, GEO.walkY + 1.2, 1.05),
    M.metal,
    { outline: true, outlineWidth: 0.012 }
  );
  const roadSign = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.24), M.sign);
  roadSign.rotation.y = -Math.PI / 2 + 0.16;
  roadSign.position.set(2.98, GEO.walkY + 2.15, 1.05);
  env.glows.push(roadSign);

  /* --- 组装 --- */
  const root = new THREE.Group();
  root.add(bank.build());
  for (const g of env.glows) root.add(g);
  root.add(env.glowSprites);
  root.add(env.wires);
  root.add(env.smallProps);
  for (const s of env.signals) root.add(s);
  for (const s of env.pedSignals) root.add(s);

  return {
    root,
    materials: M,
    signals: env.signals,
    pedSignals: env.pedSignals,
    geo: GEO,
  };
}