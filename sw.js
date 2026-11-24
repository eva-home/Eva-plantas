// Service worker de EVA Plantas: permite abrir la guía sin internet.
// Cuando agregues plantas o cambies algo, sube el número de VERSION para renovar el caché.
var VERSION = "eva-plantas-v1";
var SHELL = ["./", "index.html", "logo.png", "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromCache(req) { return caches.match(req, { ignoreSearch: true }); }

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // La página: primero la red (así ves las plantas nuevas), y si no hay señal, la copia guardada.
  if (req.mode === "navigate" || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(
      Promise.race([
        fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put("index.html", copy); });
          return res;
        }),
        new Promise(function (_, rej) { setTimeout(rej, 4000); })
      ]).catch(function () { return caches.match("index.html"); })
    );
    return;
  }

  // Resto (logo, íconos, tipografías): copia guardada al tiro y se actualiza en segundo plano.
  var isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin === location.origin || isFont) {
    e.respondWith(
      fromCache(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && (res.ok || res.type === "opaque")) {
            var copy = res.clone();
            caches.open(VERSION).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
  }
});
