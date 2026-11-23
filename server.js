// Zero-dependency local server, same routes as the Vercel deploy.
// Usage: node server.js   ->  http://localhost:3000/demo

const http = require('http');
const fs = require('fs');
const path = require('path');

const chatHandler = require('./api/chat');
const whatsappHandler = require('./api/whatsapp');

const PORT = process.env.PORT || 3000;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

function toReqRes(req, res) {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const q = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (obj) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
    };
    res.send = (s) => res.end(s);
    req.body = body;
    req.query = q;
    const handler = req.url.startsWith('/api/whatsapp') ? whatsappHandler : chatHandler;
    handler(req, res);
  });
}

http
  .createServer((req, res) => {
    if (req.url.startsWith('/api/')) return toReqRes(req, res);
    let p = req.url.split('?')[0];
    if (p === '/' || p === '/demo') p = '/index.html';
    const file = path.join(__dirname, 'public', p);
    fs.readFile(file, (err, data) => {
      if (err) {
        res.statusCode = 404;
        return res.end('not found');
      }
      res.setHeader('Content-Type', MIME[path.extname(file)] || 'text/plain');
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`Demo running: http://localhost:${PORT}/demo`));
