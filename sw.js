// ══════════════════════════════════════════════════════════════
//  SecureLink — Service Worker
//  Enables: offline shell, install prompt, background sync
// ══════════════════════════════════════════════════════════════

const CACHE     = 'securelink-v1';
const SHELL     = ['./', './index.html'];

// ── Install: cache the app shell ─────────────────────────────
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(SHELL))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: clean old caches ───────────────────────────────
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: network-first, fallback to cache ──────────────────
// Firebase, Make.com, and all API calls go straight to network.
// Only the app shell (index.html) is served from cache if offline.
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Always network for: Firebase, APIs, external scripts
    const alwaysNetwork = [
        'firebasedatabase.app',
        'googleapis.com',
        'gstatic.com',
        'make.com',
        'retellai.com',
        'openstreetmap.org',
        'unpkg.com',
        'esm.sh',
        'cdnjs.cloudflare.com',
        'lamejs',
    ];
    if (alwaysNetwork.some(d => url.href.includes(d))) {
        return; // let browser handle natively
    }

    // Network-first for everything else, fallback to cache
    e.respondWith(
        fetch(e.request)
            .then(res => {
                // Cache successful GET responses for the app shell
                if (e.request.method === 'GET' && res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(e.request)
                .then(cached => cached || caches.match('./index.html'))
            )
    );
});

// ── Push notifications (future use) ──────────────────────────
self.addEventListener('push', e => {
    if (!e.data) return;
    const data = e.data.json();
    self.registration.showNotification(data.title || '🚨 SecureLink Alert', {
        body:    data.body  || 'Emergency alert received',
        icon:    data.icon  || './icon-192.png',
        badge:   data.badge || './icon-96.png',
        tag:     'securelink-alert',
        renotify: true,
        vibrate: [200, 100, 200, 100, 400],
        data:    { url: data.url || './' }
    });
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(list => {
                if (list.length) return list[0].focus();
                return clients.openWindow(e.notification.data?.url || './');
            })
    );
});
