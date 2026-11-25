# MediaPulse — AVORA MEDIA Content Tracking

Bản localhost dùng Next.js App Router, TypeScript, Tailwind CSS, Prisma/PostgreSQL. Local có thể chạy bằng kho JSON bền vững trong `data/mock.json` khi DATA_MODE=mock, không cần PostgreSQL hoặc token Meta. Tên chế độ mock là adapter lưu trữ local; các Page thật nhập từ Excel được đánh dấu `manual`, không phải dữ liệu mẫu.

## Chạy local

Node.js 22.13+ và pnpm hoặc npm:

```powershell
Copy-Item .env.example .env
pnpm install
pnpm dev
```

Mở http://127.0.0.1:3000. Nếu đã có `.env`, giữ nguyên cấu hình và chỉ chạy `pnpm dev`.

| Vai trò thử nghiệm local   | Tài khoản             | Mật khẩu    |
| -------------------------- | --------------------- | ----------- |
| Admin                      | admin@media.local     | Demo@12345  |
| Staff — THÀNH TÂM          | thanh.tam@avora.local | Avora@12345 |
| User — chỉ xem tổng số bài | viewer@avora.local    | Demo@12345  |

Các tài khoản Staff nhập từ file có định danh đăng nhập dạng `ten.nhan.vien@avora.local`. Đây là định danh local được sinh để đăng nhập, không phải địa chỉ email lấy từ Excel. Admin có thể sửa tên/email/mật khẩu/vai trò và thêm hoặc xóa nhân viên trong `/admin`. Tài khoản mẫu và mật khẩu thử nghiệm chỉ phục vụ local.

## Phân quyền

- **Admin:** toàn quyền CRUD nhân viên và Fanpage; gán nhiều nhân viên cho Page; quản lý Facebook cá nhân, Facebook đang giữ Page; sync, export, kiểm duyệt và cấu hình.
- **Staff:** CRUD các Fanpage được giao tại `/staff`; Page tự thêm luôn gán cho chính Staff; sửa tên/link Page, tên/link Facebook đang giữ Page, chủ đề, tình trạng, ghi chú, nguồn dữ liệu. Không thể tự gán cho người khác, sửa role, quản lý nhân viên, cấu hình, kiểm duyệt hoặc trigger sync. Được xem dữ liệu bài đăng và xuất Excel trong phạm vi Page của mình.
- **User:** chỉ xem tên nhân viên và tổng số bài của toàn công ty, theo ngày. Không xem Fanpage, tài khoản Facebook, nội dung/metric chi tiết hoặc xuất Excel.

Role và phạm vi được kiểm tra lại ở backend. `/api/data` và `/api/export` trả 403 cho User; `/api/summary` chỉ trả số lượng, không trả profile, link Page hay bài viết. Staff không thể vượt quyền bằng cách thay id hoặc employeeIds trong request. Cấu hình companyWide cũ không mở rộng phạm vi Staff.

Đăng nhập dùng cookie ký HMAC (8 giờ), HttpOnly, SameSite=Lax, Secure khi production; mật khẩu hash scrypt; token Page mã hóa AES-256-GCM. SESSION_SECRET phải đủ ngẫu nhiên và ít nhất 32 ký tự. TOKEN_ENCRYPTION_KEY đúng 64 ký tự hex. Origin được kiểm tra cho API ghi. Rate limit đăng nhập hiện lưu trong process.

## Dữ liệu Excel đã nhập

Nguồn: `Copy of AVORA MEDIA - Content Tracking.xlsx`, sheet `CHECK LIST`, vùng A4:J166. Giữ nguyên file nguồn, chỉ đọc dữ liệu.

- 14 nhân viên, 145 Fanpage và 145 dòng check ngày 23/11/2026.
- 138 link Page hợp lệ; 5 Page thiếu link; 2 Page chứa link Facebook settings, được giữ để Admin/Staff sửa.
- 293 bài đã được ghi nhận từ 122 dòng có số hợp lệ; 23 dòng trống/SOS chưa có số bài hợp lệ.
- Giữ `null` cho số thiếu/SOS, không tự đổi thành 0. Nhân viên hoàn toàn thiếu số liệu hiện “Chưa có số liệu”. Trạng thái checked được giữ theo file (không tự đổi thành đã check).
- Không tạo bài giả, giờ giả, tương tác giả hoặc URL từng bài từ bảng tổng hợp.
- Một dòng chỉ có link tại dòng 113 nằm ngoài vùng nhân viên được gộp; không tự gán cho người ở dòng trước. Link này đã có ở dòng Bills Nation ngay sau đó.
- Hai dòng cùng tên Presspoint nhưng thiếu link vẫn là hai bản ghi theo dòng nguồn; không tự gộp khi chưa có Page ID.
- File không chứa Facebook cá nhân của nhân viên hoặc Facebook đang giữ Page. Các ô này để trống và có thể bổ sung trên giao diện.

Số liệu công ty được tách khỏi các Page mẫu ban đầu. Fixtures mẫu vẫn còn trong file dữ liệu, không được cộng vào báo cáo công ty khi đã có Page thật.

## Nhập lại từ nguồn

Bộ đọc chỉ đọc XLSX, không thực thi macro/formula hoặc chỉ dẫn trong ô. Dùng Python runtime hoặc `python` trên máy bạn:

```powershell
python -X utf8 scripts/inspect-workbook.py 'C:/path/Copy of AVORA MEDIA - Content Tracking.xlsx' data/import/avora-workbook.json
pnpm exec tsx scripts/import-avora.ts
```

Script tạo bản sao lưu `data/backups/before-avora-*.json` trước khi nhập. Dùng định danh theo dòng nguồn để chống trùng khi nhập lại đúng file. Không ghi đè tên/link/role người dùng đã sửa cho những bản ghi đã tồn tại. Báo cáo vấn đề ở `data/import/avora-result.json`. Tất cả file dữ liệu và backup nằm trong `data/` đã gitignore. Khi đổi cấu trúc hoặc sắp lại dòng nguồn, cần chuẩn bị mapping nhập liệu mới thay vì chạy lại mù quáng.

## Schema và PostgreSQL

`prisma/schema.prisma` gồm:

- `users`: tên, email đăng nhập unique, role admin/staff/user, hash mật khẩu, tên/link Facebook cá nhân và Facebook User ID optional.
- `fanpages`: tên, URL, Page ID nullable unique, tên/link Facebook giữ Page, chủ đề, tình trạng, ghi chú, nguồn manual/mock/facebook, token mã hóa, lần sync cuối.
- `employee_fanpages`: quan hệ nhiều–nhiều nhân viên/Page, khóa chính kép.
- `posts`: Post ID unique, thời gian UTC và ngày/giờ UTC+7, nội dung, link, metric và kiểm duyệt.
- `manual_checks`: tổng số bài/comment nullable theo Page/nhân viên/ngày, giá trị gốc, checked, ghi chú và nguồn file/sheet/dòng.
- `settings`: bật cron; companyWide là trường legacy, không mở quyền Staff.

Xóa Page sẽ xóa bài và check liên quan. Xóa nhân viên giữ bài/check, đặt người phụ trách về null để không mất số liệu lịch sử.

```powershell
docker compose up -d
```

Đặt DATA_MODE=database, DATABASE_URL và secret trong `.env`, rồi:

```powershell
pnpm db:push
pnpm db:seed
pnpm dev
```

Thiết lập SEED_ADMIN_EMAIL và SEED_ADMIN_PASSWORD trước khi seed. Với database production dùng Prisma migration thay cho db:push. Database chỉ ở server; không dùng Supabase nên không có RLS. Repository PostgreSQL dùng transaction/advisory lock; đang đọc/ghi theo snapshot cho quy mô MVP nhỏ, cần tối ưu truy vấn và job queue khi dữ liệu lớn.

## Facebook API và dữ liệu thủ công

Page manual không gọi API hoặc sinh mock khi sync. Admin có thể sửa Page, chuyển nguồn sang Facebook API và nhập token. API kiểm tra kết nối trước khi lưu, sau đó sync. Staff được lưu token cho Page của mình nhưng Admin là người trigger sync.

Service hỗ trợ Page ID, username, profile.php?id và /pages/name/id. Từ chối link trang chủ, settings, nhóm hoặc bài viết. Gọi `/{page-id}/posts`, phân trang cursor, timeout 20 giây, retry lỗi tạm thời. admin_creator được đối chiếu với Facebook User ID; khi thiếu chỉ tự gán nếu Page có một người phụ trách, còn nhiều người thì chờ Admin phân công.

Timestamp lưu UTC, tách ngày/giờ bằng Asia/Ho_Chi_Minh. Sync upsert theo Post ID, giữ kiểm duyệt và phân công thủ công. Lỗi Meta thật không thay bằng dữ liệu mẫu. Phiên bản API ở FACEBOOK_GRAPH_VERSION, mặc định v27.0; token/quyền và App Review do Meta cấp theo app.

Khi Page đã sync Facebook hoàn tất, số lượng từ các bài chi tiết thay thế check nhập từ Excel của Page đó trong báo cáo, không cộng hai nguồn. Dòng Excel gốc vẫn được giữ để truy vết.

## API, Excel và cron

- POST/DELETE `/api/auth`: đăng nhập/đăng xuất.
- GET `/api/data`: dữ liệu theo phạm vi Admin/Staff.
- POST `/api/data`: CRUD và các thao tác có kiểm tra role/phạm vi.
- GET `/api/summary?from=...&to=...`: tên nhân viên và tổng số bài toàn công ty; chỉ nhận bộ lọc ngày.
- GET `/api/export`: Admin/Staff, xuất sheet tổng hợp, bài chi tiết và check thủ công (nếu có), áp dụng cùng quyền và bộ lọc.
- GET `/api/cron`: yêu cầu Bearer CRON_SECRET, chạy nếu công tắc cron được bật.

Excel không đổi số thiếu thành 0, có cột số dòng thiếu và nguồn check. Nội dung được ghi như chuỗi, không thực thi công thức do người dùng nhập.

Cron 23:55 Việt Nam tương đương 16:55 UTC. Cần scheduler riêng; lần cập nhật này không tạo lịch hoặc thay đổi site cloud.

## Kiểm tra

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Khi localhost chứa bộ dữ liệu AVORA ở trên đang chạy: `node scripts/smoke.mjs` kiểm tra nhập liệu, ba role, quyền sở hữu sau khi gán lại, Admin CRUD nhân viên, Staff CRUD Page, export theo phạm vi và không sinh bài giả khi sync. Script chỉ tạo/xóa fixture QA của chính nó.

Bản cloud cũ nằm trong `sites/mediapulse-cloud` và có phiên bản/chính sách riêng. Lần cập nhật này áp dụng cho localhost; file Excel và dữ liệu nhập không được gửi lên cloud.

### Giao diện AVORA

- Logo trên site: public/brand/avora-logo.svg hiển thị cả biểu tượng và chữ AVORA MEDIA, nhúng nguyên byte ảnh gốc, không vẽ lại. Đây là SVG chứa raster, không phải vector thuần. Giữ JPG gốc để đối chiếu; tests/appearance.test.ts kiểm tra tính đồng nhất. Logo site dùng đầy đủ hình/chữ; SVG lọc nền trắng thành trong suốt. Riêng favicon (public/brand/favicon-avora-symbol-v2.png) và avora-mark.svg chỉ dùng biểu tượng bằng viewBox, không có chữ. Tiêu đề sau đăng nhập là AVORA MEDIA - Admin / Staff / User.
- Bảng màu: 8 màu có sẵn, color picker và mã HEX tùy chọn; Sáng / Tối / Hệ thống; lưu trong trình duyệt. Chữ trên nút và màu chữ nhấn tự điều chỉnh độ tương phản.
- Component dùng chung: DateRangePicker, Select, ScrollArea tại src/components/ui; biểu tượng Lucide React dùng thống nhất.
- Login: hai cột trên desktop, hình trang trí CSS bên trái, form gọn bên phải; mobile ưu tiên form. Không cuộn trang, không chứa tài khoản demo; tài khoản local xem ở hướng dẫn bên trên.
- Bài viết: mặc định ngày mới nhất có dữ liệu (không phải toàn bộ 7 ngày); truy cập URL có from/to sẽ ưu tiên khoảng đã chọn. Card riêng cho từng nhân viên, tổng riêng, cố định 8 mục mỗi card, có nút thu gọn; 8 nhân viên mỗi trang. Không hiện nguồn hay số dòng Excel trên màn này. Bộ lọc và Excel dùng cùng điều kiện, không thay đổi dữ liệu gốc.
- Quản lý Fanpage giữ nhóm nhân viên, CRUD và phân quyền như trước. Admin quản lý tất cả, Staff quản lý Page được giao; User chỉ có tổng số bài.

### Tài khoản và hồ sơ

- /users dành riêng Admin: CRUD tài khoản qua popup. Không thể hạ role hoặc xóa bất kỳ tài khoản Admin nào; kiểm tra cả giao diện và API trong giao dịch.
- Sidebar có nút thu gọn và lưu trạng thái trong trình duyệt; nav Quản lý bài đăng mở phần Fanpage.
- Menu avatar trên header: hồ sơ cá nhân hoặc đăng xuất. /api/profile cho mỗi người đọc/sửa hồ sơ chính mình: họ tên, điện thoại, địa chỉ, ảnh đại diện. Email và role không được sửa qua endpoint này.
- Avatar nhận PNG/JPEG/WebP tối đa 1 MB, xác minh chữ ký file và lưu vào dữ liệu local hoặc PostgreSQL. Thông tin điện thoại/địa chỉ không đưa vào danh sách User trong /api/data.
- Với PostgreSQL đã có dữ liệu: chạy prisma db push sau khi sao lưu theo quy trình của bạn, hoặc áp dụng prisma/profile-fields.sql. Local DATA_MODE=mock hoạt động ngay, không cần migration.
- Dropdown dùng listbox tùy chỉnh, tìm kiếm không dấu, bàn phím và portal để không bị cắt bởi popup hoặc bảng cuộn.

### Banner dùng chung và logo

- Component src/components/ui/page-heading.tsx được dùng cho Tổng quan (cả User), Bài viết, Quản lý bài đăng và Quản lý User. Các trang chỉ truyền title, description, eyebrow và actions.
- Prop theme nhận default / spring / summer / autumn / winter. Giữ default hiện tại; sau này có thể nối theme với cấu hình Admin mà không lặp lại banner ở từng trang. CSS dùng các biến --banner-bg và --banner-decoration.
- Logo UI dùng public/brand/avora-logo-transparent.svg. Chạy node scripts/build-brand.mjs để tạo lại các asset từ JPG gốc. Bộ lọc tách nền theo từng kênh màu, giảm viền trắng khi thu nhỏ; không vẽ lại logo. SVG vẫn nhúng nguồn raster gốc, không phải vector thuần.

### Điều hướng giữ nguyên khung workspace

- Các URL /, /posts, /admin, /staff và /users được nhóm tại src/app/(workspace). URL công khai không thay đổi.
- Layout của nhóm xác thực tài khoản và render AppShell một lần. Sidebar, topbar, avatar và trạng thái thu gọn/popup được giữ khi chuyển trang; trang con chỉ render nội dung.
- Điều hướng nội bộ dùng Next Link/router (bao gồm Xem dữ liệu và link Fanpage của nhân viên), có loading skeleton trong vùng nội dung. Bộ lọc truyền qua query string được cập nhật khi điều hướng.
- Các page guard và API vẫn kiểm tra quyền. Khi loading.tsx đã bắt đầu streaming, Next có thể trả HTTP 200 kèm meta redirect thay cho HTTP 307; smoke test kiểm tra redirect đúng đích và không render nội dung trang trái quyền.

Favicon Chrome: chỉ dùng biểu tượng cắt riêng, render ra PNG 64×64 và ICO 32/48/64, khai báo URL mới trong metadata để tránh cache icon cũ. Không dùng logo có chữ hay SVG còn chứa chữ ngoài viewport làm favicon.

## Đồng bộ Facebook theo ngày

Admin mở **Đồng bộ Facebook**, chọn ngày (mặc định hôm nay theo Asia/Ho_Chi_Minh), nhân viên và Fanpage, rồi bấm **Đồng bộ ngày đã chọn**. Giao diện hiển thị tiến độ và kết quả từng Page. Mỗi Page được gọi riêng, tối đa 3 Page đồng thời. Page chưa kết nối được bỏ qua; lỗi Facebook không chuyển sang mock. Staff xem bài của các Page được giao; User chỉ xem số lượng.

Để kết nối: **Quản lý bài đăng → Sửa Fanpage → Facebook API**, nhập Page ID/link và Page Access Token của chính Page đó. Token được mã hóa phía server. Không gửi token qua chat. Cần quyền đọc Page của Meta; admin_creator còn phụ thuộc business_management và có thể không được trả về. Nếu chỉ có một nhân viên phụ trách, bài được gán người đó; nhiều người phụ trách mà không có creator thì giữ Chưa phân công để tránh đếm trùng.

API POST /api/data với action sync nhận id (tùy chọn), employee (tùy chọn), date dạng YYYY-MM-DD (mặc định hôm nay). Server truyền since/until từ 00:00 ngày chọn đến trước 00:00 ngày kế tiếp UTC+7, duyệt toàn bộ pagination rồi lọc lại created_time. Chỉ khi lấy xong cả ngày mới upsert/đối soát các bài trong ngày đó; giữ ghi chú và kiểm duyệt. Ngày đồng bộ thành công 0 bài được ghi nhận là số 0, khác với chưa có dữ liệu. Lần sync sau cập nhật số Like/Comment/Share hiện tại của các bài đăng trong ngày, không phải số tương tác phát sinh riêng trong ngày. Chỉ số Meta không trả về hiển thị —.

Số check Excel chỉ được thay thế trên báo cáo cho đúng Page/ngày đã sync thành công; bản gốc vẫn lưu. Lịch sử ngày khác không bị thay đổi. Excel xuất giờ Việt Nam HH:mm:ss và ba cột Like/Comment/Share riêng, bỏ cột tổng tương tác.

PostgreSQL đang chạy trước bản cập nhật này: sao lưu DB rồi áp dụng prisma/daily-sync.sql **một lần**, sau đó chạy prisma generate. Local JSON tự nhận các trường mới. Graph API có giới hạn nội dung được đọc (ví dụ bài hết hạn/không truy cập được và Reels có endpoint riêng); đây là số bài trả về từ Page posts API, không cam kết bao gồm Reels. Tham khảo https://developers.facebook.com/docs/graph-api/reference/page/feed/ .
