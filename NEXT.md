# NEXT — Việc tiếp theo cho Brain OS

**Đọc STATE.md trước để biết đã làm gì.** Lịch sử đầy đủ (Xiaozhi, robotonline, bridge, v1, audit bảo mật, nâng cấp `/robot` face/eye-tracking/mic...) còn nguyên trong `STATE.md` và git branch `backup-before-robot-only-cleanup-20260708_050755` — không mất, chỉ không còn là việc cần làm tiếp.

**Trạng thái (2026-07-08):** `/robot` là route sản phẩm duy nhất, tên robot **Chuối** ("Robot Chuối"). UI vẫn là **1 màn demo sạch** (phiên 41) + fullscreen/tự động nói (phiên 42) — chỉ mặt robot + 6 nút demo (Chào khách/Mày là ai/Demo bán hàng/Quay trái/Quay phải/Ngủ đi) + chat gọn (6 tin gần nhất) + `<details>` "Nâng cao" đóng mặc định. **Mới nhất (phiên 43):** Chuối có "brain layer" thật — `CHUOI_PROFILE` (persona, `src/lib/robot-ai/chuoi-profile.ts`), 7 demo scenario giàu ngữ cảnh thay cho câu cụt cũ (`src/lib/robot-ai/demo-scenarios.ts`), language guard chặn text loạn ngôn ngữ trước khi tốn tiền gọi OpenAI (`src/lib/robot-ai/language-guard.ts`), local skill v2 khớp nhiều biến thể hơn, response thêm `suggestedNextActions` (chip gợi ý bước tiếp theo, bấm là gửi luôn) + `brainNote`. OpenAI system prompt build từ `CHUOI_PROFILE`, chỉ dùng cho câu ngoài 7 scenario/robot command. Chi tiết đầy đủ ở `docs/ROBOT_ONLY_STATUS.md` mục "Nâng não Chuối".

**Component/route không còn dùng trong UI nhưng chưa xoá file** (dead code, port lại nếu cần): `RobotVision.tsx` (camera), `RealtimeMicPanel.tsx` (OpenAI Realtime), `src/lib/robot/tracking.ts`, các route `/api/robot/{status,command,event,tts,transcribe,realtime-token}`.

## Việc tiếp theo

1. **Test `/robot` bằng trình duyệt/loa thật, chưa làm được ở VPS** — bấm 6 nút demo xem câu trả lời có "đỡ ngu" hơn không (dài hơn, có ngữ cảnh), bấm chip `suggestedNextActions` dưới reply xem có gửi đúng câu tiếp theo không, để ý khoảng dừng "thinking" 300ms trước khi robot nói có mượt không, thử gõ câu tiếng nước ngoài/loạn xem language guard có chặn đúng không, "Toàn màn hình"/"Tự động nói"/"Dừng nói" (phiên 42) vẫn hoạt động đúng không.
2. **Mở rộng thêm demo scenario nếu cần** (vd "demo gia đình"/"demo bảo vệ" hiện vẫn là robot command ngắn, chưa nâng thành scenario đầy đủ như 7 scenario chính) — thêm vào `DEMO_SCENARIOS` trong `demo-scenarios.ts`, không sửa rải rác.
3. **Nếu sau này cần lại camera/hands-free voice/OpenAI Realtime** — logic vẫn còn nguyên trong git history (commit trước bản reset phiên 41) + các file component chưa xoá (`RobotVision.tsx`, `RealtimeMicPanel.tsx`), port lại thay vì viết mới.
4. **Về Hà Nội lắp ESP32-S3 + TFT + mic (INMP441) + loa (MAX98357A) + servo pan/tilt** — dùng `/robot` làm simulator/UI tham chiếu (không viết lại từ đầu). `hardwareCommand` trong response chat (`type: servo|motor|face|audio`, `command`, `payload?`) đã có sẵn cấu trúc để map thẳng sang lệnh firmware thật — hiện mới là preview/log trong `<details>` "Nâng cao", chưa gửi lệnh phần cứng.
5. **Mapping eye/mouth state sang TFT sau** — `RobotFaceKiosk` đã tách rõ state (idle/happy/thinking/sad/speaking/listening/sleeping/error) + gaze qua CSS var (`--gaze-x`/`--gaze-y`/`--blink`) + `gazeOverride` (hướng nhìn rời rạc left/right/up/down/center/closed) — khi có phần cứng, port logic này sang firmware/driver màn TFT thật thay vì viết lại từ đầu.

## Lưu ý hạ tầng (vẫn đúng, không đổi)

**Postgres (`brainos-postgres`):** dùng named volume `brainos_pgdata`, đã local-only (`127.0.0.1:5432`) từ đợt audit bảo mật 2026-07-07 — xem `docs/VPS_SECURITY_AUDIT.md`. Muốn khởi động lại: `docker start brainos-postgres` (không tự `docker run`/`docker rm` tay).

**Brain OS app:** chạy tay qua `next dev` (`setsid nohup npm run dev -- -H 0.0.0.0 -p 3000 > brainos.log 2>&1 &`), chưa có systemd/pm2 — không tự sống lại sau reboot VPS. Cân nhắc thêm supervisor nếu robot thật cần uptime ổn định hơn.

**OpenAI Realtime:** `OPENAI_API_KEY` bắt buộc (đã có), `OPENAI_REALTIME_MODEL` tuỳ chọn (mặc định code `gpt-realtime-mini`). Không bao giờ đưa API key thật xuống frontend — chỉ ephemeral `client_secret` ngắn hạn qua `/api/robot/realtime-token`.

**Không làm:** cài lại Xiaozhi, dựng lại `/xiaozhi`/`/robotonline`/`/v1`/`/api/xiaozi/*` trừ khi chủ động yêu cầu lại, cài nginx native mới, sửa/xoá cấu hình NPM của domain khác (`code.irec.vn`), n8n, AI agent phức tạp (multi-step/tool-use), nhận dạng mặt thật, native Android, service worker/offline cache, gửi ảnh lên AI/cloud, ElevenLabs.
