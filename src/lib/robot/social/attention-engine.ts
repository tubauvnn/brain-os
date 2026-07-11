import type { PresenceFrame } from "../presence-types";
import type { AttentionEvent, AttentionSnapshot } from "./types";

// AttentionEngine — Phase 6F mục 2+3. Thuần logic, không đụng DOM. Theo dõi
// currentTarget/lastTarget/isTalking/isListening/lastInteraction/
// attentionScore (mục 2, đúng tên field yêu cầu) và áp luật xã hội theo bậc
// thời gian nhìn (mục 3): đi ngang qua thì bỏ qua, nhìn 2-3s thì "look", 5s
// thì "small_greeting", 10s thì "invite" — mỗi bậc chỉ phát 1 LẦN cho 1
// target (khoá bằng cờ trên chính target, không phải cooldown thời gian như
// PresenceEngine Phase 6E — "never greet twice" đúng nghĩa đen: đã chào rồi
// thì KHÔNG BAO GIỜ chào lại target đó, không phải chỉ trong 60s).

type TargetState = {
  id: string;
  embedding: number[] | null;
  firstSeenAt: number;
  lastSeenAt: number;
  hasLooked: boolean;
  hasGreeted: boolean;
  hasInvited: boolean;
};

export type AttentionEngineOptions = {
  /** Mất dấu trong khoảng dưới mức này khi rời camera coi là "chỉ đi ngang qua" (mục 3) — không phát event nào, kể cả target_lost. */
  walkByMinMs: number;
  lookMs: number;
  smallGreetingMs: number;
  inviteMs: number;
  /** Camera/FaceDetector có thể bỏ lỡ 1-2 khung hình dù người vẫn đứng yên — chỉ thật sự coi là "mất dấu" sau khoảng grace này, tránh reset dwell time oan. */
  lossGraceMs: number;
  scoreRise: number;
  scoreDecay: number;
};

export const DEFAULT_ATTENTION_ENGINE_OPTIONS: AttentionEngineOptions = {
  walkByMinMs: 2_000,
  lookMs: 2_000,
  smallGreetingMs: 5_000,
  inviteMs: 10_000,
  lossGraceMs: 1_500,
  scoreRise: 0.18,
  scoreDecay: 0.25,
};

export class AttentionEngine {
  private opts: AttentionEngineOptions;
  private current: TargetState | null = null;
  private last: TargetState | null = null;
  private lastInteractionAt: number | null = null;
  private lastDetectedAt: number | null = null;
  private attentionScore = 0;
  private targetCounter = 0;

  constructor(opts: Partial<AttentionEngineOptions> = {}) {
    this.opts = { ...DEFAULT_ATTENTION_ENGINE_OPTIONS, ...opts };
  }

  reset(): void {
    this.current = null;
    this.last = null;
    this.lastInteractionAt = null;
    this.lastDetectedAt = null;
    this.attentionScore = 0;
  }

  snapshot(now: number, isTalking: boolean, isListening: boolean): AttentionSnapshot {
    return {
      currentTargetId: this.current?.id ?? null,
      lastTargetId: this.last?.id ?? null,
      isTalking,
      isListening,
      lastInteraction: this.lastInteractionAt,
      attentionScore: this.attentionScore,
    };
  }

  private makeTarget(now: number, embedding: number[] | null): TargetState {
    this.targetCounter += 1;
    return { id: `visitor-${this.targetCounter}`, embedding, firstSeenAt: now, lastSeenAt: now, hasLooked: false, hasGreeted: false, hasInvited: false };
  }

  /**
   * @param frame null nếu presence camera đang tắt.
   * @param isTalking robot đang trong luồng chat thật (nghe/nghĩ/nói).
   * @param isListening mic (Web Speech) đang bật.
   */
  tick(now: number, frame: PresenceFrame | null, isTalking: boolean, isListening: boolean): AttentionEvent[] {
    const events: AttentionEvent[] = [];

    if (isTalking || isListening) {
      // Mục 2 "Only one active conversation" + mục 3 "Never interrupt" +
      // "Ignore random background movement while talking": đang hội thoại
      // thật thì KHOÁ currentTarget, không đổi/không tính bậc mới, chỉ cập
      // nhật lastInteraction. Nếu chưa có target nào (vd gõ chat, không đứng
      // trước camera trước đó) thì khoá luôn người đang đứng trước camera —
      // đã "chào" qua việc trò chuyện rồi nên đánh dấu hasLooked/hasGreeted
      // để tick sau khi hội thoại KHÔNG lặp lại "small_greeting" (mục 3
      // "never greet twice" áp dụng cả cho người vừa mới nói chuyện xong).
      this.lastInteractionAt = now;
      if (frame?.detected) {
        this.lastDetectedAt = now;
        if (!this.current) {
          this.current = this.makeTarget(now, frame.embedding);
        }
        this.current.hasLooked = true;
        this.current.hasGreeted = true;
        this.current.lastSeenAt = now;
        this.attentionScore = Math.min(1, this.attentionScore + this.opts.scoreRise);
      } else {
        this.attentionScore = Math.max(0, this.attentionScore - this.opts.scoreDecay);
      }
      return events; // không phát look/small_greeting/invite/target_* trong lúc đang nói chuyện
    }

    if (!frame || !frame.detected) {
      this.attentionScore = Math.max(0, this.attentionScore - this.opts.scoreDecay);
      if (this.current && this.lastDetectedAt !== null && now - this.lastDetectedAt > this.opts.lossGraceMs) {
        const dwellMs = this.current.lastSeenAt - this.current.firstSeenAt;
        this.last = this.current;
        this.current = null;
        // "If someone only walks by: do nothing" — dwell chưa đủ walkByMinMs
        // thì không phát cả target_lost, coi như chưa từng xảy ra.
        if (dwellMs >= this.opts.walkByMinMs) {
          events.push({ kind: "target_lost", targetId: this.last.id, embedding: this.last.embedding, frame: null });
        }
      }
      return events;
    }

    // frame.detected === true, không đang nói chuyện.
    this.lastDetectedAt = now;
    this.attentionScore = Math.min(1, this.attentionScore + this.opts.scoreRise);

    if (!this.current) this.current = this.makeTarget(now, frame.embedding);
    this.current.lastSeenAt = now;
    if (frame.embedding) this.current.embedding = frame.embedding; // làm mới embedding — ánh sáng/góc mặt có thể đổi giữa chừng

    const dwellMs = now - this.current.firstSeenAt;
    if (!this.current.hasLooked && dwellMs >= this.opts.lookMs) {
      this.current.hasLooked = true;
      events.push({ kind: "look", targetId: this.current.id, embedding: frame.embedding, frame });
    }
    if (!this.current.hasGreeted && dwellMs >= this.opts.smallGreetingMs) {
      this.current.hasGreeted = true;
      this.lastInteractionAt = now;
      events.push({ kind: "small_greeting", targetId: this.current.id, embedding: frame.embedding, frame });
    }
    if (!this.current.hasInvited && dwellMs >= this.opts.inviteMs) {
      this.current.hasInvited = true;
      this.lastInteractionAt = now;
      events.push({ kind: "invite", targetId: this.current.id, embedding: frame.embedding, frame });
    }

    return events;
  }
}
