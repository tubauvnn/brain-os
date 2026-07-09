// Knowledge service — cổng đọc DUY NHẤT của Conversation Agent vào tri thức
// "thế giới" (docs/KNOWLEDGE_ACQUISITION_SYSTEM_V1.md §0, khác Memory — không
// thuộc sở hữu ai, thu thập bởi Collector). Collector/Scheduler/DB riêng của
// Knowledge System CHƯA được xây (ngoài phạm vi vertical slice này). Seam này
// tồn tại để Conversation Agent gọi đúng qua contract KnowledgeService.recall()
// ngay từ đầu — trả rỗng là hành vi ĐÚNG cho tới khi có Collector thật, không
// bịa dữ liệu để lấp chỗ trống.

export type KnowledgeItem = { summary: string };

export async function recallKnowledge(): Promise<{ items: KnowledgeItem[]; note: string }> {
  return { items: [], note: "knowledge-system-not-yet-implemented" };
}
