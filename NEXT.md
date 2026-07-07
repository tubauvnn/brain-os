# NEXT — Việc tiếp theo cho Brain OS

**Đọc STATE.md trước để biết đã làm gì.**

## -8. (Mới — phiên 35, 2026-07-07) ⚠️ Sự cố Postgres bị tấn công đã cứu xong + audit khoá port — còn 3 việc ưu tiên cao

**Đã xử lý xong (phiên 35):** Postgres bị bot brute-force chiếm quyền (mật khẩu mặc định `postgres:postgres`, port từng public `0.0.0.0:5432`) — đã khôi phục LOGIN, đổi bind về `127.0.0.1`, rotate password, restore `brain_os` từ backup `2026-07-05 14:15`, xoá database rác `readme_to_recover`. Ngay sau đó đã audit toàn VPS, khoá bằng `iptables`/`ip6tables` các port admin/dev không cần public (3000, 81, 8080, 9000, 9443, 8090, 8501) mà không đụng NPM/Cloudflare/container binding. Chi tiết đầy đủ: STATE.md phiên 35, `docs/VPS_SECURITY_AUDIT.md`.

**Việc còn lại — ưu tiên cao (khác hẳn các mục bên dưới, nên làm sớm):**
1. **Cài persistence cho firewall rule** (`iptables-persistent`/`netfilter-persistent` hoặc systemd unit riêng) — rule vừa thêm **sẽ mất khi VPS reboot lần nữa**, lặp lại đúng lỗ hổng đã gây ra sự cố Postgres. Chưa làm trong phiên 35 vì cần cài thêm gói, ngoài phạm vi "chỉ audit + khoá" đã thống nhất.
2. **Thêm supervisor cho Brain OS** (`systemd`/`pm2`) — hiện `next dev` chạy tay qua `setsid nohup`, không tự phục hồi sau reboot (chính là nguyên nhân Brain OS chết ở đầu phiên 35).
3. **User tự test port đã khoá từ mạng ngoài thật** (điện thoại 4G, không qua VPN VPS) — môi trường làm việc không tự verify được 100% từ vị trí internet thật (xem `docs/VPS_SECURITY_AUDIT.md` mục 5.1 — tự test từ VPS bị "hairpin" nội bộ, không đáng tin).
4. Cân nhắc đổi target NPM của `code.irec.vn` từ IP public (`42.96.12.122:8080`) sang bridge IP nội bộ (`172.17.0.3:8080`) — giảm lý do phải giữ port 8080 public, nhưng cần sửa trong NPM UI (cần user tự làm/xác nhận trước, ngoài phạm vi "không phá NPM" của phiên 35).
5. ~~Xoá 2 file `.env.backup.*` cũ~~ ✅ **Đã xong ở phiên 36** — xem mục -9 bên dưới.

## -9. (Mới — phiên 36, 2026-07-07) ✅ Dọn `.env` backup cũ + xác nhận Xiaozhi standalone sống, local-only — sẵn sàng test voice thật

**Đã xử lý xong (phiên 36):** chuyển hết `.env.backup.*`/`.env.save` từ `/root/brain-os` sang `/root/old-env-backups` (`chmod 700`, ngoài git). Xác nhận lại Brain OS sống (`/`, `/robot`, `/xiaozhi` đều `200`, **không restart**) và Xiaozhi standalone (`xiaozhi-standalone-server`) chạy khoẻ, `RestartCount=0`, port `127.0.0.1:18000`/`18003` (không public). Tạo `/opt/xiaozhi-standalone/COMMANDS.md` (lệnh check/log/stop/start/tunnel). Chi tiết: STATE.md phiên 36, `docs/VPS_SECURITY_AUDIT.md` mục 8.

**Việc tiếp theo:**
1. **Test Xiaozhi standalone qua SSH tunnel trên laptop/PC có mic/loa thật** — xem `/opt/xiaozhi-standalone/COMMANDS.md` mục 5-6 (`ssh -N -L 18000:127.0.0.1:18000 -L 18003:127.0.0.1:18003 root@42.96.12.122 -p 26266`, rồi chạy `py-xiaozhi` trỏ `ws://127.0.0.1:18000`/`http://127.0.0.1:18003`). Agent không tự làm được (không có mic/loa trong môi trường này).
2. **Chưa public port `18000`/`18003`** — cố ý, giữ nguyên `127.0.0.1`-only cho tới khi user quyết định khác.
3. **Chưa ghép lại Xiaozhi với Brain OS** — cố ý, 2 hệ hoàn toàn tách biệt theo đúng yêu cầu, không đổi.

## -7. (Mới — phiên 34, 2026-07-07) ✅ Chuẩn bị demo Xiaozhi client voice thật qua SSH tunnel

**Đã xử lý xong (phiên 34):** server Xiaozhi vẫn chạy ổn (không đụng), nhưng chưa có client voice thật kết nối. Đã tạo `/opt/xiaozhi/py-xiaozhi/config.brainos.example.json` (mẫu config override `WEBSOCKET_URL`/`OTA_VERSION_URL`, ngoài git repo brain-os), thêm section "🎙️ Demo Client Voice" vào `/robotonline` (lệnh SSH tunnel, client config, Brain OS bridge info, cảnh báo không mở port public), và viết `docs/XIAOZHI_CLIENT_DEMO.md` (hướng dẫn đầy đủ SSH tunnel + chạy `py-xiaozhi` trên máy có mic/loa + khảo sát phương án proxy public qua subdomain riêng, chưa đổi NPM). Xem chi tiết STATE.md phiên 34.

**Việc còn lại (cần user tự làm, agent không tự làm thay được — không có mic/loa/laptop trong môi trường này):**
1. **Chạy `py-xiaozhi` thật trên laptop/PC có mic+loa** — theo `docs/XIAOZHI_CLIENT_DEMO.md` mục 3: mở SSH tunnel (`ssh -N -L 8000:127.0.0.1:8000 -L 8003:127.0.0.1:8003 root@42.96.12.122 -p 26266`), clone `py-xiaozhi`, `pip install -r requirements.txt`, sửa config trỏ `127.0.0.1`, chạy `python main.py --mode cli --skip-activation` (hoặc GUI), nói thử vào mic — đây là bước duy nhất còn thiếu để có voice thật.
2. Nếu tablet Android khó chạy SSH tunnel dạng port-forward, tạm demo bằng web `https://os.irec.vn/xiaozhi` (không cần tunnel/cài gì) cho tới khi tìm được app SSH mobile hỗ trợ tunnel ổn định.
3. **Quyết định có cần proxy public không** (chưa làm, chỉ khảo sát) — nếu sau này cần thiết bị ngoài kết nối không qua tunnel (vd ESP32 thật, nhiều người test cùng lúc): xem mục 5 trong `docs/XIAOZHI_CLIENT_DEMO.md`, cân nhắc subdomain riêng (`xiaozhi.irec.vn`/`ws-xiaozhi.irec.vn`) thay vì path chung `os.irec.vn` (rủi ro đụng route Next.js `/xiaozhi` đã có). Cần xác nhận auth/protocol của WebSocket Xiaozhi trước khi public hoá.
4. `/robotonline` có 2 lỗi TypeScript có sẵn từ phiên 33 (`OnlineBadge` thiếu prop `checking` ở 2 card Xiaozhi, dòng ~76/84 `page.tsx`) — không sửa trong phiên này (ngoài phạm vi yêu cầu), có thể dọn sau nếu cần.

## -6. (Mới — phiên 33, 2026-07-07) ✅ Fix 404 `/robotonline` + `/api/robotonline/status`

**Đã xử lý xong (phiên 33):** route `/robotonline` (page) và `/api/robotonline/status` (API) chưa từng được tạo — đó là lý do `curl` trả `NEXT_NOT_FOUND`, không phải bug ẩn. Đã tạo `src/app/robotonline/page.tsx` (4 card trạng thái: Brain OS, Xiaozhi HTTP/OTA `127.0.0.1:8003`, Xiaozhi WebSocket `127.0.0.1:8000`, Brain OS Bridge `/v1`, tự poll mỗi 10s, link quay lại `/robot`/`/xiaozhi`) và `src/app/api/robotonline/status/route.ts` (check HTTP/OTA qua `fetch` timeout 800ms, check WebSocket qua `net.Socket` TCP connect, không crash nếu Xiaozhi offline). Đã test cả 4 endpoint (`127.0.0.1:3000` và `https://os.irec.vn`, cả page lẫn API) → tất cả `200`. Regression `/robot`, `/xiaozhi`, `/api/xiaozi/chat`, `/v1/chat/completions` → không đổi hành vi, không có `404` mới. Không đụng Cloudflare/NPM, không log secret. Xem chi tiết STATE.md phiên 33.

**Việc còn lại (không khẩn cấp):**
1. Card trạng thái hiện chỉ tự poll, chưa có nút "refresh ngay" thủ công — thêm nếu cần test nhanh bằng tay.
2. Chưa test bằng mắt trên trình duyệt thật (môi trường này chỉ test được qua `curl`) — cần user tự mở `https://os.irec.vn/robotonline` xác nhận badge xanh/đỏ hiện đúng, link quay lại `/robot`/`/xiaozhi` hoạt động.

## -5. (Mới — 2026-07-06) ✅ Đã cài Xiaozhi THẬT (xiaozhi-esp32-server) trên VPS, đã nối về Brain OS — chi tiết đầy đủ ở `docs/XIAOZHI_REAL_INSTALL_RESULT.md`

**Trạng thái:** `xiaozhi-esp32-server` (server thật, chế độ server-only, Docker) đang chạy tại `/opt/xiaozhi/deploy`, LLM trỏ về Brain OS (`BrainOSLLM`, `type: openai`, `base_url: https://os.irec.vn/v1`) — đã verify 2 cách độc lập (curl thẳng Brain OS `200` + `performance_tester_llm.py` bên trong container nhận được reply thật từ Brain OS). `py-xiaozhi` (client) đã cài Python deps thành công trong venv (`/opt/py-xiaozhi/.venv`) nhưng **không chạy voice thật được trên VPS này** — thiếu PortAudio/libEGL/libopus (thư viện hệ thống, không phải Python package), cố ý không `apt install` vì VPS không có mic/loa/màn hình thật để dùng. Đọc **`docs/XIAOZHI_REAL_INSTALL_RESULT.md`** để biết đầy đủ 10 mục (repo đã clone, port, cấu hình, lệnh chạy lại...).

**Việc tiếp theo cụ thể (theo đúng thứ tự ưu tiên):**
1. **Quyết định cách mở port cho test từ xa** — hiện `xiaozhi-esp32-server` chỉ bind `127.0.0.1:8000`/`127.0.0.1:8003` (an toàn, đã thống nhất với user), nên **chỉ test được từ chính VPS**. Muốn test bằng laptop/tablet thật qua mạng: hoặc SSH tunnel (`ssh -L 8000:localhost:8000 -L 8003:localhost:8003 root@42.96.12.122`, không cần đổi gì trên VPS), hoặc tự đổi `/opt/xiaozhi/deploy/docker-compose.yml` sang bind `0.0.0.0` rồi `docker compose up -d` lại (raw IP:port, không qua NPM/Cloudflare, không có TLS/auth — cân nhắc kỹ trước khi làm vì VPS này không có firewall host-level).
2. **Chạy `py-xiaozhi` trên máy có mic+loa thật** (laptop/tablet, không phải VPS) — `git clone https://github.com/huangjunsen0406/py-xiaozhi.git` (hoặc copy từ `/opt/py-xiaozhi`), `pip install -r requirements.txt` (thường chạy được ngay trên desktop OS vì có sẵn PortAudio/GUI), rồi sửa `WEBSOCKET_URL`/`OTA_VERSION_URL` trong config trỏ vào server đã dựng (theo cách đã chọn ở bước 1).
3. **ESP32 thật** (`78/xiaozhi-esp32`) — chỉ cần khi có phần cứng robot thật, chưa làm, chưa cần làm bây giờ.
4. Nếu muốn chế độ "full module" (web admin quản lý nhiều thiết bị) thay vì server-only hiện tại — cần dựng thêm MySQL+Redis+`manager-api`+`manager-web`, phức tạp hơn nhiều, **chưa cần thiết** cho mục tiêu demo hiện tại.
5. `data/.config.yaml` (chứa secret) nằm tại `/opt/xiaozhi/deploy/data/.config.yaml` trên VPS, quyền `600`, **không** nằm trong git repo `brain-os` hay bất kỳ repo nào — không cần lo git commit nhầm, nhưng nếu build lại VPS/di chuyển server, nhớ backup riêng file này (hoặc tạo lại theo mẫu trong `docs/XIAOZHI_REAL_INSTALL_RESULT.md` mục 7).

## -4. (Cập nhật — phiên 32, 2026-07-06) ✅ `brain_local_demo` cho `/xiaozhi` hết lặp 1 câu chung chung, trả lời phong phú hơn

**Đã xử lý xong (phiên 32):** `demoConversationalFallback()` cũ (nghèo từ khoá, dễ rơi về 1 câu chung chung) đổi thành `demoConversationalBrain()` (`src/lib/brain/demo-conversational-fallback.ts`) — 13 nhóm câu hội thoại phổ biến (tên, nghe/thấy, đang làm gì, Brain OS, giá/ChinChin, khen/chê, nói nhanh, không sao, cảm ơn, tạm biệt) + 5 câu fallback khác nhau chọn theo hash khi không match nhóm nào (hết lặp mãi 1 câu). **Phát hiện + sửa 1 bug thứ tự trong lúc test:** bridge nội bộ (`xiaoziBridgeBrain`) trước đó luôn chạy trước demo brain kể cả khi `forceBrain` bật, nên các từ khoá trùng (vd "giá"/"cơm nắm") bị bridge "cướp" mất, trả lời cũ thay vì câu mới. Đã đảo thứ tự: `forceBrain` bật → demo brain chạy trước, bridge chỉ còn là lớp dự phòng cho các câu demo brain không có (lệnh robot, "tao vừa nói gì"...). Xem chi tiết + toàn bộ test STATE.md phiên 32.

**Việc còn lại (không khẩn cấp):**
1. Danh sách `RULES` trong `demoConversationalBrain()` vẫn là từ khoá cố định — nếu test tay trên `https://os.irec.vn/xiaozhi` thấy câu tự nhiên hay gặp bị rơi vào 1 trong 5 fallback (nghĩa là chưa có rule), báo lại để bổ sung, đừng tự đoán thêm ngoài phạm vi đã thống nhất.
2. Số liệu giá ChinChin trong demo brain (18k/23k) khác số liệu trong bridge nội bộ cho thiết bị thật (15k-35k, `xiaozi-bridge-brain.ts`) — **có chủ đích, 2 nơi khác nhau cho 2 mục đích khác nhau** (demo vs thiết bị thật), không phải lỗi thiếu đồng bộ. Nếu sau này muốn 2 nơi khớp nhau, cần quyết định số liệu chung rồi sửa cả 2 file.
3. Test tay trên trình duyệt thật `https://os.irec.vn/xiaozhi` (môi trường này chỉ test được qua `curl`) — xác nhận card Debug hiện đúng `brain_local_demo` cho các câu mới, mặt robot đổi đúng biểu cảm (happy/sad/idle theo `face` trả về), giọng TTS đọc câu tự nhiên, camera tracking không bị ảnh hưởng.

## -3. (Cập nhật — phiên 31, 2026-07-06) ✅ `/xiaozhi` web demo hết trả lời chung chung "Câu này Xiaozhi có thể xử lý bằng mẫu sẵn."

**Đã xử lý xong (phiên 31):** `/xiaozhi` giờ luôn gửi `meta: {source:"xiaozhi_web_demo", forceBrain:true}` khi gọi `/api/xiaozi/chat` → handler không còn rơi vào `xiaozi_template_first` cho web demo nữa, thay vào đó thử `brain_local` (bridge nội bộ) trước, rồi OpenAI nếu bật, cuối cùng là `demoConversationalFallback()` mới (provider `brain_local_demo`) cho các câu vặt (alo, ok, test, không sao...). Thiết bị Xiaozhi thật (không gửi `meta.forceBrain`) vẫn nhận `xiaozi_template_first` y hệt trước. Xem chi tiết + kết quả test STATE.md phiên 31.

**Việc còn lại (không khẩn cấp, chỉ làm nếu cần):**
1. `demoConversationalFallback()` (`src/lib/brain/demo-conversational-fallback.ts`) đang là danh sách từ khoá cố định nhỏ, giống style `xiaozi-bridge-brain.ts` — nếu test tay trên `https://os.irec.vn/xiaozhi` thấy thiếu case hay câu trả lời nghe gượng, báo lại để bổ sung, đừng tự đoán thêm ngoài phạm vi đã thống nhất.
2. `/v1/chat/completions` (bridge OpenAI-compatible, phiên 30) **chưa** gửi `meta.forceBrain` — nếu sau này muốn dùng chính bridge đó làm web demo (thay vì `/xiaozhi` gọi `/api/xiaozi/chat` trực tiếp), cần quyết định có nên mặc định `forceBrain:true` luôn ở đó hay không (ảnh hưởng cả thiết bị Xiaozhi thật nếu họ cũng trỏ vào `/v1/chat/completions` — cần cân nhắc kỹ trước khi đổi).
3. Test tay trên trình duyệt thật `https://os.irec.vn/xiaozhi` (môi trường này chỉ test được qua `curl`) — xác nhận: gõ "alo" → provider `brain_local_demo` hiện đúng trong card Debug, giọng đọc TTS phát câu tự nhiên, camera tracking (nếu bật) không bị ảnh hưởng.

## -2. (Mới — 2026-07-06) ⚠️ Đã thử cài py-xiaozhi để demo — phát hiện quan trọng: py-xiaozhi KHÔNG có ô cấu hình OpenAI base_url/api_key/model cho luồng chat chính

**Đã làm:** clone `https://github.com/huangjunsen0406/py-xiaozhi.git` vào `/opt/py-xiaozhi` (ngoài git repo Brain OS, không đụng gì tới `/root/brain-os`). Đọc kỹ `documents/docs/zh/guide/配置说明.md` (tài liệu cấu hình chính thức), `src/utils/config_manager.py` (nơi định nghĩa `DEFAULT_CONFIG`), `main.py`, và grep toàn bộ source tìm `base_url`/`api_key`/`openai`/`llm`/`server`/`websocket`. **Chưa chạy `pip install`/`uv sync`** (đúng yêu cầu "không cài nặng nếu chưa rõ") vì phát hiện dưới đây đã đủ để biết hướng ban đầu không khớp trước khi tốn thời gian cài.

**Phát hiện (quan trọng, thay đổi cách tiếp cận):**
- py-xiaozhi là **client** cho giao thức riêng của hệ sinh thái Xiaozhi (audio Opus qua WebSocket/MQTT) — cấu hình mạng chỉ có `SYSTEM_OPTIONS.NETWORK.WEBSOCKET_URL`/`OTA_VERSION_URL`/`MQTT_INFO`, trỏ tới **1 "xiaozhi-server"** (mặc định là cloud chính chủ `api.tenclass.net`/`xiaozhi.me`, hoặc 1 server tự host khác cùng giao thức, ví dụ project `xiaozhi-esp32-server`). **Không có field `base_url`/`api_key`/`model` nào cho luồng chat/LLM chính** — toàn bộ STT/LLM/TTS xử lý ở phía server đó, py-xiaozhi chỉ lo mic/loa/giao thức.
- Field `api_key`/`base_url` **duy nhất** tìm thấy trong toàn bộ source (`CAMERA.VLapi_key`, `CAMERA.Local_VL_url`, `src/mcp/tools/camera/vl_camera.py`) chỉ dùng cho **tool nhận diện hình ảnh qua camera** (dùng SDK `openai` Python trỏ mặc định vào Zhipu AI `open.bigmodel.cn`) — hoàn toàn tách biệt với hội thoại giọng nói chính, cần webcam thật, và gửi `content` dạng mảng có `image_url` (khác hẳn `content: string` mà `/v1/chat/completions` của Brain OS đang nhận) — **không phải chỗ để trỏ vào Brain OS cho demo voice**.
- Kết luận: muốn Xiaozhi (qua py-xiaozhi) thật sự nói chuyện qua Brain OS, cần **thêm 1 tầng nữa** — tự host 1 "xiaozhi-server" (vd `xiaozhi-esp32-server`, project khác, chưa tìm hiểu) cấu hình LLM provider của **server đó** trỏ vào `https://os.irec.vn/v1`, rồi mới trỏ `WEBSOCKET_URL` của py-xiaozhi vào server tự host này. Đây là việc **lớn hơn nhiều** so với "chỉ điền Base URL/API Key/Model" như giả định ban đầu.
- **VPS này không có phần cứng âm thanh** (`aplay`/`arecord` không tồn tại, `/proc/asound/cards` không có) — py-xiaozhi cần `sounddevice`/PortAudio + mic/loa thật để hoạt động đúng nghĩa, nên dù có ghép được server ở trên, **VPS chỉ test được kết nối/cấu hình, không test được voice thật**. Cần tablet/laptop có mic+loa thật cho việc đó.
- Dependencies của py-xiaozhi khá nặng (`PySide6`, `sherpa-onnx` + model wake-word, `opuslib`, `sounddevice`) — xác nhận đúng lo ngại "không cài nặng nếu chưa rõ" là hợp lý.

**Cần quyết định (việc chỉ user quyết được, không đoán tiếp):**
1. Có muốn tự host thêm 1 "xiaozhi-server" (project riêng, ví dụ `xiaozhi-esp32-server`) để py-xiaozhi/ESP32 thật có thể nói chuyện qua Brain OS không? Đây là hạ tầng mới, tốn công sức đáng kể, ngoài phạm vi những gì đã làm tới giờ.
2. Hay chấp nhận demo bằng phương án **đã chạy sẵn, không cần thêm gì**: `/robot` (web simulator của chính Brain OS, đã có chat/voice/TTS qua trình duyệt, xem STATE.md phiên 20-23) — đây là **demo không-ESP32 nhanh nhất hiện có**, không cần cài thêm py-xiaozhi/server nào.
3. Nếu vẫn muốn thử py-xiaozhi cho vui (không nhất thiết nói chuyện được với Brain OS), có thể cài + chạy `python main.py --mode cli --skip-activation` để xem UI/luồng activation, nhưng cần máy có mic/loa thật (không phải VPS này) và vẫn sẽ nói chuyện với cloud xiaozhi.me mặc định trừ khi tự host server riêng.

**Phương án demo hiện tại (không cần ESP32):**
- **`/robot` (khuyên dùng, đã chạy sẵn):** `https://os.irec.vn/robot` — chat/voice/TTS qua trình duyệt, không cần cài gì thêm, không cần phần cứng ngoài mic/loa của máy đang mở trình duyệt.
- **py-xiaozhi:** đã clone ở `/opt/py-xiaozhi`, nhưng cần quyết định #1 ở trên trước khi đầu tư cài đặt/host server, và cần máy có mic/loa thật (không phải VPS) để test voice.

**Phương án hardware sau (khi có thiết bị thật):** 78 / xiaozhi-esp32 / Lily Box — chưa nghiên cứu chi tiết, để dành khi có phần cứng thật trong tay.

## -1. (Cập nhật — phiên 30, 2026-07-06) ✅ Có bridge OpenAI-compatible cho Xiaozhi — bước tiếp theo: nhập Base URL/API Key/Model vào Xiaozhi thật

**Đã xử lý xong (phiên 25-30):** Postgres bền dữ liệu (phiên 25). Webhook auth + rate limit (phiên 26). Domain `https://os.irec.vn` đã sống (phiên 27). Secret đã rotate + build đã sạch (phiên 28). Panel `/robot` test được qua domain public (phiên 29). **Phiên 30: thêm `POST /v1/chat/completions` + `GET /v1/models`** — bridge giả lập OpenAI API, dùng chung logic với `/api/xiaozi/chat` qua `handleXiaoziMessage()` (đã tách vào `src/lib/brain/xiaozi-handler.ts`). Đây là **phương án dễ nhất** nếu app Xiaozhi chỉ có ô cấu hình kiểu OpenAI (Base URL/API Key/Model) — xem `docs/XIAOZI_SETUP.md` mục #0.

**⚠️ Quy tắc quan trọng cho các phiên sau (rút ra từ nhiều lần dính lỗi build liên tiếp, phiên 27-28, áp dụng lại thành công ở phiên 30):** **không bao giờ chạy `npm run build` khi `next dev` đang chạy trên cùng thư mục** — luôn: dừng `next dev` → (tuỳ chọn) xoá `.next/` nếu nghi ngờ cache hỏng → `npm run build` → verify pass → mới `setsid nohup npm run dev ...` lại.

**Bước tiếp theo cụ thể:**
1. **Nhập cấu hình vào Xiaozhi thật — chọn 1 trong 2 phương án:**
   - **Phương án A (khuyên dùng nếu Xiaozhi có ô kiểu OpenAI):** Base URL `https://os.irec.vn/v1`, API Key = giá trị `XIAOZI_WEBHOOK_SECRET` trong `.env` trên VPS, Model `brainos-local`. Xem `docs/XIAOZI_SETUP.md` mục #0. **Lưu ý:** mọi thiết bị gọi qua phương án này dùng chung 1 session cố định (không tách theo từng máy) — chấp nhận được nếu chỉ có 1 thiết bị Xiaozhi, cần cân nhắc nếu có nhiều.
   - **Phương án B (webhook gốc, tách session theo thiết bị):** endpoint `https://os.irec.vn/api/xiaozi/chat`, header `x-brainos-secret: <secret>`. Xem `docs/XIAOZI_SETUP.md` mục #1-10.
   - **Cả 2 phương án đều chưa test được với phần cứng Xiaozhi thật** (không có thiết bị trong môi trường làm việc này).
   - **Tránh để secret hiện lại ra terminal/screenshot/chat log** khi nhập (đây chính là lý do phải rotate ở phiên 28) — đọc trực tiếp `.env` qua SSH riêng tư.
2. **User tự test panel `/robot` bằng tay thật trên trình duyệt** (chưa làm được vì môi trường này không có trình duyệt) — xem hướng dẫn ở STATE.md phiên 29.
3. Danh sách từ khoá 5 nhóm local (`xiaozi-bridge-brain.ts`) và complexity (`complexity.ts`) đang cố định cứng theo đúng yêu cầu ban đầu — nếu dùng thật thấy thiếu case hoặc quá nhạy, báo lại để chỉnh danh sách, đừng tự đoán thêm case ngoài phạm vi đã thống nhất.
4. Câu trả lời ChinChin/iREC (menu/giá) đang là data tĩnh hard-code trong code — nếu giá/menu thật đổi thường xuyên, cân nhắc chuyển qua đọc từ DB (`Memory`/model mới) thay vì sửa code mỗi lần.
5. Muốn bật OpenAI thật cho câu phức tạp: đổi `ENABLE_OPENAI_FALLBACK="true"` trong `.env` (đang mặc định `"false"`), không cần đổi code — áp dụng cho cả 2 endpoint (`/api/xiaozi/chat` và `/v1/chat/completions`) vì dùng chung handler.
6. Có 2 file `.env.backup.<timestamp>` (phiên 27 + 28, ngoài git). **File backup phiên 27 vẫn chứa secret v1 đã lộ** — cân nhắc tự xoá tay 2 file này khi chắc chắn secret hiện tại hoạt động ổn định, để không giữ dấu vết secret cũ trên đĩa.

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
