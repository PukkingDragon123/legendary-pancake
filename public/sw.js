/* Hoot Hollow service worker.
 * - App shell: network-first for navigations (fresh when online, cached index when offline; falls back to the cache
 *   after 4 s on a flaky connection).
 * - Static assets (hashed JS/CSS, fonts, images, sounds): cache-first, filled at install from the URLs that index.html
 *   references and then at runtime. The cache name is versioned; bump VERSION to drop old caches.
 * - Notification clicks focus (or open) the app and post { type: 'hoot:notification', tag, action, data } to it.
 *   Alarm notifications may carry 'snooze' / 'dismiss' actions; the page owns the alarm and acts on the message. If no
 *   window is open, 'dismiss' just closes the notification and other actions open the app with
 *   ?notification=<tag>&action=<action> so it can pick them up on launch.
 */
const VERSION = 'v1';
const PREFIX = 'hoot-hollow-';
const CACHE = PREFIX + VERSION;
const SCOPE = self.registration.scope;
const SHELL_URL = new URL('./', SCOPE).href;
const MAX_ENTRIES = 250;
const NAV_TIMEOUT_MS = 4000;

const STATIC_RE = /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|gif|webp|avif|svg|ico|mp3|ogg|wav|m4a|json|webmanifest|glb|gltf|bin|ktx2)$/i;

function isStatic(url) {
  const p = url.pathname;
  // never cache the Vite dev server's module graph / HMR endpoints
  if (p.includes('/@') || p.includes('/node_modules/') || p.includes('/src/') || url.searchParams.has('t') || url.searchParams.has('v')) return false;
  if (p.endsWith('/sw.js')) return false;
  return STATIC_RE.test(p);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(new Request(SHELL_URL, { cache: 'reload' }));
        if (res.ok) {
          await cache.put(SHELL_URL, res.clone());
          // precache what the shell references directly (entry JS/CSS, icons, manifest)
          const html = await res.text();
          const urls = new Set();
          for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"'#]+)["']/g)) {
            const u = new URL(m[1], SHELL_URL);
            if (u.origin === self.location.origin && isStatic(u)) urls.add(u.href);
          }
          await Promise.all([...urls].map((u) => cache.add(u).catch(() => undefined)));
        }
      } catch {
        /* offline during install: the runtime cache fills later */
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Start the network request and the cache refresh synchronously so the worker stays alive for both.
    let stored = Promise.resolve();
    const network = fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          stored = caches.open(CACHE).then((c) => c.put(SHELL_URL, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => null);
    event.waitUntil(network.then(() => stored));
    event.respondWith(navigationResponse(network));
    return;
  }
  if (req.headers.has('range')) return; // media range requests: 206 responses cannot be cached
  if (isStatic(url)) event.respondWith(cacheFirst(req));
});

async function navigationResponse(network) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(SHELL_URL, { ignoreVary: true });
  const timeout = cached ? new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS)) : null;
  const res = await (timeout ? Promise.race([network, timeout]) : network);
  if (res) return res;
  if (cached) return cached;
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Hoot Hollow</title><p style="font-family:sans-serif">Hoot Hollow is offline. Reconnect once to finish installing.</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  // ignoreVary: hosts often send `Vary: Origin`, and module scripts carry an Origin header that a precache request
  // did not, which would make every lookup miss. Same-origin hashed assets are safe to match by URL alone.
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
    try {
      await cache.put(req, res.clone());
      await trim(cache);
    } catch {
      /* quota exceeded: serve without caching */
    }
  }
  return res;
}

async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_ENTRIES;
  for (let i = 0, removed = 0; i < keys.length && removed < extra; i++) {
    if (keys[i].url === SHELL_URL) continue;
    await cache.delete(keys[i]);
    removed++;
  }
}

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const action = event.action || 'open';
  const tag = n.tag || '';
  const data = n.data || null;
  n.close();
  event.waitUntil(
    (async () => {
      const msg = { type: 'hoot:notification', tag, action, data };
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = windows.find((c) => c.url.startsWith(SCOPE)) || windows[0];
      if (client) {
        try {
          if ('focus' in client) await client.focus();
        } catch {
          /* focus may be refused without user activation; the message still goes through */
        }
        client.postMessage(msg);
        return;
      }
      if (action === 'dismiss') return;
      const url = new URL('./', SCOPE);
      url.searchParams.set('notification', tag);
      url.searchParams.set('action', action);
      await self.clients.openWindow(url.href);
    })(),
  );
});
