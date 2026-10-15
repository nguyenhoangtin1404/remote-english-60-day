# Kế hoạch nâng cấp UI/UX — Remote IT English

> Mục tiêu: hiện đại hơn, chuyên nghiệp hơn, **có động lực học mỗi ngày**, vẫn giữ những điểm mạnh hiện có:
> chạy offline, không cần build, một code base cho PWA và APK.
> Nghiên cứu dùng skill *ui-ux-pro-max* (design system, style, color, typography, UX guidelines, pro-rules checklist).

---

## 1. Đánh giá hiện trạng

**Điểm tốt (giữ nguyên):** mobile-first, tap target ≥ 44px, có safe-area, focus ring, `prefers-reduced-motion`,
tab bar dưới, mục lục bài sticky, input 16px (iOS không zoom), bảng chuyển thành thẻ trên mobile.

**Vấn đề khiến app trông "chưa chuyên nghiệp":**

| # | Vấn đề | Ảnh hưởng | Mức |
|---|---|---|---|
| 1 | Icon là emoji/ký tự Unicode (☰ ⌂ ▶ ↻ ★ ⬇ 📲 🎉) | Mỗi máy hiển thị khác nhau, nét không đều, không đổi màu theo theme | Cao |
| 2 | Không có dark mode | Học buổi tối bị chói; app hiện đại gần như luôn có | Cao |
| 3 | Màu viết cứng trong JS (`style="border-color:#fcd34d;background:#fffbeb"`) và CSS (`#0f172a`, `#cbd5e1`…) | Không theme được, khó giữ nhất quán | Cao |
| 4 | Trang chủ là một chuỗi thẻ ngang nhau (cảnh báo, hero, 4 số liệu, quy trình, lộ trình, cài app, sao lưu, xoá dữ liệu) | Không có điểm nhấn "Hôm nay học gì"; nút nguy hiểm *Xoá toàn bộ* nằm ngay trang chủ | Cao |
| 5 | Không có cơ chế giữ thói quen (chuỗi ngày, mục tiêu ngày) | Với khoá 60 ngày, đây là lý do lớn nhất khiến người học bỏ dở | Cao |
| 6 | Dùng thẻ `<audio controls>` mặc định | Giao diện khác nhau giữa Chrome, Safari và WebView; chuyển tốc độ 0.75 không trực quan | Trung bình |
| 7 | Font hệ thống | Tiếng Việt có dấu hiển thị không đồng đều giữa Android, iOS và Windows | Trung bình |
| 8 | Chỉ một cấp bóng và bo góc (`--rad:14px`), khoảng cách lẻ (10/12/14px) | Phân cấp thị giác yếu, nhịp không đều | Trung bình |
| 9 | Chuyển trang và lật thẻ không có hiệu ứng | Cảm giác "trang web" hơn là "app" | Thấp |
| 10 | APK: chưa có haptics, chưa đặt màu status bar, nút Back Android chưa xử lý riêng (drawer đang mở thì nên đóng drawer) | Chưa có cảm giác app native | Trung bình |
| 11 | `--muted:#64748b` trên nền `#f6f8fb` ≈ 4.5:1, sát ngưỡng | Chữ phụ hơi mờ ngoài trời | Thấp |

---

## 2. Định hướng thiết kế

**Phong cách: Modern Minimal (Swiss) + một chút "learning app" ở phần tiến độ.**
Tool design-system gợi ý *Claymorphism* và font *Baloo 2/Comic Neue*. Gợi ý đó dành cho app trẻ em
nên **không dùng**, vì người học ở đây là dev đi làm. Lấy từ kết quả tra cứu:
- *Minimalism & Swiss* (dành cho professional tools): nhiều khoảng trắng, phân cấp chữ rõ, hover 200–250ms.
- Bảng màu *Language Learning App*: indigo cho học tập, xanh lá cho tiến độ.

### 2.1 Màu (semantic tokens, có light và dark)

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--c-primary` | `#4F46E5` (indigo 600) | `#818CF8` | nút chính, tab đang chọn, link |
| `--c-on-primary` | `#FFFFFF` | `#0B1120` | chữ trên nút chính |
| `--c-success` | `#16A34A` | `#4ADE80` | hoàn thành, đúng, cụm từ đã dùng |
| `--c-streak` | `#F59E0B` | `#FBBF24` | chuỗi ngày, sao, thẻ đến hạn |
| `--c-danger` | `#DC2626` | `#F87171` | ghi âm, xoá |
| `--c-bg` | `#F8FAFC` | `#0B1120` | nền |
| `--c-surface` | `#FFFFFF` | `#131C31` | thẻ |
| `--c-surface-2` | `#F1F5F9` | `#1C2742` | chip, ô phụ |
| `--c-text` | `#0F172A` | `#E2E8F0` | chữ chính |
| `--c-text-muted` | `#475569` (7.5:1) | `#94A3B8` (≥ 6:1) | chữ phụ, **đậm hơn hiện tại** |
| `--c-border` | `#E2E8F0` | `#25314F` | viền, đường kẻ |

> Lựa chọn khác nếu muốn giữ nhận diện cũ: giữ xanh `#0284C7` làm primary và chỉ áp dụng phần token và dark mode.

### 2.2 Chữ
- **Be Vietnam Pro** (thiết kế riêng cho tiếng Việt) cho tiêu đề và nội dung; số liệu dùng `font-variant-numeric: tabular-nums`.
- **Tự host file woff2** (subset latin + vietnamese, 400/600/700, khoảng 60KB) trong `fonts/`. Không dùng Google Fonts CDN,
  vì CDN làm app offline và APK bị mất font.
- Thang chữ: 12 / 14 / 16 (body) / 18 / 22 / 28. Line-height 1.5 cho nội dung, 1.25 cho tiêu đề.
- Cụm từ tiếng Anh 18px semibold để nổi bật hơn phần dịch.

### 2.3 Khoảng cách, bo góc, bóng
- Khoảng cách theo bội số 4/8: `--s-1:4px … --s-8:48px`. Thay hết các giá trị lẻ 10/12/14px.
- Bo góc: `--r-sm:8px` (chip, input), `--r-md:12px` (nút), `--r-lg:16px` (thẻ), `--r-xl:24px` (hero, flashcard).
- Bóng 2 cấp: `--shadow-1` cho thẻ (rất nhẹ), `--shadow-2` cho drawer, sheet và toast. Dark mode thay bóng bằng viền sáng hơn.

### 2.4 Icon
- **Lucide** (nét 2px, outline), gom thành **một SVG sprite inline** (khoảng 25 icon, < 10KB) và dùng `<svg><use href="#i-play"/></svg>`.
- Hai kích thước token: 20px trong nội dung, 24px ở tab bar. Icon nằm cạnh chữ thì `aria-hidden`; nút chỉ có icon thì cần `aria-label`.
- Thay hết: ☰→`menu`, ⌂→`house`, ▶→`play`, ↻→`repeat`, ★→`star`, ⬇/⬆→`download`/`upload`, 📲→`smartphone`, 🎉→hoạt ảnh (xem mục 3.5).

### 2.5 Chuyển động
- Token thời gian: `--d-fast:120ms` (nhấn), `--d-base:200ms` (hover, đổi trạng thái), `--d-slow:320ms` (sheet, drawer, lật thẻ).
  Easing `cubic-bezier(.2,.8,.2,1)`. Hiệu ứng thoát nhanh hơn hiệu ứng vào.
- Chỉ animate `transform` và `opacity`. Mọi thứ tắt khi `prefers-reduced-motion`.
- Chuyển trang dùng **View Transitions API** (Chrome Android, WebView, Safari 18). Trình duyệt không hỗ trợ thì đổi trang tức thì như hiện tại.

---

## 3. Thay đổi theo màn hình

### 3.1 Điều hướng
Tab bar 4 mục, icon SVG, nhãn luôn hiện:

| Hôm nay | Lộ trình | Ôn tập (badge) | Cài đặt |
|---|---|---|---|

- **Lộ trình** thay drawer trên mobile: lưới 60 ô chia theo tuần (giống contribution graph), mỗi ô một màu theo trạng thái
  (chưa học / đang học / xong). Chạm vào ô để mở ngày. Desktop vẫn giữ sidebar.
- **Cài đặt** (màn hình mới): giao diện Sáng/Tối/Theo máy, tốc độ đọc mặc định, cài app, tải audio offline, sao lưu/nhập,
  tự đánh giá, **vùng nguy hiểm** (Xoá tiến độ) đặt cuối trang với hộp xác nhận rõ ràng.
- Topbar gọn lại: tên ngày hiện tại và nút quay lại khi ở trong bài; bỏ thanh tiến độ mini (đã chuyển sang trang Hôm nay).

### 3.2 Trang "Hôm nay" (thay trang chủ)
Thứ tự từ trên xuống, mỗi khối có một mục đích:
1. **Lời chào + chuỗi ngày**: "Chào buổi tối 👋" (chỉ chữ) · 🔥 icon *flame* + "7 ngày liên tiếp".
2. **Thẻ bài hôm nay** (khối nổi bật duy nhất): "Ngày 12 · Báo cáo bug rõ ràng", thanh 5 bước
   (Cụm từ · Dịch · Viết · Nói · Nghe) tô theo phần đã làm, nút lớn **Tiếp tục**.
3. **Ôn tập**: "8 thẻ đến hạn · ~3 phút" và nút Ôn ngay. Ẩn khi không có thẻ.
4. **Vòng tiến độ khoá học**: 12/60 ngày, cạnh đó 3 số liệu nhỏ (cụm từ đã thuộc, từ đã viết, sao trung bình).
5. Gợi ý theo ngữ cảnh, mỗi lúc chỉ hiện **một** thẻ: tự đánh giá đầu khoá, nhắc sao lưu, tải audio offline.
   Thay cho việc xếp chồng nhiều thẻ cảnh báo như hiện nay.
- "Quy trình 30 phút" chuyển thành màn onboarding lần đầu (3 slide) và mục trong Cài đặt.

### 3.3 Màn hình bài học
- **Stepper sticky** thay hàng nút tròn: 5 đoạn ngang có số và tick, đoạn hiện tại được tô màu.
  Trên điện thoại hẹp chỉ hiện nhãn của bước đang mở.
- **Cụm từ**: mỗi cụm là một thẻ, nút play tròn 48px bên trái, công tắc "Che nghĩa" dạng switch,
  chạm vào nghĩa để xem. Thêm nút **Nghe tất cả** để phát lần lượt cả 6 cụm.
- **Trình phát audio tự làm** (dùng chung cho Cụm từ, Shadowing, Nghe): play/pause lớn, thanh tua dày dễ kéo,
  chọn tốc độ dạng segmented `0.75× · 1×`, nút tua lại 5 giây, hiện thời gian. Bỏ `<audio controls>` mặc định.
- **Dịch**: ô nhập, nút "Kiểm tra" hiện đáp án ngay bên dưới để so sánh từng câu; chữ khớp được tô xanh nhạt.
- **Viết**: bộ đếm từ và chip cụm từ đổi màu khi đã dùng (đã có, chỉ cần làm đẹp); gợi ý độ dài mục tiêu.
- **Nói**: nút ghi âm tròn lớn ở giữa, vòng nhấp nháy khi đang ghi, đếm giờ; danh sách các lần ghi dạng thẻ có player nhỏ.
- **Thanh hoàn thành sticky** ở đáy (nằm trên tab bar): "3/5 phần đã xong · Hoàn thành ngày".
  Khi chưa đủ, nút vẫn bấm được nhưng mở sheet liệt kê phần còn thiếu (giữ logic `missing()` hiện có).

### 3.4 Ôn tập (flashcard)
- Thẻ lật 3D (`rotateY`, 320ms), mặt trước tiếng Việt, mặt sau tiếng Anh kèm nút play.
- Hai nút lớn **Chưa nhớ** / **Đã nhớ** đặt cố định ở vùng ngón cái. Hỗ trợ vuốt trái/phải (chỉ trên thẻ, không xung đột cuộn dọc).
- Thanh tiến độ phiên ôn ("5/12"). Màn kết thúc hiện số thẻ đã nhớ và ngày đến hạn tiếp theo.

### 3.5 Phản hồi và cảm giác "app"
- Trạng thái nhấn cho mọi nút: đổi nền và opacity trong 80–120ms, **không** dùng `scale` làm xô lệch layout.
- Hoàn thành ngày: hoạt ảnh check và hiệu ứng confetti nhẹ bằng CSS, không thêm thư viện. Tắt khi bật reduced-motion.
- Toast mới: có icon, nằm trên thanh hoàn thành, có `role=status` (đã có).
- APK: `@capacitor/haptics` rung nhẹ khi hoàn thành hoặc chấm thẻ; `@capacitor/status-bar` đổi màu theo theme;
  `@capacitor/app` bắt nút Back (đóng sheet hoặc drawer trước, sau đó lùi trang, ở trang Hôm nay thì thoát app).

---

## 4. Lộ trình triển khai

| Giai đoạn | Nội dung | Ước lượng | Rủi ro |
|---|---|---|---|
| **P0. Nền tảng** | Tokens màu/khoảng cách/bo góc/bóng; tự host Be Vietnam Pro; SVG sprite; dark mode (theo máy + nút chọn); bỏ màu viết cứng trong JS | 1–1.5 ngày | Thấp, gần như chỉ sửa CSS |
| **P1. Điều hướng + Hôm nay** | Tab bar mới, màn Lộ trình (lưới 60 ô), màn Cài đặt, trang Hôm nay, chuỗi ngày (lưu `S.streak`) | 1.5–2 ngày | Trung bình: đổi route, phải giữ được dữ liệu cũ |
| **P2. Bài học** | Stepper, thẻ cụm từ, trình phát audio tự làm, thanh hoàn thành sticky, nút ghi âm mới | 2 ngày | Trung bình: audio trên iOS phải thử máy thật |
| **P3. Ôn tập + hiệu ứng** | Flashcard lật/vuốt, View Transitions, hiệu ứng hoàn thành, onboarding 3 slide | 1 ngày | Thấp |
| **P4. Native APK** | Haptics, status bar, xử lý nút Back, build lại APK, release v1.1.0 | 0.5 ngày | Thấp |
| **P5. QA** | Checklist mục 5 trên 375/768/1024px, sáng/tối, offline, Android thật, iPhone | 0.5 ngày | — |

Mỗi giai đoạn deploy được độc lập (push `main` thì Pages tự cập nhật). Làm P0 trước vì mọi phần sau đều dựa vào token.

**Ràng buộc kỹ thuật giữ nguyên:** vanilla JS, không bundler, mở được bằng `file://`; dữ liệu `localStorage`
cũ (`eri60_progress_v1`) chỉ được **thêm trường**, không đổi cấu trúc; nâng `VER` trong `sw.js` mỗi lần đổi shell.

---

## 5. Checklist trước khi phát hành (từ pro-rules)

- [ ] Không còn emoji làm icon; icon cùng nét, cùng kiểu outline, đúng token kích thước
- [ ] Chữ ≥ 4.5:1 ở **cả** sáng và tối; icon và viền điều khiển ≥ 3:1
- [ ] Vùng chạm ≥ 44×44 (iOS) / 48×48dp (Android), cách nhau ≥ 8px
- [ ] Nhấn có phản hồi trong 80–150ms, không xô lệch layout
- [ ] Tab bar, thanh hoàn thành, toast không che nội dung; tôn trọng safe-area trên và dưới
- [ ] `prefers-reduced-motion` tắt lật thẻ, confetti, view transition
- [ ] Focus thấy rõ, thứ tự tab đúng thứ tự nhìn; sheet và drawer bẫy focus và đóng được bằng Esc/Back
- [ ] Không còn hex trong `app.js`; mọi màu đi qua token
- [ ] Font và icon hoạt động khi offline (PWA đã cache, APK không mạng)
- [ ] Kiểm tra ở 375 / 768 / 1024 / 1440px, Android thật, iPhone Safari và PWA đã cài

---

## 6. Cần bạn quyết định trước khi làm

1. **Màu chủ đạo:** indigo mới (đề xuất) hay giữ xanh dương hiện tại?
2. **Chuỗi ngày (streak):** có muốn không? Nếu có, nghỉ 1 ngày có mất chuỗi không, hay cho phép ngày nghỉ (Pro-tip) không tính?
3. **Điều hướng:** đồng ý thay drawer "Danh sách" bằng màn **Lộ trình** dạng lưới không?
