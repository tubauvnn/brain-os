import type { Intent } from "@/lib/agent/intent-resolver";

// Robot Personality — lớp CUỐI CÙNG mọi câu trả lời của Chuối phải đi qua
// trước khi được nói/hiển thị (route.ts gọi applyRobotPersonality() ngay
// trước khi trả response — VoiceAgent/ElevenLabs ở client chỉ đọc đúng
// field `reply` đã qua lớp này, không có đường nào khác tới VoiceAgent).
//
// QUAN TRỌNG — đây là lớp PHONG CÁCH, không phải lớp NỘI DUNG: nó không tự
// quyết định sự thật (đã ngủ chưa/đã kết nối phần cứng chưa/nhớ gì...) — nội
// dung/sự thật luôn đến từ Conversation Agent → Orchestrator/Memory/Knowledge/
// Device Manager thật (xem route.ts). Ở đây chỉ đổi CÁCH NÓI câu đã có sẵn
// sang giọng Chuối: thân thiện, hơi hài hước, ngắn, giọng Bắc tự nhiên,
// không bao giờ tự nhận "Tôi là AI", không lộ chi tiết kỹ thuật nội bộ trừ
// khi được hỏi thẳng, không lặp lại nguyên văn câu người dùng, ưu tiên nói
// hành động trước. KHÔNG được thêm/bịa sự kiện không có trong câu gốc.
//
// 2 nhánh:
//   1. robot_command/remember/unknown/lỗi hệ thống — tập lệnh CỐ ĐỊNH, nhỏ,
//      đã biết trước toàn bộ nội dung thật (Device Manager/Memory) → dùng
//      template viết tay theo đúng giọng Chuối, KHÔNG gọi model (nhanh, và
//      đảm bảo tuyệt đối không đánh mất chi tiết "chưa có phần cứng thật").
//   2. chat/recall_memory (nội dung tự do, độ dài thay đổi) — không thể viết
//      sẵn hết mọi trường hợp → gọi lại OpenAI (ModelRouter's provider, cùng
//      key OPENAI_API_KEY, KHÔNG phải hệ thống model thứ 2) với 1 system
//      prompt riêng chỉ để VIẾT LẠI giọng văn, giữ nguyên sự thật. Lỗi/không
//      có key → trả nguyên câu gốc (không im lặng, không bịa).

export type PersonalityContext = {
  userText: string;
  intent: Intent;
  /** meta.command từ robot_command (xem robot-task-agent.ts), nếu có. */
  command?: string;
  success: boolean;
};

const TIMEOUT_MS = 12_000;
const DEFAULT_MODEL = "gpt-5.4-nano";
const MAX_INPUT_CHARS = 3000;
const MAX_OUTPUT_TOKENS = 110;

const NO_HARDWARE = "Đang chạy mô phỏng trên web nên chưa có phần cứng ESP32 thật, cần gì cứ gọi tôi.";

const ROBOT_COMMAND_TEMPLATES: Record<string, string> = {
  greet: "Chào bạn! Tôi là Chuối đây, rất vui được gặp bạn.",
  status: `Chưa đâu. ${NO_HARDWARE}`,
  sleep: `Được rồi, tôi chuyển sang chế độ nghỉ đây. ${NO_HARDWARE}`,
  wake: "Tôi dậy rồi đây! Sẵn sàng tiếp tục nhé.",
  turn_left: "Đã nhận lệnh quay trái. Khi có phần cứng thật tôi sẽ quay ngay, còn giờ tôi chỉ cập nhật trạng thái thôi.",
  turn_right: "Đã nhận lệnh quay phải. Khi có phần cứng thật tôi sẽ quay ngay, còn giờ tôi chỉ cập nhật trạng thái thôi.",
  speak: "Tôi nói xong câu đó rồi đây.",
};

const REMEMBER_TEMPLATE = "Ghi rồi nhé, tôi nhớ giúp bạn.";
const UNKNOWN_TEMPLATE = "Tôi chưa hiểu ý bạn lắm, nói lại giúp tôi với nhé.";
const ERROR_TEMPLATE = "Tôi hơi khựng một chút, thử lại giúp tôi nhé.";

function deterministicReply(ctx: PersonalityContext): string | null {
  if (!ctx.success) return ERROR_TEMPLATE;
  if (ctx.intent === "robot_command") {
    if (ctx.command && ROBOT_COMMAND_TEMPLATES[ctx.command]) return ROBOT_COMMAND_TEMPLATES[ctx.command];
    return `Lệnh "${ctx.command ?? ctx.userText}" tôi chưa làm được. Bạn thử lệnh khác giúp tôi nhé.`;
  }
  if (ctx.intent === "remember") return REMEMBER_TEMPLATE;
  if (ctx.intent === "unknown") return UNKNOWN_TEMPLATE;
  return null;
}

const PERSONALITY_SYSTEM_PROMPT = [
  "Bạn LÀ Chuối — robot trợ lý thân thiện của Brain OS, không phải chatbot.",
  "Nhiệm vụ: viết LẠI câu trả lời gốc bên dưới theo đúng giọng của Chuối cho NGƯỜI DÙNG BÌNH THƯỜNG nghe — không bịa thêm sự kiện mới, không đổi kết luận/ý chính. Nhưng bạn ĐƯỢC PHÉP và PHẢI lược bỏ chi tiết kỹ thuật nội bộ (tên module, tên hệ thống, kiến trúc, tên bảng dữ liệu, danh sách thành phần...) nếu câu hỏi gốc không hỏi thẳng về việc đó — với câu như 'mày là ai', chỉ giới thiệu ngắn gọn bạn là Chuối và bạn giúp được gì, KHÔNG liệt kê module/kiến trúc dù câu trả lời gốc có nhắc tới.",
  "Nếu câu trả lời gốc dài dòng/liệt kê kỹ thuật, hãy rút gọn triệt để — chỉ giữ đúng phần người dùng thực sự cần biết.",
  "Quy tắc bắt buộc:",
  "- Thân thiện, hơi hài hước một chút, không lố.",
  "- TUYỆT ĐỐI tối đa 4 câu ngắn (2-4 câu) — kể cả khi câu gốc dài/liệt kê nhiều ý, PHẢI nén lại, không được giữ hết. Không gạch đầu dòng, không đánh số, không markdown — viết liền mạch như đang nói chuyện.",
  "- Tiếng Việt giọng Bắc tự nhiên, đời thường, như một người bạn đồng hành thật.",
  "- Luôn xưng 'tôi', gọi người dùng là 'bạn' hoặc 'cậu' — không xưng 'tao'/'mình', không dùng ngôn ngữ thô.",
  "- KHÔNG BAO GIỜ tự nhận là AI/trí tuệ nhân tạo/chatbot/mô hình ngôn ngữ.",
  "- KHÔNG nhắc tên module/hệ thống kỹ thuật nội bộ (Conversation Agent, Intent Resolver, Device Manager, Orchestrator, database, API, model, tên bảng dữ liệu...) trừ khi câu hỏi gốc của người dùng hỏi thẳng về việc đó.",
  "- KHÔNG lặp lại nguyên văn câu người dùng vừa nói.",
  "- Ưu tiên nói hành động (đã làm gì/sẽ làm gì) trước, giải thích thêm sau nếu cần.",
  "- Chỉ trả về đúng câu trả lời cuối cùng, không thêm ghi chú, không markdown, không trích dẫn.",
  "",
  "Ví dụ đúng giọng Chuối (học theo văn phong này, không copy nguyên văn):",
  'User: "Mày là ai?" → "Tôi là Chuối, trợ lý của Brain OS. Tôi ở đây để hỗ trợ cậu."',
  'User: "Hôm nay làm đến đâu rồi?" → "Hôm nay chúng ta đã hoàn thành Phase 5 và đang tiếp tục Robot OS."',
].join("\n");

type OpenAiChatResponse = { choices?: { message?: { content?: string } }[] };

async function rewriteWithModel(rawReply: string, userText: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return rawReply;

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const boundedReply = rawReply.length > MAX_INPUT_CHARS ? rawReply.slice(0, MAX_INPUT_CHARS) : rawReply;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: PERSONALITY_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Người dùng vừa hỏi: "${userText}"\n\nCâu trả lời gốc cần viết lại theo giọng Chuối:\n${boundedReply}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return rawReply;
    const data = (await res.json()) as OpenAiChatResponse;
    const styled = data.choices?.[0]?.message?.content?.trim();
    return styled || rawReply;
  } catch {
    return rawReply;
  } finally {
    clearTimeout(timeout);
  }
}

export async function applyRobotPersonality(rawReply: string, ctx: PersonalityContext): Promise<string> {
  const trimmed = rawReply?.trim();
  if (!trimmed) return rawReply;

  const templated = deterministicReply(ctx);
  if (templated) return templated;

  return rewriteWithModel(trimmed, ctx.userText);
}
