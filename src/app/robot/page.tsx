"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RobotFaceKiosk, type RobotFaceState } from "@/components/robot/RobotFaceKiosk";

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

type ChatMessage = { id: string; role: "user" | "robot"; content: string; created_at: string };

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
      <PageHeader
        title="Robot Chuối"
        description="Robot mô phỏng trên web, trước khi nối ESP32-S3"
        action={
          <div className="flex items-center gap-2">
            <Badge variant="green">online</Badge>
            <Badge variant="indigo">Brain OS Conversation Agent</Badge>
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
              enablePointerTracking
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
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && <p className="text-xs text-zinc-500">Chuối đang trả lời...</p>}
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
                  if (e.key === "Enter") sendChatMessage(chatInput);
                }}
                placeholder="Nhắn gì đó với Chuối..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 min-h-[3rem]"
              />
              <button
                onClick={() => sendChatMessage(chatInput)}
                disabled={chatLoading || !chatInput.trim()}
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
      </details>
    </div>
  );
}
