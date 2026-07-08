// Schema chung cho mọi nguồn trả lời của Chuối (local skill, OpenAI, fallback).
// Rộng hơn NormalizedReply cũ (src/lib/brain/reply-schema.ts) — thêm mood/eyes/mouth/
// hardwareCommand để frontend animate mặt robot và preview lệnh phần cứng.
export type RobotMood = "idle" | "happy" | "listening" | "thinking" | "speaking" | "sleepy" | "error";

export type RobotAction =
  | "none"
  | "greet"
  | "introduce"
  | "look_left"
  | "look_right"
  | "look_center"
  | "smile"
  | "sleep"
  | "wake"
  | "demo_sales"
  | "demo_family"
  | "demo_security"
  | "demo_robot"
  | "move_forward"
  | "move_backward"
  | "turn_left"
  | "turn_right"
  | "stop";

// "closed" thêm cho scenario sleep — về mặt hiển thị RobotFaceKiosk đã tự nhắm
// mắt khi mood="sleepy" (state="sleeping") bất kể eyes, đây là để response API
// mô tả đúng trạng thái mắt cho debug/hardwareCommand tương lai (ESP32-S3).
export type RobotEyes = "left" | "right" | "center" | "up" | "down" | "track" | "closed";

export type RobotMouth = "idle" | "smile" | "speaking" | "thinking" | "sleep";

export type RobotHardwareCommand = {
  type: "servo" | "motor" | "face" | "audio" | "none";
  command: string;
  payload?: Record<string, unknown>;
};

// "local" | "openai" | "deepseek" | "openrouter" là bộ chính theo spec demo.
// codex_cli/claude_cli/gemini_cli chỉ xuất hiện khi gọi chat với body.deep=true
// (chế độ CLI agent có sẵn từ trước, xem src/lib/brain/cli-agent-router.ts) —
// giữ lại để không phá tính năng cũ, không phải chế độ mặc định của demo.
export type RobotProvider =
  | "local"
  | "openai"
  | "deepseek"
  | "openrouter"
  | "codex_cli"
  | "claude_cli"
  | "gemini_cli"
  | "fallback";

export type RobotChatResult = {
  ok: boolean;
  provider: RobotProvider;
  model?: string;
  reply: string;
  mood: RobotMood;
  action: RobotAction;
  eyes?: RobotEyes;
  mouth?: RobotMouth;
  hardwareCommand?: RobotHardwareCommand;
  // Gợi ý 2-3 hành động tiếp theo (nhãn tiếng Việt, khớp DEMO_BUTTONS hoặc câu
  // local skill nhận diện được) — frontend hiển thị thành chip bấm nhanh dưới reply.
  suggestedNextActions?: string[];
  // Ghi chú nội bộ ngắn cho <details> "Nâng cao" (vd "local scenario",
  // "language guard") — không hiển thị ở UI chính, không phải lỗi.
  brainNote?: string;
  cached?: boolean;
  error?: string;
};

export const ROBOT_MOODS: RobotMood[] = ["idle", "happy", "listening", "thinking", "speaking", "sleepy", "error"];

export const ROBOT_ACTIONS: RobotAction[] = [
  "none",
  "greet",
  "introduce",
  "look_left",
  "look_right",
  "look_center",
  "smile",
  "sleep",
  "wake",
  "demo_sales",
  "demo_family",
  "demo_security",
  "demo_robot",
  "move_forward",
  "move_backward",
  "turn_left",
  "turn_right",
  "stop",
];

export const ROBOT_EYES: RobotEyes[] = ["left", "right", "center", "up", "down", "track"];

export const ROBOT_MOUTHS: RobotMouth[] = ["idle", "smile", "speaking", "thinking", "sleep"];

export function isRobotMood(x: unknown): x is RobotMood {
  return typeof x === "string" && (ROBOT_MOODS as string[]).includes(x);
}

export function isRobotAction(x: unknown): x is RobotAction {
  return typeof x === "string" && (ROBOT_ACTIONS as string[]).includes(x);
}

export function isRobotEyes(x: unknown): x is RobotEyes {
  return typeof x === "string" && (ROBOT_EYES as string[]).includes(x);
}

export function isRobotMouth(x: unknown): x is RobotMouth {
  return typeof x === "string" && (ROBOT_MOUTHS as string[]).includes(x);
}
