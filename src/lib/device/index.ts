// Điểm vào duy nhất mà code ngoài src/lib/device/ nên import — không import
// trực tiếp từ device-manager.ts/providers/* ở nơi khác.
//
// Side-effect import: đăng ký toàn bộ provider đã biết vào Device Manager
// (xem providers/registry.ts, composition root). Import module này 1 lần là
// đủ — Node/Next cache module, register() không chạy lại lần 2.
import "./providers/registry";

export { DeviceManager } from "./device-manager";
export type {
  DeviceType,
  DeviceStatus,
  DeviceDescriptor,
  DeviceCommandInput,
  DeviceCommand,
  DeviceResult,
  DeviceProvider,
} from "./types";
