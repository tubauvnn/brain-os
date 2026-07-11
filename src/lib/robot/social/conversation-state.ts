import type { PresenceFrame } from "../presence-types";
import { embeddingDistance } from "../visual-embedding";
import type { VisitorMemory } from "./types";

// ConversationMemory — Phase 6F mục 4. Thuần logic, không đụng DOM. Mở rộng
// "khách vãng lai" của Phase 6E (embedding + 30 phút) thêm vài quan sát thô
// (chiều cao ước lượng/màu áo/vị trí/chủ đề vừa nói) — TẤT CẢ chỉ để nói
// bằng giọng phỏng đoán ("hình như"), KHÔNG BAO GIỜ khẳng định chắc chắn.
// Trong bộ nhớ (không DB, không file) — mất hết khi tải lại trang, đúng tinh
// thần "temporary" của cả 2 phase.

const VISITOR_MEMORY_MS = 30 * 60_000; // "Remember for about 30 minutes" (mục 4)
const EMBEDDING_MATCH_THRESHOLD = 0.06;
const HEIGHT_TALL_SIZE = 0.5;
const HEIGHT_SHORT_SIZE = 0.22;

// "estimated height" — CHỈ suy đoán thô từ kích thước mặt trong khung hình,
// bị nhiễu nặng bởi khoảng cách đứng tới camera, KHÔNG phải đo chiều cao
// thật (không có cảm biến khoảng cách). Cố tình chỉ 3 mức thô, không số cm.
function estimateHeight(size: number): VisitorMemory["estimatedHeight"] {
  if (size >= HEIGHT_TALL_SIZE) return "cao";
  if (size <= HEIGHT_SHORT_SIZE) return "thấp";
  return "trung bình";
}

// "location" — không có GPS/định vị trong nhà, chỉ vị trí THEO KHUNG HÌNH
// camera (trái/giữa/phải camera đang nhìn thấy), không phải toạ độ phòng.
function estimateLocation(x: number): VisitorMemory["location"] {
  if (x <= -0.3) return "bên trái";
  if (x >= 0.3) return "bên phải";
  return "chính giữa";
}

export class ConversationMemory {
  private visitors: VisitorMemory[] = [];
  private counter = 0;

  private prune(now: number): void {
    this.visitors = this.visitors.filter((v) => now - v.lastInteractionAt <= VISITOR_MEMORY_MS);
  }

  private findMatch(embedding: number[], now: number): { visitor: VisitorMemory; distance: number } | null {
    let best: VisitorMemory | null = null;
    let bestDist = Infinity;
    for (const v of this.visitors) {
      if (!v.embedding || now - v.lastInteractionAt > VISITOR_MEMORY_MS) continue;
      const d = embeddingDistance(embedding, v.embedding);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best && bestDist <= EMBEDDING_MATCH_THRESHOLD ? { visitor: best, distance: bestDist } : null;
  }

  /** Ghi nhận 1 lần quan sát — khớp khách cũ (trong 30 phút) hoặc tạo mới, cập nhật quan sát mới nhất (ánh sáng/góc đứng có thể đổi giữa các lần). */
  observe(frame: PresenceFrame, now: number): { visitor: VisitorMemory; returning: boolean } {
    this.prune(now);
    const match = frame.embedding ? this.findMatch(frame.embedding, now) : null;

    if (match) {
      const v = match.visitor;
      v.lastInteractionAt = now;
      v.embedding = frame.embedding;
      v.confidence = Math.max(0, 1 - match.distance / EMBEDDING_MATCH_THRESHOLD);
      if (frame.size > 0) v.estimatedHeight = estimateHeight(frame.size);
      if (frame.shirtColor) v.shirtColorName = frame.shirtColor.name;
      v.location = estimateLocation(frame.x);
      return { visitor: v, returning: true };
    }

    this.counter += 1;
    const created: VisitorMemory = {
      id: `mem-${this.counter}`,
      embedding: frame.embedding,
      estimatedHeight: frame.size > 0 ? estimateHeight(frame.size) : null,
      shirtColorName: frame.shirtColor?.name ?? null,
      location: estimateLocation(frame.x),
      lastTopic: null,
      firstSeenAt: now,
      lastInteractionAt: now,
      confidence: frame.embedding ? 1 : 0,
    };
    this.visitors.push(created);
    return { visitor: created, returning: false };
  }

  setTopic(id: string, topic: string): void {
    const v = this.visitors.find((entry) => entry.id === id);
    if (v) v.lastTopic = topic.slice(0, 80);
  }

  get(id: string): VisitorMemory | null {
    return this.visitors.find((v) => v.id === id) ?? null;
  }

  count(now: number): number {
    return this.visitors.filter((v) => now - v.lastInteractionAt <= VISITOR_MEMORY_MS).length;
  }

  /** Câu nói khi gặp lại — luôn phỏng đoán, KHÔNG BAO GIỜ khẳng định chắc chắn (mục 4, đúng ví dụ trong yêu cầu). */
  describeReturning(visitor: VisitorMemory): string {
    const hedge = visitor.confidence >= 0.7 ? "Hình như" : "Có khi";
    if (visitor.lastTopic) return `${hedge} mình vừa nói chuyện với bạn về ${visitor.lastTopic} lúc nãy.`;
    return `${hedge} mình vừa gặp bạn lúc nãy.`;
  }

  /** Chỉ dùng cho debug UI ("Nâng cao"), không phải câu robot nói — vẫn giữ giọng phỏng đoán. */
  describeObservation(visitor: VisitorMemory): string {
    const parts: string[] = [];
    if (visitor.estimatedHeight) parts.push(`chiều cao có vẻ ${visitor.estimatedHeight}`);
    if (visitor.shirtColorName) parts.push(`áo màu ${visitor.shirtColorName} (ước lượng)`);
    if (visitor.location) parts.push(`đứng ${visitor.location} camera`);
    return parts.length > 0 ? parts.join(", ") : "chưa quan sát được gì rõ";
  }
}
