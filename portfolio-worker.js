import { errorPageHeaders, renderErrorPage } from './error-pages.mjs';

const cachePrefix = 'swastika-error-assets-';
const cacheName = cachePrefix + '4';
const errorAssets = new Set([
  '/error.css',
  '/assets/favicon.png',
  '/assets/notebook/error-bow.webp',
  '/assets/notebook/desk-cat.webp',
  '/assets/instrument-serif.woff2',
]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...errorAssets]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

function errorResponse(page, status, original) {
  const headers = new Headers(errorPageHeaders);
  for (const name of ['Allow', 'Retry-After', 'WWW-Authenticate']) {
    const value = original?.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(renderErrorPage(page), { status, headers });
}

async function openPage(request) {
  let result;
  try {
    result = await fetch(request);
  } catch {
    return errorResponse(self.navigator.onLine === false ? 'offline' : 'unreachable', 503);
  }

  if (result.status >= 400 && result.status <= 599 && !result.headers.has('X-Portfolio-Error')) {
    return errorResponse(result.status, result.status, result);
  }
  return result;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== 'GET') return;

  if (!url.search && errorAssets.has(url.pathname)) {
    event.respondWith((async () => (await caches.match(request, { cacheName })) || fetch(request))());
  } else if (request.mode === 'navigate' && url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
    event.respondWith(openPage(request));
  }
});
