import { NextRequest, NextResponse } from "next/server";
import { SttRouter, DEFAULT_STT_PROVIDER } from "@/lib/stt";
import { log } from "@/lib/logger";

// POST /api/robot/transcribe — Phase 6I "Speech-to-text provider contract".
// Route CHỈ điều phối: đọc multipart form-data → SttRouter.resolve() → gọi
// qua interface → trả text. Không log audio raw, không log OPENAI_API_KEY,
// không tự ghi ConversationMessage — client gửi tiếp transcript sang
// /api/robot/chat (source:"voice") mới là nơi lưu hội thoại thật, cùng 1
// đường transcript đi qua dù ghi tay hay nói ra.
//
// sessionId/source nhận vào CHỈ để tương thích API với /api/robot/chat (client
// gửi kèm cho nhất quán, đúng dạng transcribeAudio({audio, language, sessionId,
// partial}) yêu cầu) — route này không tự dùng 2 field đó.
function fail(error: string, status: number, provider: string) {
  return NextResponse.json({ ok: false, text: "", provider, error }, { status });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Body phải là multipart/form-data.", 400, DEFAULT_STT_PROVIDER);
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return fail("Thiếu file audio hoặc file rỗng.", 400, DEFAULT_STT_PROVIDER);
  }
  const language = typeof form.get("language") === "string" ? (form.get("language") as string) : "vi";
  const providerName = typeof form.get("provider") === "string" ? (form.get("provider") as string) : DEFAULT_STT_PROVIDER;

  const provider = SttRouter.resolve(providerName);
  if (!provider) {
    const error = `Không tìm thấy STT provider "${providerName}".`;
    await log({ action: "stt.transcribe.failed", entity: "SttTranscription", payload: { provider: providerName, error } });
    return fail(error, 400, providerName);
  }

  const result = await provider.transcribe({ audio, language });
  const durationMs = Date.now() - startedAt;

  if (result.status === "error") {
    await log({ action: "stt.transcribe.failed", entity: "SttTranscription", payload: { provider: provider.name, error: result.error, durationMs } });
    return fail(result.error ?? "Nhận diện giọng nói thất bại.", 502, provider.name);
  }

  if (result.status === "empty") {
    // Không phải lỗi hệ thống — chỉ là không nghe ra được gì (im lặng/tiếng
    // ồn, mục 4 "Do not upload continuous silent audio" phía client vẫn nên
    // tránh gửi trường hợp này, đây là lưới an toàn phía server). ok:false
    // nhẹ nhàng, client biết bỏ qua, KHÔNG gửi message rỗng lên chat (mục 15).
    return NextResponse.json({ ok: false, text: "", provider: provider.name, durationMs: result.durationMs, error: "Không nghe rõ nội dung." });
  }

  await log({ action: "stt.transcribe.completed", entity: "SttTranscription", payload: { provider: provider.name, durationMs, textLength: result.text?.length ?? 0 } });
  return NextResponse.json({ ok: true, text: result.text, provider: provider.name, durationMs: result.durationMs });
}
