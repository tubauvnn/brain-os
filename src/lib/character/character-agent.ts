import { canonFileExists, HEIGHT_CHART_CANON_PATH } from "./canon";
import { findCharactersMentioned, getAllCharacters } from "./characters";
import { checkConsistency } from "./consistency-checker";
import type { Character, CharacterOutput } from "./types";

// Character Agent — nguồn sự thật DUY NHẤT về nhân vật/IP trong Brain OS.
// KHÔNG phải Image Agent — không sinh ảnh, chỉ quản lý + phát dữ liệu nhân
// vật (Character Model) và visual/voice prompt đi kèm cho agent khác dùng.
//
// ChinChin Character Canon (assets/chinchin/characters/, xem canon.ts): mọi
// visualPrompt PHẢI trỏ rõ tới file ảnh canon + nhắc "canon luôn thắng" —
// đây là cơ chế "Always load these canon files before generating any
// artwork..." áp dụng cho MỌI consumer của Character Agent (Image Agent hôm
// nay, Video/Voice/Comic Agent sau này) mà không cần mỗi agent tự nhớ quy tắc.

function buildVisualPrompt(c: Character): string {
  return [
    `${c.name}: ${c.appearance}`,
    `Màu chuẩn: ${c.canonicalColors.join(", ")}.`,
    `Tỉ lệ cơ thể: ${c.bodyProportions}`,
    `Đặc điểm khuôn mặt: ${c.facialFeatures}`,
    c.accessories.length ? `Phụ kiện: ${c.accessories.join(", ")}.` : "",
    `Quy tắc bắt buộc: ${c.visualRules.join(" ")}`,
    `Không được: ${c.forbiddenChanges.join(" ")}`,
    `ẢNH CANON (nguồn sự thật duy nhất, PHẢI tham chiếu trước khi vẽ): ${c.canonImagePath}. Height chart tham chiếu tỉ lệ 3 nhân vật: ${HEIGHT_CHART_CANON_PATH}. Nếu kết quả mâu thuẫn với ảnh canon, ảnh canon luôn thắng.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildVoicePrompt(c: Character): string {
  return `${c.voiceProfile} Phong cách nói: ${c.speakingStyle}`;
}

function buildStyleGuide(c: Character): string[] {
  return [...c.visualRules, ...c.forbiddenChanges.map((f) => `Cấm: ${f}`)];
}

function toOutput(c: Character): CharacterOutput {
  const canonImageAvailable = canonFileExists(c.canonImagePath);
  const consistency = checkConsistency(c);
  // File canon không đọc được → không thể xác nhận khớp ảnh thật, hạ điểm
  // thay vì báo 1 (khớp tuyệt đối) một cách sai lệch — "canon luôn thắng"
  // nghĩa là im lặng khi thiếu canon KHÔNG được coi là an toàn.
  const consistencyScore = canonImageAvailable ? consistency.score : consistency.score * 0.5;

  return {
    character: { id: c.id, name: c.name, universe: c.universe, species: c.species },
    appearance: c.appearance,
    personality: c.personality,
    styleGuide: buildStyleGuide(c),
    visualPrompt: buildVisualPrompt(c),
    voicePrompt: buildVoicePrompt(c),
    consistencyScore,
    canonImagePath: c.canonImagePath,
    canonImageAvailable,
    heightChartCanonPath: HEIGHT_CHART_CANON_PATH,
  };
}

export type CharacterAgentOutput = {
  requestTopic: string;
  characters: CharacterOutput[];
};

// Character Memory — nếu topic nhắc tên nhân vật cụ thể, chỉ trả nhân vật đó;
// không nhắc tên nào → tự động load TOÀN BỘ cast đã biết (đúng ví dụ Phase 5:
// "Tạo tập mới ChinChin" tự load Trang/Cam/Nâu, không cần mô tả lại).
export async function resolveCharacters(topic: string): Promise<CharacterAgentOutput> {
  const mentioned = findCharactersMentioned(topic);
  const characters = mentioned.length > 0 ? mentioned : getAllCharacters();

  return {
    requestTopic: topic,
    characters: characters.map(toOutput),
  };
}
