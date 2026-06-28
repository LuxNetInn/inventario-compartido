// ====================================================================
// InventarioApp — Service Worker
// Estrategia: Network-first para API, Cache-first para assets estáticos
// ====================================================================

const CACHE_VERSION = "inventario-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Assets que se cachean inmediatamente al instalar
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// ====================================================================
// INSTALL — Precachear assets críticos
// ====================================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(
          PRECACHE_URLS.filter((url) =>
            !url.includes("/icons/") || true
          )
        ).catch(() => {
          // Si falla algún ícono, no romper la instalación
          return cache.addAll(["/", "/manifest.webmanifest"]);
        })
      )
      .then(() => self.skipWaiting())
  );
});

// ====================================================================
// ACTIVATE — Limpiar caches viejos
// ====================================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ====================================================================
// FETCH — Estrategia híbrida
// ====================================================================
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo manejar GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Ignorar requests de extensión / chrome
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // ─── API (tRPC, /api/*) → Network-first con fallback a cache ───
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/trpc/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Solo cachear respuestas exitosas
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ─── Navegación (HTML) → Network-first, fallback a cache "/" ───
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // ─── Assets estáticos (JS, CSS, imágenes, fuentes) → Cache-first ───
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ====================================================================
// MESSAGE — Permitir skipWaiting desde el cliente
// ====================================================================
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
