import { resolveCharacters } from "@/lib/character";
import type { CharacterOutput } from "@/lib/character";
import type { CharacterReference, PromptPack } from "./types";

// Image Agent — dựng Prompt Pack JSON có cấu trúc cho 1 cảnh minh hoạ, dùng
// Character Agent (src/lib/character/) làm NGUỒN SỰ THẬT DUY NHẤT cho mọi dữ
// liệu nhân vật (appearance/colors/forbiddenChanges/canonImagePath/...). Image
// Agent KHÔNG tự suy diễn ngoại hình nhân vật — chỉ gọi resolveCharacters()
// rồi đóng gói lại thành prompt pack, style/pose/expression/cameraAngle/
// background dựng theo template cố định (KHÔNG gọi model/API ngoài, đúng yêu
// cầu Phase 6).
//
// ChinChin Character Canon: mọi CharacterReference PHẢI mang canonImagePath
// (ảnh THẬT tại assets/chinchin/characters/, xem src/lib/character/canon.ts)
// — provider ảnh thật sau này (DALL-E/Midjourney/Stable Diffusion/Veo/...)
// LUÔN load ảnh này trước khi sinh nội dung. Nếu kết quả mâu thuẫn với ảnh
// canon, ảnh canon luôn thắng — không tự thiết kế lại nhân vật.

const STYLE = "Phong cách hoạt hình 2D dễ thương (chibi), màu sắc tươi sáng, đúng nhận diện thương hiệu ChinChin.";
const CAMERA_ANGLE = "Góc máy ngang tầm mắt, cận trung (medium shot).";

function toReference(c: CharacterOutput): CharacterReference {
  return {
    id: c.character.id,
    name: c.character.name,
    visualPrompt: c.visualPrompt,
    forbiddenChanges: c.styleGuide.filter((s) => s.startsWith("Cấm:")),
    consistencyScore: c.consistencyScore,
    canonImagePath: c.canonImagePath,
    canonImageAvailable: c.canonImageAvailable,
  };
}

function buildPose(characters: CharacterOutput[]): string {
  if (characters.length <= 1) return "Đứng thẳng, tư thế thân thiện, tay vẫy chào.";
  return `Đứng cạnh nhau theo nhóm (${characters.map((c) => c.character.name).join(", ")}), tạo dáng vui vẻ, đúng tỉ lệ chiều cao theo height chart canon.`;
}

function buildExpression(characters: CharacterOutput[]): string {
  return characters.map((c) => `${c.character.name}: biểu cảm đúng tính cách (${c.personality})`).join(" ");
}

function buildBackground(characters: CharacterOutput[]): string {
  const universe = characters[0]?.character.universe ?? "ChinChin";
  return `${universe} — không gian bếp/cửa hàng cơm nắm ấm cúng, tông màu pastel.`;
}

function buildSceneDescription(topic: string, characters: CharacterOutput[]): string {
  const names = characters.map((c) => c.character.name).join(", ");
  return `Cảnh minh hoạ: ${topic}. Nhân vật xuất hiện: ${names}.`;
}

function buildNegativePrompts(characters: CharacterOutput[]): string[] {
  const base = [
    "low quality",
    "blurry",
    "extra limbs",
    "off-model",
    "khác biệt so với ảnh canon (không tự thiết kế lại nhân vật)",
  ];
  const fromCanon = characters.flatMap((c) =>
    c.styleGuide.filter((s) => s.startsWith("Cấm:")).map((s) => `${c.character.name} — ${s.replace("Cấm: ", "")}`),
  );
  const missingCanon = characters
    .filter((c) => !c.canonImageAvailable)
    .map((c) => `CẢNH BÁO: không đọc được ảnh canon của ${c.character.name} tại ${c.canonImagePath} — không tự vẽ thay.`);
  return [...base, ...fromCanon, ...missingCanon];
}

function buildConsistencyNotes(characters: CharacterOutput[]): string[] {
  return [
    "Quy tắc bất biến: nếu kết quả sinh ra mâu thuẫn với ảnh canon, ẢNH CANON LUÔN THẮNG — không tự thiết kế lại proportions/màu sắc/silhouette/biểu tượng/nét mặt/tính cách.",
    ...characters.map(
      (c) =>
        `${c.character.name}: consistencyScore=${c.consistencyScore} · canonImagePath=${c.canonImagePath} · canonImageAvailable=${c.canonImageAvailable} (dữ liệu lấy trực tiếp từ Character Agent, không tự suy diễn).`,
    ),
  ];
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
    heightChartReference: characters[0]?.heightChartCanonPath,
  };
}
