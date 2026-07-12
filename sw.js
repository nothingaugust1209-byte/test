// オフラインキャッシュ用のService Worker
// 戦略：ネットワーク優先（常に最新を取りに行き、失敗した時だけキャッシュを使う）
// 以前のバージョンはJSファイルを一部しかキャッシュしておらず、キャッシュ命中もネットワーク取得も
// 失敗した際に respondWith(undefined) となり、画面の中身が表示されない不具合があったため修正。
const CACHE_NAME = 'jouhouriron-app-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './data/terms.json',
  './data/formulas.json',
  './data/calc.json',
  './data/flow.json',
  './js/app.js',
  './js/data.js',
  './js/router.js',
  './js/katexHelper.js',
  './js/screens/terms.js',
  './js/screens/flashcard.js',
  './js/screens/calc.js',
  './js/screens/mocktest.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // 同一オリジンのファイルのみ対象（KaTeXなど外部CDNはブラウザの通常キャッシュに任せる）
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
  );
});
