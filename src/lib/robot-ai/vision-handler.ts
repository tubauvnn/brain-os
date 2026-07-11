import { VisionRouter, DEFAULT_VISION_PROVIDER, type VisionMode } from "@/lib/vision";
import { getRecentTempImages, readTempImageBytes, promoteTempImage, type TempImageRecord } from "@/lib/vision/temp-store";
import { recallMemory, rememberIfSafe } from "@/lib/memory";
import { getActiveProjectContext } from "@/lib/project";
import { applyRobotPersonality } from "./personality";
import { VoiceRouter, DEFAULT_VOICE_PROVIDER } from "@/lib/voice";
import { saveVoiceAudio } from "@/lib/voice/storage";

// Robot Vision Handler — Phase 6C, "RobotAgent" trong luồng:
//   Vision API → Image understanding provider → RobotAgent →
//   Memory/Knowledge/Project Context → Robot Personality → VoiceAgent →
//   ElevenLabs → browser response
// Đây là nơi DUY NHẤT ghép các bước đó lại — /api/robot/vision/analyze chỉ
// validate input + gọi hàm này + trả JSON, không tự làm logic nghiệp vụ.
// KHÔNG đi qua Conversation Agent/Intent Resolver thật (ảnh không phải text
// để phân loại intent) — nhưng DÙNG LẠI mọi thứ có thể: Memory, Project
// Context, Robot Personality, VoiceRouter/ElevenLabs, đúng yêu cầu "reuse
// everything possible".

const MODE_INFER_RULES: Array<{ mode: VisionMode; phrases: string[] }> = [
  { mode: "read_text", phrases: ["đọc chữ", "chữ trong ảnh", "đọc text", "read the text"] },
  { mode: "compare_with_previous", phrases: ["so với ảnh trước", "khác gì", "thay đổi", "so sánh"] },
  { mode: "inspect_scene", phrases: ["bất thường", "lỗi gì", "vấn đề", "sai sót"] },
  { mode: "robot_context", phrases: ["linh kiện", "phần cứng", "bộ phận robot", "component"] },
  { mode: "identify_objects", phrases: ["bao nhiêu", "đồ vật", "những gì", "nhìn thấy gì", "objects"] },
];

export function inferVisionMode(prompt: string | undefined): VisionMode {
  if (!prompt?.trim()) return "describe";
  const lower = prompt.toLowerCase();
  for (const rule of MODE_INFER_RULES) {
    if (rule.phrases.some((p) => lower.includes(p))) return rule.mode;
  }
  return "describe";
}

// "Do not save every image" (mục 8) — CHỈ lưu vĩnh viễn khi người dùng yêu
// cầu RÕ RÀNG trong câu hỏi kèm ảnh. Các trường hợp khác (project asset xác
// nhận quan trọng/tham chiếu phần cứng lặp lại/so sánh trước-sau có ý nghĩa)
// cần xác nhận của người dùng qua đúng câu này — Phase 6C không tự suy đoán
// "quan trọng" thay người dùng, tránh lưu bừa.
const SAVE_REQUEST_PHRASES = ["lưu ảnh", "lưu lại ảnh", "nhớ ảnh này", "giữ ảnh này"];

export function isExplicitSaveRequest(prompt: string | undefined): boolean {
  if (!prompt) return false;
  const lower = prompt.toLowerCase();
  return SAVE_REQUEST_PHRASES.some((p) => lower.includes(p));
}

export type VisionOutput = {
  text: string;
  visionMode: VisionMode;
  objects: string[];
  detectedText: string;
  observations: string[];
  confidence: number | null;
  imageStored: boolean;
  memoryUsed: string[];
  projectContextUsed: string[];
  suggestedActions: string[];
  audio: { provider: string; path: string } | null;
  error?: string;
};

export type AnalyzeRobotVisionInput = {
  image: TempImageRecord;
  prompt?: string;
  mode?: VisionMode;
  sessionId?: string;
};

// Kết quả THÔ của Vision Provider + Memory/Project Context liên quan — CHƯA
// qua Robot Personality, CHƯA sinh audio. Phase 6D (RobotAgent/capability
// planner, src/lib/robot-ai/robot-agent.ts) gọi hàm này TRỰC TIẾP khi vision
// chỉ là 1 trong nhiều capability được gộp — tránh gọi Personality/ElevenLabs
// 2 LẦN (1 lần ở đây, 1 lần ở bước merge cuối của RobotAgent). Route
// /api/robot/vision/analyze (Phase 6C, luồng "gửi hẳn 1 ảnh" từ nút bấm
// camera/upload) vẫn dùng analyzeRobotVision() bên dưới — vỏ bọc mỏng gọi
// hàm này rồi tự thêm Personality/Voice/Save, HÀNH VI KHÔNG ĐỔI.
export type RawVisionAnalysis = {
  status: "success" | "error";
  text: string;
  mode: VisionMode;
  objects: string[];
  detectedText: string;
  observations: string[];
  confidence: number | null;
  memoryUsed: string[];
  projectContextUsed: string[];
  usedPreviousImage: boolean;
  error?: string;
};

export async function getVisionAnalysis(input: AnalyzeRobotVisionInput): Promise<RawVisionAnalysis> {
  const mode = input.mode ?? inferVisionMode(input.prompt);

  let previousImage: TempImageRecord | undefined;
  if (mode === "compare_with_previous") {
    const recent = await getRecentTempImages({ sessionId: input.sessionId, excludeId: input.image.id, limit: 1 });
    previousImage = recent[0];
  }

  const memory = await recallMemory(input.prompt);
  const projectContext = await getActiveProjectContext();

  const contextText = [
    projectContext ? `Dự án đang mở: ${projectContext.name}` : "",
    memory.items.length ? `Memory liên quan:\n${memory.items.map((m) => `- ${m.title}: ${m.content}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const provider = VisionRouter.resolve(DEFAULT_VISION_PROVIDER);
  if (!provider) {
    return {
      status: "error",
      text: "Chưa có bộ phận thị giác nào sẵn sàng để phân tích ảnh.",
      mode,
      objects: [],
      detectedText: "",
      observations: [],
      confidence: null,
      memoryUsed: [],
      projectContextUsed: [],
      usedPreviousImage: false,
      error: `Không tìm thấy vision provider "${DEFAULT_VISION_PROVIDER}".`,
    };
  }

  const result = await provider.analyzeImage({
    image: readTempImageBytes(input.image),
    imageMimeType: input.image.mimeType,
    previousImage: previousImage ? readTempImageBytes(previousImage) : undefined,
    previousImageMimeType: previousImage?.mimeType,
    prompt: input.prompt,
    context: contextText,
    mode,
  });

  if (result.status === "error" || !result.text) {
    return {
      status: "error",
      text: "Mình chưa xem được ảnh này, thử gửi lại giúp mình nhé.",
      mode,
      objects: [],
      detectedText: "",
      observations: [],
      confidence: null,
      memoryUsed: memory.items.map((m) => m.title),
      projectContextUsed: projectContext ? [projectContext.name] : [],
      usedPreviousImage: !!previousImage,
      error: result.error,
    };
  }

  let text = result.text;
  if (mode === "compare_with_previous" && !previousImage) {
    text = `${text} (Lưu ý: mình chưa có ảnh trước đó để so sánh trong phiên này.)`;
  }

  return {
    status: "success",
    text,
    mode,
    objects: result.objects ?? [],
    detectedText: result.detectedText ?? "",
    observations: result.observations ?? [],
    confidence: result.confidence ?? null,
    memoryUsed: memory.items.map((m) => m.title),
    projectContextUsed: projectContext ? [projectContext.name] : [],
    usedPreviousImage: !!previousImage,
  };
}

// Luồng ĐẦY ĐỦ Phase 6C (giữ nguyên hành vi cho /api/robot/vision/analyze):
// getVisionAnalysis() + Robot Personality + lưu ảnh (nếu yêu cầu rõ) +
// ElevenLabs — dùng khi vision là TOÀN BỘ response (gửi hẳn 1 ảnh qua nút
// camera/upload), không phải 1 phần của multimodal merge.
export async function analyzeRobotVision(input: AnalyzeRobotVisionInput): Promise<VisionOutput> {
  const raw = await getVisionAnalysis(input);

  const styledText = await applyRobotPersonality(raw.text, {
    userText: input.prompt ?? "",
    intent: "vision_understanding",
    success: raw.status === "success",
  });

  if (raw.status === "error") {
    return {
      text: styledText,
      visionMode: raw.mode,
      objects: [],
      detectedText: "",
      observations: [],
      confidence: null,
      imageStored: false,
      memoryUsed: raw.memoryUsed,
      projectContextUsed: raw.projectContextUsed,
      suggestedActions: [],
      audio: null,
      error: raw.error,
    };
  }

  let imageStored = false;
  if (isExplicitSaveRequest(input.prompt)) {
    // KHÔNG gắn projectContext.id — đó là id của Project JSON (Creative
    // Studio, src/lib/project/), khác hẳn Postgres Project mà
    // MediaFile.project_id tham chiếu (2 hệ thống "project" độc lập trong
    // repo này). Gắn nhầm sẽ vi phạm foreign key. Để trống — ảnh vẫn được
    // lưu vĩnh viễn, chỉ không gắn vào 1 Postgres Project cụ thể.
    imageStored = await promoteTempImage(input.image.id);
    if (imageStored) {
      await rememberIfSafe(`Ảnh đã lưu (${input.image.filename}): ${raw.text}`.slice(0, 500), "robot-vision:analyze");
    }
  }

  let audio: { provider: string; path: string } | null = null;
  const voiceProvider = VoiceRouter.resolve(DEFAULT_VOICE_PROVIDER);
  if (voiceProvider) {
    const voiceResult = await voiceProvider.generate({ text: styledText });
    if (voiceResult.status === "success" && voiceResult.audioBuffer) {
      const saved = saveVoiceAudio(voiceResult.audioBuffer, voiceResult.mimeType ?? "audio/mpeg");
      audio = { provider: voiceProvider.name, path: saved.audioUrl };
    }
  }

  const suggestedActions: string[] = [];
  if (raw.mode === "read_text" && raw.detectedText) suggestedActions.push("Đọc to nội dung");
  if (!imageStored) suggestedActions.push("Lưu ảnh này");
  if (raw.mode !== "compare_with_previous") suggestedActions.push("So với ảnh trước có gì khác");

  return {
    text: styledText,
    visionMode: raw.mode,
    objects: raw.objects,
    detectedText: raw.detectedText,
    observations: raw.observations,
    confidence: raw.confidence,
    imageStored,
    memoryUsed: raw.memoryUsed,
    projectContextUsed: raw.projectContextUsed,
    suggestedActions,
    audio,
  };
}
