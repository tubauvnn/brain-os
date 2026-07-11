// Capability Planner — Phase 6D. Quyết định (deterministic, KHÔNG gọi model
// — cùng phong cách src/lib/agent/intent-resolver.ts, chỉ so khớp cụm từ)
// những capability nào THẬT SỰ cần cho 1 câu chat, để RobotAgent
// (robot-agent.ts) chạy đúng những cái đó, KHÔNG BAO GIỜ toàn bộ.
//
// QUAN TRỌNG — đây KHÔNG phải Intent Resolver thứ 2: Intent Resolver
// (src/lib/agent/intent-resolver.ts) vẫn là nơi DUY NHẤT phân loại intent
// (remember/robot_command/tool_request/...). Planner này CHỈ chạy cho intent
// "chat" (nhánh không khớp intent xác định nào khác) — vì "chat" là nơi câu
// hỏi tự do, có thể cần nhiều nguồn ngữ cảnh khác nhau (ảnh/memory/dự án/
// kiến thức/thiết bị/tool), khác các intent khác vốn đã biết chính xác cần
// làm gì.
//
// Thiết kế: nếu câu khớp ÍT NHẤT 1 cụm kích hoạt rõ ràng (vision/device/
// tool/search, hoặc memory/project/knowledge có cụm riêng) → dùng ĐÚNG tập
// đó, không tự thêm gì khác (khớp đúng ý người dùng, tránh gọi thừa —
// "avoid duplicate provider calls"/"cancel unnecessary capability
// execution", mục 10). Nếu KHÔNG khớp cụm nào → rơi về baseline
// memory+project+knowledge (giữ nguyên hành vi handleChat() đã có từ Phase
// 6B, không hồi quy — câu hỏi chung chung như "Mày là ai?" vẫn được chấm
// điểm liên quan qua Memory/Project như trước).

export type Capability = "memory" | "vision" | "project" | "knowledge" | "search" | "device" | "tool";

export type CapabilityPlan = {
  capabilities: Capability[];
  // reasoning — CHỈ dùng nội bộ (log/debug), KHÔNG BAO GIỜ trả ra client
  // (mục 3 "Internal only. Never expose reasoning.", mục 7 "Never expose:
  // ... planner").
  reasoning: string;
  // Chưa có cơ chế đo cost/latency thật cho từng capability — để null thay
  // vì bịa số (đúng tinh thần "no fabrication" xuyên suốt dự án).
  estimatedCost: number | null;
  estimatedLatency: number | null;
};

const MEMORY_PHRASES = ["hôm trước", "hôm qua", "lần trước", "trước đây", "đã nói", "nhớ không"];
const PROJECT_PHRASES = ["tới đâu", "đến đâu", "tiến độ", "dự án"];
const KNOWLEDGE_PHRASES = ["hướng dẫn", "cách sửa", "sửa thế nào", "là gì", "có phải", "lỗi gì", "giải thích"];
const VISION_PHRASES = [
  "nhìn",
  "trong ảnh",
  "trong hình",
  "camera",
  "chụp",
  "so với hôm qua",
  "so với ảnh trước",
  "đây có phải",
  "quan sát",
  "soi ảnh",
];
// "mở camera"/"mở vps" — cụm THIẾT BỊ rộng hơn robot_command hiện có (không
// đòi hỏi từ "robot" + động từ di chuyển, xem ROBOT_ACTION_WORDS trong
// intent-resolver.ts) — bắt các câu như "Chuối mở camera..."/"Mở VPS" vốn
// không khớp robot_command nên rơi xuống "chat".
const DEVICE_PHRASES = ["mở camera", "bật camera", "tắt camera", "mở vps", "mở cửa", "bật đèn", "tắt đèn"];
// Đồng bộ TOOL_REQUEST_PHRASES trong intent-resolver.ts — câu khớp các cụm
// này thường đã được intent-resolver bắt ở bước "tool_request" trước khi
// tới "chat" rồi, giữ lại đây chỉ để phòng câu diễn đạt khác lọt qua.
const TOOL_PHRASES = ["tính giúp", "tính toán", "mấy giờ", "bây giờ là mấy giờ"];
const SEARCH_PHRASES = ["tìm kiếm", "tra cứu", "search giúp", "tìm giúp trên mạng"];

function matchesAny(text: string, phrases: string[]): boolean {
  return phrases.some((p) => text.includes(p));
}

export type PlanContext = {
  /** Có ảnh mới upload trong lượt này HOẶC ảnh tạm gần đây trong session hay không. */
  hasImage: boolean;
};

export function planCapabilities(message: string, ctx: PlanContext): CapabilityPlan {
  const text = message.trim().toLowerCase();
  const capabilities: Capability[] = [];
  const reasons: string[] = [];

  if (ctx.hasImage || matchesAny(text, VISION_PHRASES)) {
    capabilities.push("vision");
    reasons.push(ctx.hasImage ? "có ảnh trong phiên" : "câu hỏi nhắc tới hình ảnh/camera");
  }
  if (matchesAny(text, MEMORY_PHRASES)) {
    capabilities.push("memory");
    reasons.push("câu hỏi nhắc tới thời điểm trước đây");
  }
  if (matchesAny(text, PROJECT_PHRASES)) {
    capabilities.push("project");
    reasons.push("câu hỏi về tiến độ/dự án");
  }
  if (matchesAny(text, KNOWLEDGE_PHRASES)) {
    capabilities.push("knowledge");
    reasons.push("câu hỏi cần giải thích/hướng dẫn");
  }
  if (matchesAny(text, DEVICE_PHRASES)) {
    capabilities.push("device");
    reasons.push("câu hỏi yêu cầu điều khiển thiết bị");
  }
  if (matchesAny(text, TOOL_PHRASES)) {
    capabilities.push("tool");
    reasons.push("câu hỏi cần công cụ tính toán/thời gian");
  }
  if (matchesAny(text, SEARCH_PHRASES)) {
    capabilities.push("search");
    reasons.push("câu hỏi cần tra cứu ngoài");
  }

  if (capabilities.length === 0) {
    // Không khớp cụm kích hoạt rõ ràng nào — dùng baseline an toàn, ĐÚNG
    // hành vi handleChat() đã có từ Phase 6B (Memory + Project + Knowledge),
    // không hồi quy chat thông thường.
    return {
      capabilities: ["memory", "project", "knowledge"],
      reasoning: "không khớp cụm kích hoạt cụ thể — dùng baseline memory/project/knowledge",
      estimatedCost: null,
      estimatedLatency: null,
    };
  }

  return {
    capabilities,
    reasoning: reasons.join("; "),
    estimatedCost: null,
    estimatedLatency: null,
  };
}
