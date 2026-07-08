# NEXT — Việc tiếp theo cho Brain OS

**Đọc STATE.md trước để biết đã làm gì.** Lịch sử đầy đủ (Xiaozhi, robotonline, bridge, v1, audit bảo mật, nâng cấp `/robot` face/eye-tracking/mic...) còn nguyên trong `STATE.md` và git branch `backup-before-robot-only-cleanup-20260708_050755` — không mất, chỉ không còn là việc cần làm tiếp.

**Trạng thái (2026-07-08):** `/robot` là route sản phẩm duy nhất, tên robot **Chuối** ("Robot Chuối"). **Mới nhất (phiên 41):** `/robot` đã reset thành **1 màn demo sạch** — bỏ Hands-free Voice, Camera, OpenAI Realtime, Hardware Command Preview lớn, Event log, Status/Điều khiển cũ khỏi UI chính, chỉ còn mặt robot + 6 nút demo (Chào khách/Mày là ai/Demo bán hàng/Quay trái/Quay phải/Ngủ đi) + chat gọn (6 tin gần nhất) + `<details>` "Nâng cao" đóng mặc định (provider/mood/action/eyes/mouth/hardwareCommand/raw JSON). Backend (`/api/robot/chat`) không đổi từ phiên 40: local skill engine (`src/lib/robot-ai/local-skills.ts`) chạy trước OpenAI, response schema `mood/action/eyes/mouth/hardwareCommand` (`src/lib/robot-ai/types.ts`). Chi tiết đầy đủ ở `docs/ROBOT_ONLY_STATUS.md` mục "Reset `/robot` thành 1 màn demo sạch".

**Component/route không còn dùng trong UI nhưng chưa xoá file** (dead code, port lại nếu cần): `RobotVision.tsx` (camera), `RealtimeMicPanel.tsx` (OpenAI Realtime), `src/lib/robot/tracking.ts`, các route `/api/robot/{status,command,event,tts,transcribe,realtime-token}`.

## Việc tiếp theo

1. **Test `/robot` bằng trình duyệt thật, chưa làm được ở VPS** — layout 1 màn có vỡ trên tablet/mobile thật không, mắt robot tracking theo chuột/chạm có mượt không, bấm 6 nút demo + gõ chat + mic (1 lượt, Web Speech API) có phản hồi đúng không, mở `<details>` "Nâng cao" xem JSON có đúng không.
2. **Nếu sau này cần lại camera/hands-free voice/OpenAI Realtime** — logic vẫn còn nguyên trong git history (commit trước bản reset phiên 41) + các file component chưa xoá (`RobotVision.tsx`, `RealtimeMicPanel.tsx`), port lại thay vì viết mới.
3. **Về Hà Nội lắp ESP32-S3 + TFT + mic (INMP441) + loa (MAX98357A) + servo pan/tilt** — dùng `/robot` làm simulator/UI tham chiếu (không viết lại từ đầu). `hardwareCommand` trong response chat (`type: servo|motor|face|audio`, `command`, `payload?`) đã có sẵn cấu trúc để map thẳng sang lệnh firmware thật — hiện mới là preview/log trong `<details>` "Nâng cao", chưa gửi lệnh phần cứng.
4. **Mapping eye/mouth state sang TFT sau** — `RobotFaceKiosk` đã tách rõ state (idle/happy/thinking/sad/speaking/listening/sleeping/error) + gaze qua CSS var (`--gaze-x`/`--gaze-y`/`--blink`) + `gazeOverride` (hướng nhìn rời rạc left/right/up/down/center) — khi có phần cứng, port logic này sang firmware/driver màn TFT thật thay vì viết lại từ đầu.

## Lưu ý hạ tầng (vẫn đúng, không đổi)

**Postgres (`brainos-postgres`):** dùng named volume `brainos_pgdata`, đã local-only (`127.0.0.1:5432`) từ đợt audit bảo mật 2026-07-07 — xem `docs/VPS_SECURITY_AUDIT.md`. Muốn khởi động lại: `docker start brainos-postgres` (không tự `docker run`/`docker rm` tay).

**Brain OS app:** chạy tay qua `next dev` (`setsid nohup npm run dev -- -H 0.0.0.0 -p 3000 > brainos.log 2>&1 &`), chưa có systemd/pm2 — không tự sống lại sau reboot VPS. Cân nhắc thêm supervisor nếu robot thật cần uptime ổn định hơn.

**OpenAI Realtime:** `OPENAI_API_KEY` bắt buộc (đã có), `OPENAI_REALTIME_MODEL` tuỳ chọn (mặc định code `gpt-realtime-mini`). Không bao giờ đưa API key thật xuống frontend — chỉ ephemeral `client_secret` ngắn hạn qua `/api/robot/realtime-token`.

**Không làm:** cài lại Xiaozhi, dựng lại `/xiaozhi`/`/robotonline`/`/v1`/`/api/xiaozi/*` trừ khi chủ động yêu cầu lại, cài nginx native mới, sửa/xoá cấu hình NPM của domain khác (`code.irec.vn`), n8n, AI agent phức tạp (multi-step/tool-use), nhận dạng mặt thật, native Android, service worker/offline cache, gửi ảnh lên AI/cloud, ElevenLabs.
