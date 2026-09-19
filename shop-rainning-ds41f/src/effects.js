/**
 * effects.js —— 全部动效的统一调度
 *
 *  1. 持续降雨（GPU 顶点动画的雨点）
 *  2. 屋檐 / 雨棚滴水
 *  3. 地面积水波纹
 *  4. 招牌与灯箱的轻微闪烁
 *  5. 自动门偶尔开合
 *  6. 雨水沿玻璃滑落（滚动贴图）
 *  7. 街道路面积水的灯光倒影（呼吸式强弱变化）
 *  8. 远处交通信号灯的循环变化
 */

import * as THREE from 'three';
import {
  createRain,
  createRipples,
  createDrips,
  createGlassStreaks,
  makeLightSmear,
  createPuddleSheen,
} from './environment.js';
import { LAYOUT as S } from './kit.js';
import { surfaceY } from './street.js';

export function createEffects(scene, ctx) {
  const { store, street, env } = ctx;

  /* ---------------- 1. 降雨 ---------------- */
  const rain = createRain(scene, { count: 2800, height: 8.4, spread: 5.4 });

  /* ---------------- 2. 屋檐滴水 ---------------- */
  const drips = createDrips(
    scene,
    [
      // 便利店雨棚前檐
      { x: -3.4, y: S.walkY + S.glassTop + 0.2, z: S.shopMaxZ + 1.2 },
      { x: -1.8, y: S.walkY + S.glassTop + 0.2, z: S.shopMaxZ + 1.2 },
      { x: -0.2, y: S.walkY + S.glassTop + 0.2, z: S.shopMaxZ + 1.2 },
      { x: 1.2, y: S.walkY + S.glassTop + 0.2, z: S.shopMaxZ + 1.2 },
      // 便利店屋顶前缘
      { x: -2.6, y: S.walkY + S.shopHeight + 0.18, z: S.shopMaxZ + 0.2 },
      { x: 0.9, y: S.walkY + S.shopHeight + 0.18, z: S.shopMaxZ + 0.2 },
      // 邻栋遮阳篷
      { x: 2.5, y: S.walkY + 1.7, z: 0.62 },
      // 招牌下沿
      { x: -2.8, y: S.walkY + S.glassTop + 0.2, z: S.shopMaxZ + 0.3 },
    ],
    { perOrigin: 3, speed: 3.0 }
  );

  /* ---------------- 3. 地面积水波纹 ---------------- */
  const ripples = createRipples(scene, { count: 150, surfaceY });

  /* ---------------- 4. 招牌 / 灯箱闪烁 ---------------- */
  const flickerTargets = [];
  // 招牌灯箱材质
  for (const m of store.signMeshes) {
    flickerTargets.push({ mat: m.material, base: 1, seed: Math.random() * 10 });
  }
  // 店内的发光材质，做极轻微的“呼吸”
  const breatheTargets = [];
  const seen = new Set();
  store.root.traverse((o) => {
    if (!o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (seen.has(m)) continue;
      if (m.isMeshBasicMaterial && m.color && m.toneMapped === false && m.map) {
        seen.add(m);
        if (!flickerTargets.some((t) => t.mat === m)) {
          breatheTargets.push({ mat: m, base: m.color.r ? 1 : 1, seed: Math.random() * 10 });
        }
      }
    }
  });

  /* ---------------- 5. 自动门 ---------------- */
  const door = store.door;

  /* ---------------- 6. 雨水沿玻璃滑落 ---------------- */
  const glassW = (S.shopMaxX - S.shopMinX) * 0.5;
  const streaksA = createGlassStreaks(glassW - 1.4, S.glassTop - S.glassBottom);
  streaksA.mesh.position.set(
    (S.shopMinX + S.shopMaxX) / 2 - 1.0,
    S.walkY + (S.glassBottom + S.glassTop) / 2,
    S.shopMaxZ + 0.028
  );
  scene.add(streaksA.mesh);

  const streaksB = createGlassStreaks(glassW - 1.4, S.glassTop - S.glassBottom);
  streaksB.mesh.position.set(
    (S.shopMinX + S.shopMaxX) / 2 + 1.0,
    S.walkY + (S.glassBottom + S.glassTop) / 2,
    S.shopMaxZ + 0.03
  );
  scene.add(streaksB.mesh);

  /* ---------------- 7. 路面积水的灯光倒影 ---------------- */
  const smears = new THREE.Group();
  const smearsList = [];

  /**
   * 铺一条倒影。origin 是光源所在的 (x, z)，倒影从该处朝街道方向（+Z）铺开，
   * 并且贴在真实铺装表面上（人行道 / 路面 / 小巷高地不同）。
   */
  function addSmear(color, w, l, o, x, z, opts = {}) {
    const m = makeLightSmear(color, w, l, o);
    const y = surfaceY(x, z + l / 2) + (opts.lift ?? 0.016);
    m.position.set(x, y, z + l / 2);
    if (opts.rotate) m.rotation.z = opts.rotate;
    smears.add(m);
    smearsList.push({ mesh: m, base: o, seed: Math.random() * 6.28 });
    return m;
  }

  // 便利店暖光在店前铺装上的倒影（几条，宽窄不一，形成被雨水打碎的光带）
  addSmear(0xffc98a, 1.5, 2.0, 0.5, -2.7, -0.9);
  addSmear(0xffb870, 1.9, 2.6, 0.46, -1.5, -0.9);
  addSmear(0xffd6a0, 1.4, 2.2, 0.42, -0.3, -0.9);
  addSmear(0xffc98a, 1.0, 1.8, 0.34, 0.7, -0.9);
  // 招牌的绿色灯箱
  addSmear(0x53d99a, 2.6, 1.8, 0.3, -1.6, -0.9);
  // 招牌顶部的霓虹青
  addSmear(0x7fe6ff, 3.0, 1.3, 0.2, -1.5, -0.9);
  // 自动门的溢出光
  addSmear(0xffd9a8, 1.1, 1.4, 0.36, S.doorCenterX, -0.9);

  // 路灯的冷白倒影（在街角人行道上）
  addSmear(0xbcd8ff, 1.7, 3.0, 0.42, 1.72, 1.05);

  // 自动贩卖机的冷光倒影
  addSmear(0xbfe0ff, 1.0, 1.3, 0.34, 2.72, -0.75);
  addSmear(0xbfe0ff, 1.0, 1.3, 0.3, 2.72, 0.45);

  // 交通信号灯的倒影（落在前景车道上）
  const signalSmear = makeLightSmear(0x4fe08a, 0.5, 2.2, 0.26);
  signalSmear.position.set(0.15, 0.016, 3.78 + 1.0);
  smears.add(signalSmear);
  smearsList.push({ mesh: signalSmear, base: 0.26, seed: 2.4 });

  // 小巷深处的暖光溢出（贴着巷子地面，沿 Z 方向）
  const alleySmear = makeLightSmear(0xffcf9a, 0.8, 2.6, 0.26);
  alleySmear.position.set(1.85, 0.045, 0.2);
  smears.add(alleySmear);
  smearsList.push({ mesh: alleySmear, base: 0.26, seed: 3.1 });

  scene.add(smears);

  /* ---------------- 潮湿水洼的静态高光 ---------------- */
  const puddles = createPuddleSheen(scene, surfaceY);

  /* ---------------- 8. 交通信号灯 ---------------- */
  // 车行灯：绿 → 黄 → 红 循环；行人灯：红/绿交替
  const SIGNAL_CYCLE = [
    { green: 6.5, yellow: 2.0, red: 7.0 },
  ][0];

  /* ---------------- 状态与更新 ---------------- */
  const state = {
    rainOn: true,
    rippleOn: true,
    doorOn: true,
    flickerOn: true,
    reflectionOn: true,
    wetShineOn: true,
    time: 0,
    signalPhase: 0,
    signalTimer: 0,
    signalIndex: 0, // 0=绿 1=黄 2=红
  };

  const COL_OFF = new THREE.Color(0x232a33);
  const COL_GREEN = new THREE.Color(0x3fe089);
  const COL_YELLOW = new THREE.Color(0xffc247);
  const COL_RED = new THREE.Color(0xff5a48);
  const SIGNAL_COLS = [COL_GREEN, COL_YELLOW, COL_RED];

  function updateSignal(dt) {
    state.signalTimer -= dt;
    if (state.signalTimer <= 0) {
      state.signalIndex = (state.signalIndex + 1) % 3;
      state.signalTimer =
        state.signalIndex === 0
          ? SIGNAL_CYCLE.green
          : state.signalIndex === 1
            ? SIGNAL_CYCLE.yellow
            : SIGNAL_CYCLE.red;

      // 车行灯：只点亮当前相位的那一颗
      for (let i = 0; i < street.signals.length; i++) {
        street.signals[i].material.color.copy(i === state.signalIndex ? SIGNAL_COLS[i] : COL_OFF);
      }
      // 行人灯：车行绿灯时行人红灯，其余时间行人绿灯
      const pedGreen = state.signalIndex !== 0;
      if (street.pedSignals[0]) street.pedSignals[0].material.color.copy(pedGreen ? COL_OFF : COL_RED);
      if (street.pedSignals[1]) street.pedSignals[1].material.color.copy(pedGreen ? COL_GREEN : COL_OFF);
      // 路面倒影跟着变化
      signalSmear.material.color.copy(SIGNAL_COLS[state.signalIndex]).multiplyScalar(0.85);
    }
  }

  // 初始化一次，保证开场状态正确
  state.signalTimer = 0.01;
  updateSignal(0);

  function update(dt, elapsed) {
    state.time += dt;

    /* 雨 */
    rain.update(elapsed);

    /* 滴水 */
    drips.update(elapsed);

    /* 波纹 */
    ripples.update(elapsed, state.rainOn ? rain.amount : 0);

    /* 玻璃上的雨痕：缓慢向下滚动 */
    const speed = 0.055;
    streaksA.texture.offset.y = (streaksA.texture.offset.y - speed * dt) % 1;
    streaksB.texture.offset.y = (streaksB.texture.offset.y - speed * 0.8 * dt) % 1;
    streaksA.material.opacity = 0.34 + 0.2 * Math.min(1.2, rain.amount);
    streaksB.material.opacity = 0.3 + 0.18 * Math.min(1.2, rain.amount);

    /* 自动门 */
    door.update(dt, state.doorOn);

    /* 招牌 / 灯箱闪烁 */
    if (state.flickerOn) {
      for (const t of flickerTargets) {
        const n =
          Math.sin(elapsed * 7.3 + t.seed) * 0.5 +
          Math.sin(elapsed * 23.1 + t.seed * 2.1) * 0.28 +
          Math.sin(elapsed * 61.7 + t.seed * 3.7) * 0.12;
        // 大部分时间稳定，偶尔来一次明显的闪
        const glitch = Math.sin(elapsed * 1.7 + t.seed) > 0.985 ? -0.55 : 0;
        t.mat.opacity = 1 + n * 0.055 + glitch;
        t.mat.opacity = Math.max(0.35, Math.min(1, t.mat.opacity));
      }
      for (const t of breatheTargets) {
        const v = 0.985 + Math.sin(elapsed * 2.1 + t.seed) * 0.02;
        t.mat.color.setScalar(v);
      }
    } else {
      for (const t of flickerTargets) t.mat.opacity = 1;
      for (const t of breatheTargets) t.mat.color.setScalar(1);
    }

    /* 路面倒影呼吸 */
    if (state.reflectionOn) {
      const wetGain = (state.wetShineOn ? 1 : 0.35) * Math.min(1.25, 0.5 + rain.amount * 0.5);
      for (const s of smearsList) {
        const wob = 0.88 + 0.12 * Math.sin(elapsed * 1.6 + s.seed) + 0.04 * Math.sin(elapsed * 5.3 + s.seed * 2);
        s.mesh.material.opacity = s.base * wob * wetGain;
      }
      puddles.setWetness(wetGain);
    }

    /* 交通灯 */
    updateSignal(dt);
  }

  return {
    state,
    rain,
    ripples,
    drips,
    door,
    smears,
    puddles,
    streaks: [streaksA, streaksB],
    update,
    setRainAmount(v) {
      rain.setAmount(v);
    },
    setRipples(v) {
      state.rippleOn = v;
      ripples.setEnabled(v);
    },
    setDoor(v) {
      state.doorOn = v;
    },
    setFlicker(v) {
      state.flickerOn = v;
    },
    setReflection(v) {
      state.reflectionOn = v;
      smears.visible = v;
      puddles.group.visible = v;
    },
    setWetShine(v) {
      state.wetShineOn = v;
    },
  };
}
