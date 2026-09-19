// Interaction test: drives the real UI over CDP and asserts state changes.
// Requires ?debug=1, which exposes window.__x for the harness.
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
];
const exe = BROWSERS.find(p => p && existsSync(p));
const profile = mkdtempSync(join(tmpdir(), 'dsh-ui-'));
const port = 9700 + Math.floor(Math.random() * 200);
const pageUrl = pathToFileURL(join(root, 'index.html')).href + '?debug=1&noorbit=1';

const child = spawn(exe, ['--headless=new', '--no-first-run', '--disable-extensions',
  '--window-size=1400,880', '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let id = 0; const pending = new Map();
const send = (ws, method, params) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params: params || {} }));
});

let target = null;
for (let i = 0; i < 80 && !target; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    target = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
  } catch (e) { /* wait */ }
  if (!target) await sleep(150);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
};
await send(ws, 'Runtime.enable');
await send(ws, 'Page.enable');
await send(ws, 'Page.navigate', { url: pageUrl });
await sleep(6000);

const js = async (expr) => {
  const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) {
    return 'THREW: ' + r.exceptionDetails.text + ' ' +
      ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || '');
  }
  return r.result.value;
};

const results = [];
async function check(name, expr, expect) {
  const v = await js(expr);
  const ok = expect(v);
  results.push({ name, v, ok });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + ' -> ' + JSON.stringify(v));
  return ok;
}
function report(name, value, ok) {
  results.push({ name, v: value, ok });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + ' -> ' + value);
}

// sets a control's value and fires its event
const setControl = (id, value, ev) =>
  js('(function(){var e=document.getElementById(' + JSON.stringify(id) + ');' +
     'e.value=' + JSON.stringify(String(value)) + ';' +
     'e.dispatchEvent(new Event(' + JSON.stringify(ev) + ',{bubbles:true}));return e.value;})()');

const click = (sel) => js('document.querySelector(' + JSON.stringify(sel) + ').click()');

await check('page has no errors', 'JSON.stringify(window.__err||[])', v => v === '[]');
await check('debug handle present', 'typeof window.__x === "object"', v => v === true);
await check('scene built (trees)', '__x.VEG.counts.trees > 20', v => v === true);
await check('scene built (leaves)', '__x.VEG.counts.leaves > 100', v => v === true);
await check('scene built (grass)', '__x.VEG.counts.grass > 500', v => v === true);

// --- pause / resume ---------------------------------------------------
await js('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true}))');
await sleep(250);
await check('space pauses time', '__x.SEASON.paused', v => v === true);
await check('pause button reads 继续', 'document.getElementById("btnPlay").textContent', v => v === '继续');
await js('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true}))');
await sleep(250);
await check('space resumes time', '__x.SEASON.paused', v => v === false);
await check('pause button reads 暂停', 'document.getElementById("btnPlay").textContent', v => v === '暂停');

// --- frame-rate cap ---------------------------------------------------
await setControl('selFps', 30, 'change');
await check('fps cap 30', '__x.QUALITY.maxFPS', v => v === 30);
await setControl('selFps', 120, 'change');
await check('fps cap accepts other values', '__x.QUALITY.maxFPS', v => v === 120);
await setControl('selFps', 0, 'change');
await check('fps uncapped', '__x.QUALITY.maxFPS', v => v === 0);
await setControl('selFps', 60, 'change');
await check('fps cap back to 60', '__x.QUALITY.maxFPS', v => v === 60);

// --- shadow quality ---------------------------------------------------
await setControl('selShadow', 0, 'change');
await check('shadows off', '__x.renderer.shadowMap.enabled', v => v === false);
await check('sun light stops casting', '__x.sunLight.castShadow', v => v === false);
await setControl('selShadow', 1024, 'change');
await check('shadows 1024 enabled', '__x.renderer.shadowMap.enabled', v => v === true);
await check('shadow map resized to 1024', '__x.sunLight.shadow.mapSize.x', v => v === 1024);
await setControl('selShadow', 2048, 'change');
await check('shadow map resized to 2048', '__x.sunLight.shadow.mapSize.x', v => v === 2048);

// --- render scale -----------------------------------------------------
await setControl('rScale', 60, 'input');
await check('render scale 0.6', '__x.QUALITY.renderScale', v => Math.abs(v - 0.6) < 1e-6);
await check('pixel ratio follows', '__x.renderer.getPixelRatio() <= 0.6 + 1e-6', v => v === true);
await setControl('rScale', 100, 'input');
await check('render scale back to 1.0', '__x.QUALITY.renderScale', v => v === 1);

// --- presets ----------------------------------------------------------
await click('#segPreset button[data-v="0"]');
await check('preset 0 -> 30fps cap', '__x.QUALITY.maxFPS', v => v === 30);
await check('preset 0 -> low particles', '__x.QUALITY.particles', v => Math.abs(v - 0.55) < 1e-6);
await click('#segPreset button[data-v="2"]');
await check('preset 2 -> uncapped', '__x.QUALITY.maxFPS', v => v === 0);
await check('preset 2 -> 4096 shadows', '__x.QUALITY.shadowSize', v => v === 4096);
await click('#segPreset button[data-v="1"]');
await check('preset 1 -> 60fps cap', '__x.QUALITY.maxFPS', v => v === 60);

// --- particle density -------------------------------------------------
await setControl('rPart', 40, 'input');
await check('particle density 0.4', '__x.QUALITY.particles', v => Math.abs(v - 0.4) < 1e-6);
await check('label shows 40%', 'document.getElementById("vPart").textContent', v => v === '40%');
await setControl('rPart', 100, 'input');

// --- cycle length -----------------------------------------------------
await setControl('rCycle', 240, 'input');
await check('cycle length 240s', '__x.QUALITY.cycle', v => v === 240);
await check('cycle label', 'document.getElementById("vCycle").textContent', v => v === '240s');
await setControl('rCycle', 480, 'input');

// --- switches ---------------------------------------------------------
await js('document.getElementById("swIdle").click()');
await check('idle pause on', '__x.QUALITY.idlePause', v => v === true);
await js('document.getElementById("swIdle").click()');
await check('idle pause off', '__x.QUALITY.idlePause', v => v === false);

await js('document.getElementById("swGlow").click()');
await check('bloom off', '__x.skyMat.uniforms.uBloom.value', v => v === 0);
await js('document.getElementById("swGlow").click()');
await check('bloom on', '__x.skyMat.uniforms.uBloom.value', v => v === 1);

await js('document.getElementById("swExpo").click()');
await check('auto exposure off', '__x.QUALITY.autoExposure', v => v === false);
await js('document.getElementById("swExpo").click()');

await js('document.getElementById("swDiag").click()');
await check('diagnostics hidden', 'document.getElementById("diag").style.display', v => v === 'none');
await js('document.getElementById("swDiag").click()');

// --- orbit ------------------------------------------------------------
await click('#segOrbit button[data-v="0"]');
await check('orbit off', '__x.QUALITY.autoRotate', v => v === false);
await click('#segOrbit button[data-v="1"]');
await check('orbit on', '__x.QUALITY.autoRotate', v => v === true);

// --- season scrubber (click at 72% of the bar) ------------------------
await js('(function(){' +
  'var b=document.getElementById("yearBar");' +
  'var r=b.getBoundingClientRect();' +
  'var x=r.left+r.width*0.72;' +
  'b.dispatchEvent(new PointerEvent("pointerdown",{clientX:x,clientY:r.top+8,bubbles:true,pointerId:1}));' +
  'b.dispatchEvent(new PointerEvent("pointerup",{clientX:x,clientY:r.top+8,bubbles:true,pointerId:1}));' +
  '})()');
await sleep(400);
await check('scrubber set the season', '__x.SEASON.phase > 0.68 && __x.SEASON.phase < 0.78', v => v === true);
await check('smoothed phase stays close (no jump)', 'Math.abs(__x.seasonSmooth() - __x.SEASON.phase) < 0.35', v => v === true);

// --- speed / weather sliders -----------------------------------------
await setControl('speedRange', 200, 'input');
await check('time scale 2.0x', '__x.SEASON.timeScale', v => Math.abs(v - 2) < 0.02);
await check('speed label', 'document.getElementById("speedVal").textContent', v => v === '2.00×');
await setControl('weatherRange', 0, 'input');
await check('weather intensity 0', '__x.SEASON.weather', v => v === 0);
await setControl('weatherRange', 100, 'input');
await check('weather intensity 1', '__x.SEASON.weather', v => Math.abs(v - 1) < 0.02);
await setControl('speedRange', 100, 'input');

// --- camera: drag to orbit --------------------------------------------
const camBefore = await js('__x.camera.position.x.toFixed(3)+","+__x.camera.position.z.toFixed(3)');
await js('(function(){' +
  'var c=document.getElementById("stage");' +
  'c.dispatchEvent(new PointerEvent("pointerdown",{clientX:700,clientY:400,bubbles:true,pointerId:2}));' +
  'for(var i=1;i<=14;i++)c.dispatchEvent(new PointerEvent("pointermove",{clientX:700+i*14,clientY:400,bubbles:true,pointerId:2}));' +
  'c.dispatchEvent(new PointerEvent("pointerup",{clientX:896,clientY:400,bubbles:true,pointerId:2}));' +
  '})()');
await sleep(900);
const camAfter = await js('__x.camera.position.x.toFixed(3)+","+__x.camera.position.z.toFixed(3)');
report('drag orbits the camera', camBefore + ' => ' + camAfter, camBefore !== camAfter);

// --- camera: wheel to zoom --------------------------------------------
const distBefore = await js('__x.camera.position.distanceTo(__x.controls.target).toFixed(3)');
await js('document.getElementById("stage").dispatchEvent(' +
  'new WheelEvent("wheel",{deltaY:-400,bubbles:true,cancelable:true}))');
await sleep(900);
const distAfter = await js('__x.camera.position.distanceTo(__x.controls.target).toFixed(3)');
report('wheel zooms in', distBefore + ' => ' + distAfter, parseFloat(distAfter) < parseFloat(distBefore));

// --- camera stays within its clamps -----------------------------------
await js('(function(){var c=document.getElementById("stage");' +
  'for(var k=0;k<5;k++)c.dispatchEvent(new WheelEvent("wheel",{deltaY:900,bubbles:true,cancelable:true}));' +
  '})()');
await sleep(700);
const far = await js('__x.camera.position.distanceTo(__x.controls.target)');
report('zoom clamped to maxDistance', String(far), far <= 46.5);

// --- renderer health --------------------------------------------------
await check('still no page errors', 'JSON.stringify(window.__err||[])', v => v === '[]');
await check('render loop advancing', 'window.__frames > 60', v => v === true);
await check('season label valid', 'document.getElementById("seasonName").textContent.length > 3', v => v === true);
await check('camera has no NaN', 'isFinite(__x.camera.position.x) && isFinite(__x.camera.position.y)', v => v === true);

const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' });
writeFileSync(join(root, 'ui_test.png'), Buffer.from(shot.data, 'base64'));

const failed = results.filter(r => !r.ok).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed');
ws.close(); child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
process.exit(failed ? 1 : 0);