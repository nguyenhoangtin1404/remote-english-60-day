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
  var NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var PL = NATIVE && window.Capacitor.Plugins || {};      // plugin Capacitor (Haptics, StatusBar, App, Filesystem, Share)

  /* ---------- state ---------- */
  function blank() { return { days: {}, assess: { before: {}, after: {} }, srs: {}, log: {}, last: 1, lastExport: 0 }; }
  function fix(s) { s.days = s.days || {}; s.assess = s.assess || {}; s.assess.before = s.assess.before || {}; s.assess.after = s.assess.after || {}; s.srs = s.srs || {}; s.log = s.log || {}; return s; }
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
  function ic(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function nextDay() { return DAYS.filter(function (d) { return !(S.days[d.day] && S.days[d.day].done); })[0]; }
  function reduced() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function noop() {}
  function haptic(kind) {   // chỉ trong APK: rung nhẹ khi chấm thẻ, rung "thành công" khi hoàn thành ngày
    if (!PL.Haptics) return;
    try { (kind === 'success' ? PL.Haptics.notification({ type: 'SUCCESS' }) : PL.Haptics.impact({ style: 'LIGHT' })).catch(noop); } catch (e) {}
  }
  var modals = [];          // hàm đóng của sheet / onboarding đang mở — dùng cho Esc và nút Back Android
  function trapTab(e, root) {
    var f = $$('button, a[href], input', root).filter(function (x) { return !x.disabled && x.offsetParent !== null; }), a = f[0], z = f[f.length - 1];
    if (!a) return;
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }

  /* ---------- chuỗi ngày học: mỗi 7 ngày được nghỉ 1 ngày (như ngày Pro-tip) mà không đứt chuỗi ---------- */
  function dkey(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function logActivity() { S.log[dkey(new Date())] = 1; }
  function streak() {
    var d = new Date(), active = !!S.log[dkey(d)], n = 0, lastRest = -99;
    d.setHours(12, 0, 0, 0);
    if (!active) d.setDate(d.getDate() - 1);          // hôm nay chưa học: chuỗi tính đến hôm qua, vẫn còn giữ
    for (var i = 0; i < 1000; i++, d.setDate(d.getDate() - 1)) {
      if (S.log[dkey(d)]) n++;
      else if (i - lastRest >= 7) lastRest = i;       // dùng ngày nghỉ của tuần này
      else break;
    }
    return { n: n, today: active };
  }

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
  function playPhrase(src, text, rate, onend) {   // onend: gọi khi đọc xong (dùng cho "Nghe tất cả")
    rate = rate || 1;
    player.onended = player.onerror = null;
    if (onend) { var cb = onend, fired = false; onend = function () { if (!fired) { fired = true; cb(); } }; }
    if (src) {
      player.pause(); player.src = src; player.playbackRate = rate;
      if (onend) player.onended = player.onerror = function () { player.onended = player.onerror = null; onend(); };
      player.play().catch(function () { player.onended = player.onerror = null; tts(text, rate, onend); });
      return;
    }
    tts(text, rate, onend);
  }
  function tts(text, rate, onend) {
    if (!('speechSynthesis' in window)) { toast('Trình duyệt không hỗ trợ đọc giọng nói'); if (onend) onend(); return; }
    if (!voice) toast('Máy chưa có giọng tiếng Anh (en-US) – âm thanh có thể sai. Cài thêm trong Cài đặt › Giọng nói của Windows.');
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(String(text).replace(/\.\.\.|…/g, ' ').replace(/’/g, "'"));
    u.lang = 'en-US'; u.rate = 0.9 * rate; if (voice) u.voice = voice; if (onend) u.onend = onend;
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
    c.due = today() + SRS_GAP[c.box] * DAY_MS; logActivity(); save();
  }
  function srsDue() { var t = today(); return Object.keys(S.srs).filter(function (k) { return CARD[k] && S.srs[k].due <= t; }); }
  function srsNext() { var t = today(), m = 0; Object.keys(S.srs).forEach(function (k) { var d = S.srs[k].due; if (CARD[k] && d > t && (!m || d < m)) m = d; }); return m; }   // lượt ôn kế tiếp (sau hôm nay)

  /* ---------- giao diện sáng / tối (lưu riêng trên thiết bị, không nằm trong file tiến độ) ---------- */
  var THEME_KEY = 'eri60_theme', darkMq = matchMedia('(prefers-color-scheme: dark)');
  function themePref() { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; } }
  function applyTheme(t) {
    var el = document.documentElement;
    if (t === 'light' || t === 'dark') el.setAttribute('data-theme', t); else el.removeAttribute('data-theme');
    var dark = t === 'dark' || (t !== 'light' && darkMq.matches), m = document.getElementById('themeColor');
    var bg = getComputedStyle(el).getPropertyValue('--c-bg').trim();   // màu nền lấy từ token, không viết hex ở đây
    if (m && bg) m.content = bg;
    if (PL.StatusBar) try {   // APK: status bar cùng màu nền, chữ sáng/tối theo theme
      PL.StatusBar.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(noop);
      if (bg) PL.StatusBar.setBackgroundColor({ color: bg }).catch(noop);
    } catch (e) {}
  }
  function setTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} applyTheme(t); }
  applyTheme(themePref());
  if (darkMq.addEventListener) darkMq.addEventListener('change', function () { applyTheme(themePref()); });

  /* ---------- khung: sidebar (desktop), topbar, tab bar ---------- */
  var backBtn = document.getElementById('backBtn'), brand = document.getElementById('brand'), topStreak = document.getElementById('topStreak');
  function navLink(href, icon, label, on, extra) {
    return '<a class="dl' + (on ? ' active' : '') + '" href="' + href + '"' + (on ? ' aria-current="page"' : '') + '><span class="n">' + ic(icon) + '</span><span class="t">' + label + '</span>' + (extra || '') + '</a>';
  }
  function renderChrome(cur) {
    var due = srsDue().length, sk = streak();
    var h = navLink('#/', 'house', 'Hôm nay', cur === 'home') + navLink('#/map', 'map', 'Lộ trình', cur === 'map') +
      navLink('#/srs', 'repeat', 'Ôn tập', cur === 'srs', due ? '<span class="tag due">' + due + '</span>' : '') +
      navLink('#/settings', 'settings', 'Cài đặt', cur === 'settings' || cur === 'assess');
    var w = 0;
    DAYS.forEach(function (d) {
      if (d.week !== w) { w = d.week; h += '<div class="wk">' + (w === 9 ? 'Capstone' : 'Tuần ' + w) + ' · ' + esc(WEEKS[w] || '') + '</div>'; }
      var st = S.days[d.day] || {};
      var tag = d.type === 'rest' ? 'tip' : d.type === 'review' ? 'ôn' : d.type === 'capstone' ? 'cap' : '';
      h += '<a class="dl' + (st.done ? ' done' : '') + (cur === d.day ? ' active' : '') + '" href="#/day/' + d.day + '"' + (cur === d.day ? ' aria-current="page"' : '') + '>' +
        '<span class="n">' + (st.done ? ic('check') + '<span class="sr">đã xong</span>' : d.day) + '</span><span class="t">' + esc(d.title) + '</span>' +
        (tag ? '<span class="tag">' + tag + '</span>' : '') + '</a>';
    });
    side.innerHTML = h;
    var a = $('.dl.active', side); if (a && typeof cur === 'number') side.scrollTop = Math.max(0, a.offsetTop - side.clientHeight / 2);

    var isDay = typeof cur === 'number', sub = isDay || cur === 'assess';
    backBtn.hidden = !sub; backBtn.href = isDay ? '#/map' : '#/settings';
    backBtn.setAttribute('aria-label', isDay ? 'Quay lại lộ trình' : 'Quay lại cài đặt');
    document.querySelector('.topbar').classList.toggle('has-back', sub);
    brand.textContent = isDay ? 'Ngày ' + cur + ' / 60' : cur === 'assess' ? 'Tự đánh giá' : 'Remote IT English';
    topStreak.hidden = !sk.n || cur === 'home';
    topStreak.innerHTML = ic('flame', sk.today ? 'fill' : '') + '<span class="num">' + sk.n + '</span><span class="sr"> ngày học liên tiếp</span>';

    var tab = cur === 'home' ? 'home' : cur === 'srs' ? 'srs' : cur === 'settings' || cur === 'assess' ? 'settings' : 'map';
    $$('#tabbar [data-tab]').forEach(function (t) {
      var on = t.getAttribute('data-tab') === tab;
      t.classList.toggle('on', on); if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    var b = document.getElementById('tabDue'); b.hidden = !due; b.textContent = due > 99 ? '99+' : due;
  }

  /* ---------- router ---------- */
  function route() {
    leavePage();
    var h = location.hash || '#/', m = h.match(/^#\/day\/(\d+)/);
    window.scrollTo(0, 0);
    if (m && byDay[+m[1]]) { var n = +m[1]; S.last = n; save(); renderDay(byDay[n]); renderChrome(n); return; }
    if (h.indexOf('#/assess') === 0) { renderAssess(); renderChrome('assess'); return; }
    if (h.indexOf('#/srs') === 0) { renderSrs(); renderChrome('srs'); return; }
    if (h.indexOf('#/map') === 0) { renderMap(); renderChrome('map'); return; }
    if (h.indexOf('#/settings') === 0) { renderSettings(); renderChrome('settings'); return; }
    renderToday(); renderChrome('home');
  }
  // Chuyển trang bằng View Transitions API; trình duyệt chưa hỗ trợ hoặc bật giảm chuyển động thì đổi trang tức thì
  function navigate() {
    if (!document.startViewTransition || reduced() || document.hidden) { route(); return; }
    try { document.startViewTransition(route); } catch (e) { route(); }
  }
  window.addEventListener('hashchange', navigate);

  /* ---------- Hôm nay ---------- */
  function dayProgress(d) {   // [nhãn, đã xong?] cho từng phần của 1 ngày
    var st = S.days[d.day] || {};
    if (d.type === 'review') return [['Nhớ lại', filled(st.recall, 5)], ['Viết', words(st.write) > 0], ['Nói', filled(st.rubric, 5)], ['Đối chiếu', !!st.unlocked]];
    if (d.type === 'rest') return [['Pro-tip', !!(st.reflect || st.fav)], ['Nghỉ ngơi', !!st.rested]];
    return [['Cụm từ', !!st.ph], ['Dịch', filled(st.trans, 3)], ['Viết', (d.phrases || []).filter(function (p) { return uses(st.write || '', p[0]); }).length >= 3],
      ['Nói', filled(st.checks, 3)], ['Nghe', filled(st.listen, 3)]];
  }
  function renderToday() {
    document.title = 'Hôm nay — English for Remote IT';
    var c = doneCount(), nx = nextDay(), due = srsDue().length, sk = streak(), hr = new Date().getHours();
    var hi = hr < 11 ? 'Chào buổi sáng' : hr < 14 ? 'Chào buổi trưa' : hr < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    var h = '<div class="greet"><div><h1>' + hi + '</h1><p>' + (sk.today ? 'Hôm nay bạn đã học rồi — giữ nhịp nhé!' : nx ? 'Mỗi ngày 30 phút là đủ.' : 'Khoá học đã hoàn thành.') + '</p></div>' +
      '<a class="streak' + (sk.today ? ' on' : '') + '" href="#/settings" aria-label="Chuỗi ' + sk.n + ' ngày học liên tiếp">' + ic('flame') + '<b class="num">' + sk.n + '</b><span>ngày liên tiếp</span></a></div>';
    if (nx) {
      var steps = dayProgress(nx), started = steps.some(function (s) { return s[1]; });
      h += '<section class="today" aria-labelledby="tdT"><div class="kicker">Ngày ' + nx.day + ' · ' + typeLabel(nx.type) + '</div><h2 id="tdT">' + esc(nx.title) + '</h2>' +
        (nx.title_en ? '<div class="en" lang="en">' + esc(nx.title_en) + '</div>' : '') +
        '<div class="steps" style="--n:' + steps.length + '" role="list" aria-label="Tiến độ bài hôm nay">' + steps.map(function (s) {
          return '<div role="listitem" class="' + (s[1] ? 'done' : '') + '"><i></i><span>' + s[0] + '</span><span class="sr">' + (s[1] ? ' – đã xong' : ' – chưa làm') + '</span></div>';
        }).join('') + '</div>' +
        '<a class="btn lg block" href="#/day/' + nx.day + '">' + (started ? 'Học tiếp' : c ? 'Bắt đầu ngày ' + nx.day : 'Bắt đầu khoá học') + ic('arrow-right') + '</a></section>';
    } else {
      h += '<section class="today"><div class="done-all">' + ic('trophy') + '<div><h2>Bạn đã hoàn thành 60 ngày!</h2><div class="en">Chấm cột Cuối khoá để thấy mình tiến bộ bao nhiêu.</div></div></div>' +
        '<a class="btn lg block" href="#/assess">Tự đánh giá cuối khoá' + ic('arrow-right') + '</a></section>';
    }

    // một gợi ý theo ngữ cảnh, không xếp chồng nhiều cảnh báo
    var noBefore = !Object.keys(S.assess.before).some(function (k) { return S.assess.before[k]; });
    var needBackup = c >= 3 && (!S.lastExport || Date.now() - S.lastExport > 7 * DAY_MS);
    if (noBefore && c < 3) h += '<div class="nudge">' + ic('target') + '<div><b>Chấm điểm đầu khoá (1 phút)</b><span class="meta">Tự chấm 8 kỹ năng để cuối khoá thấy rõ mình tiến bộ bao nhiêu.</span><br><a class="btn" href="#/assess">Tự đánh giá' + ic('arrow-right') + '</a></div></div>';
    else if (needBackup) h += '<div class="nudge warn">' + ic('hard-drive-download') + '<div><b>Sao lưu tiến độ</b><span class="meta">' + (S.lastExport ? 'Đã hơn 7 ngày bạn chưa' : 'Bạn chưa') + ' xuất file tiến độ. Tiến độ chỉ nằm trên máy này.</span><br><button class="btn" id="exp2">' + ic('download') + 'Xuất ngay</button></div></div>';

    h += '<div class="home-grid">';
    if (due) h += '<a class="card due" href="#/srs"><span class="ic-wrap">' + ic('repeat') + '</span><div><b>' + due + ' thẻ cần ôn hôm nay</b><span class="meta">Khoảng ' + Math.max(1, Math.round(due / 4)) + ' phút</span></div>' + ic('chevron-right') + '</a>';
    var stars = [], w = 0, known = Object.keys(S.srs).filter(function (k) { return S.srs[k].box >= 3; }).length;
    Object.keys(S.days).forEach(function (k) { var x = S.days[k]; if (x.stars) stars.push(x.stars); if (x.write) w += words(x.write); });
    var R = 38, C = 2 * Math.PI * R;
    h += '<section class="card prog" aria-label="Tiến độ khoá học"><div class="ring"><svg viewBox="0 0 88 88" aria-hidden="true"><circle class="bg" cx="44" cy="44" r="' + R + '"/>' +
      '<circle class="fg" cx="44" cy="44" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - c / DAYS.length)).toFixed(1) + '"/></svg>' +
      '<b class="num">' + c + '<small>/ ' + DAYS.length + ' ngày</small></b></div><div class="kpis">' +
      '<div class="kpi"><span>Cụm từ đã thuộc</span><b>' + known + '</b></div>' +
      '<div class="kpi"><span>Cụm từ trong hộp ôn</span><b>' + Object.keys(S.srs).length + '</b></div>' +
      '<div class="kpi"><span>Từ tiếng Anh đã viết</span><b>' + w + '</b></div>' +
      '<div class="kpi"><span>Tự chấm trung bình</span><b>' + (stars.length ? (sum(stars) / stars.length).toFixed(1) : '–') + '</b></div></div></section>';
    h += '</div>';
    if (!c) h += '<div class="eyebrow">Cách học mỗi ngày</div>' + workflowCard();
    app.innerHTML = h;
    if ($('#exp2')) $('#exp2').onclick = function () { exportProgress(); renderToday(); };
  }
  function workflowCard() {
    return '<div class="card"><div class="grid2">' +
      '<div class="tip"><b class="h">5 phút — Cụm từ</b>Nghe và đọc to từng cụm 3 lần (bản Shadowing có khoảng lặng để nhại theo), che nghĩa để tự nhớ.</div>' +
      '<div class="tip"><b class="h">8 phút — Dịch và viết</b>Dịch 3 câu rồi mới xem đáp án; viết đoạn ứng dụng dùng ít nhất 3 cụm từ.</div>' +
      '<div class="tip"><b class="h">7 phút — Nghe</b>Lần 1 không nhìn chữ (có bản chậm 0.75). Lần 2 mở transcript để kiểm tra.</div>' +
      '<div class="tip"><b class="h">10 phút — Nói và tự sửa</b>Ghi âm 60–90 giây, nghe lại, sửa 1–2 lỗi rồi nói lại lần 2.</div></div></div>';
  }

  /* ---------- Lộ trình: lưới 60 ô ---------- */
  function renderMap() {
    document.title = 'Lộ trình 60 ngày — English for Remote IT';
    var c = doneCount(), nx = nextDay();
    var h = '<h1 class="page-title">Lộ trình 60 ngày</h1><div class="map-sum"><div class="bar" role="progressbar" aria-label="Số ngày đã hoàn thành" aria-valuemin="0" aria-valuemax="' + DAYS.length + '" aria-valuenow="' + c + '">' +
      '<i style="width:' + (c / DAYS.length * 100) + '%"></i></div><b class="num">' + c + '/' + DAYS.length + '</b></div>';
    Object.keys(WEEKS).forEach(function (wk) {
      var ds = DAYS.filter(function (d) { return d.week === +wk; });
      var dn = ds.filter(function (d) { return S.days[d.day] && S.days[d.day].done; }).length;
      h += '<section class="week" aria-label="' + (wk === '9' ? 'Capstone' : 'Tuần ' + wk) + '"><div class="week-h"><b>' + (wk === '9' ? 'Capstone' : 'Tuần ' + wk) + '<small>' + esc(WEEKS[wk]) + '</small></b><span class="num">' + dn + '/' + ds.length + '</span></div><div class="grid7">' +
        ds.map(function (d) {
          var st = S.days[d.day] || {}, cls = st.done ? 'done' : nx && nx.day === d.day ? 'next' : dayProgress(d).some(function (s) { return s[1]; }) ? 'started' : '';
          var icn = d.type === 'rest' ? 'lightbulb' : d.type === 'review' ? 'repeat' : d.type === 'capstone' ? 'trophy' : '';
          return '<a class="cell ' + cls + '" href="#/day/' + d.day + '" title="' + esc(d.title) + '" aria-label="Ngày ' + d.day + ', ' + typeLabel(d.type) + ': ' + esc(d.title) + (st.done ? ' – đã xong' : nx && nx.day === d.day ? ' – học tiếp' : '') + '">' +
            d.day + (icn ? ic(icn) : '') + '</a>';
        }).join('') + '</div></section>';
    });
    h += '<div class="legend" aria-hidden="true"><span><i class="d"></i>Đã xong</span><span><i class="n"></i>Học tiếp</span><span>' + ic('lightbulb') + 'Pro-tip</span><span>' + ic('repeat') + 'Ôn tập</span><span>' + ic('trophy') + 'Capstone</span></div>';
    app.innerHTML = h;
  }

  /* ---------- Cài đặt ---------- */
  function exportProgress() {
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
  function importProgress(f) {
    var r = new FileReader();
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
  }
  function renderSettings() {
    document.title = 'Cài đặt — English for Remote IT';
    var th = themePref(), sk = streak();
    var h = '<h1 class="page-title">Cài đặt</h1>';
    h += '<div class="eyebrow">Giao diện</div><div class="set-list"><div class="set-block"><div class="seg full" id="themeSeg" role="group" aria-label="Giao diện">' +
      [['auto', 'monitor', 'Theo máy'], ['light', 'sun', 'Sáng'], ['dark', 'moon', 'Tối']].map(function (o) {
        return '<button type="button" data-v="' + o[0] + '" class="' + (o[0] === th ? 'on' : '') + '" aria-pressed="' + (o[0] === th) + '">' + ic(o[1]) + o[2] + '</button>';
      }).join('') + '</div></div></div>';
    h += '<div class="eyebrow">Khoá học</div><div class="set-list">' +
      '<div class="set-row">' + ic('flame') + '<span class="grow">Chuỗi ngày học: <b class="num">' + sk.n + ' ngày</b><small>Mỗi 7 ngày được nghỉ 1 ngày (như ngày Pro-tip) mà chuỗi không bị đứt.</small></span></div>' +
      '<a class="set-row" href="#/assess">' + ic('star') + '<span class="grow">Tự đánh giá đầu / cuối khoá<small>8 năng lực cốt lõi</small></span>' + ic('chevron-right', 'chev') + '</a>' +
      '<details><summary class="set-row">' + ic('clock') + '<span class="grow">Quy trình 30 phút mỗi ngày</span>' + ic('chevron-right', 'chev') + '</summary><div class="set-block">' + workflowCard() + '</div></details>' +
      '<button type="button" class="set-row" id="obAgain">' + ic('sparkles') + '<span class="grow">Xem lại phần giới thiệu</span>' + ic('chevron-right', 'chev') + '</button></div>';
    h += offlineCard();
    h += '<div class="eyebrow">Sao lưu tiến độ</div><div class="set-list"><div class="set-block"><p class="hint">Tiến độ lưu trên máy này' + (S.lastExport ? ' · lần xuất gần nhất: ' + new Date(S.lastExport).toLocaleDateString('vi-VN') : '') + '. Xuất file để chuyển sang máy khác hoặc phòng khi xoá dữ liệu.</p>' +
      '<div class="row"><button class="btn" id="exp">' + ic('download') + 'Xuất tiến độ</button><label class="btn" tabindex="0" id="impL">' + ic('upload') + 'Nhập tiến độ<input type="file" id="imp" accept=".json,application/json" hidden></label></div></div></div>';
    h += '<div class="eyebrow">Vùng nguy hiểm</div><div class="set-list danger-zone"><div class="set-block"><p class="hint">Xoá toàn bộ tiến độ, bài viết, ghi chú và hộp ôn trên máy này. Không thể hoàn tác — nên xuất file sao lưu trước.</p>' +
      '<button class="btn danger" id="rst">' + ic('trash-2') + 'Xoá toàn bộ tiến độ</button></div></div>';
    h += '<p class="meta" style="text-align:center;margin-top:var(--s-6)">Remote IT English · ' + (NATIVE ? 'App Android' : 'Web app') + '</p>';
    app.innerHTML = h;
    $$('#themeSeg button').forEach(function (b) {
      b.onclick = function () { $$('#themeSeg button').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); setTheme(b.getAttribute('data-v')); };
    });
    $('#obAgain').onclick = onboarding;
    $('#exp').onclick = function () { exportProgress(); renderSettings(); };
    $('#impL').onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#imp').click(); } };
    $('#imp').onchange = function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) importProgress(f); };
    $('#rst').onclick = function () { if (confirm('Xoá toàn bộ tiến độ, bài viết, ghi chú và hộp ôn? Không thể hoàn tác.')) { S = blank(); save(); toast('Đã xoá tiến độ'); location.hash = '#/'; } };
    bindOffline();
  }

  /* ---------- cài app + tải audio để học offline (chỉ bản web; bản APK đã kèm sẵn audio) ---------- */
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
    var h = '';
    if (!STANDALONE) {
      h += '<p class="hint">' + (IOS ? 'iPhone/iPad: mở trang bằng Safari → nút Chia sẻ → <b>Thêm vào MH chính</b>.' : 'Cài trang này như một app để mở nhanh từ màn hình chính, toàn màn hình.') + '</p>' +
        '<button class="btn primary" id="instBtn"' + (installEvt ? '' : ' hidden') + '>' + ic('smartphone') + 'Cài app vào máy</button>';
    }
    if (canCache) {
      h += '<p class="hint" style="margin-top:10px">Tải sẵn toàn bộ audio (~60MB) để học khi không có mạng. Nên dùng Wi‑Fi.</p>' +
        '<div class="row"><button class="btn" id="offBtn">' + ic('download') + 'Tải audio học offline</button><button class="btn" id="offDel" hidden>Xoá audio đã tải</button></div>' +
        '<p class="meta" id="offInfo" style="margin:8px 0 0"></p>';
    }
    return h ? '<div class="eyebrow">Học trên điện thoại</div><div class="set-list"><div class="set-block">' + h + '</div></div>' : '';
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
        if (!busy) { info.textContent = n ? 'Đã tải ' + n + '/' + list.length + ' file audio.' : ''; btn.innerHTML = n === list.length ? ic('circle-check') + 'Đã tải đủ audio' : ic('download') + (n ? 'Tải tiếp audio còn thiếu' : 'Tải audio học offline'); btn.disabled = n === list.length; del.hidden = !n; }
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
  // Thanh bước dính dưới topbar: mỗi phần của bài là một đoạn; đoạn đang xem tô màu chính, đoạn đã xong tô xanh.
  function secnav(labels, doneFn) {
    var secs = $$('section.card', app).slice(0, labels.length), headEl = $('.dayhead', app);
    if (!secs.length || !headEl) return;
    var nav = document.createElement('nav'); nav.className = 'secnav'; nav.setAttribute('aria-label', 'Các phần của bài');
    nav.style.setProperty('--n', labels.length);
    nav.innerHTML = labels.map(function (l, i) { return '<button type="button" data-i="' + i + '"><i></i><span>' + esc(l) + '</span></button>'; }).join('');
    headEl.insertAdjacentElement('afterend', nav);
    var btns = $$('button', nav);
    btns.forEach(function (b, i) { b.onclick = function () { secs[i].scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }; });
    function mark(i) { btns.forEach(function (b, k) { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); }); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) mark(secs.indexOf(e.target)); });
      }, { rootMargin: '-45% 0px -50% 0px' });
      secs.forEach(function (s) { io.observe(s); }); onLeave(function () { io.disconnect(); });
    }
    function ticks() { if (!doneFn) return; var d = doneFn(); btns.forEach(function (b, i) { b.classList.toggle('ok', !!d[i]); }); }
    if (doneFn) { app.addEventListener('input', ticks); app.addEventListener('change', ticks); app.addEventListener('step', ticks); onLeave(function () { app.removeEventListener('input', ticks); app.removeEventListener('change', ticks); app.removeEventListener('step', ticks); }); ticks(); }
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
    for (var k = 1; k <= 5; k++) stars += '<button type="button" data-s="' + k + '" class="' + (st.stars >= k ? 'on' : '') + '" aria-label="' + k + ' trên 5 sao" aria-pressed="' + (st.stars === k) + '">' + ic('star') + '</button>';
    return card('', 'Ghi chú & tự chấm', 'Ghi lại từ mới, lỗi hay gặp hoặc câu muốn dùng thật trong công việc.',
      '<textarea data-k="notes" aria-label="Ghi chú" placeholder="Ghi chú của bạn…" style="min-height:80px">' + esc(st.notes || '') + '</textarea>' +
      '<div class="row" style="margin-top:8px"><span class="meta">Hôm nay bạn tự tin mức nào?</span><span class="stars" role="group" aria-label="Tự chấm">' + stars + '</span></div>') +
      '<nav class="navbtns" aria-label="Chuyển ngày">' + (p ? '<a class="btn" href="#/day/' + p.day + '">' + ic('arrow-left') + 'Ngày ' + p.day + '</a>' : '<span></span>') +
      (n ? '<a class="btn" href="#/day/' + n.day + '">Ngày ' + n.day + ic('arrow-right') + '</a>' : '<a class="btn" href="#/assess">Tự đánh giá cuối khoá' + ic('arrow-right') + '</a>') + '</nav>' +
      '<p class="meta" style="text-align:center;margin:var(--s-4) 0 0">Tiến độ được lưu tự động trên máy.</p>' +
      '<div class="done-bar" id="doneBar" role="region" aria-label="Hoàn thành ngày"></div>';
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

    // thanh "Hoàn thành ngày" dính ở đáy, cập nhật theo tiến độ từng phần
    var bar = $('#doneBar'), nx = DAYS[DAYS.indexOf(d) + 1];
    function updBar() {
      var steps = dayProgress(d), k = steps.filter(function (s) { return s[1]; }).length;
      bar.classList.toggle('is-done', !!st.done);
      if (st.done) {
        bar.innerHTML = '<div class="db-txt"><b>' + ic('circle-check') + 'Đã hoàn thành ngày ' + d.day + '</b><button type="button" class="link" id="undoBtn">Bỏ đánh dấu</button></div>' +
          (nx ? '<a class="btn primary" href="#/day/' + nx.day + '">Ngày ' + nx.day + ic('arrow-right') + '</a>' : '<a class="btn primary" href="#/assess">Tự đánh giá' + ic('arrow-right') + '</a>');
        $('#undoBtn').onclick = function () { st.done = false; save(); updBar(); renderChrome(d.day); toast('Đã bỏ đánh dấu ngày ' + d.day); };
      } else {
        bar.innerHTML = '<div class="db-txt"><b class="num">' + k + '/' + steps.length + ' phần đã xong</b><span class="db-bar" aria-hidden="true"><i style="width:' + (k / steps.length * 100) + '%"></i></span></div>' +
          '<button type="button" class="btn ok" id="doneBtn">' + ic('check') + 'Hoàn thành</button>';
        $('#doneBtn').onclick = complete;
      }
    }
    function finish() {
      st.done = true; logActivity(); if (d.phrases) srsAddDay(d.day); save();
      haptic('success'); var fx = celebrate();
      toast('Hoàn thành ngày ' + d.day + ' — tuyệt vời!');
      if (nx) setTimeout(function () { if (location.hash === '#/day/' + d.day) location.hash = '#/day/' + nx.day; }, fx ? 1500 : 700);
      else { updBar(); renderChrome(d.day); }
    }
    function complete() {
      var m = missing(d);
      if (!m.length) { finish(); return; }
      sheet('<h2 id="shT">Còn ' + m.length + ' phần chưa làm</h2><ul class="miss">' + m.map(function (x) { return '<li>' + ic('info') + '<span>' + esc(x) + '</span></li>'; }).join('') + '</ul>' +
        '<p class="meta">Bạn vẫn có thể đánh dấu hoàn thành và quay lại làm sau.</p>', [['Tiếp tục học', '', null], ['Vẫn hoàn thành', 'ok', finish]]);
    }
    var t; function soon() { clearTimeout(t); t = setTimeout(updBar, 150); }
    app.addEventListener('input', soon); app.addEventListener('change', soon); app.addEventListener('step', soon);
    onLeave(function () { clearTimeout(t); app.removeEventListener('input', soon); app.removeEventListener('change', soon); app.removeEventListener('step', soon); });
    updBar();

    $$('[data-reveal]', app).forEach(function (b) {
      b.onclick = function () { var box = document.getElementById(b.getAttribute('data-reveal')); var on = box.classList.toggle('show-ans'); b.textContent = on ? 'Ẩn đáp án' : 'Xem đáp án'; b.setAttribute('aria-expanded', on); if (b.onreveal) b.onreveal(on); };
    });
  }
  function stepChanged() { app.dispatchEvent(new Event('step')); }

  /* ---------- hiệu ứng hoàn thành ngày: dấu check + confetti CSS (tắt khi giảm chuyển động) ---------- */
  function celebrate() {
    if (reduced()) return false;
    var w = document.createElement('div'), h = '';
    w.className = 'celebrate'; w.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 28; i++) {
      h += '<i class="cf' + (i % 4) + '" style="--x:' + (Math.random() * 2 - 1).toFixed(2) + ';--y:' + Math.random().toFixed(2) +
        ';--r:' + Math.round(Math.random() * 720 - 360) + 'deg;--dl:' + Math.round(Math.random() * 120) + 'ms"></i>';
    }
    w.innerHTML = h + '<div class="cel-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-15"/></svg></div>';
    document.body.appendChild(w);
    setTimeout(function () { w.remove(); }, 1700);
    return true;
  }

  /* ---------- onboarding 3 slide (lần đầu mở app; xem lại được trong Cài đặt) ---------- */
  function onboarding() {
    if ($('.ob')) return;
    var slides = [
      ['clock', 'Mỗi ngày 30 phút', 'Mỗi bài học đi qua 4 bước, làm lần lượt từ trên xuống:',
        '<ul class="ob-list"><li><b class="num">5′</b>Cụm từ: nghe và đọc to</li><li><b class="num">8′</b>Dịch và viết</li><li><b class="num">7′</b>Nghe hiểu</li><li><b class="num">10′</b>Nói, ghi âm và tự sửa</li></ul>'],
      ['flame', 'Giữ chuỗi ngày học', 'Học bài hoặc ôn thẻ mỗi ngày để chuỗi tăng lên. Mỗi 7 ngày bạn được nghỉ 1 ngày mà chuỗi không bị đứt.', ''],
      [NATIVE ? 'headphones' : 'download', 'Học cả khi không có mạng', NATIVE ? 'Toàn bộ audio đã có sẵn trong app — học được ở bất cứ đâu, không cần mạng.' :
        'Vào <b>Cài đặt › Tải audio học offline</b> (~60MB, nên dùng Wi‑Fi). Có thể cài trang này như một app trên điện thoại.', '']
    ];
    var prev = document.activeElement, w = document.createElement('div'), idx = 0, closed = false;
    w.className = 'ob'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'Giới thiệu cách học');
    w.innerHTML = '<button type="button" class="btn ghost ob-skip">Bỏ qua</button><div class="ob-track">' + slides.map(function (s, i) {
      return '<section class="ob-slide" aria-roledescription="slide" aria-label="' + (i + 1) + ' / ' + slides.length + '"' + (i ? ' aria-hidden="true"' : '') + '>' +
        '<span class="ob-ic">' + ic(s[0]) + '</span><h2>' + s[1] + '</h2><p>' + s[2] + '</p>' + s[3] + '</section>';
    }).join('') + '</div><div class="ob-foot"><div class="ob-dots" aria-hidden="true">' + slides.map(function () { return '<i></i>'; }).join('') + '</div>' +
      '<button type="button" class="btn primary lg block ob-next"></button></div>';
    document.body.appendChild(w); document.body.classList.add('lock');
    var track = $('.ob-track', w), next = $('.ob-next', w), dots = $$('.ob-dots i', w), secs = $$('.ob-slide', w);
    function mark(i) {
      idx = i; dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
      secs.forEach(function (s, k) { if (k === i) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true'); });
      next.innerHTML = i === slides.length - 1 ? 'Bắt đầu học' + ic('arrow-right') : 'Tiếp' + ic('chevron-right');
    }
    function goTo(i) { track.scrollTo({ left: i * track.clientWidth, behavior: reduced() ? 'auto' : 'smooth' }); mark(i); }
    function close() {
      if (closed) return; closed = true;
      S.intro = 1; save();
      modals.splice(modals.indexOf(close), 1);
      document.removeEventListener('keydown', key); document.body.classList.remove('lock');
      w.classList.remove('open'); setTimeout(function () { w.remove(); }, 220);
      if (prev && prev.isConnected && prev.focus && prev !== document.body) prev.focus(); else app.focus({ preventScroll: true });
    }
    function key(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' && idx < slides.length - 1) goTo(idx + 1);
      else if (e.key === 'ArrowLeft' && idx > 0) goTo(idx - 1);
      else if (e.key === 'Tab') trapTab(e, w);
    }
    var st; track.addEventListener('scroll', function () { clearTimeout(st); st = setTimeout(function () { var i = Math.round(track.scrollLeft / track.clientWidth); if (i !== idx) mark(i); }, 60); }, { passive: true });
    next.onclick = function () { if (idx >= slides.length - 1) close(); else goTo(idx + 1); };
    $('.ob-skip', w).onclick = close;
    document.addEventListener('keydown', key); modals.push(close);
    mark(0); requestAnimationFrame(function () { w.classList.add('open'); }); next.focus();
  }

  /* ---------- bottom sheet (thay confirm() của trình duyệt) ---------- */
  function sheet(html, buttons) {
    var prev = document.activeElement, w = document.createElement('div'), closed = false;
    w.className = 'sheet-wrap';
    w.innerHTML = '<div class="sheet-scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT">' + html + '<div class="sheet-act">' +
      buttons.map(function (b, i) { return '<button type="button" class="btn lg ' + b[1] + '" data-i="' + i + '">' + b[0] + '</button>'; }).join('') + '</div></div>';
    document.body.appendChild(w); document.body.classList.add('lock');
    requestAnimationFrame(function () { w.classList.add('open'); });
    function close(fn) {
      if (closed) return; closed = true;
      modals.splice(modals.indexOf(dismiss), 1);
      document.removeEventListener('keydown', key); w.classList.remove('open'); document.body.classList.remove('lock');
      setTimeout(function () { w.remove(); }, 260);
      if (prev && prev.isConnected && prev.focus) prev.focus();
      if (fn) fn();
    }
    function dismiss() { close(); }
    function key(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'Tab') trapTab(e, w);
    }
    document.addEventListener('keydown', key); modals.push(dismiss);
    $('.sheet-scrim', w).onclick = function () { close(); };
    $$('.sheet-act button', w).forEach(function (b) { b.onclick = function () { close(buttons[+b.getAttribute('data-i')][2]); }; });
    $('.sheet-act button', w).focus();
    onLeave(function () { close(); });
  }

  /* ---------- trình phát audio (bọc thẻ <audio> ẩn để giao diện giống nhau trên mọi máy) ---------- */
  function audioUI(id, src) {
    return '<div class="ap"><audio id="' + id + '" preload="none" src="' + esc(src) + '"></audio>' +
      '<button type="button" class="ap-play" aria-label="Phát">' + ic('play', 'fill') + '</button>' +
      '<div class="ap-mid"><input type="range" class="ap-seek" min="0" max="1000" step="1" value="0" aria-label="Vị trí phát">' +
      '<div class="ap-time"><span class="ap-cur num">0:00</span><span class="ap-dur num">--:--</span></div></div>' +
      '<button type="button" class="ap-back" aria-label="Lùi 5 giây">' + ic('rotate-ccw') + '<span>5</span></button></div>';
  }
  function bindAudioUI(id) {
    var a = document.getElementById(id), root = a.parentNode, play = $('.ap-play', root), seek = $('.ap-seek', root), cur = $('.ap-cur', root), dur = $('.ap-dur', root), drag = false;
    function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
    function fill() { seek.style.setProperty('--p', seek.value / 10 + '%'); }
    function sync() { var on = !a.paused; play.innerHTML = ic(on ? 'pause' : 'play', 'fill'); play.setAttribute('aria-label', on ? 'Tạm dừng' : 'Phát'); root.classList.toggle('playing', on); }
    function tick() {
      var ok = a.duration && isFinite(a.duration);
      if (!drag) seek.value = ok ? Math.round(a.currentTime / a.duration * 1000) : 0;
      cur.textContent = fmt(a.currentTime); dur.textContent = ok ? fmt(a.duration) : '--:--'; fill();
    }
    play.onclick = function () { if (a.paused) a.play().catch(function () { toast('Không phát được audio'); }); else a.pause(); };
    $('.ap-back', root).onclick = function () { a.currentTime = Math.max(0, a.currentTime - 5); };
    seek.oninput = function () { drag = true; if (a.duration) cur.textContent = fmt(seek.value / 1000 * a.duration); fill(); };
    seek.onchange = function () { drag = false; if (a.duration && isFinite(a.duration)) a.currentTime = seek.value / 1000 * a.duration; };
    ['play', 'pause', 'ended'].forEach(function (e) { a.addEventListener(e, sync); });
    ['timeupdate', 'loadedmetadata', 'durationchange', 'emptied'].forEach(function (e) { a.addEventListener(e, tick); });
    onLeave(function () { a.pause(); });
    sync(); tick();
  }

  function phrasesList(d) {
    return '<div class="ph-list" id="phT">' + d.phrases.map(function (p, i) {
      return '<div class="ph-item"><button type="button" class="say" data-i="' + i + '" aria-label="Nghe: ' + esc(p[0]) + '">' + ic('volume-2') + '</button>' +
        '<div class="ph-txt"><div class="en" lang="en">' + esc(p[0]) + '</div><div class="vn"><span tabindex="0" role="button" aria-label="Nghĩa tiếng Việt: ' + esc(p[1]) + '">' + esc(p[1]) + '</span></div></div></div>';
    }).join('') + '</div>';
  }
  // Tô những từ trong đáp án mà câu của bạn cũng có (đã chuẩn hoá I'm = I am…)
  function markAns(user, ans) {
    var have = {}; norm(user).trim().split(' ').forEach(function (w) { if (w) have[w] = 1; });
    return String(ans).split(/(\s+)/).map(function (w) {
      var k = norm(w).trim();
      return k && k.split(' ').every(function (t) { return have[t]; }) ? '<mark>' + esc(w) + '</mark>' : esc(w);
    }).join('');
  }

  /* ---------- ghi âm (nhiều lần, gắn với trang hiện tại) ---------- */
  function recorderBlock() {
    return '<div class="rec"><button type="button" class="rec-btn" id="recBtn" aria-label="Bắt đầu ghi âm">' + ic('mic') + '</button>' +
      '<div class="rec-info"><b id="recState">Chạm để ghi âm</b><span class="meta" id="recInfo" aria-live="polite">Nói 60–90 giây rồi nghe lại (cần cho phép micro).</span></div></div>' +
      '<div id="recOut"></div>';
  }
  function bindRecorder(d, onTake) {
    var btn = $('#recBtn'), state = $('#recState'), info = $('#recInfo'), out = $('#recOut'); if (!btn) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) { btn.disabled = true; state.textContent = 'Không ghi âm được'; info.textContent = 'Trình duyệt không hỗ trợ ghi âm. Hãy dùng Chrome/Edge bản mới.'; return; }
    var rec = null, stream = null, timer = null, alive = true, urls = [], takes = 0;
    function idle(msg) {
      btn.classList.remove('on'); btn.innerHTML = ic('mic'); btn.setAttribute('aria-label', takes ? 'Ghi lần ' + (takes + 1) : 'Bắt đầu ghi âm');
      state.textContent = takes ? 'Ghi lần ' + (takes + 1) : 'Chạm để ghi âm'; if (msg) info.textContent = msg;
    }
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
          var div = document.createElement('div'); div.className = 'take';
          div.innerHTML = '<div class="take-h"><b>Lần ' + takes + '</b><a class="btn ghost sm" download="Ngay' + (d.day < 10 ? '0' : '') + d.day + '_ghi_am_lan' + takes + '.' + ext + '" href="' + url + '">' + ic('download') + 'Tải về</a></div>' +
            audioUI('take' + takes, url);
          out.appendChild(div); bindAudioUI('take' + takes);
          idle('Nghe lại, ghi lỗi, rồi nói lại lần ' + (takes + 1) + '. Bản ghi không tự lưu – tải về nếu muốn giữ.');
          if (onTake) onTake(takes);
        };
        rec.start(); var t0 = Date.now();
        btn.classList.add('on'); btn.innerHTML = ic('square', 'fill'); btn.setAttribute('aria-label', 'Dừng ghi âm');
        state.textContent = 'Đang ghi… 0:00'; info.textContent = 'Chạm lần nữa để dừng.';
        timer = setInterval(function () { var s = Math.round((Date.now() - t0) / 1000); state.textContent = 'Đang ghi… ' + Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }, 500);
      }).catch(function () { idle('Không truy cập được micro. Hãy cho phép quyền micro cho ứng dụng.'); });
    };
  }

  /* ---------- lesson / capstone ---------- */
  function renderLesson(d) {
    var st = D(d.day), h = head(d, 'Thời gian: 30 phút');
    var hasShadow = !!d.audio_shadow;
    h += card(1, 'Cụm từ hôm nay', 'Nghe và đọc to mỗi cụm 3 lần. Bật <b>Che nghĩa</b> để tự kiểm tra – chạm vào ô mờ để xem nghĩa.',
      '<div class="ph-tools"><button type="button" class="btn" id="playAll">' + ic('play') + 'Nghe tất cả</button>' +
      seg('rateSeg', [['1', '1×'], ['0.75', '0.75×']], '1', 'Tốc độ đọc từng cụm') +
      '<label class="switch"><input type="checkbox" id="hideVN"><span class="track" aria-hidden="true"></span>Che nghĩa</label></div>' +
      phrasesList(d) +
      '<div class="sub-h"><span>Bài đọc cả nhóm</span>' + (hasShadow ? seg('phMode', [['read', 'Đọc liền'], ['shadow', 'Shadowing']], 'read', 'Kiểu nghe cụm từ') : '') + '</div>' +
      (hasShadow ? '<p class="meta" style="margin:0 0 var(--s-2)">Shadowing đọc mỗi cụm 2 lần, sau mỗi lần có khoảng lặng để bạn nhại theo.</p>' : '') +
      audioUI('phAudio', d.audio_phrases));
    h += card(2, 'Dịch sang tiếng Anh', 'Tự dịch trước rồi bấm "Kiểm tra". Đáp án là một cách diễn đạt tham khảo – câu khác đúng ngữ pháp, đúng ý vẫn được chấp nhận.',
      '<div id="trBox">' + d.trans.map(function (t, i) {
        return '<div class="q" id="trq' + i + '"><label for="tr' + i + '">' + (i + 1) + '. ' + esc(t) + '</label>' +
          '<div class="q-row"><input type="text" id="tr' + i + '" lang="en" data-k="trans" data-i="' + i + '" value="' + esc((st.trans || [])[i] || '') + '" placeholder="Your English…">' +
          '<button type="button" class="btn" data-chk="' + i + '" aria-expanded="false" aria-controls="tra' + i + '">Kiểm tra</button></div>' +
          '<div class="ans" id="tra' + i + '" lang="en"></div></div>';
      }).join('') + '</div><p class="meta" style="margin:0">Phần <mark>tô màu</mark> là các từ trong đáp án trùng với câu của bạn.</p>');
    h += card(3, 'Viết ứng dụng — dùng ít nhất 3 cụm từ hôm nay', esc(d.write),
      '<textarea id="wr" lang="en" data-k="write" aria-label="Bài viết" placeholder="Write here…">' + esc(st.write || '') + '</textarea>' +
      '<div class="chips" id="chips">' + d.phrases.map(function (p, i) { return '<span class="chip" data-i="' + i + '">' + esc(p[0]) + '</span>'; }).join('') + '</div>' +
      '<div class="meta" id="wc" aria-live="polite"></div><div class="meta">Nhận diện tự động chỉ là gợi ý (đã hiểu I\'m = I am…); cách viết khác vẫn có thể đúng.</div>');
    var checks = ['Lần 1: đã ghi âm', 'Đã nghe lại, ghi lỗi', 'Lần 2: tốt hơn lần 1'];
    h += card(4, 'Nói — ghi âm, nghe lại và sửa', esc(d.speak),
      recorderBlock() + '<div class="checks" style="margin-top:10px">' + checks.map(function (c, i) {
        return '<label><input type="checkbox" data-k="checks" data-i="' + i + '"' + ((st.checks || [])[i] ? ' checked' : '') + '> ' + c + '</label>';
      }).join('') + '</div>' + (d.criteria ? '<div class="tip"><b class="h">Tiêu chí bài tổng hợp</b>' + esc(d.criteria.replace(/^Tiêu chí bài tổng hợp:\s*/, '')) + '</div>' : ''));
    h += card(5, 'Nghe — trả lời 3 câu hỏi', 'Lần 1: không nhìn transcript (dùng tốc độ 0.75× nếu cần). Lần 2: mở transcript để kiểm tra.',
      '<div class="sub-h"><span>Tốc độ bài nghe</span>' + seg('spdSeg', [['n', '1×'], ['s', '0.75×']], 'n', 'Tốc độ bài nghe') + '</div>' +
      audioUI('lis', d.audio) +
      '<button type="button" class="btn" id="tsBtn" aria-expanded="false" aria-controls="ts" style="margin-top:var(--s-3)">' + ic('book-open') + 'Hiện transcript</button>' +
      '<div class="transcript" id="ts" lang="en">' + esc(d.transcript) + '</div>' +
      '<div id="lsBox">' + d.questions.map(function (q, i) {
        return '<div class="q"><label for="ls' + i + '">' + (i + 1) + '. ' + esc(q) + '</label><input type="text" id="ls' + i + '" data-k="listen" data-i="' + i + '" value="' + esc((st.listen || [])[i] || '') + '"><div class="ans">' + ic('check') + ' ' + esc(d.listen_ans[i] || '') + '</div></div>';
      }).join('') + '</div><button type="button" class="btn" data-reveal="lsBox" id="lsReveal" aria-expanded="false">Xem đáp án</button>' +
      '<div id="cmp" style="display:none;margin-top:12px"><div class="tip"><b class="h">So sánh bài viết của bạn với đoạn mẫu</b>Transcript là một đoạn mẫu cùng chủ đề, dùng đúng các cụm từ hôm nay. Đối chiếu cách mở đầu, cách nêu vấn đề và bước tiếp theo.</div>' +
      '<div class="grid2"><div class="player"><div class="meta"><b>Bài của bạn</b></div><div id="cmpMine" lang="en" style="white-space:pre-wrap"></div></div><div class="player"><div class="meta"><b>Đoạn mẫu</b></div><div lang="en">' + esc(d.transcript) + '</div></div></div></div>');
    h += footer(d);
    app.innerHTML = h;
    bindCommon(d);
    secnav(['Cụm từ', 'Dịch', 'Viết', 'Nói', 'Nghe', 'Ghi chú'], function () {
      return [!!st.ph, filled(st.trans, 3), d.phrases.filter(function (p) { return uses(st.write || '', p[0]); }).length >= 3, filled(st.checks, 3), filled(st.listen, 3), !!st.stars];
    });
    bindRecorder(d, function (n) { var cb = $$('[data-k="checks"]', app)[0]; if (n >= 1 && cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); } });
    bindAudioUI('phAudio'); bindAudioUI('lis');

    // --- cụm từ ---
    var rate = 1, ph = $('#phAudio'), queue = false;
    function heard() { if (!st.ph) { st.ph = true; saveSoon(); stepChanged(); } }
    $('#hideVN').onchange = function () { $('#phT').classList.toggle('hidevn', this.checked); $$('#phT .vn span').forEach(function (s) { s.classList.remove('peek'); }); };
    $$('#phT .vn span').forEach(function (s) { s.onclick = s.onkeydown = function (e) { if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); s.classList.toggle('peek'); }; });
    bindSeg('rateSeg', function (v) { rate = +v; ph.playbackRate = rate; });
    function stopQueue() {
      if (!queue) return; queue = false; player.onended = player.onerror = null;
      $$('#phT .ph-item').forEach(function (x) { x.classList.remove('playing'); });
      $('#playAll').innerHTML = ic('play') + 'Nghe tất cả';
      if (window.speechSynthesis) speechSynthesis.cancel(); player.pause();
    }
    function playIdx(i) {
      if (!queue) return;
      if (i >= d.phrases.length) { stopQueue(); return; }
      $$('#phT .ph-item').forEach(function (x, k) { x.classList.toggle('playing', k === i); });
      playPhrase(d.phrase_audio && d.phrase_audio[i], d.phrases[i][0], rate, function () { if (queue) setTimeout(function () { playIdx(i + 1); }, 800); });
    }
    $('#playAll').onclick = function () {
      if (queue) { stopQueue(); return; }
      ph.pause(); heard(); queue = true; this.innerHTML = ic('square', 'fill') + 'Dừng'; playIdx(0);
    };
    $$('#phT .say').forEach(function (b) { b.onclick = function () { stopQueue(); heard(); var i = +b.getAttribute('data-i'); playPhrase(d.phrase_audio && d.phrase_audio[i], d.phrases[i][0], rate); }; });
    if (hasShadow) bindSeg('phMode', function (v) { ph.pause(); ph.src = v === 'shadow' ? d.audio_shadow : d.audio_phrases; ph.load(); ph.playbackRate = rate; });
    ph.addEventListener('play', function () { stopQueue(); ph.playbackRate = rate; player.pause(); heard(); });
    onLeave(stopQueue);

    // --- dịch: kiểm tra từng câu ---
    function showAns(i) { var inp = $('#tr' + i); $('#tra' + i).innerHTML = ic('check') + ' ' + markAns(inp.value, d.trans_ans[i] || ''); }
    $$('[data-chk]', app).forEach(function (b) {
      var i = +b.getAttribute('data-chk'), q = $('#trq' + i);
      b.onclick = function () { var on = q.classList.toggle('show-ans'); if (on) showAns(i); b.textContent = on ? 'Ẩn' : 'Kiểm tra'; b.setAttribute('aria-expanded', on); };
      $('#tr' + i).addEventListener('input', function () { if (q.classList.contains('show-ans')) showAns(i); });
    });

    // --- nghe ---
    var lis = $('#lis');
    bindSeg('spdSeg', function (v) {
      var playing = !lis.paused, ratio = lis.duration ? lis.currentTime / lis.duration : 0;
      lis.src = v === 's' ? d.audio_slow : d.audio;
      lis.addEventListener('loadedmetadata', function f() { lis.removeEventListener('loadedmetadata', f); if (ratio && lis.duration) lis.currentTime = ratio * lis.duration; if (playing) lis.play(); });
      lis.load();
    });
    lis.addEventListener('play', function () { ph.pause(); stopQueue(); player.pause(); });
    onLeave(function () { player.pause(); });
    function showCmp() { if (!words($('#wr').value)) return; $('#cmpMine').textContent = $('#wr').value; $('#cmp').style.display = ''; }
    $('#tsBtn').onclick = function () { var o = $('#ts').classList.toggle('open'); this.innerHTML = ic('book-open') + (o ? 'Ẩn transcript' : 'Hiện transcript'); this.setAttribute('aria-expanded', o); if (o) showCmp(); };
    $('#lsReveal').onreveal = function (on) { if (on) showCmp(); };
    function upd() {
      var t = $('#wr').value, used = 0, n = words(t);
      $$('#chips .chip').forEach(function (c, i) { var u = uses(t, d.phrases[i][0]); c.classList.toggle('used', u); if (u) used++; });
      $('#wc').innerHTML = '<span class="num">' + n + '</span> từ · đã dùng <b class="' + (used >= 3 ? 'pos' : '') + '">' + used + '/6</b> cụm từ' + (used >= 3 ? ' · đạt mục tiêu' : ' (mục tiêu ≥ 3)') + (n && n < 40 ? ' · nên viết khoảng 40–80 từ' : '');
    }
    $('#wr').addEventListener('input', upd); upd();
  }

  /* ---------- rest (theo bản in: đọc Pro-tip 10–15 phút, suy ngẫm, nghỉ) ---------- */
  function renderRest(d) {
    var st = D(d.day), h = head(d, 'Ngày nghỉ nạp năng lượng · Đọc thư giãn 10–15 phút · không có bài tập bắt buộc');
    h += card(ic('lightbulb'), 'Pro-tip', esc(d.intro), (d.points || []).map(function (p) {
      return '<div class="tip"><b class="h">' + esc(p[0]) + '</b>' + p[1] + '</div>';   // p[1] là HTML do ban biên tập soạn sẵn
    }).join(''));
    h += card(ic('pen-line'), 'Góc suy ngẫm (tuỳ chọn)', '<b>Câu hỏi suy ngẫm:</b> ' + esc(d.reflect || ''),
      '<textarea data-k="reflect" aria-label="Suy ngẫm" placeholder="Viết vài dòng (tiếng Việt hoặc tiếng Anh)…" style="min-height:80px">' + esc(st.reflect || '') + '</textarea>' +
      '<div class="q"><label for="fav">Một cụm từ hoặc kinh nghiệm tôi tâm đắc nhất:</label><input type="text" id="fav" data-k="fav" value="' + esc(st.fav || '') + '"></div>' +
      '<div class="checks"><label><input type="checkbox" data-k="rested"' + (st.rested ? ' checked' : '') + '> Tôi đã dành thời gian nghỉ ngơi, nạp lại năng lượng và sẵn sàng cho tuần tiếp theo!</label></div>');
    h += footer(d);
    app.innerHTML = h; bindCommon(d);
  }

  /* ---------- review (theo bản in: 30 phút, KHÔNG xem tài liệu 10 phút đầu) ---------- */
  function flashcards(cards, opt) {
    // opt: {grade:true} để hiện nút Chưa nhớ / Đã nhớ (ghi vào hộp ôn); {shuffle:false} để ẩn nút Trộn
    opt = opt || {};
    return '<div class="fc-sess"><div class="fc-top"><span class="fc-bar" aria-hidden="true"><i id="fcBar"></i></span><b class="num" id="fcPos" aria-live="polite"></b></div>' +
      '<div class="flash" id="fc" role="button" tabindex="0" aria-label="Lật thẻ"><div class="fc-in">' +
      '<div class="fc-face fc-front" id="fcF"></div><div class="fc-face fc-back" id="fcB"></div></div></div>' +
      '<div class="fc-tools"><button type="button" class="btn" id="fcPrev" aria-label="Thẻ trước">' + ic('arrow-left') + '</button><button type="button" class="btn" id="fcNext" aria-label="Thẻ sau">' + ic('arrow-right') + '</button>' +
      (opt.shuffle !== false ? '<button type="button" class="btn" id="fcShuf" aria-label="Trộn thẻ">' + ic('shuffle') + '</button>' : '') +
      '<button type="button" class="btn" id="fcSay">' + ic('volume-2') + 'Nghe</button>' +
      '<label class="switch"><input type="checkbox" id="fcDir"><span class="track" aria-hidden="true"></span>EN → VN</label></div>' +
      '<div class="fc-grade" id="fcGrade"><button type="button" class="btn lg primary" id="fcFlip">' + ic('rotate-ccw') + 'Lật thẻ</button>' +
      (opt.grade ? '<button type="button" class="btn lg no" id="fcNo" hidden>' + ic('x') + 'Chưa nhớ</button><button type="button" class="btn lg ok" id="fcYes" hidden>' + ic('check') + 'Đã nhớ</button>' : '') + '</div></div>' +
      '<div id="fcEnd" hidden></div>';
  }
  function dueLabel(t) {
    var n = Math.round((t - today()) / DAY_MS);
    return n <= 1 ? 'ngày mai' : new Date(t).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' }) + ' (' + n + ' ngày nữa)';
  }
  function bindFlash(cards, opt) {
    opt = opt || {};
    var order = cards.map(function (_, i) { return i; }), pos = 0, flipped = false, fc = $('#fc');
    var total = cards.length, graded = 0, known = 0;   // dùng cho phiên ôn (removeOnGrade)
    function cur() { return cards[order[pos]]; }
    function face(txt, en, hint) { return '<span class="fc-k">' + (en ? 'English' : 'Tiếng Việt') + '</span><span' + (en ? ' lang="en"' : '') + '>' + esc(txt) + '</span><small>' + hint + '</small>'; }
    function finish() {   // hết thẻ: màn kết thúc phiên ôn hoặc trạng thái trống
      $('.fc-sess').hidden = true;
      var end = $('#fcEnd'), nx = srsNext();
      end.hidden = false;
      end.innerHTML = '<div class="fc-end">' + (graded ? ic('circle-check') + '<h3>Xong phiên ôn!</h3><p>Đã nhớ <b class="num">' + known + '/' + graded + '</b> thẻ' +
        (graded > known ? ' · ' + (graded - known) + ' thẻ sẽ gặp lại ngày mai' : '') + '</p>' : ic('calendar') + '<p>' + (opt.empty || 'Không có thẻ.') + '</p>') +
        (nx ? '<p class="meta">' + ic('calendar') + 'Lượt ôn tiếp theo: <b>' + dueLabel(nx) + '</b></p>' : '') +
        (graded ? '<a class="btn primary" href="#/">' + ic('house') + 'Về Hôm nay</a>' : '') + '</div>';
    }
    function show(instant) {
      if (!cards.length) { finish(); return; }
      var c = cur(), rev = $('#fcDir').checked;
      if (instant) fc.classList.add('instant');      // sang thẻ mới: úp thẻ ngay, không quay ngược
      fc.classList.toggle('back', flipped);
      $('#fcF').innerHTML = face(rev ? c.en : c.vn, rev, 'Nói to câu trả lời, rồi chạm để lật');
      $('#fcB').innerHTML = face(rev ? c.vn : c.en, !rev, 'Ngày ' + c.day + ' · chạm để lật lại');
      $('#fcF').setAttribute('aria-hidden', flipped); $('#fcB').setAttribute('aria-hidden', !flipped);
      fc.setAttribute('aria-label', flipped ? 'Úp thẻ' : 'Lật thẻ');
      if (instant) { void fc.offsetWidth; fc.classList.remove('instant'); }
      var of = opt.removeOnGrade ? total : cards.length;
      $('#fcPos').textContent = (opt.removeOnGrade ? graded + 1 : pos + 1) + '/' + of;
      $('#fcBar').style.width = ((opt.removeOnGrade ? graded : pos + 1) / of * 100) + '%';
      if ($('#fcYes')) { $('#fcFlip').hidden = flipped; $('#fcYes').hidden = $('#fcNo').hidden = !flipped; }
    }
    function go(k) { if (!cards.length) return; pos = (pos + k + cards.length) % cards.length; flipped = false; show(true); }
    function flip() { if (!cards.length) return; flipped = !flipped; show(); if (flipped && !$('#fcDir').checked) playPhrase(cur().src, cur().en, 1); }
    var swiped = false, tx = 0, ty = 0;
    fc.addEventListener('touchstart', function (e) { swiped = false; tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    fc.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; go(dx < 0 ? 1 : -1); }
    }, { passive: true });
    fc.onclick = function () { if (swiped) { swiped = false; return; } flip(); };
    fc.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
    $('#fcFlip').onclick = flip;
    $('#fcPrev').onclick = function () { go(-1); }; $('#fcNext').onclick = function () { go(1); };
    if ($('#fcShuf')) $('#fcShuf').onclick = function () { for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; } pos = 0; flipped = false; show(true); toast('Đã trộn thẻ'); };
    $('#fcSay').onclick = function () { if (cards.length) playPhrase(cur().src, cur().en, 1); };
    $('#fcDir').onchange = function () { flipped = false; show(true); };
    function grade(ok) {
      if (!cards.length || !flipped) return;
      srsGrade(cur().key, ok); haptic();
      if (opt.removeOnGrade) {
        graded++; if (ok) known++;
        cards.splice(order[pos], 1); order = cards.map(function (_, i) { return i; }); if (pos >= cards.length) pos = 0;
        flipped = false; show(true); if (opt.onChange) opt.onChange();
      } else { toast(ok ? 'Đã ghi: nhớ' : 'Đã ghi: chưa nhớ – sẽ gặp lại sớm'); go(1); }
    }
    if ($('#fcYes')) { $('#fcYes').onclick = function () { grade(true); }; $('#fcNo').onclick = function () { grade(false); }; }
    document.onkeydown = function (e) {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || modals.length) return;
      if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
    };
    show(true);
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
    secnav(['Nhớ lại', 'Viết', 'Nói', 'Đối chiếu'], function () { return [filled(st.recall, 5), words(st.write) > 0, filled(st.rubric, 5), false]; });

    // đồng hồ 30 phút + khoá flashcard 10 phút đầu
    function elapsed() { return st.start ? Math.floor((Date.now() - st.start) / 1000) : 0; }
    function mmss(s) { return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
    function tick() {
      var e = elapsed();
      $('#tmr').innerHTML = st.start ? (e < 1800 ? ic('clock') + ' Đã học <b class="num">' + mmss(e) + '</b> / 30:00' : ic('circle-check') + ' Đã đủ 30 phút') : 'Bấm "Bắt đầu" để tính giờ. 10 phút đầu: làm phần A mà không xem lại tài liệu.';
      $('#tmrBtn').textContent = st.start ? 'Bắt đầu lại' : 'Bắt đầu 30 phút';
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
        el.classList.toggle('good', !!v && ok); el.classList.toggle('bad', !!v && !ok);
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
    var h = '<div class="dayhead"><span class="badge">Ôn ngắt quãng</span><h1>Hộp ôn cụm từ</h1><div class="en">Hôm nay: ' + due.length + ' thẻ đến hạn' + (due.length ? ' · khoảng ' + Math.max(1, Math.round(due.length / 4)) + ' phút' : '') + '</div></div>';
    var cards = due.map(function (k) { return CARD[k]; }).sort(function (a, b) { return S.srs[a.key].box - S.srs[b.key].box || a.day - b.day; });
    h += '<section class="card srs-sess" aria-label="Phiên ôn">' + flashcards(cards, { grade: true, shuffle: false }) + '</section>';
    h += card('', 'Các hộp ôn', 'Mỗi khi bạn hoàn thành một ngày học, 6 cụm từ được đưa vào hộp 1. Nhớ → lên hộp cao hơn và lâu hơn mới gặp lại (1 → 3 → 7 → 14 → 30 ngày). Chưa nhớ → về hộp 1, gặp lại ngày mai.',
      '<div class="stats" style="margin:0">' + boxes.map(function (n, i) { return '<div class="stat"><b>' + n + '</b><span>Hộp ' + (i + 1) + ' · ôn sau ' + SRS_GAP[i + 1] + ' ngày</span></div>'; }).join('') + '</div>');
    app.innerHTML = h;
    function left() { renderChrome('srs'); }
    bindFlash(cards, { grade: true, removeOnGrade: true, onChange: left, empty: keys.length ? 'Không còn thẻ đến hạn hôm nay. Quay lại vào ngày mai!' : 'Hộp ôn đang trống. Hoàn thành một ngày học để thêm cụm từ.' });
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
      $$('.dv').forEach(function (td) { var i = td.getAttribute('data-i'), b = +A.before[i], a = +A.after[i]; td.textContent = b && a ? (a - b > 0 ? '+' : '') + (a - b) : ''; td.classList.toggle('pos', a - b > 0); });
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
  window.__eri = { norm: norm, uses: uses, srsDue: srsDue, streak: streak, player: player, state: function () { return S; } };   // dùng cho test tự động
  /* ---------- APK: nút Back Android — đóng sheet/onboarding → lùi trang → ở Hôm nay thì thoát app ---------- */
  if (PL.App) PL.App.addListener('backButton', function (e) {
    if (modals.length) { modals[modals.length - 1](); return; }
    var h = location.hash || '#/';
    if (h === '#/' || h === '#') PL.App.exitApp();
    else if (e && e.canGoBack) history.back();
    else location.hash = '#/';
  });

  route();
  if (!S.intro && !Object.keys(S.days).length) onboarding();   // lần đầu mở app
})();
