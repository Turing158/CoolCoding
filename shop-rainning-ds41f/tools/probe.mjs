// probe.mjs —— 快速在指定 URL 上执行一段 JS 并打印结果
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2];
const expr = process.argv[3] || '1';
const wait = Number(process.argv[4] || 9000);
const PORT = 9500 + Math.floor(Math.random() * 400);

// 浏览器 profile 必须放在系统临时目录：放在项目里会被 Vite 的文件监听扫到而崩溃
const profile = join(tmpdir(), `dsh-edge-${PORT}`);

const edge = spawn(EDGE, [
  '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + profile,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
try {
  let v;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { v = await r.json(); break; } } catch {}
    await sleep(250);
  }
  ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Page.navigate', { url }, sessionId);
  await sleep(wait);
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
  console.log(JSON.stringify(r.result, null, 2));
} catch (e) {
  console.log('ERR', String(e));
} finally {
  try { ws && ws.close(); } catch {}
  edge.kill();
  process.exit(0);
}