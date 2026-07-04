# STATE — Trạng thái Brain OS MVP

**Ngày tạo:** 2026-07-04  
**Cập nhật:** 2026-07-04 (phiên 3)  
**Phiên bản:** 0.1.0 MVP  
**Trạng thái:** Full stack chạy được — install, generate, migrate, seed, build đều pass. Database có dữ liệu mẫu thật.

---

## Đã làm

### Schema & Data
- [x] `prisma/schema.prisma` — 13 model đầy đủ
- [x] `prisma/seed.ts` — Profile, 5 Projects, 5 Devices, 5 Decisions, 2 Memories, 4 Connectors, 3 Preferences

### API Routes
- [x] `GET/PUT /api/profile`
- [x] `GET/POST /api/preferences`
- [x] `GET/POST /api/memories` + `GET/PATCH/DELETE /api/memories/:id`
- [x] `GET/POST /api/private-memories` + `GET/PATCH/DELETE /api/private-memories/:id`
- [x] `GET/POST /api/people` + `GET/PATCH/DELETE /api/people/:id`
- [x] `GET/POST /api/projects` + `GET/PATCH/DELETE /api/projects/:id`
- [x] `GET/POST /api/tasks` + `GET/PATCH/DELETE /api/tasks/:id`
- [x] `GET/POST /api/decisions` + `GET/PATCH/DELETE /api/decisions/:id`
- [x] `GET/POST /api/prompts` + `GET/PATCH/DELETE /api/prompts/:id`
- [x] `GET/POST /api/devices` + `GET/PATCH/DELETE /api/devices/:id`
- [x] `GET/POST /api/devices/:id/events`
- [x] `POST /api/devices/:id/command`
- [x] `GET /api/context` — context snapshot cho AI
- [x] `GET/POST /api/logs`
- [x] `POST /api/face/enroll`
- [x] `POST /api/face/identify` (stub MVP)

### UI Pages
- [x] Layout + Sidebar (11 nav items)
- [x] Dashboard (`/`) — stats, active tasks, pinned memories, recent logs
- [x] Hồ sơ (`/profile`)
- [x] Trí nhớ (`/memories`)
- [x] Kho riêng tư (`/vault`)
- [x] Người quen (`/people`)
- [x] Projects (`/projects`)
- [x] Tasks (`/tasks`)
- [x] Quyết định (`/decisions`)
- [x] Prompts (`/prompts`)
- [x] Thiết bị (`/devices`)
- [x] Logs (`/logs`)

### Infrastructure
- [x] `src/lib/prisma.ts` — singleton
- [x] `src/lib/logger.ts` — ActivityLog helper
- [x] `src/lib/api.ts` — ok/err/handleError
- [x] `src/components/ui/Card`, `Badge`, `PageHeader`
- [x] `src/components/layout/Sidebar`
- [x] Tailwind dark theme (surface/accent/zinc palette)
- [x] BRAIN_SPEC.md, STATE.md, NEXT.md

---

## File quan trọng nhất

| File | Vai trò |
|------|---------|
| `prisma/schema.prisma` | Schema nguồn sự thật — sửa đây trước |
| `src/lib/prisma.ts` | Prisma singleton |
| `src/lib/api.ts` | Response helpers |
| `src/lib/logger.ts` | ActivityLog |
| `src/app/layout.tsx` | Root layout |
| `src/app/api/context/route.ts` | Context API cho AI agent |
| `src/app/api/devices/[id]/command/route.ts` | Device command |

---

## Lỗi còn tồn tại / Known issues

- `face/identify` chỉ là stub — không có real cosine similarity
- `device command` là async queue không có push thật (WebSocket/MQTT chưa có)
- Không có auth/session — owner truy cập tự do (MVP assumption)
- UI chưa có form tạo mới — chỉ hiển thị data từ seed
- Chưa có search/filter UI
- Connector chưa có handler thực — chỉ là placeholder
- `next@14.1.0` có cảnh báo security (npm audit) — chưa upgrade, để tránh phá vỡ scope hiện tại
- `prisma` v5.22.0 có bản mới 7.8.0 (major) — chưa upgrade, ngoài scope hiện tại

## Database (phiên 3 — 2026-07-04)

- Môi trường ban đầu **không có Postgres chạy sẵn** (không service, không container, không nghe cổng 5432) dù `.env` đã trỏ `localhost:5432`.
- Đã tạo docker container Postgres 16 tên `brainos-postgres`, khớp đúng credentials trong `.env` (`postgres`/`postgres`/`brain_os`), map cổng `5432:5432`.
  ```bash
  docker run -d --name brainos-postgres \
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=brain_os \
    -p 5432:5432 postgres:16
  ```
- Chạy `npx prisma migrate dev --name init` → tạo migration `migrations/20260704102124_init/`, áp dụng thành công.
- Chạy `npm run db:seed` → seed OK. Đã verify số dòng trong DB khớp seed: Profile=1, Project=5, Device=5, Decision=5, Memory=2, Connector=4, Preference=3.
- **Lưu ý:** container `brainos-postgres` không có volume mount ngoài — nếu bị `docker rm`, dữ liệu mất. Nếu cần persist qua restart máy, thêm `-v brainos_pgdata:/var/lib/postgresql/data` khi tạo lại.
- `npm run build` chạy lại sau migrate — vẫn pass, không có regression.

## Lỗi đã sửa (phiên 2 — 2026-07-04)

1. **`next.config.ts` không hợp lệ với Next 14.1.0** → đổi thành `next.config.mjs` (Next 14 chưa hỗ trợ config `.ts`).
2. **Lỗi type Prisma Json field** (`Record<string, unknown>` không gán được cho `InputJsonValue`) lặp lại ở nhiều route:
   - Tạo helper `src/lib/json.ts` (`toJsonValue()`) để cast an toàn khi ghi field Json từ dữ liệu đã qua Zod.
   - Áp dụng ở: `src/lib/logger.ts`, `api/logs`, `api/people`, `api/people/[id]`, `api/devices`, `api/devices/[id]`, `api/devices/[id]/events`.
   - `api/devices/[id]/command` dùng cast `as Prisma.InputJsonValue` trực tiếp (payload dựng tay, không qua helper).
3. **Set `null` vào Json field** không hợp lệ với Prisma — phải dùng `Prisma.JsonNull`:
   - `api/face/enroll` (`face_embedding`)
   - `api/face/identify` (filter `where: { face_embedding: { not: Prisma.JsonNull } }`)

Kết quả: `npm run build` pass, tất cả 11 UI page + toàn bộ API routes compile thành công (28 routes total).

---

## Lệnh chạy project

```bash
cd brain-os

# 1. Cài dependencies
npm install

# 2. Cấu hình database (sửa .env nếu cần)
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brain_os"

# 3. Migrate schema
npx prisma migrate dev --name init

# 4. Seed data mẫu
npm run db:seed
# hoặc: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

# 5. Chạy dev
npm run dev
# → http://localhost:3000
```

---

## Cấu trúc thư mục hiện tại

```
brain-os/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── profile/page.tsx
│   │   ├── memories/page.tsx
│   │   ├── vault/page.tsx
│   │   ├── people/page.tsx
│   │   ├── projects/page.tsx
│   │   ├── tasks/page.tsx
│   │   ├── decisions/page.tsx
│   │   ├── prompts/page.tsx
│   │   ├── devices/page.tsx
│   │   ├── logs/page.tsx
│   │   └── api/
│   │       ├── context/route.ts
│   │       ├── logs/route.ts
│   │       ├── profile/route.ts
│   │       ├── preferences/route.ts
│   │       ├── memories/[id|route].ts
│   │       ├── private-memories/[id|route].ts
│   │       ├── people/[id|route].ts
│   │       ├── projects/[id|route].ts
│   │       ├── tasks/[id|route].ts
│   │       ├── decisions/[id|route].ts
│   │       ├── prompts/[id|route].ts
│   │       ├── devices/[id|route|events|command].ts
│   │       └── face/[enroll|identify].ts
│   ├── components/
│   │   ├── layout/Sidebar.tsx
│   │   └── ui/{Card,Badge,PageHeader}.tsx
│   └── lib/
│       ├── prisma.ts
│       ├── logger.ts
│       └── api.ts
├── .env
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.ts
├── BRAIN_SPEC.md
├── STATE.md
└── NEXT.md
```
