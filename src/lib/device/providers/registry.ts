import { DeviceManager } from "../device-manager";
import { mockRobotProvider, mockRobotDescriptor } from "./mock-robot";

// Provider Registry — composition root DUY NHẤT biết provider cụ thể nào tồn
// tại và đăng ký chúng vào Device Manager. device-manager.ts KHÔNG import file
// này và KHÔNG import bất kỳ provider nào — chỉ thấy DeviceProvider theo
// contract (types.ts).
//
// Thêm provider mới (Speaker/Camera/ESP32/Printer/Display...):
//   1. Viết 1 file trong providers/ implement DeviceProvider + export descriptor.
//   2. Import + register() thêm 1 dòng ở đây.
// KHÔNG sửa device-manager.ts.

DeviceManager.register(mockRobotDescriptor, mockRobotProvider);
