# NEXT — Việc tiếp theo cho Brain OS

**Đọc STATE.md trước để biết đã làm gì.**

Toàn bộ stack + Robot Web Simulator đã chạy được: install, generate, migrate, seed, build đều pass, đã test API robot qua curl thực tế. Còn 3 việc:

## 1. Kiểm tra `/robot` bằng mắt (chưa test qua browser thật)
```bash
cd brain-os
npm run dev -- -H 0.0.0.0
```
Mở `/robot` — bấm từng nút (Chào, Ngủ, Thức dậy, Vui, Ngạc nhiên, Đang nghĩ, Nói thử, Quay trái, Quay phải, Dừng), xác nhận mặt/emoji đổi đúng, panel trạng thái cập nhật, event log hiện đúng thứ tự.

## 2. Form CRUD cho Memory, Task, Decision, People
UI hiện chỉ đọc (read-only), thêm form theo `src/app/<module>/page.tsx`, gọi `POST/PATCH` tương ứng đã có sẵn trong API.

## 3. Auth cơ bản
Thêm `src/middleware.ts` check header `X-Brain-Token` khớp `OWNER_SECRET` trong `.env` cho mọi `/api/*` (bao gồm `/api/robot/*`).

---

**Lưu ý hạ tầng:** Postgres chạy qua docker container `brainos-postgres` (không có volume persist). Nếu container bị xoá, tạo lại bằng lệnh trong STATE.md phần Database rồi `npx prisma migrate dev` + `npm run db:seed` lại.

**Robot Simulator — sẵn sàng cho ESP32 thật sau này:** khi có phần cứng, gọi thẳng `POST /api/robot/command` hoặc `POST /api/devices/dev-robot-simulator/events` — không cần đổi API, chỉ đổi nguồn gọi.

**Không làm:** n8n, AI agent phức tạp, nhận dạng mặt thật, UI cầu kỳ, module mới ngoài scope (Profile, Memory, PrivateMemory, People, FaceProfile, Project, Task, Decision, Prompt, Device, ActivityLog, Robot Simulator).
