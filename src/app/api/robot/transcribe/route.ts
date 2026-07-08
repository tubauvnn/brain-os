import { NextRequest, NextResponse } from "next/server";

const DEFAULT_MODEL = "gpt-4o-mini-transcribe";
const TIMEOUT_MS = 20_000;
const PROVIDER = "openai_transcribe";

type OpenAiTranscriptionResponse = {
  text?: string;
};

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
// "speech.webm" bất kể content-type thật sẽ khiến request bị từ chối (400) nếu
// client gửi định dạng khác (vd Safari ghi audio/mp4, không phải webm).
function resolveFilename(file: Blob): string {
  const name = file instanceof File ? file.name : "";
  if (name && /\.[a-z0-9]+$/i.test(name)) return name;
  const ext = EXT_BY_MIME[file.type] ?? "webm";
  return `speech.${ext}`;
}

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, text: "", provider: PROVIDER, error }, { status });
}

// Không log audio raw, không log OPENAI_API_KEY, không log sessionId/nội dung
// nhạy cảm — chỉ forward file lên OpenAI và trả lại text. Lỗi thì trả message
// ngắn gọn, không kèm nội dung nhạy cảm. sessionId/source nhận để tương thích
// API với /api/robot/chat (client gửi kèm), route này không tự ghi DB — việc
// lưu ConversationMessage diễn ra khi transcript được gửi tiếp sang /api/robot/chat.
export async function POST(req: NextRequest) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail("Body phải là multipart/form-data.", 400);
    }

    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return fail("Thiếu file audio hoặc file rỗng.", 400);
    }

    const language = typeof form.get("language") === "string" ? (form.get("language") as string) : "vi";
    // sessionId/source: chỉ để tương thích API với /api/robot/chat (client gửi
    // kèm cho nhất quán) — route này không tự ghi DB nên không cần đọc ra.

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return fail("OPENAI_API_KEY chưa được cấu hình.", 500);
    }

    const model = process.env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_MODEL;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const openaiForm = new FormData();
      openaiForm.append("file", audio, resolveFilename(audio));
      openaiForm.append("model", model);
      if (language) openaiForm.append("language", language);

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: openaiForm,
        signal: controller.signal,
      });
      const durationMs = Date.now() - startedAt;

      if (!res.ok) {
        return fail(`OpenAI transcribe API lỗi: ${res.status}`, 502);
      }

      const data = (await res.json()) as OpenAiTranscriptionResponse;
      const text = (data.text ?? "").trim();
      if (!text) {
        // Không phải lỗi hệ thống — chỉ là không nghe ra được gì (im lặng/tiếng
        // ồn). Trả ok:false nhẹ nhàng để client biết bỏ qua, không crash.
        return NextResponse.json({ ok: false, text: "", provider: PROVIDER, durationMs, error: "Không nghe rõ nội dung." });
      }

      return NextResponse.json({ ok: true, text, provider: PROVIDER, durationMs });
    } catch (e) {
      const timedOut = e instanceof Error && e.name === "AbortError";
      return fail(timedOut ? `Timeout sau ${TIMEOUT_MS / 1000}s` : "Không gọi được OpenAI transcribe API", 502);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return fail("Lỗi không xác định", 500);
  }
}
