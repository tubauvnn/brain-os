import type { RobotFaceState } from "@/components/robot/RobotFaceKiosk";
import type { ActionType } from "../brain/types";

// Kiểu dùng chung cho Body Runtime (Phase 6H) — BodyState/CapabilityCheck/
// ActionExecutor/BodyExecutor. Thuần logic, KHÔNG đụng DOM (executor thật —
// BrowserBodyExecutor — sống trong page.tsx, đúng quy ước mọi phase robot
// trước: lib/ chỉ định nghĩa HỢP ĐỒNG, page.tsx mới là nơi thật sự chạm
// DOM/React). "No hardware code, No ESP32" — mọi field/hàm ở đây là KIẾN
// TRÚC, implementation duy nhất hiện có là mô phỏng trên trình duyệt.

// ─── BodyState (mục "Build BodyState") — ĐÚNG 15 field yêu cầu, không thêm
// bớt. Field nào KHÔNG có cảm biến thật trong trình duyệt/simulator (chưa
// có ESP32) thì kiểu phải cho phép "không biết" (null) — KHÔNG bịa số, đúng
// tinh thần "no fabrication" xuyên suốt dự án (xem robot-agent.ts
// executeSearch(), memory secret-detection...).
export type BodyState = {
  /** Độ, suy ra từ eyeDirection qua targetToPanTilt() có sẵn (src/lib/robot/tracking.ts) — chưa có servo thật nên đây là góc "mắt lẽ ra phải nhìn", không phải góc cổ thật. */
  headAngle: { pan: number; tilt: number };
  /** -1..1, hướng nhìn hiện tại (gaze override/camera target/con trỏ — đã có từ Phase 6A/6E). */
  eyeDirection: { x: number; y: number };
  screenState: RobotFaceState;
  speakerBusy: boolean;
  micBusy: boolean;
  cameraBusy: boolean;
  /** % pin thật từ RobotState.battery (Postgres, xem prisma/seed.ts) — null nếu chưa lấy được lần nào. */
  battery: number | null;
  /** KHÔNG có cảm biến sạc thật (chưa nối ESP32) — LUÔN null, không bịa true/false. */
  charging: boolean | null;
  /** navigator.onLine thật — tín hiệu MẠNG duy nhất có thật trong trình duyệt, không phải cường độ wifi thật. */
  wifi: "online" | "offline";
  /** KHÔNG có cảm biến nhiệt thật — LUÔN null. */
  temperature: number | null;
  /** Suy từ headAngle có đổi giữa 2 lần observe liên tiếp hay không. */
  motionState: "still" | "moving";
  /** false trong simulator hiện tại — capabilities thiết bị thật (prisma/seed.ts: "face"/"speak"/"turn") KHÔNG có servo/motor thật, "turn" chỉ là robot_command trạng thái phần mềm (xem Phase 6A). */
  servoAvailable: boolean;
  /** true — mặt luôn render được (đây chính là "màn hình"). */
  displayAvailable: boolean;
  /** true — "speak" có trong capabilities thiết bị, có VoiceAgent/ElevenLabs + browser TTS fallback. KHÔNG lẫn với autoSpeak (tuỳ chọn người dùng, xử lý riêng ở BrowserBodyExecutor). */
  voiceAvailable: boolean;
  /** true khi camera (presence hoặc vision snapshot) đang thực sự mở — tín hiệu runtime thật, không phải capability tĩnh. */
  cameraAvailable: boolean;
};

// ─── Capability check (mục "Each action has preconditions") ────────────
export type CapabilityCheckResult = {
  allowed: boolean;
  /** true nếu KHÔNG allowed nhưng vẫn có cách làm khác cùng action (mục "LookLeft requires servoAvailable otherwise simulate with eyes only") — executor vẫn gọi, chỉ đánh dấu degraded. */
  fallbackAvailable: boolean;
  reason: string;
};

// ─── Result / Brain Feedback (mục "Action Executor") ────────────────────
export type ActionOutcome = {
  requestedAction: ActionType;
  /** = requestedAction trừ khi không làm được VÀ không có fallback nào — lúc đó rơi về StaySilent có lý do rõ ràng (mục "never fail silently"). */
  executedAction: ActionType;
  succeeded: boolean;
  /** true nếu phải dùng fallback (vd mắt thay servo) hoặc thất bại hoàn toàn. */
  degraded: boolean;
  reason: string;
  say?: string;
};

// ─── Device abstraction (mục "Device abstraction") — ESP32/Simulator/
// Desktop/Browser đều cài ĐÚNG interface này. Hiện tại chỉ có 1 implementation
// thật (BrowserBodyExecutor trong page.tsx, mô phỏng trên web) — "No hardware
// code, No ESP32" nghĩa là KHÔNG viết thêm implementation nào khác ở phase
// này, chỉ đảm bảo hợp đồng đủ tổng quát để sau này cắm vào được.
export interface BodyExecutor {
  moveHead(direction: "left" | "right" | "center"): Promise<boolean>;
  lookAtPerson(): Promise<boolean>;
  blink(): Promise<boolean>;
  setExpression(expression: "smile" | "neutral"): Promise<boolean>;
  gesture(kind: "wave" | "nod"): Promise<boolean>;
  /** Resolve khi nói XONG (không phải lúc bắt đầu) — để caller biết lúc nào an toàn chuyển state tiếp theo. */
  speak(text: string): Promise<boolean>;
  /** "sad" cố tình không có action/mood nào của Brain Loop tạo ra (xem SocialMoodResult.faceState, Phase 6F) — loại khỏi type luôn cho nhất quán. */
  setScreenState(state: Exclude<RobotFaceState, "sad">): Promise<boolean>;
  /** Dùng cho Wait/StaySilent/ReturnIdle và fallback lúc Speak-family bị chặn hoàn toàn. */
  silence(): Promise<boolean>;
}
