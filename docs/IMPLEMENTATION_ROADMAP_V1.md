# Brain OS — Implementation Roadmap V1

**Vai trò:** CTO — từ đây trách nhiệm là XÂY theo giai đoạn, không thiết kế thêm. Tài liệu này là lệnh thi công, dựa trên kiến trúc đã đóng băng: `KERNEL_ARCHITECTURE_V1.md`, `ARCHITECTURE_RULES_V1.md`, `SYSTEM_CONTRACTS_V1.md`, `EXECUTION_MODEL_V1.md`, `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md`, đã vá theo `ARCHITECTURE_AUDIT_V1.md` mục 1.5.
**Ngày:** 2026-07-09.

**3 luật của roadmap này:**
1. **Mỗi Phase kết thúc = Brain OS chạy được**, người dùng thấy được kết quả — không có Phase nào chỉ "dựng khung không ai dùng".
2. **Không Phase nào viết lại Phase trước** — chỉ mở rộng. Nếu 1 Phase sau phát hiện cần đổi hợp đồng của Phase trước, đó là dấu hiệu hợp đồng thiết kế sai (`ARCHITECTURE_RULES_V1.md` — quy tắc sửa hiến pháp), không phải chuyện thường ngày.
3. **Không thiết kế thêm khái niệm mới** — mọi Phase dưới đây chỉ HIỆN THỰC HOÁ những gì đã có trong 5 tài liệu kiến trúc. Nếu 1 Phase cần 1 khái niệm chưa được đặc tả, dừng lại, không tự chế — quay lại xin thiết kế trước.

---

## Phase 0 — Đã xong (không phải việc cần làm, chỉ để tham chiếu)

**Đầu ra:** 6 tài liệu kiến trúc (`ARCHITECTURE_REVIEW_V1.md` → `ARCHITECTURE_AUDIT_V1.md`), đã vá mâu thuẫn theo audit, đóng băng V1. Không có dòng code nào thay đổi trong Phase này — đúng theo yêu cầu tại thời điểm viết.

---

## Phase 1 — Kernel tối thiểu + di trú Robot Agent (chứng minh trên tính năng THẬT đang chạy)

### Goal
Dựng 6 primitive Kernel (`KERNEL_ARCHITECTURE_V1.md` mục 4) ở mức tối thiểu chạy được, rồi di trú **chính Robot Agent đang chạy thật hôm nay** (`src/lib/robot-ai/*`) qua Kernel đó — không viết Agent demo mới, dùng cái đã có để kiểm chứng hợp đồng. Đây là "bãi thử quy mô nhỏ" mà `KERNEL_ARCHITECTURE_V1.md` mục 18.3 khuyến nghị.

### Deliverables
- `src/kernel/identity/` — `IdentityRef` type (`SYSTEM_CONTRACTS_V1.md` mục 1) + mint identity `system` lúc boot + root-of-trust cho mint tiếp theo (`KERNEL_ARCHITECTURE_V1.md` mục 4, ghi chú bổ sung).
- `src/kernel/registry/` — bảng Postgres mới (additive) lưu `PluginDescriptor`, hàm `register()`/`lookup(kind, capability)`.
- `src/kernel/event-bus/` — bảng outbox Postgres + dispatch in-process (`EventEmitter`), publish/subscribe theo envelope `SYSTEM_CONTRACTS_V1.md` mục 5. Tự động phát `task.*` theo Task/Job lifecycle transition (mục 5 cùng tài liệu).
- `src/kernel/permission-gate/` — hàm `can(identity, action, resource)`, deny-by-default. Phase này: policy tối giản — Identity `system` được mọi thứ; mọi Identity khác cần grant tường minh (chưa có UI cấp quyền, grant khai thẳng trong code cấu hình Phase 1, đủ dùng cho 1 Agent).
- `src/kernel/lifecycle/` — state machine plugin (`registered→...→running`, `SYSTEM_CONTRACTS_V1.md` mục 1 `ExecutionState` + `KERNEL_ARCHITECTURE_V1.md` mục 9), boot sequence theo đúng thứ tự mục 6 tài liệu đó.
- `src/kernel/config/` — bọc `process.env` thành context cô lập theo từng plugin lúc `init()`.
- **Di trú** `src/lib/robot-ai/*` → `src/agents/robot-agent/` implement `AgentDescriptor` (`SYSTEM_CONTRACTS_V1.md` mục 9) — persona tách khỏi model-call (`openai-provider.ts` hiện tại trộn lẫn 2 việc, đúng vi phạm đã ghi ở `ARCHITECTURE_RULES_V1.md` Điều 8.5, vá ở đây).
- `src/app/api/robot/chat/route.ts` viết lại thành lớp mỏng: parse → build `Task` → nộp cho Kernel → trả `Result` (`ARCHITECTURE_REVIEW_V1.md` mục 5 "route Next.js trở thành lớp mỏng nhất có thể").
- Dọn dead code đã xác nhận 0 import (`ARCHITECTURE_REVIEW_V1.md` mục 14.6): `RobotFace.tsx`+css, `ExpressiveRobotFace.tsx`+css, `WebFaceTracker.tsx`, `XiaoziBridgePanel.tsx`, `lib/robot/tracking.ts`, `emotion-map.ts`, `xiaozi-bridge-brain.ts`, `xiaozi-handler.ts`, `demo-conversational-fallback.ts`, `complexity.ts`, `webhook-auth.ts` (double-check bằng build trước khi xoá thật, không chỉ tin grep).
- `prisma/schema.prisma`: thêm bảng `PluginDescriptor`, `Job`/`TaskRecord`, `EventOutbox` (additive, khớp hình dạng `SYSTEM_CONTRACTS_V1.md` mục 2-3-5 — **KHÔNG** dùng lại hình dạng `Agent`/`AgentRun` cũ ở `ARCHITECTURE_REVIEW_V1.md` mục 7, đã đánh dấu thay thế).

### Files affected
`src/kernel/**` (mới) · `src/agents/robot-agent/**` (mới, di chuyển từ `src/lib/robot-ai/`) · `src/app/api/robot/chat/route.ts` (viết lại) · `prisma/schema.prisma` (additive) · xoá `src/lib/robot-ai/`, `src/components/robot/{RobotFace,ExpressiveRobotFace,WebFaceTracker,XiaoziBridgePanel}.tsx`, `src/lib/robot/{tracking,emotion-map}.ts`, `src/lib/brain/{xiaozi-bridge-brain,xiaozi-handler,demo-conversational-fallback,complexity,webhook-auth}.ts`.

### Dependencies
Không — đây là điểm khởi đầu.

### Risks
- **Scope creep** (`ARCHITECTURE_RULES_V1.md` Điều 3.5) — cám dỗ xây luôn Agent Router/Model Router "vì đang ở đây". Chống bằng cách: Phase 1 CHỈ có 1 Agent, không cần Router chọn giữa nhiều Agent — Router hoãn tới Phase 4.
- **Phá demo `/robot` đang chạy tốt** — đây là tính năng duy nhất người dùng thấy được hôm nay, không được để hồi quy.
- **Migration dở dang** giữa route cũ và mới nếu dừng giữa chừng — làm trong 1 nhánh, test đầy đủ trước khi merge, không triển khai nửa vời.

### Success criteria
- `curl -X POST /api/robot/chat -d '{"text":"mày là ai"}'` trả **đúng response hiện tại** (schema `RobotChatResult` không đổi từ góc nhìn client) — hồi quy 0 lỗi so với hành vi trước Phase 1.
- Có ít nhất 1 dòng `PluginDescriptor` trong DB cho `robot-agent`, `status: "running"`.
- Có dòng `task.created`/`task.completed` thật trong Event outbox cho mỗi lượt chat — kiểm tra được bằng query trực tiếp, không phải giả định.
- `grep -r "askRobotOpenAI\|matchLocalSkill" src/app/api/robot/chat/route.ts` → **0 kết quả** (logic đã chuyển hết vào `agents/robot-agent/`, route chỉ còn gọi Kernel).
- `tsc --noEmit` sạch, `npm run build` không lỗi mới.

---

## Phase 2 — Device tổng quát hoá (đóng đúng lỗ hổng đã khởi phát chuỗi audit)

### Goal
Thay `RobotState` (bảng riêng cho robot) bằng `DeviceState` generic, hợp nhất `/api/robot/{status,command,event}` vào `/api/devices/:id/*` — chứng minh Device là 1 `kind` Registry thật, không phải đặc cách.

### Deliverables
- `DeviceState` (Prisma, thay `RobotState`) — 1 dòng/device, `state: Json` tự do (`ARCHITECTURE_REVIEW_V1.md` mục 7 hình dạng, điều chỉnh field cho khớp `SYSTEM_CONTRACTS_V1.md` mục 12 `DeviceDescriptor`).
- Đăng ký Robot như **2 Registry entry riêng**: `AgentDescriptor{id:"robot-agent"}` (đã có từ Phase 1) + `DeviceDescriptor{id:"robot-simulator", deviceType:"robot"}` (mới) — tách rõ "ai quyết định" (Agent) khỏi "cái gì có trạng thái" (Device), đúng ranh giới `ARCHITECTURE_RULES_V1.md` Điều 9.
- `/api/robot/{status,command,event}` **xoá**, thay bằng gọi `/api/devices/robot-simulator/*` generic — frontend `/robot/page.tsx` cập nhật endpoint, KHÔNG đổi UI/UX.
- Migrate dữ liệu `RobotState` (1 row demo) → `DeviceState`, xoá bảng cũ.
- **Phép thử bắt buộc:** đăng ký 1 `DeviceDescriptor` giả (`id:"test-device"`, không cần phần cứng thật) qua Registry — xác nhận **0 dòng code Core/route bị sửa** để nó hoạt động cơ bản (đăng ký + query state) — đây là bằng chứng thực nghiệm cho tuyên bố "thêm Device thứ 2 không sửa Core".

### Files affected
`prisma/schema.prisma` (xoá `RobotState`, thêm `DeviceState`) · `src/app/api/devices/[id]/*` (mở rộng) · xoá `src/app/api/robot/{status,command,event}/route.ts` · `src/app/robot/page.tsx` (đổi endpoint gọi, không đổi UI) · `src/lib/robot.ts` (rút gọn, `applyRobotCommand` chuyển thành 1 `DevicePlugin` implementation).

### Dependencies
Phase 1 (cần Registry/Lifecycle thật).

### Risks
- Frontend `/robot` đang poll `/api/robot/status` — đổi endpoint mà quên 1 chỗ gọi sẽ vỡ UI im lặng (lỗi network, không phải lỗi logic — dễ bỏ sót khi test nhanh).
- Dữ liệu `RobotState` (dù chỉ 1 row demo) mất nếu migrate sai — sao lưu trước khi `DROP TABLE`.

### Success criteria
- `/robot` UI hoạt động y hệt Phase 1 (mắt/mồm/fullscreen/chat/demo buttons), qua route generic.
- `RobotState` không còn tồn tại trong schema.
- `test-device` giả đăng ký + query state thành công, xác nhận bằng log/output cụ thể (không chỉ "chắc là được").
- `tsc --noEmit` sạch.

---

## Phase 3 — MemoryService + đóng lỗ hổng quyền truy cập thật

### Goal
Đóng đúng lỗ hổng bảo mật đã ghi nhận lặp lại ở **mọi** tài liệu trước (`PrivateMemory` đọc/ghi được bởi bất kỳ ai gọi được server) — dựng `MemoryService` làm cổng duy nhất, enforce `access_level` thật lần đầu tiên.

### Deliverables
- `src/core/memory/memory-service.ts` implement `MemoryService` (`SYSTEM_CONTRACTS_V1.md` mục 15: `read/write/search/delete/summarize`), Permission Gate check **bên trong mọi method**, không có đường tắt.
- `/api/memories/*`, `/api/private-memories/*` viết lại: parse → gọi `MemoryService` → trả response (không còn `prisma.memory.findMany()` trực tiếp trong route handler).
- **Authentication Provider đầu tiên** (đã đặc tả sẵn ở `KERNEL_ARCHITECTURE_V1.md` mục 3 — hiện thực hoá, không phải khái niệm mới): 1 owner API token (biến môi trường) → phân giải thành `IdentityRef{type:"human", id:"owner"}`. Request không có token hợp lệ → `IdentityRef{type:"service", id:"anonymous"}`, mặc định 0 grant (deny-by-default, `ARCHITECTURE_RULES_V1.md` Điều 13.2).
- Server Component (`/memories`, `/vault` page.tsx) gọi `MemoryService` với Identity `system` (tin cậy nội bộ, cùng process, không qua HTTP) — không bị chặn bởi token check dành cho request ngoài.

### Files affected
`src/core/memory/**` (mới) · `src/app/api/memories/**`, `src/app/api/private-memories/**` (viết lại) · `src/kernel/permission-gate/` (thêm policy đọc token) · `src/app/memories/page.tsx`, `src/app/vault/page.tsx` (đổi từ `prisma.*` sang gọi `MemoryService` nội bộ).

### Dependencies
Phase 1 (Permission Gate phải thật).

### Risks
- **Đây là breaking change có chủ đích** — hôm nay `curl /api/private-memories` không cần token vẫn đọc được; sau Phase này sẽ bị chặn. Phải báo trước, không âm thầm đổi hành vi 1 API đang "hoạt động" (dù hoạt động sai).
- Nếu owner quên set token env var, chính owner cũng bị khoá khỏi `/vault` — cần thông báo rõ + giá trị mặc định an toàn (fail-closed, không fail-open).

### Success criteria
- `curl /api/private-memories` không token → `401`/`403` (trước đây `200`).
- `curl /api/private-memories -H "Authorization: Bearer $OWNER_TOKEN"` → `200`, dữ liệu đúng.
- `/memories`, `/vault` (trang UI) vẫn render đúng qua Server Component (đường nội bộ, không cần token).
- 1 lần ghi `PrivateMemory` thiếu quyền → log `permission.denied` xuất hiện trong Event outbox (Audit Trail hoạt động thật, không chỉ lý thuyết).

---

## Phase 4 — Model Router (Router đầu tiên, việc đã bị chặn từ đầu chuỗi tài liệu)

### Goal
Dựng Model Router thật, dùng `Task/Result` (Phase 1 đã có) — chuyển Robot Agent từ gọi thẳng OpenAI (`fetch()` trần) sang xin `ctx.model(capability)`.

### Deliverables
- `src/core/model-router/` — nhận `Task<ModelRequest>`, phân giải theo `capability` + policy (Phase 4: policy tối giản — chỉ 1 Provider đăng ký, chọn nó; không cần thuật toán fallback-chain phức tạp ngay, generalize dần).
- `src/models/openai/` — `ModelProvider` plugin bọc lại đúng logic `fetch()`/`AbortController`/timeout hiện có trong `openai-provider.ts` cũ (di chuyển, không viết lại từ đầu).
- Robot Agent (`src/agents/robot-agent/`) đổi lời gọi trực tiếp thành `ctx.model("chat-vi-short").invoke(...)`.
- `Result.metadata` chuẩn hoá `costUsd`/`inputTokens`/`outputTokens` (`EXECUTION_MODEL_V1.md` mục 20/25) — bắt đầu tích luỹ dữ liệu thật cho Performance Metrics dù chưa dùng ngay.
- **Phép thử bắt buộc:** đăng ký 1 Model Provider giả thứ 2 (echo/no-op) — xác nhận Model Router chọn đúng theo capability mà Robot Agent code không cần sửa.

### Files affected
`src/core/model-router/**` (mới) · `src/models/openai/**` (mới, di chuyển logic từ `src/lib/robot-ai/openai-provider.ts` cũ) · `src/agents/robot-agent/**` (đổi lời gọi model).

### Dependencies
Phase 1 (Task/Result, Registry phải thật và đã kiểm chứng qua 1 Agent thật).

### Risks
- Độ trễ tăng nếu Router thêm overhead không cần thiết — đo `latency_ms` trước/sau, không được tăng đáng kể so với gọi thẳng hiện tại (~2s).
- Local skill / CLI agent fallback chain hiện có (`deep:true`) phải tiếp tục hoạt động đúng — không phá tính năng đang chạy vì mải tổng quát hoá.

### Success criteria
- Hành vi robot chat không đổi từ góc nhìn user (local skill → openai → fallback vẫn đúng thứ tự).
- `ModelDescriptor` cho `openai` tồn tại trong Registry, `Task` gọi model có `targetCapability`, không có tên "openai" cứng trong `agents/robot-agent/` code.
- Provider giả thứ 2 đăng ký + được chọn đúng khi test yêu cầu capability nó cung cấp, không sửa Robot Agent.

---

## Phase 5 — Enforcement tooling (đóng khoảng cách Hiến pháp ↔ thực thi)

### Goal
Vá đúng phát hiện nghiêm trọng #4 của audit: Hiến pháp hiện là honor-system. Thêm công cụ thật, không chỉ tài liệu.

### Deliverables
- Lint rule (`dependency-cruiser` hoặc ESLint import-boundary theo thư mục) chặn: plugin import plugin khác trực tiếp, Kernel import bất kỳ gì ở L3+, Core Service import Provider cụ thể thay vì qua Registry.
- CI check (hoặc pre-commit hook tối thiểu nếu chưa có CI) chạy lint rule này — vi phạm chặn merge, không chỉ cảnh báo.
- Validate `kind`/`operation`/`capabilities`/`code`/`type` theo pattern đã thống nhất (`SYSTEM_CONTRACTS_V1.md` mục 0.4) lúc `Registry.register()` — từ chối đăng ký nếu sai định dạng.

### Files affected
`.dependency-cruiser.js`/`.eslintrc` (mới rule) · `src/kernel/registry/` (thêm validate) · CI config nếu có.

### Dependencies
Phase 1 (cần có `src/kernel/`, `src/agents/`, `src/models/` thật để lint có gì mà chặn).

### Risks
- Rule quá chặt chặn nhầm code hợp lệ — cần test kỹ trên toàn bộ Phase 1-4 trước khi bật chặn cứng CI.

### Success criteria
- Thử cố tình import 1 plugin từ plugin khác → lint FAIL rõ ràng, thông báo đúng lý do.
- Đăng ký 1 plugin với `kind: "Agent"` (sai case) → `Registry.register()` từ chối với lỗi `validation.*` rõ ràng.
- Toàn bộ code Phase 1-4 pass lint mới, 0 exception ngầm.

---

## Sau Phase 5

Agent Router (tổng quát hoá ngoài Robot Agent, cần ≥2 Agent thật để tránh thiết kế theo phỏng đoán) · Tool Router + Tool đầu tiên (Filesystem hoặc 1 MCP server đơn giản) · Collector đầu tiên (Hacker News hoặc RSS — Tier 🟢 theo `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 4) · Scheduling Loop thật thay cho gọi thẳng (Phase 1-4 dùng đường tắt "gọi thẳng, bỏ qua admission control tinh vi" — hợp lệ cho quy mô 1 Agent, cần thay khi có ≥2 Execution chạy đồng thời cạnh tranh tài nguyên). **Không lên kế hoạch chi tiết các Phase này ngay** — đúng nguyên tắc "không thiết kế trước khi có bằng chứng cần", quyết định cụ thể khi Phase 5 xong và có dữ liệu thật.

---

## Rủi ro xuyên suốt cả 5 Phase (không lặp lại rủi ro riêng từng Phase ở trên)

- **Không có supervisor process** (`nohup`, chưa systemd) — mỗi lần restart app để deploy Phase mới là 1 lần gián đoạn thật, chưa tự động phục hồi. Không thuộc phạm vi roadmap này (hạ tầng, không phải kiến trúc ứng dụng) nhưng ảnh hưởng trực tiếp trải nghiệm demo — cân nhắc thêm systemd unit song song, không phải thay thế 1 Phase nào ở trên.
- **1 người làm, 5 Phase tuần tự** — không giả định có thể song song hoá nếu chỉ có 1 người thực thi; thứ tự trên là thứ tự phụ thuộc thật, không phải gợi ý ưu tiên tuỳ chọn.
- **Mỗi Phase PHẢI chạy `/verify` (hoặc tương đương) trước khi coi là xong** — "success criteria" ở trên là điều kiện cần, không phải danh sách để đọc lướt rồi tự nhận đã đạt.

---

*Roadmap thi công — Phase 1 sẵn sàng bắt đầu ngay khi được phê duyệt.*
