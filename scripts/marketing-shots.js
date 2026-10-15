// Chụp màn hình app với dữ liệu demo rồi dựng ảnh giới thiệu cho README → docs/images/
// Chạy: node scripts/marketing-shots.js   (cần Google Chrome; tự mở server tĩnh ở cổng 8090)
const fs = require('fs'), path = require('path'), http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'docs/images'), SHOTS = path.join(OUT, 'screens');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 8090, BASE = `http://localhost:${PORT}/`;
fs.mkdirSync(SHOTS, { recursive: true });

/* ---------- server tĩnh tối giản ---------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

/* ---------- dữ liệu demo: đã xong ngày 1–11, đang học ngày 12, chuỗi 12 ngày ---------- */
global.window = {}; eval(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
const DAYS = window.DAYS;
function demoState() {
  const DAY = 864e5, t0 = new Date(); t0.setHours(0, 0, 0, 0); const today = t0.getTime();
  const pad = x => ('0' + x).slice(-2);
  const key = n => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const S = { days: {}, assess: { before: { 0: 2, 1: 3, 2: 2, 3: 2, 4: 3, 5: 2, 6: 3, 7: 2 }, after: {} }, srs: {}, log: {}, last: 12, lastExport: Date.now() - DAY, intro: 1 };
  for (const d of DAYS.filter(d => d.day <= 11)) {
    const st = S.days[d.day] = { done: true, stars: [4, 3, 4, 5, 4][d.day % 5], ph: true, notes: '' };
    if (d.type === 'lesson') { st.trans = d.trans_ans.slice(); st.write = d.phrases.slice(0, 3).map(p => p[0].replace(/\.\.\.|…/g, ' this')).join('. '); st.checks = [true, true, true]; st.listen = d.listen_ans.slice(); }
    (d.phrases || []).forEach((_, i) => { const box = 1 + ((d.day + i) % 4); S.srs[d.day + '-' + i] = { box, due: today + (((d.day + i) % 3) ? 2 : 0) * DAY }; });
  }
  const d12 = DAYS.find(d => d.day === 12);
  S.days[12] = { ph: true, trans: [d12.trans_ans[0], 'I will merge the pull request after the review'], write: '' };
  for (let i = 0; i < 13; i++) if (i !== 5) S.log[key(i)] = 1;          // 1 ngày nghỉ trong tuần → chuỗi vẫn giữ
  return S;
}

/* ---------- chụp ---------- */
const W = 390, H = 844, DPR = 3;
const SCREENS = [
  { name: '01-today', hash: '#/', theme: 'light' },
  { name: '02-lesson', hash: '#/day/12', theme: 'light' },
  { name: '03-translate', hash: '#/day/12', theme: 'light', prep: async p => {
      await p.evaluate(() => { document.querySelector('[data-chk="0"]').click(); document.querySelector('[data-chk="1"]').click();
        const el = document.getElementById('trq0'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 190); }); } },
  { name: '04-roadmap', hash: '#/map', theme: 'dark' },
  { name: '05-review', hash: '#/srs', theme: 'dark', prep: async p => {
      await p.evaluate(() => { const fc = document.getElementById('fc'); if (fc) fc.click(); }); await new Promise(r => setTimeout(r, 600)); } },
  { name: '06-speaking', hash: '#/day/12', theme: 'dark', prep: async p => {
      await p.evaluate(() => { const el = document.getElementById('recBtn').closest('.card'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120); }); } },
];

async function shoot(browser) {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  // Nạp dữ liệu demo bằng script chèn đầu <head>, chạy trước app.js (app tự lưu khi rời trang nên ghi từ trang trước sẽ bị đè)
  let seed = { st: JSON.stringify(demoState()), th: 'light' };
  await page.setBypassServiceWorker(true);   // không cho service worker trả trang (sẽ bỏ qua đoạn chèn dữ liệu)
  await page.setRequestInterception(true);
  page.on('request', r => {
    if (r.resourceType() === 'document') {
      return r.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace('<head>',
        '<head><script>' + (seed.st ? 'localStorage.setItem("eri60_progress_v1",' + JSON.stringify(seed.st) + ');' : 'localStorage.removeItem("eri60_progress_v1");') +
        'localStorage.setItem("eri60_theme","' + seed.th + '");</script>') });
    }
    r.continue();
  });
  for (const s of SCREENS) {
    seed.th = s.theme;
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: s.theme }]);
    await page.goto(BASE + '?shot=' + s.name + s.hash, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 400));
    if (s.prep) { await s.prep(page); await new Promise(r => setTimeout(r, 500)); }
    await page.screenshot({ path: path.join(SHOTS, s.name + '.png') });
    console.log('shot', s.name);
  }
  // màn chào lần đầu (onboarding)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }]);
  seed = { st: '', th: 'light' };
  await page.goto(BASE + '?shot=onboarding#/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: path.join(SHOTS, '00-onboarding.png') }); console.log('shot 00-onboarding');
  await page.close();
}

/* ---------- ảnh giới thiệu (HTML → PNG) ---------- */
const CSS = `
@font-face{font-family:BVP;font-weight:400;src:url(../../fonts/be-vietnam-pro-vietnamese-400-normal.woff2)}
@font-face{font-family:BVP;font-weight:600;src:url(../../fonts/be-vietnam-pro-vietnamese-600-normal.woff2)}
@font-face{font-family:BVP;font-weight:700;src:url(../../fonts/be-vietnam-pro-vietnamese-700-normal.woff2)}
@font-face{font-family:BVPL;font-weight:400;src:url(../../fonts/be-vietnam-pro-latin-400-normal.woff2)}
@font-face{font-family:BVPL;font-weight:600;src:url(../../fonts/be-vietnam-pro-latin-600-normal.woff2)}
@font-face{font-family:BVPL;font-weight:700;src:url(../../fonts/be-vietnam-pro-latin-700-normal.woff2)}
*{box-sizing:border-box;margin:0}
body{font-family:BVPL,BVP,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
.phone{position:relative;border-radius:46px;padding:11px;background:#0B1120;box-shadow:0 0 0 2px #2B3550,0 40px 80px -20px rgba(15,10,60,.55),0 18px 36px -18px rgba(0,0,0,.5)}
.phone::before{content:"";position:absolute;top:19px;left:50%;width:84px;height:24px;margin-left:-42px;border-radius:14px;background:#000;z-index:2}
.phone img{display:block;width:100%;border-radius:0 0 36px 36px}
.sb{display:flex;justify-content:space-between;align-items:center;height:40px;padding:0 26px 0 30px;border-radius:36px 36px 0 0;font-size:14px;font-weight:600}
.sb.light{background:#F8FAFC;color:#0F172A}.sb.dark{background:#0B1120;color:#E2E8F0}
.sb i{display:inline-block;width:22px;height:11px;border:1.5px solid currentColor;border-radius:3px;position:relative}
.sb i::after{content:"";position:absolute;inset:1.5px;right:5px;background:currentColor;border-radius:1px}
.bg-indigo{background:radial-gradient(1200px 700px at 85% 10%,#7C3AED 0%,transparent 60%),radial-gradient(900px 600px at 0% 100%,#312E81 0%,transparent 60%),linear-gradient(135deg,#3730A3,#4F46E5 55%,#6D28D9);color:#fff}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 70% 40%,#000 20%,transparent 75%)}
.chip{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);font-weight:600;font-size:18px}
.dot{width:8px;height:8px;border-radius:50%;background:#4ADE80}
`;
const DARK = ['04-roadmap', '05-review', '06-speaking'];
const img = n => `screens/${n}.png`;
const shot = n => `<div class="sb ${DARK.includes(n) ? 'dark' : 'light'}"><span>9:41</span><i></i></div><img src="${img(n)}">`;

const HERO = `<div class="bg-indigo" style="position:relative;width:1600px;height:900px;overflow:hidden">
<div class="grid"></div>
<div style="position:absolute;left:96px;top:150px;width:700px">
  <div class="chip"><span class="dot"></span>60 ngày · 30 phút mỗi ngày</div>
  <h1 style="font-size:66px;line-height:1.08;font-weight:700;letter-spacing:-.02em;margin:28px 0 22px">Tiếng Anh giao tiếp<br>cho dev remote<br><span style="color:#C7D2FE">&amp; freelancer</span></h1>
  <p style="font-size:24px;line-height:1.5;color:#E0E7FF;max-width:600px">Stand-up, code review, báo bug, làm việc với khách nước ngoài — luyện đủ Cụm từ · Dịch · Viết · Nói · Nghe ngay trên điện thoại.</p>
  <div style="display:flex;gap:12px;margin-top:36px;flex-wrap:wrap"><span class="chip">Học offline</span><span class="chip">Android &amp; iPhone</span><span class="chip">Miễn phí</span></div>
</div>
<div class="phone" style="position:absolute;width:300px;left:860px;top:150px;transform:rotate(-6deg)">${shot('04-roadmap')}</div>
<div class="phone" style="position:absolute;width:300px;left:1250px;top:150px;transform:rotate(6deg)">${shot('02-lesson')}</div>
<div class="phone" style="position:absolute;width:330px;left:1035px;top:95px;z-index:3">${shot('01-today')}</div>
</div>`;

const OG = `<div class="bg-indigo" style="position:relative;width:1200px;height:630px;overflow:hidden">
<div class="grid"></div>
<div style="position:absolute;left:72px;top:110px;width:560px">
  <div class="chip" style="font-size:16px"><span class="dot"></span>Remote IT English</div>
  <h1 style="font-size:54px;line-height:1.1;font-weight:700;letter-spacing:-.02em;margin:24px 0 18px">Tiếng Anh giao tiếp cho dev remote trong 60 ngày</h1>
  <p style="font-size:21px;line-height:1.5;color:#E0E7FF">Mỗi ngày 30 phút · học offline trên điện thoại</p>
</div>
<div class="phone" style="position:absolute;width:250px;left:700px;top:120px;transform:rotate(-5deg)">${shot('04-roadmap')}</div>
<div class="phone" style="position:absolute;width:270px;left:900px;top:70px">${shot('01-today')}</div>
</div>`;

const GAL = [['00-onboarding', 'Bắt đầu', '3 bước làm quen'], ['01-today', 'Hôm nay', 'Bài học + chuỗi ngày'], ['02-lesson', 'Cụm từ', 'Nghe tất cả, che nghĩa'],
  ['03-translate', 'Dịch', 'Kiểm tra từng câu'], ['06-speaking', 'Nói', 'Ghi âm, nghe lại'], ['05-review', 'Ôn tập', 'Thẻ ghi nhớ ngắt quãng']];
const GALLERY = `<div style="position:relative;width:2200px;height:1180px;background:linear-gradient(180deg,#EEF2FF,#F8FAFC 60%);color:#0F172A;overflow:hidden">
<div style="text-align:center;padding-top:80px">
  <div style="display:inline-block;padding:8px 18px;border-radius:999px;background:#E0E7FF;color:#4338CA;font-weight:700;font-size:20px">Một buổi học 30 phút</div>
  <h2 style="font-size:58px;font-weight:700;letter-spacing:-.02em;margin-top:20px">Đủ 5 kỹ năng, mỗi ngày một chủ đề công việc thật</h2>
</div>
<div style="display:flex;justify-content:center;gap:44px;margin-top:70px">
${GAL.map(([n, t, s]) => `<div style="width:300px;text-align:center"><div class="phone" style="width:300px">${shot(n)}</div>
  <div style="font-size:28px;font-weight:700;margin-top:34px">${t}</div><div style="font-size:20px;color:#475569;margin-top:4px">${s}</div></div>`).join('')}
</div></div>`;

async function compose(browser) {
  const page = await browser.newPage();
  const tmp = path.join(OUT, '_compose.html');
  for (const [name, html, w, h] of [['hero', HERO, 1600, 900], ['social-card', OG, 1200, 630], ['gallery', GALLERY, 2200, 1180]]) {
    fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body>${html}</body>`);
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('composed', name);
  }
  fs.unlinkSync(tmp);
  await page.close();
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, pipe: true, args: ['--no-first-run', '--allow-file-access-from-files'] });
  try { await shoot(browser); await compose(browser); }
  finally { await browser.close(); server.close(); }
  console.log('done →', path.relative(ROOT, OUT));
})().catch(e => { console.error(e); process.exit(1); });
