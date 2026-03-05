// 簡易離線快取（App Shell）
// ✅ v2：修正 CSS/JS 長期吃舊快取問題
const CACHE_NAME = "xiamen-trip-app-v2";

const PRECACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./itinerary.html",
  "./food.html",
  "./hotel.html",
  "./taxi.html",
  "./transport.html",
  "./souvenir.html",
  "./tips.html",
  "./medical.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// HTML：network-first（確保內容可更新）
// CSS/JS/圖片：stale-while-revalidate（先快取、背景更新）
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get("accept") || "";
  const isHTML = accept.includes("text/html");

  const isStatic =
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".json");

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached);

        // 有快取就先回快取，並在背景更新
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 其他：沿用 cache fallback
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});