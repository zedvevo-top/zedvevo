// ZedVevo Service Worker for Background Android Pop-up Notifications & PWA Deep Linking
self.addEventListener('install', () => {
  console.log('[SW-DEBUG] ZedVevo Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW-DEBUG] ZedVevo Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle notification click from Android notification bar or system shade
self.addEventListener('notificationclick', (event) => {
  console.log('[SW-DEBUG] Notification clicked on Android/OS bar:', event.notification);
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || data.actionUrl || data.link || '/';

  // Ensure absolute or clean relative URL
  if (!targetUrl.startsWith('http') && !targetUrl.startsWith('/')) {
    targetUrl = '/' + targetUrl;
  }

  console.log('[SW-DEBUG] Navigating to targetUrl:', targetUrl);

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If an open window exists, focus it and navigate to target route
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client && targetUrl) {
              return client.navigate(targetUrl);
            }
            client.postMessage({ type: 'NOTIFICATION_NAVIGATE', url: targetUrl });
            return;
          }
        }
        // If no window is currently open, open a new window to target route
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Handle push events if push service is active
self.addEventListener('push', (event) => {
  console.log('[SW-DEBUG] Push event received on Android device:', event);
  if (!event.data) {
    console.log('[SW-DEBUG] Push event received with no data payload');
    return;
  }

  try {
    const payload = event.data.json();
    console.log('[SW-DEBUG] Parsed JSON push payload:', payload);
    const title = payload.title || 'ZedVevo Notification';
    const options = {
      body: payload.body || payload.message || 'You have a new update on ZedVevo',
      icon: payload.icon || '/app-icon.png',
      badge: '/app-icon.png',
      tag: payload.tag || `zedvevo-${Date.now()}`,
      data: { url: payload.url || payload.actionUrl || '/' },
      vibrate: [200, 100, 200],
      requireInteraction: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    const text = event.data.text();
    console.log('[SW-DEBUG] Raw text push payload:', text);
    event.waitUntil(
      self.registration.showNotification('ZedVevo Alert', {
        body: text,
        icon: '/app-icon.png',
        badge: '/app-icon.png',
        data: { url: '/' },
      })
    );
  }
});
