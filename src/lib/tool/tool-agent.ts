import { evaluateExpression } from "./calculator";
import type { ToolResult } from "./types";

// Generic Tool Agent — deterministic, KHÔNG gọi API ngoài. Phase 3 (Agent
// Runtime) chỉ cần chứng minh contract TaskAgent tổng quát hoá được ra ngoài
// agent sáng tạo — 2 tool tối giản: calculator (biểu thức số học an toàn) và
// datetime (giờ hệ thống hiện tại).

const CALC_TRIGGERS = ["tính giúp", "tính toán", "calculate"];
const TIME_TRIGGERS = ["mấy giờ", "bây giờ là mấy giờ", "what time is it", "current time"];

function extractAfter(text: string, triggers: string[]): string | null {
  const lower = text.toLowerCase();
  for (const t of triggers) {
    const idx = lower.indexOf(t);
    if (idx !== -1) return text.slice(idx + t.length).trim().replace(/^[:\-–]\s*/, "");
  }
  return null;
}

export async function runTool(input: string): Promise<ToolResult> {
  const calcExpr = extractAfter(input, CALC_TRIGGERS);
  if (calcExpr !== null) {
    try {
      return { tool: "calculator", success: true, result: String(evaluateExpression(calcExpr)) };
    } catch (e) {
      return { tool: "calculator", success: false, error: e instanceof Error ? e.message : "Không tính được." };
    }
  }

  if (TIME_TRIGGERS.some((t) => input.toLowerCase().includes(t))) {
    return { tool: "datetime", success: true, result: new Date().toISOString() };
  }

  // Fallback: input chỉ toàn ký tự số học (không có trigger rõ ràng) — vẫn tính.
  if (/^[\d+\-*/().\s]+$/.test(input.trim()) && /\d/.test(input)) {
    try {
      return { tool: "calculator", success: true, result: String(evaluateExpression(input.trim())) };
    } catch (e) {
      return { tool: "unknown", success: false, error: e instanceof Error ? e.message : "Không tính được." };
    }
  }

  return { tool: "unknown", success: false, error: "Không nhận diện được yêu cầu công cụ." };
}
