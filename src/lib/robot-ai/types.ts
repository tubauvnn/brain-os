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

export type RobotEyes = "left" | "right" | "center" | "up" | "down" | "track";

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
