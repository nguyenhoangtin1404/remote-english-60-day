/* English for Remote IT & Freelancer — 60 ngày (web edition)
   Vanilla JS, chạy offline bằng file:// hoặc host tĩnh. Tiến độ lưu trong localStorage.
   Nội dung sinh từ content/content.json (chung với bản in) → data.js. */
(function () {
  'use strict';
  var DAYS = window.DAYS || [], WEEKS = window.WEEKS || {};
  var KEY = 'eri60_progress_v1';
  var DAY_MS = 864e5, SRS_GAP = [0, 1, 3, 7, 14, 30];   // khoảng ôn (ngày) theo hộp Leitner 1..5
  var app = document.getElementById('app'), side = document.getElementById('sidebar');
  var byDay = {}; DAYS.forEach(function (d) { byDay[d.day] = d; });

  /* ---------- state ---------- */
  function blank() { return { days: {}, assess: { before: {}, after: {} }, srs: {}, last: 1, lastExport: 0 }; }
  function fix(s) { s.days = s.days || {}; s.assess = s.assess || {}; s.assess.before = s.assess.before || {}; s.assess.after = s.assess.after || {}; s.srs = s.srs || {}; return s; }
  var S = load();
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.days) return fix(s); } catch (e) {} return blank(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Không lưu được tiến độ (bộ nhớ trình duyệt bị chặn?)'); } }
  function D(n) { return S.days[n] || (S.days[n] = {}); }
  var saveT; function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 300); }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2600); }
  function words(s) { var m = String(s || '').trim().match(/\S+/g); return m ? m.length : 0; }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function doneCount() { return DAYS.filter(function (d) { return S.days[d.day] && S.days[d.day].done; }).length; }
  function typeLabel(t) { return { lesson: 'Bài học', rest: 'Nghỉ · Pro-tip', review: 'Ôn tập', capstone: 'Capstone' }[t] || t; }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }

  // Chuẩn hoá để so khớp cụm từ: bỏ dấu câu, mở rộng dạng viết tắt (I'm = I am, don't = do not…)
  function norm(s) {
    s = ' ' + String(s).toLowerCase().replace(/[’‘`´]/g, "'") + ' ';
    s = s.replace(/\bcan't\b/g, 'can not').replace(/\bwon't\b/g, 'will not').replace(/\bcannot\b/g, 'can not')
      .replace(/n't\b/g, ' not').replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'ve\b/g, ' have')
      .replace(/'ll\b/g, ' will').replace(/'d\b/g, ' would').replace(/\blet's\b/g, 'let us')
      .replace(/\b(it|that|there|here|what|who|he|she)'s\b/g, '$1 is');
    return ' ' + s.replace(/\.\.\.|…/g, ' ').replace(/[^a-z0-9'\- ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  }
  function stem(en) { return norm(en); }                    // đã có khoảng trắng 2 đầu → khớp nguyên từ
  function uses(text, en) { var s = stem(en); return s.trim().length > 0 && norm(text).indexOf(s) >= 0; }

  /* ---------- page lifecycle (dọn timer, audio, ghi âm khi đổi trang) ---------- */
  var cleanups = [];
  function onLeave(fn) { cleanups.push(fn); }
  function leavePage() { cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} }); if (window.speechSynthesis) speechSynthesis.cancel(); document.onkeydown = null; }

  /* ---------- audio cụm từ (Cole) + dự phòng giọng trình duyệt ---------- */
  var voice = null, player = new Audio();
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    var vs = speechSynthesis.getVoices().filter(function (v) { return /^en[-_]US/i.test(v.lang); });
    voice = vs.filter(function (v) { return /natural|online|google/i.test(v.name); })[0] || vs[0] || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function playPhrase(src, text, rate) {
    rate = rate || 1;
    if (src) { player.pause(); player.src = src; player.playbackRate = rate; player.play().catch(function () { tts(text, rate); }); return; }
    tts(text, rate);
  }
  function tts(text, rate) {
    if (!('speechSynthesis' in window)) { toast('Trình duyệt không hỗ trợ đọc giọng nói'); return; }
    if (!voice) toast('Máy chưa có giọng tiếng Anh (en-US) – âm thanh có thể sai. Cài thêm trong Cài đặt › Giọng nói của Windows.');
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(String(text).replace(/\.\.\.|…/g, ' ').replace(/’/g, "'"));
    u.lang = 'en-US'; u.rate = 0.9 * rate; if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }
  onLeave(function () {});

  /* ---------- SRS (ôn ngắt quãng kiểu Leitner) ---------- */
  function allCards() { var a = []; DAYS.forEach(function (d) { (d.phrases || []).forEach(function (p, i) { a.push({ key: d.day + '-' + i, day: d.day, i: i, en: p[0], vn: p[1], src: d.phrase_audio && d.phrase_audio[i] }); }); }); return a; }
  var CARDS = allCards(), CARD = {}; CARDS.forEach(function (c) { CARD[c.key] = c; });
  function srsAddDay(day) { (byDay[day].phrases || []).forEach(function (_, i) { var k = day + '-' + i; if (!S.srs[k]) S.srs[k] = { box: 1, due: today() + DAY_MS }; }); }
  function srsGrade(key, ok) {
    var c = S.srs[key] || (S.srs[key] = { box: 1, due: today() });
    c.box = ok ? Math.min(5, c.box + 1) : 1;
    c.due = today() + SRS_GAP[c.box] * DAY_MS; save();
  }
  function srsDue() { var t = today(); return Object.keys(S.srs).filter(function (k) { return CARD[k] && S.srs[k].due <= t; }); }

  /* ---------- sidebar & topbar ---------- */
  function renderSidebar(cur) {
    var due = srsDue().length;
    var h = '<a class="dl' + (cur === 'home' ? ' active' : '') + '" href="#/"><span class="n" aria-hidden="true">⌂</span><span class="t">Trang chủ &amp; tiến độ</span></a>' +
      '<a class="dl' + (cur === 'srs' ? ' active' : '') + '" href="#/srs"><span class="n" aria-hidden="true">↻</span><span class="t">Ôn ngắt quãng</span>' + (due ? '<span class="tag" style="background:#fef3c7;color:#92400e">' + due + '</span>' : '') + '</a>';
    var w = 0;
    DAYS.forEach(function (d) {
      if (d.week !== w) { w = d.week; h += '<div class="wk">' + (w === 9 ? 'Capstone' : 'Tuần ' + w) + ' · ' + esc(WEEKS[w] || '') + '</div>'; }
      var st = S.days[d.day] || {};
      var tag = d.type === 'rest' ? 'tip' : d.type === 'review' ? 'ôn' : d.type === 'capstone' ? 'cap' : '';
      h += '<a class="dl' + (st.done ? ' done' : '') + (cur === d.day ? ' active' : '') + '" href="#/day/' + d.day + '"' + (cur === d.day ? ' aria-current="page"' : '') + '>' +
        '<span class="n">' + (st.done ? '<span aria-label="đã xong">✓</span>' : d.day) + '</span><span class="t">' + esc(d.title) + '</span>' +
        (tag ? '<span class="tag">' + tag + '</span>' : '') + '</a>';
    });
    h += '<div class="wk">Khác</div><a class="dl' + (cur === 'assess' ? ' active' : '') + '" href="#/assess"><span class="n" aria-hidden="true">★</span><span class="t">Tự đánh giá đầu / cuối khoá</span></a>';
    side.innerHTML = h;
    var a = $('.dl.active', side); if (a) side.scrollTop = Math.max(0, a.offsetTop - side.clientHeight / 2);
    var c = doneCount();
    document.getElementById('miniBar').style.width = (c / DAYS.length * 100) + '%';
    document.getElementById('miniText').textContent = c + '/' + DAYS.length;
    renderTabs(cur);
  }
  var menuBtn = document.getElementById('menuBtn'), scrim = document.getElementById('scrim'), tabMenu = document.getElementById('tabMenu');
  function drawer(open) {
    side.classList.toggle('open', open); scrim.classList.toggle('show', open); document.body.classList.toggle('lock', open);
    menuBtn.setAttribute('aria-expanded', open); tabMenu.setAttribute('aria-expanded', open);
    if (open) { var a = $('.dl.active', side) || $('.dl', side); if (a) { side.scrollTop = Math.max(0, a.offsetTop - side.clientHeight / 2); setTimeout(function () { a.focus({ preventScroll: true }); }, 260); } }
  }
  menuBtn.onclick = function () { drawer(!side.classList.contains('open')); };
  tabMenu.onclick = function () { drawer(!side.classList.contains('open')); };
  scrim.onclick = function () { drawer(false); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && side.classList.contains('open')) { drawer(false); menuBtn.focus(); } });
  side.addEventListener('click', function (e) { if (e.target.closest('a')) drawer(false); });
  function renderTabs(cur) {
    var next = DAYS.filter(function (d) { return !(S.days[d.day] && S.days[d.day].done); })[0];
    var learn = document.getElementById('tabLearn'); learn.href = '#/day/' + (next ? next.day : 60);
    var due = srsDue().length, b = document.getElementById('tabDue'); b.hidden = !due; b.textContent = due > 99 ? '99+' : due;
    $$('#tabbar [data-tab]').forEach(function (t) {
      var k = t.getAttribute('data-tab'), on = (k === 'home' && cur === 'home') || (k === 'srs' && cur === 'srs') || (k === 'learn' && typeof cur === 'number');
      t.classList.toggle('on', on); if (t.tagName === 'A') { if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); }
    });
  }

  /* ---------- router ---------- */
  function route() {
    leavePage();
    if (side.classList.contains('open')) drawer(false);
    var h = location.hash || '#/', m = h.match(/^#\/day\/(\d+)/);
    window.scrollTo(0, 0);
    if (m && byDay[+m[1]]) { var n = +m[1]; S.last = n; save(); renderDay(byDay[n]); renderSidebar(n); return; }
    if (h.indexOf('#/assess') === 0) { renderAssess(); renderSidebar('assess'); return; }
    if (h.indexOf('#/srs') === 0) { renderSrs(); renderSidebar('srs'); return; }
    renderHome(); renderSidebar('home');
  }
  window.addEventListener('hashchange', route);

  /* ---------- home ---------- */
  function renderHome() {
    document.title = 'English for Remote IT & Freelancer — 60 ngày';
    var c = doneCount(), next = DAYS.filter(function (d) { return !(S.days[d.day] && S.days[d.day].done); })[0];
    var stars = [], w = 0;
    Object.keys(S.days).forEach(function (k) { var x = S.days[k]; if (x.stars) stars.push(x.stars); if (x.write) w += words(x.write); });
    var avg = stars.length ? (sum(stars) / stars.length).toFixed(1) : '–', due = srsDue().length;
    var noBefore = !Object.keys(S.assess.before).some(function (k) { return S.assess.before[k]; });
    var needBackup = c >= 3 && (!S.lastExport || Date.now() - S.lastExport > 7 * DAY_MS);
    var h = '';
    if (noBefore) h += '<div class="card" style="border-color:#fcd34d;background:#fffbeb"><b>Trước khi bắt đầu:</b> chấm nhanh 8 kỹ năng ở cột <b>Đầu khoá</b> (1 phút) để cuối khoá thấy rõ mình tiến bộ bao nhiêu. <a class="btn" href="#/assess" style="margin-left:6px">Tự đánh giá đầu khoá →</a></div>';
    if (needBackup) h += '<div class="card" style="border-color:#93c5fd;background:#eff6ff"><b>Nhắc sao lưu:</b> ' + (S.lastExport ? 'đã hơn 7 ngày bạn chưa' : 'bạn chưa') + ' xuất file tiến độ. Tiến độ chỉ nằm trong trình duyệt này – xoá dữ liệu duyệt web là mất. <button class="btn" id="exp2">⬇ Xuất ngay</button></div>';
    h += '<div class="hero"><h1>English for Remote IT &amp; Freelancer</h1><p>Workbook 60 ngày · 6 cụm từ/ngày · Dịch – Viết – Nói – Nghe. Mỗi ngày 30 phút.</p>' +
      '<div class="row" style="margin-top:16px">' +
      (next ? '<a class="btn primary" href="#/day/' + next.day + '">▶ ' + (c ? 'Học tiếp' : 'Bắt đầu') + ': Ngày ' + next.day + '</a>' : '<span>🎉 Bạn đã hoàn thành cả 60 ngày!</span>') +
      (due ? '<a class="btn" href="#/srs">↻ Ôn ' + due + ' thẻ đến hạn</a>' : '') +
      (S.last && S.last !== (next && next.day) ? '<a class="btn" href="#/day/' + S.last + '">Mở lại ngày ' + S.last + '</a>' : '') +
      '</div></div>';
    h += '<div class="stats"><div class="stat"><b>' + c + '/60</b><span>ngày hoàn thành</span></div>' +
      '<div class="stat"><b>' + Object.keys(S.srs).length + '</b><span>cụm từ trong hộp ôn</span></div>' +
      '<div class="stat"><b>' + w + '</b><span>từ tiếng Anh đã viết</span></div>' +
      '<div class="stat"><b>' + avg + '</b><span>tự chấm trung bình (★)</span></div></div>';
    h += '<div class="card"><h2>Quy trình 30 phút mỗi ngày</h2><div class="grid2" style="margin-top:8px">' +
      '<div class="tip"><b class="h">5 phút — Cụm từ</b>Nghe và đọc to từng cụm 3 lần (bản Shadowing có khoảng lặng để nhại theo), che nghĩa để tự nhớ.</div>' +
      '<div class="tip"><b class="h">8 phút — Dịch và viết</b>Dịch 3 câu rồi mới xem đáp án; viết đoạn ứng dụng dùng ít nhất 3 cụm từ.</div>' +
      '<div class="tip"><b class="h">7 phút — Nghe</b>Lần 1 không nhìn chữ (có bản chậm 0.75). Lần 2 mở transcript để kiểm tra.</div>' +
      '<div class="tip"><b class="h">10 phút — Nói và tự sửa</b>Ghi âm 60–90 giây, nghe lại, sửa 1–2 lỗi rồi nói lại lần 2.</div></div>' +
      '<p class="meta" style="margin:8px 0 0">Tự kiểm tra: □ Đúng yêu cầu □ Rõ tình trạng/vấn đề □ Dùng ít nhất 3 cụm từ □ Có bước tiếp theo □ Đã ghi âm và tự sửa</p></div>';
    h += '<div class="card"><h2>Lộ trình</h2><p class="hint">Mỗi tuần: 5 ngày học + 1 ngày nghỉ (Pro-tip) + 1 ngày ôn tập. Tuần cuối là 4 bài Capstone tổng hợp.</p>';
    Object.keys(WEEKS).forEach(function (wk) {
      var ds = DAYS.filter(function (d) { return d.week === +wk; });
      var dn = ds.filter(function (d) { return S.days[d.day] && S.days[d.day].done; }).length;
      h += '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:8px 0">' +
        '<a href="#/day/' + ds[0].day + '"><b>' + (wk === '9' ? 'Capstone' : 'Tuần ' + wk) + '</b> · ' + esc(WEEKS[wk]) + '</a>' +
        '<span class="meta">' + dn + '/' + ds.length + '</span></div>';
    });
    h += '</div>';
    h += offlineCard();
    h += '<div class="card"><h2>Sao lưu tiến độ</h2><p class="hint">Tiến độ lưu trong trình duyệt này' + (S.lastExport ? ' · lần xuất gần nhất: ' + new Date(S.lastExport).toLocaleDateString('vi-VN') : '') + '. Xuất file để chuyển sang máy khác hoặc phòng khi xoá dữ liệu trình duyệt.</p>' +
      '<div class="row"><button class="btn" id="exp">⬇ Xuất tiến độ (.json)</button><label class="btn" tabindex="0">⬆ Nhập tiến độ<input type="file" id="imp" accept=".json,application/json" hidden></label>' +
      '<button class="btn" id="rst" style="margin-left:auto;color:#dc2626">Xoá toàn bộ tiến độ</button></div></div>';
    app.innerHTML = h;
    function doExport() {
      S.lastExport = Date.now(); save();
      var name = 'tien_do_english_remote_it_' + new Date().toISOString().slice(0, 10) + '.json', json = JSON.stringify(S, null, 1);
      if (NATIVE) {   // WebView trong APK không tải blob được → ghi file rồi mở bảng Chia sẻ (Drive, Zalo, Gmail…)
        var P = window.Capacitor.Plugins;
        P.Filesystem.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' })
          .then(function (r) { return P.Share.share({ title: name, files: [r.uri] }); })
          .then(function () { toast('Đã xuất file tiến độ'); }, function () { toast('Chưa chia sẻ file tiến độ'); });
        return;
      }
      var b = new Blob([json], { type: 'application/json' });
      var a = document.createElement('a'), u = URL.createObjectURL(b); a.href = u;
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 1000); toast('Đã xuất file tiến độ');
    }
    $('#exp').onclick = function () { doExport(); renderHome(); };
    if ($('#exp2')) $('#exp2').onclick = function () { doExport(); renderHome(); };
    $('#imp').onchange = function (e) {
      var f = e.target.files[0]; e.target.value = ''; if (!f) return; var r = new FileReader();
      r.onload = function () {
        var s; try { s = JSON.parse(r.result); } catch (x) { toast('File không phải JSON hợp lệ'); return; }
        var ok = s && typeof s === 'object' && s.days && typeof s.days === 'object' && !Array.isArray(s.days) &&
          Object.keys(s.days).every(function (k) { return /^\d+$/.test(k) && +k >= 1 && +k <= 60 && typeof s.days[k] === 'object'; });
        if (!ok) { toast('File không đúng định dạng tiến độ của workbook'); return; }
        var n = Object.keys(s.days).filter(function (k) { return s.days[k].done; }).length;
        if (!confirm('Nhập file này sẽ THAY THẾ toàn bộ tiến độ hiện tại (' + doneCount() + ' ngày đã xong) bằng tiến độ trong file (' + n + ' ngày đã xong). Tiếp tục?')) return;
        S = fix(s); save(); toast('Đã nhập tiến độ'); route();
      };
      r.readAsText(f);
    };
    $('#rst').onclick = function () { if (confirm('Xoá toàn bộ tiến độ, bài viết, ghi chú và hộp ôn? Không thể hoàn tác.')) { S = blank(); save(); route(); } };
    bindOffline();
  }

  /* ---------- cài app + tải audio để học offline (chỉ bản web; bản APK đã kèm sẵn audio) ---------- */
  var NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var AUDIO_CACHE = 'eri60-audio', installEvt = null;
  var STANDALONE = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; var b = $('#instBtn'); if (b) b.hidden = false; });
  window.addEventListener('appinstalled', function () { installEvt = null; toast('Đã cài app vào máy'); var b = $('#instBtn'); if (b) b.hidden = true; });
  function audioList() {
    var seen = {}, out = [];
    function add(u) { if (u && !seen[u]) { seen[u] = 1; out.push(u); } }
    DAYS.forEach(function (d) { add(d.audio); add(d.audio_slow); add(d.audio_phrases); add(d.audio_shadow); (d.phrase_audio || []).forEach(add); });
    return out;
  }
  function offlineCard() {
    if (NATIVE) return '';
    var canCache = 'caches' in window && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
    var h = '<div class="card"><h2>Học trên điện thoại</h2>';
    if (!STANDALONE) {
      h += '<p class="hint">' + (IOS ? 'iPhone/iPad: mở trang bằng Safari → nút Chia sẻ <b>⎋</b> → <b>Thêm vào MH chính</b>.' : 'Cài trang này như một app để mở nhanh từ màn hình chính, toàn màn hình.') + '</p>' +
        '<button class="btn primary" id="instBtn"' + (installEvt ? '' : ' hidden') + '>📲 Cài app vào máy</button>';
    }
    if (canCache) {
      h += '<p class="hint" style="margin-top:10px">Tải sẵn toàn bộ audio (~60MB) để học khi không có mạng. Nên dùng Wi‑Fi.</p>' +
        '<div class="row"><button class="btn" id="offBtn">⬇ Tải audio học offline</button><button class="btn" id="offDel" hidden>Xoá audio đã tải</button></div>' +
        '<p class="meta" id="offInfo" style="margin:8px 0 0"></p>';
    }
    return h + '</div>';
  }
  function bindOffline() {
    var ib = $('#instBtn');
    if (ib) ib.onclick = function () { if (!installEvt) return; installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; ib.hidden = true; }); };
    var btn = $('#offBtn'), del = $('#offDel'), info = $('#offInfo'); if (!btn) return;
    var list = audioList(), busy = false;
    function status() {
      return caches.open(AUDIO_CACHE).then(function (c) { return c.keys(); }).then(function (ks) {
        var have = {}; ks.forEach(function (r) { have[new URL(r.url).pathname] = 1; });
        var n = list.filter(function (u) { return have[new URL(u, location.href).pathname]; }).length;
        if (!busy) { info.textContent = n ? 'Đã tải ' + n + '/' + list.length + ' file audio.' : ''; btn.textContent = n === list.length ? '✓ Đã tải đủ audio' : n ? '⬇ Tải tiếp audio còn thiếu' : '⬇ Tải audio học offline'; btn.disabled = n === list.length; del.hidden = !n; }
        return have;
      });
    }
    status();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    btn.onclick = function () {
      if (busy) return; busy = true; btn.disabled = true;
      caches.open(AUDIO_CACHE).then(function (c) {
        return status().then(function (have) {
          var todo = list.filter(function (u) { return !have[new URL(u, location.href).pathname]; }), done = list.length - todo.length, fail = 0, i = 0;
          function step() { info.textContent = 'Đang tải ' + done + '/' + list.length + '…'; }
          function worker() {
            if (i >= todo.length) return Promise.resolve();
            var u = todo[i++];
            return fetch(u).then(function (r) { if (!r.ok || r.status !== 200) throw 0; return c.put(u, r); })
              .then(function () { done++; step(); }, function () { fail++; }).then(worker);
          }
          step();
          return Promise.all([worker(), worker(), worker(), worker()]).then(function () { return fail; });
        });
      }).then(function (fail) {
        busy = false; toast(fail ? 'Còn ' + fail + ' file chưa tải được – thử lại khi mạng ổn định' : 'Đã tải xong audio – học offline được rồi'); status();
      }, function () { busy = false; btn.disabled = false; toast('Không tải được (bộ nhớ đầy?)'); });
    };
    del.onclick = function () { if (confirm('Xoá audio đã tải về máy? (Tiến độ học không bị ảnh hưởng.)')) caches.delete(AUDIO_CACHE).then(status); };
  }

  /* ---------- shared blocks ---------- */
  function head(d, sub) {
    return '<div class="dayhead"><span class="badge">Ngày ' + d.day + ' · ' + typeLabel(d.type) + '</span>' +
      '<h1>' + esc(d.title) + '</h1>' + (d.title_en ? '<div class="en">' + esc(d.title_en) + '</div>' : '') +
      (d.tag ? '<div class="en">' + esc(d.tag) + '</div>' : '') + (sub ? '<p class="meta" style="margin:6px 0 0">' + sub + '</p>' : '') + '</div>';
  }
  function card(num, title, hint, body, id) {
    return '<section class="card"' + (id ? ' id="' + id + '"' : '') + '><h2>' + (num ? '<span class="num" aria-hidden="true">' + num + '</span>' : '') + esc(title) + '</h2>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + body + '</section>';
  }
  // Thanh chuyển nhanh giữa các phần trong 1 ngày (dính dưới topbar). labels ứng với các <section.card> theo thứ tự.
  function secnav(labels, doneFn) {
    var secs = $$('section.card', app).slice(0, labels.length), headEl = $('.dayhead', app);
    if (!secs.length || !headEl) return;
    var nav = document.createElement('nav'); nav.className = 'secnav'; nav.setAttribute('aria-label', 'Các phần của bài');
    nav.innerHTML = labels.map(function (l, i) { return '<button type="button" data-i="' + i + '">' + esc(l) + '</button>'; }).join('');
    headEl.insertAdjacentElement('afterend', nav);
    var btns = $$('button', nav);
    btns.forEach(function (b, i) { b.onclick = function () { secs[i].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }; });
    function mark(i) { btns.forEach(function (b, k) { b.classList.toggle('on', k === i); }); var b = btns[i]; if (b) nav.scrollTo({ left: b.offsetLeft - nav.clientWidth / 2 + b.offsetWidth / 2, behavior: 'smooth' }); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) mark(secs.indexOf(e.target)); });
      }, { rootMargin: '-45% 0px -50% 0px' });
      secs.forEach(function (s) { io.observe(s); }); onLeave(function () { io.disconnect(); });
    }
    function ticks() { if (!doneFn) return; var d = doneFn(); btns.forEach(function (b, i) { b.classList.toggle('ok', !!d[i]); }); }
    if (doneFn) { app.addEventListener('input', ticks); app.addEventListener('change', ticks); onLeave(function () { app.removeEventListener('input', ticks); app.removeEventListener('change', ticks); }); ticks(); }
    mark(0);
  }
  function filled(arr, n) { for (var i = 0; i < n; i++) if (!String((arr || [])[i] || '').trim()) return false; return true; }
  function seg(id, items, on, label) {
    return '<span class="seg" id="' + id + '" role="group" aria-label="' + esc(label) + '">' + items.map(function (it) {
      return '<button type="button" data-v="' + esc(it[0]) + '" class="' + (it[0] === on ? 'on' : '') + '" aria-pressed="' + (it[0] === on) + '">' + esc(it[1]) + '</button>';
    }).join('') + '</span>';
  }
  function bindSeg(id, fn) {
    $$('#' + id + ' button').forEach(function (b) {
      b.onclick = function () { $$('#' + id + ' button').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); fn(b.getAttribute('data-v')); };
    });
  }
  function footer(d) {
    var st = D(d.day), i = DAYS.indexOf(d), p = DAYS[i - 1], n = DAYS[i + 1], stars = '';
    for (var k = 1; k <= 5; k++) stars += '<button type="button" data-s="' + k + '" class="' + (st.stars >= k ? 'on' : '') + '" aria-label="' + k + ' trên 5 sao" aria-pressed="' + (st.stars === k) + '">★</button>';
    return card('', 'Ghi chú & tự chấm', 'Ghi lại từ mới, lỗi hay gặp hoặc câu muốn dùng thật trong công việc.',
      '<textarea data-k="notes" aria-label="Ghi chú" placeholder="Ghi chú của bạn…" style="min-height:80px">' + esc(st.notes || '') + '</textarea>' +
      '<div class="row" style="margin-top:8px"><span class="meta">Hôm nay bạn tự tin mức nào?</span><span class="stars" role="group" aria-label="Tự chấm">' + stars + '</span></div>') +
      '<div class="complete"><div><b>' + (st.done ? '✓ Đã hoàn thành ngày ' + d.day : 'Xong bài hôm nay?') + '</b><div class="meta" style="color:#94a3b8">Tiến độ được lưu tự động trên trình duyệt.' + (d.phrases && !st.done ? ' Hoàn thành sẽ đưa 6 cụm từ vào hộp ôn ngắt quãng.' : '') + '</div></div>' +
      '<button type="button" class="btn ' + (st.done ? '' : 'ok') + '" id="doneBtn">' + (st.done ? 'Bỏ đánh dấu' : '✓ Hoàn thành ngày ' + d.day) + '</button></div>' +
      '<nav class="navbtns" aria-label="Chuyển ngày">' + (p ? '<a class="btn" href="#/day/' + p.day + '">← Ngày ' + p.day + '</a>' : '<span></span>') +
      (n ? '<a class="btn primary" href="#/day/' + n.day + '">Ngày ' + n.day + ' →</a>' : '<a class="btn primary" href="#/assess">Tự đánh giá cuối khoá →</a>') + '</nav>';
  }
  function missing(d) {
    var st = D(d.day), m = [];
    function empty(arr, n) { var e = []; for (var i = 0; i < n; i++) if (!String((arr || [])[i] || '').trim()) e.push(i + 1); return e; }
    if (d.type === 'lesson' || d.type === 'capstone') {
      var t = empty(st.trans, 3); if (t.length) m.push('Dịch: câu ' + t.join(', '));
      if (!words(st.write)) m.push('Viết: chưa viết'); else if (d.phrases.filter(function (p) { return uses(st.write, p[0]); }).length < 3) m.push('Viết: chưa đủ 3 cụm từ (theo nhận diện tự động)');
      var c = empty(st.checks, 3); if (c.length) m.push('Nói: còn ' + c.length + ' mục checklist');
      var l = empty(st.listen, 3); if (l.length) m.push('Nghe: câu ' + l.join(', '));
    } else if (d.type === 'review') {
      var r = empty(st.recall, 5); if (r.length) m.push('Nhớ lại: còn ' + r.length + ' cụm');
      if (!words(st.write)) m.push('Viết: chưa viết');
      var rb = empty(st.rubric, 5); if (rb.length) m.push('Nói: còn ' + rb.length + ' tiêu chí chưa chấm');
    }
    return m;
  }
  function bindCommon(d) {
    var st = D(d.day);
    $$('[data-k]', app).forEach(function (el) {
      var k = el.getAttribute('data-k'), i = el.getAttribute('data-i');
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', function () {
        var v = el.type === 'checkbox' ? el.checked : el.value;
        if (i == null) st[k] = v; else { st[k] = st[k] || []; st[k][+i] = v; }
        saveSoon();
      });
    });
    $$('.stars button', app).forEach(function (b) {
      b.onclick = function () { st.stars = +b.getAttribute('data-s'); save(); $$('.stars button', app).forEach(function (x) { var s = +x.getAttribute('data-s'); x.classList.toggle('on', s <= st.stars); x.setAttribute('aria-pressed', s === st.stars); }); };
    });
    $('#doneBtn').onclick = function () {
      if (!st.done) {
        var m = missing(d);
        if (m.length && !confirm('Còn phần chưa làm:\n• ' + m.join('\n• ') + '\n\nVẫn đánh dấu hoàn thành?')) return;
      }
      st.done = !st.done;
      if (st.done && d.phrases) srsAddDay(d.day);
      save();
      if (st.done) { toast('🎉 Hoàn thành ngày ' + d.day + '!'); var n = DAYS[DAYS.indexOf(d) + 1]; if (n) { setTimeout(function () { location.hash = '#/day/' + n.day; }, 600); return; } }
      renderDay(d); renderSidebar(d.day);
    };
    $$('[data-reveal]', app).forEach(function (b) {
      b.onclick = function () { var box = document.getElementById(b.getAttribute('data-reveal')); var on = box.classList.toggle('show-ans'); b.textContent = on ? 'Ẩn đáp án' : 'Xem đáp án'; b.setAttribute('aria-expanded', on); if (b.onreveal) b.onreveal(on); };
    });
  }

  function phrasesTable(d) {
    return '<table class="ph" id="phT">' + d.phrases.map(function (p, i) {
      return '<tr><td style="width:40px"><button type="button" class="say" data-i="' + i + '" aria-label="Nghe: ' + esc(p[0]) + '">🔊</button></td>' +
        '<td class="en" lang="en">' + esc(p[0]) + '</td><td class="vn"><span tabindex="0" role="button" aria-label="Nghĩa tiếng Việt">' + esc(p[1]) + '</span></td></tr>';
    }).join('') + '</table>';
  }

  /* ---------- ghi âm (nhiều lần, gắn với trang hiện tại) ---------- */
  function recorderBlock() {
    return '<div class="row"><button type="button" class="btn rec" id="recBtn">● Ghi âm</button><span class="meta" id="recInfo" aria-live="polite">Ghi âm giọng nói để nghe lại (cần cho phép micro).</span></div>' +
      '<div id="recOut" style="margin-top:8px"></div>';
  }
  function bindRecorder(d, onTake) {
    var btn = $('#recBtn'), info = $('#recInfo'), out = $('#recOut'); if (!btn) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) { btn.disabled = true; info.textContent = 'Trình duyệt không hỗ trợ ghi âm. Hãy dùng Chrome/Edge bản mới.'; return; }
    var rec = null, stream = null, timer = null, alive = true, urls = [], takes = 0;
    function stopAll() { clearInterval(timer); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    onLeave(function () { alive = false; try { if (rec && rec.state === 'recording') rec.stop(); } catch (e) {} stopAll(); urls.forEach(function (u) { URL.revokeObjectURL(u); }); });
    btn.onclick = function () {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        if (!alive) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; var chunks = []; rec = new MediaRecorder(s);
        rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          stopAll();
          if (!alive) return;                       // đã rời trang → bỏ bản ghi, không chèn vào trang khác
          var blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), url = URL.createObjectURL(blob); urls.push(url); takes++;
          var ext = /ogg/.test(blob.type) ? 'ogg' : /mp4/.test(blob.type) ? 'm4a' : 'webm';
          var div = document.createElement('div'); div.className = 'player'; div.style.marginTop = '6px';
          div.innerHTML = '<div class="meta"><b>Lần ' + takes + '</b></div><audio controls src="' + url + '"></audio><div class="row" style="margin-top:6px">' +
            '<a class="btn" download="Ngay' + (d.day < 10 ? '0' : '') + d.day + '_ghi_am_lan' + takes + '.' + ext + '" href="' + url + '">⬇ Tải bản ghi</a>' +
            '<span class="meta">Bản ghi không tự lưu – tải về nếu muốn giữ.</span></div>';
          out.appendChild(div);
          btn.textContent = '● Ghi lần ' + (takes + 1); btn.classList.add('rec'); info.textContent = 'Nghe lại, ghi lỗi, rồi nói lại lần ' + (takes + 1) + '.';
          if (onTake) onTake(takes);
        };
        rec.start(); var t0 = Date.now();
        btn.textContent = '■ Dừng'; btn.classList.remove('rec');
        timer = setInterval(function () { info.textContent = 'Đang ghi… ' + Math.round((Date.now() - t0) / 1000) + ' giây'; }, 500);
      }).catch(function () { info.textContent = 'Không truy cập được micro. Hãy cho phép quyền micro cho trang này.'; });
    };
  }

  /* ---------- lesson / capstone ---------- */
  function renderLesson(d) {
    var st = D(d.day), h = head(d, 'Thời gian: 30 phút');
    var hasShadow = !!d.audio_shadow;
    h += card(1, 'Cụm từ hôm nay', 'Nghe và đọc to mỗi cụm 3 lần. Bản <b>Shadowing</b> đọc mỗi cụm 2 lần, sau mỗi lần có khoảng lặng để bạn nhại theo. Bật "Che nghĩa" để tự kiểm tra – chạm vào ô mờ để xem.',
      '<div class="player" style="margin-bottom:8px">' + (hasShadow ? '<div class="row" style="margin-bottom:8px">' + seg('phMode', [['read', 'Đọc liền'], ['shadow', 'Shadowing']], 'read', 'Kiểu nghe cụm từ') + '</div>' : '') +
      '<audio controls preload="none" id="phAudio" src="' + esc(d.audio_phrases) + '"></audio></div>' +
      '<div class="row"><label class="meta"><input type="checkbox" id="hideVN"> Che nghĩa tiếng Việt</label>' +
      '<span class="meta" style="margin-left:auto">Tốc độ 🔊</span>' + seg('rateSeg', [['1', 'Thường'], ['0.75', 'Chậm']], '1', 'Tốc độ đọc từng cụm') + '</div>' +
      phrasesTable(d));
    h += card(2, 'Dịch sang tiếng Anh', 'Tự dịch trước, sau đó bấm "Xem đáp án". Đáp án là một cách diễn đạt tham khảo – câu khác đúng ngữ pháp, đúng ý vẫn được chấp nhận.',
      '<div id="trBox">' + d.trans.map(function (t, i) {
        return '<div class="q"><label for="tr' + i + '">' + (i + 1) + '. ' + esc(t) + '</label><input type="text" id="tr' + i + '" lang="en" data-k="trans" data-i="' + i + '" value="' + esc((st.trans || [])[i] || '') + '" placeholder="Your English…"><div class="ans">✓ ' + esc(d.trans_ans[i] || '') + '</div></div>';
      }).join('') + '</div><button type="button" class="btn" data-reveal="trBox" aria-expanded="false">Xem đáp án</button>');
    h += card(3, 'Viết ứng dụng — dùng ít nhất 3 cụm từ hôm nay', esc(d.write),
      '<textarea id="wr" lang="en" data-k="write" aria-label="Bài viết" placeholder="Write here…">' + esc(st.write || '') + '</textarea>' +
      '<div class="chips" id="chips">' + d.phrases.map(function (p, i) { return '<span class="chip" data-i="' + i + '">' + esc(p[0]) + '</span>'; }).join('') + '</div>' +
      '<div class="meta" id="wc" aria-live="polite"></div><div class="meta">Nhận diện tự động chỉ là gợi ý (đã hiểu I\'m = I am…); cách viết khác vẫn có thể đúng.</div>');
    var checks = ['Lần 1: đã ghi âm', 'Đã nghe lại, ghi lỗi', 'Lần 2: tốt hơn lần 1'];
    h += card(4, 'Nói — ghi âm, nghe lại và sửa', esc(d.speak),
      recorderBlock() + '<div class="checks" style="margin-top:10px">' + checks.map(function (c, i) {
        return '<label><input type="checkbox" data-k="checks" data-i="' + i + '"' + ((st.checks || [])[i] ? ' checked' : '') + '> ' + c + '</label>';
      }).join('') + '</div>' + (d.criteria ? '<div class="tip"><b class="h">Tiêu chí bài tổng hợp</b>' + esc(d.criteria.replace(/^Tiêu chí bài tổng hợp:\s*/, '')) + '</div>' : ''));
    h += card(5, 'Nghe — trả lời 3 câu hỏi', 'Lần 1: không nhìn transcript (dùng bản Chậm nếu cần). Lần 2: mở transcript để kiểm tra.',
      '<div class="player"><div class="row" style="margin-bottom:8px">' + seg('spdSeg', [['n', 'Bình thường'], ['s', 'Chậm 0.75']], 'n', 'Tốc độ bài nghe') +
      '<button type="button" class="btn" id="tsBtn" style="margin-left:auto" aria-expanded="false">Hiện transcript</button></div>' +
      '<audio controls preload="none" id="lis" src="' + esc(d.audio) + '"></audio>' +
      '<div class="transcript" id="ts" lang="en">' + esc(d.transcript) + '</div></div>' +
      '<div id="lsBox">' + d.questions.map(function (q, i) {
        return '<div class="q"><label for="ls' + i + '">' + (i + 1) + '. ' + esc(q) + '</label><input type="text" id="ls' + i + '" data-k="listen" data-i="' + i + '" value="' + esc((st.listen || [])[i] || '') + '"><div class="ans">✓ ' + esc(d.listen_ans[i] || '') + '</div></div>';
      }).join('') + '</div><button type="button" class="btn" data-reveal="lsBox" id="lsReveal" aria-expanded="false">Xem đáp án</button>' +
      '<div id="cmp" style="display:none;margin-top:12px"><div class="tip"><b class="h">So sánh bài viết của bạn với đoạn mẫu</b>Transcript là một đoạn mẫu cùng chủ đề, dùng đúng các cụm từ hôm nay. Đối chiếu cách mở đầu, cách nêu vấn đề và bước tiếp theo.</div>' +
      '<div class="grid2"><div class="player"><div class="meta"><b>Bài của bạn</b></div><div id="cmpMine" lang="en" style="white-space:pre-wrap"></div></div><div class="player"><div class="meta"><b>Đoạn mẫu</b></div><div lang="en">' + esc(d.transcript) + '</div></div></div></div>');
    h += footer(d);
    app.innerHTML = h;
    bindCommon(d);
    secnav(['1 Cụm từ', '2 Dịch', '3 Viết', '4 Nói', '5 Nghe', 'Ghi chú'], function () {
      return [false, filled(st.trans, 3), d.phrases.filter(function (p) { return uses(st.write || '', p[0]); }).length >= 3, filled(st.checks, 3), filled(st.listen, 3), !!st.stars];
    });
    bindRecorder(d, function (n) { var cb = $$('[data-k="checks"]', app)[0]; if (n >= 1 && cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); } });

    var rate = 1;
    $('#hideVN').onchange = function () { $('#phT').classList.toggle('hidevn', this.checked); $$('#phT td.vn span').forEach(function (s) { s.classList.remove('peek'); }); };
    $$('#phT td.vn span').forEach(function (s) { s.onclick = s.onkeydown = function (e) { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); s.classList.toggle('peek'); }; });
    bindSeg('rateSeg', function (v) { rate = +v; $('#phAudio').playbackRate = rate; });
    $$('#phT .say').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-i'); playPhrase(d.phrase_audio && d.phrase_audio[i], d.phrases[i][0], rate); }; });
    var ph = $('#phAudio');
    if (hasShadow) bindSeg('phMode', function (v) { ph.pause(); ph.src = v === 'shadow' ? d.audio_shadow : d.audio_phrases; ph.load(); ph.playbackRate = rate; });
    ph.addEventListener('play', function () { ph.playbackRate = rate; player.pause(); });
    var lis = $('#lis');
    bindSeg('spdSeg', function (v) {
      var playing = !lis.paused, ratio = lis.duration ? lis.currentTime / lis.duration : 0;
      lis.src = v === 's' ? d.audio_slow : d.audio;
      lis.addEventListener('loadedmetadata', function f() { lis.removeEventListener('loadedmetadata', f); if (ratio && lis.duration) lis.currentTime = ratio * lis.duration; if (playing) lis.play(); });
      lis.load();
    });
    onLeave(function () { ph.pause(); lis.pause(); player.pause(); });
    function showCmp() { if (!words($('#wr').value)) return; $('#cmpMine').textContent = $('#wr').value; $('#cmp').style.display = ''; }
    $('#tsBtn').onclick = function () { var o = $('#ts').classList.toggle('open'); this.textContent = o ? 'Ẩn transcript' : 'Hiện transcript'; this.setAttribute('aria-expanded', o); if (o) showCmp(); };
    $('#lsReveal').onreveal = function (on) { if (on) showCmp(); };
    function upd() {
      var t = $('#wr').value, used = 0;
      $$('#chips .chip').forEach(function (c, i) { var u = uses(t, d.phrases[i][0]); c.classList.toggle('used', u); if (u) used++; });
      $('#wc').innerHTML = words(t) + ' từ · đã dùng <b style="color:' + (used >= 3 ? 'var(--ok)' : 'inherit') + '">' + used + '/6</b> cụm từ' + (used >= 3 ? ' ✓ đạt mục tiêu' : ' (mục tiêu ≥ 3)');
    }
    $('#wr').addEventListener('input', upd); upd();
  }

  /* ---------- rest (theo bản in: đọc Pro-tip 10–15 phút, suy ngẫm, nghỉ) ---------- */
  function renderRest(d) {
    var st = D(d.day), h = head(d, 'Ngày nghỉ nạp năng lượng · Đọc thư giãn 10–15 phút · không có bài tập bắt buộc');
    h += card('💡', 'Pro-tip', esc(d.intro), (d.points || []).map(function (p) {
      return '<div class="tip"><b class="h">' + esc(p[0]) + '</b>' + p[1] + '</div>';   // p[1] là HTML do ban biên tập soạn sẵn
    }).join(''));
    h += card('✍', 'Góc suy ngẫm (tuỳ chọn)', '<b>Câu hỏi suy ngẫm:</b> ' + esc(d.reflect || ''),
      '<textarea data-k="reflect" aria-label="Suy ngẫm" placeholder="Viết vài dòng (tiếng Việt hoặc tiếng Anh)…" style="min-height:80px">' + esc(st.reflect || '') + '</textarea>' +
      '<div class="q"><label for="fav">Một cụm từ hoặc kinh nghiệm tôi tâm đắc nhất:</label><input type="text" id="fav" data-k="fav" value="' + esc(st.fav || '') + '"></div>' +
      '<div class="checks"><label><input type="checkbox" data-k="rested"' + (st.rested ? ' checked' : '') + '> Tôi đã dành thời gian nghỉ ngơi, nạp lại năng lượng và sẵn sàng cho tuần tiếp theo!</label></div>');
    h += footer(d);
    app.innerHTML = h; bindCommon(d);
  }

  /* ---------- review (theo bản in: 30 phút, KHÔNG xem tài liệu 10 phút đầu) ---------- */
  function flashcards(cards, opt) {
    // opt: {grade:true} để hiện nút Nhớ/Chưa nhớ (ghi vào hộp ôn)
    return '<div class="flash" id="fc" role="button" tabindex="0" aria-live="polite"></div><div class="row" style="margin-top:10px;justify-content:space-between">' +
      '<div class="row"><button type="button" class="btn" id="fcPrev" aria-label="Thẻ trước">←</button><button type="button" class="btn" id="fcNext" aria-label="Thẻ sau">→</button>' +
      (opt && opt.shuffle !== false ? '<button type="button" class="btn" id="fcShuf">🔀 Trộn</button>' : '') + '<button type="button" class="btn" id="fcSay">🔊 Nghe</button></div>' +
      '<span class="meta" id="fcPos"></span></div>' +
      (opt && opt.grade ? '<div class="row" id="fcGrade" style="margin-top:8px;display:none"><button type="button" class="btn" id="fcNo" style="border-color:#f59e0b">✗ Chưa nhớ</button><button type="button" class="btn ok" id="fcYes">✓ Nhớ</button><span class="meta">Ghi vào hộp ôn ngắt quãng</span></div>' : '') +
      '<div class="row" style="margin-top:8px"><label class="meta"><input type="checkbox" id="fcDir"> Đảo chiều (EN → VN)</label></div>';
  }
  function bindFlash(cards, opt) {
    opt = opt || {};
    var order = cards.map(function (_, i) { return i; }), pos = 0, flipped = false, fc = $('#fc');
    function cur() { return cards[order[pos]]; }
    function show() {
      if (!cards.length) { fc.innerHTML = '<div>' + (opt.empty || 'Không có thẻ.') + '</div>'; ['#fcPrev', '#fcNext', '#fcShuf', '#fcSay'].forEach(function (s) { if ($(s)) $(s).disabled = true; }); return; }
      var c = cur(), rev = $('#fcDir').checked, front = rev ? c.en : c.vn, back = rev ? c.vn : c.en;
      fc.innerHTML = '<div><span' + ((flipped ? !rev : rev) ? ' lang="en"' : '') + '>' + esc(flipped ? back : front) + '</span><small>' + (flipped ? 'Ngày ' + c.day + ' · chạm để lật lại' : 'Nói to câu trả lời, rồi chạm để xem') + '</small></div>';
      fc.style.background = flipped ? 'linear-gradient(135deg,#f0fdf4,#fff)' : '';
      $('#fcPos').textContent = (pos + 1) + ' / ' + cards.length;
      if ($('#fcGrade')) $('#fcGrade').style.display = flipped ? '' : 'none';
    }
    function go(k) { if (!cards.length) return; pos = (pos + k + cards.length) % cards.length; flipped = false; show(); }
    function flip() { if (!cards.length) return; flipped = !flipped; show(); if (flipped && !$('#fcDir').checked) playPhrase(cur().src, cur().en, 1); }
    var swiped = false, tx = 0, ty = 0;
    fc.addEventListener('touchstart', function (e) { swiped = false; tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    fc.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; go(dx < 0 ? 1 : -1); }
    }, { passive: true });
    fc.onclick = function () { if (swiped) { swiped = false; return; } flip(); };
    fc.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
    $('#fcPrev').onclick = function () { go(-1); }; $('#fcNext').onclick = function () { go(1); };
    if ($('#fcShuf')) $('#fcShuf').onclick = function () { for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; } pos = 0; flipped = false; show(); toast('Đã trộn thẻ'); };
    $('#fcSay').onclick = function () { if (cards.length) playPhrase(cur().src, cur().en, 1); };
    $('#fcDir').onchange = function () { flipped = false; show(); };
    function grade(ok) {
      srsGrade(cur().key, ok);
      if (opt.removeOnGrade) { cards.splice(order[pos], 1); order = cards.map(function (_, i) { return i; }); if (pos >= cards.length) pos = 0; flipped = false; show(); if (opt.onChange) opt.onChange(); }
      else { toast(ok ? 'Đã ghi: nhớ' : 'Đã ghi: chưa nhớ – sẽ gặp lại sớm'); go(1); }
    }
    if ($('#fcYes')) { $('#fcYes').onclick = function () { grade(true); }; $('#fcNo').onclick = function () { grade(false); }; }
    document.onkeydown = function (e) {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
    };
    show();
  }

  function renderReview(d) {
    var st = D(d.day), h = head(d, '30 phút · <b>Không xem lại tài liệu trong 10 phút đầu</b> · Tự đánh giá: <span id="rubTop">__</span>/25 điểm');
    var lessons = DAYS.filter(function (x) { return x.week === d.week && (x.type === 'lesson' || x.type === 'capstone'); });
    var cards = []; lessons.forEach(function (x) { x.phrases.forEach(function (p, i) { cards.push({ key: x.day + '-' + i, en: p[0], vn: p[1], day: x.day, src: x.phrase_audio && x.phrase_audio[i] }); }); });
    h += '<div class="card row" style="justify-content:space-between"><span id="tmr" class="meta" aria-live="polite"></span><button type="button" class="btn primary" id="tmrBtn"></button></div>';
    h += card('A', 'Nhớ lại — viết 5 cụm từ và nghĩa', 'Không mở sách hay flashcard. Ô cụm từ sẽ xanh nếu khớp một cụm từ của tuần.',
      '<div id="rcBox">' + [0, 1, 2, 3, 4].map(function (i) {
        return '<div class="grid2 q"><input type="text" lang="en" class="rc" aria-label="Cụm từ ' + (i + 1) + '" data-k="recall" data-i="' + i + '" value="' + esc((st.recall || [])[i] || '') + '" placeholder="' + (i + 1) + '. Cụm từ tiếng Anh…">' +
          '<input type="text" aria-label="Nghĩa cụm từ ' + (i + 1) + '" data-k="recallVn" data-i="' + i + '" value="' + esc((st.recallVn || [])[i] || '') + '" placeholder="Nghĩa tiếng Việt…"></div>';
      }).join('') + '</div>');
    h += card('B', 'Viết — cập nhật tiến độ / email / Slack', 'Nêu rõ: tình trạng hiện tại, việc đã hoàn thành, bước tiếp theo, blocker và deadline (nếu có).',
      '<textarea id="wr" lang="en" data-k="write" aria-label="Bài viết" placeholder="Write here…">' + esc(st.write || '') + '</textarea><div class="meta" id="wc" aria-live="polite"></div>');
    var rub = ['Nói đủ ý', 'Rõ nghĩa, tự nhiên', 'Dùng đúng cụm từ', 'Biết làm rõ / hỏi lại', 'Mạch lạc, tự tin'];
    h += card('C', 'Nói — ghi âm 60–90 giây và tự chấm 5 tiêu chí', 'Mỗi tiêu chí 1–5 điểm.',
      recorderBlock() + '<table class="assess" style="margin-top:10px">' + rub.map(function (r, i) {
        var v = (st.rubric || [])[i] || '';
        return '<tr><td><label for="rb' + i + '">' + r + '</label></td><td style="width:90px"><select id="rb' + i + '" data-k="rubric" data-i="' + i + '"><option value="">–</option>' +
          [1, 2, 3, 4, 5].map(function (n) { return '<option' + (String(v) === String(n) ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></td></tr>';
      }).join('') + '</table><div class="meta" id="rubT" style="margin:6px 0 10px"></div>' +
      '<div class="q"><label for="good">Một điểm làm tốt:</label><input type="text" id="good" data-k="good" value="' + esc(st.good || '') + '"></div>' +
      '<div class="q"><label for="improve">Một điểm cần cải thiện ở tuần sau:</label><input type="text" id="improve" data-k="improve" value="' + esc(st.improve || '') + '"></div>');
    h += card('D', 'Đối chiếu & ôn lại ' + cards.length + ' cụm từ của tuần', 'Chỉ mở sau khi đã tự làm phần A. Bấm Nhớ / Chưa nhớ để đưa thẻ vào hộp ôn ngắt quãng.',
      '<div id="fcLock"><p class="meta" id="lockMsg"></p><button type="button" class="btn" id="unlock">Mở flashcard</button></div><div id="fcWrap" style="display:none">' + flashcards(cards, { grade: true }) + '</div>');
    h += footer(d);
    app.innerHTML = h; bindCommon(d); bindRecorder(d);
    secnav(['A Nhớ lại', 'B Viết', 'C Nói', 'D Đối chiếu'], function () { return [filled(st.recall, 5), words(st.write) > 0, filled(st.rubric, 5), false]; });

    // đồng hồ 30 phút + khoá flashcard 10 phút đầu
    function elapsed() { return st.start ? Math.floor((Date.now() - st.start) / 1000) : 0; }
    function mmss(s) { return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
    function tick() {
      var e = elapsed();
      $('#tmr').innerHTML = st.start ? (e < 1800 ? '⏱ Đã học <b>' + mmss(e) + '</b> / 30:00' : '⏱ Đã đủ 30 phút') : 'Bấm "Bắt đầu" để tính giờ. 10 phút đầu: làm phần A mà không xem lại tài liệu.';
      $('#tmrBtn').textContent = st.start ? 'Bắt đầu lại' : '▶ Bắt đầu 30 phút';
      $('#lockMsg').textContent = st.unlocked ? '' : (st.start && e >= 600 ? 'Đã qua 10 phút – bạn có thể mở flashcard để đối chiếu.' : 'Flashcard đang ẩn để bạn tự nhớ lại trước (còn ' + mmss(Math.max(0, 600 - e)) + ').');
      if (st.unlocked || (st.start && e >= 600)) { $('#fcLock').style.display = 'none'; $('#fcWrap').style.display = ''; }
    }
    $('#tmrBtn').onclick = function () { st.start = Date.now(); st.unlocked = false; save(); $('#fcLock').style.display = ''; $('#fcWrap').style.display = 'none'; tick(); };
    $('#unlock').onclick = function () {
      if (!(st.start && elapsed() >= 600) && !confirm('Sách khuyên không xem lại tài liệu trong 10 phút đầu để luyện nhớ chủ động. Vẫn mở flashcard?')) return;
      st.unlocked = true; save(); tick();
    };
    var iv = setInterval(tick, 1000); onLeave(function () { clearInterval(iv); player.pause(); }); tick();
    bindFlash(cards, { grade: true });

    function chk() {
      $$('.rc').forEach(function (el) {
        var v = norm(el.value).trim(), ok = v.length > 3 && cards.some(function (c) { var s = stem(c.en).trim(); return s && (v.indexOf(s) >= 0 || (s.indexOf(v) >= 0 && v.length >= s.length * 0.7)); });
        el.style.borderColor = !v ? '' : ok ? 'var(--ok)' : 'var(--warn)'; el.style.background = !v ? '' : ok ? '#f0fdf4' : '#fffbeb';
      });
    }
    $$('.rc').forEach(function (el) { el.addEventListener('input', chk); }); chk();
    function upd() { var t = $('#wr').value, used = cards.filter(function (c) { return uses(t, c.en); }).length; $('#wc').textContent = words(t) + ' từ · đã dùng ' + used + ' cụm từ của tuần'; }
    $('#wr').addEventListener('input', upd); upd();
    function rubT() { var a = (st.rubric || []).filter(Boolean).map(Number), s = a.length ? sum(a) : null; $('#rubT').textContent = a.length ? 'Tổng: ' + s + '/25' + (a.length < 5 ? ' (mới chấm ' + a.length + '/5 tiêu chí)' : '') : ''; $('#rubTop').textContent = a.length ? s : '__'; }
    $$('select[data-k="rubric"]', app).forEach(function (s) { s.addEventListener('change', function () { setTimeout(rubT, 0); }); }); rubT();
  }

  function renderDay(d) {
    if (d.type === 'rest') renderRest(d);
    else if (d.type === 'review') renderReview(d);
    else renderLesson(d);
    document.title = 'Ngày ' + d.day + ' · ' + d.title + ' — English for Remote IT';
  }

  /* ---------- SRS page ---------- */
  function renderSrs() {
    document.title = 'Ôn ngắt quãng — English for Remote IT';
    var keys = Object.keys(S.srs).filter(function (k) { return CARD[k]; }), due = srsDue();
    var boxes = [0, 0, 0, 0, 0]; keys.forEach(function (k) { boxes[S.srs[k].box - 1]++; });
    var h = '<div class="dayhead"><span class="badge">Ôn ngắt quãng</span><h1>Hộp ôn cụm từ</h1><div class="en">Spaced repetition · hộp Leitner</div></div>';
    h += card('', 'Hôm nay: ' + due.length + ' thẻ đến hạn', 'Mỗi khi bạn hoàn thành một ngày học, 6 cụm từ được đưa vào hộp 1. Nhớ → lên hộp cao hơn và lâu hơn mới gặp lại (1 → 3 → 7 → 14 → 30 ngày). Chưa nhớ → về hộp 1, gặp lại ngày mai.',
      '<div class="stats" style="margin:0">' + boxes.map(function (n, i) { return '<div class="stat"><b>' + n + '</b><span>Hộp ' + (i + 1) + ' · ôn sau ' + SRS_GAP[i + 1] + ' ngày</span></div>'; }).join('') + '</div>');
    var cards = due.map(function (k) { return CARD[k]; }).sort(function (a, b) { return S.srs[a.key].box - S.srs[b.key].box || a.day - b.day; });
    h += card('', 'Phiên ôn', '', flashcards(cards, { grade: true, shuffle: false }) + '<p class="meta" id="srsLeft"></p>');
    app.innerHTML = h;
    function left() { $('#srsLeft').textContent = cards.length ? 'Còn ' + cards.length + ' thẻ trong phiên.' : (keys.length ? '🎉 Hết thẻ đến hạn hôm nay. Quay lại vào ngày mai!' : ''); renderSidebar('srs'); }
    bindFlash(cards, { grade: true, removeOnGrade: true, onChange: left, empty: keys.length ? '🎉 Không còn thẻ đến hạn hôm nay.' : 'Hộp ôn đang trống. Hoàn thành một ngày học để thêm cụm từ.' });
    onLeave(function () { player.pause(); });
    left();
  }

  /* ---------- assessment ---------- */
  var SKILLS = ['Giới thiệu bản thân 60s', 'Cập nhật stand-up', 'Mô tả blocker & nhờ hỗ trợ', 'Hỏi lại khi chưa hiểu rõ',
    'Giải thích kỹ thuật dễ hiểu', 'Làm rõ phạm vi với khách', 'Báo tiến độ và rủi ro', 'Trả lời phỏng vấn Remote IT'];
  function renderAssess() {
    document.title = 'Tự đánh giá — English for Remote IT';
    var A = S.assess;
    A.evidence = A.evidence || {};
    function sel(which, i) {
      var v = A[which][i] || '';
      return '<select data-w="' + which + '" data-i="' + i + '" aria-label="' + esc(SKILLS[i]) + ' – ' + (which === 'before' ? 'đầu khoá' : 'cuối khoá') + '"><option value="">–</option>' + [1, 2, 3, 4, 5].map(function (n) { return '<option' + (String(v) === String(n) ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>';
    }
    var h = '<div class="dayhead"><span class="badge">Tự đánh giá</span><h1>Bảng đánh giá năng lực đầu &amp; cuối khoá</h1><div class="en">1 = rất khó, chưa phản xạ · 3 = làm được nhưng còn ngập ngừng · 5 = tự tin, trôi chảy</div></div>';
    h += card('', '8 năng lực cốt lõi', 'Chấm cột "Đầu khoá" trước ngày 1, cột "Cuối khoá" sau ngày 60. Ghi bằng chứng cụ thể (bài viết, bản ghi âm, ticket…).',
      '<table class="assess skills"><tr class="th"><th>Năng lực</th><th>Đầu khoá</th><th>Cuối khoá</th><th>Tiến bộ</th><th>Bằng chứng</th></tr>' +
      SKILLS.map(function (s, i) { return '<tr><td class="sk">' + s + '</td><td data-l="Đầu khoá">' + sel('before', i) + '</td><td data-l="Cuối khoá">' + sel('after', i) + '</td><td class="dv" data-i="' + i + '" data-l="Tiến bộ"></td><td class="ev"><input type="text" data-e="' + i + '" aria-label="Bằng chứng: ' + esc(s) + '" value="' + esc(A.evidence[i] || '') + '" placeholder="Bằng chứng (bài viết, bản ghi, ticket…)" style="min-width:160px"></td></tr>'; }).join('') +
      '<tr class="avg"><th>Trung bình</th><th id="avB"></th><th id="avA"></th><th id="avD"></th><th></th></tr></table>');
    h += card('', 'Mục tiêu sau khoá học', '', '<textarea id="goal" aria-label="Mục tiêu" placeholder="Ví dụ: tự tin nói stand-up 2 phút, nhận được 1 khách hàng nước ngoài…">' + esc(A.goal || '') + '</textarea>');
    h += card('', 'Kế hoạch duy trì sau 60 ngày', '', '<ul style="margin:0;padding-left:18px"><li>Mỗi tuần ghi âm 2 tình huống: 1 lần mô tả task/blocker, 1 lần tóm tắt quyết định kỹ thuật.</li><li>Mỗi tuần viết 2 tin nhắn/email cho đồng nghiệp/khách hàng.</li><li>Tiếp tục dùng trang <a href="#/srs">Ôn ngắt quãng</a> mỗi ngày vài phút.</li><li>Kỹ năng dưới 3/5: quay lại các ngày học tương ứng để luyện lại.</li></ul>');
    app.innerHTML = h;
    function calc() {
      function avg(o) { var a = SKILLS.map(function (_, i) { return +o[i] || 0; }).filter(Boolean); return a.length ? sum(a) / a.length : null; }
      $$('.dv').forEach(function (td) { var i = td.getAttribute('data-i'), b = +A.before[i], a = +A.after[i]; td.textContent = b && a ? (a - b > 0 ? '+' : '') + (a - b) : ''; td.style.color = a - b > 0 ? 'var(--ok)' : ''; });
      var b = avg(A.before), a = avg(A.after);
      $('#avB').textContent = b ? b.toFixed(1) : ''; $('#avA').textContent = a ? a.toFixed(1) : ''; $('#avD').textContent = a && b ? (a - b >= 0 ? '+' : '') + (a - b).toFixed(1) : '';
    }
    $$('select[data-w]', app).forEach(function (s) { s.onchange = function () { A[s.getAttribute('data-w')][s.getAttribute('data-i')] = s.value; save(); calc(); }; });
    $$('input[data-e]', app).forEach(function (el) { el.oninput = function () { A.evidence[el.getAttribute('data-e')] = el.value; saveSoon(); }; });
    $('#goal').oninput = function () { A.goal = this.value; saveSoon(); };
    calc();
  }

  /* ---------- PWA: chỉ đăng ký khi chạy qua http(s) ---------- */
  if (!NATIVE && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  window.addEventListener('beforeunload', save);
  window.__eri = { norm: norm, uses: uses, srsDue: srsDue, player: player, state: function () { return S; } };   // dùng cho test tự động
  route();
})();
