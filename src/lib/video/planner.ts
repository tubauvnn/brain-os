import type { VideoScene } from "./types";

// Story/Scene/Prompt Planner — logic THUẦN, dùng chung cho mọi Provider (Mock
// hôm nay, Veo/Kling sau này) — KHÔNG gọi model/API ngoài (đúng yêu cầu Phase
// 3 "No external API"). Rút "chủ đề" từ message bằng cách bỏ cụm kích hoạt đã
// biết, rồi dựng câu chuyện theo khung cố định 4 cảnh (hook → problem →
// showcase → call-to-action). Đây là bản template tối giản để chứng minh
// vertical slice — thay bằng planner sinh động (model-based) là bước sau,
// không đổi contract VideoScene/VideoPlan.

const TRIGGER_PHRASES = [
  "tạo video giới thiệu",
  "làm video giới thiệu",
  "tạo video",
  "làm video",
  "video giới thiệu",
  "create a video",
  "make a video",
];

export type StoryOutline = {
  topic: string;
  title: string;
  durationSeconds: number;
  music: string;
};

// Story Planner — xác định chủ đề + khung tổng thể (tiêu đề, thời lượng, nhạc nền).
export function planStory(prompt: string): StoryOutline {
  let topic = prompt.trim();
  const lower = topic.toLowerCase();
  for (const phrase of TRIGGER_PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx !== -1) {
      topic = topic.slice(idx + phrase.length).trim();
      break;
    }
  }
  topic = topic.replace(/^(về|for|about)\s+/i, "").trim();
  if (!topic) topic = "sản phẩm";

  return {
    topic,
    title: `Giới thiệu ${topic}`,
    durationSeconds: 32,
    music: "Nhạc nền vui tươi, tiết tấu nhanh, phù hợp quảng cáo ngắn.",
  };
}

const SCENE_BEATS: Array<{ beat: string; narrate: (topic: string) => string; cameraMovement: string }> = [
  {
    beat: "hook",
    narrate: (topic) => `Bạn đã từng thử ${topic} chưa?`,
    cameraMovement: "Zoom in nhanh vào sản phẩm.",
  },
  {
    beat: "problem",
    narrate: (topic) => `Tìm một lựa chọn ngon, tiện lợi cho ${topic} không hề dễ.`,
    cameraMovement: "Pan ngang, ánh sáng dịu.",
  },
  {
    beat: "showcase",
    narrate: (topic) => `${topic} mang đến hương vị trọn vẹn trong từng miếng.`,
    cameraMovement: "Slow-motion cận cảnh sản phẩm.",
  },
  {
    beat: "cta",
    narrate: (topic) => `Thử ngay ${topic} hôm nay!`,
    cameraMovement: "Zoom out, hiện logo thương hiệu.",
  },
];

// Scene Planner — khung 4 cảnh cố định, chia đều thời lượng. imagePrompt để
// rỗng, Prompt Generator điền sau (tách 2 bước đúng pipeline yêu cầu).
export function planScenes(topic: string, totalDurationSeconds: number): VideoScene[] {
  const perScene = Math.round(totalDurationSeconds / SCENE_BEATS.length);
  return SCENE_BEATS.map((s, i) => ({
    index: i + 1,
    description: `Cảnh ${i + 1} — ${s.beat}`,
    narration: s.narrate(topic),
    imagePrompt: "",
    cameraMovement: s.cameraMovement,
    durationSeconds: perScene,
  }));
}

// Prompt Generator — điền imagePrompt (text-to-image style) cho từng scene.
// KHÔNG gọi API ngoài — ghép template + topic + cameraMovement đã có.
export function generatePrompts(scenes: VideoScene[], topic: string): VideoScene[] {
  return scenes.map((s) => ({
    ...s,
    imagePrompt: `${s.description}, chủ thể: ${topic}, phong cách quảng cáo, ánh sáng đẹp, ${s.cameraMovement.toLowerCase()}`,
  }));
}
