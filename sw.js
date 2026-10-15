/* Service worker: chỉ hoạt động khi web được host qua http(s).
   App shell: cache trước. Audio: cache khi đã nghe 1 lần hoặc khi bấm "Tải audio học offline".
   Trình phát audio (nhất là Safari iOS) luôn gửi Range request → cắt từ bản cache trả 206 để tua/phát được khi offline. */
var VER = 'eri60-v4';
var AUDIO = 'eri60-audio';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'data.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'fonts/be-vietnam-pro-latin-400-normal.woff2', 'fonts/be-vietnam-pro-latin-600-normal.woff2', 'fonts/be-vietnam-pro-latin-700-normal.woff2',
  'fonts/be-vietnam-pro-vietnamese-400-normal.woff2', 'fonts/be-vietnam-pro-vietnamese-600-normal.woff2', 'fonts/be-vietnam-pro-vietnamese-700-normal.woff2'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VER).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VER && k !== AUDIO; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});

function rangeResponse(full, range) {
  return full.blob().then(function (b) {
    var m = /bytes=(\d*)-(\d*)/.exec(range), size = b.size, start, end;
    if (!m) return new Response(b, { status: 200, headers: { 'Content-Type': full.headers.get('Content-Type') || 'audio/mpeg', 'Content-Length': size } });
    if (m[1] === '') { start = Math.max(0, size - (+m[2] || 0)); end = size - 1; }     // bytes=-N
    else { start = +m[1]; end = m[2] === '' ? size - 1 : Math.min(+m[2], size - 1); }
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    return new Response(b.slice(start, end + 1), { status: 206, headers: {
      'Content-Type': full.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' } });
  });
}

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.indexOf('/audio/') >= 0) {
    var range = e.request.headers.get('range');
    e.respondWith(caches.open(AUDIO).then(function (c) {
      return c.match(url.href, { ignoreSearch: true }).then(function (hit) {
        if (hit) return range ? rangeResponse(hit, range) : hit;
        if (range) return fetch(e.request);                 // chưa tải → để trình duyệt tự stream từ mạng
        return fetch(e.request).then(function (r) { if (r.ok && r.status === 200) c.put(url.href, r.clone()); return r; });
      });
    }));
    return;
  }
  // shell: mạng trước (luôn lấy bản mới), mất mạng thì dùng cache
  e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); if (r.ok) caches.open(VER).then(function (c) { c.put(e.request, cp); }); return r; })
    .catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); }); }));
});
