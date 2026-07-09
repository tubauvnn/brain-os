import { randomUUID } from "crypto";
import { log } from "@/lib/logger";
import type {
  DeviceCommandInput,
  DeviceDescriptor,
  DeviceProvider,
  DeviceResult,
  DeviceType,
} from "./types";

// Device Manager — RUNTIME ORCHESTRATION, KHÔNG phải Physical Device Registry
// (bảng Device/Postgres, /api/devices, xem prisma/schema.prisma). Device
// Manager giữ 1 danh sách provider in-memory (register() dưới đây), tự tạo
// ExecutionContext cho mỗi lệnh (executionId + startedAt), tự log toàn bộ
// lifecycle, tự trả DeviceResult chuẩn. Device Manager CHƯA đọc Physical
// Device Registry ở Phase 2 — 2 lớp tách biệt hoàn toàn, có thể nối sau này mà
// không đổi contract ở đây.
//
// QUAN TRỌNG — Inversion of Control: file này CHỈ import types.ts (contract).
// KHÔNG import bất kỳ provider cụ thể nào (Mock Robot, Speaker, ESP32...).
// Provider cụ thể nào tồn tại + đăng ký ra sao là việc của
// providers/registry.ts (composition root) — xem file đó. Thêm provider mới
// KHÔNG được sửa file này.
//
//     Conversation Agent → Intent Resolver → Device Manager → Device Provider

type RegisteredDevice = {
  descriptor: DeviceDescriptor;
  provider: DeviceProvider;
};

const devices = new Map<string, RegisteredDevice>();

function register(descriptor: DeviceDescriptor, provider: DeviceProvider): void {
  devices.set(descriptor.id, { descriptor, provider });
}

function list(): DeviceDescriptor[] {
  return Array.from(devices.values()).map((d) => d.descriptor);
}

// Phân giải theo id trước (chính xác nhất), rồi theo type (device đầu tiên
// khớp) — đủ dùng khi Phase 2 chỉ có 1 device robot. Nhiều device cùng type
// (chọn cái nào) là quyết định của Phase sau, không giải quyết trước ở đây.
function resolve(deviceId?: string, deviceType?: DeviceType): RegisteredDevice | null {
  if (deviceId) return devices.get(deviceId) ?? null;
  if (deviceType) {
    return Array.from(devices.values()).find((d) => d.descriptor.type === deviceType) ?? null;
  }
  return null;
}

async function execute(input: DeviceCommandInput): Promise<DeviceResult> {
  const executionId = randomUUID();
  const startedAt = Date.now();

  await log({
    action: "device.command.received",
    entity: "DeviceExecution",
    entity_id: executionId,
    payload: { deviceId: input.deviceId ?? null, deviceType: input.deviceType, command: input.command },
  });

  const target = resolve(input.deviceId, input.deviceType);

  if (!target) {
    const latencyMs = Date.now() - startedAt;
    await log({
      action: "device.command.failed",
      entity: "DeviceExecution",
      entity_id: executionId,
      payload: { deviceType: input.deviceType, command: input.command, error: "device_not_found", latencyMs },
    });
    return {
      success: false,
      deviceId: input.deviceId,
      deviceType: input.deviceType,
      command: input.command,
      status: "failed",
      message: `Không tìm thấy device khớp deviceType="${input.deviceType}"${
        input.deviceId ? ` / deviceId="${input.deviceId}"` : ""
      }.`,
      error: "device_not_found",
      latencyMs,
    };
  }

  await log({
    action: "device.resolved",
    entity: "DeviceExecution",
    entity_id: executionId,
    payload: { deviceId: target.descriptor.id, deviceType: target.descriptor.type, provider: target.provider.name },
  });

  await log({
    action: "device.command.started",
    entity: "DeviceExecution",
    entity_id: executionId,
    payload: { deviceId: target.descriptor.id, command: input.command },
  });

  try {
    const result = await target.provider.execute({ ...input, deviceId: target.descriptor.id, executionId });
    const latencyMs = Date.now() - startedAt;
    const finalResult: DeviceResult = { ...result, latencyMs };

    await log({
      action: finalResult.success ? "device.command.completed" : "device.command.failed",
      entity: "DeviceExecution",
      entity_id: executionId,
      payload: {
        deviceId: target.descriptor.id,
        command: input.command,
        status: finalResult.status,
        latencyMs,
        error: finalResult.error ?? null,
      },
    });

    return finalResult;
  } catch (e) {
    const latencyMs = Date.now() - startedAt;
    const message = e instanceof Error ? e.message : "Lỗi không xác định khi thực thi lệnh device.";
    await log({
      action: "device.command.failed",
      entity: "DeviceExecution",
      entity_id: executionId,
      payload: { deviceId: target.descriptor.id, command: input.command, error: message, latencyMs },
    });
    return {
      success: false,
      deviceId: target.descriptor.id,
      deviceType: target.descriptor.type,
      command: input.command,
      status: "failed",
      message,
      error: message,
      latencyMs,
    };
  }
}

// KHÔNG đăng ký device nào ở đây — xem providers/registry.ts (composition
// root), nơi DUY NHẤT ghép descriptor + provider cụ thể rồi gọi register().
export const DeviceManager = {
  register,
  list,
  resolve,
  execute,
};
