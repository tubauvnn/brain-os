import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { GeneratedAsset } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toJsonValue } from "@/lib/json";
import { saveGeneratedImage } from "./storage";
import type { RecordNewAssetInput } from "./types";

// Asset Manager — "reuse previous assets / detect duplicates / maintain canon
// consistency" (Phase 4, mục 5). Reuse dựa trên contentHash (sha256 của
// prompt + negative prompts + nhân vật + location đã CHUẨN HOÁ — khớp CHÍNH
// XÁC, không phải similarity mờ) trong CÙNG project — không tự nhận diện
// "tương tự" bằng cách nào khác để tránh bịa ra 1 khả năng chưa thật sự có.
// Canon consistency: metadata của mỗi asset lưu lại canonWarnings do Prompt
// Builder phát hiện (Character Agent, Phase 3) — không tự phán đoán thêm.

export function hashPrompt(prompt: string, negativePrompts: string[], characterIds: string[], locationTag: string | null): string {
  const normalized = JSON.stringify({
    prompt: prompt.trim(),
    negativePrompts: [...negativePrompts].sort(),
    characterIds: [...characterIds].sort(),
    locationTag: locationTag ?? "",
  });
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// Không có project (episode không gắn projectId) → không có "lịch sử" nào để
// đối chiếu, luôn generate mới — an toàn hơn là tự đoán phạm vi tái dùng.
export async function findReusableAsset(projectId: string | null | undefined, contentHash: string): Promise<GeneratedAsset | null> {
  if (!projectId) return null;
  const candidate = await prisma.generatedAsset.findFirst({
    where: { project_id: projectId, content_hash: contentHash },
    orderBy: { created_at: "asc" },
  });
  if (!candidate) return null;

  // File vật lý có thể đã bị xoá ngoài ý muốn — không claim reuse được nữa
  // (tránh trả về asset trỏ tới file không tồn tại), generate mới thay vì lỗi.
  const absolutePath = path.join(process.cwd(), candidate.path);
  if (!fs.existsSync(absolutePath)) return null;

  return candidate;
}

export async function recordNewAsset(input: RecordNewAssetInput): Promise<GeneratedAsset> {
  const saved = saveGeneratedImage(input.imageBuffer, input.mimeType);
  const contentHash = hashPrompt(input.prompt, input.negativePrompts, input.characterIds, input.locationTag ?? null);

  return prisma.generatedAsset.create({
    data: {
      type: "image",
      scene_id: input.sceneId ?? null,
      project_id: input.projectId ?? null,
      prompt: input.prompt,
      negative_prompts: input.negativePrompts,
      provider: input.provider,
      path: saved.relativePath,
      mime_type: input.mimeType,
      cost_usd: input.costUsd ?? null,
      content_hash: contentHash,
      character_ids: input.characterIds,
      location_tag: input.locationTag ?? null,
      prop_tags: input.propTags,
      reused: false,
      metadata: toJsonValue(input.metadata),
    },
  });
}

// Tái dùng — KHÔNG gọi Image Provider, KHÔNG ghi file mới (dùng lại đúng
// `path` của asset gốc), chỉ tạo 1 dòng GeneratedAsset mới trỏ vào scene hiện
// tại (1 asset chỉ thuộc 1 scene — xem quan hệ scene_id trong schema) với
// cost_usd=0 và reused=true.
export async function recordReusedAsset(source: GeneratedAsset, sceneId: string): Promise<GeneratedAsset> {
  return prisma.generatedAsset.create({
    data: {
      type: source.type,
      scene_id: sceneId,
      project_id: source.project_id,
      prompt: source.prompt,
      negative_prompts: source.negative_prompts,
      provider: source.provider,
      path: source.path,
      mime_type: source.mime_type,
      cost_usd: 0,
      content_hash: source.content_hash,
      character_ids: source.character_ids,
      location_tag: source.location_tag,
      prop_tags: source.prop_tags,
      reused: true,
      metadata: source.metadata ?? undefined,
    },
  });
}

export async function listAssets(filters: { projectId?: string; locationTag?: string; sceneId?: string }): Promise<GeneratedAsset[]> {
  return prisma.generatedAsset.findMany({
    where: {
      ...(filters.projectId ? { project_id: filters.projectId } : {}),
      ...(filters.locationTag ? { location_tag: filters.locationTag } : {}),
      ...(filters.sceneId ? { scene_id: filters.sceneId } : {}),
    },
    orderBy: { created_at: "desc" },
  });
}
