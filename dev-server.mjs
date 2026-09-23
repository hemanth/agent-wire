import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import worker from './src/worker.ts';

const PORT = process.env.PORT || 8787;
const DIST_DIR = path.resolve('dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:' + PORT}`);
    const pathname = parsedUrl.pathname;

    // 1. If API route, delegate to worker.fetch
    if (pathname.startsWith('/api/')) {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const body = buffers.length > 0 ? Buffer.concat(buffers) : null;

      const webHeaders = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => webHeaders.append(key, v));
          } else {
            webHeaders.set(key, value);
          }
        }
      }

      const webRequest = new Request(parsedUrl.toString(), {
        method: req.method,
        headers: webHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
      });

      const env = {
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || ''
      };

      const webResponse = await worker.fetch(webRequest, env);

      res.statusCode = webResponse.status;
      webResponse.headers.forEach((v, k) => {
        res.setHeader(k, v);
      });

      const responseBody = await webResponse.arrayBuffer();
      res.end(Buffer.from(responseBody));
      return;
    }

    // 2. Serve static files from ./dist
    let filePath = path.join(DIST_DIR, pathname);
    if (pathname === '/' || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  } catch (err) {
    console.error('Local server error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`AgentWire is live at http://localhost:${PORT}`);
});
