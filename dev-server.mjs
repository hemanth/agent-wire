import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './src/worker.ts';
import { AGENT_READY_HEADERS } from './src/protocols.ts';

const PORT = process.env.PORT || 8787;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = fs.existsSync(path.resolve(__dirname, 'dist'))
  ? path.resolve(__dirname, 'dist')
  : path.resolve(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function stripBasePath(pathname) {
  if (pathname === '/ai/agent-wire' || pathname === '/ai/agent-wire/') {
    return '/';
  }
  if (pathname.startsWith('/ai/agent-wire/')) {
    return pathname.slice('/ai/agent-wire'.length);
  }
  return pathname;
}

function shouldDelegateToWorker(pathname, acceptHeader = '') {
  if (
    pathname.startsWith('/api/') ||
    pathname === '/mcp' ||
    pathname.startsWith('/mcp/') ||
    pathname.startsWith('/v1/') ||
    pathname.startsWith('/.well-known/') ||
    pathname === '/llms.txt' ||
    pathname === '/llms-full.txt' ||
    pathname === '/auth.md' ||
    pathname === '/robots.txt' ||
    pathname === '/openapi.json' ||
    pathname === '/index.md'
  ) {
    return true;
  }
  if ((pathname === '/' || pathname === '/index.html') && acceptHeader.toLowerCase().includes('text/markdown')) {
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:' + PORT}`);
    const pathname = stripBasePath(parsedUrl.pathname);
    parsedUrl.pathname = pathname;
    const acceptHeader = String(req.headers.accept || '');

    // 1. If API, MCP, OpenAI v1, .well-known, or Markdown negotiation route, delegate to worker.fetch
    if (shouldDelegateToWorker(pathname, acceptHeader)) {
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

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const responseBody = await webResponse.arrayBuffer();
      res.end(Buffer.from(responseBody));
      return;
    }

    // 2. Serve static files from ./dist with universal Agent-Ready Link & Content-Signal headers (with path-traversal guard)
    const normalizedRel = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^\/+/, '');
    let filePath = path.resolve(DIST_DIR, normalizedRel);
    if (!filePath.startsWith(DIST_DIR) || pathname === '/' || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      if (['.woff2', '.png', '.gif', '.jpg', '.svg', '.ico'].includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
      for (const [k, v] of Object.entries(AGENT_READY_HEADERS)) {
        res.setHeader(k, v);
      }
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
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
