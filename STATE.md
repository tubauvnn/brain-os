# STATE — Trạng thái Brain OS MVP

**Ngày tạo:** 2026-07-04  
**Cập nhật:** 2026-07-04 (phiên 14)  
**Phiên bản:** 0.1.0 MVP + Robot Simulator + Tablet/PWA + Browser TTS + Chat/Voice/Camera + Gemini AI Provider (chống 429) + Domain HTTPS (chưa xong — chờ user xác nhận URL NPM)  
**Trạng thái:** Full stack chạy được — install, generate, migrate, seed, build đều pass. Database có dữ liệu mẫu thật. Robot chat dùng kiến trúc AI Provider hoàn chỉnh (Gemini thật hoặc fallback mẫu), context lấy từ Profile/Preferences/Memory/PrivateMemory (theo access_level)/Decisions/Projects/Tasks/5 tin nhắn gần nhất, giới hạn tổng 8000 ký tự. **Chống 429:** khi Gemini rate-limit, tự động fallback (`provider: "fallback_429"`) + cooldown 60s toàn cục, tránh dội thêm request — đã test end-to-end thật với key thật đang bị 429 (xác nhận cả lúc kích hoạt cooldown lẫn lúc cooldown hết hạn tự thử lại). Robot lưu ảnh chụp camera vào `MediaFile`. `/robot` hiển thị rõ 3 khối Chat/Voice/Camera. **Domain `os.irec.vn`:** vẫn chưa hoạt động (`https://os.irec.vn` → 525) — đang chờ user xác nhận URL họ dùng để truy cập NPM (xem phiên 12), **việc này đang treo, cần quay lại sau**.

---

## Đã làm

### Schema & Data
- [x] `prisma/schema.prisma` — 16 model (13 gốc + RobotState + ConversationMessage + MediaFile)
- [x] `prisma/seed.ts` — Profile, 5 Projects, 6 Devices (kể cả robot simulator), 5 Decisions, 2 Memories, 4 Connectors, 3 Preferences

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
- [x] `POST /api/robot/chat` — chat với robot, lưu ConversationMessage, trả lời template/Gemini
- [x] `POST /api/media/upload` + `GET /api/media` + `GET/DELETE /api/media/:id`

### UI Pages
- [x] Layout + Sidebar (13 nav items)
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
- [x] Robot Simulator (`/robot`) — mặt robot, panel trạng thái, nút điều khiển, event log
- [x] Tablet Launcher (`/tablet`) — grid mở nhanh + xin quyền mic/camera/notification
- [x] Logs (`/logs`)

### Robot Simulator (phiên 4 — 2026-07-04)

Robot ảo chạy hoàn toàn trên web — mô phỏng cho Robot ChinChin trước khi nối ESP32/C920/TV thật. Không dùng phần cứng, không có AI agent thật (chỉ mapping command → state cố định).

- **Model mới:** `RobotState` (1 dòng / device robot) — `mode`, `face`, `battery`, `last_command`, `last_command_at`. Quan hệ 1-1 với `Device` (`device_id @unique`).
- **Device seed:** `dev-robot-simulator` — "Robot ChinChin Web Simulator", `device_type: robot`, `status: online`.
- **Logic thuần (không AI):** `src/lib/robot.ts` — `applyRobotCommand()` map 10 command → `{mode, face, battery, message}`. Pin giả lập giảm 2%/lệnh (sàn 5%), lệnh `sleep` sạc lại 100%.
- **API:**
  - `GET /api/robot/status` — trạng thái hiện tại + 20 event gần nhất. `export const dynamic = "force-dynamic"` (bắt buộc, xem Lỗi đã sửa bên dưới).
  - `POST /api/robot/command` — body `{command, payload}`, validate qua Zod enum 10 giá trị. Ghi `DeviceEvent` (`event_type: "robot_command"`) + `ActivityLog` (`action: "robot.command"`).
  - `POST /api/robot/event` — passthrough tương đương `/api/devices/:id/events` nhưng tự resolve robot device, dùng cho ESP32 thật sau này.
  - Response format riêng theo yêu cầu: `{ok, state, message}` (khác `{ok, data}` của các route khác) — dùng `NextResponse.json` trực tiếp thay vì helper `ok()`.
- **UI `/robot`:** client component, fetch `/api/robot/status` khi mount, gọi `/api/robot/command` khi bấm nút. 6 mặt (idle/happy/speaking/sleep/surprised/thinking) hiển thị bằng emoji lớn. Event log merge từ `recent_events` (server) + log mới append client-side.
- **Đã test qua curl thực tế:** status, greet, speak (custom text), sleep (battery recharge 100%), invalid command (422 Zod error), event (heartbeat), ActivityLog ghi đúng 4 action `robot.command`/`robot.event`. Trang `/robot` trả 200.
- Robot là **interface của Brain OS**, không phải app tách rời — dùng lại `Device` + `ActivityLog` sẵn có, không hard-code logic robot vào core (đúng nguyên tắc BRAIN_SPEC.md #1, #3).

### Tablet / PWA (phiên 6 — 2026-07-04)

Không đổi schema, không thêm module/AI mới — chỉ thêm layer tablet-friendly + PWA installable lên trên các trang đã có.

- **`/robot` — tối ưu tablet ngang:**
  - Nút điều khiển tăng `min-h-[3.25rem]` → `min-h-[4rem]`, `text-base sm:text-lg`, dễ bấm hơn trên landscape tablet.
  - Thêm nút **toàn màn hình** (⛶) trên card mặt robot — dùng `Element.requestFullscreen()` / `document.exitFullscreen()` chuẩn của trình duyệt (Fullscreen API), không cần thư viện ngoài. Khi fullscreen, emoji phóng to theo `min(50vw, 50vh)` để luôn cân đối theo mọi kích thước màn hình — dùng làm màn hình hiển thị mặt robot riêng (kiosk-style) khi cần.
  - Card mặt robot đổi từ `<Card>` dùng chung sang `<div>` thường (giữ nguyên style) để gắn được `ref` cho Fullscreen API — không sửa component `Card` dùng chung, tránh ảnh hưởng các trang khác.
- **`/tablet` (trang mới — launcher nhanh):** `src/app/tablet/page.tsx`
  - Grid 8 tile lớn (Dashboard, Robot, Thiết bị, Tasks, Trí nhớ, Project, Người quen, Logs), `min-h-[7rem]`+, bấm để điều hướng — không phải module dữ liệu mới, chỉ là trang điều hướng tĩnh.
  - Card "Quyền truy cập thiết bị" — 3 nút placeholder gọi thẳng Web API chuẩn: `navigator.mediaDevices.getUserMedia({audio:true})` (mic), `getUserMedia({video:true})` (camera), `Notification.requestPermission()` (thông báo). Hiển thị trạng thái qua `Badge` (Chưa xin / Đã cho phép / Từ chối / Không hỗ trợ). Không lưu stream, không xử lý gì thêm — đúng nghĩa placeholder xin quyền trước cho tích hợp phần cứng thật sau này.
  - Thêm vào Sidebar: `{ href: "/tablet", label: "Tablet", icon: "▦" }`.
- **PWA manifest:** `public/manifest.json` — `start_url: "/tablet"`, `display: "standalone"`, `orientation: "landscape"`, `theme_color`/`background_color` khớp theme tối hiện tại, đủ icon `192`/`512` (kể cả `purpose: maskable`).
- **Icons placeholder:** `public/icons/{icon-192,icon-512,apple-touch-icon}.png` — tạo bằng script Node thuần (`zlib` built-in, không cài thư viện ảnh nào) vẽ ô vuông bo góc màu indigo + glyph "B" đơn giản. Chỉ là placeholder, nên thay bằng icon thật khi có brand asset.
- **`src/app/layout.tsx`:** thêm `metadata.manifest`, `metadata.icons` (icon + apple touch icon), `metadata.appleWebApp` (`capable`, `statusBarStyle`, `title`) và `export const viewport` (`themeColor`, `width`, `initialScale`) — theo đúng convention Next.js 14 (viewport tách khỏi metadata, tránh warning deprecated).
- **Không có:** service worker / cache offline (không được yêu cầu, tránh rủi ro cache sai API routes); không cài Chromium/Playwright (đã bị user yêu cầu dừng ở phiên trước).
- **Đã verify qua curl:** `manifest.json` (200, `application/json`), 3 icon (200, `image/png`), `/robot` và `/tablet` (200), head tags `<link rel="manifest">`, `<meta name="apple-mobile-web-app-capable">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">` đều xuất hiện đúng trong HTML render từ server. **Chưa** test bằng mắt trên tablet thật (cảm ứng, "Add to Home Screen", landscape thực tế) — cần user tự kiểm tra.

### Browser TTS `/robot` (phiên 7 — 2026-07-04)

Chỉ dùng **Web Speech API** (`window.speechSynthesis`) có sẵn trong trình duyệt — **không gọi API ngoài**, không thêm dependency, không đổi schema/API server.

- Bấm **"Chào"** → đọc cố định "Xin chào, tôi là ChinChin." (độc lập với message server trả về "Xin chào! 👋", vì user yêu cầu đúng câu này).
- Ô nhập text (`Nói thử`, đã có sẵn từ phiên 4) → đọc đúng nội dung vừa nhập khi bấm nút.
- Các lệnh khác (Ngủ, Vui, Ngạc nhiên...) **không** kích hoạt TTS — chỉ 2 trường hợp trên theo đúng yêu cầu, tránh thêm hành vi ngoài phạm vi.
- **Nút bật/tắt âm thanh:** góc phải header card "Điều khiển", state `soundEnabled` (mặc định bật). Khi tắt, gọi `speechSynthesis.cancel()` ngay để dừng giọng đang đọc dở.
- **Ưu tiên giọng tiếng Việt:** load danh sách voice qua `speechSynthesis.getVoices()` (kèm lắng nghe event `voiceschanged` vì voices thường load bất đồng bộ), tìm voice có `lang` bắt đầu bằng `"vi"`; nếu không có, dùng voice mặc định của trình duyệt — `utterance.lang` luôn set `"vi-VN"` để trình duyệt ưu tiên giọng đúng ngôn ngữ dù không tìm thấy voice `vi` cụ thể.
- Trước khi đọc câu mới luôn gọi `speechSynthesis.cancel()` để không bị chồng giọng khi bấm liên tục.
- Nút bị `disabled` + tooltip nếu trình duyệt không hỗ trợ `speechSynthesis` (kiểm tra qua `"speechSynthesis" in window`).
- **Đã verify:** `npm run build` pass, `/robot` trả 200, nút "Âm thanh: Bật" và text mặc định "Xin chào, tôi là ChinChin." xuất hiện đúng trong HTML render. **Chưa** nghe thử giọng đọc thật (cần trình duyệt thật có loa/tai nghe) — cần user tự test.

### Chống Gemini 429 (phiên 14 — 2026-07-04)

Chỉ sửa `src/lib/ai/` — không đổi schema, không đổi API contract chính (chỉ mở rộng thêm giá trị `provider`).

- **`GeminiRateLimitError`** (class riêng trong `providers/gemini.ts`) — ném ra khi `res.status === 429`, để `index.ts` phân biệt được với lỗi khác (timeout, lỗi mạng, response rỗng...).
- **Cooldown 60s toàn cục:** biến module-level `cooldownUntil` (không cần Redis/DB — server Next.js chạy 1 process dài hạn nên biến trong memory là đủ cho MVP). Sau khi dính 429, `askGemini()` sẽ **không gọi API Gemini nữa** trong 60s tiếp theo — tự ném `GeminiRateLimitError` kèm số giây còn lại, tránh dội thêm request vào lúc đang bị giới hạn.
- **`provider: "fallback_429"`** (giá trị mới trong `ResponseProvider` type) — phân biệt rõ với `"fallback"` thường (chưa cấu hình `GEMINI_API_KEY`) khi trả về client, để UI/log biết chính xác lý do dùng câu trả lời mẫu.
- **Giới hạn context:** `contextToPromptText()` cắt chuỗi ở `MAX_CONTEXT_CHARS = 8000` ký tự (kèm dòng thông báo bị cắt). Số lượng bản ghi mỗi loại giữ đúng 5 (memories/decisions/tasks qua `limit` mặc định, `recent_messages` đổi từ `take: 6` → `take: 5` cho khớp yêu cầu).
- **UI `/robot`:** `providerLabel()` thêm case `"fallback_429"` → hiển thị "Fallback (Gemini quá tải 429)".
- **Đã test end-to-end thật (dùng chính key thật đang bị rate-limit trong `~/.bashrc`):**
  1. Gọi chat lần 1 → Gemini trả 429 thật → response `provider: "fallback_429"`, `gemini_error: "Gemini trả về 429 (quá giới hạn request)"`.
  2. Gọi chat lần 2 ngay sau đó → **không gọi lại Gemini** (cooldown), response `gemini_error: "Gemini đang cooldown sau lỗi 429, còn 60s"`.
  3. Đợi đủ 62s, gọi lại → hệ thống **tự động thử lại Gemini** (không kẹt ở thông báo cooldown cũ), nhận 429 mới thật từ API, kích hoạt lại cooldown mới — xác nhận đúng vòng đời cooldown hoạt động chính xác.

### Gemini AI Provider cho Robot Chat (phiên 13 — 2026-07-04)

Nâng cấp kiến trúc AI provider đã có từ phiên 8 lên đúng cấu trúc/hợp đồng được yêu cầu chi tiết, **không đổi schema** (field `provider` trên `ConversationMessage` vốn đã là `String?`, chỉ đổi giá trị lưu vào đó).

**Cấu trúc file mới (`src/lib/ai/`):**
- `types.ts` — `BrainContext`, `BuildBrainContextParams`, `AiProviderName` (`"gemini" | "fallback"`), `AiProvider` interface.
- `context.ts` — `buildBrainContext({projectId?, accessLevel?, deviceId?, limit?})` (đổi tên từ `buildChatContext`), mở rộng lấy thêm **Preferences** và **lịch sử chat gần nhất** (6 tin, theo `deviceId`) so với phiên 8 (trước chỉ có Profile/Memory/Decision/Project/Task). `PrivateMemory` chỉ được query khi `accessLevel >= 3` (nhánh `Promise.resolve([])` nếu không đủ quyền — không phải lọc sau khi lấy, mà **không query luôn** để chắc chắn không có dữ liệu riêng tư nào lọt vào tầng ứng dụng khi không đủ quyền).
- `providers/gemini.ts` (đổi vị trí từ `gemini.ts` cũ) — `askGemini({message, context})`, model mặc định giữ nguyên `gemini-2.0-flash` (không hạ xuống `gemini-1.5-flash` như ví dụ trong yêu cầu vì model đó có nguy cơ đã bị Google deprecate tính tới 2026-07; `.env` vẫn override được qua `GEMINI_MODEL` nếu cần đổi). System prompt có đủ rule: trả lời tiếng Việt, ngắn gọn tự nhiên, vai trò robot/assistant Brain OS, chỉ dùng dữ liệu có trong context (không bịa), nói rõ khi không chắc, không suy đoán nội dung riêng tư nếu mục "Trí nhớ riêng tư" không xuất hiện trong context.
- `provider.ts` — giữ nguyên logic keyword-matching cũ (đã fix word-boundary từ phiên 8), chỉ đổi `name` từ `"template"` → `"fallback"` cho khớp hợp đồng response mới.
- `index.ts` — `generateRobotReply(userText, params)`: có `GEMINI_API_KEY` thì gọi Gemini trước, lỗi/timeout (10s) thì tự fallback về template **kèm thông tin lỗi** (`gemini_error`) để UI hiển thị nhẹ, không bao giờ để chat gãy.

**API `/api/robot/chat`:** trả đúng hợp đồng yêu cầu `{ok, reply, provider: "gemini"|"fallback", context_used: true, ...}` (giữ thêm `gemini_error`, `user_message_id`, `robot_message_id`, `created_at` — các field bổ sung, không phá hợp đồng chính). `ActivityLog` ghi thêm `context_used`/`gemini_error` vào payload.

**Security (đã tuân thủ đúng yêu cầu):**
- API key chỉ đọc qua `process.env.GEMINI_API_KEY`, không hard-code, không commit `.env` (đã verify `git ls-files` không có `.env`).
- Không gửi toàn bộ DB lên Gemini — chỉ gửi context đã lọc, giới hạn `limit` (mặc định 5) mỗi loại.
- **`accessLevel` mặc định = 1** khi gọi từ `/api/robot/chat` (không phải 3) — vì **chưa có auth/session thật**, không có cách nào biết "người chat" có phải owner hay không. Để client-side tự gửi `accessLevel` lên sẽ là lỗ hổng (ai cũng có thể tự khai `accessLevel:3` để lấy PrivateMemory), nên hardcode 1 ở route, chỉ nâng lên khi có auth thật gắn access_level theo user đăng nhập (ghi rõ trong comment code).
- **Đã test thật** cơ chế gating: insert tạm 1 `PrivateMemory` row → gọi `buildBrainContext({accessLevel:1})` trả `private_memories: []`, `buildBrainContext({accessLevel:3})` trả đúng nội dung → **đúng như thiết kế** — test qua 1 API route tạm (`/api/api/debugcontexttest`, đã xoá ngay sau khi test xong cùng với row test).

**UI `/robot`:** bubble tin nhắn robot giờ hiện label rõ ràng "Gemini" hoặc "Fallback (câu trả lời mẫu)" (hàm `providerLabel()`) thay vì in thẳng chuỗi provider thô; nếu `gemini_error` có giá trị, hiện thêm dòng cảnh báo nhỏ màu vàng "⚠️ Gemini lỗi (...), đã dùng câu trả lời mẫu" — không crash UI, không mất tin nhắn.

**Phát hiện ngoài ý muốn:** máy đã có sẵn `GEMINI_API_KEY` thật export trong `~/.bashrc` (không liên quan tới project, có vẻ dùng cho công cụ khác của user) — biến này **ghi đè** giá trị rỗng trong `.env` của project vì Next.js/dotenv không override biến đã tồn tại trong process env. Nhờ vậy đã test được luồng Gemini thật (không phải giả lập) — nhưng key này đang bị **rate-limit (HTTP 429)** tại thời điểm test, nên mọi request tự động fallback — đã xác nhận đúng hành vi "lỗi Gemini không crash, tự chuyển fallback, có ghi `gemini_error`".

**Đã verify:** `npm run build` pass, `npx prisma generate` chạy lại (không có thay đổi schema), chat qua curl trả đúng field `provider`/`context_used`/`gemini_error`, gating PrivateMemory đúng, `.env` không bị commit.

### Domain HTTPS `os.irec.vn` (phiên 10 — 2026-07-04)

**Mục tiêu:** chạy Brain OS tại `https://os.irec.vn` thay vì `http://42.96.12.122:3000` để mic/camera trên tablet hoạt động (browser yêu cầu secure context).

**Phát hiện quan trọng — khác giả định ban đầu:**
- **Không có nginx cài trực tiếp** trên VPS. Cổng 80/443 do container **Nginx Proxy Manager (NPM — `jc21/nginx-proxy-manager`, đã chạy 12+ ngày)** chiếm, đang phục vụ domain khác (`code.irec.vn` → `42.96.12.122:8080`, xác nhận qua đọc `database.sqlite` của NPM, read-only).
- Vì vậy cách làm "tạo file `/etc/nginx/sites-available/os.irec.vn`" **không thể hoạt động** — không có gì bind port 80/443 để nó có tác dụng; NPM mới là nginx thực sự đang chạy. Không cài nginx native mới (sẽ xung đột port, và không cần thiết vì NPM đã làm được việc này).
- **DNS `os.irec.vn` đã tồn tại sẵn** trên Cloudflare, proxy ON, trỏ đúng về server này — xác nhận qua `curl https://os.irec.vn` trả lỗi Cloudflare **525 "SSL handshake failed"** (nghĩa là Cloudflare kết nối đúng tới origin nhưng origin/NPM chưa có host/cert nào khớp tên `os.irec.vn`); `curl http://os.irec.vn` trả 200 nhưng là trang "Default Site" mặc định của NPM, không phải Brain OS. → **Không cần làm lại bước thêm DNS Cloudflare.**
- App Next.js xác nhận chạy đúng ở `127.0.0.1:3000` (`curl` trả 200).

**Không tự thao tác được NPM vì thiếu quyền — theo đúng quy tắc "không đoán mò":**
- Không có tài khoản đăng nhập NPM (UI ở cổng 81) và không có API token.
- Đã kiểm tra: cơ chế tạo admin mặc định của NPM (`setup.js`) chỉ chạy khi bảng `user` **hoàn toàn trống** — DB này đã có user + 1 certificate hoạt động (`code.irec.vn`), nên không có "reset an toàn" nào áp dụng được mà không đụng tới tài khoản hiện có của user.
- Đã cân nhắc và **từ chối** phương án ghi thẳng vào bảng `proxy_host` trong SQLite của NPM: việc này không tự động sinh lại nginx config hay xin SSL Let's Encrypt (những việc đó chỉ chạy qua backend Node.js của NPM khi tạo qua UI/API), dễ để lại trạng thái nửa vời và rủi ro cho `code.irec.vn` đang chạy tốt trên cùng NPM.

**Đã bàn giao cho user:** hướng dẫn ngắn gọn thêm Proxy Host qua NPM UI (`http://42.96.12.122:81`) — Domain `os.irec.vn`, Forward `42.96.12.122:3000` (giống pattern `code.irec.vn`), bật Websockets Support, xin SSL Let's Encrypt + Force SSL + HTTP/2.

**Trạng thái tại thời điểm cập nhật file này:** `https://os.irec.vn` vẫn trả lỗi 525 — đang chờ user hoàn tất bước NPM UI ở trên. Sau khi user xác nhận xong, cần chạy lại: `curl -I https://os.irec.vn`, `curl -I https://os.irec.vn/robot`, `curl -I https://os.irec.vn/tablet` để verify, rồi mới coi việc này là hoàn tất.

**Verify lần 2 (phiên 11 — 2026-07-04, sau khi user báo "đã thêm Proxy Host"):**
- Cả 3 URL (`os.irec.vn`, `/robot`, `/tablet`) **vẫn trả 525** qua Cloudflare.
- `ss -tulpn | grep 3000` + `curl -I http://127.0.0.1:3000` → app vẫn chạy tốt (200 OK) — không phải lỗi phía Brain OS.
- Đọc trực tiếp `database.sqlite` của NPM (read-only): bảng `proxy_host` **vẫn chỉ có 1 dòng** (`code.irec.vn`), bảng `certificate` **vẫn chỉ có 1 dòng** (`code.irec.vn`) — **không có bất kỳ dấu vết nào của `os.irec.vn`**. Đã kiểm tra thêm `redirection_host`, `dead_host`, `stream` — đều rỗng, không bị thêm nhầm chỗ.
- `openssl s_client -connect 42.96.12.122:443 -servername os.irec.vn` → lỗi `tlsv1 unrecognized name` — nginx trong NPM hoàn toàn chưa biết tên `os.irec.vn` (không có server block/cert nào khớp SNI này).
- `docker logs nginx-proxy-manager` → không có sự kiện "Reloading Nginx" nào tương ứng với thao tác tạo host mới gần đây (chỉ có các lần reload định kỳ tự động mỗi 6 tiếng do task "IP Ranges").
- **Kết luận:** thao tác thêm Proxy Host trong NPM UI của user **chưa được lưu thành công vào hệ thống** — không phải lỗi Cloudflare (edge vẫn kết nối đúng tới origin, thể hiện qua chính lỗi 525), không phải lỗi forward host/port (vì host chưa hề tồn tại để có forward config), không phải lỗi Next.js app. Đã báo lại cho user kiểm tra/làm lại bước NPM UI, không đoán mò hay tự sửa DB của NPM.

**Verify lần 3 (phiên 12 — 2026-07-04, sau khi user báo "đã thêm" lần 2):**
- `http://os.irec.vn` → 200 nhưng vẫn là trang **"Default Site"** của NPM (`<title>Default Site</title>`) — chưa phải Brain OS.
- `https://os.irec.vn` → vẫn 525, không đổi.
- App Next.js vẫn OK từ mọi hướng: `curl 127.0.0.1:3000`, `curl 42.96.12.122:3000` đều 200.
- **Từ bên trong container NPM:** `curl http://172.17.0.1:3000` và `curl http://42.96.12.122:3000` **đều gọi được, trả 200** — xác nhận network/forward host hoàn toàn không phải vấn đề, container NPM có thể reach tới app bình thường nếu có cấu hình.
- `proxy_host`/`certificate` table trong NPM: **vẫn chỉ có 1 dòng** (`code.irec.vn`), không có `os.irec.vn`.
- **Bằng chứng quyết định:** `stat` file `database.sqlite` của NPM → lần sửa đổi cuối cùng là **2026-06-22 14:32:51**, tức **12 ngày trước** thời điểm kiểm tra (2026-07-04 16:31). Đã xác nhận chỉ có đúng 1 container NPM trên máy, port 81 chỉ container đó sở hữu (`docker port nginx-proxy-manager`), không có container NPM nào khác.
- **Kết luận mới:** đây gần như chắc chắn **không phải lỗi cấu hình** mà là user đang thao tác nhầm — có thể đang truy cập một NPM instance/URL khác (domain quản trị riêng, hoặc VPS khác) chứ không phải container `nginx-proxy-manager` đang chạy trên chính VPS này. Đã hỏi lại user để xác nhận URL họ dùng truy cập NPM UI — **chưa nhận được câu trả lời rõ ràng** (câu trả lời tiếp theo của user là một yêu cầu khác — tích hợp Gemini API — nên việc xác nhận domain/NPM tạm dừng ở đây, cần quay lại sau).

### UI `/robot`: hiển thị rõ Chat/Voice/Camera + secure-context aware (phiên 9 — 2026-07-04)

**Vấn đề phát hiện:** truy cập `/robot` qua `http://<IP>:3000` (không phải `https://` hay `localhost`) khiến `getUserMedia`/`SpeechRecognition` bị trình duyệt chặn hoàn toàn do yêu cầu secure context — trước đó UI không báo lý do rõ ràng, chỉ lỗi âm thầm hoặc lỗi chung chung. Đồng thời Chat/Voice/Camera đang nằm sau hệ thống tab (từ phiên 8) nên không "hiển thị rõ ngay phía trên" như mong muốn khi test trên tablet.

**Thay đổi (chỉ sửa `src/app/robot/page.tsx` và data trong `src/app/tablet/page.tsx` — không đổi schema, không đổi API, không thêm AI):**

1. **Bỏ hệ thống tab** (TabKey/TABS/activeTab) — 3 khối **💬 Chat với Robot**, **🎤 Voice / Mic**, **📷 Camera capture** giờ là section cố định, luôn hiển thị ngay đầu trang (ngay sau cảnh báo secure context + banner lỗi chung), xếp dọc theo thứ tự đó. **Event log** vẫn còn nhưng chuyển xuống cuối trang dưới dạng section thường (không còn lý do giữ tab chỉ vì 1 mục còn lại).
2. **Phát hiện secure context:** thêm state `isSecureContext` + `secureContextChecked`, đọc `window.isSecureContext` trong `useEffect` sau mount (client-only, tránh hydration mismatch — mặc định `false`/"chưa xác nhận" giống pattern `speechSupported`/`sttSupported` đã có sẵn trong file). `window.isSecureContext` tự đúng cho cả `https://` lẫn `http://localhost` (trình duyệt coi localhost là secure), chỉ `false` khi truy cập qua IP/domain thường qua HTTP — đúng chính xác trường hợp lỗi mà user gặp phải.
3. **Banner cảnh báo:** hiện đúng dòng yêu cầu **"Mic/Camera cần HTTPS hoặc localhost"** (kèm origin hiện tại để dễ debug) ngay dưới `PageHeader`, chỉ hiện khi `secureContextChecked && !isSecureContext` — không bị flash sai (nhờ cờ `secureContextChecked` tách biệt với giá trị `isSecureContext`, nên chỉ render sau khi đã xác nhận thật, không đoán mò trước).
4. **Nút mic** (cả trong khối Chat lẫn khối Voice) và **nút "Bật camera"**: `disabled` tính từ `canUseMic = secureContextChecked && isSecureContext && sttSupported` và `canUseCamera = secureContextChecked && isSecureContext && cameraSupported` — đúng 2 điều kiện yêu cầu (secure context AND trình duyệt hỗ trợ API tương ứng). Tooltip (`title`) giải thích rõ lý do cụ thể (đang kiểm tra / cần HTTPS-localhost / trình duyệt không hỗ trợ / sẵn sàng) thay vì chung chung.
5. **Chat text + TTS không đổi hành vi** — không phụ thuộc `isSecureContext` (đúng yêu cầu, vì `speechSynthesis` không cần secure context, chat chỉ là fetch API thường).
6. **Nút "🔊 Test âm thanh"** — thêm trong khối Voice/Mic, gọi `speak("Brain OS đã sẵn sàng.")`, chỉ phụ thuộc `speechSupported` (không phụ thuộc secure context) — đúng yêu cầu "TTS vẫn hoạt động trên HTTP nếu browser cho phép".
7. **`/tablet`:** 2 tile "Robot Chat"/"Robot Camera" đổi từ `?tab=chat`/`?tab=camera` (không còn ý nghĩa vì bỏ tab) sang anchor `#chat`/`#camera` — trỏ thẳng tới `id="chat"`/`id="camera"` bọc quanh mỗi khối trên `/robot`, trình duyệt tự cuộn tới đúng section khi mở link (không cần JS, không cần đổi API).
8. **Lưu ý kỹ thuật:** component `Card` dùng chung không hỗ trợ prop `id` — dùng `<div id="...">` bọc ngoài mỗi `<Card>` thay vì sửa component `Card` (tránh ảnh hưởng các trang khác dùng chung).

**Đã verify qua curl:** HTML render ban đầu (trước khi JS chạy) đúng như thiết kế phòng thủ — 3 khối luôn có mặt, `id="chat"/"voice"/"camera"` đúng, nút mic mặc định `disabled` với tooltip "Đang kiểm tra..." (trạng thái bi quan trước khi client xác nhận secure context), ô nhập chat + nút Gửi luôn render không điều kiện, `/tablet` có đúng href `/robot#chat` và `/robot#camera`, API `/api/robot/chat` vẫn hoạt động bình thường sau khi sửa UI. **Chưa test được qua curl:** giá trị thật của `window.isSecureContext` khi truy cập qua IP (cần trình duyệt thật) — user cần tự mở `http://<IP>:3000/robot` để xác nhận banner cảnh báo hiện đúng và nút mic/camera bị disable đúng lúc.

### Robot Chat + Voice + Camera + MediaFile (phiên 8 — 2026-07-04)

**Schema mới (2 model, migration `20260704113751_add_chat_and_media`):**
- `ConversationMessage` — `role` (enum `ChatRole`: `user`/`robot`), `content`, `provider` (nullable — "template" hoặc "gemini"), `device_id`, `project_id` optional, `created_at`. Quan hệ `onDelete: Cascade` với `Device` (giống `DeviceEvent`/`RobotState`).
- `MediaFile` — đúng theo yêu cầu: `filename`, `original_name`, `mime_type`, `size`, `path`, `source_type` (enum `MediaSourceType`: `camera`/`upload`/`robot`/`tablet`), `device_id`/`project_id`/`person_id` optional, `access_level` (default `3`), `metadata` Json optional, `created_at`. **File lưu ngoài `public/`** tại `uploads/media/` (project root, không phải `public/uploads/media`) — vì `access_level` mặc định là `owner_only` và Next.js serve `public/` tĩnh công khai không qua kiểm soát nào; DB chỉ lưu `path` (string), không có route nào trả về byte ảnh (đúng yêu cầu "DB chỉ lưu metadata/path", không yêu cầu route xem ảnh). Thêm `/uploads/` vào `.gitignore`.
- Field convention: dùng `snake_case` nhất quán với toàn bộ schema hiện có (không dùng `camelCase` như mô tả gốc, vì mọi model khác trong dự án — `access_level`, `created_at`, `device_id`...— đều `snake_case`).

**AI provider (không hard-code Gemini vào core):**
- `src/lib/ai/provider.ts` — interface `AiProvider` + `templateProvider` (trả lời mẫu bằng keyword matching đơn giản, có `\b` word-boundary để tránh khớp nhầm — vd ban đầu `"hi"` khớp nhầm vào chữ "ng**hi**êu" tiếng Việt, đã fix bằng regex boundary).
- `src/lib/ai/gemini.ts` — gọi thẳng Gemini REST API bằng `fetch` (không thêm SDK/dependency), model mặc định `gemini-2.0-flash` (override qua `GEMINI_MODEL` env nếu model retire). Timeout 10s qua `AbortController`. Không bao giờ gửi ảnh — chỉ gửi text + context dạng text.
- `src/lib/ai/context.ts` — `buildChatContext()` lấy Profile, 5 Memory (pinned+gần nhất, access_level ≤1), 5 Decision active, 5 Project active, 5 Task todo/in_progress — cùng tinh thần `/api/context` nhưng gọn hơn, **không sửa route `/api/context` hiện có** để tránh rủi ro regression.
- `src/lib/ai/index.ts` — `generateRobotReply()`: nếu có `GEMINI_API_KEY` thì thử Gemini trước, lỗi/timeout thì fallback về `templateProvider` (chat không bao giờ bị gãy vì lỗi mạng/API).
- `.env` thêm `GEMINI_API_KEY=""` (rỗng mặc định) + `GEMINI_MODEL="gemini-2.0-flash"`.

**API:**
- `POST /api/robot/chat` — body `{text}`, lưu 2 `ConversationMessage` (user + robot), ghi `ActivityLog` (`action: "robot.chat"`), trả `{ok, reply, provider, user_message_id, robot_message_id, created_at}`.
- `GET /api/robot/status` mở rộng thêm `recent_messages` (30 tin nhắn gần nhất, cùng cách làm với `recent_events` đã có) — để UI load lại lịch sử chat khi F5 trang, không cần route GET riêng.
- `POST /api/media/upload` — nhận `multipart/form-data` qua `req.formData()` (Web API chuẩn của Next.js App Router, **không cài multer/dependency nào**), validate mimetype (chỉ nhận `image/png|jpeg|webp`), sinh filename ngẫu nhiên (`randomUUID()`), ghi `ActivityLog` với action đúng tên yêu cầu: `robot_camera_capture`.
- `GET /api/media` (filter theo `source_type`/`device_id`/`project_id`/`person_id`) + `GET/DELETE /api/media/:id` (xoá cả file trên disk lẫn record DB, ghi `ActivityLog` `media.delete`).

**UI `/robot`:** giữ nguyên toàn bộ phần Mặt robot + Panel trạng thái + Điều khiển (không đổi) từ các phiên trước, thêm **tab bar 4 tab** bên dưới theo đúng yêu cầu PHẦN 3:
- **Chat:** danh sách tin nhắn dạng bubble (user phải/indigo, robot trái/xám, badge provider nhỏ), input + nút mic inline + nút Gửi.
- **Voice:** nút mic lớn dạng tròn (dùng chung state nhận diện với tab Chat qua `sttTargetRef`), textarea hiển thị transcript, nút "Gửi vào Chat".
- **Camera:** `<video>` preview từ `getUserMedia({video:true})`, nút Bật/Tắt camera, nút "Chụp và lưu" (vẽ frame vào `<canvas>` ẩn → `canvas.toBlob()` → `FormData` → `POST /api/media/upload` với `source_type=robot`), ghi chú access_level=3 ngay dưới nút.
- **Event log:** y hệt nội dung cũ, chỉ chuyển vào trong tab thay vì đứng riêng.
- Tab mặc định = `chat`; đọc `?tab=` từ `window.location.search` trong `useEffect` (không dùng `useSearchParams` của Next để tránh phải bọc Suspense boundary — đơn giản hơn, đủ dùng).
- **Voice-to-text:** dùng `SpeechRecognition`/`webkitSpeechRecognition` (Web Speech API) — TypeScript không có type sẵn cho API này (`lib.dom` không include), đã khai báo interface tối thiểu riêng (`SpeechRecognitionLike`...) thay vì dùng `any`. `lang="vi-VN"`, `continuous=false`, `interimResults=true`.
- **`/tablet`:** thêm 2 tile "Robot Chat" (`/robot?tab=chat`) và "Robot Camera" (`/robot?tab=camera`).

**Bảo mật (đã tuân thủ đúng yêu cầu):**
- Không lưu ảnh base64 vào Postgres — chỉ lưu file + path.
- `MediaFile.access_level` mặc định `3` (owner_only) trong schema; API cho phép override qua form field nhưng mặc định vẫn 3 nếu không truyền.
- Không nhận dạng mặt thật, không gửi ảnh lên AI/cloud (Gemini chỉ nhận text context, không bao giờ nhận ảnh).
- File nằm ngoài `public/`, không có route serve byte ảnh ra ngoài.

**Đã test qua curl thực tế:** chat (3 câu, xác nhận template reply đúng theo từng loại câu hỏi sau khi fix word-boundary), status có `recent_messages`, upload ảnh thật (759 bytes PNG) → file xuất hiện đúng trong `uploads/media/`, list, get theo id, delete (xoá cả file lẫn DB row, 404 sau khi xoá), validate lỗi (thiếu file, sai mimetype), `ActivityLog` có đủ `robot.chat`/`robot_camera_capture`/`media.delete`, `/robot` + `/robot?tab=camera` + `/tablet` đều 200, tile "Robot Chat"/"Robot Camera" xuất hiện đúng trên `/tablet`. **Chưa test bằng tay thật:** mic thật (STT), giọng đọc thật (TTS đã test ở phiên 7), camera thật trên tablet, Gemini thật (chưa có `GEMINI_API_KEY` thật để thử — chỉ verify code path fallback về template khi thiếu key).

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
| `src/lib/robot.ts` | Logic mapping command → state cho Robot Simulator |
| `src/app/robot/page.tsx` | UI Robot Simulator (toàn màn hình + browser TTS) |
| `src/app/api/robot/{status,command,event}/route.ts` | API Robot Simulator |
| `src/app/tablet/page.tsx` | Tablet Launcher + xin quyền mic/camera/notification |
| `public/manifest.json` | PWA manifest |
| `public/icons/` | Icon placeholder (192/512/apple-touch) |
| `src/lib/ai/{types,context,provider,index}.ts` + `src/lib/ai/providers/gemini.ts` | AI provider (fallback/Gemini) cho robot chat — `buildBrainContext()`, `askGemini()` |
| `src/app/api/robot/chat/route.ts` | API chat robot (`{ok, reply, provider, context_used, gemini_error}`) |
| `src/lib/media.ts` | Helper thư mục upload + validate mimetype |
| `src/app/api/media/{upload,route,[id]}` | API MediaFile (upload/list/get/delete) |
| `uploads/media/` | File ảnh chụp thật (ngoài git, ngoài public/) |

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
- Robot Simulator: `turn_left`/`turn_right` không có mô phỏng góc quay/hướng thực (chỉ đổi `mode`, giữ nguyên `face`) — đủ cho MVP
- Robot Simulator: event log trên UI chỉ giữ tối đa 50 dòng trong state client, không có phân trang
- Robot Simulator UI: chưa được xác nhận bằng mắt qua trình duyệt thật (chỉ mới verify qua `npm run build` + response HTTP) — user sẽ tự test tablet/phone thật
- PWA: chưa có service worker/offline cache — chỉ installable (manifest + icons + meta tags), chưa hoạt động offline
- Icons: chỉ là placeholder hình học vẽ bằng script, cần thay icon thật khi có brand asset
- `/tablet`: chưa test "Add to Home Screen" / fullscreen kiosk thật trên thiết bị tablet thật
- Browser TTS: chỉ trigger khi bấm "Chào" hoặc "Nói thử" — các lệnh khác (Vui, Ngủ, Ngạc nhiên...) không đọc, đúng theo yêu cầu nhưng có thể user muốn mở rộng sau
- Browser TTS: chưa test giọng đọc thật trên thiết bị (phụ thuộc voice tiếng Việt có sẵn trên hệ điều hành/trình duyệt của user hay không — nếu không có voice `vi`, sẽ dùng giọng mặc định của trình duyệt với `lang="vi-VN"`)
- Browser TTS: trạng thái `soundEnabled` không lưu localStorage — reload trang sẽ về mặc định bật
- Robot chat: fallback reply chỉ là keyword matching đơn giản (pin/cảm ơn/tên/chào), không hiểu ngữ cảnh nhiều lượt — cần Gemini hoạt động để trả lời thông minh hơn
- Robot chat: key Gemini thật hiện có (`~/.bashrc`, ngoài project) **liên tục bị 429** kể cả sau cooldown 60s và sau 62s chờ — nghi ngờ key hết quota hẳn (không phải rate-limit tạm thời), chưa xác nhận được một câu trả lời Gemini thành công thật sự. Cần key khác hoặc chờ quota theo chu kỳ (ngày/tháng tuỳ gói) để test đường thành công.
- Cooldown 429: biến `cooldownUntil` chỉ tồn tại trong memory của process Next.js hiện tại — nếu server restart, cooldown bị reset về 0 (không ảnh hưởng tới tính đúng đắn logic, chỉ là không persist qua restart, chấp nhận được cho MVP)
- Robot chat: `accessLevel` cho chat hiện hardcode = 1 ở route (an toàn, không rò PrivateMemory) — khi có auth/session thật, cần sửa để lấy access_level theo user đăng nhập thay vì hardcode
- Voice-to-text: dùng `webkitSpeechRecognition`, chỉ Chrome/Edge/Safari hỗ trợ tốt — Firefox không hỗ trợ, nút mic sẽ tự disable
- Voice-to-text: `continuous=false` nên chỉ nhận 1 câu nói mỗi lần bấm mic, không phải hội thoại liên tục
- Camera: không có gallery xem lại ảnh đã chụp trong UI — chỉ có nút chụp+lưu, xem dữ liệu phải query DB/API trực tiếp
- MediaFile: không có route serve byte ảnh ra ngoài (theo đúng yêu cầu bảo mật) — muốn xem ảnh phải truy cập trực tiếp file trên server
- `/robot`: đã bỏ hệ thống tab (phiên 9) — nếu trang quá dài trên màn hình nhỏ, cần cuộn qua Chat → Voice → Camera → Mặt robot → Điều khiển → Event log; chưa có nav nội bộ (chỉ có anchor `#chat`/`#voice`/`#camera` để deep-link từ `/tablet`)
- `window.isSecureContext`: mặc định pessimistic (`false`) cho tới khi `useEffect` chạy xong sau mount — trên kết nối rất chậm có thể thấy nút mic/camera "Đang kiểm tra..." trong chốc lát trước khi bật/tắt đúng, không phải bug

## UI Polish `/robot` (phiên 5 — 2026-07-04)

Chỉ sửa presentation của `src/app/robot/page.tsx`, **không đổi API, không đổi schema, không thêm tính năng**:

- Layout vẫn nằm trong layout Brain OS hiện tại (Sidebar + main), dùng lại `Card`/`Badge`/`PageHeader` có sẵn.
- Mặt robot: to hơn (`text-[100px]` → `text-[160px]` theo breakpoint), căn giữa, có glow nền dạng radial gradient theo từng biểu cảm (màu khác nhau cho happy/sleep/surprised/thinking/speaking/idle), mode hiển thị dạng `Badge` thay vì chữ mono nhỏ.
- Panel trạng thái: chuyển từ danh sách phẳng sang `StatRow` có `divide-y`, dễ đọc hơn; thêm thanh pin trực quan (`div` width theo % battery, đổi màu xanh/vàng/đỏ theo mức) — thuần hiển thị lại field `battery` có sẵn, không có logic mới.
- Nút điều khiển: chuyển `flex-wrap` → `grid grid-cols-2 sm:grid-cols-3`, tăng kích thước tối thiểu `min-h-[3.25rem]` (~52px, đủ chuẩn touch target), thêm hiệu ứng `active:scale-95` cho phản hồi chạm trên tablet.
- Event log: mỗi dòng chuyển thành card riêng (`rounded-lg bg-zinc-900/60 border`) thay vì hàng kẻ, dùng `Badge` cho command, responsive `flex-col` (mobile) → `flex-row` (tablet trở lên).
- Responsive: container `max-w-4xl` → `max-w-5xl`, padding `p-6` → `p-4 sm:p-6`, layout 2 cột (`md:grid-cols-3`) đổi thành `lg:grid-cols-3` để tablet dọc (portrait, ~768px) hiển thị xếp chồng (mặt robot full-width, dễ nhìn hơn), tablet ngang (~1024px, đúng breakpoint `lg`) mới lên 2 cột.
- **Lỗi đã sửa:** dùng nhầm `bg-gradient-radial` (không phải utility mặc định của Tailwind) → đổi thành `bg-[radial-gradient(circle,var(--tw-gradient-stops))]` (arbitrary value, đúng cách làm radial gradient không cần plugin).
- **Đã thử dùng Playwright để chụp screenshot tự động kiểm tra UI nhưng user yêu cầu dừng** — không cài Chromium/Playwright vào project, chỉ dựa vào `npm run build` pass + dev server chạy được. User sẽ tự kiểm tra bằng mắt trên trình duyệt/tablet thật.

## Lỗi đã sửa (phiên 4 — 2026-07-04, Robot Simulator)

1. **`GET /api/robot/status` bị Next.js static-optimize thành `○` (prerendered) thay vì `λ` (dynamic)** — route không dùng `NextRequest`/cookies nên Next coi là static và sẽ cache dữ liệu tại thời điểm build. Fix: thêm `export const dynamic = "force-dynamic";` — đã verify lại build log chuyển đúng thành `λ /api/robot/status`.

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
