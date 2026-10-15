// Sinh tài nguyên tĩnh (chạy lại khi đổi font/icon): font Be Vietnam Pro tự host + SVG sprite Lucide nhúng trong index.html.
// Kết quả được commit, nên app vẫn chạy không cần build (file://, PWA, APK).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), nm = path.join(root, 'node_modules');

const FONT_DIR = path.join(root, 'fonts');
fs.mkdirSync(FONT_DIR, { recursive: true });
for (const sub of ['latin', 'vietnamese']) for (const w of [400, 600, 700]) {
  const f = `be-vietnam-pro-${sub}-${w}-normal.woff2`;
  fs.copyFileSync(path.join(nm, '@fontsource/be-vietnam-pro/files', f), path.join(FONT_DIR, f));
}

const ICONS = ['house', 'map', 'repeat', 'settings', 'play', 'pause', 'volume-2', 'check', 'star', 'download', 'upload',
  'smartphone', 'flame', 'chevron-left', 'chevron-right', 'arrow-left', 'arrow-right', 'shuffle', 'mic', 'square', 'x',
  'sun', 'moon', 'monitor', 'lightbulb', 'trash-2', 'target', 'trophy', 'book-open', 'headphones', 'languages', 'pen-line',
  'circle-check', 'info', 'lock', 'sparkles', 'rotate-ccw', 'clock', 'list-checks', 'message-square', 'hard-drive-download', 'calendar'];
const sym = ICONS.map(n => {
  const s = fs.readFileSync(path.join(nm, 'lucide-static/icons', n + '.svg'), 'utf8');
  const inner = s.slice(s.indexOf('>', s.indexOf('<svg')) + 1, s.lastIndexOf('</svg>')).replace(/\s*\n\s*/g, '').trim();
  return `<symbol id="i-${n}" viewBox="0 0 24 24">${inner}</symbol>`;
}).join('');
const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">${sym}</svg>`;
const idx = path.join(root, 'index.html');
const html = fs.readFileSync(idx, 'utf8').replace(/<!--icons-->[\s\S]*?<!--\/icons-->/, `<!--icons-->${sprite}<!--/icons-->`);
fs.writeFileSync(idx, html);
console.log('fonts + ' + ICONS.length + ' icons ok');
