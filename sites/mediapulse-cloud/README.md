# MediaPulse — Sites cloud edition

Bản cloud của MVP MediaPulse, dùng Vinext (App Router), React, TypeScript, Tailwind và Cloudflare D1. Bản Next.js + Prisma/PostgreSQL cho local vẫn ở thư mục gốc của workspace; bản xuất bản được quản lý riêng tại đây.

## Truy cập

Site riêng tư, giới hạn chủ sở hữu bởi nền tảng Sites. Người truy cập phải đăng nhập ChatGPT qua cơ chế của Sites; sau đó đăng nhập tài khoản nội bộ để thử Admin/User.

- Admin demo: admin@media.local / Demo@12345
- Nhân viên demo: nv1@media.local / Demo@12345 (đến nv4@media.local)

Dữ liệu mẫu được tạo một lần trong D1, gồm 6 Page, 4 nhân viên, 252 bài. Mọi cập nhật lưu trên server và tồn tại sau khi reload, đổi thiết bị hoặc redeploy. Đây là môi trường trải nghiệm nội bộ với tài khoản mẫu, chưa phải tài khoản công ty thật.

## Dữ liệu và bảo mật

`lib/db.ts` giữ giao diện repository của MVP, dùng bảng D1 `workspace_state` chứa snapshot JSON của users/fanpages/posts/settings. Revision và câu UPDATE có điều kiện giúp tránh ghi đè dữ liệu giữa các Worker. Mỗi mutation được ghi atomically. Hướng này phù hợp MVP nhỏ; khi dữ liệu lớn, cần chuyển các thực thể thành bảng và truy vấn theo bộ lọc. Schema và SQL migration ở `db/schema.ts`, `drizzle/`.

Các API kiểm tra role ở server; nhân viên chỉ nhận bài của Page được gán trừ khi Admin bật xem toàn công ty. Password dùng scrypt có salt; token Page dùng AES-256-GCM; session cookie ký HMAC, HttpOnly, Secure, SameSite=Lax. Secret được cấu hình bằng Sites environment tools, không có trong source hay manifest. Demo accounts được hiển thị rõ ràng và chỉ nên dùng trên Site riêng tư.

Page thật có thể thêm với nguồn Facebook Graph API; Page mẫu và Page thật luôn được phân biệt, không thay lỗi Meta bằng mock. Token thật cần quyền phù hợp và Meta App Review theo tài khoản của bạn.

## Chạy và kiểm tra

Yêu cầu Node 22.13+, pnpm. Chạy helper Sites để cài/build theo execution profile của checkout.

- `pnpm install`
- `pnpm db:generate` khi có thay đổi schema
- `pnpm build`
- Áp dụng migration D1 local theo README starter hoặc hướng dẫn Sites
- `pnpm start` để mở Worker preview
- `pnpm test` cho các test logic
- `node scripts/smoke.mjs` với TEST_BASE_URL trỏ đến Worker preview để kiểm tra auth, RBAC, XLSX, CRUD và sync

Runtime keys: SESSION_SECRET, TOKEN_ENCRYPTION_KEY (64 hex), CRON_SECRET, FACEBOOK_GRAPH_VERSION. Các secret production đã được lưu trong Sites, không trong file local.

Cron endpoint `/api/cron` vẫn yêu cầu Bearer CRON_SECRET và công tắc bật trong tab Cấu hình. Site riêng tư còn có lớp xác thực của nền tảng; cron ngoài nền tảng cần service access được cấp riêng. Chưa cấu hình lịch tự động trong lần xuất bản này.
