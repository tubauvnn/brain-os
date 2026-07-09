// Voice Provider abstraction — bước đầu tiên, tối giản, KHÔNG phải Model Router
// đầy đủ (chưa tới lúc, xem docs/IMPLEMENTATION_ROADMAP_V1.md Phase 4). Mục
// đích duy nhất: route /api/voice/generate gọi qua interface này, không bao
// giờ gọi thẳng fetch() tới ElevenLabs — thêm provider thứ 2 sau này chỉ cần
// thêm 1 file + 1 dòng trong registry (index.ts), không sửa route.

export type VoiceGenerationInput = {
  text: string;
  voiceId?: string;
  modelId?: string;
};

export type VoiceGenerationResult = {
  status: "success" | "error";
  audioBuffer?: Buffer;
  mimeType?: string;
  durationMs?: number;
  cost?: number;
  error?: string;
};

export interface VoiceProvider {
  readonly name: string;
  generate(input: VoiceGenerationInput): Promise<VoiceGenerationResult>;
}
