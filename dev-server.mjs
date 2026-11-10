import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import worker from './src/worker.ts';
import { AGENT_READY_HEADERS, wantsMarkdown } from './src/protocols.ts';

const gzipAsync = promisify(zlib.gzip);
const readFileAsync = promisify(fs.readFile);

const PORT = Number(process.env.PORT || 8787);
const MAX_BODY_BYTES = 262_144; // 256 KB
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = fs.existsSync(path.resolve(__dirname, 'dist'))
  ? path.resolve(__dirname, 'dist')
  : path.resolve(__dirname, '../dist');
const DIST_REAL = fs.existsSync(DIST_DIR) ? fs.realpathSync(DIST_DIR) : DIST_DIR;

const TRUSTED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  'h3manth.com',
  'www.h3manth.com',
  'agent-wire.workers.dev',
  ...(process.env.PUBLIC_HOST ? [process.env.PUBLIC_HOST.toLowerCase()] : [])
]);

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

const COMPRESSIBLE_EXTS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.md', '.txt', '.svg']);

function resolveSafeOrigin(req, isLoopbackProxy) {
  const forwardedHost = isLoopbackProxy ? String(req.headers['x-forwarded-host'] || '').split(',')[0].trim() : '';
  const rawHost = (forwardedHost || String(req.headers.host || '')).trim().toLowerCase();
  const hostOnly = rawHost.startsWith('[')
    ? rawHost.slice(0, rawHost.indexOf(']') + 1)
    : rawHost.split(':')[0];

  if (hostOnly && TRUSTED_HOSTNAMES.has(hostOnly)) {
    const forwardedProto = isLoopbackProxy ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() : '';
    const isProdDomain = hostOnly === 'h3manth.com' || hostOnly === 'www.h3manth.com' || hostOnly === 'agent-wire.workers.dev';
    const scheme = forwardedProto === 'https' || isProdDomain ? 'https' : 'http';
    return `${scheme}://${rawHost}`;
  }
  return `http://localhost:${PORT}`;
}

function acceptsGzip(acceptEncoding = '') {
  if (!acceptEncoding || !acceptEncoding.toLowerCase().includes('gzip')) return false;
  for (const part of acceptEncoding.split(',')) {
    const [enc, ...params] = part.trim().split(';').map(s => s.trim());
    if (enc.toLowerCase() === 'gzip' || enc === '*') {
      let q = 1.0;
      for (const p of params) {
        if (p.toLowerCase().startsWith('q=')) {
          const parsed = Number.parseFloat(p.slice(2));
          if (!Number.isNaN(parsed)) q = parsed;
        }
      }
      if (enc.toLowerCase() === 'gzip') return q > 0;
    }
  }
  return false;
}

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
    pathname === '/healthz' ||
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
  if ((pathname === '/' || pathname === '/index.html') && wantsMarkdown(acceptHeader)) {
    return true;
  }
  return false;
}

function resolveContainedAssetPath(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const candidate = path.resolve(DIST_DIR, '.' + path.posix.normalize('/' + decoded));
  const rel = path.relative(DIST_DIR, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  if (!fs.existsSync(candidate)) {
    return null;
  }
  try {
    const real = fs.realpathSync(candidate);
    if (real !== DIST_REAL && !real.startsWith(DIST_REAL + path.sep)) {
      return null;
    }
    if (fs.statSync(real).isDirectory()) {
      return null;
    }
    return real;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const remoteAddr = req.socket?.remoteAddress || '127.0.0.1';
    const isLoopbackProxy =
      remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
    const safeOrigin = resolveSafeOrigin(req, isLoopbackProxy);
    const parsedUrl = new URL(req.url || '/', safeOrigin);
    const pathname = stripBasePath(parsedUrl.pathname);
    parsedUrl.pathname = pathname;
    const acceptHeader = String(req.headers.accept || '');
    const clientAcceptsGzip = acceptsGzip(String(req.headers['accept-encoding'] || ''));

    // 1. If API, healthz, MCP, OpenAI v1, .well-known, or Markdown negotiation route, delegate to worker.fetch
    if (shouldDelegateToWorker(pathname, acceptHeader)) {
      const declaredLen = Number(req.headers['content-length'] || '0');
      if (Number.isFinite(declaredLen) && declaredLen > MAX_BODY_BYTES) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Payload too large (maximum 256 KB).' }));
        return;
      }

      const buffers = [];
      let totalBytes = 0;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        for await (const chunk of req) {
          totalBytes += chunk.length;
          if (totalBytes > MAX_BODY_BYTES) {
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Payload too large (maximum 256 KB).' }));
            req.destroy();
            return;
          }
          buffers.push(chunk);
        }
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
      if (!isLoopbackProxy) {
        webHeaders.delete('cf-connecting-ip');
        webHeaders.set('x-trusted-client-ip', remoteAddr.replace(/^::ffff:/, ''));
      }

      const webRequest = new Request(parsedUrl.toString(), {
        method: req.method,
        headers: webHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined
      });

      const env = {
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
        ENVIRONMENT: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
        BASE_PATH: process.env.BASE_PATH || '',
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
        FEATURE_FLAGS: process.env.FEATURE_FLAGS || '',
        ALLOW_DEMO_KEY: process.env.ALLOW_DEMO_KEY || '',
        ADMIN_SECRET: process.env.ADMIN_SECRET || '',
        WEB_BOT_AUTH_PUBLIC_JWK: process.env.WEB_BOT_AUTH_PUBLIC_JWK || ''
      };

      const webResponse = await worker.fetch(webRequest, env);

      res.statusCode = webResponse.status;
      webResponse.headers.forEach((v, k) => {
        res.setHeader(k, v);
      });

      if (req.method === 'HEAD') {
        await webResponse.body?.cancel().catch(() => {});
        res.end();
        return;
      }

      const contentType = String(webResponse.headers.get('content-type') || '').toLowerCase();

      // Stream SSE responses chunk-by-chunk without buffering
      if (contentType.includes('text/event-stream') && webResponse.body) {
        res.setHeader('X-Accel-Buffering', 'no');
        for await (const chunk of webResponse.body) {
          if (res.destroyed) break;
          res.write(Buffer.from(chunk));
        }
        if (!res.writableEnded) res.end();
        return;
      }

      const rawBuf = Buffer.from(await webResponse.arrayBuffer());
      if (
        clientAcceptsGzip &&
        !webResponse.headers.get('content-encoding') &&
        rawBuf.length > 512 &&
        (contentType.includes('json') || contentType.includes('text/') || contentType.includes('markdown'))
      ) {
        const compressed = await gzipAsync(rawBuf);
        res.removeHeader('content-length');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept, Accept-Encoding, Origin');
        res.end(compressed);
        return;
      }

      res.end(rawBuf);
      return;
    }

    // 2. Serve static files from ./dist with universal Agent-Ready & Security headers (strict containment guard)
    const isHashedAsset = pathname.startsWith('/assets/');
    let filePath = pathname === '/' ? null : resolveContainedAssetPath(pathname);

    if (!filePath) {
      if (isHashedAsset) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        for (const [k, v] of Object.entries(AGENT_READY_HEADERS)) {
          res.setHeader(k, v);
        }
        res.end('Asset Not Found');
        return;
      }
      const fallbackHtml = path.join(DIST_REAL, 'index.html');
      filePath = fs.existsSync(fallbackHtml) ? fallbackHtml : null;
    }

    if (filePath) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      if (isHashedAsset) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (['.woff2', '.png', '.gif', '.jpg', '.svg', '.ico'].includes(ext)) {
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
      if (clientAcceptsGzip && COMPRESSIBLE_EXTS.has(ext)) {
        const raw = await readFileAsync(filePath);
        if (raw.length > 256) {
          const compressed = await gzipAsync(raw);
          res.removeHeader('content-length');
          res.setHeader('Content-Encoding', 'gzip');
          res.end(compressed);
          return;
        }
      }
      pipeline(fs.createReadStream(filePath), res, err => {
        if (err && !res.headersSent) {
          res.statusCode = 500;
          res.end();
        }
      });
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not Found');
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'server.unhandled_exception',
        reason: err && err.message ? String(err.message).slice(0, 300) : 'Unknown error'
      })
    );
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }));
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

server.listen(PORT, () => {
  process.stdout.write(`AgentWire is live at http://localhost:${PORT}\n`);
});
