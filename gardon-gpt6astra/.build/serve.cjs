const http = require('http');
const fs = require('fs');
const path = require('path');
const base = path.dirname(__dirname);
http.createServer((req,res)=>{
  const url = new URL(req.url,'http://127.0.0.1:8765');
  if(url.pathname==='/' || url.pathname==='/index.html'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    fs.createReadStream(path.join(base,'index.html')).pipe(res);
  }else if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();}
  else {res.writeHead(404);res.end('Not found');}
}).listen(8765,'127.0.0.1',()=>console.log('Garden preview: http://127.0.0.1:8765/?test=1&fps=12'));
