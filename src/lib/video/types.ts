// Video contracts — cùng pattern Model Router / Voice Router / Device Manager
// (src/lib/model, src/lib/voice, src/lib/device): interface trước, provider cụ
// thể sau. Video Agent (video-agent.ts) là RUNTIME ORCHESTRATION cho pipeline
// Story Planner → Scene Planner → Prompt Generator → Provider. Provider là
// phần DUY NHẤT sẽ đổi khi có Veo/OpenAI/Kling thật — Story/Scene/Prompt
// Planner (planner.ts) là logic dùng chung, không phải thứ cần thay.

export type VideoRequest = {
  prompt: string;
  sessionId?: string;
};

export type VideoScene = {
  index: number;
  description: string;
  narration: string;
  imagePrompt: string;
  cameraMovement: string;
  durationSeconds: number;
};

// Output JSON — kết quả cuối cùng Video Agent trả về (đã gộp story + scenes +
// kết quả provider).
export type VideoPlan = {
  title: string;
  durationSeconds: number;
  scenes: VideoScene[];
  narration: string;
  imagePrompts: string[];
  cameraMovement: string[];
  music: string;
  status: "planned" | "failed";
  error?: string;
};

// Input đưa vào Provider — plan đã đầy đủ scenes + imagePrompt, provider chỉ
// việc render (hoặc, ở Phase 3, chỉ xác nhận plan hợp lệ — KHÔNG gọi API
// ngoài, KHÔNG có Veo/Runway/Kling thật).
export type VideoGenerationInput = {
  title: string;
  durationSeconds: number;
  scenes: VideoScene[];
};

export type VideoGenerationResult = {
  status: "planned" | "rendering" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
};

// Video Generator Provider — implement để render video thật (Veo/OpenAI/
// Kling) sau này. Provider KHÔNG tự log, KHÔNG tự tạo ExecutionContext, KHÔNG
// tự planning story/scene/prompt — Video Agent làm tất cả việc đó, provider
// chỉ nhận plan đã dựng xong và trả kết quả render.
export interface VideoGeneratorProvider {
  readonly name: string;
  generate(input: VideoGenerationInput): Promise<VideoGenerationResult>;
}
