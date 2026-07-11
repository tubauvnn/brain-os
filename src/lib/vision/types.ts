// Vision Provider abstraction — cùng pattern Model/Voice/Video Router
// (src/lib/model, src/lib/voice, src/lib/video): interface trước, provider
// cụ thể sau. Route/handler KHÔNG BAO GIỜ gọi thẳng OpenAI Vision — chỉ qua
// interface này. Thêm provider thứ 2 (Claude Vision/Gemini Vision...) sau
// này chỉ cần thêm 1 file trong providers/ + 1 dòng trong vision-router.ts.

export type VisionMode =
  | "describe"
  | "identify_objects"
  | "read_text"
  | "inspect_scene"
  | "compare_with_previous"
  | "robot_context";

export const VISION_MODES: VisionMode[] = [
  "describe",
  "identify_objects",
  "read_text",
  "inspect_scene",
  "compare_with_previous",
  "robot_context",
];

export type VisionAnalysisInput = {
  image: Buffer;
  imageMimeType: string;
  /** Chỉ có khi mode = "compare_with_previous". */
  previousImage?: Buffer;
  previousImageMimeType?: string;
  /** Câu hỏi/prompt của người dùng, nếu có — KHÔNG bắt buộc. */
  prompt?: string;
  /** Context đã lắp sẵn (Memory/Project Context liên quan), dạng text. */
  context?: string;
  mode: VisionMode;
};

export type VisionAnalysisResult = {
  status: "success" | "error";
  text?: string;
  objects?: string[];
  detectedText?: string;
  observations?: string[];
  /** null nếu provider không trả confidence thật — KHÔNG được bịa số. */
  confidence?: number | null;
  error?: string;
};

export interface VisionProvider {
  readonly name: string;
  analyzeImage(input: VisionAnalysisInput): Promise<VisionAnalysisResult>;
}
