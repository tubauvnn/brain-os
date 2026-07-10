import type { ImageGenerationInput, ImageGenerationResult, ImageGeneratorProvider } from "../types";

const DEFAULT_MODEL = "gpt-image-1";
const DEFAULT_SIZE = "1024x1024";
const TIMEOUT_MS = 60_000; // sinh ảnh chậm hơn nhiều so với chat/TTS — cùng lý do timeout dài hơn model/voice provider
const MAX_PROMPT_CHARS = 4000;

type OpenAiImageResponse = {
  data?: { b64_json?: string }[];
};

// OpenAI Images Provider — GỌI THẬT api.openai.com/v1/images/generations, KHÔNG
// mock (đúng yêu cầu Phase 4 "no mock provider"). Không dùng SDK vendor, gọi
// REST trực tiếp — cùng quy ước raw fetch() đã dùng cho
// src/lib/model/providers/openai.ts và src/lib/voice/providers/elevenlabs.ts
// (Phase 1/Voice Provider, KHÔNG sửa). gpt-image-1 KHÔNG có tham số negative
// prompt riêng (khác Stable Diffusion) — negativePrompts được gộp vào cuối
// prompt dưới dạng chỉ dẫn "Tránh: ...". API cũng KHÔNG trả cost USD trực
// tiếp — costUsd luôn để undefined ở đây (Cost Manager áp giá ước lượng cấu
// hình được, không bịa số ở tầng provider, cùng nguyên tắc ElevenLabs
// provider).
export const openAiImageProvider: ImageGeneratorProvider = {
  name: "openai-image",

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const prompt = input.prompt?.trim();
    if (!prompt) return { status: "error", error: "Thiếu prompt hoặc prompt rỗng." };
    if (prompt.length > MAX_PROMPT_CHARS) {
      return { status: "error", error: `Prompt vượt giới hạn ${MAX_PROMPT_CHARS} ký tự.` };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { status: "error", error: "OPENAI_API_KEY chưa được cấu hình." };

    const model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
    const size = input.size || (process.env.OPENAI_IMAGE_SIZE as ImageGenerationInput["size"]) || DEFAULT_SIZE;

    const finalPrompt = input.negativePrompts?.length
      ? `${prompt}\n\nTránh (negative prompt): ${input.negativePrompts.join(", ")}.`
      : prompt;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: finalPrompt,
          size,
          n: 1,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: { message?: string } };
          detail = body.error?.message ?? "";
        } catch {
          // body không phải JSON — bỏ qua, dùng status code làm thông tin chính
        }
        const reason =
          res.status === 401
            ? "OpenAI từ chối API key (401) — kiểm tra OPENAI_API_KEY."
            : `OpenAI Images API lỗi (${res.status})${detail ? `: ${detail}` : ""}.`;
        return { status: "error", error: reason };
      }

      const data = (await res.json()) as OpenAiImageResponse;
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) return { status: "error", error: "OpenAI không trả về dữ liệu ảnh (b64_json)." };

      const imageBuffer = Buffer.from(b64, "base64");
      if (imageBuffer.length === 0) return { status: "error", error: "OpenAI trả về ảnh rỗng." };

      return { status: "success", imageBuffer, mimeType: "image/png", costUsd: undefined };
    } catch (e) {
      const timedOut = e instanceof Error && e.name === "AbortError";
      return {
        status: "error",
        error: timedOut ? `Timeout sau ${TIMEOUT_MS / 1000}s gọi OpenAI Images API.` : "Không gọi được OpenAI Images API.",
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
