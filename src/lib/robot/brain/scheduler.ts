import type { ActionType, GoalId } from "./types";

// Scheduler — Phase 6G mục "Scheduler". Thuần logic, các mốc thời gian ĐÚNG
// yêu cầu (3s/8s/15s/30s/60s). Mỗi timer chỉ "liên quan" trong 1 vài goal cụ
// thể (vd "tiny movement" chỉ có ý nghĩa lúc Idle/Watching, không phải lúc
// đang Conversation) — tick() trả về ĐÚNG 1 ứng viên (timer quá hạn NHIỀU
// NHẤT nếu vài timer cùng tới hạn 1 lúc), KHÔNG bao giờ trả nhiều hành động
// cùng lúc (khớp "Never block"/ActionPlanner "outputs exactly one action").
//
// "30s small greeting"/"60s offer help" chỉ là LƯỚI AN TOÀN — bình thường
// AttentionEngine (Phase 6F) đã tự chào ở mốc 5s/mời ở mốc 10s nhanh hơn
// nhiều rồi, 2 timer này hiếm khi thực sự bắn (ActionPlanner còn gác thêm 1
// lớp cooldown trước khi cho phép nói, xem action-planner.ts).

export type SchedulerCandidate = { action: ActionType; reason: string; say?: string };

type TimerId = "tiny_movement" | "look_around" | "idle_pose" | "watch_safety_greeting" | "offer_help";

const INTERVALS_MS: Record<TimerId, number> = {
  tiny_movement: 3_000,
  look_around: 8_000,
  idle_pose: 15_000,
  watch_safety_greeting: 30_000,
  offer_help: 60_000,
};

const ALL_TIMERS = Object.keys(INTERVALS_MS) as TimerId[];

function isGoalRelevant(timer: TimerId, goal: GoalId): boolean {
  switch (timer) {
    case "tiny_movement":
      return goal === "Idle" || goal === "Watching";
    case "look_around":
    case "idle_pose":
      return goal === "Idle";
    case "watch_safety_greeting":
      return goal === "Watching";
    case "offer_help":
      return goal === "Waiting" || goal === "Selling";
  }
}

export class Scheduler {
  private nextFireAt: Record<TimerId, number> = {
    tiny_movement: 0,
    look_around: 0,
    idle_pose: 0,
    watch_safety_greeting: 0,
    offer_help: 0,
  };
  private lookAroundToggle = false;
  private idlePoseToggle = false;

  reset(): void {
    for (const timer of ALL_TIMERS) this.nextFireAt[timer] = 0;
  }

  tick(now: number, goal: GoalId): SchedulerCandidate | null {
    let bestTimer: TimerId | null = null;
    let bestOverdueMs = -Infinity;

    for (const timer of ALL_TIMERS) {
      if (!isGoalRelevant(timer, goal)) continue;
      // Lần đầu timer này "liên quan" — hẹn giờ từ NGAY BÂY GIỜ, không bắn
      // ngay lập tức (đếm ngược mới bắt đầu đúng lúc goal này bắt đầu).
      if (this.nextFireAt[timer] === 0) this.nextFireAt[timer] = now + INTERVALS_MS[timer];
      if (now < this.nextFireAt[timer]) continue;
      const overdueMs = now - this.nextFireAt[timer];
      if (overdueMs > bestOverdueMs) {
        bestOverdueMs = overdueMs;
        bestTimer = timer;
      }
    }

    if (!bestTimer) return null;
    this.nextFireAt[bestTimer] = now + INTERVALS_MS[bestTimer];
    return this.buildCandidate(bestTimer);
  }

  private buildCandidate(timer: TimerId): SchedulerCandidate {
    switch (timer) {
      case "tiny_movement":
        return { action: "Blink", reason: "cử động nhỏ giữ mặt không đứng hình (3s)" };
      case "look_around": {
        this.lookAroundToggle = !this.lookAroundToggle;
        return { action: this.lookAroundToggle ? "LookLeft" : "LookRight", reason: "nhìn quanh cho đỡ nhàm (8s)" };
      }
      case "idle_pose": {
        this.idlePoseToggle = !this.idlePoseToggle;
        return { action: this.idlePoseToggle ? "Smile" : "Wave", reason: "đổi dáng đứng idle (15s)" };
      }
      case "watch_safety_greeting":
        return { action: "StartConversation", say: "Chào bạn nhé.", reason: "để ý ai đó khá lâu mà chưa kịp chào (30s, lưới an toàn)" };
      case "offer_help":
        return { action: "Invite", say: "Cần giúp gì cứ nói với mình nhé.", reason: "đợi tương tác khá lâu, chủ động mời (60s)" };
    }
  }
}
