# Brain OS — Execution Model V1

**Vai trò:** thiết kế cách công việc thực sự di chuyển qua hệ thống — mảnh còn thiếu khiến Agent/Model/Tool Router và Workflow Engine chưa thể thiết kế đúng. Không code, không implement.
**Ngày:** 2026-07-09 · **Tiền đề:** dựng trên `KERNEL_ARCHITECTURE_V1.md` (6 primitive), `ARCHITECTURE_RULES_V1.md` (hiến pháp), `SYSTEM_CONTRACTS_V1.md` (Task/Job/Result/Event/Progress/Error — tài liệu này **không định nghĩa lại** các hợp đồng đó, chỉ đặc tả **hành vi runtime** dùng chúng).

> **🔒 KIẾN TRÚC V1 ĐÃ ĐÓNG BĂNG (2026-07-09), đã vá sau `ARCHITECTURE_AUDIT_V1.md`:** mọi `Task.kind` literal đổi thành `Task.operation` (khớp `SYSTEM_CONTRACTS_V1.md`) · `joinPolicy` quorum đổi sang kiểu object · mục 4 bỏ `grantedPermissions` cache (không đổi hành vi enforce, chỉ giảm 1 field không rõ tác dụng) · mục 25 thêm yêu cầu cập nhật NGUYÊN TỬ cho `accumulatedCostUsd` (vá race condition thật, audit mục 1 phát hiện #3) · mục 30 thêm quy tắc chặn đệ quy Learning Loop (vá audit mục 1 phát hiện #5) · mục 0 thêm phạm vi rõ ràng: model này KHÔNG phủ Automation dạng phản ứng liên tục (audit mục 1 phát hiện #1) · mục 24/28/29 và mục 25/26 làm rõ hơn "1 view, không phải 1 hệ thống riêng" (audit mục 3.4/3.5).

---

## 0. Vì sao cần 1 execution model riêng, không mượn nguyên 1 hệ có sẵn

Brain OS có 4 ràng buộc đồng thời mà **không hệ nào trong 6 hệ tham chiếu** (Linux Scheduler, Ray, Temporal, Airflow, LangGraph, ROS, Kubernetes Controllers) giải quyết cùng lúc:

1. **Đồ thị công việc không biết trước đầy đủ** — "tạo video quảng cáo" không có DAG cố định trước khi Agent bắt đầu suy luận; Agent có thể quyết định giữa chừng "cần thêm 1 bước nữa" dựa trên kết quả bước trước. → loại Airflow làm mô hình CHÍNH (DAG tĩnh khai trước).
2. **1 VPS, 1 owner, không phân tán** — đã nhắc lại xuyên suốt cả 4 tài liệu trước. → loại nguyên runtime phân tán của Ray/Kubernetes, chỉ mượn **mẫu hình khái niệm**.
3. **Công việc chạy dài, hệ thống có thể restart** (chưa có supervisor, đã ghi nhận ở `NEXT.md`) — cần phục hồi được, nhưng code Agent gọi model AI vốn dĩ **không xác định được (non-deterministic)** — không có "cùng input luôn ra cùng output" để replay như Temporal yêu cầu. → không copy nguyên "deterministic replay" của Temporal.
4. **Chi phí AI là 1 trục lập lịch thật** (tiền, token) — không hệ nào trong 6 hệ tham chiếu coi "$ mỗi lần gọi" là 1 tín hiệu lập lịch bậc nhất (Linux Scheduler lập lịch theo CPU-time, không theo tiền).

→ Thiết kế dưới đây **mượn có chọn lọc**: đồ thị động của Ray/LangGraph, checkpoint-snapshot (không phải replay) lấy cảm hứng từ LangGraph's checkpointer, mẫu Goal/Feedback/Result/Cancel của ROS Actions (đã tự nhiên hội tụ với `Task/Progress/Result/cancel()` ở `SYSTEM_CONTRACTS_V1.md` — xem mục 31), và mẫu reconcile-không-replay của Kubernetes Controllers cho phần Resume. Không hệ nào bị copy nguyên khối.

**0.5 — Phạm vi KHÔNG phủ (bổ sung sau `ARCHITECTURE_AUDIT_V1.md` mục 1 phát hiện #1, mục 12.2):** toàn bộ tài liệu này dựng quanh hình dạng **Intent rời rạc → hội tụ → Result** (mục 1) — có điểm bắt đầu (user/hệ thống yêu cầu 1 việc cụ thể) và điểm kết thúc rõ ràng (đồ thị hội tụ). **"Automation" theo nghĩa phản ứng liên tục** (vd "hễ có Knowledge mới về đối thủ thì báo", không ai "hỏi" điều này, không có điểm hội tụ) **KHÔNG khớp hình dạng này** — 1 subscriber luôn bật, phản ứng theo Event (Constitution Điều 6.1), không đi qua Planning/Scheduling Loop/hội tụ. Model thực thi cho Automation dạng này **chưa được thiết kế** — để lại cho 1 tài liệu riêng khi cần (không đoán trước hình dạng đúng khi chưa có use case thật, đúng nguyên tắc "không xây cho quy mô/nhu cầu chưa tồn tại" xuyên suốt cả 6 tài liệu). Automation dạng **có điểm kết thúc rõ ràng** (vd "chạy Agent này lúc 3AM, xong thì thôi" — bản chất là 1 Execution được Scheduler tạo Task, xem `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 8) **VẫN khớp** model này bình thường — ranh giới là "có hội tụ" hay "chạy mãi mãi", không phải "có lịch hay không".

---

## 1. Execution Lifecycle — thiết kế lại vòng đời tổng thể

Ví dụ user đưa (`Intent → Planning → Task Graph → Scheduling → Agent Selection → Model Selection → Tool Selection → Execution → Monitoring → Memory → Knowledge → Learning → Result`) có 3 vấn đề cần sửa:

- **Agent/Model/Tool Selection không phải 3 pha tuần tự cấp cao** — chúng lặp lại **theo từng Task**, có thể hàng chục lần trong 1 execution, không phải 1 lần duy nhất ở giữa pipeline.
- **Memory/Knowledge không chỉ được đọc ở 1 bước cố định** — Agent đọc chúng xuyên suốt cả Planning lẫn mọi Task, không phải sau "Monitoring".
- **Learning đặt trước Result là sai hướng độ trễ** — không nên bắt user chờ "hệ thống học xong" mới nhận câu trả lời.

**Thiết kế lại — vòng lặp, không phải đường thẳng:**

```
User Intent
    │
    ▼
┌───────────────── Planning Phase (mục 5) ─────────────────┐
│  hỏi Memory (đây là ai, ưu tiên gì) + Knowledge (đã biết  │
│  gì rồi) → sinh Task Graph khởi đầu (≥1 root Task)        │
└──────────────────────────┬──────────────────────────────┘
                            ▼
      ┌─────────── Scheduling Loop (mục 6, LẶP) ───────────┐
      │ 1. tìm Task READY (dependency đã thoả, mục 8)       │
      │ 2. admission control (budget/priority/fairness)      │
      │ 3. dispatch → resolve Agent → Agent tự resolve       │
      │    Model/Tool nó cần (Agent/Model/Tool Selection     │
      │    xảy ra Ở ĐÂY, mỗi lần dispatch, không phải 1 pha  │
      │    cấp cao duy nhất)                                 │
      │ 4. thực thi (có thể stream, có thể dừng chờ duyệt    │
      │    người, có thể TỰ THÊM node mới vào đồ thị)        │
      │ 5. quan sát Result → cập nhật trạng thái đồ thị       │
      │ 6. checkpoint (mục 22)                                │
      └──────────────────────┬───────────────────────────────┘
                              │ lặp tới khi đồ thị không còn Task
                              │ pending/ready nào
                              ▼
                  Đồ thị hội tụ (success | partial_success | failure)
                              │
                              ▼
                  Result → trả cho User NGAY (không chờ bước sau)
                              │
                              ▼ (bất đồng bộ, KHÔNG chặn dòng trên)
                  Learning Loop (mục 30) — Memory/Knowledge/Metrics
```

**Vì sao là vòng lặp:** đồ thị **lớn dần trong lúc chạy** (mục 5-6) — không có "1 lượt Planning rồi xong", có "Planning tạo node đầu tiên, Scheduling Loop có thể tự thêm node mới mỗi lần 1 Task hoàn tất và Agent xử lý nó quyết định cần thêm bước". Vòng lặp dừng khi đồ thị **hội tụ** (không còn node `ready`/`pending`), không phải khi "hết 1 danh sách bước cố định".

---

## 2. Task Lifecycle (execution-specific — không định nghĩa lại `SYSTEM_CONTRACTS_V1.md` mục 2-3)

Bổ sung 3 khái niệm runtime mà System Contracts chưa cần vì nó chỉ đặc tả **hình dạng**, không đặc tả **khi nào 1 Task được phép chạy**:

- **Admission:** 1 Task tồn tại trong đồ thị nhưng chưa chắc được **admit** (đưa vào hàng chờ dispatch thật) — Scheduling Loop (mục 6) quyết định admit dựa trên budget/priority/fairness, tách biệt khỏi "đã ready" (dependency thoả).
- **Readiness:** `dependsOn` (mục 8) đã thoả toàn bộ theo `joinPolicy`. Ready ≠ Admitted — ready là điều kiện CẦN, admission control quyết định điều kiện ĐỦ.
- **Dispatch:** thời điểm 1 Job (mục 3, System Contracts) thực sự được tạo cho 1 Task đã admit — đây là lúc Agent/Model/Tool Selection xảy ra (mục 1).

```
Task tồn tại trong graph
   │
   ▼ dependsOn thoả (mục 8)
 ready
   │
   ▼ admission control cho qua (mục 6)
 admitted ──► dispatch (tạo Job mới, mục 3) ──► ... (lifecycle Job/Result như System Contracts)
```

---

## 3. Agent Lifecycle (trong phạm vi 1 lần dispatch)

Khác với Plugin Lifecycle (`KERNEL_ARCHITECTURE_V1.md` mục 9 — đăng ký/khởi tạo/health/restart, sống suốt vòng đời process), **Agent Lifecycle** ở đây là vòng lặp **bên trong 1 lần xử lý 1 Task**:

```
receive(Task, ExecutionContext)
   │
   ▼
reason  ──► cần Model? → ctx.model(capability).invoke() [= 1 Task con]
        ──► cần Tool?  → ctx.tool(name).execute()        [= 1 Task con]
        ──► cần Memory/Knowledge? → ctx.memory/knowledge.recall() [mục 16-17]
   │
   ▼
quyết định: xong chưa?
   │                    │
   ▼ chưa                ▼ rồi
spawn thêm Task con    trả Result (mục 4, System Contracts)
vào đồ thị, quay lại
"reason"
```

**Điều quan trọng:** Agent **không tự gọi trực tiếp** Model/Tool Provider (`ARCHITECTURE_RULES_V1.md` Điều 4.3) — mọi lần "cần Model/Tool" ở trên tự nó là 1 Task con mới trong đồ thị, đi qua đúng Scheduling Loop (mục 1) như bất kỳ Task nào khác, không phải lời gọi hàm tắt. Đây là lý do 1 Agent "đơn giản" (như Robot Agent hiện tại) thực chất **luôn** tạo ra 1 đồ thị nhỏ (root Task → 0-1 Task con gọi Model), không phải ngoại lệ.

---

## 4. Execution Context

```ts
type ExecutionContext = {
  executionId: string;              // = id của root Task
  trace: TraceContext;                // correlationId = executionId, DÙNG CHUNG cho mọi Task/Job/Event trong execution này
  requestedBy: IdentityRef;
  budget?: { maxCostUsd?: number; maxTokens?: number; deadline?: string };
  graph: TaskGraphRef;                 // tham chiếu đồ thị — CÓ THỂ LỚN DẦN, xem mục 1/5
  checkpointRef?: string;
  accumulatedCostUsd: number;          // cộng dồn khi mỗi Task hoàn tất, xem mục 25
  accumulatedTokens?: { input: number; output: number };
  status: "planning" | "scheduling" | "paused" | "converged" | "failed" | "cancelled";
  createdAt: string;
  updatedAt: string;
};
```

**Không phải Kernel primitive thứ 7** — cùng kỷ luật đã áp cho `Task`/`Result` ở `SYSTEM_CONTRACTS_V1.md` mục 0.1: `ExecutionContext` là đối tượng ABI, dựng trên Event Bus/Registry/Permission Gate đã có, không mở rộng Kernel.

**Đã xoá field `grantedPermissions` (cache) khỏi bản gốc, theo `ARCHITECTURE_AUDIT_V1.md` mục 11.1:** field này từng khai "cache, không thay Permission Gate — Permission Gate vẫn luôn được hỏi thật" — nếu enforcement thật không đổi hành vi dựa trên field đó, nó không đo lường được lợi ích cụ thể, chỉ tạo rủi ro hiểu lầm (tên "granted" dễ đọc nhầm thành nguồn thẩm quyền thật). Xoá tới khi có số liệu cụ thể chứng minh cache này tiết kiệm được gì — Permission Gate (`ctx` mỗi plugin nhận, `KERNEL_ARCHITECTURE_V1.md` mục 6 bước 5) vẫn là nơi DUY NHẤT quyết định, không đổi.

**`graph` là tham chiếu, không phải mảng tĩnh nhúng trực tiếp** — vì đồ thị lớn dần (mục 1), `ExecutionContext` chỉ giữ con trỏ tới trạng thái đồ thị hiện tại (lưu ở Core Service quản lý Execution, chưa đặt tên ở tài liệu này vì đó là việc của thiết kế Router sau) — không nhúng toàn bộ graph trực tiếp vào context truyền qua mọi lời gọi (tránh object phình to theo thời gian chạy).

---

## 5. Planning Phase

**Input:** Intent (text/voice/event đã chuẩn hoá) + `requestedBy`.
**Output:** `ExecutionContext` mới + Task Graph khởi đầu (**tối thiểu 1 root Task**, không bắt buộc đầy đủ).

**Ai làm Planning:** 1 capability (`"planning"`), phân giải qua Registry như mọi capability khác — **không hardcode 1 "Planner" cụ thể trong Kernel/Core** (đúng Điều 3.4 Constitution — mặc định là plugin). Planner **tự nó cũng là 1 Agent** (dùng đúng Agent Lifecycle mục 3) — không phải 1 khái niệm kernel-level riêng.

**Planner PHẢI:**
1. Hỏi `ctx.memory.recall()` — biết đang phục vụ ai, ưu tiên gì (`MemoryService`, `SYSTEM_CONTRACTS_V1.md` mục 15).
2. Hỏi `ctx.knowledge.recall()` — biết thế giới đã có gì liên quan (`KnowledgeService`, mục 16), tránh lặp lại việc đã biết.
3. Ước tính `budget` sơ bộ (dựa `costEstimate` của các Agent/Model khả dĩ liên quan, từ Descriptor — `SYSTEM_CONTRACTS_V1.md` mục 9-10) — gán vào `ExecutionContext.budget` nếu user/policy không tự đặt.
4. Trả về đồ thị khởi đầu — **KHÔNG BẮT BUỘC** đầy đủ toàn bộ các bước, chỉ cần root Task đủ để Scheduling Loop bắt đầu — phần còn lại của đồ thị **được phép** sinh dần trong lúc chạy (mục 1, mục 3).

**Planning KHÔNG phải pha "chạy 1 lần rồi khoá cứng"** — 1 Task đặc biệt (`operation: "graph.replan"`) **ĐƯỢC PHÉP** được Agent tự tạo giữa chừng nếu nó phát hiện kế hoạch ban đầu sai hướng — tái sử dụng đúng cơ chế "Agent spawn Task con" (mục 3), không phải cơ chế Planning riêng thứ 2.

---

## 6. Scheduling Phase

**Không phải Linux CFS thật** (không có CPU run-queue vật lý) — nhưng mượn đúng 2 ý tưởng của nó: **priority** (Task có `priority` field, `SYSTEM_CONTRACTS_V1.md` mục 2) và **fairness** (1 Execution/Agent không được độc chiếm worker pool — giới hạn số Task đồng thời tối đa **cho mỗi Execution**, không chỉ giới hạn tổng toàn hệ thống, để 1 Execution "tham lam" không đói các Execution khác).

**Vòng lặp Scheduling (chạy liên tục hoặc kích hoạt theo event `task.completed`/`task.failed`):**
1. Quét đồ thị của mọi Execution đang `scheduling` — tìm Task ở trạng thái `ready` (mục 2).
2. **Admission control**, theo thứ tự kiểm tra:
   - Permission Gate cho phép `requestedBy`/Agent thực hiện `targetCapability` này không? (Constitution Điều 13.1 — không có ngoại lệ)
   - `ExecutionContext.accumulatedCostUsd + ước tính chi phí Task này ≤ budget.maxCostUsd`? Nếu vượt → Task **không** bị huỷ, chuyển `paused{pauseReason:"budget_exceeded"}`, chờ tăng budget hoặc quyết định cắt bớt.
   - Concurrency limit toàn cục và limit-mỗi-Execution còn chỗ không?
   - Priority — Task priority cao hơn được ưu tiên khi có nhiều Task cùng ready và concurrency limit chật.
3. Task qua hết admission → **dispatch** (mục 2) → tạo `Job` mới → Agent Lifecycle (mục 3) chạy.
4. Nhận `Result` → cập nhật trạng thái node trong đồ thị → nếu Agent có spawn Task con → thêm vào đồ thị → quay lại bước 1.

**Điểm mượn từ Kubernetes Controllers:** vòng lặp Scheduling là **level-triggered, không thuần edge-triggered** — nghĩa là dù có bỏ lỡ 1 event `task.completed` (Event Bus chỉ đảm bảo at-least-once, không đảm bảo real-time tuyệt đối, `KERNEL_ARCHITECTURE_V1.md` mục 8), vòng lặp vẫn **tự quét lại định kỳ** để phát hiện Task nào đã ready mà chưa được xử lý — không phụ thuộc 100% vào việc "nhận đúng 1 event kích hoạt", giống cách Kubernetes controller không tin tưởng tuyệt đối vào watch event, luôn có full-resync định kỳ làm lưới an toàn.

---

## 7. Parallel Execution

Mọi Task **không có quan hệ `dependsOn` trực tiếp/gián tiếp với nhau** **ĐƯỢC PHÉP** chạy song song, giới hạn bởi concurrency limit (mục 6). Không cần khai báo "chạy song song" tường minh — song song là **mặc định** cho bất kỳ 2 node độc lập nào trong đồ thị, tuần tự chỉ xảy ra khi có `dependsOn` thật.

**Join semantics** khi 1 Task phụ thuộc nhiều Task khác — `Task.joinPolicy` (field chung của `Task`, `SYSTEM_CONTRACTS_V1.md` mục 2 — không còn gắn riêng Workflow Contract, đã gộp vào Agent, xem mục 9/13 tài liệu đó):
- `"all"` (mặc định) — ready chỉ khi **mọi** dep đã `succeeded`.
- `"any"` — ready ngay khi **1** dep bất kỳ `succeeded` (dùng cho race — vd gọi 2 Model song song, lấy kết quả nào về trước).
- `{ type: "quorum", count: N }` — ready khi **N trong M** dep đã `succeeded` (dùng cho pattern "hỏi 3 nguồn, cần 2 đồng thuận") — kiểu object có cấu trúc, không mã hoá số trong chuỗi (`ARCHITECTURE_AUDIT_V1.md` mục 7.1).

**partial_success lan truyền tự nhiên:** nếu 1 dep dùng `joinPolicy:"all"` mà 1 trong các dep `failed` (không phải toàn bộ), Task cha **không tự động fail** — nó nhận đủ thông tin (`Result.partial`, `SYSTEM_CONTRACTS_V1.md` mục 4) để tự quyết định tiếp tục với dữ liệu có được hay dừng — quyết định đó là logic của Agent, không phải quy tắc cứng của Scheduling.

---

## 8. Dependencies

`dependsOn: string[]` (Task id) — field chung của `Task` (`SYSTEM_CONTRACTS_V1.md` mục 2), dùng cho **mọi** Task, không riêng gì kịch bản nhiều bước tĩnh (trước đây gọi "Workflow" — đã gộp vào Agent, không còn là khái niệm tách biệt).

**Cycle detection:** áp dụng đúng nguyên tắc đã có ở `KERNEL_ARCHITECTURE_V1.md` mục 6 bước 4 cho việc nạp plugin — **fail loud lúc thêm node, không deadlock âm thầm**. Vì đồ thị lớn dần lúc runtime (mục 1), cycle detection **PHẢI chạy mỗi lần 1 node mới được thêm** (không chỉ 1 lần lúc Planning) — thêm 1 Task con có `dependsOn` trỏ ngược lên tổ tiên của chính nó bị từ chối ngay tại thời điểm spawn (mục 3), trả `ErrorObject{code:"validation.circular_dependency"}`.

**Dependency tới Task ngoài Execution hiện tại** — **KHÔNG hỗ trợ** ở Phase 1 (1 Execution chỉ phụ thuộc Task trong chính đồ thị của nó) — muốn dùng lại kết quả 1 Execution khác, đọc qua Knowledge/Memory (đã ghi lại, mục 16-17), không tạo cross-execution dependency edge trực tiếp (tránh đồ thị toàn hệ thống trở thành 1 mạng lưới không biên giới, khó reasoning/checkpoint).

---

## 9. Retries

Dùng nguyên `RetryPolicy` (`SYSTEM_CONTRACTS_V1.md` mục 1/2) — retry = 1 `Job` mới cùng `taskId`, `attempt` tăng.

**Tính chất quan trọng do thiết kế readiness-gated (mục 2) mang lại miễn phí:** dependents của 1 Task **chỉ** trở nên `ready` sau khi Job của Task đó đạt `succeeded` — nghĩa là khi 1 Task fail và đang retry, **không có dependent nào đã lỡ dispatch cần "hoãn lại"**, vì chúng chưa bao giờ được dispatch (còn chờ đúng dep đó `succeeded`). Retry không cần cơ chế "un-schedule" downstream — hệ quả tự nhiên của readiness gate, không phải cơ chế bổ sung riêng.

---

## 10. Cancellation

Cooperative, kế thừa `SYSTEM_CONTRACTS_V1.md` mục 2. Ở tầng Execution: huỷ 1 node **PHẢI lan xuống mọi descendant chưa terminal** trong đồ thị — descendant đang `running` nhận cancel request (cooperative), descendant còn `pending`/chưa dispatch chuyển thẳng `cancelled` không cần dispatch trước rồi mới huỷ (tối ưu — không tốn 1 lần dispatch vô ích).

**Huỷ 1 node KHÔNG lan lên ancestor hay sang branch độc lập** — chỉ lan xuống, đúng hướng dependency (mục 8). Huỷ toàn bộ Execution = huỷ root Task, lan xuống toàn đồ thị theo quy tắc trên.

---

## 11. Timeouts

**Per-Task:** `Task.timeoutMs` (`SYSTEM_CONTRACTS_V1.md` mục 2).

**Per-Execution (mới ở tài liệu này):** `ExecutionContext.budget.deadline` — hạn chót cho **toàn bộ** đồ thị. **Tái dùng nguyên mẫu đã chứng minh hoạt động trong codebase hiện tại** (`cli-agent-router.ts`: timeout riêng từng provider + tổng ngân sách thời gian toàn chuỗi, ngân sách còn lại co dần cho provider sau — ghi nhận ở `ARCHITECTURE_REVIEW_V1.md` mục 1.9): mỗi lần dispatch 1 Task, timeout thật sự áp dụng = `min(Task.timeoutMs ?? defaultTimeoutMs, remainingTimeUntilExecutionDeadline)` — không phải phát minh mới, tổng quát hoá 1 pattern đã chạy thật trong sản phẩm hiện tại lên cho MỌI Task, không riêng CLI agent chain.

---

## 12. Human Approval

**Không phải subsystem riêng — là 1 Task đặc biệt.** Khi Agent (hoặc chính manifest của 1 capability) đánh dấu 1 hành động `requiresApproval: true`, Agent (mục 3) spawn 1 Task con `operation:"human.approval"`, `targetCapability:"human.approval"`. 1 **Human Approval Provider** (Tool Provider plugin — hiện UI/gửi thông báo qua Tool capability `notification.send`, `SYSTEM_CONTRACTS_V1.md` mục 11, chờ phản hồi) resolve Task này.

Trong lúc chờ, Task đó (và mọi descendant phụ thuộc kết quả duyệt) ở trạng thái `paused{pauseReason:"human_approval"}` — **tái dùng state `paused` đã có** ở `SYSTEM_CONTRACTS_V1.md` (không thêm state mới vào `ExecutionState` đã đóng băng version 1.0.0 — đúng kỷ luật versioning, Điều 17.3: không phá hợp đồng đã phát hành chỉ vì tiện).

Người duyệt (Identity type `human`) phản hồi → Human Approval Provider trả `Result{status:"success", output:{approved: boolean, note?: string}}` → Task con hoàn tất → dependents trở `ready` bình thường (mục 8-9) — **không có code path đặc biệt nào khác** cho "sau khi được duyệt", nó chỉ là 1 Task đã `succeeded` như mọi Task khác.

---

## 13. Streaming Outputs

Dùng nguyên `StreamHandle` (`SYSTEM_CONTRACTS_V1.md` mục 4). Ở tầng Execution: khi 1 Task con đang stream, `Progress` của nó **PHẢI** được Scheduling Loop propagate lên `ExecutionContext` (tổng hợp progress đa cấp — UI theo dõi 1 Execution thấy được Task con nào đang stream, không chỉ thấy trạng thái tổng "đang chạy").

---

## 14. Long-running Jobs

Thuộc tính của **1 Task** — `Task.mode:"async"` (`SYSTEM_CONTRACTS_V1.md` mục 4), `Result{status:"accepted"}` trả ngay, theo dõi tiếp qua `Job`/Progress. Scheduling Loop (mục 6) **không block** chờ 1 Task long-running — nó tiếp tục dispatch các Task độc lập khác (mục 7) trong lúc Task đó chạy nền.

---

## 15. Background Jobs

**Khác trục với Long-running (mục 14), không phải cùng khái niệm:** Long-running là thuộc tính của **1 Task** (mất bao lâu). Background là thuộc tính của **1 Execution** (có ai đang chủ động theo dõi realtime hay không). 1 Execution nền có thể gồm toàn Task nhanh (vd lượt chạy Collector hàng ngày — mỗi Task fetch chỉ vài giây, nhưng cả Execution chạy lúc không ai xem UI). Kết quả của Execution nền **PHẢI** được giao qua Event/notification (Tool Telegram, ghi ActivityLog...) — **KHÔNG** giả định có 1 kết nối đang mở chờ sẵn.

---

## 16. Memory Integration

Agent gọi `ctx.memory.recall()`/`ctx.memory.remember()` (`SYSTEM_CONTRACTS_V1.md` mục 15) — **bản thân lời gọi này CŨNG là 1 Task con** (`operation:"memory.read"`/`"memory.write"`, `targetCapability:"memory"`) đi qua đúng Scheduling Loop, không phải lời gọi hàm tắt bỏ qua Permission Gate. Lịch sử truy cập Memory trong 1 Execution nằm sẵn trong Execution History (mục 24/28, xem ghi chú hợp nhất) — không cần cơ chế audit riêng cho Memory.

---

## 17. Knowledge Integration

Tương tự mục 16, cộng thêm: **RAG pattern (`KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 12) là 1 mẫu graph cụ thể**, không phải cơ chế riêng — bước "sufficiency check → fallback search internet" chính là Agent (mục 3) tự spawn 1 Task con `targetCapability:"tool.web_search"` khi `ctx.knowledge.recall()` không đủ tín hiệu, rồi spawn tiếp 1 Task `targetCapability:"knowledge.ingest"` đẩy kết quả search ngược vào Knowledge Pipeline — đúng 3 node trong 1 đồ thị con, dùng lại nguyên cơ chế Agent Lifecycle (mục 3) + Task spawn động (mục 1), không phải thiết kế bổ sung.

---

## 18. Device Integration

Lệnh gửi Device = 1 Task nhắm `targetCapability` = 1 command đã khai trong `DeviceDescriptor.commands` (`SYSTEM_CONTRACTS_V1.md` mục 12) — dùng khuôn Task/Result y hệt Tool. **Telemetry KHÔNG đi qua Task/Result** (đã quyết ở System Contracts mục 12) — nếu 1 Agent cần biết trạng thái Device mới nhất để quyết định bước tiếp theo, nó **subscribe Event** `device.<id>.telemetry`, không `recall()` nó như Memory/Knowledge (khác bản chất dữ liệu — telemetry là dòng chảy, không phải kho tra cứu).

**Rủi ro riêng của Device khác Tool/Model thuần software:** lệnh gửi Device có thể gây hệ quả vật lý không thể "thử lại vô hại" (robot đã quay trái thật, gọi lại lệnh turn_left lần 2 không "undo" được) — Retry (mục 9) cho Task nhắm Device **NÊN** mặc định `maxAttempts` thấp hơn Tool/Model thuần software, và **NÊN** cân nhắc `requiresApproval` (mục 12) cho command có khả năng gây hại — quyết định cụ thể để lại cho lúc thiết kế Device Router, ở đây chỉ nêu nguyên tắc.

---

## 19. Tool Integration

Đã đủ ở `SYSTEM_CONTRACTS_V1.md` mục 11 — Task/Result chuẩn, validate input theo `inputSchema` tại Tool Router trước dispatch. Ở tầng Execution: **rate limit của Tool (`ToolDescriptor.rateLimits`) là 1 tín hiệu admission control** (mục 6) — Scheduling Loop **PHẢI** tôn trọng rate limit đã khai, không dispatch vượt quá dù đồ thị có nhiều Task cùng nhắm 1 Tool sẵn sàng chạy song song.

---

## 20. Model Integration

Đã đủ ở `SYSTEM_CONTRACTS_V1.md` mục 10. Điểm bổ sung ở tầng Execution: mỗi lần Model invoke hoàn tất, `Result.metadata` **PHẢI** chứa `costUsd`/`inputTokens`/`outputTokens` nếu Provider biết được — dữ liệu này nuôi trực tiếp mục 25 (Resource Tracking) và mục 27 (Performance Metrics) bên dưới. Đây là **chuẩn bị dữ liệu cho Model Router** (chưa thiết kế) — không phải Model Router tự nó, nhưng nếu thiếu chuẩn hoá field này từ bây giờ, Model Router sau này không có dữ liệu latency/cost thật để chọn provider thông minh.

---

## 21. Failure Recovery

**`FailurePolicy` mỗi node (hoặc mặc định toàn Execution):**
- `"fail_fast"` — 1 Task fail → huỷ toàn bộ Execution (mọi node khác đang chạy nhận cancel).
- `"continue_independent"` (**mặc định**) — chỉ descendant của node fail bị ảnh hưởng (không thể `ready`, cuối cùng đồ thị hội tụ ở `partial_success`); nhánh độc lập tiếp tục bình thường.
- `"best_effort"` — cố hoàn tất càng nhiều node càng tốt dù nhiều nhánh fail, Result cuối luôn `partial_success` trừ khi root Task tự nó fail.

**Vì sao mặc định là `continue_independent`, không phải `fail_fast`:** 1 kế hoạch AI-generated thường có nhiều nhánh độc lập (vd "tạo video" có thể song song "viết kịch bản" + "tìm nhạc nền" + "chọn giọng đọc") — 1 nhánh lỗi (nhạc nền) không có lý do kiến trúc nào để huỷ nhánh khác đã thành công (kịch bản) — `fail_fast` phù hợp hơn cho các Execution có tính giao dịch chặt (transactional), là ngoại lệ cần khai tường minh, không phải mặc định.

---

## 22. Checkpointing

**Quyết định thiết kế cốt lõi, khác Temporal có chủ đích:** checkpoint = lưu **snapshot** định kỳ của `ExecutionContext` + trạng thái đồ thị (node nào `succeeded`/`failed`/`pending`), **KHÔNG** phải lưu toàn bộ event history để replay xác định lại từ đầu.

**Vì sao không theo Temporal:** deterministic replay đòi hỏi code Agent **không được** có bất kỳ thao tác không xác định trực tiếp nào (gọi model AI, đọc đồng hồ hệ thống, gọi API ngoài) — nhưng **bản chất của Agent trong Brain OS chính là gọi model AI liên tục**, thứ vốn dĩ không xác định (cùng prompt, nhiệt độ >0, không chắc ra cùng output; kể cả nhiệt độ=0, API bên ngoài vẫn có thể trả khác theo thời gian). Ép toàn bộ Agent code phải "deterministic-safe" (bọc mọi lời gọi model qua 1 lớp Activity riêng như Temporal yêu cầu) là chi phí kỷ luật rất lớn cho lợi ích không tương xứng ở quy mô hiện tại — Snapshot-checkpoint chấp nhận đánh đổi: có thể mất 1 khoảng tiến độ nhỏ giữa 2 lần checkpoint khi crash, đổi lại đơn giản hơn nhiều để triển khai và suy luận đúng.

**Khi nào checkpoint:**
1. Mỗi khi 1 Task đạt trạng thái terminal (`succeeded`/`failed`/`cancelled`) — đúng lúc "ready set" của đồ thị đổi (mục 2), điểm tự nhiên để chụp lại.
2. Định kỳ theo timer cho 1 Task long-running đơn lẻ (mục 14) — nhưng đây **chỉ checkpoint ở tầng đồ thị** ("Task X vẫn đang chạy"), **KHÔNG** checkpoint trạng thái NỘI BỘ của Task đó — nếu 1 plugin muốn tự phục hồi tốt hơn giữa chừng, đó là trách nhiệm của chính plugin (vd tự lưu tiến độ nội bộ), không phải việc của Execution Model.

---

## 23. Resume Execution

**Resume = chạy lại Scheduling Loop bình thường trên state đã phục hồi — không phải 1 chế độ đặc biệt.** Vì Scheduling Loop (mục 6) chỉ dispatch Task `ready` **và chưa từng dispatch/đã terminal**, load lại checkpoint gần nhất rồi khởi động lại vòng lặp là đủ — đây là hệ quả trực tiếp của mượn tư duy reconcile-không-replay từ Kubernetes Controllers (mục 0): không cần "phát lại lịch sử", chỉ cần "nhìn trạng thái hiện tại, tiếp tục hội tụ về đích".

**Xử lý Task đang `running` lúc crash (chưa có Result khi checkpoint cuối được ghi):** coi là **crashed**, không phải `failed` thật (chưa chắc nó đã thực sự thất bại — có thể vừa hoàn tất ngay trước khi crash, xem điểm yếu #4 ở `SYSTEM_CONTRACTS_V1.md` mục 18 — vấn đề retry+side-effect tái xuất hiện chính xác ở đây). Xử lý: tạo `Job` mới (tính là 1 lần retry, trừ vào `RetryPolicy.maxAttempts`) — **KHÔNG** giả định nó chắc chắn thất bại hoàn toàn, chỉ giả định "không có bằng chứng nó thành công", và giao trách nhiệm idempotency cho plugin (nhất quán với giới hạn đã thừa nhận ở System Contracts, không giả vờ giải quyết ở đây).

---

## 24. Observability, Execution History & Audit Trail — 1 nguồn dữ liệu, 3 cách truy vấn (gộp trình bày sau `ARCHITECTURE_AUDIT_V1.md` mục 3.4)

**Đánh số riêng 3 mục (24/28/29 ở bản gốc) tạo ảo giác 3 hệ thống cần xây riêng, dù nội dung luôn khẳng định ngược lại** — audit chỉ đúng điểm này: cách trình bày (structure) mâu thuẫn với nội dung (content). Gộp lại ở đây thành 1 mục duy nhất, mục 28/29 dưới chỉ còn là con trỏ ngắn.

Mọi Task/Job/Result/Event mang `TraceContext` (`SYSTEM_CONTRACTS_V1.md` mục 1) với `correlationId = executionId` — **không có 3 hệ lưu trữ song song, chỉ có 1 nguồn dữ liệu (Task/Job/Result/Event) và 3 cách hỏi nó:**

| Nhu cầu | Cách truy vấn | Dùng khi |
|---|---|---|
| **Observability** | Lọc theo `correlationId = executionId`, thời gian thực | Execution **đang chạy** — theo dõi tiến độ trực tiếp |
| **Execution History** | Lọc theo `executionId`, không giới hạn thời gian | Execution **đã xong từ lâu** — "hôm qua đã chạy gì" |
| **Audit Trail** | Lọc theo `IdentityRef`/`causationId`, xuyên nhiều Execution | Câu hỏi bảo mật/tuân thủ — "ai làm gì, được cấp quyền gì, lúc nào" |

Không mục nào cần bảng/pipeline lưu trữ riêng — tạo bảng "audit log" tách khỏi Task/Event thật sẽ tái tạo đúng lỗi "nhiều nguồn sự thật cho cùng 1 sự kiện" mà `ARCHITECTURE_RULES_V1.md` Điều 16.14 cấm (`KnowledgeRelation` cạnh Knowledge đã là 1 ví dụ ranh giới cần cẩn thận, xem `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 6). Đây chính là "audit là thuộc tính của Event Bus" đã lập ở `KERNEL_ARCHITECTURE_V1.md` mục 13, áp dụng đủ cho cả 3 nhu cầu.

---

## 25. Resource Tracking (Cost + Token) — gộp mục 25/26 cũ, 1 cơ chế duy nhất

**Hợp nhất theo `ARCHITECTURE_AUDIT_V1.md` mục 3.5:** Token là 1 trường hợp riêng của Cost (cho Model invocation) — 1 cơ chế tổng hợp, không phải 2. `Result.metadata.costUsd`/`inputTokens`/`outputTokens` (nếu plugin biết) → cộng dồn vào `ExecutionContext.accumulatedCostUsd`/`accumulatedTokens` mỗi khi 1 Task `succeeded`/`partial_success` — đọc bởi admission control (mục 6) để chặn dispatch tiếp nếu vượt `budget.maxCostUsd`.

**Chi phí là ước tính tại thời điểm dispatch, xác nhận tại thời điểm hoàn tất** — 2 con số này **có thể lệch nhau** (Model trả giá thật sau khi chạy xong, không phải trước) — admission control dùng `costEstimate` tĩnh (Descriptor, `SYSTEM_CONTRACTS_V1.md` mục 9-10) làm ước tính TRƯỚC, `Result.metadata.costUsd` là số liệu THẬT SAU — không trộn lẫn 2 nguồn này.

**Race condition đã vá (`ARCHITECTURE_AUDIT_V1.md` mục 1 phát hiện #3, mục 6.3):** mục 7 (Parallel Execution) cho phép nhiều Task cùng Execution hoàn tất đồng thời — read-modify-write ngây thơ trên `accumulatedCostUsd` (đọc giá trị hiện tại, cộng thêm, ghi lại) **SẼ** mất update dưới concurrency, khiến ngân sách bị đếm thiếu âm thầm — đúng chỗ dùng để ENFORCE ngân sách. **Cập nhật `accumulatedCostUsd`/`accumulatedTokens` BẮT BUỘC là 1 phép toán nguyên tử ở tầng lưu trữ** (vd `UPDATE execution_context SET accumulated_cost = accumulated_cost + $1 WHERE id = $2`, không phải đọc-tính-ghi 3 bước riêng ở tầng ứng dụng) — đây là ràng buộc bắt buộc của Core Service triển khai `ExecutionContext`, không phải gợi ý.

---

## 27. Performance Metrics

Dẫn xuất, không phải thiết kế mới: `Job.startedAt`/`finishedAt` (thời lượng) + `Result.metadata` (cost/token) tổng hợp theo `(pluginId, Task.operation)` thành thống kê phân vị (p50/p95 latency, cost trung bình). **Đây chính là dữ liệu Model Router (chưa thiết kế) sẽ cần** để chọn provider theo policy giá/tốc độ — tài liệu này **KHÔNG** thiết kế thuật toán chọn, chỉ đảm bảo dữ liệu đầu vào cho thuật toán đó tồn tại và có hình dạng chuẩn ngay từ Task/Result đầu tiên chạy thật.

---

## 28. Execution History

Xem mục 24 — hàng "Execution History" trong bảng. Không có nội dung riêng ngoài mục 24.

---

## 29. Audit Trail

Xem mục 24 — hàng "Audit Trail" trong bảng. Không có nội dung riêng ngoài mục 24.

---

## 30. Learning Loop

**Chạy bất đồng bộ SAU khi Result đã trả cho user** (mục 1) — không chặn độ trễ trả lời. Về bản chất, Learning Loop **là 1 Execution khác** (nhỏ, chạy nền, mục 15) dùng đúng cơ chế đã thiết kế ở toàn bộ tài liệu này — không phải subsystem riêng.

**Chặn đệ quy vô hạn (vá `ARCHITECTURE_AUDIT_V1.md` mục 1 phát hiện #5):** nếu Learning Loop là 1 Execution, và mọi Execution phải qua Planning Phase (mục 5, gọi `ctx.memory`/`ctx.knowledge`), Learning Loop của chính nó có thể kích hoạt Learning Loop tiếp theo sau khi hoàn tất — đệ quy không có điểm dừng. **Quy tắc bắt buộc:** `ExecutionContext` của 1 Learning Loop **PHẢI** đánh dấu `metadata.isLearningLoop: true`; Planning Phase (mục 5) **PHẢI** kiểm tra cờ này trước khi tạo Task `operation:"learning.run"` cho Result vừa hội tụ — nếu `ExecutionContext` vừa hoàn tất đã có `isLearningLoop: true`, **KHÔNG** tạo Learning Loop cho nó (base case, dừng đệ quy tại độ sâu 1). Learning Loop **KHÔNG** cần Planning Phase đầy đủ (không cần lại hỏi Memory/Knowledge để "lên kế hoạch học" — nó chỉ thực thi 4 bước cố định liệt kê dưới đây) — miễn tuân thủ base case trên, không cần cơ chế chặn đệ quy phức tạp hơn.

**Learning Loop PHẢI làm:**
1. Đẩy sự kiện/dữ kiện thế giới mới phát hiện được (nếu có, vd từ mục 17) vào Knowledge Service.
2. Đẩy sở thích/thông tin cá nhân quan sát được (nếu có) vào Memory Service.
3. Cập nhật Performance Metrics (mục 27) từ dữ liệu Execution vừa hoàn tất.
4. Ghi vào Execution History (mục 28) — bản thân bước này không "học" gì, chỉ lưu trữ, nhưng là tiền đề cho các bước học sau này đọc lại.

**Learning Loop KHÔNG làm** (giới hạn phạm vi tường minh, tránh diễn giải sai "học" thành 1 thứ nặng hơn nó thực sự là ở Phase 1): **KHÔNG** fine-tune/huấn luyện lại trọng số bất kỳ model AI nào — đó là bài toán MLOps hoàn toàn khác, nặng hơn nhiều bậc, ngoài phạm vi Execution Model. "Học" ở đây nghĩa là **"hệ thống định tuyến/ước tính/gợi nhớ tốt hơn theo thời gian"** (nhờ Metrics tốt hơn, Knowledge nhiều hơn, Memory chính xác hơn) — không phải "trí tuệ nhân tạo bên trong thông minh hơn". Diễn giải "Learning" thành huấn luyện lại model sẽ kéo theo hạ tầng ML-ops không tương xứng quy mô hiện tại, đúng loại rủi ro "xây hạ tầng cho quy mô chưa tồn tại" đã cảnh báo xuyên suốt cả 4 tài liệu trước.

---

## 31. So sánh với 6 hệ tham chiếu — vì sao thiết kế này hợp Brain OS hơn

| Hệ | Điều đã mượn | Vì sao KHÔNG copy nguyên khối |
|---|---|---|
| **Linux Scheduler** | Priority + fairness (mục 6) | Không có run-queue vật lý/CPU-time thật để lập lịch — "công bằng" ở đây là công bằng giữa Execution, không giữa tiến trình OS |
| **Ray** | Đồ thị **động**, Task có thể tự spawn Task khác lúc runtime (mục 1, 3) — điểm mượn quan trọng nhất | Không dùng runtime phân tán/object store (Plasma) của Ray — quá nặng cho 1 VPS; chỉ mượn **mẫu hình**, tự triển khai trên Postgres + Event Bus đơn tiến trình |
| **Temporal** | Khái niệm cần "durable execution" cho việc chạy dài/crash-resilient (mục 22-23) | **Từ chối** deterministic replay — code Agent gọi model AI vốn không xác định, ép "an toàn để replay" tốn kỷ luật không tương xứng; chọn checkpoint-snapshot đơn giản hơn, chấp nhận mất tiến độ nhỏ giữa 2 checkpoint |
| **LangGraph** | **Người anh em gần nhất về khái niệm** — graph node, checkpointer, interrupt cho human-in-loop (mục 12, 22) | LangGraph định phạm vi cho 1 tiến trình orchestrate 1 agent nội bộ; Brain OS cần điều phối **hàng trăm plugin khác vendor/loại** qua Identity/Permission/Registry chung — về cơ bản là "tổng quát hoá pattern của LangGraph ra quy mô toàn hệ điều hành plugin", không chỉ 1 quy trình reasoning |
| **ROS** | Mẫu Goal/Feedback/Result/Cancel của ROS Actions **hội tụ độc lập** với `Task/Progress/Result/cancel()` đã thiết kế ở `SYSTEM_CONTRACTS_V1.md` — xác nhận chéo, không phải trùng hợp | ROS không có Planning (không suy luận ý định), không có khái niệm chi phí AI/token, phạm vi là middleware robot, không phải điều phối AI đa miền |
| **Kubernetes Controllers** | Reconcile-không-replay (mục 6, 23) — vòng lặp level-triggered, tự resync định kỳ, không tin tưởng tuyệt đối vào event | K8s controller quản lý **trạng thái ổn định vô hạn kỳ** (giữ đúng 3 replica mãi mãi); Execution của Brain OS có **điểm kết thúc rõ ràng** (đồ thị hội tụ) — khác bản chất bài toán ở tầng cao nhất, dù sub-pattern reconcile vẫn dùng được |

**Kết luận so sánh:** không hệ nào trong 6 hệ giải quyết đồng thời cả 4 ràng buộc ở mục 0 — thiết kế này là **tổng hợp có chủ đích** các mẫu hình đã được chứng minh ở từng hệ, không phải phát minh từ số 0 và cũng không phải copy 1 hệ có sẵn.

---

## 32. Giới hạn đã biết của chính thiết kế này

**#1 — Checkpoint-snapshot mất tiến độ giữa 2 lần checkpoint khi crash** (đã nêu ở mục 22) — đánh đổi có chủ đích, không phải sơ suất, nhưng cần nhắc lại ở đây: nếu tần suất crash cao hơn dự tính (hạ tầng hiện tại chưa có supervisor, theo `NEXT.md`), phần "tiến độ mất" có thể lớn hơn chấp nhận được — ngưỡng cụ thể cần đo bằng dữ liệu thật, không đoán trước.

**#2 — Fairness giữa Execution chưa định nghĩa thuật toán cụ thể** (mục 6 chỉ nêu nguyên tắc "không độc chiếm", chưa chọn round-robin hay weighted-fair-queueing hay cơ chế khác) — để lại cho lúc triển khai Scheduling Loop thật, vì cần dữ liệu tải thật (bao nhiêu Execution đồng thời trong thực tế) mới chọn đúng.

**#3 — Đồ thị lớn dần không giới hạn về mặt lý thuyết** — 1 Agent lỗi logic có thể tự spawn Task con vô hạn (loop vô tận trong "reason → chưa xong → spawn thêm" ở mục 3). Cần 1 giới hạn cứng (vd max node/Execution, max độ sâu đệ quy spawn) — **chưa định nghĩa con số cụ thể ở tài liệu này**, chỉ ghi nhận đây là lỗ hổng cần vá trước khi Agent Router thật được xây (nếu không, budget mục 25 là lưới an toàn cuối cùng nhưng không phải lưới duy nhất nên có).

**#4 — Cross-execution dependency bị cấm (mục 8) có thể quá cứng nhắc** cho 1 số use case thật sau này (vd 1 Workflow định kỳ cần chờ kết quả Execution khác chưa xong) — quyết định giữ đơn giản ở Phase 1, chấp nhận có thể phải nới lỏng khi có nhu cầu thật cụ thể, không nới trước khi cần (nhất quán nguyên tắc "không xây cho quy mô chưa tồn tại" xuyên suốt cả 5 tài liệu).

---

## 33. Kết — tài liệu này mở khoá gì

Trước tài liệu này, Agent/Model/Tool Router không có nơi thống nhất để biết: Task của chúng tới từ đâu (Scheduling Loop, mục 6), khi nào chúng được phép chạy (readiness + admission, mục 2/6), phải báo cáo tiến độ/chi phí ra sao (mục 6/13/25/26), và điều gì xảy ra khi chúng thất bại/cần huỷ/hệ thống crash (mục 9/10/21/22/23). Đây chính xác là lý do câu hỏi gốc nêu ra: *"chúng ta vẫn chưa biết công việc thực sự di chuyển qua hệ thống như thế nào"* — giờ đã có 1 câu trả lời cụ thể, đủ chi tiết để thiết kế Router tiếp theo mà không phải đoán.

*Tài liệu thuần kiến trúc — không có code, migration, hay thay đổi nào lên project trong quá trình viết tài liệu này.*
