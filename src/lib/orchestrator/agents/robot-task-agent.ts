import { DeviceManager } from "@/lib/device";
import type { AgentMetadata, Task, TaskAgent, TaskAgentResult } from "../types";

// Robot Task Agent — ADAPTER mỏng bọc Device Manager (src/lib/device/, KHÔNG
// sửa gì ở đó ngoài thêm command mock mới trong providers/mock-robot.ts) để
// khớp hợp đồng TaskAgent, cùng nguyên tắc voice-task-agent.ts bọc VoiceRouter.
// Trước Phase 6A, intent "robot_command" gọi thẳng DeviceManager từ Conversation
// Agent — giờ đi qua đúng chuỗi Conversation Agent → Intent Resolver →
// Task Orchestrator → Robot Agent → Device Manager → Device Provider như yêu cầu.
//
// Agent này KHÔNG nói chuyện với ESP32/motor/camera thật — chỉ dịch message
// người dùng thành 1 DeviceCommand cố định rồi giao cho Device Manager, y hệt
// logic buildRobotDeviceCommand cũ (chuyển từ conversation-agent.ts sang đây).

const SUPPORTED_INTENTS = ["robot_command"];

const STATUS_WORDS = ["trạng thái", "status", "kết nối", "connect"];
const SLEEP_WORDS = ["ngủ đi", "ngủ", "nghỉ đi"];
const WAKE_WORDS = ["thức dậy", "dậy đi", "thức"];
const TURN_LEFT_WORDS = ["quay trái", "nhìn trái", "rẽ trái"];
const TURN_RIGHT_WORDS = ["quay phải", "nhìn phải", "rẽ phải"];

function canHandle(intent: string): boolean {
  return SUPPORTED_INTENTS.includes(intent);
}

function matchAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function buildDeviceCommand(message: string): { command: string; payload?: Record<string, unknown> } {
  const text = message.trim().toLowerCase();
  if (matchAny(text, STATUS_WORDS)) return { command: "status" };
  if (matchAny(text, TURN_LEFT_WORDS)) return { command: "turn_left" };
  if (matchAny(text, TURN_RIGHT_WORDS)) return { command: "turn_right" };
  if (matchAny(text, SLEEP_WORDS)) return { command: "sleep" };
  if (matchAny(text, WAKE_WORDS)) return { command: "wake" };
  return { command: "greet", payload: { text: message.trim() } };
}

async function execute(task: Task): Promise<TaskAgentResult> {
  const { command, payload } = buildDeviceCommand(task.input);
  const result = await DeviceManager.execute({ deviceType: "robot", command, payload });

  return {
    success: result.success,
    agent: "robot-agent",
    output: { command, message: result.message, status: result.status, data: result.data },
    error: result.success ? undefined : result.error,
  };
}

function metadata(): AgentMetadata {
  return {
    name: "robot-agent",
    supportedIntents: SUPPORTED_INTENTS,
    description: "Execute Robot Device Command",
  };
}

export const robotTaskAgent: TaskAgent = { canHandle, execute, metadata };
