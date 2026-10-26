/* Deen Companion service worker — lets the app open offline and install like a real app.
   Pages: network first (so updates always arrive), fallback to the saved copy.
   Fonts, icons and the Firebase SDK: saved after first use.
   Live data (Firestore, login, prayer-time API) is never touched. */
const CACHE = 'deen-shell-v2';
const SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {                       // the app page itself
    e.respondWith(
      fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./', copy)); return r; })
        .catch(() => caches.match('./').then(r => r || caches.match(req)))
    );
    return;
  }
  const isStatic = url.origin === location.origin || STATIC_HOSTS.includes(url.hostname);
  if (!isStatic) return;                               // Firestore, auth, prayer API: straight to the network

  e.respondWith(                                       // stale-while-revalidate
    caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }))
  );
});

/* Tapping a prayer-time notification brings the app to the front. */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
