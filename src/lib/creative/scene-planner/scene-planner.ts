import { findCharacterByName, findCharactersMentioned } from "@/lib/character";
import type { StoryOutline } from "../story/types";
import type { PlannedScene, ScenePlan } from "./types";

// Scene Planner — logic THUẦN (KHÔNG gọi model/API ngoài, cùng nguyên tắc
// src/lib/video/planner.ts, Phase 3): nhận Story Outline đã sinh bởi Story
// Agent, chia lại thành danh sách Scene có ước lượng thời lượng + xác định
// asset cần thiết (nhân vật/địa điểm/đạo cụ) cho từng cảnh — đầu vào cho
// Prompt Builder ở bước sau.

const MIN_SCENE_SECONDS = 2;
const MAX_SCENE_SECONDS = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Nhân vật xuất hiện trong 1 cảnh = nhân vật được nhắc trong mô tả cảnh HOẶC
// là người nói 1 dòng thoại — khớp qua Character Agent (Phase 3, KHÔNG sửa),
// không tự đoán tên ngoài cast đã biết.
function resolveSceneCharacterIds(description: string, dialogueSpeakers: string[]): string[] {
  const ids = new Set<string>();
  for (const c of findCharactersMentioned(description)) ids.add(c.id);
  for (const speaker of dialogueSpeakers) {
    const c = findCharacterByName(speaker);
    if (c) ids.add(c.id);
  }
  return Array.from(ids);
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

export function planScenes(story: StoryOutline): ScenePlan {
  const sceneCount = story.scenes.length;
  const perSceneSeconds = sceneCount > 0 ? clamp(Math.round(story.durationSeconds / sceneCount), MIN_SCENE_SECONDS, MAX_SCENE_SECONDS) : MIN_SCENE_SECONDS;

  const scenes: PlannedScene[] = story.scenes
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((seed, i) => {
      const characterIds = resolveSceneCharacterIds(
        seed.description,
        seed.dialogue.map((d) => d.character),
      );
      const propTags = Array.from(new Set(seed.props.map(normalizeTag).filter(Boolean)));

      return {
        index: i + 1,
        description: seed.description,
        dialogue: seed.dialogue,
        durationSeconds: perSceneSeconds,
        characterIds,
        locationTag: normalizeTag(seed.location || "unknown"),
        propTags,
      };
    });

  const totalDurationSeconds = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);

  return { scenes, totalDurationSeconds };
}
