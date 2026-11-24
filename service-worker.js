/**
 * Ocson Finance Management System - static asset service worker
 *
 * Only non-sensitive static files are cached. Financial data, session tokens,
 * Apps Script bridge responses, KYC images and documents are NEVER cached.
 */
'use strict';

const CACHE_NAME = 'ocson-static-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './manifest.json',
  './assets/icons/icon.svg',
  './css/main.css',
  './css/themes.css',
  './css/layout.css',
  './css/components.css',
  './css/responsive.css',
  './js/config.js',
  './js/api.js',
  './js/auth.js',
  './js/validation.js',
  './js/app.js',
  './js/login.js',
  './js/dashboard.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(STATIC_ASSETS.map(function (asset) {
        return cache.add(asset).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; })
        .map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('script.google') !== -1) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put('./index.html', copy); });
        }
        return response;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      return cached || fetch(request).then(function (response) {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});
