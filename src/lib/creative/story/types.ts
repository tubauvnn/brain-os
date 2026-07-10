// Story Agent contracts. Story Agent KHÔNG phải Video Agent's template planner
// (src/lib/video/planner.ts, Phase 3, cố định 4 cảnh quảng cáo) — đây là nội
// dung SÁNG TẠO THẬT, gọi Model Router (src/lib/model/, Phase 1/3, không sửa)
// để sinh ý tưởng/outline/lời thoại/scene list. Character canon (Phase 3,
// src/lib/character/) luôn được nạp trước để Story Agent không tự bịa nhân
// vật khác — đúng nguyên tắc "canon luôn thắng" đã áp dụng cho Image Agent.

export type StoryDialogueLine = { character: string; line: string };

export type StorySceneSeed = {
  index: number;
  description: string;
  location: string;
  props: string[];
  dialogue: StoryDialogueLine[];
};

export type StoryOutline = {
  title: string;
  logline: string;
  theme: string;
  durationSeconds: number;
  scenes: StorySceneSeed[];
};

export type StoryAgentResult =
  | { status: "success"; story: StoryOutline; charactersUsed: string[] }
  | { status: "error"; error: string };
