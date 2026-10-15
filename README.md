# English for Remote IT & Freelancer — 60 ngày

Workbook luyện tiếng Anh 60 ngày cho dev remote & freelancer, dùng được trên điện thoại.

## Cài lên điện thoại

**Cách 1 — Web app (Android & iPhone):** mở https://nguyenhoangtin1404.github.io/remote-english-60-day/
- Android (Chrome): bấm **📲 Cài app vào máy** ở trang chủ (hoặc menu ⋮ → *Cài đặt ứng dụng*).
- iPhone (Safari): nút Chia sẻ → **Thêm vào MH chính**.
- Ở trang chủ bấm **⬇ Tải audio học offline** (~60MB) để học không cần mạng.

**Cách 2 — APK Android:** tải `RemoteITEnglish.apk` ở mục Releases, mở file để cài (cho phép "Cài ứng dụng không rõ nguồn gốc"). Audio có sẵn trong app, chạy offline 100%.

Tiến độ lưu trên máy — dùng **Xuất tiến độ** ở trang chủ để sao lưu / chuyển máy.

## Phát triển

```bash
npm install
npm run serve      # chạy web tại http://localhost:8080
npm run apk        # build APK debug (cần Android SDK + JDK 17) → android/app/build/outputs/apk/debug/
```

Push lên `main` → GitHub Actions tự deploy bản web lên GitHub Pages.
