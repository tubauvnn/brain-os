export type Intent =
  | "chat"
  | "remember"
  | "recall_memory"
  | "robot_command"
  | "voice_request"
  | "unknown";

// Intent Resolver — luật xác định (deterministic), KHÔNG gọi model. Chỉ so khớp
// cụm từ trên message đã lowercase/trim, bằng substring (KHÔNG dùng regex \b —
// \b trong JS chỉ hiểu word-char ASCII, im lặng KHÔNG khớp ở biên ký tự có dấu
// tiếng Việt như "đ", đã xác nhận qua test tay: /\bđã nói gì về\b/ không khớp
// "tao đã nói gì về cà phê" dù cụm từ có xuất hiện y hệt). Thêm luật mới: thêm 1
// cụm vào đúng nhóm bên dưới — KHÔNG đổi thứ tự ưu tiên các nhóm (remember/
// recall_memory xét trước robot_command/voice_request vì cụm "nhớ" dễ đụng nhau).
//
// Đây KHÔNG phải NLU — chỉ đủ để Conversation Agent định tuyến hành vi cho
// vertical slice này. Nâng cấp lên model-based classification là bước sau,
// ngoài phạm vi hiện tại.

const REMEMBER_PHRASES = ["nhớ rằng", "mày nhớ", "ghi nhớ", "nhớ giúp", "remember that", "please remember"];

const RECALL_MEMORY_PHRASES = ["đã nói gì về", "nhớ gì về", "nhớ không về", "what did i say about", "mày có nhớ"];

// robot_command đòi hỏi cả 2: có từ "robot" VÀ 1 động từ hành động — tránh khớp
// nhầm câu chat thường chứa 1 trong các âm tiết ngắn này.
// "chào"/"greet" thêm cho Phase 2 (Device Manager, lệnh "robot chào khách").
const ROBOT_ACTION_WORDS = ["đi", "tới", "quay", "dừng", "tiến", "lùi", "di chuyển", "chào", "greet"];

const VOICE_REQUEST_PHRASES = ["nói câu", "đọc câu", "đọc to", "nói to"];

function hasAlpha(text: string): boolean {
  return /[a-zA-ZÀ-ỹ]/.test(text);
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((p) => text.includes(p));
}

function isRobotCommand(text: string): boolean {
  return text.includes("robot") && includesAny(text, ROBOT_ACTION_WORDS);
}

export function resolveIntent(message: string): Intent {
  const text = message.trim().toLowerCase();
  if (!text || !hasAlpha(text)) return "unknown";

  if (includesAny(text, REMEMBER_PHRASES)) return "remember";
  if (includesAny(text, RECALL_MEMORY_PHRASES)) return "recall_memory";
  if (isRobotCommand(text)) return "robot_command";
  if (includesAny(text, VOICE_REQUEST_PHRASES)) return "voice_request";
  return "chat";
}
