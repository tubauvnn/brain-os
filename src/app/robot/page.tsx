"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RobotFaceKiosk, type RobotFaceState, type RobotGesture } from "@/components/robot/RobotFaceKiosk";
import { PresenceDetector } from "@/components/robot/PresenceDetector";
import type { PresenceFrame } from "@/lib/robot/presence-types";
import { SocialBrain } from "@/lib/robot/social/social-brain";
import type { SocialAction, SocialBrainContext, SocialMoodResult } from "@/lib/robot/social/types";
import type { RobotMood } from "@/lib/robot-ai/types";

// Bản reset (2026-07-08) — 1 màn demo sạch: mặt robot + 6 nút demo + chat gọn.
// KHÔNG có camera, KHÔNG có hands-free voice loop, KHÔNG có OpenAI Realtime.
// Debug/raw JSON dồn hết vào <details> "Nâng cao", đóng mặc định. Lịch sử cũ
// (camera/voice/realtime/hardware preview panel) đã có ở git history, không
// còn trong UI chính — cần lại thì xem commit trước bản reset này.
//
// Phase 6A (2026-07-11) — UI KHÔNG đổi layout/thiết kế. /api/robot/chat giờ
// nối thẳng Conversation Agent → Intent Resolver → Orchestrator/Memory/
// Knowledge/Project Context/Device Manager thật (xem route.ts), không còn
// local-skills.ts/demo-scenarios.ts kịch bản gõ sẵn. Giọng nói ưu tiên
// VoiceAgent → ElevenLabs thật (/api/voice/generate), rơi về giọng trình
// duyệt (Web Speech API) nếu ElevenLabs lỗi/chưa cấu hình — không bịa giọng.
//
// Phase 6C (2026-07-11) — thêm vision (camera snapshot + upload ảnh) vào
// ĐÚNG khung chat/nút bấm hiện có, KHÔNG dashboard riêng. Ảnh đi qua
// /api/robot/vision/upload (lưu tạm) rồi /api/robot/vision/analyze (Vision
// Provider → Robot Personality → VoiceAgent → ElevenLabs, xem
// src/lib/robot-ai/vision-handler.ts) — trang này KHÔNG gọi provider nào
// trực tiếp, chỉ gọi 2 route đó.
//
// Phase 6E (2026-07-11) — Presence Detector: PresenceDetector.tsx (camera
// RIÊNG, tách khỏi camera chụp ảnh Vision ở trên) đưa PresenceFrame mỗi
// ~350ms — cảm biến thô (có người không/số mặt/khoảng cách/chuyển động/
// embedding tạm thời), không tự quyết định hành vi gì. Camera presence TẮT
// mặc định (bấm nút "Presence" mới xin quyền).
//
// Phase 6F (2026-07-11) — Social Brain: SocialBrain (src/lib/robot/social/,
// thuần logic không đụng DOM) là nơi DUY NHẤT quyết định hành vi xã giao từ
// PresenceFrame — gộp MoodEngine (9 mood, mỗi hành động đều mang theo),
// AttentionEngine (currentTarget/attentionScore, luật bậc thời gian nhìn:
// 2-3s "look", 5s chào, 10s mời — mỗi bậc CHỈ 1 LẦN cho 1 người, không lặp
// lại), ConversationMemory (nhớ khách vãng lai ~30 phút, luôn nói giọng
// phỏng đoán) và HumorEngine (câu chào/đùa/tạm biệt/bán hàng xoay vòng,
// không lặp liền nhau — KHÔNG gọi AI provider nào). Idle behaviors
// (blink/look/smile/breathe mỗi 15-30s) vẫn chạy dù camera presence tắt;
// SocialBrain tự khoá lại (không đổi target/không nói gì) suốt lúc robot
// đang nghe/nghĩ/nói chuyện thật (mục 3 "never interrupt"). Không đụng Vision
// provider/Conversation Agent/Device Manager/ESP32 — mỗi SocialAction vẫn
// POST best-effort qua /api/robot/event (event_type "social.<kind>") như
// Phase 6E, cùng 1 điểm vào cho DeviceManager thật sau này.

type RobotState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "sleeping" | "error";

const STATUS_TEXT: Record<RobotState, string> = {
  idle: "Đang nghỉ",
  listening: "Đang nghe",
  thinking: "Đang nghĩ",
  speaking: "Đang nói",
  happy: "Đang vui",
  sleeping: "Đang ngủ",
  error: "Gặp lỗi nhẹ",
};

// mood (RobotChatResult, xem src/lib/robot-ai/types.ts) → RobotState hiển thị.
// "sleepy" (mood) → "sleeping" (state hiển thị, trùng tên RobotFaceState).
const MOOD_TO_STATE: Record<string, RobotState> = {
  idle: "idle",
  happy: "happy",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
  sleepy: "sleeping",
  error: "error",
};
function moodToState(mood?: string): RobotState | null {
  if (!mood) return null;
  return MOOD_TO_STATE[mood] ?? null;
}

// Hướng nhìn rời rạc (-1..1) cho gazeOverride — "track"/không rõ = null (quay
// lại tracking theo con trỏ bình thường).
const EYES_TO_GAZE: Record<string, { x: number; y: number } | null> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  center: { x: 0, y: 0 },
  track: null,
};
const EYES_OVERRIDE_MS = 1500;

// imagePreviewUrl — chỉ để hiển thị thumbnail trong bong bóng chat của user
// (object URL client-side, KHÔNG phải URL server-servable — ảnh không bao
// giờ public, xem src/lib/vision/temp-store.ts).
type ChatMessage = { id: string; role: "user" | "robot"; content: string; created_at: string; imagePreviewUrl?: string };

type HardwareCommandDTO = { type: string; command: string; payload?: Record<string, unknown> };
type ChatResponse = {
  ok: boolean;
  provider?: string;
  model?: string;
  reply?: string;
  mood?: string;
  action?: string;
  eyes?: string;
  mouth?: string;
  hardwareCommand?: HardwareCommandDTO;
  suggestedNextActions?: string[];
  brainNote?: string;
  error?: string | null;
};

type VisionUploadResponse = { ok: boolean; imageId?: string; error?: string };
type VisionAnalyzeResponse = {
  ok: boolean;
  text?: string;
  visionMode?: string;
  suggestedActions?: string[];
  audio?: { provider: string; path: string } | null;
  error?: string;
};

const QUICK_COMMAND_BUTTONS: { label: string; text: string }[] = [
  { label: "Chào khách", text: "chào khách" },
  { label: "Mày là ai", text: "mày là ai" },
  { label: "Giới thiệu bán hàng", text: "giới thiệu bán hàng" },
  { label: "Quay trái", text: "quay trái" },
  { label: "Quay phải", text: "quay phải" },
  { label: "Ngủ đi", text: "ngủ đi" },
];

// suggestedNextActions từ backend là nhãn tiếng Việt (xem
// src/lib/robot-ai/presentation.ts) — map sang đúng text Intent Resolver
// nhận diện được khi user bấm chip gợi ý.
const SUGGESTION_TEXT_MAP: Record<string, string> = {
  "Chào khách": "chào khách",
  "Mày là ai": "mày là ai",
  "Giới thiệu bán hàng": "giới thiệu bán hàng",
  "Quay trái": "quay trái",
  "Quay phải": "quay phải",
  "Ngủ đi": "ngủ đi",
  "Thức dậy": "thức dậy",
};

// Thời gian tối thiểu robot ở trạng thái "thinking" trước khi chuyển sang
// speaking — local scenario trả lời trong <5ms, không có khoảng dừng này thì
// mặt robot "giật" từ thinking sang speaking gần như tức thời, không giống
// đang xử lý gì cả.
const MIN_THINKING_MS = 300;

const AUTO_SPEAK_KEY = "robot_chuoi_auto_speak";

const CHAT_MEMORY_KEY = "robot_chuoi_demo_v3_history";
// Key cũ của các bản trước — CHỦ ĐỘNG không load, chỉ dọn rác localStorage.
const OLD_CHAT_MEMORY_KEYS = ["robot_chuoi_history", "robot_chuoi_clean_history", "robot_chuoi_chat_history"];
const CHAT_MEMORY_LIMIT = 20;
const CHAT_DISPLAY_LIMIT = 6;

// sessionId — để Conversation Agent nhớ ngữ cảnh giữa các lượt hỏi trong cùng
// phiên (xem loadSessionHistoryText trong conversation-agent.ts). Sinh 1 lần,
// giữ trong localStorage — không phải UI hiển thị, chỉ là dây nối phía sau.
const SESSION_ID_KEY = "robot_chuoi_session_id";

// "Đọc lại"/"Dừng nói" xử lý NGAY trên client (không gọi API) — đây là điều
// khiển UI (giống hệt 2 nút có sẵn "🔊 Tự động nói"/"⏹ Dừng nói"), không phải
// nội dung AI bịa ra, nên không cần đi qua Conversation Agent.
const REPLAY_PHRASES = ["đọc lại", "nói lại", "lặp lại", "nhắc lại"];
// KHÔNG có "dừng lại" đơn lẻ ở đây — trùng với ROBOT_ACTION_WORDS
// ("robot dừng lại" là lệnh robot thật, phải đi qua Conversation Agent, không
// chặn ở client). Chỉ chặn client-side các cụm chắc chắn là "im giọng nói".
const STOP_SPEECH_PHRASES = ["dừng nói", "im lặng", "ngừng nói", "thôi nói"];

function stripDiacriticsForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function matchesAnyPhrase(text: string, phrases: string[]): boolean {
  const normalized = ` ${stripDiacriticsForMatch(text)} `;
  return phrases.some((p) => normalized.includes(` ${stripDiacriticsForMatch(p)} `));
}

const GREETING: ChatMessage = {
  id: "greet",
  role: "robot",
  content: "Xin chào, mình là Chuối đây.",
  created_at: new Date(0).toISOString(),
};

// ─── Web Speech API — khai báo tối thiểu, chỉ 1 lượt nghe (không có lib.dom) ──
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function RobotPage() {
  const [robotState, setRobotState] = useState<RobotState>("idle");
  const [gazeOverride, setGazeOverride] = useState<{ x: number; y: number } | null>(null);
  const gazeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fullscreen chỉ phần mặt robot (không phải cả trang) — requestFullscreen()
  // trên faceCardRef. isFullscreen cũng là fallback layout (fixed inset-0) cho
  // trình duyệt từ chối requestFullscreen() (vd 1 số bối cảnh iOS Safari).
  const faceCardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    function handleFullscreenChange() {
      if (document.fullscreenElement !== faceCardRef.current) setIsFullscreen(false);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);
  useEffect(() => {
    if (isFullscreen && faceCardRef.current && document.fullscreenElement !== faceCardRef.current) {
      faceCardRef.current.requestFullscreen().catch(() => {
        // Bị từ chối — vẫn dùng layout fullscreen giả lập qua CSS (fixed inset-0).
      });
    }
  }, [isFullscreen]);
  function toggleFullscreen() {
    if (isFullscreen) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    } else {
      setIsFullscreen(true);
    }
  }

  // Tự động nói — mặc định bật, lưu localStorage để nhớ lựa chọn qua các lần mở lại.
  const [autoSpeak, setAutoSpeak] = useState(true);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(AUTO_SPEAK_KEY);
      if (saved !== null) setAutoSpeak(saved === "true");
    } catch {
      // bỏ qua — giữ mặc định true
    }
  }, []);
  function toggleAutoSpeak() {
    setAutoSpeak((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(AUTO_SPEAK_KEY, String(next));
      } catch {
        // bỏ qua
      }
      return next;
    });
  }

  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);

  const [sttSupported, setSttSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const viVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string>("");

  // ─── Vision (Phase 6C) — camera preview + ảnh đang chờ gửi ──────────────
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [stagedImage, setStagedImage] = useState<{ blob: Blob; previewUrl: string; origin: "camera" | "upload" } | null>(null);
  const [visionBusy, setVisionBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Presence camera (Phase 6E) + Social Brain (Phase 6F) ───────────────
  const [presenceEnabled, setPresenceEnabled] = useState(false);
  const [presenceFrame, setPresenceFrame] = useState<PresenceFrame | null>(null);
  const [presenceGesture, setPresenceGesture] = useState<RobotGesture>("none");
  const [presenceMouth, setPresenceMouth] = useState<"smile" | null>(null);
  const [attentionActive, setAttentionActive] = useState(false);
  const [blinkTrigger, setBlinkTrigger] = useState(0);
  const [sellingContext, setSellingContext] = useState(false);
  const [lastSocialMood, setLastSocialMood] = useState<SocialMoodResult | null>(null);
  const [socialDebug, setSocialDebug] = useState<ReturnType<SocialBrain["debugSnapshot"]> | null>(null);
  const socialBrainRef = useRef<SocialBrain | null>(null);
  if (!socialBrainRef.current) socialBrainRef.current = new SocialBrain();
  const latestFrameRef = useRef<PresenceFrame | null>(null);
  const gestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dọn camera stream + object URL khi rời trang — không để camera bật ngầm.
  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // sessionId ổn định qua các lần mở lại trang — sinh 1 lần, lưu localStorage.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SESSION_ID_KEY);
      if (saved) {
        sessionIdRef.current = saved;
      } else {
        const generated = crypto.randomUUID();
        sessionIdRef.current = generated;
        window.localStorage.setItem(SESSION_ID_KEY, generated);
      }
    } catch {
      sessionIdRef.current = `robot-${Date.now()}`;
    }
  }, []);

  // Dọn key localStorage cũ + nạp lịch sử của bản này (nếu có), lúc mount.
  useEffect(() => {
    for (const key of OLD_CHAT_MEMORY_KEYS) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // bỏ qua
      }
    }
    try {
      const raw = window.localStorage.getItem(CHAT_MEMORY_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(saved) && saved.length > 0) setMessages(saved);
      }
    } catch {
      // localStorage hỏng/không parse được — giữ nguyên câu chào mặc định.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_MEMORY_KEY, JSON.stringify(messages.slice(-CHAT_MEMORY_LIMIT)));
    } catch {
      // localStorage đầy/bị chặn — bỏ qua, không ảnh hưởng chat.
    }
  }, [messages]);

  function clearChat() {
    setMessages([GREETING]);
    try {
      window.localStorage.removeItem(CHAT_MEMORY_KEY);
    } catch {
      // bỏ qua
    }
  }

  // Giọng đọc trình duyệt (Web Speech API) — không gọi API ngoài, không có
  // panel chọn giọng/toggle âm thanh, cứ có là đọc.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    function pickVietnameseVoice() {
      const voices = window.speechSynthesis.getVoices();
      viVoiceRef.current = voices.find((v) => v.lang.toLowerCase().startsWith("vi")) ?? null;
    }
    pickVietnameseVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVietnameseVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pickVietnameseVoice);
  }, []);

  useEffect(() => {
    setSttSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  function speakBrowser(text: string, onDone: () => void) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "vi-VN";
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    if (viVoiceRef.current) utter.voice = viVoiceRef.current;
    utter.onend = onDone;
    utter.onerror = onDone;
    setRobotState("speaking");
    window.speechSynthesis.speak(utter);
  }

  // Giọng thật ưu tiên VoiceAgent → ElevenLabs (/api/voice/generate, cùng
  // route Voice Agent trong Orchestrator dùng — không tạo route TTS thứ 2).
  // ElevenLabs lỗi/chưa cấu hình (ELEVENLABS_API_KEY) → rơi về giọng trình
  // duyệt, KHÔNG im lặng, không bịa audio.
  async function speak(text: string, onDone: () => void) {
    setRobotState("speaking");
    try {
      const res = await fetch("/api/voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json()) as { success: boolean; audioUrl?: string };
      if (!json.success || !json.audioUrl) {
        speakBrowser(text, onDone);
        return;
      }
      if (typeof window === "undefined") {
        onDone();
        return;
      }
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = json.audioUrl;
      audio.onended = onDone;
      audio.onerror = () => speakBrowser(text, onDone);
      await audio.play();
    } catch {
      speakBrowser(text, onDone);
    }
  }

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setRobotState("idle");
  }

  function applyGaze(eyes?: string) {
    if (!eyes || !(eyes in EYES_TO_GAZE)) return;
    if (gazeTimerRef.current) clearTimeout(gazeTimerRef.current);
    const target = EYES_TO_GAZE[eyes];
    setGazeOverride(target);
    if (target) {
      gazeTimerRef.current = setTimeout(() => setGazeOverride(null), EYES_OVERRIDE_MS);
    }
  }

  function flashError() {
    setRobotState("error");
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setRobotState("idle"), 1500);
  }

  // ─── Social Brain (Phase 6F) ────────────────────────────────────────────
  // "talking" = robot đang nghe/nghĩ/nói (chat text, vision đang xử lý, camera
  // vision snapshot đang mở) — mục 3 "never interrupt" + mục 6 "keep eye
  // contact while talking, return idle when stops": SocialBrain tự khoá lại
  // (không đổi target, không phát look/greet/invite mới) suốt lúc này.
  const talking = robotState === "listening" || robotState === "thinking" || robotState === "speaking";

  function triggerGesture(gesture: RobotGesture, ms: number) {
    if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    setPresenceGesture(gesture);
    gestureTimerRef.current = setTimeout(() => setPresenceGesture("none"), ms);
  }

  function triggerMouthSmile(ms: number) {
    if (mouthTimerRef.current) clearTimeout(mouthTimerRef.current);
    setPresenceMouth("smile");
    mouthTimerRef.current = setTimeout(() => setPresenceMouth(null), ms);
  }

  // Best-effort — chỗ DeviceManager thật (mục 9 "later DeviceManager will
  // simply consume actions") sau này chỉ việc đọc lại các DeviceEvent
  // "social.*" này, KHÔNG chặn UI nếu lỗi/mất mạng.
  function logSocialAction(action: SocialAction) {
    fetch("/api/robot/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: `social.${action.kind}`, payload: action as unknown as Record<string, unknown> }),
    }).catch(() => {
      // Không có robot device/offline — Social Brain vẫn chạy được trên simulator.
    });
  }

  // Mood (mục 1 "every response carries one mood") điều khiển blink/đầu ngay —
  // faceState ("eye animation") do từng nhánh bên dưới tự set qua setRobotState
  // (idle/look set ngay, greet/invite/joke/goodbye set SAU KHI nói xong) để
  // không đè animation "đang nói" giữa chừng.
  function applyMoodVisuals(mood: SocialMoodResult) {
    setAttentionActive(mood.fastBlink);
    if (mood.gesture) triggerGesture(mood.gesture, mood.gesture === "breathe" ? 1800 : 900);
  }

  function handleSocialAction(action: SocialAction) {
    logSocialAction(action);
    applyMoodVisuals(action.mood);
    setLastSocialMood(action.mood);

    if (action.kind === "idle") {
      setRobotState(action.mood.faceState);
      switch (action.behavior) {
        case "blink":
          setBlinkTrigger((n) => n + 1);
          break;
        case "look_left":
          applyGaze("left");
          break;
        case "look_right":
          applyGaze("right");
          break;
        case "smile":
          triggerMouthSmile(1200);
          break;
        case "breathe":
          // Hành vi idle "breathe" (mục 8) tự nó phải kích hoạt gesture, KHÔNG
          // phụ thuộc mood hiện tại có gesture hay không (applyMoodVisuals()
          // chỉ áp gesture khi MOOD yêu cầu — 2 nguồn kích hoạt độc lập nhau).
          triggerGesture("breathe", 1800);
          break;
      }
      return;
    }
    if (action.kind === "look") {
      setRobotState(action.mood.faceState);
      return; // hướng nhìn thật do cameraTarget (prop RobotFaceKiosk bên dưới) lo liên tục — không cần gazeOverride rời rạc ở đây
    }

    // greet/invite/joke/goodbye — đều có `say` (mục 5 Humor Layer).
    setMessages((prev) => [
      ...prev,
      { id: `social-${Date.now()}`, role: "robot", content: action.say, created_at: new Date().toISOString() },
    ]);
    if (autoSpeak) speak(action.say, () => setRobotState(action.mood.faceState));
    else setRobotState(action.mood.faceState);
  }

  // Tick SocialBrain mỗi giây — idle behaviors chạy dù presence (camera)
  // đang tắt, luật xã hội (look/chào/mời/tạm biệt) chỉ chạy khi có
  // PresenceFrame thật. deps=[] nên hàm bên trong CHỈ được tạo 1 lần lúc
  // mount — mọi state đọc trực tiếp (autoSpeak/isListening/sellingContext/
  // lastResponse/robotState) sẽ "đóng băng" ở giá trị render đầu nếu gọi
  // thẳng, nên interval gọi qua ref "luôn mới nhất" này (gán lại mỗi render).
  function runSocialTick() {
    const now = Date.now();
    const ctx: SocialBrainContext = {
      isTalking: talking,
      isListening,
      sellingContext,
      chatMood: lastResponse?.mood as RobotMood | undefined,
    };
    const actions = socialBrainRef.current?.tick(now, latestFrameRef.current, ctx) ?? [];
    actions.forEach(handleSocialAction);
    setSocialDebug(socialBrainRef.current?.debugSnapshot(now, ctx) ?? null);
  }
  const runSocialTickRef = useRef(runSocialTick);
  runSocialTickRef.current = runSocialTick;

  useEffect(() => {
    const id = setInterval(() => runSocialTickRef.current(), 1000);
    return () => clearInterval(id);
  }, []);

  // Mục 7 "Sales Mode" — project context hiện tại có phải ChinChin không.
  // Đọc lại GET /api/robot/continuity ĐÃ CÓ SẴN từ Phase 6B
  // (activeProject.name) — KHÔNG thêm/đổi route nào, KHÔNG đụng Conversation
  // Agent. Poll nhẹ mỗi 30s, đủ nhanh để bắt kịp lúc đổi project sáng tạo.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/robot/continuity");
        const json = (await res.json()) as { activeProject?: { name?: string } | null };
        if (!cancelled) setSellingContext(json.activeProject?.name === "ChinChin");
      } catch {
        // Lỗi mạng tạm thời — giữ nguyên giá trị cũ, không đổi mood vì lỗi vặt.
      }
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  function handlePresenceFrame(frame: PresenceFrame) {
    latestFrameRef.current = frame;
    setPresenceFrame(frame);
  }

  function togglePresence() {
    setPresenceEnabled((prev) => {
      const next = !prev;
      if (!next) {
        latestFrameRef.current = null;
        setPresenceFrame(null);
      }
      return next;
    });
  }

  // "look" (mục 3, 2-3s) — mắt hướng liên tục về phía người đang đứng trước
  // camera, KHÔNG chỉ khi tier "look" vừa kích hoạt (tự nhiên hơn, và cũng là
  // cách mục 6 "keep eye contact while talking" có tác dụng thật khi camera
  // presence đang bật). detected=false hoặc presence tắt → useRobotEyes tự
  // rơi về pointer/idle wander như cũ.
  const cameraTarget = presenceEnabled && presenceFrame?.detected ? { x: presenceFrame.x, y: presenceFrame.y, detected: true } : null;

  // ─── Vision (Phase 6C) ───────────────────────────────────────────────────
  // State binding mục 10: mở camera = observing (dùng lại "listening" — face
  // chưa có riêng 1 state "observing"), gửi ảnh = thinking, trả lời = speaking,
  // lỗi camera = alert (dùng lại flashError/"error"), xong = idle.
  function stopCameraStream() {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
  }

  async function openCamera() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      flashError();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacing }, audio: false });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOpen(true);
      setRobotState("listening"); // observing

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCanSwitchCamera(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch {
        setCanSwitchCamera(false);
      }
    } catch {
      // Quyền camera bị từ chối/không có camera — mục 13 test F: KHÔNG được
      // làm hỏng /robot, chỉ báo lỗi ngắn rồi rơi về nút tải ảnh lên (vẫn hiển
      // thị bình thường, không cần code riêng — nút Ảnh luôn có sẵn).
      flashError();
      setCameraOpen(false);
    }
  }

  function closeCamera() {
    stopCameraStream();
    setCameraOpen(false);
    setRobotState("idle");
  }

  async function switchCameraFacing() {
    const next = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(next);
    stopCameraStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      flashError();
      setCameraOpen(false);
    }
  }

  function stageImage(blob: Blob, origin: "camera" | "upload") {
    if (stagedImage) URL.revokeObjectURL(stagedImage.previewUrl);
    setStagedImage({ blob, previewUrl: URL.createObjectURL(blob), origin });
  }

  function captureSnapshot() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) stageImage(blob, "camera");
    }, "image/jpeg", 0.9);
    closeCamera();
  }

  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
  const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại đúng file đó lần sau
    if (!file) return;
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      flashError();
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      flashError();
      return;
    }
    stageImage(file, "upload");
  }

  function removeStagedImage() {
    if (stagedImage) URL.revokeObjectURL(stagedImage.previewUrl);
    setStagedImage(null);
  }

  async function sendVisionMessage(promptText: string) {
    if (!stagedImage || visionBusy) return;
    const image = stagedImage;
    const text = promptText.trim();

    setVisionBusy(true);
    setChatInput("");
    setLastSuggestions([]);
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: "user",
        content: text || "(gửi ảnh)",
        created_at: new Date().toISOString(),
        imagePreviewUrl: image.previewUrl,
      },
    ]);
    removeStagedImage();
    setRobotState("thinking");

    try {
      const form = new FormData();
      form.append("file", image.blob, image.origin === "camera" ? "capture.jpg" : "upload");
      form.append("captureOrigin", image.origin);
      if (sessionIdRef.current) form.append("sessionId", sessionIdRef.current);

      const uploadRes = await fetch("/api/robot/vision/upload", { method: "POST", body: form });
      const uploadJson = (await uploadRes.json()) as VisionUploadResponse;
      if (!uploadJson.ok || !uploadJson.imageId) {
        flashError();
        return;
      }

      const analyzeRes = await fetch("/api/robot/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: uploadJson.imageId, prompt: text || undefined, sessionId: sessionIdRef.current || undefined }),
      });
      const analyzeJson = (await analyzeRes.json()) as VisionAnalyzeResponse;
      if (!analyzeJson.ok || !analyzeJson.text) {
        flashError();
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: `local-reply-${Date.now()}`, role: "robot", content: analyzeJson.text as string, created_at: new Date().toISOString() },
      ]);
      setLastSuggestions(analyzeJson.suggestedActions ?? []);

      if (autoSpeak && analyzeJson.audio?.path) {
        setRobotState("speaking");
        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        audio.src = analyzeJson.audio.path;
        audio.onended = () => setRobotState("idle");
        audio.onerror = () => speakBrowser(analyzeJson.text as string, () => setRobotState("idle"));
        await audio.play().catch(() => speakBrowser(analyzeJson.text as string, () => setRobotState("idle")));
      } else if (autoSpeak) {
        speakBrowser(analyzeJson.text, () => setRobotState("idle"));
      } else {
        setRobotState("idle");
      }
    } catch {
      flashError();
    } finally {
      setVisionBusy(false);
    }
  }

  // "Đọc lại"/"Dừng nói" — điều khiển audio ngay trên client, không gọi
  // /api/robot/chat (không phải câu hỏi cho AI, chỉ là lệnh UI, xem
  // REPLAY_PHRASES/STOP_SPEECH_PHRASES ở đầu file).
  function handleStopSpeechCommand(text: string) {
    setChatInput("");
    stopSpeaking();
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() },
      { id: `local-stop-${Date.now()}`, role: "robot", content: "Chuối dừng nói rồi.", created_at: new Date().toISOString() },
    ]);
  }

  function handleReplayCommand(text: string) {
    setChatInput("");
    const lastRobotMessage = [...messages].reverse().find((m) => m.role === "robot");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    if (!lastRobotMessage) return;
    const mapped = moodToState(lastResponse?.mood) ?? "idle";
    if (autoSpeak) {
      speak(lastRobotMessage.content, () => setRobotState(mapped));
    }
  }

  async function sendChatMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || chatLoading) return;
    if (matchesAnyPhrase(text, STOP_SPEECH_PHRASES)) return handleStopSpeechCommand(text);
    if (matchesAnyPhrase(text, REPLAY_PHRASES)) return handleReplayCommand(text);

    setChatLoading(true);
    setChatInput("");
    setLastSuggestions([]);
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    setRobotState("thinking");
    const thinkingStartedAt = Date.now();
    try {
      const res = await fetch("/api/robot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source: "text", sessionId: sessionIdRef.current || undefined }),
      });
      const json = (await res.json()) as ChatResponse;

      const elapsed = Date.now() - thinkingStartedAt;
      if (elapsed < MIN_THINKING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_THINKING_MS - elapsed));
      }

      if (!json.ok || !json.reply) {
        flashError();
        return;
      }
      setLastResponse(json);
      setLastSuggestions(json.suggestedNextActions ?? []);
      setMessages((prev) => [
        ...prev,
        { id: `local-reply-${Date.now()}`, role: "robot", content: json.reply as string, created_at: new Date().toISOString() },
      ]);
      // Mục 4 "last topic" — gắn câu hỏi vừa chat vào khách đang là
      // currentTarget (nếu presence đang bật và có ai trước camera), để nếu
      // họ quay lại trong 30 phút, describeReturning() có thể nhắc tới.
      socialBrainRef.current?.noteTopic(Date.now(), { isTalking: true, isListening: false, sellingContext, chatMood: json.mood as RobotMood | undefined }, text);
      applyGaze(json.eyes);
      const mapped = moodToState(json.mood) ?? "idle";
      if (autoSpeak && json.reply.trim()) {
        speak(json.reply, () => setRobotState(mapped));
      } else {
        setRobotState(mapped);
      }
    } catch {
      flashError();
    } finally {
      setChatLoading(false);
    }
  }

  function sendSuggestedAction(label: string) {
    sendChatMessage(SUGGESTION_TEXT_MAP[label] ?? label);
  }

  function toggleMic() {
    if (!sttSupported) return;
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const text = result?.[0]?.transcript?.trim();
      if (text) sendChatMessage(text);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    setRobotState("listening");
    recognition.start();
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1120px] mx-auto">
      <PresenceDetector enabled={presenceEnabled} onFrame={handlePresenceFrame} />
      <PageHeader
        title="Robot Chuối"
        description="Robot mô phỏng trên web, trước khi nối ESP32-S3"
        action={
          <div className="flex items-center gap-2">
            <Badge variant="green">online</Badge>
            <Badge variant="indigo">Brain OS Conversation Agent</Badge>
            <button
              onClick={togglePresence}
              title="Bật camera để robot tự chào/để ý khi có người tới gần (Social Brain, Phase 6F)"
              className={`text-[11px] px-2.5 py-1 rounded-lg active:scale-95 transition-all ${
                presenceEnabled ? "bg-emerald-600/30 text-emerald-300" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              👀 Presence: {presenceEnabled ? "Bật" : "Tắt"}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT — mặt robot */}
        <Card className={isFullscreen ? "p-0" : ""}>
          <div
            ref={faceCardRef}
            className={`relative flex flex-col items-center justify-center ${
              isFullscreen ? "fixed inset-0 z-50 bg-[#0b0b0f] w-screen h-screen" : "py-10"
            }`}
          >
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
              className={`absolute top-3 right-3 px-3 h-9 rounded-lg text-xs flex items-center gap-1 bg-zinc-800/80 text-zinc-300 hover:bg-indigo-600/30 active:scale-95 transition-all ${
                isFullscreen ? "z-10" : ""
              }`}
            >
              {isFullscreen ? "⤢ Thoát toàn màn hình" : "⛶ Toàn màn hình"}
            </button>
            <RobotFaceKiosk
              state={robotState as RobotFaceState}
              gazeOverride={gazeOverride}
              cameraTarget={cameraTarget}
              enablePointerTracking
              gesture={presenceGesture}
              mouthOverride={presenceMouth}
              attentionActive={attentionActive}
              blinkTrigger={blinkTrigger}
              className={isFullscreen ? "w-[min(70vw,70vh)]" : "w-56 sm:w-64 md:w-72"}
            />
            <p className="mt-4 text-sm text-zinc-400">{STATUS_TEXT[robotState]}</p>
          </div>
        </Card>

        {/* RIGHT — quick command buttons + chat */}
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-sm font-medium text-zinc-100 mb-3">Lệnh nhanh</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_COMMAND_BUTTONS.map((d) => (
                <button
                  key={d.label}
                  disabled={chatLoading}
                  onClick={() => sendChatMessage(d.text)}
                  className="min-h-[3.25rem] px-3 py-2 text-sm font-medium rounded-xl bg-zinc-800 text-zinc-200 hover:bg-indigo-600/30 hover:text-indigo-300 active:scale-95 transition-all disabled:opacity-50"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-medium text-zinc-100">Chat với Chuối</h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleAutoSpeak}
                  title="Chuối tự đọc câu trả lời bằng giọng trình duyệt"
                  className={`text-[11px] px-2.5 py-1 rounded-lg active:scale-95 transition-all ${
                    autoSpeak ? "bg-indigo-600/30 text-indigo-300" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  🔊 Tự động nói: {autoSpeak ? "Bật" : "Tắt"}
                </button>
                <button
                  onClick={stopSpeaking}
                  title="Dừng nói"
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 active:scale-95 transition-all"
                >
                  ⏹ Dừng nói
                </button>
                <button
                  onClick={clearChat}
                  title="Xoá hội thoại"
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-red-600/20 hover:text-red-300 active:scale-95 transition-all"
                >
                  Xoá
                </button>
              </div>
            </div>
            <div className="space-y-2 mb-3">
              {messages.slice(-CHAT_DISPLAY_LIMIT).map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      m.role === "user" ? "bg-indigo-600/30 text-indigo-100" : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {m.imagePreviewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imagePreviewUrl} alt="Ảnh đã gửi cho Chuối" className="rounded-lg mb-1.5 max-h-40 max-w-full object-cover" />
                    )}
                    {m.content}
                  </div>
                </div>
              ))}
              {(chatLoading || visionBusy) && <p className="text-xs text-zinc-500">Chuối đang trả lời...</p>}
            </div>
            {!chatLoading && lastSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {lastSuggestions.map((label) => (
                  <button
                    key={label}
                    onClick={() => sendSuggestedAction(label)}
                    className="text-xs px-2.5 py-1 rounded-full bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 active:scale-95 transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {/* Vision (Phase 6C) — camera preview / staged image, tối giản, không dashboard riêng */}
            {cameraOpen && (
              <div className="mb-3 rounded-xl overflow-hidden bg-black relative">
                <video ref={videoRef} muted playsInline className="w-full max-h-56 object-cover" />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-2">
                  <button
                    onClick={captureSnapshot}
                    className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium active:scale-95 transition-all"
                  >
                    📸 Chụp
                  </button>
                  {canSwitchCamera && (
                    <button
                      onClick={switchCameraFacing}
                      title="Đổi camera"
                      className="w-10 h-10 rounded-full bg-zinc-800/90 text-zinc-200 flex items-center justify-center active:scale-95 transition-all"
                    >
                      🔄
                    </button>
                  )}
                  <button
                    onClick={closeCamera}
                    title="Đóng camera"
                    className="w-10 h-10 rounded-full bg-zinc-800/90 text-zinc-200 flex items-center justify-center active:scale-95 transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            {stagedImage && !cameraOpen && (
              <div className="mb-3 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stagedImage.previewUrl} alt="Ảnh sắp gửi" className="h-16 w-16 rounded-lg object-cover border border-zinc-700" />
                <div className="flex-1 text-xs text-zinc-400">Ảnh đã sẵn sàng — nhắn thêm câu hỏi (không bắt buộc) rồi bấm Gửi.</div>
                <button
                  onClick={removeStagedImage}
                  title="Bỏ ảnh"
                  className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-red-600/20 hover:text-red-300 flex items-center justify-center active:scale-95 transition-all shrink-0"
                >
                  ✕
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelected}
              className="hidden"
            />
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => (cameraOpen ? closeCamera() : openCamera())}
                title="Camera"
                className={`text-[11px] px-2.5 py-1.5 rounded-lg active:scale-95 transition-all ${
                  cameraOpen ? "bg-indigo-600/30 text-indigo-300" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                📷 Camera
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Tải ảnh lên"
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 active:scale-95 transition-all"
              >
                🖼️ Tải ảnh lên
              </button>
            </div>
            <div className="flex gap-2">
              {sttSupported && (
                <button
                  onClick={toggleMic}
                  title="Bấm nói"
                  className={`min-h-[3rem] w-12 shrink-0 rounded-xl flex items-center justify-center text-lg transition-all active:scale-95 ${
                    isListening ? "bg-red-600/40 text-red-300" : "bg-zinc-800 text-zinc-300 hover:bg-indigo-600/30"
                  }`}
                >
                  {isListening ? "⏹" : "🎤"}
                </button>
              )}
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (stagedImage ? sendVisionMessage(chatInput) : sendChatMessage(chatInput));
                }}
                placeholder={stagedImage ? "Hỏi gì đó về ảnh này (không bắt buộc)..." : "Nhắn gì đó với Chuối..."}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 min-h-[3rem]"
              />
              <button
                onClick={() => (stagedImage ? sendVisionMessage(chatInput) : sendChatMessage(chatInput))}
                disabled={chatLoading || visionBusy || (!stagedImage && !chatInput.trim())}
                className="min-h-[3rem] px-4 rounded-xl bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 active:scale-95 transition-all disabled:opacity-40 shrink-0 text-sm font-medium"
              >
                Gửi
              </button>
            </div>
          </Card>
        </div>
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 select-none">Nâng cao</summary>
        <Card className="mt-2 text-xs">
          {lastResponse ? (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1 font-mono text-zinc-400">
                <span>provider: {lastResponse.provider ?? "—"}</span>
                <span>mood: {lastResponse.mood ?? "—"}</span>
                <span>action: {lastResponse.action ?? "—"}</span>
                <span>eyes: {lastResponse.eyes ?? "—"}</span>
                <span>mouth: {lastResponse.mouth ?? "—"}</span>
                <span>
                  hardwareCommand: {lastResponse.hardwareCommand?.type ?? "none"}
                  {lastResponse.hardwareCommand?.command ? `/${lastResponse.hardwareCommand.command}` : ""}
                </span>
                <span>brainNote: {lastResponse.brainNote ?? "—"}</span>
                <span>suggestedNextActions: {lastResponse.suggestedNextActions?.join(", ") || "—"}</span>
              </div>
              {lastResponse.provider === "fallback" && (
                <p className="text-amber-500">
                  OpenAI chưa cấu hình hoặc gọi lỗi{lastResponse.error ? `: ${lastResponse.error}` : "."} Local skills vẫn chạy
                  bình thường.
                </p>
              )}
              <pre className="mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-2 overflow-x-auto text-zinc-500">
                {JSON.stringify(lastResponse, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-zinc-500">Chưa có phản hồi nào.</p>
          )}
          <p className="mt-2 text-zinc-600">Sau này map hardwareCommand sang ESP32-S3.</p>
        </Card>

        <Card className="mt-2 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1 font-mono text-zinc-400">
            <span>presence: {presenceEnabled ? "bật" : "tắt"}</span>
            <span>người: {presenceFrame?.detected ? "có" : "không"}</span>
            <span>số mặt: {presenceFrame?.count ?? 0}</span>
            <span>khoảng cách: {presenceFrame?.distance ?? "—"}</span>
            <span>chuyển động: {presenceFrame ? presenceFrame.motion.toFixed(2) : "—"}</span>
            <span>nguồn: {presenceFrame?.source ?? "—"}</span>
            <span>attention: {attentionActive ? "có" : "không"}</span>
            <span>mood: {lastSocialMood?.mood ?? "—"}</span>
            <span>selling: {sellingContext ? "có" : "không"}</span>
            <span>attentionScore: {socialDebug?.attention.attentionScore.toFixed(2) ?? "—"}</span>
            <span>currentTarget: {socialDebug?.attention.currentTargetId ?? "—"}</span>
            <span>khách nhớ (30p): {socialDebug?.visitorCount ?? 0}</span>
          </div>
          {socialDebug?.currentVisitorDescription && (
            <p className="mt-2 text-zinc-500">Quan sát khách hiện tại: {socialDebug.currentVisitorDescription} (ước lượng, không chắc chắn).</p>
          )}
          <p className="mt-2 text-zinc-600">
            Social Brain (Phase 6F) — luật look/chào/mời chỉ chạy khi bật camera Presence ở trên; idle behaviors
            (blink/look/smile/breathe) vẫn chạy dù tắt.
          </p>
        </Card>
      </details>
    </div>
  );
}
