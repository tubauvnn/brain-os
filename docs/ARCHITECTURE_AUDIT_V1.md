# Brain OS — Architecture Audit V1

**Vai trò:** Chief Architect mới, không có nghĩa vụ bảo vệ 6 tài liệu trước. Nhiệm vụ là **phá**, không phải cải thiện. Không code.
**Ngày:** 2026-07-09 · **Phạm vi:** `ARCHITECTURE_REVIEW_V1.md`, `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md`, `KERNEL_ARCHITECTURE_V1.md`, `ARCHITECTURE_RULES_V1.md`, `SYSTEM_CONTRACTS_V1.md`, `EXECUTION_MODEL_V1.md`.

**Phương pháp:** không đọc lại phần "tóm tắt" của từng tài liệu và gật đầu — tự suy luận lại từng tuyên bố cốt lõi, đối chiếu chéo giữa 6 tài liệu, tìm điểm 2 tài liệu ngầm giả định 2 điều khác nhau. Phần lớn phát hiện dưới đây là mâu thuẫn hoặc lỗ hổng **thật**, không phải phê bình hình thức.

---

## 1. Tóm tắt điều hành — 6 phát hiện nghiêm trọng nhất

1. **"Automation" — 1 trong 8 domain mục tiêu gốc — có thể KHÔNG khớp được với Execution Model.** Toàn bộ `EXECUTION_MODEL_V1.md` dựng quanh hình dạng "Intent rời rạc → Plan → hội tụ → Result" — nhưng Automation đúng nghĩa (vd "hễ có Knowledge mới về đối thủ thì báo") là **luồng phản ứng liên tục, không có điểm bắt đầu do user hỏi, không có điểm "hội tụ" theo nghĩa đã định nghĩa**. Chưa tài liệu nào kiểm chứng Automation có thực sự chạy được qua Execution Model hay cần 1 hình dạng thực thi khác hẳn (subscriber luôn bật, không phải graph có đầu có cuối).
2. **2 thiết kế database KHÔNG TƯƠNG THÍCH cho cùng 1 khái niệm, chưa từng đối chiếu.** `ARCHITECTURE_REVIEW_V1.md` mục 7 đề xuất bảng `Agent`/`AgentRun` (field `slug`, `agent_id`, `model_slug`...). `SYSTEM_CONTRACTS_V1.md` mục 8-9 định nghĩa `PluginDescriptor`/`Job` (field `id`, `kind`, `contractVersion`...) cho **đúng cùng nhu cầu** — đăng ký Agent + theo dõi 1 lần chạy. 2 hình dạng khác nhau, viết cách nhau 4 tài liệu, không tài liệu nào nói "cái sau thay cái trước".
3. **Race condition thật trong cơ chế enforce budget.** `ExecutionContext.accumulatedCostUsd` (`EXECUTION_MODEL_V1.md` mục 4/25) là 1 field cộng dồn, được **nhiều Task chạy song song** (mục 7 cho phép tường minh) cùng cập nhật. Không tài liệu nào chỉ ra cơ chế đồng bộ hoá — read-modify-write ngây thơ dưới concurrency **sẽ** mất update, khiến budget ceiling — chính cơ chế được thiết kế để CHẶN chi tiêu vượt mức — âm thầm sai mà không ai phát hiện.
4. **Hiến pháp (`ARCHITECTURE_RULES_V1.md`) hiện đang ở đúng trạng thái nó được viết ra để ngăn chặn.** Mọi quy tắc MUST đều dựa vào "công cụ enforce" (lint import-boundary) được nhắc tới **4 lần** xuyên suốt các tài liệu nhưng **chưa từng được thiết kế cụ thể** — công cụ nào, chạy ở đâu, ai sở hữu. Hôm nay, mọi quy tắc MUST của Hiến pháp là honor-system 100%, y hệt tình trạng `access_level` không được enforce mà toàn bộ chuỗi tài liệu này viết ra để sửa.
5. **Learning Loop tự tham chiếu có nguy cơ đệ quy vô hạn chưa được xử lý.** `EXECUTION_MODEL_V1.md` mục 30 nói "Learning Loop tự nó là 1 Execution khác". Nhưng mọi Execution phải qua Planning Phase (mục 5), và Planning Phase gọi `ctx.memory`/`ctx.knowledge` — nếu Learning Loop cũng là Execution, nó cũng phải Planning, cũng có thể sinh ra Learning Loop của chính nó sau khi hoàn tất. Không có "trường hợp dừng" (base case) nào được định nghĩa.
6. **Khuyến nghị `tenant_id` (`KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 14) bị rơi mất khi thiết kế `IdentityRef`.** Tài liệu Knowledge nói rõ "thêm `tenant_id` nullable NGAY TỪ PHASE 1 vì rẻ bây giờ, đắt sau". `IdentityRef` (`KERNEL_ARCHITECTURE_V1.md` mục 4, dùng lại nguyên trong 3 tài liệu sau) **không có field nào tương đương** — chính khuyến nghị "làm rẻ ngay từ đầu" đã bị bỏ quên ngay ở tài liệu kế tiếp.

---

## 1.5 Trạng thái xử lý (bổ sung 2026-07-09, sau khi CTO triage) — CHỈ vá lỗi bắt buộc trước implementation, không vá toàn bộ

Vai trò đổi từ "phá" sang "xây theo giai đoạn" (xem `docs/IMPLEMENTATION_ROADMAP_V1.md`). Không phải mọi phát hiện dưới đây đáng sửa ngay — CTO triage theo tiêu chí: **có gây rework thật nếu để nguyên lúc bắt đầu code không?** Ký hiệu: ✅ ĐÃ VÁ (sửa tài liệu) · 🟡 CHẤP NHẬN (cân nhắc, giữ nguyên có lý do) · 🔵 HOÃN (đúng, nhưng không chặn implementation, đưa vào roadmap) · ⚪ KHÔNG ÁP DỤNG (nhận xét/so sánh, không phải lỗi cần sửa).

| Mục audit | Trạng thái | Sửa ở đâu |
|---|---|---|
| 1 (#1 Automation) | 🔵 HOÃN có chủ đích | `EXECUTION_MODEL_V1.md` mục 0.5 — phạm vi không phủ, ghi rõ thay vì giả vờ đã phủ |
| 1 (#2 Agent/AgentRun vs PluginDescriptor/Job) | ✅ | `ARCHITECTURE_REVIEW_V1.md` banner đầu file — mục 7 cũ đánh dấu thay thế |
| 1 (#3 race condition cost) | ✅ | `EXECUTION_MODEL_V1.md` mục 25 — bắt buộc cập nhật nguyên tử |
| 1 (#4 hiến pháp không tooling) | 🔵 HOÃN, đưa vào roadmap | `docs/IMPLEMENTATION_ROADMAP_V1.md` — lint import-boundary là 1 deliverable cụ thể, không chỉ nhắc tên |
| 1 (#5 Learning Loop đệ quy) | ✅ | `EXECUTION_MODEL_V1.md` mục 30 — cờ `isLearningLoop` chặn base case |
| 1 (#6 tenantId) | ✅ | `KERNEL_ARCHITECTURE_V1.md` mục 4 — thêm field nullable |
| 2.1, 2.2 (Core cũ/roadmap cũ chưa đánh dấu lỗi thời) | ✅ | `ARCHITECTURE_REVIEW_V1.md` banner đầu file |
| 2.3 (Scheduler trùng tên) | ✅ | `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 8 — làm rõ Scheduler = tạo Task, Scheduling Loop = điều phối |
| 2.4 (Router chưa phân loại) | ✅ | `ARCHITECTURE_RULES_V1.md` Điều 3.3 — Router = Core Service, không phạm trù riêng |
| 2.5 (RobotState trạng thái mơ hồ) | ✅ | Theo dõi tường minh ở `docs/IMPLEMENTATION_ROADMAP_V1.md`, không còn lơ lửng |
| 3.1 (Manifest vs Descriptor) | ✅ | `KERNEL_ARCHITECTURE_V1.md` mục 4 — quan hệ tường minh |
| 3.2 (`kind` trùng trục) | ✅ | `SYSTEM_CONTRACTS_V1.md` mục 2 — đổi `Task.kind` → `Task.operation` |
| 3.3 (Confidence chưa đối chiếu) | 🟡 CHẤP NHẬN, không gộp | Model AI confidence / Agent decision confidence / Knowledge confidence **cố ý để riêng** — đối tượng đo khác nhau đủ xa (điểm số nội bộ 1 lần suy luận vs điểm chất lượng dữ liệu lưu trữ) để không đáng ép chung 1 primitive; khác `ErrorObject`/`Progress` (cùng đối tượng: mọi Task/Job) |
| 3.4, 3.5 (đánh số tạo ảo giác tách rời) | ✅ | `EXECUTION_MODEL_V1.md` mục 24 (gộp 24/28/29), mục 25 (gộp 25/26) |
| 4.1 (Task/Job tách sớm) | 🟡 CHẤP NHẬN | Giữ nguyên hợp đồng — rẻ để giữ dù chưa dùng hết, đắt hơn để bỏ rồi thêm lại sau; `docs/IMPLEMENTATION_ROADMAP_V1.md` cho phép triển khai Phase 1 collapse Job:Task = 1:1 trong thực thi, không phá hợp đồng |
| 4.2 (ExecutionContext có cần không) | 🟡 CHẤP NHẬN | Giữ nguyên; roadmap cho phép Phase 1 lưu field của nó trực tiếp trên Job thay vì bảng riêng — hợp đồng không đổi, triển khai đơn giản hơn |
| 4.3 (KnowledgeRelation đầu cơ) | ✅ | `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 6 — hoãn khỏi V1 tường minh |
| 4.4 (Config/Secrets ranh giới mảnh) | 🟡 CHẤP NHẬN, có bảo vệ | `KERNEL_ARCHITECTURE_V1.md` mục 3 — thêm lý do hẹp (cơ chế cô lập, không phải "config quan trọng") |
| 5.1 (pgvector hardcode) | ✅ | `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 6 — gắn nhãn "triển khai tham chiếu" |
| 5.2 (Identity minting) | ✅ | `KERNEL_ARCHITECTURE_V1.md` mục 4 — root-of-trust |
| 5.3 (mẫu reconcile thiếu trong Hiến pháp) | ✅ | `ARCHITECTURE_RULES_V1.md` Điều 6.4 |
| 5.4 (metadata không enforce) | 🟡 CHẤP NHẬN | Rủi ro thật nhưng nhỏ, cùng loại với 1(#4) — theo dõi chung, không cần fix riêng |
| 6.1, 6.2, 6.3 (rủi ro quy mô) | 🔵 HOÃN đúng nghĩa | Không chặn Phase 1 (quy mô nhỏ) — đưa vào Risks của `docs/IMPLEMENTATION_ROADMAP_V1.md` để không quên khi scale thật |
| 7.1 (`quorum:N` string) | ✅ | `SYSTEM_CONTRACTS_V1.md` mục 2 — kiểu object |
| 7.2 (naming convention 1/4) | ✅ (quy ước) / 🔵 (tooling) | `SYSTEM_CONTRACTS_V1.md` mục 0.4 — quy ước hợp nhất; công cụ validate vẫn ở roadmap |
| 7.3 (Descriptor tĩnh sẽ đổi) | 🟡 CHẤP NHẬN | Đúng, nhưng đúng là rủi ro TƯƠNG LAI — không sửa trước khi có vendor thật để quan sát pattern đổi |
| 8.1 (tỷ lệ design/implementation) | ⚪ Giải quyết bằng hành động, không phải sửa văn bản | Chính là lý do lệnh CTO này được ban hành — dừng viết tài liệu, bắt đầu `docs/IMPLEMENTATION_ROADMAP_V1.md` |
| 8.2 (Human Approval nặng) | 🟡 CHẤP NHẬN | Không có hành động tự chủ rủi ro cao nào ở Phase 1 — chưa cấp bách, để nguyên thiết kế, revisit nếu thấy cấn khi implement thật |
| 9.1 (thiếu Session) | ✅ | `SYSTEM_CONTRACTS_V1.md` mục 15.5 |
| 9.2 (thiếu Notification) | ✅ (giải quyết KHÔNG thêm khái niệm) | `SYSTEM_CONTRACTS_V1.md` mục 11 — quy ước "1 Tool capability" |
| 9.3 (deprecation window) | ✅ | `ARCHITECTURE_RULES_V1.md` Điều 7.4.1 — 30 ngày/hết phụ thuộc |
| 9.4 (config operator) | 🔵 HOÃN | Phase 1 dùng env var/DB row trực tiếp, chưa cần UI — ghi trong roadmap |
| 10.1 (gộp Workflow vào Agent) | ✅ | `SYSTEM_CONTRACTS_V1.md` mục 9/13 |
| 10.2, 10.3 (gộp trình bày) | ✅ | Trùng 3.4/3.5 ở trên |
| 11.1 (xoá grantedPermissions) | ✅ | `EXECUTION_MODEL_V1.md` mục 4 |
| 11.2 (xoá costEstimate tĩnh) | 🟡 CHẤP NHẬN, không xoá | Cần cho cold-start (Agent mới, chưa có Performance Metrics thật) — giữ, đã ghi rõ đây là ước tính tạm không phải nguồn sự thật thứ 2 |
| 12.1 (chi phí = chi phí AI) | ✅ | `SYSTEM_CONTRACTS_V1.md` mục 11 — `ToolDescriptor.pricing` |
| 12.2 (Agent luôn hỏi-đáp rời rạc) | 🔵 Trùng 1(#1) | Xem `EXECUTION_MODEL_V1.md` mục 0.5 |
| 12.3 (checkpoint-snapshot đánh đổi) | 🟡 CHẤP NHẬN | Đánh đổi đã ghi rõ từ đầu (`EXECUTION_MODEL_V1.md` mục 22), audit xác nhận đã trình bày trung thực — không đổi quyết định |
| 13.1 (Human Approval elegant nhưng...) | 🟡 Trùng 8.2 | Giữ nguyên |
| 13.2 (kind tự do) | ✅ (quy ước) / 🔵 (tooling) | Trùng 7.2 |
| 13.3 (Learning Loop đệ quy) | ✅ | Trùng 1(#5) |
| 14 (so sánh 6 hệ) | ⚪ | Phân tích, không phải lỗi — giữ nguyên làm tài liệu tham chiếu |

---

## 2. Mâu thuẫn (Contradictions)

**2.1 — "Core" cũ chưa từng bị đánh dấu lỗi thời trong chính tài liệu chứa nó.** `KERNEL_ARCHITECTURE_V1.md` mục 1 tự phê bình `ARCHITECTURE_REVIEW_V1.md` mục 5 ("Core" gộp Router+Memory+Event Bus+Scheduler+Permission là sai) — nhưng đây là con trỏ **1 chiều**. `ARCHITECTURE_REVIEW_V1.md` vẫn đứng nguyên với roadmap Phase 1-5 riêng của nó, không có dòng nào trỏ ngược "mục này đã bị thay thế, xem Kernel doc". 1 người đọc tuần tự (rất có khả năng xảy ra thật) sẽ nhận đúng kiến trúc đã bị bác bỏ làm sự thật, rồi mới phát hiện mâu thuẫn 3 tài liệu sau.

**2.2 — Roadmap Phase 1-5 của `ARCHITECTURE_REVIEW_V1.md` giờ sai về khối lượng công việc.** Phase 2 ("Agent Router MVP... registry code-only") được viết **trước khi** `EXECUTION_MODEL_V1.md` tồn tại — không tính tới Scheduling Loop, ExecutionContext, checkpoint/resume là điều kiện cần để Agent Router chạy có ý nghĩa (không chỉ đăng ký, mà chạy được, phục hồi được sau crash). Roadmap đó hiện đang đánh giá thấp Phase 2 một cách có hệ thống, không ai cập nhật lại.

**2.3 — "Scheduler" bị dùng để chỉ 2 thứ khác quy mô, không tài liệu nào phân biệt.** `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 8 định nghĩa Scheduler = "kích hoạt Collector theo cron", 1 Core Service nhỏ, thay được dễ dàng (đúng như `KERNEL_ARCHITECTURE_V1.md` mục 3 xếp loại). `EXECUTION_MODEL_V1.md` mục 6 dùng "Scheduling Loop" để chỉ **toàn bộ engine dispatch/admission/readiness cho MỌI Task trong hệ thống** — quy mô và vai trò trung tâm hoàn toàn khác. Đây là **cùng 1 process, hay 2 thứ khác nhau trùng tên**? Không tài liệu nào trả lời — nếu là cùng 1 thứ, nó không còn "nhỏ, thay dễ" như Kernel doc phân loại; nếu là 2 thứ khác nhau, tên trùng sẽ gây nhầm lẫn thật khi implement.

**2.4 — "Router" có phải "Core Service" không, câu trả lời khác nhau tuỳ tài liệu.** `KERNEL_ARCHITECTURE_V1.md` mục 5 gộp "Routers & Domain Core Services" vào **1 tầng** (L4), ngụ ý Router = 1 loại Core Service. `ARCHITECTURE_RULES_V1.md` Điều 3.3 chỉ nói "Core Service phải đăng ký qua Registry" mà không nhắc "Router" lần nào trong toàn bộ Điều 3 (quyết định Plugin/Core/Kernel) — Router hoàn toàn vắng mặt khỏi khung phân loại 3-nhóm của chính Hiến pháp. Router thuộc nhóm nào theo đúng quy trình quyết định ở Điều 3.1-3.5? Chưa ai áp dụng bài kiểm tra đó cho chính Router.

**2.5 — `RobotState` được 2 tài liệu ra 2 phán quyết khác nhau về mức độ khẩn cấp.** `ARCHITECTURE_REVIEW_V1.md` mục 14 xếp "tổng quát hoá RobotState → DeviceState" vào nhóm **"REFACTOR SỚM"**. `ARCHITECTURE_RULES_V1.md` Điều 9.3 nhắc lại đúng ví dụ này nhưng không gắn mức độ khẩn cấp nào — chỉ nói "không được lặp lại". Không tài liệu nào xác nhận việc này đã/chưa làm, hay còn nằm trong backlog — sau 5 tài liệu, trạng thái thật của chính vấn đề gốc (điều khiến toàn bộ chuỗi audit này bắt đầu) chưa từng được cập nhật.

---

## 3. Khái niệm bị trùng lặp (Duplicated Concepts)

**3.1 — `PluginManifest` (`KERNEL_ARCHITECTURE_V1.md` mục 7) và `PluginDescriptor` (`SYSTEM_CONTRACTS_V1.md` mục 8)** — cùng field cốt lõi (`id/kind/version/capabilities/dependencies`), 2 tên khác nhau, quan hệ giữa chúng (input tác giả khai vs bản ghi đã làm giàu lúc runtime với `status`/`healthStatus`) **có thể** là chủ đích nhưng **chưa từng được nói ra tường minh** — đọc như trôi dạt đặt tên, không như quyết định thiết kế.

**3.2 — `kind` là tên field dùng cho 2 trục hoàn toàn khác nhau.** `PluginDescriptor.kind` = loại plugin ("agent"/"model"/"tool"...). `Task.kind` = loại hành động ("agent.run"/"tool.execute"...). Cùng tên field, 2 hệ giá trị khác nhau, xuất hiện trong 2 contract liền kề nhau trong cùng 1 tài liệu (`SYSTEM_CONTRACTS_V1.md` mục 2 và mục 8) — nguy cơ nhầm lẫn thật khi code (`Task.kind === "agent"` sai nhưng trông hợp lý).

**3.3 — "Confidence" được định nghĩa độc lập, không đối chiếu với các trục "độ tin cậy" khác đã ngầm tồn tại.** `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` định nghĩa `confidence_score` cho Knowledge. Không tài liệu nào hỏi: model AI cũng có "độ tự tin" khi trả lời, Agent cũng có thể có "độ chắc chắn" khi ra quyết định — đây có phải cùng 1 khái niệm dùng ở 3 nơi, hay 3 khái niệm khác nhau cùng tên? Không giống `ErrorObject`/`Progress` (đã được rút thành primitive dùng chung ở `SYSTEM_CONTRACTS_V1.md` mục 1), "confidence" chưa từng được xét có nên rút chung hay không — bỏ sót, không phải quyết định.

**3.4 — Execution History (mục 28) / Audit Trail (mục 29) / Observability (mục 24) trình bày như 3 mục đánh số riêng trong `EXECUTION_MODEL_V1.md`, dù nội dung tự nói "đây là 3 CÁCH TRUY VẤN trên CÙNG 1 dữ liệu, không phải 3 hệ thống".** Việc đánh số riêng (theo đúng thứ tự yêu cầu gốc) tạo ảo giác 3 thứ cần thiết kế/xây riêng biệt, dù văn bản bên trong nói ngược lại — rủi ro thật: người đọc lướt tiêu đề (rất phổ biến với tài liệu dài) sẽ mang theo đúng nhận thức sai mà nội dung cố tránh.

**3.5 — Cost Tracking (mục 25) / Token Tracking (mục 26)** cùng vấn đề như 3.4 — mục 26 tự nhận "chỉ là trường hợp riêng của mục 25" nhưng vẫn được cấp 1 mục ngang hàng.

---

## 4. Trừu tượng hoá không cần thiết (Unnecessary Abstractions)

**4.1 — Tách `Task`/`Job` ngay từ ngày 0, trước khi có 1 Task thật nào từng chạy.** Lý do tách (Task = yêu cầu bất biến, Job = 1 lần thử) hợp lý **ở quy mô có retry thật xảy ra thường xuyên** — hệ thống hiện tại có đúng 1 "Agent" chạy thật (`local-skills.ts` của `/robot`), retry gần như chưa từng xảy ra trong thực tế. Đưa 2 khái niệm thay vì 1 trước khi có bằng chứng cần — đúng dạng phức tạp hoá sớm mà **chính 5 tài liệu này liên tục cảnh báo cho các subsystem khác** (Event Bus transport, vector store...) nhưng lại không tự áp dụng cho chính thiết kế Task/Job của mình.

**4.2 — `ExecutionContext` có thực sự là 1 khái niệm mới, hay chỉ là "Task gốc + vài field cộng dồn"?** Xét kỹ field của nó: `executionId` (=id Task gốc), `trace`/`requestedBy` (đã có sẵn trên mọi Task), phần thực sự mới chỉ là `budget`/`accumulatedCostUsd`/`graph`/`checkpointRef`. Có thể đã đủ nếu đặt các field này trực tiếp lên `Job` của Task gốc, không cần 1 danh từ cấp cao mới. Chưa có bằng chứng thử phương án tối giản hơn trước khi quyết định cần 1 object riêng.

**4.3 — `KnowledgeRelation` (bảng quan hệ Knowledge-tới-Knowledge với `relation_type` enum) được thiết kế trước khi có 1 bản ghi Knowledge thật nào tồn tại.** Đây là schema đầu cơ cho 1 tính năng (tìm Knowledge liên quan) chưa có dữ liệu để kiểm chứng nhu cầu thật — YAGNI cổ điển, dù bản thân `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 13 cảnh báo đúng nguyên tắc này cho các phần khác (đừng thêm vector search khi chưa cần).

**4.4 — Config/Secrets có thực sự là 1 kernel PRIMITIVE, hay chỉ là quy ước phân phối biến môi trường?** So với 5 primitive còn lại (Identity/Registry/Event Bus/Permission Gate/Lifecycle Manager — mỗi cái có hành vi/hợp đồng riêng biệt rõ ràng), Config/Secrets gần với "cách Infrastructure (L1) phân phối env var an toàn" hơn là 1 khái niệm kernel-level độc lập. Ranh giới "nó cần lúc boot nên là kernel" cũng đúng cho kết nối Database (đã xếp ở Infrastructure, không phải Kernel) — tiêu chí phân loại cho 2 trường hợp này không nhất quán.

---

## 5. Coupling ẩn (Hidden Coupling)

**5.1 — `Unsupported("vector(1536)")` trong schema minh hoạ của `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 6 hardcode cú pháp Prisma-riêng-cho-Postgres+pgvector** ngay trong 1 hợp đồng được cho là ABI-agnostic. `KERNEL_ARCHITECTURE_V1.md` mục 3 khẳng định "Kernel phụ thuộc khái niệm lưu trữ bền, không phụ thuộc Postgres cụ thể" — nhưng 1 tài liệu khác trong cùng bộ đã cắm cứng chi tiết triển khai Postgres vào đúng chỗ tuyên bố database-agnostic. Nếu "đổi database" từng được test thật, đây chính xác là chỗ sẽ vỡ trước tiên.

**5.2 — Vòng đời tạo mới 1 `IdentityRef` chưa từng được thiết kế.** Mọi tài liệu **giả định** `IdentityRef` đã tồn tại sẵn khi cần dùng — không tài liệu nào trả lời: ai/cái gì mint 1 Identity mới cho 1 human/agent/device lần đầu xuất hiện? Có kiểm tra quyền để mint không (nếu có, ai cấp quyền cho lệnh mint ĐẦU TIÊN — vấn đề con-gà-quả-trứng kinh điển của mọi hệ IAM, chưa được thừa nhận là tồn tại)?

**5.3 — Scheduling Loop "quét đồ thị" (`EXECUTION_MODEL_V1.md` mục 6) là 1 mẫu tương tác thứ 3 mà `ARCHITECTURE_RULES_V1.md` Điều 6 chưa từng định nghĩa.** Điều 6 chỉ nói "Event hoặc gọi trực tiếp" — polling/scan định kỳ trên state bền không khớp gọn vào cái nào trong 2 loại đó. Không sai về mặt kỹ thuật (không import plugin nào trực tiếp), nhưng Hiến pháp — tài liệu duy nhất có nhiệm vụ liệt kê MỌI mẫu tương tác hợp lệ — bỏ sót đúng mẫu mà tài liệu thiết kế quan trọng nhất (Execution Model) dựa vào nhiều nhất.

**5.4 — `metadata: không authoritative` là quy ước, không có cơ chế chặn ai đó đọc field nghiệp vụ từ đó.** Đây đúng loại rủi ro mà `ARCHITECTURE_RULES_V1.md` Điều 2.5 đã cảnh báo cho dependency rule (quy ước không công cụ sẽ bị xói mòn) — nhưng cảnh báo đó chưa từng được áp lại cho chính field `metadata` xuất hiện trên MỌI contract của `SYSTEM_CONTRACTS_V1.md`.

---

## 6. Rủi ro về quy mô (Scalability Risks)

**6.1 — Chi phí thật của "quét toàn bộ đồ thị mỗi vòng lặp Scheduling" chưa từng được định lượng.** Ở "hàng nghìn Workflow" (mục tiêu tường minh của `ARCHITECTURE_RULES_V1.md` §14), mỗi Execution có thể có hàng trăm node (đặc biệt khi đồ thị lớn dần không giới hạn — chính `EXECUTION_MODEL_V1.md` mục 32 điểm yếu #3 đã tự thừa nhận chưa có giới hạn cứng). "Quét toàn bộ mỗi vòng lặp" mượn ý tưởng Kubernetes reconcile, nhưng Kubernetes reconcile trên etcd — hệ lưu trữ được thiết kế riêng cho watch/list hiệu quả ở quy mô lớn. Brain OS định làm điều tương tự trên **1 bảng Postgres đóng vai trò outbox** — nền tảng yếu hơn đáng kể cho đúng mẫu truy cập này, chưa từng được thừa nhận.

**6.2 — Event Bus phải gánh ít nhất 3 loại tải khác bản chất trên cùng 1 outbox: sự kiện hệ thống tần suất thấp (task.completed), streaming token-by-token tần suất rất cao (đã tự flag ở `SYSTEM_CONTRACTS_V1.md` mục 18 #2), VÀ telemetry liên tục từ tới 300 Device.** 300 device × heartbeat/telemetry hợp lý (vd mỗi 10 giây) đã là ~30 sự kiện/giây **liên tục, vĩnh viễn**, không phải tải bùng nổ như Task event. `KERNEL_ARCHITECTURE_V1.md` mục 12 gộp chung "hàng triệu event" thành 1 rủi ro duy nhất — không phân biệt tải liên tục (steady-state) với tải bùng nổ (bursty), 2 bài toán quy mô khác nhau về bản chất, cần chiến lược khác nhau, nhưng được xử lý như 1.

**6.3 — Đếm dồn ngân sách dưới concurrency (đã nêu ở mục 1, phát hiện #3) cũng là 1 rủi ro quy mô** — càng nhiều Task chạy song song (đúng mục tiêu "500 Agent"), race condition trên `accumulatedCostUsd` càng dễ xảy ra và càng khó phát hiện (lỗi timing, không phải lỗi logic rõ ràng).

---

## 7. Rủi ro cần viết lại trong tương lai (Future Rewrite Risks)

**7.1 — `joinPolicy: "quorum:N"` mã hoá số trong chuỗi** (`EXECUTION_MODEL_V1.md` mục 7) — không type-safe, cần parse, sẽ cần viết lại thành object có cấu trúc ngay khi cần thêm tham số (vd "quorum theo N dep có priority cao nhất" khác "quorum bất kỳ N dep").

**7.2 — Rủi ro chuỗi ký tự tự do không kiểm chứng (đã tự flag CHỈ cho `Task.kind`, `SYSTEM_CONTRACTS_V1.md` mục 18 #6) áp dụng y hệt cho `capabilities[]`, `ErrorObject.code`, và `Event.type`** — cùng 1 loại rủi ro (không có registry validate naming convention), nhưng chỉ được thừa nhận ở đúng 1/4 chỗ nó thực sự tồn tại. Đây không phải 4 rủi ro riêng — là 1 rủi ro xuất hiện 4 lần, và đội ngũ mới chỉ nhìn thấy 1/4.

**7.3 — Descriptor tĩnh (`pricing`/`latencyEstimate`/`costEstimate`) giả định thuộc tính THỰC RA thay đổi.** Giá model đổi theo thời gian (thực tế ngành AI thay đổi liên tục), rate limit Tool có thể đổi không báo trước, capability Device có thể đổi sau khi cập nhật firmware. Thiết kế "đăng ký 1 lần, coi như tĩnh, cập nhật định kỳ" gần như chắc chắn cần viết lại thành lịch sử có version/timestamp hoặc live-query, ngay khi hệ thống có đủ vendor thật để quan sát hiện tượng này.

---

## 8. Overengineering

**8.1 — Tỷ lệ thiết kế/triển khai đang cực kỳ lệch.** 6 tài liệu, ~2400+ dòng, đặc tả đủ cho "500 Agent/200 Model/500 Tool/300 Device/hàng triệu Knowledge/hàng nghìn Workflow" — trong khi hệ thống hiện tại có **đúng 1** Agent-tương-đương chạy thật (`local-skills.ts`). Mỗi tài liệu riêng lẻ đều tự cảnh báo đúng "đừng xây hạ tầng cho quy mô chưa tồn tại" cho các subsystem cụ thể (transport phân tán, vector DB, consensus...) — nhưng **chưa tài liệu nào tự hỏi liệu chính khối lượng và độ đầy đủ của 6 tài liệu này, trước khi viết 1 plugin thật, có phải chính nó là 1 dạng over-engineering** ("big design up front" — rủi ro kinh điển: bản thiết kế đẹp không sống sót qua lần chạm thực tế đầu tiên).

**8.2 — Human Approval như 1 Task đầy đủ (Task/Job/Result/RetryPolicy/timeout) cho việc về bản chất có thể chỉ là 1 hộp thoại xác nhận có/không.** Elegant về mặt hợp nhất khái niệm (`EXECUTION_MODEL_V1.md` mục 12), nhưng cái giá là RetryPolicy/timeout mang ý nghĩa kỳ lạ khi áp cho "chờ người bấm nút" (retry nghĩa là gì — hỏi lại người đó lần nữa? timeout nghĩa là gì — tự động từ chối sau N phút?). Máy móc dùng chung có thể phức tạp hơn giá trị nó mang lại so với 1 primitive "pause + callback" đơn giản hơn.

---

## 9. Khái niệm còn thiếu (Missing Concepts)

**9.1 — Không có hợp đồng `Session` dù `ARCHITECTURE_RULES_V1.md` §11 liệt kê nó là 1 trong 6 khái niệm cần phân biệt.** Memory/Knowledge/Cache/State/Configuration đều (gián tiếp) có hình dạng qua các contract khác — Session thì không, dù được nêu tên tường minh ngang hàng 5 khái niệm kia.

**9.2 — Không có hợp đồng `Notification` dù được dùng ngầm định ở ít nhất 4 chỗ** (Digest Agent — Knowledge doc; giao kết quả Background Execution — Execution Model mục 15; yêu cầu Human Approval — mục 12; cảnh báo DLQ — Kernel doc mục 8). "Báo cho người biết 1 việc gì đó" là hạ tầng chịu tải nặng xuyên suốt cả bộ tài liệu, chưa từng được thiết kế 1 lần.

**9.3 — Không có chính sách thời hạn di trú (deprecation window) cụ thể.** `ARCHITECTURE_RULES_V1.md` Điều 7.4 nói "version cũ tiếp tục phục vụ tới khi mọi bên đã chuyển" — không nói bao lâu, ai quyết định đóng cửa sổ, hay điều gì xảy ra với 1 Execution đang chạy dở dùng version bị buộc khai tử giữa chừng.

**9.4 — Không có cơ chế cấu hình cho operator** (chọn Model mặc định cho capability nào, đặt budget mặc định, đặt retention policy) — `ARCHITECTURE_RULES_V1.md` chỉ liệt Configuration như 1 loại state, không nói ai/cách nào thực sự thay đổi nó.

---

## 10. Khái niệm nên gộp (Should Be Merged)

**10.1 — Workflow (kind riêng) nên cân nhắc gộp vào Agent.** `EXECUTION_MODEL_V1.md` đã xác lập triết lý đồ thị động — 1 Workflow tĩnh (`steps[]` khai trước) chỉ là trường hợp đặc biệt của 1 Agent có Planning phase tầm thường/xác định trước, không cần 1 `kind` Plugin riêng với Contract riêng (`SYSTEM_CONTRACTS_V1.md` mục 13). Giữ 2 khái niệm song song tạo câu hỏi không cần thiết: "việc này nên viết thành Agent hay Workflow?" cho mọi ca sử dụng mới.

**10.2 — Execution History / Audit Trail / Observability nên trình bày lại thành 1 mục "3 view trên 1 nguồn dữ liệu"** thay vì 3 mục đánh số riêng (đã nêu ở mục 3.4) — nội dung đã đúng, cách trình bày gây hiểu lầm ngược lại nội dung.

**10.3 — Cost Tracking / Token Tracking nên gộp thành 1 mục "Resource Tracking"** với Token là 1 trường con của Cost cho Model — như đã nêu ở mục 3.5.

---

## 11. Khái niệm nên xoá (Should Be Deleted)

**11.1 — `ExecutionContext.grantedPermissions` (cache).** Tài liệu tự nói "đây là cache, không thay Permission Gate, Permission Gate vẫn luôn được hỏi thật". Nếu enforcement thật không đổi hành vi dựa trên field này, nó không có tác dụng đo lường được — chỉ tạo rủi ro hiểu lầm (tên gọi "granted" nghe như đã cấp thật, dễ bị đọc nhầm thành nguồn thẩm quyền). Nên xoá trừ khi có số liệu cụ thể chứng minh việc cache này tiết kiệm được gì.

**11.2 — `AgentDescriptor.costEstimate`/`latencyEstimate` (tĩnh, tự khai) nên cân nhắc xoá sau khi Performance Metrics (mục 27) có đủ dữ liệu thật** — giữ 2 nguồn sự thật (ước tính tự khai vs đo thật) cho cùng 1 thứ là chính xác loại vi phạm "nhiều nguồn sự thật cho cùng 1 sự kiện" mà `ARCHITECTURE_RULES_V1.md` Điều 16.14 cấm — chỉ tạm chấp nhận cho vấn đề cold-start (chưa có dữ liệu thật lần đầu), không nên là trạng thái vĩnh viễn.

---

## 12. Giả định sai (Wrong Assumptions)

**12.1 — Giả định "chi phí = chi phí gọi Model AI".** `ToolDescriptor` (`SYSTEM_CONTRACTS_V1.md` mục 11) **không có field `pricing`** trong khi `ModelDescriptor` có đầy đủ. Nhưng tầm nhìn gốc của Brain OS gồm cả robot/printer/business — 1 Tool điều khiển Printer tiêu tốn mực/giấy thật, 1 Device robot có hao mòn cơ khí thật — đây cũng là "chi phí" theo đúng nghĩa cần theo dõi (mục 25), nhưng khung Cost Tracking hiện tại chỉ nhìn thấy chi phí AI. Giả định ẩn "chi phí quan trọng ⇒ chi phí AI" không khớp tầm nhìn đã tuyên bố từ tài liệu gốc nhất.

**12.2 — Giả định "Agent luôn hoạt động theo vòng hỏi-đáp rời rạc" (đã nêu ở phát hiện #1, mục điều hành).** Đây là giả định nền tảng nhất bị thách thức mạnh nhất — nếu sai, `EXECUTION_MODEL_V1.md` không chỉ thiếu 1 chi tiết, nó thiếu **1 hình dạng thực thi hoàn toàn khác** cho ít nhất 1 trong 8 domain mục tiêu ban đầu.

**12.3 — Giả định "checkpoint-snapshot đơn giản hơn deterministic replay của Temporal" chỉ đúng về CHI PHÍ TRIỂN KHAI, chưa chắc đúng về CHI PHÍ SUY LUẬN ĐÚNG ĐẮN.** Temporal khó xây hơn nhưng cho đảm bảo mạnh (trạng thái phục hồi luôn nhất quán). Checkpoint-snapshot dễ xây hơn nhưng đẩy toàn bộ gánh nặng "resume có an toàn không" sang từng plugin author, mãi mãi (đã tự thừa nhận ở `SYSTEM_CONTRACTS_V1.md` mục 18 #4 và `EXECUTION_MODEL_V1.md` mục 23) — đây có thể là đánh đổi **chi phí thấp hơn nhưng đúng đắn kém hơn về tổng thể**, không phải chiến thắng thuần tuý như văn bản trình bày.

---

## 13. Ý tưởng nghe hay nhưng sẽ vỡ khi triển khai thật

**13.1 — Human Approval as Task** (đã nêu mục 8.2) — elegant trên giấy, ngữ nghĩa retry/timeout kỳ quặc khi áp cho hành vi con người.

**13.2 — 1 Registry chung, `kind` chuỗi tự do, không enum đóng khung** — elegant cho mở rộng (đúng mục tiêu "500 Agent không sửa Core"), nhưng trong triển khai thật: **0 autocomplete, 0 bắt lỗi lúc biên dịch cho `"agnet"` gõ nhầm thay vì `"agent"`** — gánh nặng bắt lỗi bị đẩy hết sang runtime/thời điểm đăng ký, thứ đã bị hoãn thiết kế ("chưa thiết kế ở tài liệu này" — `SYSTEM_CONTRACTS_V1.md` mục 18 #6). Sẽ sinh lỗi thật trong tháng đầu viết plugin thật.

**13.3 — "Learning Loop chỉ là 1 Execution khác" (tính đệ quy thanh lịch)** — elegant về mặt hợp nhất, nhưng có bug logic thật (đệ quy vô hạn tiềm ẩn, mục 1 phát hiện #5) chưa được vá.

---

## 14. Đối chiếu với 6 hệ tham chiếu — góc nhìn phản biện

| Hệ | Brain OS tự nhận đã mượn gì | Nơi phép so sánh không đứng vững |
|---|---|---|
| **Linux** | Priority + fairness trong Scheduling | Linux scheduler có hàng chục năm cứng hoá thực chiến; Scheduling Loop của Brain OS chưa build, độ tự tin trình bày (mục 6 Execution Model) chưa tương xứng mức đã được kiểm chứng = 0 |
| **Kubernetes** | Reconcile-không-replay | K8s reconcile trên etcd — kho lưu trữ nhất quán, tối ưu cho watch/list ở quy mô lớn. Brain OS định làm tương tự trên 1 bảng Postgres đóng vai outbox — nền tảng yếu hơn hẳn cho đúng mẫu truy cập này (mục 6.1) |
| **Ray** | Đồ thị động, Task tự sinh Task | Ray có scheduler phân tán thật với backpressure/object placement đã kiểm chứng; Brain OS chỉ "phác thảo" admission control (Execution Model mục 6) chứ chưa mô hình hoá nghiêm túc backpressure khi đồ thị lớn nhanh hơn tốc độ dispatch |
| **Temporal** | Nhu cầu durable execution | Đã đổi lấy đảm bảo yếu hơn (checkpoint-snapshot) để giảm chi phí triển khai — đánh đổi có thể lệch theo hướng bất lợi hơn văn bản trình bày (mục 12.3) |
| **LangGraph** | Graph node, checkpointer, interrupt cho human-in-loop | LangGraph state đồng nhất (bộ nhớ 1 tiến trình Python); Brain OS phải serialize checkpoint XUYÊN qua ranh giới plugin dị nhất (in-process hôm nay, có thể out-of-process sau — Kernel doc mục 13) — bài toán khó hơn nhiều so với những gì LangGraph đã giải, được đối xử như độ khó tương đương |
| **ROS** | Goal/Feedback/Result/Cancel ~ Task/Progress/Result/cancel | ROS Action sinh ra cho robot vật lý — "cancel" có ngữ nghĩa vật lý rõ ràng (dừng motor). Áp mẫu này cho lời gọi model AI đã bắt đầu sinh: "cancel" 1 lượt sinh token có thực sự dừng được tính phí phía vendor không? Chưa tài liệu nào trả lời — điểm khác biệt bản chất giữa "huỷ hành động vật lý" và "huỷ hoá đơn đã phát sinh" bị bỏ qua |

---

## 15. Những gì KHÔNG bị phá — để giữ audit này cân bằng, không phải phá vì phá

Nhiệm vụ được giao là tấn công, nhưng 1 audit chỉ toàn phá huỷ không giúp ích cho quyết định tiếp theo. 3 điều đứng vững qua rà soát này, nêu ngắn gọn:

- **Ranh giới Kernel 6-nguyên-thuỷ** (mục 4 Kernel doc) — dù Config/Secrets là điểm yếu nhất (mục 4.4 audit này), 5/6 nguyên thuỷ còn lại có lý lẽ vững, đã áp bài kiểm tra 3 câu hỏi nhất quán.
- **Task/Result envelope tách khỏi payload** (`SYSTEM_CONTRACTS_V1.md` mục 0.2) — nguyên lý ABI đúng đắn, không phát hiện lỗ hổng nào ở chính nguyên lý này, chỉ ở vài field cụ thể xây trên nó.
- **Quy tắc "chỉ phụ thuộc xuống, không plugin nào import plugin khác"** (`ARCHITECTURE_RULES_V1.md` Điều 2) — không tìm thấy phản ví dụ nào trong toàn bộ 6 tài liệu vi phạm chính quy tắc này ở tầng thiết kế (dù công cụ enforce nó thì chưa tồn tại, mục 1 phát hiện #4).

---

*Audit thuần kiến trúc — không có code, migration, hay thay đổi nào lên project. Không phát hiện nào ở trên được tự động sửa; đây là danh sách cần Chief Architect (con người) quyết định xử lý cái nào, bỏ qua cái nào.*
