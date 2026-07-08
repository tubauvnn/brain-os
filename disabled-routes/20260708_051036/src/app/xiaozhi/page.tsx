"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ExpressiveRobotFace, type RobotEmotion, type RobotState } from "@/components/robot/ExpressiveRobotFace";
import { WebFaceTracker, type FaceTarget } from "@/components/robot/WebFaceTracker";
import { smoothGaze, targetToPanTilt } from "@/lib/robot/tracking";
import { mapTextToEmotion } from "@/lib/robot/emotion-map";

// ─── Web Speech API (SpeechRecognition) — không có sẵn trong lib.dom của TS ───
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

type EndpointMode = "webhook" | "openai";

type ChatMessage = {
  id: string;
  role: "user" | "robot";
  content: string;
  created_at: string;
};

const SECRET_STORAGE_KEY = "xiaozhi_web_secret";
const DEFAULT_DEVICE_ID = "xiaozhi-web-demo";
const DEFAULT_MODEL = "brainos-local";
const VALID_API_FACES: RobotState[] = ["idle", "happy", "thinking", "sad"];
const HAPPY_HOLD_MS = 1200;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function XiaozhiPage() {
  // Settings — chỉ secret được lưu localStorage (theo yêu cầu), deviceId/model
  // chỉ là input có giá trị mặc định, không cần trỏ vào server.
  const [endpointMode, setEndpointMode] = useState<EndpointMode>("webhook");
  const [secret, setSecret] = useState("");
  const [deviceId, setDeviceId] = useState(DEFAULT_DEVICE_ID);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [showSettings, setShowSettings] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(SECRET_STORAGE_KEY);
    if (saved) setSecret(saved);
  }, []);

  function handleSecretChange(value: string) {
    setSecret(value);
    window.localStorage.setItem(SECRET_STORAGE_KEY, value);
  }

  // Robot face state
  const [robotState, setRobotState] = useState<RobotState>("idle");
  const [robotEmotion, setRobotEmotion] = useState<RobotEmotion>("neutral");
  const happyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug panel (Phần G)
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [faceRaw, setFaceRaw] = useState<string | null>(null);
  const [actionRaw, setActionRaw] = useState<string | null>(null);

  // Camera tracking (Phần D/E)
  const [cameraTrackingEnabled, setCameraTrackingEnabled] = useState(false);
  const [debugCamera, setDebugCamera] = useState(false);
  const [visionTarget, setVisionTarget] = useState<FaceTarget>({ detected: false, x: 0, y: 0, size: 0, source: "none" });
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  const handleFaceTarget = useCallback((target: FaceTarget) => {
    setVisionTarget(target);
    if (target.detected) {
      setGaze((prev) => smoothGaze(prev, { x: target.x, y: target.y }));
    }
  }, []);

  const panTilt = targetToPanTilt(gaze);

  // Secure context + hỗ trợ trình duyệt — chỉ biết được sau khi mount client.
  const [secureContextChecked, setSecureContextChecked] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const viVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    setIsSecureContext(typeof window !== "undefined" && window.isSecureContext);
    setSttSupported(getSpeechRecognitionConstructor() !== null);
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    setCameraSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
    setSecureContextChecked(true);
  }, []);

  useEffect(() => {
    if (!ttsSupported) return;
    function pickVietnameseVoice() {
      const voices = window.speechSynthesis.getVoices();
      viVoiceRef.current = voices.find((v) => v.lang.toLowerCase().startsWith("vi")) ?? null;
    }
    pickVietnameseVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVietnameseVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pickVietnameseVoice);
  }, [ttsSupported]);

  useEffect(() => {
    return () => {
      if (happyTimerRef.current) clearTimeout(happyTimerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const canUseMic = secureContextChecked && isSecureContext && sttSupported;
  const canUseCamera = secureContextChecked && isSecureContext && cameraSupported;
  const showInsecureWarning = secureContextChecked && !isSecureContext;

  // ── Voice output (browser TTS) ─────────────────────────────────────────────
  const [voiceInputOn, setVoiceInputOn] = useState(false);

  const speak = useCallback(
    (text: string) => {
      if (happyTimerRef.current) {
        clearTimeout(happyTimerRef.current);
        happyTimerRef.current = null;
      }
      if (!ttsSupported || !text) {
        setRobotState("idle");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "vi-VN";
      if (viVoiceRef.current) utterance.voice = viVoiceRef.current;
      utterance.onstart = () => setRobotState("speaking");
      utterance.onend = () => {
        setRobotState("happy");
        happyTimerRef.current = setTimeout(() => {
          setRobotState(voiceInputOn ? "listening" : "idle");
        }, HAPPY_HOLD_MS);
      };
      utterance.onerror = () => setRobotState("idle");
      window.speechSynthesis.speak(utterance);
    },
    [ttsSupported, voiceInputOn]
  );

  function stopSpeaking() {
    if (happyTimerRef.current) {
      clearTimeout(happyTimerRef.current);
      happyTimerRef.current = null;
    }
    if (ttsSupported) window.speechSynthesis.cancel();
    setRobotState(voiceInputOn ? "listening" : "idle");
  }

  // ── Send message tới Brain OS (webhook hoặc OpenAI-compatible) ────────────
  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || busy) return;
    setBusy(true);
    setChatInput("");
    setError(null);
    setMessages((prev) => [...prev, { id: newId("user"), role: "user", content: text, created_at: new Date().toISOString() }]);
    setRobotState("thinking");
    setRobotEmotion("curious");

    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    try {
      let res: Response;
      if (endpointMode === "webhook") {
        res = await fetch("/api/xiaozi/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-brainos-secret": secret },
          body: JSON.stringify({
            text,
            deviceId,
            accessLevel: 3,
            meta: { source: "xiaozhi_web_demo", forceBrain: true },
          }),
        });
      } else {
        res = await fetch("/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
          body: JSON.stringify({ model, messages: [{ role: "user", content: text }], stream: false }),
        });
      }

      const elapsed = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt);
      setHttpStatus(res.status);
      setLatencyMs(elapsed);
      const json = await res.json().catch(() => null);

      let replyText = "";
      let apiFace: string | null = null;
      let apiAction: string | null = null;
      let apiProvider: string | null = null;
      let failMessage: string | null = null;

      if (endpointMode === "webhook") {
        if (!res.ok || !json?.ok) {
          failMessage = json?.error || `Lỗi HTTP ${res.status}`;
        } else {
          replyText = json.speak || json.robot_say || json.reply || "";
          apiFace = typeof json.face === "string" ? json.face : null;
          apiAction = typeof json.action === "string" ? json.action : null;
          apiProvider = typeof json.provider === "string" ? json.provider : null;
        }
      } else {
        if (!res.ok || json?.error) {
          failMessage = json?.error?.message || `Lỗi HTTP ${res.status}`;
        } else {
          replyText = json?.choices?.[0]?.message?.content || "";
        }
      }

      setProvider(apiProvider);
      setFaceRaw(apiFace);
      setActionRaw(apiAction);

      if (failMessage) {
        setError(failMessage);
        setRobotState("error");
        setRobotEmotion("confused");
        setMessages((prev) => [...prev, { id: newId("robot"), role: "robot", content: failMessage as string, created_at: new Date().toISOString() }]);
        return;
      }

      setMessages((prev) => [...prev, { id: newId("robot"), role: "robot", content: replyText, created_at: new Date().toISOString() }]);

      const mapped = mapTextToEmotion(replyText);
      const nextState = apiFace && VALID_API_FACES.includes(apiFace as RobotState) ? (apiFace as RobotState) : mapped.state;
      setRobotState(nextState);
      setRobotEmotion(mapped.emotion);
      speak(replyText);
    } catch {
      setError("Không kết nối được API");
      setRobotState("error");
      setRobotEmotion("confused");
    } finally {
      setBusy(false);
    }
  }

  // ── Voice input (SpeechRecognition, optional) ──────────────────────────────
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  function toggleVoiceInput() {
    if (!canUseMic) return;
    if (voiceInputOn) {
      recognitionRef.current?.stop();
      setVoiceInputOn(false);
      setRobotState("idle");
      return;
    }
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript ?? "";
      if (text.trim()) sendMessage(text.trim());
    };
    recognition.onerror = () => {
      setVoiceInputOn(false);
      setRobotState("idle");
    };
    recognition.onend = () => setVoiceInputOn(false);
    recognitionRef.current = recognition;
    setVoiceInputOn(true);
    setRobotState("listening");
    recognition.start();
  }

  // ── Fullscreen demo (Phần I) ────────────────────────────────────────────────
  const kioskRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInputInFullscreen, setShowInputInFullscreen] = useState(true);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === kioskRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function enterFullscreen() {
    setCameraTrackingEnabled(true);
    try {
      await kioskRef.current?.requestFullscreen();
    } catch {
      // Fullscreen API có thể bị từ chối trên vài trình duyệt — layout kiosk
      // vẫn áp dụng qua state isFullscreen dù không vào fullscreen thật.
    }
  }

  async function exitFullscreen() {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  }

  const faceGazeProps = cameraTrackingEnabled
    ? { targetDetected: visionTarget.detected, gazeX: gaze.x, gazeY: gaze.y }
    : {};

  return (
    <div
      ref={kioskRef}
      className={isFullscreen ? "fixed inset-0 z-50 bg-black flex flex-col overflow-y-auto" : "p-4 sm:p-6 max-w-6xl mx-auto"}
    >
      {!isFullscreen && (
        <PageHeader
          title="Xiaozhi Web Demo"
          description="Robot ảo ChinChin/Xiaozhi trên web — biểu cảm + camera tracking, chưa cần ESP32."
          action={
            <Link href="/robot" className="text-xs text-indigo-400 hover:text-indigo-300">
              ← Robot Simulator
            </Link>
          }
        />
      )}

      {showInsecureWarning && (
        <div className="mb-4 flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-800 rounded-lg px-4 py-3">
          <span className="text-lg leading-none shrink-0">⚠️</span>
          <p className="text-xs text-amber-400/80">
            Camera/mic cần mở bằng <span className="font-mono">https://os.irec.vn/xiaozhi</span> — trang đang chạy qua kết nối
            không an toàn nên trình duyệt chặn quyền camera/micro. Chat văn bản và giọng đọc (TTS) vẫn hoạt động bình thường.
          </p>
        </div>
      )}

      {error && !isFullscreen && (
        <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className={isFullscreen ? "flex-1 flex flex-col items-center justify-center p-4 gap-3" : "grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4"}>
        {/* ── Robot face + controls ── */}
        <div className="flex flex-col items-center gap-3">
          <ExpressiveRobotFace
            state={robotState}
            emotion={robotEmotion}
            className={isFullscreen ? "w-full max-w-md" : "w-full max-w-xs"}
            {...faceGazeProps}
          />

          {isFullscreen && (
            <p className="text-[10px] font-mono text-zinc-500">
              {robotState} / {robotEmotion} · pan {panTilt.pan}° tilt {panTilt.tilt}° · {visionTarget.source}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={isFullscreen ? exitFullscreen : enterFullscreen}
              className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-300 hover:bg-indigo-600/30 transition-colors"
            >
              {isFullscreen ? "Exit Fullscreen" : "⛶ Fullscreen Demo"}
            </button>
            <button
              onClick={() => setCameraTrackingEnabled((v) => !v)}
              disabled={!canUseCamera}
              title={canUseCamera ? "Bật/tắt camera tracking" : "Cần HTTPS/localhost + trình duyệt hỗ trợ camera"}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40 ${
                cameraTrackingEnabled ? "bg-teal-600/40 text-teal-200" : "bg-zinc-800 text-zinc-300 hover:bg-teal-600/20"
              }`}
            >
              📷 Camera Tracking
            </button>
            <button
              onClick={() => setDebugCamera((v) => !v)}
              disabled={!cameraTrackingEnabled}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40 ${
                debugCamera ? "bg-zinc-700 text-zinc-100" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              🐞 Debug Camera
            </button>
            <button
              onClick={toggleVoiceInput}
              disabled={!canUseMic}
              title={canUseMic ? "Nói để nhập" : "Voice input chưa hỗ trợ trên trình duyệt này."}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40 ${
                voiceInputOn ? "bg-red-600/40 text-red-200" : "bg-zinc-800 text-zinc-300 hover:bg-indigo-600/30"
              }`}
            >
              {voiceInputOn ? "⏹ Đang nghe" : "🎤 Voice"}
            </button>
            <button onClick={stopSpeaking} className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
              🔇 Stop speaking
            </button>
          </div>

          {!canUseMic && secureContextChecked && isSecureContext && (
            <p className="text-[11px] text-amber-500">Voice input chưa hỗ trợ trên trình duyệt này.</p>
          )}

          {(!isFullscreen || showInputInFullscreen) && (
            <div className="flex gap-2 w-full max-w-xl">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage(chatInput);
                }}
                placeholder='Gõ "Brain OS là gì"...'
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200"
              />
              <button
                onClick={() => sendMessage(chatInput)}
                disabled={busy || !chatInput.trim()}
                className="px-4 rounded-xl bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 disabled:opacity-40 text-sm font-medium"
              >
                Gửi
              </button>
            </div>
          )}
          {isFullscreen && (
            <button
              onClick={() => setShowInputInFullscreen((v) => !v)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              {showInputInFullscreen ? "Ẩn ô nhập" : "Hiện ô nhập"}
            </button>
          )}
        </div>

        {/* ── Settings + debug + chat log ── */}
        {!isFullscreen && (
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-zinc-100">⚙️ Cài đặt</h3>
                <button onClick={() => setShowSettings((v) => !v)} className="text-xs text-zinc-500 hover:text-zinc-300">
                  {showSettings ? "Thu gọn" : "Mở rộng"}
                </button>
              </div>
              {showSettings && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Endpoint mode</label>
                    <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden text-xs">
                      <button
                        onClick={() => setEndpointMode("webhook")}
                        className={`flex-1 px-2.5 py-1.5 transition-colors ${
                          endpointMode === "webhook" ? "bg-indigo-600/40 text-indigo-200" : "text-zinc-400 hover:bg-zinc-800"
                        }`}
                      >
                        Xiaozi webhook
                      </button>
                      <button
                        onClick={() => setEndpointMode("openai")}
                        className={`flex-1 px-2.5 py-1.5 transition-colors ${
                          endpointMode === "openai" ? "bg-indigo-600/40 text-indigo-200" : "text-zinc-400 hover:bg-zinc-800"
                        }`}
                      >
                        OpenAI compatible
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Secret (XIAOZI_WEBHOOK_SECRET)</label>
                    <input
                      type="password"
                      value={secret}
                      onChange={(e) => handleSecretChange(e.target.value)}
                      placeholder="Dán secret từ .env"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
                      autoComplete="off"
                    />
                  </div>
                  {endpointMode === "webhook" ? (
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Device ID</label>
                      <input
                        value={deviceId}
                        onChange={(e) => setDeviceId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Model</label>
                      <input
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-zinc-100 mb-3">🩺 Debug</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">HTTP status</span>
                  <span className="font-mono text-zinc-300">{httpStatus ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Provider</span>
                  <span className="font-mono text-zinc-300">{provider ?? "—"}</span>
                </div>
                {provider === "xiaozi_template_first" && (
                  <p className="text-[11px] text-amber-500">
                    Đây là mode thiết bị thật. Web demo nên bật forceBrain.
                  </p>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Latency</span>
                  <span className="font-mono text-zinc-300">{latencyMs !== null ? `${latencyMs} ms` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">face / action</span>
                  <span className="font-mono text-zinc-300">
                    {faceRaw ?? "—"} / {actionRaw ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Camera target</span>
                  <span className="font-mono text-zinc-300">
                    {visionTarget.detected
                      ? `x${visionTarget.x.toFixed(2)} y${visionTarget.y.toFixed(2)} (${visionTarget.source})`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Pan / Tilt</span>
                  <span className="font-mono text-zinc-300">
                    {panTilt.pan}° / {panTilt.tilt}° {panTilt.centered && <Badge variant="green">centered</Badge>}
                  </span>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-zinc-100 mb-3">💬 Hội thoại</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {messages.length === 0 && <p className="text-xs text-zinc-600">Chưa có tin nhắn — gõ hoặc bấm mic để bắt đầu.</p>}
                {messages.map((m) => (
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
                {busy && <p className="text-xs text-zinc-500">Robot đang trả lời...</p>}
              </div>
            </Card>
          </div>
        )}
      </div>

      {cameraTrackingEnabled && (
        <WebFaceTracker enabled={cameraTrackingEnabled} debug={debugCamera} onTargetUpdate={handleFaceTarget} />
      )}
    </div>
  );
}
