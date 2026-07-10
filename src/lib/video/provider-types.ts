// VideoProvider — the ONLY contract Brain OS orchestration calls for
// image-to-video generation (Phase 5). Same IoC shape as every other
// provider in this codebase (ModelProvider/VoiceProvider/
// ImageGeneratorProvider — src/lib/model/, src/lib/voice/,
// src/lib/creative/image-provider/): interface first, concrete
// implementations second, selected via a registry
// (video-provider-registry.ts), never imported directly by callers.
//
// This file is intentionally vendor-neutral — no OpenMontage-specific (or
// any other vendor-specific) field exists here. Async job semantics
// (create → poll → cancel) are part of the CONTRACT, not a detail of any
// one implementation: a provider whose underlying work is fast/local (e.g.
// the local pan/zoom provider) is free to return an already-"completed" job
// from createVideo() — nothing requires a job to take any minimum time.
//
// A NEW file, not touching src/lib/video/types.ts (Phase 3's
// VideoGeneratorProvider/VideoGenerationInput/VideoGenerationResult, used by
// the existing template Video Agent) — that contract is untouched, zero
// regression. This is a separate, richer contract for real async
// image-to-video providers.

export type VideoJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type CreateVideoInput = {
  prompt: string;
  imagePath?: string;
  durationSeconds?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  outputPath: string;
};

export type VideoJob = {
  jobId: string;
  status: VideoJobStatus;
  progress: number;
  outputPath?: string;
  costUsd?: number;
  durationSeconds?: number;
  error?: string;
};

export type CostEstimateResult = {
  costUsd: number;
  estimatedRuntimeSeconds?: number;
  healthy: boolean;
};

export type HealthCheckResult = {
  available: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};

export interface VideoProvider {
  readonly name: string;
  createVideo(input: CreateVideoInput): Promise<VideoJob>;
  getJob(jobId: string): Promise<VideoJob>;
  cancelJob(jobId: string): Promise<VideoJob>;
  estimateCost(input: CreateVideoInput): Promise<CostEstimateResult>;
  healthCheck(): Promise<HealthCheckResult>;
}
