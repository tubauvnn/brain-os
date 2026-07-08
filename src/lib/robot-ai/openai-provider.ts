import {
  isRobotAction,
  isRobotEyes,
  isRobotMood,
  isRobotMouth,
  type RobotChatResult,
} from "./types";
import { CHUOI_PROFILE } from "./chuoi-profile";

const DEFAULT_MODEL = "gpt-5.4-nano";
const TIMEOUT_MS = 20_000;
const MAX_CONTEXT_CHARS = 8000;
const MAX_OUTPUT_TOKENS = 120;

// Persona đầy đủ của Chuối cho OpenAI — chỉ dùng cho câu ngoài local skill
// (xem src/lib/robot-ai/local-skills.ts, luôn chạy trước và không gọi OpenAI).
// Build từ CHUOI_PROFILE (chuoi-profile.ts) — đổi persona thì sửa ở đó, không
// sửa chuỗi cứng ở đây.
const SYSTEM_PROMPT = [
  `Bạn là ${CHUOI_PROFILE.name}, ${CHUOI_PROFILE.identity}. Bạn không phải chatbot thông thường; bạn là ${CHUOI_PROFILE.role}.`,
  `Phong cách nói: ${CHUOI_PROFILE.speakingStyle.join(", ")}.`,
  `Quy tắc bắt buộc: ${CHUOI_PROFILE.rules.join(" ")}`,
  "",
  "Luôn trả JSON hợp lệ, không markdown, không giải thích ngoài JSON. Schema bắt buộc (đủ các trường, không thiếu trường nào):",
  "{",
  '  "reply": string,',
  '  "mood": "idle" | "happy" | "listening" | "thinking" | "speaking" | "sleepy" | "error",',
  '  "action": "none" | "greet" | "introduce" | "look_left" | "look_right" | "look_center" | "smile" | "sleep" | "wake" | "demo_sales" | "demo_family" | "demo_security" | "demo_robot" | "move_forward" | "move_backward" | "turn_left" | "turn_right" | "stop",',
  '  "eyes": "left" | "right" | "center" | "up" | "down" | "track",',
  '  "mouth": "idle" | "smile" | "speaking" | "thinking" | "sleep"',
  "}",
  "",
  "Quy tắc thêm:",
  "- reply tối đa 2 câu, giọng thân thiện, dễ nghe.",
  "- mood/action/eyes/mouth chỉ được dùng đúng giá trị liệt kê ở trên.",
  '- Câu hỏi chung chung (chào hỏi, hỏi cảm nghĩ...) thì mood "speaking", eyes "center", mouth "speaking", action "none" trừ khi câu rõ ràng là một lệnh robot.',
  "- Không bịa dữ liệu ngoài context. Không tiết lộ private memory nếu không đủ quyền.",
].join("\n");

// Ngữ cảnh simulator — nhắc model rằng đây là demo web trước ESP32-S3, để
// reply "giống robot thật, không giống chatbot" như Phần 6 yêu cầu.
const SIMULATOR_CONTEXT =
  "Chuối đang là simulator trên web /robot. Sau này hardwareCommand sẽ map sang servo/motor/TFT. Mục tiêu demo là nhìn giống robot thật, không giống chatbot.";

type OpenAiChatResponse = {
  choices?: { message?: { content?: string } }[];
};

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

function extractJsonBlock(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

// Parse + validate JSON thô từ model. Chỉ "reply" rỗng mới coi là lỗi cứng —
// mood/action/eyes/mouth sai/thiếu thì tự sửa về giá trị an toàn thay vì vứt
// bỏ cả câu trả lời tốt (model đôi khi bỏ sót 1 trường dù đã dặn schema).
function parseRobotJson(raw: string): Omit<RobotChatResult, "ok" | "provider" | "model"> | null {
  try {
    const jsonText = extractJsonBlock(stripCodeFence(raw));
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    if (!reply) return null;

    return {
      reply,
      mood: isRobotMood(parsed.mood) ? parsed.mood : "speaking",
      action: isRobotAction(parsed.action) ? parsed.action : "none",
      eyes: isRobotEyes(parsed.eyes) ? parsed.eyes : "center",
      mouth: isRobotMouth(parsed.mouth) ? parsed.mouth : "speaking",
    };
  } catch {
    return null;
  }
}

// Provider chính (nhanh) cho câu ngoài local skill — gọi thẳng OpenAI Chat
// Completions API. Không log/in API key ở bất kỳ đâu (kể cả trong Error message).
export async function askRobotOpenAI(
  message: string,
  context: string = ""
): Promise<Omit<RobotChatResult, "ok" | "provider"> & { model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY chưa được cấu hình");

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const boundedContext =
    context.length > MAX_CONTEXT_CHARS
      ? `${context.slice(0, MAX_CONTEXT_CHARS)}\n...(context bị cắt bớt, vượt giới hạn ${MAX_CONTEXT_CHARS} ký tự)`
      : context;

  const userContent = [
    boundedContext ? `Context: ${boundedContext}` : "Context: (không có dữ liệu liên quan)",
    `Ghi chú: ${SIMULATOR_CONTEXT}`,
    `User nói: ${message}`,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`OpenAI API lỗi: ${res.status}`);
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI không trả về nội dung");

    const normalized = parseRobotJson(text);
    if (!normalized) throw new Error('OpenAI trả JSON không hợp lệ (thiếu "reply" hoặc sai schema)');
    return { ...normalized, model };
  } finally {
    clearTimeout(timeout);
  }
}
