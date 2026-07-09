// Điểm vào duy nhất mà code bên ngoài src/lib/voice/ nên import — không import
// trực tiếp từ voice-router.ts/providers/* ở nơi khác (ARCHITECTURE_RULES_V1.md
// Điều 4.1: giao tiếp qua hợp đồng, không qua triển khai).
export { VoiceRouter, DEFAULT_VOICE_PROVIDER } from "./voice-router";
export type { VoiceProvider, VoiceGenerationInput, VoiceGenerationResult } from "./types";
