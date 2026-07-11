import type { SocialMood, SocialMoodResult } from "./types";
import type { RobotMood } from "@/lib/robot-ai/types";

// MoodEngine — Phase 6F mục 1. Thuần logic, không đụng DOM — tính 1 trong 9
// SocialMood mỗi tick từ tín hiệu hiện tại, rồi tra bảng ra đúng bộ tham số
// mood đó điều khiển (mắt/blink/đầu/tốc độ nói/kiểu chào, mục 1 "Mood
// controls"). Ưu tiên rõ ràng, cao → thấp — chỉ 1 mood thắng mỗi lần gọi.

const WATCHING_ATTENTION_THRESHOLD = 0.35; // attentionScore từ mức này coi là "đang bị để ý" (mục 3 tier "look")
const SLEEPY_IDLE_MS = 90_000; // im lặng đủ lâu (không ai, không chat) mới coi là buồn ngủ

export type MoodEngineInput = {
  isTalking: boolean; // robot đang trong luồng chat thật (nghe/nghĩ/nói) — xem "talking" ở page.tsx
  isListening: boolean; // mic (Web Speech) đang bật
  chatMood?: RobotMood; // mood field của RobotChatResult gần nhất, nếu isTalking từ 1 lượt chat thật
  sellingContext: boolean; // project context hiện tại == ChinChin (mục 7)
  attentionScore: number; // 0..1, từ AttentionEngine
  justInvited: boolean; // AttentionEngine vừa phát "invite" ở tick này
  justGreeted: boolean; // AttentionEngine vừa phát "small_greeting"/greet ở tick này
  justToldJoke: boolean; // HumorEngine vừa chọn 1 câu joke ở tick này
  idleMs: number; // now - lastInteraction
};

const MOOD_FACE_PARAMS: Record<SocialMood, Omit<SocialMoodResult, "mood">> = {
  sleepy: { faceState: "sleeping", fastBlink: false, gesture: null, speakingRate: 0.9, greetingStyle: "calm" },
  idle: { faceState: "idle", fastBlink: false, gesture: null, speakingRate: 1.0, greetingStyle: "calm" },
  happy: { faceState: "happy", fastBlink: false, gesture: null, speakingRate: 1.0, greetingStyle: "warm" },
  excited: { faceState: "happy", fastBlink: true, gesture: "nod", speakingRate: 1.15, greetingStyle: "cheeky" },
  curious: { faceState: "listening", fastBlink: false, gesture: null, speakingRate: 1.0, greetingStyle: "warm" },
  thinking: { faceState: "thinking", fastBlink: false, gesture: null, speakingRate: 0.95, greetingStyle: "calm" },
  playful: { faceState: "happy", fastBlink: true, gesture: "wave", speakingRate: 1.1, greetingStyle: "cheeky" },
  selling: { faceState: "happy", fastBlink: false, gesture: "nod", speakingRate: 1.05, greetingStyle: "cheeky" },
  listening: { faceState: "listening", fastBlink: false, gesture: null, speakingRate: 1.0, greetingStyle: "warm" },
};

export class MoodEngine {
  compute(input: MoodEngineInput): SocialMoodResult {
    const mood = this.resolveMood(input);
    return { mood, ...MOOD_FACE_PARAMS[mood] };
  }

  private resolveMood(input: MoodEngineInput): SocialMood {
    // mục 7 — bối cảnh bán hàng luôn thắng, robot phải "bán" ngay cả khi đang
    // được để ý/vừa chào.
    if (input.sellingContext) return "selling";
    // Mic đang bật/robot đang trong luồng chat thật — ưu tiên phản ánh đúng
    // trạng thái thao tác, không để mood xã giao (curious/playful) đè lên.
    if (input.isListening) return "listening";
    if (input.isTalking) return input.chatMood === "thinking" ? "thinking" : "happy";
    if (input.justInvited) return "excited";
    if (input.justToldJoke) return "playful";
    if (input.justGreeted) return "happy";
    if (input.attentionScore >= WATCHING_ATTENTION_THRESHOLD) return "curious";
    if (input.idleMs >= SLEEPY_IDLE_MS) return "sleepy";
    return "idle";
  }
}
