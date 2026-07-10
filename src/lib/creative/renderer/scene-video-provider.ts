import path from "node:path";
import { VideoProviderRegistry } from "@/lib/video";
import type { VideoJob, VideoProvider } from "@/lib/video";
import { log } from "@/lib/logger";
import type { TimelineClip } from "./types";

// Scene Video Provider — the ONLY place episode-render-service.ts touches
// VideoProvider (src/lib/video/, Phase 5). No provider-specific branching
// here: VideoProviderRegistry.selectHealthyProvider() returns whichever
// provider is healthy right now (OpenMontage adapter if a downstream key is
// ever configured, otherwise the always-available local pan/zoom provider —
// see video-provider-registry.ts). "Falling back to local rendering" is not
// a special case in this file; it is simply which provider got selected.
//
// Implements async job/poll/retry/timeout/cancel per the VideoProvider
// contract: createVideo() → bounded poll → on failure, retry up to
// MAX_RETRIES_PER_SCENE (same bounded-retry philosophy as
// src/lib/creative/render-queue/render-queue.ts) → on exhaustion, cancel the
// job and return null for that scene (media-composer.ts's own internal
// pan/zoom fallback covers it — belt and suspenders, should not trigger
// since the registry's last entry is guaranteed available).

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // ~60s max wait per job before timing out
const MAX_RETRIES_PER_SCENE = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilTerminal(provider: VideoProvider, initial: VideoJob): Promise<VideoJob> {
  let job = initial;
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") return job;
    await sleep(POLL_INTERVAL_MS);
    job = await provider.getJob(job.jobId);
  }
  await provider.cancelJob(job.jobId);
  return { ...job, status: "failed", error: job.error ?? `Timeout sau ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s chờ video provider.` };
}

async function renderSceneWithRetry(provider: VideoProvider, clip: TimelineClip, outPath: string): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES_PER_SCENE; attempt++) {
    try {
      const job = await provider.createVideo({
        prompt: clip.prompt,
        imagePath: clip.imagePath,
        durationSeconds: clip.durationSeconds,
        aspectRatio: "9:16",
        outputPath: outPath,
      });

      const finalJob = job.status === "completed" || job.status === "failed" ? job : await pollUntilTerminal(provider, job);

      if (finalJob.status === "completed" && finalJob.outputPath) {
        return finalJob.outputPath;
      }

      await log({
        action: "video_provider.scene_render.failed",
        entity: "TimelineClip",
        entity_id: clip.sceneId,
        payload: { provider: provider.name, attempt, error: finalJob.error },
      });
    } catch (e) {
      await log({
        action: "video_provider.scene_render.error",
        entity: "TimelineClip",
        entity_id: clip.sceneId,
        payload: { provider: provider.name, attempt, error: e instanceof Error ? e.message : String(e) },
      });
    }
  }
  return null;
}

// Trả về sceneId -> clip path cho MỌI scene render được qua VideoProvider.
// Scene nào không có trong map thì media-composer.ts tự render pan/zoom nội
// bộ (không lỗi, không chặn toàn bộ episode vì 1 scene thất bại).
export async function buildProviderClips(clips: TimelineClip[], workDir: string): Promise<Record<string, string>> {
  const provider = await VideoProviderRegistry.selectHealthyProvider();
  if (!provider) {
    await log({ action: "video_provider.none_available", entity: "Timeline", payload: {} });
    return {};
  }

  await log({ action: "video_provider.selected", entity: "Timeline", payload: { provider: provider.name } });

  const clipsDir = path.join(workDir, "provider-clips");
  const result: Record<string, string> = {};

  for (const clip of clips) {
    const outPath = path.join(clipsDir, `scene-${String(clip.index).padStart(3, "0")}.mp4`);
    const clipPath = await renderSceneWithRetry(provider, clip, outPath);
    if (clipPath) result[clip.sceneId] = clipPath;
  }

  return result;
}
