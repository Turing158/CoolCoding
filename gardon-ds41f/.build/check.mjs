// Syntax-checks the generated single-file HTML without running it.
// Usage: node .build/check.mjs
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];

let bad = 0, n = 0;
scripts.forEach((m, i) => {
  const attrs = m[1];
  if (/text\/plain/.test(attrs)) { console.log(`#${i} three.js source: ${m[2].length} chars (opaque, skipped)`); return; }
  if (!/type="module"/.test(attrs)) { console.log(`#${i} skipped`); return; }
  const tmp = join(here, '.check' + i + '.mjs');
  writeFileSync(tmp, m[2], 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log(`#${i} module OK (${m[2].length} chars)`);
  } catch (e) {
    bad++;
    const msg = (e.stderr || e.stdout || '').toString().trim();
    console.log(`#${i} SYNTAX ERROR:\n${msg}`);
  }
  unlinkSync(tmp);
  n++;
});
console.log(bad ? `FAILED (${bad} of ${n})` : `PASSED (${n} module scripts)`);
process.exit(bad ? 1 : 0);