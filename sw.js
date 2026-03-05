// 簡易離線快取（App Shell）
// 注意：若你之後新增頁面/檔案，記得更新 PRECACHE 清單與 CACHE_NAME 版本
const CACHE_NAME = "xiamen-trip-app-v1";

const PRECACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./itinerary.html",
  "./map.html",
  "./food.html",
  "./hotel.html",
  "./taxi.html",
  "./transport.html",
  "./souvenir.html",
  "./tips.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
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

// 對 HTML：優先網路、失敗用快取（讓內容可更新）
// 對其他靜態檔：優先快取、沒有再抓網路
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只處理同源
  if (url.origin !== self.location.origin) return;

  const isHTML =
    req.headers.get("accept") && req.headers.get("accept").includes("text/html");

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

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});