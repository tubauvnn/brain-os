// Kiểu dùng chung cho Voice Conversation Engine (Phase 6I) — VadEngine/
// TurnStateMachine/fast-commands. Thuần logic, không đụng DOM/Web Audio API
// (đó là việc của VoiceCapture.tsx, component "use client" duy nhất chạm
// getUserMedia/AnalyserNode/MediaRecorder — cùng quy ước lib thuần/component
// DOM đã dùng xuyên suốt Presence/Social/Brain/Body).

// ─── Turn-taking (mục 6) ─────────────────────────────────────────────────
export type TurnState = "idle" | "listening" | "hearing" | "transcribing" | "thinking" | "speaking" | "interrupted" | "error";

export type TurnEvent =
  | "enable" // hands-free bật HOẶC push-to-talk bắt đầu 1 phiên
  | "speech_start" // VAD/thao tác tay: người dùng bắt đầu nói (từ speaking → barge-in)
  | "resume_capture" // sau interrupted, xác nhận đã bắt đầu ghi âm lượt mới → hearing
  | "speech_end" // VAD/thao tác tay: hết câu, sẵn sàng transcribe
  | "transcript_ready" // có transcript không rỗng → gửi đi
  | "transcript_empty" // không nghe ra gì — quay lại nghe, KHÔNG gửi message rỗng (mục 15)
  | "reply_ready" // /api/robot/chat đã trả lời → chuẩn bị phát audio
  | "playback_end" // phát xong (hoặc autoSpeak tắt, coi như "phát" xong ngay)
  | "playback_error"
  | "disable" // tắt hands-free/dừng hẳn → idle
  | "fail"; // lỗi chung (mic bị từ chối, mất mạng...) → error

export type TurnTransitionResult = { state: TurnState; changed: boolean };

// ─── VAD (mục 4) ─────────────────────────────────────────────────────────
export type VadEvent =
  | { kind: "speech_start"; at: number }
  | { kind: "speech_end"; at: number; durationMs: number; tooShort: boolean }
  | { kind: "max_utterance"; at: number; durationMs: number };

export type VoiceConfig = {
  /** RMS 0..1 — trên ngưỡng này coi là có tiếng nói, dưới là nền/ồn thấp. */
  vadThreshold: number;
  minSpeechMs: number;
  endSilenceMs: number;
  maxUtteranceMs: number;
};
