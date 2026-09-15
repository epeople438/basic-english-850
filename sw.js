const SHELL = "be850-shell-v8";
const AUDIO = "be850-audio-v1";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./data.js",
  "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== AUDIO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Audio: cache-first, persist on first play so it works offline thereafter.
  if (url.pathname.includes("/audio/")){
    e.respondWith(
      caches.open(AUDIO).then(c => c.match(req).then(hit => hit ||
        fetch(req).then(res => { c.put(req, res.clone()); return res; })))
    );
    return;
  }
  // App shell: network-first (always fresh online), fall back to cache offline.
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(SHELL).then(c => c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});
