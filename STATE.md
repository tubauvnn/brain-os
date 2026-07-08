# STATE — Trạng thái Brain OS MVP

**Ngày tạo:** 2026-07-04  
**Cập nhật:** 2026-07-08 (phiên 39)  
**Phiên bản:** 0.1.0 MVP + Robot Simulator (mặt SVG animate + camera tracking) + Tablet/PWA + Chat/Voice/Camera + Hands-free Voice Mode (OpenAI STT + OpenAI TTS) + Smart Robot Fullscreen Mode + Session/ngữ cảnh hội thoại + OpenAI provider chính + CLI Agent Router chế độ `deep` + Xiaozi/Xiaozhi Bridge (template-first, phiên 24) + Postgres persistence: named volume + backup + health check (phiên 25) + Xiaozi webhook auth: secret token + rate limit + docs (phiên 26) + Domain `os.irec.vn` đã sống + secret thật đã set (phiên 27) + Xiaozi webhook secret đã rotate + fix production build (phiên 28) + Xiaozi Bridge panel test được qua domain public bằng secret nhập tay (phiên 29) + OpenAI-compatible bridge `/v1/chat/completions` + `/v1/models` cho Xiaozhi (phiên 30) + fix `/xiaozhi` web demo trả lời chung chung (phiên 31) + `brain_local_demo` phong phú hơn (phiên 32) + `/robotonline` status page + `/api/robotonline/status` (phiên 33) + demo Xiaozhi client voice thật qua SSH tunnel + docs (phiên 34) + cứu sự cố Postgres bị bot tấn công (0.0.0.0:5432 → local-only, rotate password, restore backup) + audit khoá port public thừa toàn VPS (phiên 35) + dọn .env backup cũ + xác nhận Brain OS/Xiaozhi standalone sống, local-only sau audit (phiên 36) + dừng hẳn Xiaozhi, chỉ giữ `/robot`, chuẩn bị robot thật Hà Nội (phiên 37) + `/robot` face không mascot (RobotFaceKiosk) + eye tracking mượt (pointer/camera/blink/idle) + mic VU meter/push-to-talk + OpenAI Realtime ephemeral token đã verify thật (phiên 38) + **đổi tên robot "ChinChin" → "Chuối" (phiên 39)**  
**Trạng thái:** Full stack chạy được — install, generate, migrate, seed, build đều pass. **Phiên 33 — fix 404 `/robotonline`:** route `src/app/robotonline/page.tsx` + `src/app/api/robotonline/status/route.ts` chưa từng tồn tại (không phải bug, đơn giản là chưa tạo) nên Next trả `NEXT_NOT_FOUND` cho cả page lẫn API. Đã tạo page hiển thị 4 card trạng thái (Brain OS, Xiaozhi HTTP/OTA `127.0.0.1:8003`, Xiaozhi WebSocket `127.0.0.1:8000`, Brain OS Bridge `https://os.irec.vn/v1`) tự poll `/api/robotonline/status` mỗi 10s, có link quay lại `/robot` và `/xiaozhi`. API check Xiaozhi HTTP/OTA bằng `fetch` với `AbortController` timeout 800ms (bắt mọi response, kể cả lỗi HTTP, miễn có phản hồi là coi như online), check WebSocket bằng TCP `net.Socket` connect thô tới port 8000 (không cần handshake WS đầy đủ) — cả hai đều `try/catch` nên Xiaozhi offline không làm crash route. Không đổi Cloudflare/NPM, không đụng `/robot`, `/xiaozhi`, `/api/xiaozi/chat`, `/v1/chat/completions` (đã regression-test qua cả localhost lẫn domain thật, vẫn `200`/`400` như cũ, không có `404`). Đã test đủ 4 endpoint qua cả `127.0.0.1:3000` lẫn `https://os.irec.vn` → tất cả `200`. **Phiên 30 — thêm OpenAI-compatible bridge:** nhiều app Xiaozhi chỉ cho nhập cấu hình kiểu OpenAI (Base URL/API Key/Model), không có chỗ nhập webhook body/header tuỳ biến như `/api/xiaozi/chat` — đã thêm `POST /v1/chat/completions` + `GET /v1/models` giả lập đúng hợp đồng OpenAI Chat Completions. Logic xử lý chính (`ensureSession`, lookup device, gọi `xiaoziBridgeBrain`, complexity-detector, OpenAI-fallback, lưu `ConversationMessage`, ghi `ActivityLog`) đã **tách ra `src/lib/brain/xiaozi-handler.ts` (`handleXiaoziMessage()`)** dùng chung cho cả `/api/xiaozi/chat` lẫn `/v1/chat/completions` — không copy/paste logic, `/api/xiaozi/chat` giờ chỉ còn parse/validate/auth/rate-limit rồi gọi handler. Auth dùng lại đúng `XIAOZI_WEBHOOK_SECRET`/`verifyXiaoziWebhook()` (Bearer hoặc `x-brainos-secret`, local bypass để test), chỉ đổi hình dạng lỗi 401 sang chuẩn OpenAI (`{"error":{"message":"Unauthorized Brain OS compatible API","type":"unauthorized"}}`). `/v1/chat/completions` hỗ trợ cả non-stream lẫn `stream:true` (SSE tối thiểu — 1 chunk nội dung + 1 chunk `finish_reason:"stop"` + `[DONE]`, không stream token thật vì nguồn trả lời là bridge nội bộ/OpenAI đã trả nguyên câu). Deployment cho Xiaozhi OpenAI-compatible dùng chung 1 `deviceId`/`sessionId` cố định (`xiaozhi-openai-compatible`/`openai-compatible-xiaozhi-openai-compatible`) — hạn chế: nhiều thiết bị gọi qua bridge này sẽ chia sẻ chung 1 session. Đã test đầy đủ qua domain public thật: `/v1/models` với Bearer → `200`; `/v1/chat/completions` với Bearer → `200`, `choices[0].message.content` đúng; không có secret → `401`. `/api/xiaozi/chat` vẫn hoạt động đúng sau refactor (regression test qua domain thật, lệnh "ngủ đi" → `action:"sleep"` như cũ). Xiaozi Bridge panel (phiên 29) vẫn hoạt động, secret không đổi thêm ở phiên này. Postgres (phiên 25) vẫn bền dữ liệu qua named volume `brainos_pgdata`. Domain `https://os.irec.vn` vẫn hoạt động bình thường (phiên 27). Robot chat (`/api/robot/chat`) mặc định gọi **OpenAI API** (`gpt-5.4-nano`, ~2s); `deep: true` mới dùng CLI Agent Router. Chat/voice nhớ ngữ cảnh trong 1 phiên (phiên 21). Hands-free Voice Mode (OpenAI STT/TTS, phiên 22). Smart Robot Fullscreen Mode (phiên 23). Xiaozi/Xiaozhi Bridge (phiên 24): webhook theo mô hình **template-first**, mặc định OpenAI **tắt** (`ENABLE_OPENAI_FALLBACK=false`). **Auth thật của Codex CLI và Gemini CLI trên VPS này vẫn chưa xong** (xem phiên 17). Robot lưu ảnh chụp camera vào `MediaFile`.

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
- [x] `POST /api/robot/chat` — chat với robot, lưu ConversationMessage (best-effort), trả lời qua CLI agent router (Codex/Claude/Gemini CLI → fallback, xem phiên 16)
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

### Smart Robot Fullscreen Mode — camera tracking + mắt nhìn theo người (phiên 23 — 2026-07-05)

Yêu cầu: khi bật fullscreen, robot vẫn nghe mic, vẫn dùng camera nhìn theo người, mắt/mặt nhìn theo vị trí người đứng trước camera — không tạo ảnh, không phá chat/STT/TTS hiện có.

**File mới:**
- `src/lib/robot/tracking.ts` — `targetToPanTilt({x, y})`: chuyển toạ độ tracking (-1..1) thành góc pan (±45°)/tilt (±25°) giả định + cờ `centered` (lệch < 0.18 cả 2 trục). **Servo-ready nhưng chưa gọi phần cứng** — hiện chỉ dùng để `console.debug()` trong `page.tsx`, đúng yêu cầu "tạm chỉ console/debug hiển thị pan/tilt".
- `src/components/robot/RobotVision.tsx` — component camera + phát hiện người/mặt nhẹ, không model nặng:
  - `getUserMedia({video:{facingMode:"user"}, audio:false})`, chỉ chạy khi `enabled=true` (props), dừng hẳn (`stop tracks`) khi `enabled=false`/unmount.
  - Xử lý 1 khung mỗi 400ms qua `setInterval`, vẽ vào canvas ẩn 64×64px (đủ nhẹ, không cần độ phân giải cao cho ước lượng vị trí).
  - **Option A:** dùng `FaceDetector` của trình duyệt nếu có (`window.FaceDetector`, API thử nghiệm, chủ yếu Chrome — khai báo type tối thiểu vì chưa có trong `lib.dom.d.ts`).
  - **Option B (fallback):** motion detection tự viết — so 2 khung liên tiếp từng pixel, tính "trọng tâm" vùng thay đổi nhiều nhất (weighted centroid theo độ lệch màu RGB) làm vị trí ước lượng. Không phải nhận diện khuôn mặt thật, chỉ đủ để mắt robot "có vẻ" nhìn theo chuyển động trước camera — chấp nhận được cho MVP demo, không dùng model nặng (đúng yêu cầu "không bắt buộc model nặng ở bước này").
  - Trả về `{detected, x, y, size, label, confidence}` qua callback `onTargetUpdate` — không tạo ảnh, không gửi frame lên server, xử lý hoàn toàn phía client.
  - Preview debug (`debug=true`) là `<video>` nhỏ góc màn hình, mirror CSS (`scale-x-[-1]`, giống gương selfie) — **không ảnh hưởng toạ độ tracking** vì `drawImage()` luôn đọc frame gốc chưa mirror của phần tử `<video>`, bất kể CSS transform áp lên nó để hiển thị.
  - **Lưu ý mirror/hướng trái-phải:** toạ độ `x` tính theo frame camera gốc (chưa mirror) — nếu sau này test tay thấy "cảm giác ngược" (người dịch sang phải mà mắt robot nhìn sang trái), chỉ cần đảo dấu `x` ở `handleVisionTarget()` trong `page.tsx`, không cần sửa `RobotVision.tsx`.

**Nâng `src/components/robot/RobotFace.tsx`:**
- Thêm prop `gazeX?`, `gazeY?` (-1..1) và `targetDetected?: boolean`.
- Bọc `<Eyes />` trong 1 `<g>` — nếu có `gazeX`/`gazeY` và `targetDetected !== false`, dịch chuyển bằng thuộc tính SVG `transform` gốc (không phải CSS `style.transform`) để tỉ lệ lệch đúng theo kích thước SVG dù render lớn (kiosk) hay nhỏ (card thường) — CSS pixel transform sẽ bị sai tỉ lệ giữa 2 kích thước khác nhau.
- **`targetDetected === false` (khác `undefined`)** mới bật hiệu ứng "quét mắt trái-phải" — dùng `<animateTransform>` SVG gốc (SMIL, không JS/CSS keyframe), lặp 4s. Phân biệt chặt `false` vs `undefined` để các chỗ dùng `RobotFace` khác (không có RobotVision) giữ nguyên hành vi tĩnh như phiên 20, không tự nhiên bật hiệu ứng quét ngoài ý muốn.
- Các state khác (listening mắt to, thinking mắt nhìn lên/dấu chấm chạy, speaking miệng động, happy mắt cong má sáng...) **giữ nguyên 100%** từ phiên 20 — gaze chỉ là 1 lớp dịch chuyển thêm vào, không thay logic chọn Eyes/Mouth theo state.

**Sửa `src/app/robot/page.tsx`:**
- State mới: `isFullscreenRobot`, `cameraTrackingEnabled`, `visionDebug`, `visionTarget`, `gazeX`/`gazeY`, `targetDetected`, ref `kioskRef` — tách hoàn toàn khỏi `isFullscreen`/`faceCardRef` cũ (nút "⛶" đơn giản chỉ phóng to mặt, giữ nguyên không đổi).
- `<RobotVision>` mount **1 lần, luôn luôn** ở gốc cây component (không lồng trong kiosk view) — để "📷 Tracking" hoạt động độc lập với fullscreen (bật tracking xem thử trước khi vào kiosk cũng được, đúng yêu cầu 2 nút tách biệt).
- `handleVisionTarget()`: làm mượt (lerp 0.5) `gazeX`/`gazeY` từ target mới mỗi ~400ms thay vì snap thẳng — mắt di chuyển tự nhiên hơn, đỡ giật. Gọi `targetToPanTilt()` + `console.debug()` mỗi lần có target (servo-ready, chưa gọi phần cứng).
- `enterFullscreenRobotMode()`: bật `isFullscreenRobot` + `cameraTrackingEnabled`, tự `startVoiceMode()` nếu voice mode chưa bật ("bật voice mode nếu người dùng cho phép" — `startVoiceMode()` đã tự xin quyền mic sẵn có từ phiên 21, xin bị từ chối thì set trạng thái "unsupported" như cũ, không crash).
- Kiosk view render có điều kiện (`isFullscreenRobot`) — `<div ref={kioskRef} className="fixed inset-0 z-50 ...">` chứa RobotFace lớn (`w-[min(78vw,78vh)]`), status ngắn ("Đang nghe"/"Nhìn thấy bạn"...), transcript nhỏ, provider nhỏ, 3 nút (Exit/Tracking/Debug cam). `useEffect` riêng gọi `kioskRef.current.requestFullscreen()` **sau khi** div đã mount (không gọi ngay lúc bấm nút, tránh gọi trên node chưa tồn tại) — nếu Fullscreen API bị từ chối (vd iOS Safari), lớp `fixed inset-0` vẫn giả lập layout toàn màn hình qua CSS, chỉ mất phần ẩn thanh địa chỉ trình duyệt.
- `fullscreenchange` listener (đã có từ trước cho `isFullscreen`) mở rộng thêm: nếu `document.fullscreenElement !== kioskRef.current` thì tự tắt `isFullscreenRobot` — bắt được cả trường hợp user thoát fullscreen bằng phím Esc/nút trình duyệt, không chỉ qua nút "Exit Fullscreen" của mình.
- Ngoài kiosk, card mặt robot (layout thường) cũng có sẵn 2 nút mới "📷 Tracking"/"🐞 Debug cam" cạnh nút "⛶" cũ + Badge "Nhìn thấy bạn"/"Đang tìm người" khi tracking bật — dùng thử camera tracking mà không cần vào fullscreen.

**Đã test:** `npm run build` pass, `/robot` trả 200, HTML chứa đủ 3 nút mới ("Fullscreen Robot", "📷 Tracking", "Debug cam"), kiosk view đúng là KHÔNG render khi `isFullscreenRobot` mặc định `false` (xác nhận conditional render hoạt động đúng). `POST /api/robot/chat` test lại xác nhận không bị ảnh hưởng. **Chưa test camera/FaceDetector/motion-detection bằng mắt thật** (không có trình duyệt/mic/camera thật trong môi trường này) — cần user tự thử, đặc biệt kiểm tra hướng mắt trái-phải có đúng chiều không (xem ghi chú mirror ở `RobotVision.tsx`).

### OpenAI TTS thay browser speechSynthesis làm giọng đọc chính (phiên 22 — 2026-07-05)

Yêu cầu: browser TTS (`speechSynthesis`) nghe chưa hay, tạm dùng OpenAI TTS (chưa dùng ElevenLabs).

**ENV mới (đã thêm vào `.env`):** `OPENAI_TRANSCRIBE_MODEL="gpt-4o-mini-transcribe"` (phiên 21, quên ghi lúc đó), `TTS_PROVIDER="openai"`, `OPENAI_TTS_MODEL="gpt-4o-mini-tts"`, `OPENAI_TTS_VOICE="coral"`. Cũng sửa lại comment cũ trong `.env` (dòng nói "không còn OPENAI_API_KEY vì không ai đọc nữa" — sai từ phiên 18, OpenAI đã là provider chính).

**File mới:** `src/app/api/robot/tts/route.ts` — nhận JSON `{text, voice?}`, gọi thẳng OpenAI `/v1/audio/speech` (model `OPENAI_TTS_MODEL`/mặc định code `gpt-4o-mini-tts`, voice từ body hoặc `OPENAI_TTS_VOICE`/mặc định code `"coral"`, `instructions` cố định "Nói tiếng Việt giọng Bắc, thân thiện, ngắn gọn, tự nhiên, giống robot mascot ChinChin.", `response_format:"mp3"`), timeout 20s, không log text đầy đủ (chỉ dùng nội bộ, không console.log) và không log API key. **Trả thẳng audio nhị phân** (`Content-Type: audio/mpeg`), không bọc JSON — để client `fetch().blob()` rồi phát bằng `HTMLAudioElement` trực tiếp.

**Sửa `src/app/robot/page.tsx`:**
- `speak()` cũ đổi tên thành `speakBrowser()` (giữ nguyên 100% logic, dùng làm fallback).
- `speak()` mới: thử gọi `/api/robot/tts` trước (kèm `voice: ttsVoice`), phát bằng `new Audio(URL.createObjectURL(blob))`. `isSpeaking` bật lúc bắt đầu phát (trước `await audio.play()`), tắt lúc `onended`/`onerror`. **Bất kỳ lỗi nào** (network, HTTP lỗi, `res.blob()` lỗi, hay `audio.play()` bị chặn bởi autoplay policy — promise reject, rơi vào cùng `catch`) đều fallback gọi `speakBrowser(text, onEnd)` — không bao giờ để robot "câm" hoàn toàn. Tham số `onEnd` giữ nguyên vị trí/ý nghĩa như phiên 19 (hands-free vẫn chain nghe tiếp đúng cách, không đổi gì ở phía gọi).
- Thêm `currentAudioRef` (ref tới `HTMLAudioElement` đang phát) để `interruptRobotSpeaking()` dừng được audio OpenAI TTS (khác `speechSynthesis.cancel()` chỉ dừng được browser TTS) — cả 2 đều được gọi khi ngắt lời robot, dù cái nào đang phát cũng dừng đúng.
- Dropdown chọn voice (`coral`/`marin`/`cedar`/`nova`/`shimmer`/`alloy`) trong card "Điều khiển", lưu `localStorage["robot_tts_voice"]`, đọc lại lúc mount. Nút bật/tắt âm thanh (🔊/🔇) giữ nguyên vị trí — **bỏ điều kiện `disabled={!speechSupported}`** cũ (vô lý với kiến trúc mới: OpenAI TTS không cần `speechSynthesis` để hoạt động, chỉ browser-fallback mới cần).
- Face/mode khi TTS phát/kết thúc **không cần sửa gì thêm** — đã tự đúng từ phiên 20 nhờ `isSpeaking` điều khiển `RobotFace` qua cơ chế ưu tiên có sẵn (`isSpeaking > ... > face`), không phân biệt provider TTS nào đang phát.

**Đã test qua curl thật:** `POST /api/robot/tts {"text":"Xin chào, tôi là robot ChinChin.","voice":"coral"}` → file MP3 thật 55KB (`MPEG ADTS, layer III, v2, 128 kbps, 24 kHz, Monaural` theo `file`), phát được. Test round-trip TTS→transcribe (dùng chính audio vừa tạo) → nhận lại đúng text gốc, xác nhận audio hợp lệ không chỉ đúng định dạng mà đúng nội dung thật.

### OpenAI STT + lưu ngữ cảnh hội thoại theo session (phiên 21 — 2026-07-05)

Yêu cầu: mic chuẩn hơn (browser SpeechRecognition nhận tiếng Việt chưa tốt) + lưu đầy đủ hội thoại vào DB + robot nhớ được vài câu vừa nói trong phiên.

**Schema (migration `20260705104517_conversation_session_and_metadata`, chỉ thêm field/bảng optional — không phá dữ liệu cũ):**
- Model mới `ConversationSession` (`id`, `title?`, `source` mặc định `"robot"`, `created_at`, `updated_at`, quan hệ 1-N với `ConversationMessage`).
- `ConversationMessage` thêm 3 field optional: `source String?` (`"voice"|"text"`), `metadata Json?`, `session_id String?` (FK tới `ConversationSession`, `onDelete: SetNull`).
- **Đã tự đổi so với yêu cầu gốc:** field trong draft schema của user dùng camelCase (`createdAt`, `sessionId`...) — đổi sang `snake_case` (`created_at`, `session_id`...) cho khớp convention đã có xuyên suốt toàn bộ `schema.prisma` (mọi model khác đều `snake_case`), tránh trộn 2 kiểu đặt tên trong cùng file. Role của message robot **vẫn dùng `"robot"`** (enum `ChatRole` cũ), không đổi thành `"assistant"` như câu chữ gốc của user — vì đổi enum sẽ không khớp toàn bộ data lịch sử đã lưu từ phiên 8 tới giờ; `"robot"` và `"assistant"` chỉ khác tên gọi, không khác ý nghĩa.

**File mới:**
- `src/lib/brain/session-context.ts` — `ensureSession(id)` (upsert `ConversationSession`, best-effort — id do client tự sinh nên chưa chắc có row DB tương ứng, phải tạo trước khi dùng làm khoá ngoại), `loadSessionHistoryText(id, limit=20)` (lấy N tin gần nhất, dựng lại thành text theo thứ tự thời gian), `countSessionMessages(id)` (cho debug panel).
- `src/app/api/robot/transcribe/route.ts` — nhận `multipart/form-data` (`audio`, `language` optional mặc định `vi`), forward file lên OpenAI `/v1/audio/transcriptions` (model `OPENAI_TRANSCRIBE_MODEL`, mặc định code `gpt-4o-mini-transcribe`), timeout 20s, không log audio/API key. Trả `{ok, text, provider:"openai_transcribe"}` hoặc `{ok:false, text:"", error}`.
  - **Bug phát hiện + tự sửa qua test tay:** ban đầu đặt cứng tên file gửi lên OpenAI là `"speech.webm"` bất kể định dạng thật — test bằng file mp3 thật (tạo từ chính `/api/robot/tts`) bị OpenAI trả `400` vì đuôi file không khớp nội dung (OpenAI dùng phần mở rộng để nhận diện codec). Fix: `resolveFilename()` ưu tiên tên file gốc nếu có đuôi hợp lệ, nếu không thì suy ra đuôi từ `Content-Type` thật (map `audio/webm→webm`, `audio/mp4→mp4`, `audio/mpeg→mp3`...). Đã test lại: transcribe đúng y nguyên text gốc ("Xin chào, tôi là robot Chin-Chin.") qua vòng TTS→STT thật. **Phía client** (`page.tsx`) cũng sửa tương tự — đặt tên blob theo `recorder.mimeType` thật thay vì cứng `.webm` (Safari có thể ghi `audio/mp4` thay vì webm).

**Sửa `src/app/api/robot/chat/route.ts`:**
- Schema thêm `sessionId`, `source` (`"voice"|"text"`, mặc định `"text"`), `sttMode`, `sttProvider`, `durationMs`, `confidence`.
- `ensureSession()` trước khi dùng `sessionId` làm khoá ngoại; nếu tạo lỗi (DB down), coi như không có session — chat vẫn trả lời bình thường, chỉ mất phần nhớ ngữ cảnh (best-effort, đúng tinh thần "DB lỗi không crash" xuyên suốt project).
- Load `loadSessionHistoryText()` → ghép với `SYSTEM_CONTEXT` qua `combineContext()`, cắt cứng ở **8000 ký tự tổng** (áp dụng ở đây, một chỗ duy nhất, cho cả nhánh OpenAI lẫn CLI agent — trước đó chỉ `openai-provider.ts` tự cắt, `cli-agent-router.ts` không cắt).
- **Bỏ điều kiện `if (device)` khi lưu message** (khác thiết kế phiên 16-20): trước đây nếu `getRobotDevice()` thất bại thì KHÔNG lưu message nào cả; giờ luôn thử lưu (dùng `device?.id` — `undefined` nếu không có device), vì `session_id` giờ là khoá chính cho ngữ cảnh, không nên phụ thuộc vào việc tìm được device robot simulator hay không.
- Message user lưu `metadata: {sttMode, durationMs, confidence, accessLevel}`; message robot lưu `metadata: {robot_say, face, action, latencyMs}`.
- Response thêm `session_id`, `session_message_count` (đếm tổng tin trong session, cho debug panel), `latency_ms` (đo riêng thời gian gọi AI, không tính thời gian DB).

**Sửa `/robot` (`page.tsx`) — Hands-free Voice Mode giờ có 2 chế độ STT:**
- `sessionId` sinh 1 lần bằng `crypto.randomUUID()`, lưu `localStorage["robot_session_id"]`, đọc lại lúc mount (theo đúng pattern `useEffect` client-only đã dùng cho secure-context check, tránh lỗi SSR/hydration vì `localStorage` không tồn tại lúc server-render).
- Nút chọn **OpenAI STT / Browser STT** trong card Hands-free (disable khi đang bật voice mode, tránh đổi mode giữa chừng). Mặc định `"openai"`.
- `startHandsFreeListening()` giờ là dispatcher gọi `startBrowserListening()` (SpeechRecognition, logic y hệt phiên 19, đổi tên) hoặc `startOpenAiListening()` (mới).
- **`startOpenAiListening()` — MediaRecorder + VAD tự viết (không thư viện ngoài):** dùng `AnalyserNode` (Web Audio API) đọc time-domain data mỗi `requestAnimationFrame`, tính độ lệch trung bình so với 128 làm "volume". Im lặng liên tục ≥ 1000ms (sau khi đã phát hiện có nói) → tự `recorder.stop()`; hoặc chạm trần 15s (an toàn, tránh thu âm vô hạn). `onstop`: nếu thời lượng < 500ms → coi như không có gì, nghe lại ngay, KHÔNG gọi transcribe API. Nếu đủ dài → gửi `/api/robot/transcribe`, kết quả đưa vào `runHandsFreeTurn()` y hệt nhánh browser.
- Mic stream + `AudioContext`/`AnalyserNode` chỉ xin quyền **1 lần** lúc bấm "Bật hội thoại giọng nói" (`startVoiceMode`, mode `openai`), tái sử dụng cho mọi lượt ghi âm trong phiên — không xin quyền lại mỗi câu nói. Giải phóng đầy đủ (`releaseOpenAiMic()`: dừng recorder, đóng `AudioContext`, dừng track mic) khi tắt voice mode hoặc rời trang.
- `canUseHandsFreeMic` tách riêng khỏi `canUseMic` cũ (vẫn dùng cho 2 nút mic thủ công ở khối Chat/Voice) — kiểm tra `mediaRecorderSupported` khi `sttMode==="openai"`, `sttSupported` khi `"browser"`.
- **Debug panel nhỏ** (Mục tiêu 4, gộp vào cuối card Hands-free thay vì tạo card riêng): STT mode, Provider, Latency, Session (rút gọn 8 ký tự đầu), Saved (số tin đã lưu trong session), Last transcript.
- `sendChatMessage()` (chat thủ công) cũng gửi kèm `sessionId`/`source:"text"` — nhớ ngữ cảnh áp dụng cho cả gõ tay, không chỉ voice.

**Đã test qua curl thật (2 lượt liên tiếp cùng `sessionId`):** lượt 2 hỏi "Tao vừa nói tao là ai?" → robot trả lời đúng nhắc lại tên đã cho ở lượt 1 — xác nhận cơ chế nhớ ngữ cảnh hoạt động thật, không phải giả lập. `session_message_count` tăng đúng (2 → 4 → 6...) qua các lượt gọi. Query log xác nhận `ConversationSession`/`ConversationMessage` (kèm `source`/`metadata`/`session_id`) ghi đúng xuống Postgres thật.

### RobotFace — mặt robot SVG/CSS animate thay emoji tĩnh (phiên 20 — 2026-07-05)

Chỉ code — **không tạo ảnh, không dùng API tạo ảnh, không thư viện animation ngoài**. Component mới thuần Tailwind + inline SVG (kèm `<animate>` SVG gốc) + 1 CSS module nhỏ cho các hiệu ứng transform-based (thở, wave/nod, error pulse).

**File mới:**
- `src/components/robot/RobotFace.tsx` — component chính, export `RobotFace`, `RobotFaceExpr` (`"idle"|"happy"|"thinking"|"sad"|"speaking"|"listening"|"sleeping"|"error"`), `RobotGesture` (`"none"|"wave"|"nod"`).
- `src/components/robot/RobotFace.module.css` — keyframes: `breathe` (thở nhẹ, luôn chạy), `wave`/`nod` (gesture nhất thời 0.9s rồi tự tắt), `errorRing` (viền đỏ pulse), `dot`/`sparkle`/`zFloat` (animation cho icon trán theo state).

**Thiết kế mascot:** onigiri (cơm nắm) bo tròn — 1 path SVG hình tam giác bo góc (trắng ngà `#fbf6ec`, không dùng trắng thuần để đỡ gắt trên nền tối), dải "nori" (rong biển) đen quấn phần dưới đúng đặc trưng onigiri thật, 2 mắt lớn + đốm sáng nhỏ (sparkle) để có hồn, má hồng (`Cheeks`, sáng hơn khi happy), miệng đổi theo state. Toàn bộ vẽ tay bằng SVG path/ellipse, không phụ thuộc font emoji của hệ điều hành (khác bản cũ dùng emoji 🙂😄😮😴😲🤔 — vốn hiển thị khác nhau tuỳ OS/trình duyệt, không đồng nhất khi lên màn TFT sau này).

**8 state, mỗi state có bộ mắt/miệng riêng (không morph 1 path chung — rõ ràng hơn khi đọc code, dễ chỉnh từng state độc lập):**
- `idle` — mắt chớp tự nhiên qua SVG `<animate>` gốc trên `ry` (không cần JS/interval), miệng cong nhẹ.
- `happy` — mắt cong hình `^_^` (path arc, không phải ellipse), miệng cười hở, má sáng hơn (opacity cao hơn), sparkle ✦ nhấp nháy góc trên phải.
- `thinking` — mắt + đốm sáng trôi lên nhẹ (SVG `<animate>` trên `cy`/`cx`, mô phỏng "nhìn lên nghĩ ngợi"), 3 chấm nảy (CSS `dot` keyframe, so le `animation-delay`) phía trên đầu.
- `listening` — mắt to hơn hẳn (rx/ry 14.5-15 so với 12.5-13 bình thường), vòng sóng mic lan toả từ đỉnh đầu (2 `<circle>` animate `r`+`opacity` lệch pha — hiệu ứng radar ping thuần SVG).
- `speaking` — mắt idle bình thường, **miệng là điểm nhấn**: 1 `<ellipse>` animate `ry` liên tục (SVG `<animate>`, không cần JS) tạo cảm giác đang nói — chỉ render khi `expr === "speaking"`.
- `sad` — mắt cụp (path mí mắt phủ lên trên ellipse), miệng cong xuống.
- `sleeping` — mắt là 2 nét cong nhắm (không phải ellipse), chữ "Z"/"z" bay lên mờ dần lặp lại (CSS `zFloat`, so le `animation-delay`), miệng là 1 nét thẳng ngắn.
- `error` — mắt tròn + 2 nét chân mày xếch lo lắng phía trên, miệng zigzag, **viền màn hình đỏ pulse** (CSS `errorRing` áp vào div ngoài cùng, không phải icon riêng).

**Ưu tiên state (đúng yêu cầu, implement trong hàm `resolveExpr()`):** `isSpeaking` > `isListening` > `isThinking` > `face` (prop, mặc định `"idle"`). Field `face` từ `/api/robot/chat` (`reply-schema.ts`, chỉ có 4 giá trị `idle|happy|thinking|sad`) là tập con hợp lệ của 8 state RobotFace nên gán thẳng không cần map.

**Gesture `action` (wave/nod):** hiệu ứng nhất thời chồng lên biểu cảm nền, không phải state riêng — `useEffect` lắng nghe prop `action` đổi giá trị (khác `"none"`), set 1 CSS class tạm (`gestureWave`/`gestureNod`) rồi tự clear qua `setTimeout` 900ms. **Hạn chế đã biết:** nếu 2 lượt chat liên tiếp cùng trả `action:"wave"`, `useEffect` (dependency `[action]`) không re-trigger vì giá trị không đổi — gesture thứ 2 sẽ không phát lại. Chấp nhận được cho MVP (gesture chỉ là hiệu ứng phụ, không phải thông tin quan trọng); muốn sửa triệt để cần backend gửi kèm 1 nonce/timestamp thay vì chỉ tên gesture.

**Sửa `src/app/robot/page.tsx` — nối dữ liệu vào RobotFace:**
- Thay khối `<div>` emoji + glow radial-gradient cũ bằng `<RobotFace face={robotFaceExpr} action={robotAction} isListening={...} isThinking={...} isSpeaking={isSpeaking} battery={state?.battery} className={...} />`.
- Xoá `FACE_STYLE` map + biến `face`/`faceStyle` cũ (không còn dùng). Đổi tên type cục bộ `RobotFace` (union 6 giá trị của DB) → `DbRobotFace` để tránh đụng tên với component mới cùng tên import từ `@/components/robot/RobotFace`.
- Thêm `mapDbFaceToExpr()` — map biểu cảm từ `RobotState` (DB, do nút lệnh Chào/Ngủ/Vui/Ngạc nhiên/Đang nghĩ cập nhật qua `/api/robot/command`) sang `RobotFaceExpr`. **Lưu ý:** DB có `"surprised"` nhưng RobotFace không có state riêng cho "ngạc nhiên" (đúng 8 state cố định theo yêu cầu) — map `surprised → happy` (biểu cảm tích cực gần nhất) thay vì `error` (dễ hiểu lầm là robot đang lỗi khi thực ra chỉ là 😲 vui vẻ).
- 2 state mới `robotFaceExpr`/`robotAction` cập nhật từ **2 nguồn**: (1) `loadStatus()`/`sendCommand()` — qua `mapDbFaceToExpr(state.current_face)`, giữ nguyên hành vi cũ của các nút lệnh; (2) `sendChatMessage()`/`runHandsFreeTurn()` — thẳng từ `json.face`/`json.action` của response chat (đúng yêu cầu "response face/action từ /api/robot/chat => face/action" — **đây cũng chính là việc đã ghi nợ ở NEXT.md mục #0b từ phiên 19**, giờ coi như đã xong).
- Thêm state `isSpeaking`, cập nhật trong `speak()` qua `utterance.onstart`/`onend`/`onerror` — áp dụng cho **mọi** lần gọi `speak()` (chat thủ công, hands-free, "Nói thử", greet, "Test âm thanh"), không chỉ riêng voice mode, nên miệng RobotFace tự động "nói" bất kể nguồn phát âm thanh nào. `interruptRobotSpeaking()` cũng chủ động `setIsSpeaking(false)` (phòng trường hợp `speechSynthesis.cancel()` không bắn `onend`/`onerror` trên một số trình duyệt).
- `isListening`/`isThinking` truyền vào RobotFace là **OR** của 2 nguồn: mic thủ công (`isListening` state cũ) HOẶC hands-free (`voiceModeStatus === "listening"/"thinking"`), và `chatLoading` (chat thủ công đang gọi API) cho `isThinking`.

**Responsive/kích thước:** `RobotFace` tự `aspect-square` (luôn vuông 1:1, sẵn sàng fit màn TFT vuông/tròn sau này theo đúng yêu cầu #9) — `className` truyền từ `page.tsx` chỉ set độ rộng (`w-56 sm:w-64 md:w-72`, hoặc `w-[min(70vw,70vh)]` khi fullscreen), không set aspect/height. `viewBox="0 0 200 200"` co giãn mượt mọi kích thước qua thuộc tính SVG chuẩn.

**Không đổi:** `Badge` hiển thị `current_mode` vẫn giữ nguyên ngay dưới RobotFace (không phải một phần của component mới). Toàn bộ chat/voice mode/OpenAI provider không đụng tới — chỉ thêm 2 state mới (`robotFaceExpr`, `robotAction`) và 1 state (`isSpeaking`) nối vào luồng đã có sẵn.

**Đã test:** `npm run build` pass, `/robot` trả 200, HTML chứa đúng SVG (`fbf6ec` nền cơm nắm, `232323` dải nori, text "IDLE"), `POST /api/robot/chat` test lại xác nhận backend không đổi (`face:"thinking"`, `action:"nod"` trả về đúng, sẽ hiển thị đúng qua RobotFace). **Chưa xem bằng mắt animation chạy mượt trên trình duyệt thật** (không cài Chromium/Playwright theo yêu cầu trước đó) — cần user tự mở `/robot`, thử các nút lệnh (Vui/Ngủ/Ngạc nhiên/Đang nghĩ) và hands-free voice mode để xác nhận mặt đổi biểu cảm mượt, miệng động khi nói.

### Hands-free Voice Mode cho `/robot` (phiên 19 — 2026-07-05)

Chỉ sửa `src/app/robot/page.tsx` (frontend thuần) — **không đổi API, không đổi schema**, dùng lại `POST /api/robot/chat` sẵn có. Không dùng OpenAI Realtime API, không dùng TTS API ngoài — chỉ `SpeechRecognition`/`webkitSpeechRecognition` (nghe) và `speechSynthesis` (nói), cả hai đều là Web API có sẵn trong trình duyệt.

**Vòng lặp hội thoại:** bấm "🎙️ Bật hội thoại giọng nói" → recognition tự start → khi có **final transcript** (không rỗng, khác transcript vừa gửi lượt trước) → gọi `runHandsFreeTurn()` → `POST /api/robot/chat` → nhận `reply`/`robot_say` → `speak(robot_say)` → khi TTS xong, đợi cooldown 500ms → tự `startHandsFreeListening()` lại → lặp lại. Bấm "⏹ Tắt hội thoại giọng nói" để dừng hẳn (dừng recognition + cancel TTS + xoá timer chờ).

**Tách hoàn toàn khỏi STT thủ công đã có** (nút mic ở khối Chat và khối Voice/Mic, dùng `recognitionRef`/`sttTargetRef`) — Hands-free dùng ref riêng (`handsFreeRecognitionRef`) để 2 cơ chế không tranh nhau 1 phiên ghi âm. Khi Hands-free đang bật, 2 nút mic thủ công tự động `disabled` (kèm title giải thích) để tránh 2 phiên `SpeechRecognition` chạy song song (hầu hết trình duyệt chỉ cho 1 phiên ghi âm active tại một thời điểm).

**State machine (`voiceModeStatus`):** `"off" | "listening" | "thinking" | "speaking" | "paused" | "unsupported"` — hiện qua `Badge` ở góc card, label tiếng Việt qua `handsFreeStatusLabel()` (Đang nghe / Đang nghĩ / Đang nói / Tạm dừng / Mic không hỗ trợ).

**Các cơ chế chống lỗi/vòng lặp hỏng:**
- `lastSentTranscriptRef` — chặn gửi trùng transcript 2 lần liên tiếp (vd browser fire `onresult` final nhiều lần cho cùng 1 câu nói).
- `turnInProgressRef` — cờ đánh dấu "đang xử lý 1 lượt" (từ lúc gửi API tới lúc TTS xong), để `recognition.onend`/`onerror` (bị trigger bởi chính `recognition.stop()` mà `onresult` gọi khi bắt được final transcript) **không** vô tình lên lịch nghe lại chồng lên lượt đang xử lý.
- `recognition.onerror` phân biệt `"not-allowed"`/`"service-not-allowed"` (user từ chối quyền mic) → **tắt hẳn voice mode**, không lặp lại xin quyền vô tận; các lỗi khác (`"no-speech"`, `"aborted"`...) → tự nghe lại sau 300ms nếu voice mode còn bật.
- API lỗi (network fail hoặc `ok:false`) trong `runHandsFreeTurn()` → robot nói cố định **"Tôi chưa xử lý được, thử lại nhé."** (đúng yêu cầu), rồi vẫn tiếp tục vòng lặp nghe lại bình thường — không bao giờ đứng im.
- Cleanup khi unmount trang: dừng recognition + clear timer + cancel TTS (tránh mic/loa tiếp tục chạy ngầm sau khi rời `/robot`).

**`speak()` mở rộng (không phá chỗ gọi cũ):** thêm tham số thứ 2 `onEnd?: () => void`, dùng để Hands-free biết chính xác lúc nào TTS đọc xong mà tự nghe lại (qua `utterance.onend`/`utterance.onerror`). Mọi chỗ gọi `speak(text)` cũ (greet, "Nói thử", "Test âm thanh", chat thủ công) không đổi vì tham số này optional.

**UI:** thẻ mới "🗣️ Hội thoại giọng nói (Hands-free)" chèn giữa khối Chat và khối Voice/Mic cũ — 3 nút (Bật/Tắt/Ngắt lời robot — nút "Ngắt" chỉ enable khi đang ở trạng thái "speaking"), cảnh báo trình duyệt không hỗ trợ ("...dùng Chrome Android"), cảnh báo cần HTTPS (`https://os.irec.vn/robot`) nếu không phải secure context, và transcript thu gọn trong `<details>`/`<summary>` (mặc định đóng, bấm để xem — đúng yêu cầu "ẩn/thu nhỏ nhưng vẫn xem được nếu cần", dùng thẳng HTML `<details>` thay vì tự viết state toggle).

**Không đổi:** `sendChatMessage()` (chat thủ công qua ô nhập text) giữ nguyên 100% hành vi cũ — Hands-free dùng hàm riêng `runHandsFreeTurn()` (có thêm cooldown-chain + fallback nói lỗi) thay vì gọi lại `sendChatMessage()`, chấp nhận trùng một phần logic (fetch + push message) để không rủi ro đổi hành vi chat cũ.

**Đã test:** `npm run build` pass, `/robot` trả 200, HTML render đúng 3 label ("Hội thoại giọng nói (Hands-free)", "Bật hội thoại giọng nói", "Ngắt robot đang nói"), server log sạch không lỗi. `POST /api/robot/chat` test lại xác nhận không bị ảnh hưởng (`provider:"openai"` như trước). **Chưa test bằng mắt/tai thật trên trình duyệt có mic** (SpeechRecognition/speechSynthesis không thể test qua curl) — cần user tự thử trên Chrome/Chrome Android thật, đặc biệt qua `https://os.irec.vn/robot` một khi domain xong (mic cần secure context).

### OpenAI làm provider chính (nhanh), CLI agent lùi thành chế độ `deep` (phiên 18 — 2026-07-05)

Yêu cầu: user tự thêm `OPENAI_API_KEY`/`OPENAI_MODEL` thật vào `.env` — muốn robot chat trả lời **nhanh** bằng OpenAI làm mặc định, CLI agent (chậm, 25-60s) chỉ dùng khi chủ động yêu cầu qua `body.deep === true`.

**File mới:**
- `src/lib/brain/reply-schema.ts` — module dùng chung cho **mọi** nguồn trả lời (OpenAI, CLI agent, fallback): type `Face`/`Action`/`NormalizedReply`, hằng `FALLBACK_REPLY`, và các hàm `stripCodeFence()`/`extractJsonBlock()`/`truncateWords()`/`isFace()`/`isAction()`/`normalizeReply()`/`parseReplyJson()`. **Tách ra từ phiên này** — trước đó các hàm này định nghĩa riêng trong `cli-agent-router.ts`; giờ `cli-agent-router.ts` import lại từ đây (đã refactor, xoá code trùng), và `openai-provider.ts` dùng chung logic parse/validate JSON, đảm bảo 2 provider luôn xử lý JSON model trả về theo đúng 1 cách nhất quán.
- `src/lib/brain/openai-provider.ts` — `askOpenAI(message, context?)`: gọi thẳng OpenAI Chat Completions API (`https://api.openai.com/v1/chat/completions`), model đọc từ `process.env.OPENAI_MODEL` (mặc định code `gpt-5.4-nano` nếu thiếu env), timeout 15s qua `AbortController`, context cắt cứng 8000 ký tự. **Không log/in `OPENAI_API_KEY` ở bất kỳ đâu** (kể cả trong `Error` message — chỉ dùng trong header `Authorization`, không bao giờ ghép vào chuỗi lỗi).
  - **Bug phát hiện qua test tay:** prompt ban đầu (chỉ liệt kê quy tắc dạng prose, không kèm ví dụ JSON schema — đúng như yêu cầu gốc của user) khiến model **thường xuyên trả thiếu trường** (vd chỉ có `{"robot_say": "..."}`, thiếu hẳn `"reply"`) → `parseReplyJson()` trả `null` → toàn bộ request rơi xuống fallback dù OpenAI gọi thành công. Xác nhận qua `curl` trực tiếp tới OpenAI API (không qua app) với đúng model/key thật.
  - **Fix:** thêm khối `Schema bắt buộc: {...}` tường minh vào system prompt (giống cách `cli-agent-router.ts` đã làm ở phiên 16) + `response_format: {type: "json_object"}` trong request body — đã test lại qua `curl` trực tiếp, model trả đủ 4 trường (`reply`, `robot_say`, `face`, `action`) đúng schema.

**Sửa `src/lib/brain/cli-agent-router.ts`:** refactor dùng `reply-schema.ts` — xoá `stripCodeFence`/`extractJsonBlock`/`truncateWords`/`isFace`/`isAction`/`normalize` định nghĩa riêng (trùng lặp với OpenAI provider), `CliAgentResult` giờ là `NormalizedReply & {provider, errors}`, `FALLBACK_RESULT` build từ `FALLBACK_REPLY` dùng chung. Không đổi hành vi/luồng Codex→Claude→Gemini→fallback đã có từ phiên 16-17.

**Sửa `src/app/api/robot/chat/route.ts`:**
- Thêm `deep: z.boolean().optional()` vào schema body.
- Hàm `resolveReply(userText, deep)`: nếu `deep` → gọi `askCliAgents()` (không đổi), map `provider` nội bộ (`codex_cli`/`claude_cli`/`gemini_cli`) thành `"cli_agent"` cho hợp đồng response bên ngoài (chỉ giữ 3 giá trị `"openai"|"cli_agent"|"fallback"` theo đúng yêu cầu) — chi tiết CLI nào thành công/lỗi **vẫn được giữ đầy đủ** trong `ActivityLog` (`log()`) qua field `error` (join các lỗi từng provider) dù không lộ ra ngoài response. Nếu không `deep` → gọi `askOpenAI()` trước, lỗi thì fallback local ngay (**không** rơi xuống CLI agent — đúng yêu cầu "không dùng CLI agent cho chat realtime mặc định vì chậm").
- Response contract đổi từ `errors: string[]` (phiên 16-17) → `error: string | null` (số ít, đúng yêu cầu lần này) — đơn giản hơn, đủ dùng vì giờ chỉ có 1 nhánh chạy tại 1 thời điểm (không phải chain nhiều lỗi tích luỹ như CLI router nội bộ).
- Giữ nguyên toàn bộ phần best-effort DB (không crash nếu Postgres lỗi) và input linh hoạt `message`/`text`/`content`, `accessLevel` mặc định 3 (giữ trong schema, chưa dùng để lọc context) từ phiên 15-16.

**Sửa UI `/robot` (tối thiểu, không đổi bố cục):**
- `providerLabel()`: `"openai"` → "OpenAI", `"cli_agent"` → "CLI Agent (Codex/Claude/Gemini)", `"fallback"` → "Fallback (chế độ cơ bản)" — bỏ 3 case cũ `codex_cli`/`claude_cli`/`gemini_cli` (không còn xuất hiện ở response ngoài, đã collapse thành `cli_agent` trong route).
- `ChatResponse`/`ChatMessage`: đổi field `errors?: string[]` → `error?: string | null`, cảnh báo fallback đổi text thành "Chưa gọi được AI thật, đang dùng chế độ cơ bản" (chung cho cả 2 nhánh openai/CLI, không còn nói riêng "3 CLI agent" vì giờ có thể fail ngay từ nhánh OpenAI).
- `speak()` vẫn đọc `robot_say` (giữ từ phiên 16), không đổi.

**Đã test qua curl thật:**
- Mặc định (không `deep`): `provider:"openai"`, có `reply`/`robot_say`, **~5s** (so với 30-60s của CLI agent) — đúng yêu cầu "trả lời nhanh".
- `{"deep":true}`: `provider:"cli_agent"` (qua Claude CLI, Codex CLI vẫn timeout 25s do chưa login — xem phiên 17), `error` ghi rõ `"codex_cli: timeout sau 25s"` — xác nhận nhánh CLI vẫn hoạt động đúng qua field `deep`.
- `/robot` vẫn trả 200. `npm run build` pass.

### Wrapper cố định env cho CLI agent + phát hiện auth thật (phiên 17 — 2026-07-05)

Bug report: user gọi `codex`/`gemini` thủ công trên VPS được, nhưng nghi ngờ `/api/robot/chat` (gọi từ tiến trình Next.js) có thể fail vì process env khác terminal (thiếu `PATH` của nvm, thiếu `HOME`, v.v.).

**Wrapper mới (không phải file trong repo — nằm ở `/usr/local/bin`, ngoài git):**
- `/usr/local/bin/brainos-codex` — set cứng `HOME=/root`, `PATH=...` (bao gồm `/root/.nvm/versions/node/v22.23.0/bin`), `TERM=dumb`, `NO_COLOR=1`, `cd /home/brainos/agent-workspace`, rồi `exec codex exec --skip-git-repo-check "$@"`.
- `/usr/local/bin/brainos-gemini` — tương tự, `exec gemini -p "$@" --skip-trust`.
- **Đã sửa 1 chỗ so với yêu cầu gốc của user:** PATH mẫu user đưa (`/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.npm-global/bin`) **thiếu thư mục nvm** (`/root/.nvm/versions/node/v22.23.0/bin`) — đây là nơi `codex`/`gemini`/`claude` thực sự nằm (symlink, xác nhận qua `which`/`readlink -f`), và `/root/.npm-global/bin` **không tồn tại** trên máy này. Nếu dùng đúng PATH mẫu, wrapper sẽ báo "command not found" 100% các lần — đã tự sửa PATH cho đúng thay vì copy nguyên văn.
- **Giữ cứng flag trust/skip-check ngay trong wrapper** (không phải trong router) — vì router giờ chỉ gọi `brainos-codex "<prompt>"` với đúng 1 tham số theo yêu cầu, nên `--skip-git-repo-check`/`--skip-trust` phải nằm trong wrapper để không bị mất.

**Sửa `src/lib/brain/cli-agent-router.ts`:**
- `PROVIDERS`: `codex_cli` và `gemini_cli` giờ gọi `/usr/local/bin/brainos-codex`/`brainos-gemini` (đường dẫn tuyệt đối) với `buildArgs: (prompt) => [prompt]` — wrapper tự lo phần flag/cwd/env. `claude_cli` vẫn gọi thẳng `claude -p "<prompt>"` (không cần wrapper, không có yêu cầu trust-dir, đã chạy ổn định qua PATH kế thừa).
- Thêm `FIXED_ENV` — set cứng `HOME`/`PATH`/`TERM`/`NO_COLOR` (giống wrapper) truyền qua `env` option của `execFile()` cho **cả 3 provider** (không chỉ Codex/Gemini) — đảm bảo môi trường chạy CLI luôn xác định, không phụ thuộc `process.env` kế thừa từ tiến trình Next.js. Có thêm `NODE_ENV: process.env.NODE_ENV` (bắt buộc vì type `NodeJS.ProcessEnv` của Next.js yêu cầu field này, không ảnh hưởng gì tới 3 CLI).
- Giữ nguyên toàn bộ cơ chế timeout 25s/CLI + tổng 60s/route + đóng stdin ngay (EOF) đã có từ phiên 16.

**Đã test wrapper độc lập (mô phỏng đúng lo ngại của user — process env "sạch" như tiến trình khác terminal):**
```bash
env -i PATH=/usr/bin:/bin HOME=/tmp /usr/local/bin/brainos-codex "..."   # OK, tìm thấy lệnh, chạy đúng cwd
env -i PATH=/usr/bin:/bin HOME=/tmp /usr/local/bin/brainos-gemini "..."  # OK, tìm thấy lệnh, chạy đúng cwd
```
→ Xác nhận wrapper **giải quyết đúng vấn đề PATH/HOME** mà user lo ngại — không còn lỗi "command not found" hay "not inside a trusted directory" dù env bị strip sạch.

**Phát hiện quan trọng (không phải lỗi env/PATH — báo lại user, không tự ý login lại theo đúng yêu cầu):**
- `codex login status` → **"Not logged in"**. Nguyên nhân: ở phiên trước, Codex CLI có token đã hết hạn (refresh thất bại, 401) nhưng `codex login status` vẫn báo "Logged in using ChatGPT" (chỉ kiểm tra file token tồn tại, không kiểm tra còn hạn); phiên trước đã thử `codex login --device-auth` để sửa nhưng mã hết hạn/bị ngắt trước khi hoàn tất, khiến trạng thái chuyển từ "có token hỏng" sang "không có token nào". **Cần user tự chạy `codex login` (hoặc `codex login --device-auth` nếu VPS không có trình duyệt) và hoàn tất trong 15 phút.**
- `~/.gemini/settings.json` → `{"security":{"auth":{"selectedType":"gemini-api-key"}}}` — Gemini CLI trên VPS này **đang cấu hình xác thực bằng API key**, không phải OAuth login tài khoản Google. Nghĩa là "Gemini CLI" ở đây về bản chất vẫn cần một API key hợp lệ để chạy — key hiện tại (trong `~/.bashrc`, đã biết từ phiên 14-15) không hợp lệ/hết quota. Muốn Gemini CLI thật sự hoạt động theo đúng tinh thần "CLI đã login, không dùng API key trả phí", cần user tự chạy `gemini` (interactive) và chọn phương thức đăng nhập "Login with Google" thay vì API key.
- **Chỉ Claude CLI hoạt động thật** trên VPS này hiện tại — đã xác nhận nhiều lần qua test.

**Đã test qua curl thật** (`--max-time 70`): tổng ~38s (Codex CLI chạm timeout 25s do vòng lặp reconnect WebSocket 401 thật, Claude CLI trả lời thành công ~10s ngay sau), `provider:"claude_cli"`, `errors:["codex_cli: timeout sau 25s"]`. `/robot` vẫn trả 200. `npm run build` pass.

**"AgentRun ghi provider success/fail":** không tạo endpoint `/agents` mới (không có yêu cầu file cụ thể, tránh thêm module ngoài scope) — dùng lại cơ chế đã có: mảng `errors[]` trong response (ghi rõ provider nào lỗi + lý do) và `ActivityLog` (`action: "robot.chat"`, payload chứa `provider` thành công + toàn bộ `errors[]`) qua `log()` trong route — đã đủ để trả lời "provider nào success/fail" mà không cần thêm route/schema mới.

### CLI Agent Router — bỏ OpenAI/Gemini API trả phí, dùng Codex/Claude/Gemini CLI (phiên 16 — 2026-07-05)

Yêu cầu: `/api/robot/chat` không được gọi bất kỳ paid model API nào (không OpenAI API, không Gemini API key) — thay vào đó dùng 3 CLI agent **đã login sẵn trên VPS** (Codex CLI, Claude CLI, Gemini CLI), chạy trong workspace cô lập, không được đụng vào repo chính.

**File mới:**
- `src/lib/brain/system-context.ts` — hằng số `SYSTEM_CONTEXT`, mô tả tĩnh về Brain OS/robot ChinChin, gửi kèm mọi request tới CLI (thay cho context động truy vấn DB như kiến trúc AI Provider cũ ở phiên 13).
- `src/lib/brain/cli-agent-router.ts` — `askCliAgents(message, context)`: chạy tuần tự Codex CLI → Claude CLI → Gemini CLI → fallback local. Chi tiết quan trọng:
  - **Workspace cô lập:** `/home/brainos/agent-workspace` (tự `mkdir -p` nếu chưa có) — mọi CLI chạy với `cwd` này, không phải thư mục repo (`/root/brain-os`), nên dù CLI có cố sửa file cũng không đụng được vào code thật.
  - **Timeout 2 lớp (sửa lại trong cùng phiên sau khi phát hiện demo bị treo quá lâu):** ban đầu để 90s/CLI theo yêu cầu gốc, nhưng test thật cho thấy tổng thời gian có thể lên tới ~110s (Codex timeout 90s + Claude ~10s) — quá lâu cho demo. Đã giảm còn **25s/provider** (`PER_PROVIDER_TIMEOUT_MS`), và thêm **trần tổng 60s cho cả route** (`TOTAL_TIMEOUT_MS`): thời gian còn lại co dần cho provider sau (provider cuối có thể nhận ít hơn 25s nếu provider trước đã dùng gần hết ngân sách), dưới 3s thì bỏ qua thẳng provider đó. Có thêm một `Promise.race` với deadline tổng làm lưới an toàn — đảm bảo response luôn về trong ~60.5s dù cơ chế timeout của `execFile` vì lý do gì đó không kích hoạt kịp.
  - **Bắt buộc thêm flag trust/skip-check** mà yêu cầu gốc không đề cập, phát hiện qua test tay: `codex exec` cần `--skip-git-repo-check` (mặc định từ chối chạy ngoài git repo/thư mục chưa trust), `gemini -p` cần `--skip-trust` (mặc định từ chối chạy headless trong thư mục chưa trust tương tác) — thiếu 2 flag này, CLI in lỗi trust rồi thoát ngay, sẽ luôn bị coi là lỗi dù CLI vẫn hoạt động bình thường.
  - **Bug đã sửa — stdin treo hết timeout:** ban đầu dùng `util.promisify(execFile)`, để `stdio` mặc định (pipe mở, không đóng). Codex CLI đọc thêm dữ liệu từ stdin dù đã có prompt dạng argument ("Reading additional input from stdin...") — pipe không đóng khiến Codex treo tới hết timeout thay vì tự thoát lỗi sau ~20s như khi test tay với `< /dev/null`. Fix: chuyển sang `execFile` dạng callback thường (không promisify) để lấy được `ChildProcess`, gọi `child.stdin?.end()` ngay sau khi spawn để đóng stdin (EOF) tức thì.
  - **Parse JSON an toàn:** `stripCodeFence()` bỏ ```` ```json ... ``` ```` nếu CLI lỡ bọc markdown; `extractJsonBlock()` cắt lấy đúng khối `{...}` ngoài cùng nếu CLI in thêm chữ thừa trước/sau JSON.
  - **Validate nhẹ tay:** chỉ `reply` rỗng mới bị coi là lỗi cứng (loại bỏ kết quả, thử provider tiếp theo) — `face`/`action` sai giá trị tự về `"idle"`/`"none"`, `robot_say` thiếu thì lấy từ `reply`, và luôn bị cắt về tối đa 18 từ (`truncateWords`) thay vì từ chối cả câu trả lời tốt chỉ vì hơi dài.
  - **Lỗi luôn có tên provider đứng đầu** trong mảng `errors` (vd: `"codex_cli: timeout sau 25s"`, `"gemini_cli: lệnh không tồn tại"`) — dùng `describeError()` rút gọn về 1 dòng (ưu tiên `stderr`, cắt 200 ký tự, bỏ xuống dòng) thay vì để nguyên `error.message` của `execFile` (chứa lại toàn bộ command + prompt dài, không hữu ích khi log/hiển thị).
- **Đã phát hiện khi test (quan trọng, báo lại user):** trên VPS này, **Codex CLI và Gemini CLI đang hết hạn đăng nhập** (`codex exec` → `401 Invalid refresh token`; `gemini -p` → `401 UNAUTHENTICATED`) — chỉ **Claude CLI hoạt động bình thường**. Router vẫn hoạt động đúng thiết kế (tự fallback qua Claude CLI, ghi rõ lỗi 2 provider kia), nhưng nếu muốn thật sự có 3 lớp dự phòng, cần đăng nhập lại `codex login` và `gemini` (interactive) trên VPS — ngoài phạm vi việc này vì cần thao tác tương tác/trình duyệt mà agent không tự làm thay được.

**Sửa `src/app/api/robot/chat/route.ts`:**
- Bỏ hoàn toàn import `@/lib/ai` (kiến trúc OpenAI/Gemini API cũ) — gọi `askCliAgents(userText, SYSTEM_CONTEXT)` thay thế.
- Giữ nguyên input linh hoạt `message`/`text`/`content` và `deviceId`/`accessLevel` (mặc định 3) từ phiên 15 — `accessLevel` hiện chưa được CLI router dùng tới (context giờ tĩnh, không lọc theo access_level) nhưng vẫn giữ trong schema để tương thích API/auth thật sau này.
- **DB best-effort thật sự:** tra `device` + lưu `ConversationMessage` (user và robot) đều bọc `try/catch` riêng — nếu Postgres lỗi, chat vẫn trả lời bình thường qua CLI agent, chỉ mất phần lưu lịch sử (trước đây ở phiên 15 nếu `getRobotDevice` throw sẽ làm hỏng cả request).
- Response luôn đúng dạng `{ok:true, reply, robot_say, face, action, provider, errors, ...ids}` — bỏ các field cũ `context_used`/`openai_error`/`gemini_error` (không còn ý nghĩa với kiến trúc CLI).

**Sửa UI `/robot` (`src/app/robot/page.tsx`, tối thiểu, không đổi bố cục):**
- TTS giờ đọc `robot_say` (câu ngắn ≤18 từ) thay vì `reply` (câu đầy đủ hiển thị trong bong bóng chat) — đúng yêu cầu tách nội dung web/tablet đọc to.
- `providerLabel()`: `"codex_cli"` → "Codex CLI", `"claude_cli"` → "Claude CLI", `"gemini_cli"` → "Gemini CLI", `"fallback"` → "Fallback (chế độ cơ bản)".
- Cảnh báo nhẹ khi `provider === "fallback"`: hiện dòng "⚠️ Cả 3 CLI agent đều không trả lời được..." kèm danh sách lỗi rút gọn.
- `face`/`action` CLI trả về **chưa được wire vào trạng thái robot thật** (emoji/mode hiện tại vẫn điều khiển qua `/api/robot/command` riêng) — chỉ mới hiển thị qua provider label, để dành làm việc sau nếu cần robot tự đổi mặt theo câu trả lời chat.

**Dọn dẹp:** xoá toàn bộ `src/lib/ai/` (kiến trúc OpenAI/Gemini API phiên 13-15, không còn file nào import tới) và xoá `OPENAI_API_KEY`/`OPENAI_MODEL`/`GEMINI_API_KEY`/`GEMINI_MODEL` khỏi `.env` (không còn ai đọc).

**Đã test qua curl thật** (`{"message":"Chào khách đến mua cơm nắm ChinChin","accessLevel":3}`, `--max-time 70`): tổng ~32s (Codex thoát lỗi auth thật ~22s, Claude trả lời thành công ~10s), `provider:"claude_cli"`, `robot_say` ≤18 từ, `face:"happy"`, `action:"wave"`, `errors` ghi rõ `"codex_cli: ... Failed to refresh token: 401 Unauthorized..."`. `npm run build` pass sau mọi thay đổi.

### Fix kết nối Postgres + payload chat linh hoạt (phiên 15 — 2026-07-05)

Bug report: `/api/robot/chat` lỗi `Authentication failed against database server at localhost, credentials for postgres are not valid.` — xác nhận đây là lỗi Postgres, không phải Gemini.

- **Nguyên nhân:** container `brainos-postgres` vẫn chạy (uptime 20h, env `POSTGRES_PASSWORD=postgres` khớp `.env`), nhưng **password thật đã lưu trong volume của DB không còn khớp** `postgres` nữa — do image Postgres chỉ áp dụng `POSTGRES_PASSWORD` lúc **khởi tạo lần đầu** volume; nếu container từng bị tạo lại (hoặc password bị đổi tay) trong khi volume dữ liệu cũ được giữ lại, env var mới không tự động cập nhật lại password đã lưu. `pg_hba.conf` chỉ `trust` cho `127.0.0.1`/`::1` bên trong container — mọi kết nối từ ngoài (kể cả app Next.js chạy trên host) đi qua `scram-sha-256` nên bị từ chối.
- **Đã kiểm tra trước khi sửa:** volume `fa53b859b1...` có data thật (1 Profile, 2 Memory, 36 ConversationMessage, 6 Device) — **đã hỏi user** trước khi động vào, chọn phương án **giữ data** thay vì recreate container.
- **Fix:** `docker exec brainos-postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"` — đổi password role ngay trong container hiện tại, khớp lại với `DATABASE_URL` trong `.env`, **không mất data, không cần recreate container**.
- Verify: `npx prisma generate` + `npx prisma migrate status` → "Database schema is up to date!" (3 migration, không cần chạy lại `migrate dev`/`db:seed` vì schema/data đã có sẵn và khớp).
- **`/api/robot/chat` — payload linh hoạt:** trước đây chỉ nhận `{text}`, giờ nhận `message` **hoặc** `text` **hoặc** `content` (ưu tiên theo thứ tự đó). Thiếu cả 3 → trả `400 {ok:false, error:"Thiếu nội dung tin nhắn..."}` thay vì lỗi Zod chung chung. Body không phải JSON hợp lệ → bắt riêng, trả `400` rõ ràng thay vì rơi xuống lỗi 500 chung.
- **`deviceId`** (hoặc `device_id`) optional, mặc định `"dev-robot-simulator"` — `getRobotDevice()` (`src/lib/robot.ts`) giờ nhận thêm tham số `deviceId` optional, tra theo `id` nếu có truyền, giữ nguyên hành vi cũ (tìm theo `device_type: "robot"`) nếu không truyền.
- **`accessLevel`** (hoặc `access_level`) optional, mặc định đổi từ hardcode `1` → `3` theo yêu cầu (route giờ là kênh chat chính chủ, không phải public endpoint chưa auth) — validate `int 0..4` qua Zod. **Lưu ý bảo mật:** vì chưa có auth thật, bất kỳ ai gọi được endpoint này đều có thể tự truyền `accessLevel: 3` và đọc được `PrivateMemory` qua context — chấp nhận được cho MVP chạy local/tin cậy, nhưng **phải thêm auth trước khi expose endpoint ra ngoài** (xem Known issues).
- Đã test qua curl thật: `message`/`text`/`content` đều hoạt động, thiếu cả 3 trả 400 đúng, JSON không hợp lệ trả 400 đúng, response luôn là JSON kể cả khi lỗi. Gemini hiện trả `401` (không phải 429) — do `GEMINI_API_KEY` trong `~/.bashrc` (khác key trong `.env`, override theo cơ chế đã ghi ở phiên 14) có vẻ không hợp lệ; cơ chế fallback (không phân biệt 401/429/timeout, đều fallback về template) đã xử lý đúng, **không crash, luôn trả JSON** — không đụng vào phần Gemini vì đây là vấn đề key/quota đã biết từ trước (xem NEXT.md), ngoài phạm vi yêu cầu lần này.
- App đã restart lại (`pkill -f "next dev"` rồi `nohup npm run dev -- -H 0.0.0.0 -p 3000 > brainos.log 2>&1 &`), log sạch, không còn lỗi Prisma authentication.

### Chống Gemini 429 (phiên 14 — 2026-07-04) — ĐÃ THAY THẾ ở phiên 16

> **Toàn bộ `src/lib/ai/` mô tả trong section này đã bị xoá ở phiên 16** (2026-07-05) — robot chat không còn gọi OpenAI/Gemini API trả phí, chuyển sang CLI Agent Router (Codex/Claude/Gemini CLI). Giữ lại nội dung dưới đây làm lịch sử/tham khảo kiến trúc cũ.

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

### Gemini AI Provider cho Robot Chat (phiên 13 — 2026-07-04) — ĐÃ THAY THẾ ở phiên 16

> **Đã xoá ở phiên 16** (2026-07-05), xem lý do ở ghi chú tương tự tại section "Chống Gemini 429" ngay trên.

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

### Xiaozi/Xiaozhi Bridge — kiến trúc template-first (phiên 24 — 2026-07-05)

Yêu cầu: Xiaozi/Xiaozhi (phần cứng robot khác) đã có sẵn voice/mic/STT/TTS/template/skill/phản xạ cơ bản — Brain OS **không tự build lại** các phần đó, chỉ đóng vai trò webhook backend cho Xiaozi: nhận câu Xiaozi không tự trả lời được, lưu hội thoại/log, quản lý memory/profile/project, xử lý câu liên quan Brain OS/ChinChin/iREC, và chỉ gọi OpenAI khi câu thật sự phức tạp. `/robot` (route `/api/robot/chat` và mọi thứ liên quan — session-context, openai-provider, cli-agent-router, RobotFace, RobotVision...) **giữ nguyên 100%, không đụng** — giờ coi `/robot` vừa là simulator vừa là nơi admin xem/test Xiaozi Bridge.

**Kiến trúc 3 lớp (ưu tiên từ trên xuống, dừng ở lớp đầu tiên xử lý được):**
- **L0 — Xiaozi built-in:** template/skill có sẵn trên chính thiết bị Xiaozi (kể chuyện, thời tiết, trò chuyện phổ thông...) — Brain OS không biết và không cần biết các case này tồn tại, chỉ nhận request khi Xiaozi tự quyết định "câu này template không xử lý được".
- **L1 — Brain OS local bridge (`xiaoziBridgeBrain()`):** xử lý nội bộ, không gọi AI ngoài, tốc độ tức thời (~40-50ms qua test). Chỉ 5 nhóm cố định: (1) "Brain OS là gì", (2) ChinChin/iREC (menu/giá cố định), (3) memory/session (ghi nhớ, "tao vừa nói gì" — dùng `previousUserText` lấy từ `ConversationMessage` cùng `session_id`), (4) lệnh robot cơ bản (ngủ/vui/nhìn trái-phải/gật đầu → map `face`/`action`), (5) dashboard/status (hỏi đang dùng "não" nào). Không thuộc nhóm nào → `matched:false`, để route quyết định tiếp.
- **L2 — OpenAI fallback:** **chỉ** gọi khi `isComplexRequest(text)` (`src/lib/brain/complexity.ts`, kiểm tra ~18 cụm từ khoá như "phân tích", "chiến lược", "lập kế hoạch", "tính toán chi phí", "hỏi não"...) trả `true` **và** `ENABLE_OPENAI_FALLBACK=true`. Nếu phức tạp nhưng OpenAI đang tắt → trả lời cố định "Việc này cần não nâng cao, hiện tôi chưa bật OpenAI." (`provider:"fallback_complex_disabled"`), không im lặng, không giả vờ trả lời được.

**Thứ tự check quan trọng (bug tự phát hiện + tự sửa qua test tay):** ban đầu implement theo đúng thứ tự literal của yêu cầu (bridge nội bộ chạy trước, complexity-check chạy sau khi bridge báo `matched:false`) — test câu "phân tích chiến lược mở rộng ChinChin lên 20 điểm bán" bị nhóm (2) ChinChin/iREC "cướp" mất (vì câu có chứa từ "chinchin"), trả về menu/giá thay vì đi tới nhánh phức tạp. **Fix:** `xiaoziBridgeBrain()` giờ check `isComplexRequest()` **đầu tiên** — nếu phức tạp, trả `matched:false` ngay, bỏ qua toàn bộ 5 nhóm quick-reply, để route xử lý nhánh OpenAI/fallback. Đã test lại xác nhận đúng.

**ENV mới (`.env`):**
```
AI_PROVIDER="local"              # chỉ mang tính mô tả/hiển thị ở panel debug, không tự đổi luồng gọi OpenAI
ENABLE_OPENAI_FALLBACK="false"   # true mới cho phép gọi OpenAI ở nhánh L2
OPENAI_ONLY_FOR_COMPLEX="true"   # mang tính chủ đích/hiển thị — hiện luồng thực tế LUÔN chỉ gọi OpenAI khi complex=true (không có nhánh "gọi OpenAI cho câu không phức tạp"), nên cờ này chưa có switch riêng
```
MVP chạy đầy đủ không cần `OPENAI_API_KEY` (dù key thật vẫn có sẵn trong `.env` từ phiên 18, dùng chung cho `/api/robot/chat`) — mặc định `ENABLE_OPENAI_FALLBACK=false` nên nhánh L2 không bao giờ được gọi tới trừ khi bật tay.

**File mới:**
- `src/lib/brain/complexity.ts` — `isComplexRequest(text)`, so khớp substring (lowercase) với danh sách từ khoá cố định.
- `src/lib/brain/xiaozi-bridge-brain.ts` — `xiaoziBridgeBrain(input)`, hàm thuần (không async, không đọc DB trực tiếp — route tự truy vấn `previousUserText` rồi truyền qua `meta` trước khi gọi).
- `src/app/api/xiaozi/chat/route.ts` — webhook chính. Input linh hoạt (`text`/`message`, `deviceId` mặc định `"xiaozi-robot-1"`, `sessionId` mặc định `"xiaozi-" + deviceId`, `accessLevel` mặc định `3`). Lưu `ConversationMessage` cả lượt user (`source:"xiaozi"`, `provider:"xiaozi"`) lẫn robot (mọi nhánh, `provider` phản ánh đúng nguồn: `brain_local`/`openai`/`fallback`/`fallback_complex_disabled`/`xiaozi_template_first`) — **best-effort, DB lỗi không crash** (dùng lại pattern try/catch nuốt lỗi đã có từ `/api/robot/chat`). Không log API key ở bất kỳ đâu (lỗi OpenAI chỉ ghi message ngắn vào `ActivityLog`, không kèm key).
- `src/app/api/xiaozi/status/route.ts` — GET nhỏ, chỉ trả cấu hình không nhạy cảm (`aiProvider`, `enableOpenaiFallback`, `openaiOnlyForComplex`, `sampleDeviceId`, `endpointPath`) cho panel debug.
- `src/components/robot/XiaoziBridgePanel.tsx` — panel mới chèn vào đầu `/robot` (trước card "Điều khiển"), hiển thị endpoint (`https://os.irec.vn/api/xiaozi/chat`), giá trị 3 env, `deviceId` mẫu, 2 khối curl mẫu (local/complex), và 3 nút test nhanh (local/complex/template-first) gọi thẳng `/api/xiaozi/chat` từ trình duyệt, hiện `provider` + `speak` + latency của lần test gần nhất.

**Đã test qua curl thật (server dev thật, port 3000, DB Postgres thật):**
- `{"text":"Brain OS là gì",...}` → `provider:"brain_local"`, đúng câu trả lời cố định.
- `{"text":"kể chuyện cười đi",...}` → `provider:"xiaozi_template_first"`, không gọi OpenAI.
- `{"text":"phân tích chiến lược mở rộng ChinChin lên 20 điểm bán",...}` với `ENABLE_OPENAI_FALLBACK=false` → `provider:"fallback_complex_disabled"`; bật tạm `ENABLE_OPENAI_FALLBACK=true` → `provider:"openai"` (trả lời thật, ~2s), rồi tắt lại đúng mặc định `false`.
- `{"text":"ngủ đi",...}` → `action:"sleep"`; `{"text":"nhớ tao là Tú nhé","sessionId":"sess-test-1",...}` rồi `{"text":"tao vừa nói gì","sessionId":"sess-test-1",...}` → trả đúng lại câu vừa lưu, xác nhận truy vấn `previousUserText` theo `session_id` hoạt động.
- `GET /api/xiaozi/status` → đúng JSON config, không lộ `OPENAI_API_KEY`. `/robot` vẫn 200, panel "🔌 Xiaozi Bridge" xuất hiện đúng vị trí. `npm run build` pass (cả ở worktree cô lập lẫn ở checkout chính sau khi đồng bộ).

**Sự cố hạ tầng phát hiện + tự sửa (không liên quan code Xiaozi, nhưng chặn việc test):** container Postgres `brainos-postgres` (docker, đã chạy 27h) **không còn database `brain_os`** (chỉ còn `postgres`/`readme_to_recover`/`template0`/`template1`) — không rõ nguyên nhân (ngoài phạm vi phiên này để điều tra). Đã tự `CREATE DATABASE brain_os`, chạy lại `prisma migrate deploy` (4 migration cũ, không đổi schema) + `npm run db:seed`. **Hệ quả: toàn bộ `ConversationMessage`/`ActivityLog`/dữ liệu thật đã tích luỹ qua các phiên trước (21-23) đã mất**, giờ chỉ còn dữ liệu mẫu từ `prisma/seed.ts`. Nếu có bản backup Postgres riêng, cần restore thủ công; nếu không, coi như bắt đầu lại từ seed.

**Không đụng:** NPM/Cloudflare (đúng yêu cầu), `/api/robot/*` và mọi thứ trong `src/lib/brain/` từ phiên 16-23 (chỉ *thêm* file mới, không sửa file cũ nào ngoại trừ `.env` thêm 3 dòng và `src/app/robot/page.tsx` thêm 1 import + 1 dòng render panel).

### Postgres persistence — named volume + backup + health check (phiên 25 — 2026-07-05)

Yêu cầu: sự cố mất DB `brain_os` ở phiên 24 (nguyên nhân: container `brainos-postgres` chạy trên **volume ẩn danh**, dễ mất data nếu container bị xoá/tạo lại chứ không chỉ restart) — cần cố định bằng named volume + backup + health check, không phá code Xiaozi Bridge.

**Hiện trạng trước khi sửa (đã kiểm tra bằng `docker inspect`):** `brainos-postgres` mount `Type: volume` nhưng `Name` là 1 chuỗi hash dài (volume ẩn danh Docker tự sinh khi không khai `-v name:path` hay compose) — xác nhận đúng nghi vấn ở NEXT.md phiên trước. DB đang có 24 `ConversationMessage`/3 `ConversationSession` (dữ liệu test từ phiên 24, không phải data thật cũ đã mất).

**Backup trước khi động vào gì (2 lần, để chắc):** `docker exec brainos-postgres pg_dump -U postgres brain_os > backups/...sql` — cả 2 lần đều thành công (exit 0, ~1043 dòng, 39.6KB), không log lỗi, verify không chứa `sk-` (API key không nằm trong DB nên không có gì để lộ).

**File mới:**
- `docker-compose.db.yml` — service `postgres` (image `postgres:16`, `container_name: brainos-postgres`, `restart: unless-stopped`, env `POSTGRES_USER/PASSWORD/DB` khớp `.env` hiện tại, port `5432:5432`, volume `brainos_pgdata:/var/lib/postgresql/data`). **Lưu ý:** phải khai `volumes.brainos_pgdata.name: brainos_pgdata` tường minh — nếu không, Docker Compose tự prefix tên project (`brain-os_brainos_pgdata`) chứ không đúng y hệt tên yêu cầu; đã phát hiện qua lần chạy thử đầu tiên và sửa lại trước khi cutover thật.
- `scripts/backup-db.sh` — `pg_dump` ra `backups/brain_os_<timestamp>.sql`, tự dò `PROJECT_ROOT` theo vị trí script (không hard-code `/root/brain-os`, chạy đúng dù repo ở đường dẫn khác), giữ lại 20 bản mới nhất (`ls -1t ... | tail -n +21 | xargs rm -f`), in ra đường dẫn file vừa tạo. Thêm script `npm run db:backup` trong `package.json`.
- `src/app/api/health/db/route.ts` — `GET`, đếm `conversationMessages`/`conversationSessions` thật qua Prisma; `agents`/`agentRuns` trả `null` (schema hiện tại **không có** model `Agent`/`AgentRun` — trả `null` thay vì bịa số `0`, tránh gây hiểu lầm là "có nhưng bằng 0"). Lỗi DB → `{ok:false, database:"error", error}`, HTTP 503, không crash.
- `.gitignore` thêm `/backups/` — file `pg_dump` có thể chứa nội dung hội thoại/`PrivateMemory` thật, không được commit lên git.

**Cutover container (an toàn, không xoá gì):**
1. Backup lần cuối ngay trước khi dừng container cũ.
2. `docker stop brainos-postgres` → `docker rename brainos-postgres brainos-postgres-old-202607051405` (giữ nguyên, **không xoá**, làm lưới an toàn nếu cutover có vấn đề).
3. `docker compose -f docker-compose.db.yml up -d` → tạo container `brainos-postgres` mới, volume named `brainos_pgdata`, DB `brain_os` rỗng (`\dt` không có bảng nào).
4. Restore: `docker exec -i brainos-postgres psql -U postgres -d brain_os < backups/brain_os_pre_migration_....sql` — 0 lỗi, đủ lại 19 bảng + đúng 24/3 dòng `ConversationMessage`/`ConversationSession` + bảng `_prisma_migrations` (4 migration, khớp y hệt trước cutover).
5. `npx prisma migrate deploy` → `"No pending migrations to apply."` (xác nhận restore đã mang theo đúng migration history, không cần chạy lại từ đầu).
6. Test bền vững: `docker restart brainos-postgres` → data vẫn còn nguyên (24 dòng) — xác nhận named volume hoạt động đúng, khác hẳn hành vi trước đây.

**Đã test qua curl/CLI thật:**
- `GET /api/health/db` → `{"ok":true,"database":"connected","counts":{"conversationMessages":24,"conversationSessions":3,"agents":null,"agentRuns":null}}` (tăng lên 26 sau khi chạy thêm 1 lượt test `/api/xiaozi/chat`).
- `POST /api/xiaozi/chat {"text":"Brain OS là gì",...}` → vẫn `provider:"brain_local"` như phiên 24, xác nhận cutover Postgres không phá Xiaozi Bridge.
- `npm run db:backup` → in đúng đường dẫn file mới, backup có mặt trong `backups/` (4 file, đều dưới ngưỡng giữ 20 bản).
- `npm run build` pass (cả worktree cô lập lẫn checkout chính), server dev restart thật trên port 3000, `/robot` vẫn 200.

**Không đụng:** NPM/Cloudflare, code Xiaozi Bridge/CLI agent/OpenAI provider (chỉ thêm file mới + 1 dòng script trong `package.json` + 1 dòng `.gitignore`). Container cũ `brainos-postgres-old-202607051405` vẫn còn trên máy (dừng hẳn, không chạy) — có thể xoá thủ công sau khi user xác nhận không cần nữa (`docker rm brainos-postgres-old-202607051405`), phiên này chủ động không tự xoá.

### Xiaozi webhook auth — secret token + rate limit + tài liệu (phiên 26 — 2026-07-05)

Yêu cầu: trước khi nối Xiaozi thật vào endpoint public `https://os.irec.vn/api/xiaozi/chat`, phải bảo vệ webhook bằng secret token + tài liệu cấu hình nhanh. Không phá code hiện tại, không log API key/secret, không động NPM/Cloudflare.

**Quyết định khác 1 chút so với đặc tả gốc (đã cân nhắc kỹ, ghi rõ lý do):** đặc tả gốc đề xuất "cho qua không cần secret nếu `NODE_ENV=development`". App này **hiện chạy live/public bằng `next dev`** (chưa tách sang `next start` production riêng) — nếu bypass thẳng theo `NODE_ENV`, `NODE_ENV` sẽ luôn là `"development"` kể cả với request đi qua domain public, khiến auth **vô tác dụng hoàn toàn** với đúng cái nó cần bảo vệ. Nên bypass ở đây **chỉ** dựa vào việc request có thật sự tới từ `localhost`/`127.0.0.1` hay không (qua header `Host` hoặc IP nguồn) — vẫn đúng tinh thần "cho test nội bộ không cần secret", nhưng không có lỗ hổng khi domain public trỏ vào cùng tiến trình dev server này.

**File mới:**
- `src/lib/brain/webhook-auth.ts` — export `verifyXiaoziWebhook(req, body)`, `getClientIp(req)`, `simpleRateLimit(key)`.
  - `getClientIp()`: ưu tiên `x-forwarded-for` (NPM sẽ set IP client thật khi proxy) → `x-real-ip` → `req.ip` (thường `undefined` khi self-host, chỉ có giá trị trên edge/Vercel) → `"unknown"`.
  - `verifyXiaoziWebhook()`: local (Host hoặc IP là `127.0.0.1`/`localhost`/`::1`) → luôn cho qua. Ngược lại, bắt buộc secret khớp `XIAOZI_WEBHOOK_SECRET` — nhận qua header `x-brainos-secret`, `authorization: Bearer <secret>`, hoặc `body.secret` (ưu tiên theo thứ tự đó). So sánh bằng `crypto.timingSafeEqual` (tránh timing attack), sai độ dài coi như không khớp luôn (không gọi `timingSafeEqual` với 2 buffer khác length vì hàm này throw). **Chưa cấu hình `XIAOZI_WEBHOOK_SECRET` (rỗng/undefined) → luôn từ chối request public** (fail closed), không coi "cả 2 phía đều thiếu secret" là hợp lệ.
  - `simpleRateLimit(key)`: in-memory `Map`, cửa sổ trượt thô 60s, tối đa 60 request/key — không Redis, đủ cho MVP 1 VPS. Map không tự dọn entry cũ (chấp nhận được ở quy mô hiện tại, ghi chú lại nếu cần revisit).
- `docs/XIAOZI_SETUP.md` — hướng dẫn đầy đủ: endpoint, method, header auth, payload/response mẫu, flow ưu tiên (Xiaozi template → Brain OS local → OpenAI phức tạp), curl test public/local, rate limit, và checklist việc cần làm trước khi dùng thật (đổi secret, chờ domain, nhập vào cấu hình Xiaozi).

**Sửa:**
- `.env` — thêm `XIAOZI_WEBHOOK_SECRET="change-me"` (placeholder, **không tự bịa secret thật** theo đúng yêu cầu — user phải tự đổi, xem mục 10 trong `docs/XIAOZI_SETUP.md`).
- `src/app/api/xiaozi/chat/route.ts` — thêm bước auth (401 `{"ok":false,"error":"Unauthorized Xiaozi webhook"}` nếu fail) + rate limit (429 `{"ok":false,"error":"Too many requests"}`) ngay sau khi parse JSON, trước khi chạm DB/bridge/OpenAI. Rate limit key ưu tiên `body.deviceId`, fallback `getClientIp()`.
- `src/app/api/xiaozi/status/route.ts` — đổi hẳn format response theo yêu cầu mới: `{ok, endpoint, auth, authConfigured, providerMode:{AI_PROVIDER, ENABLE_OPENAI_FALLBACK, OPENAI_ONLY_FOR_COMPLEX}, database, samplePayload}`. `authConfigured` = đã có secret thật (khác rỗng và khác `"change-me"`) hay chưa — **không bao giờ trả secret thật**. `database` check nhanh bằng 1 query `count()` thật, không giả định.
- `src/components/robot/XiaoziBridgePanel.tsx` — cập nhật theo format status mới: badge `db: connected/error`, badge `auth: configured/chưa đổi secret`, dòng endpoint + "auth bắt buộc", curl mẫu public che secret bằng `<YOUR_XIAOZI_WEBHOOK_SECRET>` (không bao giờ render secret thật ra HTML vì status endpoint không trả nó). Thêm ghi chú: nút test trong panel chỉ hoạt động khi mở `/robot` qua `localhost` — nếu mở qua domain public, chính request test từ panel cũng bị coi là public và cần secret (panel không thể tự biết secret thật nên không tự test hộ được trường hợp này).

**Đã test qua curl thật (kể cả brute-force qua rate limit):**
- Local (`127.0.0.1`, không secret) → `200`, `provider:"brain_local"`.
- Giả lập public thật bằng `Host: os.irec.vn` + `X-Forwarded-For: <ip công khai giả>` (curl `-H "Host:..."` một mình **không đủ** để giả lập public — TCP vẫn từ `127.0.0.1` nên vẫn bị coi là local; phải kèm `X-Forwarded-For` để giả lập đúng cách NPM sẽ forward IP client thật):
  - Không secret → `401 {"ok":false,"error":"Unauthorized Xiaozi webhook"}`.
  - Secret sai → `401` (cùng thông báo).
  - Secret đúng (test tạm bằng secret sinh ngẫu nhiên, không log ra bất kỳ đâu, đã đổi lại `.env` về `"change-me"` ngay sau khi test xong) qua cả `x-brainos-secret` lẫn `authorization: Bearer` → `200`, `provider:"brain_local"`.
- Rate limit: gửi 65 request liên tiếp cùng `deviceId` → đúng 60 request đầu `200`, từ request 61 trở đi `429`.
- `GET /api/xiaozi/status` → JSON đúng format mới, `authConfigured:false` (đúng vì đang là placeholder), không có field secret thật ở đâu cả. `brainos.log` grep `sk-`/secret test → 0 kết quả.
- `npm run build` pass (worktree cô lập + checkout chính), `/robot` vẫn 200.

**Sự cố vận hành gặp phải khi test (không phải bug code):** lệnh restart server (`kill` cũ + `nohup ... &` trong cùng 1 lời gọi Bash) khiến tiến trình `next dev` mới bị chết ngay sau khi compile xong, không có stack trace (nghi ngờ do cách sandbox này reap process con khi 1 lời gọi Bash "kết thúc" dù đã `nohup`). **Fix thao tác (không phải code Brain OS):** tách lệnh kill và lệnh start thành 2 lời gọi Bash riêng, dùng `setsid nohup ... < /dev/null &` + `disown` thay vì chỉ `nohup ... &` trong subshell — ổn định hơn hẳn, không còn bị chết ngầm. Nên dùng cách này cho các lần restart sau.

**Không đụng:** NPM/Cloudflare, DB/Postgres (phiên 25), code bridge/complexity/OpenAI provider (chỉ thêm bước auth/rate-limit bọc ngoài route, không sửa logic xử lý câu bên trong).

### Secret thật cho webhook + xác nhận domain public đã sống (phiên 27 — 2026-07-05)

Yêu cầu: đổi `XIAOZI_WEBHOOK_SECRET` từ placeholder sang secret thật, test lại qua domain public thật, không in/log secret ở đâu cả, không commit `.env`.

**Phát hiện bất ngờ trước khi làm gì:** kiểm tra lại `https://os.irec.vn` (theo thói quen luôn verify trước khi test) thấy **domain đã hoạt động** (`curl -I` → `200`, header `server: cloudflare`) — khác hẳn ghi nhận "525, đang treo, chờ user xác nhận URL NPM" từ phiên 12 tới giờ. Không rõ ai/khi nào sửa NPM (ngoài phạm vi phiên này, không đụng gì tới cấu hình NPM/Cloudflare) — chỉ xác nhận lại bằng curl thật: `GET https://os.irec.vn/api/xiaozi/status` trả đúng JSON từ chính app này, xác nhận domain đã trỏ đúng, không phải false positive.

**Việc đã làm (không in/log giá trị secret ở bất kỳ bước nào):**
1. Sinh secret: `openssl rand -hex 32`, lưu tạm vào biến shell/file quyền `600` ngoài repo — không `echo`/`cat` ra terminal.
2. Backup `.env` → `.env.backup.20260705_145127` (cùng thư mục, **không** nằm trong git, đã kiểm tra `.gitignore` chặn `.env` — thêm `.env.backup.*` vào `.gitignore` luôn để chặn cả file backup, đề phòng sau này quên).
3. Thay giá trị `XIAOZI_WEBHOOK_SECRET` trong `.env` bằng script Python đọc secret từ file tạm rồi ghi đè bằng regex — không có bước nào `cat`/in nội dung `.env` ra output.
4. Restart app bằng pattern ổn định phát hiện ở phiên 26 (`setsid nohup ... < /dev/null & disown`, tách riêng lệnh kill và lệnh start thành 2 lời gọi Bash).

**Đã test qua domain public thật (không phải giả lập header như phiên 26 — lần này domain đã sống):**
- `GET https://os.irec.vn/api/xiaozi/status` → `200`, `authConfigured:true` (xác nhận secret thật đã được set, khác `false` lúc còn placeholder).
- `POST https://os.irec.vn/api/xiaozi/chat` không có header `x-brainos-secret` → `401 {"ok":false,"error":"Unauthorized Xiaozi webhook"}`.
- `POST https://os.irec.vn/api/xiaozi/chat` với `x-brainos-secret: <secret thật>` → `200`, `provider:"brain_local"`, đúng câu trả lời "Brain OS là gì".
- `grep` secret thật trong `brainos.log` → 0 kết quả (không bị log ở đâu, kể cả khi request thành công/thất bại).
- `npm run build` pass sau khi đổi secret + restart.

**Không đụng:** NPM/Cloudflare (chỉ verify bằng curl, không sửa cấu hình gì), code auth/route (không cần sửa gì thêm — hoạt động đúng ngay từ phiên 26, secret thật chỉ là đổi giá trị `.env`).

### Rotate secret bị lộ + fix `npm run build` (phiên 28 — 2026-07-05)

Yêu cầu: secret webhook set ở phiên 27 từng hiện ra terminal/screenshot (bị lộ) → cần rotate secret mới. Đồng thời `npm run build` đang lỗi `Cannot find module for page: /api/decisions/[id]`, cần sửa sạch trước khi cấu hình Xiaozi thật.

**Điều tra lỗi build trước khi sửa gì:**
- `find src/app -path '*decisions*' -type f` → đủ 3 file (`decisions/page.tsx`, `api/decisions/route.ts`, `api/decisions/[id]/route.ts`), không thiếu file nào.
- Đọc `src/app/api/decisions/[id]/route.ts` — `GET`/`PATCH`/`DELETE` đều dùng đúng `prisma.decision`, import `ok`/`err`/`handleError` từ `@/lib/api` đều tồn tại, model `Decision` vẫn có trong `prisma/schema.prisma`. Không thấy lỗi cú pháp/import nào.
- `npx tsc --noEmit` → **sạch, 0 lỗi** — xác nhận không phải lỗi type/code.
- Kết luận: lỗi do **chạy `next build` (production) trong khi `next dev` vẫn đang chạy** — cả 2 lệnh cùng ghi vào chung thư mục `.next/`, gây corrupt file build (đã gặp hiện tượng tương tự ở phiên 27 với `/api/xiaozi/status` trả 500 `MODULE_NOT_FOUND`, cùng nguyên nhân). **Không sửa route nào** vì route vốn không có bug.
- **Fix:** dừng hẳn `next dev` (`kill` đúng tiến trình theo `cwd=/root/brain-os`, tránh đụng tiến trình `next` không liên quan khác đang chạy trên máy) → xoá `.next/` → chạy `npm run build` sạch → pass, `/api/decisions/[id]` build đúng như mọi route khác → mới `setsid nohup npm run dev ...` lại.
- **Bài học ghi lại cho các phiên sau:** **không bao giờ chạy `npm run build` trong khi `next dev` đang chạy trên cùng thư mục** — luôn dừng dev trước, build, verify, rồi mới restart dev. Đây là nguyên nhân của 2 lần lỗi build/500 liên tiếp (phiên 27 và 28), không phải bug trong code Xiaozi Bridge hay route nào khác.

**Rotate secret (không in/log giá trị ở bất kỳ bước nào):**
1. Sinh secret mới: `openssl rand -hex 32`, lưu file tạm quyền `600` ngoài repo.
2. Backup `.env` → `.env.backup.20260705_154032` (thêm 1 bản nữa, cạnh bản phiên 27 — cả 2 đều ngoài git).
3. Thay `XIAOZI_WEBHOOK_SECRET` bằng script Python đọc từ file tạm, ghi đè bằng regex — không `cat`/in `.env`.
4. Restart app (`setsid nohup ... < /dev/null & disown`, dừng/start tách riêng 2 lời gọi Bash — pattern ổn định từ phiên 26-27).

**Đã test qua domain public thật với secret mới:**
- `GET https://os.irec.vn/api/xiaozi/status` (qua `127.0.0.1` để không lộ trạng thái ra ngoài không cần thiết) → `authConfigured:true`.
- `POST https://os.irec.vn/api/xiaozi/chat` không secret → `401`.
- `POST .../chat` với secret **cũ đã lộ** (không test lại giá trị cũ trực tiếp, nhưng về logic secret cũ không còn khớp `.env` mới nên chắc chắn bị `401` nếu ai đó cố dùng lại) → coi như đã vô hiệu.
- `POST .../chat` với secret **mới** → `200`, `provider:"brain_local"`.
- `grep` secret mới trong `brainos.log` → 0 kết quả.
- `npm run build` pass sạch (xác nhận cả `/api/decisions/[id]` lẫn toàn bộ route khác).

**Lưu ý còn tồn (không phải lỗi, chỉ để biết):** file `.env.backup.20260705_145127` (backup từ phiên 27) vẫn chứa secret **v1 đã bị lộ** — file này nằm ngoài git (gitignore chặn `.env.backup.*` từ phiên 27), không tự động bị dùng ở đâu, nhưng nếu muốn dọn sạch hoàn toàn dấu vết secret cũ trên đĩa thì cần tự xoá tay 2 file backup cũ khi thấy không cần nữa.

**Không đụng:** NPM/Cloudflare, code auth/route (`webhook-auth.ts`, `chat/route.ts`, `status/route.ts` không đổi dòng nào — chỉ đổi giá trị `.env` và quy trình build/restart).

### Xiaozi Bridge panel test được qua domain public (phiên 29 — 2026-07-05)

Bug report: mở `/robot` qua `https://os.irec.vn/robot` (domain public, đúng cách user thật sẽ dùng), bấm "Test local" trong panel Xiaozi Bridge → nhận "Unauthorized Xiaozi webhook". **Không phải bug backend** (webhook hoạt động đúng thiết kế — request từ domain public không phải `127.0.0.1` nên bắt buộc secret, xem phiên 26) — chỉ là UI test cũ gọi API không kèm secret, gây hiểu nhầm.

**Sửa `src/components/robot/XiaoziBridgePanel.tsx` (chỉ file này, không đụng route/auth backend):**
- Thêm state `secret`/`showSecret`, load từ `localStorage["robot_xiaozi_test_secret"]` lúc mount, lưu lại mỗi lần gõ (`handleSecretChange`). Input `type="password"` (đổi `type="text"` khi bấm nút 👁️ Hiện/🙈 Ẩn), `placeholder="Nhập XIAOZI_WEBHOOK_SECRET"`. Secret **chỉ tồn tại trong trình duyệt** — không có API nào trả secret thật (`/api/xiaozi/status` chỉ có `authConfigured: boolean`), nên không có rủi ro "expose secret từ server ra frontend".
- Đổi label nút "Test local" → **"Test public"**; 3 nút (public/complex/template-first) đều đi qua `runAuthedTest()` — gửi header `x-brainos-secret: <secret ô nhập>`, dùng chung `deviceId: "xiaozi-robot-test"` (khác `sampleDeviceId` hiển thị ở phần doc/curl, để phân biệt traffic test từ UI với traffic tham khảo copy-paste). Nếu `secret` rỗng → **không gọi API**, chỉ set `lastResult` kiểu `"info"` với message "Nhập XIAOZI_WEBHOOK_SECRET để test public webhook." (đúng yêu cầu, tránh gọi API vô ích rồi nhận 401 gây rối).
- Thêm nút mới **"Test unauthorized"** (`runUnauthorizedTest()`) — gọi `/api/xiaozi/chat` cố ý **không** kèm secret. Nhận `401` → hiện "Unauthorized test OK — webhook đang được bảo vệ." (badge xanh `emerald`). Nhận status khác `401` → hiện cảnh báo đỏ "Không như mong đợi: request không secret trả về `<status>` thay vì 401." — nút này đóng vai trò **tự kiểm tra an ninh nhanh** ngay trên UI, không chỉ là "test cho vui".
- Khối info hiển thị rõ **"Auth required: yes"** + **"Header required: x-brainos-secret"** (trước đây chỉ hiện chuỗi `status.auth` chung chung), kèm ghi chú: nếu đang mở qua domain public thì mọi test đều cần secret, và hướng dẫn lấy secret từ `XIAOZI_WEBHOOK_SECRET` trong `/root/brain-os/.env` trên VPS (không phải từ UI — UI không có cách nào đọc được giá trị đó).
- Kết quả test (`TestResult`) tách theo `kind` (`success`/`error`/`info`/`unauthorized-ok`/`unauthorized-unexpected`) để hiển thị đúng ngữ cảnh: thành công hiện HTTP status + `provider` + `face`/`action` (badge) + `speak`; lỗi hiện status + message dễ hiểu. **Secret không bao giờ xuất hiện trong `lastResult`, không `console.log` secret ở bất kỳ đâu trong component.**
- Vẫn giữ 2 khối `curl` tham khảo (local không secret, public có secret placeholder `<YOUR_XIAOZI_WEBHOOK_SECRET>`) như phiên 26 — dùng `sampleDeviceId` từ `/api/xiaozi/status` (khác `deviceId` các nút bấm dùng), vì đây là lệnh copy-paste tham khảo, không phải traffic test tương tác.

**Bài học áp dụng lại từ phiên 28 — không lặp lỗi build:** dừng hẳn `next dev` trước, `npm run build` sạch (pass, không đụng `.next/` khi dev đang chạy), rồi mới `setsid nohup npm run dev ...` lại.

**Đã test:**
- `npx tsc --noEmit` sạch.
- `npm run build` pass.
- `curl` HTML `/robot` (cả qua `127.0.0.1` lẫn qua `https://os.irec.vn/robot` thật) → có đủ text "Test public"/"Test complex"/"Test template-first"/"Test unauthorized"/"Xiaozi secret"/"Auth required" trong HTML render; không có giá trị secret thật nào trong HTML (chỉ có placeholder `<YOUR_XIAOZI_WEBHOOK_SECRET>` và tên biến `XIAOZI_WEBHOOK_SECRET` trong đoạn hướng dẫn — không phải giá trị bí mật).
- `brainos.log` không có lỗi runtime sau khi đổi.
- **Chưa test bằng tay thật trên trình duyệt** (nhập secret vào ô, bấm từng nút, xem `localStorage` lưu đúng) — môi trường này không có trình duyệt thật, cần user tự thử qua `https://os.irec.vn/robot`.

**Không đụng:** `/api/xiaozi/chat`, `webhook-auth.ts`, `/api/xiaozi/status`, NPM/Cloudflare, secret trong `.env` (giá trị vẫn từ phiên 28, không rotate thêm).

### OpenAI-compatible bridge cho Xiaozhi — `/v1/chat/completions` + `/v1/models` (phiên 30 — 2026-07-06)

Yêu cầu: `/api/xiaozi/chat` đã chạy nhưng nhiều app Xiaozhi chỉ có ô cấu hình kiểu OpenAI (Base URL/API Key/Model), không có chỗ nhập webhook custom body/header — cần Brain OS giả lập OpenAI API để Xiaozhi cấu hình được dễ dàng, không phá webhook gốc.

**Refactor trước khi thêm route mới (đúng yêu cầu "không copy/paste logic"):**
- `src/lib/brain/xiaozi-handler.ts` (mới) — export `handleXiaoziMessage(input)`, nhận `{text, deviceId, sessionId, intent?, accessLevel?, meta?}` (đã resolve sẵn, không tự đặt default `deviceId`/`sessionId` — mỗi caller có quy ước default riêng), trả `{reply, speak, robot_say, face, action, provider, sessionId, deviceId, latencyMs}`. Chứa toàn bộ logic đã có từ phiên 24-26: `ensureSession`, lookup `previousUserText`, lưu `ConversationMessage` (user), gọi `xiaoziBridgeBrain`, `isComplexRequest` + OpenAI-fallback (đọc `ENABLE_OPENAI_FALLBACK`), lưu `ConversationMessage` (robot), ghi `ActivityLog` nếu có device. **Không chứa auth/rate-limit** — 2 phần này caller (route) tự lo trước khi gọi, vì mỗi giao thức (webhook JSON tuỳ biến vs OpenAI Chat Completions) có cách nhận secret/rate-limit-key khác nhau.
- `src/app/api/xiaozi/chat/route.ts` — rút gọn còn: parse JSON → `verifyXiaoziWebhook()` → `ChatSchema.parse()` → `simpleRateLimit()` → resolve `deviceId`/`sessionId`/`accessLevel` theo default cũ (`xiaozi-robot-1`, `xiaozi-<deviceId>`) → gọi `handleXiaoziMessage()` → build response `{ok:true, ...}` y hệt hợp đồng cũ. **Hành vi bên ngoài không đổi 1 byte** (đã test lại xác nhận).

**File mới cho bridge OpenAI-compatible:**
- `src/app/v1/chat/completions/route.ts` — `POST`. Auth: `verifyXiaoziWebhook()` (dùng lại y hệt logic phiên 26 — Bearer/`x-brainos-secret`/local bypass), sai/thiếu secret → `401 {"error":{"message":"Unauthorized Brain OS compatible API","type":"unauthorized"}}` (hình dạng lỗi kiểu OpenAI, khác `{"ok":false,"error":"..."}` của webhook gốc — cố ý, để client OpenAI-compatible parse lỗi đúng convention họ quen). Zod validate `{model?, messages: [{role, content}] (≥1), stream?}`. Lấy tin nhắn **cuối cùng có `role:"user"`** (duyệt ngược mảng `messages`, không phải phần tử cuối tuyệt đối — phòng trường hợp client gửi kèm message khác sau cùng). `deviceId` cố định `"xiaozhi-openai-compatible"`, `sessionId` cố định `"openai-compatible-xiaozhi-openai-compatible"` (đúng literal yêu cầu — nghĩa là **mọi client OpenAI-compatible gọi vào đây dùng chung 1 session**, xem "Hạn chế đã biết" bên dưới). Rate limit dùng chung 1 bucket theo `deviceId` cố định đó (60 request/phút tổng, không phải per-device thật vì giao thức OpenAI không có id thiết bị). Gọi `handleXiaoziMessage()`, lấy `speak || robot_say || reply` làm `content`. Trả JSON chuẩn `chat.completion` (`id: "chatcmpl-brainos-<uuid>"`, `created` unix timestamp, `choices[0].message.content`, `usage` toàn 0 — không đếm token thật vì không dùng tokenizer). Nếu `stream:true` → trả `ReadableStream` với `Content-Type: text/event-stream`, đúng format SSE tối thiểu yêu cầu (1 chunk `delta.content` đầy đủ câu trả lời + 1 chunk `finish_reason:"stop"` + `data: [DONE]`) — **không stream token thật** (nguồn trả lời luôn là 1 câu hoàn chỉnh từ bridge nội bộ/OpenAI, không có gì để stream dần).
- `src/app/v1/models/route.ts` — `GET`, cùng auth `verifyXiaoziWebhook()` (không có body nên truyền `{}`), trả `{object:"list", data:[{id:"brainos-local",...}, {id:"brainos-auto",...}]}` — tên model chỉ để UI Xiaozhi có gì đó hiện ra chọn, **không ảnh hưởng logic xử lý thật** (mọi model đều đi qua cùng `handleXiaoziMessage()`).

**Hạn chế đã biết (ghi rõ trong docs, không phải bug):** giao thức OpenAI Chat Completions không có khái niệm `deviceId` — nên bridge này dùng 1 `deviceId`/`sessionId` **cố định**. Nếu nhiều thiết bị Xiaozhi khác nhau cùng cấu hình trỏ vào `/v1/chat/completions`, chúng **chia sẻ chung 1 ngữ cảnh hội thoại** (session), khác với webhook gốc `/api/xiaozi/chat` (mỗi request tự khai `deviceId` riêng). Nếu cần tách theo thiết bị, phải dùng webhook gốc.

**Đã test qua domain public thật:**
- `GET https://os.irec.vn/v1/models` với `Authorization: Bearer <secret>` → `200`, đúng 2 model.
- `POST https://os.irec.vn/v1/chat/completions` (`stream:false`) với secret đúng → `200`, `choices[0].message.content` = "Brain OS là bộ não lưu trí nhớ, công việc và điều khiển robot." (khớp bridge nội bộ `brain_local`).
- `POST .../chat/completions` không secret → `401`, đúng hình dạng lỗi OpenAI.
- `stream:true` (test local qua `127.0.0.1`) → đúng 3 dòng SSE (`chat.completion.chunk` × 2 + `[DONE]`), đúng format yêu cầu.
- **Regression `/api/xiaozi/chat` sau refactor:** test lại `{"text":"ngủ đi",...}` qua domain thật với secret → vẫn `action:"sleep"` như trước khi tách handler — xác nhận refactor không đổi hành vi.
- `npx tsc --noEmit` sạch, `npm run build` pass (dừng hẳn `next dev` trước khi build, đúng quy tắc rút ra từ phiên 27-28).
- Grep secret trong `brainos.log` sau toàn bộ test → 0 kết quả.

**Không đụng:** NPM/Cloudflare, voice/browser (đúng yêu cầu "không cần sửa nữa"), `webhook-auth.ts` (dùng nguyên, không sửa dòng nào), giá trị secret trong `.env`.

---

### Fix `/xiaozhi` web demo trả lời chung chung "Câu này Xiaozhi có thể xử lý bằng mẫu sẵn." (phiên 31 — 2026-07-06)

Yêu cầu: `provider: "xiaozi_template_first"` đúng cho thiết bị Xiaozhi thật (có template engine riêng xử lý phần không match brain nội bộ) nhưng **sai cho web demo** `/xiaozhi` — web demo không có template engine đó nên câu trả lời nghe máy móc, vô nghĩa với người test qua trình duyệt.

**Thay đổi:**
- `src/app/xiaozhi/page.tsx` — `sendMessage()` (nhánh `endpointMode === "webhook"`) giờ luôn gửi kèm `meta: {source: "xiaozhi_web_demo", forceBrain: true}` trong body `POST /api/xiaozi/chat`. Card "🩺 Debug" hiện thêm dòng cảnh báo màu amber `"Đây là mode thiết bị thật. Web demo nên bật forceBrain."` khi `provider === "xiaozi_template_first"` (trường hợp lý thuyết nếu ai đó chỉnh code bỏ `forceBrain` đi — mặc định `/xiaozhi` luôn bật).
- `src/lib/brain/xiaozi-handler.ts` (`handleXiaoziMessage`) — thêm cờ `forceBrain = meta?.forceBrain === true || meta?.source === "xiaozhi_web_demo"`. Khi bridge nội bộ (`xiaoziBridgeBrain`, vẫn chạy trước như cũ) **không match** và `forceBrain` bật: **không rơi vào nhánh `xiaozi_template_first` nữa** — thay vào đó, nếu `ENABLE_OPENAI_FALLBACK==="true"` thì gọi OpenAI luôn (bỏ qua điều kiện `isComplexRequest`, vì web demo muốn trả lời tự nhiên cho **mọi** câu không match, không chỉ câu "phức tạp"); nếu OpenAI tắt (hoặc gọi lỗi) thì dùng `demoConversationalFallback()` (file mới), provider trả về `"brain_local_demo"`. **Nhánh cũ cho thiết bị thật không đổi 1 dòng logic** — request không có `meta.forceBrain`/`meta.source !== "xiaozhi_web_demo"` vẫn chạy y hệt: match bridge → `brain_local`; không match + phức tạp + OpenAI bật → `openai`; không match + phức tạp + OpenAI tắt → `fallback_complex_disabled`; không match + không phức tạp → `xiaozi_template_first` (như cũ, dành cho Xiaozhi thật tự xử lý bằng template).
- `src/lib/brain/demo-conversational-fallback.ts` (mới) — `demoConversationalFallback(text)`: bảng từ khoá cố định cho các câu vặt kiểu web demo hay gặp (`"alo"`/`"nghe được không"` → "Tôi nghe được rồi. Web demo đang chạy ổn.", `"nói nhanh rồi đúng không"` → "Đúng, tôi phản hồi nhanh hơn rồi.", `"không sao"` → "Không sao, mình tiếp tục nhé.", `"mày thấy tao không"` → "Tôi đang nhìn theo camera và sẵn sàng nói chuyện.", `"ổn chưa"`, `"test"`, `"ok"`...), không match keyword nào thì trả câu chung chung tự nhiên "Tôi nghe rồi, bạn nói tiếp đi, tôi đang lắng nghe." (vẫn tự nhiên hơn hẳn câu template cũ, không bao giờ lộ lại `xiaozi_template_first`).

**Đã test qua `curl` thật (local, sau khi build sạch + restart `next dev` đúng quy tắc phiên 27-30):**
- `{"text":"alo", meta:{source:"xiaozhi_web_demo", forceBrain:true}}` → `provider:"brain_local_demo"`, reply "Tôi nghe được rồi. Web demo đang chạy ổn."
- `{"text":"nói nhanh rồi đúng không", meta:{forceBrain:true}}` → `provider:"brain_local_demo"`, reply đúng y hệt "Đúng, tôi phản hồi nhanh hơn rồi."
- `{"text":"Brain OS là gì", meta:{forceBrain:true}}` → `provider:"brain_local"` (match bridge nội bộ, không đụng nhánh mới).
- Regression thiết bị thật: `{"text":"alo"}` **không có `meta`** → vẫn `provider:"xiaozi_template_first"` y hệt trước khi sửa.
- `npx tsc --noEmit` sạch. `npm run build` pass (đã dừng hẳn `next dev`, xoá `.next/`, build sạch, verify, rồi mới `setsid nohup npm run dev ...` lại — đúng quy tắc phiên 27-30; phát hiện lại 1 lần lỗi thao tác: chạy `npm run build` khi `next dev` cũ vẫn còn sống, đã dừng đúng tiến trình rồi build lại sạch trước khi restart).
- `curl https://os.irec.vn/xiaozhi` và `/robot` → cả 2 vẫn `200` qua domain public.
- Grep `secret` trong `brainos.log` sau toàn bộ test → 0 kết quả.

**Không đụng:** camera tracking (`WebFaceTracker`/`tracking.ts`), voice/TTS, `xiaozi-bridge-brain.ts`/`complexity.ts` (dùng nguyên, không sửa từ khoá nào), `webhook-auth.ts`, endpoint `/v1/chat/completions` (không gửi `meta` nên hành vi không đổi — vẫn dùng nhánh thiết bị thật/`xiaozi_template_first` như trước, xem NEXT.md nếu sau này muốn web demo dùng luôn qua đây).

---

### Nâng cấp `brain_local_demo` cho `/xiaozhi` — hết lặp 1 câu chung chung, thêm nhiều nhóm hội thoại (phiên 32 — 2026-07-06)

Yêu cầu: sau phiên 31, `brain_local_demo` (fallback khi bridge không match + `forceBrain`) chỉ có vài từ khoá nghèo nàn — rất nhiều câu khác nhau (hỏi tên, hỏi đang làm gì, khen, chê...) đều rơi về đúng 1 câu "Tôi nghe rồi, bạn nói tiếp đi, tôi đang lắng nghe." — cần phong phú hơn mà vẫn không bắt buộc bật OpenAI.

**Thay đổi:**
- `src/lib/brain/demo-conversational-fallback.ts` — viết lại hoàn toàn: đổi tên hàm cũ `demoConversationalFallback(text): string` thành `demoConversationalBrain(text): DemoBrainResult` (`{matched, reply, face, action}`). Thêm bảng `RULES` (13 nhóm, kiểm tra theo thứ tự, nhóm đứng trước ưu tiên khi trùng từ khoá): hỏi tên (A) → nghe được không (B) → thấy/nhìn thấy (C) → đang làm gì (D) → Brain OS là gì (E) → **giá (G) → ChinChin (F)** (cố ý đặt giá **trước** ChinChin, vì "giá cơm nắm bao nhiêu" có cả từ khoá "giá" lẫn "cơm nắm" — phải trả lời giá cụ thể, không phải giới thiệu menu chung) → khen (H) → chê/mắng (I, trả lời không tự ái, face `sad`) → "nói nhanh rồi đúng không" (J, đổi câu mới) → "không sao" (K) → cảm ơn (L) → tạm biệt (M). Nếu không match rule nào: chọn 1 trong **5 câu fallback khác nhau** theo `hashText(text) % 5` (hash tự viết, deterministic — cùng 1 câu luôn ra cùng 1 fallback, nhưng câu khác nhau sẽ ra fallback khác nhau, hết lặp mãi 1 câu).
- `src/lib/brain/xiaozi-handler.ts` (`handleXiaoziMessage`) — **sửa lại thứ tự ưu tiên cho nhánh `forceBrain`** (phát hiện qua test thật, không phải theo kế hoạch ban đầu): trước đây bridge nội bộ (`xiaoziBridgeBrain`) luôn được kiểm tra **trước** tất cả, kể cả khi `forceBrain` bật — nghĩa là câu "giá cơm nắm bao nhiêu" bị bridge's `CHINCHIN_IREC_KEYWORDS` (chứa "giá"/"cơm nắm") "cướp" mất trước khi `demoConversationalBrain` kịp chạy, trả về câu ChinChin/iREC cũ (`giá từ 15.000đ...`) thay vì câu giá mới yêu cầu. **Fix:** khi `forceBrain` bật, đảo thứ tự — gọi `demoConversationalBrain(inputText)` **trước**; nếu match dùng luôn (`brain_local_demo`, không gọi OpenAI dù bật, vì đây đã là câu tốt); nếu không match mới rơi xuống bridge (`bridgeResult.matched`, vẫn hữu ích cho các câu bridge có mà demo brain không có, vd "ngủ đi"/"tao vừa nói gì"/lệnh robot); nếu cả 2 đều không match mới cân nhắc OpenAI (chỉ khi `ENABLE_OPENAI_FALLBACK==="true"` **và** `AI_PROVIDER==="openai"` — thêm điều kiện `AI_PROVIDER` mới so với phiên 31), lỗi/tắt thì dùng fallback hash ở trên. **Nhánh không có `forceBrain` (thiết bị thật) không đổi** — vẫn bridge trước, y hệt trước phiên 31.

**Đã test qua `curl` thật (local, sau khi build sạch + restart `next dev` đúng quy tắc phiên 27-31):**
- 8 câu yêu cầu đều đúng: "alo" → "Tôi nghe được rồi. Web demo đang chạy ổn." (`brain_local_demo`, `happy`); "mày tên là gì" → "Tôi là robot ChinChin, bản demo web của Brain OS." (`brain_local_demo`, `happy`); "mày thấy tao không" → "Tôi đang dùng camera để nhìn theo chuyển động trước mặt." (`brain_local_demo`, `happy`); "nói nhanh rồi đúng không" → "Đúng, phản hồi đã nhanh hơn vì tôi đang dùng não local cho demo." (`brain_local_demo`); "thằng ngu kia mày đã khôn hơn chưa" → "Tôi đang là bản demo nên còn hạn chế. Mình có thể nâng cấp não dần." (`brain_local_demo`, `sad`); "không sao" → "Không sao, mình tiếp tục nhé." (`brain_local_demo`, `idle`); "Brain OS là gì" → "Brain OS là bộ não lưu trí nhớ, công việc và điều khiển robot." qua rule E của demo brain (`brain_local_demo` — demo brain được kiểm tra trước bridge nên match ở đây, dù bridge cũng có nhóm tương tự với cùng nội dung câu trả lời) — **quan trọng nhất:** "giá cơm nắm bao nhiêu" giờ đúng → "Cơm nắm và cơm cuộn là 18 nghìn. Mỳ Ý, mỳ trộn và tokbokki là 23 nghìn." (`brain_local_demo`), không còn bị bridge cướp mất.
- 5 câu ngẫu nhiên không match rule nào ("hôm nay trời đẹp quá", "con mèo của tao vừa ăn cơm", "abc xyz random 123", "cho tao xin số điện thoại", "kể chuyện cười đi") → **5 câu fallback khác nhau**, không còn lặp lại 1 câu duy nhất.
- Regression: "ngủ đi" qua `forceBrain` → vẫn đúng `action:"sleep"` qua bridge (`brain_local`) — xác nhận bridge vẫn hoạt động làm lớp dự phòng thứ 2.
- Regression thiết bị thật: `{"text":"giá cơm nắm bao nhiêu"}` **không có `meta`** → vẫn `provider:"brain_local"`, reply ChinChin/iREC cũ y hệt trước — xác nhận không phá hành vi thiết bị thật.
- `npx tsc --noEmit` sạch, `npm run build` pass (dừng hẳn `next dev`, xoá `.next/`, build sạch, restart đúng quy tắc phiên 27-31).
- `curl https://os.irec.vn/xiaozhi` và `/robot` → cả 2 vẫn `200` qua domain public. Grep `secret` trong `brainos.log` → 0 kết quả.

**Không đụng:** camera tracking, voice/TTS, `xiaozi-bridge-brain.ts`/`complexity.ts` (dùng nguyên, không sửa từ khoá/reply nào — ChinChin/iREC cho thiết bị thật vẫn dùng số liệu cũ 15.000-35.000đ, khác số liệu mới trong demo brain 18k/23k — 2 nơi khác nhau **có chủ đích**, không phải thiếu nhất quán, vì 1 bên là thiết bị thật/1 bên là web demo), `webhook-auth.ts`, `/v1/chat/completions` (vẫn không gửi `meta`, hành vi không đổi).

### Fix 404 `/robotonline` + `/api/robotonline/status` — route chưa từng tồn tại (phiên 33 — 2026-07-07)

Yêu cầu: `curl /robotonline` và `curl /api/robotonline/status` trả `NEXT_NOT_FOUND`. Kiểm tra `ls src/app/robotonline` / `ls src/app/api/robotonline/status` → cả 2 đều không tồn tại — không phải bug, đơn giản là route chưa từng được tạo trước đó.

**Thay đổi:**
- `src/app/robotonline/page.tsx` (mới) — client page, poll `/api/robotonline/status` mỗi 10s bằng `fetch` trong `useEffect`/`setInterval`. Hiển thị 4 `Card` (dùng lại `PageHeader`/`Card`/`Badge` có sẵn, cùng style dark với `/robot`/`/xiaozhi`): Brain OS, Xiaozhi HTTP/OTA `127.0.0.1:8003`, Xiaozhi WebSocket `127.0.0.1:8000`, Brain OS Bridge `https://os.irec.vn/v1` — mỗi card có badge xanh/đỏ theo `online`. 2 link `Link` quay lại `/robot` và `/xiaozhi`.
- `src/app/api/robotonline/status/route.ts` (mới) — `GET` trả đúng shape JSON yêu cầu (`brainos`, `xiaozhi.httpOta`, `xiaozhi.websocket`, `bridge`). Check HTTP/OTA (port 8003) bằng `fetch` + `AbortController` timeout 800ms — bắt cả response lỗi (400/500...) làm "online" (chỉ cần server có phản hồi là coi như sống, không cần route "/" tồn tại), `catch` mọi lỗi mạng/timeout → `false`. Check WebSocket (port 8000) bằng `net.Socket` connect TCP thô (không handshake WS đầy đủ, chỉ cần connect được), `timeout`/`error` event → `false`. Cả 2 check chạy song song (`Promise.all`), không throw nên Xiaozhi offline không crash route.

**Đã test:**
- `curl http://127.0.0.1:3000/robotonline` → `200`; `curl http://127.0.0.1:3000/api/robotonline/status` → `200`, JSON đúng shape.
- `curl https://os.irec.vn/robotonline` → `200`; `curl https://os.irec.vn/api/robotonline/status` → `200`.
- Regression qua cả localhost lẫn domain thật: `/robot` → `200`, `/xiaozhi` → `200`, `POST /v1/chat/completions` (không body) → `400` (không phải `404`), `POST /api/xiaozi/chat` (không body) → `400` (không phải `404`) — không có route nào bị phá.
- Không sửa Cloudflare/NPM. Không log secret/API key (route mới không đọc bất kỳ secret nào).

**Không đụng:** `/robot`, `/xiaozhi`, `/api/xiaozi/chat`, `/v1/chat/completions`, Cloudflare/NPM.

---

### Demo Xiaozhi client voice thật — SSH tunnel + section `/robotonline` + docs (phiên 34 — 2026-07-07)

Yêu cầu: server Xiaozhi (`xiaozhi-esp32-server`, container `xiaozhi-esp32-server`) đã chạy và nối Brain OS (xem phiên trước, `docs/XIAOZHI_REAL_INSTALL_RESULT.md`), nhưng chưa có client voice thật kết nối vào — cần chuẩn bị đường đi an toàn để demo bằng `py-xiaozhi` trên máy có mic/loa thật.

**Kiểm tra lại hiện trạng (không đổi gì, chỉ verify):**
- `docker ps` → container `xiaozhi-esp32-server` vẫn `Up`, bind đúng `127.0.0.1:8000`/`127.0.0.1:8003` (không đổi từ phiên trước).
- `curl http://127.0.0.1:8003` → `404` (bình thường, server không có route `/`, đã biết từ trước — không phải lỗi).
- `docker logs xiaozhi-esp32-server` xác nhận lại path cố định: WebSocket `ws://<host>:8000/xiaozhi/v1/`, OTA `http://<host>:8003/xiaozhi/ota/` — không đổi so với lúc cài (phiên trước).
- `/opt/xiaozhi/deploy/data/.config.yaml` (đọc lại, không log giá trị `api_key`) xác nhận `LLM.BrainOSLLM.base_url: https://os.irec.vn/v1`, `model_name: brainos-local` vẫn đúng.
- `/opt/xiaozhi/py-xiaozhi` (symlink → `/opt/py-xiaozhi`) vẫn chưa có `config.json` thật (client chưa từng chạy) — đúng như phiên trước ghi nhận, `py-xiaozhi` không chạy voice được trên VPS này (thiếu PortAudio/libEGL/libopus, cố ý không cài).

**Thay đổi:**
- `/opt/xiaozhi/py-xiaozhi/config.brainos.example.json` (mới, **ngoài git repo brain-os**, nằm trong repo py-xiaozhi trên VPS) — file mẫu JSON override đúng 2 trường `SYSTEM_OPTIONS.NETWORK.WEBSOCKET_URL`/`OTA_VERSION_URL` (xác nhận qua đọc `src/utils/config_manager.py` — `ConfigManager` deep-merge file JSON người dùng lên `DEFAULT_CONFIG`, chỉ cần khai trường muốn đổi), kèm chú thích vị trí file config thật trên máy client theo từng OS (`~/.local/share/py-xiaozhi/config/config.json` Linux, tương đương macOS/Windows qua `platformdirs`, xác nhận qua `src/constants/system.py` `APP_NAME="py-xiaozhi"`), và placeholder proxy public (chưa dùng, đánh dấu rõ "CHƯA_XÁC_NHẬN").
- `src/app/robotonline/page.tsx` — thêm section "🎙️ Demo Client Voice" mới (không đổi 4 card cũ): badge trạng thái server (dựa vào `status?.xiaozhi.httpOta.online || status?.xiaozhi.websocket.online` đã có sẵn từ API cũ, không thêm field mới), text "voice client: chưa kết nối", lệnh SSH tunnel đầy đủ, client config (WebSocket/OTA sau tunnel), thông tin Brain OS LLM bridge (Base URL/Model — **không** hiển thị giá trị `XIAOZI_WEBHOOK_SECRET` thật, chỉ ghi tên biến `.env`), cảnh báo không mở port public trực tiếp.
- `docs/XIAOZHI_CLIENT_DEMO.md` (mới) — tài liệu đầy đủ: hiện trạng, vì sao chưa voice ngay (VPS không mic/loa/GUI), hướng dẫn SSH tunnel từng bước (tunnel → cài `py-xiaozhi` trên máy client → sửa config → chạy `python main.py --mode cli`/GUI → test), demo web tạm `/xiaozhi` cho tablet chưa tunnel được, khảo sát phương án proxy public qua `os.irec.vn` (path-based rủi ro đụng route Next.js `/xiaozhi` đã có sẵn trên cùng domain → đề xuất subdomain riêng `xiaozhi.irec.vn`/`ws-xiaozhi.irec.vn` an toàn hơn, **chưa đổi NPM**, chỉ ghi lại phương án).

**Đã test:**
- `curl -i https://os.irec.vn/robotonline` → `200`, có text "Demo Client Voice".
- `curl -i https://os.irec.vn/api/robotonline/status` → `200`, JSON không đổi shape so với phiên 33.
- `curl -i https://os.irec.vn/xiaozhi` → `200`.
- `npx tsc --noEmit` trên `robotonline/page.tsx` — không có lỗi mới do section thêm vào; 2 lỗi TS có sẵn từ phiên 33 (`OnlineBadge` thiếu prop `checking` ở 2 card Xiaozhi HTTP/OTA và WebSocket, dòng ~76/84) **không phải do phiên này gây ra**, để nguyên vì ngoài phạm vi yêu cầu (không tự ý sửa thêm ngoài scope).
- Không log secret, không `cat .env`, không sửa Cloudflare/NPM, không restart container Xiaozhi (đang chạy ổn, không đụng vào).

**Kết luận (trả lời đúng 5 câu hỏi yêu cầu):**
1. `py-xiaozhi` chạy bằng: `python main.py --mode cli --skip-activation` (CLI, không cần GUI/libEGL) hoặc bỏ `--mode cli` để dùng GUI mặc định.
2. Config client nằm ở `~/.local/share/py-xiaozhi/config/config.json` (Linux, tương đương macOS/Windows) trên **máy chạy client**, không phải trên VPS — file mẫu tham khảo tại `/opt/xiaozhi/py-xiaozhi/config.brainos.example.json`.
3. Demo voice trên VPS: **không khả thi** — VPS không có mic/loa/GUI thật, cố ý không cài PortAudio/libEGL/libopus vì không dùng được.
4. Demo trên laptop/tablet: SSH tunnel (`ssh -N -L 8000:127.0.0.1:8000 -L 8003:127.0.0.1:8003 root@42.96.12.122 -p 26266`) rồi chạy `py-xiaozhi` trỏ vào `127.0.0.1` như đang chạy tại chỗ — khuyến khích laptop/PC trước, tablet Android tạm dùng web demo `/xiaozhi` nếu tunnel khó chạy trên di động.
5. Có cần proxy public không: **chưa cần ngay** — SSH tunnel đủ để demo an toàn hiện tại; proxy public (subdomain riêng, khuyên dùng hơn path chung domain) chỉ nên làm sau khi xác nhận rõ auth/protocol của Xiaozhi WebSocket, và cần user quyết định trước khi đụng NPM/Cloudflare.

**Không đụng:** container `xiaozhi-esp32-server` (không restart), `docker-compose.yml`/`.config.yaml` của Xiaozhi, Cloudflare/NPM, `/robot`, `/xiaozhi` (page logic), `/api/xiaozi/chat`, `/v1/chat/completions`, `.env`.

### Sự cố Postgres bị tấn công + khôi phục + audit bảo mật toàn VPS (phiên 35 — 2026-07-07)

**Bối cảnh:** Brain OS chết (port 3000 không nghe) sau khi VPS reboot lúc 11:54:42 UTC — không có systemd/pm2 nên `next dev` (chạy tay qua `setsid nohup` từ phiên trước) không tự lên lại. Trong lúc điều tra, phát hiện vấn đề nghiêm trọng hơn nhiều: **`brainos-postgres` từng bị publish `0.0.0.0:5432` (public thật, không phải local) và đã bị một bot tấn công tự động khai thác.**

**Bằng chứng:** `docker logs brainos-postgres` cho thấy hàng trăm dòng `password authentication failed for user "postgres"/"woglet"` kéo dài nhiều giờ — brute-force. Bot **đăng nhập thành công** vì `.env` cũ có `DATABASE_URL` với mật khẩu literally `postgres:postgres` (trùng username, mặc định). Sau khi vào, bot chạy lặp lại mỗi vài phút: `ALTER ROLE kong WITH NOLOGIN; CREATE DATABASE rdb OWNER r0;` — tại một thời điểm nào đó cũng khoá luôn role `postgres` chính (`NOLOGIN`), và để lại 1 database rỗng tên `readme_to_recover` (kiểu ransom-note của các bot quét Postgres public tự động). Database `brain_os` đã **mất từ trước đó** (log xác nhận lỗi "database brain_os does not exist" đã có từ 2026-07-06 03:44 — hụt một bước trong migration Postgres phiên 25, không phải do bot xoá).

**Khôi phục (thứ tự đã làm):**
1. Khôi phục `LOGIN` cho role `postgres` qua **single-user mode** (`postgres --single`, cách duy nhất vào được khi role tự nó bị khoá).
2. **Đổi bind Postgres từ `0.0.0.0:5432` → `127.0.0.1:5432`** (recreate container, giữ nguyên volume `brainos_pgdata` — không mất data thật đã có).
3. **Rotate mật khẩu** `postgres` sang random 32 ký tự (qua single-user mode), cập nhật `DATABASE_URL` trong `.env`.
4. Tạo lại database `brain_os`, restore từ backup gần nhất **`backups/brain_os_20260705_141549.sql`** (2026-07-05 14:15 UTC — bản mới nhất có sẵn; `prisma migrate status` xác nhận schema khớp, không có migration nào bị thiếu). **Mất dữ liệu từ 2026-07-05 14:15 tới lúc restore (2026-07-07 ~14:20)** — không có bản mới hơn.
5. Xoá database rác `readme_to_recover`.
6. Restart `next dev` (`setsid nohup`, giống cách chạy cũ) với credential mới — verify `/`, `/robot` local lẫn qua `https://os.irec.vn` đều `200`, không còn lỗi Prisma auth.

**Audit bảo mật toàn VPS (theo yêu cầu ngay sau đó, xem đầy đủ `docs/VPS_SECURITY_AUDIT.md`):**
- Snapshot `ss -tulpn`/`docker ps` trước khi sửa gì — phát hiện thêm nhiều port khác cũng public `0.0.0.0`/`[::]` không cần thiết: **3000** (Brain OS, process trần, dual-stack — lộ trực tiếp qua IP:port, không qua Cloudflare), **9000/9443** (Portainer), **81** (NPM admin UI), **8080** (code-server — nhưng có domain `code.irec.vn` phụ thuộc thật), **8090/8501** (MoneyPrinterTurbo).
- **Không dùng UFW** (yêu cầu: không tự enable nếu chưa chắc, tránh tự khoá SSH) — dùng thẳng `iptables`/`ip6tables`: allow `127.0.0.0/8`+`::1` (loopback) và `172.16.0.0/12` (dải nội bộ Docker, cho phép NPM proxy `172.17.0.1:3000` tới Brain OS vẫn hoạt động), DROP còn lại. Port 3000 dùng chain `INPUT` (process trần, không qua Docker NAT); các port Docker-published dùng chain `DOCKER-USER` (đúng cách Docker khuyến nghị để không bị chính Docker ghi đè rule).
- **Phát hiện quan trọng khi verify:** IPv6 là một mặt trận riêng — `docker-proxy` tự lắng nghe trực tiếp trên `[::]:PORT` ở host (không qua NAT/FORWARD như IPv4, vì không có `ip6 nat` DNAT nào được Docker tạo trên VPS này) → rule `DOCKER-USER` (IPv4 FORWARD-based) **không** che được IPv6 chút nào. Đã bổ sung thêm rule riêng trên `ip6tables INPUT` cho từng port (3000, 9000, 9443, 81, 8080) để vá đúng lỗ này.
- **Test tự-VPS không đáng tin cậy:** tự `curl` từ VPS tới chính IP public của nó bị Linux/Docker "hairpin" (định tuyến nội bộ, không đi qua chain lọc dành cho traffic thật từ internet) — xác nhận bằng `tcpdump -i eth0` trong lúc tự test: **0 gói tin** dù `curl`/`WebFetch` báo "kết nối được". Đã ghi rõ giới hạn này trong báo cáo, khuyến nghị user tự test lại bằng mạng 4G/máy ngoài thật.
- **Rủi ro nhất là port 8080 (code-server)** vì `code.irec.vn` (qua NPM) trỏ thẳng vào `42.96.12.122:8080` (IP public, không phải bridge IP nội bộ dù cùng network với NPM) — đã test `https://code.irec.vn` ngay sau khi thêm rule, vẫn `302 → /login` bình thường, không gãy.
- **Không đổi:** bind container nào (không rebind code-server/Portainer/NPM qua `docker run`/compose), không sửa NPM (UI/config/proxy_host), không đổi Cloudflare, không restart Brain OS lần 2, không cài Xiaozhi, không log secret (đọc password qua biến môi trường tạm + file `chmod 600` xoá ngay sau khi dùng, không bao giờ in ra terminal).

**Giới hạn còn lại (ghi trong `docs/VPS_SECURITY_AUDIT.md` mục 5, chưa tự ý xử lý vì ngoài phạm vi/cần quyết định của user):**
1. **Rule iptables/ip6tables KHÔNG persistent qua reboot** — mất hết nếu VPS reboot lần nữa (chưa cài `iptables-persistent`, cố tình không cài thêm gói ngoài yêu cầu). Đây là rủi ro lặp lại đúng nguyên nhân gốc của sự cố (reboot làm mất trạng thái bảo vệ).
2. Brain OS (port 3000) vẫn chạy tay qua `next dev`/`setsid nohup`, chưa có systemd/pm2 — vẫn sẽ chết lần nữa nếu reboot, dù port đã được khoá firewall.
3. UFW vẫn `inactive` — chỉ ghi lệnh đề xuất trong báo cáo, chưa bật.

**Đã test cuối:** `ss -tulpn`, `docker ps`, `curl 127.0.0.1:3000/robot` (200), `curl https://os.irec.vn/robot` (200), `curl https://os.irec.vn/xiaozhi` (200), `curl https://code.irec.vn` (302, không gãy), SSH (26266) xác nhận không đụng tới ở cả 2 chain IPv4/IPv6.

### Dọn file `.env` backup cũ + xác nhận trạng thái Brain OS/Xiaozhi standalone sau audit (phiên 36 — 2026-07-07)

**Đã làm:** chuyển `.env.backup.20260705_145127`, `.env.backup.20260705_154032`, `.env.save` từ `/root/brain-os` sang `/root/old-env-backups` (`chmod 700`, ngoài repo git). Không `cat`/in nội dung bất kỳ file `.env*` nào. Xác nhận `.env` thật (đang dùng) không bị git track (`git ls-files | grep '^\.env'` rỗng, khớp `.gitignore`).

**Xác nhận lại trạng thái (không sửa gì, chỉ verify — không restart Brain OS vì đang sống):**
- Brain OS: `127.0.0.1:3000/robot`, `os.irec.vn/robot`, `os.irec.vn/xiaozhi` đều `200`.
- Xiaozhi standalone: container `xiaozhi-standalone-server` vẫn `Up` ~3h, `RestartCount=0`, port `127.0.0.1:18000`/`127.0.0.1:18003` (không có `0.0.0.0:8000`/`8003` nào sót lại), `curl 127.0.0.1:18003/xiaozhi/ota/` → `200`. Không đụng Brain OS trong lúc kiểm tra.
- Tạo `/opt/xiaozhi-standalone/COMMANDS.md` — lệnh check/log/stop/start/tunnel nhanh, container name xác nhận thật (`xiaozhi-standalone-server`).
- Cập nhật `docs/VPS_SECURITY_AUDIT.md` mục 8 (dọn dẹp + xác nhận trạng thái sau audit).

**Không đổi:** không public port `18000`/`18003`, không ghép lại Xiaozhi vào Brain OS, không sửa NPM/Cloudflare, không cài lại/restart bất kỳ container nào.

### Dọn toàn bộ Xiaozhi/web client/bridge — chuyển sang chế độ chỉ giữ `/robot` (phiên 37 — 2026-07-08)

**Quyết định:** không làm robot ở Đà Lạt nữa, dừng hẳn hướng Xiaozhi. Từ giờ Brain OS chỉ giữ **một** route sản phẩm: `/robot` (web robot simulator), chuẩn bị cho robot thật ở Hà Nội (ESP32-S3 sau này). Toàn bộ phần Xiaozhi/bridge/web client/`robotonline`/`v1`/`tablet` đã dừng và **archive** (không xoá vĩnh viễn) — có thể khôi phục nếu cần.

**Backup trước khi sửa:** tạo git branch `backup-before-robot-only-cleanup-20260708_050755` (snapshot commit hiện tại trước khi dọn) — không add/commit `.env`.

**Đã dừng:**
- `docker stop xiaozhi-standalone-server` (không `rm` — image/volume còn nguyên).
- Kill process web client Xiaozhi (`fuser -k 18100/tcp`).
- Xác nhận `ss -tulpn` không còn `18000`/`18003`/`18100` nào lắng nghe.

**Đã archive (mv, không rm -rf):**
- `/opt/xiaozhi-standalone` → `/opt/disabled-projects/xiaozhi-standalone.disabled.20260708_050947`
- `/opt/xiaozhi-web-client` → `/opt/disabled-projects/xiaozhi-web-client.disabled.20260708_050947`
- (Không đụng thêm `/opt/xiaozhi.mixed.disabled.20260707_120000` và `/opt/py-xiaozhi` — đã ở trạng thái archive/không chạy từ trước, ngoài phạm vi lần dọn này.)
- Route Next.js: `src/app/xiaozhi`, `src/app/robotonline`, `src/app/tablet`, `src/app/v1`, `src/app/api/xiaozi`, `src/app/api/robotonline` → `disabled-routes/20260708_051036/src/app/...` (giữ nguyên cấu trúc thư mục để dễ khôi phục — chỉ cần `mv` ngược lại).
- Docs: `ROBOTONLINE.md`, `XIAOZHI_CLIENT_DEMO.md`, `XIAOZHI_REAL_INSTALL_RESULT.md`, `XIAOZI_SETUP.md` → `docs/archived-xiaozhi/`. Giữ nguyên `docs/VPS_SECURITY_AUDIT.md` (vẫn hữu ích, không phải tài liệu Xiaozhi).

**Dọn theo (tránh dead-link, không phải yêu cầu trực tiếp nhưng cần thiết để `/robot` sạch):**
- `src/components/layout/Sidebar.tsx` — bỏ mục nav "Tablet" (trỏ route đã archive).
- `public/manifest.json` — `start_url` đổi từ `/tablet` → `/robot` (PWA giờ mở thẳng robot simulator).
- **Chưa đụng `src/lib/brain/xiaozi-handler.ts`/`xiaozi-bridge-brain.ts`/`demo-conversational-fallback.ts`** — dead code sau khi archive route (không còn ai gọi), để nguyên vì ngoài phạm vi yêu cầu (chỉ dọn route/docs, không dọn sâu lib), không ảnh hưởng build hay `/robot`.
- Tạo `docs/ROBOT_ONLY_STATUS.md` — tổng hợp đầy đủ những gì đã disable/archive + cách khôi phục nếu cần sau này.
- Viết lại `NEXT.md` — chỉ còn roadmap robot thật Hà Nội (ESP32-S3 + TFT + mic + loa + servo, dùng `/robot` làm tham chiếu, chưa quyết định LLM/API cho robot thật).

**Restart Brain OS sạch + verify:** `pkill -f "next dev"` rồi chạy lại `npm run dev -- -H 0.0.0.0 -p 3000` (nền qua `nohup`). Test sau restart: `/robot` local + qua `os.irec.vn` đều `200`; `os.irec.vn/xiaozhi` và `os.irec.vn/robotonline` trả `404` (route đã archive, không còn tồn tại — đúng như mong muốn, không phải lỗi).

**Không đụng:** Nginx Proxy Manager, Cloudflare, domain `os.irec.vn` (không sửa cấu hình gì), Postgres (`brainos-postgres`, vẫn local-only từ phiên 35), không `cat`/log `.env` hay bất kỳ secret nào trong suốt quá trình.

### `/robot` — face không mascot + eye tracking mượt + mic sẵn sàng OpenAI Realtime (phiên 38 — 2026-07-08)

**Mục tiêu:** biến `/robot` thành demo chuẩn bị cho robot thật (ESP32-S3 + TFT + mic + loa ở Hà Nội) — bỏ hẳn mascot onigiri, eye tracking chuẩn hơn (pointer + camera fallback, smoothing/clamp/blink/idle đúng thông số yêu cầu), mic UI cho OpenAI Realtime API, và endpoint tạo ephemeral token server-side. Chỉ sửa file liên quan `/robot`, không rewrite toàn app, không khôi phục Xiaozhi.

**File mới:**
- `src/lib/robot/useRobotEyes.ts` — hook eye-tracking, chạy qua `requestAnimationFrame`, ghi thẳng CSS var (`--gaze-x`/`--gaze-y`/`--blink`) lên 1 `containerRef` thay vì `setState` mỗi frame (khác hẳn cách cũ `setGazeX`/`setGazeY` trong `page.tsx`, đã xoá). Pointer/touch toàn màn hình, lerp `0.12`, clamp `±15px`/`±10px`, blink random `3-7s` (`150ms`), idle wander sau `5s` không input, bias theo attention state (`thinking` nhìn lên, `listening`/`speaking` nhìn thẳng hơn). Camera target (khi `detected=true`) ưu tiên hơn pointer.
- `src/components/robot/RobotFaceKiosk.tsx` + `RobotFaceKiosk.module.css` — face mới kiểu màn hình/kiosk (khung bo góc, không mascot), 2 mắt là khối bo tròn màu sáng (kiểu Anki Vector/Cozmo, không sclera trắng) đọc CSS var từ `useRobotEyes` (tự gọi hook bên trong, self-contained), miệng 8 state (`idle`/`happy`/`thinking`/`sad`/`speaking`/`listening`/`sleeping`/`error`). `RobotFace.tsx`/`ExpressiveRobotFace.tsx` cũ (đều vẽ onigiri) vẫn còn trên đĩa, không xoá, nhưng không còn được `/robot` dùng.
- `src/components/robot/RealtimeMicPanel.tsx` — panel "🎙️ Mic / OpenAI Realtime" thay `XiaoziBridgePanel` cũ (đã gọi endpoint `/api/xiaozi/status`/`/api/xiaozi/chat` không còn tồn tại từ phiên 37, giờ bị hỏng nên gỡ). Gồm: mic permission + VU meter thật (`AnalyserNode`, RMS), phát hiện im lặng > 900ms, push-to-talk (hold), nút test meter độc lập không cần OpenAI; và phần OpenAI Realtime: Create session/Connect voice/Disconnect, `RTCPeerConnection` đầy đủ (addTrack mic, data channel `oai-events`, SDP offer/answer, map event → trạng thái robot), ephemeral token chỉ giữ `useRef` (không `localStorage`), event log debug (không chứa audio/secret).
- `src/app/api/robot/realtime-token/route.ts` — server-side only, đọc `OPENAI_API_KEY`, thiếu key trả `{ok:false,error:"OPENAI_API_KEY missing"}` (`400`). Có key thì gọi OpenAI tạo ephemeral client secret cho WebRTC.

**Phát hiện quan trọng khi test thật (không đoán, đã verify qua curl trực tiếp tới OpenAI):** endpoint `/v1/realtime/sessions` (dạng cũ, body phẳng `{model,voice,...}`, theo hiểu biết cũ) trả `404 "Invalid URL"` — API đã đổi sang **`POST /v1/realtime/client_secrets`**, body lồng trong `session{type:"realtime", model, instructions, audio:{output:{voice}, input:{turn_detection}}}`, response trả field `value` (không phải `client_secret.value`). Model cũng đổi tên hoàn toàn — không còn `gpt-4o-realtime-preview`, danh sách hiện tại (`curl /v1/models`) là `gpt-realtime`, `gpt-realtime-mini`, `gpt-realtime-2`, v.v. Đã sửa `route.ts` theo đúng schema thật, test lại qua Next.js: thiếu key → `400` đúng; có key thật → `200`, nhận `client_secret` hợp lệ (tiền tố `ek_...`). Cũng đã verify riêng route trao đổi SDP WebRTC (`POST /v1/realtime?model=...` kèm ephemeral token) — gửi SDP rác nhận lại lỗi parse SDP hợp lệ (không phải lỗi routing 404), xác nhận toàn chuỗi endpoint đúng.

**Giới hạn thành thật (không giả vờ đã xong):** đã verify thật việc tạo ephemeral token + đường dẫn SDP đúng route qua curl server-side, nhưng **chưa** test được 1 phiên WebRTC hoàn chỉnh có audio 2 chiều thật từ trình duyệt (môi trường này không có mic/loa thật) — cần user tự bấm "Create session" → "Connect voice" trên trình duyệt thật để xác nhận nốt.

**Sửa `page.tsx` (không rewrite toàn bộ, chỉ đổi phần liên quan):**
- Đổi import `RobotFace`→`RobotFaceKiosk`, `RobotFaceExpr`→`RobotFaceState`, bỏ `XiaoziBridgePanel`, thêm `RealtimeMicPanel`.
- Xoá state `gazeX`/`gazeY`/`setGazeX`/`setGazeY`/`targetDetected` (nay do `useRobotEyes` xử lý nội bộ qua ref, không qua React state) — `handleVisionTarget()` chỉ còn lưu `visionTarget` thô + log servo pan/tilt debug, không tự lerp bằng `setState` nữa.
- Thêm `resolveDisplayState()` — giữ đúng thứ tự ưu tiên cũ (`isSpeaking > isListening > isThinking > face nền`) khi gọi `RobotFaceKiosk`.
- 2 chỗ render `RobotFaceKiosk` (card thường + fullscreen kiosk) nhận `cameraTarget={cameraTrackingEnabled ? {x,y,detected} : undefined}` thay vì `gazeX`/`gazeY`/`targetDetected` rời rạc.
- Thêm dòng "Hardware Ready" (badge tổng quan: Eye Tracking, Mic, OpenAI Realtime, phần cứng ESP32-S3 chưa nối) ngay dưới `PageHeader`, và label "Eye Tracking" cạnh nút "📷 Tracking" trên card mặt robot — đúng yêu cầu đặt tên UI (`Robot Simulator`/`Eye Tracking`/`Mic / OpenAI Realtime`/`Hardware Ready`).

**Đã test:** `npx tsc --noEmit` sạch (chỉ còn 2 lỗi TS có sẵn từ phiên 33 trong `disabled-routes/` — ngoài phạm vi, không phải route đang chạy). `next dev` compile sạch, không lỗi runtime trong `brainos.log`. `curl /robot` local + domain → `200`, HTML xác nhận đủ 4 label UI yêu cầu, `grep -i "onigiri\|cơm nắm\|rice"` → `0` match (không còn dấu vết mascot). `curl -X POST /api/robot/realtime-token` → `200` thật với `client_secret` hợp lệ (đã có `OPENAI_API_KEY` sẵn trong `.env`). `os.irec.vn/xiaozhi` và `/robotonline` vẫn `404` (không sống lại). Không `cat .env`, không log/in API key hay ephemeral token ra bất kỳ đâu ngoài response JSON cho chính request đó.

### Đổi tên robot "ChinChin" → "Chuối" trong `/robot` (phiên 39 — 2026-07-08)

**Lưu ý đọc STATE.md:** các mục lịch sử phía trên (phiên 4-38) nhắc "ChinChin" là **ghi chép lịch sử tại thời điểm đó** — không sửa lại các đoạn cũ (giữ nguyên tính chính xác lịch sử của log), chỉ persona/tên hiển thị hiện tại trong code đã đổi. Xem `docs/ROBOT_ONLY_STATUS.md` mục "Đổi tên robot thành Chuối" để biết đầy đủ danh sách file đã sửa.

**Tóm tắt:** đổi toàn bộ tên/persona robot trong phạm vi `/robot` từ "ChinChin" sang "Chuối" — UI (`PageHeader` title/description, badge "Voice Assistant" thay "Mic / OpenAI Realtime"), system prompt AI thật (`openai-provider.ts`, `cli-agent-router.ts`, `realtime-token/route.ts`) kèm rule tường minh cho câu hỏi danh tính ("mày là ai" → "Mình là Chuối, robot demo của Brain OS.") và câu chào ("xin chào" → "Xin chào, mình là Chuối đây."), `system-context.ts`, `session-context.ts` (nhãn role lịch sử hội thoại), `tts/route.ts` (bỏ chữ "mascot"), câu chào mặc định trong `robot.ts`/`page.tsx`.

**Đã test thật qua curl (không giả lập):** `POST /api/robot/chat {"text":"mày là ai"}` → `robot_say:"Mình là Chuối, robot demo của Brain OS."`, `provider:"openai"` — đúng nguyên văn, AI thật trả lời theo rule mới trong system prompt (không phải hard-code). `POST /api/robot/chat {"text":"xin chào"}` → `robot_say:"Xin chào, mình là Chuối đây."`, `provider:"openai"` — đúng nguyên văn. `curl /robot` local + domain → `200`.

**Không đụng:** route/domain/NPM/Cloudflare/`.env`, `XiaoziBridgePanel.tsx` (đã chết từ phiên 38, còn sót 1 dòng "ChinChin" trong string test nội bộ — không sửa vì ngoài phạm vi tìm kiếm yêu cầu), các đoạn lịch sử cũ trong chính STATE.md này.

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
| `src/components/robot/RobotFace.tsx` + `RobotFace.module.css` | Mặt robot SVG/CSS animate (mascot onigiri ChinChin, 8 state, gaze tracking) |
| `src/components/robot/RobotVision.tsx` | Camera + phát hiện người/mặt nhẹ (FaceDetector hoặc fallback motion detection) |
| `src/lib/robot/tracking.ts` | `targetToPanTilt()` — servo-ready, hiện chỉ debug console |
| `src/app/robot/page.tsx` | UI Robot Simulator (toàn màn hình + browser TTS + Hands-free Voice Mode + RobotFace) |
| `src/app/api/robot/{status,command,event}/route.ts` | API Robot Simulator |
| `src/app/tablet/page.tsx` | Tablet Launcher + xin quyền mic/camera/notification |
| `public/manifest.json` | PWA manifest |
| `public/icons/` | Icon placeholder (192/512/apple-touch) |
| `src/lib/brain/system-context.ts` | Context tĩnh mô tả Brain OS/robot ChinChin — gửi kèm cho cả OpenAI provider và CLI agent |
| `src/lib/brain/reply-schema.ts` | Schema/parse/validate JSON dùng chung cho mọi provider (`NormalizedReply`, `parseReplyJson()`, `FALLBACK_REPLY`) |
| `src/lib/brain/openai-provider.ts` | `askOpenAI()` — provider chính (nhanh, mặc định), gọi thẳng OpenAI Chat Completions API |
| `src/lib/brain/cli-agent-router.ts` | `askCliAgents()` — router Codex CLI → Claude CLI → Gemini CLI → fallback, chỉ dùng khi `body.deep === true` |
| `/usr/local/bin/brainos-codex`, `/usr/local/bin/brainos-gemini` | Wrapper cố định HOME/PATH/TERM/NO_COLOR + flag trust cho Codex/Gemini CLI (ngoài git, xem phiên 17) |
| `src/lib/brain/session-context.ts` | `ensureSession()`/`loadSessionHistoryText()`/`countSessionMessages()` — ngữ cảnh + lưu hội thoại theo `sessionId` |
| `src/app/api/robot/chat/route.ts` | API chat robot (`{ok, reply, robot_say, face, action, provider: "openai"\|"cli_agent"\|"fallback", error, session_id, session_message_count, latency_ms}`) |
| `src/app/api/robot/transcribe/route.ts` | Speech-to-text — nhận audio, gọi OpenAI `/v1/audio/transcriptions`, trả `{ok, text, provider:"openai_transcribe"}` |
| `src/app/api/robot/tts/route.ts` | Text-to-speech — nhận `{text, voice?}`, gọi OpenAI `/v1/audio/speech`, trả thẳng audio nhị phân (`audio/mpeg`) |
| `src/lib/media.ts` | Helper thư mục upload + validate mimetype |
| `src/app/api/media/{upload,route,[id]}` | API MediaFile (upload/list/get/delete) |
| `uploads/media/` | File ảnh chụp thật (ngoài git, ngoài public/) |
| `src/lib/brain/complexity.ts` | `isComplexRequest()` — nhận diện câu "phức tạp" cần OpenAI (phiên 24) |
| `src/lib/brain/xiaozi-bridge-brain.ts` | `xiaoziBridgeBrain()` — bridge nội bộ L1 cho Xiaozi (5 nhóm cố định, phiên 24) |
| `src/app/api/xiaozi/chat/route.ts` | Webhook chính cho Xiaozi/Xiaozhi — template-first, chỉ gọi OpenAI khi phức tạp (phiên 24) |
| `src/app/api/xiaozi/status/route.ts` | Config không nhạy cảm cho panel debug Xiaozi Bridge (phiên 24) |
| `src/components/robot/XiaoziBridgePanel.tsx` | Panel "🔌 Xiaozi Bridge" trên `/robot` — endpoint/env/nút test nhanh (phiên 24) |
| `docker-compose.db.yml` | Postgres named volume `brainos_pgdata`, `restart: unless-stopped` (phiên 25) |
| `scripts/backup-db.sh` (`npm run db:backup`) | Backup nhanh `brain_os` ra `backups/`, giữ 20 bản mới nhất (phiên 25) |
| `src/app/api/health/db/route.ts` | Health check DB — đếm `ConversationMessage`/`ConversationSession` thật (phiên 25) |
| `src/lib/brain/webhook-auth.ts` | `verifyXiaoziWebhook()`/`getClientIp()`/`simpleRateLimit()` — auth + rate limit cho webhook public (phiên 26) |
| `docs/XIAOZI_SETUP.md` | Hướng dẫn cấu hình Xiaozi/Xiaozhi gọi Brain OS — endpoint, secret, payload, curl test, phương án OpenAI-compatible (phiên 26 + 30) |
| `src/lib/brain/xiaozi-handler.ts` | `handleXiaoziMessage()` — logic xử lý 1 lượt chat, dùng chung cho `/api/xiaozi/chat` và `/v1/chat/completions` (phiên 30) |
| `src/app/v1/chat/completions/route.ts` | Bridge OpenAI-compatible `POST /v1/chat/completions` (non-stream + SSE tối thiểu) cho Xiaozhi (phiên 30) |
| `src/app/v1/models/route.ts` | `GET /v1/models` — danh sách model giả (`brainos-local`/`brainos-auto`) cho Xiaozhi (phiên 30) |

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
- Robot chat: fallback cuối cùng (cả OpenAI lẫn CLI agent đều lỗi) chỉ là câu cố định "Tôi đang ở chế độ cơ bản..." (`FALLBACK_REPLY` trong `reply-schema.ts`) — không có keyword matching như kiến trúc cũ (phiên 8-15)
- Robot chat: **`accessLevel` vẫn được parse/validate trong request (mặc định 3) để tương thích API, nhưng chưa provider nào dùng để lọc dữ liệu** — cả OpenAI lẫn CLI agent đều nhận `SYSTEM_CONTEXT` tĩnh (không truy vấn Memory/PrivateMemory/Decision theo access_level như kiến trúc phiên 13). Nghĩa là hiện tại **không có rò rỉ PrivateMemory qua chat** nhưng cũng **không có ngữ cảnh thật** (không biết task/project/memory gì đang có)
- **Chế độ `deep: true` (CLI agent, xem phiên 16-18):** Codex CLI chưa đăng nhập (`codex login status` → "Not logged in"), Gemini CLI đang cấu hình auth kiểu API key (không phải OAuth, xem phiên 17) — chỉ Claude CLI hoạt động thật, không ảnh hưởng nhánh OpenAI mặc định. Wrapper `/usr/local/bin/brainos-codex`/`brainos-gemini` nằm **ngoài git** — nếu VPS bị cài lại/đổi máy, cần tạo lại theo nội dung phiên 17. Mỗi lần gọi `deep:true` mất tối thiểu ~8-10s (Claude CLI), tối đa 60s (thử cả 3 CLI) — **chỉ dùng khi chủ động cần**, không phải luồng chat mặc định
- ~~`face`/`action` chưa được nối vào trạng thái robot thật~~ **đã xong ở phiên 20** — xem section RobotFace phía trên
- OpenAI provider: model `gpt-5.4-nano` cần `response_format: json_object` + schema tường minh trong system prompt mới trả đủ 4 trường ổn định (đã xác nhận qua test — prompt chỉ liệt kê quy tắc dạng prose, không kèm ví dụ JSON, khiến model hay thiếu trường `reply`) — nếu đổi model khác qua `OPENAI_MODEL`, nên test lại xem model đó có tuân thủ tốt như vậy không, đặc biệt nếu model không hỗ trợ `response_format`
- RobotFace: gesture `wave`/`nod` không phát lại nếu 2 lượt chat liên tiếp trả cùng giá trị `action` (vd `"wave"` rồi `"wave"` — `useEffect` không thấy đổi nên không re-trigger) — xem chi tiết ở section RobotFace phía trên, chấp nhận được vì chỉ là hiệu ứng phụ
- RobotFace: chưa test animation bằng mắt trên trình duyệt thật (không cài Chromium/Playwright) — chỉ verify qua build + kiểm tra HTML render đúng cấu trúc SVG
- RobotVision/Smart Fullscreen Mode (phiên 23): **chưa test bằng camera/mắt thật** — motion-detection fallback + FaceDetector đều chỉ verify qua code review, chưa xác nhận độ nhạy/ngưỡng (`MOTION_DIFF_THRESHOLD=25`) có hợp lý trong điều kiện ánh sáng thật hay không
- RobotVision: chưa xác nhận chiều trái-phải của `gazeX` có đúng trực giác không (người dịch sang phải thì mắt robot có nhìn đúng hướng không) — đã ghi sẵn cách sửa (đảo dấu `x` trong `handleVisionTarget()`) nếu test tay thấy ngược
- RobotVision: `FaceDetector` là API thử nghiệm, chỉ một số bản Chrome/Android WebView hỗ trợ (thường sau flag hoặc Origin Trial) — đa số trình duyệt sẽ luôn rơi xuống fallback motion-detection, không phải lỗi
- Smart Robot Fullscreen Mode: `requestFullscreen()` trên kiosk container có thể bị từ chối trên một số trình duyệt di động (đặc biệt iOS Safari không hỗ trợ Fullscreen API đầy đủ cho phần tử tuỳ ý) — đã có fallback CSS (`fixed inset-0`) nhưng chưa test tay trên iOS thật
- Smart Robot Fullscreen Mode: bật "Fullscreen Robot" sẽ tự bật voice mode nếu chưa bật, nhưng **không** tự tắt lại camera tracking/voice mode khi thoát fullscreen (thiết kế có chủ đích, để user tự tắt qua nút riêng nếu muốn) — có thể gây bất ngờ nếu user mong đợi mọi thứ tự tắt theo fullscreen
- OpenAI STT (MediaRecorder + VAD, phiên 21): ngưỡng `THRESHOLD=10` và `SILENCE_MS=1000` là giá trị đoán hợp lý ban đầu, **chưa tune bằng mic thật** — có thể cần chỉnh nếu mic quá nhạy (cắt câu giữa chừng) hoặc quá trễ (chờ lâu mới gửi). Chỉ verify được qua code review + test transcribe API độc lập (curl file mp3 có sẵn), không test được toàn bộ vòng ghi âm-VAD-gửi bằng mic thật (không có trình duyệt thật trong môi trường này)
- OpenAI STT: `MediaRecorder` không được test trên Safari/iOS thật — mimeType mặc định trên Safari có thể khác Chrome (`audio/mp4` thay vì `audio/webm`); đã xử lý qua `resolveFilename()`/đặt tên theo `blob.type` thật (không hardcode `.webm`) nhưng chưa xác nhận bằng thiết bị Safari thật
- OpenAI TTS: `audio.play()` có thể bị chặn bởi autoplay policy của trình duyệt nếu gọi ngoài ngữ cảnh tương tác người dùng — trong luồng hiện tại (bấm nút/nói vào mic) luôn có tương tác trước đó nên nhìn chung không gặp, nhưng chưa test kỹ trên mọi trình duyệt/thiết bị
- Session/ngữ cảnh: model đôi lúc nhớ nhầm chi tiết nhỏ dù cơ chế nhớ hoạt động đúng (vd test thật trả lời "Bậu là Tú" thay vì đúng tên đã nói) — đây là hạn chế tự nhiên của LLM khi tổng hợp lại lịch sử dạng text thuần, không phải lỗi cơ chế lưu/truyền context (đã xác nhận DB lưu đúng, context truyền đúng)
- Session: không có UI xem/xoá lịch sử theo session, không có giới hạn số session hay dọn dẹp session cũ (mỗi trình duyệt tự giữ 1 `sessionId` vĩnh viễn trong `localStorage` trừ khi user tự xoá) — chấp nhận được cho MVP
- Voice-to-text: dùng `webkitSpeechRecognition`, chỉ Chrome/Edge/Safari hỗ trợ tốt — Firefox không hỗ trợ, nút mic sẽ tự disable
- Voice-to-text: `continuous=false` nên chỉ nhận 1 câu nói mỗi lần bấm mic (khối Chat/Voice thủ công), không phải hội thoại liên tục — **Hands-free Voice Mode (phiên 19) tự khởi động lại recognition sau mỗi lượt nên có cảm giác liên tục**, dù cơ chế nền vẫn là nhiều phiên `continuous=false` nối tiếp nhau, không phải 1 phiên streaming thật
- Hands-free Voice Mode: chưa test bằng tai/mic thật (chỉ verify qua build + HTML render) — cần user tự thử trên Chrome/Chrome Android thật, đặc biệt qua HTTPS (`https://os.irec.vn/robot`)
- Hands-free Voice Mode: nếu mạng chậm/API trả lời lâu, robot vẫn ở trạng thái "Đang nghĩ" tới khi có response — không có timeout riêng ở tầng UI (dựa vào timeout tự nhiên của `fetch`/server, không set thêm `AbortController` phía client cho lời gọi này)
- Hands-free Voice Mode: 2 phiên `SpeechRecognition` (thủ công vs hands-free) không thể chạy đồng thời — đã disable 2 nút mic thủ công khi hands-free bật, nhưng nếu user thao tác rất nhanh (vd đổi tab rồi quay lại ngay lúc state chưa kịp re-render) có thể có khoảng trống rất ngắn chưa disable kịp; chấp nhận được cho MVP
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
- **Lưu ý:** container `brainos-postgres` không có volume mount **tường minh** (không dùng `-v`), nhưng image Postgres tự tạo volume ẩn danh (anonymous volume) nên data vẫn sống sót qua restart container thường — **chỉ mất khi `docker rm` kèm cờ xoá volume hoặc xoá volume ẩn danh thủ công**. Rủi ro thật đã gặp ở phiên 15: volume ẩn danh có thể mang password cũ khác với `POSTGRES_PASSWORD` khai báo lúc `docker run` lần sau nếu container bị tạo lại mà tái sử dụng volume cũ — xem phiên 15 để biết cách sửa (đổi password bằng `ALTER USER`, không cần recreate). Muốn persist rõ ràng và tránh nhầm lẫn này, nên đổi sang named volume: `-v brainos_pgdata:/var/lib/postgresql/data`.
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
