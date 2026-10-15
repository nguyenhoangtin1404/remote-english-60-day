// Copy web app (tĩnh) vào www/ để Capacitor đóng gói thành APK.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const FILES = ['fonts', 'index.html', 'style.css', 'app.js', 'data.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'audio'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of FILES) fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });
console.log('www/ ready');
