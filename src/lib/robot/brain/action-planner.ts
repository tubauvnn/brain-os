import type { SocialAction } from "../social/types";
import type { SchedulerCandidate } from "./scheduler";
import type { GoalId, PlannedAction, VisualHint, WorldState } from "./types";

// ActionPlanner — Phase 6G mục "Action Planner". Thuần logic, `plan()` LUÔN
// trả đúng 1 PlannedAction (không bao giờ mảng/nhiều action 1 lúc).
//
// Thứ tự thẩm quyền: 1 SocialAction từ SocialBrain (Phase 6F, đã tự đảm bảo
// never-greet-twice/dwell tiers/anti-repeat) LUÔN thắng nếu có — ActionPlanner
// chỉ MAP 1-1 sang vocabulary Action mới + áp thêm lớp cooldown toàn cục
// (mục "Action cooldowns", KHÁC với cooldown per-target của AttentionEngine).
// Không có SocialAction nào thì mới rơi về mặc định theo Goal, rồi tới
// Scheduler (mục "Scheduler", timer 3-60s) làm lớp idle/an toàn cuối cùng.

const GREETING_COOLDOWN_MS = 60_000;
const INVITE_COOLDOWN_MS = 90_000;
const LINE_COOLDOWN_MS = 5 * 60_000; // "same joke"/"same sales line" 5 phút

export class CooldownTracker {
  private lastGreetingAt: number | null = null;
  private lastInviteAt: number | null = null;
  private lineLastUsedAt = new Map<string, number>();

  canGreet(now: number): boolean {
    return this.lastGreetingAt === null || now - this.lastGreetingAt >= GREETING_COOLDOWN_MS;
  }
  canInvite(now: number): boolean {
    return this.lastInviteAt === null || now - this.lastInviteAt >= INVITE_COOLDOWN_MS;
  }
  canSayLine(text: string, now: number): boolean {
    const last = this.lineLastUsedAt.get(text);
    return last === undefined || now - last >= LINE_COOLDOWN_MS;
  }
  recordGreeting(now: number): void {
    this.lastGreetingAt = now;
  }
  recordInvite(now: number): void {
    this.lastInviteAt = now;
  }
  recordLine(text: string, now: number): void {
    this.lineLastUsedAt.set(text, now);
  }
}

type PlanResult = { planned: PlannedAction; visualHint: VisualHint };

function fromSocial(action: SocialAction, now: number, cooldowns: CooldownTracker): PlanResult {
  const mood = action.mood.mood;
  switch (action.kind) {
    case "idle":
      switch (action.behavior) {
        case "blink":
          return { planned: { type: "Blink", reason: "hành vi idle ngẫu nhiên", mood }, visualHint: null };
        case "look_left":
          return { planned: { type: "LookLeft", reason: "hành vi idle ngẫu nhiên", mood }, visualHint: null };
        case "look_right":
          return { planned: { type: "LookRight", reason: "hành vi idle ngẫu nhiên", mood }, visualHint: null };
        case "smile":
          return { planned: { type: "Smile", reason: "hành vi idle ngẫu nhiên", mood }, visualHint: null };
        case "breathe":
          return { planned: { type: "Wait", reason: "nhịp thở idle", mood }, visualHint: "breathe" };
      }
      break;
    case "look":
      return { planned: { type: "LookAtPerson", reason: "có người đang được để ý (2-3s)", mood }, visualHint: null };
    case "greet": {
      const visualHint: VisualHint = action.mood.gesture === "nod" ? "nod" : null;
      if (!cooldowns.canGreet(now)) {
        return { planned: { type: "StartConversation", reason: "muốn chào nhưng cooldown 60s chưa hết — chỉ nhìn, không nói", mood }, visualHint };
      }
      cooldowns.recordGreeting(now);
      return {
        planned: {
          type: "StartConversation",
          say: action.say,
          reason: action.returning ? "khách quen quay lại trong 30 phút" : "khách mới, đã để ý đủ lâu (5s)",
          mood,
        },
        visualHint,
      };
    }
    case "invite": {
      const visualHint: VisualHint = action.mood.gesture === "nod" ? "nod" : null;
      if (!cooldowns.canInvite(now)) {
        return { planned: { type: "Invite", reason: "muốn mời nhưng cooldown 90s chưa hết — im lặng", mood }, visualHint };
      }
      cooldowns.recordInvite(now);
      return { planned: { type: "Invite", say: action.say, reason: "đã để ý đủ lâu (10s), chủ động mời", mood }, visualHint };
    }
    case "joke": {
      if (!cooldowns.canSayLine(action.say, now)) {
        return { planned: { type: "Smile", reason: "muốn đùa nhưng câu này vừa dùng trong 5 phút — cười thôi", mood }, visualHint: null };
      }
      cooldowns.recordLine(action.say, now);
      const visualHint: VisualHint = action.mood.gesture === "wave" ? "wave_gesture" : null;
      return { planned: { type: "Speak", say: action.say, reason: "vẫn đứng nhìn sau khi mời, chêm 1 câu đùa nhẹ", mood }, visualHint };
    }
    case "goodbye":
      return { planned: { type: "EndConversation", say: action.say, reason: "khách vừa rời khỏi camera", mood }, visualHint: null };
  }
  return { planned: { type: "Wait", reason: "sự kiện xã giao không xác định", mood }, visualHint: null };
}

function fromScheduler(candidate: SchedulerCandidate, world: WorldState, cooldowns: CooldownTracker, now: number): PlanResult {
  if (candidate.say && candidate.action === "StartConversation") {
    if (!cooldowns.canGreet(now)) {
      return { planned: { type: "LookAtPerson", reason: "lưới an toàn 30s muốn chào nhưng cooldown chưa hết", mood: world.currentMood }, visualHint: null };
    }
    cooldowns.recordGreeting(now);
    return { planned: { type: candidate.action, say: candidate.say, reason: candidate.reason, mood: world.currentMood }, visualHint: null };
  }
  if (candidate.say && candidate.action === "Invite") {
    if (!cooldowns.canInvite(now)) {
      return { planned: { type: "Wait", reason: "lưới an toàn 60s muốn mời nhưng cooldown chưa hết", mood: world.currentMood }, visualHint: null };
    }
    cooldowns.recordInvite(now);
    return { planned: { type: candidate.action, say: candidate.say, reason: candidate.reason, mood: world.currentMood }, visualHint: null };
  }
  return { planned: { type: candidate.action, reason: candidate.reason, mood: world.currentMood }, visualHint: null };
}

function fromGoal(goal: GoalId, world: WorldState, scheduler: SchedulerCandidate | null, cooldowns: CooldownTracker, now: number): PlanResult {
  switch (goal) {
    case "Conversation":
      return { planned: { type: "ContinueConversation", reason: "đang trả lời/tương tác với người dùng", mood: world.currentMood }, visualHint: null };
    case "Thinking":
      return { planned: { type: "Wait", reason: "đang xử lý câu hỏi", mood: world.currentMood }, visualHint: null };
    case "Listening":
      return { planned: { type: "StaySilent", reason: "mic đang mở, nhường người dùng nói", mood: world.currentMood }, visualHint: null };
    case "Greeting":
      return { planned: { type: "StaySilent", reason: "vừa chào xong, đợi phản hồi", mood: world.currentMood }, visualHint: null };
    case "Selling":
      if (scheduler) return fromScheduler(scheduler, world, cooldowns, now);
      return { planned: { type: "LookAtPerson", reason: "đang ở chế độ bán hàng, chờ phản hồi", mood: world.currentMood }, visualHint: null };
    case "Waiting":
      if (scheduler) return fromScheduler(scheduler, world, cooldowns, now);
      return { planned: { type: "LookAtPerson", reason: "đang đợi người xem có tương tác không", mood: world.currentMood }, visualHint: null };
    case "Watching":
      if (scheduler) return fromScheduler(scheduler, world, cooldowns, now);
      return { planned: { type: "LookAtPerson", reason: "có người đang được để ý", mood: world.currentMood }, visualHint: null };
    case "Sleeping":
      return { planned: { type: "Sleep", reason: `im lặng ${Math.round(world.idleSeconds)}s rồi, chuyển sang nghỉ`, mood: world.currentMood }, visualHint: null };
    case "Idle":
    default:
      if (scheduler) return fromScheduler(scheduler, world, cooldowns, now);
      return { planned: { type: "Wait", reason: "không có gì mới, đang chờ — im lặng cũng là 1 hành động hợp lệ", mood: world.currentMood }, visualHint: null };
  }
}

export class ActionPlanner {
  plan(
    goal: GoalId,
    world: WorldState,
    pending: { socialActions: SocialAction[]; schedulerCandidate: SchedulerCandidate | null },
    cooldowns: CooldownTracker,
    now: number
  ): PlanResult {
    const social = pending.socialActions[0];
    if (social) return fromSocial(social, now, cooldowns);
    return fromGoal(goal, world, pending.schedulerCandidate, cooldowns, now);
  }
}
