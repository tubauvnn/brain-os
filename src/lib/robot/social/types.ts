import type { RobotFaceState, RobotGesture } from "@/components/robot/RobotFaceKiosk";
import type { RobotMood } from "@/lib/robot-ai/types";

// Kiểu dùng chung cho Social Brain (Phase 6F) — SocialBrain/MoodEngine/
// AttentionEngine/ConversationMemory/HumorEngine. Tất cả import type-only từ
// RobotFaceKiosk/robot-ai/types (không kéo runtime của component "use
// client" vào lib thuần) để dùng chung đúng 1 nguồn cho các enum mặt/mood đã
// có, không tạo bản sao lệch nhau.

export type SocialMood = "sleepy" | "idle" | "happy" | "excited" | "curious" | "thinking" | "playful" | "selling" | "listening";

export const SOCIAL_MOODS: SocialMood[] = ["sleepy", "idle", "happy", "excited", "curious", "thinking", "playful", "selling", "listening"];

export type GreetingStyle = "calm" | "warm" | "cheeky";

// "Mọi phản hồi đều mang 1 mood" (mục 1) — bundle đầy đủ tham số mà mood đó
// điều khiển (mắt/blink/đầu/tốc độ nói/kiểu chào), MoodEngine tính 1 lần,
// page.tsx chỉ áp dụng thẳng, không tự suy diễn lại ở tầng UI.
export type SocialMoodResult = {
  mood: SocialMood;
  /** "sad" cố tình không có mood xã giao nào tạo ra — loại khỏi type để page.tsx không phải xử lý case không bao giờ xảy ra. */
  faceState: Exclude<RobotFaceState, "sad">;
  fastBlink: boolean;
  gesture: RobotGesture | null;
  /** 0.85-1.15 — chỉ ảnh hưởng giọng browser TTS fallback (speechSynthesis), không đụng ElevenLabs/backend. */
  speakingRate: number;
  greetingStyle: GreetingStyle;
};

export type AttentionEventKind = "look" | "small_greeting" | "invite" | "target_changed" | "target_lost";

export type AttentionEvent = {
  kind: AttentionEventKind;
  targetId: string;
  embedding: number[] | null;
  frame: import("../presence-types").PresenceFrame | null;
};

export type AttentionSnapshot = {
  currentTargetId: string | null;
  lastTargetId: string | null;
  isTalking: boolean;
  isListening: boolean;
  lastInteraction: number | null;
  attentionScore: number; // 0..1
};

export type VisitorEstimate = {
  estimatedHeight: "thấp" | "trung bình" | "cao" | null;
  shirtColorName: string | null;
  location: "bên trái" | "chính giữa" | "bên phải" | null;
};

export type VisitorMemory = VisitorEstimate & {
  id: string;
  embedding: number[] | null;
  lastTopic: string | null;
  firstSeenAt: number;
  lastInteractionAt: number;
  /** Độ tin cậy match embedding lần gần nhất (0..1) — KHÔNG phải xác suất "đúng là người này", chỉ để chọn giọng văn hedge phù hợp. */
  confidence: number;
};

export type HumorCategory = "greeting" | "returning_greeting" | "invite" | "joke" | "goodbye" | "sales";

// Hành động cụ thể SocialBrain trả về mỗi tick — page.tsx áp thẳng lên
// UI/audio, không cần biết logic engine nào tạo ra nó. Mỗi action đều mang
// theo `mood` (mục 1 "Every response carries one mood").
export type SocialAction =
  | { kind: "idle"; behavior: "blink" | "look_left" | "look_right" | "smile" | "breathe"; mood: SocialMoodResult }
  | { kind: "look"; mood: SocialMoodResult }
  | { kind: "greet"; say: string; mood: SocialMoodResult; returning: boolean }
  | { kind: "invite"; say: string; mood: SocialMoodResult }
  | { kind: "joke"; say: string; mood: SocialMoodResult }
  | { kind: "goodbye"; say: string; mood: SocialMoodResult };

export type SocialBrainContext = {
  isTalking: boolean;
  isListening: boolean;
  sellingContext: boolean;
  chatMood?: RobotMood;
};
