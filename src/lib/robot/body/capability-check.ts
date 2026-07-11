import type { ActionType, PlannedAction } from "../brain/types";
import type { BodyState, CapabilityCheckResult } from "./types";

// checkCapability — Phase 6H mục "Each action has preconditions". Thuần
// hàm. Bảng yêu cầu KHÔNG liệt kê Wait/StaySilent/ReturnIdle/LookLeft(*)... —
// action nào không có trong bảng nghĩa là "luôn làm được" (mục "Doing
// nothing is a valid action" từ Phase 6G vẫn đúng: im lặng không cần điều
// kiện tiên quyết gì).
//
// (*) LookLeft/LookRight/LookAtPerson CÓ trong bảng — ví dụ đúng nghĩa đen
// yêu cầu gốc: "LookLeft requires servoAvailable otherwise simulate with
// eyes only" — fallbackAvailable=true nghĩa là VẪN gọi executor, chỉ đánh
// dấu degraded (executor.moveHead() trong simulator vốn dĩ CHÍNH LÀ "mắt",
// không phải servo thật, nên fallback ở đây tự nhiên trùng luôn với cách
// simulator vẫn làm — không có gì "giả" thêm).

type Requirement = {
  capability: keyof Pick<BodyState, "servoAvailable" | "displayAvailable" | "voiceAvailable" | "cameraAvailable">;
  busyField?: keyof Pick<BodyState, "speakerBusy" | "micBusy" | "cameraBusy">;
  /** true = thiếu capability vẫn có cách bù (degraded), false = thiếu là chịu, không có đường nào khác (mục "gracefully explain, never fail silently"). */
  hasFallback: boolean;
  fallbackExplain: string;
};

const REQUIREMENTS: Partial<Record<ActionType, Requirement>> = {
  LookLeft: { capability: "servoAvailable", hasFallback: true, fallbackExplain: "không có servo thật, mô phỏng bằng mắt" },
  LookRight: { capability: "servoAvailable", hasFallback: true, fallbackExplain: "không có servo thật, mô phỏng bằng mắt" },
  LookAtPerson: { capability: "servoAvailable", hasFallback: true, fallbackExplain: "không có servo thật, mô phỏng bằng mắt" },
  Blink: { capability: "displayAvailable", hasFallback: false, fallbackExplain: "không có màn hình để chớp mắt" },
  Smile: { capability: "displayAvailable", hasFallback: false, fallbackExplain: "không có màn hình để đổi biểu cảm" },
  Wave: { capability: "displayAvailable", hasFallback: false, fallbackExplain: "không có màn hình/tay để vẫy" },
  Sleep: { capability: "displayAvailable", hasFallback: false, fallbackExplain: "không có màn hình để hiện mặt ngủ" },
  Speak: { capability: "voiceAvailable", busyField: "speakerBusy", hasFallback: true, fallbackExplain: "không phát được âm thanh, chỉ hiện chữ" },
  StartConversation: { capability: "voiceAvailable", busyField: "speakerBusy", hasFallback: true, fallbackExplain: "không phát được âm thanh, chỉ hiện chữ" },
  ContinueConversation: { capability: "voiceAvailable", busyField: "speakerBusy", hasFallback: true, fallbackExplain: "không phát được âm thanh, chỉ hiện chữ" },
  Invite: { capability: "voiceAvailable", busyField: "speakerBusy", hasFallback: true, fallbackExplain: "không phát được âm thanh, chỉ hiện chữ" },
  EndConversation: { capability: "voiceAvailable", busyField: "speakerBusy", hasFallback: true, fallbackExplain: "không phát được âm thanh, chỉ hiện chữ" },
};

export function checkCapability(action: PlannedAction, body: BodyState): CapabilityCheckResult {
  const req = REQUIREMENTS[action.type];
  if (!req) return { allowed: true, fallbackAvailable: false, reason: "không cần điều kiện tiên quyết nào" };

  if (req.busyField && body[req.busyField]) {
    // "Bận" khác "thiếu capability" — đây là lý do cho Recovery "retry if
    // appropriate" (mục "Recovery"): không có fallback nào hợp lý cho việc
    // nói chồng lên chính mình, chỉ có thể đợi lượt sau khi hết bận.
    return { allowed: false, fallbackAvailable: false, reason: `${req.busyField} đang bận — thử lại ở lượt sau` };
  }

  if (body[req.capability]) return { allowed: true, fallbackAvailable: false, reason: "đủ điều kiện" };

  return { allowed: false, fallbackAvailable: req.hasFallback, reason: `${req.capability} không có — ${req.fallbackExplain}` };
}
