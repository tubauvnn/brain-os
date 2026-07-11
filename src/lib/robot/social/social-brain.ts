import { PresenceEngine } from "../presence-engine";
import type { PresenceFrame } from "../presence-types";
import { AttentionEngine } from "./attention-engine";
import { ConversationMemory } from "./conversation-state";
import { HumorEngine } from "./humor-engine";
import { MoodEngine } from "./mood-engine";
import type { SocialAction, SocialBrainContext, SocialMoodResult } from "./types";

// SocialBrain — Phase 6F mục 9. Điểm gộp DUY NHẤT của 4 engine (mục 9 yêu
// cầu "everything isolated inside SocialBrain/MoodEngine/AttentionEngine/
// ConversationState/HumorEngine") — page.tsx chỉ gọi tick()/noteTopic(), KHÔNG
// tự cầm logic bên trong. KHÔNG đụng Vision provider/Conversation Agent/
// Device Manager/ESP32 — hoàn toàn tách biệt, chạy phía client trên /robot.
//
// Tái dùng PresenceEngine (Phase 6E) NHƯNG CHỈ để lấy idle behaviors (mục 8,
// giống hệt mục 5 của 6E) — luôn gọi tick() với frame=null nên nhánh
// greet/attention/returning-visitor CŨ của PresenceEngine không bao giờ chạy
// (xem presence-engine.ts: "if (!frame) return events"), AttentionEngine ở
// đây thay thế hoàn toàn phần đó bằng luật bậc thời gian mới (mục 3), không
// trùng lặp/xung đột với nhau.

const JOKE_MIN_MS_AFTER_INVITE = 4_000;
const JOKE_MAX_MS_AFTER_INVITE = 25_000;
const JOKE_CHANCE = 0.5; // không phải lần "smile" idle nào cũng chêm joke — tránh nói nhiều quá

export class SocialBrain {
  private presence = new PresenceEngine();
  private attention = new AttentionEngine();
  private memory = new ConversationMemory();
  private humor = new HumorEngine();
  private mood = new MoodEngine();

  private startedAt: number | null = null;
  private greetedTargetIds = new Set<string>();
  private invitedTargetId: string | null = null;
  private invitedAt: number | null = null;
  private jokedTargetIds = new Set<string>();

  private computeMood(now: number, ctx: SocialBrainContext, extra: { justInvited?: boolean; justGreeted?: boolean; justToldJoke?: boolean } = {}): SocialMoodResult {
    const snapshot = this.attention.snapshot(now, ctx.isTalking, ctx.isListening);
    const idleMs = snapshot.lastInteraction === null ? now - (this.startedAt ?? now) : now - snapshot.lastInteraction;
    return this.mood.compute({
      isTalking: ctx.isTalking,
      isListening: ctx.isListening,
      chatMood: ctx.chatMood,
      sellingContext: ctx.sellingContext,
      attentionScore: snapshot.attentionScore,
      justInvited: extra.justInvited ?? false,
      justGreeted: extra.justGreeted ?? false,
      justToldJoke: extra.justToldJoke ?? false,
      idleMs,
    });
  }

  /** Gắn chủ đề vừa trò chuyện vào khách đang là currentTarget (nếu có) — dùng khi họ quay lại (mục 4 "last topic"). */
  noteTopic(now: number, ctx: SocialBrainContext, topic: string): void {
    const snapshot = this.attention.snapshot(now, ctx.isTalking, ctx.isListening);
    if (snapshot.currentTargetId) this.memory.setTopic(snapshot.currentTargetId, topic);
  }

  debugSnapshot(now: number, ctx: SocialBrainContext) {
    const snapshot = this.attention.snapshot(now, ctx.isTalking, ctx.isListening);
    const visitor = snapshot.currentTargetId ? this.memory.get(snapshot.currentTargetId) : null;
    return {
      attention: snapshot,
      visitorCount: this.memory.count(now),
      currentVisitorDescription: visitor ? this.memory.describeObservation(visitor) : null,
    };
  }

  tick(now: number, frame: PresenceFrame | null, ctx: SocialBrainContext): SocialAction[] {
    if (this.startedAt === null) this.startedAt = now;
    const actions: SocialAction[] = [];

    // Idle behaviors (mục 8) — tái dùng bộ đếm giờ của PresenceEngine
    // (frame=null nên KHÔNG chạy nhánh greet/attention cũ của nó), chỉ lọc
    // lấy đúng phần "idle" để chắc chắn không lẫn hành vi cũ vào.
    const idleEvents = this.presence.tick(now, ctx.isTalking || ctx.isListening, null).filter((e) => e.kind === "idle");
    for (const idle of idleEvents) {
      if (idle.kind !== "idle") continue;

      if (idle.behavior === "smile" && this.invitedTargetId && this.canTellJoke(now, ctx)) {
        const targetId = this.invitedTargetId;
        const say = this.humor.pick("joke");
        this.jokedTargetIds.add(targetId);
        actions.push({ kind: "joke", say, mood: this.computeMood(now, ctx, { justToldJoke: true }) });
        continue;
      }
      actions.push({ kind: "idle", behavior: idle.behavior, mood: this.computeMood(now, ctx) });
    }

    // Luật xã hội theo bậc thời gian (mục 2+3).
    const attentionEvents = this.attention.tick(now, frame, ctx.isTalking, ctx.isListening);
    for (const event of attentionEvents) {
      switch (event.kind) {
        case "look": {
          actions.push({ kind: "look", mood: this.computeMood(now, ctx) });
          break;
        }
        case "small_greeting": {
          if (!frame) break;
          const { visitor, returning } = this.memory.observe(frame, now);
          this.greetedTargetIds.add(event.targetId);
          const say =
            returning && Math.random() < 0.5
              ? this.memory.describeReturning(visitor)
              : this.humor.pick(returning ? "returning_greeting" : "greeting");
          actions.push({ kind: "greet", say, mood: this.computeMood(now, ctx, { justGreeted: true }), returning });
          break;
        }
        case "invite": {
          if (!frame) break;
          this.memory.observe(frame, now); // làm mới quan sát (vị trí/màu áo có thể đổi từ lúc small_greeting)
          this.greetedTargetIds.add(event.targetId);
          this.invitedTargetId = event.targetId;
          this.invitedAt = now;
          let say = this.humor.pick("invite");
          if (ctx.sellingContext) say = `${say} ${this.humor.pick("sales")}`;
          actions.push({ kind: "invite", say, mood: this.computeMood(now, ctx, { justInvited: true }) });
          break;
        }
        case "target_lost": {
          if (this.greetedTargetIds.has(event.targetId) && !ctx.isTalking && !ctx.isListening) {
            const say = this.humor.pick("goodbye");
            actions.push({ kind: "goodbye", say, mood: this.computeMood(now, ctx) });
          }
          this.greetedTargetIds.delete(event.targetId);
          if (this.invitedTargetId === event.targetId) {
            this.invitedTargetId = null;
            this.invitedAt = null;
          }
          this.jokedTargetIds.delete(event.targetId);
          break;
        }
        case "target_changed":
          break; // AttentionEngine hiện chưa phát kind này (đổi target chỉ xảy ra qua target_lost + target mới) — giữ nhánh cho tương lai.
      }
    }

    return actions;
  }

  private canTellJoke(now: number, ctx: SocialBrainContext): boolean {
    if (ctx.isTalking || ctx.isListening) return false;
    if (!this.invitedTargetId || this.invitedAt === null) return false;
    if (this.jokedTargetIds.has(this.invitedTargetId)) return false;
    const elapsed = now - this.invitedAt;
    if (elapsed < JOKE_MIN_MS_AFTER_INVITE || elapsed > JOKE_MAX_MS_AFTER_INVITE) return false;
    return Math.random() < JOKE_CHANCE;
  }
}
