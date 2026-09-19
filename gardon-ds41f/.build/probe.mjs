// Real-time verification harness driven over the Chrome DevTools Protocol.
// Uses Node's built-in fetch + WebSocket, so it needs no external packages.
//
//   node .build/probe.mjs <out.png> <query> [waitMs]
//
// Prints console errors and the page's diagnostic title, then screenshots.
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = process.argv[2] || 'probe.png';
const query = process.argv[3] || '';
const waitMs = parseInt(process.argv[4] || '6000', 10);

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
];
const exe = BROWSERS.find(p => p && existsSync(p));
if (!exe) { console.error('no chromium browser found'); process.exit(2); }

const profile = mkdtempSync(join(tmpdir(), 'dsh-probe-'));
const port = 9200 + Math.floor(Math.random() * 500);
const pageUrl = pathToFileURL(join(root, 'index.html')).href + query;

const child = spawn(exe, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--mute-audio',
  '--window-size=1400,880',
  '--use-angle=default',
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await r.json();
      const t = list.find(x => x.type === 'page');
      if (t && t.webSocketDebuggerUrl) return t;
    } catch (e) { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('devtools target never appeared');
}

let id = 0;
const pending = new Map();
const logs = [];

function send(ws, method, params) {
  const msgId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params: params || {} }));
  });
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = (m.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' ');
    if (m.params.type === 'error' || m.params.type === 'warning') logs.push(m.params.type + ': ' + text.slice(0, 600));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    logs.push('EXCEPTION: ' + (d.exception && d.exception.description ? d.exception.description : d.text));
  }
};

await send(ws, 'Runtime.enable');
await send(ws, 'Page.enable');
await send(ws, 'Log.enable');

const start = Date.now();
await send(ws, 'Page.navigate', { url: pageUrl });
await sleep(waitMs);                                  // real time, no virtual clock

const evalJs = async (expr) => {
  const r = await send(ws, 'Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true
  });
  if (r.exceptionDetails) return 'EVAL ERROR: ' + r.exceptionDetails.text;
  return r.result.value;
};

const title = await evalJs('document.title');
const errs = await evalJs('JSON.stringify(window.__err || [])');
const frames = await evalJs('window.__frames || 0');
const diag = await evalJs('(document.getElementById("diag")||{}).textContent || ""');
const bench = await evalJs('window.__bench ? JSON.stringify(window.__bench(150)) : "no-bench"');
const sweep = await evalJs('window.__sweep ? JSON.stringify(window.__sweep(3000)) : "no-sweep"');
const realFps = await evalJs('window.__lastFps || 0');
const elapsed = Date.now() - start;

const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' });
writeFileSync(join(root, out), Buffer.from(shot.data, 'base64'));

console.log('title     : ' + title);
console.log('pageErrors: ' + errs);
console.log('frames    : ' + frames + ' rAF ticks in ' + elapsed + ' ms  => ' +
  (frames / (elapsed / 1000)).toFixed(1) + ' fps average');
console.log('realFps   : ' + realFps);
console.log('bench     : ' + bench);
console.log('diag      : ' + String(diag).replace(/\s+/g, ' ').slice(0, 200));
if (sweep && sweep !== 'no-sweep') {
  const o = JSON.parse(sweep);
  const parts = Object.keys(o).filter(k => k[0] !== '_')
    .sort((a, b) => o[b] - o[a])
    .map(k => k + '=' + o[k]);
  console.log('continuity: max step over ' + o._steps + ' samples -> overall ' + o._maxOverall);
  console.log('  worst   : ' + parts.slice(0, 8).join('  '));
}
if (logs.length) console.log('console   :\n  ' + logs.slice(0, 12).join('\n  '));
console.log('screenshot: ' + join(root, out));

ws.close();
child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
process.exit(0);
