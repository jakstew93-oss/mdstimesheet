const CACHE_NAME = 'mdsmiths-timesheet-v53';
const APP_SHELL = [
  './',
  './Index.html',
  './index.html',
  './recent-regs.js',
  './recent-regs.js?v=34',
  './appearance.css?v=51',
  './appearance.js?v=51',
  './widget-import.js?v=51',
  './timesheet-tools.js?v=51',
  './workflow-ui.js?v=51',
  './driver-characters.css?v=51',
  './driver-characters.js?v=51',
  './driver-avatars/jak-stewart.png',
  './driver-avatars/cody-slack.png',
  './driver-avatars/ash-kemp.png',
  './driver-avatars/martyn-evans.png',
  './driver-avatars/matthew-heath.png',
  './driver-avatars/luke-chambers.png',
  './fonts/vt323.ttf',
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
