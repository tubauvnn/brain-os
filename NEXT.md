# NEXT — Việc tiếp theo cho Brain OS

**Đọc STATE.md trước để biết đã làm gì.**

## -1. (Cập nhật — phiên 27, 2026-07-05) ✅ Secret thật đã set + domain đã sống — bước tiếp theo: nhập endpoint + secret vào Xiaozi/Xiaozhi thật

**Đã xử lý xong (phiên 25-27):** Postgres bền dữ liệu qua named volume (phiên 25). Webhook `/api/xiaozi/chat` có auth + rate limit (phiên 26). **Phiên 27: domain `https://os.irec.vn` đã hoạt động thật** (`/`, `/robot`, `/tablet`, `/api/xiaozi/status` đều `200` qua curl thật — không rõ ai/khi nào sửa NPM, chỉ xác nhận lại, không đụng gì tới cấu hình NPM/Cloudflare) **và `XIAOZI_WEBHOOK_SECRET` trong `.env` đã được đổi từ placeholder sang secret thật** (`openssl rand -hex 32`, giá trị không ghi ở đâu ngoài `.env` trên VPS). Đã test qua đúng domain public thật: không secret → `401`, đúng secret → `200`/`provider:"brain_local"`.

**Bước tiếp theo cụ thể (chỉ còn việc ngoài phạm vi code Brain OS):**
1. **Nhập vào cấu hình webhook của thiết bị Xiaozi/Xiaozhi thật:**
   - Endpoint: `https://os.irec.vn/api/xiaozi/chat`
   - Header: `x-brainos-secret: <giá trị secret thật trong .env trên VPS>` — lấy trực tiếp từ `.env` (`XIAOZI_WEBHOOK_SECRET`) khi cấu hình, phiên làm việc này không ghi lại giá trị đó ở bất kỳ đâu khác.
   - Theo tài liệu/app đi kèm phần cứng Xiaozi/Xiaozhi (ngoài phạm vi Brain OS) — **chưa test được bước này** vì không có phần cứng thật trong môi trường làm việc hiện tại.
2. Danh sách từ khoá 5 nhóm local (`xiaozi-bridge-brain.ts`) và complexity (`complexity.ts`) đang cố định cứng theo đúng yêu cầu ban đầu — nếu dùng thật thấy thiếu case hoặc quá nhạy, báo lại để chỉnh danh sách, đừng tự đoán thêm case ngoài phạm vi đã thống nhất.
3. Câu trả lời ChinChin/iREC (menu/giá) đang là data tĩnh hard-code trong code — nếu giá/menu thật đổi thường xuyên, cân nhắc chuyển qua đọc từ DB (`Memory`/model mới) thay vì sửa code mỗi lần.
4. Muốn bật OpenAI thật cho câu phức tạp: đổi `ENABLE_OPENAI_FALLBACK="true"` trong `.env` (đang mặc định `"false"`), không cần đổi code.
5. Có `.env.backup.20260705_145127` từ lúc đổi secret (ngoài git, chỉ nằm trên VPS) — có thể xoá khi chắc chắn secret mới hoạt động ổn định, hoặc giữ lại làm lưới an toàn.

## 0. (Cập nhật — phiên 18, 2026-07-05) Đăng nhập lại Codex CLI và Gemini CLI — chỉ còn ảnh hưởng chế độ `deep`

**Từ phiên 18, robot chat mặc định dùng OpenAI API (nhanh, ~5s), không còn phụ thuộc CLI agent** — mục này giờ chỉ quan trọng nếu muốn chế độ `deep: true` (CLI Agent Router: Codex CLI → Claude CLI → Gemini CLI → fallback) có đủ 3 lớp dự phòng thật. Không khẩn cấp như trước.

Wrapper (`/usr/local/bin/brainos-codex`, `/usr/local/bin/brainos-gemini`) đã xác nhận hoạt động đúng về mặt env/PATH/trust-dir — vấn đề còn lại **không phải env/wrapper, mà là auth thật của chính CLI**:
- `codex login status` → **"Not logged in"** (không phải chỉ hết hạn — không có token nào). Cần chạy `codex login` (mở trình duyệt) hoặc `codex login --device-auth` (nếu VPS không có trình duyệt, sẽ ra URL + mã 1 lần, cần hoàn tất trong 15 phút) rồi làm theo hướng dẫn.
- `gemini` đang cấu hình `~/.gemini/settings.json` → `selectedType: "gemini-api-key"` (dùng API key, không phải OAuth login tài khoản Google) — key hiện tại không hợp lệ/hết quota. Muốn dùng đúng nghĩa "CLI đã login" (không phải API key trả phí), cần chạy `gemini` (interactive) và **chọn phương thức "Login with Google"** thay vì API key, sẽ đổi `selectedType` sang OAuth.

Chỉ **Claude CLI hoạt động bình thường**. Router vẫn chạy đúng thiết kế (tự rơi xuống Claude CLI khi gọi `deep:true`, ghi rõ lỗi 2 CLI kia trong field `error`), nhưng để có đủ 3 lớp dự phòng thật, user cần tự đăng nhập lại trên VPS (thao tác cần tương tác/trình duyệt hoặc chọn phương thức đăng nhập, agent không tự làm thay được):
```bash
codex login              # hoặc: codex login --device-auth
gemini                    # chạy tương tác, chọn "Login with Google" thay vì API key
```
Sau khi đăng nhập lại, test bằng `curl ... -d '{"message":"...","deep":true}'` nhiều lần và xem field `provider` — nếu Codex/Gemini CLI hoạt động, thi thoảng sẽ thấy `provider: "cli_agent"` thành công nhanh hơn (không phải luôn timeout Codex rồi mới qua Claude).

## 0a. (Cập nhật — phiên 22, 2026-07-05) Test Hands-free Voice Mode (OpenAI STT + OpenAI TTS) bằng tai/mic thật

`/robot` giờ có nút "🎙️ Bật hội thoại giọng nói" (thẻ "🗣️ Hội thoại giọng nói (Hands-free)") — robot tự nghe → gửi → nói → tự nghe lại liên tục. **Từ phiên 21-22, mặc định dùng OpenAI cho cả nghe (STT, `/api/robot/transcribe`) lẫn nói (TTS, `/api/robot/tts`)**, có nút chuyển sang Browser STT/chỉ có browser TTS fallback nếu OpenAI lỗi. **Chưa test được bằng tai/mic thật** (chỉ verify từng API riêng lẻ qua curl — transcribe, tts, round-trip TTS→STT đều đã xác nhận đúng — nhưng chưa test toàn bộ vòng UI thật với mic/loa) — cần user tự thử trên Chrome hoặc Chrome Android thật:
- Bấm "Bật hội thoại giọng nói" (mặc định "OpenAI STT"), nói 1 câu, kiểm tra: robot có tự dừng ghi âm sau khi im lặng ~1s không (không phải cắt giữa câu, cũng không phải chờ quá lâu) → gửi → trả lời → đọc bằng giọng OpenAI TTS (tự nhiên hơn hẳn giọng máy cũ) → tự nghe lại.
- Thử đổi sang "Browser STT" — xác nhận vẫn hoạt động như phiên 19 (không bị phá).
- Thử đổi voice TTS (dropdown coral/marin/cedar/nova/shimmer/alloy trong card "Điều khiển") — nghe thử từng giọng có khác nhau rõ không.
- Tắt mạng/đổi `OPENAI_API_KEY` sai tạm thời — xác nhận TTS tự fallback về giọng máy (browser) mà không bị câm, và STT báo lỗi rõ ràng chứ không treo.
- Bấm "✋ Ngắt robot đang nói" trong lúc robot đang đọc (cả 2 trường hợp: đang phát OpenAI TTS và đang phát browser TTS fallback) — kiểm tra dừng đúng cả 2 loại + quay lại nghe ngay.
- Nếu ngưỡng VAD (im lặng 1000ms mới dừng ghi âm, `THRESHOLD=10` trong `startOpenAiListening()`) cảm giác sai (cắt câu quá sớm/trễ) — báo lại để chỉnh `SILENCE_MS`/`THRESHOLD` trong `src/app/robot/page.tsx`.
- Thử trên trình duyệt không hỗ trợ (vd Firefox desktop với OpenAI STT — cần `MediaRecorder`, hầu hết trình duyệt hiện đại đều có) — kiểm tra cảnh báo hiện đúng.
- Thử qua HTTP thường (không phải HTTPS/localhost) — kiểm tra cảnh báo `https://os.irec.vn/robot` hiện đúng chỗ.

## 0b-1. (Mới — phiên 23, 2026-07-05) Test Smart Robot Fullscreen Mode (camera tracking) bằng thiết bị thật

`/robot` giờ có "🖥️ Fullscreen Robot" — vào kiosk toàn màn hình, tự bật camera tracking (`RobotVision`) + voice mode, mắt robot (`gazeX`/`gazeY` mới trên `RobotFace`) nhìn theo người trước camera. **Hoàn toàn chưa test bằng camera/mắt thật** (môi trường này không có trình duyệt/camera thật) — cần user tự thử:
- Bấm "🖥️ Fullscreen Robot" trên tablet/laptop có camera — xác nhận: vào đúng fullscreen, RobotFace phóng to, xin quyền camera, badge chuyển "Đang tìm người" → "Nhìn thấy bạn" khi có người trước camera.
- Di chuyển sang trái/phải trước camera — xác nhận mắt robot có nhìn theo đúng hướng không (**quan trọng:** nếu thấy ngược — dịch phải mà mắt nhìn trái — sửa 1 dòng trong `handleVisionTarget()` ở `src/app/robot/page.tsx`, đảo dấu `target.x`, xem ghi chú "mirror/hướng trái-phải" trong STATE.md phiên 23).
- Rời khỏi khung hình — xác nhận mắt chuyển sang "quét" trái-phải nhẹ (`targetDetected=false`) thay vì đứng im, và badge về lại "Đang tìm người".
- Bấm "🐞 Debug cam" — xem preview camera nhỏ góc màn hình có hiển thị đúng, mirror tự nhiên (như gương) không.
- Kiểm tra trên trình duyệt/thiết bị không hỗ trợ `FaceDetector` (đa số) — xác nhận fallback motion-detection vẫn hoạt động (mắt có phản ứng khi có chuyển động trước camera, dù thô hơn nhận diện mặt thật).
- Bấm "⤢ Exit Fullscreen" và phím Esc (2 cách khác nhau) — cả 2 đều phải thoát đúng, không kẹt ở trạng thái lưng chừng.
- Test trên iOS Safari nếu có — `requestFullscreen()` trên phần tử tuỳ ý có thể không được hỗ trợ đầy đủ, xác nhận fallback CSS (layout kiosk giả lập) vẫn dùng được dù không ẩn được thanh địa chỉ.
- Nếu ngưỡng motion-detection quá nhạy/không nhạy (mắt phản ứng cả với ánh sáng thay đổi, hoặc không phản ứng khi có người rõ ràng) — báo lại để chỉnh `MOTION_DIFF_THRESHOLD`/`MOTION_MIN_WEIGHT` trong `src/components/robot/RobotVision.tsx`.

## 0b. (Mới — phiên 20, 2026-07-05) Test RobotFace (mặt SVG animate mới) bằng mắt thật

`/robot` giờ dùng `RobotFace` (`src/components/robot/RobotFace.tsx`) — mascot onigiri ChinChin vẽ bằng SVG/CSS, thay emoji tĩnh cũ, tự đổi biểu cảm theo `face`/`action` từ `/api/robot/chat` VÀ theo trạng thái nghe/nghĩ/nói thời gian thực. **Chưa xem bằng mắt trên trình duyệt thật** (không cài Chromium/Playwright) — cần user tự mở `/robot` và kiểm tra:
- Bấm các nút lệnh cũ (Chào/Vui/Ngủ/Ngạc nhiên/Đang nghĩ) — mặt có đổi biểu cảm đúng không (Ngạc nhiên giờ map sang "happy", không còn mặt 😲 riêng — xem STATE.md phiên 20 nếu muốn xác nhận đây có phải hành vi mong muốn không).
- Gõ chat hoặc bật Hands-free Voice Mode — mặt có chuyển đúng listening (đang nghe) → thinking (đang gọi API, 3 chấm nảy) → speaking (miệng động theo TTS) → về lại face từ response (thường "happy" hoặc "idle") không.
- Bấm "Toàn màn hình" (⛶) — RobotFace có scale đẹp, không vỡ layout không.
- Trên tablet/mobile thật — mặt có đủ lớn, dễ nhìn, animation có giật/lag không (component dùng SVG `<animate>` gốc + CSS transform, về lý thuyết nhẹ, nhưng chưa đo hiệu năng trên thiết bị thật).

## 1. (✅ Đã xong — phiên 27, 2026-07-05) Domain `os.irec.vn` đã hoạt động

Từng ghi nhận "525, đang treo, chờ xác nhận URL NPM" từ phiên 12 tới phiên 26 — **phiên 27 kiểm tra lại thấy đã sống** (không rõ ai/khi nào sửa, phiên này không đụng gì tới NPM/Cloudflare, chỉ verify lại bằng curl thật):
```bash
curl -I https://os.irec.vn          # 200
curl -I https://os.irec.vn/robot    # 200 (lần đầu có thể chậm ~10s do next dev compile on-demand)
curl -I https://os.irec.vn/tablet   # 200
curl -I https://os.irec.vn/api/xiaozi/status  # 200
```
Nếu sau này thấy lại lỗi `525`/không kết nối được, đó là hồi quy hạ tầng NPM/Cloudflare — không phải do code Brain OS.

## 2. Test Chat/Voice/Camera/Hands-free thật trên tablet (domain HTTPS đã có — có thể làm ngay)
Test Chat, Voice (mic), Camera, Hands-free Voice Mode (xem mục #0a), nút "🔊 Test âm thanh" trên `https://os.irec.vn/robot` — mic/camera cần HTTPS domain thật để browser cấp quyền. **Từ phiên 18:** chat mặc định lại nhanh (~5s, qua OpenAI) như trước — chỉ chậm (8-60s) khi chủ động gọi `deep:true`, không phải mặc định nữa.

## 3. Form CRUD cho Memory, Task, Decision, People + Auth cơ bản
Việc cũ từ các phiên trước, vẫn chưa làm. Auth không còn khẩn cấp như trước cho riêng robot chat (từ phiên 16-18, chat dùng context tĩnh `SYSTEM_CONTEXT` cho cả OpenAI lẫn CLI agent, không còn đọc `PrivateMemory`/Memory theo `accessLevel` nữa — xem STATE.md Known issues), nhưng vẫn cần cho các trang CRUD khác và cho việc **quay lại wiring context động** (Memory/Task/Decision thật) vào prompt sau này mà không rò rỉ dữ liệu riêng tư.

---

**Lưu ý hạ tầng NPM:** container `nginx-proxy-manager` đang phục vụ ít nhất 1 domain khác (`code.irec.vn`) — khi thao tác trong NPM UI, chỉ thêm host mới, không sửa/xoá host đã có.

**Lưu ý hạ tầng Postgres (đã cố định ở phiên 25):** container `brainos-postgres` giờ chạy qua `docker-compose.db.yml`, dùng **named volume `brainos_pgdata`** (trước đó là volume ẩn danh — nguyên nhân khiến `brain_os` biến mất hoàn toàn ở phiên 24, không chỉ là vấn đề "restart bình thường vẫn sống" như ghi chú cũ tưởng). Muốn khởi động lại container (vd sau khi restart máy): `docker compose -f docker-compose.db.yml up -d` — **không** tự `docker run`/`docker rm` tay nữa, luôn qua file compose này để giữ đúng volume/tên container. Nếu gặp lỗi "Authentication failed... credentials for postgres are not valid" dù container đang chạy, **đừng vội recreate** — kiểm tra data còn không (`docker exec brainos-postgres psql -U postgres -d brain_os -c "\dt"` qua local trust), nếu còn thì chỉ cần đổi lại password bằng `docker exec brainos-postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"` (xem phiên 15 trong STATE.md). **Trước khi làm bất kỳ thao tác nào có khả năng ảnh hưởng container/volume, chạy `npm run db:backup` trước** (giờ đã có script, không cần nhớ lệnh `pg_dump` tay). Container cũ (volume ẩn danh, đã dừng) vẫn còn với tên `brainos-postgres-old-202607051405` — chỉ xoá (`docker rm`) khi chắc chắn không cần nữa.

**Lưu ý provider robot chat (phiên 18-22):** mặc định (`body.deep` không phải `true`) gọi thẳng **OpenAI** (`askOpenAI()` trong `src/lib/brain/openai-provider.ts`, model `OPENAI_MODEL`/`gpt-5.4-nano`, timeout 15s, ~2s thực tế) — nhanh, phù hợp chat realtime, giờ có thêm **lịch sử session** (20 tin gần nhất, `sessionId`) ghép vào context. Chỉ khi `body.deep === true` mới dùng **CLI Agent Router** (`askCliAgents()` trong `cli-agent-router.ts`, thứ tự Codex CLI → Claude CLI → Gemini CLI → fallback, timeout 25s/CLI, tổng tối đa 60s, chạy trong workspace cô lập `/home/brainos/agent-workspace`). Codex/Gemini CLI gọi qua wrapper cố định env `/usr/local/bin/brainos-codex`/`brainos-gemini` (**ngoài git**, xem STATE.md phiên 17 để tạo lại nếu VPS đổi máy). Cả 2 provider dùng chung schema/parse JSON ở `src/lib/brain/reply-schema.ts`. `SYSTEM_CONTEXT` (`system-context.ts`) + lịch sử session ghép lại, cắt cứng **8000 ký tự tổng** ngay trong `route.ts` (phiên 21, một chỗ duy nhất cho cả 2 nhánh). Codex CLI (chưa login) và Gemini CLI (đang cấu hình auth kiểu API key, không phải OAuth) hiện chưa hoạt động thật trên VPS này, chỉ ảnh hưởng nhánh `deep:true` (xem mục #0 phía trên). **`OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_TRANSCRIBE_MODEL`/`TTS_PROVIDER`/`OPENAI_TTS_MODEL`/`OPENAI_TTS_VOICE` đã có thật trong `.env`** — không log/in ra bất kỳ đâu.

**Lưu ý session/ngữ cảnh hội thoại (phiên 21):** mỗi trình duyệt tự sinh 1 `sessionId` (UUID) lưu `localStorage["robot_session_id"]`, gửi kèm mọi request `/api/robot/chat`. Backend `ensureSession()` tự tạo `ConversationSession` nếu chưa có (best-effort, DB lỗi thì chat vẫn chạy nhưng mất phần nhớ ngữ cảnh). Muốn "quên" hội thoại cũ, xoá `robot_session_id` khỏi `localStorage` (DevTools → Application → Local Storage) rồi tải lại trang — sẽ tự sinh session mới.

**Lưu ý MediaFile:** ảnh lưu ở `uploads/media/` (ngoài `public/`, ngoài git). Không có route xem ảnh.

**Không làm:** cài nginx native mới, sửa/xoá cấu hình NPM của domain khác, n8n, AI agent phức tạp (multi-step/tool-use), nhận dạng mặt thật, native Android, service worker/offline cache, gửi ảnh lên AI/cloud, cài thêm Chromium/Playwright, ElevenLabs (đang tạm dùng OpenAI TTS), module mới ngoài scope (Profile, Memory, PrivateMemory, People, FaceProfile, Project, Task, Decision, Prompt, Device, ActivityLog, RobotState, ConversationMessage, ConversationSession, MediaFile).
