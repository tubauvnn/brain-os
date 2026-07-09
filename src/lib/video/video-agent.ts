import { randomUUID } from "crypto";
import { log } from "@/lib/logger";
import { planStory, planScenes, generatePrompts } from "./planner";
import type { VideoGeneratorProvider, VideoPlan, VideoRequest } from "./types";

// Video Agent — RUNTIME ORCHESTRATION cho pipeline:
//
//     Conversation Agent → Intent Resolver → Video Agent →
//     Story Planner → Scene Planner → Prompt Generator → Provider → Output JSON
//
// QUAN TRỌNG — Inversion of Control (cùng nguyên tắc Device Manager,
// src/lib/device/device-manager.ts): file này CHỈ import types.ts (contract)
// + planner.ts (logic thuần, không phải provider). KHÔNG import bất kỳ
// Video Generator Provider cụ thể nào (Mock/Veo/OpenAI/Kling). Provider nào
// tồn tại + đăng ký ra sao là việc của providers/registry.ts (composition
// root) — thêm provider mới KHÔNG được sửa file này.

const providers = new Map<string, VideoGeneratorProvider>();

function register(provider: VideoGeneratorProvider): void {
  providers.set(provider.name, provider);
}

function resolve(name: string): VideoGeneratorProvider | null {
  return providers.get(name) ?? null;
}

const DEFAULT_PROVIDER = "mock-generator";

async function generate(request: VideoRequest): Promise<VideoPlan> {
  const executionId = randomUUID();

  await log({
    action: "video.request.received",
    entity: "VideoExecution",
    entity_id: executionId,
    payload: { prompt: request.prompt },
  });

  const story = planStory(request.prompt);
  await log({
    action: "video.story.planned",
    entity: "VideoExecution",
    entity_id: executionId,
    payload: { topic: story.topic, title: story.title, durationSeconds: story.durationSeconds },
  });

  const outline = planScenes(story.topic, story.durationSeconds);
  await log({
    action: "video.scenes.planned",
    entity: "VideoExecution",
    entity_id: executionId,
    payload: { sceneCount: outline.length },
  });

  const scenes = generatePrompts(outline, story.topic);
  await log({
    action: "video.prompts.generated",
    entity: "VideoExecution",
    entity_id: executionId,
    payload: { sceneCount: scenes.length },
  });

  const buildPlan = (status: VideoPlan["status"], error?: string): VideoPlan => ({
    title: story.title,
    durationSeconds: story.durationSeconds,
    scenes,
    narration: scenes.map((s) => s.narration).join(" "),
    imagePrompts: scenes.map((s) => s.imagePrompt),
    cameraMovement: scenes.map((s) => s.cameraMovement),
    music: story.music,
    status,
    error,
  });

  const provider = resolve(DEFAULT_PROVIDER);
  if (!provider) {
    const error = `Không tìm thấy video provider "${DEFAULT_PROVIDER}".`;
    await log({
      action: "video.generation.failed",
      entity: "VideoExecution",
      entity_id: executionId,
      payload: { error },
    });
    return buildPlan("failed", error);
  }

  const result = await provider.generate({ title: story.title, durationSeconds: story.durationSeconds, scenes });

  await log({
    action: result.status === "failed" ? "video.generation.failed" : "video.generation.completed",
    entity: "VideoExecution",
    entity_id: executionId,
    payload: { provider: provider.name, status: result.status, error: result.error ?? null },
  });

  return buildPlan(result.status === "failed" ? "failed" : "planned", result.error);
}

// KHÔNG đăng ký provider nào ở đây — xem providers/registry.ts (composition
// root), nơi DUY NHẤT ghép provider cụ thể rồi gọi register().
export const VideoAgent = {
  register,
  resolve,
  generate,
};
