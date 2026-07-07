# Xiaozhi Client Voice Demo — kết nối py-xiaozhi thật với Brain OS

Tài liệu này trả lời: "server Xiaozhi đã chạy, nhưng làm sao demo nói chuyện
bằng giọng nói thật?" — không phá gì trong `docs/XIAOZHI_REAL_INSTALL_RESULT.md`
(vẫn là nguồn chi tiết đầy đủ về cách server được cài/nối Brain OS), tài liệu
này chỉ tập trung vào bước còn thiếu: **client voice thật**.

## 1. Hiện trạng

- `xiaozhi-esp32-server` (server thật, container `xiaozhi-esp32-server`) đang
  chạy trên VPS, chế độ server-only, LLM đã nối về Brain OS
  (`base_url: https://os.irec.vn/v1`, `model_name: brainos-local`) — xem
  `docs/XIAOZHI_REAL_INSTALL_RESULT.md` mục 2, 3, 8 để biết cách verify.
- Server **chỉ bind `127.0.0.1`** trên VPS:
  - WebSocket: `ws://127.0.0.1:8000/xiaozhi/v1/`
  - HTTP/OTA: `http://127.0.0.1:8003/xiaozhi/ota/`
- `/robotonline` (`https://os.irec.vn/robotonline`) hiển thị 2 trạng thái này
  live (poll mỗi 10s) + section "🎙️ Demo Client Voice" mới thêm.
- **Chưa có client voice thật nào kết nối vào** — `py-xiaozhi` đã clone/cài
  Python deps ở `/opt/xiaozhi/py-xiaozhi` (symlink → `/opt/py-xiaozhi`) nhưng
  chưa từng chạy thành công (thiếu thư viện hệ thống âm thanh trên VPS).

## 2. Vì sao chưa voice ngay được

- VPS này **không có mic/loa/GUI thật** — `py-xiaozhi` cần `sounddevice`
  (PortAudio), `opuslib` (libopus), và GUI cần `libEGL` để chạy — 3 thư viện
  hệ thống này cố ý **không cài** trên VPS vì cài vào cũng không test được gì
  (không có phần cứng âm thanh để dùng).
- `py-xiaozhi` là **client thay thế cho ESP32 thật** — nó cần chạy trên một
  máy có mic/loa thật (laptop/tablet/desktop), không phải trên server.

## 3. Cách demo an toàn bằng SSH tunnel (khuyên dùng ngay)

Vì server chỉ bind `127.0.0.1` trên VPS, máy ngoài (laptop/tablet) không vào
thẳng được — dùng SSH tunnel để "kéo" 2 port đó về máy client, an toàn vì
không mở port nào ra Internet, đi qua kênh SSH đã mã hoá sẵn.

**Bước 1 — trên máy sẽ chạy `py-xiaozhi` (laptop/PC có mic+loa):**

```bash
ssh -N \
  -L 8000:127.0.0.1:8000 \
  -L 8003:127.0.0.1:8003 \
  root@42.96.12.122 -p 26266
```

Giữ lệnh này chạy (không trả về prompt là bình thường, `-N` nghĩa là không
mở shell, chỉ forward port). Mở terminal thứ 2 để chạy client.

**Bước 2 — cài + chạy `py-xiaozhi` trên máy đó** (không phải VPS):

```bash
git clone https://github.com/huangjunsen0406/py-xiaozhi.git
cd py-xiaozhi
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Bước 3 — trỏ config vào tunnel.** Client dùng
`~/.local/share/py-xiaozhi/config/config.json` (Linux), tương đương macOS/
Windows — xem file mẫu `config.brainos.example.json` cạnh repo
`/opt/xiaozhi/py-xiaozhi` trên VPS (chỉ tham khảo, copy 2 dòng override qua
máy client, không cần copy nguyên file):

```json
{
  "SYSTEM_OPTIONS": {
    "NETWORK": {
      "OTA_VERSION_URL": "http://127.0.0.1:8003/xiaozhi/ota/",
      "WEBSOCKET_URL": "ws://127.0.0.1:8000/xiaozhi/v1/"
    }
  }
}
```

`py-xiaozhi` tự deep-merge file JSON này lên default (không cần copy nguyên
default) — chạy lần đầu (`python main.py`) sẽ tự sinh file config default tại
đường dẫn trên nếu chưa có, sau đó sửa 2 trường `NETWORK` ở trên rồi chạy lại.

**Bước 4 — chạy client:**

```bash
python main.py --mode cli --skip-activation
# hoặc bỏ --mode cli để dùng GUI mặc định (cần libEGL — có sẵn trên đa số desktop OS)
```

**Bước 5 — test:** nói vào mic, đợi Xiaozhi server xử lý ASR → gửi câu hỏi
sang Brain OS (`https://os.irec.vn/v1/chat/completions`) → nhận câu trả lời
→ TTS đọc lại qua loa.

Nếu Termius/Android khó chạy tunnel dạng `-L` port-forward kiểu này (một số
app SSH mobile không hỗ trợ đầy đủ local port forwarding), **dùng laptop/PC
trước** — tablet Android tạm demo bằng web `/xiaozhi` (mục 4 dưới) cho tới
khi có cách tunnel ổn định hơn trên di động.

## 4. Cách demo web tạm (không cần tunnel, không cần cài gì)

`https://os.irec.vn/xiaozhi` — demo web tự viết của Brain OS (không phải
client Xiaozhi gốc), có chat + giọng nói ngay trong trình duyệt, không cần
`py-xiaozhi`/SSH tunnel/mic ngoài mic của máy đang mở trình duyệt. Dùng cái
này nếu cần demo nhanh trên tablet/điện thoại mà chưa set up tunnel.

## 5. Phương án proxy public qua os.irec.vn (chỉ khảo sát, CHƯA làm)

Đã xác nhận qua log server + file cấu hình (`docker logs xiaozhi-esp32-server`,
`/opt/xiaozhi/deploy/data/.config.yaml`) — path **cố định**, không cấu hình
được khác:

- WebSocket: `ws://<host>:8000/xiaozhi/v1/`
- HTTP/OTA: `http://<host>:8003/xiaozhi/ota/`

**Vấn đề nếu proxy path-based cùng domain `os.irec.vn`:** domain này đã có
Next.js route `/xiaozhi` (trang demo web ở mục 4) phục vụ qua cùng NPM →
cổng 3000. Thêm location `/xiaozhi/v1/` hay `/xiaozhi/ota/` đè lên cùng domain
đòi hỏi NPM "Custom Nginx Configuration" với location block ưu tiên đúng thứ
tự trước khi rơi vào `proxy_pass` mặc định của Next.js — **rủi ro xung đột
route nếu cấu hình sai thứ tự** (vd Next.js "nuốt" mất request trước khi tới
được location riêng cho Xiaozhi).

**Đề xuất an toàn hơn: dùng subdomain riêng thay vì path chung domain:**

```
xiaozhi.irec.vn     -> 127.0.0.1:8003   (HTTP/OTA)
ws-xiaozhi.irec.vn   -> 127.0.0.1:8000   (WebSocket)
```

Cần trong NPM: thêm 2 Proxy Host mới (không sửa host `os.irec.vn`/`code.irec.vn`
đã có), bật **Websocket Support** cho `ws-xiaozhi.irec.vn` (switch có sẵn
trong tab Details của NPM). Việc này **chưa làm** trong phiên này — chỉ ghi
lại phương án, chờ quyết định của user trước khi đụng NPM/Cloudflare (đúng
yêu cầu "chưa rõ auth/protocol thì chỉ tạo tài liệu, chưa đổi NPM").

**Trước khi làm proxy public (dù path hay subdomain), cần xác nhận thêm:**
1. Server Xiaozhi (`xiaozhi-esp32-server`) có tầng auth/token nào cho
   WebSocket không, hay ai kết nối được cũng chấp nhận? (ảnh hưởng mức độ an
   toàn khi public hoá).
2. Có cần TLS thật cho `wss://` không (bắt buộc nếu ESP32 thật hoặc trình
   duyệt yêu cầu HTTPS context) — subdomain qua NPM có thể cấp Let's Encrypt
   như các domain khác.

## 6. Bước sau

1. Chạy `py-xiaozhi` theo mục 3 trên **laptop có mic/loa thật** trước — đây
   là cách nhanh nhất để nghe được voice thật ngay bây giờ, không cần đổi hạ
   tầng gì.
2. Nếu muốn demo trên tablet mà không tunnel được, dùng web demo mục 4 tạm
   thời.
3. Nếu sau này cần thiết bị ngoài kết nối trực tiếp (không qua tunnel, ví dụ
   ESP32 thật hoặc nhiều người test cùng lúc) — quay lại mục 5, quyết định
   path-proxy hay subdomain, rồi mới cấu hình NPM.
