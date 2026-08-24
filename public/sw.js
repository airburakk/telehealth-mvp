// AURA — Service Worker (PWA faz 2: Web Push)
// Strateji (bilinçli muhafazakâr — sağlık verisi tazeliği önce gelir):
//   • /api/*           → ASLA önbellek yok, doğrudan ağ (klinik veri + kimlik)
//   • Sayfa gezinmesi  → network-first; ağ yoksa /offline.html
//   • /_next/static/*  → cache-first (içerik hash'li, değişmez) + ikonlar
//   • push             → tarayıcı kapalıyken bildirim göster; tıklayınca ilgili sayfa
// 🪤 PRECACHE'teki bir dosyayı DEĞİŞTİRİRSEN VERSION'ı da artır: cache adı VERSION'dan türer,
// activate yalnız adı farklı olan eski cache'leri siler. Artırmazsan mevcut kullanıcı eski
// kopyayı görmeye devam eder (v5, 2026-08-19: amblem + offline.html gece teması + manifest;
// v6, 2026-08-21: icon-192/icon-512 URL'lerine `?v=2` cache-kırıcı eklendi — push bildirimi
// ikonu ve manifest ikonu, favicon gibi tarayıcının inatçı ikon önbelleğine takılıyordu;
// v7, 2026-08-23: marka seti v2 — küre ikonları, `?v=3`).
const VERSION = "air-pwa-v7";
const PRECACHE = ["/offline.html", "/icon-192.png?v=3", "/icon-512.png?v=3", "/manifest.webmanifest"];
// cacheable-kontrolü pathname üzerinden yapılıyor (query'siz) — PRECACHE artık query'li URL
// taşıdığı için ayrı bir pathname kümesi lazım, yoksa `PRECACHE.includes(url.pathname)` hiç
// eşleşmez ve ikonlar cache-first yoldan sessizce düşer.
const PRECACHE_PATHS = new Set(PRECACHE.map((u) => new URL(u, self.location.origin).pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // klinik veri/kimlik — her zaman canlı

  // Sayfa gezinmesi: önce ağ, düşerse offline sayfası
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Hash'li statikler + ikonlar: önce önbellek, yoksa ağdan al ve sakla
  const cacheable =
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE_PATHS.has(url.pathname);
  if (cacheable) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});

// ── Web Push: tarayıcı kapalıyken bildirim göster ──
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "AURA";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png?v=3",
      badge: "/icon-192.png?v=3",
      lang: "tr",
      data: { href: data.href || "/" },
    })
  );
});

// Bildirime tıklama: açık sekme varsa odaklan + yönlendir, yoksa yeni pencere
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if ("focus" in tab) {
          tab.focus();
          if ("navigate" in tab) tab.navigate(href);
          return;
        }
      }
      return clients.openWindow(href);
    })
  );
});
