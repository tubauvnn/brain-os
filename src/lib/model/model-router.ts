import type { ModelProvider } from "./types";
import { openAiProvider } from "./providers/openai";

// Model Router — cùng pattern với Voice Router (src/lib/voice/voice-router.ts).
// Điểm DUY NHẤT biết danh sách Model Provider nào tồn tại. Thêm provider thứ 2
// (Claude/Gemini...): 1 file mới trong providers/ + 1 dòng vào map dưới đây.
const MODEL_PROVIDERS: Record<string, ModelProvider> = {
  openai: openAiProvider,
};

export const DEFAULT_MODEL_PROVIDER = "openai";

export const ModelRouter = {
  resolve(name: string = DEFAULT_MODEL_PROVIDER): ModelProvider | null {
    return MODEL_PROVIDERS[name] ?? null;
  },

  listProviders(): string[] {
    return Object.keys(MODEL_PROVIDERS);
  },
};
