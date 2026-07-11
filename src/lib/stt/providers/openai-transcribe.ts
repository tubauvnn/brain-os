import type { SttProvider, SttTranscribeInput, SttTranscribeResult } from "../types";

// Chuyển nguyên logic đã có (từng nằm trực tiếp trong
// src/app/api/robot/transcribe/route.ts trước Phase 6I) vào đây — vẫn raw
// fetch() tới OpenAI, không dùng SDK vendor nào, đúng quy ước xuyên suốt dự
// án (Model/Vision/Voice Router đều vậy).

const DEFAULT_MODEL = "gpt-4o-mini-transcribe";
const DEFAULT_LANGUAGE = "vi";
const TIMEOUT_MS = 20_000;

type OpenAiTranscriptionResponse = { text?: string };

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

// OpenAI dùng phần mở rộng tên file để nhận diện định dạng audio — đặt cứng
// "speech.webm" bất kể content-type thật sẽ khiến request bị từ chối (400)
// nếu client gửi định dạng khác (vd Safari ghi audio/mp4, không phải webm).
function resolveFilename(file: Blob): string {
  const name = file instanceof File ? file.name : "";
  if (name && /\.[a-z0-9]+$/i.test(name)) return name;
  const ext = EXT_BY_MIME[file.type] ?? "webm";
  return `speech.${ext}`;
}

async function transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { status: "error", error: "OPENAI_API_KEY chưa được cấu hình." };

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_MODEL;
  const language = input.language || DEFAULT_LANGUAGE;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const form = new FormData();
    form.append("file", input.audio, resolveFilename(input.audio));
    form.append("model", model);
    if (language) form.append("language", language);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;

    if (!res.ok) return { status: "error", durationMs, error: `OpenAI transcribe API lỗi: ${res.status}` };

    const data = (await res.json()) as OpenAiTranscriptionResponse;
    const text = (data.text ?? "").trim();
    if (!text) return { status: "empty", durationMs };

    return { status: "success", text, durationMs };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return { status: "error", error: timedOut ? `Timeout sau ${TIMEOUT_MS / 1000}s` : "Không gọi được OpenAI transcribe API" };
  } finally {
    clearTimeout(timeout);
  }
}

export const openAiTranscribeProvider: SttProvider = {
  name: "openai_transcribe",
  transcribe,
};
