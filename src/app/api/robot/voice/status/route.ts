import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { SttRouter, DEFAULT_STT_PROVIDER } from "@/lib/stt";
import { VoiceRouter, DEFAULT_VOICE_PROVIDER } from "@/lib/voice";

export const dynamic = "force-dynamic";

// GET /api/robot/voice/status — Phase 6I mục 14. Bản tóm tắt an toàn: có
// STT/TTS provider khả dụng không (đủ API key), để UI quyết định hiện nút
// mic/toggle hands-free hay giải thích lý do chưa dùng được (mục 15 "If
// microphone permission is denied... explain briefly" — cùng tinh thần,
// nhưng đây là kiểm tra CẤU HÌNH SERVER, không phải quyền trình duyệt).
// KHÔNG BAO GIỜ trả API key hay chi tiết provider nhạy cảm nào khác.
export async function GET() {
  try {
    const sttProvider = SttRouter.resolve(DEFAULT_STT_PROVIDER);
    const sttAvailable = !!sttProvider && !!process.env.OPENAI_API_KEY;

    const voiceProvider = VoiceRouter.resolve(DEFAULT_VOICE_PROVIDER);
    const ttsAvailable = !!voiceProvider && !!process.env.ELEVENLABS_API_KEY;

    return NextResponse.json({
      ok: true,
      stt: {
        provider: sttProvider?.name ?? null,
        available: sttAvailable,
        reason: sttAvailable ? undefined : "OPENAI_API_KEY chưa được cấu hình — không nhận diện giọng nói được.",
      },
      tts: {
        provider: voiceProvider?.name ?? null,
        available: ttsAvailable,
        reason: ttsAvailable ? undefined : "ELEVENLABS_API_KEY chưa được cấu hình — vẫn rơi về giọng trình duyệt (Web Speech API), không câm.",
      },
      // Hands-free cần STT thật (không thể VAD-driven nếu không transcribe
      // được) — TTS luôn có fallback giọng trình duyệt nên không chặn.
      handsFreeReady: sttAvailable,
    });
  } catch (e) {
    return handleError(e);
  }
}
