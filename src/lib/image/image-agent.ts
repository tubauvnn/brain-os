import { resolveCharacters } from "@/lib/character";
import type { CharacterOutput } from "@/lib/character";
import type { CharacterReference, PromptPack } from "./types";

// Image Agent — dựng Prompt Pack JSON có cấu trúc cho 1 cảnh minh hoạ, dùng
// Character Agent (src/lib/character/) làm NGUỒN SỰ THẬT DUY NHẤT cho mọi dữ
// liệu nhân vật (appearance/colors/forbiddenChanges/...). Image Agent KHÔNG
// tự suy diễn ngoại hình nhân vật — chỉ gọi resolveCharacters() rồi đóng gói
// lại thành prompt pack, style/pose/expression/cameraAngle/background dựng
// theo template cố định (KHÔNG gọi model/API ngoài, đúng yêu cầu Phase 6).

const STYLE = "Phong cách hoạt hình 2D dễ thương (chibi), màu sắc tươi sáng, đúng nhận diện thương hiệu Onigiri City.";
const CAMERA_ANGLE = "Góc máy ngang tầm mắt, cận trung (medium shot).";

function toReference(c: CharacterOutput): CharacterReference {
  return {
    id: c.character.id,
    name: c.character.name,
    visualPrompt: c.visualPrompt,
    forbiddenChanges: c.styleGuide.filter((s) => s.startsWith("Cấm:")),
    consistencyScore: c.consistencyScore,
  };
}

function buildPose(characters: CharacterOutput[]): string {
  if (characters.length <= 1) return "Đứng thẳng, tư thế thân thiện, tay vẫy chào.";
  return `Đứng cạnh nhau theo nhóm (${characters.map((c) => c.character.name).join(", ")}), tạo dáng vui vẻ.`;
}

function buildExpression(characters: CharacterOutput[]): string {
  return characters.map((c) => `${c.character.name}: biểu cảm đúng tính cách (${c.personality})`).join(" ");
}

function buildBackground(characters: CharacterOutput[]): string {
  const universe = characters[0]?.character.universe ?? "Onigiri City";
  return `${universe} — không gian bếp/cửa hàng cơm nắm ấm cúng, tông màu pastel.`;
}

function buildSceneDescription(topic: string, characters: CharacterOutput[]): string {
  const names = characters.map((c) => c.character.name).join(", ");
  return `Cảnh minh hoạ: ${topic}. Nhân vật xuất hiện: ${names}.`;
}

function buildNegativePrompts(characters: CharacterOutput[]): string[] {
  const base = ["low quality", "blurry", "extra limbs", "off-model", "màu sai lệch so với canon"];
  const fromCanon = characters.flatMap((c) => c.styleGuide.filter((s) => s.startsWith("Cấm:")).map((s) => `${c.character.name} — ${s.replace("Cấm: ", "")}`));
  return [...base, ...fromCanon];
}

function buildConsistencyNotes(characters: CharacterOutput[]): string[] {
  return characters.map(
    (c) => `${c.character.name}: consistencyScore=${c.consistencyScore} (1 = khớp hoàn toàn canon, lấy trực tiếp từ Character Agent, không tự suy diễn).`,
  );
}

export async function buildPromptPack(topic: string): Promise<PromptPack> {
  const resolved = await resolveCharacters(topic);
  const characters = resolved.characters;

  return {
    characterReferences: characters.map(toReference),
    sceneDescription: buildSceneDescription(topic, characters),
    style: STYLE,
    pose: buildPose(characters),
    expression: buildExpression(characters),
    cameraAngle: CAMERA_ANGLE,
    background: buildBackground(characters),
    negativePrompts: buildNegativePrompts(characters),
    consistencyNotes: buildConsistencyNotes(characters),
  };
}
