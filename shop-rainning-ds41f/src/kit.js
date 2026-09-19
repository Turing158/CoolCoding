/**
 * kit.js —— 三渲二（Cel-shading / 3D-to-2D）场景通用工具箱
 *
 * 提供：
 *  - 卡通材质（带多级色阶 gradientMap）
 *  - 轮廓线外壳（BackSide 描边，二次元的关键）
 *  - 画布贴图生成（招牌、海报、货架商品、排水沟、斑马线、天空……）
 *  - 几何体合并工具（大幅降低 draw call，保证帧率）
 *  - 发光精灵、文字绘制等辅助函数
 */

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ */
/* 全局尺寸常量（单位：米，相当于 1:1 的微缩模型）                       */
/* ------------------------------------------------------------------ */

export const LAYOUT = {
  baseSize: 8.0, // 正方形底座边长
  baseThickness: 0.26, // 底座厚度（顶面为 y = 0）
  walkY: 0.14, // 人行道 / 街区台面高度

  // 街区（抬高的铺装台面）
  blockMinX: -3.86,
  blockMaxX: 2.8,
  blockMinZ: -3.86,
  blockMaxZ: 1.25,

  // 小巷（穿过街区，落到路面高度）
  alleyMinX: 1.71,
  alleyMaxX: 2.35,

  // 小巷右侧的邻栋建筑
  neighborMinX: 2.35,
  neighborMaxX: 2.8,
  neighborHeight: 3.6,

  // 便利店
  shopMinX: -3.86,
  shopMaxX: 1.5,
  shopMinZ: -3.8,
  shopMaxZ: -0.7,
  shopHeight: 3.3,

  doorCenterX: -0.45,
  doorHalf: 0.62,
  glassBottom: 0.42,
  glassTop: 2.52,
};

/* ------------------------------------------------------------------ */
/* 随机数（固定种子，保证每次生成完全一致）                             */
/* ------------------------------------------------------------------ */

export function makeRng(seed = 20240912) {
  let s = seed >>> 0;
  return function rng() {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export const rand = makeRng();

export function randRange(rng, a, b) {
  return a + (b - a) * rng();
}

/* ------------------------------------------------------------------ */
/* 卡通材质                                                             */
/* ------------------------------------------------------------------ */

const gradientCache = new Map();

/** 由 0~1 的色阶数组生成 MeshToonMaterial 使用的 gradientMap */
export function makeGradientMap(ramp) {
  const key = ramp.join(',');
  if (gradientCache.has(key)) return gradientCache.get(key);
  const data = new Uint8Array(ramp.length);
  for (let i = 0; i < ramp.length; i++) {
    data[i] = Math.max(0, Math.min(255, Math.round(ramp[i] * 255)));
  }
  const tex = new THREE.DataTexture(data, ramp.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  gradientCache.set(key, tex);
  return tex;
}

/** 默认 4 级色阶：亮部饱满，暗部压得比较深，形成明显的动画分层 */
export const TOON_RAMP = [0.24, 0.5, 0.78, 1.0];
/** 更硬的 3 级色阶，用于强调轮廓分明的道具 */
export const TOON_RAMP_HARD = [0.3, 0.62, 1.0];

export const toonGradient = makeGradientMap(TOON_RAMP);
export const toonGradientHard = makeGradientMap(TOON_RAMP_HARD);

/**
 * 创建一个卡通材质
 * @param {object} opts
 * @param {number|string} opts.color 基色
 * @param {number} [opts.emissive] 自发光色
 * @param {number} [opts.emissiveIntensity]
 * @param {number} [opts.ramp] 使用硬色阶
 * @param {number} [opts.shininess] 湿润高光强度
 * @param {THREE.Texture} [opts.map]
 */
export function toonMat(opts = {}) {
  const {
    color = 0xffffff,
    emissive = 0x000000,
    emissiveIntensity = 1,
    map = null,
    hard = false,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    depthWrite = true,
    alphaTest = 0,
  } = opts;

  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: hard ? toonGradientHard : toonGradient,
    emissive,
    emissiveIntensity,
    map,
    transparent,
    opacity,
    side,
    depthWrite,
    alphaTest,
  });
  // 卡通渲染下环境光强度建议由调用方控制；这里保持默认即可
  return mat;
}

/** 纯自发光材质（灯管、灯箱、LED、灯罩内的发光面） */
export function glowMat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    toneMapped: opts.toneMapped ?? false,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true,
    map: opts.map ?? null,
    blending: opts.blending ?? THREE.NormalBlending,
  });
}

/* ------------------------------------------------------------------ */
/* 轮廓线（描边外壳）                                                   */
/* ------------------------------------------------------------------ */

const OUTLINE_MAT = new THREE.MeshBasicMaterial({
  color: 0x1b1a2b,
  side: THREE.BackSide,
  depthWrite: false, // 关闭深度写入，避免描边遮住前面的物体
  toneMapped: false,
});

export const outlineMaterial = OUTLINE_MAT;

/**
 * 为几何体生成描边外壳（inverted hull）。
 *
 * 做法：复制几何体，沿每个顶点的法线方向外扩 thickness 米，配合 BackSide +
 * depthWrite:false 的黑色材质，就能得到二次元动画里那种干净均匀的轮廓线。
 * 为了在硬边（盒子的棱角）处也得到连续的描边，先把只含 position 的副本做一次
 * 顶点焊接并重算法线，得到“棱角处的平均法线”，再用它来外扩。
 */
export function makeOutline(geometry, thickness = 0.02) {
  const g = geometry.clone();

  const posOnly = new THREE.BufferGeometry();
  posOnly.setAttribute('position', geometry.attributes.position.clone());
  if (geometry.index) posOnly.setIndex(geometry.index.clone());
  let welded = null;
  try {
    welded = mergeVertices(posOnly, 1e-4);
    welded.computeVertexNormals();
  } catch (err) {
    welded = null;
  }

  const dst = g.attributes.position;
  const src = welded && welded.attributes.normal ? welded : null;

  if (src && welded.attributes.position.count === dst.count) {
    // 焊接后顶点数不变（几何体本身就是硬边结构）时可直接使用平均法线
    for (let i = 0; i < dst.count; i++) {
      dst.setXYZ(
        i,
        dst.getX(i) + src.getX(i) * thickness,
        dst.getY(i) + src.getY(i) * thickness,
        dst.getZ(i) + src.getZ(i) * thickness
      );
    }
  } else {
    const nrm = g.attributes.normal;
    for (let i = 0; i < dst.count; i++) {
      dst.setXYZ(
        i,
        dst.getX(i) + nrm.getX(i) * thickness,
        dst.getY(i) + nrm.getY(i) * thickness,
        dst.getZ(i) + nrm.getZ(i) * thickness
      );
    }
  }

  dst.needsUpdate = true;
  if (posOnly.index) posOnly.setIndex(null);
  g.computeVertexNormals();
  posOnly.dispose();
  if (welded) welded.dispose();
  return g;
}

/**
 * 把一个网格变成带描边的组合体（返回一个 Group）。
 */
export function outlined(mesh, thickness = 0.022) {
  const group = new THREE.Group();
  group.add(mesh);
  const shell = new THREE.Mesh(makeOutline(mesh.geometry, thickness), outlineMaterial);
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.userData.isOutline = true;
  group.add(shell);
  group.userData.solid = mesh;
  group.userData.shell = shell;
  return group;
}

/* ------------------------------------------------------------------ */
/* 几何体合并 / 实例化                                                  */
/* ------------------------------------------------------------------ */

/** 合并一组几何体（全部为 position/normal/uv 的索引几何体时最安全） */
export function mergeHard(geometries) {
  const list = geometries.filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return mergeGeometries(list, false);
}

/** 便捷：生成一个已平移/旋转/缩放的 BoxGeometry */
export function boxAt(w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4();
  const e = new THREE.Euler(rx, ry, rz, 'YXZ');
  m.makeRotationFromEuler(e);
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
}

export function cylAt(rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
}

export function planeAt(w, h, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
}

/* ------------------------------------------------------------------ */
/* 几何体收集器：把成百上千个小部件按材质合并成极少数网格               */
/* ------------------------------------------------------------------ */

export function makeBank() {
  const groups = new Map();
  return {
    /**
     * @param {string} key 分组键（同键共用一个材质）
     * @param {THREE.BufferGeometry|THREE.BufferGeometry[]} geom 几何体或几何体数组
     * @param {THREE.Material} material
     * @param {object} [opts] { outline, outlineWidth, castShadow, receiveShadow, name }
     */
    add(key, geom, material, opts = {}) {
      if (!geom) return;
      let g = groups.get(key);
      if (!g) {
        g = { material, opts, geoms: [] };
        groups.set(key, g);
      }
      // 允许直接传数组（批量添加），统一展开成单个几何体
      const list = Array.isArray(geom) ? geom : [geom];
      for (const item of list) {
        if (item && item.isBufferGeometry) g.geoms.push(item);
      }
    },
    /** 生成一个 Group，内部每个分组是一个（或一对带描边的）网格 */
    build() {
      const root = new THREE.Group();
      for (const [key, g] of groups) {
        const merged = mergeHard(g.geoms);
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, g.material);
        mesh.castShadow = g.opts.castShadow ?? true;
        mesh.receiveShadow = g.opts.receiveShadow ?? true;
        mesh.name = key;
        if (g.opts.outline ?? true) {
          const wrap = outlined(mesh, g.opts.outlineWidth ?? 0.016);
          wrap.name = key;
          wrap.userData.bankKey = key;
          root.add(wrap);
        } else {
          mesh.userData.bankKey = key;
          root.add(mesh);
        }
      }
      return root;
    },
    get size() {
      return groups.size;
    },
  };
}

/* ------------------------------------------------------------------ */
/* 画布贴图工具                                                         */
/* ------------------------------------------------------------------ */

const JP_FONT = '"Yu Gothic UI","Yu Gothic","Meiryo","MS Gothic","Noto Sans JP","Hiragino Sans",sans-serif';

export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

export function canvasTexture(canvas, opts = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = opts.colorSpace ?? THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 4;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  tex.needsUpdate = true;
  return tex;
}

/** 竖向排列的日文文字（招牌常用） */
export function drawVerticalText(ctx, text, x, y, size, color, lineGap = 1.06) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px ${JP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, y + i * size * lineGap);
  }
  ctx.restore();
}

export function drawText(ctx, text, x, y, size, color, opts = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${opts.weight ?? 700} ${size}px ${JP_FONT}`;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = opts.baseline ?? 'top';
  if (opts.letterSpacing) ctx.letterSpacing = `${opts.letterSpacing}px`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 常用贴图工厂                                                         */
/* ------------------------------------------------------------------ */

let stripeTex = null;
/** 便利店雨棚 / 招牌底纹的斜条纹（日式便利店常见的绿白配色） */
export function getStripeTexture(c1 = '#1f7a4d', c2 = '#f4f2e6') {
  if (stripeTex) return stripeTex;
  const { canvas, ctx } = makeCanvas(256, 64);
  ctx.fillStyle = c2;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = c1;
  ctx.save();
  ctx.translate(0, 0);
  for (let i = -64; i < 320; i += 44) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 22, 0);
    ctx.lineTo(i + 22 - 64, 64);
    ctx.lineTo(i - 64, 64);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  stripeTex = canvasTexture(canvas, { repeat: [1, 1] });
  stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
  return stripeTex;
}

/** 生成一张“商品陈列”贴图，用于货架正面（远看像一整排商品） */
export function getShelfGoodsTexture(seed = 1) {
  const rng = makeRng(seed * 7919);
  const { canvas, ctx } = makeCanvas(512, 256);
  ctx.fillStyle = '#f2ede2';
  ctx.fillRect(0, 0, 512, 256);
  const palette = [
    '#e8695f', '#f0a13c', '#e8d45a', '#5fb26a', '#4f9bd8',
    '#8b6ad0', '#d96aa8', '#f2f0e6', '#6b4a2f', '#2f6f9e',
  ];
  const rows = 4;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = 'rgba(120,130,150,0.22)';
    ctx.fillRect(0, r * rowH + rowH - 6, 512, 6);
    let x = 4;
    while (x < 512) {
      const w = 16 + Math.floor(rng() * 22);
      const h = rowH - 16 - Math.floor(rng() * 8);
      const y = r * rowH + (rowH - 6 - h);
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + 2, y + 2, w - 4, Math.max(3, h * 0.16));
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, y + h - 4, w, 4);
      x += w + 3 + Math.floor(rng() * 5);
    }
  }
  return canvasTexture(canvas);
}

/** 自动贩卖机的正面面板 */
export function getVendingTexture() {
  const { canvas, ctx } = makeCanvas(256, 512);
  // 机身
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#d9e4ec');
  grad.addColorStop(1, '#b9c6d2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);
  // 顶部灯箱
  ctx.fillStyle = '#e64a3c';
  ctx.fillRect(6, 6, 244, 56);
  drawText(ctx, 'ドリンク', 128, 16, 34, '#ffffff', { align: 'center' });
  drawText(ctx, 'COLD / HOT', 128, 44, 14, '#ffe6c9', { align: 'center', weight: 600 });
  // 商品展示窗
  ctx.fillStyle = '#101820';
  ctx.fillRect(10, 72, 236, 268);
  const cols = 4;
  const rows = 4;
  const cellW = 236 / cols;
  const cellH = 268 / rows;
  const colors = ['#ff7a4d', '#ffd166', '#5fbf7a', '#57a8e0', '#e05a7a', '#f0f0f0', '#8f6bd6'];
  const rng = makeRng(4242);
  for (let r = 0; r < rows; r++) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(10, 72 + r * cellH + cellH - 4, 236, 4);
    for (let c = 0; c < cols; c++) {
      const x = 10 + c * cellW + cellW * 0.18;
      const y = 72 + r * cellH + cellH * 0.12;
      const w = cellW * 0.64;
      const h = cellH * 0.7;
      ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(x, y + h * 0.12, w, h * 0.16);
      ctx.fillStyle = '#c9d4dd';
      ctx.fillRect(x + w * 0.1, y + h, w * 0.8, 4);
    }
  }
  // 出货口
  ctx.fillStyle = '#8d98a3';
  ctx.fillRect(14, 348, 228, 40);
  ctx.fillStyle = '#2a323b';
  ctx.fillRect(20, 354, 216, 28);
  // 按钮区
  ctx.fillStyle = '#c8d3dc';
  ctx.fillRect(10, 396, 236, 46);
  ctx.fillStyle = '#3ba55d';
  ctx.fillRect(24, 406, 60, 26);
  ctx.fillStyle = '#2f6f9e';
  ctx.fillRect(96, 406, 60, 26);
  ctx.fillStyle = '#c94a3c';
  ctx.fillRect(168, 406, 60, 26);
  // 底部
  ctx.fillStyle = '#93a0ab';
  ctx.fillRect(10, 448, 236, 54);
  ctx.fillStyle = '#3c4650';
  ctx.fillRect(10, 490, 236, 12);
  return canvasTexture(canvas);
}

/** 排水沟铁篦子 */
export function getDrainTexture() {
  const { canvas, ctx } = makeCanvas(128, 256);
  ctx.fillStyle = '#2a2f38';
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#454c58';
  for (let y = 8; y < 256; y += 16) {
    ctx.fillRect(6, y, 116, 8);
  }
  ctx.fillStyle = '#1b1f26';
  for (let y = 16; y < 256; y += 16) {
    ctx.fillRect(6, y, 116, 4);
  }
  ctx.strokeStyle = '#565f6c';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, 122, 250);
  return canvasTexture(canvas, { repeat: [1, 4] });
}

/** 沥青路面（带湿痕） */
export function getAsphaltTexture() {
  const rng = makeRng(991);
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#33363f';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const s = rng() * 2.2 + 0.4;
    const v = rng();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.16)';
    ctx.fillRect(x, y, s, s);
  }
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(20,26,40,${0.05 + rng() * 0.12})`;
    ctx.lineWidth = 1 + rng() * 3;
    ctx.beginPath();
    const x = rng() * 256;
    const y = rng() * 256;
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 40, y + 20, x + 60, y - 20, x + 110, y + 10);
    ctx.stroke();
  }
  return canvasTexture(canvas, { repeat: [4, 4] });
}

/** 人行道地砖 */
export function getTileTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#8d8f95';
  ctx.fillRect(0, 0, 256, 256);
  const n = 8;
  const s = 256 / n;
  const rng = makeRng(77);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = 0.9 + rng() * 0.16;
      const c = Math.floor(140 * v);
      ctx.fillStyle = `rgb(${c},${c + 2},${c + 6})`;
      ctx.fillRect(x * s + 1.2, y * s + 1.2, s - 2.4, s - 2.4);
    }
  }
  ctx.strokeStyle = 'rgba(50,52,60,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s, 0);
    ctx.lineTo(i * s, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * s);
    ctx.lineTo(256, i * s);
    ctx.stroke();
  }
  return canvasTexture(canvas, { repeat: [6, 6] });
}

/** 墙面瓷砖（店内 / 店外） */
export function getWallTileTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#e6e2d8';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(160,155,145,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 16, 0);
    ctx.lineTo(i * 16, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * 16);
    ctx.lineTo(128, i * 16);
    ctx.stroke();
  }
  return canvasTexture(canvas, { repeat: [4, 4] });
}

/** 通用海报 / 宣传单 */
export function getPosterTexture(kind = 0) {
  const { canvas, ctx } = makeCanvas(256, 360);
  const themes = [
    { bg: '#ffffff', accent: '#e0453a', title: '新発売', sub: 'いちごフェア' },
    { bg: '#fff6e2', accent: '#f08a1e', title: '期間限定', sub: 'あつあつ弁当' },
    { bg: '#eaf3ff', accent: '#2f6f9e', title: 'おでん', sub: 'はじめました' },
    { bg: '#ffffff', accent: '#3ba55d', title: 'ポイント', sub: '2倍キャンペーン' },
  ];
  const t = themes[kind % themes.length];
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, 256, 360);
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, 0, 256, 74);
  drawText(ctx, t.title, 128, 12, 42, '#ffffff', { align: 'center' });
  ctx.fillStyle = t.accent;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.arc(128, 210, 96, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // 商品剪影
  ctx.fillStyle = t.accent;
  if (kind % 4 === 0) {
    ctx.beginPath();
    ctx.arc(128, 210, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(128, 210, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.accent;
    ctx.beginPath();
    ctx.arc(128, 210, 30, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(78, 150, 100, 120);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(90, 164, 76, 34);
  }
  drawText(ctx, t.sub, 128, 296, 26, '#333333', { align: 'center' });
  drawText(ctx, 'セブンデイリー ' + 'コンビニ', 128, 328, 15, '#888888', { align: 'center', weight: 500 });
  return canvasTexture(canvas);
}

/** 杂志封面拼贴（用于杂志架） */
export function getMagazineTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rng = makeRng(5150);
  const cols = 4;
  const rows = 3;
  const cw = 256 / cols;
  const ch = 256 / rows;
  const colors = ['#e8574a', '#f2b23c', '#4f9bd8', '#5fb26a', '#8b6ad0', '#e07aa8', '#ededed'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
      ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.86)';
      ctx.fillRect(c * cw + 6, r * ch + 6, cw - 12, ch * 0.26);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(c * cw + 6, r * ch + ch * 0.62, cw - 12, ch * 0.16);
    }
  }
  return canvasTexture(canvas);
}

/** 饮料柜内的饮料排（发光背板前的一排瓶罐） */
export function getDrinkRowTexture() {
  const { canvas, ctx } = makeCanvas(512, 128);
  ctx.fillStyle = '#f7f4ec';
  ctx.fillRect(0, 0, 512, 128);
  const colors = ['#e8574a', '#f2b23c', '#4f9bd8', '#5fb26a', '#8b6ad0', '#f0f0f0', '#3c3c3c', '#e07aa8'];
  const rng = makeRng(808);
  let x = 6;
  while (x < 500) {
    const w = 20 + Math.floor(rng() * 14);
    const h = 78 + Math.floor(rng() * 26);
    const y = 122 - h;
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.quadraticCurveTo(x + w / 2, y - 8, x + w, y + 8);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(x + 3, y + h * 0.42, w - 6, h * 0.2);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(x, y + h - 5, w, 5);
    x += w + 4;
  }
  ctx.fillStyle = 'rgba(120,130,150,0.25)';
  ctx.fillRect(0, 122, 512, 6);
  return canvasTexture(canvas);
}

/** 店内地板导视条纹 */
export function getFloorGuideTexture() {
  const { canvas, ctx } = makeCanvas(64, 64);
  ctx.fillStyle = '#d8dde3';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#4ba86a';
  ctx.fillRect(8, 0, 48, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let y = 0; y < 64; y += 16) ctx.fillRect(8, y, 48, 8);
  return canvasTexture(canvas, { repeat: [1, 1] });
}

/** 天空渐变（穹顶内部） */
export function getSkyTexture() {
  const { canvas, ctx } = makeCanvas(16, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#05080f');
  grad.addColorStop(0.4, '#0c1322');
  grad.addColorStop(0.65, '#1b2745');
  grad.addColorStop(0.84, '#35426a');
  grad.addColorStop(1.0, '#565a7c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  return canvasTexture(canvas);
}

/** 便利店主招牌（横向，用于正面看板） */
export function getShopSignTexture() {
  const { canvas, ctx } = makeCanvas(1024, 256);
  // 底色：深绿 + 白色斜条
  ctx.fillStyle = '#0e6b45';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, 0, 1024, 14);
  ctx.fillRect(0, 242, 1024, 14);
  // 主体文字
  drawText(ctx, 'セブン デイリー', 512, 60, 104, '#ffffff', { align: 'center' });
  drawText(ctx, 'SEVEN DAILY MART', 512, 176, 52, '#ffe9b8', { align: 'center', weight: 600, letterSpacing: 6 });
  // 两侧装饰条
  ctx.fillStyle = '#f2b23c';
  ctx.fillRect(0, 100, 22, 56);
  ctx.fillRect(1002, 100, 22, 56);
  return canvasTexture(canvas);
}

/** 招牌侧面的竖排小字 */
export function getShopSignSideTexture() {
  const { canvas, ctx } = makeCanvas(128, 512);
  ctx.fillStyle = '#0e6b45';
  ctx.fillRect(0, 0, 128, 512);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(6, 6, 116, 6);
  ctx.fillRect(6, 500, 116, 6);
  drawVerticalText(ctx, 'コンビニ', 64, 60, 78, '#ffffff', 1.12);
  return canvasTexture(canvas);
}

/** 门头灯箱 / 店内悬挂灯箱 */
export function getLightBoxTexture(kind = 0) {
  const { canvas, ctx } = makeCanvas(512, 256);
  if (kind === 0) {
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(0, 0, 512, 256);
    drawText(ctx, 'お で ん', 256, 30, 84, '#c9432f', { align: 'center' });
    drawText(ctx, 'は じ め ま し た', 256, 138, 46, '#3a3a3a', { align: 'center' });
    ctx.fillStyle = '#f2b23c';
    ctx.fillRect(40, 206, 432, 10);
  } else if (kind === 1) {
    ctx.fillStyle = '#eef6ff';
    ctx.fillRect(0, 0, 512, 256);
    drawText(ctx, 'ATM', 256, 44, 110, '#2f6f9e', { align: 'center' });
    drawText(ctx, '24 時間 利用可能', 256, 172, 40, '#4a5a6a', { align: 'center' });
  } else {
    ctx.fillStyle = '#fdf3e0';
    ctx.fillRect(0, 0, 512, 256);
    drawText(ctx, 'コーヒー', 256, 32, 88, '#6b4a2f', { align: 'center' });
    drawText(ctx, 'いれたて 100円', 256, 148, 50, '#c9432f', { align: 'center' });
  }
  return canvasTexture(canvas);
}

/** 路牌 / 指示牌 */
export function getRoadSignTexture() {
  const { canvas, ctx } = makeCanvas(512, 160);
  ctx.fillStyle = '#1f4f8f';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 144);
  drawText(ctx, ' 木 町', 256, 34, 62, '#ffffff', { align: 'center' });
  drawText(ctx, 'SAKURAGI-CHO', 256, 108, 24, '#cfe0ff', { align: 'center', weight: 600, letterSpacing: 3 });
  return canvasTexture(canvas);
}

/** 小巷口的告示 / 海报栏 */
export function getNoticeBoardTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#4b515a';
  ctx.fillRect(6, 6, 244, 244);
  const rng = makeRng(2024);
  const colors = ['#f4f1e6', '#ffe9b8', '#dcecff', '#ffd9d9', '#e6f5e0'];
  for (let i = 0; i < 7; i++) {
    const w = 60 + rng() * 50;
    const h = 62 + rng() * 46;
    const x = 12 + rng() * (232 - w);
    const y = 12 + rng() * (232 - h);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rng() - 0.5) * 0.16);
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(60,60,70,0.7)';
    for (let l = 0; l < 4; l++) {
      ctx.fillRect(-w / 2 + 6, -h / 2 + 10 + l * 10, w - 12 - rng() * 10, 4);
    }
    ctx.restore();
  }
  return canvasTexture(canvas);
}

/* ------------------------------------------------------------------ */
/* 发光精灵（廉价的光晕，替代昂贵的 Bloom）                             */
/* ------------------------------------------------------------------ */

let glowTexture = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const { canvas, ctx } = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = canvasTexture(canvas);
  return glowTexture;
}

export function makeGlow(color, size = 1, opacity = 0.7) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}
