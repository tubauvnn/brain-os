import type { ImageGeneratorProvider } from "./types";
import { openAiImageProvider } from "./providers/openai-image";

// Image Router — cùng pattern ModelRouter/VoiceRouter (src/lib/model/,
// src/lib/voice/). Điểm DUY NHẤT biết danh sách Image Generator Provider nào
// tồn tại. Phase 4: chỉ 1 provider thật (OpenAI), KHÔNG có provider giả —
// thêm provider thứ 2 (Stability/Midjourney-proxy/...) sau này chỉ cần 1 file
// trong providers/ + 1 dòng vào map dưới đây.
const IMAGE_PROVIDERS: Record<string, ImageGeneratorProvider> = {
  "openai-image": openAiImageProvider,
};

export const DEFAULT_IMAGE_PROVIDER = "openai-image";

export const ImageRouter = {
  resolve(name: string = DEFAULT_IMAGE_PROVIDER): ImageGeneratorProvider | null {
    return IMAGE_PROVIDERS[name] ?? null;
  },
  listProviders(): string[] {
    return Object.keys(IMAGE_PROVIDERS);
  },
};
