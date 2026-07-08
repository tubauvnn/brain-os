import { parseReplyJson, type NormalizedReply } from "./reply-schema";

const DEFAULT_MODEL = "gpt-5.4-nano";
const TIMEOUT_MS = 15_000;
const MAX_CONTEXT_CHARS = 8000;

// Bản prose ban đầu (chỉ liệt kê quy tắc, không kèm ví dụ schema) khiến model
// thường xuyên trả thiếu trường (vd chỉ có "robot_say", thiếu "reply") — đã xác
// nhận qua test tay. Thêm khối schema tường minh + response_format json_object
// (dưới) để model tuân thủ đủ 4 trường.
const SYSTEM_PROMPT = `Bạn là Chuối, robot demo của Brain OS. Trả lời tiếng Việt ngắn gọn, thân thiện, dễ nghe. Ưu tiên câu dưới 2 câu.
Luôn trả JSON hợp lệ, không markdown, không giải thích ngoài JSON.

Schema bắt buộc (đủ cả 4 trường, không được thiếu trường nào):
{
  "reply": string,
  "robot_say": string,
  "face": "idle" | "happy" | "thinking" | "sad",
  "action": "none" | "wave" | "nod"
}

Quy tắc:
- robot_say tối đa 18 từ, giọng Bắc, thân thiện, dễ nghe.
- Nếu được hỏi "mày là ai"/"bạn là ai"/"cậu là ai": robot_say trả đúng "Mình là Chuối, robot demo của Brain OS."
- Nếu người dùng chào hỏi (xin chào/chào/hi): robot_say trả đúng "Xin chào, mình là Chuối đây."
- face chỉ được idle/happy/thinking/sad.
- action chỉ được none/wave/nod.
- Không bịa dữ liệu ngoài context.
- Không tiết lộ private memory nếu không đủ quyền.`;

type OpenAiChatResponse = {
  choices?: { message?: { content?: string } }[];
};

// Provider chính (nhanh) cho robot chat — gọi thẳng OpenAI Chat Completions API.
// Không log/in API key ở bất kỳ đâu (kể cả trong Error message).
export async function askOpenAI(message: string, context: string = ""): Promise<NormalizedReply> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY chưa được cấu hình");

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  // Không gửi toàn bộ database — context truyền vào (SYSTEM_CONTEXT tĩnh hoặc
  // context động sau này) bị cắt cứng ở 8000 ký tự trước khi đưa vào prompt.
  const boundedContext =
    context.length > MAX_CONTEXT_CHARS
      ? `${context.slice(0, MAX_CONTEXT_CHARS)}\n...(context bị cắt bớt, vượt giới hạn ${MAX_CONTEXT_CHARS} ký tự)`
      : context;

  const userContent = [
    boundedContext ? `Context: ${boundedContext}` : "Context: (không có dữ liệu liên quan)",
    `User nói: ${message}`,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`OpenAI API lỗi: ${res.status}`);
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI không trả về nội dung");

    const normalized = parseReplyJson(text);
    if (!normalized) throw new Error("OpenAI trả JSON không hợp lệ (thiếu \"reply\" hoặc sai schema)");
    return normalized;
  } finally {
    clearTimeout(timeout);
  }
}
