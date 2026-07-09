import type { Character, ConsistencyCheckResult, ConsistencyOverride } from "./types";

// Consistency Checker — so khớp override với Character Model gốc trên đúng 6
// khía cạnh yêu cầu Phase 5: appearance, colors, height (bodyProportions),
// personality, voice (voiceProfile), relationships. Không override (Character
// Agent tự phát canonical, chưa có agent khác gửi mô tả riêng) → score 1,
// "No drift is allowed" theo đúng nghĩa dữ liệu chưa hề bị chỉnh sửa.

const CHECKED_FIELDS: Array<keyof ConsistencyOverride> = [
  "appearance",
  "canonicalColors",
  "bodyProportions",
  "personality",
  "voiceProfile",
  "relationships",
];

export function checkConsistency(canonical: Character, override?: ConsistencyOverride): ConsistencyCheckResult {
  if (!override) return { score: 1, mismatches: [] };

  const mismatches: string[] = [];
  for (const field of CHECKED_FIELDS) {
    const value = override[field];
    if (value === undefined) continue;
    if (JSON.stringify(canonical[field]) !== JSON.stringify(value)) {
      mismatches.push(field);
    }
  }

  const score = 1 - mismatches.length / CHECKED_FIELDS.length;
  return { score, mismatches };
}
