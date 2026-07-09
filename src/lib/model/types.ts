// Model Provider abstraction — cùng pattern đã dùng cho Voice (src/lib/voice/types.ts).
// Conversation Agent không bao giờ gọi thẳng fetch() tới OpenAI/Claude — chỉ gọi
// qua interface này. Thêm provider thứ 2 (Claude/Gemini...) sau này chỉ cần thêm
// 1 file trong providers/ + 1 dòng trong model-router.ts, không sửa Agent.

export type ModelGenerationInput = {
  message: string;
  // Context đã được Agent assembly sẵn (Memory + Knowledge, dạng text) — provider
  // không tự đi đọc Memory/Knowledge.
  context?: string;
};

export type ModelGenerationResult = {
  status: "success" | "error";
  reply?: string;
  model?: string;
  error?: string;
};

export interface ModelProvider {
  readonly name: string;
  generate(input: ModelGenerationInput): Promise<ModelGenerationResult>;
}
