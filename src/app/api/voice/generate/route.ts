import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { VoiceRouter, DEFAULT_VOICE_PROVIDER } from "@/lib/voice";
import { saveVoiceAudio } from "@/lib/voice/storage";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

const GenerateSchema = z.object({
  text: z.string().min(1, "text không được rỗng").max(5000),
  voiceId: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  provider: z.string().min(1).optional(), // dự phòng cho provider thứ 2 sau này, mặc định elevenlabs
});

// POST /api/voice/generate — Brain OS phía đầu chuỗi:
//   Brain OS (route này) → VoiceRouter → VoiceProvider interface → ElevenLabs Provider
// Route CHỈ điều phối: validate → VoiceRouter.resolve() → gọi qua interface →
// lưu file → trả response. Route này (và mọi thứ ngoài src/lib/voice/providers/)
// KHÔNG BAO GIỜ được nhắc tên "elevenlabs" như 1 nhánh logic — chỉ như 1 chuỗi
// tên provider tự do, đối xử y hệt bất kỳ tên provider nào khác.
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body phải là JSON hợp lệ." }, { status: 400 });
  }

  const parsed = GenerateSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join(", ");
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
  const { text, voiceId, modelId, provider: providerName } = parsed.data;
  const resolvedProviderName = providerName ?? DEFAULT_VOICE_PROVIDER;

  await log({
    action: "voice.generate.started",
    entity: "VoiceGeneration",
    payload: { provider: resolvedProviderName, textLength: text.length, voiceId, modelId },
  });

  const provider = VoiceRouter.resolve(resolvedProviderName);
  if (!provider) {
    const error = `Không tìm thấy voice provider "${resolvedProviderName}".`;
    await log({
      action: "voice.generate.failed",
      entity: "VoiceGeneration",
      payload: { provider: resolvedProviderName, error, latencyMs: Date.now() - startedAt },
    });
    return NextResponse.json({ success: false, provider: resolvedProviderName, error }, { status: 400 });
  }

  await log({
    action: "voice.generate.provider_selected",
    entity: "VoiceGeneration",
    payload: { provider: provider.name },
  });

  const result = await provider.generate({ text, voiceId, modelId });
  const latencyMs = Date.now() - startedAt;

  if (result.status === "error" || !result.audioBuffer) {
    await log({
      action: "voice.generate.failed",
      entity: "VoiceGeneration",
      payload: { provider: provider.name, error: result.error, latencyMs },
    });
    return NextResponse.json(
      { success: false, provider: provider.name, error: result.error ?? "Sinh audio thất bại." },
      { status: 502 }
    );
  }

  let audioUrl: string;
  try {
    const saved = saveVoiceAudio(result.audioBuffer, result.mimeType ?? "audio/mpeg");
    audioUrl = saved.audioUrl;
    await log({
      action: "voice.generate.audio_saved",
      entity: "VoiceGeneration",
      payload: { provider: provider.name, audioUrl: saved.audioUrl, audioPath: saved.audioPath },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Không lưu được file audio.";
    await log({
      action: "voice.generate.failed",
      entity: "VoiceGeneration",
      payload: { provider: provider.name, error, latencyMs: Date.now() - startedAt },
    });
    return NextResponse.json({ success: false, provider: provider.name, error }, { status: 500 });
  }

  await log({
    action: "voice.generate.completed",
    entity: "VoiceGeneration",
    payload: { provider: provider.name, audioUrl, latencyMs, cost: result.cost ?? null },
  });

  return NextResponse.json({
    success: true,
    provider: provider.name,
    audioUrl,
    duration: result.durationMs,
    cost: result.cost,
    latencyMs,
  });
}
