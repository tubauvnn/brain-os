// Điểm vào duy nhất mà code bên ngoài src/lib/stt/ nên import — không import
// trực tiếp từ stt-router.ts/providers/* ở nơi khác (cùng quy ước
// src/lib/voice/index.ts, ARCHITECTURE_RULES_V1.md Điều 4.1).
export { SttRouter, DEFAULT_STT_PROVIDER } from "./stt-router";
export type { SttProvider, SttTranscribeInput, SttTranscribeResult } from "./types";
