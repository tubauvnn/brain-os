"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type RobotFace = "idle" | "happy" | "speaking" | "sleep" | "surprised" | "thinking";

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

type ChatResponse = {
  ok: boolean;
  reply?: string;
  provider?: string;
  context_used?: boolean;
  gemini_error?: string | null;
  robot_message_id?: string;
  created_at?: string;
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
  geminiError?: string | null;
  created_at: string;
};

function providerLabel(provider?: string | null): string {
  if (provider === "gemini") return "Gemini";
  if (provider === "fallback") return "Fallback (câu trả lời mẫu)";
  if (provider === "fallback_429") return "Fallback (Gemini quá tải 429)";
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
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
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

const FACE_STYLE: Record<RobotFace, { emoji: string; glow: string }> = {
  idle: { emoji: "🙂", glow: "from-zinc-500/30 to-zinc-900/0" },
  happy: { emoji: "😄", glow: "from-amber-500/30 to-amber-900/0" },
  speaking: { emoji: "😮", glow: "from-emerald-500/30 to-emerald-900/0" },
  sleep: { emoji: "😴", glow: "from-indigo-500/30 to-indigo-900/0" },
  surprised: { emoji: "😲", glow: "from-pink-500/30 to-pink-900/0" },
  thinking: { emoji: "🤔", glow: "from-purple-500/30 to-purple-900/0" },
};

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
  const [speakText, setSpeakText] = useState("Xin chào, tôi là ChinChin.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(false);
  const faceCardRef = useRef<HTMLDivElement>(null);
  const viVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Secure context — mic/camera của trình duyệt chỉ hoạt động trên HTTPS hoặc localhost.
  const [secureContextChecked, setSecureContextChecked] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Voice (STT dùng chung cho khối Chat + khối Voice/Mic)
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sttTargetRef = useRef<"chat" | "voice">("chat");

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === faceCardRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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
    setCameraSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
    setSecureContextChecked(true);
  }, []);

  // Dừng camera khi rời trang.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!soundEnabled || !speechSupported || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "vi-VN";
      if (viVoiceRef.current) utterance.voice = viVoiceRef.current;
      window.speechSynthesis.speak(utterance);
    },
    [soundEnabled, speechSupported]
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
        speak("Xin chào, tôi là ChinChin.");
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
        body: JSON.stringify({ text }),
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
          geminiError: json.gemini_error,
          created_at: json.created_at ?? new Date().toISOString(),
        },
      ]);
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

  const face = (state?.current_face ?? "idle") as RobotFace;
  const faceStyle = FACE_STYLE[face] ?? FACE_STYLE.idle;
  const battery = state?.battery ?? 0;
  const batteryColor =
    battery > 50 ? "bg-emerald-500" : battery > 20 ? "bg-amber-500" : "bg-red-500";

  // Mic/Camera chỉ bật khi secure context + trình duyệt hỗ trợ. Chat text + TTS luôn hoạt động.
  const showInsecureWarning = secureContextChecked && !isSecureContext;
  const canUseMic = secureContextChecked && isSecureContext && sttSupported;
  const canUseCamera = secureContextChecked && isSecureContext && cameraSupported;

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
        title="Robot Simulator"
        description="Robot ảo ChinChin — mô phỏng trên web, chưa nối phần cứng."
      />

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
        <h3 className="text-sm font-medium text-zinc-100 mb-3">💬 Chat với Robot</h3>
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
                {m.role === "robot" && m.provider && (
                  <p className="mt-1 text-[10px] text-zinc-500 font-mono">{providerLabel(m.provider)}</p>
                )}
                {m.role === "robot" && m.geminiError && (
                  <p className="mt-1 text-[10px] text-amber-500">
                    ⚠️ Gemini lỗi ({m.geminiError}), đã dùng câu trả lời mẫu.
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
            disabled={!canUseMic}
            title={micTitle()}
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

      <div id="voice">
      <Card className="mb-4 flex flex-col items-center text-center py-8">
        <h3 className="text-sm font-medium text-zinc-100 mb-4">🎤 Voice / Mic</h3>
        <button
          onClick={() => (isListening ? stopListening() : startListening("voice"))}
          disabled={!canUseMic}
          title={micTitle()}
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

      {/* ── Mặt robot + trạng thái + điều khiển (đã có từ trước) ── */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div
          ref={faceCardRef}
          className={`relative lg:col-span-2 flex flex-col items-center justify-center bg-[#16161a] border border-zinc-800 rounded-xl ${
            isFullscreen ? "py-0 min-h-screen justify-center" : "py-10 sm:py-14"
          }`}
        >
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-indigo-600/40 active:scale-95 transition-all text-lg"
          >
            {isFullscreen ? "⤢" : "⛶"}
          </button>
          <div className="relative flex items-center justify-center">
            <div
              className={`absolute inset-0 -m-8 rounded-full blur-3xl bg-[radial-gradient(circle,var(--tw-gradient-stops))] ${faceStyle.glow}`}
              aria-hidden
            />
            <div
              className={`relative leading-none select-none ${
                isFullscreen
                  ? "text-[min(50vw,50vh)]"
                  : "text-[100px] sm:text-[140px] md:text-[160px]"
              }`}
            >
              {faceStyle.emoji}
            </div>
          </div>
          <Badge variant="indigo">{state?.current_mode ?? "..."}</Badge>
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

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-100">Điều khiển</h3>
          <button
            onClick={toggleSound}
            disabled={!speechSupported}
            title={speechSupported ? "Bật/tắt đọc giọng nói" : "Trình duyệt không hỗ trợ đọc giọng nói"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-indigo-600/30 active:scale-95 transition-all disabled:opacity-40"
          >
            {soundEnabled ? "🔊 Âm thanh: Bật" : "🔇 Âm thanh: Tắt"}
          </button>
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
