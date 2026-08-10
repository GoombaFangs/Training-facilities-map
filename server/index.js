/**
 * Local server for closed-network deployment.
 * Serves the built app (dist/) and persists shared data as JSON files.
 *
 * Usage:
 *   npm run build
 *   npm run start
 *
 * Environment:
 *   PORT  — listen port (default 3000)
 *   HOST  — bind address (default 0.0.0.0 for LAN access)
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SEED_FACILITIES = path.join(ROOT_DIR, 'public', 'data', 'data.geojson');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/** @type {Record<string, string>} */
const DATA_FILES = {
  facilities: 'facilities.geojson',
  managers: 'managers.json',
  'option-catalogs': 'option-catalogs.json',
  'map-region-layout': 'map-region-layout.json',
  'manager-reports': 'manager-reports.json',
};

/** @type {Map<string, { updatedAt: number, data: unknown }>} */
const memory = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * @param {string} filePath
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * @param {string} key
 */
function dataFilePath(key) {
  const filename = DATA_FILES[key];
  if (!filename) return null;
  return path.join(DATA_DIR, filename);
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * @param {string} key
 */
async function loadDataKey(key) {
  const cached = memory.get(key);
  if (cached) return cached;

  const filePath = dataFilePath(key);
  if (!filePath) return null;

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    const stat = await fs.stat(filePath);
    const entry = { data, updatedAt: stat.mtimeMs };
    memory.set(key, entry);
    return entry;
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
      if (key === 'facilities') {
        return seedFacilities();
      }
      const empty = defaultDataForKey(key);
      const entry = { data: empty, updatedAt: Date.now() };
      await persistDataKey(key, entry);
      return entry;
    }
    throw error;
  }
}

/**
 * @param {string} key
 */
function defaultDataForKey(key) {
  switch (key) {
    case 'managers':
    case 'manager-reports':
      return [];
    case 'map-region-layout':
      return { northFromLat: 32.5, southBelowLat: 31.5 };
    case 'option-catalogs':
      return null;
    default:
      return null;
  }
}

async function seedFacilities() {
  try {
    const raw = await fs.readFile(SEED_FACILITIES, 'utf8');
    const data = JSON.parse(raw);
    const entry = { data, updatedAt: Date.now() };
    await persistDataKey('facilities', entry);
    console.log('Seeded facilities from public/data/data.geojson');
    return entry;
  } catch (error) {
    console.warn('Could not seed facilities:', error.message);
    const entry = {
      data: { type: 'FeatureCollection', features: [] },
      updatedAt: Date.now(),
    };
    await persistDataKey('facilities', entry);
    return entry;
  }
}

/**
 * @param {string} key
 * @param {{ data: unknown, updatedAt: number }} entry
 */
async function persistDataKey(key, entry) {
  const filePath = dataFilePath(key);
  if (!filePath) throw new Error(`Unknown data key: ${key}`);

  const tmpPath = `${filePath}.tmp`;
  const payload = JSON.stringify(entry.data, null, 2);
  await fs.writeFile(tmpPath, payload, 'utf8');
  await fs.rename(tmpPath, filePath);
  memory.set(key, entry);
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} pathname
 */
async function handleApi(req, res, pathname) {
  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, time: Date.now() });
    return;
  }

  if (pathname === '/api/meta') {
    /** @type {Record<string, { updatedAt: number }>} */
    const meta = {};
    for (const key of Object.keys(DATA_FILES)) {
      const entry = await loadDataKey(key);
      meta[key] = { updatedAt: entry?.updatedAt ?? 0 };
    }
    sendJson(res, 200, meta);
    return;
  }

  const match = pathname.match(/^\/api\/data\/([a-z-]+)$/);
  if (!match) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const key = match[1];
  if (!DATA_FILES[key]) {
    sendJson(res, 404, { error: 'Unknown data key' });
    return;
  }

  if (req.method === 'GET') {
    const entry = await loadDataKey(key);
    sendJson(res, 200, {
      data: entry?.data ?? null,
      updatedAt: entry?.updatedAt ?? 0,
    });
    return;
  }

  if (req.method === 'PUT') {
    let parsed;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
      sendJson(res, 400, { error: 'Body must include { data: ... }' });
      return;
    }

    const entry = {
      data: parsed.data,
      updatedAt: Date.now(),
    };
    await persistDataKey(key, entry);
    sendJson(res, 200, { ok: true, updatedAt: entry.updatedAt });
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} urlPath
 */
async function serveStatic(req, res, urlPath) {
  let relative = decodeURIComponent(urlPath.split('?')[0]);
  if (relative === '/') relative = '/index.html';

  const safePath = path.normalize(relative).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(DIST_DIR, safePath);

  if (!filePath.startsWith(DIST_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await serveStatic(req, res, `${urlPath.replace(/\/$/, '')}/index.html`);
      return;
    }

    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': getMimeType(filePath),
      'Content-Length': content.length,
      'Cache-Control': urlPath.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
    });
    res.end(content);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
      try {
        const fallback = await fs.readFile(path.join(DIST_DIR, 'index.html'));
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': fallback.length,
          'Cache-Control': 'no-cache',
        });
        res.end(fallback);
      } catch {
        sendJson(res, 404, { error: 'Not found' });
      }
      return;
    }
    console.error('Static file error:', error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (error) {
    console.error('Request error:', error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

async function start() {
  await ensureDataDir();

  try {
    await fs.access(DIST_DIR);
  } catch {
    console.error(
      'Missing dist/ folder. Run "npm run build" first, then "npm run start".',
    );
    process.exit(1);
  }

  for (const key of Object.keys(DATA_FILES)) {
    await loadDataKey(key);
  }

  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  Training Facilities Map — local server');
    console.log(`  Listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`  LAN clients: http://<server-ip>:${PORT}`);
    console.log(`  Data folder: ${DATA_DIR}`);
    console.log('');
  });
}

start();
