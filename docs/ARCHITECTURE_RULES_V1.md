# Brain OS — Architecture Rules (CONSTITUTION V1)

**Vai trò:** hiến pháp kiến trúc — không code, không sửa project. Mọi module tương lai (kể cả Model Router chưa thiết kế) phải tuân thủ tài liệu này.
**Ngày:** 2026-07-09 · **Tiền đề:** đúc kết từ `ARCHITECTURE_REVIEW_V1.md` (hiện trạng), `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md`, `KERNEL_ARCHITECTURE_V1.md` (kernel 6 khái niệm: Identity/Registry/Event Bus/Permission Gate/Lifecycle Manager/Config-Secrets). Tài liệu này **bảo vệ** ranh giới kernel đó, không định nghĩa lại nó.

**Quy ước đọc:** MUST/MUST NOT = bắt buộc, không có ngoại lệ trừ khi tự tài liệu này nêu rõ. SHOULD/SHOULD NOT = mặc định mạnh, cần lý do rõ ràng để đi ngược lại, và lý do đó phải ghi lại. MAY = tự do lựa chọn.

> **🔒 KIẾN TRÚC V1 ĐÃ ĐÓNG BĂNG (2026-07-09).** Điều 3.3 (Router = Core Service), Điều 6.4 (mẫu reconcile), Điều 7.4.1 (cửa sổ deprecation cụ thể) bổ sung sau `ARCHITECTURE_AUDIT_V1.md`. Sửa mục 2/4/8/9/10/13 hoặc thêm điều mới sau điểm này áp dụng đúng "Quy tắc sửa đổi" ở cuối tài liệu (sau mục 16) — không phải PR thường.

---

# 1. Core Philosophy

**Brain OS LÀ:** 1 kernel điều phối — nơi AI, con người, robot, thiết bị, tool, tri thức, automation, business giao tiếp với nhau qua 1 bộ khái niệm chung (Identity/Registry/Event/Permission/Lifecycle/Config). UI, Robot, Voice, Mobile (tương lai) đều chỉ là **client** — không client nào có đặc quyền hơn client khác.

**Brain OS KHÔNG PHẢI:**
- **Không phải chatbot** — chat là 1 giao diện, không phải sản phẩm. Nếu 1 ngày Brain OS chỉ còn là "nơi để chat", kiến trúc đã thất bại.
- **Không phải CRM** — People/Project là plugin/domain module, không phải trung tâm hệ thống.
- **Không phải task manager** — Tasks là 1 plugin trong hàng trăm plugin tương lai, không phải lý do hệ thống tồn tại.
- **Không phải "app nhớ"** — Memory là 1 Core Service trong nhiều Core Service, không phải toàn bộ giá trị của hệ thống.
- **Không phải gắn với 1 vendor AI cụ thể** — không có "Brain OS chạy trên Claude" hay "Brain OS chạy trên GPT", chỉ có "Brain OS gọi qua Model Router".

**Điều 1.1:** Không tính năng đơn lẻ nào (chat/robot/CRM/task) được phép trở thành "cái mà Brain OS là" — đó chính là sự chiếm quyền phạm vi (scope capture) mà 3 nhãn "chatbot/CRM/task manager" ngụ ý, và là lý do đầu tiên user loại trừ tường minh ở mọi tài liệu trong chuỗi này.

**Điều 1.2:** Giá trị của Brain OS nằm ở **khả năng điều phối**, không nằm ở bất kỳ plugin cụ thể nào — kể cả plugin tốt nhất, phức tạp nhất, được dùng nhiều nhất hôm nay.

---

# 2. Dependency Rules

Kế thừa trực tiếp `KERNEL_ARCHITECTURE_V1.md` mục 10 — nhắc lại dưới dạng điều khoản bắt buộc, không diễn giải lại lý do (đã có ở tài liệu đó).

**Điều 2.1:** Mỗi tầng (L7 Applications → L6 Workflows → L5 Agents → L4 Routers/Core Services → L3 Providers/Plugins → L2 Kernel → L1 Infrastructure) **CHỈ ĐƯỢC** phụ thuộc tầng ngay dưới nó hoặc Kernel.

**Điều 2.2:** **CẤM TUYỆT ĐỐI** phụ thuộc lên tầng trên. Không có ngoại lệ "chỉ lần này thôi".

**Điều 2.3:** **CẤM TUYỆT ĐỐI** 1 plugin import trực tiếp 1 plugin khác — kể cả cùng `kind` (Agent import Agent khác, Model Provider import Model Provider khác đều cấm như nhau). Muốn dùng khả năng của plugin khác → tra Registry theo capability, hoặc phát Event.

**Điều 2.4:** Kernel **CẤM TUYỆT ĐỐI** phụ thuộc bất kỳ thứ gì ở L3 trở lên. Đây là ranh giới không thể thương lượng của toàn bộ kiến trúc.

**Điều 2.5:** Quy tắc phụ thuộc **PHẢI** được thực thi bằng công cụ (lint import-boundary theo thư mục), không chỉ bằng tài liệu. Lý do: codebase hiện tại đã có quy ước tốt trong `BRAIN_SPEC.md` nhưng vẫn phát sinh vi phạm thật (route robot riêng song song route generic, `access_level` không được enforce ở bất kỳ đâu) — quy ước không có công cụ chặn sẽ bị xói mòn dưới áp lực deadline, không phải "có thể", mà "chắc chắn" theo bằng chứng đã quan sát.

---

# 3. Module Rules — khi nào Plugin, khi nào Core, quyết định thế nào

**Điều 3.1 — Bài kiểm tra 3 câu hỏi (kế thừa `KERNEL_ARCHITECTURE_V1.md` mục 1), áp dụng cho MỌI thành phần mới:**
1. Thay thế hoàn toàn cách triển khai của nó có kéo theo viết lại phần lớn hệ thống không?
2. Nó có bắt buộc tồn tại TRƯỚC KHI bất kỳ plugin nào chạy được không?
3. Nó có mang tri thức nghiệp vụ/vendor cụ thể không?

**Điều 3.2:** Đạt cả 3 (đúng/đúng/sai) → **Kernel**. Chỉ 6 khái niệm hiện đạt cả 3 (`KERNEL_ARCHITECTURE_V1.md` mục 4) — con số này **KHÔNG** được mở rộng chỉ vì 1 tính năng mới "nghe có vẻ nền tảng".

**Điều 3.3:** Nền tảng-nhưng-thay-được (đa số plugin cần dùng, nhưng triển khai cụ thể của nó thay được mà không kéo sập hệ thống) → **Core Service** (Memory, Knowledge, Scheduler, Search). **Router (Agent/Model/Tool/Device Router) là 1 LOẠI Core Service, không phải phạm trù thứ 3** — làm rõ tường minh sau `ARCHITECTURE_AUDIT_V1.md` mục 2.4 (Router từng vắng mặt khỏi khung phân loại 3-nhóm này). Router qua đúng bài kiểm tra 3 câu hỏi Điều 3.1 giống mọi Core Service khác (thay được, không cần tồn tại trước plugin đầu tiên nếu không tính chính nó, không mang tri thức vendor) — không có quy tắc riêng nào cho "Router" tách khỏi "Core Service". Core Service **PHẢI** tự nó cũng đăng ký qua Registry và tuân thủ Plugin Lifecycle (mục 7) — "Core" không phải giấy phép miễn trừ khỏi kỷ luật plugin, chỉ là "loại plugin đóng gói sẵn cùng hệ thống, có thể thay".

**Điều 3.4:** Mặc định cho mọi thứ còn lại → **Plugin**. Nếu 1 thành phần có thể lỗi mà không kéo sập phần còn lại của hệ thống, nó là plugin — kể cả khi nó quan trọng, kể cả khi nó là plugin duy nhất được dùng hôm nay (Robot Agent hôm nay là plugin duy nhất thật sự chạy — điều đó không nâng cấp nó lên Core hay Kernel).

**Điều 3.5 — Nguyên tắc gánh nặng chứng minh đảo ngược:** mặc định của mọi thành phần mới **LÀ** Plugin. Muốn nâng lên Core hoặc Kernel **PHẢI** chứng minh qua Điều 3.1, không phải ngược lại ("cứ thêm vào Core cho nhanh rồi tính sau" **BỊ CẤM** — đây chính là Rủi ro #1 lớn nhất đã nêu ở `KERNEL_ARCHITECTURE_V1.md` mục 15).

---

# 4. Interface Rules — giao tiếp qua hợp đồng, không qua triển khai

**Điều 4.1:** Mọi tương tác xuyên module **PHẢI** đi qua 1 interface đã khai báo (capability contract) — **CẤM** import trực tiếp class/function cụ thể của module khác.

**Điều 4.2 — Vì sao:** chi tiết triển khai đổi liên tục; hợp đồng, nếu thiết kế đúng, không cần đổi theo. Phụ thuộc vào triển khai nghĩa là mọi lần refactor nội bộ của module B làm module A vỡ theo dù **mục đích** của B không hề đổi — đây chính xác là nguyên nhân gốc của "4 thế hệ AI-calling logic chồng lấn" đã ghi nhận ở `ARCHITECTURE_REVIEW_V1.md` mục 1.9: mỗi thế hệ viết lại vì thế hệ trước bị coupling quá chặt để sửa an toàn, không phải vì ý tưởng sai.

**Điều 4.3:** Router hỏi Registry "cho tôi 1 plugin có capability X" — **KHÔNG BAO GIỜ** `import "models/claude/index.ts"` trực tiếp dù chỉ 1 lần, dù chỉ để "test nhanh".

**Điều 4.4:** 1 module **ĐƯỢC PHÉP** phụ thuộc vào **hình dạng** của 1 interface mà không cần biết plugin nào đang thoả mãn nó — và plugin thoả mãn đó **ĐƯỢC PHÉP** đổi lúc runtime mà code gọi nó không cần sửa.

**Điều 4.5:** Interface **PHẢI** được version hoá (xem mục 7) — "hợp đồng ổn định" không có nghĩa "hợp đồng không bao giờ đổi", nghĩa là "đổi có kiểm soát, tương thích ngược trong 1 cửa sổ chuyển tiếp".

---

# 5. State Rules — state được phép ở đâu, tuyệt đối không được ở đâu

**Điều 5.1 — Nơi state ĐƯỢC PHÉP tồn tại:**
- State bền của Kernel (Identity, Registry entry, Permission policy, Event outbox) — sở hữu độc quyền bởi tầng persistence của Kernel.
- State của Core Service (Memory, Knowledge, search index) — sở hữu độc quyền bởi đúng 1 Core Service, truy cập chỉ qua interface của nó.
- State cục bộ, tạm thời, trong-tiến-trình, giới hạn trong 1 request/session của 1 plugin — được phép, miễn không cần sống sót qua restart và không chia sẻ với plugin khác.

**Điều 5.2 — Nơi state TUYỆT ĐỐI KHÔNG ĐƯỢC tồn tại:**
- **Không có global mutable state** truy cập được bởi nhiều plugin cùng lúc (không singleton object, không biến module-level chia sẻ xuyên plugin boundary).
- **1 plugin không được giữ trực tiếp state bền của plugin khác** (không đọc thẳng bảng DB/file của plugin khác) — phải qua interface/event của plugin sở hữu nó.
- **UI/Application layer (L7) không được là nguồn sự thật (source of truth) cho business state** — UI state là VIEW/CACHE của state do Core Service sở hữu, không phải nơi dữ liệu **chỉ** tồn tại. Ví dụ đã làm ĐÚNG trong codebase hiện tại: chat memory `localStorage` của `/robot` được thiết kế tường minh là cache demo phía client, KHÔNG thay thế session lưu ở DB (`ConversationMessage`) — đây là ranh giới cần giữ nguyên khi mở rộng, không phải nới lỏng.
- **Kernel không được giữ state nghiệp vụ** — hệ quả tự nhiên của việc Kernel không biết "Memory"/"Task" nghĩa là gì (mục 1), nên về cấu trúc nó không thể giữ state của các khái niệm đó.

---

# 6. Event Rules — khi nào Event, khi nào gọi trực tiếp

**Điều 6.1 — Dùng Event khi:**
- Publisher không cần (và không nên chờ) phản hồi — "việc này đã xảy ra", không cần ai xác nhận đã nhận.
- Có thể có nhiều subscriber chưa biết trước, kể cả subscriber sẽ được thêm sau này mà publisher không cần sửa gì (đây là điều kiện mở rộng — 1 plugin mới có thể subscribe `knowledge.ingested` mà không ai phải sửa Knowledge Pipeline).
- Hành động vốn dĩ bất đồng bộ/chạy dài (Collector chạy xong 1 lượt, Agent hoàn thành 1 task).
- Muốn tách rời thất bại — subscriber lỗi không được ảnh hưởng publisher.

**Điều 6.2 — Dùng gọi trực tiếp (qua interface Registry-resolved, dạng request-response) khi:**
- Caller thực sự cần giá trị trả về NGAY để tiếp tục logic của chính nó (Agent cần câu trả lời của Model để đi tiếp, không phải "khi nào rảnh thì trả lời").
- Có đúng 1 bên trả lời dự kiến, biết trước qua tra cứu capability — không phải "phát cho ai đang nghe thì nghe".
- Thao tác cần nhất quán ngay lập tức (Permission Gate's `can()` — không thể "để sau", cần biết ngay để quyết định có cho tiếp tục hay không).

**Điều 6.3 — Quy tắc ngón tay cái:** mẫu "hỏi rồi cần trả lời ngay để làm tiếp" → gọi trực tiếp qua interface. Mẫu "thông báo, không ai bắt buộc phải phản ứng" → Event. Cả 2 đều đi qua kernel primitive (Registry-resolved interface hoặc Event Bus) — **không** cái nào là import trực tiếp, nên cả 2 đều tuân thủ mục 4.

**Điều 6.4 — Mẫu thứ 3 (bổ sung sau `ARCHITECTURE_AUDIT_V1.md` mục 5 phát hiện #3): quét/reconcile định kỳ trên state bền.** Không phải Event (không có publisher/subscriber cụ thể), không phải gọi trực tiếp (không hỏi 1 plugin cụ thể trả lời ngay) — 1 Core Service **ĐƯỢC PHÉP** định kỳ tự đọc lại state bền của chính nó (qua Registry/persistence, không import plugin khác) để tìm việc cần làm, làm lưới an toàn cho trường hợp lỡ 1 Event (Event Bus chỉ đảm bảo at-least-once, không đảm bảo real-time tuyệt đối). Ví dụ hợp lệ: vòng lặp lập lịch quét "còn Task nào sẵn sàng mà chưa dispatch" định kỳ, không chỉ dựa vào event `task.completed` kích hoạt. Điều kiện: **chỉ đọc state của chính Core Service đó sở hữu hoặc qua Registry công khai** — không đọc thẳng bảng nội bộ của 1 plugin khác (vẫn tuân Điều 5.2).

---

# 7. Plugin Rules

**Điều 7.1 — Lifecycle** (kế thừa `KERNEL_ARCHITECTURE_V1.md` mục 6/9): `registered → resolving-dependencies → initializing → running ⇄ paused → error → restarting → stopped → removed`. **CẤM** plugin tự chuyển trạng thái ngoài sự điều phối của Lifecycle Manager.

**Điều 7.2:** Plugin **PHẢI** khai manifest đầy đủ (`id/kind/version/capabilities/dependencies`) trước khi được nạp. Phụ thuộc không khai báo **BỊ CẤM** — kể cả khi nó "tình cờ chạy được" hôm nay, vì Lifecycle Manager không thể đảm bảo thứ tự boot cho 1 phụ thuộc nó không biết tồn tại.

**Điều 7.3 — Isolation:** 1 plugin lỗi **KHÔNG ĐƯỢC** làm kernel process chết (Phase 1: cô lập tốt nhất có thể trong cùng process; dài hạn: cô lập tiến trình/container thật). 1 plugin **KHÔNG ĐƯỢC** truy cập secret/config của plugin khác.

**Điều 7.4 — Versioning:** mọi plugin khai `version`. Registry **ĐƯỢC PHÉP** giữ nhiều version cùng `id` song song trong cửa sổ chuyển tiếp. Thay đổi phá vỡ tương thích (breaking change) **PHẢI** là version mới (major), và version cũ **PHẢI** tiếp tục phục vụ được tới khi mọi bên phụ thuộc đã chuyển xong — **CẤM** ép chuyển đồng thời bắt buộc toàn hệ thống.

**Điều 7.4.1 — Cửa sổ chuyển tiếp cụ thể (bổ sung sau `ARCHITECTURE_AUDIT_V1.md` mục 9.3):** mặc định **30 ngày kể từ khi version mới publish, HOẶC tới khi 0 plugin còn phụ thuộc version cũ, TUỲ ĐIỀU KIỆN NÀO ĐẾN SAU** — chủ (owner) của plugin publish version mới là người quyết định đóng cửa sổ sớm hơn nếu muốn (không ai khác được ép). 1 Execution đang chạy dở dùng version sắp hết hạn **KHÔNG** bị buộc dừng giữa chừng — nó hoàn tất bằng version đã bắt đầu, chỉ Execution MỚI mới bị từ chối dùng version đã hết cửa sổ.

**Điều 7.5 — Compatibility:** plugin chỉ tương tác qua capability đã khai — **CẤM** giả định hành vi nội bộ cụ thể của 1 plugin khác (dù đang quan sát thấy hành vi đó). Đây là điều kiện để Provider A thay bằng Provider B mà không ai phát hiện, trừ khi cố tình kiểm tra.

---

# 8. AI Rules — Model Provider abstraction

**Điều 8.1:** Kernel và Core Service **TUYỆT ĐỐI KHÔNG ĐƯỢC** chứa tên vendor cụ thể ("Claude", "GPT", "Gemini", hay bất kỳ tên nào khác) trong code của chính chúng.

**Điều 8.2:** Mọi truy cập model đi qua **Model Router** — Agent xin 1 capability (`chat`, `vision`, `embedding`, `video-gen`...), Model Router phân giải ra 1 Model Provider đã đăng ký thoả capability đó + theo policy (giá/độ trễ/fallback chain).

**Điều 8.3:** Tên vendor/SDK/API vendor cụ thể **CHỈ ĐƯỢC PHÉP** xuất hiện bên trong 1 Model Provider plugin — không nơi nào khác trong toàn hệ thống.

**Điều 8.4 — Vì sao:** model sẽ bị thay/thêm/loại bỏ liên tục — đã có bằng chứng thật (Gemini từng được dùng, bị loại vì lỗi 429 liên tục, ghi nhận ở `ARCHITECTURE_REVIEW_V1.md` mục 1.9). Nếu tên vendor rò vào Core, mỗi lần thay model là sửa nhiều file thay vì thay 1 plugin.

**Điều 8.5 — Hệ quả bắt buộc:** persona/system prompt **KHÔNG ĐƯỢC** nhúng cứng bên trong Model Provider — đó là việc của Agent (Agent quyết định "nói bằng giọng gì", Model Provider chỉ biết "gọi model theo cách nào"). Đây là vi phạm **đã xảy ra thật** trong codebase hiện tại (`robot-ai/openai-provider.ts` chứa toàn bộ persona "Chuối" trộn lẫn logic gọi OpenAI, ghi nhận ở `ARCHITECTURE_REVIEW_V1.md` mục 1.9) — điều 8.5 tồn tại chính để ngăn lặp lại đúng lỗi này ở Agent thứ 2.

---

# 9. Device Rules — vì sao Robot/Camera/ESP32/Drone/TV/Printer đều là Device

**Điều 9.1:** Mọi thiết bị — Robot, Camera, ESP32, Drone, TV, Printer, và bất kỳ loại nào chưa tồn tại hôm nay — **ĐỀU LÀ** Device, đăng ký qua Device Router/Registry với 1 `deviceType`, không phải khái niệm kernel-level riêng biệt cho từng loại.

**Điều 9.2 — Vì sao tất cả cùng 1 khuôn:** mọi thiết bị, bất kể phần cứng hay mô phỏng phần mềm, đều có chung đúng 4 thuộc tính: (a) định danh (1 instance cụ thể), (b) trạng thái (online/offline, mode/telemetry hiện tại), (c) tập lệnh nó chấp nhận, (d) tập sự kiện nó phát ra. Đặc cách hoá 1 loại thiết bị tạo N hệ thống song song thay vì 1 hệ thống chung có N cấu hình.

**Điều 9.3 — Bằng chứng vi phạm đã xảy ra, không phải giả thuyết:** codebase hiện tại có `RobotState` (bảng riêng chỉ cho robot) + `/api/robot/{status,command,event}` (route riêng song song `/api/devices/:id/*` generic) — ghi nhận tường minh ở `ARCHITECTURE_REVIEW_V1.md` mục 1.10 là ví dụ cụ thể nhất của việc "Robot không thực sự chỉ là 1 Device". Điều 9.1-9.2 tồn tại để **không lặp lại** mẫu này khi Camera/ESP32/Drone/TV/Printer được thêm — mỗi loại thêm sau **PHẢI** dùng đúng khuôn Device generic, không tạo `CameraState`/`Esp32State`/`DroneState` riêng.

**Điều 9.4:** 1 Device đã đăng ký **TỰ ĐỘNG** lộ ra các lệnh của nó thành Tool tương ứng (vd `device.robot-01.turn_left`) — Agent gọi qua Tool Router, không cần biết giao thức riêng của từng loại thiết bị.

---

# 10. Tool Rules — GitHub/Google/Telegram/Filesystem/Cloudflare

**Điều 10.1:** Mọi khả năng hành động ra bên ngoài (side-effecting, không chỉ đọc dữ liệu) mà Agent có thể gọi **ĐỀU LÀ** Tool, triển khai bởi 1 Tool Provider plugin — GitHub, Google, Telegram, Filesystem, Cloudflare không có ngoại lệ, không có "tool đặc biệt gắn cứng vào Core vì hay dùng".

**Điều 10.2:** Interface Tool tối thiểu: `name`, `description`, `inputSchema` (zod-style), `execute()`. Tool Router là nơi DUY NHẤT biết những Tool Provider nào tồn tại; Agent chỉ hỏi theo tên/capability.

**Điều 10.3 — MCP ưu tiên:** với các dịch vụ đã có MCP (Model Context Protocol) server công khai, Tool Provider **NÊN** implement dưới dạng MCP client thay vì tự viết tích hợp riêng — biến "thêm 1 Tool" thành "thêm 1 dòng cấu hình endpoint MCP" thay vì viết code, đúng tinh thần triệt để nhất của "Tool là Plugin".

**Điều 10.4 — Vì sao thống nhất Tool với cùng kỷ luật Model/Device:** code của 1 Agent phải đọc giống hệt nhau dù đang "gửi tin Telegram" hay "quay đầu robot" — cả 2 đều là `ctx.tool(name).execute(input)`. Sự đồng nhất này là điều kiện để 1 mẫu Agent duy nhất mở rộng tới 500 Tool mà không cần đặc cách từng loại.

---

# 11. Memory Rules — phân biệt Memory / Knowledge / Cache / State / Configuration / Session

| Khái niệm | Sở hữu/phạm vi | Vòng đời | Tính khả biến | Ví dụ | Mất dữ liệu này thì sao? |
|---|---|---|---|---|---|
| **Memory** | Cá nhân, về owner, gate theo `access_level` | Dài hạn, không tự hết hạn | Ghi/sửa/xoá bởi user/Agent | "Tú thích cà phê đen, dị ứng tôm" | Hệ thống "quên" người dùng — nghiêm trọng, không phục hồi được nếu không hỏi lại |
| **Knowledge** | Thế giới, không thuộc sở hữu ai, gắn nguồn | Có `expires_at`, suy giảm chất lượng theo thời gian | Không ghi đè — supersede qua version (xem `KNOWLEDGE_ACQUISITION_SYSTEM_V1.md`) | "GitHub Trending có 1 framework RAG mới" | Hệ thống "quên" thế giới — phục hồi được bằng thu thập lại, nhưng chậm/tốn kém |
| **Cache** | Dẫn xuất/tính toán lại được | Ngắn hạn, TTL, an toàn để mất hoàn toàn | Vô hiệu hoá/tính lại tự do bất kỳ lúc nào | Kết quả API render trong 60s | Không sao — chỉ chậm hơn, không sai hơn |
| **State** | Trạng thái runtime của 1 thực thể cụ thể (plugin/workflow-run/device) | Kernel's Lifecycle state: bền. State theo request: tạm | Chuyển đổi theo state machine đã định nghĩa | `Device.status = "online"`, `Workflow.status = "running"` | Mất khả năng biết trạng thái hiện tại — thường phục hồi được bằng cách hỏi lại thực thể đó (poll device) |
| **Configuration** | Cách 1 plugin/service được thiết lập, không phát sinh từ việc dùng | Bền, đổi hiếm, thường qua hành động tường minh của owner/operator | Khả biến nhưng tần suất thấp | Model Provider mặc định cho capability "chat" | Về giá trị mặc định hoặc cần cấu hình lại thủ công — không mất dữ liệu nghiệp vụ |
| **Session** | 1 cửa sổ tương tác giới hạn giữa 1 client cụ thể và Brain OS | Tạm-vừa (có thể kéo dài giờ/ngày nhưng không vô hạn), gắn 1 cuộc hội thoại | Chỉ nối thêm (append-only) trong cửa sổ, hết hạn | `ConversationSession` của robot chat hiện tại | Mất mạch hội thoại hiện tại, không mất sự kiện/tri thức đã trích ra từ nó |

**Điều 11.1 — Phép thử phân loại nhanh:** hỏi "nếu mất dữ liệu này, điều gì hỏng?" — câu trả lời quyết định nó thuộc hàng nào trong bảng trên, không phải cảm tính "nghe giống memory".

**Điều 11.2:** **CẤM** 1 khái niệm âm thầm đóng vai khái niệm khác — cụ thể: **CẤM** dùng Cache để lưu Memory (TTL hết hạn = "an toàn" làm mất dữ liệu cá nhân thật), **CẤM** dùng Session để lưu Knowledge dài hạn (tri thức thế giới không nên biến mất khi 1 cuộc hội thoại kết thúc), **CẤM** Configuration đóng vai State (cấu hình không nên đổi theo mỗi request runtime).

**Điều 11.3 — Ví dụ đã đúng cần giữ nguyên tinh thần:** `/robot` dùng `localStorage` cho lịch sử chat demo — đây là **Session/Cache phía client**, không phải Memory, và tài liệu thiết kế của nó nói rõ điều này ("độc lập với DB session, không thay thế cơ chế session DB"). Khi mở rộng ra Agent khác, giữ đúng ranh giới này — không để bất kỳ Agent nào lưu Memory/Knowledge thật chỉ trong `localStorage`/state phía client.

---

# 12. Error Rules

**Điều 12.1:** Lỗi **PHẢI** lan truyền dưới dạng Event (`plugin.error`, `event.delivery.failed`) — **CẤM** nuốt lỗi âm thầm (catch-and-ignore không phát gì). Lỗi ồn ào tốt hơn lỗi im lặng — dead code Xiaozhi từng tồn tại nhiều tháng không ai biết vì không có cơ chế bắt buộc surfacing (`ARCHITECTURE_REVIEW_V1.md` mục 1.9) là bằng chứng cho hệ quả của việc không tuân thủ điều này.

**Điều 12.2:** 1 plugin lỗi **KHÔNG ĐƯỢC** lan sang plugin không phụ thuộc nó (isolation, `KERNEL_ARCHITECTURE_V1.md` mục 6/14).

**Điều 12.3 — Retry:** có giới hạn, exponential backoff, cấu hình được theo từng subscription/plugin. **CẤM** retry vô hạn vào 1 phụ thuộc lỗi vĩnh viễn — vừa lãng phí tài nguyên, vừa che giấu vấn đề thật cần được biết tới.

**Điều 12.4 — Graceful degradation:** khi 1 phụ thuộc không sẵn sàng, bên phụ thuộc nó **PHẢI** có hành vi fallback đã định nghĩa — không nhất thiết là "vẫn thành công", đôi khi fallback đúng là "trả lỗi rõ ràng cho caller", không phải giả vờ thành công. Ví dụ đã làm ĐÚNG: `/api/robot/chat` khi OpenAI lỗi → trả text fallback tường minh + `provider:"fallback"`, không crash, không giả vờ là kết quả OpenAI thật.

**Điều 12.5 — Dead Letter Queue** là nơi chứa event hết lượt retry — **PHẢI** quan sát được, **CẤM** âm thầm vứt bỏ.

**Điều 12.6 — Circuit breaker:** 1 plugin lỗi liên tục **NÊN** tự chuyển `paused` (Lifecycle Manager) thay vì tiếp tục nhận request chắc chắn sẽ lỗi tiếp.

---

# 13. Security Rules

**Điều 13.1:** Mọi hành động nhạy cảm **PHẢI** đi qua Permission Gate — **CẤM TUYỆT ĐỐI** đường tắt "internal trusted call" bỏ qua kiểm tra. Đường tắt chính là cách `access_level` của codebase hiện tại trở thành nhãn trang trí thay vì cơ chế thật (`ARCHITECTURE_REVIEW_V1.md` mục 1.4) — điều 13.1 tồn tại để không lặp lại.

**Điều 13.2 — Mặc định là TỪ CHỐI (deny-by-default):** 1 Identity/plugin không có grant tường minh thì không có gì, không phải "mọi thứ trừ thứ bị cấm tường minh".

**Điều 13.3 — Secrets:** 1 plugin chỉ nhận đúng secret nó đã khai cần — **CẤM** truy cập ngầm định vào kho secret toàn cục.

**Điều 13.4 — Trust boundary theo Identity type:** loại Identity (human/agent/device/service/system) quyết định tầng tin cậy mặc định — hành động của Agent tự chủ có hậu quả không đảo ngược được (tài chính, vật lý qua robot, giao tiếp ra ngoài) **NÊN** yêu cầu xác nhận nâng cao (Identity kiểu `human`) trừ khi đã được cấp quyền tự chủ tường minh cho đúng lớp hành động đó.

**Điều 13.5 — Isolation:** hôm nay in-process (yếu), nhưng interface **PHẢI** thiết kế như thể cô lập nghiêm ngặt (không plugin nào giữ tham chiếu trực tiếp tới object của plugin khác) — để nâng cấp cô lập thật (subprocess/container) sau này không cần đổi interface.

**Điều 13.6 — Audit** không thể bổ sung sau — mọi hành động đặc quyền **PHẢI** truy vết được về Identity + chuỗi nhân-quả (causation chain) ngay từ event đầu tiên.

---

# 14. Scalability Rules

Kế thừa `KERNEL_ARCHITECTURE_V1.md` mục 12, phát biểu lại thành ràng buộc bắt buộc:

**Điều 14.1:** Số lượng plugin tăng (Registry) **PHẢI** vẫn rẻ tới hàng nghìn plugin — đây là bài toán quy mô CẤU HÌNH, không phải THÔNG LƯỢNG, và **PHẢI** được đối xử đúng như vậy (không over-engineer Registry cho thông lượng nó không cần).

**Điều 14.2:** Thông lượng Event tăng (hàng triệu event) **PHẢI** được cô lập hoàn toàn trong TRIỂN KHAI transport của Event Bus — hợp đồng publish/subscribe/ack **KHÔNG ĐƯỢC** đổi khi transport đổi (in-process → broker thật).

**Điều 14.3:** Khối lượng Knowledge tăng (hàng triệu bản ghi) **PHẢI** được cô lập trong triển khai lưu trữ/index của Knowledge Service — `ctx.knowledge.recall()` **KHÔNG ĐƯỢC** đổi hợp đồng dù kho có 1.000 hay 10 triệu bản ghi.

**Điều 14.4:** Số lượng Workflow tăng (hàng nghìn) tuân theo đúng nguyên tắc cô lập như Điều 14.2 — triển khai Workflow Engine thay được, hợp đồng ổn định.

**Điều 14.5 — Quy tắc chung:** bất kỳ lần đổi triển khai vì lý do quy mô nào **PHẢI vô hình** với mọi module chỉ phụ thuộc vào hợp đồng ổn định. Nếu không vô hình được, hợp đồng ban đầu thiết kế sai — vấn đề nằm ở hợp đồng, không phải ở nỗ lực scale.

---

# 15. Coding Rules — quy ước cấu trúc (không phải code style)

**Điều 15.1 — Folder rule:** 1 plugin = 1 thư mục, tên thư mục = `id` của plugin (kebab-case), nằm dưới thư mục đúng `kind` của nó (`agents/<id>/`, `models/<id>/`, `tools/<id>/`, `devices/<id>/`, `collectors/<id>/`).

**Điều 15.2 — Naming rule:** `id` của plugin **PHẢI** duy nhất toàn cục — không chỉ duy nhất trong `kind` của nó. Lý do: tránh nhập nhằng trong log/event/audit trail ở những nơi ngữ cảnh `kind` có thể bị mất (vd 1 dòng log chỉ ghi `id`, không kèm `kind`).

**Điều 15.3 — Dependency injection rule:** 1 module nhận phụ thuộc qua context object được Kernel tiêm lúc `init()` — **CẤM** singleton khởi tạo ở thời điểm import (side-effect lúc import là nguồn gốc kinh điển của coupling ẩn và code khó test).

**Điều 15.4 — Architecture rule:** vị trí file/module trong cây thư mục **PHẢI** khớp đúng tầng kiến trúc của nó (mục 2) — file của 1 Core Service **KHÔNG ĐƯỢC** nằm trong thư mục của 1 plugin và ngược lại.

**Điều 15.5 — Không God Module:** 1 file/module **KHÔNG ĐƯỢC** đảm nhận nhiều hơn trách nhiệm của đúng 1 plugin. Ví dụ vi phạm đã tồn tại thật trong codebase: `xiaozi-handler.ts` (261 dòng, gộp routing + auth + chọn "brain" + logging trong 1 file) — điều 15.5 tồn tại để không tái diễn ở plugin mới.

---

# 16. Những điều TUYỆT ĐỐI BỊ CẤM

Danh sách quét nhanh — mỗi mục kèm 1 dòng lý do, và ví dụ thật trong codebase hiện tại nếu có (để không ai đọc như cảnh báo lý thuyết):

1. **God Objects** — 1 module vừa routing vừa business logic vừa persistence vừa gọi ngoài. *(Ví dụ thật: `xiaozi-handler.ts`.)*
2. **Hardcoded provider** — tên vendor xuất hiện trong Kernel/Core Service/Agent code thay vì ẩn sau Provider plugin. *(Ví dụ thật: persona nhúng thẳng trong `askRobotOpenAI()`.)*
3. **Circular dependency** — Module A import B import A, ở bất kỳ tầng nào. Bị cấm theo cấu trúc nếu tuân thủ mục 2 — nêu tường minh vì sẽ có người thử dưới áp lực deadline.
4. **Global mutable state** — singleton/biến module-level chia sẻ xuyên plugin boundary.
5. **Business logic trong UI** — UI/page quyết định "Knowledge nào quan trọng" hay "gọi Model nào" — việc đó thuộc Core Service/Agent, UI chỉ render và dispatch.
6. **Vendor lock ngoài Provider layer** — bất kỳ đoạn code nào ở tầng không phải Provider giả định hình dạng API riêng của 1 vendor cụ thể (thay vì `ModelResponse` đã chuẩn hoá).
7. **Memory bên trong plugin** — 1 plugin giữ bản sao riêng của Memory/Knowledge thay vì luôn hỏi Core Service sở hữu nó — dẫn tới view cũ/không nhất quán, phá vỡ single-source-of-truth.
8. **Nuốt lỗi âm thầm** — catch block bỏ qua lỗi mà không phát Event/không surfacing (liên hệ Điều 12.1).
9. **Import trực tiếp plugin-tới-plugin** — quy tắc quan trọng nhất, nhắc lại thẳng thừng ở đây vì đây là vi phạm dễ mắc phải nhất, không phải vì nó khác Điều 2.3/4.1.
10. **Bypass Permission Gate** — bất kỳ đường tắt "gọi nội bộ tin cậy" nào né `can()`.
11. **Retry vô hạn** — lặp lại mãi vào 1 phụ thuộc lỗi vĩnh viễn.
12. **Phụ thuộc không khai báo** — plugin gọi 1 capability nó không khai trong manifest, kể cả khi "tình cờ chạy được" hôm nay.
13. **Kernel import bất kỳ thứ gì ở tầng trên nó** — tuyệt đối, 0 ngoại lệ, đây là định nghĩa của ranh giới Kernel.
14. **Nhiều nguồn sự thật cho cùng 1 sự kiện** — vd cả `RobotState` riêng lẫn `DeviceState` chung cùng tồn tại cho cùng 1 thiết bị *(vi phạm thật, đã ghi nhận)* — chọn đúng 1 nơi sở hữu, luôn luôn.
15. **UI là nơi DUY NHẤT dữ liệu tồn tại** — không tính năng nào mà bản sao được lưu duy nhất chỉ ở phía client (`localStorage`) cho bất kỳ thứ gì quan trọng hơn cache/demo có thể mất.
16. **Persona/prompt logic nhúng trong Model Provider** — trộn "cách gọi model X" với "nói giọng gì/theo kịch bản nào" (liên hệ Điều 8.5).

---

## Tự phản biện: điều nào trong 16 mục trên nhiều khả năng sẽ đổi, điều nào không bao giờ được đổi

**Nhiều khả năng sẽ tiến hoá** (không phải yếu điểm — 1 hiến pháp thừa nhận điều này mới đáng tin, không phải giả vờ mọi thứ vĩnh cửu):

- **Ngưỡng cụ thể ở mục 14** (bao nhiêu event/ngày thì đổi transport, bao nhiêu bản ghi thì tách vector store riêng) — sẽ hiệu chỉnh lại khi có dữ liệu sử dụng thật, đó là điều bình thường; **nguyên tắc** (cô lập scale sau hợp đồng ổn định) mới là phần cố định, không phải con số.
- **Cơ chế versioning cụ thể ở mục 7.4** (độ dài cửa sổ chuyển tiếp, cách Registry giữ nhiều version) — nhiều khả năng cần tinh chỉnh sau khi có lần nâng cấp plugin thật đầu tiên bộc lộ trường hợp biên chưa lường trước trên giấy.
- **Ngưỡng "hành động cần xác nhận người" ở Điều 13.4** — sẽ cần điều chỉnh khi mức độ tự chủ thật của Agent trưởng thành dần; quá chặt sớm giết trải nghiệm, quá lỏng sớm nguy hiểm — kỳ vọng lặp lại nhiều lần, không phải 1 lần đúng ngay.
- **Quy ước folder/naming cụ thể ở mục 15** — hợp lý để tinh chỉnh khi đã có nhiều hơn 2-3 plugin thật được viết và bộc lộ điểm cấn — giả định hôm nay chưa chắc hoàn hảo.
- **Ranh giới Event-vs-gọi-trực-tiếp ở mục 6** — sẽ có tình huống thực tế mơ hồ cần "án lệ" bổ sung theo thời gian, giống luật thành văn cần án lệ đi kèm.

**KHÔNG BAO GIỜ được đổi** (nền tảng thật sự — nếu điều này gãy, mục đích tồn tại của toàn bộ kiến trúc gãy theo, không có "phiên bản cải tiến" của nó, chỉ có vi phạm nó):

- **Chiều phụ thuộc (mục 2)** — tầng chỉ phụ thuộc xuống, không plugin nào import plugin khác trực tiếp.
- **Hợp đồng thay vì triển khai (mục 4)** — đây là định nghĩa của việc "là Brain OS" thay vì "1 đống script nối nhau".
- **Kernel không bao giờ biết tên vendor** (mục 8/9/10) — yêu cầu tường minh, nhắc lại xuyên suốt cả 4 tài liệu trong chuỗi này, không phải trùng lặp ngẫu nhiên — vi phạm nó là cách nhanh nhất tái tạo đúng vấn đề đã ghi nhận ở codebase hiện tại.
- **Mặc định từ chối + Permission Gate bắt buộc (mục 13)** — nền tảng bảo mật đắt hơn nhiều lần để vá sau so với giữ nguyên từ đầu — `access_level` không được enforce của codebase hiện tại là bằng chứng sống cho cái giá đó.
- **Ranh giới 6-khái-niệm của Kernel** (`KERNEL_ARCHITECTURE_V1.md` mục 4) — tài liệu này tồn tại chính để bảo vệ ranh giới đó khỏi bị xói mòn dần. Nếu ranh giới đó cần dịch chuyển, đó là 1 lần thiết kế lại kernel có chủ đích, đánh giá đầy đủ hệ quả — không phải 1 "cập nhật quy tắc" thông thường.

**Quy tắc sửa đổi chính tài liệu này** (1 hiến pháp không có thủ tục sửa đổi sẽ hoặc bị đóng băng sai, hoặc bị lờ đi): sửa mục 2/4/8/9/10/13 hoặc ranh giới Kernel **PHẢI** qua 1 lần xem xét kiến trúc tường minh, có ghi lại lý do — **KHÔNG** qua 1 PR thông thường. Sửa ngưỡng cụ thể ở mục 14/15 hoặc bổ sung án lệ cho mục 6 là quyết định kỹ thuật bình thường, không cần thủ tục nặng.

---

*Hiến pháp kiến trúc — không có code, migration, hay thay đổi nào lên project trong quá trình viết tài liệu này.*
