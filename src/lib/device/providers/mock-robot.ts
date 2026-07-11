import type { DeviceCommand, DeviceDescriptor, DeviceProvider, DeviceResult } from "../types";

// Mock Robot Provider — KHÔNG gọi phần cứng thật (không ESP32, không motor,
// không loa thật, không camera). Đủ để chứng minh vertical slice Device
// Manager end-to-end cho Phase 2. Provider thật (ESP32/robot vật lý) implement
// cùng interface DeviceProvider, đăng ký trong providers/registry.ts (composition
// root) — KHÔNG đăng ký trong device-manager.ts, Device Manager không được biết
// tới provider cụ thể nào.

const SUPPORTED_COMMANDS = ["speak", "greet", "status", "sleep", "wake", "turn_left", "turn_right", "move_placeholder"];

function textOf(payload: Record<string, unknown> | undefined, fallback: string): string {
  const text = payload?.text;
  return typeof text === "string" && text.trim() ? text.trim() : fallback;
}

async function execute(command: DeviceCommand): Promise<Omit<DeviceResult, "latencyMs">> {
  const base = {
    deviceId: command.deviceId,
    deviceType: command.deviceType,
    command: command.command,
  };

  switch (command.command) {
    case "greet": {
      const text = textOf(command.payload, "Xin chào, mình là robot mock.");
      return {
        ...base,
        success: true,
        status: "completed",
        message: "Mock robot greeted successfully.",
        data: { spoken: text },
      };
    }

    case "speak": {
      const text = textOf(command.payload, "");
      if (!text) {
        return {
          ...base,
          success: false,
          status: "failed",
          message: "Thiếu payload.text để nói.",
          error: "missing_text",
        };
      }
      return {
        ...base,
        success: true,
        status: "completed",
        message: "Mock robot spoke successfully.",
        data: { spoken: text },
      };
    }

    case "status": {
      return {
        ...base,
        success: true,
        status: "completed",
        message: "Mock robot is online.",
        data: { online: true, mode: "mock" },
      };
    }

    case "sleep": {
      return {
        ...base,
        success: true,
        status: "completed",
        message: "Mock robot đang ngủ (mô phỏng, chưa có servo/màn hình thật).",
        data: { mode: "sleep" },
      };
    }

    case "wake": {
      return {
        ...base,
        success: true,
        status: "completed",
        message: "Mock robot đã thức dậy.",
        data: { mode: "idle" },
      };
    }

    case "turn_left": {
      return {
        ...base,
        success: true,
        status: "completed",
        message: "Mock robot quay sang trái (mô phỏng, chưa có servo thật).",
        data: { direction: "left" },
      };
    }

    case "turn_right": {
      return {
        ...base,
        success: true,
        status: "completed",
        message: "Mock robot quay sang phải (mô phỏng, chưa có servo thật).",
        data: { direction: "right" },
      };
    }

    case "move_placeholder": {
      return {
        ...base,
        success: false,
        status: "not_implemented",
        message: "move_placeholder not implemented yet.",
        error: "not_implemented",
      };
    }

    default:
      return {
        ...base,
        success: false,
        status: "failed",
        message: `Mock robot không hỗ trợ lệnh "${command.command}".`,
        error: "unsupported_command",
      };
  }
}

export const mockRobotProvider: DeviceProvider = { name: "mock-robot", execute };
export const MOCK_ROBOT_CAPABILITIES = SUPPORTED_COMMANDS;

// Descriptor đi kèm provider — cặp (descriptor, provider) sống chung 1 file vì
// chỉ providers/registry.ts (composition root) mới ghép chúng lại và đăng ký
// vào Device Manager.
export const mockRobotDescriptor: DeviceDescriptor = {
  id: "mock-robot-1",
  name: "Mock Robot",
  type: "robot",
  provider: mockRobotProvider.name,
  status: "mock",
  capabilities: MOCK_ROBOT_CAPABILITIES,
  metadata: { note: "Không kết nối phần cứng thật — Phase 2 vertical slice." },
};
