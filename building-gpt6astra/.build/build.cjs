const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const vendor = fs.readFileSync(path.join(__dirname, 'three.r160.min.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'scene.js'), 'utf8');
new Function(app);
new Function(vendor);
const protect = s => s.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8')
 .replace('<!-- THREE_VENDOR -->', () => '<!-- Three.js r160. Source: jsDelivr npm/three@0.160.0/build/three.min.js. MIT license retained below. Inlined for offline use. -->\n<script>\n' + protect(vendor) + '\n</script>')
 .replace('<!-- SITE_APP -->', () => '<script>\n' + protect(app) + '\n</script>');
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(match[1]);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('Created index.html · ' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KiB · Three.js r160 embedded');
