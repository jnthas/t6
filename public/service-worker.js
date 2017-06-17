
var dataCacheName= 't6-cache-2017-06-13';
var cacheName= 't6-cache-2017-06-13';
var filesToCache = [
    '/m',
    '/manifest.json',
    '/css/m/inline.css',
    '/js/m/material.min.js',
    '/js/m/t6app.js',
    '/js/m/menu.js',
    '/js/m/offline.js',
    '/js/m/toast.js',
    '/js/t6.min.js',
    '/js/flot/jquery.flot.js',
    '/js/flot/jquery.flot.time.min.js',
    '/js/m/moment.min-2.18.1.js',

    '/img/opl_img3.jpg',
    '/img/opl_img2.jpg',
    '/img/opl_img.jpg',
    '/img/m/welcome_card.jpg',
    '/img/m/side-nav-bg.jpg',
];

self.addEventListener('hashchange', function() {
    console.log('this view\'s id is ', location.hash.substr(1));
});

self.addEventListener('install', function(e) {
	console.log('[ServiceWorker] Install');
	e.waitUntil(
		caches.open(cacheName).then(function(cache) {
			console.log('[ServiceWorker] Caching app shell');
			return cache.addAll(filesToCache);
		})
	);
});

self.addEventListener('activate', function(e) {
	console.log('[ServiceWorker] Activate');
	e.waitUntil(
		caches.keys().then(function(keyList) {
			return Promise.all(keyList.map(function(key) {
				if (key !== cacheName && key !== dataCacheName) {
					console.log('[ServiceWorker] Removing old cache', key);
					return caches.delete(key);
				}
			}));
		})
	);
	return self.clients.claim();
});

/*
self.addEventListener('fetch', function(e) {
	console.log('[ServiceWorker] Fetch', e.request.url);
	if (e.request.url.indexOf('2.0.1') > -1) {
		// https://jakearchibald.com/2014/offline-cookbook/#cache-then-network
		e.respondWith(
			caches.open(dataCacheName).then(function(cache) {
				console.log('[ServiceWorker] caching t6 for ', e.request.url);
				return fetch(e.request).then(function(response){
					cache.put(e.request.url, response.clone());
					return response;
				});
			})
		);
	} else {
		// https://jakearchibald.com/2014/offline-cookbook/#cache-falling-back-to-network
		console.log('[ServiceWorker] Cache, falling back to the network -> '+e.request.url);
		e.respondWith(
			caches.match(e.request).then(function(response) {
				return response || fetch(e.request);
			})
		);
	}
});
*/
self.addEventListener('fetch', function(event) {
	console.log('Handling fetch event for', event.request.url);
	if (event.request.url.indexOf('2.0.1') > -1) {
		event.respondWith(
			caches.match(event.request).then(function(response) {
				if (response) {
					console.log('Found response in cache');// , response
					return response;
				}
				console.log('No response found in cache. About to fetch from network...');
				toast('No response found in cache. About to fetch from network...', 5000);
				return fetch(event.request).then(function(response) {
					caches.open(cacheName).then(function(cache) {
						console.log('About to put');
						cache.put(event.request, response.clone());
						console.log('Put is done');
						//toast('Put is done.', 5000);
					});
					return response;
				}).catch(function(error) {
					console.error('Fetching failed:', error);

					throw error;
				});
			})
		);
	} else {
		console.log('No caching on this file.');
	}
});