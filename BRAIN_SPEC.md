# BRAIN SPEC — Brain OS Architecture

## Mục tiêu
Brain OS là hệ thống trí nhớ dài hạn (long-term memory) + quản lý project/task + private vault + people + device API.  
Mục tiêu: trở thành "não chính" của toàn bộ hệ sinh thái (robot, ruaanh.vn, ChinChin, automation, AI agent).

---

## Nguyên tắc kiến trúc

1. **Core tách khỏi app cụ thể** — không hard-code robot/ruaanh/ChinChin vào core.
2. **Mọi module: schema → service → API → UI** — đủ 4 tầng.
3. **Plugin/Connector model** — nối ngoài qua Connector table (telegram, gmail, n8n, ruaanh, robot).
4. **Access level** — kiểm soát ai được đọc gì.
5. **Activity log** — mọi hành động quan trọng đều ghi vào ActivityLog.
6. **Code sạch, ít magic** — dễ để Codex/AI tiếp tục.
7. **Không làm AI agent phức tạp ở MVP** — stub là đủ.

---

## Module và bảng dữ liệu

| Module | Bảng | Ghi chú |
|--------|------|---------|
| Profile | `Profile`, `Preference` | Chủ hệ thống. Một owner. |
| Memory | `Memory` | Trí nhớ chung, access_level 0-4. |
| PrivateMemory | `PrivateMemory` | Vault riêng, access_level >= 3. |
| People | `People`, `FaceProfile` | Người quen + face identity. |
| Projects | `Project` | Các dự án đang chạy. |
| Tasks | `Task` | Task có subtask, gắn project. |
| Decisions | `Decision` | Quyết định kiến trúc/cuộc sống. |
| Prompts | `Prompt` | Prompt library cho AI. |
| Devices | `Device`, `DeviceEvent` | Mọi thiết bị đăng ký. |
| Connectors | `Connector` | Plugin nối dịch vụ ngoài. |
| ActivityLogs | `ActivityLog` | Audit log toàn hệ thống. |

---

## Access Level

| Level | Tên | Ý nghĩa |
|-------|-----|---------|
| 0 | public | Ai cũng đọc được |
| 1 | known | Người quen biết |
| 2 | family | Chỉ gia đình |
| 3 | owner_only | Chỉ chủ hệ thống |
| 4 | confirm_required | Cần xác nhận thêm |

---

## Device Types

`robot` | `laptop` | `camera` | `tv` | `esp32` | `browser` | `other`

Robot là một DeviceType. Nhận lệnh qua `POST /api/devices/:id/command`.  
Gửi event qua `POST /api/devices/:id/events`.

---

## API Chính

### CRUD chuẩn
```
GET/POST    /api/profile
GET/POST    /api/preferences
GET/POST    /api/memories
GET/PATCH/DELETE /api/memories/:id
GET/POST    /api/private-memories
GET/PATCH/DELETE /api/private-memories/:id
GET/POST    /api/people
GET/PATCH/DELETE /api/people/:id
GET/POST    /api/projects
GET/PATCH/DELETE /api/projects/:id
GET/POST    /api/tasks
GET/PATCH/DELETE /api/tasks/:id
GET/POST    /api/decisions
GET/PATCH/DELETE /api/decisions/:id
GET/POST    /api/prompts
GET/PATCH/DELETE /api/prompts/:id
GET/POST    /api/devices
GET/PATCH/DELETE /api/devices/:id
```

### API Đặc biệt
```
GET  /api/context?project_id=&limit=   → Context snapshot cho AI agent
GET/POST /api/logs                     → Activity logs
POST /api/face/enroll                  → Enroll face embedding
POST /api/face/identify                → Identify face (MVP stub)
POST /api/devices/:id/events           → Device gửi event lên
POST /api/devices/:id/command          → Gửi lệnh xuống device
GET  /api/devices/:id/events           → Lịch sử events
```

### Response format
```json
{ "ok": true, "data": {...} }
{ "ok": false, "error": "message" }
```

---

## Rule mở rộng

**Thêm module mới:**
1. Thêm model vào `prisma/schema.prisma`
2. Chạy `npx prisma migrate dev`
3. Tạo `src/app/api/<module>/route.ts` (GET/POST)
4. Tạo `src/app/api/<module>/[id]/route.ts` (GET/PATCH/DELETE)
5. Tạo `src/app/<module>/page.tsx`
6. Thêm vào Sidebar nav

**Thêm connector:**
1. Thêm enum vào `ConnectorType`
2. Tạo handler trong `/src/lib/connectors/<name>.ts`
3. Connector phải dùng ActivityLog khi trigger

**Face identity thật:**
1. Chọn embedding model (InsightFace, FaceNet...)
2. Implement cosine similarity trong `/api/face/identify`
3. Vẫn giữ `store_raw = false`

---

## File structure quan trọng

```
brain-os/
├── prisma/schema.prisma       ← Schema nguồn sự thật
├── prisma/seed.ts             ← Seed data mẫu
├── src/
│   ├── app/
│   │   ├── layout.tsx         ← Root layout + Sidebar
│   │   ├── page.tsx           ← Dashboard
│   │   ├── api/               ← API routes
│   │   └── [module]/page.tsx  ← UI từng module
│   ├── components/
│   │   ├── layout/Sidebar.tsx
│   │   └── ui/               ← Card, Badge, PageHeader
│   └── lib/
│       ├── prisma.ts          ← Prisma singleton
│       ├── logger.ts          ← Activity logger
│       └── api.ts             ← ok/err/handleError helpers
├── BRAIN_SPEC.md              ← Spec này
├── STATE.md                   ← Trạng thái hiện tại
└── NEXT.md                    ← Việc tiếp theo
```
