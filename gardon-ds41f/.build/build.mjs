// Assembles the single-file HTML deliverable from .build/ parts.
// Usage: node .build/build.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const shellHead = readFileSync(join(here, 'shell_head.html'), 'utf8');
const shellMid = readFileSync(join(here, 'shell_mid.html'), 'utf8');
const shellTail = readFileSync(join(here, 'shell_tail.html'), 'utf8');

// three.js r160 module build, inlined verbatim. A local scratch copy wins;
// otherwise borrow r160 from a sibling demo so the file can be rebuilt offline.
const threeCandidates = [
  join(here, '..', '.tmp-three', 'package', 'build', 'three.module.js'),
  join(here, '..', 'node_modules', 'three', 'build', 'three.module.js'),
  join(root, '..', 'beijing-temple-of-heaven-gpt6astra', 'node_modules', 'three', 'build', 'three.module.js'),
  join(root, '..', 'lego-gpt6astra', 'node_modules', 'three', 'build', 'three.module.js')
];
const threePath = threeCandidates.find(p => existsSync(p));
if (!threePath) {
  console.error('three.module.js not found. Run:  cd .tmp-three && npm pack three@0.160.1 && tar -xzf three-0.160.1.tgz package/build/three.module.js');
  process.exit(1);
}
const threeSrc = readFileSync(threePath, 'utf8');
const rev = (threeSrc.match(/REVISION\s*=\s*['"](\d+)['"]/) || [])[1] || '?';
console.log('three.js r' + rev + ' from ' + threePath);
if (rev !== '160') console.warn('warning: the deliverable is specified as r160, found r' + rev);

const parts = readdirSync(here)
  .filter(f => /^part\d+_.*\.js$/.test(f))
  .sort();

let app = '';
for (const f of parts) {
  app += '\n/* ================= ' + f + ' ================= */\n';
  app += readFileSync(join(here, f), 'utf8');
}

if (app.includes('</scr' + 'ipt')) throw new Error('app source contains a script end tag');

const out = shellHead + threeSrc + shellMid + app + shellTail;
const target = join(root, 'index.html');
writeFileSync(target, out, 'utf8');
console.log('wrote ' + target + '  (' + (out.length / 1024).toFixed(0) + ' KB)');
