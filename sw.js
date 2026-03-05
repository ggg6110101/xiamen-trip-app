/* sw.js — 小黑的愛心之廈門自由行助手
   Cache strategy designed to avoid “stuck” updates.

   - Navigations (HTML): Network First (always try newest)
   - Assets (CSS/JS/IMG/Fonts): Stale-While-Revalidate
   - Cleans old caches on activate
   - skipWaiting + clientsClaim for fast updates
*/

const APP_PREFIX = "xiamen-trip-app";
const RUNTIME_CACHE = `${APP_PREFIX}-runtime`;     // 不用版本號也不會卡
const ASSET_CACHE = `${APP_PREFIX}-assets`;        // 靜態資源快取
const HTML_CACHE = `${APP_PREFIX}-html`;           // HTML 快取（離線備援）

// 你可以選擇把離線首頁做成 fallback（可選）
const OFFLINE_FALLBACK_URL = "index.html";

// 安裝：盡量快，並預先快取離線 fallback（可選）
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(HTML_CACHE);
      // 嘗試快取離線 fallback（如果抓不到也不影響安裝）
      await cache.add(new Request(OFFLINE_FALLBACK_URL, { cache: "reload" }));
    } catch {}
  })());
});

// 啟用：立即接管 + 清理舊快取（同 prefix 但不是這三個）
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        const isMine = key.startsWith(APP_PREFIX);
        const keep = (key === RUNTIME_CACHE || key === ASSET_CACHE || key === HTML_CACHE);
        if (isMine && !keep) return caches.delete(key);
      })
    );
    await self.clients.claim();
  })());
});

// 允許頁面端要求立刻啟用新 SW
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// 工具：判斷是否為「導覽/HTML」
function isNavigationRequest(request) {
  return request.mode === "navigate"
    || (request.headers.get("accept") || "").includes("text/html");
}

// 工具：判斷可快取的請求（只快取 GET）
function isCacheable(request) {
  return request.method === "GET" && request.url.startsWith(self.location.origin);
}

// Network First（HTML）
async function networkFirst(request) {
  const cache = await caches.open(HTML_CACHE);

  try {
    const response = await fetch(request, { cache: "no-store" });
    // 成功就更新 HTML 快取
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    // 網路失敗：用快取備援
    const cached = await cache.match(request);
    if (cached) return cached;

    // 最後備援：離線 fallback（index.html）
    const fallback = await cache.match(OFFLINE_FALLBACK_URL);
    if (fallback) return fallback;

    throw err;
  }
}

// Stale-While-Revalidate（CSS/JS/IMG/Fonts 等）
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = (async () => {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) await cache.put(request, fresh.clone());
      return fresh;
    } catch {
      return null;
    }
  })();

  // 先回快取（秒開），同時背景更新
  return cached || (await networkPromise) || fetch(request);
}

// Fetch：核心路由策略
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 非同源或不可快取 → 直接走網路
  if (!isCacheable(req)) return;

  // 導覽 / HTML：Network First，避免首頁摘要或頁面內容卡住
  if (isNavigationRequest(req)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 其他靜態資源：SWR
  const dest = req.destination; // 'style', 'script', 'image', 'font', ...
  if (dest === "style" || dest === "script" || dest === "image" || dest === "font") {
    event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
    return;
  }

  // 其餘 GET（例如 JSON/其他）：SWR 放 runtime
  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
});