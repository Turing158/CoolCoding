const fs = require('fs');
const path = require('path');
const root = path.dirname(__dirname);
let three = fs.readFileSync(path.join(__dirname, 'three-r160.min.js'), 'utf8');
// r160's legacy UMD build is intentionally used for double-clickable file:// use.
// Keep the distributed source and its license, omitting only its startup notice.
three = three.replace(/^console\.warn\([^\n]+\),\s*/, '!');
const license = `/* Three.js r160 (0.160.0) — MIT License
Copyright © 2010-2023 Three.js authors
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions: The above copyright notice and this
permission notice shall be included in all copies or substantial portions of
the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE. */\n`;
const shell = fs.readFileSync(path.join(__dirname, 'shell.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'garden.js'), 'utf8');
new Function(app);
new Function(three);
const html = shell.replace('/* THREE_BUNDLE */', () => license + three.replace(/<\/script/gi, '<\\/script'))
  .replace('/* GARDEN_APPLICATION */', () => app.replace(/<\/script/gi, '<\\/script'));
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(JSON.stringify({file: 'index.html', bytes: Buffer.byteLength(html), threeRevision: /REVISION="160"|const t="160"|160/.test(three), scripts: (html.match(/<script>/g)||[]).length, externalScripts: (html.match(/<script[^>]+src=/g)||[]).length, externalStylesheets: (html.match(/<link[^>]+rel="stylesheet"/g)||[]).length}, null, 2));
