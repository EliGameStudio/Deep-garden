/* DEEP GARDEN service worker.
   Two rules that cost us dearly elsewhere and are not negotiable here:
   1. index.html is NETWORK-FIRST, or an update never reaches the phone.
   2. Other origins (Firebase!) are never touched, or the leaderboard freezes. */
var CACHE = 'deepgarden-v6-2';
var SHELL = ['./', './index.html', './manifest.json', './icon-180.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  // never cache anything from another origin - the leaderboard lives there
  if (url.origin !== self.location.origin) return;

  var isDoc = req.mode === 'navigate' || url.pathname === '/' || /index\.html$/.test(url.pathname);

  if (isDoc) {
    // network-first: always try for a fresh build, fall back to cache when offline
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); });
        })
    );
    return;
  }

  // icons and manifest: cache-first, they hardly ever change
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
