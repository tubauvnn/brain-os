# Cấu hình Xiaozi/Xiaozhi gọi Brain OS

Hướng dẫn nhanh để trỏ thiết bị Xiaozi/Xiaozhi (đã có sẵn voice/STT/TTS/template
riêng) sang webhook Brain OS khi template của nó không tự xử lý được câu.

## 1. Endpoint

```
https://os.irec.vn/api/xiaozi/chat
```

(Đã hoạt động — xác nhận qua curl thật ở phiên 27, xem STATE.md. Vẫn có thể
test nội bộ qua `http://127.0.0.1:3000/api/xiaozi/chat` ngay trên VPS, không
cần secret.)

## 2. Method

`POST`, body JSON (`Content-Type: application/json`).

## 3. Header bắt buộc (request public)

```
x-brainos-secret: <XIAOZI_WEBHOOK_SECRET>
```

Có thể dùng thay thế `Authorization: Bearer <XIAOZI_WEBHOOK_SECRET>` nếu thiết
bị/thư viện HTTP của Xiaozi thuận tiện gửi Bearer token hơn header tuỳ biến.
Giá trị secret thật lấy từ `XIAOZI_WEBHOOK_SECRET` trong `.env` trên VPS —
**không** phải giá trị placeholder `"change-me"` mặc định lúc mới cài.

Request gọi trực tiếp tới `127.0.0.1`/`localhost` (test ngay trên VPS) **không
cần** header này.

## 4. Payload mẫu

```json
{
  "text": "Brain OS là gì",
  "deviceId": "xiaozi-robot-1",
  "accessLevel": 3
}
```

Các field khác được hỗ trợ (tuỳ chọn): `message` (thay cho `text`), `sessionId`,
`userId`, `intent`, `fromTemplate`, `meta`.

## 5. Response mẫu

```json
{
  "ok": true,
  "reply": "Brain OS là bộ não lưu trí nhớ, công việc và điều khiển robot.",
  "speak": "Brain OS là bộ não lưu trí nhớ, công việc và điều khiển robot.",
  "robot_say": "Brain OS là bộ não lưu trí nhớ, công việc và điều khiển robot.",
  "face": "happy",
  "action": "none",
  "provider": "brain_local",
  "sessionId": "xiaozi-xiaozi-robot-1",
  "deviceId": "xiaozi-robot-1",
  "latencyMs": 120
}
```

Xiaozi nên đọc to `speak` (hoặc `robot_say`, 2 field giá trị giống nhau) — `reply`
là bản đầy đủ hơn dùng cho log/admin, không nhất thiết phải đọc nguyên văn.

`provider` cho biết câu vừa được xử lý ở đâu: `brain_local` (bridge nội bộ),
`openai` (fallback phức tạp), `fallback_complex_disabled` (phức tạp nhưng
OpenAI đang tắt), hoặc `xiaozi_template_first` (Brain OS không có gì để làm,
Xiaozi tự xử lý bằng template của nó).

## 6. Flow — khi nào Xiaozi nên gọi Brain OS

1. **Xiaozi template/skill xử lý trước** — phần lớn câu (kể chuyện, thời tiết,
   trò chuyện phổ thông...) không cần gọi Brain OS.
2. **Câu liên quan Brain OS/ChinChin/iREC, cần nhớ/lưu, hoặc lệnh robot cơ
   bản** → gọi webhook, Brain OS trả lời ngay từ bridge nội bộ (`brain_local`,
   nhanh, không tốn OpenAI).
3. **Câu thật sự phức tạp** (phân tích, lập kế hoạch, so sánh...) → Brain OS
   chỉ gọi OpenAI nếu `ENABLE_OPENAI_FALLBACK=true` trong `.env`; nếu đang tắt,
   trả lời cố định báo chưa bật được não nâng cao (`fallback_complex_disabled`).

## 7. Test curl — public (sau khi có domain)

```bash
curl -i -X POST https://os.irec.vn/api/xiaozi/chat \
  -H "Content-Type: application/json" \
  -H "x-brainos-secret: YOUR_SECRET" \
  -d '{"text":"Brain OS là gì","deviceId":"xiaozi-robot-1","accessLevel":3}'
```

Không có header `x-brainos-secret` (hoặc sai secret) → `401 Unauthorized Xiaozi webhook`.

## 8. Test local (ngay trên VPS, không cần secret)

```bash
curl -i http://127.0.0.1:3000/api/xiaozi/status

curl -i -X POST http://127.0.0.1:3000/api/xiaozi/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"Brain OS là gì","deviceId":"xiaozi-robot-1","accessLevel":3}'
```

`GET /api/xiaozi/status` cho biết cấu hình hiện tại (endpoint, có bắt buộc auth
không, `authConfigured` — đã đổi secret thật hay còn placeholder, `providerMode`,
tình trạng kết nối DB) — **không bao giờ trả secret thật**.

## 9. Rate limit

Mỗi `deviceId` (hoặc IP nếu không có `deviceId`) giới hạn **60 request/phút**.
Vượt quá → `429 Too many requests`. Giới hạn lưu in-memory trên tiến trình
Next.js hiện tại (không Redis) — reset khi restart server, đủ dùng cho MVP 1
thiết bị/1 VPS.

## 10. Việc cần làm trước khi dùng thật

1. ✅ Đã xong (phiên 27) — `XIAOZI_WEBHOOK_SECRET` trong `.env` đã đổi từ
   `"change-me"` sang secret thật (`openssl rand -hex 32`), app đã restart.
2. ✅ Đã xong (phiên 27) — domain `https://os.irec.vn` đã hoạt động, xác nhận
   qua curl thật (`/`, `/robot`, `/tablet`, `/api/xiaozi/status`, `/api/xiaozi/chat`
   với/không secret đều đúng như mong đợi).
3. **Còn lại:** nhập endpoint + secret vào cấu hình webhook của Xiaozi/Xiaozhi
   thật (theo tài liệu/app đi kèm phần cứng — ngoài phạm vi Brain OS, xem NEXT.md).
4. Sau khi nhập xong, test lại đúng bước #7 ở trên một lần nữa từ chính thiết
   bị Xiaozi (không chỉ curl tay) để chắc chắn thiết bị gọi đúng header/payload.
