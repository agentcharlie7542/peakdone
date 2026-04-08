/**
 * PeakDone Service Worker
 *
 * 전략:
 * - HTML (네비게이션): Network-first → 항상 최신 메타태그·콘텐츠 크롤링 가능
 * - 폰트·CDN 스타일: Cache-first (장기 캐시) → Core Web Vitals 개선
 * - Firebase API: Network-only → 캐시 금지
 * - 나머지: Stale-while-revalidate
 */

const CACHE_VERSION = 'peakdone-v3';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const FONT_CACHE    = `${CACHE_VERSION}-fonts`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

const FONT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

const NETWORK_ONLY_ORIGINS = [
  'https://firestore.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://firebase.googleapis.com',
];

// ── Install: 정적 에셋 사전 캐시 ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {/* 오프라인 환경 무시 */})
    )
  );
});

// ── Activate: 이전 버전 캐시 정리 ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== FONT_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: 전략별 분기 ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1) Firebase API → Network-only (캐시 절대 금지)
  if (NETWORK_ONLY_ORIGINS.some((o) => request.url.startsWith(o))) {
    return; // 기본 fetch 통과
  }

  // 2) 폰트 → Cache-first (1년 캐시)
  if (FONT_ORIGINS.some((o) => request.url.startsWith(o))) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // 3) HTML 내비게이션 → Network-first (SEO 크롤러가 항상 최신 HTML을 받도록)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, cloned));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 4) 나머지 → Stale-while-revalidate
  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
