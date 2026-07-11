"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RobotFaceKiosk, type RobotFaceState, type RobotGesture } from "@/components/robot/RobotFaceKiosk";
import { PresenceDetector } from "@/components/robot/PresenceDetector";
import type { PresenceFrame } from "@/lib/robot/presence-types";
import { BrainLoop } from "@/lib/robot/brain/brain-loop";
import type { BrainCycleResult, BrainLoopInputs, ConversationState, VisualHint } from "@/lib/robot/brain/types";
import { moodFaceParams } from "@/lib/robot/social/mood-engine";
import type { SocialMood } from "@/lib/robot/social/types";
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
// thuần logic không đụng DOM) gộp MoodEngine (9 mood), AttentionEngine
// (currentTarget/attentionScore, luật bậc thời gian nhìn: 2-3s "look", 5s
// chào, 10s mời — mỗi bậc CHỈ 1 LẦN cho 1 người), ConversationMemory (nhớ
// khách vãng lai ~30 phút, luôn nói giọng phỏng đoán) và HumorEngine (câu
// chào/đùa/tạm biệt/bán hàng xoay vòng — KHÔNG gọi AI provider nào).
//
// Phase 6G (2026-07-11) — Brain Loop: robot chủ động thật sự, không chỉ chờ
// sự kiện. BrainLoop (src/lib/robot/brain/, thuần logic) chạy vòng lặp
// Observe→Think→Prioritize→Plan mỗi 200ms (page.tsx chỉ còn việc Execute —
// áp PlannedAction lên UI/giọng nói): Observe gom WorldState mới nhất
// (presence/conversation/mood từ SocialBrain — SocialBrain giờ SỐNG BÊN
// TRONG BrainLoop, page.tsx không giữ ref riêng nữa — + project/camera/thời
// gian rảnh); Think (GoalEngine) chọn 1 trong 9 goal (Idle/Greeting/
// Conversation/Selling/Watching/Thinking/Listening/Waiting/Sleeping), mỗi
// goal có priority/interruptible/timeout/completion condition riêng;
// Prioritize (PriorityEngine) quyết định có chuyển goal hay không — ưu tiên
// cao hơn luôn thắng, "never interrupt" hội thoại thật; Plan (ActionPlanner)
// luôn ra ĐÚNG 1 action trong 15 action cố định (LookLeft/LookRight/
// LookAtPerson/Blink/Smile/Wave/Speak/StaySilent/Wait/StartConversation/
// ContinueConversation/EndConversation/Invite/ReturnIdle/Sleep) — SocialAction
// từ SocialBrain luôn có thẩm quyền cao nhất khi có, Scheduler (mốc 3s/8s/
// 15s/30s/60s) chỉ là lớp idle-ambience/lưới an toàn phía dưới. Thêm 1 lớp
// cooldown TOÀN CỤC mới (chào 60s/mời 90s/đùa-hoặc-câu-bán-hàng-y-hệt 5
// phút — "never spam", KHÁC cooldown per-target đã có của AttentionEngine).
// Không đụng Vision provider/Conversation Agent/Device Manager/ESP32.

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

  // ─── Presence camera (Phase 6E) + Brain Loop (Phase 6F/6G) ───────────────
  const [presenceEnabled, setPresenceEnabled] = useState(false);
  const [presenceFrame, setPresenceFrame] = useState<PresenceFrame | null>(null);
  const [presenceGesture, setPresenceGesture] = useState<RobotGesture>("none");
  const [presenceMouth, setPresenceMouth] = useState<"smile" | null>(null);
  const [attentionActive, setAttentionActive] = useState(false);
  const [blinkTrigger, setBlinkTrigger] = useState(0);
  const [sellingContext, setSellingContext] = useState(false);
  const [projectContext, setProjectContext] = useState<string | null>(null);
  const [lastCycle, setLastCycle] = useState<BrainCycleResult | null>(null);
  const brainLoopRef = useRef<BrainLoop | null>(null);
  if (!brainLoopRef.current) brainLoopRef.current = new BrainLoop();
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

  // ─── Brain Loop (Phase 6G) ───────────────────────────────────────────────
  // "talking" = robot đang nghe/nghĩ/nói (chat text, vision đang xử lý, camera
  // vision snapshot đang mở) — dùng để suy ra conversationState cho
  // BrainLoop, KHÔNG tính lại gì mới (mục 3 "never interrupt" của Phase 6F
  // vẫn đúng nguyên vẹn qua GoalEngine: Conversation/Listening/Thinking luôn
  // ưu tiên cao nhất, xem goal-engine.ts).
  const talking = robotState === "listening" || robotState === "thinking" || robotState === "speaking";
  const conversationState: ConversationState = !talking ? "none" : isListening ? "mic_listening" : robotState === "speaking" ? "speaking" : "thinking";

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

  // Best-effort — chỗ DeviceManager thật (mục "Simulation": "Provide debug
  // overlay"/kế thừa mục 9 Phase 6F "later DeviceManager will simply consume
  // actions") sau này chỉ việc đọc lại các DeviceEvent "brain.*" này, KHÔNG
  // chặn UI nếu lỗi/mất mạng (BrainLoop.cycle() bản thân không await gì cả —
  // "Never block" — log là việc RIÊNG của executor này, ngoài vòng lặp).
  function logBrainAction(result: BrainCycleResult) {
    fetch("/api/robot/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: `brain.${result.action.type}`,
        payload: { goal: result.goal, action: result.action, visualHint: result.visualHint } as unknown as Record<string, unknown>,
      }),
    }).catch(() => {
      // Không có robot device/offline — Brain Loop vẫn chạy được trên simulator.
    });
  }

  // Mood đi kèm PlannedAction chỉ giữ lại id (mục "Mood controls" đã tính 1
  // lần trong MoodEngine, xem moodFaceParams() — tra lại bảng ở executor này
  // thay vì mang cả object nặng qua từng lớp BrainLoop/ActionPlanner).
  function applyMoodVisuals(mood: SocialMood) {
    const params = moodFaceParams(mood);
    setAttentionActive(params.fastBlink);
  }

  // visualHint — hiệu ứng hình ảnh phụ KHÔNG có action riêng trong vocabulary
  // 15 action cố định (breathe/gật đầu/vẫy tay đã có từ Phase 6E/6F, giữ
  // nguyên hiệu ứng, không mất gì khi chuyển sang Phase 6G).
  function applyVisualHint(hint: VisualHint) {
    if (hint === "breathe") triggerGesture("breathe", 1800);
    else if (hint === "nod") triggerGesture("nod", 900);
    else if (hint === "wave_gesture") triggerGesture("wave", 900);
  }

  // Execute — bước cuối cùng của vòng lặp (Observe→Think→Prioritize→Plan đã
  // xong bên trong BrainLoop.cycle(), thuần logic không đụng DOM). Đúng 15
  // action cố định, switch đủ cả 15 để TypeScript tự báo thiếu nếu sau này
  // vocabulary đổi.
  function executeBrainAction(result: BrainCycleResult) {
    logBrainAction(result);
    applyMoodVisuals(result.action.mood);
    applyVisualHint(result.visualHint);
    setLastCycle(result);

    const { action } = result;
    switch (action.type) {
      case "Blink":
        setBlinkTrigger((n) => n + 1);
        break;
      case "LookLeft":
        applyGaze("left");
        break;
      case "LookRight":
        applyGaze("right");
        break;
      case "LookAtPerson":
        setGazeOverride(null); // cameraTarget (prop RobotFaceKiosk bên dưới) đã tự dẫn hướng liên tục
        break;
      case "Smile":
        triggerMouthSmile(1200);
        break;
      case "Wave":
        triggerGesture("wave", 900);
        break;
      case "Sleep":
        setRobotState("sleeping");
        break;
      case "Wait":
      case "StaySilent":
        break; // "Doing nothing is a valid action" (mục "Thinking") — không cần side-effect
      case "ReturnIdle":
        setRobotState("idle"); // vừa rời 1 goal khác (Watching/Waiting/Selling/Sleeping...) — trả mặt về đúng trạng thái nghỉ, không để lại state cũ (vd "listening") lỡ dở
        break;
      case "ContinueConversation":
        break; // luồng chat thật (sendChatMessage/speak) đã tự lo hết hiệu ứng, tránh làm 2 lần
      case "StartConversation":
      case "Invite":
      case "Speak":
      case "EndConversation":
        break; // xử lý `say` chung bên dưới, dùng cho cả 4 loại
    }

    if (action.say) {
      setMessages((prev) => [...prev, { id: `brain-${Date.now()}`, role: "robot", content: action.say as string, created_at: new Date().toISOString() }]);
      applyGaze("center");
      const faceState = moodFaceParams(action.mood).faceState;
      if (autoSpeak) speak(action.say, () => setRobotState(faceState));
      else setRobotState(faceState);
    }
  }

  // BrainLoop chạy mỗi 200ms (mục "Loop": "Run every 200ms" — nhanh hơn hẳn
  // vòng 1s cũ của Phase 6F, an toàn vì SocialBrain bên trong so mọi ngưỡng
  // bằng `now` tuyệt đối, không đếm số lần gọi). deps=[] nên hàm bên trong
  // CHỈ được tạo 1 lần lúc mount — mọi state đọc trực tiếp (autoSpeak/
  // isListening/sellingContext/lastResponse/robotState...) sẽ "đóng băng" ở
  // giá trị render đầu nếu gọi thẳng, nên interval gọi qua ref "luôn mới
  // nhất" này (gán lại mỗi render, cùng pattern Phase 6E/6F đã dùng).
  function runBrainCycle() {
    if (!brainLoopRef.current) return;
    const now = Date.now();
    const inputs: BrainLoopInputs = {
      frame: latestFrameRef.current,
      presenceEnabled,
      conversationState,
      voicePlaying: robotState === "speaking",
      projectContext,
      sellingContext,
      chatMood: lastResponse?.mood as RobotMood | undefined,
    };
    const result = brainLoopRef.current.cycle(now, inputs);
    executeBrainAction(result);
  }
  const runBrainCycleRef = useRef(runBrainCycle);
  runBrainCycleRef.current = runBrainCycle;

  useEffect(() => {
    const id = setInterval(() => runBrainCycleRef.current(), 200);
    return () => clearInterval(id);
  }, []);

  // Mục "Selling"/"projectContext" — tên project sáng tạo đang mở, đọc lại
  // GET /api/robot/continuity ĐÃ CÓ SẴN từ Phase 6B (activeProject.name) —
  // KHÔNG thêm/đổi route nào, KHÔNG đụng Conversation Agent. sellingContext
  // (mục 7 Phase 6F "Sales Mode") suy thẳng từ tên này, không cần state
  // riêng. Poll nhẹ mỗi 30s, đủ nhanh bắt kịp lúc đổi project sáng tạo.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/robot/continuity");
        const json = (await res.json()) as { activeProject?: { name?: string } | null };
        if (cancelled) return;
        const name = json.activeProject?.name ?? null;
        setProjectContext(name);
        setSellingContext(name === "ChinChin");
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
      // Mục 4 "last topic" (Phase 6F) — gắn câu hỏi vừa chat vào khách đang
      // là currentTarget (nếu presence đang bật và có ai trước camera), để
      // nếu họ quay lại trong 30 phút, describeReturning() có thể nhắc tới.
      brainLoopRef.current?.noteTopic(
        Date.now(),
        { frame: latestFrameRef.current, presenceEnabled, conversationState: "thinking", voicePlaying: false, projectContext, sellingContext, chatMood: json.mood as RobotMood | undefined },
        text
      );
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
              title="Bật camera để robot tự chào/để ý khi có người tới gần (Brain Loop, Phase 6G)"
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
            <span>selling: {sellingContext ? "có" : "không"}</span>
            <span>project: {projectContext ?? "—"}</span>
          </div>

          {/* Debug overlay Brain Loop (Phase 6G, mục "Simulation") — đúng 5 mục yêu cầu: Current Goal/Mood/Target/Next Action/Reason. */}
          <div className="mt-3 pt-2 border-t border-zinc-800 grid grid-cols-2 sm:grid-cols-3 gap-y-1 font-mono text-zinc-400">
            <span>Goal: {lastCycle?.goal ?? "—"}</span>
            <span>Mood: {lastCycle?.action.mood ?? "—"}</span>
            <span>Target: {lastCycle?.world.activeTargetId ?? "—"}</span>
            <span>Next Action: {lastCycle?.action.type ?? "—"}</span>
            <span>attentionScore: {lastCycle ? lastCycle.world.attentionScore.toFixed(2) : "—"}</span>
            <span>idleSeconds: {lastCycle ? Math.round(lastCycle.world.idleSeconds) : "—"}</span>
            <span>khách nhớ (30p): {lastCycle?.world.visitorCount ?? 0}</span>
          </div>
          {lastCycle && <p className="mt-2 text-zinc-500">Reason: {lastCycle.action.reason}</p>}
          {lastCycle?.action.say && <p className="mt-1 text-zinc-500">Say: &ldquo;{lastCycle.action.say}&rdquo;</p>}

          <p className="mt-2 text-zinc-600">
            Brain Loop (Phase 6G) — Observe→Think→Prioritize→Plan mỗi 200ms. Luật xã hội (look/chào/mời) chỉ chạy khi
            bật camera Presence ở trên; idle behaviors/goal Idle vẫn chạy dù tắt.
          </p>
        </Card>
      </details>
    </div>
  );
}
