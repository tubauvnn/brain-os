import type { ModelProvider, ModelGenerationInput, ModelGenerationResult } from "../types";

const DEFAULT_MODEL = "gpt-5.4-nano";
const TIMEOUT_MS = 20_000;
const MAX_CONTEXT_CHARS = 8000;
const MAX_MESSAGE_CHARS = 4000;

// System prompt tổng quát — KHÔNG mang persona robot (mood/action/eyes/mouth,
// xem src/lib/robot-ai/*). Conversation Agent là entry point chung cho mọi
// client (Web/Robot/Voice/Mobile/API); presentation riêng của từng client (vd
// robot dịch reply thành face/action) là việc của client đó, không phải Agent.
const SYSTEM_PROMPT = [
  "Bạn là trợ lý hội thoại của Brain OS.",
  "Trả lời ngắn gọn, chính xác, tự nhiên.",
  "Nếu có Context (Memory/Knowledge) được cung cấp, ưu tiên dùng đúng thông tin trong đó — không bịa thêm.",
  "Nếu Context không liên quan tới câu hỏi, bỏ qua, trả lời bình thường.",
  "Không dùng các từ 'mock'/'demo'/'placeholder'/'fake' để mô tả câu trả lời hoặc bản thân. Nếu điều gì đó chưa thật/chưa kết nối, nói rõ bằng tiếng Việt tự nhiên (vd \"chưa kết nối phần cứng thật\", \"chưa có dữ liệu thật\").",
].join("\n");

type OpenAiChatResponse = {
  choices?: { message?: { content?: string } }[];
};

async function generate(input: ModelGenerationInput): Promise<ModelGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { status: "error", error: "OPENAI_API_KEY chưa được cấu hình." };

  const message = input.message.trim();
  if (!message) return { status: "error", error: "message không được rỗng." };
  if (message.length > MAX_MESSAGE_CHARS) {
    return { status: "error", error: `message vượt quá ${MAX_MESSAGE_CHARS} ký tự.` };
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const context = input.context ?? "";
  const boundedContext =
    context.length > MAX_CONTEXT_CHARS
      ? `${context.slice(0, MAX_CONTEXT_CHARS)}\n...(context bị cắt bớt, vượt giới hạn ${MAX_CONTEXT_CHARS} ký tự)`
      : context;

  const userContent = [
    boundedContext ? `Context:\n${boundedContext}` : "Context: (không có)",
    `User: ${message}`,
  ].join("\n\n");

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
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { status: "error", error: `OpenAI API lỗi: ${res.status}` };
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return { status: "error", error: "OpenAI không trả về nội dung." };

    return { status: "success", reply, model };
  } catch (e) {
    const error = e instanceof Error && e.name === "AbortError" ? "OpenAI timeout." : "Không gọi được OpenAI.";
    return { status: "error", error };
  } finally {
    clearTimeout(timeout);
  }
}

export const openAiProvider: ModelProvider = { name: "openai", generate };
