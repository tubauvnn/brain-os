import type { AiProvider } from "./types";

// Trả lời mẫu (fallback) — không có AI thật, dùng khi chưa cấu hình GEMINI_API_KEY
// hoặc khi gọi Gemini bị lỗi.
export const templateProvider: AiProvider = {
  name: "fallback",
  async generateReply(userText: string): Promise<string> {
    const lower = userText.toLowerCase();
    // Dùng \b (word boundary) để tránh khớp nhầm vào chuỗi con trong từ tiếng Việt
    // (vd: "hi" khớp nhầm vào "nghiêu" nếu dùng includes() thuần).
    const hasWord = (word: string) => new RegExp(`\\b${word}\\b`, "i").test(lower);

    if (hasWord("pin") || hasWord("battery")) {
      return "Bạn xem panel trạng thái phía trên để biết mức pin hiện tại của tôi nhé.";
    }
    if (lower.includes("cảm ơn") || hasWord("thanks") || hasWord("thank")) {
      return "Không có gì, rất vui được giúp bạn!";
    }
    if (lower.includes("tên") || lower.includes("bạn là ai")) {
      return "Tôi là ChinChin — robot simulator của Brain OS.";
    }
    if (lower.includes("chào") || hasWord("hello") || hasWord("hi")) {
      return "Xin chào! Tôi là ChinChin, trợ lý robot của Brain OS. Tôi có thể giúp gì cho bạn?";
    }
    return `Tôi đã nhận được: "${userText}". Hiện tại tôi chưa có AI thật (chưa cấu hình GEMINI_API_KEY), đây chỉ là câu trả lời mẫu.`;
  },
};
