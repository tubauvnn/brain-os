import type { RobotEmotion, RobotState } from "@/components/robot/ExpressiveRobotFace";

// Suy luận state/emotion từ nội dung câu trả lời text khi API không trả field
// face/action riêng — dùng làm lớp "biểu cảm mềm" phủ lên trên face của API
// (xem PHẦN F trong yêu cầu gốc). Thứ tự rule có ý nghĩa: lỗi/chưa hiểu được
// ưu tiên trước "happy" mặc định.
const ERROR_PATTERNS = ["lỗi", "unauthorized", "error"];
const CONFUSED_PATTERNS = ["chưa hiểu", "không hiểu", "nói lại"];
const THINKING_PATTERNS = ["đang nghĩ", "phân tích", "kế hoạch"];
const SLEEP_PATTERNS = ["ngủ"];
const HAPPY_PATTERNS = ["xin chào", "rất vui", "tuyệt", "ok", "được"];

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p));
}

export function mapTextToEmotion(text: string): { state: RobotState; emotion: RobotEmotion } {
  const normalized = (text || "").toLowerCase();

  if (includesAny(normalized, ERROR_PATTERNS)) return { state: "error", emotion: "confused" };
  if (includesAny(normalized, CONFUSED_PATTERNS)) return { state: "confused", emotion: "confused" };
  if (includesAny(normalized, THINKING_PATTERNS)) return { state: "thinking", emotion: "curious" };
  if (includesAny(normalized, SLEEP_PATTERNS)) return { state: "sleeping", emotion: "neutral" };
  if (includesAny(normalized, HAPPY_PATTERNS)) return { state: "happy", emotion: "joy" };
  if (normalized.trim().length > 0) return { state: "happy", emotion: "joy" };
  return { state: "idle", emotion: "neutral" };
}
