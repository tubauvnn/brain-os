import type { DeviceCommand, DeviceDescriptor, DeviceProvider, DeviceResult } from "../types";

// Simulated Robot Provider — chưa nối phần cứng thật (không ESP32, không
// motor, không loa thật, không camera). Đây là provider Device Manager có
// sẵn hôm nay (từ Phase 2); provider phần cứng thật (ESP32/robot vật lý)
// implement CÙNG interface DeviceProvider, đăng ký trong
// providers/registry.ts (composition root) — KHÔNG đăng ký trong
// device-manager.ts, Device Manager không được biết tới provider cụ thể nào.
//
// QUAN TRỌNG (Phase 6A fix) — message trả về ở đây LÀ câu robot nói/hiển thị
// thật cho người dùng (đi thẳng qua robot-task-agent → Conversation Agent →
// /api/robot/chat, không qua lớp "trình diễn" nào khác). Vì vậy PHẢI trung
// thực và KHÔNG được chứa các từ mô tả nội bộ như "mock"/"demo"/"placeholder"/
// "fake" — nói thẳng đây là robot mô phỏng trên web, chưa có ESP32, đúng sự
// thật, không phải kịch bản/giả lập nội dung.

const SUPPORTED_COMMANDS = ["speak", "greet", "status", "sleep", "wake", "turn_left", "turn_right"];

const NO_HARDWARE_NOTE = "Hiện tại đây là robot mô phỏng trên web, chưa kết nối phần cứng ESP32 thật.";

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
      const text = textOf(command.payload, "Xin chào!");
      return {
        ...base,
        success: true,
        status: "completed",
        message: `Tôi đã chào bạn xong. ${NO_HARDWARE_NOTE}`,
        data: { spoken: text, hardwareConnected: false },
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
        message: `Tôi đã nói xong câu bạn yêu cầu. ${NO_HARDWARE_NOTE}`,
        data: { spoken: text, hardwareConnected: false },
      };
    }

    case "status": {
      return {
        ...base,
        success: true,
        status: "completed",
        message: `Chưa. ${NO_HARDWARE_NOTE}`,
        data: { online: true, hardwareConnected: false },
      };
    }

    case "sleep": {
      return {
        ...base,
        success: true,
        status: "completed",
        message: `Tôi đã chuyển sang chế độ ngủ. ${NO_HARDWARE_NOTE}`,
        data: { mode: "sleep", hardwareConnected: false },
      };
    }

    case "wake": {
      return {
        ...base,
        success: true,
        status: "completed",
        message: `Tôi đã thức dậy. ${NO_HARDWARE_NOTE}`,
        data: { mode: "idle", hardwareConnected: false },
      };
    }

    case "turn_left": {
      return {
        ...base,
        success: true,
        status: "completed",
        message: `Tôi đã nhận lệnh quay trái. Hiện chưa có phần cứng nên tôi chỉ cập nhật trạng thái mô phỏng.`,
        data: { direction: "left", hardwareConnected: false },
      };
    }

    case "turn_right": {
      return {
        ...base,
        success: true,
        status: "completed",
        message: `Tôi đã nhận lệnh quay phải. Hiện chưa có phần cứng nên tôi chỉ cập nhật trạng thái mô phỏng.`,
        data: { direction: "right", hardwareConnected: false },
      };
    }

    default:
      return {
        ...base,
        success: false,
        status: "failed",
        message: `Tôi chưa hỗ trợ lệnh "${command.command}" ở robot mô phỏng này.`,
        error: "unsupported_command",
      };
  }
}

export const mockRobotProvider: DeviceProvider = { name: "simulated-robot", execute };
export const MOCK_ROBOT_CAPABILITIES = SUPPORTED_COMMANDS;

// Descriptor đi kèm provider — cặp (descriptor, provider) sống chung 1 file vì
// chỉ providers/registry.ts (composition root) mới ghép chúng lại và đăng ký
// vào Device Manager. name/status ở đây là NHÃN QUẢN TRỊ nội bộ (hiện ở trang
// admin /devices, KHÔNG bao giờ lọt vào message trả lời robot ở trên).
export const mockRobotDescriptor: DeviceDescriptor = {
  id: "simulated-robot-1",
  name: "Robot mô phỏng (web)",
  type: "robot",
  provider: mockRobotProvider.name,
  status: "simulated",
  capabilities: MOCK_ROBOT_CAPABILITIES,
  metadata: { note: "Chưa kết nối phần cứng thật — chạy mô phỏng trên web." },
};
