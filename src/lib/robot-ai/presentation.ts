import type { Intent } from "@/lib/agent/intent-resolver";
import type { ConversationResult } from "@/lib/agent/types";
import type { RobotAction, RobotEyes, RobotHardwareCommand, RobotMood, RobotMouth } from "./types";

// Robot Presentation — dịch ConversationResult THẬT (từ Conversation Agent →
// Intent Resolver → Orchestrator/Memory/Knowledge, xem src/lib/agent/) sang
// mood/action/eyes/mouth/hardwareCommand cho RobotFaceKiosk animate. Đây LÀ
// "presentation riêng của client Robot" mà conversation-agent.ts cố tình
// không tự làm (xem comment đầu file đó) — KHÔNG tạo nội dung trả lời, KHÔNG
// bịa reply, chỉ ánh xạ intent + (nếu có) meta.command thật đã chạy sang biểu
// cảm khuôn mặt. Thay thế hoàn toàn robot-ai/local-skills.ts +
// demo-scenarios.ts + openai-provider.ts (mock/hardcoded, đã xoá Phase 6A).

export type RobotPresentation = {
  mood: RobotMood;
  action: RobotAction;
  eyes: RobotEyes;
  mouth: RobotMouth;
  hardwareCommand?: RobotHardwareCommand;
  suggestedNextActions?: string[];
  brainNote: string;
};

const ROBOT_COMMAND_PRESENTATION: Record<
  string,
  Pick<RobotPresentation, "mood" | "action" | "eyes" | "mouth" | "hardwareCommand" | "suggestedNextActions">
> = {
  greet: {
    mood: "happy",
    action: "greet",
    eyes: "center",
    mouth: "speaking",
    hardwareCommand: { type: "face", command: "greet" },
    suggestedNextActions: ["Demo bán hàng", "Quay trái"],
  },
  status: {
    mood: "thinking",
    action: "none",
    eyes: "center",
    mouth: "speaking",
  },
  sleep: {
    mood: "sleepy",
    action: "sleep",
    eyes: "closed",
    mouth: "sleep",
    hardwareCommand: { type: "face", command: "sleep" },
    suggestedNextActions: ["Thức dậy"],
  },
  wake: {
    mood: "happy",
    action: "wake",
    eyes: "center",
    mouth: "speaking",
    hardwareCommand: { type: "face", command: "wake" },
    suggestedNextActions: ["Chào khách"],
  },
  turn_left: {
    mood: "idle",
    action: "turn_left",
    eyes: "left",
    mouth: "speaking",
    hardwareCommand: { type: "servo", command: "look_left", payload: { angle: -35 } },
    suggestedNextActions: ["Quay phải", "Chào khách"],
  },
  turn_right: {
    mood: "idle",
    action: "turn_right",
    eyes: "right",
    mouth: "speaking",
    hardwareCommand: { type: "servo", command: "look_right", payload: { angle: 35 } },
    suggestedNextActions: ["Quay trái", "Chào khách"],
  },
};

const DEFAULT_ROBOT_COMMAND_PRESENTATION = ROBOT_COMMAND_PRESENTATION.greet;

function presentRobotCommand(meta: Record<string, unknown> | undefined): RobotPresentation {
  const command = typeof meta?.command === "string" ? meta.command : undefined;
  const base = (command && ROBOT_COMMAND_PRESENTATION[command]) || DEFAULT_ROBOT_COMMAND_PRESENTATION;
  return { ...base, brainNote: `robot_command:${command ?? "unknown"} (Device Manager)` };
}

export function deriveRobotPresentation(
  intent: Intent,
  result: Pick<ConversationResult, "success" | "error" | "meta">
): RobotPresentation {
  if (!result.success) {
    return { mood: "error", action: "none", eyes: "center", mouth: "idle", brainNote: result.error ?? "error" };
  }

  switch (intent) {
    case "robot_command":
      return presentRobotCommand(result.meta);
    case "remember":
      return { mood: "happy", action: "none", eyes: "center", mouth: "speaking", brainNote: "memory.write" };
    case "recall_memory":
      return { mood: "thinking", action: "none", eyes: "center", mouth: "speaking", brainNote: "memory.read" };
    case "unknown":
      return { mood: "idle", action: "none", eyes: "center", mouth: "idle", brainNote: "unknown intent" };
    case "chat":
    default:
      return { mood: "speaking", action: "none", eyes: "center", mouth: "speaking", brainNote: `intent:${intent}` };
  }
}
