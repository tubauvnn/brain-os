// STT Provider abstraction — Phase 6I, CÙNG pattern với src/lib/voice/
// (VoiceProvider) và src/lib/vision/ (VisionProvider): route CHỈ gọi qua
// interface này, không bao giờ gọi thẳng fetch() tới OpenAI hay bất kỳ
// vendor STT nào — thêm provider thứ 2 (Deepgram/Whisper tự host/Azure...)
// sau này chỉ cần thêm 1 file trong providers/ + 1 dòng registry
// (stt-router.ts), không sửa route/RobotAgent.

export type SttTranscribeInput = {
  /** File audio đã ghi (webm/ogg/mp4/wav...) — Blob/File từ multipart form-data, KHÔNG phải audio thô/PCM. */
  audio: Blob;
  /** Mã ngôn ngữ ISO-639-1, mặc định "vi" (tiếng Việt) — xem DEFAULT_LANGUAGE trong provider. */
  language?: string;
};

export type SttTranscribeResult = {
  status: "success" | "empty" | "error";
  /** Chỉ có khi status="success". "empty" nghĩa là gọi provider thành công nhưng không nghe ra chữ nào (im lặng/tiếng ồn) — KHÔNG phải lỗi hệ thống. */
  text?: string;
  durationMs?: number;
  error?: string;
};

export interface SttProvider {
  readonly name: string;
  transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult>;
}
