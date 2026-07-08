import { NextRequest, NextResponse } from "next/server";

const DEFAULT_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "coral";
const TIMEOUT_MS = 20_000;
const MAX_TEXT_CHARS = 2000;

const INSTRUCTIONS = "Nói tiếng Việt giọng Bắc, thân thiện, ngắn gọn, tự nhiên, giống robot mascot ChinChin.";

// Trả thẳng audio nhị phân (không bọc JSON) để client play trực tiếp bằng
// HTMLAudioElement. Không log text đầy đủ, không log OPENAI_API_KEY.
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Body phải là JSON hợp lệ." }, { status: 400 });
    }

    const { text, voice } = (body ?? {}) as { text?: unknown; voice?: unknown };
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ ok: false, error: 'Thiếu "text" hoặc rỗng.' }, { status: 400 });
    }
    const boundedText = text.trim().slice(0, MAX_TEXT_CHARS);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY chưa được cấu hình." }, { status: 500 });
    }

    const model = process.env.OPENAI_TTS_MODEL || DEFAULT_MODEL;
    const resolvedVoice =
      (typeof voice === "string" && voice.trim()) || process.env.OPENAI_TTS_VOICE || DEFAULT_VOICE;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          voice: resolvedVoice,
          input: boundedText,
          instructions: INSTRUCTIONS,
          response_format: "mp3",
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        return NextResponse.json({ ok: false, error: `OpenAI TTS API lỗi: ${res.status}` }, { status: 502 });
      }

      const audio = await res.arrayBuffer();
      return new NextResponse(audio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      const timedOut = e instanceof Error && e.name === "AbortError";
      return NextResponse.json(
        { ok: false, error: timedOut ? `Timeout sau ${TIMEOUT_MS / 1000}s` : "Không gọi được OpenAI TTS API" },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Lỗi không xác định" }, { status: 500 });
  }
}
