# Cấu hình Xiaozi/Xiaozhi gọi Brain OS

Hướng dẫn nhanh để trỏ thiết bị Xiaozi/Xiaozhi (đã có sẵn voice/STT/TTS/template
riêng) sang webhook Brain OS khi template của nó không tự xử lý được câu.

## 0. Phương án dễ nhất — OpenAI-compatible (dùng nếu Xiaozhi chỉ có ô nhập kiểu OpenAI)

Nhiều app Xiaozhi chỉ cho nhập cấu hình kiểu OpenAI (Base URL / API Key / Model),
không có chỗ nhập header/body tuỳ biến — không cần quan tâm webhook gốc ở các
mục bên dưới, chỉ cần điền đúng 3 ô này:

**Base URL:**
```
https://os.irec.vn/v1
```

**API Key:**
```
<giá trị XIAOZI_WEBHOOK_SECRET trong /root/brain-os/.env trên VPS>
```

**Model:**
```
brainos-local
```

**Cách hoạt động:** Xiaozhi gọi `POST {Base URL}/chat/completions` đúng format
OpenAI Chat Completions — Brain OS nhận, chạy lại **y hệt logic** template-first
→ bridge nội bộ → complexity-detector → OpenAI-fallback (dùng chung
`handleXiaoziMessage()` với `/api/xiaozi/chat`, xem STATE.md phiên 30), rồi trả
lời lại đúng format OpenAI (`choices[0].message.content`). `GET {Base
URL}/models` liệt kê 2 model giả (`brainos-local`, `brainos-auto`) chỉ để UI
Xiaozhi có gì đó để chọn — tên model không ảnh hưởng logic xử lý thật.

**Auth:** dùng đúng `XIAOZI_WEBHOOK_SECRET` hiện có, gửi qua `Authorization:
Bearer <secret>` (chuẩn OpenAI) — endpoint cũng chấp nhận `x-brainos-secret`
nếu cần, nhưng hầu hết client OpenAI-compatible chỉ có ô "API Key" nên sẽ tự
gửi Bearer.

**Giới hạn cần biết:** giao thức OpenAI không có khái niệm `deviceId`/`sessionId`
riêng — mọi request qua `/v1/chat/completions` đều dùng chung **1 session cố
định** (`openai-compatible-xiaozhi-openai-compatible`). Nếu có nhiều thiết bị
Xiaozhi cùng gọi qua bridge này, chúng sẽ **chia sẻ chung 1 ngữ cảnh hội
thoại**, không tách biệt theo từng máy. Cần tách riêng theo thiết bị thì dùng
webhook gốc `/api/xiaozi/chat` (mục #1 bên dưới) thay vì bridge này.

**Test:**
```bash
SECRET=$(grep '^XIAOZI_WEBHOOK_SECRET=' /root/brain-os/.env | cut -d '"' -f2)

curl -i https://os.irec.vn/v1/models \
  -H "Authorization: Bearer $SECRET"

curl -i -X POST https://os.irec.vn/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SECRET" \
  -d '{"model":"brainos-local","messages":[{"role":"user","content":"Brain OS là gì"}],"stream":false}'
```
Không có/sai API Key → `401 {"error":{"message":"Unauthorized Brain OS compatible API","type":"unauthorized"}}`
(khác hình dạng lỗi của webhook gốc — cố ý khớp convention OpenAI để client dễ
hiểu thông báo lỗi).

---

## Phương án webhook gốc (linh hoạt hơn — nếu Xiaozhi hỗ trợ header/body tuỳ biến)

Các mục dưới đây (1-10) mô tả webhook gốc `/api/xiaozi/chat` — dùng khi cần
`deviceId`/`sessionId` riêng theo từng thiết bị, hoặc khi Xiaozhi hỗ trợ cấu
hình header/body tuỳ biến thay vì chỉ có ô kiểu OpenAI.

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

1. ✅ Đã xong (phiên 27, **rotate lại ở phiên 28** vì bản phiên 27 bị lộ ra
   terminal/screenshot) — `XIAOZI_WEBHOOK_SECRET` trong `.env` là secret thật
   (`openssl rand -hex 32`), app đã restart. **Nếu bạn từng thấy/copy secret ở
   phiên 27, giá trị đó không còn dùng được nữa** — lấy lại giá trị mới nhất
   trực tiếp từ `.env` trên VPS.
2. ✅ Đã xong (phiên 27) — domain `https://os.irec.vn` đã hoạt động, xác nhận
   qua curl thật (`/`, `/robot`, `/tablet`, `/api/xiaozi/status`, `/api/xiaozi/chat`
   với/không secret đều đúng như mong đợi).
3. **Còn lại:** nhập endpoint + secret **mới nhất** vào cấu hình Xiaozi/Xiaozhi
   thật — **ưu tiên phương án OpenAI-compatible ở mục #0** (Base URL/API
   Key/Model) nếu app Xiaozhi có sẵn kiểu cấu hình này, đơn giản hơn hẳn so với
   webhook gốc. Tránh để secret hiện lại ra terminal/screenshot/chat log khi
   nhập — đọc trực tiếp từ `.env` qua SSH riêng tư.
4. Sau khi nhập xong, test lại đúng bước #7 (webhook gốc) hoặc test curl ở mục
   #0 (OpenAI-compatible) một lần nữa từ chính thiết bị Xiaozi (không chỉ curl
   tay) để chắc chắn thiết bị gọi đúng header/payload.
