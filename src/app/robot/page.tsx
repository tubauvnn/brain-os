"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RobotFaceKiosk, type RobotFaceState, type RobotGesture } from "@/components/robot/RobotFaceKiosk";
import { RobotVision, type VisionTarget } from "@/components/robot/RobotVision";
import { RealtimeMicPanel } from "@/components/robot/RealtimeMicPanel";
import { targetToPanTilt } from "@/lib/robot/tracking";

// Biểu cảm lưu trong RobotState (DB, điều khiển qua nút lệnh /api/robot/command)
// — khác với RobotFaceState (component hiển thị), xem mapDbFaceToExpr() bên dưới.
type DbRobotFace = "idle" | "happy" | "speaking" | "sleep" | "surprised" | "thinking";

function mapDbFaceToExpr(dbFace: string | undefined): RobotFaceState {
  switch (dbFace as DbRobotFace) {
    case "happy":
      return "happy";
    case "sleep":
      return "sleeping";
    // RobotFaceKiosk không có state "surprised" riêng — map về "happy" (biểu
    // cảm tích cực gần nhất) thay vì "error" (dễ gây hiểu lầm là robot đang lỗi).
    case "surprised":
      return "happy";
    case "thinking":
      return "thinking";
    case "speaking":
      return "speaking";
    default:
      return "idle";
  }
}

// mood/action/eyes từ /api/robot/chat (RobotChatResult, xem src/lib/robot-ai/types.ts)
// quy đổi sang các prop mà RobotFaceKiosk/useRobotEyes đã hỗ trợ sẵn.
const MOOD_TO_FACE_STATE: Record<string, RobotFaceState> = {
  idle: "idle",
  happy: "happy",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
  sleepy: "sleeping",
  error: "error",
};
function moodToFaceState(mood?: string): RobotFaceState | null {
  if (!mood) return null;
  return MOOD_TO_FACE_STATE[mood] ?? null;
}

// RobotGesture chỉ có none/wave/nod (hiệu ứng nhất thời) — action nào không map
// trực tiếp thì không gesture (đã đủ thể hiện qua đổi mood/badge action riêng).
const ACTION_TO_GESTURE: Record<string, RobotGesture> = {
  greet: "wave",
  introduce: "nod",
  smile: "nod",
  wake: "nod",
};
function actionToGesture(action?: string): RobotGesture {
  if (!action) return "none";
  return ACTION_TO_GESTURE[action] ?? "none";
}

// Hướng nhìn rời rạc (-1..1) cho gazeOverride của useRobotEyes. "track" = null
// (không override, quay lại camera/pointer tracking như bình thường).
const EYES_TO_GAZE: Record<string, { x: number; y: number } | null> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  center: { x: 0, y: 0 },
  track: null,
};

// Ưu tiên hiển thị giống RobotFace cũ: isSpeaking > isListening > isThinking > face nền.
function resolveDisplayState(
  base: RobotFaceState,
  flags: { isSpeaking: boolean; isListening: boolean; isThinking: boolean }
): RobotFaceState {
  if (flags.isSpeaking) return "speaking";
  if (flags.isListening) return "listening";
  if (flags.isThinking) return "thinking";
  return base;
}

type RobotStateData = {
  device_id: string;
  name: string;
  status: string;
  current_mode: string;
  current_face: string;
  battery: number;
  last_command: string | null;
  last_command_at: string | null;
};

type DeviceEventDTO = {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
};

type ConversationMessageDTO = {
  id: string;
  role: "user" | "robot";
  content: string;
  provider: string | null;
  created_at: string;
};

type StatusResponse = {
  ok: boolean;
  state?: RobotStateData;
  recent_events?: DeviceEventDTO[];
  recent_messages?: ConversationMessageDTO[];
  error?: string;
};

type CommandResponse = {
  ok: boolean;
  state?: RobotStateData;
  message?: string;
  error?: string;
};

type HardwareCommandDTO = { type: string; command: string; payload?: Record<string, unknown> };

type ChatResponse = {
  ok: boolean;
  reply?: string;
  provider?: string;
  model?: string;
  mood?: string;
  action?: string;
  eyes?: string;
  mouth?: string;
  hardwareCommand?: HardwareCommandDTO;
  robot_message_id?: string;
  created_at?: string;
  error?: string | null;
  session_id?: string | null;
  session_message_count?: number | null;
  latency_ms?: number;
};

type TranscribeResponse = {
  ok: boolean;
  text?: string;
  provider?: string;
  error?: string;
};

type MediaUploadResponse = {
  ok: boolean;
  data?: { id: string };
  error?: string;
};

type LogEntry = {
  id: string;
  time: string;
  command: string;
  message: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "robot";
  content: string;
  provider?: string | null;
  mood?: string | null;
  action?: string | null;
  error?: string | null;
  created_at: string;
};

function providerLabel(provider?: string | null): string {
  if (provider === "local") return "Local skill";
  if (provider === "openai") return "OpenAI";
  if (provider === "deepseek") return "DeepSeek";
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "codex_cli" || provider === "claude_cli" || provider === "gemini_cli") return "CLI Agent (deep mode)";
  if (provider === "fallback") return "Fallback (chế độ cơ bản)";
  return provider ?? "";
}

// ─── Web Speech API (SpeechRecognition) — không có sẵn trong lib.dom của TS, khai báo tối thiểu ──
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
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
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

const COMMANDS: { command: string; label: string }[] = [
  { command: "greet", label: "Chào" },
  { command: "sleep", label: "Ngủ" },
  { command: "wake", label: "Thức dậy" },
  { command: "happy", label: "Vui" },
  { command: "surprised", label: "Ngạc nhiên" },
  { command: "thinking", label: "Đang nghĩ" },
  { command: "turn_left", label: "Quay trái" },
  { command: "turn_right", label: "Quay phải" },
  { command: "stop", label: "Dừng" },
];

// Demo buttons — gửi thẳng câu vào /api/robot/chat, khớp local skill (xem
// src/lib/robot-ai/local-skills.ts) nên trả lời ngay, không chờ OpenAI.
const DEMO_BUTTONS: { label: string; text: string }[] = [
  { label: "Chào khách", text: "chào khách" },
  { label: "Giới thiệu bản thân", text: "mày là ai" },
  { label: "Demo bán hàng", text: "demo bán hàng" },
  { label: "Demo gia đình", text: "demo gia đình" },
  { label: "Demo bảo vệ", text: "demo bảo vệ" },
  { label: "Demo mắt nhìn theo", text: "nhìn tôi" },
  { label: "Demo nghe nói", text: "test mic" },
  { label: "Demo robot command", text: "demo robot" },
  { label: "Quay trái", text: "quay trái" },
  { label: "Quay phải", text: "quay phải" },
  { label: "Dừng lại", text: "dừng lại" },
  { label: "Chế độ ngủ", text: "ngủ đi" },
  { label: "Thức dậy", text: "thức dậy" },
  { label: "Chế độ vui vẻ", text: "cười lên" },
];

function toLogEntry(e: DeviceEventDTO): LogEntry {
  const payload = (e.payload ?? {}) as Record<string, unknown>;
  return {
    id: e.id,
    time: e.created_at,
    command: typeof payload.command === "string" ? payload.command : e.event_type,
    message: typeof payload.message === "string" ? payload.message : "",
  };
}

function toChatMessage(m: ConversationMessageDTO): ChatMessage {
  return { id: m.id, role: m.role, content: m.content, provider: m.provider, created_at: m.created_at };
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      {value}
    </div>
  );
}

export default function RobotPage() {
  const [state, setState] = useState<RobotStateData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [speakText, setSpeakText] = useState("Xin chào, mình là Chuối đây.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const faceCardRef = useRef<HTMLDivElement>(null);
  const viVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // Audio OpenAI TTS đang phát (nếu có) — cần ref riêng để interruptRobotSpeaking()
  // dừng được, khác với speechSynthesis (fallback browser TTS).
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Voice OpenAI TTS chọn được — lưu localStorage `robot_tts_voice`, đọc lại lúc mount.
  const TTS_VOICES = ["coral", "marin", "cedar", "nova", "shimmer", "alloy"] as const;
  const [ttsVoice, setTtsVoice] = useState<string>("coral");
  useEffect(() => {
    const saved = window.localStorage.getItem("robot_tts_voice");
    if (saved) setTtsVoice(saved);
  }, []);
  function handleTtsVoiceChange(voice: string) {
    setTtsVoice(voice);
    window.localStorage.setItem("robot_tts_voice", voice);
  }

  // Biểu cảm/hành động hiển thị trên RobotFaceKiosk — cập nhật từ 2 nguồn: nút
  // lệnh thủ công (map qua mapDbFaceToExpr) và response mood/action của /api/robot/chat.
  const [robotFaceExpr, setRobotFaceExpr] = useState<RobotFaceState>("idle");
  const [robotAction, setRobotAction] = useState<RobotGesture>("none");

  // Structured response gần nhất từ /api/robot/chat (mood/action/eyes/mouth/hardwareCommand)
  // — hiển thị badge trong chat + panel "Hardware command preview".
  const [robotMoodLabel, setRobotMoodLabel] = useState<string>("idle");
  const [robotActionLabel, setRobotActionLabel] = useState<string>("none");
  const [robotEyesLabel, setRobotEyesLabel] = useState<string>("center");
  const [robotMouthLabel, setRobotMouthLabel] = useState<string>("idle");
  const [lastHardwareCommand, setLastHardwareCommand] = useState<HardwareCommandDTO | null>(null);

  // Hướng nhìn rời rạc tạm thời (eyes: left/right/up/down/center) — ưu tiên cao
  // nhất trong useRobotEyes, tự hết hạn sau EYES_OVERRIDE_MS để quay lại
  // camera/pointer tracking bình thường (eyes: "track" thì không override gì).
  const EYES_OVERRIDE_MS = 1500;
  const [gazeOverride, setGazeOverride] = useState<{ x: number; y: number } | null>(null);
  const gazeOverrideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function applyRobotEyes(eyes?: string) {
    if (!eyes || !(eyes in EYES_TO_GAZE)) return;
    if (gazeOverrideTimerRef.current) clearTimeout(gazeOverrideTimerRef.current);
    const target = EYES_TO_GAZE[eyes];
    setGazeOverride(target);
    if (target) {
      gazeOverrideTimerRef.current = setTimeout(() => setGazeOverride(null), EYES_OVERRIDE_MS);
    }
  }

  // Gộp lại phần xử lý response chung cho sendChatMessage + runHandsFreeTurn —
  // tránh lặp mapping mood/action/eyes/mouth/hardwareCommand ở 2 chỗ.
  function applyRobotResponse(json: ChatResponse) {
    const face = moodToFaceState(json.mood);
    if (face) setRobotFaceExpr(face);
    setRobotAction(actionToGesture(json.action));
    if (json.mood) setRobotMoodLabel(json.mood);
    if (json.action) setRobotActionLabel(json.action);
    if (json.eyes) {
      setRobotEyesLabel(json.eyes);
      applyRobotEyes(json.eyes);
    }
    if (json.mouth) setRobotMouthLabel(json.mouth);
    setLastHardwareCommand(json.hardwareCommand ?? null);
    setSessionMessageCount(json.session_message_count ?? null);
    setLastProvider(json.provider ?? null);
    setLastLatencyMs(json.latency_ms ?? null);
  }

  // Secure context — mic/camera của trình duyệt chỉ hoạt động trên HTTPS hoặc localhost.
  const [secureContextChecked, setSecureContextChecked] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [mediaRecorderSupported, setMediaRecorderSupported] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);

  // Session — id sinh ở client, lưu localStorage `robot_session_id`, gửi kèm mọi
  // request /api/robot/chat + /api/robot/transcribe để robot nhớ ngữ cảnh trong phiên.
  const [sessionId, setSessionId] = useState("");
  useEffect(() => {
    const existing = window.localStorage.getItem("robot_session_id");
    if (existing) {
      setSessionId(existing);
      return;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem("robot_session_id", id);
    setSessionId(id);
  }, []);

  // Panel debug nhỏ (Mục tiêu 4) — cập nhật từ response /api/robot/chat gần nhất.
  const [lastTranscript, setLastTranscript] = useState("");
  const [sessionMessageCount, setSessionMessageCount] = useState<number | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  // STT mode cho Hands-free Voice Mode: "openai" (MediaRecorder + /api/robot/transcribe,
  // nhận diện tiếng Việt tốt hơn) mặc định, hoặc "browser" (SpeechRecognition, phiên 19).
  const [sttMode, setSttMode] = useState<"browser" | "openai">("openai");

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Memory phiên bằng localStorage (Mục tiêu 7) — độc lập với DB/session server-side
  // (loadStatus() bên dưới vẫn tải lịch sử DB như cũ). Load lúc mount để reload
  // trang vẫn thấy chat cũ ngay, không cần chờ fetch DB.
  const CHAT_MEMORY_KEY = "robot_chuoi_chat_history";
  const CHAT_MEMORY_LIMIT = 20;
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAT_MEMORY_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(saved) && saved.length > 0) setMessages(saved);
    } catch {
      // localStorage hỏng/không parse được — bỏ qua, loadStatus() vẫn nạp từ DB.
    }
  }, []);
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      window.localStorage.setItem(CHAT_MEMORY_KEY, JSON.stringify(messages.slice(-CHAT_MEMORY_LIMIT)));
    } catch {
      // localStorage đầy/bị chặn — bỏ qua, không ảnh hưởng chat.
    }
  }, [messages]);
  function clearChatMemory() {
    window.localStorage.removeItem(CHAT_MEMORY_KEY);
    setMessages([]);
  }

  // Voice (STT dùng chung cho khối Chat + khối Voice/Mic)
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sttTargetRef = useRef<"chat" | "voice">("chat");

  // Hands-free Voice Mode — vòng lặp nghe → gửi → nói → nghe tiếp, độc lập với
  // STT thủ công ở trên (recognitionRef) để tránh 2 phiên ghi âm chồng nhau.
  type VoiceModeStatus = "off" | "listening" | "thinking" | "speaking" | "paused" | "unsupported";
  const [voiceModeOn, setVoiceModeOn] = useState(false);
  const [voiceModeStatus, setVoiceModeStatus] = useState<VoiceModeStatus>("off");
  const [voiceModeTranscript, setVoiceModeTranscript] = useState("");
  const voiceModeOnRef = useRef(false);
  const handsFreeRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastSentTranscriptRef = useRef("");
  const turnInProgressRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // OpenAI STT (sttMode === "openai") — MediaRecorder + voice-activity-detection
  // đơn giản qua Web Audio API, thay cho SpeechRecognition của trình duyệt.
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const vadRafRef = useRef<number | null>(null);
  const recordStartRef = useRef(0);

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);

  // Smart Robot Fullscreen Mode — kiosk: RobotFaceKiosk lớn + camera tracking
  // (mắt nhìn theo người) + voice mode, tách hoàn toàn khỏi nút "⛶" fullscreen-face
  // đơn giản cũ (isFullscreen/faceCardRef) để không phá tính năng đã có.
  const [isFullscreenRobot, setIsFullscreenRobot] = useState(false);
  const [cameraTrackingEnabled, setCameraTrackingEnabled] = useState(false);
  const [visionDebug, setVisionDebug] = useState(false);
  const [visionTarget, setVisionTarget] = useState<VisionTarget>({ detected: false, x: 0, y: 0, size: 0 });
  const kioskRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === faceCardRef.current);
      if (document.fullscreenElement !== kioskRef.current) setIsFullscreenRobot(false);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Vào kiosk mode xong DOM mới có kioskRef — request fullscreen ở effect riêng,
  // không phải ngay trong lúc bấm nút (tránh gọi requestFullscreen() trên node
  // chưa mount).
  useEffect(() => {
    if (isFullscreenRobot && kioskRef.current && document.fullscreenElement !== kioskRef.current) {
      kioskRef.current.requestFullscreen().catch(() => {
        // Fullscreen API có thể bị từ chối (vd iOS Safari) — vẫn dùng layout
        // kiosk giả lập qua CSS (fixed inset-0), chỉ mất phần ẩn thanh địa chỉ.
      });
    }
  }, [isFullscreenRobot]);

  // RobotVision báo target mới ~mỗi 400ms. Việc làm mượt (lerp)/clamp/blink
  // cho mắt giờ nằm hoàn toàn trong useRobotEyes (bên trong RobotFaceKiosk,
  // chạy qua requestAnimationFrame + refs, không setState mỗi frame) — ở đây
  // chỉ cần lưu target thô để truyền xuống làm cameraTarget prop.
  function handleVisionTarget(target: VisionTarget) {
    setVisionTarget(target);
    if (target.detected) {
      // Servo-ready: chưa gọi phần cứng, chỉ log để dễ nối servo pan/tilt sau này.
      const panTilt = targetToPanTilt(target);
      // eslint-disable-next-line no-console
      console.debug("[RobotVision] pan/tilt", panTilt);
    }
  }

  async function enterFullscreenRobotMode() {
    setIsFullscreenRobot(true);
    setCameraTrackingEnabled(true);
    if (!voiceModeOn) await startVoiceMode();
  }

  function exitFullscreenRobotMode() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setIsFullscreenRobot(false);
  }

  // Browser TTS (Web Speech API) — không gọi API ngoài, chỉ dùng speechSynthesis có sẵn.
  // TTS không cần secure context nên vẫn hoạt động trên HTTP.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechSupported(false);
      return;
    }
    setSpeechSupported(true);

    function pickVietnameseVoice() {
      const voices = window.speechSynthesis.getVoices();
      viVoiceRef.current = voices.find((v) => v.lang.toLowerCase().startsWith("vi")) ?? null;
    }

    pickVietnameseVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVietnameseVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pickVietnameseVoice);
  }, []);

  // Kiểm tra secure context + hỗ trợ mic/camera của trình duyệt (chỉ chạy sau khi mount trên client).
  useEffect(() => {
    setIsSecureContext(typeof window !== "undefined" && window.isSecureContext);
    setSttSupported(getSpeechRecognitionConstructor() !== null);
    setMediaRecorderSupported(
      typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia
    );
    setCameraSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
    setSecureContextChecked(true);
  }, []);

  // Dừng camera khi rời trang.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    voiceModeOnRef.current = voiceModeOn;
  }, [voiceModeOn]);

  // Dừng hẳn Hands-free Voice Mode (mic + TTS + timer chờ) khi rời trang.
  useEffect(() => {
    return () => {
      handsFreeRecognitionRef.current?.stop();
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      currentAudioRef.current?.pause();
      releaseOpenAiMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // onEnd optional — dùng để Hands-free Voice Mode biết lúc nào robot nói xong
  // mà tự nghe tiếp; các chỗ gọi speak() cũ không truyền onEnd vẫn hoạt động y hệt.
  // Fallback browser TTS (Web Speech API) — giữ nguyên logic cũ, chỉ đổi tên để
  // speak() bên dưới có thể gọi lại khi OpenAI TTS lỗi.
  const speakBrowser = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!soundEnabled || !speechSupported || !text) {
        onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "vi-VN";
      if (viVoiceRef.current) utterance.voice = viVoiceRef.current;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        onEnd?.();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        onEnd?.();
      };
      window.speechSynthesis.speak(utterance);
    },
    [soundEnabled, speechSupported]
  );

  // isSpeaking cập nhật từ đây cho MỌI lần gọi speak() (chat, hands-free, "Nói
  // thử", greet...) — để RobotFace tự động chuyển miệng sang "speaking" bất kể
  // nguồn gọi. Mặc định thử OpenAI TTS (giọng tự nhiên hơn) trước, lỗi bất kỳ
  // bước nào (network, API lỗi, autoplay bị chặn...) đều fallback về browser
  // speechSynthesis — không bao giờ để robot "câm" hoàn toàn.
  const speak = useCallback(
    async (text: string, onEnd?: () => void) => {
      if (!soundEnabled || !text) {
        onEnd?.();
        return;
      }

      currentAudioRef.current?.pause();
      currentAudioRef.current = null;

      try {
        const res = await fetch("/api/robot/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: ttsVoice }),
        });
        if (!res.ok) throw new Error(`tts http ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          onEnd?.();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
          speakBrowser(text, onEnd);
        };
        setIsSpeaking(true);
        await audio.play();
      } catch {
        currentAudioRef.current = null;
        speakBrowser(text, onEnd);
      }
    },
    [soundEnabled, ttsVoice, speakBrowser]
  );

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (!next && speechSupported) window.speechSynthesis.cancel();
      return next;
    });
  }

  async function toggleFullscreen() {
    if (!faceCardRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await faceCardRef.current.requestFullscreen();
      }
    } catch {
      // Fullscreen không được hỗ trợ trên thiết bị này — bỏ qua.
    }
  }

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/robot/status");
      const json = (await res.json()) as StatusResponse;
      if (!json.ok || !json.state) {
        setError(json.error ?? "Không tải được trạng thái robot");
        return;
      }
      setState(json.state);
      setRobotFaceExpr(mapDbFaceToExpr(json.state.current_face));
      setError(null);
      const initialLogs = (json.recent_events ?? [])
        .filter((e) => e.event_type === "robot_command")
        .map(toLogEntry);
      setLogs(initialLogs);
      setMessages((json.recent_messages ?? []).map(toChatMessage));
    } catch {
      setError("Không kết nối được API");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function sendCommand(command: string, payload?: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch("/api/robot/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, payload }),
      });
      const json = (await res.json()) as CommandResponse;
      if (!json.ok || !json.state) {
        setError(json.error ?? "Lệnh thất bại");
        return;
      }
      setState(json.state);
      setRobotFaceExpr(mapDbFaceToExpr(json.state.current_face));
      setError(null);
      setLogs((prev) =>
        [
          {
            id: `${Date.now()}`,
            time: new Date().toISOString(),
            command,
            message: json.message ?? "",
          },
          ...prev,
        ].slice(0, 50)
      );

      if (command === "greet") {
        speak("Xin chào, mình là Chuối đây.");
      } else if (command === "speak") {
        const text = typeof payload?.text === "string" ? payload.text : speakText;
        speak(text);
      }
    } catch {
      setError("Không kết nối được API");
    } finally {
      setLoading(false);
    }
  }

  async function sendChatMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || chatLoading) return;
    setChatLoading(true);
    setChatInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    try {
      const res = await fetch("/api/robot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sessionId: sessionId || undefined, source: "text" }),
      });
      const json = (await res.json()) as ChatResponse;
      if (!json.ok || !json.reply) {
        setError(json.error ?? "Chat thất bại");
        return;
      }
      setError(null);
      setMessages((prev) => [
        ...prev,
        {
          id: json.robot_message_id ?? `local-reply-${Date.now()}`,
          role: "robot",
          content: json.reply as string,
          provider: json.provider,
          mood: json.mood,
          action: json.action,
          error: json.error,
          created_at: json.created_at ?? new Date().toISOString(),
        },
      ]);
      applyRobotResponse(json);
      speak(json.reply);
    } catch {
      setError("Không kết nối được API");
    } finally {
      setChatLoading(false);
    }
  }

  function startListening(target: "chat" | "voice") {
    if (!canUseMic) return;
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;
    sttTargetRef.current = target;
    recognitionRef.current?.stop();

    const recognition = new Ctor();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      const combined = (finalText || interimText).trim();
      if (!combined) return;
      if (sttTargetRef.current === "chat") {
        setChatInput(combined);
      } else {
        setVoiceTranscript(combined);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  // ── Hands-free Voice Mode: nghe → gửi → nói → nghe tiếp, lặp liên tục ──

  function scheduleNextListen(delayMs: number) {
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      cooldownTimerRef.current = null;
      if (voiceModeOnRef.current) startHandsFreeListening();
    }, delayMs);
  }

  // Dispatcher — chọn cơ chế nghe theo sttMode. Cả 2 nhánh dùng chung state
  // machine (voiceModeStatus/turnInProgressRef/scheduleNextListen/runHandsFreeTurn).
  function startHandsFreeListening() {
    if (sttMode === "openai") {
      startOpenAiListening();
    } else {
      startBrowserListening();
    }
  }

  function startBrowserListening() {
    if (!canUseHandsFreeMic) {
      setVoiceModeStatus("unsupported");
      return;
    }
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      setVoiceModeStatus("unsupported");
      return;
    }
    // An toàn nếu gọi lại khi đã có phiên đang chạy (vd sau khi ngắt lời robot).
    handsFreeRecognitionRef.current?.stop();
    turnInProgressRef.current = false;
    setVoiceModeTranscript("");

    const recognition = new Ctor();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      const combined = (finalText || interimText).trim();
      if (combined) setVoiceModeTranscript(combined);

      const finalTrimmed = finalText.trim();
      // Không gửi rỗng, không gửi trùng transcript vừa gửi lượt trước.
      if (finalTrimmed && finalTrimmed !== lastSentTranscriptRef.current) {
        turnInProgressRef.current = true;
        recognition.stop();
        setLastTranscript(finalTrimmed);
        runHandsFreeTurn(finalTrimmed, { source: "voice", sttMode: "browser" });
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceModeOn(false);
        voiceModeOnRef.current = false;
        setVoiceModeStatus("unsupported");
        setError("Đã từ chối quyền micro — không thể tiếp tục hội thoại giọng nói.");
        return;
      }
      // "no-speech"/"aborted"/lỗi mạng... — im lặng thử nghe lại nếu voice mode còn bật.
      if (voiceModeOnRef.current && !turnInProgressRef.current) scheduleNextListen(300);
    };

    recognition.onend = () => {
      // Nếu recognition tự kết thúc mà chưa có transcript nào được gửi đi (vd im
      // lặng quá lâu) và voice mode vẫn bật, tự nghe lại — tránh đứng im mãi mãi.
      if (voiceModeOnRef.current && !turnInProgressRef.current) scheduleNextListen(300);
    };

    handsFreeRecognitionRef.current = recognition;
    setVoiceModeStatus("listening");
    recognition.start();
  }

  // OpenAI STT: thu âm bằng MediaRecorder trên stream mic đã xin quyền sẵn
  // (startVoiceMode), tự dừng khi phát hiện im lặng ~1s (voice-activity-detection
  // đơn giản qua AnalyserNode), rồi gửi lên /api/robot/transcribe.
  const SILENCE_MS = 1000;
  const MIN_RECORD_MS = 500;
  const MAX_RECORD_MS = 15_000;

  function stopVad() {
    if (vadRafRef.current !== null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
  }

  function startOpenAiListening() {
    if (!canUseHandsFreeMic || !micStreamRef.current || !audioContextRef.current || !analyserRef.current) {
      setVoiceModeStatus("unsupported");
      return;
    }
    turnInProgressRef.current = false;
    setVoiceModeTranscript("");

    const stream = micStreamRef.current;
    const analyser = analyserRef.current;
    audioChunksRef.current = [];

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      setVoiceModeStatus("unsupported");
      return;
    }
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stopVad();
      const durationMs = Date.now() - recordStartRef.current;
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];
      if (durationMs < MIN_RECORD_MS || chunks.length === 0) {
        // Quá ngắn (im lặng/tiếng động nhỏ) — bỏ qua, nghe lại ngay, không gửi API.
        if (voiceModeOnRef.current && !turnInProgressRef.current) scheduleNextListen(150);
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      turnInProgressRef.current = true;
      transcribeAndRun(blob, durationMs);
    };

    recordStartRef.current = Date.now();
    setVoiceModeStatus("listening");
    recorder.start();

    // Vòng lặp VAD: theo dõi biên độ âm thanh qua time-domain data, dừng recorder
    // khi im lặng liên tục >= SILENCE_MS (sau khi đã có tiếng nói), hoặc chạm trần
    // MAX_RECORD_MS để tránh thu âm vô hạn nếu người dùng nói liên tục/ồn nền.
    const data = new Uint8Array(analyser.fftSize);
    let hasSpoken = false;
    let lastLoudAt = Date.now();
    const THRESHOLD = 10;

    const tick = () => {
      if (mediaRecorderRef.current !== recorder || recorder.state !== "recording") return;
      analyser.getByteTimeDomainData(data);
      let sumDeviation = 0;
      for (let i = 0; i < data.length; i++) sumDeviation += Math.abs(data[i] - 128);
      const volume = sumDeviation / data.length;

      const now = Date.now();
      if (volume > THRESHOLD) {
        hasSpoken = true;
        lastLoudAt = now;
      }
      const recordingMs = now - recordStartRef.current;
      const silenceMs = now - lastLoudAt;

      if ((hasSpoken && silenceMs >= SILENCE_MS) || recordingMs >= MAX_RECORD_MS) {
        recorder.stop();
        return;
      }
      vadRafRef.current = requestAnimationFrame(tick);
    };
    vadRafRef.current = requestAnimationFrame(tick);
  }

  async function transcribeAndRun(blob: Blob, durationMs: number) {
    try {
      const form = new FormData();
      // Đặt tên file theo mimeType thật của MediaRecorder (Chrome thường ra
      // audio/webm, Safari có thể ra audio/mp4) — server dùng phần mở rộng để
      // OpenAI nhận diện đúng định dạng, đặt cứng ".webm" sẽ lỗi 400 nếu sai định dạng.
      const mimeBase = blob.type.split(";")[0].trim();
      const ext = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav" }[
        mimeBase
      ] ?? "webm";
      form.append("audio", blob, `speech.${ext}`);
      form.append("language", "vi");
      const res = await fetch("/api/robot/transcribe", { method: "POST", body: form });
      const json = (await res.json()) as TranscribeResponse;
      const text = (json.text ?? "").trim();
      if (!json.ok || !text) {
        // Không nghe rõ / lỗi transcribe — nghe lại, không gửi chat với nội dung rỗng.
        turnInProgressRef.current = false;
        if (voiceModeOnRef.current) scheduleNextListen(300);
        return;
      }
      if (text === lastSentTranscriptRef.current) {
        turnInProgressRef.current = false;
        if (voiceModeOnRef.current) scheduleNextListen(300);
        return;
      }
      setLastTranscript(text);
      setVoiceModeTranscript(text);
      runHandsFreeTurn(text, { source: "voice", sttMode: "openai", sttProvider: "openai_transcribe", durationMs });
    } catch {
      turnInProgressRef.current = false;
      if (voiceModeOnRef.current) scheduleNextListen(500);
    }
  }

  // Một lượt hội thoại hoàn chỉnh: gửi transcript → nhận reply → đọc bằng TTS →
  // sau cooldown 500ms tự nghe lại. Tách riêng khỏi sendChatMessage() (dùng cho
  // ô chat thủ công) để không đổi hành vi chat cũ.
  async function runHandsFreeTurn(
    text: string,
    meta: { source: "voice"; sttMode: "browser" | "openai"; sttProvider?: string; durationMs?: number }
  ) {
    lastSentTranscriptRef.current = text;
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    setVoiceModeStatus("thinking");

    let robotSay = "Tôi chưa xử lý được, thử lại nhé.";
    let robotMessage: ChatMessage = {
      id: `local-reply-${Date.now()}`,
      role: "robot",
      content: robotSay,
      provider: "fallback",
      created_at: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/robot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId || undefined,
          source: meta.source,
          sttMode: meta.sttMode,
          sttProvider: meta.sttProvider,
          durationMs: meta.durationMs,
        }),
      });
      const json = (await res.json()) as ChatResponse;
      if (!json.ok || !json.reply) throw new Error(json.error ?? "Chat thất bại");
      robotSay = json.reply;
      robotMessage = {
        id: json.robot_message_id ?? robotMessage.id,
        role: "robot",
        content: json.reply,
        provider: json.provider,
        mood: json.mood,
        action: json.action,
        error: json.error,
        created_at: json.created_at ?? robotMessage.created_at,
      };
      applyRobotResponse(json);
    } catch {
      // Giữ nguyên robotSay/robotMessage mặc định — robot vẫn phải nói được gì đó.
    }

    setMessages((prev) => [...prev, robotMessage]);
    setVoiceModeStatus("speaking");
    speak(robotSay, () => {
      turnInProgressRef.current = false;
      if (!voiceModeOnRef.current) {
        setVoiceModeStatus("off");
        return;
      }
      setVoiceModeStatus("paused");
      scheduleNextListen(500);
    });
  }

  function releaseOpenAiMic() {
    stopVad();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  }

  async function startVoiceMode() {
    if (!canUseHandsFreeMic) {
      setVoiceModeStatus("unsupported");
      return;
    }
    // Dừng mic thủ công (chat/voice) nếu đang chạy — tránh 2 phiên ghi âm chồng nhau.
    stopListening();
    lastSentTranscriptRef.current = "";

    if (sttMode === "openai") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        micStreamRef.current = stream;
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
      } catch {
        setVoiceModeStatus("unsupported");
        setError("Không xin được quyền micro cho OpenAI STT.");
        return;
      }
    }

    setVoiceModeOn(true);
    voiceModeOnRef.current = true;
    startHandsFreeListening();
  }

  function stopVoiceMode() {
    setVoiceModeOn(false);
    voiceModeOnRef.current = false;
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    handsFreeRecognitionRef.current?.stop();
    handsFreeRecognitionRef.current = null;
    releaseOpenAiMic();
    window.speechSynthesis.cancel();
    currentAudioRef.current?.pause();
    currentAudioRef.current = null;
    setVoiceModeStatus("off");
  }

  function interruptRobotSpeaking() {
    window.speechSynthesis.cancel();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    // cancel()/pause() không đảm bảo bắn onend/onerror trên mọi trình duyệt —
    // chủ động tắt isSpeaking ngay để RobotFace không bị kẹt ở trạng thái "speaking".
    setIsSpeaking(false);
    if (voiceModeOnRef.current) {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      turnInProgressRef.current = false;
      startHandsFreeListening();
    }
  }

  function handsFreeStatusLabel(): string {
    if (!secureContextChecked) return "Đang kiểm tra...";
    if (!canUseHandsFreeMic) return "Mic không hỗ trợ";
    switch (voiceModeStatus) {
      case "listening":
        return "Đang nghe";
      case "thinking":
        return "Đang nghĩ";
      case "speaking":
        return "Đang nói";
      case "paused":
        return "Tạm dừng";
      case "unsupported":
        return "Mic không hỗ trợ";
      default:
        return voiceModeOn ? "..." : "Đã tắt";
    }
  }

  async function startCamera() {
    setCameraError(null);
    if (!canUseCamera || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera cần HTTPS hoặc localhost, và trình duyệt phải hỗ trợ getUserMedia.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError("Không xin được quyền camera.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);
    setCaptureStatus(null);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas không khả dụng");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Không tạo được ảnh");

      const form = new FormData();
      form.append("file", blob, `robot-capture-${Date.now()}.png`);
      form.append("source_type", "robot");
      if (state?.device_id) form.append("device_id", state.device_id);

      const res = await fetch("/api/media/upload", { method: "POST", body: form });
      const json = (await res.json()) as MediaUploadResponse;
      if (!json.ok || !json.data) {
        setCaptureStatus(json.error ?? "Lưu ảnh thất bại");
        return;
      }
      setCaptureStatus(`Đã lưu ảnh (id: ${json.data.id.slice(0, 10)}...)`);
    } catch {
      setCaptureStatus("Có lỗi khi chụp/lưu ảnh");
    } finally {
      setCapturing(false);
    }
  }

  const battery = state?.battery ?? 0;
  const batteryColor =
    battery > 50 ? "bg-emerald-500" : battery > 20 ? "bg-amber-500" : "bg-red-500";

  // Mic/Camera chỉ bật khi secure context + trình duyệt hỗ trợ. Chat text + TTS luôn hoạt động.
  const showInsecureWarning = secureContextChecked && !isSecureContext;
  const canUseMic = secureContextChecked && isSecureContext && sttSupported;
  const canUseCamera = secureContextChecked && isSecureContext && cameraSupported;
  // Hands-free dùng capability riêng theo sttMode — OpenAI STT cần MediaRecorder,
  // không phải SpeechRecognition (khác với 2 nút mic thủ công ở khối Chat/Voice).
  const canUseHandsFreeMic =
    secureContextChecked && isSecureContext && (sttMode === "browser" ? sttSupported : mediaRecorderSupported);

  function micTitle(): string {
    if (!secureContextChecked) return "Đang kiểm tra...";
    if (!isSecureContext) return "Cần HTTPS hoặc localhost để dùng mic";
    if (!sttSupported) return "Trình duyệt không hỗ trợ nhận diện giọng nói";
    return "Nói để nhập";
  }

  function cameraTitle(): string {
    if (!secureContextChecked) return "Đang kiểm tra...";
    if (!isSecureContext) return "Cần HTTPS hoặc localhost để dùng camera";
    if (!cameraSupported) return "Trình duyệt không hỗ trợ camera";
    return "Bật camera";
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Robot Chuối"
        description="Xin chào, mình là Chuối, robot demo của Brain OS."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[10px] tracking-widest font-mono text-zinc-600 uppercase mr-1">Hardware Ready</span>
        <Badge variant="green">Eye Tracking: pointer + camera fallback</Badge>
        <Badge variant="green">Mic: VU meter + push-to-talk</Badge>
        <Badge variant="indigo">Voice Assistant: xem panel bên dưới</Badge>
        <Badge variant="default">ESP32-S3 + TFT + INMP441 + MAX98357A: chưa nối (chờ về Hà Nội)</Badge>
      </div>

      {showInsecureWarning && (
        <div className="mb-4 flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-800 rounded-lg px-4 py-3">
          <span className="text-lg leading-none shrink-0">⚠️</span>
          <div>
            <p className="font-medium">Mic/Camera cần HTTPS hoặc localhost</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Trang đang chạy qua kết nối không an toàn ({typeof window !== "undefined" ? window.location.origin : ""}), trình duyệt chặn quyền micro và camera vì lý do bảo mật. Chat bằng văn bản và giọng đọc (TTS) vẫn hoạt động bình thường.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ── 3 khối chính: Chat / Voice-Mic / Camera — luôn hiển thị, không ẩn sau tab ── */}

      <div id="chat">
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-100">💬 Chat với Robot</h3>
          <button
            onClick={clearChatMemory}
            title="Xoá lịch sử chat lưu trong trình duyệt (localStorage)"
            className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-red-600/20 hover:text-red-300 active:scale-95 transition-all"
          >
            🗑️ Clear memory
          </button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto mb-3">
          {messages.length === 0 && (
            <p className="text-xs text-zinc-600">Chưa có tin nhắn nào — gõ hoặc bấm mic để bắt đầu.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-indigo-600/30 text-indigo-100" : "bg-zinc-800 text-zinc-200"
                }`}
              >
                <p>{m.content}</p>
                {m.role === "robot" && (m.provider || m.mood || m.action) && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.provider && <Badge variant="indigo">{providerLabel(m.provider)}</Badge>}
                    {m.mood && <Badge variant="default">mood: {m.mood}</Badge>}
                    {m.action && m.action !== "none" && <Badge variant="green">action: {m.action}</Badge>}
                  </div>
                )}
                {m.role === "robot" && m.provider === "fallback" && (
                  <p className="mt-1 text-[10px] text-amber-500">
                    ⚠️ Chưa gọi được AI thật, đang dùng chế độ cơ bản.
                    {m.error ? ` (${m.error})` : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
          {chatLoading && <p className="text-xs text-zinc-500">Robot đang trả lời...</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => (isListening ? stopListening() : startListening("chat"))}
            disabled={!canUseMic || voiceModeOn}
            title={voiceModeOn ? "Đang ở chế độ hội thoại giọng nói — tắt để dùng mic thủ công" : micTitle()}
            className={`min-h-[3.5rem] w-14 shrink-0 rounded-xl flex items-center justify-center text-xl transition-all active:scale-95 disabled:opacity-40 ${
              isListening ? "bg-red-600/40 text-red-300" : "bg-zinc-800 text-zinc-300 hover:bg-indigo-600/30"
            }`}
          >
            {isListening ? "⏹" : "🎤"}
          </button>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendChatMessage(chatInput);
            }}
            placeholder="Nhắn gì đó với robot..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-base text-zinc-200 min-h-[3.5rem]"
          />
          <button
            onClick={() => sendChatMessage(chatInput)}
            disabled={chatLoading || !chatInput.trim()}
            className="min-h-[3.5rem] px-5 rounded-xl bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 active:scale-95 transition-all disabled:opacity-40 shrink-0 text-base font-medium"
          >
            Gửi
          </button>
        </div>
      </Card>
      </div>

      <div id="handsfree">
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-medium text-zinc-100">🗣️ Hội thoại giọng nói (Hands-free)</h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden text-xs">
              <button
                onClick={() => setSttMode("openai")}
                disabled={voiceModeOn}
                className={`px-2.5 py-1.5 transition-all disabled:opacity-50 ${
                  sttMode === "openai" ? "bg-indigo-600/40 text-indigo-200" : "text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                OpenAI STT
              </button>
              <button
                onClick={() => setSttMode("browser")}
                disabled={voiceModeOn}
                className={`px-2.5 py-1.5 transition-all disabled:opacity-50 ${
                  sttMode === "browser" ? "bg-indigo-600/40 text-indigo-200" : "text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                Browser STT
              </button>
            </div>
            <Badge variant={voiceModeOn ? "green" : "default"}>{handsFreeStatusLabel()}</Badge>
          </div>
        </div>

        {sttMode === "browser" && !sttSupported && secureContextChecked && (
          <p className="text-xs text-amber-400 mb-3">
            Trình duyệt này chưa hỗ trợ voice recognition, dùng Chrome Android.
          </p>
        )}
        {sttMode === "openai" && !mediaRecorderSupported && secureContextChecked && (
          <p className="text-xs text-amber-400 mb-3">
            Trình duyệt này chưa hỗ trợ ghi âm (MediaRecorder), thử đổi sang &quot;Browser STT&quot; hoặc dùng Chrome Android.
          </p>
        )}
        {canUseHandsFreeMic === false && secureContextChecked && isSecureContext === false && (
          <p className="text-xs text-amber-400 mb-3">
            Cần truy cập qua <span className="font-mono">https://os.irec.vn/robot</span> (HTTPS) để dùng mic trên thiết bị thật.
          </p>
        )}

        <div className="flex flex-wrap gap-3 mb-3">
          {!voiceModeOn ? (
            <button
              onClick={startVoiceMode}
              disabled={!canUseHandsFreeMic}
              title={canUseHandsFreeMic ? "Bật hội thoại giọng nói" : "Mic không khả dụng (xem cảnh báo phía trên)"}
              className="min-h-[3.5rem] px-5 rounded-xl bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 active:scale-95 transition-all disabled:opacity-40 text-base font-medium"
            >
              🎙️ Bật hội thoại giọng nói
            </button>
          ) : (
            <button
              onClick={stopVoiceMode}
              className="min-h-[3.5rem] px-5 rounded-xl bg-red-600/30 text-red-300 hover:bg-red-600/50 active:scale-95 transition-all text-base font-medium"
            >
              ⏹ Tắt hội thoại giọng nói
            </button>
          )}
          <button
            onClick={interruptRobotSpeaking}
            disabled={!voiceModeOn || voiceModeStatus !== "speaking"}
            className="min-h-[3.5rem] px-5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-amber-600/30 hover:text-amber-300 active:scale-95 transition-all disabled:opacity-40 text-base font-medium"
          >
            ✋ Ngắt robot đang nói
          </button>
        </div>

        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer select-none hover:text-zinc-300">Xem transcript</summary>
          <p className="mt-2 whitespace-pre-wrap text-zinc-400">{voiceModeTranscript || "(chưa có nội dung)"}</p>
        </details>

        <p className="mt-3 text-[11px] text-zinc-600">
          Khi bật, robot tự nghe → gửi → nói, rồi tự nghe lại — không cần bấm gửi thủ công. Bấm &quot;Tắt&quot; để dừng hẳn.
        </p>

        <div className="mt-3 pt-3 border-t border-zinc-900 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px] font-mono text-zinc-500">
          <span>STT: {sttMode === "openai" ? "OpenAI" : "Browser"}</span>
          <span>Provider: {lastProvider ?? "—"}</span>
          <span>Latency: {lastLatencyMs !== null ? `${lastLatencyMs}ms` : "—"}</span>
          <span>Session: {sessionId ? `${sessionId.slice(0, 8)}...` : "—"}</span>
          <span>Saved: {sessionMessageCount ?? "—"}</span>
          <span className="truncate" title={lastTranscript}>
            Last: {lastTranscript || "—"}
          </span>
        </div>
      </Card>
      </div>

      <div id="voice">
      <Card className="mb-4 flex flex-col items-center text-center py-8">
        <h3 className="text-sm font-medium text-zinc-100 mb-4">🎤 Voice / Mic</h3>
        <button
          onClick={() => (isListening ? stopListening() : startListening("voice"))}
          disabled={!canUseMic || voiceModeOn}
          title={voiceModeOn ? "Đang ở chế độ hội thoại giọng nói — tắt để dùng mic thủ công" : micTitle()}
          className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl transition-all active:scale-95 disabled:opacity-40 ${
            isListening ? "bg-red-600/40 text-red-300" : "bg-zinc-800 text-zinc-300 hover:bg-indigo-600/30"
          }`}
        >
          🎤
        </button>
        <p className="mt-3 text-xs text-zinc-500">
          {!secureContextChecked
            ? "Đang kiểm tra..."
            : !isSecureContext
              ? "Cần HTTPS hoặc localhost để dùng mic"
              : !sttSupported
                ? "Trình duyệt không hỗ trợ nhận diện giọng nói"
                : isListening
                  ? "Đang nghe..."
                  : "Bấm để nói"}
        </p>
        <textarea
          readOnly
          value={voiceTranscript}
          placeholder="Nội dung nhận diện sẽ hiện ở đây..."
          className="mt-4 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 min-h-[5rem] resize-none"
        />
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setVoiceTranscript("")}
            className="min-h-[3rem] px-4 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all text-sm"
          >
            Xoá
          </button>
          <button
            onClick={() => {
              const text = voiceTranscript;
              setVoiceTranscript("");
              sendChatMessage(text);
            }}
            disabled={!voiceTranscript.trim() || chatLoading}
            className="min-h-[3rem] px-5 rounded-xl bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 active:scale-95 transition-all disabled:opacity-40 text-sm font-medium"
          >
            Gửi vào Chat
          </button>
          <button
            onClick={() => speak("Brain OS đã sẵn sàng.")}
            disabled={!speechSupported}
            title={speechSupported ? "Đọc thử câu kiểm tra âm thanh" : "Trình duyệt không hỗ trợ đọc giọng nói"}
            className="min-h-[3rem] px-5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-emerald-600/30 hover:text-emerald-300 active:scale-95 transition-all disabled:opacity-40 text-sm font-medium"
          >
            🔊 Test âm thanh
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-600">TTS (đọc giọng nói) hoạt động cả trên HTTP — không cần secure context.</p>
      </Card>
      </div>

      <div id="camera">
      <Card className="mb-4">
        <h3 className="text-sm font-medium text-zinc-100 mb-3">📷 Camera capture</h3>
        {cameraError && <p className="text-xs text-red-400 mb-2">{cameraError}</p>}
        <div className="rounded-xl overflow-hidden bg-black aspect-video mb-3 flex items-center justify-center">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`w-full h-full object-cover ${cameraOn ? "" : "hidden"}`}
          />
          {!cameraOn && <span className="text-xs text-zinc-600">Camera đang tắt</span>}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex flex-wrap gap-3">
          {!cameraOn ? (
            <button
              onClick={startCamera}
              disabled={!canUseCamera}
              title={cameraTitle()}
              className="min-h-[3.5rem] px-5 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-indigo-600/30 active:scale-95 transition-all disabled:opacity-40 text-base font-medium"
            >
              📷 Bật camera
            </button>
          ) : (
            <>
              <button
                onClick={stopCamera}
                className="min-h-[3.5rem] px-5 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-red-600/30 active:scale-95 transition-all text-base font-medium"
              >
                Tắt camera
              </button>
              <button
                onClick={capturePhoto}
                disabled={capturing}
                className="min-h-[3.5rem] px-5 rounded-xl bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 active:scale-95 transition-all disabled:opacity-40 text-base font-medium"
              >
                {capturing ? "Đang lưu..." : "📸 Chụp và lưu"}
              </button>
            </>
          )}
        </div>
        {captureStatus && <p className="mt-3 text-xs text-zinc-400">{captureStatus}</p>}
        <p className="mt-3 text-[11px] text-zinc-600">
          Ảnh lưu access_level=3 (owner_only) trên server, không gửi lên AI/cloud.
        </p>
      </Card>
      </div>

      {/* ── Demo control panel — bấm phát là thấy Chuối phản ứng ngay (local skill, không chờ OpenAI) ── */}
      <Card className="mb-4">
        <h3 className="text-sm font-medium text-zinc-100 mb-3">🎬 Demo Control Panel</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {DEMO_BUTTONS.map((d) => (
            <button
              key={d.label}
              disabled={chatLoading}
              onClick={() => sendChatMessage(d.text)}
              className="min-h-[3rem] px-3 py-2 text-sm rounded-xl bg-zinc-800 text-zinc-200 hover:bg-indigo-600/30 hover:text-indigo-300 active:scale-95 transition-all disabled:opacity-50"
            >
              {d.label}
            </button>
          ))}
        </div>
      </Card>

      {/* ── Hardware command preview — action/eyes/mouth/hardwareCommand từ response gần nhất ── */}
      <Card className="mb-4">
        <h3 className="text-sm font-medium text-zinc-100 mb-2">🔧 Hardware Command Preview</h3>
        <div className="divide-y divide-zinc-900">
          <StatRow label="Mood" value={<span className="text-sm text-zinc-200 font-mono">{robotMoodLabel}</span>} />
          <StatRow label="Action" value={<span className="text-sm text-zinc-200 font-mono">{robotActionLabel}</span>} />
          <StatRow label="Eyes" value={<span className="text-sm text-zinc-200 font-mono">{robotEyesLabel}</span>} />
          <StatRow label="Mouth" value={<span className="text-sm text-zinc-200 font-mono">{robotMouthLabel}</span>} />
          <StatRow
            label="hardwareCommand.type"
            value={<span className="text-sm text-zinc-200 font-mono">{lastHardwareCommand?.type ?? "none"}</span>}
          />
          <StatRow
            label="hardwareCommand.command"
            value={<span className="text-sm text-zinc-200 font-mono">{lastHardwareCommand?.command ?? "—"}</span>}
          />
        </div>
        {lastHardwareCommand?.payload && (
          <pre className="mt-2 text-[11px] bg-zinc-950 border border-zinc-800 rounded-lg p-2 overflow-x-auto text-zinc-400">
            {JSON.stringify(lastHardwareCommand.payload, null, 2)}
          </pre>
        )}
        <p className="mt-3 text-[11px] text-zinc-600">Phần này sau sẽ map sang ESP32-S3.</p>
      </Card>

      {/* ── Mặt robot + trạng thái + điều khiển (đã có từ trước) ── */}

      <RobotVision enabled={cameraTrackingEnabled} debug={visionDebug} onTargetUpdate={handleVisionTarget} />

      {isFullscreenRobot && (
        <div
          ref={kioskRef}
          className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4 p-6"
        >
          <RobotFaceKiosk
            state={resolveDisplayState(robotFaceExpr, {
              isSpeaking,
              isListening: isListening || voiceModeStatus === "listening",
              isThinking: chatLoading || voiceModeStatus === "thinking",
            })}
            gesture={robotAction}
            cameraTarget={
              cameraTrackingEnabled
                ? { x: visionTarget.x, y: visionTarget.y, detected: visionTarget.detected }
                : undefined
            }
            gazeOverride={gazeOverride}
            batteryPercent={state?.battery}
            className="w-[min(78vw,78vh)]"
          />
          <p className="text-sm text-zinc-300">
            {handsFreeStatusLabel()}
            {cameraTrackingEnabled ? ` · ${visionTarget.detected ? "Nhìn thấy bạn" : "Đang tìm người"}` : ""}
          </p>
          {(voiceModeTranscript || lastTranscript) && (
            <p className="text-xs text-zinc-500 max-w-md text-center truncate">
              {voiceModeTranscript || lastTranscript}
            </p>
          )}
          {lastProvider && <p className="text-[10px] font-mono text-zinc-600">{lastProvider}</p>}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <button
              onClick={exitFullscreenRobotMode}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-red-600/30 active:scale-95 transition-all text-sm"
            >
              ⤢ Exit Fullscreen
            </button>
            <button
              onClick={() => setCameraTrackingEnabled((v) => !v)}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-indigo-600/30 active:scale-95 transition-all text-sm"
            >
              📷 Tracking: {cameraTrackingEnabled ? "Bật" : "Tắt"}
            </button>
            <button
              onClick={() => setVisionDebug((v) => !v)}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-indigo-600/30 active:scale-95 transition-all text-sm"
            >
              🐞 Debug cam: {visionDebug ? "Bật" : "Tắt"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div
          ref={faceCardRef}
          className={`relative lg:col-span-2 flex flex-col items-center justify-center bg-[#16161a] border border-zinc-800 rounded-xl ${
            isFullscreen ? "py-0 min-h-screen justify-center" : "py-10 sm:py-14"
          }`}
        >
          <div className="absolute top-3 left-3">
            <span className="text-[10px] tracking-widest font-mono text-zinc-500 uppercase">Eye Tracking</span>
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              onClick={() => setVisionDebug((v) => !v)}
              title="Bật/tắt xem trước camera tracking (debug)"
              className={`px-2.5 h-10 rounded-lg text-xs flex items-center gap-1 transition-all active:scale-95 ${
                visionDebug ? "bg-indigo-600/40 text-indigo-200" : "bg-zinc-800/80 text-zinc-300 hover:bg-indigo-600/30"
              }`}
            >
              🐞 Debug cam
            </button>
            <button
              onClick={() => setCameraTrackingEnabled((v) => !v)}
              title="Bật/tắt camera nhìn theo người (không vào fullscreen)"
              className={`px-2.5 h-10 rounded-lg text-xs flex items-center gap-1 transition-all active:scale-95 ${
                cameraTrackingEnabled ? "bg-teal-600/40 text-teal-200" : "bg-zinc-800/80 text-zinc-300 hover:bg-indigo-600/30"
              }`}
            >
              📷 Tracking
            </button>
            <button
              onClick={enterFullscreenRobotMode}
              title="Smart Robot Fullscreen Mode — mặt lớn, camera nhìn theo người, voice mode"
              className="px-2.5 h-10 rounded-lg text-xs flex items-center gap-1 bg-zinc-800/80 text-zinc-300 hover:bg-indigo-600/30 active:scale-95 transition-all"
            >
              🖥️ Fullscreen Robot
            </button>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình (chỉ mặt)"}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-indigo-600/40 active:scale-95 transition-all text-lg"
            >
              {isFullscreen ? "⤢" : "⛶"}
            </button>
          </div>
          <RobotFaceKiosk
            state={resolveDisplayState(robotFaceExpr, {
              isSpeaking,
              isListening: isListening || voiceModeStatus === "listening",
              isThinking: chatLoading || voiceModeStatus === "thinking",
            })}
            gesture={robotAction}
            cameraTarget={
              cameraTrackingEnabled
                ? { x: visionTarget.x, y: visionTarget.y, detected: visionTarget.detected }
                : undefined
            }
            gazeOverride={gazeOverride}
            batteryPercent={state?.battery}
            className={isFullscreen ? "w-[min(70vw,70vh)]" : "w-56 sm:w-64 md:w-72"}
          />
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="indigo">{state?.current_mode ?? "..."}</Badge>
            <Badge variant="default">
              {cameraTrackingEnabled ? "Eye: Camera" : "Eye: Pointer"}
            </Badge>
            {cameraTrackingEnabled && (
              <Badge variant={visionTarget.detected ? "green" : "default"}>
                {visionTarget.detected ? "Nhìn thấy bạn" : "Đang tìm người"}
              </Badge>
            )}
          </div>
        </div>

        <Card>
          <h3 className="text-sm font-medium text-zinc-100 mb-2">Trạng thái</h3>
          <div className="divide-y divide-zinc-900">
            <StatRow
              label="Kết nối"
              value={
                <Badge variant={state?.status === "online" ? "green" : "default"}>
                  {state?.status ?? "—"}
                </Badge>
              }
            />
            <StatRow
              label="Chế độ"
              value={<span className="text-sm text-zinc-200 font-mono">{state?.current_mode ?? "—"}</span>}
            />
            <StatRow
              label="Biểu cảm"
              value={<span className="text-sm text-zinc-200 font-mono">{state?.current_face ?? "—"}</span>}
            />
            <StatRow
              label="Lệnh gần nhất"
              value={<span className="text-sm text-zinc-200 font-mono">{state?.last_command ?? "—"}</span>}
            />
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-900">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-zinc-500">Pin</span>
              <span className="text-sm text-zinc-200 font-mono">{state ? `${battery}%` : "—"}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${batteryColor}`}
                style={{ width: `${Math.max(0, Math.min(100, battery))}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      <RealtimeMicPanel />

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-medium text-zinc-100">Điều khiển</h3>
          <div className="flex items-center gap-2">
            <select
              value={ttsVoice}
              onChange={(e) => handleTtsVoiceChange(e.target.value)}
              title="Giọng đọc OpenAI TTS"
              className="px-2 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 border border-zinc-700"
            >
              {TTS_VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <button
              onClick={toggleSound}
              title="Bật/tắt đọc giọng nói"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-indigo-600/30 active:scale-95 transition-all"
            >
              {soundEnabled ? "🔊 Âm thanh: Bật" : "🔇 Âm thanh: Tắt"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 mb-4">
          {COMMANDS.map((c) => (
            <button
              key={c.command}
              disabled={loading}
              onClick={() => sendCommand(c.command)}
              className="min-h-[4rem] px-4 py-3 text-base sm:text-lg font-medium rounded-xl bg-zinc-800 text-zinc-200 hover:bg-indigo-600/30 hover:text-indigo-300 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={speakText}
            onChange={(e) => setSpeakText(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-base text-zinc-200 min-h-[4rem]"
            placeholder="Nội dung robot sẽ nói..."
          />
          <button
            disabled={loading}
            onClick={() => sendCommand("speak", { text: speakText })}
            className="min-h-[4rem] px-6 py-3 text-base sm:text-lg font-medium rounded-xl bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 active:scale-95 transition-all disabled:opacity-50 shrink-0"
          >
            Nói thử
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-100 mb-3">📋 Event log</h3>
        {logs.length === 0 && <p className="text-xs text-zinc-600">Chưa có lệnh nào.</p>}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map((l) => (
            <div
              key={l.id}
              className="rounded-lg bg-zinc-900/60 border border-zinc-800 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3"
            >
              <span className="text-xs text-zinc-600 font-mono shrink-0 sm:w-20">
                {new Date(l.time).toLocaleTimeString("vi-VN")}
              </span>
              <Badge variant="indigo">{l.command}</Badge>
              <span className="text-sm text-zinc-400">{l.message}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
