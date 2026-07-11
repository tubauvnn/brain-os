import type { VisionAnalysisInput, VisionAnalysisResult, VisionMode, VisionProvider } from "../types";

// OpenAI Vision Provider — adapter NHỎ NHẤT có thể: dùng đúng OPENAI_API_KEY
// đã có (không thêm biến môi trường bắt buộc mới), gọi Chat Completions với
// content dạng multimodal (text + image_url data URI), KHÔNG dùng SDK vendor
// (đúng quy ước đã có trong codebase, xem src/lib/voice/providers/elevenlabs.ts).
// Đây là adapter DUY NHẤT Phase 6C thêm — không sửa src/lib/model/ (Model
// Router text-only vẫn y nguyên, "không đổi phần còn lại của Brain OS").

const TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = "gpt-5.4-nano";
const MAX_OUTPUT_TOKENS = 500;
const MAX_CONTEXT_CHARS = 3000;
const MAX_PROMPT_CHARS = 1000;

const MODE_INSTRUCTIONS: Record<VisionMode, string> = {
  describe: "Mô tả ngắn gọn, trung thực những gì thấy trong ảnh.",
  identify_objects: "Liệt kê các đồ vật/món nhìn thấy trong ảnh, càng cụ thể càng tốt (KHÔNG đếm bừa nếu không đếm được rõ).",
  read_text: "Đọc CHÍNH XÁC chữ nhìn thấy trong ảnh (nếu có). Nếu chữ mờ/không đọc được rõ, nói thẳng là không đọc được rõ — KHÔNG đoán bừa nội dung chữ.",
  inspect_scene: "Tìm những điểm bất thường/đáng chú ý trong ảnh (nếu có) — chỉ nêu điều THẬT SỰ quan sát được, không suy diễn quá xa.",
  compare_with_previous: "So sánh ảnh THỨ NHẤT (ảnh mới) với ảnh THỨ HAI (ảnh trước đó) — nêu điểm khác biệt quan sát được. Nếu không có ảnh trước để so sánh, nói rõ điều đó.",
  robot_context: "Xác định đây có phải linh kiện/bộ phận robot (ESP32, servo, mạch, dây, cảm biến...) không. Nếu không chắc, nói rõ mức độ không chắc chắn, KHÔNG khẳng định bừa.",
};

const SYSTEM_PROMPT = [
  "Bạn là bộ phận thị giác của robot Chuối (Brain OS) — phân tích ảnh THẬT, không bịa.",
  "Chỉ mô tả những gì THỰC SỰ quan sát được trong ảnh được cung cấp. Không suy đoán quá xa, không bịa chi tiết không thấy được.",
  "Nếu không chắc chắn về điều gì (vật thể mờ, chữ không rõ, không đủ góc nhìn...), PHẢI nói rõ sự không chắc chắn đó trong `text`, không khẳng định như thật.",
  'Trả JSON hợp lệ, không markdown, đúng schema (thiếu trường thì để giá trị rỗng phù hợp, KHÔNG bỏ trường):',
  "{",
  '  "text": string (câu trả lời chính, ngắn gọn, trung thực),',
  '  "objects": string[] (đồ vật nhận diện được, rỗng nếu không áp dụng),',
  '  "detectedText": string (chữ đọc được trong ảnh, rỗng nếu không có/không đọc được),',
  '  "observations": string[] (quan sát đáng chú ý khác, rỗng nếu không có),',
  '  "confidence": number | null (0-1, mức tự tin THẬT của bạn — null nếu bạn không có cơ sở ước lượng số, TUYỆT ĐỐI không bịa 1 con số để có vẻ chắc chắn)',
  "}",
].join("\n");

type OpenAiChatResponse = { choices?: { message?: { content?: string } }[] };

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

type ParsedVisionJson = { text?: unknown; objects?: unknown; detectedText?: unknown; observations?: unknown; confidence?: unknown };

function parseVisionJson(raw: string): Omit<VisionAnalysisResult, "status" | "error"> | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as ParsedVisionJson;
    const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
    if (!text) return null;

    return {
      text,
      objects: Array.isArray(parsed.objects) ? parsed.objects.filter((o): o is string => typeof o === "string") : [],
      detectedText: typeof parsed.detectedText === "string" ? parsed.detectedText : "",
      observations: Array.isArray(parsed.observations)
        ? parsed.observations.filter((o): o is string => typeof o === "string")
        : [],
      confidence: typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence) ? parsed.confidence : null,
    };
  } catch {
    return null;
  }
}

async function analyzeImage(input: VisionAnalysisInput): Promise<VisionAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { status: "error", error: "OPENAI_API_KEY chưa được cấu hình." };

  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const boundedPrompt = (input.prompt ?? "").slice(0, MAX_PROMPT_CHARS);
  const boundedContext = (input.context ?? "").slice(0, MAX_CONTEXT_CHARS);

  const userTextParts = [
    `Chế độ phân tích: ${input.mode} — ${MODE_INSTRUCTIONS[input.mode]}`,
    boundedContext ? `Context (Memory/Project liên quan):\n${boundedContext}` : "",
    boundedPrompt ? `Người dùng hỏi: "${boundedPrompt}"` : "",
    input.mode === "compare_with_previous" ? "Ảnh thứ nhất là ảnh MỚI, ảnh thứ hai (nếu có) là ảnh TRƯỚC ĐÓ." : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: userTextParts },
    { type: "image_url", image_url: { url: toDataUrl(input.image, input.imageMimeType) } },
  ];
  if (input.previousImage && input.previousImageMimeType) {
    content.push({ type: "image_url", image_url: { url: toDataUrl(input.previousImage, input.previousImageMimeType) } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { status: "error", error: `OpenAI Vision API lỗi: ${res.status}` };
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return { status: "error", error: "OpenAI Vision không trả về nội dung." };

    const parsed = parseVisionJson(raw);
    if (!parsed) return { status: "error", error: "OpenAI Vision trả JSON không hợp lệ." };

    return { status: "success", ...parsed };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return { status: "error", error: timedOut ? `Timeout sau ${TIMEOUT_MS / 1000}s gọi OpenAI Vision.` : "Không gọi được OpenAI Vision API." };
  } finally {
    clearTimeout(timeout);
  }
}

export const openAiVisionProvider: VisionProvider = { name: "openai-vision", analyzeImage };
