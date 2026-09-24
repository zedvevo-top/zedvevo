// ZedVevo Service Worker for Background Android Pop-up Notifications & PWA Deep Linking
self.addEventListener('install', () => {
  console.log('[SW-DEBUG] ZedVevo Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW-DEBUG] ZedVevo Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Respond to SW diagnostic ping checks from Admin Panel
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SW_PING') {
    event.ports[0]?.postMessage({
      type: 'SW_PONG',
      status: 'active',
      fcmCompatible: true,
      timestamp: Date.now(),
      userAgent: self.navigator?.userAgent || 'ServiceWorkerContext',
    });
  }
});

// Handle notification click from Android notification bar, system shade, or FCM push
self.addEventListener('notificationclick', (event) => {
  console.log('[SW-DEBUG] Notification clicked on Android/OS bar:', event.notification);
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || data.actionUrl || data.link || '/';

  // Ensure absolute URL resolution to prevent blank screen or origin mismatch on mobile browsers
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    if (!targetUrl.startsWith('/')) {
      targetUrl = '/' + targetUrl;
    }
  }

  const absoluteUrl = targetUrl.startsWith('http')
    ? targetUrl
    : new URL(targetUrl, self.location.origin).href;

  console.log('[SW-DEBUG] Navigating via NOTIFICATION_NAVIGATE protocol to:', absoluteUrl);

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 1. If an open window client exists, focus it and dispatch NOTIFICATION_NAVIGATE message for smooth SPA transition
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_NAVIGATE',
              url: targetUrl,
              absoluteUrl: absoluteUrl,
              timestamp: Date.now(),
              notificationData: data,
            });
            return;
          }
        }

        // 2. If no client window is currently open, open a new window to absolute URL
        if (self.clients.openWindow) {
          return self.clients.openWindow(absoluteUrl);
        }
      })
  );
});

// Handle FCM and Web Push background events on Android devices
self.addEventListener('push', (event) => {
  console.log('[SW-DEBUG] FCM Push event received on Android device:', event);
  if (!event.data) {
    console.log('[SW-DEBUG] Push event received with no data payload');
    return;
  }

  try {
    const payload = event.data.json();
    console.log('[SW-DEBUG] Parsed JSON push payload:', payload);

    const notificationPayload = payload.notification || payload;
    const dataPayload = payload.data || payload;

    const title = notificationPayload.title || dataPayload.title || 'ZedVevo Notification';
    const body = notificationPayload.body || dataPayload.body || dataPayload.message || 'You have a new update on ZedVevo';
    const icon = notificationPayload.icon || dataPayload.icon || '/app-icon.png';
    const url = dataPayload.url || dataPayload.actionUrl || notificationPayload.click_action || '/';

    const options = {
      body,
      icon,
      badge: '/app-icon.png',
      tag: payload.tag || `zedvevo-${Date.now()}`,
      data: {
        url,
        fcmMessageId: payload.fcmMessageId || dataPayload.fcmMessageId,
        timestamp: Date.now(),
      },
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
        data: { url: '/', timestamp: Date.now() },
      })
    );
  }
});
