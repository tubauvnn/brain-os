import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
// Cross-module import: creative/renderer's low-level pan/zoom ffmpeg helper
// (Episode Renderer Core, previous phase, unmodified — extracted into its
// own file so this SAME implementation backs both media-composer.ts's
// internal fallback and this provider, not two copies of the same ffmpeg
// filter chain). video/ depending on creative/renderer/ here (rather than
// relocating the shared helper) is a deliberate, minimal choice — moving
// already-shipped files risks touching a previous phase for no functional
// gain.
import { renderPanZoomClip } from "@/lib/creative/renderer/local-pan-zoom-clip";
import { probeVideo } from "@/lib/creative/renderer/ffmpeg";
import type { CostEstimateResult, CreateVideoInput, HealthCheckResult, VideoJob, VideoProvider } from "../provider-types";

// LocalPanZoomVideoProvider — the guaranteed-available bottom rung of
// video-provider-registry.ts. A real VideoProvider peer to OpenMontageAdapter
// and any future direct provider — NOT a hardcoded fallback branch anywhere
// in the orchestration code. Its only dependency is the `ffmpeg` binary,
// already required by every other part of the Episode Renderer. Always
// healthy, zero cost, animates a static image via pan/zoom (no AI-generated
// motion — that's what OpenMontage/direct providers add when configured).

const DEFAULT_RESOLUTION = { width: 1080, height: 1920 };
const DEFAULT_FPS = 25;
const DEFAULT_DURATION_SECONDS = 5;

// createVideo() completes synchronously (ffmpeg pan/zoom on a short clip is
// fast) — nothing in the VideoProvider contract requires a job to be slow.
// This map lets getJob()/cancelJob() answer for jobs already finished by the
// time createVideo() returned; it does not need to survive a process
// restart (the output file itself does — only this bookkeeping is ephemeral).
const jobs = new Map<string, VideoJob>();

async function healthCheck(): Promise<HealthCheckResult> {
  return { available: true };
}

async function estimateCost(_input: CreateVideoInput): Promise<CostEstimateResult> {
  return { costUsd: 0, estimatedRuntimeSeconds: 2, healthy: true };
}

async function createVideo(input: CreateVideoInput): Promise<VideoJob> {
  const jobId = randomUUID();

  if (!input.imagePath) {
    const job: VideoJob = { jobId, status: "failed", progress: 0, error: "local-pan-zoom provider chỉ hỗ trợ image-to-video — thiếu imagePath." };
    jobs.set(jobId, job);
    return job;
  }

  await fs.mkdir(path.dirname(input.outputPath), { recursive: true });

  try {
    await renderPanZoomClip({
      imagePath: input.imagePath,
      durationSeconds: input.durationSeconds ?? DEFAULT_DURATION_SECONDS,
      resolution: DEFAULT_RESOLUTION,
      fps: DEFAULT_FPS,
      outPath: input.outputPath,
    });
    const probed = await probeVideo(input.outputPath);
    const job: VideoJob = { jobId, status: "completed", progress: 100, outputPath: input.outputPath, costUsd: 0, durationSeconds: probed.durationSeconds };
    jobs.set(jobId, job);
    return job;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định khi render pan/zoom.";
    const job: VideoJob = { jobId, status: "failed", progress: 0, error: message };
    jobs.set(jobId, job);
    return job;
  }
}

async function getJob(jobId: string): Promise<VideoJob> {
  return jobs.get(jobId) ?? { jobId, status: "failed", progress: 0, error: "Không tìm thấy job." };
}

async function cancelJob(jobId: string): Promise<VideoJob> {
  // createVideo() luôn chạy xong trước khi trả về — không có job nào đang
  // "running" để huỷ thật sự; chỉ trả lại trạng thái hiện có.
  return jobs.get(jobId) ?? { jobId, status: "cancelled", progress: 0 };
}

export const localPanZoomProvider: VideoProvider = {
  name: "local-pan-zoom",
  createVideo,
  getJob,
  cancelJob,
  estimateCost,
  healthCheck,
};
