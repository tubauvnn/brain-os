import type { PresenceFrame } from "../presence-types";
import type { SocialMood } from "../social/types";

// Kiểu dùng chung cho Brain Loop (Phase 6G) — BrainLoop/WorldState/GoalEngine/
// PriorityEngine/ActionPlanner/Scheduler. Toàn bộ THUẦN LOGIC, không đụng
// DOM/React — page.tsx là nơi DUY NHẤT thực thi (Execute) kết quả loop trả
// về, đúng tinh thần "isolated" của mọi phase robot trước (6E/6F).

// ─── Goals (mục "Goals") ────────────────────────────────────────────────
export type GoalId = "Conversation" | "Listening" | "Thinking" | "Greeting" | "Selling" | "Waiting" | "Watching" | "Idle" | "Sleeping";

export type GoalDefinition = {
  id: GoalId;
  /** Số càng cao càng ưu tiên — "Higher priority interrupts lower". */
  priority: number;
  /** Goal có thể bị NGẮT bởi ứng viên khác cùng mức ưu tiên hay không (ưu tiên cao hơn luôn thắng bất kể cờ này). */
  interruptible: boolean;
  /** null = không tự hết hạn, chỉ kết thúc qua completion condition hoặc bị goal ưu tiên cao hơn ngắt. */
  timeoutMs: number | null;
  /** Điều kiện coi là "đã xong tự nhiên" — dùng để goal ưu tiên thấp hơn HOẶC bằng có thể thay thế mà không bị coi là ngắt ngang. */
  isComplete: (world: WorldState) => boolean;
};

// ─── Actions (mục "Action Planner") — ĐÚNG 15 action liệt kê trong yêu cầu,
// không thêm/bớt — mọi hành vi khác (breathe, nod đầu...) là "visualHint"
// đi kèm, không phải action riêng, để "Next Action" trên debug overlay luôn
// là 1 trong đúng 15 tên này.
export type ActionType =
  | "LookLeft"
  | "LookRight"
  | "LookAtPerson"
  | "Blink"
  | "Smile"
  | "Wave"
  | "Speak"
  | "StaySilent"
  | "Wait"
  | "StartConversation"
  | "ContinueConversation"
  | "EndConversation"
  | "Invite"
  | "ReturnIdle"
  | "Sleep";

export const ACTION_TYPES: ActionType[] = [
  "LookLeft",
  "LookRight",
  "LookAtPerson",
  "Blink",
  "Smile",
  "Wave",
  "Speak",
  "StaySilent",
  "Wait",
  "StartConversation",
  "ContinueConversation",
  "EndConversation",
  "Invite",
  "ReturnIdle",
  "Sleep",
];

/** Hiệu ứng hình ảnh phụ không có action riêng trong vocabulary — page.tsx đọc thêm field này để không mất hiệu ứng đã có từ Phase 6E/6F (breathe, gật đầu, vẫy tay). */
export type VisualHint = "breathe" | "nod" | "wave_gesture" | null;

export type PlannedAction = {
  type: ActionType;
  /** Vì sao chọn action này — hiển thị thẳng lên debug overlay ("Reason"), viết tiếng Việt ngắn gọn. */
  reason: string;
  /** Có nội dung nói ra hay không — action nào cũng có thể mang say (StartConversation/Invite/Speak/EndConversation chủ yếu), executor chỉ cần check field này thay vì switch theo type. */
  say?: string;
  mood: SocialMood;
};

// ─── Conversation state (mục "Conversation"/"Environment") ─────────────
export type ConversationState = "none" | "mic_listening" | "thinking" | "speaking";

// ─── WorldState (mục "Observe"/"Environment") — snapshot MỚI NHẤT luôn ghi
// đè, không tích luỹ lịch sử (BrainLoop giữ 1 bản duy nhất).
export type WorldState = {
  now: number;
  // Presence / Vision (từ PresenceFrame — KHÔNG gọi provider vision mới)
  presenceEnabled: boolean;
  peopleCount: number;
  distance: PresenceFrame["distance"];
  activeTargetId: string | null;
  attentionScore: number;
  // Conversation
  conversationState: ConversationState;
  // Memory / mood (từ SocialBrain, Phase 6F — không tính toán lại)
  visitorCount: number;
  lastGreetingAt: number | null;
  lastSpeechAt: number | null;
  currentMood: SocialMood;
  // Voice / camera / action hiện tại
  voicePlaying: boolean;
  cameraEnabled: boolean;
  currentAction: ActionType | null;
  // Thời gian
  idleSeconds: number;
  // Dự án
  projectContext: string | null;
  sellingContext: boolean;
  // Sự kiện xã giao VỪA xảy ra ở chính cycle này (từ SocialBrain, Phase 6F)
  // — chỉ true đúng 1 cycle lúc kích hoạt, GoalEngine dùng để BẮT ĐẦU
  // Greeting/Waiting/Selling; goal đó tự duy trì bằng timeoutMs riêng sau đó
  // (xem goal-engine.ts), không cần cờ này giữ true liên tục.
  pendingGreeting: boolean;
  pendingInvite: boolean;
};

// ─── Input BrainLoop cần mỗi cycle — page.tsx tập hợp từ state React hiện
// có, KHÔNG có logic quyết định gì ở đây, chỉ dữ liệu thô.
export type BrainLoopInputs = {
  frame: PresenceFrame | null;
  presenceEnabled: boolean;
  conversationState: ConversationState;
  voicePlaying: boolean;
  projectContext: string | null;
  sellingContext: boolean;
  /** mood field của RobotChatResult gần nhất, nếu có — chỉ để SocialBrain (Phase 6F) tính mood nội bộ chính xác hơn khi conversationState="thinking", không ảnh hưởng Goal/Action. */
  chatMood?: import("@/lib/robot-ai/types").RobotMood;
};

export type BrainCycleResult = {
  world: WorldState;
  goal: GoalId;
  action: PlannedAction;
  visualHint: VisualHint;
};
