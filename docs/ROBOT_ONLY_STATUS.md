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

Bắt đầu lại từ `/robot` (`src/app/robot/page.tsx` + `src/components/robot/RobotFace.tsx` + `src/lib/robot.ts`) — đây là simulator/UI tham chiếu duy nhất còn giữ, không dính Xiaozhi. Chi tiết việc cần làm: xem `NEXT.md`.

## Cách khôi phục nếu sau này đổi ý (tham khảo, chưa cần làm)

- Route: `mv disabled-routes/<timestamp>/src/app/<x> src/app/<x>`
- Docs: `mv docs/archived-xiaozhi/<file>.md docs/<file>.md`
- Container: `docker start xiaozhi-standalone-server` (image/volume còn nguyên trong `/opt/disabled-projects/xiaozhi-standalone.disabled.<timestamp>/deploy`)
- Web client: `cd /opt/disabled-projects/xiaozhi-web-client.disabled.<timestamp> && ./start.sh`
