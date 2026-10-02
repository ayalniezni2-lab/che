// Web version only (registered when window.CHE_STATIC is set): keeps Che! itself on the phone, so it opens fast
// and works without internet after the first visit. tools/build_site.py fills in BUILD and SHELL.
// Audio is not cached here: the browser streams each clip from the site (needs internet).
const BUILD = "20261002-1433-03ff1fc";
const SHELL = ["./", "icon-192.png", "icon-512.png", "index.html", "manifest.webmanifest", "css/style.css", "js/app.js", "js/backend.js", "js/exercise.js", "js/input.js", "js/ui.js", "js/views/culture.js", "js/views/home.js", "js/views/learn.js", "js/views/notebook.js", "js/views/placement.js", "js/views/practice.js", "js/views/session.js", "js/views/settings.js", "js/views/stats.js", "js/views/unit.js", "js/views/verbs.js", "js/views/words.js", "engine.zip"];
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/';
const APP_CACHE = 'che-app-' + BUILD;
const ENGINE_CACHE = 'che-pyodide';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // cache: 'reload' = straight from the site, never a stale copy from the browser's own short-term cache
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('che-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const engine = url.href.startsWith(PYODIDE);
  if (url.origin !== self.location.origin && !engine) return;
  if (url.pathname.includes('/audio/')) return;          // clips stream straight from the site
  event.respondWith(caches.open(engine ? ENGINE_CACHE : APP_CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: !engine });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && (res.type === 'basic' || res.type === 'cors')) cache.put(req, res.clone());
    return res;
  }));
});
