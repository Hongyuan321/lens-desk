'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = {'/':'index.html','/index.html':'index.html','/app.js':'app.js','/workflow.js':'workflow.js','/style.css':'style.css','/docs/fieldwork.html':'docs/fieldwork.html'};
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server = http.createServer((req,res) => {
  const route = req.url.split('?')[0];
  if (req.method !== 'GET' || !Object.hasOwn(files,route)) {
    res.writeHead(404).end(); return;
  }
  const file = files[route];
  fs.readFile(path.join(__dirname,file),(error,bytes) => {
    if (error) { res.writeHead(500).end(); return; }
    res.writeHead(200,{'Content-Type':types[path.extname(file)]+'; charset=utf-8'}).end(bytes);
  });
});
server.on('error',error => { console.error('启动失败：'+error.message); process.exitCode=1; });
server.listen(4173,'127.0.0.1',() => console.log('映务台已启动：http://127.0.0.1:4173  （按 Ctrl+C 结束）'));
