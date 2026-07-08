# Robot-only Status

Cập nhật: 2026-07-08

## Quyết định

Không tiếp tục làm robot ở Đà Lạt / dừng hẳn hướng Xiaozhi. Từ giờ Brain OS chỉ giữ **một** mặt trận: web robot simulator tại **https://os.irec.vn/robot**. Mọi thứ khác liên quan Xiaozhi/bridge/web client đã được dừng và archive (không xoá vĩnh viễn), để có thể khôi phục nếu cần sau này.

## Đã disable / archive

- **Container Xiaozhi:** `xiaozhi-standalone-server` — `docker stop` (không `rm`, image/volume còn nguyên).
- **Web client Xiaozhi:** process Node port `18100` đã kill.
- **Folder `/opt`** (archive, không xoá):
  - `/opt/xiaozhi-standalone` → `/opt/disabled-projects/xiaozhi-standalone.disabled.<timestamp>`
  - `/opt/xiaozhi-web-client` → `/opt/disabled-projects/xiaozhi-web-client.disabled.<timestamp>`
  - (Trước đó đã có sẵn `/opt/xiaozhi.mixed.disabled.20260707_120000` và `/opt/py-xiaozhi` từ lần dọn dẹp trước — không đụng thêm, vẫn nằm nguyên ngoài `/opt/disabled-projects`.)
- **Route trong Brain OS** (archive vào `disabled-routes/<timestamp>/`, không xoá):
  - `src/app/xiaozhi` (trang demo web `/xiaozhi`)
  - `src/app/robotonline` (trang `/robotonline`)
  - `src/app/tablet` (PWA launcher — không phải Xiaozhi-specific, nhưng không cần nữa khi chỉ giữ `/robot`)
  - `src/app/v1` (`/v1/chat/completions`, `/v1/models` — bridge OpenAI-compatible)
  - `src/app/api/xiaozi` (`/api/xiaozi/chat`, `/api/xiaozi/status`)
  - `src/app/api/robotonline` (`/api/robotonline/status`)
- **Docs** (archive vào `docs/archived-xiaozhi/`, không xoá):
  - `ROBOTONLINE.md`, `XIAOZHI_CLIENT_DEMO.md`, `XIAOZHI_REAL_INSTALL_RESULT.md`, `XIAOZI_SETUP.md`
- **UI dọn theo:** bỏ mục nav "Tablet" khỏi `Sidebar.tsx` (trỏ tới route đã archive), đổi `manifest.json` `start_url` từ `/tablet` → `/robot` (PWA giờ mở thẳng vào robot simulator).
- **Chưa xoá code lib dùng chung còn sót** (`src/lib/brain/xiaozi-handler.ts`, `xiaozi-bridge-brain.ts`, `demo-conversational-fallback.ts`) — các file này giờ không còn route nào gọi tới (dead code, không ảnh hưởng build/`/robot`), để nguyên thay vì xoá vì ngoài phạm vi yêu cầu lần này (chỉ dọn route, không dọn sâu vào lib).

## Port không còn chạy

`18000` (Xiaozhi WebSocket), `18003` (Xiaozhi HTTP/OTA), `18100` (web client) — xác nhận bằng `ss -tulpn`, không còn tiến trình/container nào lắng nghe 3 port này.

## Còn sống, không đụng

- Brain OS (`next dev`, port `3000`) — không restart nếu không cần, chỉ verify.
- `/robot` — route duy nhất còn giữ, dùng `Prisma`/`Postgres` (`brainos-postgres`, đã local-only từ đợt audit trước), OpenAI provider cho chat/TTS/STT.
- Nginx Proxy Manager, Cloudflare, domain `os.irec.vn` — không sửa gì.

## Khi nào về Hà Nội làm robot thật

Bắt đầu lại từ `/robot` (`src/app/robot/page.tsx` + `src/components/robot/RobotFaceKiosk.tsx` + `src/lib/robot.ts`) — đây là simulator/UI tham chiếu duy nhất còn giữ, không dính Xiaozhi. Chi tiết việc cần làm: xem `NEXT.md`.

## Cách khôi phục nếu sau này đổi ý (tham khảo, chưa cần làm)

- Route: `mv disabled-routes/<timestamp>/src/app/<x> src/app/<x>`
- Docs: `mv docs/archived-xiaozhi/<file>.md docs/<file>.md`
- Container: `docker start xiaozhi-standalone-server` (image/volume còn nguyên trong `/opt/disabled-projects/xiaozhi-standalone.disabled.<timestamp>/deploy`)
- Web client: `cd /opt/disabled-projects/xiaozhi-web-client.disabled.<timestamp> && ./start.sh`

## Nâng cấp `/robot` — face không dùng mascot + eye tracking + mic sẵn sàng OpenAI Realtime (2026-07-08)

Toàn bộ thay đổi dưới đây **chỉ trong `/robot`** — không đụng route/container nào đã disable ở trên, không khôi phục Xiaozhi.

### Robot face mới — không dùng ảnh cơm nắm/mascot

`RobotFace.tsx`/`ExpressiveRobotFace.tsx` cũ đều vẽ mascot onigiri (cơm nắm) — không dùng nữa cho `/robot`. Face mới: **`src/components/robot/RobotFaceKiosk.tsx`** — khung bo góc kiểu màn hình/kiosk (không mascot), 2 mắt là khối bo tròn sáng màu (kiểu Anki Vector/Cozmo — mắt chính là "đồng tử", không có sclera trắng), miệng đổi hình theo state (`idle`/`happy`/`thinking`/`sad`/`speaking`/`listening`/`sleeping`/`error`). File CSS riêng `RobotFaceKiosk.module.css` (blink, breathe, gesture wave/nod). Component cũ (`RobotFace.tsx`, `ExpressiveRobotFace.tsx`) vẫn còn trên đĩa (không xoá) nhưng **không còn được `/robot` import/dùng nữa**.

### Eye tracking cải thiện — `src/lib/robot/useRobotEyes.ts`

Hook mới, chạy hoàn toàn qua `requestAnimationFrame` + ghi thẳng CSS custom property (`--gaze-x`, `--gaze-y`, `--blink`) lên 1 `containerRef` — **không `setState` mỗi frame** (khác cách cũ dùng `setGazeX`/`setGazeY` React state, đã xoá khỏi `page.tsx`). `RobotFaceKiosk` tự gọi hook này bên trong, `page.tsx` chỉ cần truyền `cameraTarget`/`state`.

Đúng theo yêu cầu:
- **Theo con trỏ/chạm** trên toàn màn hình (không giới hạn trong khung mặt) — cảm giác tự nhiên hơn cho kiosk.
- **Smoothing:** lerp `current += (target - current) * 0.12` mỗi frame.
- **Clamp pupil:** tối đa `±15px` ngang, `±10px` dọc (trong khoảng 12–18px / 8–12px yêu cầu).
- **Blink tự nhiên:** random mỗi 3–7 giây, kéo dài 150ms (trong khoảng 120–180ms yêu cầu).
- **Idle micro-movement:** sau 5 giây không có input thật (pointer/camera), mắt tự lượn nhẹ trái-phải bằng sóng sin biên độ nhỏ.
- **Attention state:** `thinking` → mắt hơi nhìn lên; `listening`/`speaking` → kéo target về gần giữa (nhìn thẳng hơn).
- Camera-detected target (từ `RobotVision`, khi bật "📷 Tracking") **ưu tiên hơn** con trỏ khi `detected=true`.

### Camera tracking — tái dùng `RobotVision.tsx` có sẵn (không đổi)

Component `RobotVision.tsx` (đã có từ trước) đã đúng yêu cầu: xin quyền camera, dùng `window.FaceDetector` nếu trình duyệt hỗ trợ (detect mỗi 400ms), fallback sang motion-detection tự viết (so 2 khung liên tiếp, không model AI nặng) nếu không có `FaceDetector`. Không cài MediaPipe/face-api. Không đổi file này — chỉ đổi cách `page.tsx` feed target vào face (qua prop `cameraTarget` thay vì `gazeX`/`gazeY` state cũ).

### Mic UI — VU meter + push-to-talk

Nằm trong panel mới **"🎙️ Mic / OpenAI Realtime"** (`src/components/robot/RealtimeMicPanel.tsx`, thay thế `XiaoziBridgePanel` cũ đã gọi endpoint không còn tồn tại):
- `getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1}})`.
- VU meter thật qua `AnalyserNode` (RMS volume 0-100%), cập nhật qua `requestAnimationFrame`.
- Phát hiện im lặng đơn giản: dưới ngưỡng liên tục > 900ms → coi như ngừng nói (hiển thị trạng thái, không tự ý gửi gì đi).
- Nút "Request mic / Test meter" — hoạt động **độc lập với OpenAI**, không cần key, không crash nếu chưa cấu hình.
- Nút "Bấm để nói (giữ)" — push-to-talk kiểu hold (mousedown/touchstart → mở mic, mouseup/touchend → dừng).
- Không lưu audio, không log audio/base64 ra console — chỉ log tên event (vd `"event: response.created"`) trong panel debug.

### OpenAI Realtime — ephemeral token, KHÔNG đưa API key xuống frontend

**Backend:** `src/app/api/robot/realtime-token/route.ts` (server-side only, `POST`):
- Đọc `process.env.OPENAI_API_KEY` — thiếu thì trả `{ok:false, error:"OPENAI_API_KEY missing"}` (`HTTP 400`), không crash.
- Có key thì gọi **`POST https://api.openai.com/v1/realtime/client_secrets`** — đây là endpoint đã **verify thật qua curl** tại thời điểm viết code (2026-07-08); endpoint cũ `/v1/realtime/sessions` (dạng body phẳng) trả `404 Invalid URL`, API đã đổi sang dạng body lồng trong `session{}` và response trả field `value` (không phải `client_secret.value` như tài liệu cũ). Model cũng đổi tên — không còn `gpt-4o-realtime-preview`, danh sách hiện tại: `gpt-realtime`, `gpt-realtime-mini`, v.v. (`curl /v1/models` để xem đầy đủ).
- Trả về frontend: `client_secret` (ephemeral, tiền tố `ek_...`, hết hạn sau ~vài phút), `session_id`, `model`, `voice` — **không có gì là `OPENAI_API_KEY` thật**.
- Đã test thật (không giả lập): thiếu key → `400` đúng format; có key thật → `200`, nhận được `client_secret` hợp lệ. Cũng đã verify riêng endpoint trao đổi SDP WebRTC (`POST /v1/realtime?model=...` kèm ephemeral token) route đúng (trả lỗi parse SDP hợp lệ thay vì lỗi routing 404), xác nhận toàn bộ chuỗi endpoint đúng.

**Frontend (`RealtimeMicPanel.tsx`):** ephemeral token chỉ giữ trong `useRef` (memory), **không bao giờ ghi `localStorage`/`sessionStorage`**, không hiển thị ra UI. Code WebRTC đầy đủ đã viết (không phải khung sườn rỗng):
- `RTCPeerConnection` + `addTrack(micStream)` + `createDataChannel("oai-events")`.
- `createOffer()` → `setLocalDescription()` → POST SDP tới OpenAI kèm ephemeral token → `setRemoteDescription(answer)`.
- `<audio autoPlay>` ẩn để phát audio trả về từ OpenAI.
- Map event trên data channel sang trạng thái robot: `input_audio_buffer.speech_started`→`listening`, `response.created`→`thinking`, `response.output_audio.delta`→`speaking`, `response.done`→`idle`.

**Giới hạn đã biết (thành thật, không giả vờ đã xong):** đã verify thật **việc tạo token + đường dẫn trao đổi SDP đúng route** qua curl trực tiếp tới OpenAI, nhưng **chưa** test được 1 phiên WebRTC hoàn chỉnh có audio 2 chiều thật từ trình duyệt (môi trường này không có mic/loa thật) — cần user tự bấm "Create session" → "Connect voice" trên trình duyệt thật (Chrome/Chrome Android) để xác nhận nốt bước cuối.

### ENV cần cho OpenAI Realtime

- `OPENAI_API_KEY` — bắt buộc, đã có sẵn trong `.env` trên VPS (dùng chung với chat/TTS/STT hiện có).
- `OPENAI_REALTIME_MODEL` — tuỳ chọn, mặc định code `gpt-realtime-mini` nếu thiếu, không crash. Có thể đổi sang `gpt-realtime` (chất lượng cao hơn, đắt hơn) nếu muốn.
- **Không bao giờ đưa `OPENAI_API_KEY` xuống frontend** — chỉ ephemeral `client_secret` (tiền tố `ek_...`, tự hết hạn sau vài phút) mới được gửi ra trình duyệt, qua `/api/robot/realtime-token`.

### Khi về Hà Nội — mapping sang phần cứng thật

- **ESP32-S3** — điều khiển chính.
- **TFT** — hiển thị lại `RobotFaceKiosk` (hoặc phiên bản native tối giản hơn) — state/eye-tracking đã tách rõ qua CSS var/props nên dễ port logic sang màn cứng.
- **INMP441** (mic I2S) — thay cho `getUserMedia` browser, cùng luồng audio input cho OpenAI Realtime.
- **MAX98357A** (I2S amp) — phát audio output từ OpenAI Realtime thay cho `<audio>` element trên web.
- **Servo pan/tilt** — đã có sẵn `src/lib/robot/tracking.ts` (`targetToPanTilt()`) tính góc pan/tilt servo-ready từ target camera, chỉ chưa gọi phần cứng thật.

## Đổi tên robot thành Chuối (2026-07-08)

Tên hiển thị/persona của robot trong `/robot` đã đổi từ "ChinChin" sang **Chuối** ("Robot Chuối"). Câu giới thiệu chuẩn: *"Xin chào, mình là Chuối, robot demo của Brain OS."*

**Đã đổi (chỉ trong phạm vi `/robot`):**
- `PageHeader` title → "Robot Chuối", description → câu giới thiệu ở trên.
- Badge "Hardware Ready": "Mic / OpenAI Realtime" → "Voice Assistant" (khớp UI mới: Robot Chuối / Eye Tracking / Voice Assistant / Hardware Ready).
- Header panel mic (`RealtimeMicPanel.tsx`): "🎙️ Mic / OpenAI Realtime" → "🎙️ Voice Assistant".
- System prompt AI thật (`src/lib/brain/openai-provider.ts`, dùng cho nhánh mặc định của `/api/robot/chat`; `src/lib/brain/cli-agent-router.ts`, dùng cho nhánh `deep:true`; `src/app/api/robot/realtime-token/route.ts`, dùng cho OpenAI Realtime) — đều đổi câu mở đầu thành *"Bạn là Chuối, robot demo của Brain OS. Trả lời tiếng Việt ngắn gọn, thân thiện, dễ nghe. Ưu tiên câu dưới 2 câu."*, kèm 2 rule tường minh cho câu hỏi danh tính và câu chào (xem dưới).
- `src/lib/brain/system-context.ts` — "Robot ChinChin là interface..." → "Robot Chuối là interface...".
- `src/lib/brain/session-context.ts` — nhãn role lịch sử hội thoại gửi lại cho AI: "ChinChin:" → "Chuối:" (để AI thấy đúng tên chính nó trong ngữ cảnh nhiều lượt).
- `src/app/api/robot/tts/route.ts` — instructions giọng đọc: bỏ chữ "mascot", đổi "ChinChin" → "robot Chuối" (đúng yêu cầu không dùng từ mascot).
- `src/lib/robot.ts` + `src/app/robot/page.tsx` — câu chào mặc định (lệnh `greet`, text mặc định ô "Nói thử", "Xin chào, tôi là ChinChin.") → **"Xin chào, mình là Chuối đây."**

**Không có bộ pattern-matcher "local" tách biệt cho câu "mày là ai"/câu chào trong `/api/robot/chat`** — endpoint này 100% dùng AI thật (OpenAI, hoặc CLI agent khi `deep:true`), không có tầng trả lời tĩnh riêng như `/xiaozhi` (đã disable) từng có. Vì vậy 2 câu bắt buộc ("Mình là Chuối, robot demo của Brain OS." / "Xin chào, mình là Chuối đây.") được đảm bảo bằng **rule tường minh trong system prompt** (không phải hard-code) — đã test thật qua `curl`, AI trả đúng nguyên văn cả 2 câu, `provider:"openai"` (không giả lập).

> **Cập nhật 2026-07-08 (sau, xem mục "Smart Robot Demo" bên dưới):** nhận định trên **không còn đúng** — `/api/robot/chat` giờ có tầng local skill chạy trước OpenAI. Giữ nguyên đoạn này để lịch sử, không sửa lùi.

**Không đụng:** `XiaoziBridgePanel.tsx` (đã archive/không còn render từ phiên 38, còn 1 dòng "ChinChin" trong string test nội bộ — không sửa vì file này đã chết, ngoài phạm vi tìm kiếm yêu cầu lần này), toàn bộ `disabled-routes/`, `docs/archived-xiaozhi/`, Postgres, NPM/Cloudflare, `.env`.

## Chuối trở thành Smart Robot Demo — action-aware (2026-07-08)

Nâng cấp `/robot` từ "chatbot có mặt robot" thành demo robot thật hơn: có local skill engine trả lời tức thì, schema response giàu hơn (mood/action/eyes/mouth/hardwareCommand), demo buttons bấm phát ăn ngay, memory localStorage, và panel xem trước lệnh phần cứng. Toàn bộ vẫn chỉ trong phạm vi `/robot` — không đụng Xiaozhi/Lily/ElevenLabs, không khôi phục `/xiaozhi`/`/robotonline`.

### Schema mới — `src/lib/robot-ai/types.ts`

`RobotChatResult`: `ok, provider, model?, reply, mood, action, eyes?, mouth?, hardwareCommand?, cached?, error?`.
- `mood`: `idle|happy|listening|thinking|speaking|sleepy|error`.
- `action`: 18 giá trị (`greet`, `introduce`, `look_left/right/center`, `smile`, `sleep`, `wake`, `demo_sales/family/security/robot`, `move_forward/backward`, `turn_left/right`, `stop`, `none`).
- `eyes`: `left|right|center|up|down|track`. `mouth`: `idle|smile|speaking|thinking|sleep`.
- `hardwareCommand`: `{type: servo|motor|face|audio|none, command, payload?}` — placeholder cho ESP32-S3 sau này, chưa gọi phần cứng thật.
- `provider` mở rộng hơn 4 giá trị trong spec gốc (`local|openai|deepseek|openrouter`) để không phá tính năng `deep:true` (CLI agent) đã có từ trước: thêm `codex_cli|claude_cli|gemini_cli|fallback`.

### Local skill engine — `src/lib/robot-ai/local-skills.ts`

Chạy **trước** OpenAI trong `/api/robot/chat`, normalize tiếng Việt (bỏ dấu qua `NFD` + strip combining marks, xử lý riêng `đ/Đ`), so khớp cụm từ trọn vẹn (word-boundary, không match chuỗi con). 15 skill: chào (`xin chào/hello/chuối ơi`), giới thiệu (`mày là ai/bạn là ai/giới thiệu`), chào khách, quay trái/phải, nhìn tôi, cười lên, dừng lại, ngủ đi, thức dậy, demo bán hàng/gia đình/bảo vệ/robot, test mic — mỗi skill trả `RobotChatResult` đầy đủ ngay, `provider:"local"`, latency ~0-3ms (đã đo qua curl), không gọi OpenAI.

### OpenAI provider mới — `src/lib/robot-ai/openai-provider.ts`

Chỉ gọi khi câu không khớp local skill nào. System prompt persona đầy đủ (robot có mắt/miệng/mic/loa, sau này ESP32-S3/TFT/servo — không nhắc Xiaozhi/Lily trừ khi được hỏi), trả JSON schema mood/action/eyes/mouth (không còn `face`/`robot_say` cũ). `max_completion_tokens: 120` (đã verify tham số này đúng với model `gpt-5.4-nano` qua test thật, không phải đoán), timeout 20s, context gồm `SYSTEM_CONTEXT` + tối đa 6 lượt lịch sử session (`OPENAI_HISTORY_LIMIT = 12` dòng). Lỗi (thiếu key/timeout/JSON sai schema) → fallback local: *"Chuối chưa kết nối được não AI, nhưng phần điều khiển robot vẫn chạy."* (`mood:"error"`, `provider:"fallback"`).

**`src/app/api/robot/chat/route.ts`** giữ nguyên toàn bộ logic DB/session cũ (lưu `ConversationMessage`, session history, `ActivityLog`), chỉ đổi phần resolve reply: local skill → (nếu `deep:true`) CLI agent (quy đổi best-effort từ schema `face/action` cũ sang `mood/eyes/mouth` mới, xem `LEGACY_FACE_TO_MOOD` trong route) → OpenAI mới → fallback. Response JSON luôn đủ field theo `RobotChatResult` cộng thêm debug field cũ (`session_id`, `latency_ms`, `session_message_count`...).

### Frontend — `src/app/robot/page.tsx`

- **Mood → face**: map `mood` sang `RobotFaceState` có sẵn của `RobotFaceKiosk` (`sleepy`→`sleeping`, còn lại trùng tên).
- **Action → gesture**: chỉ 4 action map sang gesture thật (`greet`→wave, `introduce/smile/wake`→nod) vì `RobotGesture` chỉ có `none|wave|nod`; action đầy đủ vẫn hiển thị qua badge + panel Hardware Preview.
- **Eyes → gaze thật**: thêm `gazeOverride` vào `useRobotEyes`/`RobotFaceKiosk` (ưu tiên cao nhất, trên cả camera/pointer) — `left/right/up/down/center` là hướng nhìn cố định (-1..1), tự hết hạn sau 1.5s quay lại tracking bình thường; `track` = không override (dùng camera/pointer như cũ). Đây là plumbing mới thật, không phải chỉ hiển thị badge.
- **Demo Control Panel**: 14 nút gửi thẳng câu vào `/api/robot/chat` (khớp local skill, phản hồi ngay).
- **Hardware Command Preview**: panel mới hiện `mood/action/eyes/mouth/hardwareCommand.type/command/payload` từ response gần nhất + dòng "Phần này sau sẽ map sang ESP32-S3."
- **Memory localStorage**: key `robot_chuoi_chat_history`, tối đa 20 tin nhắn gần nhất, load lúc mount (paint ngay trước khi DB fetch xong), lưu mỗi khi `messages` đổi, nút "🗑️ Clear memory" xoá cả localStorage lẫn state UI. **Độc lập với DB** — `loadStatus()` (tải lịch sử từ Postgres theo session) vẫn giữ nguyên như cũ, không xoá; localStorage chỉ là cache phía client cho riêng yêu cầu demo lần này, không phải thay thế cơ chế session DB.
- Badge provider/mood/action hiển thị trực tiếp trong bong bóng chat của robot.

### Đã test thật (curl, không giả lập)

Cả 12 câu local skill (`chào khách`, `mày là ai`, `nhìn tôi`, `cười lên`, `thức dậy`, `dừng lại`, `demo gia đình/bảo vệ/bán hàng/robot`, `quay trái`, `ngủ đi`, `test mic`) trả đúng `provider:"local"` + schema đầy đủ, latency 0-3ms. Câu ngoài skill (hỏi thời tiết) rơi xuống `provider:"openai"`, `model:"gpt-5.4-nano"`, JSON hợp lệ. `/robot` local + prod đều `200`. `/xiaozhi`, `/robotonline` vẫn `404` (local + prod). Không log/leak `OPENAI_API_KEY` hay chuỗi giống secret trong `brainos.log`. `tsc --noEmit` sạch (2 lỗi còn lại nằm trong `disabled-routes/`, không liên quan, có từ trước).

### Chưa làm (đúng phạm vi yêu cầu)

- Chưa nối phần cứng thật — `hardwareCommand` mới là preview/log, chưa gửi lệnh servo/motor thật.
- Chưa test UI bằng trình duyệt thật (chỉ verify qua curl + xem HTML SSR có đủ marker "Demo Control Panel"/"Hardware Command Preview"/"Clear memory") — môi trường VPS không có trình duyệt để click thật.
- `eslint`/`next lint` chưa chạy được (repo chưa có `eslint.config.js`, `next lint` đòi setup tương tác) — đã bù bằng `tsc --noEmit` sạch cho toàn bộ file đổi.

## Reset `/robot` thành 1 màn demo sạch (2026-07-08, sau mục "Smart Robot Demo" ở trên)

Bản "Smart Robot Demo" ở trên (Demo Control Panel 14 nút, Hardware Command Preview panel lộ ngoài, cộng dồn với Hands-free Voice/Camera/OpenAI Realtime từ phiên 38) khiến `/robot` nhìn như dashboard dev, không giống demo sản phẩm. Đã viết lại toàn bộ `src/app/robot/page.tsx` (1884 dòng → ~370 dòng) thành 1 màn sạch.

**Bỏ khỏi UI chính** (không xoá file component, chỉ không còn import/dùng trong `page.tsx` — giống cách `RobotFace.tsx` cũ được giữ lại làm dead code từ phiên 38):
- Hội thoại giọng nói (Hands-free) — vòng lặp nghe→gửi→nói→nghe tiếp.
- Camera capture + camera tracking/debug cam (`RobotVision.tsx`).
- OpenAI Realtime — Create session/Connect voice/Disconnect (`RealtimeMicPanel.tsx`).
- Hardware Command Preview dạng panel lớn lộ ngoài, Event log dài, khối "Điều khiển" 9 nút DB-backed (`/api/robot/command`) + Status panel (battery/mode/last_command).
- Demo Control Panel 14 nút → rút còn 6. Badge provider/mood/action rối trong mỗi bong bóng chat.

**Layout mới:** `max-w-[1120px]`, không cần scroll khi vừa mở trang. Desktop grid 2 cột (trái: mặt robot to + dòng trạng thái tiếng Việt; phải: 6 nút demo + chat 6 tin gần nhất). Mobile stack dọc: mặt → nút demo → chat. Header nhỏ chỉ 2 pill tĩnh ("online", "local skills + OpenAI optional") thay khối "Hardware Ready" 4 badge cũ.

**6 nút demo cố định:** Chào khách, Mày là ai, Demo bán hàng, Quay trái, Quay phải, Ngủ đi — đều là local skill, không gọi OpenAI.

**Mic tối giản:** chỉ 1 lượt nghe (Web Speech API, `continuous:false`), final transcript tự gửi vào chat; ẩn hẳn nút mic nếu trình duyệt không hỗ trợ. Không còn hands-free loop/OpenAI STT toggle/session id/latency debug/VU meter/push-to-talk.

**`<details>` "Nâng cao"** (đóng mặc định): provider/mood/action/eyes/mouth/hardwareCommand + raw JSON response cuối + ghi chú "OpenAI chưa cấu hình..." (chỉ hiện khi `provider:"fallback"`, không phải banner đỏ to) + "Sau này map hardwareCommand sang ESP32-S3."

**Reset lịch sử rác:** localStorage đổi sang key `robot_chuoi_demo_v3_history`; lúc mount chủ động xoá 3 key cũ (`robot_chuoi_history`, `robot_chuoi_clean_history`, `robot_chuoi_chat_history`) — không đọc lại lịch sử/câu tiếng nước ngoài cũ. Lần đầu vào bản mới chỉ có đúng 1 câu chào tĩnh: *"Xin chào, mình là Chuối đây."* (không gọi API). Nút Xoá reset về đúng câu chào này.

**Backend không đổi** — `/api/robot/chat` từ phiên 40 đã đúng schema gọn yêu cầu, local skill vẫn chạy trước OpenAI, không rewrite.

**Đã test thật (curl):** `/robot` local + prod `200`; `/xiaozhi`, `/robotonline` vẫn `404`; `mày là ai`/`demo bán hàng`/`quay trái` → `provider:"local"` đúng schema như phiên 40 (backend không đổi). Grep HTML SSR: có đủ "Robot Chuối"/"Demo nhanh"/"Chat với Chuối"/"Nâng cao", **không còn** "Hands-free"/"Camera"/"OpenAI Realtime"/"Hardware Command Preview"/"Event log"/"Xiaozhi"/"Lily"/"ElevenLabs"/"Voice Assistant"/"Điều khiển"/"Trạng thái". `tsc --noEmit` sạch toàn repo.

**Chưa test bằng trình duyệt thật** (môi trường VPS không có trình duyệt) — cần user tự bấm thử trên Chrome/Safari để xác nhận mắt tracking mượt, mic 1 lượt hoạt động đúng, layout không bị vỡ trên tablet thật.

## Khôi phục fullscreen robot + tự động nói (2026-07-08, sau bản reset ở trên)

Bản reset 1 màn sạch ở trên lỡ dọn mất 2 chức năng người dùng cần: fullscreen mặt robot và tự động đọc câu trả lời. Đã thêm lại đúng 2 thứ này, **không** khôi phục lại camera/OpenAI Realtime/hands-free loop phức tạp — UI vẫn 1 màn sạch như trước.

**Fullscreen robot:** nút "⛶ Toàn màn hình" ở góc face card, gọi `requestFullscreen()` trên đúng `<div>` bọc `RobotFaceKiosk` (không phải cả trang) — nên chat/demo buttons tự động không hiển thị khi fullscreen (đúng hành vi chuẩn của Fullscreen API). Có fallback CSS `fixed inset-0` cho trình duyệt từ chối request. Nút đổi thành "⤢ Thoát toàn màn hình" khi đang fullscreen, đồng bộ qua sự kiện `fullscreenchange` (đề phòng user thoát bằng Esc).

**Tự động nói:** toggle trong header card Chat, mặc định bật, lưu `localStorage` key `robot_chuoi_auto_speak`. Nhận reply → nếu bật thì `speechSynthesis` đọc (`lang="vi-VN"`, `rate/pitch/volume=1.0`, ưu tiên voice tiếng Việt nếu máy có) → robot state `speaking` lúc đọc → về lại mood vừa nhận khi đọc xong. Nút "⏹ Dừng nói" cạnh đó: cancel ngay + về `idle`.

**Đã test qua curl** — không đổi hành vi backend. Chưa test bằng trình duyệt/loa thật (môi trường VPS không có).

## Nâng não Chuối — brain profile + demo scenario + language guard (2026-07-08, sau bản fullscreen/auto-speak ở trên)

Local skill trước đó (phiên 40-41) chỉ trả 1 câu xác nhận cụt ("Ok, Chuối quay trái.") — người dùng phản hồi demo "vẫn ngu ngu". Thêm 1 "brain layer" thật cho Chuối: personality rõ, kịch bản demo có ngữ cảnh, chặn ngôn ngữ lạ, gợi ý bước tiếp theo — vẫn không gọi OpenAI cho các lệnh demo, vẫn không thêm panel UI mới.

**`src/lib/robot-ai/chuoi-profile.ts`** — `CHUOI_PROFILE` (name/identity/role/speakingStyle/hardware/rules) là nguồn sự thật duy nhất cho persona, dùng để build system prompt OpenAI thay vì chuỗi cứng.

**`src/lib/robot-ai/demo-scenarios.ts`** — 7 scenario (`greet_customer`, `introduce`, `sales_demo`, `turn_left`, `turn_right`, `sleep`, `wake`), mỗi scenario là 1 màn trình diễn nhỏ: câu trả lời dài hơn có ngữ cảnh (vd sales_demo nhắc cả "báo tồn hàng và gọi chủ quầy" thay vì chỉ xác nhận đơn thuần) + `suggestedNextActions` (2-3 gợi ý bước tiếp theo) + `brainNote:"local scenario"`.

**`src/lib/robot-ai/language-guard.ts`** — đo tỷ lệ ký tự ngoài dải Latin/Việt; câu bị nhận diện loạn (Bengali/Ả Rập/Cyrillic...) → trả thẳng *"Chuối chưa nghe rõ. Bạn nói lại bằng tiếng Việt giúp mình nhé."*, không gọi OpenAI. Không chặn tiếng Anh (vẫn là chữ Latin, vẫn rơi xuống OpenAI bình thường như câu ngoài kịch bản).

**`src/lib/robot-ai/local-skills.ts` v2** — thứ tự xử lý: normalize → language guard → demo scenario → robot command (nhìn tôi/cười lên/dừng lại/demo gia đình/bảo vệ/robot/test mic) → identity fallback (biến thể hỏi danh tính khác chữ) → `null` cho OpenAI. Khớp nhiều biến thể hơn: "chuối ơi"/"chào"/"xin chào" → chào; "quay trái"/"nhìn trái"/"trái" → quay trái (tương tự phải); "ngủ đi"/"nghỉ đi" → ngủ; "dậy đi"/"thức dậy" → dậy.

**`src/lib/robot-ai/openai-provider.ts`** — system prompt build từ `CHUOI_PROFILE`, thêm `SIMULATOR_CONTEXT` vào mỗi request nhắc model đây là simulator trước ESP32-S3, mục tiêu "giống robot thật, không giống chatbot".

**API + frontend:** `RobotChatResult` thêm `suggestedNextActions`/`brainNote`; `/api/robot/chat` trả + lưu 2 field này. `page.tsx`: giữ `thinking` tối thiểu 300ms trước khi chuyển `speaking` (local scenario trả lời <5ms, không delay thì mặt robot giật); `suggestedNextActions` hiện thành chip tròn nhỏ dưới tin nhắn cuối, bấm chip tự gửi câu tương ứng; `<details>` "Nâng cao" thêm dòng `brainNote`/`suggestedNextActions`.

**Đã test thật (curl):** 4 scenario demo button + biến thể (ngủ/dậy/nghỉ/quay phải/cười/identity fallback) đều đúng, câu dài có ngữ cảnh, không gọi OpenAI. Câu Bengali → language guard đúng, không gọi OpenAI. Câu ngoài kịch bản → OpenAI, tiếng Việt, không bịa. `/robot` `200`, `/xiaozhi`/`/robotonline` `404`. Chưa test bằng trình duyệt thật (chip gợi ý, delay 300ms, giọng đọc câu dài hơn).
