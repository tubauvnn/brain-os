export type Intent =
  | "chat"
  | "remember"
  | "recall_memory"
  | "robot_command"
  | "voice_request"
  | "video_request"
  | "character_request"
  | "image_request"
  | "project_request"
  | "tool_request"
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

const REMEMBER_PHRASES = ["nhớ rằng", "ghi nhớ", "nhớ giúp", "remember that", "please remember"];

// "mày nhớ" đứng RIÊNG ở recall (không phải remember) — câu thật tế hay dùng
// dạng câu hỏi "mày nhớ ... không?" (Phase 6A robot verify: "Mày nhớ tao đang
// làm gì không?"), không phải lệnh ghi nhớ mới. Trước đây "mày nhớ" nằm trong
// REMEMBER_PHRASES, khớp NHẦM câu hỏi này thành "remember" (ghi luôn câu hỏi
// làm memory mới thay vì trả lời) — sửa bằng cách chuyển hẳn sang recall.
const RECALL_MEMORY_PHRASES = [
  "đã nói gì về",
  "nhớ gì về",
  "nhớ không về",
  "what did i say about",
  "mày có nhớ",
  "mày nhớ",
];

// robot_command đòi hỏi cả 2: có từ "robot" VÀ 1 động từ hành động — tránh khớp
// nhầm câu chat thường chứa 1 trong các âm tiết ngắn này.
// "chào"/"greet" thêm cho Phase 2 (Device Manager, lệnh "robot chào khách").
// "kết nối"/"connect" thêm cho Phase 6A — câu hỏi trạng thái kết nối phần cứng
// ("Robot thật đã kết nối chưa?") cũng cần đi qua Device Manager để trả lời
// THẬT (mock/simulator hay đã có ESP32 thật), không để model đoán bừa.
const ROBOT_ACTION_WORDS = ["đi", "tới", "quay", "dừng", "tiến", "lùi", "di chuyển", "chào", "greet", "kết nối", "connect"];

// Phase 6A — các câu lệnh demo cố định trên UI /robot (DEMO_BUTTONS trong
// src/app/robot/page.tsx) không chứa từ "robot" nên không khớp
// ROBOT_ACTION_WORDS ở trên — liệt kê thẳng để vẫn đi qua Device Manager thay
// vì rơi xuống "chat" (model không nên tự bịa hành động xoay đầu/ngủ/thức).
const ROBOT_DEMO_PHRASES = ["chào khách", "quay trái", "quay phải", "ngủ đi", "thức dậy"];

const VOICE_REQUEST_PHRASES = ["nói câu", "đọc câu", "đọc to", "nói to"];

// video_request thêm cho Phase 3 (Video Agent, lệnh "tạo video giới thiệu...").
const VIDEO_REQUEST_PHRASES = ["tạo video", "làm video", "video giới thiệu", "create a video", "make a video"];

// character_request thêm cho Phase 5 (Character Agent, lệnh "tạo tập mới...").
// Xét TRƯỚC video_request vì "tạo tập mới" là câu tạo nội dung (không nhất
// thiết ra video) — Character Agent chỉ trả dữ liệu nhân vật, không sinh video.
const CHARACTER_REQUEST_PHRASES = ["tạo tập mới", "tập mới", "nhân vật", "character agent"];

// image_request thêm cho Phase 6 (Image Agent, prompt pack minh hoạ). Xét
// TRƯỚC character_request vì cụm "vẽ nhân vật"/"tạo ảnh nhân vật" chứa sẵn
// "nhân vật" — nếu xét character_request trước sẽ nuốt mất các câu vẽ ảnh.
const IMAGE_REQUEST_PHRASES = ["tạo ảnh", "vẽ ảnh", "tạo hình ảnh", "vẽ nhân vật", "image agent", "generate image", "create an image"];

// project_request thêm cho Phase 7 (Project Agent: create/open/save/update/
// list dự án qua JSON local). Xét TRƯỚC image/character/video_request vì
// "dự án"/"project" không đụng phrase nào ở trên, đặt sớm cho rõ ưu tiên.
const PROJECT_REQUEST_PHRASES = [
  "tạo dự án",
  "mở dự án",
  "lưu dự án",
  "cập nhật dự án",
  "danh sách dự án",
  "create project",
  "open project",
  "save project",
  "list project",
];

// tool_request thêm cho Agent Runtime (Generic Tool Agent: calculator/
// datetime, xem src/lib/tool/). Không đụng phrase nào ở trên.
const TOOL_REQUEST_PHRASES = ["tính giúp", "tính toán", "mấy giờ", "bây giờ là mấy giờ", "calculate", "what time is it"];

function hasAlpha(text: string): boolean {
  return /[a-zA-ZÀ-ỹ]/.test(text);
}

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((p) => text.includes(p));
}

function isRobotCommand(text: string): boolean {
  if (text.includes("robot") && includesAny(text, ROBOT_ACTION_WORDS)) return true;
  return includesAny(text, ROBOT_DEMO_PHRASES);
}

export function resolveIntent(message: string): Intent {
  const text = message.trim().toLowerCase();
  if (!text || !hasAlpha(text)) return "unknown";

  if (includesAny(text, REMEMBER_PHRASES)) return "remember";
  if (includesAny(text, RECALL_MEMORY_PHRASES)) return "recall_memory";
  if (isRobotCommand(text)) return "robot_command";
  if (includesAny(text, PROJECT_REQUEST_PHRASES)) return "project_request";
  if (includesAny(text, IMAGE_REQUEST_PHRASES)) return "image_request";
  if (includesAny(text, CHARACTER_REQUEST_PHRASES)) return "character_request";
  if (includesAny(text, VIDEO_REQUEST_PHRASES)) return "video_request";
  if (includesAny(text, VOICE_REQUEST_PHRASES)) return "voice_request";
  if (includesAny(text, TOOL_REQUEST_PHRASES)) return "tool_request";
  return "chat";
}
