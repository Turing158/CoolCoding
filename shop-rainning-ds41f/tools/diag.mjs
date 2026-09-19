// diag.mjs —— 无头 Edge 加载页面并 dump DOM，读取 #diag 里的诊断 JSON
import { spawn } from 'node:child_process';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'http://127.0.0.1:4173/?test=1';
const wait = Number(process.argv[3] || 8000);

function run(args) {
  return new Promise((res) => {
    const p = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => res({ code, out, err }));
  });
}

const r = await run([
  '--headless=new',
  '--disable-gpu-sandbox',
  '--no-sandbox',
  '--enable-unsafe-swiftshader',
  '--virtual-time-budget=' + wait,
  '--dump-dom',
  url,
]);

const dom = r.out;
const m = dom.match(/<pre id="diag"[^>]*>([\s\S]*?)<\/pre>/);
if (m) {
  console.log('DIAG:', m[1]);
} else {
  const t = dom.match(/<title>([\s\S]*?)<\/title>/);
  console.log('NO DIAG ELEMENT. title=', t ? t[1] : '(none)');
  console.log('dom length', dom.length);
}

const errLines = r.err
  .split('\n')
  .filter((l) => /error|Error|Uncaught|WARNING.*shader|THREE/i.test(l))
  .filter((l) => !/fallback_task_provider|QQBrowser|GroupMarkerNotSet|voice_transcription|registration_protocol|SharedImageManager|gpu_channel|CommandBufferProxy/i.test(l));
console.log('--- stderr (filtered) ---');
console.log(errLines.slice(0, 40).join('\n'));