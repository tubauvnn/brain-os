import type { SocialMood } from "../social/types";
import type { ActionType, BrainLoopInputs, WorldState } from "./types";

// observeWorld — bước "Observe" của Brain Loop (mục "Loop"/"Observe"). Thuần
// hàm, không side-effect — nhận dữ liệu thô (BrainLoopInputs, từ camera/chat/
// project context) + snapshot đã có sẵn từ SocialBrain (Phase 6F, KHÔNG tính
// lại attention/mood ở đây) + vài mốc thời gian BrainLoop tự theo dõi, trả
// về ĐÚNG 1 bản WorldState mới nhất (mục "WorldState must always represent
// the latest snapshot" — không giữ lịch sử, gọi lại là ghi đè hoàn toàn).

export type SocialSnapshotForWorld = {
  attentionScore: number;
  currentTargetId: string | null;
  visitorCount: number;
  mood: SocialMood;
};

export type TrackedTimestamps = {
  lastGreetingAt: number | null;
  lastSpeechAt: number | null;
  /** Lần cuối có 1 action "có ý nghĩa" (không phải Wait/StaySilent/Blink) — dùng tính idleSeconds cho GoalEngine quyết định Sleeping. */
  lastMeaningfulActivityAt: number;
  currentAction: ActionType | null;
};

export function observeWorld(
  now: number,
  inputs: BrainLoopInputs,
  social: SocialSnapshotForWorld,
  tracked: TrackedTimestamps,
  pending: { greeting: boolean; invite: boolean }
): WorldState {
  return {
    now,
    presenceEnabled: inputs.presenceEnabled,
    peopleCount: inputs.frame?.count ?? 0,
    distance: inputs.frame?.distance ?? "unknown",
    activeTargetId: social.currentTargetId,
    attentionScore: social.attentionScore,
    conversationState: inputs.conversationState,
    visitorCount: social.visitorCount,
    lastGreetingAt: tracked.lastGreetingAt,
    lastSpeechAt: tracked.lastSpeechAt,
    currentMood: social.mood,
    voicePlaying: inputs.voicePlaying,
    cameraEnabled: inputs.presenceEnabled,
    currentAction: tracked.currentAction,
    idleSeconds: Math.max(0, (now - tracked.lastMeaningfulActivityAt) / 1000),
    projectContext: inputs.projectContext,
    sellingContext: inputs.sellingContext,
    pendingGreeting: pending.greeting,
    pendingInvite: pending.invite,
  };
}
