// Long-run behavioural test over CDP:
//  * the year actually advances and cycles
//  * seasons pass through every phase smoothly (no jumps between samples)
//  * creatures and props stay inside the sandbox
//  * the boat is moored when the lake is frozen and sailing when it is not
//  * nothing accumulates in the scene graph over time (no leaks)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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
const profile = mkdtempSync(join(tmpdir(), 'dsh-sim-'));
const port = 9400 + Math.floor(Math.random() * 300);
// a 60 second year so the whole cycle can be observed inside the test
const pageUrl = pathToFileURL(join(root, 'index.html')).href +
  '?debug=1&noorbit=1&phase=0.02';

const child = spawn(exe, ['--headless=new', '--no-first-run', '--disable-extensions',
  '--window-size=1100,700', '--remote-debugging-port=' + port,
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
await sleep(5000);

const js = async (expr) => {
  const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) return 'THREW: ' + (r.exceptionDetails.exception.description || r.exceptionDetails.text);
  return r.result.value;
};

const results = [];
const check = (name, value, ok) => {
  results.push({ name, value, ok });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + ' -> ' + value);
};

// --- speed the year up so a full cycle fits in the run -----------------
await js('(function(){var e=document.getElementById("rCycle");e.value=60;e.dispatchEvent(new Event("input"));})()');
await js('__x.SEASON.timeScale = 1');

// --- sample the year ---------------------------------------------------
const SAMPLES = 90;
const sampleExpr = `(function(){
  function box(o, out, key){ if(!o) return; out.push([key, o.position.x, o.position.y, o.position.z]); }
  var p = [];
  for (var i=0;i<__x.VEG.list ? 0 : 0;i++){}
  var objs = [];
  __x.SEASON_RUNTIME_PEOPLE = __x.SEASON_RUNTIME_PEOPLE || null;
  return JSON.stringify({
    p: __x.SEASON.phase,
    snow: __x.S.S.snow, ice: __x.S.ice, canopy: __x.S.canopy,
    leafSize: __x.S.leafSize, temp: __x.S.temperature,
    daylight: __x.S.daylight,
    children: __x.renderer.info.memory.geometries,
    textures: __x.renderer.info.memory.textures,
    boat: __x.boatState ? __x.boatState() : null
  });
})()`;

// expose boat + creature positions for the boundary check
await js(`(function(){
  window.__world = function(){
    var out = { boat: null, people: [], minY: 1e9, maxAbs: 0 };
    var scene = __x.renderer.__scene || null;
    return out;
  };
})()`);

const series = [];
for (let i = 0; i < SAMPLES; i++) {
  const raw = await js('JSON.stringify({p:__x.SEASON.phase,snow:__x.S.snow,ice:__x.S.ice,' +
    'canopy:__x.S.canopy,leafSize:__x.S.leafSize,temp:__x.S.temperature,daylight:__x.S.daylight,' +
    'geo:__x.renderer.info.memory.geometries,tex:__x.renderer.info.memory.textures,' +
    'frames:window.__frames})');
  if (typeof raw === 'string' && raw.startsWith('THREW')) { console.log(raw); break; }
  series.push(JSON.parse(raw));
  await sleep(750);
}

check('year advanced past several seasons',
  series[0].p.toFixed(2) + ' -> ' + series[series.length - 1].p.toFixed(2),
  series[series.length - 1].p > series[0].p || series.some((s, i) => i > 0 && s.p < series[i - 1].p));

check('phase is always in [0,1)', series.every(s => s.p >= 0 && s.p < 1),
  series.every(s => s.p >= 0 && s.p < 1));

// --- smoothness -------------------------------------------------------
// Headless browsers throttle requestAnimationFrame, so sample-to-sample deltas
// only reflect the sample spacing. The authoritative continuity check is the
// in-page sweep, which walks the year at fixed resolution regardless of timing.
const sweep = JSON.parse(await js('JSON.stringify(window.__sweep(3000))'));
const worstKey = Object.keys(sweep).filter(k => k[0] !== '_')
  .sort((a, b) => sweep[b] - sweep[a])[0];
check('season model is continuous (worst step ' + worstKey + '=' + sweep[worstKey] +
  ' at 3000 samples)', sweep._maxOverall, sweep._maxOverall < 0.12);

// sampled values must still be finite and in range
let finite = true;
for (const s of series) {
  for (const k of ['snow', 'ice', 'canopy', 'leafSize', 'temp', 'daylight']) {
    if (!isFinite(s[k]) || s[k] < -100 || s[k] > 100) finite = false;
  }
}
check('every sampled channel stays finite and in range', finite, finite);

// --- the year really reaches winter and comes back ---------------------
await js('__x.QUALITY.cycle = 1e9;');
const probe = async (ph) => {
  await js('__x.SEASON.phase = ' + ph + ';');
  await sleep(1600);
  return JSON.parse(await js('JSON.stringify({p:+__x.SEASON.phase.toFixed(3),' +
    'snow:+__x.S.snow.toFixed(2),ice:+__x.S.ice.toFixed(2),canopy:+__x.S.canopy.toFixed(2),' +
    'bloom:+__x.S.blossom.toFixed(2),leafDrop:+__x.S.leafDrop.toFixed(2),' +
    'boat:__x.BOAT.state,temp:+__x.S.temperature.toFixed(1)})'));
};
const atSpring = await probe(0.10);
const atSummer = await probe(0.32);
const atAutumn = await probe(0.64);
const atWinter = await probe(0.92);

console.log('   spring: ' + JSON.stringify(atSpring));
console.log('   summer: ' + JSON.stringify(atSummer));
console.log('   autumn: ' + JSON.stringify(atAutumn));
console.log('   winter: ' + JSON.stringify(atWinter));

check('spring blossoms', atSpring.bloom, atSpring.bloom > 0.5);
check('spring is mild', atSpring.temp, atSpring.temp > 5 && atSpring.temp < 20);
check('summer canopy is full', atSummer.canopy, atSummer.canopy > 0.95);
check('summer is warm', atSummer.temp, atSummer.temp > 22);
check('autumn leaves are falling', atAutumn.leafDrop, atAutumn.leafDrop > 0.4);
check('winter snow covers the garden', atWinter.snow, atWinter.snow > 0.5);
check('winter lake freezes over', atWinter.ice, atWinter.ice > 0.5);
check('winter canopy is bare', atWinter.canopy, atWinter.canopy < 0.35);
check('winter is cold', atWinter.temp, atWinter.temp < 5);
check('boat sails in summer', atSummer.boat, atSummer.boat === 'sailing');
check('boat is home on a frozen lake', atWinter.boat, atWinter.boat !== 'sailing');
check('boat is home on a frozen lake', atWinter.boat, atWinter.boat !== 'sailing');

// --- no resource leaks -------------------------------------------------
const geo0 = series[0].geo, geo1 = series[series.length - 1].geo;
const tex0 = series[0].tex, tex1 = series[series.length - 1].tex;
check('geometry count stable (' + geo0 + ' -> ' + geo1 + ')', geo1, geo1 <= geo0 + 2);
check('texture count stable (' + tex0 + ' -> ' + tex1 + ')', tex1, tex1 <= tex0 + 2);

// --- boundary + boat behaviour at a frozen moment ----------------------
const fz = atWinter, sm = atSummer;

// --- everything stays inside the diorama -------------------------------
const bounds = await js(`(function(){
  var bad = [];
  var lim = 13.05;
  var names = ['people','buildings','vegetation','deskprops','knobs','boat','birds','butterflies','fireflies','clouds'];
  function test(obj, name){
    if (!obj) return;
    obj.traverse(function(o){
      if (!o.position) return;
      var p = o.getWorldPosition(new __x.THREE.Vector3());
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) { bad.push(name+' NaN'); return; }
      // the desk and its props legitimately sit outside the sand tray
      if (name === 'deskprops' || name === 'knobs') return;
      if (Math.abs(p.x) > lim || Math.abs(p.z) > lim)
        bad.push(name + ' out at ' + p.x.toFixed(2) + ',' + p.z.toFixed(2));
    });
  }
  for (var i=0;i<names.length;i++)
    test(__x.scene.getObjectByName(names[i]), names[i]);
  return JSON.stringify(bad.slice(0, 12));
})()`);
check('no creature or prop escapes the tray: ' + bounds, bounds, bounds === '[]');

// --- creatures are all above the ground --------------------------------
const below = await js(`(function(){
  var bad = [];
  for (var i=0;i<__x.PEOPLE.length;i++){
    var q = __x.PEOPLE[i].parts.group.getWorldPosition(new __x.THREE.Vector3());
    if (q.y < -1.0) bad.push('person ' + i + ' below ground at y=' + q.y.toFixed(2));
  }
  var b = __x.BOAT.group.getWorldPosition(new __x.THREE.Vector3());
  if (b.y < -0.60) bad.push('boat submerged at y=' + b.y.toFixed(2));
  return JSON.stringify(bad);
})()`);
check('people and boat stay above the surface: ' + below, below, below === '[]');

const errs = await js('JSON.stringify(window.__err||[])');
check('no runtime errors during the year: ' + errs, errs, errs === '[]');

const failed = results.filter(r => !r.ok).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed');
ws.close(); child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
process.exit(failed ? 1 : 0);
