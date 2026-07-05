# NEXT — Việc tiếp theo cho Brain OS

**Đọc STATE.md trước để biết đã làm gì.**

## 1. Xác nhận Gemini hoạt động thật (đang chờ quota hồi phục hoặc key khác)
Máy đã có sẵn `GEMINI_API_KEY` thật trong `~/.bashrc` (biến này override giá trị rỗng trong `.env` của project), nhưng **liên tục bị 429** kể cả sau khi đợi cooldown 60s + thêm vài giây — nghi ngờ key đã hết quota hẳn (không phải rate-limit tạm thời trong vài phút). Cơ chế chống 429 (cooldown, fallback, không crash) đã test kỹ và hoạt động đúng — chỉ còn thiếu 1 lần xác nhận Gemini trả lời thành công thật sự. Thử lại:
```bash
curl -X POST http://localhost:3000/api/robot/chat -H "Content-Type: application/json" -d '{"text":"Brain OS là gì?"}'
```
Nếu `provider` trả về `"gemini"` (không còn `"fallback_429"`), nghĩa là đã hoạt động thật. Nếu vẫn 429 sau nhiều giờ, cần dùng key khác trong `.env` (`GEMINI_API_KEY=` trong `/root/brain-os/.env`, nhưng lưu ý biến trong `~/.bashrc` sẽ luôn override nó — muốn dùng key riêng cho project, cần `unset GEMINI_API_KEY` trước khi chạy `npm run dev`, hoặc sửa `~/.bashrc`).

## 2. HOÀN TẤT domain `os.irec.vn` (đang treo — chưa xác nhận được URL NPM đúng)

Đã hỏi user xác nhận họ truy cập NPM qua URL nào (vì database NPM chưa hề đổi trong 12 ngày dù báo đã thêm 2 lần) nhưng **chưa nhận được câu trả lời** — phiên vừa rồi user chuyển sang yêu cầu tích hợp Gemini thay vì trả lời. Cần quay lại hỏi:
- Bạn đang mở NPM qua `http://42.96.12.122:81` hay một domain/URL khác?
- Khi bấm Save trong NPM UI, có thấy `os.irec.vn` xuất hiện trong danh sách Proxy Hosts không, có báo lỗi gì không?

Verify sau khi có domain:
```bash
curl -I https://os.irec.vn
curl -I https://os.irec.vn/robot
curl -I https://os.irec.vn/tablet
```

## 3. Test Chat/Voice/Camera thật trên tablet (sau khi có domain HTTPS)
Test tab Chat, Voice (mic), Camera, nút "🔊 Test âm thanh" trên `https://os.irec.vn/robot` — mic/camera cần HTTPS domain thật để browser cấp quyền.

## 4. Form CRUD cho Memory, Task, Decision, People + Auth cơ bản
Việc cũ từ các phiên trước, vẫn chưa làm. **Auth đặc biệt quan trọng giờ** vì `accessLevel` cho robot chat đang hardcode = 1 ở `/api/robot/chat` — cần auth thật để gắn access_level đúng theo user đăng nhập thay vì hardcode.

---

**Lưu ý hạ tầng NPM:** container `nginx-proxy-manager` đang phục vụ ít nhất 1 domain khác (`code.irec.vn`) — khi thao tác trong NPM UI, chỉ thêm host mới, không sửa/xoá host đã có.

**Lưu ý hạ tầng Postgres:** container `brainos-postgres` không có volume persist. Nếu bị xoá, tạo lại theo lệnh trong STATE.md phần Database rồi `npx prisma migrate dev` + `npm run db:seed` lại.

**Lưu ý Gemini:** model mặc định `gemini-2.0-flash` (đổi qua `GEMINI_MODEL` trong `.env` nếu cần). Prompt đã có rule không bịa dữ liệu, không tiết lộ private memory ngoài quyền — xem `src/lib/ai/context.ts` (`buildBrainContext`) và `src/lib/ai/providers/gemini.ts` (system rules). Đã chống 429: cooldown 60s toàn cục (biến memory, reset khi restart server), context giới hạn 8000 ký tự, tối đa 5 bản ghi mỗi loại (memories/decisions/tasks/tin nhắn gần nhất).

**Lưu ý MediaFile:** ảnh lưu ở `uploads/media/` (ngoài `public/`, ngoài git). Không có route xem ảnh.

**Không làm:** cài nginx native mới, sửa/xoá cấu hình NPM của domain khác, n8n, AI agent phức tạp (multi-step/tool-use), nhận dạng mặt thật, native Android, service worker/offline cache, gửi ảnh lên AI/cloud, cài thêm Chromium/Playwright, module mới ngoài scope (Profile, Memory, PrivateMemory, People, FaceProfile, Project, Task, Decision, Prompt, Device, ActivityLog, RobotState, ConversationMessage, MediaFile).
