import type { VoiceGenerationInput, VoiceGenerationResult, VoiceProvider } from "../types";

const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const TIMEOUT_MS = 30_000;
const MAX_TEXT_CHARS = 5000; // giới hạn ElevenLabs công bố cho free/starter tier

// Không dùng SDK vendor — gọi REST trực tiếp, đúng quy ước đã có trong codebase
// (xem src/app/api/robot/tts/route.ts, src/lib/robot-ai/openai-provider.ts).
// Không bao giờ log/trả API key ở bất kỳ đâu, kể cả trong message lỗi.
export const elevenLabsProvider: VoiceProvider = {
  name: "elevenlabs",

  async generate(input: VoiceGenerationInput): Promise<VoiceGenerationResult> {
    const text = input.text?.trim();
    if (!text) {
      return { status: "error", error: "Thiếu text hoặc text rỗng." };
    }
    if (text.length > MAX_TEXT_CHARS) {
      return { status: "error", error: `Text vượt giới hạn ${MAX_TEXT_CHARS} ký tự.` };
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { status: "error", error: "ELEVENLABS_API_KEY chưa được cấu hình." };
    }

    const voiceId = input.voiceId?.trim() || process.env.ELEVENLABS_DEFAULT_VOICE_ID;
    if (!voiceId) {
      return {
        status: "error",
        error: "Thiếu voiceId — không có voiceId trong request lẫn ELEVENLABS_DEFAULT_VOICE_ID.",
      };
    }
    const modelId = input.modelId?.trim() || process.env.ELEVENLABS_DEFAULT_MODEL_ID || DEFAULT_MODEL_ID;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // ElevenLabs trả lỗi dạng JSON {"detail": {...}} — đọc để chẩn đoán
        // (vd voice id sai → 400/404), nhưng KHÔNG bao giờ đưa response thô
        // (có thể echo lại phần request) ra ngoài nguyên văn.
        let detail = "";
        try {
          const body = (await res.json()) as { detail?: { message?: string } | string };
          detail =
            typeof body.detail === "string" ? body.detail : body.detail?.message ?? "";
        } catch {
          // body không phải JSON — bỏ qua, dùng status code làm thông tin chính
        }
        const reason =
          res.status === 401
            ? "ElevenLabs từ chối API key (401) — kiểm tra ELEVENLABS_API_KEY."
            : res.status === 404
              ? `Không tìm thấy voiceId "${voiceId}" (404).`
              : `ElevenLabs API lỗi (${res.status})${detail ? `: ${detail}` : ""}.`;
        return { status: "error", error: reason };
      }

      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);
      if (audioBuffer.length === 0) {
        return { status: "error", error: "ElevenLabs trả về audio rỗng." };
      }

      return {
        status: "success",
        audioBuffer,
        mimeType: "audio/mpeg",
        durationMs: Date.now() - startedAt, // thời gian gọi API, KHÔNG phải độ dài audio (ElevenLabs không trả field này)
        cost: undefined, // ElevenLabs không trả cost trong response — để trống, không bịa số
      };
    } catch (e) {
      const timedOut = e instanceof Error && e.name === "AbortError";
      return {
        status: "error",
        error: timedOut ? `Timeout sau ${TIMEOUT_MS / 1000}s gọi ElevenLabs.` : "Không gọi được ElevenLabs API.",
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
