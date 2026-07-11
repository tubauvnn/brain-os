import type { VisionProvider } from "./types";
import { openAiVisionProvider } from "./providers/openai-vision";

// Vision Router — điểm DUY NHẤT biết danh sách Vision Provider nào tồn tại,
// cùng pattern src/lib/voice/voice-router.ts / src/lib/model/model-router.ts.
const VISION_PROVIDERS: Record<string, VisionProvider> = {
  "openai-vision": openAiVisionProvider,
};

export const DEFAULT_VISION_PROVIDER = "openai-vision";

export const VisionRouter = {
  resolve(name: string = DEFAULT_VISION_PROVIDER): VisionProvider | null {
    return VISION_PROVIDERS[name] ?? null;
  },
  listProviders(): string[] {
    return Object.keys(VISION_PROVIDERS);
  },
};
