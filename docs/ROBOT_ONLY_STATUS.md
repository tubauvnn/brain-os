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

**Không đụng:** `XiaoziBridgePanel.tsx` (đã archive/không còn render từ phiên 38, còn 1 dòng "ChinChin" trong string test nội bộ — không sửa vì file này đã chết, ngoài phạm vi tìm kiếm yêu cầu lần này), toàn bộ `disabled-routes/`, `docs/archived-xiaozhi/`, Postgres, NPM/Cloudflare, `.env`.
