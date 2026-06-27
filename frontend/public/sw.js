// Precision Service Worker — Offline Cache + Push Notifications
// Cache version is checked dynamically; SW auto-updates because nginx serves sw.js with no-cache.
const CACHE_NAME = 'precisionia-v7';
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
];

// Install — cache core shell only (not JS chunks — they have hashed names and are cached by nginx)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean ALL old caches to ensure fresh assets after deploy
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — Network-first for navigations. DO NOT cache JS/CSS (Vite hashed bundles are already cached by browser with immutable headers).
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/api/')) return;

    // Skip cross-origin requests
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    // Never intercept version.json — must always come from network
    if (url.pathname === '/version.json') return;

    // Only provide offline fallback for full page navigations.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() =>
                    caches.match(event.request).then((cached) => {
                        if (cached) return cached;
                        return caches.match('/') || Response.error();
                    })
                )
        );
        return;
    }

    // For sub-resources (JS, CSS, images): network only — let browser HTTP cache handle it.
    // Do NOT add to SW cache to avoid serving stale chunks after deploy.
});

// Push Notification handler
self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? { title: 'Precision', body: 'Nova notificação' };
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/precisionai-icon-192.png?v=3',
            badge: '/precisionai-favicon-32.png?v=3',
            vibrate: [100, 50, 100],
            tag: data.tag || 'default',
            renotify: !!data.tag,
            data: { url: data.url || '/dashboard' },
        })
    );
});

// Notification click — open target URL or dashboard
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/dashboard';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(url);
                    return;
                }
            }
            return self.clients.openWindow(url);
        })
    );
});

// Message handler — supports skipWaiting from the app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') self.skipWaiting();
});
