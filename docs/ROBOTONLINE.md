# Robot Online — trang trạng thái Xiaozhi + Brain OS

Trang/API kiểm tra nhanh Brain OS và Xiaozhi real server (HTTP/OTA + WebSocket)
có đang sống không, cùng thông tin cấu hình bridge để tham chiếu nhanh —
không cần SSH vào VPS kiểm tra port/process bằng tay.

## Route

- `GET /robotonline` — trang hiển thị 4 card trạng thái (Brain OS, Xiaozhi
  HTTP/OTA, Xiaozhi WebSocket, Brain OS Bridge), tự poll `/api/robotonline/status`
  mỗi 10 giây, có link quay lại `/robot` và `/xiaozhi`.
- `GET /api/robotonline/status` — API JSON đứng sau trang trên.

## Response shape

```json
{
  "ok": true,
  "brainos": { "online": true, "domain": "https://os.irec.vn" },
  "xiaozhi": {
    "httpOta": { "host": "127.0.0.1", "port": 8003, "online": true },
    "websocket": { "host": "127.0.0.1", "port": 8000, "online": true },
    "public": false
  },
  "bridge": {
    "openaiCompatibleBaseUrl": "https://os.irec.vn/v1",
    "model": "brainos-local",
    "xiaoziWebhook": "https://os.irec.vn/api/xiaozi/chat"
  }
}
```

## Cách check online hoạt động

- **Xiaozhi HTTP/OTA (`127.0.0.1:8003`):** `fetch` kèm `AbortController` timeout
  800ms — miễn server có phản hồi (kể cả status lỗi như 400/500) là coi như
  `online: true`. Không cần route `/` tồn tại trên Xiaozhi server.
- **Xiaozhi WebSocket (`127.0.0.1:8000`):** connect TCP thô bằng `net.Socket`
  (không handshake WebSocket đầy đủ, chỉ cần connect được).
- Cả hai đều bọc `try/catch`/`timeout` — Xiaozhi offline không làm route crash,
  chỉ trả `online: false`.

## Test

```bash
curl -i http://127.0.0.1:3000/robotonline
curl -i http://127.0.0.1:3000/api/robotonline/status

curl -i https://os.irec.vn/robotonline
curl -i https://os.irec.vn/api/robotonline/status
```

Mong đợi cả 4 lệnh trên đều trả `200`.

## Ghi chú

- Không cần đổi Cloudflare/NPM — route dùng chung domain/proxy đã có sẵn cho
  Brain OS.
- Route không đọc bất kỳ secret/API key nào (không có `XIAOZI_WEBHOOK_SECRET`,
  `OPENAI_API_KEY`... trong code) — an toàn để hiển thị public.
- Xem STATE.md phiên 33 để biết bối cảnh đầy đủ (route từng bị 404 vì chưa
  từng được tạo, không phải bug).
