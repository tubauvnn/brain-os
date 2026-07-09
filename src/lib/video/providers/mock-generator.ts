import type { VideoGenerationInput, VideoGenerationResult, VideoGeneratorProvider } from "../types";

// Mock Generator — KHÔNG gọi Veo/Runway/Kling/OpenAI, KHÔNG render video thật.
// Chỉ xác nhận plan (title/scenes/imagePrompt) đã hợp lệ và đánh dấu status
// "planned". Provider thật sau này (VeoProvider/KlingProvider/...) implement
// cùng interface VideoGeneratorProvider, nhận đúng input này, gọi API thật để
// render, trả videoUrl + status "completed" — không sửa Video Agent.

async function generate(input: VideoGenerationInput): Promise<VideoGenerationResult> {
  if (!input.scenes.length) {
    return { status: "failed", error: "no_scenes" };
  }
  return { status: "planned" };
}

export const mockVideoGeneratorProvider: VideoGeneratorProvider = { name: "mock-generator", generate };
