import type { VadEvent, VoiceConfig } from "./types";

// VadEngine — Phase 6I mục 4 "VAD". Thuần logic — nhận 1 chuỗi mẫu RMS
// volume (0..1, VoiceCapture.tsx tự tính từ AnalyserNode mỗi ~50-100ms) qua
// feed(now, rmsLevel), tự quyết định speech_start/speech_end/max_utterance.
// KHÔNG đụng Web Audio API/MediaStream ở đây — dễ test bằng chuỗi số thuần
// (xem cách AttentionEngine/PresenceEngine các phase trước đã làm).
//
// 4 hành vi bắt buộc của yêu cầu gốc, map trực tiếp:
//   - "detect speech start"          → speech_start (sau khi giữ trên
//     ngưỡng đủ minSpeechMs, không phải chớm chạm ngưỡng là báo ngay)
//   - "detect speech end"            → speech_end (im lặng liên tục đủ
//     endSilenceMs)
//   - "ignore low-level background noise" → vadThreshold
//   - "minimum speech duration"      → minSpeechMs (lọc tiếng động ngắn/tạp âm)
//   - "maximum utterance duration"   → maxUtteranceMs → max_utterance
//   - "configurable silence timeout" → endSilenceMs

// Cấu hình qua NEXT_PUBLIC_* (đọc được ở browser, khác biến server-only như
// OPENAI_API_KEY) — đúng TÊN "Config:" yêu cầu gốc liệt kê, chỉ thêm tiền tố
// bắt buộc của Next.js để lộ ra client. Có default an toàn nếu chưa set.
function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  vadThreshold: envNumber("NEXT_PUBLIC_VOICE_VAD_THRESHOLD", 0.025),
  minSpeechMs: envNumber("NEXT_PUBLIC_VOICE_MIN_SPEECH_MS", 300),
  endSilenceMs: envNumber("NEXT_PUBLIC_VOICE_END_SILENCE_MS", 700),
  maxUtteranceMs: envNumber("NEXT_PUBLIC_VOICE_MAX_UTTERANCE_MS", 30_000),
};

export class VadEngine {
  private config: VoiceConfig;
  private speaking = false;
  private speechStartedAt: number | null = null;
  private lastAboveThresholdAt: number | null = null;

  constructor(config: Partial<VoiceConfig> = {}) {
    this.config = { ...DEFAULT_VOICE_CONFIG, ...config };
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  /** Ghi đè ngưỡng VAD tại chỗ, không reset state đang dở (mục 7 "speaking-state gating" — robot đang nói thì khó kích hoạt hơn, KHÔNG tắt hẳn). `undefined` = quay lại mặc định. */
  setThreshold(value: number | undefined): void {
    this.config.vadThreshold = value ?? DEFAULT_VOICE_CONFIG.vadThreshold;
  }

  reset(): void {
    this.speaking = false;
    this.speechStartedAt = null;
    this.lastAboveThresholdAt = null;
  }

  /** Nạp 1 mẫu RMS volume (0..1) tại thời điểm `now` (ms) — trả về event nếu trạng thái vừa đổi, null nếu chưa có gì mới. */
  feed(now: number, rmsLevel: number): VadEvent | null {
    const aboveThreshold = rmsLevel >= this.config.vadThreshold;
    if (aboveThreshold) this.lastAboveThresholdAt = now;

    if (!this.speaking) {
      if (!aboveThreshold) {
        this.speechStartedAt = null; // im lặng trở lại trước khi đủ minSpeechMs — chưa từng là câu nói thật
        return null;
      }
      if (this.speechStartedAt === null) this.speechStartedAt = now;
      if (now - this.speechStartedAt < this.config.minSpeechMs) return null; // chưa đủ lâu — có thể chỉ là tiếng động ngắn
      this.speaking = true;
      return { kind: "speech_start", at: this.speechStartedAt };
    }

    // speaking === true từ đây.
    const startedAt = this.speechStartedAt ?? now;
    if (now - startedAt >= this.config.maxUtteranceMs) {
      const durationMs = now - startedAt;
      this.reset();
      return { kind: "max_utterance", at: now, durationMs };
    }

    const silenceMs = this.lastAboveThresholdAt === null ? Infinity : now - this.lastAboveThresholdAt;
    if (silenceMs >= this.config.endSilenceMs) {
      const endedAt = this.lastAboveThresholdAt ?? now;
      const durationMs = endedAt - startedAt;
      this.reset();
      return { kind: "speech_end", at: now, durationMs, tooShort: durationMs < this.config.minSpeechMs };
    }

    return null;
  }
}
