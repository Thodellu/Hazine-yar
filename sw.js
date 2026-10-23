/* Service worker: lets the app open offline after the first visit. */
const VER = 'hazine-yar-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'
];
const FONT_CSS = 'https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/Vazirmatn-font-face.css';

// Save the font stylesheet and the font files it points to, so the Vazirmatn look works offline too.
async function precacheFont(cache) {
  try {
    const res = await fetch(FONT_CSS);
    if (!res.ok) return;
    await cache.put(FONT_CSS, res.clone());
    const css = await res.text();
    const urls = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(m => new URL(m[1], FONT_CSS).href);
    await Promise.all([...new Set(urls)].map(u => cache.add(u).catch(() => {})));
  } catch (err) { /* no connection during install: fonts are saved on a later visit instead */ }
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER)
      .then(async c => { await c.addAll(SHELL); await precacheFont(c); })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // The page itself: try the network first so updates arrive, fall back to the saved copy offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(VER).then(c => c.put('index.html', copy)); return res; })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Icons, fonts and everything else: saved copy first, then network (and save it for next time).
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VER).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
