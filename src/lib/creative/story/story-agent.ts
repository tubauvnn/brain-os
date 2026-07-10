import { z } from "zod";
import { resolveCharacters } from "@/lib/character";
import { ModelRouter, DEFAULT_MODEL_PROVIDER } from "@/lib/model";
import type { StoryAgentResult, StoryOutline } from "./types";

// Story Agent — RUNTIME thật đầu tiên của Creative Studio (Phase 4):
//
//     Topic → Character Agent (canon) → Model Router (OpenAI) → JSON Story Outline
//
// KHÔNG dùng template cố định (khác src/lib/video/planner.ts, Phase 3) — gọi
// thẳng Model Router (src/lib/model/, KHÔNG sửa) để sinh nội dung thật. Luôn
// resolveCharacters(topic) TRƯỚC (Phase 3, KHÔNG sửa) và nhét cast + tính
// cách + giọng nói vào Context — model bị RÀNG BUỘC chỉ được dùng cast đó,
// không tự bịa nhân vật khác (đúng nguyên tắc canon-first đã áp dụng cho
// Image Agent). Model Router hiện KHÔNG hỗ trợ JSON mode (Phase 1, không sửa)
// nên parse phải phòng thủ: bóc code fence/text thừa, JSON.parse, validate
// zod — lỗi ở bất kỳ bước nào trả {status:"error"}, KHÔNG throw, KHÔNG bịa
// dữ liệu thay thế.

const MIN_SCENES = 3;
const MAX_SCENES = 8;

const DialogueLineSchema = z.object({
  character: z.string().min(1),
  line: z.string().min(1),
});

const SceneSeedSchema = z.object({
  index: z.number().int().positive(),
  description: z.string().min(1),
  location: z.string().min(1).default("Không xác định"),
  props: z.array(z.string()).default([]),
  dialogue: z.array(DialogueLineSchema).default([]),
});

const StoryOutlineSchema = z.object({
  title: z.string().min(1),
  logline: z.string().min(1),
  theme: z.string().default(""),
  durationSeconds: z.number().int().positive().default(60),
  scenes: z.array(SceneSeedSchema).min(1),
});

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

function buildPrompt(topic: string, characterBriefs: string[]): { message: string; context: string } {
  const message = [
    `Viết 1 tập phim hoạt hình ngắn (animated episode) cho chủ đề: "${topic}".`,
    `Chỉ được dùng các nhân vật đã liệt kê trong Context (nếu có) — không bịa thêm nhân vật khác, không đổi tính cách/giọng nói của họ. Nếu Context không liệt kê nhân vật nào, tự sáng tạo nhân vật phù hợp chủ đề.`,
    `Chia thành ${MIN_SCENES}-${MAX_SCENES} cảnh (scenes), mỗi cảnh có index tăng dần từ 1, mô tả ngắn (description), địa điểm (location), đạo cụ xuất hiện (props, mảng chuỗi), và lời thoại (dialogue, mảng {character, line}).`,
    `Trả lời DUY NHẤT bằng 1 JSON object đúng schema sau, không thêm text nào khác, không thêm markdown code fence:`,
    `{"title": string, "logline": string, "theme": string, "durationSeconds": number, "scenes": [{"index": number, "description": string, "location": string, "props": string[], "dialogue": [{"character": string, "line": string}]}]}`,
  ].join("\n");

  const context = characterBriefs.length
    ? characterBriefs.join("\n")
    : "(Không có nhân vật canon nào được nhắc tới trong chủ đề.)";

  return { message, context };
}

export async function generateStory(topic: string): Promise<StoryAgentResult> {
  const trimmed = topic.trim();
  if (!trimmed) return { status: "error", error: "topic không được rỗng." };

  const resolved = await resolveCharacters(trimmed);
  const characterBriefs = resolved.characters.map(
    (c) => `- ${c.character.name} (${c.character.species}): ${c.personality} Giọng nói: ${c.voicePrompt}`,
  );

  const provider = ModelRouter.resolve(DEFAULT_MODEL_PROVIDER);
  if (!provider) {
    return { status: "error", error: `Không tìm thấy model provider "${DEFAULT_MODEL_PROVIDER}".` };
  }

  const { message, context } = buildPrompt(trimmed, characterBriefs);
  const result = await provider.generate({ message, context });

  if (result.status === "error" || !result.reply) {
    return { status: "error", error: result.error ?? "Model không trả về nội dung." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonBlock(result.reply));
  } catch {
    return { status: "error", error: "Model trả về JSON không hợp lệ (parse thất bại)." };
  }

  const parsed = StoryOutlineSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      status: "error",
      error: `Story JSON không khớp schema: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
    };
  }

  const story: StoryOutline = parsed.data;
  return { status: "success", story, charactersUsed: resolved.characters.map((c) => c.character.name) };
}
