import { prisma } from "@/lib/prisma";

// Memory service — cổng đọc/ghi DUY NHẤT của Conversation Agent vào bảng Memory
// (docs/KNOWLEDGE_ACQUISITION_SYSTEM_V1.md §0: Memory là thông tin cá nhân, có
// access_level, không tự hết hạn). Agent không tự query Prisma trực tiếp.
//
// Quyết định "khi nào nên ghi nhớ" KHÔNG nằm ở đây nữa — đó là việc của Intent
// Resolver (src/lib/agent/intent-resolver.ts, intent "remember"). Service này
// chỉ đọc/ghi khi được gọi, không tự suy luận.

const RECALL_LIMIT = 5;

export type MemoryItem = { title: string; content: string };

export async function recallMemory(): Promise<{ items: MemoryItem[] }> {
  const items = await prisma.memory.findMany({
    where: { access_level: { lte: 1 } },
    orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
    take: RECALL_LIMIT,
    select: { title: true, content: true },
  });
  return { items };
}

export async function writeMemory(content: string, source: string): Promise<MemoryItem> {
  return prisma.memory.create({
    data: {
      title: content.slice(0, 60),
      content,
      category: "conversation",
      access_level: 1,
      source,
    },
    select: { title: true, content: true },
  });
}
