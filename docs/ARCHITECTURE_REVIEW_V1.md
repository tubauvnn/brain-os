# Brain OS — Architecture Review V1

**Vai trò:** Principal Software Architect review — phân tích thuần tuý, không code, không thêm tính năng, không refactor.
**Ngày:** 2026-07-08 · **Phạm vi:** toàn bộ source hiện tại (`/root/brain-os`), 43 phiên phát triển (xem `STATE.md`).
**Khung đánh giá:** Brain OS được coi là **AI Operating System** — không phải chatbot, không phải CRM, không phải Project Manager. Mục tiêu cuối: người dùng ra lệnh tự nhiên ("Tạo video quảng cáo", "Đi kiểm tra robot"), hệ thống tự chọn Agent → Model → Tool → chạy workflow → trả kết quả. Đích tới: 100+ Agents, 100+ Models, 100+ Tools, 100+ Devices **không sửa Core**.

---

> **⚠️ CẬP NHẬT 2026-07-09 — Kiến trúc V1 đã đóng băng, tài liệu này 1 phần đã bị thay thế.**
> Sau `ARCHITECTURE_AUDIT_V1.md` (audit đối kháng), các quyết định kiến trúc THẬT nằm ở bộ tài liệu sau, theo đúng thứ tự đọc:
> `KERNEL_ARCHITECTURE_V1.md` → `ARCHITECTURE_RULES_V1.md` → `SYSTEM_CONTRACTS_V1.md` → `EXECUTION_MODEL_V1.md` → `docs/IMPLEMENTATION_ROADMAP_V1.md`.
> Cụ thể trong tài liệu này:
> - **Mục 5-13 (Kiến trúc/Folder/Database/Agent/Model/Tool/Device/Memory Architecture đề xuất) — ĐÃ THAY THẾ.** "Core" gộp Router+Memory+Event Bus+Scheduler+Permissions ở mục 5 là **sai** — đã được `KERNEL_ARCHITECTURE_V1.md` mục 1 tự phê bình và tách lại: Kernel chỉ còn 6 nguyên thuỷ (Identity/Registry/Event Bus/Permission Gate/Lifecycle Manager/Config-Secrets), phần còn lại là Core Service thay được. Schema `Agent`/`AgentRun` ở mục 7 **mâu thuẫn** với `PluginDescriptor`/`Job` đã định nghĩa sau ở `SYSTEM_CONTRACTS_V1.md` mục 8-9 — dùng `PluginDescriptor`/`Job`, không dùng `Agent`/`AgentRun`.
> - **Mục 16 (Roadmap Phase 1-5) — ĐÃ THAY THẾ** bởi `docs/IMPLEMENTATION_ROADMAP_V1.md` (viết sau khi có đủ Kernel/Contracts/Execution Model, roadmap này ở đây đã lỗi thời về khối lượng công việc thật).
> - **Mục 1 (11 khía cạnh hiện trạng), mục 2-4 (điểm mạnh/yếu/rủi ro) — VẪN ĐÚNG, giữ nguyên** — đây là quan sát hiện trạng codebase tại thời điểm viết, không phải đề xuất kiến trúc, không bị thay thế. `RobotState → DeviceState` (mục 1.3/1.10) theo dõi tiến độ ở `docs/IMPLEMENTATION_ROADMAP_V1.md`, không phải ở đây.

## Cách đọc báo cáo này

- Mục 1 đi qua đúng 11 khía cạnh được yêu cầu đánh giá (Folder structure → Project Layer), mỗi khía cạnh kết bằng nhãn phân loại:
  **[ĐÚNG]** giữ nguyên · **[KHÓ MỞ RỘNG]** sẽ cản trở khi scale · **[REFACTOR SỚM]** nên sửa trước khi thêm Agent/Model/Tool/Device thứ 2 · **[CHƯA ĐỤNG]** để yên, ngoài phạm vi ưu tiên hiện tại.
- Mục 2–4 tổng hợp lại thành điểm mạnh/yếu/rủi ro ở tầm nhìn hệ thống (không lặp lại chi tiết mục 1).
- Mục 5–13 là kiến trúc đề xuất, có tham chiếu ngược cụ thể tới file/pattern hiện có — không phải thiết kế trên giấy trắng, mà là "tổng quát hoá cái đã có" ở nhiều chỗ.
- Mục 14–16 là hành động, xếp theo mức độ khẩn.

---

## 1. Đánh giá hiện trạng theo 11 khía cạnh

### 1.1 Folder structure

```
src/
├── app/                    # Next.js App Router — page.tsx (UI) + api/**/route.ts (32 route file)
├── components/
│   ├── ui/                 # Card, Badge, PageHeader — 3 primitive dùng chung toàn app
│   ├── layout/              # Sidebar.tsx + nav-config.ts (mới, phiên IA refactor)
│   └── robot/                # 7 component robot — 4/7 là dead code (xem 1.7)
└── lib/
    ├── prisma.ts, api.ts, logger.ts, json.ts, media.ts   # utility gốc, single-responsibility
    ├── robot.ts             # logic robot-simulator (command → state)
    ├── robot/tracking.ts, useRobotEyes.ts, emotion-map.ts   # tracking.ts + emotion-map.ts dead (0 import), useRobotEyes.ts sống
    ├── robot-ai/             # brain layer MỚI NHẤT cho robot chat (types, local-skills, demo-scenarios, chuoi-profile, language-guard, openai-provider)
    └── brain/                # brain layer CŨ — phần lớn dead code (xem 1.9)
```

Không có `src/core/`, `src/agents/`, `src/models/`, `src/tools/`, `src/devices/` — mọi "trí tuệ" (routing, persona, provider selection) nằm lẫn trong `lib/robot-ai` và `lib/brain`, được đặt tên theo **tính năng** ("robot-ai") chứ không theo **vai trò kiến trúc** (agent/model/tool). Đây là khác biệt quan trọng: cấu trúc thư mục hiện tại phản ánh lịch sử tính năng (robot, xiaozi, ai) chứ không phản ánh domain kiến trúc mục tiêu.

**[ĐÚNG]** `app/`, `components/ui`, `lib/` (utility gốc) tách bạch rõ, không có gì đặt sai chỗ mức nghiêm trọng.
**[KHÓ MỞ RỘNG]** không có nơi chuẩn để đặt Agent/Model/Tool/Device thứ 2 — người viết tiếp sẽ tự chọn đặt vào đâu (khả năng cao lại tạo `lib/photo-ai/`, `lib/video-ai/`... lặp lại đúng mẫu robot-ai đã có), nhân bản fragmentation thay vì hội tụ.

### 1.2 Architecture (kiến trúc tổng thể)

Mẫu hình hiện tại: **Next.js App Router route handler = toàn bộ business logic.** Không có service layer, không có dependency injection, không có central dispatcher. Mỗi trong 32 file `route.ts` tự làm: parse zod → gọi Prisma trực tiếp → `log()` → trả `ok()/err()`. Đây **chính xác** là kiến trúc "schema → service → API → UI đủ 4 tầng" mà `BRAIN_SPEC.md` đề ra — chỉ là "service" ở đây gộp thẳng vào route handler (hợp lý cho CRUD đơn giản, không hợp lý cho AI orchestration).

Không có bất kỳ tầng trung gian nào giữa "user request" và "gọi thẳng 1 model/1 script cố định". `askRobotOpenAI()`, `askCliAgents()`, `matchLocalSkill()` đều được gọi **trực tiếp và tuần tự cứng** trong `route.ts` của `/api/robot/chat` — không có khái niệm "chọn agent phù hợp" hay "chọn model phù hợp", chỉ có 1 nhánh if/else 4 bước (local skill → deep? → openai → fallback).

Chi tiết đáng chú ý: `src/lib/brain/system-context.ts` chứa 1 dòng string tĩnh — *"Có các layer: Personal Core, Work/Project Layer, Agent Router, Task System, Robot Interface."* — được **gửi làm prompt cho chính AI**, mô tả 1 kiến trúc "Agent Router" mà **không hề tồn tại trong code**. Đây là ví dụ cụ thể nhất cho khoảng cách giữa tầm nhìn (đã viết thành văn, kể cả trong prompt) và hiện trạng (0 dòng code thực thi khái niệm đó) — không phải lời chê, mà là tín hiệu tốt: kiến trúc mục tiêu đã được hình dung đúng từ trước, chỉ chưa được xây.

**[ĐÚNG]** cho miền CRUD thuần (Profile/Memory/People/Project/Task/Decision/Prompt) — route-handler-làm-tất-cả là lựa chọn đúng, không cần sửa.
**[KHÓ MỞ RỘNG]** cho miền AI/Agent — mỗi tính năng AI mới sẽ phải tái tạo lại đúng mẫu if/else 4 bước này (đã thấy lặp lại giữa `xiaozi-handler.ts` cũ và `robot/chat/route.ts` mới — 2 bản gần giống nhau, viết cách nhau ~20 phiên).
**[REFACTOR SỚM]** cần 1 lớp Router (Agent/Model) đứng giữa route handler và các "brain" cụ thể — xem mục 5.

### 1.3 Database

17 model, 7 enum, PostgreSQL qua Prisma. Model cốt lõi (`Memory`, `PrivateMemory`, `People`, `Project`, `Task`, `Decision`, `Prompt`, `Device`, `ActivityLog`, `Connector`) **generic, không hard-code business** — đúng nguyên tắc #1 của `BRAIN_SPEC.md`. Quan hệ qua `project_id` khá nhất quán (Memory/Task/Decision/ConversationMessage/MediaFile đều FK về Project).

Điểm lệch khỏi tổng quát hoá:
- **`RobotState`** — bảng 1-1 với `Device` nhưng chỉ áp dụng khi `device_type = robot` (field `face`, "mode" robot-specific). Đây là ví dụ **duy nhất** trong schema vi phạm "Robot chỉ là 1 Device" — nếu Camera/ESP32/Home Assistant vào sau theo đúng mẫu này sẽ có `CameraState`, `Esp32State`... nhân bản.
- **`Connector`** có enum `ConnectorType` (telegram/gmail/n8n/webhook/ruaanh/robot/custom) nhưng **không có bảng con lưu config theo loại** (dùng `config Json?` — chấp nhận được) và **không có handler code nào implement** (`src/lib/connectors/` không tồn tại) — schema đã đón đầu đúng hướng plugin, code chưa theo kịp.
- **Không có model `Agent`/`Model`/`Tool`/`AgentRun`** — tự nhận trong comment của chính codebase: `src/app/api/health/db/route.ts` dòng 8 viết thẳng *"Schema hiện tại không có model Agent/AgentRun — trả null thay vì bịa số 0."* Đây là bằng chứng rõ nhất rằng phần "OS điều khiển Agent" của tầm nhìn **chưa có chỗ đứng trong DB.**
- `access_level` là `Int` tự do (0-4) trên 6 model, validate range qua zod lúc ghi, nhưng **không có bảng/field nào định nghĩa "ai được đọc mức mấy"** — không có `User`/`Session`/`PermissionGrant`. Level tồn tại như 1 nhãn phân loại nội dung, không phải cơ chế phân quyền thật.

**[ĐÚNG]** giữ nguyên toàn bộ model CRUD hiện có — generic, đủ tốt, không cần đổi.
**[KHÓ MỞ RỘNG]** `RobotState` (per-device-type table); thiếu Agent/Model/Tool/AgentRun khiến "Running Agents" trên Dashboard tương lai không có nguồn dữ liệu.
**[REFACTOR SỚM]** tổng quát hoá `RobotState` → `DeviceState` **trước khi** thêm device type thứ 2 (chi phí migrate rẻ nhất là bây giờ, khi chỉ có 1 bảng đặc thù).

### 1.4 API

32 route file, chia 12 domain (profile, preferences, memories, private-memories, people, projects, tasks, decisions, prompts, devices, robot/\*, media, face, context, logs, health). Pattern **cực kỳ nhất quán**: zod schema riêng cho Create/Update → `try/catch` → `handleError()`. 11/12 domain CRUD giống hệt khuôn — hiếm thấy độ nhất quán này ở dự án lớn dần theo từng phiên.

Phát hiện quan trọng:
- **Không có `middleware.ts`.** Không route nào (kể cả `/api/private-memories`, access_level mặc định 3 = owner_only) kiểm tra danh tính người gọi. Bất kỳ ai/tiến trình nào gọi được tới Next.js server đều đọc/ghi được **mọi** bảng, kể cả vault riêng tư.
- `access_level` chỉ thực sự được **dùng để lọc** ở đúng 1 nơi: `src/app/api/context/route.ts` dòng 16 (`access_level: { lte: 1 }` khi build context snapshot). Ngoài chỗ đó, field này chỉ được validate lúc ghi, không bao giờ được đọc lại để gate quyền truy cập.
- `/api/context/route.ts` — endpoint **có thật, đang chạy**, gom `profile + memories(≤lv1) + active_tasks + decisions + online_devices` thành 1 snapshot. Đây chính là tiền thân đúng hướng của "context cho AI agent" nhưng **hiện không route/agent nào gọi nó** — robot chat dùng `SYSTEM_CONTEXT` tĩnh (`src/lib/brain/system-context.ts`) thay vì gọi context API này. Một mảnh ghép đúng hướng đang bị bỏ quên.
- "robot" hầu như không rò rỉ vào code generic — chỉ xuất hiện hợp lệ như 1 giá trị enum (`device_type`, `source_type`). Đây là điểm tốt, không phải coupling smell thật.
- Domain `/api/robot/*` (7 route: chat/status/command/event/tts/transcribe/realtime-token) là domain **duy nhất** không theo mẫu CRUD chuẩn — hợp lý vì bản chất khác (gọi AI/audio ngoài), nhưng cũng là domain duy nhất có 4 thế hệ logic chồng lấn (xem 1.9).

**[ĐÚNG]** pattern zod + `ok/err/handleError` cho mọi domain CRUD tương lai — giữ nguyên, đây là chuẩn tốt.
**[KHÓ MỞ RỘNG]** không có auth ở bất kỳ đâu — khi thêm Tool "Telegram"/"Google" (theo đúng roadmap người dùng), bề mặt API sẽ public hơn nữa mà vẫn 0 xác thực.
**[REFACTOR SỚM]** enforce `access_level` thật (ít nhất ở tầng đọc Memory/PrivateMemory) trước khi có Agent tự động gọi các API này thay người dùng — hiện tại "an toàn" chỉ vì chưa có gì tự động gọi, giả định đó sẽ sai ngay khi Agent Router ra đời.

### 1.5 State Management

Không có Context/Zustand/Redux/bất kỳ store toàn cục nào (đã grep xác nhận). 2 mẫu hình duy nhất:
- **Server Component + Prisma trực tiếp** — 11/12 trang (`profile`, `memories`, `vault`, `people`, `prompts`, `decisions`, `projects`, `tasks`, `devices`, `logs`, `brain` mới) — `async function Page()` query thẳng, không có client state ngoài form (hiện còn chưa có form tạo mới — "UI chưa có form tạo mới" tự ghi trong Known Issues).
- **`"use client"` + `useState` cục bộ** — chỉ `/robot/page.tsx`, ~15 state riêng lẻ (robotState, messages, autoSpeak, isFullscreen, gazeOverride...), không chia sẻ gì ra ngoài trang.

**[ĐÚNG]** cho quy mô hiện tại — server component trực tiếp là lựa chọn tối giản đúng đắn, `/robot` cần client state vì tương tác thời gian thực (mic, speech, fullscreen).
**[KHÓ MỞ RỘNG]** Dashboard tương lai cần hiển thị "Running Agents" (mục tiêu đã nêu) — dữ liệu này về bản chất **cross-page, real-time, nhiều agent chạy song song** — không có nguồn sự thật chung nào hiện nay để hiển thị (không SSE/WebSocket, không polling store, không server-sent event). Đây không phải lỗi hiện tại (chưa cần) nhưng là khoảng trống phải lấp trước khi Dashboard "Today/Running Agents/Robot Status" thành hiện thực.

### 1.6 Navigation

Vừa refactor xong (phiên IA V2): `Sidebar.tsx` + `nav-config.ts`, 5 nhóm (Dashboard/Brain/Projects/Devices/Logs), accordion hiện children theo route đang active, `NAV_GROUPS` là nguồn cấu hình duy nhất (trang `/brain` cũng đọc từ đây, không lặp danh sách). Không đổi URL nào, không có logic nghiệp vụ trong nav — đúng tinh thần "UI không quyết định kiến trúc, kiến trúc quyết định UI": `nav-config.ts` chỉ là 1 index trình bày lại route đã tồn tại, hoàn toàn không ảnh hưởng tới domain logic.

**[ĐÚNG]** giữ nguyên, không cần đụng thêm trong review này — đã đúng mẫu "cấu hình khai báo, mở rộng bằng thêm entry, không sửa logic hiển thị".
**[CHƯA ĐỤNG]** phần này independent với toàn bộ phần còn lại của báo cáo — refactor Core (Agent/Model/Tool) không đòi hỏi đổi gì ở nav.

### 1.7 Components

`components/ui/` — 3 primitive (`Card`, `Badge`, `PageHeader`), không state, tái sử dụng ở toàn bộ 12 trang, kích thước nhỏ, đúng single-responsibility. Đây là nền tảng UI tốt, nên là **chuẩn bắt buộc** cho mọi trang Agent/Tool/Device tương lai thay vì mỗi trang tự vẽ lại.

`components/robot/` — 7 file, ~2200 dòng, nhưng grep import (đã verify trực tiếp, không suy đoán) xác nhận **chỉ 1/7 còn sống**:
| File | Dòng | Trạng thái |
|---|---|---|
| `RobotFaceKiosk.tsx` | 198 | **Đang dùng** — import trực tiếp trong `/robot/page.tsx` |
| `RobotVision.tsx` | 188 | **Dead** — không được `page.tsx` import; chỉ còn được `RobotFace.tsx` (cũng dead) import → dead transitively |
| `RealtimeMicPanel.tsx` | 477 | **Dead** — 0 import ở bất kỳ đâu trong `src/` |
| `RobotFace.tsx` + `.module.css` | 393 | **Dead** — 0 import |
| `ExpressiveRobotFace.tsx` | 437 | **Dead** — 0 import (chỉ tự import `RobotFace.tsx`, cũng dead) |
| `WebFaceTracker.tsx` | 229 | **Dead** — 0 import |
| `XiaoziBridgePanel.tsx` | 263 | **Dead** — 0 import (Xiaozhi đã archive từ phiên 37) |

Tổng **~2000/2200 dòng (91%) của cả thư mục là dead code** — hệ quả tích luỹ qua nhiều lần "reset UI" (phiên 41 dọn `/robot` xuống 1 màn sạch, bỏ luôn Camera/Realtime panel khỏi UI chính nhưng không xoá file component). `lib/robot/tracking.ts` + `emotion-map.ts` chết theo cùng lý do (mất người gọi khi bỏ camera pan/tilt khỏi UI chính) — chỉ `useRobotEyes.ts` còn sống (được `RobotFaceKiosk.tsx` import).

**Phát hiện quan trọng thứ 2, chưa từng nhắc ở đâu khác trong báo cáo này:** cả 11 trang CRUD domain (Profile/Memory/Vault/People/Prompts/Decisions/Projects/Tasks/Devices/Logs, không tính `/robot` và `/brain`) **hoàn toàn read-only** — không 1 form tạo/sửa/xoá nào tồn tại trong UI, dù API CRUD đầy đủ (`POST/PATCH/DELETE`) đã có cho mọi domain. `memories/page.tsx` và `vault/page.tsx` literally render dòng chữ "Thêm qua API POST /api/memories" khi rỗng — xác nhận đây là chủ đích, không phải thiếu sót tạm thời. Nghĩa là: **Brain OS hôm nay vận hành qua curl/script/seed, không qua UI của chính nó**, ngoại trừ đúng 1 domain (robot chat). Điều này không sai (API-first là hướng đúng cho 1 OS), nhưng cần ghi nhận tường minh vì nó đổi hẳn cách đọc "component nào quan trọng" — phần lớn đầu tư UI thực tế đã dồn vào `/robot` (~530 dòng, 1 trang) trong khi 11 domain còn lại chỉ có list-view.

**Phát hiện thứ 3:** 7+ trang domain (`people`, `decisions`, `prompts`, `projects`, `tasks`, `devices`, `memories`, `vault`) lặp lại gần như nguyên văn cùng 1 khuôn: `prisma.X.findMany()` → `<PageHeader>` → `items.map(item => <Card><Badge>tags</Badge></Card>)`. Không có `<EntityList>`/`<EntityCard>` chung nào trừu tượng hoá khuôn này — mỗi trang tự viết lại vòng lặp render giống hệt nhau. Không nguy hiểm (thuần trùng lặp, không phải coupling sai), nhưng là ứng viên rõ ràng cho 1 component dùng chung khi domain CRUD thứ 8, 9, 10 tiếp tục nhân bản đúng khuôn này.

**[ĐÚNG]** `components/ui/` — mẫu chuẩn, nhân rộng cho Agent/Tool cards tương lai.
**[REFACTOR SỚM]** dọn dead code trong `components/robot/` + `lib/robot/tracking.ts`/`emotion-map.ts` (~2000+ dòng chắc chắn chết, đã verify import = 0, không phải phỏng đoán) — không khẩn nhưng nên làm **trước** khi thư mục này có thêm component Camera/ESP32, kẻo lẫn lộn "cái nào còn sống".
**[CHƯA ĐỤNG]** UI read-only + thiếu `<EntityList>` chung — cả 2 đều là nợ kỹ thuật thật nhưng **không chặn đường** tới Agent/Model/Tool Router (mục tiêu chính của review này); xứng đáng 1 phiên riêng sau khi Core ổn định, không nên trộn vào Phase 1-2 của roadmap (mục 16).

### 1.8 Memory

`Memory` (chung, access_level mặc định 1) và `PrivateMemory` (vault, access_level 3-4) — 2 bảng tách bạch rõ theo đúng khuyến nghị "Memory phải độc lập". CRUD API sạch, không có business logic ngoài validate.

Nhưng: **Agent hiện tại (robot chat) không đọc Memory tại runtime.** `SYSTEM_CONTEXT` gửi cho OpenAI là **chuỗi tĩnh hard-code** trong `system-context.ts`/`chuoi-profile.ts` — không truy vấn `Memory`/`PrivateMemory`/`Decision` theo `project_id`/`access_level` như kiến trúc phiên 13 (Gemini provider, đã xoá) từng làm qua `buildBrainContext()`. Tự nhận trong `STATE.md` (phiên 18): *"không có ngữ cảnh thật (không biết task/project/memory gì đang có)."* Đây là khoảng lùi so với thiết kế cũ, không phải tiến bộ — bản Gemini-era **có** đọc Memory, bản hiện tại (OpenAI-era) **không**.

`ConversationMessage`/`ConversationSession` — thiết kế **generic đúng** (`role`, `content`, `provider`, `metadata Json`, `session_id`, không field nào robot-specific ngoài optional `device_id`) nhưng **100% chỉ được dùng bởi robot chat** trên thực tế — chưa có domain thứ 2 nào tận dụng lại làm "lịch sử hội thoại Agent nói chung".

**[ĐÚNG]** tách `Memory`/`PrivateMemory` độc lập khỏi Agent logic — đúng yêu cầu "Agent chỉ đọc/ghi, logic không nằm trong Memory". Giữ nguyên 2 bảng này.
**[KHÓ MỞ RỘNG]** không có `MemoryService`/interface thu hẹp nào đứng giữa Agent và Prisma — mọi route tự viết `prisma.memory.findMany(...)` riêng; khi có Agent thứ 2 cần đọc Memory, sẽ hoặc (a) copy query, hoặc (b) gọi thẳng Prisma từ trong Agent code — cả 2 đều phá nguyên tắc "Agent chỉ đọc/ghi qua giao diện, không tự do truy vấn".
**[REFACTOR SỚM]** dựng 1 `MemoryService` mỏng (recall/remember, enforce access_level bên trong) làm **cổng duy nhất** — vá luôn lỗ hổng phân quyền ở mục 1.4 tại 1 chỗ thay vì rải rác N route.

### 1.9 AI Layer

Đây là khu vực phân mảnh nặng nhất trong toàn bộ codebase — **4 thế hệ logic gọi AI chồng lấn nhau**:

1. **`src/lib/ai/*`** (đã xoá khỏi working tree, còn trong git history) — thời Gemini (phiên 13-14). Có **interface `AiProvider`** thật (`{name, generateReply(userText, context)}`) + `buildBrainContext()` đọc Memory/Project/Task thật. Đây là bản **duy nhất từng có tư duy "provider trừu tượng"** — bị xoá không phải vì thiết kế sai mà vì Gemini bị 429 liên tục (phiên 14).
2. **`src/lib/brain/{xiaozi-bridge-brain,xiaozi-handler,demo-conversational-fallback,complexity,webhook-auth}.ts`** — thời Xiaozhi (phiên 24-32). `complexity.ts`/`xiaozi-bridge-brain.ts` **dead code xác nhận** (không route nào còn gọi, `/api/xiaozi/*` đã bị archion từ phiên 37). `webhook-auth.ts` (secret token + rate-limit — code chất lượng tốt) cũng dead theo vì không còn webhook public nào dùng.
3. **`src/lib/brain/{openai-provider,cli-agent-router,reply-schema,session-context,system-context}.ts`** — thời robot-chat OpenAI-mặc-định (phiên 16-18). `cli-agent-router.ts` **vẫn sống** (nhánh `deep:true`) nhưng theo `STATE.md` known-issues: 2/3 CLI provider (Codex, Gemini) chưa auth đúng trên VPS này — chỉ Claude CLI thật sự chạy được. `openai-provider.ts` (bản này) đã bị **thay thế** bởi thế hệ 4 nhưng file vẫn còn, `reply-schema.ts`/`session-context.ts`/`system-context.ts` vẫn được `route.ts` import — sống sót một phần.
4. **`src/lib/robot-ai/*`** (mới nhất, phiên 40-43) — `types.ts`, `local-skills.ts`, `demo-scenarios.ts`, `chuoi-profile.ts`, `language-guard.ts`, `openai-provider.ts`. Đây là bản **thực sự đang phục vụ** `/api/robot/chat` mặc định. Schema (`mood/action/eyes/mouth/hardwareCommand`) phong phú hơn 3 thế hệ trước, nhưng **persona ("Chuối") lại bake cứng vào chính model-call code** (`askRobotOpenAI()` chứa toàn bộ system prompt) — trộn lẫn khái niệm "Agent" (ai đang nói, persona gì) với "Model" (gọi provider nào) vào 1 file.

Không có SDK AI nào trong `package.json` (`openai`, `@anthropic-ai/sdk`... đều không có) — mọi lời gọi model dùng `fetch()` trần tới REST endpoint, tự viết `AbortController`/timeout/parse JSON lặp lại **4 lần** (tts route, transcribe route, robot-ai/openai-provider, realtime-token route) — không có 1 HTTP client / retry helper dùng chung.

**[KHÓ MỞ RỘNG]** toàn bộ khu vực này — mỗi Agent mới (Video/Photo/Research/Business...) nhiều khả năng sẽ tái tạo đúng mẫu "1 file provider riêng, 1 system prompt riêng, tự viết fetch+timeout+parse riêng" như đã thấy lặp lại 4 lần.
**[REFACTOR SỚM]** hợp nhất "gọi model" (Model Provider, tổng quát) tách khỏi "persona/kịch bản" (Agent, cụ thể) — xem mục 8-9. Xoá dead code thế hệ 1-3 sau khi xác nhận không còn route nào gọi tới (thế hệ 2 gần như chắc chắn chết, thế hệ 3 sống 1 phần qua `deep:true`).
**[CHƯA ĐỤNG]** `local-skills.ts`/`demo-scenarios.ts`/`language-guard.ts` (thế hệ 4) — logic đúng, chỉ cần **di chuyển vị trí kiến trúc** (từ "feature file" thành "Robot Agent implementation"), không cần viết lại.

### 1.10 Device Layer

`Device` (generic: `device_type` enum mở, `capabilities String[]`, `meta Json`, `token`) + `DeviceEvent` (generic telemetry/log) — nền tảng **đủ tốt** để làm Device Registry thật. `RobotState` là ngoại lệ đặc thù duy nhất (xem 1.3).

`POST /api/devices/:id/command` — nhận lệnh, ghi `DeviceEvent(event_type:"command")`, trả `202 {status:"queued"}`. Comment trong chính route: *"MVP: command is queued, not executed in real-time. Future: push via WebSocket/MQTT to actual device."* Không có kênh đẩy lệnh thật tới thiết bị — thiết bị (nếu có) phải tự poll `DeviceEvent`, cơ chế poll đó **cũng chưa tồn tại** ở phía thiết bị (chưa có firmware/client thật, chỉ có robot simulator web UI gọi ngược route riêng `/api/robot/command`, không đi qua route generic `/api/devices/:id/command` này).

`/api/robot/{status,command,event}` là **bản sao gần như trùng lặp** của `/api/devices/:id/{events,command}` generic, chỉ khác ở việc tự resolve `device_type=robot` thay vì nhận `:id`, và ghi thêm vào `RobotState`. Đây là ví dụ cụ thể nhất của "robot không thực sự chỉ là 1 Device" ở tầng API — có 2 con đường song song để điều khiển cùng 1 thiết bị.

**[ĐÚNG]** `Device`/`DeviceEvent` schema + `/api/devices/*` route generic — nền tảng đúng, giữ nguyên.
**[KHÓ MỞ RỘNG]** command fire-and-forget không push thật — khi có ESP32 thật (roadmap đã nêu), sẽ cần quyết định kênh đẩy lệnh (WebSocket/MQTT/long-poll) và điều đó ảnh hưởng ngược lên schema `DeviceEvent` (có thể cần tách `DeviceCommand` khỏi `DeviceEvent` — hiện đang dùng chung 1 bảng cho cả 2 chiều in/out).
**[REFACTOR SỚM]** hợp nhất `/api/robot/{status,command,event}` vào cùng cơ chế với `/api/devices/:id/*` (robot dùng device generic route + 1 lớp "Robot Agent" đọc/ghi `DeviceState` generic thay vì `RobotState` riêng) — làm trước khi thêm Camera/ESP32 thật, kẻo mỗi loại device lại có route riêng như robot đang có.

### 1.11 Project Layer

`Project` là hub hợp lý: `Memory`, `Task`, `Decision`, `ConversationMessage`, `MediaFile` đều FK `project_id` — đúng tinh thần "Project chỉ quản lý Tasks/Files/Knowledge/Timeline/Documents" mà yêu cầu đề ra, ở mức: **Tasks** ✅ đầy đủ (kể cả subtask qua self-relation), **Files** ✅ một phần (`MediaFile`, nhưng model này gắn chặt semantics "ảnh chụp camera/upload" — `mime_type`, `source_type: camera|upload|robot|tablet` — chưa phải "file dự án" tổng quát như tài liệu/PDF/export), **Knowledge** ⚠️ hiện đi qua `Memory` filter theo `project_id` (dùng chung bảng, không có bảng riêng — chấp nhận được), **Timeline/Documents** ❌ chưa có model nào tương ứng.

**[ĐÚNG]** quan hệ `project_id` xuyên suốt — mô hình hub-and-spoke đúng, giữ nguyên, mở rộng bằng cách thêm FK mới chứ không đổi cấu trúc.
**[CHƯA ĐỤNG]** Timeline/Documents chưa cần thêm ngay — đây đúng nghĩa "Project sẽ có sau" theo lời user, không phải thiếu sót cần vá gấp.

---

## 2. Điểm mạnh (tổng hợp)

1. **4 tầng schema → API → UI được tuân thủ tuyệt đối nhất quán** trên 11/12 domain — hiếm gặp ở dự án phát triển rời rạc theo phiên như thế này.
2. **Prisma schema cốt lõi generic, không hard-code nghiệp vụ cụ thể** (ruaanh/ChinChin/robot) vào cấu trúc bảng — đúng nguyên tắc kiến trúc #1 tự đề ra từ đầu (`BRAIN_SPEC.md`) và phần lớn được giữ vững.
3. **`Device` model đã đủ tổng quát** để làm Device Registry mà không cần đổi schema khi thêm loại thiết bị mới (trừ đúng 1 ngoại lệ: `RobotState`).
4. **Đã từng có tư duy Provider trừu tượng thật** (`src/lib/ai/AiProvider`, đã xoá) — không phải xây từ 0, chỉ cần hồi sinh + tổng quát hoá.
5. **Không khoá vendor SDK** — gọi REST trực tiếp, dễ thay/thêm provider (dù đang lặp code do thiếu HTTP client dùng chung).
6. **Ghi chép quyết định kiến trúc cực kỳ tốt** (`STATE.md` 43 phiên, `NEXT.md`, `BRAIN_SPEC.md`) — mọi quyết định đều có lý do bằng văn bản, giúp review này (và mọi refactor sau) có căn cứ thay vì đoán.
7. **Navigation vừa refactor đúng nguyên tắc "kiến trúc quyết định UI"** — `nav-config.ts` là index thuần trình bày, không rò rỉ logic nghiệp vụ.

## 3. Điểm yếu (tổng hợp)

1. **Không có bất kỳ tầng Agent/Model/Tool router nào** — toàn bộ "trí tuệ" nằm cứng trong 1 route (`/api/robot/chat`) phục vụ đúng 1 use case.
2. **4 thế hệ AI-calling logic chồng lấn**, ước tính **~2500+ dòng dead/nửa-dead code** rải trong `lib/brain/*` và `components/robot/*`.
3. **Không enforce phân quyền ở bất kỳ đâu** — `access_level` là nhãn, không phải cơ chế; không `middleware.ts`, không session, không auth.
4. **Persona (Agent) và Model provider bị trộn lẫn trong cùng 1 file** (`robot-ai/openai-provider.ts`) — sẽ phải tách lại ngay khi có Agent thứ 2 dùng chung OpenAI.
5. **Device command chưa có kênh đẩy thật** — "điều khiển thiết bị" hiện chỉ là ghi log DB.
6. **Robot đã lệch khỏi nguyên tắc "chỉ là 1 Device"** ở cả DB (`RobotState`) lẫn API (`/api/robot/*` song song với `/api/devices/*`).
7. **Agent không thực sự đọc Memory tại runtime** — đây là bước lùi so với kiến trúc Gemini-era đã bị xoá, không phải vấn đề mới nhưng cũng chưa được vá lại.

## 4. Rủi ro nếu tiếp tục phát triển như hiện tại

1. **Chi phí bảo trì tăng tuyến tính theo số Agent**, không phẳng — mỗi Agent mới (Video/Photo/Research/Business/SEO/Voice/Automation...) nhiều khả năng nhân bản lại đúng mẫu "1 file, 1 prompt, 1 fetch/timeout riêng" đã thấy lặp 4 lần trong AI layer.
2. **Rủi ro bảo mật thật, không phải lý thuyết** — `PrivateMemory` (access_level ≥ 3, "owner_only") đọc/ghi được bởi bất kỳ ai gọi được `/api/private-memories` — chưa bị khai thác chỉ vì chưa có gì public trỏ vào đó; điều này sẽ đổi ngay khi có Tool "Telegram"/"Google" hoặc Agent tự động thay mặt user gọi API. **Cụ thể hơn:** `/api/context/route.ts` là 1 endpoint **đang chạy thật**, gộp sẵn `profile + memories + active_tasks + decisions + online_devices` thành 1 JSON snapshot, **0 xác thực**, 0 caller hiện tại — nếu bất kỳ Tool/Agent nào sau này gọi nhầm hoặc bị lộ URL này ra ngoài, đây là 1 endpoint duy nhất tổng hợp sẵn phần lớn dữ liệu cá nhân, rủi ro cao hơn hẳn so với việc phải dò từng route CRUD riêng lẻ.
3. **Robot làm "hardcode mẫu"** cho device tiếp theo — nếu Camera/ESP32/Home Assistant lặp lại mẫu `RobotState` + route riêng, sẽ có N bảng *State gần giống hệt và N route song song, đúng thứ yêu cầu gốc cấm ("tuyệt đối không hardcode Robot").
4. **"Automation" (1 trong 8 domain mục tiêu) hiện không có nơi để sống** — không Event Bus, không Scheduler; automation viết ra sẽ tự chế cơ chế polling/cron riêng, lặp lại vấn đề #1.
5. **`deep:true` (CLI agent) có thể bị chọn nhầm** nếu sau này Agent Router coi nó là 1 Model provider hợp lệ tự động — 2/3 provider trong chain hiện fail âm thầm do chưa auth đúng trên VPS.
6. **Dead code tích luỹ** làm việc "tìm code thật đang chạy" ngày càng tốn thời gian khi số module tăng — đã mất công review kỹ (đọc source, grep import) chỉ để xác nhận 4/7 file trong `components/robot/` không ai dùng.

---

## 5. Kiến trúc đề xuất

```
┌─────────────────────────────── Brain OS Core ───────────────────────────────┐
│                                                                              │
│   Agent Router  ──▶  Model Router  ──▶  Tool Router  ──▶  Device Router     │
│        │                                                        │           │
│        ├──────────────────▶  Memory / Knowledge  ◀──────────────┤           │
│        │                    (MemoryService: recall/remember)    │           │
│        │                                                        │           │
│        └──────────────────▶  Event Bus  ◀────────────────────────┘          │
│                                   │                                          │
│                            Scheduler · Permissions · ActivityLog            │
└───────────────────────────────────────────────────────────────────────────┘
        ▲                    ▲                  ▲                  ▲
   src/agents/*         src/models/*       src/tools/*        src/devices/*
   (plugin, tự đăng ký)  (provider, tự     (capability,       (per device-type,
                          đăng ký)          tự đăng ký)        tự đăng ký)
```

**Nguyên tắc trung tâm:** Core **không bao giờ import** từ `agents/`, `models/`, `tools/`, `devices/` — chiều phụ thuộc chỉ đi 1 hướng (plugin → Core, không ngược lại). Thêm 1 Agent/Model/Tool/Device = thêm 1 thư mục tự đăng ký (self-registering module), **không sửa bất kỳ file nào trong Core**. Đây là điều kiện đủ để đạt "100+ Agent/Model/Tool/Device không sửa Core".

Route Next.js (`app/api/**`) trở thành **lớp mỏng nhất có thể**: parse request → gọi 1 entrypoint Core (`agentRouter.dispatch(input)` hoặc tương đương) → trả response. Domain CRUD thuần (Profile/Memory/Project/...) **giữ nguyên như hiện tại** — không cần Core can thiệp, đây không phải nơi Agent/Model/Tool sống.

Mỗi thành phần Core cụ thể:

- **Agent Router** — nhận input đã chuẩn hoá (text/voice/event), so khớp với `capabilities`/`triggerExamples` của từng Agent đã đăng ký, chọn Agent phù hợp nhất (khởi đầu: keyword/rule match như `local-skills.ts` đã làm tốt cho robot; nâng cấp sau: embedding similarity — không cần ngay).
- **Model Router** — Agent xin "1 model có capability X" (chat/vision/image-gen/video-gen/tts/stt), Router chọn provider cụ thể theo `ModelRegistry` + policy (cost/latency/fallback chain) — tổng quát hoá đúng cơ chế fallback-chain đã có trong `cli-agent-router.ts` (Codex→Claude→Gemini→fallback) thành cơ chế **dùng chung cho mọi Agent**, không viết riêng mỗi lần.
- **Tool Router** — bề mặt function-calling thống nhất (tương thích chuẩn tool-use của OpenAI/Anthropic, và có thể nhận thẳng MCP server làm nguồn Tool — xem mục 10).
- **Device Router** — cầu nối giữa Tool Router và `Device`/`DeviceState` — 1 device đã đăng ký tự động lộ ra như 1 tập Tool ("robot.turn_left", "camera.capture") cho Agent gọi, không cần Agent biết chi tiết giao thức thiết bị.
- **Memory/Knowledge (MemoryService)** — cổng duy nhất Agent được phép đọc/ghi `Memory`/`PrivateMemory`, enforce `access_level` bên trong (1 chỗ, thay vì 0 chỗ như hiện tại).
- **Event Bus** — in-process pub/sub (`EventEmitter` là đủ ở quy mô hiện tại, xem mục 15) để Device/Agent phát sự kiện, các bên khác (Agent/Automation) subscribe mà không cần biết nhau trực tiếp.
- **Scheduler** — chạy Agent theo lịch/1 lần trong tương lai — domain "Automation" cần cái này để tồn tại.
- **Permissions** — tổng quát hoá `access_level` int hiện có thành hàm `assertAccess()` dùng chung, gọi từ MemoryService/Device Router/Tool Router — không cần hệ thống RBAC phức tạp, chỉ cần 1 chỗ kiểm tra duy nhất thay vì 0 chỗ.

## 6. Folder structure đề xuất

```
src/
├── core/                      # KHÔNG BAO GIỜ import từ agents/models/tools/devices
│   ├── agent-router/
│   ├── model-router/
│   ├── tool-router/
│   ├── device-router/
│   ├── memory/                # MemoryService — cổng duy nhất vào Memory/PrivateMemory
│   ├── event-bus/
│   ├── scheduler/
│   └── permissions/
├── agents/
│   ├── robot-agent/           # tổng quát hoá từ lib/robot-ai/* hiện có (di chuyển, không viết lại)
│   ├── research-agent/        # ví dụ agent thứ 2, chứng minh mẫu nhân rộng được
│   └── ...
├── models/                    # tổng quát hoá AiProvider interface đã xoá (lib/ai/types.ts cũ)
│   ├── openai/
│   ├── claude/
│   ├── gemini/
│   └── ...
├── tools/
│   ├── filesystem/
│   ├── telegram/
│   └── ...
├── devices/
│   ├── robot/                 # thay cho RobotState đặc thù
│   └── ...
├── app/                       # route handler MỎNG — parse + gọi core + trả response
│   ├── api/                   # domain CRUD giữ nguyên y như hiện tại
│   └── [pages]/                # giữ nguyên
├── components/                # giữ nguyên ui/ + layout/, dọn dead code trong robot/
└── lib/                       # utility gốc, không domain logic (prisma/api/logger/json)
```

Đây **không phải viết lại** — `lib/robot-ai/*` gần như map 1-1 sang `agents/robot-agent/*` (di chuyển + tách phần "gọi OpenAI" ra `models/openai/`), `lib/ai/AiProvider` (đã xoá, còn trong git history) là khởi điểm tốt cho `core/model-router/` + `models/*`.

## 7. Database đề xuất

Bổ sung (additive, không phá schema hiện có):

```prisma
model Agent {
  id           String   @id @default(cuid())
  slug         String   @unique          // "robot-agent", "video-agent"
  name         String
  description  String?
  capabilities String[] @default([])
  config       Json?
  enabled      Boolean  @default(true)
  runs         AgentRun[]
}

model AgentRun {
  id          String   @id @default(cuid())
  agent_id    String
  model_slug  String?                    // provider thực sự dùng lượt này
  input       Json
  output      Json?
  status      String   @default("running") // running|done|error
  error       String?
  started_at  DateTime @default(now())
  finished_at DateTime?
  agent       Agent    @relation(fields: [agent_id], references: [id])
}

model DeviceState {                       // thay cho RobotState — 1 dòng / device, mọi loại
  id         String   @id @default(cuid())
  device_id  String   @unique
  state      Json                          // schema tự do, do Device plugin diễn giải
  updated_at DateTime @updatedAt
  device     Device   @relation(fields: [device_id], references: [id], onDelete: Cascade)
}
```

`Model`/`Tool` **chưa cần bảng riêng ở Phase 1-2** — đăng ký qua code (self-registering module) là đủ; chỉ cần bảng DB khi muốn bật/tắt hoặc cấu hình Model/Tool **không cần redeploy** (Phase 5). Làm bảng DB quá sớm cho thứ chưa có nhu cầu "hot-config" là over-engineering (xem mục 15).

`RobotState` → migrate dữ liệu sang `DeviceState` (giữ `RobotState` đọc-only 1 thời gian ngắn hoặc xoá thẳng vì chỉ có 1 row demo). Không đổi gì ở `Memory`, `PrivateMemory`, `Project`, `Task`, `Decision`, `Prompt`, `People`, `ActivityLog`, `Connector` — các bảng này đã đúng.

## 8. Agent Architecture

```ts
interface Agent {
  slug: string;                    // "robot-agent"
  name: string;
  capabilities: string[];          // ["robot-control", "small-talk-vi"]
  triggerExamples: string[];       // dùng cho Agent Router match
  run(input: AgentInput, ctx: AgentContext): Promise<AgentResult>;
}
```

`AgentContext` là thứ Core tiêm vào — cấp cho Agent quyền gọi `ctx.model(capability)`, `ctx.tool(name)`, `ctx.memory.recall()/remember()`, `ctx.emit(event)` — Agent **không tự import Prisma, không tự fetch OpenAI**. Đây là ranh giới quan trọng nhất: Agent chỉ code **kịch bản/quyết định**, không code **cách gọi model** hay **cách truy vấn DB**.

`robot-agent` (di chuyển từ `lib/robot-ai/*`) là bằng chứng khả thi tốt nhất hiện có: `local-skills.ts` **đã đúng là logic Agent** (chọn kịch bản theo input), chỉ cần đổi chỗ gọi OpenAI trực tiếp (`askRobotOpenAI`) thành `ctx.model("chat-vi-short")`.

Đăng ký: mỗi thư mục `agents/<slug>/index.ts` export 1 `Agent` object; 1 file loader duy nhất trong `core/agent-router/` glob-import toàn bộ `agents/*/index.ts` lúc khởi động — thêm agent thứ 101 chỉ là thêm 1 thư mục, **0 dòng sửa trong `core/`**.

## 9. Model Architecture

```ts
interface ModelProvider {
  slug: string;                 // "openai-gpt5-nano", "claude-sonnet"
  capabilities: string[];       // ["chat", "vision"], ["video-gen"], ["tts"]
  invoke(request: ModelRequest): Promise<ModelResponse>;
}
```

Tổng quát hoá đúng interface `AiProvider` đã có (và bị xoá) trong `src/lib/ai/types.ts` — chỉ mở rộng `generateReply(text, context): Promise<string>` (hẹp, robot-chat-specific) thành `invoke(request): Promise<response>` (rộng, đa capability). Model Router chọn provider theo capability + policy (giá/tốc độ/fallback) — logic fallback-chain trong `cli-agent-router.ts` (thử Codex → Claude → Gemini theo thứ tự, canh tổng timeout) tổng quát hoá thẳng thành policy mặc định của Model Router, dùng lại cho **mọi** Agent thay vì chỉ robot chat.

Provider cụ thể theo capability (ví dụ, không giới hạn danh sách):
- **Chat/reasoning:** Claude, GPT (OpenAI), Gemini, Grok, OpenRouter (bản thân là 1 meta-provider gộp nhiều model phía sau — Model Router coi OpenRouter như 1 provider bình thường, không cần biết nó proxy tiếp).
- **Image/Video generation:** fal, Runware.
- **Vendor khác (vd "TOTU")** — Model Router **không cần biết trước** danh tính nhà cung cấp; miễn implement đúng `ModelProvider` interface là đăng ký được, đúng tinh thần "không hardcode".

Không cần SDK vendor — giữ nguyên cách gọi `fetch()` REST hiện tại, nhưng rút 4 bản `AbortController`/timeout/parse-JSON trùng lặp (tts, transcribe, robot-ai/openai-provider, realtime-token) thành **1 HTTP helper dùng chung** trong `core/model-router/http.ts`.

## 10. Tool Architecture

```ts
interface Tool {
  name: string;                   // "telegram.send_message"
  description: string;
  inputSchema: ZodSchema;         // tái dùng zod đã có sẵn khắp API
  execute(input: unknown, ctx: ToolContext): Promise<unknown>;
}
```

Tương thích trực tiếp với chuẩn tool-calling của OpenAI/Anthropic (mô tả bằng JSON Schema từ zod) — Agent không tự quyết định "gọi API nào", chỉ khai "cần tool có tên X", Model (qua tool-use) hoặc Agent logic quyết định gọi.

**Khuyến nghị mạnh:** hỗ trợ **MCP (Model Context Protocol) client** trong Tool Router. Google/GitHub/Telegram/Filesystem/Cloudflare **đã có MCP server công khai/dễ viết** — thay vì tự viết integration cho từng dịch vụ, Tool Router chỉ cần biết "kết nối tới 1 MCP server, expose toàn bộ tool nó khai báo" → đúng nghĩa "Tool là Plugin, không hardcode" ở mức triệt để nhất (thêm Tool = thêm 1 dòng cấu hình MCP endpoint, không viết code).

`ESP32`/`Camera`/`Printer` là ví dụ Tool **được sinh ra từ Device** (không phải Tool độc lập) — xem mục 11 để rõ ranh giới.

## 11. Device Architecture

Ranh giới rõ giữa **Device** và **Tool**: Device là 1 thực thể có **định danh + trạng thái** (nằm trong DB, có online/offline, có lịch sử event) — ví dụ 1 con robot cụ thể, 1 camera cụ thể. Tool là 1 **khả năng hành động không nhất thiết có trạng thái** — "gửi tin Telegram" không có "trạng thái" theo nghĩa device.

`Device`/`DeviceEvent`/`DeviceState` (đề xuất mục 7) đã đủ tổng quát làm nền. Device Router khi khởi động sẽ **tự sinh Tool tương ứng** cho mỗi device đã đăng ký (vd device `robot-01` sinh tool `device.robot-01.turn_left`) — đây là cách ESP32/Camera "vừa là Device vừa dùng được như Tool" mà không cần định nghĩa 2 lần.

```ts
interface DevicePlugin {
  deviceType: string;             // khớp DeviceType enum
  interpretState(raw: Json): DeviceStateView;   // diễn giải DeviceState.state theo loại thiết bị
  commands: Record<string, { schema: ZodSchema; send(device, args): Promise<void> }>;
}
```

`send()` hôm nay có thể vẫn chỉ là ghi `DeviceEvent` (giữ nguyên hành vi fire-and-forget hiện tại — **không vội xây WebSocket/MQTT**, xem mục 15) — điểm mấu chốt là **giao diện đã sẵn sàng** để cắm kênh push thật vào sau mà không đổi Agent/Tool Router phía trên.

## 12. Memory Architecture

```ts
interface MemoryService {
  recall(query: MemoryQuery, requesterAccessLevel: number): Promise<MemoryEntry[]>;
  remember(entry: NewMemoryEntry, requesterAccessLevel: number): Promise<MemoryEntry>;
}
```

Đây là **cổng duy nhất** vào `Memory`/`PrivateMemory` — mọi Agent gọi qua `ctx.memory`, không bao giờ tự `prisma.memory.*`. `assertAccess(requesterAccessLevel, entry.access_level)` nằm **bên trong** `MemoryService`, chạy **1 lần, đúng 1 chỗ** — vá luôn lỗ hổng "không enforce access_level" nêu ở mục 1.4/1.8 mà không cần sửa từng route.

`ConversationMessage`/`ConversationSession` giữ nguyên schema (đã generic đúng) nhưng nên coi là **Agent memory ngắn hạn** (per-session) tách biệt khỏi **Memory dài hạn** (`Memory`/`PrivateMemory`) — `MemoryService` có thể quản lý cả 2 nhưng expose 2 method riêng (`recallLongTerm`/`recallSession`), không gộp lẫn.

Logic "nên nhớ gì, nên gợi lại gì" (ranking, similarity, semantic search sau này) sống **trong `MemoryService`**, không sống trong từng Agent — đúng yêu cầu "logic Agent không được nằm trong Memory" (và ngược lại: logic Memory không lặp lại trong từng Agent).

## 13. Event Flow — 2 kịch bản tham chiếu

**"Tạo video quảng cáo"**
1. Input (chat/voice/Telegram tool) → chuẩn hoá thành `AgentInput`.
2. **Agent Router** khớp capability `video-generation` → chọn Video Agent (hoặc Business Agent điều phối Video Agent như 1 bước con).
3. Video Agent gọi `ctx.memory.recall()` — lấy Prompt/Memory liên quan brand/style (ví dụ Prompt library tag "video", Memory pinned của Project).
4. Video Agent xin `ctx.model("video-gen")` → **Model Router** chọn fal/Runware theo policy.
5. Video Agent gọi thêm `ctx.tool("filesystem.save")`, `ctx.tool("telegram.notify")` nếu cần lưu/publish.
6. Kết quả + toàn bộ trace lưu vào `AgentRun`; `ActivityLog` ghi như hiện tại; **Event Bus** phát `agent.completed` (Notification Agent hoặc automation khác có thể subscribe).
7. Trả kết quả về đúng kênh user gọi.

**"Đi kiểm tra robot"**
1. Input → **Agent Router** khớp capability `device-inspection` → Robot Agent.
2. Robot Agent gọi **Device Router** → resolve device robot đã đăng ký → đọc `DeviceState` mới nhất / yêu cầu snapshot camera.
3. Robot Agent gọi `ctx.tool("camera.capture")` (Tool sinh ra từ Device, mục 11).
4. Robot Agent xin `ctx.model("vision")` → **Model Router** chọn provider có khả năng vision (Claude/GPT/Gemini vision) → phân tích khung hình.
5. Robot Agent ghi `DeviceEvent`/`AgentRun`, phát `device.inspected` lên **Event Bus** (Security Agent nếu có, subscribe sẵn, có thể tự leo thang khi phát hiện bất thường).
6. Trả lời user.

Cả 2 luồng đi qua **toàn bộ** thành phần Core đề xuất (Agent/Model/Tool/Device Router, Memory, Event Bus, ActivityLog) — không thành phần nào thừa, không thành phần nào thiếu để phục vụ đúng 2 ví dụ mục tiêu người dùng đưa ra.

---

## 14. Những việc nên refactor ngay (trước khi thêm Agent/Model/Tool/Device thứ 2)

1. **Tách "gọi model" khỏi "persona"** trong `lib/robot-ai/openai-provider.ts` — persona ("Chuối") chuyển thành config của Robot Agent, file provider chỉ còn "gọi OpenAI theo capability". Rẻ nhất khi mới có 1 agent, đắt dần theo số agent nếu để nguyên.
2. **Dựng `MemoryService` mỏng** (recall/remember, enforce `access_level` bên trong) — vá lỗ hổng phân quyền thật (mục 4.2) tại 1 điểm.
3. **Tổng quát hoá `RobotState` → `DeviceState`** trước khi Camera/ESP32/Home Assistant vào — chi phí migrate rẻ nhất khi chỉ có 1 bảng đặc thù.
4. **Hợp nhất `/api/robot/{status,command,event}` vào `/api/devices/:id/*`** — robot dùng đúng route generic, không còn 2 con đường song song điều khiển cùng 1 thiết bị.
5. **Dựng Agent/Model Registry tối thiểu (code-only, chưa cần DB)** ngay khi robot chat là agent duy nhất — thiết lập mẫu lúc rẻ, không đợi tới agent thứ 10 mới retrofit.
6. **Dọn dead code đã xác nhận**: `RobotFace.tsx`+css, `ExpressiveRobotFace.tsx`+css, `WebFaceTracker.tsx`, `XiaoziBridgePanel.tsx` (components/robot/); `xiaozi-bridge-brain.ts`, `xiaozi-handler.ts`, `demo-conversational-fallback.ts`, `complexity.ts`, `webhook-auth.ts` (lib/brain/) — xác nhận lại từng file trước khi xoá (đã grep 0 import, nhưng nên double-check bằng build trước khi xoá thật).

## 15. Những việc tuyệt đối chưa nên làm

1. **Đừng dựng Event Bus/Scheduler phân tán** (Kafka/RabbitMQ/Redis Streams) — quy mô hiện tại (1 VPS, 1 owner) chỉ cần `EventEmitter` in-process hoặc polling Postgres đơn giản. "100+ Agent/Device" là scale về **số lượng plugin**, không phải scale về **throughput hạ tầng** — đừng nhầm 2 trục này.
2. **Đừng thêm semantic search/embedding store (pgvector...) cho Memory** trước khi có đủ dữ liệu thật cần recall thông minh — hiện `Memory` chưa tới mức cần similarity search, thêm sớm là over-engineering giải quyết vấn đề chưa tồn tại.
3. **Đừng xây kênh push thiết bị thật (WebSocket/MQTT server)** trước khi có ít nhất 1 thiết bị vật lý thật kết nối (ESP32 "khi về Hà Nội" theo `NEXT.md`) — giữ nguyên "queued, chưa push thật" tới khi có phần cứng để test thật, tránh xây hạ tầng cho thiết bị không tồn tại.
4. **Đừng thêm multi-tenant/RBAC UI phức tạp** — đây là OS cá nhân single-owner; thứ cần là "chỉ owner + thiết bị được cấp token mới gọi được" (auth đơn giản), không phải hệ thống nhiều vai trò/tổ chức.
5. **Đừng nâng cấp Prisma (v5→v7)/Next.js giữa lúc refactor Core** — đổi kiến trúc và đổi framework cùng lúc là công thức lỗi khó debug; làm xong Phase 1-2 (mục 16) rồi mới xét nâng cấp framework riêng, độc lập.
6. **Đừng port lại Xiaozhi/ChinChin/robotonline cũ vào kiến trúc Agent mới** — đã archive có chủ đích (phiên 37); nếu cần tính năng tương tự sau này, viết như 1 Agent/Tool mới sạch theo kiến trúc mới, không khôi phục code cũ.
7. **Đừng để nhu cầu hiển thị UI kéo ngược thiết kế Core** — vd đừng thêm field vào `Agent`/`Model` chỉ vì 1 màn hình cụ thể muốn hiển thị đẹp hơn; UI luôn là consumer của Core.

## 16. Roadmap Phase 1 → Phase 5

**Phase 1 — Ổn định nền (trước khi thêm bất kỳ Agent mới nào)**
Dọn dead code (mục 14.6) · tách persona khỏi model-call (14.1) · `MemoryService` + enforce access_level (14.2) · `RobotState`→`DeviceState` (14.3) · hợp nhất route robot vào device generic (14.4).

**Phase 2 — Agent Router MVP**
`core/agent-router` + `core/model-router` (code-only registry, self-registering module, chưa cần bảng DB) · di chuyển `lib/robot-ai/*` thành `agents/robot-agent/` đúng interface mới · thêm 1 Agent thứ 2 (vd Research Agent, dùng chung Model Router) để **chứng minh mẫu nhân rộng được** trước khi tin tưởng nó cho 100 agent.

**Phase 3 — Model Router đa provider + Tool Router**
Thêm Claude/Gemini làm `ModelProvider` thật (không qua CLI exec) · `core/tool-router` + 2-3 Tool thật (Filesystem, Device-generated tools) · cân nhắc MCP client cho Tool Router (mục 10).

**Phase 4 — Scheduler + Automation + Permissions thật**
`core/scheduler` (chạy Agent theo lịch) · domain "Automation" có chỗ để sống · `Permissions`/`assertAccess()` áp dụng rộng ra Tool/Device Router, không chỉ Memory · `Agent`/`AgentRun` lên DB thật (bảng đề xuất mục 7) — Dashboard "Running Agents" có dữ liệu thật để hiển thị.

**Phase 5 — Scale-out**
`Model`/`Tool` registry chuyển từ code sang DB-backed (bật/tắt/cấu hình không cần redeploy) · kênh push thiết bị thật (WebSocket/MQTT) khi có phần cứng thật · auth thật (owner + device token) trước khi mở thêm kênh vào (Telegram/Google...) · fleet management nhiều device cùng loại.

---

*Báo cáo thuần phân tích — không có thay đổi code nào được thực hiện trong quá trình viết báo cáo này.*
