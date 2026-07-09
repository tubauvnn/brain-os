# Brain OS — Knowledge Acquisition System V1

**Vai trò:** Principal AI Architect — thiết kế thuần kiến trúc, không code, không schema thật (Prisma mẫu chỉ để minh hoạ hình dạng dữ liệu), không UI.
**Ngày:** 2026-07-08 · **Tiền đề:** tài liệu này build trực tiếp trên `docs/ARCHITECTURE_REVIEW_V1.md` — dùng lại đúng khái niệm Core (Agent Router / Model Router / Tool Router / Device Router / Memory / Event Bus / Scheduler / Permissions) đã đề xuất ở đó, không phát minh lại.
**Mục tiêu:** Brain OS chủ động thu thập, xử lý và tích luỹ tri thức thế giới mỗi ngày — không chờ user hỏi, không search internet lại từ đầu mỗi lần.

> **🔒 KIẾN TRÚC V1 ĐÃ ĐÓNG BĂNG (2026-07-09), đã vá sau `ARCHITECTURE_AUDIT_V1.md`:** `KnowledgeRelation` (mục 6) + Dedup lớp 3 (mục 9, phần vector-similarity linking) **hoãn khỏi phạm vi V1** — xem ghi chú tại mục 6 (audit mục 4.3: schema đầu cơ trước khi có dữ liệu thật). Schema `embedding: Unsupported("vector(1536)")` ở mục 6 là **minh hoạ triển khai tham chiếu**, không phải hợp đồng — hợp đồng thật là `KnowledgeRepository` interface (mục 14.4), xem ghi chú tại mục 6 (audit mục 5.1). "Scheduler" ở mục 8 làm rõ là **bộ tạo Task theo cron**, không phải bộ điều phối/dispatch chính — bộ điều phối chính là Scheduling Loop của `EXECUTION_MODEL_V1.md` mục 6 (audit mục 2.3, tránh nhầm 2 khái niệm trùng tên khác quy mô).

---

## 0. Ranh giới Knowledge vs Memory (đọc trước khi đọc phần còn lại)

| | **Memory** (đã có, `docs/ARCHITECTURE_REVIEW_V1.md` mục 12) | **Knowledge** (tài liệu này) |
|---|---|---|
| Bản chất | Thông tin **cá nhân** — của Tú, về Tú, do Tú/Agent ghi | Tri thức **thế giới** — không thuộc sở hữu ai, tồn tại độc lập với Brain OS |
| Nguồn | User nói, Agent suy ra trong lúc phục vụ user | Collector thu thập chủ động từ internet, định kỳ, không cần user yêu cầu |
| Truy cập | Có `access_level` (0-4), gate theo quyền | Mặc định công khai/trung lập — không gate theo owner (xem mục 14 về đa-tenant) |
| Vòng đời | Không tự hết hạn — tồn tại tới khi user xoá | **Có hạn dùng** (`expires_at`), có suy giảm điểm chất lượng theo thời gian, có thể bị archive |
| Cổng truy cập | `MemoryService.recall()/remember()` | `KnowledgeService.recall()/ingest()/expire()` — **service riêng, không dùng chung gate với Memory** |
| Ví dụ | "Tú thích cà phê đen, dị ứng tôm" | "Hôm nay GitHub Trending có 1 framework RAG mới 8k sao" |

Hai service độc lập nhưng cùng nằm trong Core, cùng nguyên tắc: **Agent chỉ đọc/ghi qua service, không tự query Prisma**. Một Agent (vd Research Agent) hoàn toàn có thể gọi cả hai trong 1 lượt xử lý (`ctx.memory.recall()` để biết Tú quan tâm mảng gì, `ctx.knowledge.recall()` để lấy tin tức mới nhất về mảng đó).

---

## 1. Kiến trúc Knowledge System (tổng quan)

```
                    ┌─────────────── Scheduler (Core) ───────────────┐
                    │  cron per-collector, concurrency limit, retry  │
                    └───────────────────────┬─────────────────────────┘
                                             │ trigger
                    ┌────────────────────────▼────────────────────────┐
                    │            Collector Registry (Plugin)           │
                    │  AI News · GitHub · Product Hunt · HN · Reddit   │
                    │  Google Trends · TikTok · Facebook · YouTube ·   │
                    │  RSS · Custom  — mỗi nguồn 1 plugin, tự đăng ký  │
                    └───────────────────────┬─────────────────────────┘
                                             │ RawDocument[]
                    ┌────────────────────────▼────────────────────────┐
                    │              Knowledge Pipeline (Core, cố định)   │
                    │  Normalizer → Dedup (rẻ) → Summarizer → Classifier│
                    │  → Importance Scorer → Embedding → Dedup (vector)│
                    └───────────────────────┬─────────────────────────┘
                                             │ Knowledge (đủ field)
                    ┌────────────────────────▼────────────────────────┐
                    │       KnowledgeService (Core) — cổng duy nhất     │
                    │         recall() / ingest() / expire() / prune() │
                    └──────┬───────────────────────────────────┬──────┘
                            │                                    │
                     Knowledge Store                      Event Bus
                  (Postgres + vector index)          phát "knowledge.ingested"
                                                                 │
                                                    ┌────────────▼────────────┐
                                                    │  Research/Video/Business/ │
                                                    │  SEO Agent (qua ctx.knowledge) │
                                                    │  + Notify/Digest Agent    │
                                                    └───────────────────────────┘
```

**3 ranh giới bất biến** (chi tiết lý do ở mục 14, nêu sớm vì chi phối mọi thiết kế bên dưới):
1. **Collector không biết Pipeline làm gì** — chỉ có nhiệm vụ trả `RawDocument[]` thô, đúng định dạng thoả thuận.
2. **Pipeline không biết Collector nào gọi nó** — nhận `RawDocument[]` kèm `source` (tên Collector), xử lý giống hệt nhau bất kể nguồn.
3. **Agent không được chạm Knowledge Store trực tiếp** — chỉ qua `KnowledgeService`, giống hệt nguyên tắc đã áp cho Memory.

**Vị trí trong Core đã đề xuất:** Knowledge System **không phải** 1 Router ngang hàng Agent/Model/Tool/Device Router — nó là 1 **service con của Core** (như Memory), được **nuôi** bởi 1 luồng nền chạy qua Scheduler, và được **đọc** bởi Agent qua `ctx.knowledge`. Không cần thêm Router thứ 5.

---

## 2. Folder Structure

```
src/
├── core/
│   └── knowledge/
│       ├── knowledge-service.ts        # recall()/ingest()/expire()/prune() — cổng duy nhất
│       ├── pipeline/
│       │   ├── normalizer.ts
│       │   ├── deduplicator.ts         # 3 lớp, xem mục 9
│       │   ├── summarizer.ts           # gọi Model Router (capability "summarize")
│       │   ├── classifier.ts           # gọi Model Router (capability "classify")
│       │   ├── importance-scorer.ts    # xem mục 10
│       │   └── embedder.ts             # gọi Model Router (capability "embedding")
│       └── types.ts                    # RawDocument, KnowledgeCandidate, KnowledgeQuery
├── collectors/                          # Plugin — mỗi thư mục 1 nguồn, tự đăng ký
│   ├── ai-news/
│   ├── github-trending/
│   ├── product-hunt/
│   ├── hacker-news/
│   ├── reddit/
│   ├── google-trends/
│   ├── tiktok-trends/
│   ├── facebook-trends/
│   ├── youtube/
│   ├── rss/                             # nhận N feed URL qua config, không phải 1 nguồn cố định
│   └── custom/                          # template để user tự thêm nguồn không cần sửa Core
└── agents/
    ├── research-agent/    # đọc Knowledge TRƯỚC khi search internet (mục 12)
    ├── video-agent/        # đọc Knowledge để đề xuất chủ đề
    ├── business-agent/     # đọc Knowledge để đề xuất chiến lược
    ├── seo-agent/           # đọc Knowledge để tìm keyword
    └── digest-agent/        # MỚI — subscribe "knowledge.ingested", tổng hợp "hôm nay có gì mới"
```

Khớp 1-1 với `src/agents/*`, `src/models/*` đã đề xuất trong Architecture Review V1 — `collectors/` là thư mục plugin thứ 5, cùng cấp `agents/`/`models/`/`tools/`/`devices/`, cùng nguyên tắc tự đăng ký.

---

## 3. Plugin Architecture (Collector)

```ts
interface KnowledgeCollector {
  slug: string;                    // "github-trending" — duy nhất, dùng làm "source"
  name: string;
  sourceType: SourceType;          // "news" | "code" | "social" | "trends" | "video" | "rss" | "custom"
  defaultSchedule: string;         // cron mặc định, Scheduler override được (mục 8)
  authRef?: string;                // trỏ tới Connector.id đã có (tái dùng model Connector hiện có)
  fetch(ctx: CollectorContext): Promise<RawDocument[]>;
}

type RawDocument = {
  externalId: string;              // id gốc tại nguồn — dùng dedupe lớp 1 (mục 9)
  url?: string;
  title: string;
  body: string;
  publishedAt?: Date;
  author?: string;
  engagement?: Record<string, number>;   // stars/upvotes/views/comments nếu nguồn có — thô, chưa chuẩn hoá
  raw: unknown;                     // giữ nguyên payload gốc, phục vụ debug/reprocess
};
```

**Đăng ký:** mỗi `collectors/<slug>/index.ts` export 1 `KnowledgeCollector`; Collector Registry (trong `core/knowledge/`) glob-import toàn bộ lúc khởi động — giống hệt cơ chế Agent Registry đã đề xuất. Thêm nguồn thứ 11 = thêm 1 thư mục, **0 dòng sửa Core**.

**Tái dùng hạ tầng đã có:** `authRef` trỏ vào model `Connector` (đã tồn tại trong schema hiện tại, có `connector_type` enum + `config Json`) — token Reddit OAuth, cookie TikTok, API key Product Hunt... lưu ở đó, Collector không tự quản secret. Đây là 1 chỗ tái dùng thật, không phải bảng mới.

---

## 4. Collector Architecture — chi tiết & risk tier từng nguồn

Không phải 10 nguồn dễ như nhau. Phân tier theo độ ổn định/hợp lệ của đường lấy dữ liệu — quyết định trực tiếp thứ tự triển khai (Phase nào làm nguồn nào, xem `ARCHITECTURE_REVIEW_V1.md` tinh thần "làm rẻ trước, phần rủi ro để sau"):

| Collector | Đường lấy dữ liệu khả dĩ | Tier | Ghi chú |
|---|---|---|---|
| **Hacker News** | Firebase API chính thức, miễn phí, ổn định | 🟢 1 | Làm đầu tiên — rẻ nhất, không rủi ro |
| **RSS** | Chuẩn RSS/Atom, N feed do user cấu hình | 🟢 1 | "Collector vạn năng" — AI News thực ra nên **là 1 cấu hình RSS** (feed từ các blog/newsletter AI uy tín) thay vì viết riêng, xem ghi chú dưới |
| **GitHub Trending** | Không có official API cho "trending" — dùng community JSON mirror hoặc tự scrape HTML trang trending | 🟡 2 | HTML scrape dễ vỡ khi GitHub đổi layout — cô lập lỗi kỹ (Scheduler mục 8), không để vỡ 1 nguồn kéo sập cả batch |
| **Product Hunt** | GraphQL API chính thức, cần API token | 🟢 1 | Ổn định, có rate limit rõ ràng |
| **Reddit** | Official API, cần OAuth app + tuân thủ rate limit (đã siết chặt từ 2023) | 🟡 2 | Chi phí/điều khoản đã đổi — cần review ToS hiện hành trước khi bật thật, không giả định free như trước |
| **YouTube** | Data API v3 chính thức (quota-based, có free tier) | 🟢 1 | Ổn định, quota cần theo dõi |
| **Google Trends** | Không có official public API — chỉ có thư viện/endpoint không chính thức | 🔴 3 | Dễ bị chặn IP, không có SLA. Khuyến nghị: cân nhắc SerpApi/tương tự (dịch vụ trung gian trả phí, có ToS rõ) thay vì tự scrape trực tiếp |
| **TikTok Trends** | Không có official public API cho "trending" | 🔴 3 | Rủi ro ToS cao nhất trong danh sách — khuyến nghị **hoãn tới khi có API/dịch vụ hợp lệ**, không tự động hoá scrape trực tiếp |
| **Facebook Trends** | Facebook đã **ngừng tính năng Trending** (từ 2018) — mục này gần như không còn nguồn thật để thu thập | 🔴 3 | Khuyến nghị: bỏ khỏi danh sách 10, hoặc thay bằng "Meta/Instagram public content API" nếu mục tiêu thật là theo dõi Meta ecosystem, không phải "Facebook Trends" theo nghĩa đen (tính năng đã chết) |
| **Custom** | Không cố định — template cho user tự khai báo | 🟢 — | Chính là cơ chế biến bất kỳ nguồn nào (kể cả nguồn nội bộ, vd "email digest", "Slack channel") thành Collector mà không cần Core biết trước |

**Kết luận thiết kế:** không nên coi "10 Collector" là 10 khối công việc ngang nhau. **AI News nên implement như 1 cấu hình của RSS Collector** (không phải class riêng) — giảm còn thực chất ~7-8 loại adapter kỹ thuật khác nhau, trong đó 4 nguồn Tier 🟢 nên làm trước, 2 nguồn Tier 🟡 làm sau khi có cơ chế cô lập lỗi tốt, 2-3 nguồn Tier 🔴 (Google Trends/TikTok/Facebook) **để cuối cùng, có thể mãi mãi không tự động hoá** nếu không tìm được đường lấy dữ liệu hợp lệ — đây là phản biện thẳng vào yêu cầu gốc: liệt kê đủ 8 nguồn ví dụ không có nghĩa cả 8 đều nên tự động hoá ngay ở Phase 1.

---

## 5. Processing Pipeline

Cố định, không phải plugin — **mọi** `RawDocument` từ **mọi** Collector đi qua đúng 6 bước theo đúng thứ tự này, đảm bảo chất lượng đồng nhất bất kể nguồn:

1. **Normalizer** — chuẩn hoá về 1 shape chung: strip HTML/markdown thừa, chuẩn hoá encoding UTF-8, quy timestamp về UTC, **phát hiện ngôn ngữ** (field `language` — cần cho cả lọc lẫn chọn model summarize phù hợp). Đây là **lớp duy nhất hiểu format riêng của từng loại nguồn** (RSS XML khác JSON API khác HTML scrape) — mọi bước sau chỉ thấy 1 schema chung.
2. **Dedup lớp 1+2** (rẻ, trước khi tốn tiền AI) — theo `(source, externalId)` và theo content-hash — xem mục 9. Loại ngay tại đây, không đẩy tiếp xuống Summarizer nếu đã trùng.
3. **Summarizer** — gọi Model Router (`capability: "summarize"`) sinh `title` chuẩn hoá (có thể khác title gốc nếu title gốc là clickbait) + `summary` ngắn (2-4 câu).
4. **Classifier** — gán `category` (rule-based mặc định theo `sourceType` của Collector, model tinh chỉnh nếu cần) + `tags` (model sinh, giới hạn 5-8 tag/bản ghi tránh tag rác).
5. **Importance Scorer** — xem mục 10, kết hợp nhiều tín hiệu, **không chỉ hỏi AI 1 câu "quan trọng không"**.
6. **Embedding** — gọi Model Router (`capability: "embedding"`), lưu kèm `embedding_model_version` (lý do ở mục 14). Sau bước này chạy **Dedup lớp 3** (vector similarity, xem mục 9) trước khi ghi vào Store.

→ **Knowledge Store** qua `KnowledgeService.ingest()` — đây là nơi duy nhất enforce "đủ field bắt buộc" (title/summary/source/category/tags/created/importance/confidence/language/embedding), từ chối ghi nếu thiếu — không route/Collector nào được bypass service này để ghi thẳng DB.

---

## 6. Database Design (minh hoạ hình dạng — không phải migration thật)

Bổ sung thuần additive lên schema hiện có, không sửa `Memory`/`PrivateMemory`/model nào khác.

**Đây là 1 triển khai THAM CHIẾU (Postgres+pgvector cụ thể), không phải hợp đồng** — hợp đồng thật `KnowledgeService`/`KnowledgeRepository` (mục 14.4, `SYSTEM_CONTRACTS_V1.md` mục 16) mới là thứ Agent/Pipeline phụ thuộc vào. Field `Unsupported("vector(1536)")` dưới đây cắm cứng cú pháp Prisma-riêng-Postgres — chấp nhận được cho 1 ví dụ minh hoạ, nhưng **không được** đọc như 1 tuyên bố "Kernel/ABI phụ thuộc Postgres" (chúng không — xem `KERNEL_ARCHITECTURE_V1.md` mục 3 hàng "Database").

**`KnowledgeRelation` HOÃN khỏi phạm vi V1 (`ARCHITECTURE_AUDIT_V1.md` mục 4.3):** bảng dưới đây minh hoạ hình dạng đầy đủ dự kiến, nhưng **không nằm trong `docs/IMPLEMENTATION_ROADMAP_V1.md` Phase đầu** — đây là schema đầu cơ cho tính năng "tìm Knowledge liên quan" viết trước khi có 1 bản ghi Knowledge thật nào tồn tại để kiểm chứng nhu cầu. Dedup lớp 3 (mục 9, phần vector-similarity) cũng hoãn theo — Phase đầu chỉ cần Dedup lớp 1+2 (rẻ, đủ dùng khi volume còn nhỏ).

```prisma
model Knowledge {
  id                String    @id @default(cuid())
  title             String
  summary           String
  content           String?             // full text — cân nhắc lưu ngoài DB nếu lớn, xem mục 13
  source            String              // slug của Collector, vd "github-trending"
  source_url        String?
  external_id       String?             // id gốc tại nguồn — dedupe lớp 1
  category          String
  tags              String[]  @default([])
  language          String    @default("en")

  importance_score  Float     @default(0)   // 0-100, xem mục 10
  confidence_score  Float     @default(0)   // 0-1, độc lập với importance
  quality_score     Float     @default(0)   // composite, dùng để prune (mục 13)

  embedding                 Unsupported("vector(1536)")?   // pgvector — CHƯA có trong hạ tầng hiện tại, xem mục 13/14
  embedding_model_version  String?                          // bắt buộc đi kèm embedding, xem mục 14

  status            KnowledgeStatus @default(active)   // active | stale | expired | archived
  expires_at        DateTime?
  collected_at      DateTime  @default(now())
  published_at      DateTime?           // thời điểm nguồn gốc công bố — khác collected_at
  updated_at        DateTime  @updatedAt
  version           Int       @default(1)
  superseded_by_id  String?             // trỏ bản ghi mới hơn nếu bị "cập nhật" thay vì ghi đè
  scoring_policy_version String?        // versioning công thức scoring, xem mục 14

  related           KnowledgeRelation[] @relation("KnowledgeToRelated")
  related_from      KnowledgeRelation[] @relation("RelatedToKnowledge")

  @@index([category, importance_score])
  @@index([source, external_id])
  @@index([status, expires_at])
}

model KnowledgeRelation {
  id            String   @id @default(cuid())
  knowledge_id  String
  related_id    String
  similarity    Float
  relation_type String   @default("similar")   // "similar" | "duplicate" | "update_of"
  created_at    DateTime @default(now())

  knowledge     Knowledge @relation("KnowledgeToRelated", fields: [knowledge_id], references: [id], onDelete: Cascade)
  related       Knowledge @relation("RelatedToKnowledge", fields: [related_id], references: [id], onDelete: Cascade)

  @@unique([knowledge_id, related_id])
}

enum KnowledgeStatus {
  active     // đang dùng bình thường
  stale      // qua ngưỡng "tươi", vẫn recall được nhưng bị hạ điểm rank
  expired    // qua expires_at, không recall mặc định (phải yêu cầu tường minh)
  archived   // đã prune (mục 13), giữ lại nhưng loại khỏi mọi truy vấn thường
}

model CollectorRun {                      // quan sát/audit — tương tự AgentRun đã đề xuất
  id              String   @id @default(cuid())
  collector_slug  String
  status          String   @default("running")   // running | success | partial | error
  items_fetched   Int      @default(0)
  items_ingested  Int      @default(0)
  items_deduped   Int      @default(0)
  error           String?
  started_at      DateTime @default(now())
  finished_at     DateTime?

  @@index([collector_slug, started_at])
}
```

**Cảnh báo hạ tầng cụ thể (không phải lý thuyết):** Postgres hiện tại chạy image `postgres:16` thuần (đã kiểm tra `docker-compose.db.yml`) — **không có sẵn extension `vector`**. Trước khi field `embedding` có ý nghĩa, cần đổi sang image có pgvector (`pgvector/pgvector:pg16` hoặc cài extension thủ công) — đây là việc hạ tầng cần làm **trước** Phase có Embedding, không phải chi tiết migrate tầm thường. Đưa vào roadmap tường minh, không giả định "cứ thêm field là chạy được".

---

## 7. Event Flow

**Luồng thu thập hàng ngày** (đúng ví dụ user đưa, chi tiết hoá):

```
Scheduler (cron per-collector)
  → Collector Registry (chạy song song, concurrency-limited, mỗi Collector độc lập)
  → Collector.fetch() → RawDocument[]
  → Knowledge Pipeline (Normalizer → Dedup 1+2 → Summarizer → Classifier → Importance Scorer → Embedding → Dedup 3)
  → KnowledgeService.ingest() → Knowledge Store
  → Event Bus phát "knowledge.ingested" { count, byCategory, runId }
  → Digest Agent (subscribe sẵn) tổng hợp "hôm nay học được X điều mới, nổi bật: ..."
  → ghi ActivityLog (Dashboard tương lai hiển thị, đúng mục tiêu "Today/Running Agents" đã nêu ở Architecture Review V1)
```

**Luồng Agent tiêu thụ Knowledge** (Research/Video/Business/SEO — đây là phần **quan trọng hơn** luồng thu thập, vì là lý do Knowledge System tồn tại):

```
User/Agent Router → chọn Agent (vd Video Agent)
  → Agent gọi ctx.knowledge.recall({ categories, preferredSources, sortBy: "importance", limit })
  → ĐỦ tín hiệu tốt (quality cao, đủ mới, đủ số lượng)?
      CÓ → dùng luôn, trả lời/đề xuất ngay — KHÔNG search internet
      KHÔNG → Agent gọi ctx.tool("web.search") (Tool Router)
              → kết quả search ĐƯỢC ĐẨY NGƯỢC vào Knowledge Pipeline (bước 2 trong sơ đồ trên)
              → lần hỏi sau về chủ đề này đã có sẵn trong Knowledge
```

**Insight thiết kế quan trọng nhất của tài liệu này:** Knowledge không chỉ được nạp bởi 10 Collector chạy theo lịch — **mọi lần Agent buộc phải search internet vì Knowledge chưa đủ cũng là 1 đường nạp Knowledge mới**, qua đúng 1 Pipeline. Đây là cơ chế khiến hệ thống "học suốt đời" đúng nghĩa thay vì chỉ học từ danh sách nguồn cố định — nguồn tri thức thực sự không giới hạn ở 10 Collector, nó mở rộng theo đúng những gì user/Agent thực sự cần biết.

---

## 8. Scheduler Design

**Làm rõ sau `ARCHITECTURE_AUDIT_V1.md` mục 2.3:** "Scheduler" ở đây là **bộ tạo Task theo cron** (mỗi lần tới giờ, tạo 1 `Task{operation:"collector.fetch"}` mới và giao cho hệ thống điều phối chung) — **không phải** bộ dispatch/admission-control chính của toàn hệ thống. Bộ điều phối chính (nhận Task từ Scheduler này lẫn từ mọi nguồn khác — Agent tự spawn, user request trực tiếp — rồi quyết định khi nào/có chạy hay không) là **Scheduling Loop**, thiết kế đầy đủ ở `EXECUTION_MODEL_V1.md` mục 6. Quan hệ: Scheduler (mục này) là 1 trong nhiều nguồn TẠO Task; Scheduling Loop là nơi DUY NHẤT quyết định thực thi — Knowledge System không tự dispatch Collector, nó chỉ tự TẠO Task rồi giao cho cơ chế chung.

Knowledge System **không cần đợi Scheduling Loop đầy đủ** mới chạy được — Phase đầu, Scheduler có thể gọi thẳng 1 endpoint nội bộ thực thi Collector ngay (bỏ qua admission control tinh vi), miễn tuân thủ đúng Task/Result contract khi Scheduling Loop thật sẵn sàng migrate vào sau, không cần viết lại Collector. Thiết kế tối thiểu khả thi ngay:

- **Cơ chế kích hoạt:** OS-level cron (systemd timer/crontab) gọi 1 endpoint nội bộ bảo vệ bằng secret (tái dùng đúng pattern `webhook-auth.ts` đã có sẵn trong `src/lib/brain/`, hiện đang dead code — đây là nơi hồi sinh nó hợp lý). Chọn OS-cron thay vì in-process scheduler (vd `node-cron` chạy cùng process Next.js) vì hiện tại Next.js chạy tay qua `nohup`, không có supervisor (đã ghi nhận ở Architecture Review V1) — tách khỏi vòng đời process Next.js đáng tin cậy hơn ở giai đoạn này.
- **Per-collector schedule, không phải 1 lịch chung:** mỗi Collector khai `defaultSchedule` riêng (GitHub Trending/HN/Product Hunt: 1-4 lần/ngày; RSS: theo tần suất publish thực tế của từng feed; Google Trends nếu bật: có thể theo giờ) — Scheduler đọc field này, không hardcode 1 giờ chạy chung cho tất cả.
- **Cô lập lỗi per-collector:** 1 Collector fail (đặc biệt các nguồn Tier 🟡/🔴 ở mục 4, dễ vỡ do scrape) không được chặn Collector khác — mỗi lần chạy ghi 1 `CollectorRun` riêng, `status: error` không rollback batch của Collector khác.
- **Idempotency:** lock đơn giản (1 row DB hoặc advisory lock Postgres) đảm bảo 1 Collector không có 2 `CollectorRun` chạy chồng nếu lần trước chưa xong (vd chạy chậm bất thường, cron kích hoạt lại trước khi xong).
- **Concurrency limit toàn cục:** giới hạn N Collector chạy song song (không phải cả 10 cùng lúc) — tránh dồn tải Model Router (Summarizer/Embedding) và mạng ra ngoài cùng lúc.
- **Retry/backoff riêng từng Collector** — không retry ngay lập tức (tăng khả năng bị nguồn chặn IP với các Tier 🟡/🔴), backoff theo phút/giờ, số lần retry giới hạn rồi đánh dấu `error` chờ lần chạy theo lịch tiếp theo.

---

## 9. Dedup Strategy — 3 lớp, rẻ trước đắt sau

| Lớp | Tiêu chí | Vị trí trong Pipeline | Chi phí |
|---|---|---|---|
| **1** | `(source, externalId)` trùng | Ngay sau Normalizer, trước Summarizer | Rẻ nhất — 1 index lookup, chặn re-process khi Collector chạy lại/relaunch |
| **2** | Content-hash (SHA-256 của title+body đã normalize) trùng | Cùng vị trí lớp 1 | Rẻ — bắt trường hợp cùng nội dung nhưng `externalId` khác nhau (RSS syndicate lại nguồn gốc) |
| **3** | Vector similarity (cosine) > ngưỡng (vd 0.92) | Sau Embedding, trước khi ghi Store | **HOÃN khỏi V1** (mục 6) — cần `KnowledgeRelation` + embedding thật, cả 2 chưa nằm trong Phase đầu. Đắt hơn (cần ANN index khi volume lớn, xem mục 13) — bắt "cùng câu chuyện, nguồn khác nhau, diễn đạt khác nhau" |

**Lớp 3 không xoá bản ghi mới** (khi được triển khai, sau V1) — link nó vào bản ghi đã tồn tại qua `KnowledgeRelation{relation_type:"duplicate"}`, và **feedback ngược vào Importance Scorer** (mục 10): càng nhiều nguồn độc lập cùng đưa 1 tin → tín hiệu tin đó quan trọng hơn. Dedup và Ranking không tách rời hoàn toàn — đây là 1 vòng phản hồi có chủ đích, không phải trùng hợp.

---

## 10. Ranking Strategy

Hai điểm **độc lập**, không gộp thành 1 số duy nhất (gộp sớm sẽ mất thông tin — 1 tin quan trọng nhưng chưa xác thực là trạng thái hợp lệ, cần biểu diễn được, không phải lỗi):

- **Confidence Score (0-1)** — "thông tin này đáng tin tới đâu": nguồn có uy tín theo trọng số cấu hình sẵn per-Collector, ngôn ngữ/nội dung có rõ ràng không (không phải spam/clickbait rỗng), có bị flag bởi bước Classifier không.
- **Importance Score (0-100)** — "thông tin này đáng chú ý tới đâu", tổng hợp nhiều tín hiệu:
  1. Source authority weight (cấu hình per-Collector, HN/GitHub Trending mặc định cao hơn 1 RSS blog cá nhân không rõ danh tiếng).
  2. Engagement thô từ nguồn (stars/upvotes/views), chuẩn hoá **theo log-scale** (tránh 1 bài viral 1 triệu view làm lệch toàn bộ thang điểm tuyến tính).
  3. Cross-source corroboration — số lượng liên kết `duplicate` từ Dedup lớp 3 (mục 9).
  4. Recency decay theo **hàm mũ**, không tuyến tính (tin AI News hôm qua mất giá nhanh hơn nhiều so với 1 repo GitHub Trending tuần trước).
  5. AI-assisted relevance — Model Router (`capability: "score"`) chấm "mức liên quan tới lĩnh vực Brain OS/Tú đang quan tâm", có đọc `ctx.memory`/`Profile` để **cá nhân hoá** — đây là điểm khác biệt hoá thật so với 1 aggregator tin tức chung chung.

- **Quality Score (composite, chỉ dùng nội bộ cho Prune, mục 13)** = hàm của Importance + Confidence + Recency — **không** dùng Quality Score để hiển thị/rank cho Agent (Agent luôn thấy 2 trục riêng), chỉ dùng để quyết định "cái gì nên bị dọn".

---

## 11. Search Strategy

3 lớp bổ sung nhau, không thay thế nhau:

1. **Structured filter** (category/tags/source/date-range/importance-threshold) — B-tree index thường (`@@index` đã khai ở mục 6), rẻ, dùng cho truy vấn rõ ràng ("có gì mới hôm nay", "tin AI News tuần này").
2. **Full-text search** (Postgres `tsvector`) — lớp rẻ bổ sung cho truy vấn từ khoá chính xác (tên riêng, tên sản phẩm) mà semantic search đôi khi bỏ lỡ.
3. **Semantic search** (vector similarity, pgvector) — dùng khi câu hỏi không khớp filter rõ ràng ("có xu hướng gì liên quan tới video ngắn AI không").

**Hybrid, theo thứ tự:** lọc bằng (1) trước để thu hẹp tập ứng viên (rẻ) → chỉ chạy (3) trong tập đã thu hẹp, **không bao giờ vector-scan toàn bảng** khi bảng đã lớn (liên hệ trực tiếp mục 13). (2) chạy song song, hợp kết quả (1)+(2)+(3) theo trọng số.

---

## 12. RAG Strategy (cách Agent thực sự "hỏi Knowledge trước khi search internet")

```
1. Query      — Hybrid Search (mục 11) theo nhu cầu Agent, lấy top-K (vd 10-20)
2. Rerank     — (tuỳ chọn, có thể bỏ ở Phase 1) model rẻ chấm lại top-K theo mức liên quan
                THẬT SỰ với câu hỏi cụ thể (khác Importance Score tĩnh đã lưu sẵn)
3. Assemble   — ghép SUMMARY (không phải full content, tiết kiệm token) của top-N sau rerank,
                kèm citation (source + url) — Agent trả lời PHẢI trích dẫn được nguồn
4. Sufficiency check — điểm liên quan sau rerank quá thấp HOẶC top-N đều status="stale/expired"?
      ĐỦ    → dùng Knowledge, trả lời/đề xuất — KHÔNG search internet
      KHÔNG → fallback ctx.tool("web.search") → kết quả tự động nạp lại Pipeline (mục 7)
```

**Bias theo từng Agent, không phải 1 query chung:** `ctx.knowledge.recall()` nhận `preferredSources`/`preferredCategories` làm trọng số, để mỗi Agent tự nhiên nghiêng về đúng loại Knowledge của mình mà không cần biết nhau:

| Agent | Ưu tiên category/source |
|---|---|
| Video Agent | `trends`, `tiktok-trends`, `youtube` |
| SEO Agent | `google-trends`, tags khớp keyword đang nghiên cứu |
| Business Agent | `product-hunt`, `ai-news`, `hacker-news` |
| Research Agent | không bias cố định — nhận `categories` từ chính câu hỏi user |

**Ranh giới quan trọng:** RAG ở đây phục vụ **Agent nội bộ ra quyết định**, không phải chatbot trả lời tự do — nên Sufficiency check (bước 4) nghiêm hơn 1 chatbot thông thường: thà fallback search internet hơi thừa còn hơn để Agent đề xuất chiến lược/video dựa trên Knowledge đã `stale`.

---

## 13. Rủi ro khi dữ liệu lên hàng triệu bản ghi

1. **Vector index cost** — pgvector (ivfflat/hnsw) trên hàng triệu vector cần RAM lớn, build/update index chậm dần theo insert rate. Ngưỡng cân nhắc: khi vượt ~5-10 triệu bản ghi trên 1 VPS đơn, tách vector store riêng (Qdrant/pgvector instance riêng), không share tài nguyên với Postgres chính (nơi chứa Memory/Task/Project — OLTP nhạy latency, không nên bị vector index cạnh tranh I/O).
2. **Storage tuyến tính** — `content` full-text + `raw` payload gốc phình rất nhanh (hàng triệu bài × vài KB). Khuyến nghị: **không** lưu full content trong Postgres — chỉ `summary` + `raw_ref` trỏ object storage rẻ (S3-compatible/local disk), tách hẳn khỏi OLTP DB.
3. **Dedup lớp 3 chậm dần** — so 1 bản ghi mới với hàng triệu bản ghi cũ theo cosine similarity brute-force không khả thi ở scale lớn — **bắt buộc ANN index** (approximate, không exact) ngay từ khi thiết kế, chấp nhận đánh đổi 1 phần độ chính xác dedupe lấy tốc độ.
4. **Data drift trong công thức scoring** — 1 công thức Importance viết ở Phase 1 (10 Collector) có thể lệch hẳn khi có 100 Collector (phân bổ category/volume đổi hoàn toàn). Cần review định kỳ (theo quý, không cần real-time), không cần pipeline ML phức tạp ngay — nhưng **phải** version hoá policy (mục 14) để biết bản ghi nào chấm theo công thức nào.
5. **"Đống rác" nếu chỉ dựa `expires_at` bị động** — phần lớn Knowledge cũ sẽ không bao giờ được Agent nào `recall()` lại (long-tail vô dụng) dù chưa hết hạn kỹ thuật. Cần 1 job **Prune** định kỳ (không real-time): hạ `status → archived` cho bản ghi có `quality_score` thấp + quá X ngày + 0 lượt recall được ghi nhận — chiến lược giống cache eviction nhưng theo trọng số chất lượng, không chỉ theo thời gian.
6. **Chi phí AI call tuyến tính theo volume ingest** — Summarizer/Classifier/Embedding chạy cho **mọi** `RawDocument` sau dedup 1-2. Ở hàng triệu bản ghi/năm, chi phí này đáng kể. Giảm bằng: model rẻ/nhỏ cho Summarizer/Classifier hàng loạt (ingest-time, tần suất cao), chỉ dùng model tốt cho phần nhạy cảm hơn (RAG rerank ở query-time — tần suất thấp hơn ingest rất nhiều lần).
7. **Backpressure khi đột biến volume** — breaking news/viral trend có thể khiến 1 Collector trả về gấp hàng chục-hàng trăm lần bình thường trong 1 lần chạy. Pipeline cần queue + rate limit, chấp nhận **sample** (bỏ sót có chủ đích 1 phần) thay vì để nghẽn toàn hệ thống hoặc timeout cả batch.

---

## 14. Kiến trúc mở rộng 10 năm

Nguyên tắc sống lâu hơn bất kỳ công nghệ cụ thể nào (embedding model, vector DB, nguồn dữ liệu đều **sẽ** đổi trong 10 năm — kiến trúc phải không phụ thuộc vào việc chúng không đổi):

1. **3 ranh giới ở mục 1 là bất biến** — Collector không biết Pipeline, Pipeline không biết Collector, Agent chỉ qua KnowledgeService. Giữ đúng 3 ranh giới này thì embedding model đổi từ OpenAI sang gì, vector DB đổi từ pgvector sang gì, hay thêm 1000 Collector mới — không có gì ở "phía bên kia ranh giới" phải sửa.
2. **Embedding phải version hoá, không chỉ lưu vector trần** — `embedding_model_version` đi kèm mọi bản ghi (đã đưa vào schema mục 6). 10 năm chắc chắn đổi model nhúng nhiều lần; vector sinh từ 2 model khác nhau **không so sánh trực tiếp được**. Không version hoá → tới lúc cần biết "bản ghi nào cần re-embed" sẽ không có cách xác định được, buộc re-embed toàn bộ tốn kém thay vì chọn lọc.
3. **Scoring policy cũng phải version hoá** (`scoring_policy_version`, mục 6/13) — cùng lý do như embedding: công thức Importance/Confidence sẽ đổi, cần biết bản ghi nào chấm theo phiên bản nào để tái chấm điểm hàng loạt có chủ đích, không mất dấu vết.
4. **Knowledge Store tách khỏi Postgres về mặt LOGIC ngay từ đầu** — dùng qua `KnowledgeRepository` interface trong `KnowledgeService` dù triển khai đầu tiên là Postgres+pgvector. 10 năm sau nếu buộc tách sang vector-native DB hoặc kiến trúc phân tán hơn, đó là đổi **phần triển khai**, không đổi **hợp đồng** mà Agent/Pipeline phụ thuộc vào.
5. **Multi-tenant readiness, không khoá cứng single-owner** — khác với Memory (vốn thuộc về 1 owner theo bản chất), Knowledge là tri thức thế giới, về lý thuyết dùng chung được nếu Brain OS sau này phục vụ nhiều owner/nhiều instance. Thêm `tenant_id`/`workspace_id` **nullable** ngay từ Phase 1 (rẻ) — thêm sau khi đã có hàng triệu bản ghi không có cột này thì rất đắt (mục 13 đã nêu chi phí thao tác ở scale lớn).
6. **Agent-bias không được rò vào Knowledge Store schema** — `preferredSources`/`preferredCategories` (mục 12) sống ở **tầng gọi** (Agent context lúc query), Knowledge Store luôn trả dữ liệu trung lập, không đánh giá lại "ai đang hỏi" ngay trong tầng lưu trữ. Giữ đúng Separation of Concerns này là điều kiện để Knowledge Store còn dùng được cho những Agent **chưa tồn tại hôm nay** — 1 Agent thứ 50 viết sau 5 năm vẫn gọi được `KnowledgeService.recall()` y hệt Agent đầu tiên, không cần Knowledge Store "biết trước" về nó.

---

*Tài liệu thuần thiết kế — không có code, schema thật, hay UI nào được tạo trong quá trình viết tài liệu này. Interface/Prisma trong tài liệu là minh hoạ hình dạng, không phải implementation.*
