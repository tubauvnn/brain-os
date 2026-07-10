import { buildPromptPack } from "@/lib/image";
import { getAllCharacters } from "@/lib/character";
import { getActiveProjectContext } from "@/lib/project";
import { recallLocationDescription } from "../project-memory/project-memory";
import type { ScenePromptInput, ScenePromptResult } from "./types";

// Prompt Builder — bước cuối trước khi có prompt sẵn sàng đưa cho Image
// Provider thật. Ghép 4 nguồn, đúng thứ tự yêu cầu Phase 4:
//   1. Character canon — tái dùng buildPromptPack() (src/lib/image/, Phase 3,
//      KHÔNG sửa) làm nguồn DUY NHẤT cho style/pose/expression/negative
//      prompts liên quan nhân vật — không tự viết lại logic canon.
//   2. Project style — storyBible/worldSettings của project ĐANG MỞ (Phase 7,
//      src/lib/project/, KHÔNG sửa), chỉ áp dụng khi projectId truyền vào
//      khớp đúng project đang mở (Phase 7 chỉ hỗ trợ 1 project active tại 1
//      thời điểm, không phải lookup theo id tuỳ ý).
//   3. Location context — tái dùng mô tả địa điểm đã "nhớ" từ asset đầu tiên
//      cùng locationTag (Project Memory, Phase 4) để các cảnh cùng bối cảnh
//      không bị vẽ khác nhau mỗi lần.
//   4. Negative prompts — hợp nhất negative prompts từ canon + bộ mặc định
//      Creative Studio (chất lượng ảnh chung, không liên quan nhân vật).

const DEFAULT_NEGATIVE_PROMPTS = [
  "text watermark",
  "signature",
  "deformed hands",
  "extra fingers",
  "duplicate character",
  "low resolution",
];

function characterNamesFor(ids: string[]): string[] {
  const all = getAllCharacters();
  return ids.map((id) => all.find((c) => c.id === id)?.name).filter((n): n is string => Boolean(n));
}

export async function buildScenePrompt(scene: ScenePromptInput, projectId?: string | null): Promise<ScenePromptResult> {
  const characterNames = characterNamesFor(scene.characterIds);
  // buildPromptPack() tự gọi resolveCharacters(topic) bên trong — nhét thẳng
  // tên nhân vật đã xác định (Scene Planner) vào topic để đảm bảo khớp ĐÚNG
  // tập nhân vật của cảnh này, không lệch theo suy đoán riêng của nó.
  const topic = [scene.description, ...characterNames].join(" ");
  const pack = await buildPromptPack(topic);

  const canonWarnings = pack.characterReferences
    .filter((c) => !c.canonImageAvailable || c.consistencyScore < 1)
    .map((c) => `${c.name}: canonImageAvailable=${c.canonImageAvailable}, consistencyScore=${c.consistencyScore}`);

  let projectStyle = "";
  if (projectId) {
    const active = await getActiveProjectContext();
    if (active && active.id === projectId) {
      projectStyle = [active.storyBible, active.worldSettings].filter(Boolean).join(" ");
    }
  }

  let locationContext = `Địa điểm: ${scene.locationTag}.`;
  if (projectId) {
    const recalled = await recallLocationDescription(projectId, scene.locationTag);
    if (recalled) locationContext = `Địa điểm (giữ nhất quán với cảnh trước cùng bối cảnh): ${recalled}`;
  }

  const propsContext = scene.propTags.length ? `Đạo cụ xuất hiện: ${scene.propTags.join(", ")}.` : "";

  const prompt = [
    pack.sceneDescription,
    pack.style,
    pack.pose,
    pack.expression,
    pack.cameraAngle,
    pack.background,
    locationContext,
    propsContext,
    projectStyle,
  ]
    .filter(Boolean)
    .join(" ");

  const negativePrompts = Array.from(new Set([...pack.negativePrompts, ...DEFAULT_NEGATIVE_PROMPTS]));

  return {
    prompt,
    negativePrompts,
    characterIds: scene.characterIds,
    locationTag: scene.locationTag,
    propTags: scene.propTags,
    canonWarnings,
  };
}
