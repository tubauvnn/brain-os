// Image Generator Provider abstraction — cùng pattern
// VideoGeneratorProvider/VoiceProvider/ModelProvider (src/lib/video/types.ts,
// src/lib/voice/types.ts, src/lib/model/types.ts): interface trước, provider
// cụ thể sau. Image Agent (Creative Studio) KHÔNG bao giờ gọi thẳng fetch()
// tới OpenAI — chỉ qua interface này. Phase 4 yêu cầu "no mock provider" —
// chỉ có 1 provider thật đăng ký (openai-image.ts), KHÔNG có provider giả nào
// trong providers/.

export type ImageGenerationInput = {
  prompt: string;
  negativePrompts?: string[];
  size?: "1024x1024" | "1024x1536" | "1536x1024";
};

export type ImageGenerationResult = {
  status: "success" | "error";
  imageBuffer?: Buffer;
  mimeType?: string;
  costUsd?: number;
  error?: string;
};

export interface ImageGeneratorProvider {
  readonly name: string;
  generate(input: ImageGenerationInput): Promise<ImageGenerationResult>;
}
