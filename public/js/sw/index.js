require('serviceworker-cache-polyfill');

var version = '19';
var prefix = 'wikioffline';
var staticCacheName = `${prefix}-static-v${version}`;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(staticCacheName).then(cache => {
      return cache.addAll([
        '/',
        '/shell.html',
        '/js/page.js',
        '/js/page-framework.js', // yeahhhh, we're caching waayyyyy more than we need, but keeps the request tests fair
        '/css/head-wiki.css', // don't need this when it's inlined, but helps when rendered with blocking CSS in settings
        '/css/wiki.css'
      ]);
    })
  );
});

var expectedCaches = [
  staticCacheName
];

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key.indexOf(prefix + '-') === 0
            && key.indexOf(`${prefix}-article-`) !== 0
            && expectedCaches.indexOf(key) === -1) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// This will vanish when the ServiceWorker closes,
// but that's cool, I want that.
var jsonTmpCache = {};

self.addEventListener('fetch', event => {
  var requestURL = new URL(event.request.url);

  // catch the root request
  if (requestURL.origin == location.origin) {
    if (requestURL.pathname == '/') {
      event.respondWith(caches.match('/'));
      return;
    }
    if (requestURL.pathname == '/') {
      event.respondWith(caches.match('/shell.html'));
      return;
    }
    if (requestURL.pathname.indexOf('/wiki/') === 0) {
      if (/\.json$/.test(requestURL.pathname)) {
        if (jsonTmpCache[requestURL.href]) {
          var response = jsonTmpCache[requestURL.href];
          delete jsonTmpCache[requestURL.href];
          event.respondWith(response);
        }
        return;
      }
      
      // Get ahead of the pack by starting the json request now
      var jsonURL = new URL(requestURL);
      jsonURL.pathname += '.json';
      jsonURL.search = '';
      jsonTmpCache[jsonURL.href] = fetch(jsonURL, {
        credentials: 'include' // needed for flag cookies
      });

      event.respondWith(caches.match('/shell.html'));
      return; 
    }
  }

  // default fetch behaviour
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('message', event => {
  if (event.data == 'skipWaiting') {
    self.skipWaiting();
  }
});