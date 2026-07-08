# NEXT — Việc tiếp theo cho Brain OS

**Đọc STATE.md trước để biết đã làm gì.** Lịch sử đầy đủ (Xiaozhi, robotonline, bridge, v1, audit bảo mật, nâng cấp `/robot` face/eye-tracking/mic...) còn nguyên trong `STATE.md` và git branch `backup-before-robot-only-cleanup-20260708_050755` — không mất, chỉ không còn là việc cần làm tiếp.

**Trạng thái (2026-07-08):** `/robot` là route sản phẩm duy nhất, tên robot đã đổi thành **Chuối** ("Robot Chuối", xem `docs/ROBOT_ONLY_STATUS.md` mục "Đổi tên robot thành Chuối"). Face mới không dùng mascot (`RobotFaceKiosk`), eye tracking mượt hơn (pointer + camera fallback), mic/panel "Voice Assistant" có VU meter/push-to-talk, và `/api/robot/realtime-token` đã verify thật tạo được ephemeral token cho OpenAI Realtime (WebRTC). **Mới nhất:** `/robot` đã nâng cấp thành Smart Robot Demo action-aware — local skill engine (`src/lib/robot-ai/local-skills.ts`) trả lời tức thì cho ~15 lệnh/câu hỏi phổ biến trước khi gọi OpenAI, response schema giàu hơn (`mood/action/eyes/mouth/hardwareCommand`, xem `src/lib/robot-ai/types.ts`), Demo Control Panel (14 nút), Hardware Command Preview, memory localStorage — chi tiết đầy đủ ở `docs/ROBOT_ONLY_STATUS.md` mục "Chuối trở thành Smart Robot Demo".

## Việc tiếp theo

1. **Test `/robot` bằng trình duyệt thật, chưa làm được ở VPS** — bấm thử toàn bộ Demo Control Panel (14 nút), xác nhận mắt robot thật sự nhìn trái/phải/lên/xuống khi action có `eyes` (qua `gazeOverride` mới trong `useRobotEyes`), test nút "🗑️ Clear memory" + reload trang xem lịch sử localStorage còn không.
2. **Test `/robot` trên điện thoại thật** — mở `https://os.irec.vn/robot` trên Chrome/Safari mobile, kiểm tra: eye tracking theo chạm có mượt không, camera tracking (nút "📷 Tracking") có xin quyền + fallback đúng không, mic (panel "🎙️ Voice Assistant") có xin quyền + VU meter chạy không.
3. **Test voice AI thật qua OpenAI Realtime** — `OPENAI_API_KEY` đã có sẵn trong `.env`, `/api/robot/realtime-token` đã verify tạo token thành công qua curl. Việc còn lại: trên trình duyệt thật, bấm "Create session" → "Connect voice" trong panel Mic, nói thử, xác nhận có nghe được giọng AI trả lời qua loa không (chưa test được vòng audio 2 chiều thật vì môi trường này không có mic/loa — xem giới hạn trong `docs/ROBOT_ONLY_STATUS.md`).
4. **Về Hà Nội lắp ESP32-S3 + TFT + mic (INMP441) + loa (MAX98357A) + servo pan/tilt** — dùng `/robot` làm simulator/UI tham chiếu (không viết lại từ đầu). `hardwareCommand` trong response chat (`type: servo|motor|face|audio`, `command`, `payload?`) đã có sẵn cấu trúc để map thẳng sang lệnh firmware thật — hiện mới là preview/log trong UI, chưa gửi lệnh phần cứng.
5. **Mapping eye/mouth state sang TFT sau** — `RobotFaceKiosk` đã tách rõ state (idle/happy/thinking/sad/speaking/listening/sleeping/error) + gaze qua CSS var (`--gaze-x`/`--gaze-y`/`--blink`) + `src/lib/robot/tracking.ts` (`targetToPanTilt()` servo-ready) — khi có phần cứng, port logic này sang firmware/driver màn TFT thật thay vì viết lại từ đầu.

## Lưu ý hạ tầng (vẫn đúng, không đổi)

**Postgres (`brainos-postgres`):** dùng named volume `brainos_pgdata`, đã local-only (`127.0.0.1:5432`) từ đợt audit bảo mật 2026-07-07 — xem `docs/VPS_SECURITY_AUDIT.md`. Muốn khởi động lại: `docker start brainos-postgres` (không tự `docker run`/`docker rm` tay).

**Brain OS app:** chạy tay qua `next dev` (`setsid nohup npm run dev -- -H 0.0.0.0 -p 3000 > brainos.log 2>&1 &`), chưa có systemd/pm2 — không tự sống lại sau reboot VPS. Cân nhắc thêm supervisor nếu robot thật cần uptime ổn định hơn.

**OpenAI Realtime:** `OPENAI_API_KEY` bắt buộc (đã có), `OPENAI_REALTIME_MODEL` tuỳ chọn (mặc định code `gpt-realtime-mini`). Không bao giờ đưa API key thật xuống frontend — chỉ ephemeral `client_secret` ngắn hạn qua `/api/robot/realtime-token`.

**Không làm:** cài lại Xiaozhi, dựng lại `/xiaozhi`/`/robotonline`/`/v1`/`/api/xiaozi/*` trừ khi chủ động yêu cầu lại, cài nginx native mới, sửa/xoá cấu hình NPM của domain khác (`code.irec.vn`), n8n, AI agent phức tạp (multi-step/tool-use), nhận dạng mặt thật, native Android, service worker/offline cache, gửi ảnh lên AI/cloud, ElevenLabs.
