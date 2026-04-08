// Precision IA Service Worker — Offline Cache + Push Notifications
const CACHE_NAME = 'prospector-v5';
const STATIC_ASSETS = [
    '/',
    '/dashboard',
    '/manifest.json',
];

// Install — cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — Network-first with cache fallback. Always return a valid Response (required by respondWith).
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

    // Skip cross-origin requests (Google fonts, profile photos, analytics, etc.)
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

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

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
    );
});

// Push Notification handler
self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? { title: 'Precision IA', body: 'Nova notificação' };
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/precisionai-icon-192.png',
            badge: '/precisionai-favicon-32.png',
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
