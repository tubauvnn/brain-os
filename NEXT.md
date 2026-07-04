# NEXT — Việc tiếp theo cho Brain OS

**Đọc STATE.md trước để biết đã làm gì.**

Toàn bộ stack đã chạy được: install, generate, migrate, seed, build đều pass. DB có dữ liệu mẫu thật (container docker `brainos-postgres`). Còn 3 việc:

## 1. Chạy dev server và kiểm tra UI thật
```bash
cd brain-os
npm run dev
```
Mở http://localhost:3000 — dashboard phải hiện stats; `/projects` 5 project; `/devices` 5 thiết bị; `/decisions` 5 quyết định.

## 2. Form CRUD cho Memory, Task, Decision, People
UI hiện chỉ đọc (read-only), thêm form theo `src/app/<module>/page.tsx`, gọi `POST/PATCH` tương ứng đã có sẵn trong API (xem chi tiết field trong BRAIN_SPEC.md phần API).

## 3. Auth cơ bản
Thêm `src/middleware.ts` check header `X-Brain-Token` khớp `OWNER_SECRET` trong `.env` cho mọi `/api/*`.

---

**Lưu ý hạ tầng:** Postgres chạy qua docker container `brainos-postgres` (không có volume persist). Nếu container bị xoá, tạo lại bằng lệnh trong STATE.md phần Database rồi `npx prisma migrate dev` + `npm run db:seed` lại.

**Không làm:** n8n, AI agent phức tạp, nhận dạng mặt thật, UI cầu kỳ, module mới ngoài scope (Profile, Memory, PrivateMemory, People, FaceProfile, Project, Task, Decision, Prompt, Device, ActivityLog).
