// Minimal service worker: network-first for same-origin GETs so online users
// always get fresh content, with a cache fallback so the app opens offline.
const CACHE = 'kufli-v1';
const SHELL = ['/', '/index.html', '/favicon.png', '/kufli-logo.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // leave Supabase / UEFA / fonts alone

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});

// ── Web Push ───────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kufli TippJáték', {
      body: data.body || '',
      icon: '/kufli-logo-192.png',
      badge: '/favicon.png',
      tag: data.tag || 'kufli',
      renotify: !!data.tag,
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin)) {
          await w.focus();
          if ('navigate' in w) await w.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
