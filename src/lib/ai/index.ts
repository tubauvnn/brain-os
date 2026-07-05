import { buildBrainContext } from "./context";
import { templateProvider } from "./provider";
import { geminiProvider, GeminiRateLimitError } from "./providers/gemini";
import type { BuildBrainContextParams, ResponseProvider } from "./types";

export type GenerateReplyResult = {
  text: string;
  provider: ResponseProvider;
  context_used: boolean;
  gemini_error: string | null;
};

export async function generateRobotReply(
  userText: string,
  params: BuildBrainContextParams = {}
): Promise<GenerateReplyResult> {
  const context = await buildBrainContext(params);

  if (process.env.GEMINI_API_KEY) {
    try {
      const text = await geminiProvider.generateReply(userText, context);
      return { text, provider: "gemini", context_used: true, gemini_error: null };
    } catch (e) {
      // Gemini lỗi/timeout/429 — không để chat gãy, luôn fallback về câu trả lời mẫu.
      const isRateLimit = e instanceof GeminiRateLimitError;
      const message = e instanceof Error ? e.message : "Lỗi không xác định khi gọi Gemini";
      const text = await templateProvider.generateReply(userText, context);
      return {
        text,
        provider: isRateLimit ? "fallback_429" : "fallback",
        context_used: true,
        gemini_error: message,
      };
    }
  }

  const text = await templateProvider.generateReply(userText, context);
  return { text, provider: "fallback", context_used: true, gemini_error: null };
}
