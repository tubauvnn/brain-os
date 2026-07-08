# NEXT — Việc tiếp theo cho Brain OS

**Đọc STATE.md trước để biết đã làm gì.** Lịch sử đầy đủ trước phiên dọn dẹp 2026-07-08 (Xiaozhi, robotonline, bridge, v1, audit bảo mật...) vẫn còn nguyên trong `STATE.md` và trong git branch `backup-before-robot-only-cleanup-20260708_050755` — không mất, chỉ không còn là việc cần làm tiếp.

**Quyết định (2026-07-08):** không tiếp tục làm robot ở Đà Lạt, dừng hẳn hướng Xiaozhi/bridge/web client. Chỉ còn một mục tiêu: robot thật ở Hà Nội, dùng `/robot` làm điểm bắt đầu. Xem `docs/ROBOT_ONLY_STATUS.md` để biết chi tiết những gì đã disable/archive.

## Việc tiếp theo

1. **Về Hà Nội, lắp robot thật.** Đây là bước tiếp theo duy nhất còn mở — mọi thứ khác (Xiaozhi, bridge, web client, `/robotonline`, `/xiaozhi`, `/v1`) đã dừng, không cần quay lại trừ khi chủ động quyết định khác.
2. **Phần cứng dự kiến:** ESP32-S3 + màn hình TFT + mic + loa + servo (pan/tilt cho camera tracking, xem `src/lib/robot/tracking.ts` đã có sẵn `targetToPanTilt()` servo-ready từ phiên robot simulator cũ). Chưa nghiên cứu chi tiết firmware/wiring — bắt đầu khi có phần cứng trong tay.
3. **Dùng `/robot` (`src/app/robot/page.tsx`, `src/components/robot/RobotFace.tsx`, `src/lib/robot.ts`) làm simulator/UI tham chiếu** — toàn bộ mặt SVG animate, camera tracking, hands-free voice mode, chat/TTS/STT đã có và hoạt động qua `https://os.irec.vn/robot`, dùng làm nền tham chiếu khi nối phần cứng ESP32-S3 thật (thay vì viết lại từ đầu).
4. **Chưa dùng Xiaozhi/LLM/API nào cho robot thật** — quyết định kiến trúc AI/LLM cho robot thật (dùng lại OpenAI provider có sẵn trong `/api/robot/chat`, hay xây riêng) để dành tới khi có phần cứng, chưa quyết định trong phiên này.

## Lưu ý hạ tầng (vẫn đúng, không đổi)

**Postgres (`brainos-postgres`):** dùng named volume `brainos_pgdata`, đã local-only (`127.0.0.1:5432`) từ đợt audit bảo mật 2026-07-07 — xem `docs/VPS_SECURITY_AUDIT.md`. Muốn khởi động lại: `docker start brainos-postgres` (không tự `docker run`/`docker rm` tay).

**Brain OS app:** chạy tay qua `next dev` (`setsid nohup npm run dev >> brainos.log 2>&1 &`), chưa có systemd/pm2 — không tự sống lại sau reboot VPS. Cân nhắc thêm supervisor nếu robot thật cần uptime ổn định hơn.

**Không làm:** cài lại Xiaozhi, dựng lại `/xiaozhi`/`/robotonline`/`/v1`/`/api/xiaozi/*` trừ khi chủ động yêu cầu lại, cài nginx native mới, sửa/xoá cấu hình NPM của domain khác (`code.irec.vn`), n8n, AI agent phức tạp (multi-step/tool-use), nhận dạng mặt thật, native Android, service worker/offline cache, gửi ảnh lên AI/cloud, ElevenLabs.
