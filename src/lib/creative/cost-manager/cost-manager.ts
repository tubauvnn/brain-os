import type { CostEstimate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toJsonValue } from "@/lib/json";

// Cost Manager — "estimate image cost / voice cost / video cost / episode
// total" (Phase 4, mục 7). CHỈ là ước lượng cấu hình được (env override, giá
// mặc định ghi rõ trong comment) — OpenAI Images API/ElevenLabs không trả
// cost USD trực tiếp (xem image-provider/providers/openai-image.ts,
// src/lib/voice/providers/elevenlabs.ts Phase 1), và KHÔNG có Voice/Video
// Provider nào thực sự được gọi ở bước này — voice/video cost luôn là dự
// phóng (forecast), không phải chi phí đã phát sinh thật.

const DEFAULT_IMAGE_COST_USD = 0.04; // xấp xỉ gpt-image-1, kích thước 1024x1024, chất lượng chuẩn — chỉnh qua CREATIVE_IMAGE_COST_USD
const DEFAULT_VOICE_COST_USD_PER_1K_CHARS = 0.3; // xấp xỉ ElevenLabs starter tier — chỉnh qua CREATIVE_VOICE_COST_USD_PER_1K_CHARS
const DEFAULT_VIDEO_COST_USD_PER_SECOND = 0.1; // placeholder — chưa có Video Provider thật (Phase 4 dừng trước bước này) — chỉnh qua CREATIVE_VIDEO_COST_USD_PER_SECOND

function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function dialogueCharCountFor(dialogue: unknown): number {
  if (!Array.isArray(dialogue)) return 0;
  return dialogue.reduce((sum: number, entry) => {
    if (entry && typeof entry === "object" && typeof (entry as { line?: unknown }).line === "string") {
      return sum + (entry as { line: string }).line.length;
    }
    return sum;
  }, 0);
}

export async function estimateEpisodeCost(episodeId: string): Promise<CostEstimate> {
  const episode = await prisma.storyEpisode.findUniqueOrThrow({
    where: { id: episodeId },
    include: { scenes: { include: { assets: true } } },
  });

  const perImagePrice = envNumber("CREATIVE_IMAGE_COST_USD", DEFAULT_IMAGE_COST_USD);
  const perVoicePrice = envNumber("CREATIVE_VOICE_COST_USD_PER_1K_CHARS", DEFAULT_VOICE_COST_USD_PER_1K_CHARS);
  const perVideoPrice = envNumber("CREATIVE_VIDEO_COST_USD_PER_SECOND", DEFAULT_VIDEO_COST_USD_PER_SECOND);

  let imageCostUsd = 0;
  let renderedImageCount = 0;
  let reusedImageCount = 0;
  let pendingImageCount = 0;
  let dialogueCharCount = 0;

  for (const scene of episode.scenes) {
    dialogueCharCount += dialogueCharCountFor(scene.dialogue);

    const latestAsset = scene.assets.slice().sort((a, b) => a.created_at.getTime() - b.created_at.getTime()).pop();

    if (!latestAsset) {
      pendingImageCount += 1;
      imageCostUsd += perImagePrice; // chưa render — dự phóng theo giá cấu hình
    } else if (latestAsset.reused) {
      reusedImageCount += 1; // tái dùng — không phát sinh chi phí ảnh mới
    } else {
      renderedImageCount += 1;
      imageCostUsd += latestAsset.cost_usd ?? perImagePrice; // ưu tiên cost thật nếu provider từng trả, else giá cấu hình
    }
  }

  const voiceCostUsd = (dialogueCharCount / 1000) * perVoicePrice;
  const videoCostUsd = episode.duration_seconds * perVideoPrice;
  const totalUsd = imageCostUsd + voiceCostUsd + videoCostUsd;

  return prisma.costEstimate.create({
    data: {
      episode_id: episodeId,
      image_cost_usd: round2(imageCostUsd),
      voice_cost_usd: round2(voiceCostUsd),
      video_cost_usd: round2(videoCostUsd),
      total_usd: round2(totalUsd),
      breakdown: toJsonValue({
        perImagePriceUsd: perImagePrice,
        perVoice1kCharsPriceUsd: perVoicePrice,
        perVideoSecondPriceUsd: perVideoPrice,
        sceneCount: episode.scenes.length,
        renderedImageCount,
        reusedImageCount,
        pendingImageCount,
        dialogueCharCount,
        totalDurationSeconds: episode.duration_seconds,
        note: "voiceCostUsd/videoCostUsd là ước lượng — chưa có lệnh gọi Voice/Video Provider thật nào trong bước này.",
      }),
    },
  });
}

export async function getLatestCostEstimate(episodeId: string): Promise<CostEstimate | null> {
  return prisma.costEstimate.findFirst({ where: { episode_id: episodeId }, orderBy: { created_at: "desc" } });
}
