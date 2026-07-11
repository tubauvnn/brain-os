import { GOALS } from "./goal-engine";
import type { GoalId, WorldState } from "./types";

// PriorityEngine — Phase 6G mục "Priority Engine". Thuần logic, 1 hàm quyết
// định duy nhất: "goal đang chạy có nên NHƯỜNG cho goal ứng viên không?"
//
// Luật (đúng nghĩa đen yêu cầu "Higher priority interrupts lower"):
//   1. Ưu tiên CAO HƠN luôn thắng, KHÔNG điều kiện — kể cả current đang
//      "interruptible: false" (goal top-tier như Conversation/Listening/
//      Thinking vốn đã ở priority cao nhất nên thực tế câu này không bao giờ
//      bị 1 goal khác vượt qua được, interruptible chỉ là lớp phòng thủ nếu
//      cấu hình goal sau này thay đổi).
//   2. Ưu tiên BẰNG NHAU — chỉ chuyển nếu goal hiện tại tự khai "cho phép
//      ngắt cùng cấp" (interruptible=true).
//   3. Ưu tiên THẤP HƠN — KHÔNG được ngắt ngang goal hiện tại (tránh
//      "duplicated actions"/thrashing qua lại) — chỉ chuyển khi goal hiện
//      tại đã HẾT HẠN (timeoutMs) hoặc đã "xong tự nhiên" (isComplete).
export function shouldSwitchGoal(current: { goal: GoalId; startedAt: number }, candidate: GoalId, world: WorldState): boolean {
  if (candidate === current.goal) return false; // không có gì đổi — tránh set lại y hệt (mục "No duplicated actions")

  const candidateDef = GOALS[candidate];
  const currentDef = GOALS[current.goal];

  if (candidateDef.priority > currentDef.priority) return true;
  if (candidateDef.priority === currentDef.priority) return currentDef.interruptible;

  const elapsed = world.now - current.startedAt;
  const timedOut = currentDef.timeoutMs !== null && elapsed >= currentDef.timeoutMs;
  return timedOut || currentDef.isComplete(world);
}
