// Device contracts — cùng pattern Model Router / Voice Router (src/lib/model,
// src/lib/voice): interface trước, provider cụ thể sau.
//
// QUAN TRỌNG — Device Manager (device-manager.ts) là RUNTIME ORCHESTRATION,
// KHÔNG phải Physical Device Registry (bảng Device trong Postgres,
// prisma/schema.prisma, /api/devices). Hai lớp tách biệt hoàn toàn ở Phase 2:
// Device Manager giữ 1 danh sách in-memory riêng (Mock Robot Provider), CHƯA
// đọc Physical Device Registry. Không gộp 2 khái niệm này lại.

export type DeviceType = "robot" | "camera" | "speaker" | "display" | "esp32" | "unknown";

export type DeviceStatus = "online" | "offline" | "idle" | "error" | "simulated";

// Device Contract — mô tả 1 thiết bị Device Manager biết điều khiển.
export type DeviceDescriptor = {
  id: string;
  name: string;
  type: DeviceType;
  provider: string;
  status: DeviceStatus;
  capabilities: string[];
  metadata?: Record<string, unknown>;
};

// Device Command Contract — input để gọi Device Manager. executionId KHÔNG
// nằm ở input: Device Manager tự sinh khi tạo ExecutionContext cho lệnh này
// (đúng trách nhiệm "create ExecutionContext" của Device Manager) — caller
// (API route/Conversation Agent) không tự đặt executionId.
export type DeviceCommandInput = {
  deviceId?: string;
  deviceType: DeviceType;
  command: string;
  payload?: Record<string, unknown>;
  timeoutMs?: number;
};

// Command đầy đủ đưa vào Device Provider — có executionId do Device Manager gắn.
export type DeviceCommand = DeviceCommandInput & {
  executionId: string;
};

// Device Result Contract — output chuẩn cho mọi lệnh Device Manager thực thi.
export type DeviceResult = {
  success: boolean;
  deviceId?: string;
  deviceType: DeviceType;
  command: string;
  status: "completed" | "failed" | "not_implemented";
  message: string;
  data?: Record<string, unknown>;
  error?: string;
  latencyMs: number;
};

// Device Provider — implement để Device Manager điều khiển 1 loại thiết bị
// (mock hoặc thật sau này). Provider KHÔNG tự log, KHÔNG tự tạo
// ExecutionContext, KHÔNG tự đo latency — Device Manager làm tất cả việc đó,
// provider chỉ thực thi lệnh và trả kết quả (thiếu latencyMs).
export interface DeviceProvider {
  readonly name: string;
  execute(command: DeviceCommand): Promise<Omit<DeviceResult, "latencyMs">>;
}
