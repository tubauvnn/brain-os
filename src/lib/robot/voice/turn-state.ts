import type { TurnEvent, TurnState, TurnTransitionResult } from "./types";

// TurnStateMachine — Phase 6I mục 6 "Turn-taking". Thuần logic, bảng chuyển
// trạng thái TƯỜNG MINH — mỗi (state, event) chỉ có ĐÚNG 1 kết quả, sự kiện
// không hợp lệ ở state hiện tại thì bị BỎ QUA (không throw, mục "Never get
// stuck" xuyên suốt dự án) thay vì áp dụng nhầm. Chính cấu trúc bảng này tự
// đảm bảo 2 luật khó nhất:
//   - "no overlapping robot audio" — CHỈ có đúng 1 đường vào "speaking"
//     (thinking --reply_ready--> speaking), không path nào khác tới được.
//   - "no duplicate transcript submission" — CHỈ "transcribing" mới nhận
//     transcript_ready/transcript_empty; gọi 2 lần liên tiếp thì lần 2 rơi
//     vào state mới (thinking/listening), không khớp bảng, tự bị bỏ qua.
//
// Barge-in (mục 5): speech_start từ "speaking" → "interrupted" (không phải
// thẳng "hearing" — cho UI 1 nhịp hiển thị RÕ "vừa bị ngắt lời" trước khi
// caller xác nhận đã bắt đầu ghi âm thật qua resume_capture → "hearing").
const TRANSITIONS: Record<TurnState, Partial<Record<TurnEvent, TurnState>>> = {
  idle: { enable: "listening" },
  listening: { speech_start: "hearing", disable: "idle" },
  hearing: { speech_end: "transcribing", disable: "idle" },
  transcribing: { transcript_ready: "thinking", transcript_empty: "listening", disable: "idle" },
  thinking: { reply_ready: "speaking", disable: "idle" },
  speaking: { speech_start: "interrupted", playback_end: "listening", playback_error: "error", disable: "idle" },
  interrupted: { resume_capture: "hearing", disable: "idle" },
  error: { enable: "listening", disable: "idle" },
};

export class TurnStateMachine {
  private state: TurnState = "idle";

  get current(): TurnState {
    return this.state;
  }

  reset(): void {
    this.state = "idle";
  }

  transition(event: TurnEvent): TurnTransitionResult {
    if (event === "fail") {
      const changed = this.state !== "error";
      this.state = "error";
      return { state: "error", changed };
    }
    const next = TRANSITIONS[this.state]?.[event];
    if (!next) return { state: this.state, changed: false };
    const changed = next !== this.state;
    this.state = next;
    return { state: next, changed };
  }
}
