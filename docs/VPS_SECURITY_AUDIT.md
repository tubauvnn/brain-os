# VPS Security Audit — sau sự cố Postgres bị tấn công

**Thời gian audit:** 2026-07-07, ~14:29–14:40 UTC (tiếp ngay sau khi cứu Brain OS/Postgres).

## 1. Sự cố đã phát hiện (bối cảnh, xem chi tiết STATE.md phiên 35)

- Brain OS (port 3000) chết do VPS reboot lúc 11:54:42 UTC — không có systemd/pm2 nên process không tự lên lại.
- `brainos-postgres` từng bị publish `0.0.0.0:5432` (public). Log cho thấy 1 bot brute-force nhiều giờ liền (`password authentication failed for user "postgres"/"woglet"`), đăng nhập được vì mật khẩu DB là `postgres:postgres` (mặc định, trùng username). Sau khi vào, bot chạy lặp lại `ALTER ROLE kong WITH NOLOGIN; CREATE DATABASE rdb OWNER r0;`, tự khoá luôn role `postgres` (`NOLOGIN`), để lại database rác `readme_to_recover`. Database `brain_os` đã mất từ trước đó (từ 2026-07-06, một migration hụt, không liên quan trực tiếp bot).
- Đã xử lý: khôi phục `LOGIN` qua single-user mode, đổi bind Postgres về `127.0.0.1:5432`, rotate mật khẩu, tạo lại `brain_os` + restore từ backup gần nhất (`backups/brain_os_20260705_141549.sql`, mất dữ liệu từ 2026-07-05 14:15 tới lúc restore), xoá `readme_to_recover`.

## 2. Port public trước audit

| Port | Service | Container | Bind trước | Ghi chú |
|---|---|---|---|---|
| 22 → 26266 | SSH | host (sshd) | `0.0.0.0`+`[::]` | Bắt buộc public |
| 80 | NPM HTTP | nginx-proxy-manager | `0.0.0.0`+`[::]` | Bắt buộc public |
| 443 | NPM HTTPS | nginx-proxy-manager | `0.0.0.0`+`[::]` | Bắt buộc public |
| 81 | NPM admin UI | nginx-proxy-manager | `0.0.0.0`+`[::]` | Không cần public, không có domain nào trỏ vào |
| 3000 | Brain OS (`next dev`) | không phải docker, process trần | `0.0.0.0`+`[::]` (dual-stack) | NPM proxy `os.irec.vn` trỏ `172.17.0.1:3000` — vẫn để lộ trực tiếp qua IP:port |
| 5432 | Postgres Brain OS | brainos-postgres | ~~`0.0.0.0`~~ đã sửa trước audit này | Đã là `127.0.0.1` từ lúc cứu sự cố |
| 8080 | code-server | code-server | `0.0.0.0`+`[::]` | **Có dùng domain `code.irec.vn` qua NPM** (target là IP public `42.96.12.122:8080`, cùng bridge network với NPM nhưng cấu hình theo IP public) — có `auth: password` bật sẵn |
| 8090 | MoneyPrinterTurbo API | moneyprinterturbo-api | `0.0.0.0` (chỉ IPv4) | Không có domain nào trỏ vào |
| 8501 | MoneyPrinterTurbo WebUI | moneyprinterturbo-webui | `0.0.0.0` (chỉ IPv4) | Không có domain nào trỏ vào |
| 9000 | Portainer HTTP | portainer | `0.0.0.0`+`[::]` | Không có domain nào trỏ vào |
| 9443 | Portainer HTTPS | portainer | `0.0.0.0`+`[::]` | Không có domain nào trỏ vào |
| 18000/18003 | Xiaozhi standalone | xiaozhi-standalone-server | `127.0.0.1` | Đã local-only từ trước, không đụng |

## 3. Port đã khoá / local-only (trong audit này)

Dùng **iptables/ip6tables** (không đổi bind container, không đổi NPM, không enable UFW) — allow loopback + dải nội bộ Docker (`172.16.0.0/12`), DROP còn lại:

| Port | Cơ chế | Trạng thái sau |
|---|---|---|
| 3000 | `iptables`/`ip6tables` INPUT (process trần, không qua Docker NAT) | Chỉ local (`127.0.0.0/8`, `::1`) + dải Docker nội bộ (`172.16.0.0/12`) truy cập được. Test trực tiếp `http://<public-ip>:3000` từ chính VPS (loopback tới IP công khai) đã bị chặn; `os.irec.vn` và local vẫn `200`. |
| 9000, 9443 | IPv4: `iptables` DOCKER-USER (FORWARD) · IPv6: `ip6tables` INPUT (docker-proxy tự lắng nghe `[::]`, không qua NAT) | Không có domain phụ thuộc, an toàn tuyệt đối để khoá |
| 81 | như trên | NPM tự vẫn phục vụ 80/443 bình thường (chỉ chặn riêng port 81) |
| 8080 (code-server) | như trên | **Rủi ro cao nhất** vì `code.irec.vn` dùng chính port này — đã test `code.irec.vn` sau khi thêm rule: vẫn `302 → /login` bình thường (không gãy) |
| 8090, 8501 (MoneyPrinterTurbo) | IPv4 only (không có listener IPv6) | Không có domain phụ thuộc |

**Postgres 5432:** đã local-only từ bước cứu sự cố (không cần làm gì thêm trong audit này).

## 4. Port còn public hợp lệ (không đổi, cần thiết)

- `22`/`26266` SSH — quản trị VPS.
- `80`/`443` — NPM, phục vụ `os.irec.vn`, `code.irec.vn`, mọi domain khác qua Cloudflare.

## 5. Giới hạn đã biết / rủi ro chưa xử lý dứt điểm

1. **Không xác minh được 100% từ vị trí thật sự bên ngoài internet.** Tự test từ chính VPS tới IP công khai của nó bị Linux/Docker "hairpin" (tự định tuyến nội bộ, không đi qua chain lọc bên ngoài) nên không phản ánh đúng traffic thật từ internet — đã xác nhận bằng `tcpdump` trên `eth0` (không thấy gói tin nào trong lúc tự test). Cơ chế lọc (`iptables`/`ip6tables`, dùng DNAT+FORWARD chuẩn của Docker) là đúng kỹ thuật và đúng cách làm phổ biến, nhưng khuyến nghị **user tự kiểm tra lại bằng máy khác** (điện thoại 4G, không qua VPN VPS) bằng:
   ```bash
   curl -m 5 -I http://42.96.12.122:9000
   curl -m 5 -I http://42.96.12.122:3000
   curl -m 5 -I http://42.96.12.122:8080
   ```
   Nếu các lệnh trên **timeout/connection refused** (không phải `200`) từ máy ngoài → xác nhận đã khoá đúng.
2. **Không persistent qua reboot.** Toàn bộ rule vừa thêm là `iptables`/`ip6tables` runtime — **sẽ mất khi VPS reboot** (chưa cài `iptables-persistent`/`netfilter-persistent`, cố tình chưa cài thêm gói mới ngoài phạm vi yêu cầu). Đây là rủi ro giống hệt nguyên nhân gốc của sự cố Postgres (reboot làm mất trạng thái). Xem mục 8.
3. **UFW vẫn `inactive`, chưa bật** — theo đúng yêu cầu ("không tự enable nếu chưa chắc"). Lệnh đề xuất (chưa chạy):
   ```bash
   ufw allow 26266/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw default deny incoming
   ufw --force enable
   ```
   **Lưu ý nếu áp dụng sau này:** UFW không tự lọc port do Docker publish (Docker tự chèn rule vào trước) — vẫn cần giữ song song rule `DOCKER-USER`/`ip6tables` như đã làm ở đây, UFW chỉ cộng thêm lớp bảo vệ cho port không phải Docker (như 3000 nếu chưa có rule input riêng, và như một lớp phòng thủ chung).
4. **code-server (8080)** vẫn buộc phải public một phần vì `code.irec.vn` trỏ thẳng vào port này qua IP public (không qua bridge network nội bộ của NPM dù kỹ thuật có thể làm được) — mật khẩu `PASSWORD` đã bật sẵn (không kiểm tra độ mạnh, không log ra terminal) là lớp bảo vệ duy nhất còn lại ở layer ứng dụng nếu firewall có lỗ hổng nào chưa lường hết.
5. **Chưa audit các container khác ngoài phạm vi yêu cầu** (vd `moneyprinterturbo-api`/`webui` có auth gì không — chưa kiểm tra, chỉ khoá port).

## 6. Lệnh kiểm tra nhanh

```bash
# Xem toàn bộ port đang nghe
ss -tulpn

# Xem container + port
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'

# Xem rule đã thêm (IPv4)
iptables -S INPUT
iptables -S DOCKER-USER

# Xem rule đã thêm (IPv6)
ip6tables -S INPUT

# Test web chính
curl -I http://127.0.0.1:3000/robot
curl -I https://os.irec.vn/robot

# Test 1 port đã khoá từ trong VPS (KHÔNG đủ để kết luận — xem mục 5.1)
curl -m 5 -I http://127.0.0.1:9000    # phải vẫn 200 (local được phép)
```

## 7. Việc cần làm tiếp theo (ưu tiên giảm dần)

1. **Cài đặt persistence cho firewall rule** (`iptables-persistent`/`netfilter-persistent`, hoặc 1 systemd unit chạy lại đúng các lệnh ở mục 3 lúc boot) — nếu không, mọi khoá port hôm nay sẽ mất sau lần reboot tiếp theo, lặp lại đúng kịch bản dẫn tới sự cố Postgres.
2. **User tự test từ mạng ngoài thật** (điện thoại 4G) theo mục 5.1 để xác nhận độc lập.
3. Cân nhắc thêm supervisor cho Brain OS (`systemd`/`pm2`) để process port 3000 tự sống lại sau reboot — hiện `next dev` vẫn chạy tay qua `setsid nohup`, không tự phục hồi.
4. Quyết định có nên chuyển `code.irec.vn` sang trỏ NPM → IP nội bộ bridge (`172.17.0.3:8080`) thay vì IP public — giảm bớt lý do phải giữ 8080 public, nhưng cần sửa cấu hình trong NPM UI (ngoài phạm vi "không phá NPM" của audit này, cần user tự làm hoặc xác nhận trước).
5. Xoá 2 file `.env.backup.*` cũ trên `/root/brain-os` nếu còn (ghi nhận từ NEXT.md phiên 30) — không liên quan trực tiếp audit này nhưng cùng nhóm rủi ro rò rỉ secret cũ.
6. Không mở lại Xiaozhi standalone task trong phiên audit này (đúng yêu cầu) — có thể quay lại bình thường, không bị ảnh hưởng bởi bất kỳ thay đổi nào ở đây (port 18000/18003 không đụng tới).
