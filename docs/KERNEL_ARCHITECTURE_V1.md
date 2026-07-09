# Brain OS — Kernel & System Architecture (FOUNDATION V1)

**Vai trò:** Chief Software Architect — thiết kế kernel phải sống được 5-10 năm. Không code, không sửa project, không migration, không implement.
**Ngày:** 2026-07-09 · **Tiền đề:** đọc sau `ARCHITECTURE_REVIEW_V1.md` (hiện trạng codebase) và `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` (thiết kế Knowledge Service). Tài liệu này **sửa lại** một quyết định của chính tài liệu đầu tiên — xem mục 16.a — đây là chủ đích, không phải nhầm lẫn.

> **🔒 KIẾN TRÚC V1 ĐÃ ĐÓNG BĂNG (2026-07-09).** Đã qua `ARCHITECTURE_AUDIT_V1.md` (audit đối kháng) và vá các mâu thuẫn/lỗ hổng cần vá trước implementation (tenantId, root-of-trust cho Identity mint, quan hệ Manifest/Descriptor — xem cuối mục 4). Roadmap triển khai ở `docs/IMPLEMENTATION_ROADMAP_V1.md`. Thay đổi kernel sau điểm này phải qua review kiến trúc tường minh (`ARCHITECTURE_RULES_V1.md` — quy tắc sửa đổi hiến pháp), không phải sửa tự do.

---

## 1. Design Philosophy

Một kernel không phải là "chỗ để code quan trọng" — nó là **tập hợp tối thiểu các khái niệm mà nếu đổi, mọi thứ khác phải viết lại**. Ngược lại: nếu 1 thứ có thể thay bằng cách khác mà phần còn lại của hệ thống không cần biết, nó **không** thuộc kernel, bất kể nó "core" tới đâu về mặt nghiệp vụ.

Ba câu hỏi lọc, áp cho mọi thành phần trong tài liệu này (mục 3):
1. **Nếu thay thế hoàn toàn cách triển khai của thứ này, có bao nhiêu chỗ khác phải sửa theo?** Gần-0 → không phải kernel. Gần-tất-cả → có thể là kernel.
2. **Thứ này có cần tồn tại TRƯỚC KHI bất kỳ plugin nào có thể chạy không?** Không → không phải kernel, nó là 1 plugin/service chạy sau khi kernel sẵn sàng.
3. **Thứ này có mang tri thức nghiệp vụ/vendor cụ thể không** (biết "Claude" là gì, "Robot" là gì, "Memory" nghĩa là gì)? Có → chắc chắn không phải kernel, bất kể nó quan trọng thế nào.

**Tự phê bình có chủ đích:** `ARCHITECTURE_REVIEW_V1.md` (mục 5) từng gộp Agent/Model/Tool/Device Router + Memory + Event Bus + Scheduler + Permissions vào chung 1 khối gọi là "Core". Ở tầm nhìn "review hiện trạng + đề xuất refactor gần", cách gộp đó đủ dùng. Ở tầm nhìn "kernel sống 10 năm", nó **sai** — Scheduler và 4 Router sẽ đổi cách triển khai nhiều lần trong 10 năm (đã tự dự đoán "Workflow Engine sẽ phải viết lại" ngay ở mục 15), trong khi thứ thật sự không được đổi là **cách các thành phần tìm thấy nhau và giao tiếp với nhau**. Tài liệu này tách lại: kernel nhỏ hơn nhiều so với "Core" cũ, phần còn lại của "Core" cũ chuyển xuống thành **Core Services** — vẫn nền tảng, vẫn ship kèm hệ thống, nhưng về nguyên tắc thay thế được, chạy qua đúng cơ chế plugin như mọi thứ khác.

Không thiết kế cho Kubernetes-scale ngay hôm nay (1 VPS, 1 owner). Thiết kế **hợp đồng** (contract/interface) theo tư duy Kubernetes/ROS/Ray — để triển khai có thể đổi từ "1 process, in-memory" sang "phân tán thật" sau này **mà không ai gọi vào hợp đồng đó phải sửa code**. Hợp đồng đắt để đổi. Triển khai rẻ để đổi, nếu hợp đồng đúng ngay từ đầu.

---

## 2. First Principles

Áp cho mọi quyết định trong tài liệu:

- **Kernel không được biết tên riêng của bất kỳ thứ gì bên ngoài nó** — không "Claude", không "Robot", không "Memory", không "GitHub". Kernel chỉ biết các khái niệm trừu tượng: Principal, Plugin, Event, Permission, Lifecycle State.
- **1 plugin không bao giờ import trực tiếp 1 plugin khác.** Muốn dùng khả năng của plugin khác → tra cứu qua Registry theo capability, hoặc gọi qua Event Bus. Đây là quy tắc duy nhất, áp dụng triệt để, ngăn chặn chính xác kiểu coupling đã thấy trong codebase hiện tại (`ARCHITECTURE_REVIEW_V1.md` mục 1.9: 4 thế hệ AI-calling logic import chéo nhau).
- **Thêm 1 thành phần mới không bao giờ được sửa kernel.** Nếu thêm Agent/Model/Tool/Device/Collector thứ N+1 mà bắt buộc phải sửa 1 dòng trong kernel, thiết kế kernel sai — không phải plugin đó "đặc biệt".
- **Chính sách (policy) không thuộc kernel — cơ chế thực thi (enforcement) thuộc kernel.** Kernel đảm bảo "mọi hành động nhạy cảm đều đi qua 1 điểm kiểm tra", không đảm bảo "điểm kiểm tra đó quyết định đúng" — quyết định đúng là việc của policy plugin, thay được, học được, tinh chỉnh được.
- **Triển khai đơn giản trước, hợp đồng đúng trước** — không xây hạ tầng phân tán cho quy mô chưa tồn tại (đã nêu lặp lại ở cả 2 tài liệu trước — nguyên tắc xuyên suốt cả 3 tài liệu, không phải ngẫu nhiên trùng lặp).
- **Mọi hành động phải truy vết được về nguồn gốc (ai/cái gì gây ra nó)** — không thể bổ sung audit trail sau khi hệ thống đã lớn; phải là thuộc tính có sẵn từ event đầu tiên.

---

## 3. Kernel Responsibilities — rà soát từng thành phần được liệt kê

| Thành phần | Trong Kernel? | Vì sao / vì sao không | Phụ thuộc | Plugin hoá được? | Tác động nếu lỗi |
|---|---|---|---|---|---|
| **Identity** | ✅ **Có** (tối giản) | Mọi thứ khác (Permission, Event, Registry, Audit) cần 1 cách nhất quán để nói "ai/cái gì đang làm việc này". Không có Identity từ đầu → chính là lý do `access_level` trong codebase hiện tại tồn tại nhưng không thể enforce (không có khái niệm "ai đang gọi" để so với level) — bằng chứng thật, không phải giả thuyết. | Config/Secrets (mint identity cần seed) | Không — đây là 1 trong các khái niệm bất biến | Không có Identity → Permission/Audit/Registry đều sụp theo |
| **Authentication** (cơ chế xác thực: password/OAuth/biometric/device-token) | ❌ Không | Cơ chế xác thực **sẽ đổi nhiều lần** trong 10 năm (password → OAuth → passkey → thứ chưa phát minh). Kernel chỉ cần **kết quả** (1 Identity đã verify), không cần biết **cách** verify. | Identity (sinh ra Identity đã verify) | Có — mỗi cơ chế là 1 Authentication Provider | 1 provider lỗi không ảnh hưởng identity đã xác thực trước đó qua provider khác |
| **Permissions** | ⚠️ **Nửa trong nửa ngoài** — điểm thực thi (`can(identity, action, resource)`) là kernel; chính sách quyết định là plugin | Nếu điểm thực thi không bắt buộc, sớm muộn sẽ có code "quên" gọi nó (đã xảy ra thật — 0 route nào trong codebase hiện tại enforce access_level). Nhưng chính sách (RBAC/ABAC/rule nào) chắc chắn sẽ tinh chỉnh liên tục — không đóng băng logic đó vào kernel. | Identity | Chính sách: có. Điểm thực thi: không | Nếu Permission Gate lỗi → **deny-by-default**, không phải allow-by-default (kernel phải cứng nguyên tắc này) |
| **Configuration/Secrets** | ✅ **Có** (tối giản) | Mọi plugin — kể cả các plugin của chính kernel — cần 1 cách an toàn, cô lập để nhận config/secret lúc khởi tạo, trước khi bất kỳ hệ thống config "cấp cao" nào (feature flag UI...) tồn tại. Đây là phụ thuộc khởi động (bootstrapping dependency), giống boot parameter của Linux kernel. | Infrastructure (env/secret store) | Không (chỉ cơ chế phân phối, không phải nội dung config) | Không load được config → không plugin nào khởi tạo được — fail nhanh, không chạy nửa vời |
| **Scheduler** | ❌ Không | "Kích hoạt theo thời gian" là 1 khả năng cụ thể, thay được (cron → distributed job queue → external trigger) miễn Event Bus + Registry ổn định. `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 8 đã tự thiết kế Scheduler không cần đợi kernel đầy đủ — bằng chứng nó không cần là kernel. | Event Bus, Registry, Lifecycle | Có — chính nó là 1 Core Service | 1 Scheduler lỗi không kích hoạt được job, nhưng hệ thống còn lại vẫn chạy |
| **Event Bus** | ✅ **Có** (chỉ phần transport, không phải event type cụ thể) | Đây là hệ thần kinh — không có nó, plugin không có cách nào giao tiếp mà không import trực tiếp nhau (chính là bug kiến trúc lớn nhất hiện tại). Kernel chỉ định nghĩa **hình dạng gói tin** (envelope) + đảm bảo giao (retry/DLQ) — không biết `"knowledge.ingested"` nghĩa là gì. | Identity (gắn nguồn gốc event) | Không — transport là bất biến; **loại event cụ thể thì có** (plugin tự định nghĩa) | Event Bus chết → toàn hệ thống mất khả năng phối hợp, đây là rủi ro nghiêm trọng nhất (xem mục 14) |
| **Plugin Manager** | ✅ **Có**, nhưng gộp vào Registry + Lifecycle (không phải 1 khối riêng thứ 7) | "Nạp plugin" thực chất là hành vi lúc-khởi-động của Lifecycle Manager thao tác trên Registry — tách riêng thành khối thứ 7 chỉ tạo thêm ranh giới không cần thiết | Registry, Event Bus | Không | Không nạp được plugin → hệ thống chỉ còn kernel trần, không có tính năng gì |
| **Logging** | ❌ Không (nội dung/định dạng log) — nhưng kernel **phát** sự kiện nội bộ về chính hoạt động của nó lên Event Bus | Kernel không cần "hệ thống logging" — nó cần đảm bảo hoạt động của nó **có thể bị quan sát**. 1 Logging Service (plugin) subscribe Event Bus và định dạng/lưu trữ theo ý muốn — đổi từ ghi file sang ELK sang thứ khác không đụng kernel. | Event Bus | Có — hoàn toàn | Logging Service chết → mất khả năng xem log, **không** mất khả năng vận hành (khác biệt quan trọng với Event Bus chết) |
| **Health Monitor** | ⚠️ **Nửa trong nửa ngoài** — hợp đồng health-check (mọi plugin phải trả lời được "tôi khoẻ không") là kernel (gộp vào Lifecycle Manager); dashboard/alerting là plugin | Nếu hợp đồng health-check không bắt buộc từ kernel, mỗi plugin tự định nghĩa "khoẻ" theo cách khác nhau → Lifecycle Manager không thể ra quyết định restart/pause nhất quán | Lifecycle Manager | Dashboard: có. Hợp đồng: không | 1 plugin không trả lời health-check → tự động coi là lỗi, cô lập, không chặn plugin khác |
| **Task Queue** | ❌ Không | Cơ chế xếp hàng công việc là 1 pattern triển khai (in-memory → Postgres-backed → distributed) xây trên Event Bus, không phải khái niệm nền tảng | Event Bus, Registry | Có | 1 Task Queue implementation lỗi → thay bằng cái khác, plugin gọi qua interface không biết gì đổi |
| **Workflow Engine** | ❌ Không | Đây là thành phần **dự đoán sẽ phải viết lại nhiều lần nhất** trong 10 năm (LangGraph-style graph, DAG đơn giản, hay thứ chưa phát minh) — càng lý do để không đóng băng nó vào kernel | Event Bus, Registry, Agent Router | Có | Đổi Workflow Engine không ảnh hưởng Identity/Permission/Event contract |
| **State Manager** (session/app state, khác Knowledge/Memory) | ❌ Không | Thuộc về từng Agent/Application cụ thể, không phải khái niệm hệ thống dùng chung | — | Có | Cục bộ theo plugin, không lan |
| **Agent Registry / Model Registry / Tool Registry / Device Registry / Service Registry** | ✅ **Có — nhưng là 1 Registry chung, không phải 5 cái riêng** | 5 registry riêng = 5 lần code trùng lặp cùng 1 việc ("đăng ký + tra cứu theo capability"). 1 Registry chung, mỗi entry có field `kind` tự do (`"agent"`, `"model"`, `"tool"`, `"device"`, hoặc **bất kỳ chuỗi nào chưa tồn tại hôm nay**) — đây là điều kiện để thêm 1 LOẠI plugin hoàn toàn mới sau 5 năm mà **không cần sửa kernel** | Lifecycle, Event Bus | Không (bản thân cơ chế) — nhưng Router nào lọc theo `kind` gì thì Router đó là plugin/Core Service | Registry chết → không thành phần nào tìm thấy nhau nữa, tương đương Event Bus chết |
| **Cache** | ❌ Không | Thuần tối ưu hiệu năng, 0 tri thức nghiệp vụ, không cần để hệ thống ĐÚNG, chỉ cần để hệ thống NHANH — tiêu chí kinh điển của "không phải kernel" | Infrastructure | Có | Cache chết → chậm hơn, không sai hơn |
| **Message Bus** | (= Event Bus, không tách riêng) | Xem Event Bus — request/response là 1 pattern dựng trên pub/sub (correlation id + reply-to), không cần 1 hệ transport thứ 2 | — | — | — |
| **Vector Store** | ❌ Không | Chi tiết triển khai của Knowledge Service (đã nêu ở `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 14.4 — "Knowledge Store tách khỏi Postgres về mặt LOGIC") — kernel không cần biết vector là gì | Persistence (qua Infrastructure) | Có | Chỉ ảnh hưởng Knowledge Service, không lan ra hệ thống |
| **Database** | ❌ Không (kernel chỉ cần 1 "khả năng lưu trữ bền" trừu tượng) | Kernel phụ thuộc **khái niệm** "có nơi lưu bền được" cho Identity/Registry/Permission-policy/Event-outbox — không phụ thuộc Postgres cụ thể. Đổi database là đổi Infrastructure, không phải đổi kernel — miễn interface persistence kernel dùng không đổi | Infrastructure | N/A (đây là hạ tầng, không phải "plugin" theo nghĩa Agent/Tool) | Mất kết nối DB → kernel không khởi động được (fail-fast đúng), không chạy "nửa sống nửa chết" |
| **Search** | ❌ Không | Thuộc Knowledge Service (đã thiết kế ở tài liệu trước, mục 11 — Hybrid Search) | Knowledge Service | Có | Cục bộ |
| **Projects, Tasks** | ❌ Không | Business/domain module thuần — đúng tinh thần "Project chỉ quản lý Tasks/Files/Knowledge" đã nêu ở review trước, không phải khái niệm hệ thống | Registry (để đăng ký như 1 Business Module), Memory/Knowledge | Có | Cục bộ |
| **Robot, Camera, Voice, Video, Business, Automation, Research** | ❌ Không (tuyệt đối) | Đây chính xác là danh sách "Kernel không bao giờ được biết" mà yêu cầu đã nêu — mỗi thứ là 1 Agent hoặc 1 Device Type, đăng ký qua Registry như plugin bình thường | Registry, Router tương ứng | Có (bản chất chúng LÀ plugin) | Robot Agent chết không ảnh hưởng Video Agent — đây chính là điểm kiểm chứng thiết kế đúng |
| **GitHub, Google, Telegram, Claude, Gemini, GPT, ESP32, OpenRouter, TOTU, OpenMontage** | ❌ Không (tuyệt đối) | Vendor cụ thể — Tool Provider hoặc Model Provider hoặc Device Driver plugin. Kernel import 1 trong số này = vi phạm nguyên tắc nền tảng nhất của toàn bộ 3 tài liệu | Model/Tool/Device Router (Core Service, không phải kernel) | Có (bắt buộc phải plugin, không có lựa chọn khác) | 1 vendor down (vd OpenAI lỗi) không được phép ảnh hưởng tới việc kernel còn "sống" — đây là phép thử triệt để nhất cho ranh giới kernel |

**Kết quả rà soát:** trong ~35 thành phần được liệt kê, chỉ **6 khái niệm** thực sự cần ở trong kernel (mục 4). Mọi thứ còn lại — kể cả những thứ nghe rất "nền tảng" như Scheduler, Memory, Permission Policy, Task Queue — đều thay được mà không kéo theo viết lại toàn hệ thống.

**Tự phản biện đã cân nhắc, giữ nguyên quyết định (`ARCHITECTURE_AUDIT_V1.md` mục 4.4):** Config/Secrets là nguyên thuỷ yếu nhất trong 6 — ranh giới với "Infrastructure phân phối env var" mảnh hơn 5 nguyên thuỷ còn lại. Giữ nguyên trong Kernel vì lý do hẹp: không phải "config values quan trọng" (đó đúng là Infrastructure), mà vì **cơ chế cô lập** (Plugin A không đọc được secret Plugin B dù cùng process, mục 13) là 1 đảm bảo bảo mật kernel-level, không phải tối ưu hiệu năng — khác Database (đổi engine không đổi đảm bảo bảo mật nào). Ranh giới mảnh, nhưng lý do giữ là cụ thể, không phải quán tính.

---

## 4. Kernel Boundaries — 6 khái niệm cuối cùng

```
┌──────────────────────────── BRAIN OS KERNEL ────────────────────────────┐
│                                                                            │
│   Identity          — "ai/cái gì đang hành động" (human|agent|device|    │
│                        service|system), tối giản: id + type + tenantId   │
│                        (nullable, xem chú thích dưới)                    │
│                                                                            │
│   Registry           — 1 sổ đăng ký chung cho MỌI loại plugin, tra cứu    │
│                        theo capability/kind, không phải 4-5 registry riêng│
│                                                                            │
│   Event Bus           — transport pub/sub + request-response, chỉ định   │
│                        nghĩa ENVELOPE (id/type/source/timestamp/          │
│                        causation/payload), không định nghĩa event nào cụ  │
│                        thể tồn tại                                       │
│                                                                            │
│   Permission Gate     — điểm thực thi bắt buộc can(identity,action,      │
│                        resource) — KHÔNG chứa chính sách, chỉ đảm bảo mọi │
│                        hành động nhạy cảm đều phải đi qua đây             │
│                                                                            │
│   Lifecycle Manager   — state machine cho mọi plugin (đăng ký→khởi tạo→  │
│                        chạy→lỗi→khôi phục→dừng), hợp đồng health-check,   │
│                        thứ tự boot/shutdown theo dependency               │
│                                                                            │
│   Config/Secrets      — phân phối config/secret an toàn, cô lập theo     │
│                        từng plugin, lúc khởi tạo                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────┘
```

**Điều kiện để 1 khái niệm ở trong danh sách này:** phải đúng cả 3 câu hỏi lọc ở mục 1 — thay thế cách triển khai kéo theo viết lại gần hết hệ thống, phải tồn tại trước khi plugin đầu tiên chạy được, và không mang tri thức nghiệp vụ/vendor. Không khái niệm nào khác trong bản rà soát mục 3 đạt cả 3.

**Điều kernel KHÔNG BAO GIỜ chứa** (liệt kê tường minh vì đây là phần dễ bị xói mòn nhất theo thời gian — xem Rủi ro #1 mục 15):
- Tên bất kỳ Agent/Model/Tool/Device/vendor cụ thể nào.
- Logic nghiệp vụ (định nghĩa "quan trọng" nghĩa là gì, "memory" khác "knowledge" thế nào — những khái niệm này sống ở Core Service).
- Chính sách quyết định (permission rule cụ thể, model routing policy cụ thể).
- Bất kỳ import trực tiếp nào tới code nằm ngoài `kernel/`.

**`tenantId` (bổ sung sau `ARCHITECTURE_AUDIT_V1.md` mục 1 phát hiện #6):** `IdentityRef` mang thêm 1 field `tenantId?: string`, nullable, mặc định `null` (single-owner hôm nay = mọi Identity cùng `tenantId: null`, không phân biệt). Đây đúng khuyến nghị đã đưa ra ở `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 14.5 ("thêm nullable ngay từ Phase 1 vì rẻ bây giờ, đắt sau") — bị bỏ sót ở bản gốc của tài liệu này, nay bổ sung lại. Không kéo theo cơ chế multi-tenant nào khác (Permission policy, Registry... vẫn single-tenant ở Phase 1) — chỉ đảm bảo schema không phải migrate thêm cột khi thật sự cần nhiều owner sau này.

**Vòng đời tạo mới 1 Identity (bổ sung sau `ARCHITECTURE_AUDIT_V1.md` mục 5 phát hiện #2):** Identity đầu tiên tồn tại là `system` (mint lúc boot, mục 6 bước 2c) — đây là **root of trust** duy nhất của toàn hệ thống. Mọi Identity khác (human/agent/device) được mint qua 1 lời gọi `identity.mint` đi qua Permission Gate như mọi hành động khác — chỉ Identity đã có quyền `identity.mint_grant` (mặc định chỉ `system` có, lúc boot) mới cấp được quyền mint tiếp cho Identity khác (vd cấp cho 1 "Onboarding Tool" quyền tự mint Identity `human` mới khi có user đăng ký lần đầu). Không có đường tắt "mint không cần quyền" — kể cả Identity đầu tiên (`system`) cũng được mint bởi chính Kernel's boot sequence, không phải tự phát sinh ngoài quy trình.

**`PluginManifest` (mục 7) vs `PluginDescriptor` (`SYSTEM_CONTRACTS_V1.md` mục 8) — quan hệ tường minh, không phải trôi dạt đặt tên:** `PluginManifest` là dữ liệu **tác giả plugin tự khai** (id/kind/version/capabilities/dependencies + 3 hàm lifecycle). `PluginDescriptor` là **bản ghi Registry lưu lại**, dựng từ `PluginManifest` cộng thêm field runtime mà chỉ Registry mới biết (`status`, `healthStatus`, `installedAt`, `lastHealthCheckAt`) — tác giả plugin không tự đặt các field runtime này. `Registry.register(manifest) → PluginDescriptor` là hàm duy nhất tạo ra quan hệ này.

---

## 5. Layered Architecture

```
L7  Applications        Web UI · Robot Face UI · (tương lai) Mobile App ·
                          Voice Assistant — mỗi cái là 1 CLIENT, không đặc quyền gì hơn nhau

L6  Workflows            Định nghĩa quy trình nhiều bước (user tạo hoặc Agent tự sinh) —
                          thành phần dự đoán thay đổi nhiều nhất (mục 15)

L5  Agents                Robot Agent · Video Agent · Research Agent · Business Agent ·
                          SEO Agent · ... — ra quyết định trong 1 domain cụ thể

L4  Routers & Domain      Agent Router · Model Router · Tool Router · Device Router ·
    Core Services         Memory Service · Knowledge Service · Scheduler · Search ·
                          Cache — "thông minh điều phối", thay được, không phải kernel

L3  Providers/Plugins     Model Provider (Claude/GPT/Gemini/...) · Tool Provider
                          (GitHub/Telegram/...) · Device Driver (ESP32/Camera/...) ·
                          Collector (mục Knowledge Acquisition) — triển khai cụ thể

L2  Kernel                Identity · Registry · Event Bus · Permission Gate ·
                          Lifecycle Manager · Config/Secrets — mục 4

L1  Infrastructure        Postgres · filesystem · network · process runtime

L0  Operating System      Linux/VPS
```

**Vì sao khác ví dụ user đưa** (`Applications → Workflows → Agents → Routers → Core Services → Kernel → Infrastructure → OS`): gộp "Routers" và "Core Services" thành 1 tầng (L4) vì chúng cùng bản chất — cả hai đều là "logic điều phối thay được, không phải kernel, không phải plugin triển khai cụ thể" — tách 2 tầng riêng chỉ tạo ảo giác phân lớp mà không có ranh giới thật giữa "Router" và "Scheduler" (cả hai đều điều phối, không lưu trạng thái nghiệp vụ dài hạn). Providers/Plugins (L3) đứng **dưới** Routers không phải vì bị gọi trước, mà vì chúng **đăng ký lên Registry độc lập, trước khi bất kỳ Router nào cần chúng** — chiều đăng ký đi lên (L3→kernel), chiều gọi đi xuống (L4 gọi vào L3 qua Registry, không import trực tiếp).

---

## 6. Boot Process

```
1. Infrastructure preflight
   — DB reachable? filesystem ghi được? biến môi trường bắt buộc có đủ?
   — Fail fast, không khởi động nửa vời.

2. Kernel self-init (thứ tự bên trong, phụ thuộc lẫn nhau tối thiểu)
   a. Config/Secrets loader     — nạp config của chính kernel trước tiên
   b. Persistence connection     — kết nối lưu trữ bền cho Identity/Registry/
                                    Permission-policy/Event-outbox
   c. Identity subsystem         — mint identity "system" cho chính kernel
                                    (kernel cần tự attribute hành động của nó)
   d. Event Bus transport        — sẵn sàng nhận, chưa có subscriber nào
   e. Permission Gate             — nạp policy mặc định = DENY-BY-DEFAULT
   f. Registry + Lifecycle Manager — sẵn sàng nhận đăng ký

   → phát "kernel.ready" lên Event Bus. Kernel CHƯA có tính năng gì — đúng
     như thiết kế, kernel không tự nó "làm" gì cả.

3. Plugin discovery & registration
   — Quét thư mục/manifest plugin đã khai báo (agents/, models/, tools/,
     devices/, collectors/, và bất kỳ kind mới nào chưa biết trước).
   — Mỗi plugin khai `{id, kind, version, capabilities[], dependencies[]}`.
   — Registry.register() cho từng plugin — CHƯA khởi tạo, chỉ ghi nhận tồn tại.

4. Dependency resolution
   — Topological sort theo `dependencies[]` đã khai.
   — Phát hiện circular dependency → từ chối nạp NGAY (fail loud, không deadlock
     âm thầm).
   — Plugin khai phụ thuộc 1 plugin/capability không tồn tại → từ chối nạp
     plugin đó, KHÔNG bỏ qua âm thầm (silent skip là cách lỗi ẩn tích luỹ —
     đã thấy hệ quả ở `ARCHITECTURE_REVIEW_V1.md`: dead code âm thầm tồn tại
     nhiều tháng không ai biết).

5. Initialization (theo thứ tự đã resolve)
   — Mỗi plugin nhận 1 context object cấp bởi kernel: Config/Secrets CỦA RIÊNG
     nó, handle Event Bus (publish/subscribe), handle Registry (lookup, KHÔNG
     phải quyền ghi tuỳ ý), Permission Gate để tự kiểm tra khi cần.
   — Plugin KHÔNG nhận tham chiếu trực tiếp tới plugin khác — chỉ nhận khả
     năng tra cứu.

6. Health check
   — Sau init(), Lifecycle Manager gọi healthCheck() trong timeout cố định.
   — Qua → chuyển trạng thái "running", phát "plugin.ready".
   — Không qua/timeout → "error", phát "plugin.error", KHÔNG tự động xoá khỏi
     Registry (con người/operator cần thấy nó lỗi, không phải biến mất).

7. Steady state
   — Plugin tự báo heartbeat định kỳ (chủ động báo, không phải kernel chủ
     động dò từng plugin — mở rộng tốt hơn ở quy mô 500+ plugin).
   — Lifecycle Manager theo dõi, áp circuit-breaker: 1 plugin lỗi liên tục
     → tự chuyển "paused", ngăn lỗi lan (mục 14).

8. Recovery
   — Plugin lỗi giữa chừng → cô lập lỗi (không crash kernel process — đảm bảo
     BẮT BUỘC của kernel, xem mục 13), phát "plugin.error" để plugin phụ
     thuộc nó tự phản ứng (vd Model Router đánh dấu 1 provider tạm unavailable).
   — Restart theo policy đã khai (none | on-failure | always, backoff có giới
     hạn số lần).

9. Shutdown
   — Ngược thứ tự dependency, graceful drain (chờ việc đang dở tới timeout
     rồi force), gọi onShutdown() từng plugin, phát "kernel.shutdown".
```

---

## 7. Plugin System

**Vì sao TẤT CẢ mọi thứ ngoài kernel phải là plugin, không có ngoại lệ "vì nó quan trọng":**

1. **Đối xứng = dễ đoán.** Nếu Robot Agent là plugin nhưng Video Agent (thêm sau) lại được viết đặc cách "gắn cứng" vì "làm nhanh hơn", 6 tháng sau không ai còn nhớ vì sao 2 thứ tương tự lại khác cấu trúc — đây đúng là thứ đã xảy ra trong codebase hiện tại (robot có route riêng `/api/robot/*` song song route generic `/api/devices/*`, `ARCHITECTURE_REVIEW_V1.md` mục 1.10).
2. **Test được độc lập.** 1 plugin tuân thủ đúng interface → test bằng cách giả lập Registry/Event Bus, không cần dựng cả hệ thống.
3. **Thay thế không đợi được phê duyệt kiến trúc.** Đổi từ Claude sang model khác chỉ là thêm/gỡ 1 Model Provider — không phải "dự án refactor".
4. **Giới hạn blast radius.** 1 plugin lỗi (kể cả lỗi nghiêm trọng, kể cả bị compromise) không thể vượt qua Permission Gate để chạm dữ liệu nó không được cấp quyền — vì nó không có đường nào khác ngoài đi qua kernel.

**Cụ thể hoá cho từng loại đã nêu trong yêu cầu** (Agents/Models/Tools/Devices/Collectors/Pipelines/Business Modules/Video System/Robot System/Knowledge Providers/Search Providers/Storage Providers/Voice Providers): tất cả dùng **chung 1 hợp đồng plugin cơ sở** —

```ts
interface PluginManifest {
  id: string;
  kind: string;              // "agent" | "model" | "tool" | "device" | "collector" | ... (mở, không đóng khung)
  version: string;
  capabilities: string[];    // để Router/Registry lọc theo nhu cầu, không theo tên
  dependencies?: string[];   // id hoặc capability bắt buộc phải sẵn sàng trước
  init(ctx: KernelContext): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  onShutdown?(): Promise<void>;
}
```

Loại plugin cụ thể (Agent/Tool/Model/Device) MỞ RỘNG interface này với method riêng của loại đó (`Agent.run()`, `Tool.execute()`...) — nhưng phần **đăng ký/khởi tạo/health/shutdown** luôn giống nhau, xử lý bởi đúng 1 cơ chế kernel, không viết lại cho từng loại.

**"Business Module" (vd toàn bộ hệ thống phục vụ 1 business như ChinChin) không phải 1 loại plugin mới** — nó là 1 TỔ HỢP (Agents + Workflows + cấu hình) ở tầng L6-L7, dùng lại đúng các Agent/Tool/Model đã đăng ký, không cần kernel biết khái niệm "business" tồn tại.

---

## 8. Event System

**Envelope (duy nhất kernel định nghĩa):**
```ts
type Event = {
  id: string;
  type: string;              // vd "knowledge.ingested" — convention "domain.entity.action",
                              // KHÔNG enforce cứng bởi kernel, chỉ là quy ước cho plugin author
  source: PrincipalRef;      // Identity của thứ phát ra event
  timestamp: DateTime;
  correlationId?: string;    // nối các event cùng 1 luồng xử lý (vd 1 lượt Agent chạy)
  causationId?: string;      // event nào trực tiếp gây ra event này — truy vết nhân-quả
  payload: unknown;          // kernel không đọc, không hiểu nội dung này
};
```

- **Message flow:** publish → Event Bus ghi vào outbox bền (Phase 1: 1 bảng Postgres là đủ, không cần broker riêng) → phân phối tới subscriber đã đăng ký theo pattern (hỗ trợ wildcard, vd `device.*.error`).
- **Request/response** dựng trên pub/sub: caller publish kèm `replyTo` + `correlationId`, callee publish response tới đúng `replyTo` — không cần 1 hệ transport thứ 2 riêng cho RPC.
- **Delivery semantics:** **at-least-once**, không phải exactly-once (exactly-once cần nhiều hạ tầng hơn giá trị nó mang lại ở quy mô hiện tại). Hệ quả: **mọi subscriber bắt buộc idempotent** — đây là ràng buộc thiết kế, không phải gợi ý (đã có tiền lệ đúng hướng: dedupe theo `externalId` ở Knowledge Pipeline).
- **Retry:** exponential backoff, số lần giới hạn, cấu hình được theo từng subscription.
- **Dead Letter Queue:** hết số lần retry → chuyển vào DLQ bền, **không bao giờ âm thầm vứt bỏ**. DLQ tự nó cũng là dữ liệu quan sát được — 1 "DLQ Monitor" (plugin, không phải kernel) có thể subscribe và cảnh báo.
- **Error isolation:** 1 subscriber lỗi khi xử lý event không được làm publisher hay subscriber khác lỗi theo — lỗi xử lý event được publish lại thành chính 1 event (`event.delivery.failed`), để việc "theo dõi lỗi" cũng chỉ là 1 subscriber khác, không phải logic đặc biệt trong kernel.

---

## 9. Service Lifecycle

```
registered ──► resolving-dependencies ──► initializing ──► running ⇄ paused
                                                 │                 │
                                                 ▼                 ▼
                                               error ◄─────────────┘
                                                 │
                                          restarting (theo policy)
                                                 │
                                              stopped ──► removed
```

- **Registration:** plugin khai manifest, Registry ghi nhận — chưa chạy code plugin.
- **Discovery:** Router/Core Service tra cứu Registry theo `kind`/`capabilities`, không theo `id` cụ thể trừ khi cố ý ghim 1 plugin nhất định.
- **Initialization:** theo thứ tự dependency (mục 6 bước 4-5).
- **Running ⇄ Paused:** operator (hoặc chính Lifecycle Manager qua circuit breaker) có thể pause 1 plugin đang chạy mà không gỡ đăng ký — dùng khi cần cô lập tạm thời (vd 1 vendor đang rate-limit) mà không mất cấu hình.
- **Restart:** theo policy khai trong manifest (`none | on-failure | always`), backoff tăng dần, giới hạn số lần trước khi giữ nguyên `error` chờ can thiệp người.
- **Upgrade:** đăng ký version mới **song song** version cũ trong 1 cửa sổ chuyển tiếp (Registry hỗ trợ nhiều version cùng lúc, mục 15 rủi ro #3) — Router có thể dịch dần traffic sang version mới, không phải "tắt-bật" gây gián đoạn.
- **Removal:** gỡ đăng ký, phát `plugin.removed` — Router/plugin khác đang phụ thuộc nó sẽ thấy capability biến mất qua Registry, tự xử lý theo logic riêng (không phải kernel quyết định thay).

---

## 10. Dependency Rules

**Quy tắc duy nhất, áp dụng không ngoại lệ:** mỗi tầng (mục 5) chỉ được phụ thuộc tầng **dưới** nó hoặc kernel — không bao giờ phụ thuộc tầng trên, không bao giờ phụ thuộc ngang hàng bằng import trực tiếp.

| Từ tầng | Được phép gọi | Bị cấm |
|---|---|---|
| L7 Applications | L4 Routers (qua API), Event Bus (subscribe realtime) | Import trực tiếp bất kỳ L3/L5 nào |
| L6 Workflows | L5 Agents, L4 Routers | Import trực tiếp L3 Provider |
| L5 Agents | L4 Routers/Core Services (qua `ctx.model()`, `ctx.tool()`, `ctx.memory()`...) | Tự import Prisma, tự `fetch()` vendor API, import Agent khác trực tiếp |
| L4 Routers/Core Services | Kernel (Registry để lookup L3 Provider), Event Bus | Biết tên vendor cụ thể (chỉ biết `capabilities`) |
| L3 Providers/Plugins | Kernel (đăng ký, publish event) | Import Provider khác, import Router (chiều ngược bị cấm) |
| Kernel | Infrastructure | **Bất kỳ thứ gì ở L3 trở lên** — đây là ranh giới tuyệt đối |

**Inversion of Control cụ thể:** không tầng nào "new" (khởi tạo trực tiếp) 1 thành phần nó phụ thuộc — nó khai `dependencies`/`capabilities` cần, kernel (qua Lifecycle Manager) tiêm (inject) tham chiếu tới **capability**, không phải tới **implementation cụ thể**. Đây là cách 1 Agent gọi "tôi cần 1 model biết chat" mà không bao giờ viết tên `"claude-sonnet"` trong code của nó.

**Enforcement — không chỉ là quy ước:** quy tắc phụ thuộc phải được kiểm tra bằng công cụ (lint import-boundary, vd kiểu `dependency-cruiser`/ESLint import rules theo thư mục), không chỉ ghi trong tài liệu. Lý do thẳng thắn: codebase hiện tại **đã có quy ước tốt** (`BRAIN_SPEC.md`, ghi nhận ở `ARCHITECTURE_REVIEW_V1.md`) nhưng vẫn phát sinh vi phạm (route robot riêng thay vì generic, access_level không enforce) — vì quy ước không có công cụ chặn ở build-time thì bị xói mòn dần theo áp lực deadline. Kernel 10 năm không thể dựa vào "mọi người nhớ nguyên tắc".

---

## 11. Extension Strategy

**Thêm 1 instance của loại plugin đã biết** (vd Agent thứ 101, Model thứ 51): thêm 1 thư mục + implement interface loại đó + khai manifest. **0 sửa kernel, 0 sửa Router** (Router tự thấy qua Registry lần discovery tiếp theo).

**Thêm 1 LOẠI plugin hoàn toàn mới chưa từng có** (vd 3 năm sau xuất hiện khái niệm "Sensor Fusion Module" không khớp Agent/Model/Tool/Device nào): vì Registry dùng `kind: string` tự do (không phải enum cố định trong kernel), đăng ký 1 `kind` mới **không đụng kernel**. Cần thêm: (a) 1 interface riêng cho loại đó (ở tầng plugin, không phải kernel), (b) có thể cần 1 Router mới ở L4 nếu loại này cần điều phối thông minh — nhưng Router mới cũng chỉ là 1 Core Service mới, không phải sửa kernel. **Đây là phép thử quan trọng nhất cho "kernel sống được 10 năm"** — khả năng đón nhận 1 khái niệm hôm nay chưa hình dung ra, không chỉ mở rộng danh sách đã biết.

**Version compatibility:** Registry lưu `version` mỗi entry, Router có thể yêu cầu `capabilities` tối thiểu thay vì `version` cụ thể — giảm số lần phải sửa Router khi Provider nâng cấp nội bộ mà interface bên ngoài không đổi.

---

## 12. Scalability Strategy

Mục tiêu: 500 Agents / 200 Models / 500 Tools / 300 Devices / hàng triệu Knowledge / hàng nghìn Workflows / hàng triệu Events.

| Trục | Áp lực thật ở quy mô này? | Chiến lược |
|---|---|---|
| **Registry** (~1500 plugin entries) | Không — 1500 dòng là tầm thường với bất kỳ DB nào, kể cả load hết vào memory lúc boot | Không cần thiết kế đặc biệt, giữ đơn giản |
| **Identity** (nghìn principal: người + agent + device) | Không | Bảng có index, không cần gì thêm |
| **Event Bus** (**hàng triệu event**) | **Có — đây là điểm chịu áp lực thật nhất** | Phase 1: outbox Postgres + in-process dispatch — ĐỦ tới vài trăm nghìn event/ngày. Vượt ngưỡng đó: đổi TRIỂN KHAI transport (NATS JetStream/Redis Streams/Kafka) — kernel's publish/subscribe/ack **interface không đổi**, plugin không viết lại. Đây chính xác là lý do envelope + interface phải ổn định từ đầu (mục 1). |
| **Permission Gate ở QPS cao** | Có, nếu mỗi lần gọi đều evaluate policy đầy đủ | Cache quyết định theo `(identity, action-class)` với TTL ngắn — tối ưu triển khai của Permission Gate, không đổi hợp đồng `can()` |
| **Workflow Engine / Task Queue** (hàng nghìn workflow) | Có, ở tầng triển khai | Cùng chiến lược Event Bus — xây trên Event Bus/Registry từ đầu để đổi triển khai không lan |
| **Knowledge (hàng triệu bản ghi)** | Có | Đã thiết kế riêng, chi tiết ở `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md` mục 13 — không lặp lại ở đây |

**Nguyên tắc chung:** "100-500 plugin" là scale về **số lượng cấu hình**, rẻ. "Hàng triệu event/knowledge" là scale về **throughput dữ liệu**, đắt. Kernel design đúng là design sao cho 2 trục này **tách rời** — thêm plugin thứ 501 không bao gigiờ tự động kéo theo vấn đề throughput, và giải quyết throughput (đổi Event Bus transport) không bao giờ kéo theo phải sửa plugin.

---

## 13. Security Boundaries

- **Least privilege bắt buộc, không phải khuyến nghị:** mỗi plugin khai trong manifest chính xác capability/permission nó cần (tool nào được gọi, event type nào được publish/subscribe, mức Memory/Knowledge nào được đọc). Permission Gate chỉ cấp đúng những gì đã khai — không có "mặc định được phép". Hệ quả trực tiếp: lỗ hổng đã ghi nhận ở `ARCHITECTURE_REVIEW_V1.md` (bất kỳ ai gọi được server đều đọc được `PrivateMemory`) **về mặt cấu trúc không thể xảy ra** trong thiết kế này — không phải vì code "cẩn thận hơn", mà vì 1 plugin không khai `memory.private.read` thì không có đường nào khác để chạm vào đó.
- **Cô lập secret theo plugin:** Config/Secrets primitive đảm bảo Plugin A không đọc được secret của Plugin B **dù cùng process** — mỗi plugin nhận đúng context của riêng nó, không có biến toàn cục chứa tất cả secret.
- **Phổ cô lập tiến trình (isolation spectrum):** Phase 1 — plugin chạy in-process (Node), nhanh/đơn giản nhưng cô lập yếu (1 plugin lỗi nặng vẫn có thể ảnh hưởng process). Tương lai — subprocess/container/service riêng, cô lập mạnh hơn, phức tạp hơn. **Kernel không được giả định in-process** — mọi giao tiếp qua Event Bus/Registry (không gọi hàm trực tiếp) là điều kiện để leo thang mức cô lập sau này mà không viết lại plugin.
- **Identity type chi phối chính sách:** phân biệt `human | agent | device | service | system` (mục 4) cho phép chính sách kiểu "Robot Agent được tự chủ gọi `device.turn_left`, nhưng hành động có hệ quả không đảo ngược được cần xác nhận từ 1 Identity kiểu `human`" — không thể biểu đạt được nếu Identity không phân loại từ đầu.
- **Audit là thuộc tính của Event Bus, không phải tính năng riêng:** `causationId`/`correlationId`/`source` có sẵn trên MỌI event → mọi hành động có đặc quyền đều truy vết được về nguồn gốc. Quan trọng đặc biệt khi Agent bắt đầu hành động thay mặt người dùng (tài chính, vật lý qua robot, giao tiếp ra ngoài) — không thể bổ sung audit sau khi hệ thống đã lớn, phải có từ event đầu tiên.

---

## 14. Failure Recovery

- **Kernel process crash:** ở Phase 1 (1 process), kernel chết = toàn hệ thống dừng. Giảm thiểu: OS-level supervisor (systemd, hiện **chưa có** — đã ghi nhận là gap thật ở `NEXT.md`) tự restart với backoff; Registry/Identity/Permission-policy **lưu bền** (không thuần in-memory) để restart tái tạo lại trạng thái "cái gì đã đăng ký" thay vì khởi động từ số 0.
- **Plugin crash:** cô lập (mục 6 bước 8), không lan, restart theo policy.
- **Event mất dữ liệu:** outbox bền (kể cả triển khai đơn giản bằng 1 bảng Postgres ở Phase 1) đảm bảo restart kernel không âm thầm mất event đang xử lý dở — "chắc chắn được lưu" quan trọng hơn "nhanh" ở giai đoạn này.
- **Cascading failure:** circuit breaker built-in ở Lifecycle Manager (mục 6 bước 7) — 1 plugin lỗi liên tục tự chuyển "paused" thay vì tiếp tục nhận request và lỗi tiếp, dồn tải lên các plugin gọi nó.
- **Split-brain/multi-node:** **không áp dụng ở Phase 1** (1 VPS, không có 2 node nào để "brain" tách nhau) — nhưng Identity/Registry không được ngầm giả định "chỉ có đúng 1 process, đúng 1 Postgres" theo cách không thể mở rộng sau (vd không dùng ID sinh kiểu chỉ đúng trong 1 process) — không xây consensus phân tán bây giờ (vi phạm nguyên tắc "không xây hạ tầng cho quy mô chưa tồn tại"), chỉ **không khoá cứng** giả định 1-node vào kernel.
- **Điểm lỗi đơn (SPOF) còn tồn tại kể cả sau thiết kế này:** Postgres vẫn là 1 điểm lỗi đơn cho toàn bộ trạng thái bền của kernel ở Phase 1 — thành thật ghi nhận, không phải thiết kế này "giải quyết" nó, chỉ là không làm nó tệ hơn. Giảm thiểu (backup, sau này có thể replica) là vấn đề hạ tầng, ngoài phạm vi thiết kế kernel.

---

## 15. Risks

1. **Kernel scope creep** — rủi ro kiến trúc lớn nhất, không phải rủi ro kỹ thuật. Áp lực "thêm 1 thứ vào kernel cho nhanh" sẽ luôn tồn tại (đã có tiền lệ thật: logic được viết thẳng vào route handler vì nhanh hơn thiết kế đúng). Giảm thiểu: mọi thay đổi kernel bắt buộc có lý do tường minh "vì sao không thể là plugin", cộng lint import-boundary (mục 10) khiến vi phạm bị phát hiện ở build-time, không phải sau nhiều năm.
2. **Xây hạ tầng phân tán quá sớm** — rủi ro đối lập với #1, cũng thật. Cả 3 tài liệu (Architecture Review, Knowledge Acquisition, tài liệu này) đều lặp lại cùng cảnh báo — không phải trùng lặp ngẫu nhiên, đây là sai lầm dễ mắc nhất khi thiết kế "cho tương lai" mà quên quy mô hiện tại.
3. **Plugin interface churn** — kernel ổn định không có nghĩa gì nếu HỢP ĐỒNG plugin (`Agent`, `Tool`, `Model` interface) đổi liên tục không tương thích ngược, phá mọi plugin đã viết. Giảm thiểu: version hoá interface từ ngày đầu (Registry hỗ trợ nhiều version song song, mục 9), không chỉ version hoá kernel.
4. **Bùng nổ độ phức tạp chính sách phân quyền** ở quy mô 500 Agent × 500 Tool × 300 Device — ma trận quyền từng-cặp sẽ không quản lý nổi. Cần nhóm theo capability/role ngay từ đầu (permission theo "loại hành động", không theo từng cặp plugin cụ thể).
5. **Chi phí trì hoãn tăng dần** — mỗi tính năng mới thêm vào pattern hardcode hiện tại (trước khi áp dụng kernel này) làm khối lượng cần di trú lớn hơn. Đây là rủi ro có tính thời gian thật, không trừu tượng — càng để lâu, `ARCHITECTURE_REVIEW_V1.md` mục 16 (roadmap) càng tốn công hơn để thực hiện.
6. **SPOF Postgres vẫn còn** (mục 14) — thiết kế kernel không tự động giải quyết vấn đề hạ tầng.
7. **Thành phần dự đoán sẽ phải viết lại** (không phải "có thể", mà "gần như chắc chắn" theo kinh nghiệm hệ thống tương tự): Workflow Engine (chưa đủ use case thật để biết hình dạng đúng), Event Bus transport implementation (in-process → broker, ĐÚNG như kế hoạch, không phải thất bại), Permission policy engine (RBAC hôm nay, có thể cần ABAC/thứ phức tạp hơn khi Agent tự chủ hơn). **Không** dự đoán phải viết lại: Identity, Registry, Event envelope shape, Lifecycle state machine — đây chính là cam kết "kernel" của tài liệu này, và là tiêu chí để đánh giá lại sau 2-3 năm xem thiết kế có đúng không.

---

## 16. Alternative Architectures Considered

**a. "Core lớn" (chính `ARCHITECTURE_REVIEW_V1.md` đã đề xuất)** — gộp Router + Memory + Event Bus + Scheduler + Permission vào 1 khối. **Từ chối ở tài liệu này**: khối đó quá lớn để thực sự "không đổi trong 10 năm" — tự mâu thuẫn với chính rủi ro #7 mà tài liệu đó cũng liệt kê (Workflow Engine dự đoán viết lại, nhưng lại được xếp trong "Core" cùng khối với Identity). Đây là sửa sai có chủ đích, không phải mâu thuẫn giữa 2 tài liệu.

**b. Microservices ngay từ đầu** (mỗi Agent/Tool là 1 service triển khai riêng, gọi qua network RPC) — **từ chối cho hiện tại**: chi phí vận hành khổng lồ so với 1 VPS/1 owner, không tương xứng lợi ích ở quy mô này. **Nhưng thiết kế này giữ nguyên lựa chọn đó cho tương lai** — vì plugin giao tiếp thuần qua Event Bus/Registry (không import trực tiếp), tách 1 plugin ra chạy như service riêng sau này là đổi TRIỂN KHAI, không đổi kiến trúc. Đây là pattern "modular monolith tiến hoá" — đã có tiền lệ thành công thật (nhiều hệ thống lớn vận hành theo mô hình này nhiều năm trước khi tách service chọn lọc), không phải lý thuyết chưa kiểm chứng.

**c. Actor-model runtime đầy đủ (kiểu Ray/Erlang/BEAM)** — được cân nhắc nghiêm túc vì Ray/ROS nằm trong danh sách nguồn cảm hứng. **Chấp nhận PHẦN TINH THẦN** (mỗi plugin ~ 1 actor cô lập, Event Bus ~ mailbox, Lifecycle Manager ~ supervisor tree — supervision pattern) — **từ chối RUNTIME đầy đủ** (không đặt cược cả stack vào 1 runtime phân tán chuyên biệt mà đội ngũ/hạ tầng hiện tại — Node/Next.js/Postgres — chưa có kinh nghiệm vận hành). Có thể xem xét lại nếu Brain OS thật sự cần scheduler phân tán cho khối lượng tính toán lớn (vd huấn luyện/suy luận model tại chỗ, không chỉ gọi API).

**d. Event Sourcing làm nguồn sự thật chính** (trạng thái = replay toàn bộ event log, không phải bảng CRUD) — cân nhắc vì mang lại khả năng audit/replay rất mạnh, khớp tinh thần "mọi thứ phải truy vết được". **Từ chối làm mô hình CHÍNH**: phần lớn trạng thái Brain OS (Memory, Knowledge, Project) có bản chất CRUD tự nhiên, ép vào event-sourcing tăng độ phức tạp không tương xứng lợi ích, và đội ngũ hiện tại chưa quen vận hành mô hình này. **Chấp nhận MỘT PHẦN**: outbox/DLQ của Event Bus vốn dĩ đã có hình dạng log, hưởng lợi tự nhiên từ tư duy event-sourcing mà không cần áp dụng toàn hệ thống — đây là lựa chọn hỗn hợp có chủ đích, không phải all-or-nothing.

**e. Không có kernel — toàn bộ là "plugin soup" phẳng, không lớp đặc quyền nào** — **từ chối dứt khoát, có bằng chứng cụ thể**: đây chính xác là những gì đang xảy ra trong codebase hiện tại — không có 1 cơ chế "tìm nhau"/"giao tiếp" chung, kết quả là 4 thế hệ AI-calling logic tự phát minh lại cách định tuyến/schema riêng, không tương thích nhau (`ARCHITECTURE_REVIEW_V1.md` mục 1.9). Đây không phải rủi ro lý thuyết của phương án "không kernel" — đó là hiện trạng đã quan sát được, là bằng chứng thực nghiệm mạnh nhất cho việc kernel này cần tồn tại.

---

## 17. Trade-offs

Trung thực về cái giá phải trả của thiết kế đã chọn — không thiết kế nào miễn phí:

- **In-process plugin (Phase 1)** = nhanh, đơn giản, triển khai rẻ — **nhưng** cô lập yếu thật sự: 1 plugin lỗi cực đoan (vd memory leak, vòng lặp vô hạn) vẫn có thể ảnh hưởng cả process dù Lifecycle Manager cố gắng cô lập ở tầng logic. Cô lập tiến trình thật (subprocess/container) là điều duy nhất giải quyết triệt để, và đó là chi phí vận hành lớn hơn hẳn — chấp nhận đánh đổi này ở Phase 1, không giả vờ đã giải quyết.
- **At-least-once delivery** = đơn giản hơn nhiều so với exactly-once — **nhưng** đặt gánh nặng "phải idempotent" lên VĨNH VIỄN mọi plugin author, mãi mãi, không chỉ 1 lần. Đây là kỷ luật thiết kế bắt buộc duy trì liên tục, không phải chi phí trả 1 lần.
- **1 Registry chung thay vì Registry riêng cho Agent/Model/Tool/Device** = đơn giản hơn, mở cho loại plugin chưa biết trước — **nhưng** mất type-safety/tối ưu hoá riêng mà 1 registry chuyên biệt có thể có (vd Model Registry biết sẵn field `contextWindow`, `costPerToken` mà Registry chung không có chỗ chuẩn để đặt) — đánh đổi bằng cách để Router tự validate/diễn giải field riêng của loại nó, không phải Registry.
- **Kernel chỉ làm điểm thực thi permission, không làm chính sách** = đúng nguyên tắc tách biệt — **nhưng** nghĩa là kernel không tự nó đảm bảo "quyết định đúng", chỉ đảm bảo "luôn có 1 quyết định được hỏi". Chính sách tồi vẫn cho kết quả tồi — kernel không phải thuốc chữa bách bệnh cho bảo mật, chỉ là điều kiện cần.
- **Manifest khai báo (dependencies/capabilities) bắt buộc** = boot dễ dự đoán, debug được, dependency graph tường minh — **nhưng** thêm chi phí viết cho mọi plugin author so với cách "cứ code rồi gọi thẳng cho nhanh" — đây chính xác là chi phí kỷ luật đã thiếu ở codebase hiện tại, giờ trả trước thay vì trả sau (và trả sau luôn đắt hơn, đã thấy rõ qua rủi ro #5 mục 15).

---

## 18. Final Recommendation

1. **Chấp nhận kernel 6-khái-niệm** ở mục 4 (Identity, Registry, Event Bus, Permission Gate, Lifecycle Manager, Config/Secrets) làm nền tảng — nhỏ hơn đáng kể so với "Core" đã đề xuất ở `ARCHITECTURE_REVIEW_V1.md`, và đó là điều đúng nên làm, không phải bước lùi.
2. **Xây HỢP ĐỒNG đúng ngay từ đầu, triển khai đơn giản** — Event envelope, Plugin manifest shape, Permission Gate interface phải đúng ngay từ phiên bản đầu tiên (đắt để đổi sau), trong khi triển khai bên dưới (in-process EventEmitter, 1 bảng Postgres cho Registry/outbox) hoàn toàn có thể thô sơ ở Phase 1 (rẻ để đổi sau, MIỄN hợp đồng phía trên nó không đổi).
3. **Không di trú toàn bộ 32 route hiện tại cùng lúc.** Dùng đúng phạm vi đã sẵn có trong `ARCHITECTURE_REVIEW_V1.md` Phase 1-2 (dọn dead code, tách persona khỏi model-call, `MemoryService`, `RobotState→DeviceState`) làm **bãi thử** cho kernel này ở quy mô nhỏ (1-2 Agent, 1 Router) — kiểm chứng hợp đồng đúng trước khi tổng quát hoá cho 500 Agent. Nếu hợp đồng cần sửa sau khi thử với plugin thật đầu tiên, sửa lúc đó rẻ hơn nhiều so với sửa sau khi đã có 50 plugin phụ thuộc vào nó.
4. **Đo lại sau 2-3 năm:** tiêu chí thành công của kernel này là Identity/Registry/Event-envelope/Lifecycle không cần đổi dạng không tương thích ngược trong 2-3 năm đầu, dù Scheduler/Workflow Engine/Permission-policy có thể đã được viết lại nhiều lần bên trên nó. Nếu kernel cũng phải đổi thường xuyên như phần còn lại — nghĩa là ranh giới ở mục 3-4 vẽ sai chỗ, cần review lại, không phải bám cứng thiết kế vì đã viết ra.

---

*Tài liệu thuần kiến trúc — không có code, migration, hay thay đổi nào lên project trong quá trình viết tài liệu này. Dừng lại, chờ phê duyệt trước khi thiết kế subsystem tiếp theo.*
