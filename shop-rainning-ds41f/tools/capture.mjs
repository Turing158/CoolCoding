// capture.mjs —— 用无头 Edge 截图，检查渲染结果与控制台错误
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL_BASE = process.env.URL_BASE || 'http://127.0.0.1:4173/';
const OUT = resolve(process.env.OUT_DIR || 'docs/shots');
const WIDTH = Number(process.env.W || 1280);
const HEIGHT = Number(process.env.H || 800);
const WAIT = Number(process.env.WAIT || 6000);

// 用分号分隔多个目标，因为目标本身可能含有逗号（如 cam=1,2,3）
const targets = (process.env.TARGETS || 'hero').split(';').map((s) => s.trim()).filter(Boolean);
/** 允许 TARGETS 里写成 "name::cam=x,y,z&look=x,y,z" 的形式做自由取景 */
function parseTarget(t) {
  const [name, q] = t.split('::');
  return { name, query: q ? '&' + q : '' };
}

mkdirSync(OUT, { recursive: true });

function runEdge(args) {
  return new Promise((res) => {
    const p = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => res({ code, out, err }));
  });
}

const results = [];
for (const raw of targets) {
  const { name, query } = parseTarget(raw);
  // 注意：cam/look 等自定义参数不用 view=，否则会被默认视角覆盖
  const viewPart = name.startsWith('@') ? '' : `view=${encodeURIComponent(name)}&`;
  const cleanName = name.startsWith('@') ? name.slice(1) : name;
  const url = `${URL_BASE}?still=1&${viewPart}${query.replace(/^&/, '')}`;
  const file = resolve(OUT, `${cleanName.replace(/[^\w.-]/g, '_')}.png`);
  const args = [
    '--headless=new',
    '--disable-gpu-sandbox',
    '--no-sandbox',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--enable-unsafe-swiftshader',
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${file}`,
    `--virtual-time-budget=${WAIT}`,
    url,
  ];
  const r = await runEdge(args);
  const fatal = /Failed to write file|FATAL/i.test(r.err);
  results.push({ target: cleanName, file, code: r.code, fatal, stderrTail: r.err.split('\n').slice(-3).join(' | ') });
}

console.log(JSON.stringify(results, null, 2));