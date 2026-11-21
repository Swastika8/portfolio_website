import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPosts, readPost, summarizePosts } from './blog-content.mjs';
import { compareContracts } from '../schema-check.mjs';
import { errorPageHeaders, renderErrorPage, siteSecurityHeaders } from '../error-pages.mjs';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const port = Number(process.env.PORTFOLIO_PORT || 4173);
const hosts = new Set(['127.0.0.1:' + port, 'localhost:' + port]);
const publicFiles = new Set([
  '/index.html', '/about.html', '/blog.html', '/post.html',
  '/styles.css', '/notebook.css', '/notebook.js', '/blog.js', '/journal-text.js',
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

async function api(request, response, pathname) {
  if (pathname !== '/api/schema-check') error(404, 'This endpoint is unavailable.');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    error(405, 'Use POST to compare contracts.');
  }
  const { expected, incoming } = await readJson(request);
  return json(response, 200, compareContracts(expected, incoming));
}

async function serveBlogData(request, response, pathname) {
  if (!['GET', 'HEAD'].includes(request.method)) error(405, 'Use GET to read the blog.');
  if (pathname === '/blog-data/posts.json') return json(response, 200, { posts: summarizePosts(await listPosts()) });
  const match = /^\/blog-data\/([^/]+)\.json$/.exec(pathname);
  const post = match && await readPost(match[1]);
  if (!post) error(404, 'This post is unavailable.');
  return json(response, 200, { post });
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
    if (pathname === '/studio.html' && ['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(307, { Location: '/blog.html' });
      return response.end();
    }
    if (isApiPath(pathname)) {
      await api(request, response, pathname);
    } else if (pathname.startsWith('/blog-data/')) {
      await serveBlogData(request, response, pathname);
    } else {
      if (pathname === '/post.html' && ['GET', 'HEAD'].includes(request.method) && !(await readPost(url.searchParams.get('id')))) {
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

