# Brain OS — System Contracts (ABI V1)

**Vai trò:** ABI (Application Binary Interface) của Brain OS — hợp đồng giao tiếp giữa mọi module. Không code, không implement. Interface dưới đây là đặc tả hình dạng (schema), không phải triển khai.
**Ngày:** 2026-07-09 · **Tiền đề:** tuân thủ `ARCHITECTURE_RULES_V1.md` (đặc biệt Điều 4 — giao tiếp qua hợp đồng, không qua triển khai) và ranh giới 6-khái-niệm của `KERNEL_ARCHITECTURE_V1.md`. Tài liệu này **không** thêm khái niệm mới vào Kernel — mọi thứ ở đây là quy ước ở tầng ABI, dựng trên 6 primitive đã có (Identity/Registry/Event Bus/Permission Gate/Lifecycle Manager/Config-Secrets), xem mục 0.1 để biết vì sao Task/Result không trở thành primitive thứ 7.

> **🔒 KIẾN TRÚC V1 ĐÃ ĐÓNG BĂNG (2026-07-09), đã vá sau `ARCHITECTURE_AUDIT_V1.md`:** `Task.kind` đổi tên thành `Task.operation` (mục 2, tránh trùng tên với `PluginDescriptor.kind`) · `dependsOn`/`joinPolicy` (kiểu có cấu trúc, không mã hoá chuỗi) chuyển lên `Task` dùng chung, không riêng Workflow · **Workflow Contract (mục 13 cũ) đã gộp vào Agent** (mục 9) · thêm Session Contract (mục 15.5) · thêm `pricing` cho `ToolDescriptor` (mục 11) · Notification giải quyết bằng quy ước "1 Tool capability", không phải contract mới (mục 11) · quy ước đặt tên hợp nhất cho `operation`/`kind`/`capabilities`/`code`/`type` (mục 0.4).

---

## 0. Nguyên tắc thiết kế của tài liệu này

**0.1 — Task/Result không phải Kernel primitive.** Đây là quyết định thiết kế quan trọng nhất của tài liệu, cần nói rõ trước khi đọc bất kỳ mục nào khác: mẫu hình "gửi Task → nhận Result" mà toàn bộ tài liệu này xây dựng là 1 **quy ước ở tầng ABI**, triển khai bằng cách dùng lại đúng 6 primitive Kernel đã có (Task lifecycle transition → phát qua Event Bus; `requestedBy`/`executedBy` → Identity; quyền được kiểm tra qua Permission Gate trước khi Task chạy; Job theo dõi qua Lifecycle Manager's state machine) — **không** phải khái niệm kernel-level thứ 7. Lý do: `ARCHITECTURE_RULES_V1.md` Điều 3.2 cố định số primitive của Kernel, và Task/Result mang tri thức nghiệp vụ ("có 1 công việc cần làm, có 1 kết quả") — đúng loại tri thức Kernel không được biết theo Điều 3.1 câu hỏi lọc thứ 3.

**0.2 — Envelope chung, payload tự do.** Mọi hợp đồng dưới đây tách 2 phần: **envelope** (id/version/trace/lifecycle/error/progress — kernel-ABI hiểu và xử lý được) và **payload** (`input`/`output` — hình dạng do plugin tự định nghĩa, không ai ngoài plugin đó và caller của nó cần hiểu). Đây đúng nguyên lý ABI thật (vd HTTP không biết JSON body của bạn chứa gì, chỉ biết header/status/body-là-byte) — không phải phát minh riêng.

**0.3 — Định nghĩa 1 lần, dùng lại nhiều lần.** Các khối dưới đây (`IdentityRef`, `TraceContext`, `ErrorObject`, `Progress`, `RetryPolicy`, `ContractVersion`) định nghĩa **đúng 1 lần** ở mục 1 — mọi hợp đồng sau đó tham chiếu lại, không định nghĩa riêng. Nếu 1 mục sau này viết "Error model: dùng `ErrorObject`" mà không giải thích lại, đó là chủ đích, không phải thiếu sót.

**0.4 — Quy ước đặt tên cho MỌI chuỗi tự do trong tài liệu này (bổ sung sau `ARCHITECTURE_AUDIT_V1.md` mục 7.2 — rủi ro chuỗi tự do không kiểm chứng áp dụng như nhau cho `Task.operation`, `PluginDescriptor.kind`, `capabilities[]`, `ErrorObject.code`, `Event.type`, không chỉ riêng 1 field):** mọi 4 field trên theo đúng 1 pattern `^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$` (`domain.entity` hoặc `domain.action`, chữ thường, phân cách bằng dấu chấm). Không tài liệu nào enforce pattern này bằng type system — đây là quy ước cho tác giả plugin, dự kiến enforce bằng validate lúc `Registry.register()` khi Registry thật được xây (`docs/IMPLEMENTATION_ROADMAP_V1.md`), không phải ở tầng ABI này.

---

## 1. Common Conventions — khối dùng chung

```ts
// Ai/cái gì — người, agent, thiết bị, service, hệ thống. Khớp Identity của Kernel.
type IdentityRef = {
  id: string;
  type: "human" | "agent" | "device" | "service" | "system";
};

// Truy vết nhân-quả — có mặt trên MỌI Task/Job/Result/Event, không ngoại lệ.
type TraceContext = {
  traceId: string;         // xuyên suốt 1 luồng xử lý (1 yêu cầu user → nhiều Task/Event con)
  spanId: string;          // đơn vị công việc hiện tại
  parentSpanId?: string;
  correlationId?: string;  // nhóm các Task/Event thuộc cùng 1 phiên nghiệp vụ (vd 1 Workflow run)
  causationId?: string;    // Event/Task nào trực tiếp sinh ra cái này
};

// Version của CHÍNH hợp đồng (không phải version của plugin implement nó).
type ContractVersion = string; // SemVer "major.minor.patch" — xem mục 17 cho quy tắc tương thích

// Chuẩn hoá lỗi — dùng cho MỌI lỗi trong toàn hệ thống, không có "lỗi tự do" nào khác.
type ErrorObject = {
  code: string;                 // namespaced: "permission.denied", "timeout.exceeded"... xem mục 7
  message: string;               // dành cho hệ thống/dev đọc, KHÔNG phải copy hiển thị end-user
  severity: "info" | "warning" | "error" | "fatal";
  category: "permission" | "dependency" | "timeout" | "validation" | "not_found" | "conflict" | "internal" | "external";
  recoverable: boolean;          // hệ thống tự phục hồi được không, không cần người can thiệp
  retryable: boolean;            // caller được phép thử lại NGUYÊN input này không
  cause?: ErrorObject;           // lỗi lồng nhau — lỗi gốc gây ra lỗi này (error chaining)
  context?: Record<string, unknown>;  // dữ liệu debug bổ sung — CẤM chứa secret
  trace: TraceContext;
};

type LogLine = { timestamp: string; level: "debug" | "info" | "warn" | "error"; message: string };

// Báo cáo tiến độ — dùng cho MỌI Task/Job đang chạy, UI luôn đọc từ đúng 1 hình dạng này.
type Progress = {
  taskId: string;
  step: { index: number; total?: number; label: string };
  percentage?: number;           // 0-100, optional — không phải mọi việc đo được %
  eta?: { estimatedCompletionAt?: string; confidence: "low" | "medium" | "high" };
  logs?: LogLine[];               // buffer gần nhất, không phải toàn bộ lịch sử
  warnings?: ErrorObject[];       // severity="warning", không chặn tiếp tục
  errors?: ErrorObject[];         // đã xảy ra nhưng vẫn đang cố tiếp tục (dẫn tới partial_success)
  updatedAt: string;
};

type RetryPolicy = {
  maxAttempts: number;
  backoff: "fixed" | "exponential";
  baseDelayMs: number;
  maxDelayMs?: number;
  retryableCategories?: ErrorObject["category"][];  // giới hạn retry theo category cụ thể, mặc định dùng ErrorObject.retryable
};

// Lifecycle chung — Task/Job dùng đúng state machine này (không phải lifecycle riêng của Plugin, mục 8).
type ExecutionState =
  | "submitted" | "queued" | "running" | "paused"
  | "succeeded" | "failed" | "cancelled" | "timed_out";
```

---

## 2. Task Contract (universal — "Mọi subsystem nhận 1 Task")

**Mục đích:** phong bì chung cho "1 đơn vị công việc được yêu cầu", bất kể đích đến là Agent, Model, Tool, Collector, hay 1 bước Workflow.

**Trách nhiệm:** Task mô tả **cái gì cần làm** và **ai yêu cầu** — nó **KHÔNG** biết **ai sẽ làm** cho tới khi Router (L4, không phải kernel) phân giải `targetCapability` thành 1 plugin cụ thể.

```ts
type Task<TInput = unknown> = {
  id: string;
  contractVersion: ContractVersion;   // "1.0.0"
  operation: string;                   // "agent.run" | "tool.execute" | "model.invoke" | "collector.fetch" | ...
                                        // quy ước đặt tên: mục 0.4 — ĐỔI TÊN từ "kind" (bổ sung sau
                                        // ARCHITECTURE_AUDIT_V1.md mục 3.2: "kind" trùng tên với
                                        // PluginDescriptor.kind nhưng khác trục hoàn toàn — Task.operation
                                        // = HÀNH ĐỘNG gì, PluginDescriptor.kind = LOẠI plugin gì — 2 field
                                        // cùng tên ở 2 contract liền kề là rủi ro nhầm lẫn thật khi code)
  requestedBy: IdentityRef;
  targetCapability?: string;           // Router dùng để chọn plugin — vắng mặt nếu targetPluginId đã ghim sẵn
  targetPluginId?: string;
  input: TInput;                       // payload tự do theo domain — kernel/ABI không đọc nội dung
  priority?: "low" | "normal" | "high" | "critical";
  deadline?: string;                    // ISO datetime — cần xong trước khi nào
  timeoutMs?: number;                   // override default của plugin, riêng cho lần chạy này
  retryPolicy?: RetryPolicy;
  mode?: "sync" | "async";              // "async" → subsystem trả Result{status:"accepted"} ngay, xem mục 4
  idempotencyKey?: string;              // cho phép caller retry an toàn — xem mục 18 điểm yếu #3
  dependsOn?: string[];                 // id các Task khác phải xong trước — DÙNG CHUNG cho mọi Task, không
                                         // riêng gì "Workflow" (bổ sung sau EXECUTION_MODEL_V1.md mục 8,
                                         // và sau khi gộp Workflow vào Agent — xem mục 9/13 dưới)
  joinPolicy?: "all" | "any" | { type: "quorum"; count: number };  // mặc định "all" nếu có dependsOn.
                                         // Kiểu object cho quorum (KHÔNG mã hoá số trong chuỗi "quorum:N")
                                         // — sửa sau ARCHITECTURE_AUDIT_V1.md mục 7.1
  trace: TraceContext;
  createdAt: string;
  metadata?: Record<string, unknown>;   // free-form, KHÔNG authoritative (không ai được đọc field nghiệp vụ từ đây)
};
```

**Required:** `id, contractVersion, operation, requestedBy, input, trace, createdAt`. **Optional:** còn lại.

**Lifecycle:** `submitted → queued → running → (paused ⇄ running) → succeeded | failed | cancelled | timed_out` (dùng đúng `ExecutionState`, mục 1) — theo dõi qua 1 hoặc nhiều `Job` (mục 3), không phải Task tự giữ state của chính nó.

**Cancellation:** caller gọi `cancel(taskId, reason)`. **Hợp tác (cooperative), không cưỡng chế** — subsystem đang xử lý Task **PHẢI** tự kiểm tra cờ huỷ định kỳ trong vòng lặp dài. Ở Phase 1 (plugin in-process), **không có** cách buộc dừng 1 plugin không tự nguyện dừng — giới hạn thật, không giả vờ đã giải quyết (nhất quán với `KERNEL_ARCHITECTURE_V1.md` mục 13 về isolation spectrum).

**Timeout:** `timeoutMs` (per-Task) ghi đè `defaultTimeoutMs` (khai trong Plugin manifest, mục 8) nếu có. Hết timeout mà chưa `succeeded/failed/cancelled` → hệ thống tự chuyển `timed_out`, phát `ErrorObject{code:"timeout.exceeded", retryable:true}`.

**Retry:** theo `retryPolicy` nếu Task khai, hoặc policy mặc định của subsystem xử lý nó. Mỗi lần thử = 1 `Job` mới (mục 3) cùng `taskId`, `attempt` tăng dần — **PHẢI** truyền cùng `idempotencyKey` xuyên suốt mọi attempt của cùng 1 Task.

**Metadata & Tracing:** `metadata` tự do/không ràng buộc; `trace` bắt buộc và **PHẢI** giữ nguyên `traceId`/`correlationId` xuyên suốt toàn bộ Job/Event con sinh ra từ Task này.

**Versioning:** xem mục 17 (áp dụng chung, không lặp lại ở đây).

---

## 3. Job Contract (universal — 1 lần thực thi cụ thể của 1 Task)

**Mục đích:** Task là **yêu cầu** (bất biến sau khi tạo); Job là **1 lần thực thi** yêu cầu đó — 1 Task có thể sinh nhiều Job (mỗi lần retry = 1 Job mới, `attempt` tăng dần).

```ts
type Job = {
  id: string;
  taskId: string;
  contractVersion: ContractVersion;
  state: ExecutionState;
  progress?: Progress;
  attempt: number;
  workerRef?: { pluginId: string; instanceId?: string };  // ai đang thực thi lần này
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: Result;                       // gắn khi kết thúc, xem mục 4
  cancelRequested?: boolean;
  trace: TraceContext;
};
```

**Lifecycle/Error/Progress/Cancellation/Timeout/Retry:** dùng đúng cơ chế của Task (mục 2) — Job không định nghĩa lại, nó là **thực thể theo dõi** cho 1 Task đang/đã chạy.

**Vì sao tách riêng khỏi Task:** nếu gộp chung, "retry" sẽ phải mutate chính Task gốc (phá tính bất biến của yêu cầu ban đầu) hoặc tạo Task trùng lặp (mất liên kết "đây là lần thử thứ mấy của cùng 1 yêu cầu"). Tách Job cho phép Task giữ nguyên làm bằng chứng "yêu cầu ban đầu là gì", trong khi lịch sử các lần thử nằm ở chuỗi Job.

---

## 4. Result Contract (universal — "Mọi subsystem trả 1 Result")

```ts
type Result<TOutput = unknown> = {
  taskId: string;
  jobId?: string;                        // vắng mặt nếu Result trả ngay không qua Job theo dõi (sync nhanh)
  contractVersion: ContractVersion;
  status: "accepted" | "success" | "partial_success" | "failure" | "cancelled" | "timed_out";
  output?: TOutput;                      // có mặt nếu success/partial_success
  error?: ErrorObject;                   // có mặt nếu failure/timed_out
  warnings?: ErrorObject[];              // có thể kèm cả success (cảnh báo nhẹ không chặn)
  partial?: {                            // chỉ có khi status="partial_success"
    completedItems: number;
    totalItems?: number;
    failedItems?: { item: unknown; error: ErrorObject }[];
  };
  streaming?: StreamHandle;              // có mặt nếu Task yêu cầu streaming, xem dưới
  executedBy?: { pluginId: string; version: string };  // khác requestedBy của Task — ai THỰC SỰ xử lý
  startedAt?: string;
  finishedAt?: string;                   // vắng mặt nếu status="accepted" (đang chạy nền)
  durationMs?: number;
  trace: TraceContext;
  metadata?: Record<string, unknown>;
};
```

**Success / Failure / Partial Success:** `status` phân biệt rõ 3 trạng thái — **partial_success khác failure**: dùng khi 1 Task xử lý nhiều item (vd Collector fetch 50 bài, 45 thành công 5 lỗi) — hệ thống **PHẢI** phân biệt "hoàn toàn không làm được gì" (failure) với "làm được phần lớn, có phần lỗi" (partial_success) — gộp 2 trạng thái này làm mất thông tin quan trọng cho quyết định retry (retry toàn bộ hay chỉ retry phần lỗi).

**Streaming:**
```ts
type StreamHandle = {
  streamId: string;
  protocol: "event-bus-channel";         // Phase 1 CHỈ hỗ trợ kênh này — không tạo transport thứ 2
  chunkEventType: string;                // vd "task.<id>.stream.chunk" — subscribe Event Bus để nhận
  closeEventType: string;                // báo stream kết thúc
};
```
Streaming **KHÔNG PHẢI** 1 transport riêng — nó là 1 kênh cụ thể trên Event Bus đã có (nhất quán tuyệt đối với nguyên tắc "1 transport" của `KERNEL_ARCHITECTURE_V1.md` mục 8, vốn đã hợp nhất request/response vào pub/sub — Result streaming áp dụng đúng logic đó thêm 1 lần nữa thay vì phát minh cơ chế mới). **Điểm yếu đã biết của lựa chọn này:** xem mục 18 điểm yếu #2.

**Background execution / long-running job:** khi `Task.mode === "async"`, subsystem **PHẢI** trả `Result{status:"accepted"}` **ngay lập tức** (không `output`, không `finishedAt`) — caller theo dõi tiếp qua `jobId` (poll `Job` hoặc subscribe `task.<id>.progress`/`task.<id>.completed`). Đây là cách duy nhất hợp lệ để chạy Task dài — **CẤM** subsystem giữ HTTP-style connection mở chờ tới khi xong (không mở rộng được, vi phạm `ARCHITECTURE_RULES_V1.md` Điều 6).

---

## 5. Event Contract (universal)

**Envelope:** kế thừa nguyên vẹn từ `KERNEL_ARCHITECTURE_V1.md` mục 8 (`id/type/source/timestamp/correlationId/causationId/payload`) — không định nghĩa lại ở đây.

**Quy tắc phát sinh tự động:** mọi transition trong lifecycle của Task/Job (mục 2-3) **BẮT BUỘC** tự động phát đúng 1 event tương ứng — đây **không phải** việc mỗi subsystem tự nhớ gọi `emit()`, mà là hành vi tích hợp sẵn của cơ chế Task/Job dùng chung. Hệ quả: `TaskCreated`/`TaskStarted`/`TaskProgress`/`TaskCompleted`/`TaskFailed` **luôn nhất quán tuyệt đối** vì chúng không phải logic tuỳ ý của từng plugin.

| Event type | Phát khi nào | Payload chính |
|---|---|---|
| `task.created` | Task được submit | `Task` |
| `task.started` | Job chuyển `running` | `{taskId, jobId}` |
| `task.progress` | Mỗi lần `Progress` cập nhật | `Progress` |
| `task.completed` | `Result.status ∈ {success, partial_success}` | `Result` |
| `task.failed` | `Result.status ∈ {failure, timed_out}` | `Result` |
| `task.cancelled` | Huỷ thành công | `{taskId, jobId, reason}` |
| `plugin.loaded` | Lifecycle Manager hoàn tất init | `PluginDescriptor` |
| `plugin.error` | Plugin lỗi (đã có ở Kernel doc) | `{pluginId, error: ErrorObject}` |
| `device.connected` / `device.disconnected` | Đổi `connectionState` | `DeviceDescriptor` |
| `knowledge.ingested` | Knowledge Pipeline ghi xong | (giữ nguyên tên đã dùng ở `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` — **không đổi** thành `knowledge.added` dù ví dụ user gợi ý khác tên, để nhất quán xuyên tài liệu; xem mục 18) |
| `memory.updated` | `MemoryService.write()` thành công | `{id, changedFields}` |
| `agent.completed` | `Result` của bất kỳ Task `operation:"agent.run"` nào (kể cả Agent chạy 1 kế hoạch tĩnh — xem mục 9, Workflow đã gộp vào Agent) | `Result` |

**Subscriptions:** hỗ trợ wildcard theo prefix (vd `device.*` bắt cả `device.connected`/`device.disconnected`/`device.<id>.telemetry`). Khai trong manifest (ưu tiên, để dependency graph đầy đủ lúc boot) hoặc runtime (linh hoạt hơn, không có trong graph boot-time).

**Retry/DLQ/Error recovery:** kế thừa nguyên vẹn `KERNEL_ARCHITECTURE_V1.md` mục 8 — at-least-once, exponential backoff, DLQ bền không âm thầm vứt.

---

## 6. Progress Contract — đã định nghĩa ở mục 1, yêu cầu UI cụ thể

UI (mọi client — Web/Robot/Voice/Mobile) **PHẢI** luôn suy ra được đủ 6 thứ sau từ đúng 1 object `Progress` (mục 1), không cần query thêm nguồn nào khác:

| UI cần biết | Field trong `Progress` |
|---|---|
| Bước hiện tại | `step.label` (+ `step.index`/`step.total` nếu biết trước tổng số bước) |
| Phần trăm | `percentage` (optional — không phải Task nào cũng đo được, UI **PHẢI** xử lý được trường hợp vắng mặt, không giả định luôn có) |
| ETA | `eta.estimatedCompletionAt` + `eta.confidence` (thấp/vừa/cao — tránh UI hiển thị 1 con số ETA giả-chính-xác cho ước tính mơ hồ) |
| Logs | `logs[]` (buffer gần nhất, không phải toàn bộ lịch sử — tránh Progress object phình vô hạn) |
| Warnings | `warnings[]` (không chặn tiếp tục) |
| Errors | `errors[]` (đã xảy ra, task vẫn đang cố, có thể dẫn tới `partial_success`) |

**Không có trường "trạng thái tổng" riêng trong Progress** — trạng thái tổng (`running`/`paused`/...) đọc từ `Job.state` (mục 3), Progress chỉ mô tả **chi tiết bên trong** trạng thái `running`.

---

## 7. Error Contract — bảng mã lỗi chuẩn hoá

`ErrorObject` đã định nghĩa ở mục 1. Bảng dưới chuẩn hoá `category` → ví dụ `code` cụ thể → giá trị mặc định của `recoverable`/`retryable` (subsystem **ĐƯỢC PHÉP** ghi đè mặc định nếu có lý do, nhưng **PHẢI** khai tường minh, không im lặng đổi hành vi):

| category | ví dụ code | recoverable (mặc định) | retryable (mặc định) | Ghi chú |
|---|---|---|---|---|
| `permission` | `permission.denied`, `permission.identity_unresolved` | false | false | Không tự phục hồi được — cần cấp quyền, không phải thử lại |
| `dependency` | `dependency.unavailable`, `dependency.version_mismatch` | true | true | Phụ thuộc có thể quay lại sẵn sàng — thử lại có ý nghĩa |
| `timeout` | `timeout.exceeded`, `timeout.deadline_missed` | true | true (nếu còn attempt) | |
| `validation` | `validation.invalid_input`, `validation.schema_mismatch` | false | false | Input phải sửa trước — thử lại nguyên input vô nghĩa |
| `not_found` | `not_found.plugin`, `not_found.knowledge_id` | false | false | |
| `conflict` | `conflict.duplicate_id`, `conflict.version_race` | tuỳ trường hợp | tuỳ trường hợp | Subsystem phải tự quyết theo ngữ cảnh cụ thể |
| `internal` | `internal.unexpected`, `internal.unhandled_exception` | false (cho tới khi điều tra) | false | **Mặc định KHÔNG retry** — lỗi chưa hiểu không nên tự động lặp lại |
| `external` | `external.vendor_error`, `external.rate_limited` | true | true (backoff dài hơn cho `rate_limited`) | |

**severity vs category — không trộn lẫn:** `category` trả lời "loại lỗi gì", `severity` trả lời "nghiêm trọng tới đâu". `fatal` **dành riêng** cho lỗi đòi hỏi con người can thiệp ngay (không chỉ "Task này fail" mà "hệ thống đang ở trạng thái nguy hiểm") — phân biệt với `error` (Task fail, hệ thống vẫn ổn định) là bắt buộc, không phải tuỳ chọn — 1 lỗi `fatal` **NÊN** trigger Lifecycle Manager cân nhắc pause plugin liên quan, không chỉ log lại.

---

## 8. Plugin Contract

**Mục đích:** khuôn chung cho MỌI thứ đăng ký vào Registry — Agent/Model/Tool/Device/Collector đều là 1 `kind` cụ thể của Plugin, không phải 5 khuôn riêng (Workflow không còn là `kind` riêng — đã gộp vào Agent, xem mục 9).

```ts
type PluginDescriptor = {
  id: string;                    // duy nhất toàn cục (ARCHITECTURE_RULES_V1.md Điều 15.2)
  kind: string;                   // "agent" | "model" | "tool" | "device" | "collector" | "workflow" | ... (mở)
  name: string;
  version: string;                // version của CHÍNH plugin (khác contractVersion nó implement)
  contractVersion: ContractVersion;  // version hợp đồng của `kind` này mà plugin tuân theo
  capabilities: string[];
  dependencies?: string[];
  description?: string;
  owner?: IdentityRef;
  defaultTimeoutMs?: number;
  status: "installed" | "enabled" | "disabled" | "updating" | "removing" | "error";
  installedAt: string;
  lastHealthCheckAt?: string;
  healthStatus?: "healthy" | "degraded" | "unhealthy" | "unknown";
};
```

**Vòng đời operations** — mỗi operation là 1 lời gọi `Task{operation:"plugin.<action>"} → Result` (dùng đúng khuôn chung, không phải API riêng):

| Operation | `Task.operation` | Ghi chú |
|---|---|---|
| Install | `plugin.install` | Chỉ đăng ký descriptor — **KHÔNG** tự động enable (2 bước tách biệt: install rồi enable, để có thể kiểm tra trước khi kích hoạt) |
| Enable | `plugin.enable` | Trigger Lifecycle: `initializing → healthCheck → running` |
| Disable | `plugin.disable` | Pause graceful, giữ đăng ký |
| Update | `plugin.update` | Version mới chạy song song version cũ theo `ARCHITECTURE_RULES_V1.md` Điều 7.4 (cửa sổ 30 ngày/tới khi hết phụ thuộc, Điều 7.4.1) — không ép cutover đồng thời |
| Remove | `plugin.remove` | **CHỈ** cho phép khi đã `disabled` — không xoá 1 plugin đang chạy |
| Health | `plugin.health` | Query nhanh, trả `healthStatus` hiện tại |
| Version | (đọc trực tiếp `PluginDescriptor.version`) | Không cần operation riêng |
| Dependencies | (đọc trực tiếp `PluginDescriptor.dependencies` + Registry lookup) | Không cần operation riêng |

**Error/Progress/Cancellation/Timeout/Retry:** mọi operation trên dùng nguyên Task/Result/Job (mục 2-4) — Plugin Contract không định nghĩa cơ chế riêng.

---

## 9. Agent Contract

**Mục đích:** khuôn cho 1 đơn vị ra quyết định trong 1 domain cụ thể (Robot Agent, Video Agent, Research Agent...).

```ts
type AgentDescriptor = PluginDescriptor & {
  kind: "agent";
  triggerExamples?: string[];         // Agent Router dùng để match ý định
  costEstimate?: { currency: string; perInvocation?: number };  // ƯỚC TÍNH — giá thật do Model Provider quyết định lúc runtime
  latencyEstimate?: { p50Ms?: number; p95Ms?: number };
  requiredPermissions: string[];       // capability nó cần Permission Gate cấp
  preferredModels?: string[];           // capability tag (vd "chat-vi-short"), KHÔNG BAO GIỜ tên vendor cụ thể (Constitution Điều 8.1)
  supportedTools?: string[];            // tool capability nó gọi được
};
```

**Invocation:** `Task<AgentInput> → Result<AgentOutput>`, `AgentInput`/`AgentOutput` tự do theo domain của Agent. Toàn bộ Error/Progress/Cancellation/Timeout/Retry dùng nguyên Task/Result (mục 2-4) — **không có** cơ chế riêng cho Agent.

**Ràng buộc bổ sung (không thuộc template chung):** `AgentDescriptor` **CẤM** chứa bất kỳ tên Model/Tool/Device vendor cụ thể nào (chỉ capability tag) — vi phạm điều này là vi phạm trực tiếp `ARCHITECTURE_RULES_V1.md` Điều 8.1.

**"Workflow" đã gộp vào Agent, không còn là `kind` riêng (giải quyết `ARCHITECTURE_AUDIT_V1.md` mục 10.1):** bản gốc tài liệu này có `WorkflowDescriptor`/mục 13 riêng cho đồ thị bước tĩnh khai trước (`steps[]`). Sau khi `EXECUTION_MODEL_V1.md` xác lập triết lý đồ thị **động** (Agent tự sinh Task con lúc chạy, không chỉ chạy theo `steps[]` cố định), 1 Workflow tĩnh chỉ là **trường hợp đặc biệt của 1 Agent có Planning phase xác định trước** (Agent Lifecycle bước "reason" luôn quyết định giống nhau, không phụ thuộc runtime) — không đủ khác biệt để cần `kind`/Contract riêng. Muốn định nghĩa 1 quy trình tĩnh nhiều bước: viết 1 Agent mà hàm quyết định của nó trả về đúng 1 `Task[]` cố định (dùng `Task.dependsOn`/`joinPolicy` ở mục 2 cho DAG giữa các Task con) thay vì suy luận động — vẫn là `AgentDescriptor`, `kind: "agent"`, không có `kind: "workflow"`.

---

## 10. Model Contract

```ts
type ModelDescriptor = PluginDescriptor & {
  kind: "model";
  capabilities: ("chat" | "vision" | "audio" | "video" | "embedding" | "image-gen" | "video-gen" | "reasoning")[];
  pricing?: { currency: string; perInputToken?: number; perOutputToken?: number; perRequest?: number };
  speed?: { tokensPerSecond?: number; p50LatencyMs?: number };
  limits?: { maxContextTokens?: number; maxOutputTokens?: number; rateLimitPerMinute?: number };
  streamingSupported: boolean;
  reasoningSupported?: boolean;
};
```

**Invocation:** `Task<ModelRequest> → Result<ModelResponse>` — streaming dùng đúng `StreamHandle` (mục 4), **không** cơ chế streaming riêng cho Model dù đây là nơi streaming được dùng nhiều nhất thực tế (token-by-token). Xem mục 18 điểm yếu #2 — đây là nơi lựa chọn "1 transport duy nhất" bị thử thách nặng nhất.

**Pricing/Speed/Limits là mô tả TĨNH** (đăng ký 1 lần, cập nhật định kỳ) — **KHÔNG** phải giá/tốc độ thật của 1 lần gọi cụ thể (giá/latency thật đó nằm trong `Result.metadata` của từng lần invoke).

---

## 11. Tool Contract

```ts
type ToolDescriptor = PluginDescriptor & {
  kind: "tool";
  inputSchema: unknown;                 // JSON Schema (dẫn xuất từ zod), mô tả input Tool cần
  authRef?: string;                     // trỏ Connector đã có trong schema hiện tại — KHÔNG BAO GIỜ chứa secret trực tiếp
  rateLimits?: { requestsPerMinute?: number; requestsPerDay?: number };
  availability?: "available" | "degraded" | "unavailable";  // cập nhật bởi health check định kỳ
  pricing?: { currency: string; perInvocation?: number; unit?: string };  // bổ sung sau ARCHITECTURE_AUDIT_V1.md
                                         // mục 12.1 — "chi phí" không chỉ là chi phí Model AI: Tool điều
                                         // khiển Printer/API trả phí cũng có chi phí thật, cần đối xứng
                                         // với ModelDescriptor.pricing (mục 10), không phải trường hợp phụ
};
```

**Invocation:** `Task<ToolInput> → Result<ToolOutput>`. **Ràng buộc bổ sung:** Tool Router **PHẢI** validate `Task.input` theo `inputSchema` **TRƯỚC KHI** forward xuống Tool Provider — input không hợp lệ trả `ErrorObject{category:"validation"}` ngay tại Router, **KHÔNG** để Tool Provider tự xử lý input sai (tập trung validation ở 1 điểm, không lặp lại ở từng Provider).

**Authentication:** không nằm trong Task/Result — nằm trong `authRef` trỏ tới `Connector` (đã tồn tại trong schema hiện tại), Tool Provider tự lấy credential lúc `execute()`, không truyền qua Task input (secret không bao giờ đi qua Event Bus/Task envelope, nhất quán Constitution Điều 13.3).

**Notification — không phải 1 contract mới (giải quyết `ARCHITECTURE_AUDIT_V1.md` mục 9.2 mà không thêm khái niệm):** "báo cho người biết 1 việc gì đó" (Digest Agent, giao kết quả Background Execution, yêu cầu Human Approval, cảnh báo DLQ) **đều là 1 Tool** có `capabilities` chứa `"notification.send"` — không cần primitive/contract riêng. 1 Tool Provider cụ thể (vd Telegram) implement capability này như bất kỳ capability nào khác; Agent gọi `ctx.tool("notification.send")` giống hệt gọi bất kỳ Tool nào khác, không có API đặc biệt.

---

## 12. Device Contract

```ts
type DeviceDescriptor = PluginDescriptor & {
  kind: "device";
  deviceType: string;                    // khớp DeviceType hiện có trong schema (robot/camera/esp32/...)
  connectionState: "connected" | "disconnected" | "reconnecting" | "unknown";
  lastHeartbeatAt?: string;
  heartbeatIntervalMs?: number;          // vắng mặt quá hạn = tự động coi "disconnected"
  commands: { name: string; inputSchema: unknown }[];   // mỗi command TỰ ĐỘNG lộ ra như 1 Tool (Constitution Điều 9.4)
  telemetrySchema?: unknown;
};
```

**Commands:** `Task<CommandInput> → Result<CommandOutput>` — dùng khuôn chung, mỗi command trong `commands[]` chính là 1 `targetCapability` cụ thể.

**Telemetry KHÔNG đi qua Task/Result** — telemetry là luồng dữ liệu liên tục, không phải "yêu cầu 1 lần nhận 1 kết quả" — phát qua Event Bus (`device.<id>.telemetry`), nhất quán `ARCHITECTURE_RULES_V1.md` Điều 6.1 (Event dùng khi không cần phản hồi tức thì, nhiều subscriber tiềm năng).

**Heartbeat:** thiết bị tự báo định kỳ (không phải Kernel chủ động dò — đã quyết ở `KERNEL_ARCHITECTURE_V1.md` mục 6 bước 7, lý do mở rộng tốt hơn ở quy mô 300+ device).

---

## 13. (Đã gộp vào mục 9 — Workflow không còn là Contract riêng)

Xem ghi chú cuối mục 9 (Agent Contract). Đồ thị nhiều bước (trước đây `WorkflowDescriptor.steps[]`) nay biểu diễn bằng `Task.dependsOn`/`Task.joinPolicy` (mục 2) giữa các Task con do 1 Agent sinh ra — DAG vẫn tồn tại đầy đủ, chỉ không còn là `kind` Plugin riêng.

---

## 14. Collector Contract

Đã thiết kế chi tiết ở `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 3 — ở đây **chỉ chuẩn hoá lại** theo khuôn Plugin + Task/Result, không thiết kế lại nội dung:

```ts
type CollectorDescriptor = PluginDescriptor & {
  kind: "collector";
  sourceType: string;
  defaultSchedule: string;   // cron — Scheduler (Core Service) đọc field này
};
```

**Invocation:** `Task{operation:"collector.fetch"} → Result<RawDocument[]>` — `RawDocument` giữ nguyên định nghĩa đã có ở tài liệu Knowledge, không định nghĩa lại ở đây.

---

## 15. Memory Contract

```ts
interface MemoryService {
  read(query: MemoryQuery, requester: IdentityRef): Promise<Result<MemoryEntry[]>>;
  write(entry: NewMemoryEntry, requester: IdentityRef): Promise<Result<MemoryEntry>>;
  search(query: string, filters: MemoryFilters, requester: IdentityRef): Promise<Result<MemoryEntry[]>>;
  delete(id: string, requester: IdentityRef): Promise<Result<void>>;
  summarize(filters: MemoryFilters, requester: IdentityRef): Promise<Result<string>>;
}
```

**Read / Write / Search / Delete / Summarize** — đủ 5 method yêu cầu. **Ràng buộc bắt buộc:** mọi method nhận `requester: IdentityRef` — **KHÔNG CÓ** overload "bỏ qua identity" dưới bất kỳ hình thức nào (Constitution Điều 13.1/13.2 — Permission Gate luôn được hỏi bên trong `MemoryService`, không method nào né được, kể cả gọi "nội bộ tin cậy").

`summarize()` gọi Model Router nội bộ (capability `"summarize"`) — **caller của `MemoryService` không bao giờ biết/cần biết model nào được dùng bên trong** (đúng ranh giới Constitution Điều 8).

---

## 15.5 Session Contract

**Bổ sung sau `ARCHITECTURE_AUDIT_V1.md` mục 9.1** — `ARCHITECTURE_RULES_V1.md` §11 liệt Session là 1 trong 6 khái niệm state cần phân biệt, nhưng chỉ 5/6 (Memory/Knowledge/Cache/State/Configuration) có hình dạng contract tường minh trước bản sửa này. Session **tối giản có chủ đích** — không phải kho dữ liệu nghiệp vụ, chỉ là cửa sổ theo dõi 1 luồng tương tác:

```ts
type Session = {
  id: string;
  clientRef: IdentityRef;              // ai/thiết bị nào đang tương tác (thường type: "human" hoặc "device")
  source: string;                      // "robot-chat" | "web" | "voice" | ... — kênh tạo ra session
  startedAt: string;
  lastActivityAt: string;
  expiresAt?: string;                  // vắng mặt = theo policy mặc định của Core Service quản lý Session
  status: "active" | "expired" | "closed";
  trace: TraceContext;                 // correlationId dùng chung cho mọi Task/Event trong session này
};
```

**Không có method `read`/`write` nội dung riêng** — Session chỉ là 1 "khung" gắn `trace.correlationId` cho nhiều Task liên tiếp cùng 1 cuộc tương tác; **nội dung** cuộc trò chuyện (message qua lại) vẫn là `Memory`/`Knowledge` thật nếu đáng nhớ dài hạn, hoặc chỉ tồn tại trong `Task.input`/`Result.output` của từng Task nếu không (đúng bảng phân loại Điều 11 Constitution — mất Session không mất tri thức/sự kiện đã trích ra từ nó). `ConversationSession`/`ConversationMessage` hiện có trong schema Postgres là 1 triển khai cụ thể của contract này, không cần đổi.

---

## 16. Knowledge Contract

```ts
interface KnowledgeService {
  ingest(candidate: KnowledgeCandidate, source: IdentityRef): Promise<Result<Knowledge>>;
  update(id: string, patch: KnowledgePatch): Promise<Result<Knowledge>>;    // tạo version mới, KHÔNG ghi đè
  expire(id: string, reason: string): Promise<Result<void>>;
  recall(query: KnowledgeQuery, requester: IdentityRef): Promise<Result<Knowledge[]>>;
  getConfidence(id: string): Promise<Result<{ confidence: number; importance: number }>>;
}
```

**Ingest / Update / Expire / Reference / Confidence** — đủ 5 khía cạnh yêu cầu, với 1 quyết định thiết kế cần nói rõ: **"Reference" không phải 1 method riêng** — mọi `Knowledge` trả về từ `recall()` **BẮT BUỘC** kèm đủ `source`/`sourceUrl`/`id` để trích dẫn được ngay — đây là **thuộc tính bắt buộc của dữ liệu trả về**, không phải 1 API endpoint tách biệt (tách riêng sẽ tạo nguy cơ Agent quên gọi "lấy reference" sau khi đã `recall()`, dẫn tới trả lời không trích dẫn được nguồn — rủi ro đã lường trước, không phải giả thuyết).

`update()` tạo `Knowledge` version mới (field `superseded_by_id` trỏ ngược, theo đúng thiết kế đã có ở `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 6) — **CẤM** ghi đè trực tiếp, giữ lịch sử để tái tạo lại "hệ thống từng biết gì tại thời điểm nào".

---

## 17. Versioning & Backward Compatibility — quy tắc áp dụng cho MỌI hợp đồng ở trên

**17.1 — SemVer bắt buộc:** mọi `contractVersion` theo `major.minor.patch`. Major = breaking change. Minor = thêm field mới, không phá consumer cũ (mọi field mới ở minor bump **PHẢI** optional). Patch = sửa lỗi mô tả/hành vi, không đổi hình dạng.

**17.2 — Quy tắc tương thích cụ thể:** 1 subsystem nhận Task với `contractVersion.major` **nhỏ hơn hoặc bằng** major cao nhất nó hỗ trợ → **PHẢI** xử lý được. `major` **lớn hơn** major nó hỗ trợ → từ chối với `ErrorObject{code:"validation.contract_version_unsupported", retryable:false}` — không được cố xử lý mù quáng.

**17.3 — Field mới ở minor bump PHẢI có thể bỏ qua an toàn:** 1 consumer cũ hơn (chưa biết field mới) **PHẢI** vẫn hoạt động đúng nếu bỏ qua field đó — không bao giờ được thiết kế 1 field mới là **bắt buộc** để hành vi đúng, vì điều đó biến 1 minor bump thành breaking change trá hình.

**17.4 — Cửa sổ chuyển tiếp:** khi phát hành major mới của 1 hợp đồng, Registry **NÊN** cho phép cả 2 major cùng tồn tại (`KERNEL_ARCHITECTURE_V1.md` mục 9) cho tới khi mọi plugin phụ thuộc đã migrate — không ép cutover đồng thời toàn hệ thống.

**17.5 — Version của hợp đồng khác version của plugin:** `PluginDescriptor.version` (bản thân plugin) và `PluginDescriptor.contractVersion` (hợp đồng `kind` nó tuân theo) **PHẢI** tách biệt rõ ràng, không gộp — 1 plugin có thể lên version 2.5.0 mà vẫn tuân theo `contractVersion: "1.0.0"` của Agent Contract không đổi.

---

## 18. Tự phản biện — Điểm yếu của chính thiết kế này

**#1 — "Universal Task/Result" không thực sự universal.** Telemetry (mục 12) và các luồng dữ liệu liên tục khác **không** đi qua Task/Result — chúng đi qua Event Bus. Điều này đúng đắn (Constitution Điều 6 phân biệt rõ), nhưng có nghĩa khẳng định "mọi subsystem nhận Task, trả Result" trong yêu cầu gốc **cần 1 ngoại lệ tường minh**: Task/Result phủ đúng phần **có hình dạng yêu cầu-kết quả** (request-shaped) của hệ thống, không phủ phần **luồng dữ liệu không ai yêu cầu, phát liên tục** (stream-shaped, tự nhiên là Event). Không thừa nhận ranh giới này sẽ dẫn tới ép Telemetry vào Task/Result 1 cách gượng ép (vd tạo 1 "Task" giả cho mỗi nhịp heartbeat) — sai hướng.

**#2 — Streaming qua Event Bus outbox có thể quá tốn kém ở tần suất cao.** Model Contract (mục 10) là nơi cần streaming nhiều nhất — sinh token theo thời gian thực. Nếu mỗi token là 1 event ghi vào outbox bền (Phase 1: 1 bảng Postgres, theo `KERNEL_ARCHITECTURE_V1.md` mục 8/12), tần suất ghi có thể quá cao cho use case token-by-token thật. **Chưa giải quyết ở tài liệu này** (đúng chủ đích — Model Router chưa được thiết kế) — cần cân nhắc khi thiết kế Model Router: có thể cần 1 "làn nhanh" (fast lane, in-memory-only, không qua outbox bền) riêng cho streaming tần suất cực cao, tách khỏi "làn bền" (durable lane) dùng cho Task lifecycle event thông thường — gộp chung 2 nhu cầu khác bản chất vào 1 outbox duy nhất là rủi ro hiệu năng thật, không phải lý thuyết.

**#3 — Idempotency là khuyến nghị, không phải đảm bảo.** `idempotencyKey` (mục 2) tồn tại nhưng tài liệu **chưa** định nghĩa module nào chịu trách nhiệm enforce nó (kiểm tra key trùng, chặn xử lý lặp). Ở Phase 1, đây là **best-effort** — mỗi subsystem tự quyết có dùng key để dedupe hay không. Hệ quả: hệ thống vẫn dễ tổn thương với double-execution y hệt mức độ Constitution Điều 12 (Event Rules) đã thừa nhận cho at-least-once delivery — thêm field không tự động thêm đảm bảo, chỉ tạo điều kiện CHO 1 module tương lai (dedup store chuyên biệt) enforce chặt hơn.

**#4 — Retry + side-effect chưa có lời giải ở tầng hợp đồng.** Nếu attempt 1 của 1 Task đã gây ra tác dụng phụ 1 phần (vd đã gửi 1 nửa tin nhắn Telegram) trước khi lỗi, attempt 2 (Job mới, mục 3) có thể lặp lại tác dụng phụ đó trừ khi subsystem tự kiểm tra. Hợp đồng **không thể** ép buộc tác dụng phụ là idempotent — chỉ có thể khuyến khích qua việc truyền `idempotencyKey` xuyên suốt mọi attempt để subsystem **CÓ THỂ** tự dedupe nếu muốn. Đây là giới hạn nội tại của mọi hệ thống retry-với-side-effect, không riêng thiết kế này — nhưng cần nói rõ, không giả vờ đã giải quyết.

**#5 — Progress tự báo cáo, không xác minh được.** `percentage`/`eta` (mục 6) hoàn toàn tự báo cáo bởi subsystem đang chạy — không có cơ chế xác minh độ chính xác. 1 plugin lỗi (không phải ác ý, chỉ là bug) có thể báo "99%" mãi mãi mà không bao giờ hoàn tất. Lưới an toàn duy nhất là `timeoutMs` tổng (mục 2) — Dashboard/UI **KHÔNG ĐƯỢC** coi `percentage` là bảo đảm cứng, chỉ là tín hiệu tham khảo.

**#6 — [ĐÃ VÁ MỘT PHẦN sau `ARCHITECTURE_AUDIT_V1.md` mục 7.2] `Task.operation` (trước đây `Task.kind`) là chuỗi tự do, không có registry validate.** Điểm yếu ban đầu chỉ nêu cho 1 field — audit chỉ ra đúng rủi ro này áp dụng như nhau cho `PluginDescriptor.kind`, `capabilities[]`, `ErrorObject.code`, `Event.type`. Mục 0.4 giờ quy định 1 pattern chung `^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$` cho cả 5 field thay vì chỉ 1 — **nhưng việc enforce bằng công cụ (validate lúc `Registry.register()`) vẫn CHƯA thiết kế/xây**, chỉ mới thống nhất quy ước. Đây là hạng mục cụ thể trong `docs/IMPLEMENTATION_ROADMAP_V1.md`, không phải đã xong.

**#7 — Giữ tên `knowledge.ingested` thay vì đổi theo gợi ý `KnowledgeAdded` của user (mục 5) là 1 lựa chọn có chủ đích, không phải bỏ sót** — nêu ở đây để tường minh, không lặng lẽ đi ngược yêu cầu: đổi tên event đã dùng ở tài liệu Knowledge Acquisition sẽ phá tính nhất quán xuyên bộ tài liệu mà không mang lại lợi ích nào — quy ước đặt tên `domain.entity.action` (đã áp dụng nhất quán ở `task.*`/`plugin.*`/`device.*`) ưu tiên hơn việc khớp chính xác ví dụ minh hoạ trong yêu cầu.

---

## 19. Kết

Bộ hợp đồng này là ABI — **hình dạng**, không phải **hành vi**. Model Router, Tool Router, Agent Router, Device Router (chưa thiết kế) sẽ là những module **triển khai** cách dùng các hợp đồng này để thực sự điều phối — bản thân hợp đồng không điều phối gì cả, chỉ đảm bảo mọi module tương lai "nói cùng 1 ngôn ngữ" trước khi bất kỳ Router nào tồn tại, đúng thứ tự mà yêu cầu đã đặt ra ("Design these contracts before any Router exists").

*Tài liệu thuần đặc tả hợp đồng — không có code, migration, hay thay đổi nào lên project trong quá trình viết tài liệu này.*
