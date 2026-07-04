import { prisma } from "./prisma";

export const ROBOT_COMMANDS = [
  "greet",
  "sleep",
  "wake",
  "happy",
  "surprised",
  "thinking",
  "speak",
  "turn_left",
  "turn_right",
  "stop",
] as const;

export type RobotCommand = (typeof ROBOT_COMMANDS)[number];

type CommandResult = { mode: string; face: string; battery: number; message: string };

export function applyRobotCommand(
  command: RobotCommand,
  payload: Record<string, unknown> | undefined,
  current: { battery: number; face: string }
): CommandResult {
  const battery = command === "sleep" ? 100 : Math.max(5, current.battery - 2);

  switch (command) {
    case "greet":
      return { mode: "greeting", face: "happy", battery, message: "Xin chào! 👋" };
    case "sleep":
      return { mode: "sleeping", face: "sleep", battery, message: "Robot đang ngủ và sạc pin..." };
    case "wake":
      return { mode: "idle", face: "idle", battery, message: "Robot đã thức dậy." };
    case "happy":
      return { mode: "idle", face: "happy", battery, message: "Robot đang vui!" };
    case "surprised":
      return { mode: "idle", face: "surprised", battery, message: "Ồ, bất ngờ chưa!" };
    case "thinking":
      return { mode: "idle", face: "thinking", battery, message: "Robot đang suy nghĩ..." };
    case "speak": {
      const text = typeof payload?.text === "string" ? payload.text : "Xin chào, tôi là ChinChin.";
      return { mode: "speaking", face: "speaking", battery, message: text };
    }
    case "turn_left":
      return { mode: "turning_left", face: current.face, battery, message: "Đang quay trái..." };
    case "turn_right":
      return { mode: "turning_right", face: current.face, battery, message: "Đang quay phải..." };
    case "stop":
      return { mode: "idle", face: "idle", battery, message: "Robot đã dừng." };
  }
}

export async function getRobotDevice() {
  return prisma.device.findFirst({
    where: { device_type: "robot" },
    orderBy: { created_at: "asc" },
  });
}

export async function getOrCreateRobotState(deviceId: string) {
  const existing = await prisma.robotState.findUnique({ where: { device_id: deviceId } });
  if (existing) return existing;
  return prisma.robotState.create({ data: { device_id: deviceId } });
}
