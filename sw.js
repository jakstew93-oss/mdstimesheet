const CACHE_NAME = 'mdsmiths-timesheet-v111';
const NAV_TIMEOUT_MS = 2500;
const APP_SHELL = [
  './',
  './site-config.css?v=2',
  './site-config.js?v=4',
  './drivers.js?v=3',
  './admin.css?v=5',
  './admin.js?v=8',
  './receipt-ocr.js?v=67',
  './vendor/ocr/tesseract.min.js',
  './vendor/ocr/worker.min.js',
  './expenses.css?v=70',
  './expenses.js?v=72',
  './expense-template.js?v=70',
  './weather-season.css?v=77',
  './weather-season.js?v=78',
  './pocket-tools.css?v=79',
  './pocket-tools.js?v=79',
  './test-results.js?v=79',
  './vehicle-regs.css?v=80',
  './vehicle-regs.js?v=82',
  './data-backup.js?v=82',
  './native-bridge.js?v=84',
  './shift-dial.css?v=1',
  './shift-dial.js?v=3',
  './shift-status.css?v=2',
  './shift-status.js?v=3',
  './pay-estimate.js?v=7',
  './sunday-reminder.js?v=3',
  './Index.html',
  './index.html',
  './recent-regs.js',
  './recent-regs.js?v=34',
  './appearance.css?v=62',
  './appearance.js?v=62',
  './widget-import.js?v=82',
  './timesheet-tools.js?v=62',
  './workflow-ui.js?v=65',
  './driver-characters.css?v=62',
  './driver-characters.js?v=69',
  './driver-avatars/jak-stewart-black-shirt.png',
  './driver-avatars/cody-slack-black-shirt.png',
  './driver-avatars/ash-kemp-black-shirt.png',
  './driver-avatars/martyn-evans.png',
  './driver-avatars/matthew-heath-black-shirt.png',
  './driver-avatars/luke-chambers-black-shirt.png',
  './driver-avatars/oliver-spicer-black-shirt.png',
  './driver-avatars/tobi-culver.png',
  './fonts/vt323.ttf',
  './fonts/bundled/f8bd5f78-38bb-43ca-9d00-40e125c4c602.woff2',
  './fonts/bundled/87bc95b0-ea1e-4bae-8f6e-3ecde09bf5e4.woff2',
  './fonts/bundled/bce67087-83ae-4504-b72b-57856f9599ff.woff2',
  './fonts/bundled/2d9c7d1c-858b-4441-a771-43a77bb0b672.woff2',
  './fonts/bundled/3be60238-8391-416b-9fb4-3d8a31607990.woff2',
  './fonts/bundled/b1c67b25-6368-4318-b5a3-44fe26ce767a.woff2',
  './fonts/bundled/536e8c8a-a387-4644-9d36-145c1ad0fc0e.woff2',
  './fonts/bundled/b9c92014-b212-4857-a622-4fa5c860a492.woff2',
  './fonts/bundled/a2e5c6dc-fea7-481a-b33f-9ae474f7025e.woff2',
  './fonts/bundled/6b194990-163a-4bd2-a535-a5ef138e4f42.woff2',
  './fonts/bundled/c22f7e1b-e4d2-4995-bf21-15017870213d.woff2',
  './fonts/bundled/f54d60e9-af96-478e-966c-8b6567d8e9e3.woff2',
  './fonts/bundled/e17c85f0-1422-4155-8ad9-b5427ff840ca.woff2',
  './templates/timesheet-blank.pdf',
  './templates/holiday-blank.pdf',
  './templates/van-check-blank.pdf',
  './spark-town.html?v=62',
  './cody-snackagotchi.html?v=62',
  './spark-town.js?v=62',
  './spark-town-launcher.js?v=78',
  './black-web.html?v=3',
  './cody-burger-chase.html?v=75',
  './cody-burger-chase.js?v=75',
  './pdf-lib.min.js',
  './manifest.webmanifest',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './annual-leave-request-form.pdf',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        APP_SHELL.map(url => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  if (/\/(drivers|site-config)\.js$/i.test(url.pathname)) return false;
  return /\.(?:js|css|png|jpg|jpeg|svg|woff2|ttf|pdf|webmanifest)$/i.test(url.pathname);
}

function fetchWithTimeout(request, timeoutMs, init) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    fetch(request, init).then(
      response => { clearTimeout(timer); resolve(response); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isNavigation = event.request.mode === 'navigate';

  // Static versioned assets: cache-first for instant load on weak mobile signal.
  if (!isNavigation && isStaticAsset(requestUrl)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML / navigation and dynamic requests: network-first with short timeout, falling back to cache.
  event.respondWith(
    fetchWithTimeout(event.request, NAV_TIMEOUT_MS, isSameOrigin ? { cache: 'no-cache' } : undefined)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (isSameOrigin && isNavigation) return caches.match('./index.html');
        throw new Error('Offline cache miss: ' + event.request.url);
      }))
  );
});
