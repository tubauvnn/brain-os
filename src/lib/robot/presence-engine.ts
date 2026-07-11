import type { IdleBehavior, PresenceEvent, PresenceFrame } from "./presence-types";
import { matchVisitor, type Visitor } from "./visual-embedding";

// Presence Engine — Phase 6E. Thuần logic (KHÔNG đụng DOM/camera/React), nhận
// PresenceFrame (từ PresenceDetector) + trạng thái "đang nói chuyện hay
// không" mỗi tick, trả về danh sách PresenceEvent robot cần thực hiện NGAY
// (chào/attention/idle/rời đi). Giữ tách biệt khỏi UI để sau này DeviceManager
// (ESP32 thật) dùng lại đúng engine này, chỉ cần thay cách "thực hiện" event.

export type PresenceEngineOptions = {
  /** Không thấy ai >20s rồi mới xuất hiện lại mới tính là "người mới tới" (mục 2). */
  absenceGreetMs: number;
  /** Không lặp lại lời chào trong khoảng này (mục 2: "Do not repeat greeting within 60s"). */
  greetCooldownMs: number;
  /** Nhớ khách vãng lai trong bao lâu (mục 4: "within 30 minutes"). */
  visitorMemoryMs: number;
  /** Phải nhìn thẳng vào robot liên tục bao lâu mới tính là "đang chú ý" (mục 3). */
  attentionDwellMs: number;
  /** Ngưỡng |x|,|y| coi là "đang nhìn thẳng vào robot". */
  attentionCenterThreshold: number;
  /** Khoảng random giữa 2 hành vi idle (mục 5: "Every 15~30s randomly"). */
  idleMinMs: number;
  idleMaxMs: number;
  /** Khoảng cách embedding tối đa để coi là cùng 1 người (thô, không phải face recognition thật). */
  embeddingMatchThreshold: number;
};

export const DEFAULT_PRESENCE_ENGINE_OPTIONS: PresenceEngineOptions = {
  absenceGreetMs: 20_000,
  greetCooldownMs: 60_000,
  visitorMemoryMs: 30 * 60_000,
  attentionDwellMs: 1_200,
  attentionCenterThreshold: 0.28,
  idleMinMs: 15_000,
  idleMaxMs: 30_000,
  embeddingMatchThreshold: 0.06,
};

const IDLE_BEHAVIORS: IdleBehavior[] = ["blink", "look_left", "look_right", "smile", "breathe"];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class PresenceEngine {
  private opts: PresenceEngineOptions;
  private lastDetectedAt: number | null = null;
  private wasDetectedLastTick = false;
  private lastGreetAt: number | null = null;
  private attentionOn = false;
  private attentionSince: number | null = null;
  private visitors: Visitor[] = [];
  private nextIdleAt: number | null = null;

  constructor(opts: Partial<PresenceEngineOptions> = {}) {
    this.opts = { ...DEFAULT_PRESENCE_ENGINE_OPTIONS, ...opts };
  }

  /** Số khách vãng lai còn nhớ (trong cửa sổ 30 phút) — chỉ để hiển thị debug. */
  visitorCount(now: number): number {
    return this.visitors.filter((v) => now - v.lastSeenAt <= this.opts.visitorMemoryMs).length;
  }

  reset(): void {
    this.lastDetectedAt = null;
    this.wasDetectedLastTick = false;
    this.lastGreetAt = null;
    this.attentionOn = false;
    this.attentionSince = null;
    this.visitors = [];
    this.nextIdleAt = null;
  }

  private canSpeakGreeting(now: number): boolean {
    return this.lastGreetAt === null || now - this.lastGreetAt > this.opts.greetCooldownMs;
  }

  /**
   * @param now performance.now()/Date.now() — chỉ cần nhất quán giữa các lần gọi.
   * @param talking robot đang nghe/nghĩ/nói chuyện (mục 6) — idle bị tạm dừng lúc này,
   *   nhìn thẳng vào người dùng do useRobotEyes lo (đã có bias sẵn cho listening/speaking).
   * @param frame null nếu camera presence đang tắt — engine vẫn chạy idle behaviors bình thường.
   */
  tick(now: number, talking: boolean, frame: PresenceFrame | null): PresenceEvent[] {
    const events: PresenceEvent[] = [];

    // Mục 5 — idle behaviors: chạy độc lập với camera, tạm dừng khi đang hội
    // thoại (mục 6), lên lịch lại ngay cả khi bị tạm dừng để không dồn cục
    // nhiều hành vi liền nhau lúc quay lại idle.
    if (this.nextIdleAt === null) this.nextIdleAt = now + randomBetween(this.opts.idleMinMs, this.opts.idleMaxMs);
    if (talking) {
      this.nextIdleAt = now + randomBetween(this.opts.idleMinMs, this.opts.idleMaxMs);
    } else if (now >= this.nextIdleAt) {
      const behavior = IDLE_BEHAVIORS[Math.floor(Math.random() * IDLE_BEHAVIORS.length)];
      events.push({ kind: "idle", behavior });
      this.nextIdleAt = now + randomBetween(this.opts.idleMinMs, this.opts.idleMaxMs);
    }

    if (!frame) return events; // presence camera tắt — chỉ còn idle behaviors

    const detected = frame.detected;
    const absenceMs = this.lastDetectedAt === null ? Infinity : now - this.lastDetectedAt;

    // Mục 2+4 — người mới xuất hiện sau khi vắng mặt đủ lâu: chào (lần đầu
    // gặp) hoặc "À lại gặp bạn rồi" (khớp embedding khách cũ trong 30 phút).
    const isNewAppearance = detected && !this.wasDetectedLastTick && absenceMs > this.opts.absenceGreetMs;
    if (isNewAppearance) {
      const match = frame.embedding
        ? matchVisitor(frame.embedding, this.visitors, now, this.opts.visitorMemoryMs, this.opts.embeddingMatchThreshold)
        : null;
      if (match) {
        match.lastSeenAt = now;
        if (this.canSpeakGreeting(now)) {
          events.push({ kind: "returning_visitor", say: "À lại gặp bạn rồi." });
          this.lastGreetAt = now;
        }
      } else {
        if (frame.embedding) this.visitors.push({ embedding: frame.embedding, lastSeenAt: now });
        if (this.canSpeakGreeting(now)) {
          events.push({ kind: "greet", say: "Xin chào." });
          this.lastGreetAt = now;
        }
      }
    }

    if (detected) this.lastDetectedAt = now;
    if (!detected && this.wasDetectedLastTick) {
      events.push({ kind: "person_left" });
      this.attentionOn = false;
      this.attentionSince = null;
    }
    this.wasDetectedLastTick = detected;

    // Mục 3 — attention: nhìn thẳng vào robot liên tục đủ lâu mới tính, tránh
    // trigger vì người dùng chỉ lướt ngang qua khung hình.
    const lookingAtRobot =
      detected &&
      Math.abs(frame.x) < this.opts.attentionCenterThreshold &&
      Math.abs(frame.y) < this.opts.attentionCenterThreshold;
    if (lookingAtRobot) {
      if (this.attentionSince === null) this.attentionSince = now;
      if (!this.attentionOn && now - this.attentionSince >= this.opts.attentionDwellMs) {
        this.attentionOn = true;
        const say = this.canSpeakGreeting(now) ? "Xin chào." : undefined;
        if (say) this.lastGreetAt = now;
        events.push({ kind: "attention", on: true, say });
      }
    } else {
      this.attentionSince = null;
      if (this.attentionOn) {
        this.attentionOn = false;
        events.push({ kind: "attention", on: false });
      }
    }

    // Dọn khách đã quá 30 phút — không giữ mãi trong bộ nhớ phiên.
    this.visitors = this.visitors.filter((v) => now - v.lastSeenAt <= this.opts.visitorMemoryMs);

    return events;
  }
}
