// cdp.mjs —— 通过 Chrome DevTools Protocol 真实驱动页面：
// 读取运行时诊断、测量帧率、点击 UI、截图。
// Node 22+ 自带 WebSocket，无需额外依赖。
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333 + Math.floor(Math.random() * 200);
const OUT = resolve('docs/shots');
mkdirSync(OUT, { recursive: true });

const URL_TO_OPEN = process.env.PAGE || 'http://127.0.0.1:4173/';
const WIDTH = Number(process.env.W || 1440);
const HEIGHT = Number(process.env.H || 900);

// 浏览器 profile 放在系统临时目录：放在项目里会被 Vite 的文件监听扫到而崩溃
const profile = join(tmpdir(), `dsh-edge-cdp-${PORT}`);

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--mute-audio',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    '--user-data-dir=' + profile,
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getVersion() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(250);
  }
  throw new Error('DevTools endpoint unavailable');
}

const version = await getVersion();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let msgId = 0;
const pending = new Map();
const events = [];

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve: res, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(JSON.stringify(m.error)));
    else res(m.result);
  } else if (m.method) {
    events.push(m);
  }
};

function send(method, params = {}, sessionId) {
  const id = ++msgId;
  return new Promise((res, rej) => {
    pending.set(id, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        rej(new Error('timeout: ' + method));
      }
    }, 30000);
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId);

// 收集控制台错误
const consoleErrors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error') {
    consoleErrors.push(m.params.entry.text);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(
      'exception: ' + (m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text)
    );
  }
});

async function evaluate(expr, awaitPromise = false) {
  const r = await send(
    'Runtime.evaluate',
    { expression: expr, returnByValue: true, awaitPromise },
    sessionId
  );
  if (r.exceptionDetails) {
    throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  const file = resolve(OUT, name + '.png');
  writeFileSync(file, Buffer.from(r.data, 'base64'));
  return file;
}

const report = {};

try {
  await send('Page.navigate', { url: URL_TO_OPEN }, sessionId);

  // 等待场景就绪
  for (let i = 0; i < 100; i++) {
    const ok = await evaluate('!!(window.__dsh && window.__dsh.ready)');
    if (ok) break;
    await sleep(200);
  }
  report.ready = await evaluate('!!(window.__dsh && window.__dsh.ready)');
  await sleep(2500);

  // ---- 场景统计 ----
  report.sceneStats = await evaluate(`(() => {
    const d = window.__dsh;
    const r = d.renderer;
    let meshes = 0, objects = 0, sprites = 0, points = 0, lights = 0;
    d.scene.traverse((o) => {
      objects++;
      if (o.isMesh) meshes++;
      if (o.isSprite) sprites++;
      if (o.isPoints) points++;
      if (o.isLight) lights++;
    });
    return {
      objects, meshes, sprites, points, lights,
      drawCalls: r.info.render.calls,
      triangles: r.info.render.triangles,
      programs: r.info.programs ? r.info.programs.length : -1,
      geometries: r.info.memory.geometries,
      textures: r.info.memory.textures,
      fpsLimit: d.settings.fpsLimit,
    };
  })()`);

  // ---- 帧率测量：用真实 render 次数统计，验证限帧是否生效 ----
  async function measureFps(limit, ms = 2600) {
    await evaluate(`window.__dsh.settings.fpsLimit = ${limit}; true`);
    await sleep(350); // 让累积器稳定
    const r = await evaluate(`
      (() => {
        window.__fpsProbe2 = {
          start: performance.now(),
          rc: window.__dsh.renderCount,
          done: false,
        };
        setTimeout(() => { window.__fpsProbe2.done = true; }, ${ms});
        return true;
      })()
    `);
    for (let i = 0; i < 60; i++) {
      if (await evaluate('window.__fpsProbe2.done')) break;
      await sleep(200);
    }
    return await evaluate(`
      (() => {
        const p = window.__fpsProbe2;
        const secs = (performance.now() - p.start) / 1000;
        const rendered = window.__dsh.renderCount - p.rc;
        return { target: ${limit}, renderedFrames: rendered, seconds: +secs.toFixed(2), actualFps: +(rendered / secs).toFixed(1) };
      })()
    `);
  }

  report.frameLimit = {};
  for (const lim of [10, 20, 40, 0]) {
    report.frameLimit[lim === 0 ? 'unlimited' : lim] = await measureFps(lim);
  }
  await evaluate('window.__dsh.settings.fpsLimit = 40; true');

  // ---- 动效是否真的在动：比较两个时刻的场景状态 ----
  const motion = await evaluate(`(() => {
    const d = window.__dsh;
    const pick = () => {
      const s = d.store.door.group.children[0];
      return {
        doorX: +s.position.x.toFixed(4),
        rainT: +d.effects.rain.material.uniforms.uTime.value.toFixed(3),
        rippleT: +d.effects.ripples.mesh.material.uniforms.uTime.value.toFixed(3),
        smearOpacity: +d.effects.smears.children[0].material.opacity.toFixed(4),
        signal: d.effects.state.signalIndex,
      };
    };
    window.__m0 = pick();
    return window.__m0;
  })()`);
  await sleep(2200);
  const motion2 = await evaluate(`(() => {
    const d = window.__dsh;
    const s = d.store.door.group.children[0];
    return {
      doorX: +s.position.x.toFixed(4),
      rainT: +d.effects.rain.material.uniforms.uTime.value.toFixed(3),
      rippleT: +d.effects.ripples.mesh.material.uniforms.uTime.value.toFixed(3),
      smearOpacity: +d.effects.smears.children[0].material.opacity.toFixed(4),
      signal: d.effects.state.signalIndex,
    };
  })()`);
  report.motionChanges = {
    doorMoved: motion.doorX !== motion2.doorX,
    rainAdvanced: motion2.rainT > motion.rainT,
    rippleAdvanced: motion2.rippleT > motion.rippleT,
    reflectionBreathed: motion.smearOpacity !== motion2.smearOpacity,
    from: motion,
    to: motion2,
  };

  // ---- 动效速度是否与真实时间一致（限帧不应导致慢放）----
  report.animSpeed = {};
  for (const lim of [20, 40, 0]) {
    await evaluate(`window.__dsh.settings.fpsLimit = ${lim}; true`);
    await sleep(400);
    await evaluate(`
      (() => {
        window.__s0 = {
          t: window.__dsh.effects.state.time,
          wall: performance.now(),
          loop: window.__dsh.loopCalls,
          sim: window.__dsh.simSteps,
          render: window.__dsh.renderCount,
        };
        return true;
      })()
    `);
    await sleep(2000);
    report.animSpeed[lim === 0 ? 'unlimited' : lim] = await evaluate(`
      (() => {
        const d = window.__dsh;
        const wall = (performance.now() - window.__s0.wall) / 1000;
        return {
          simSeconds: +(d.effects.state.time - window.__s0.t).toFixed(3),
          wallSeconds: +wall.toFixed(3),
          ratio: +((d.effects.state.time - window.__s0.t) / wall).toFixed(3),
          loopCalls: d.loopCalls - window.__s0.loop,
          simSteps: d.simSteps - window.__s0.sim,
          renders: d.renderCount - window.__s0.render,
          loopPerSec: +((d.loopCalls - window.__s0.loop) / wall).toFixed(1),
        };
      })()
    `);
  }
  await evaluate('window.__dsh.settings.fpsLimit = 40; true');

  // ---- UI 交互：展开设置条 ----
  report.uiPanel = await evaluate(`(() => {
    const root = document.getElementById('ui-root');
    return { collapsedClass: root.classList.contains('ui-collapsed') };
  })()`);
  await evaluate(`document.getElementById('ui-toggle').click(); true`);
  await sleep(700);
  report.uiPanelAfterClick = await evaluate(`(() => {
    const root = document.getElementById('ui-root');
    const panel = root.querySelector('.ui-panel');
    const r = panel.getBoundingClientRect();
    return {
      collapsedClass: root.classList.contains('ui-collapsed'),
      panelWidth: Math.round(r.width),
      panelHeight: Math.round(r.height),
      visible: getComputedStyle(panel).visibility,
      opacity: getComputedStyle(panel).opacity,
    };
  })()`);
  report.uiShot = await shot('ui-panel');

  // ---- 改设置：阴影质量 / 描边 / 雨量，验证真实生效 ----
  const shadowTest = await evaluate(`(() => {
    const d = window.__dsh;
    const moon = d.lights.moon;
    const before = { size: moon.shadow.mapSize.width, cast: moon.castShadow };
    const el = document.getElementById('shadowQuality');
    el.value = '3';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { before };
  })()`);
  await sleep(500);
  report.shadowChange = await evaluate(`(() => {
    const moon = window.__dsh.lights.moon;
    return { after: { size: moon.shadow.mapSize.width, cast: moon.castShadow } };
  })()`);
  report.shadowChange.before = shadowTest.before;

  report.outlineToggle = await evaluate(`(() => {
    const d = window.__dsh;
    let outlines = 0, visible = 0;
    d.scene.traverse((o) => { if (o.userData && o.userData.isOutline) { outlines++; if (o.visible) visible++; } });
    const el = document.getElementById('outline');
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    let vis2 = 0;
    d.scene.traverse((o) => { if (o.userData && o.userData.isOutline && o.visible) vis2++; });
    // 还原
    el.value = '1';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    let vis3 = 0;
    d.scene.traverse((o) => { if (o.userData && o.userData.isOutline && o.visible) vis3++; });
    return { totalOutlines: outlines, visibleBefore: visible, visibleAfterOff: vis2, visibleAfterOn: vis3 };
  })()`);

  report.rainToggle = await evaluate(`(() => {
    const d = window.__dsh;
    const geo = d.effects.rain.points.geometry;
    const before = geo.drawRange.count;
    const el = document.getElementById('rainAmount');
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const after0 = geo.drawRange.count;
    el.value = '100';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const after100 = geo.drawRange.count;
    return { before, after0, after100 };
  })()`);

  // 湿润高光开关：清漆 / 粗糙度 / 倒影强度都应随之变化
  report.wetShineToggle = await evaluate(`(() => {
    const d = window.__dsh;
    const glass = d.store.materials.glass;
    const road = d.street.materials.asphalt;
    const on = {
      clearcoat: glass.clearcoat, glassRough: glass.roughness, roadRough: road.roughness,
      wetShineOn: d.effects.state.wetShineOn,
    };
    const el = document.getElementById('wetShine');
    el.checked = false;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    const off = {
      clearcoat: glass.clearcoat, glassRough: glass.roughness, roadRough: road.roughness,
      wetShineOn: d.effects.state.wetShineOn,
    };
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    const back = { clearcoat: glass.clearcoat, roadRough: road.roughness };
    return { on, off, back };
  })()`);

  // ---- 视角切换 ----
  await evaluate(`document.querySelector('[data-view="front"]').click(); true`);
  await sleep(1400);
  report.viewFront = await evaluate(`(() => {
    const c = window.__dsh.camera;
    return { pos: [+c.position.x.toFixed(2), +c.position.y.toFixed(2), +c.position.z.toFixed(2)] };
  })()`);
  report.frontShot = await shot('cdp-front');

  await evaluate(`document.querySelector('[data-view="hero"]').click(); true`);
  await sleep(1400);
  report.heroShot = await shot('cdp-hero');

  // ---- OrbitControls 拖拽 / 缩放 ----
  const dragTest = await evaluate(`(() => {
    const d = window.__dsh;
    return { before: [+d.camera.position.x.toFixed(3), +d.camera.position.z.toFixed(3)] };
  })()`);
  const canvasBox = await evaluate(`(() => {
    const r = document.getElementById('scene').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: canvasBox.x, y: canvasBox.y, button: 'left', clickCount: 1, buttons: 1 }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: canvasBox.x + 180, y: canvasBox.y + 40, button: 'left', buttons: 1 }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: canvasBox.x + 320, y: canvasBox.y + 60, button: 'left', buttons: 1 }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: canvasBox.x + 320, y: canvasBox.y + 60, button: 'left', buttons: 0 }, sessionId);
  await sleep(600);
  const dragAfter = await evaluate(`(() => {
    const d = window.__dsh;
    return { after: [+d.camera.position.x.toFixed(3), +d.camera.position.z.toFixed(3)] };
  })()`);
  report.dragRotates = {
    before: dragTest.before,
    after: dragAfter.after,
    changed: dragTest.before[0] !== dragAfter.after[0] || dragTest.before[1] !== dragAfter.after[1],
  };

  // 滚轮缩放
  const zoomBefore = await evaluate('+window.__dsh.camera.position.length().toFixed(3)');
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: canvasBox.x, y: canvasBox.y, deltaX: 0, deltaY: -240, button: 'none' }, sessionId);
  await sleep(700);
  const zoomAfter = await evaluate('+window.__dsh.camera.position.length().toFixed(3)');
  report.wheelZooms = { before: zoomBefore, after: zoomAfter, changed: zoomBefore !== zoomAfter };

  // 窗口尺寸变化
  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 620, deviceScaleFactor: 1, mobile: false }, sessionId);
  await sleep(600);
  report.resize = await evaluate(`(() => {
    const c = document.getElementById('scene');
    const r = window.__dsh.renderer;
    return {
      canvasW: c.width, canvasH: c.height,
      cssW: Math.round(c.getBoundingClientRect().width),
      aspect: +window.__dsh.camera.aspect.toFixed(3),
      drawingW: r.domElement.width,
    };
  })()`);
  await send('Emulation.clearDeviceMetricsOverride', {}, sessionId);

  report.consoleErrors = consoleErrors.slice(0, 8);
} catch (err) {
  report.harnessError = String(err && err.stack ? err.stack : err);
}

console.log(JSON.stringify(report, null, 2));

try {
  ws.close();
} catch {}
edge.kill();
process.exit(0);
