const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const html = path.resolve(__dirname, '../index.html');
const server = http.createServer((req, res) => {
 const route = new URL(req.url, 'http://127.0.0.1').pathname;
 if (route !== '/' && route !== '/index.html') { res.writeHead(404); res.end(); return; }
 res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 fs.createReadStream(html).pipe(res);
});
server.listen(8766, '127.0.0.1', () => console.log('Local single-page preview: http://127.0.0.1:8766'));
