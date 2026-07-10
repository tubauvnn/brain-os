import { prisma } from "@/lib/prisma";
import type { ProjectCreativeAssetSummary, ProjectCreativeMemory } from "./types";

// Project Memory (Creative Studio) — Brain OS "nhớ" asset/địa điểm/đạo cụ đã
// sinh ra cho 1 project, đọc trực tiếp từ bảng GeneratedAsset (Postgres, Phase
// 4 mới thêm — additive, KHÔNG đụng model Project/Phase 7 JSON store). Đây là
// nguồn dữ liệu DUY NHẤT mà Asset Manager (dedup) và Prompt Builder (location
// continuity) dùng — không có bản sao thứ 2.

function toSummary(a: {
  id: string;
  type: string;
  path: string;
  prompt: string;
  location_tag: string | null;
  prop_tags: string[];
  character_ids: string[];
  reused: boolean;
  created_at: Date;
}): ProjectCreativeAssetSummary {
  return {
    id: a.id,
    type: a.type,
    path: a.path,
    prompt: a.prompt,
    locationTag: a.location_tag,
    propTags: a.prop_tags,
    characterIds: a.character_ids,
    reused: a.reused,
    createdAt: a.created_at.toISOString(),
  };
}

export async function getProjectCreativeMemory(projectId: string): Promise<ProjectCreativeMemory> {
  const assets = await prisma.generatedAsset.findMany({
    where: { project_id: projectId },
    orderBy: { created_at: "asc" },
  });

  const locations = new Set<string>();
  const props = new Set<string>();
  const characterIds = new Set<string>();

  for (const a of assets) {
    if (a.location_tag) locations.add(a.location_tag);
    for (const p of a.prop_tags) props.add(p);
    for (const c of a.character_ids) characterIds.add(c);
  }

  return {
    projectId,
    locations: Array.from(locations),
    props: Array.from(props),
    characterIds: Array.from(characterIds),
    assets: assets.map(toSummary),
  };
}

// Location continuity — Prompt Builder gọi hàm này TRƯỚC khi tự viết mô tả
// địa điểm mới: nếu project đã có ảnh nào tại cùng locationTag, tái dùng đúng
// mô tả (prompt) của asset ĐẦU TIÊN từng render tại đó, để scene sau vẽ đúng
// bối cảnh scene trước (thay vì mỗi scene bịa lại địa điểm khác nhau).
export async function recallLocationDescription(projectId: string, locationTag: string): Promise<string | null> {
  const asset = await prisma.generatedAsset.findFirst({
    where: { project_id: projectId, location_tag: locationTag },
    orderBy: { created_at: "asc" },
  });
  return asset?.prompt ?? null;
}
