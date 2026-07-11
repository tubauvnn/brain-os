import { prisma } from "@/lib/prisma";

// Memory service — cổng đọc/ghi DUY NHẤT của Conversation Agent vào bảng Memory
// (docs/KNOWLEDGE_ACQUISITION_SYSTEM_V1.md §0: Memory là thông tin cá nhân, có
// access_level, không tự hết hạn). Agent không tự query Prisma trực tiếp.
//
// Quyết định "khi nào nên ghi nhớ" KHÔNG nằm ở đây nữa — đó là việc của Intent
// Resolver (src/lib/agent/intent-resolver.ts, intent "remember"). Service này
// chỉ đọc/ghi khi được gọi, không tự suy luận.
//
// Phase 6B — recallMemory() giờ nhận `query` tuỳ chọn để CHỈ lấy memory liên
// quan tới câu hỏi hiện tại (không dump cả bảng vào prompt) — không có
// embedding/vector search trong stack này nên dùng khớp từ khoá thô (đủ dùng
// cho quy mô cá nhân hiện tại, KHÔNG bịa ra 1 hệ thống retrieval mới). Không
// truyền query → giữ nguyên hành vi cũ (pinned + gần nhất).

const RECALL_LIMIT = 5;
const RELEVANCE_CANDIDATE_LIMIT = 50;
const MIN_TOKEN_LEN = 3;

export type MemoryItem = { id: string; title: string; content: string };

function stripDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return Array.from(new Set(stripDiacritics(text).match(/[a-z0-9]+/g)?.filter((t) => t.length >= MIN_TOKEN_LEN) ?? []));
}

function scoreOverlap(tokens: string[], haystack: string): number {
  const normalized = stripDiacritics(haystack);
  return tokens.reduce((score, t) => (normalized.includes(t) ? score + 1 : score), 0);
}

async function recallRelevant(query: string): Promise<MemoryItem[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const candidates = await prisma.memory.findMany({
    where: { access_level: { lte: 1 } },
    orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
    take: RELEVANCE_CANDIDATE_LIMIT,
    select: { id: true, title: true, content: true, tags: true },
  });

  return candidates
    .map((m) => ({ m, score: scoreOverlap(tokens, `${m.title} ${m.content} ${m.tags.join(" ")}`) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RECALL_LIMIT)
    .map((x) => ({ id: x.m.id, title: x.m.title, content: x.m.content }));
}

// query rỗng/không truyền → hành vi CŨ (pinned + gần nhất, không lọc liên
// quan) — dùng cho các nơi cần 1 lát cắt chung (vd chưa có câu hỏi cụ thể).
// query có nội dung → CHỈ trả memory thật sự khớp từ khoá, có thể trả rỗng
// (đúng — "không tìm thấy memory liên quan" khác "không có memory nào").
export async function recallMemory(query?: string): Promise<{ items: MemoryItem[] }> {
  if (query?.trim()) {
    return { items: await recallRelevant(query) };
  }
  const items = await prisma.memory.findMany({
    where: { access_level: { lte: 1 } },
    orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
    take: RECALL_LIMIT,
    select: { id: true, title: true, content: true },
  });
  return { items };
}

export async function getMostRecentMemory(): Promise<MemoryItem | null> {
  const item = await prisma.memory.findFirst({
    where: { access_level: { lte: 1 } },
    orderBy: { created_at: "desc" },
    select: { id: true, title: true, content: true },
  });
  return item;
}

// Chống ghi trùng lặp nguyên văn (cùng nội dung, không phân biệt hoa/thường/
// khoảng trắng thừa) — "Do not save: repeated facts" (Phase 6B yêu cầu 3).
async function findDuplicate(content: string): Promise<MemoryItem | null> {
  const normalized = content.trim().toLowerCase();
  const recent = await prisma.memory.findMany({
    where: { access_level: { lte: 1 } },
    orderBy: { created_at: "desc" },
    take: 20,
    select: { id: true, title: true, content: true },
  });
  return recent.find((m) => m.content.trim().toLowerCase() === normalized) ?? null;
}

export type WriteMemoryOptions = { category?: string; tags?: string[] };

// Trả về { item, deduped: true } nếu nội dung y hệt đã tồn tại (không tạo
// dòng mới) — caller (conversation-agent.ts) tự quyết định câu xác nhận phù hợp.
export async function writeMemory(
  content: string,
  source: string,
  options: WriteMemoryOptions = {}
): Promise<{ item: MemoryItem; deduped: boolean }> {
  const existing = await findDuplicate(content);
  if (existing) return { item: existing, deduped: true };

  const item = await prisma.memory.create({
    data: {
      title: content.slice(0, 60),
      content,
      category: options.category ?? "conversation",
      tags: options.tags ?? [],
      access_level: 1,
      source,
    },
    select: { id: true, title: true, content: true },
  });
  return { item, deduped: false };
}

export async function deleteMemory(id: string): Promise<MemoryItem | null> {
  try {
    return await prisma.memory.delete({
      where: { id },
      select: { id: true, title: true, content: true },
    });
  } catch {
    return null;
  }
}

// ─── Ghi nhớ AN TOÀN — dùng chung bởi Conversation Agent (intent "remember",
// src/lib/agent/conversation-agent.ts) VÀ /api/robot/memory/remember, để 2
// nơi không lặp lại cùng 1 chính sách (Phase 6B mục 3: "Do not save: secrets
// or API keys" / phân loại preference-vs-fact). Đây LÀ chính sách ghi nhớ,
// đặt trong service này (không phải Agent/route) đúng nguyên tắc "quyết định
// khi nào ghi KHÔNG nằm trong service" chỉ áp dụng cho "khi nào" (Intent
// Resolver quyết định) — còn "ghi cái gì có an toàn không" là quy tắc DỮ LIỆU
// thuộc về chính Memory service.

// Phase 6C regression check phát hiện 2 lỗi thật ở đây (không phải diễn giải
// quá hẹp — lỗi thật): `[:là]` là CHARACTER CLASS (khớp 1 ký tự bất kỳ trong
// ':'/'l'/'à', không phải chuỗi "là"), và ban đầu còn đòi hỏi từ khoá đứng
// NGAY TRƯỚC ":"/"="/"là" — câu tự nhiên tiếng Việt hay chen thêm từ ở giữa
// ("password CỦA TAO là...") nên không khớp. Sửa: chỉ cần từ khoá nhạy cảm
// xuất hiện BẤT KỲ ĐÂU trong câu là đủ để từ chối lưu — thà chặn nhầm 1 câu
// vô hại còn hơn để lọt 1 secret thật (đây chỉ là remember qua chat, người
// dùng luôn có thể diễn đạt lại nếu bị chặn nhầm).
// "token" giữ riêng (không chỉ "access token") — token nói chung hầu như
// luôn là thông tin xác thực trong ngữ cảnh này. KHÔNG thêm "bí mật" (nghĩa
// chung "secret" trong tiếng Việt) — quá rộng, sẽ chặn nhầm cả bí mật cá
// nhân không liên quan bảo mật (vd "giữ bí mật giúp tao chuyện sinh nhật").
const SECRET_KEYWORDS = ["mật khẩu", "password", "api key", "api-key", "apikey", "access token", "secret key", "token"];
const SECRET_PATTERNS = [
  /\bsk-[a-zA-Z0-9]{10,}/,
  /\bAKIA[0-9A-Z]{12,}/,
  /\bBearer\s+[a-zA-Z0-9._-]{10,}/i,
  ...SECRET_KEYWORDS.map((w) => new RegExp(w.replace(/ /g, "[ _-]?"), "i")),
];

export function looksLikeSecret(text: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(text));
}

const PREFERENCE_WORDS = ["thích", "muốn", "ưu tiên", "ghét", "prefer", "want"];

export function detectMemoryCategory(text: string): string {
  const lower = text.toLowerCase();
  return PREFERENCE_WORDS.some((w) => lower.includes(w)) ? "preference" : "fact";
}

export type RememberOutcome =
  | { status: "written"; item: MemoryItem; category: string }
  | { status: "duplicate"; item: MemoryItem; category: string }
  | { status: "refused" };

export async function rememberIfSafe(content: string, source: string): Promise<RememberOutcome> {
  const trimmed = content.trim();
  if (looksLikeSecret(trimmed)) return { status: "refused" };

  const category = detectMemoryCategory(trimmed);
  const { item, deduped } = await writeMemory(trimmed, source, { category });
  return { status: deduped ? "duplicate" : "written", item, category };
}
