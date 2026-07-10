import type { RenderJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { buildScenePrompt } from "../prompt-builder/prompt-builder";
import { findReusableAsset, hashPrompt, recordNewAsset, recordReusedAsset } from "../asset-manager/asset-manager";
import { ImageRouter, DEFAULT_IMAGE_PROVIDER } from "../image-provider/image-router";

// Render Queue — "asynchronous generation / progress tracking / retry failed
// jobs" (Phase 4, mục 6). Brain OS KHÔNG có worker process/supervisor nền
// (xem NEXT.md — chạy tay qua `next dev`, chưa có systemd/pm2) nên không có
// hạ tầng để chạy 1 vòng lặp nền thật sự "asynchronous" theo nghĩa tự động —
// hình dạng trung thực khả thi ở đây là: enqueueSceneJob() ghi job status
// "queued" ngay lập tức (không block request), rồi processQueue() được gọi
// RIÊNG (qua API, có thể gọi từ cron/1 lần bấm tay) để thực thi — tách rời
// "nộp việc" khỏi "chạy việc", đúng tinh thần hàng đợi dù không có worker nền
// thật. Ghi rõ giới hạn này thay vì giả vờ có worker không tồn tại.

const DEFAULT_MAX_ATTEMPTS = 3;

function maxAttempts(): number {
  const raw = Number(process.env.CREATIVE_RENDER_MAX_ATTEMPTS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_ATTEMPTS;
}

export async function enqueueSceneJob(sceneId: string): Promise<RenderJob> {
  const scene = await prisma.storyScene.findUnique({ where: { id: sceneId } });
  if (!scene) throw new Error(`Không tìm thấy scene "${sceneId}".`);

  const job = await prisma.renderJob.create({
    data: { scene_id: sceneId, kind: "image", status: "queued", max_attempts: maxAttempts() },
  });
  await prisma.storyScene.update({ where: { id: sceneId }, data: { status: "queued" } });

  await log({ action: "creative.render.enqueued", entity: "RenderJob", entity_id: job.id, payload: { sceneId } });
  return job;
}

async function ensureScenePrompt(sceneId: string) {
  const scene = await prisma.storyScene.findUniqueOrThrow({
    where: { id: sceneId },
    include: { episode: true },
  });

  if (scene.image_prompt) {
    return {
      scene,
      prompt: scene.image_prompt,
      negativePrompts: scene.negative_prompts,
      characterIds: scene.character_ids,
      locationTag: scene.location_tag,
      propTags: scene.prop_tags,
    };
  }

  const built = await buildScenePrompt(
    {
      description: scene.description,
      characterIds: scene.character_ids,
      locationTag: scene.location_tag ?? "unknown",
      propTags: scene.prop_tags,
    },
    scene.episode.project_id,
  );

  await prisma.storyScene.update({
    where: { id: sceneId },
    data: { image_prompt: built.prompt, negative_prompts: built.negativePrompts, status: "prompted" },
  });

  return {
    scene,
    prompt: built.prompt,
    negativePrompts: built.negativePrompts,
    characterIds: built.characterIds,
    locationTag: built.locationTag,
    propTags: built.propTags,
  };
}

async function processJob(job: RenderJob): Promise<void> {
  await prisma.renderJob.update({
    where: { id: job.id },
    data: { status: "running", attempts: { increment: 1 }, started_at: new Date() },
  });

  try {
    const { scene, prompt, negativePrompts, characterIds, locationTag, propTags } = await ensureScenePrompt(job.scene_id);
    const projectId = scene.episode.project_id;

    const contentHash = hashPrompt(prompt, negativePrompts, characterIds, locationTag);
    const reusable = await findReusableAsset(projectId, contentHash);

    if (reusable) {
      const asset = await recordReusedAsset(reusable, scene.id);
      await prisma.renderJob.update({
        where: { id: job.id },
        data: { status: "completed", result_asset_id: asset.id, finished_at: new Date(), error: null },
      });
      await prisma.storyScene.update({ where: { id: scene.id }, data: { status: "rendered" } });
      await log({
        action: "creative.render.reused",
        entity: "RenderJob",
        entity_id: job.id,
        payload: { sceneId: scene.id, assetId: asset.id },
      });
      return;
    }

    const provider = ImageRouter.resolve(DEFAULT_IMAGE_PROVIDER);
    if (!provider) throw new Error(`Không tìm thấy image provider "${DEFAULT_IMAGE_PROVIDER}".`);

    const result = await provider.generate({ prompt, negativePrompts });
    if (result.status === "error" || !result.imageBuffer) {
      throw new Error(result.error ?? "Sinh ảnh thất bại.");
    }

    const asset = await recordNewAsset({
      sceneId: scene.id,
      projectId,
      prompt,
      negativePrompts,
      provider: provider.name,
      imageBuffer: result.imageBuffer,
      mimeType: result.mimeType ?? "image/png",
      costUsd: result.costUsd,
      characterIds,
      locationTag,
      propTags,
    });

    await prisma.renderJob.update({
      where: { id: job.id },
      data: { status: "completed", result_asset_id: asset.id, finished_at: new Date(), error: null },
    });
    await prisma.storyScene.update({ where: { id: scene.id }, data: { status: "rendered" } });
    await log({
      action: "creative.render.completed",
      entity: "RenderJob",
      entity_id: job.id,
      payload: { sceneId: scene.id, assetId: asset.id, provider: provider.name },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định khi render.";
    const current = await prisma.renderJob.findUniqueOrThrow({ where: { id: job.id } });
    const exhausted = current.attempts >= current.max_attempts;

    await prisma.renderJob.update({
      where: { id: job.id },
      data: {
        status: exhausted ? "failed" : "retrying",
        error: message,
        finished_at: exhausted ? new Date() : null,
      },
    });
    if (exhausted) {
      await prisma.storyScene.update({ where: { id: current.scene_id }, data: { status: "failed" } });
    }
    await log({
      action: exhausted ? "creative.render.failed" : "creative.render.retrying",
      entity: "RenderJob",
      entity_id: job.id,
      payload: { attempts: current.attempts, maxAttempts: current.max_attempts, error: message },
    });
  }
}

// Xử lý tối đa `limit` job đang chờ (queued/retrying), theo thứ tự cũ nhất
// trước. Gọi tuần tự (không Promise.all) — mỗi job có thể tốn tiền thật (gọi
// OpenAI Images), tuần tự giúp dừng sớm dễ dàng và log rõ ràng theo thứ tự.
export async function processQueue(limit = 1): Promise<{ processed: number; jobIds: string[] }> {
  const jobs = await prisma.renderJob.findMany({
    where: { status: { in: ["queued", "retrying"] } },
    orderBy: { queued_at: "asc" },
    take: limit,
  });

  for (const job of jobs) {
    await processJob(job);
  }

  return { processed: jobs.length, jobIds: jobs.map((j) => j.id) };
}

// Retry thủ công — CHỈ áp dụng cho job đã "failed" (đã dùng hết max_attempts
// tự động trong processQueue). Đây là hành động CHỦ Ý của người dùng cấp lại
// ngân sách thử mới (reset attempts), khác với retry tự động bên trong
// processQueue (bounded, âm thầm).
export async function retryJob(jobId: string): Promise<RenderJob> {
  const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Không tìm thấy render job "${jobId}".`);
  if (job.status !== "failed") {
    throw new Error(`Chỉ retry được job ở trạng thái "failed" (hiện tại: "${job.status}").`);
  }

  const updated = await prisma.renderJob.update({
    where: { id: jobId },
    data: { status: "queued", attempts: 0, error: null, started_at: null, finished_at: null },
  });
  await prisma.storyScene.update({ where: { id: job.scene_id }, data: { status: "queued" } });
  await log({ action: "creative.render.retry_requested", entity: "RenderJob", entity_id: jobId, payload: {} });
  return updated;
}

export async function listJobs(filters: { status?: string; episodeId?: string }): Promise<RenderJob[]> {
  return prisma.renderJob.findMany({
    where: {
      ...(filters.status ? { status: filters.status as RenderJob["status"] } : {}),
      ...(filters.episodeId ? { scene: { episode_id: filters.episodeId } } : {}),
    },
    orderBy: { queued_at: "desc" },
  });
}
