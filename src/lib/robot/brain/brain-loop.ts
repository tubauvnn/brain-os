import { SocialBrain } from "../social/social-brain";
import type { SocialBrainContext } from "../social/types";
import { desiredGoal } from "./goal-engine";
import { shouldSwitchGoal } from "./priority-engine";
import { ActionPlanner, CooldownTracker } from "./action-planner";
import { Scheduler } from "./scheduler";
import { observeWorld } from "./world-state";
import type { ActionType, BrainCycleResult, BrainLoopInputs, GoalId } from "./types";
import type { SocialMood } from "../social/types";

// BrainLoop — Phase 6G mục "Architecture"/"Loop". Điểm gộp DUY NHẤT
// Observe→Think→Prioritize→Plan cho robot (Execute là việc của page.tsx —
// BrainLoop KHÔNG đụng DOM/React, giữ đúng "isolated" như mọi engine robot
// trước). Gọi cycle() mỗi 200ms, KHÔNG bao giờ await/block bên trong (mọi
// I/O — POST /api/robot/event log — là việc của page.tsx sau khi nhận
// BrainCycleResult, fire-and-forget).
//
// Sở hữu LUÔN instance SocialBrain (Phase 6F) — page.tsx không cần giữ ref
// riêng nữa, chỉ gọi qua BrainLoop. SocialBrain vẫn tick() mỗi cycle (200ms,
// nhanh hơn 1s cũ của Phase 6F) — an toàn vì mọi ngưỡng bên trong nó so bằng
// `now` tuyệt đối, không đếm số lần gọi, xem social-brain.ts/attention-engine.ts.

const MEANINGFUL_ACTIONS: ActionType[] = ["StartConversation", "ContinueConversation", "EndConversation", "Invite", "Speak", "LookAtPerson"];

function isMeaningfulAction(type: ActionType): boolean {
  return MEANINGFUL_ACTIONS.includes(type);
}

export class BrainLoop {
  private socialBrain = new SocialBrain();
  private scheduler = new Scheduler();
  private actionPlanner = new ActionPlanner();
  private cooldowns = new CooldownTracker();

  private currentGoal: GoalId = "Idle";
  private goalStartedAt = 0;
  private lastMeaningfulActivityAt = 0;
  private lastGreetingAt: number | null = null;
  private lastSpeechAt: number | null = null;
  private previousAction: ActionType | null = null;
  private lastMood: SocialMood = "idle";

  private buildSocialCtx(inputs: BrainLoopInputs): SocialBrainContext {
    return {
      isTalking: inputs.conversationState !== "none",
      isListening: inputs.conversationState === "mic_listening",
      sellingContext: inputs.sellingContext,
      chatMood: inputs.chatMood,
    };
  }

  /** Gắn chủ đề vừa chat vào khách hiện tại (nếu có) — passthrough sang SocialBrain, xem noteTopic() trong social-brain.ts. */
  noteTopic(now: number, inputs: BrainLoopInputs, topic: string): void {
    this.socialBrain.noteTopic(now, this.buildSocialCtx(inputs), topic);
  }

  cycle(now: number, inputs: BrainLoopInputs): BrainCycleResult {
    if (this.goalStartedAt === 0) this.goalStartedAt = now;
    if (this.lastMeaningfulActivityAt === 0) this.lastMeaningfulActivityAt = now;

    // ── Observe ──────────────────────────────────────────────────────────
    const ctx = this.buildSocialCtx(inputs);
    const socialActions = this.socialBrain.tick(now, inputs.frame, ctx);
    const socialDebug = this.socialBrain.debugSnapshot(now, ctx);
    if (socialActions[0]) this.lastMood = socialActions[0].mood.mood;

    const world = observeWorld(
      now,
      inputs,
      {
        attentionScore: socialDebug.attention.attentionScore,
        currentTargetId: socialDebug.attention.currentTargetId,
        visitorCount: socialDebug.visitorCount,
        mood: this.lastMood,
      },
      {
        lastGreetingAt: this.lastGreetingAt,
        lastSpeechAt: this.lastSpeechAt,
        lastMeaningfulActivityAt: this.lastMeaningfulActivityAt,
        currentAction: this.previousAction,
      },
      { greeting: socialActions.some((a) => a.kind === "greet"), invite: socialActions.some((a) => a.kind === "invite") }
    );

    // ── Think ────────────────────────────────────────────────────────────
    const desired = desiredGoal(world);

    // ── Prioritize ───────────────────────────────────────────────────────
    const previousGoal = this.currentGoal;
    if (shouldSwitchGoal({ goal: this.currentGoal, startedAt: this.goalStartedAt }, desired, world)) {
      this.currentGoal = desired;
      this.goalStartedAt = now;
    }

    // ── Plan ─────────────────────────────────────────────────────────────
    const schedulerCandidate = this.scheduler.tick(now, this.currentGoal);
    let { planned, visualHint } = this.actionPlanner.plan(
      this.currentGoal,
      world,
      { socialActions, schedulerCandidate },
      this.cooldowns,
      now
    );

    // "ReturnIdle" (mục "Action Planner") — action riêng cho ĐÚNG cycle vừa
    // quay lại Idle từ 1 goal khác (Greeting/Selling/Watching/Waiting/
    // Sleeping...), phân biệt với "Wait" (trạng thái đứng yên bình thường
    // lúc đã ở Idle sẵn từ trước). Ghi đè SAU khi ActionPlanner chạy xong vì
    // chỉ BrainLoop mới biết goal VỪA đổi ở cycle này hay không.
    if (this.currentGoal === "Idle" && previousGoal !== "Idle" && !planned.say) {
      planned = { type: "ReturnIdle", reason: `vừa xong ${previousGoal}, quay lại trạng thái nghỉ bình thường`, mood: planned.mood };
    }

    // Sổ sách cho cycle sau — KHÔNG phải "Execute" (đó là việc của page.tsx).
    this.previousAction = planned.type;
    if (planned.say) this.lastSpeechAt = now;
    if (planned.type === "StartConversation" && planned.say) this.lastGreetingAt = now;
    if (isMeaningfulAction(planned.type)) this.lastMeaningfulActivityAt = now;

    return { world, goal: this.currentGoal, action: planned, visualHint };
  }
}
