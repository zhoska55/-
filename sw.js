// 최소한의 서비스 워커. 오프라인 캐싱은 하지 않고,
// PWA로 설치 가능하게 만드는 최소 요건만 충족한다.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
