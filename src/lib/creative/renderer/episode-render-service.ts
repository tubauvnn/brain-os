import path from "node:path";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { getAudioMixer, getMediaComposer, getSubtitleRenderer, getTimelineBuilder, getVideoExporter } from "./registry";
import { resolveEpisodeRenderPaths, cleanupWorkDir } from "./storage";
import { buildExportPreset } from "./export-presets";
import type { Timeline, TimelineSceneInput } from "./types";

// Episode Render Service — orchestrates the 5 renderer contracts into one
// episode-level render. REQUIRES every scene to already have a rendered
// image (via the existing Render Queue, Phase 4, unmodified) — does not
// re-implement image generation/dedup, just consumes its output. Runs
// synchronously (see docs/creative renderer plan — Step 7 only asked for one
// endpoint, no polling; progress is still persisted per checkpoint so the
// EpisodeRenderJob row is a real audit trail even though this call returns
// the finished result in one response).

const DEFAULT_VOICE_COST_USD_PER_1K_CHARS = 0.3; // cùng hằng số/env var Cost Manager dùng (cost-manager.ts) — KHÔNG sửa file đó, chỉ dùng lại cùng công thức cho chi phí THẬT sau khi render (khác cost-manager, vốn là ước lượng TRƯỚC khi render).

function voicePricePerKChar(): number {
  const raw = Number(process.env.CREATIVE_VOICE_COST_USD_PER_1K_CHARS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_VOICE_COST_USD_PER_1K_CHARS;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeRealCost(timeline: Timeline): number {
  const cues = timeline.voiceCues;
  const allKnown = cues.length > 0 && cues.every((c) => typeof c.costUsd === "number");
  if (allKnown) {
    return round2(cues.reduce((sum, c) => sum + (c.costUsd ?? 0), 0));
  }
  // Provider hiện tại (ElevenLabs) không trả cost trực tiếp (xem
  // src/lib/voice/providers/elevenlabs.ts) — dùng lại đúng công thức ước
  // lượng của Cost Manager (ký tự thoại / 1000 * giá cấu hình) thay vì bịa số.
  const totalChars = timeline.subtitleCues.reduce((sum, c) => sum + c.text.length, 0);
  return round2((totalChars / 1000) * voicePricePerKChar());
}

async function setProgress(jobId: string, progress: number): Promise<void> {
  await prisma.episodeRenderJob.update({ where: { id: jobId }, data: { progress } });
}

export type RenderEpisodeInput = {
  episodeId: string;
  projectId?: string | null;
  format: "vertical" | "horizontal" | "square";
  resolution: { width: number; height: number };
  fps: number;
  // Override tên thư mục episode trong output path — chỉ dùng cho test Step
  // 8 (cần đúng .../episodes/openmontage-test/final.mp4); API mặc định dùng
  // episodeId làm tên thư mục.
  episodeDirName?: string;
  // Giới hạn render tới 1 tập con các scene (giữ nguyên thứ tự theo index) —
  // KHÔNG expose qua POST /api/creative/episode/render (hợp đồng API cố định
  // theo yêu cầu, không thêm field). Dùng nội bộ khi cần render preview/1
  // đoạn ngắn từ 1 episode dài hơn — Story Agent (Phase 4, không sửa) luôn
  // sinh 3-8 scene ~30s/scene, không có chế độ "episode ngắn".
  sceneIds?: string[];
};

export type RenderEpisodeResult = {
  jobId: string;
  status: "completed" | "failed";
  progress: number;
  outputPath: string | null;
  duration: number;
  cost: number;
  error?: string;
};

export async function renderEpisode(input: RenderEpisodeInput): Promise<RenderEpisodeResult> {
  const episode = await prisma.storyEpisode.findUnique({
    where: { id: input.episodeId },
    include: { scenes: { orderBy: { index: "asc" }, include: { assets: true } } },
  });
  if (!episode) throw new Error(`Không tìm thấy episode "${input.episodeId}".`);
  if (episode.scenes.length === 0) throw new Error("Episode chưa có scene nào.");
  if (input.projectId && episode.project_id && input.projectId !== episode.project_id) {
    throw new Error(`projectId "${input.projectId}" không khớp project thật của episode ("${episode.project_id}").`);
  }

  let scenesToRender = episode.scenes;
  if (input.sceneIds && input.sceneIds.length > 0) {
    const idSet = new Set(input.sceneIds);
    const missing = input.sceneIds.filter((id) => !episode.scenes.some((s) => s.id === id));
    if (missing.length > 0) throw new Error(`sceneIds không thuộc episode: ${missing.join(", ")}`);
    scenesToRender = episode.scenes.filter((s) => idSet.has(s.id));
  }

  const missingImages = scenesToRender.filter((s) => s.assets.length === 0);
  if (missingImages.length > 0) {
    throw new Error(
      `${missingImages.length}/${scenesToRender.length} scene chưa có ảnh đã render (${missingImages.map((s) => s.id).join(", ")}) — ` +
        `gọi POST /api/creative/scenes/:id/render rồi /api/creative/render-queue/process trước khi render episode.`,
    );
  }

  const job = await prisma.episodeRenderJob.create({
    data: {
      episode_id: episode.id,
      project_id: episode.project_id,
      format: input.format,
      resolution: `${input.resolution.width}x${input.resolution.height}`,
      fps: input.fps,
      status: "rendering",
      started_at: new Date(),
    },
  });

  await log({ action: "creative.episode_render.started", entity: "EpisodeRenderJob", entity_id: job.id, payload: { episodeId: episode.id, format: input.format } });

  const paths = await resolveEpisodeRenderPaths(episode.project_id, episode.id, input.episodeDirName);

  try {
    await setProgress(job.id, 10);

    const sceneInputs: TimelineSceneInput[] = scenesToRender.map((scene) => {
      const latestAsset = scene.assets.slice().sort((a, b) => a.created_at.getTime() - b.created_at.getTime()).pop();
      if (!latestAsset) throw new Error(`Scene "${scene.id}" không có asset ảnh (không nên xảy ra sau bước kiểm tra ở trên).`);
      const dialogue = Array.isArray(scene.dialogue) ? (scene.dialogue as unknown as Array<{ character: string; line: string }>) : [];
      return {
        id: scene.id,
        index: scene.index,
        imagePath: path.join(process.cwd(), latestAsset.path),
        estimatedDurationSeconds: scene.duration_seconds,
        dialogue,
      };
    });

    const timeline = await getTimelineBuilder().build({
      episodeId: episode.id,
      scenes: sceneInputs,
      resolution: input.resolution,
      fps: input.fps,
      workDir: paths.workDir,
    });
    await setProgress(job.id, 40);

    const visual = await getMediaComposer().compose(timeline, paths.workDir);
    await setProgress(job.id, 60);

    const audio = await getAudioMixer().mix(timeline, paths.workDir, null);
    await setProgress(job.id, 75);

    const subtitle = await getSubtitleRenderer().render(timeline, paths.workDir);
    await setProgress(job.id, 85);

    const preset = buildExportPreset(input.format, input.resolution, input.fps);
    const exported = await getVideoExporter().export({
      visualTrackPath: visual.videoPath,
      audioTrackPath: audio.audioPath,
      subtitle,
      preset,
      outputPath: paths.finalPath,
    });

    const costUsd = computeRealCost(timeline);
    const outputPathRelative = path.relative(process.cwd(), exported.outputPath);

    await prisma.episodeRenderJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        progress: 100,
        output_path: outputPathRelative,
        duration_seconds: exported.durationSeconds,
        cost_usd: costUsd,
        finished_at: new Date(),
      },
    });

    await log({
      action: "creative.episode_render.completed",
      entity: "EpisodeRenderJob",
      entity_id: job.id,
      payload: { outputPath: outputPathRelative, durationSeconds: exported.durationSeconds, costUsd },
    });

    await cleanupWorkDir(paths.workDir);

    return { jobId: job.id, status: "completed", progress: 100, outputPath: outputPathRelative, duration: exported.durationSeconds, cost: costUsd };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định khi render episode.";
    await prisma.episodeRenderJob.update({ where: { id: job.id }, data: { status: "failed", error: message, finished_at: new Date() } });
    await log({ action: "creative.episode_render.failed", entity: "EpisodeRenderJob", entity_id: job.id, payload: { error: message } });
    return { jobId: job.id, status: "failed", progress: 0, outputPath: null, duration: 0, cost: 0, error: message };
  }
}
