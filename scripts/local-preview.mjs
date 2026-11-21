import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { compareContracts } from '../schema-check.mjs';
import { errorPageHeaders, renderErrorPage, siteSecurityHeaders } from '../error-pages.mjs';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const port = Number(process.env.PORTFOLIO_PORT || 4173);
const hosts = new Set(['127.0.0.1:' + port, 'localhost:' + port]);
const dataDirectory = resolve(process.env.PORTFOLIO_DATA_DIR || join(root, '.portfolio-data'));
const sessionLifetime = 7 * 24 * 60 * 60;
const deriveKey = promisify(scrypt);
const cookieName = 'swastika_studio';

mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(join(dataDirectory, 'portfolio.sqlite'));
database.exec([
  'PRAGMA journal_mode = WAL;',
  'PRAGMA busy_timeout = 3000;',
  'CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK (id = 1), salt TEXT NOT NULL, digest TEXT NOT NULL);',
  'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);',
  'CREATE TABLE IF NOT EXISTS posts (',
  '  id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, updated_at TEXT NOT NULL,',
  '  published_title TEXT, published_body TEXT, published_at TEXT, revision INTEGER NOT NULL',
  ');',
].join('\n'));

const publicFiles = new Set([
  '/index.html', '/about.html', '/blog.html', '/post.html', '/studio.html',
  '/styles.css', '/notebook.css', '/notebook.js', '/blog.js', '/studio.js', '/journal-text.js',
  '/about-desk.css', '/about-desk.js',
  '/error.css', '/register-offline.js', '/portfolio-worker.js', '/error-pages.mjs',
  '/projects/orion.html', '/projects/enola.html', '/projects/enola-sample.js',
  '/projects/civic-reporting.html', '/projects/import-check.html', '/projects/import-check.js',
]);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};
const cookieOptions = '; Path=/; HttpOnly; SameSite=Strict';
let failures = 0;
let lockUntil = 0;

function error(status, message) {
  throw Object.assign(new Error(message), { status });
}

function json(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function isPageRequest(request, pathname) {
  if (isApiPath(pathname)) return false;
  const mode = request.headers['sec-fetch-mode'];
  if (mode) return mode === 'navigate';
  return request.headers.accept?.includes('text/html') ||
    (!pathname.startsWith('/assets/') && (!extname(pathname) || extname(pathname) === '.html'));
}

async function readJson(request) {
  if (request.headers.origin !== 'http://' + request.headers.host) error(403, 'Open the local portfolio to make this request.');
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') error(415, 'Send a JSON request.');
  const maxBytes = 160 * 1024;
  if (Number(request.headers['content-length']) > maxBytes) error(413, 'This request is too large.');
  const buffers = [];
  let received = 0;
  for await (const chunk of request) {
    received += chunk.length;
    if (received > maxBytes) error(413, 'This request is too large.');
    buffers.push(chunk);
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(buffers).toString('utf8'));
  } catch {
    error(400, 'Check the JSON and try again.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) error(400, 'Send a JSON object.');
  return payload;
}

function sessionHash(request) {
  const token = request.headers.cookie?.match(/(?:^|;\s*)swastika_studio=([a-f0-9]{64})(?:;|$)/)?.[1];
  return token ? createHash('sha256').update(token).digest('hex') : null;
}

function isSignedIn(request) {
  const hash = sessionHash(request);
  return Boolean(hash && database.prepare('SELECT 1 FROM sessions WHERE token_hash = ? AND expires > ?').get(hash, Date.now()));
}

function endSession(request, response) {
  const hash = sessionHash(request);
  if (hash) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
  response.setHeader('Set-Cookie', cookieName + '=' + cookieOptions + '; Max-Age=0');
}

async function startSession(request, response) {
  const { password, setup } = await readJson(request);
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    error(400, 'Enter a password with 10 to 128 characters.');
  }

  const existingOwner = database.prepare('SELECT salt, digest FROM owner WHERE id = 1').get();
  if (!existingOwner && setup !== true) error(409, 'Set a studio password first.');
  if (existingOwner && setup === true) error(409, 'A password is already set. Sign in to continue.');

  if (existingOwner) {
    if (Date.now() < lockUntil) error(429, 'Wait a few minutes before trying again.');
    const digest = await deriveKey(password, existingOwner.salt, 64);
    if (!timingSafeEqual(digest, Buffer.from(existingOwner.digest, 'hex'))) {
      failures += 1;
      if (failures >= 8) {
        lockUntil = Date.now() + 5 * 60 * 1000;
        failures = 0;
      }
      error(401, 'That password did not match.');
    }
  } else {
    const salt = randomBytes(24).toString('hex');
    const digest = await deriveKey(password, salt, 64);
    const created = database.prepare('INSERT OR IGNORE INTO owner (id, salt, digest) VALUES (1, ?, ?)').run(salt, digest.toString('hex'));
    if (!created.changes) error(409, 'A password was just set. Sign in to continue.');
  }

  failures = 0;
  lockUntil = 0;
  const now = Date.now();
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  const previousHash = sessionHash(request);
  if (previousHash) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(previousHash);
  database.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
  database.prepare('INSERT INTO sessions (token_hash, expires) VALUES (?, ?)').run(hash, now + sessionLifetime * 1000);
  response.setHeader('Set-Cookie', cookieName + '=' + token + cookieOptions + '; Max-Age=' + sessionLifetime);
  json(response, 200, { signedIn: true });
}

function requireOwner(request) {
  if (!isSignedIn(request)) error(401, 'Sign in to edit the blog.');
}

function savePost(data) {
  const { id, revision, action, title, body } = data;
  if (!['save', 'publish', 'unpublish'].includes(action) || typeof title !== 'string' || typeof body !== 'string') {
    error(400, 'Check the title, post, and action.');
  }
  if (title.length > 160 || body.length > 32000) error(400, 'Keep the title within 160 characters and the post within 32,000.');
  const savedTitle = title.trim();
  if (action === 'publish' && (!savedTitle || !body.trim())) error(400, 'Add a title and some text before publishing.');

  const now = new Date().toISOString();
  const prior = id ? database.prepare('SELECT * FROM posts WHERE id = ?').get(String(id)) : null;
  if (id && !prior) error(404, 'That draft could not be found.');
  if (prior && prior.revision !== revision) error(409, 'This post changed in another tab. Reopen it before saving.');
  if (action === 'unpublish' && !prior?.published_at) error(400, 'Only a published post can be unpublished.');

  const publish = action === 'publish';
  const unpublish = action === 'unpublish';
  const liveTitle = publish ? savedTitle : unpublish ? null : prior?.published_title ?? null;
  const liveBody = publish ? body : unpublish ? null : prior?.published_body ?? null;
  const liveDate = publish ? prior?.published_at || now : unpublish ? null : prior?.published_at ?? null;
  const postId = prior?.id || randomBytes(10).toString('hex');
  if (prior) {
    const result = database.prepare([
      'UPDATE posts SET title = ?, body = ?, updated_at = ?, published_title = ?, published_body = ?,',
      'published_at = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
    ].join(' ')).run(savedTitle, body, now, liveTitle, liveBody, liveDate, postId, revision);
    if (!result.changes) error(409, 'This post changed in another tab. Reopen it before saving.');
  } else {
    database.prepare('INSERT INTO posts VALUES (?, ?, ?, ?, ?, ?, ?, 1)').run(postId, savedTitle, body, now, liveTitle, liveBody, liveDate);
  }

  return database.prepare('SELECT id, title, body, updated_at, published_at, revision FROM posts WHERE id = ?').get(postId);
}

function findPublishedPost(id) {
  if (!id || !/^[a-f0-9]{20}$/.test(id)) return;
  return database.prepare([
    'SELECT id, published_title AS title, published_body AS body, published_at FROM posts',
    'WHERE id = ? AND published_at IS NOT NULL',
  ].join(' ')).get(id);
}

async function api(request, response, path) {
  const method = request.method;
  if (path === '/api/session' && method === 'GET') {
    const setupRequired = !database.prepare('SELECT 1 FROM owner WHERE id = 1').get();
    return json(response, 200, { setupRequired, signedIn: isSignedIn(request) });
  }
  if (path === '/api/session' && method === 'POST') return startSession(request, response);
  if (path === '/api/session/end' && method === 'POST') {
    await readJson(request);
    endSession(request, response);
    return json(response, 200, { signedIn: false });
  }
  if (path === '/api/posts' && method === 'GET') {
    const posts = database.prepare([
      'SELECT id, published_title AS title, substr(published_body, 1, 240) AS excerpt, published_at',
      'FROM posts WHERE published_at IS NOT NULL ORDER BY published_at DESC, id',
    ].join(' ')).all();
    return json(response, 200, { posts });
  }
  const postMatch = path.match(/^\/api\/posts\/([a-f0-9]{20})$/);
  if (postMatch && method === 'GET') {
    const post = findPublishedPost(postMatch[1]);
    if (!post) error(404, 'This post is unavailable.');
    return json(response, 200, { post });
  }
  if (path === '/api/drafts' && method === 'GET') {
    requireOwner(request);
    const drafts = database.prepare('SELECT id, title, body, updated_at, published_at, revision FROM posts ORDER BY updated_at DESC, id').all();
    return json(response, 200, { drafts });
  }
  if (path === '/api/drafts' && method === 'POST') {
    requireOwner(request);
    return json(response, 200, { draft: savePost(await readJson(request)) });
  }
  if (path === '/api/schema-check' && method === 'POST') {
    const { expected, incoming } = await readJson(request);
    return json(response, 200, compareContracts(expected, incoming));
  }
  error(404, 'This endpoint is unavailable.');
}

async function serveFile(request, response, pathname) {
  if (!['GET', 'HEAD'].includes(request.method)) error(405, 'Use GET to open this page.');
  const path = pathname === '/' ? '/index.html' : pathname;
  const asset = path.startsWith('/assets/') && path.slice(1).split('/').every((segment) => /^[a-z0-9][a-z0-9._-]*$/i.test(segment));
  const contentType = contentTypes[extname(path)];
  if ((!publicFiles.has(path) && !asset) || !contentType) error(404, 'This page is unavailable.');
  const filepath = join(root, path.slice(1));
  let metadata;
  try {
    metadata = await stat(filepath);
  } catch (failure) {
    if (failure.code !== 'ENOENT') throw failure;
  }
  if (!metadata?.isFile()) error(404, 'This page is unavailable.');
  const etag = '"' + metadata.size.toString(16) + '-' + Math.trunc(metadata.mtimeMs).toString(16) + '"';
  const cacheHeaders = { ETag: etag, 'Cache-Control': 'no-cache' };
  if (request.headers['if-none-match']?.split(/,\s*/).includes(etag)) {
    response.writeHead(304, cacheHeaders);
    return response.end();
  }
  response.writeHead(200, { ...cacheHeaders, 'Content-Type': contentType, 'Content-Length': metadata.size });
  if (request.method === 'HEAD') return response.end();
  createReadStream(filepath).on('error', () => response.destroy()).pipe(response);
}

const server = createServer(async (request, response) => {
  for (const [name, value] of Object.entries(siteSecurityHeaders)) response.setHeader(name, value);
  let pathname = request.url.split('?')[0];
  try {
    if (!hosts.has(request.headers.host)) error(421, 'Open the portfolio on localhost.');
    const origin = 'http://' + request.headers.host;
    const url = URL.parse(request.url, origin);
    if (url?.origin !== origin) error(400, 'This request is unavailable.');
    pathname = url.pathname;
    pathname = decodeURIComponent(pathname);
    if (isApiPath(pathname)) {
      await api(request, response, pathname);
    } else {
      if (pathname === '/post.html' && ['GET', 'HEAD'].includes(request.method) && !findPublishedPost(url.searchParams.get('id'))) {
        error(404, 'This post is unavailable.');
      }
      await serveFile(request, response, pathname);
    }
  } catch (failure) {
    const status = failure.status || (failure instanceof URIError ? 400 : 500);
    if (status === 500) console.error('Portfolio request failed:', failure.name);
    if (response.headersSent) return response.destroy();
    if (status === 405 && !isApiPath(pathname)) response.setHeader('Allow', 'GET, HEAD');
    if (isPageRequest(request, pathname)) {
      response.writeHead(status, errorPageHeaders);
      return response.end(request.method === 'HEAD' ? undefined : renderErrorPage(status));
    }
    json(response, status, { error: status === 500 ? 'The portfolio could not complete this request.' : failure.message });
  }
});
server.listen(port, '127.0.0.1', () => console.log('Local preview at http://127.0.0.1:' + port + '/'));

