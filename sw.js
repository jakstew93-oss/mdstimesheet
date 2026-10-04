const CACHE_NAME = 'mdsmiths-timesheet-v59';
const APP_SHELL = [
  './',
  './Index.html',
  './index.html',
  './recent-regs.js',
  './recent-regs.js?v=34',
  './appearance.css?v=59',
  './appearance.js?v=59',
  './widget-import.js?v=59',
  './timesheet-tools.js?v=59',
  './workflow-ui.js?v=59',
  './driver-characters.css?v=59',
  './driver-characters.js?v=59',
  './driver-avatars/jak-stewart-black-shirt.png',
  './driver-avatars/cody-slack-black-shirt.png',
  './driver-avatars/ash-kemp-black-shirt.png',
  './driver-avatars/martyn-evans.png',
  './driver-avatars/matthew-heath-black-shirt.png',
  './driver-avatars/luke-chambers-black-shirt.png',
  './fonts/vt323.ttf',
  './spark-town.html?v=59',
  './cody-snackagotchi.html?v=59',
  './spark-town.js?v=59',
  './spark-town-launcher.js?v=59',
  './pdf-lib.min.js',
  './manifest.webmanifest',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './annual-leave-request-form.pdf',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
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

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isNavigation = event.request.mode === 'navigate';

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => {
        if (cached) return cached;
        if (isSameOrigin && isNavigation) return caches.match('./index.html');
        throw new Error('Offline cache miss: ' + event.request.url);
      }))
  );
});
