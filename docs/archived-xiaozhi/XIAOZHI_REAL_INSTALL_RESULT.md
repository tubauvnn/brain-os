# Xiaozhi thật — kết quả cài đặt trên VPS (2026-07-06)

Kết quả thực tế của việc cài stack Xiaozhi open-source thật (không phải demo web tự viết ở `/xiaozhi`) và nối vào Brain OS. Mọi lệnh/kết quả dưới đây đã chạy thật trên VPS này, không phải suy đoán.

## Kết luận (theo đúng 3 trạng thái yêu cầu)

**A. Xiaozhi server (`xiaozhi-esp32-server`) ĐÃ chạy được trên VPS**, chế độ "server-only" (Docker, 1 container, không cần MySQL/Redis/web-admin), đã nối LLM về Brain OS thành công và verify bằng cả 2 cách độc lập (test trực tiếp Brain OS + test qua chính engine LLM adapter của xiaozhi-server). URL nội bộ: `ws://127.0.0.1:8000/xiaozhi/v1/` (WebSocket), `http://127.0.0.1:8003/xiaozhi/ota/` (OTA/HTTP) — **hiện chỉ bind `127.0.0.1`, chưa public** (quyết định đã chốt với user để an toàn trước).

**B. `py-xiaozhi` (client) đã cấu hình được / cài Python deps thành công**, nhưng **không thể chạy voice thật trên chính VPS này** — thiếu 3 thư viện hệ thống (PortAudio, libEGL, libopus) mà VPS không có phần cứng/GUI để dùng tới. Cần chạy trên laptop/tablet có mic+loa thật.

**C. Firmware ESP32 (`78/xiaozhi-esp32`) chỉ tham khảo, chưa flash** — đúng yêu cầu, cần phần cứng thật.

---

## 1. Repo đã clone

| Repo | Đường dẫn | Trạng thái |
|---|---|---|
| `xinnan-tech/xiaozhi-esp32-server` | `/opt/xiaozhi/xiaozhi-esp32-server` | Clone mới, đầy đủ (monorepo Java+Vue+Python, chỉ dùng phần `main/xiaozhi-server`) |
| `huangjunsen0406/py-xiaozhi` | `/opt/py-xiaozhi` (symlink `/opt/xiaozhi/py-xiaozhi -> /opt/py-xiaozhi`) | Đã có sẵn từ phiên trước, đã `git pull` (up to date) |
| `78/xiaozhi-esp32` | Chưa clone | Chỉ tham khảo theo yêu cầu, không cần cho việc này |

## 2. Xiaozhi server chạy được chưa

**Đã chạy**, chế độ "server-only" (theo `docs/Deployment.md` của repo — không cần MySQL/Redis/web-admin, config qua file YAML).

```
docker ps
a496286f4a00   ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest   "python app.py"   Up   127.0.0.1:8000->8000/tcp, 127.0.0.1:8003->8003/tcp   xiaozhi-esp32-server
```

Log khởi động (`docker logs xiaozhi-esp32-server`), không có traceback:
```
初始化组件: llm成功 BrainOSLLM
初始化组件: intent成功 nointent
初始化组件: memory成功 nomem
初始化组件: vad成功 SileroVAD
初始化组件: asr成功 FunASR
OTA接口是      http://<container-ip>:8003/xiaozhi/ota/
Websocket地址是 ws://<container-ip>:8000/xiaozhi/v1/
```
(container-ip là IP nội bộ Docker network — từ host/VPS dùng `127.0.0.1:8000`/`127.0.0.1:8003`.)

## 3. Port / admin URL

- WebSocket (giao thức chính, ESP32/py-xiaozhi kết nối vào đây): `ws://127.0.0.1:8000/xiaozhi/v1/`
- HTTP (OTA + vision API): `http://127.0.0.1:8003/xiaozhi/ota/`
- **Không có web admin/console** trong chế độ server-only này (admin console chỉ có ở chế độ "full module", cần thêm MySQL+Redis+manager-api Java+manager-web Vue — **chưa dựng**, ngoài phạm vi yêu cầu "demo được không cần ESP32" tối giản).
- **Hiện chỉ bind `127.0.0.1`** (quyết định an toàn đã thống nhất với user) — muốn test từ máy khác qua mạng thật, xem mục 9 (việc tiếp theo).
- Public IP của VPS (tham khảo, chưa mở port cho nó): `42.96.12.122`.

## 4. py-xiaozhi chạy được chưa

- **Python deps: cài thành công 100%** qua `pip install -r requirements.txt` trong venv riêng (`/opt/py-xiaozhi/.venv`) — mọi package (kể cả PySide6, sherpa-onnx, opuslib, sounddevice) đều có prebuilt wheel, không cần compile.
- **Runtime: KHÔNG chạy được trên VPS này** — thiếu 3 thư viện hệ thống (không phải Python package):
  - `sounddevice` → `OSError: PortAudio library not found`
  - `PySide6.QtWidgets` (GUI) → `ImportError: libEGL.so.1: cannot open shared object file`
  - `opuslib` → `Exception: Could not find Opus library`
  - `sherpa_onnx` (wake-word/ASR) → import OK, không lỗi.
- **Cố ý không `apt install` các thư viện hệ thống trên** (PortAudio/libEGL/libopus) — đúng nguyên tắc đã thống nhất, vì VPS này không có mic/loa/màn hình thật để dùng tới, cài vào cũng không test được gì thêm.
- **Kết luận:** py-xiaozhi hoàn toàn có thể chạy — chỉ cần chạy trên máy có mic/loa/GUI thật (laptop/tablet Linux/macOS/Windows), cài lại `pip install -r requirements.txt` ở đó (các thư viện hệ thống tương ứng thường có sẵn trên desktop OS thông thường).

## 5. Có cần ESP32 không

**Không** — mục tiêu "demo không cần ESP32" đã đạt: `xiaozhi-esp32-server` (server) chạy độc lập trên VPS bằng Docker, và `py-xiaozhi` (client PC) là client thay thế cho phần cứng ESP32, kết nối cùng giao thức WebSocket. ESP32 thật chỉ cần nếu muốn demo trên phần cứng robot thật sau này.

## 6. Có web/GUI/CLI không

- **Server** (`xiaozhi-esp32-server`, chế độ server-only): không có UI, chỉ là backend WebSocket/HTTP.
- **Client** (`py-xiaozhi`): có GUI (PySide6) và CLI (`main.py --mode cli`) — nhưng cả 2 đều cần audio thật (mic/loa) để có ý nghĩa, GUI còn cần thêm `libEGL` (thường có sẵn trên desktop có màn hình, không có trên VPS headless).

## 7. Cấu hình OpenAI-compatible nằm ở đâu

- **File**: `/opt/xiaozhi/deploy/data/.config.yaml` (trên server, KHÔNG nằm trong git repo nào, không track git).
- **Cơ chế**: `config/config_loader.py` của `xiaozhi-esp32-server` merge đè `data/.config.yaml` lên `config.yaml` gốc trong image (`merge_configs()`, deep-merge, custom thắng) — nên `.config.yaml` **chỉ cần chứa phần muốn đổi**, không cần copy nguyên file gốc (đã verify bằng code, không phải đoán — xem `config/config_loader.py` dòng 160-188).
- **Nội dung** (secret đã redact khi hiển thị ở đây, file thật trên server có giá trị đầy đủ, quyền `600`):
  ```yaml
  server:
    websocket: ws://127.0.0.1:8000/xiaozhi/v1/

  selected_module:
    LLM: BrainOSLLM
    Intent: nointent   # Brain OS không hỗ trợ function-calling thật, tắt cho gọn

  LLM:
    BrainOSLLM:
      type: openai
      base_url: https://os.irec.vn/v1
      model_name: brainos-local
      api_key: "***REDACTED***"   # = XIAOZI_WEBHOOK_SECRET trong /root/brain-os/.env
  ```
- Với **py-xiaozhi** (client), cấu hình tương ứng nằm ở `SYSTEM_OPTIONS.NETWORK.WEBSOCKET_URL`/`OTA_VERSION_URL` (file `~/.local/share/py-xiaozhi/config/config.json`, tự sinh lần đầu chạy `main.py`, schema mặc định định nghĩa ở `src/utils/config_manager.py` dòng 25-37) — client này **không có** field base_url/api_key/model riêng (đã xác nhận lại đúng phát hiện phiên trước), nó chỉ trỏ tới 1 "xiaozhi-server" qua WebSocket, còn server đó (chính là `xiaozhi-esp32-server` vừa dựng) mới là nơi giữ cấu hình LLM.

## 8. Đã nối được về Brain OS chưa

**Đã nối và verify thành công qua 2 cách độc lập:**

1. **Test thẳng Brain OS** (không qua Xiaozhi server):
   ```
   POST https://os.irec.vn/v1/chat/completions  → HTTP 200
   choices[0].message.content: "Brain OS là bộ não lưu trí nhớ, công việc và điều khiển robot."
   ```
2. **Test qua chính LLM adapter của xiaozhi-server** (`performance_tester_llm.py`, chạy bằng `docker exec` — dùng đúng runtime/dependency có sẵn trong container, không cần venv riêng):
   ```
   BrainOSLLM: 首个 Token 7.058s, 完成响应 7.064s, 成功率 1/1, 状态 ✅ 正常
   ```
   → xác nhận `xiaozhi-esp32-server` thật sự gọi được Brain OS qua `type: openai` và nhận lại câu trả lời thật.

Không có secret nào bị in ra trong bất kỳ log/output nào ở trên (đã grep kiểm tra).

## 9. Lệnh chạy lại server/client

**Xiaozhi server:**
```bash
cd /opt/xiaozhi/deploy
docker compose up -d          # khởi động lại
docker compose down           # dừng
docker logs -f xiaozhi-esp32-server   # xem log
docker ps -a | grep xiaozhi   # kiểm tra trạng thái
```

**py-xiaozhi (chỉ dùng trên máy có mic/loa thật, không phải VPS này):**
```bash
cd /opt/xiaozhi/py-xiaozhi   # symlink -> /opt/py-xiaozhi
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py --mode cli    # hoặc GUI mặc định nếu bỏ --mode cli
```
Trước khi chạy, sửa `~/.local/share/py-xiaozhi/config/config.json` (tự sinh lần đầu chạy, hoặc tạo tay):
```json
{
  "SYSTEM_OPTIONS": {
    "NETWORK": {
      "OTA_VERSION_URL": "http://<vps-ip-hoặc-tunnel>:8003/xiaozhi/ota/",
      "WEBSOCKET_URL": "ws://<vps-ip-hoặc-tunnel>:8000/xiaozhi/v1/"
    }
  }
}
```

## 10. Việc tiếp theo người dùng cần làm

1. **Quyết định cách mở port cho test từ xa** (hiện `8000`/`8003` chỉ bind `127.0.0.1`, an toàn nhưng chỉ test được từ chính VPS):
   - Cách an toàn hơn: SSH tunnel từ laptop — `ssh -L 8000:localhost:8000 -L 8003:localhost:8003 root@42.96.12.122`, rồi trỏ py-xiaozhi vào `ws://localhost:8000/xiaozhi/v1/` như đang chạy tại chỗ.
   - Cách nhanh hơn nhưng lộ port ra Internet không TLS/không auth: đổi `docker-compose.yml` (`/opt/xiaozhi/deploy/docker-compose.yml`) từ `127.0.0.1:8000:8000`/`127.0.0.1:8003:8003` thành `8000:8000`/`8003:8003` (bind mọi interface), rồi `docker compose up -d` lại. **Không đụng NPM/Cloudflare** — đây là raw IP:port, không qua domain.
2. **Chạy `py-xiaozhi` thật trên laptop/tablet có mic+loa** (không phải VPS) — clone/copy `/opt/py-xiaozhi` hoặc `git clone https://github.com/huangjunsen0406/py-xiaozhi.git`, cài theo mục 9 ở trên, trỏ `WEBSOCKET_URL` theo cách đã chọn ở bước 1.
3. **ESP32 thật** (`78/xiaozhi-esp32`) — chỉ cần khi có phần cứng robot thật, lúc đó cấu hình OTA URL của firmware trỏ vào cùng server này. Chưa làm, chưa cần làm.
4. Nếu sau này muốn dùng chế độ "full module" (có web admin, quản lý nhiều thiết bị/agent qua UI) thay vì server-only — cần dựng thêm MySQL+Redis+`manager-api`+`manager-web`, phức tạp hơn nhiều, chưa làm vì không cần thiết cho mục tiêu "demo không cần ESP32".
5. Brain OS không bị ảnh hưởng gì bởi việc cài đặt này (không sửa code, không sửa NPM/Cloudflare, không đụng port 3000) — đã verify lại `https://os.irec.vn/xiaozhi` và `/robot` vẫn `200` sau khi hoàn tất.
