import type { AiProvider, BrainContext } from "../types";
import { contextToPromptText } from "../context";

const DEFAULT_MODEL = "gemini-2.0-flash";
const COOLDOWN_MS = 60_000;

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
};

// Ném riêng khi Gemini trả 429 để index.ts phân biệt được với lỗi khác
// (dùng để gắn provider = "fallback_429" thay vì "fallback" chung chung).
export class GeminiRateLimitError extends Error {
  constructor(message = "Gemini đang bị rate-limit (429)") {
    super(message);
    this.name = "GeminiRateLimitError";
  }
}

// Cooldown toàn cục trong process — sau khi dính 429, tạm ngưng gọi Gemini 60s
// để tránh dội thêm request vào lúc đang bị giới hạn.
let cooldownUntil = 0;

export function geminiCooldownRemainingMs(): number {
  return Math.max(0, cooldownUntil - Date.now());
}

export function isGeminiInCooldown(): boolean {
  return Date.now() < cooldownUntil;
}

function triggerCooldown() {
  cooldownUntil = Date.now() + COOLDOWN_MS;
}

const SYSTEM_RULES = [
  "Bạn là ChinChin, robot/trợ lý của hệ thống Brain OS.",
  "Luôn trả lời bằng tiếng Việt, ngắn gọn và tự nhiên như đang trò chuyện.",
  "Chỉ dùng thông tin có trong bối cảnh (context) được cung cấp bên dưới — không bịa thêm dữ liệu không có trong đó.",
  "Nếu không chắc chắn về điều gì, hãy nói rõ là bạn không chắc thay vì đoán mò.",
  "Mục 'Trí nhớ riêng tư' chỉ xuất hiện khi hệ thống xác định người hỏi đủ quyền truy cập — nếu mục đó không có trong bối cảnh, nghĩa là không đủ quyền, tuyệt đối không suy đoán hay bịa nội dung riêng tư.",
].join(" ");

export async function askGemini({
  message,
  context,
}: {
  message: string;
  context: BrainContext;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình");

  if (isGeminiInCooldown()) {
    const seconds = Math.ceil(geminiCooldownRemainingMs() / 1000);
    throw new GeminiRateLimitError(`Gemini đang cooldown sau lỗi 429, còn ${seconds}s`);
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const contextText = contextToPromptText(context);
  const prompt = [
    SYSTEM_RULES,
    contextText ? `Bối cảnh hiện tại:\n${contextText}` : "Bối cảnh hiện tại: (không có dữ liệu liên quan)",
    `Người dùng nói: "${message}"`,
  ].join("\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: controller.signal,
      }
    );

    if (res.status === 429) {
      triggerCooldown();
      throw new GeminiRateLimitError("Gemini trả về 429 (quá giới hạn request)");
    }

    if (!res.ok) {
      throw new Error(`Gemini API lỗi: ${res.status}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini không trả về nội dung");
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

export const geminiProvider: AiProvider = {
  name: "gemini",
  generateReply(userText, context) {
    return askGemini({ message: userText, context });
  },
};
