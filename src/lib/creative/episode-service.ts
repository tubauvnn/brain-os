import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { generateStory } from "./story/story-agent";
import { planScenes } from "./scene-planner/scene-planner";

// Episode Service — ghép Story Agent → Scene Planner (Phase 4, mục 1-2) rồi
// lưu kết quả 1 lần thành StoryEpisode + StoryScene[]. Đây là điểm vào cấp
// cao nhất của Creative Studio; Prompt Builder/Image Agent/Asset Manager/
// Render Queue/Cost Manager chạy ở bước SAU (per-scene, qua API riêng — xem
// src/app/api/creative/), không tự động render ảnh ngay khi tạo episode
// (kiểm soát chi phí — sinh ảnh luôn là hành động rõ ràng của người dùng).

export type CreateEpisodeResult =
  | { success: true; episode: NonNullable<Awaited<ReturnType<typeof getEpisode>>> }
  | { success: false; error: string };

export async function createEpisode(topic: string, projectId?: string | null): Promise<CreateEpisodeResult> {
  const storyResult = await generateStory(topic);
  if (storyResult.status === "error") {
    await log({ action: "creative.episode.story_failed", entity: "StoryEpisode", payload: { topic, error: storyResult.error } });
    return { success: false, error: storyResult.error };
  }

  const plan = planScenes(storyResult.story);
  if (plan.scenes.length === 0) {
    return { success: false, error: "Scene Planner không tạo được cảnh nào từ story outline." };
  }

  const episode = await prisma.storyEpisode.create({
    data: {
      project_id: projectId ?? null,
      title: storyResult.story.title,
      logline: storyResult.story.logline,
      theme: storyResult.story.theme || null,
      duration_seconds: plan.totalDurationSeconds,
      status: "ready",
      scenes: {
        create: plan.scenes.map((s) => ({
          index: s.index,
          description: s.description,
          dialogue: s.dialogue as unknown as Prisma.InputJsonValue,
          duration_seconds: s.durationSeconds,
          character_ids: s.characterIds,
          location_tag: s.locationTag,
          prop_tags: s.propTags,
          status: "planned",
        })),
      },
    },
  });

  await log({
    action: "creative.episode.created",
    entity: "StoryEpisode",
    entity_id: episode.id,
    payload: { title: episode.title, sceneCount: plan.scenes.length, charactersUsed: storyResult.charactersUsed },
  });

  const full = await getEpisode(episode.id);
  if (!full) return { success: false, error: "Không đọc lại được episode vừa tạo." };
  return { success: true, episode: full };
}

export async function getEpisode(episodeId: string) {
  return prisma.storyEpisode.findUnique({
    where: { id: episodeId },
    include: {
      scenes: { orderBy: { index: "asc" }, include: { render_jobs: true, assets: true } },
      cost_estimates: { orderBy: { created_at: "desc" }, take: 1 },
    },
  });
}

export async function listEpisodes(projectId?: string) {
  return prisma.storyEpisode.findMany({
    where: projectId ? { project_id: projectId } : {},
    orderBy: { created_at: "desc" },
    include: { scenes: { select: { id: true, status: true } } },
  });
}
