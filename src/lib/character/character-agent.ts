import { findCharactersMentioned, getAllCharacters } from "./characters";
import { checkConsistency } from "./consistency-checker";
import type { Character, CharacterOutput } from "./types";

// Character Agent — nguồn sự thật DUY NHẤT về nhân vật/IP trong Brain OS.
// KHÔNG phải Image Agent — không sinh ảnh, chỉ quản lý + phát dữ liệu nhân
// vật (Character Model) và visual/voice prompt đi kèm cho agent khác dùng.

function buildVisualPrompt(c: Character): string {
  return [
    `${c.name}: ${c.appearance}`,
    `Màu chuẩn: ${c.canonicalColors.join(", ")}.`,
    `Tỉ lệ cơ thể: ${c.bodyProportions}`,
    `Đặc điểm khuôn mặt: ${c.facialFeatures}`,
    c.accessories.length ? `Phụ kiện: ${c.accessories.join(", ")}.` : "",
    `Quy tắc bắt buộc: ${c.visualRules.join(" ")}`,
    `Không được: ${c.forbiddenChanges.join(" ")}`,
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
  const consistency = checkConsistency(c);
  return {
    character: { id: c.id, name: c.name, universe: c.universe, species: c.species },
    appearance: c.appearance,
    personality: c.personality,
    styleGuide: buildStyleGuide(c),
    visualPrompt: buildVisualPrompt(c),
    voicePrompt: buildVoicePrompt(c),
    consistencyScore: consistency.score,
  };
}

export type CharacterAgentOutput = {
  requestTopic: string;
  characters: CharacterOutput[];
};

// Character Memory — nếu topic nhắc tên nhân vật cụ thể, chỉ trả nhân vật đó;
// không nhắc tên nào → tự động load TOÀN BỘ cast đã biết (đúng ví dụ Phase 5:
// "Tạo tập mới Onigiri City" tự load Trang/Cam/Nâu, không cần mô tả lại).
export async function resolveCharacters(topic: string): Promise<CharacterAgentOutput> {
  const mentioned = findCharactersMentioned(topic);
  const characters = mentioned.length > 0 ? mentioned : getAllCharacters();

  return {
    requestTopic: topic,
    characters: characters.map(toOutput),
  };
}
