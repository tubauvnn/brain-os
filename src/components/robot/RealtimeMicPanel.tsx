"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Panel Mic + OpenAI Realtime (WebRTC) — tách riêng khỏi luồng chat/hands-free
// cũ (turn-based STT→chat→TTS) để không đụng/rủi ro phá code đang chạy tốt.
// Đây là chuẩn bị cho robot thật (ESP32-S3 sau này) dùng OpenAI Realtime API
// qua WebRTC — browser/mobile client PHẢI dùng ephemeral client secret
// (không bao giờ cầm OPENAI_API_KEY thật), lấy qua /api/robot/realtime-token.

export type RealtimeRobotState = "idle" | "listening" | "thinking" | "speaking" | "error";

export type RealtimeMicPanelProps = {
  onRobotStateChange?: (state: RealtimeRobotState) => void;
};

type TokenStatus = "unknown" | "not_configured" | "ready" | "error";
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

const SILENCE_THRESHOLD = 8; // ngưỡng volume (0-100) coi như im lặng
const SILENCE_HOLD_MS = 900;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function RealtimeMicPanel({ onRobotStateChange }: RealtimeMicPanelProps) {
  const [micPermission, setMicPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [micError, setMicError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0); // 0-100, cho VU meter
  const [silent, setSilent] = useState(true);
  const [holding, setHolding] = useState(false);

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("unknown");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [sessionModel, setSessionModel] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>("disconnected");
  const [robotState, setRobotState] = useState<RealtimeRobotState>("idle");
  const [eventLog, setEventLog] = useState<string[]>([]);

  // Token ephemeral — CHỈ giữ trong memory (React state), không bao giờ ghi
  // localStorage/sessionStorage, không log ra console.
  const ephemeralTokenRef = useRef<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const silenceSinceRef = useRef<number | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const setRobotStateBoth = useCallback(
    (s: RealtimeRobotState) => {
      setRobotState(s);
      onRobotStateChange?.(s);
    },
    [onRobotStateChange]
  );

  function log(line: string) {
    setEventLog((prev) => [`${new Date().toLocaleTimeString("vi-VN")} — ${line}`, ...prev].slice(0, 40));
  }

  // ── Mic permission + VU meter (dùng chung cho test meter và push-to-talk) ──

  async function requestMic(): Promise<MediaStream | null> {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      setMicPermission("granted");
      startMeter(stream);
      return stream;
    } catch (err) {
      setMicPermission("denied");
      setMicError(err instanceof Error ? err.message : "Không xin được quyền micro.");
      return null;
    }
  }

  function startMeter(stream: MediaStream) {
    stopMeter();
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    function tick() {
      const analyserNode = analyserRef.current;
      if (!analyserNode) return;
      analyserNode.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = clamp(Math.round(rms * 200), 0, 100);
      setVolume(level);

      const now = performance.now();
      if (level < SILENCE_THRESHOLD) {
        if (silenceSinceRef.current === null) silenceSinceRef.current = now;
        setSilent(now - silenceSinceRef.current > SILENCE_HOLD_MS);
      } else {
        silenceSinceRef.current = null;
        setSilent(false);
      }

      meterRafRef.current = requestAnimationFrame(tick);
    }
    meterRafRef.current = requestAnimationFrame(tick);
  }

  function stopMeter() {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setVolume(0);
    silenceSinceRef.current = null;
    setSilent(true);
  }

  function stopMicStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function handleTestMeter() {
    const stream = streamRef.current ?? (await requestMic());
    if (!stream) return;
    log("Test meter: mic đang mở, chưa gửi audio đi đâu cả.");
  }

  async function handleHoldStart() {
    setHolding(true);
    const stream = streamRef.current ?? (await requestMic());
    if (!stream) {
      setHolding(false);
      return;
    }
    if (connection === "connected") {
      setRobotStateBoth("listening");
      log("Push-to-talk: bắt đầu nói (đã kết nối Realtime).");
    } else {
      log("Push-to-talk: mic mở (chưa kết nối OpenAI Realtime — chỉ test local meter).");
    }
  }

  function handleHoldEnd() {
    setHolding(false);
    if (connection === "connected") {
      setRobotStateBoth("thinking");
      log("Push-to-talk: dừng nói.");
    }
  }

  function handleStopMic() {
    stopMeter();
    stopMicStream();
    setHolding(false);
    setRobotStateBoth("idle");
  }

  // ── OpenAI Realtime: tạo ephemeral session token ──

  async function createSession() {
    setTokenError(null);
    setTokenStatus("unknown");
    try {
      const res = await fetch("/api/robot/realtime-token", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        if (typeof data.error === "string" && data.error.includes("OPENAI_API_KEY missing")) {
          setTokenStatus("not_configured");
          setTokenError("Cần cấu hình OPENAI_API_KEY trong .env trên VPS.");
        } else {
          setTokenStatus("error");
          setTokenError(data.error ?? "Không tạo được session.");
        }
        return;
      }
      ephemeralTokenRef.current = data.client_secret;
      setSessionModel(data.model ?? null);
      setTokenStatus("ready");
      log(`Tạo session OpenAI Realtime thành công (model: ${data.model ?? "?"}).`);
    } catch (err) {
      setTokenStatus("error");
      setTokenError(err instanceof Error ? err.message : "Lỗi không xác định khi tạo session.");
    }
  }

  // ── OpenAI Realtime: kết nối WebRTC thật ──
  // Flow chuẩn theo tài liệu OpenAI Realtime (WebRTC cho browser/mobile):
  //   1. RTCPeerConnection + addTrack(mic) + data channel.
  //   2. createOffer() -> setLocalDescription().
  //   3. POST SDP offer thẳng tới OpenAI kèm ephemeral client_secret (KHÔNG
  //      phải API key thật) -> nhận SDP answer.
  //   4. setRemoteDescription(answer).
  // CHƯA test round-trip audio thật (môi trường này không có mic/loa thật) —
  // xem docs/ROBOT_ONLY_STATUS.md mục giới hạn đã biết.
  async function connectVoice() {
    if (!ephemeralTokenRef.current) {
      setTokenError("Chưa có session — bấm 'Create session' trước.");
      return;
    }
    setConnection("connecting");
    try {
      const stream = streamRef.current ?? (await requestMic());
      if (!stream) {
        setConnection("error");
        return;
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (e) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0];
        }
      };

      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => log("Data channel mở.");
      dc.onclose = () => log("Data channel đóng.");
      dc.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          handleRealtimeEvent(evt);
        } catch {
          // Không phải JSON hợp lệ — bỏ qua, không crash UI.
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const model = sessionModel || "gpt-4o-realtime-preview";
      const resp = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralTokenRef.current}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!resp.ok) {
        throw new Error(`OpenAI WebRTC handshake thất bại (HTTP ${resp.status})`);
      }
      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setConnection("connected");
      setRobotStateBoth("idle");
      log("Đã kết nối WebRTC với OpenAI Realtime.");
    } catch (err) {
      setConnection("error");
      const message = err instanceof Error ? err.message : "Lỗi không xác định khi kết nối.";
      setTokenError(message);
      log(`Lỗi kết nối: ${message}`);
    }
  }

  function handleRealtimeEvent(evt: { type?: string }) {
    log(`event: ${evt.type ?? "?"}`);
    switch (evt.type) {
      case "input_audio_buffer.speech_started":
        setRobotStateBoth("listening");
        break;
      case "response.created":
        setRobotStateBoth("thinking");
        break;
      case "response.output_audio.delta":
      case "response.audio.delta":
        setRobotStateBoth("speaking");
        break;
      case "response.done":
        setRobotStateBoth("idle");
        break;
      case "error":
        setRobotStateBoth("error");
        break;
      default:
        break;
    }
  }

  function disconnectVoice() {
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setConnection("disconnected");
    setRobotStateBoth("idle");
    log("Đã ngắt kết nối.");
  }

  useEffect(() => {
    return () => {
      stopMeter();
      stopMicStream();
      disconnectVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tokenBadge =
    tokenStatus === "ready" ? (
      <Badge variant="green">Ready</Badge>
    ) : tokenStatus === "not_configured" ? (
      <Badge variant="yellow">Not configured</Badge>
    ) : tokenStatus === "error" ? (
      <Badge variant="red">Error</Badge>
    ) : (
      <Badge variant="default">Unknown</Badge>
    );

  const connectionBadge =
    connection === "connected" ? (
      <Badge variant="green">Connected</Badge>
    ) : connection === "connecting" ? (
      <Badge variant="indigo">Connecting…</Badge>
    ) : connection === "error" ? (
      <Badge variant="red">Error</Badge>
    ) : (
      <Badge variant="default">Disconnected</Badge>
    );

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-medium text-zinc-100">🎙️ Voice Assistant</h3>
        <Badge variant={robotState === "error" ? "red" : robotState === "idle" ? "default" : "indigo"}>
          {robotState.toUpperCase()}
        </Badge>
      </div>

      {/* ── Mic test / push-to-talk — hoạt động độc lập, không cần OpenAI ── */}
      <div className="mb-4 pb-4 border-b border-zinc-900">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">
            Mic permission:{" "}
            {micPermission === "granted" ? (
              <span className="text-emerald-400">đã cấp</span>
            ) : micPermission === "denied" ? (
              <span className="text-red-400">bị từ chối</span>
            ) : (
              <span className="text-zinc-500">chưa xin</span>
            )}
          </span>
          {silent && streamRef.current && <span className="text-[10px] text-zinc-600">im lặng</span>}
        </div>

        <div className="h-3 rounded-full bg-zinc-900 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-75"
            style={{ width: `${volume}%` }}
          />
        </div>

        {micError && <p className="text-xs text-red-400 mb-2">{micError}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleTestMeter}
            className="min-h-[2.75rem] px-4 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-indigo-600/30 active:scale-95 transition-all text-sm font-medium"
          >
            Request mic / Test meter
          </button>
          <button
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={() => holding && handleHoldEnd()}
            onTouchStart={(e) => {
              e.preventDefault();
              handleHoldStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleHoldEnd();
            }}
            className={`min-h-[2.75rem] px-4 rounded-xl active:scale-95 transition-all text-sm font-medium ${
              holding ? "bg-red-600/40 text-red-200" : "bg-teal-600/30 text-teal-200 hover:bg-teal-600/50"
            }`}
          >
            {holding ? "🎙️ Đang nói… (thả để dừng)" : "🎙️ Bấm để nói (giữ)"}
          </button>
          <button
            onClick={handleStopMic}
            className="min-h-[2.75rem] px-4 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-red-600/30 active:scale-95 transition-all text-sm font-medium"
          >
            ⏹ Stop
          </button>
        </div>
      </div>

      {/* ── OpenAI Realtime session/connection ── */}
      <div>
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">Session: {tokenBadge}</div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">Voice: {connectionBadge}</div>
          {sessionModel && <span className="text-[10px] font-mono text-zinc-600">{sessionModel}</span>}
        </div>

        {tokenStatus === "not_configured" && (
          <div className="mb-3 text-xs text-amber-300 bg-amber-950/40 border border-amber-800 rounded-lg px-3 py-2">
            ⚠️ Cần cấu hình <code className="font-mono">OPENAI_API_KEY</code> trong <code className="font-mono">.env</code> trên VPS để dùng OpenAI Realtime. Mic vẫn test local (meter) được bình thường ở trên.
          </div>
        )}
        {tokenError && tokenStatus !== "not_configured" && (
          <p className="text-xs text-red-400 mb-3">{tokenError}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={createSession}
            className="min-h-[2.75rem] px-4 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-indigo-600/30 active:scale-95 transition-all text-sm font-medium"
          >
            Create session
          </button>
          <button
            onClick={connectVoice}
            disabled={tokenStatus !== "ready" || connection === "connecting" || connection === "connected"}
            className="min-h-[2.75rem] px-4 rounded-xl bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 active:scale-95 transition-all disabled:opacity-40 text-sm font-medium"
          >
            Connect voice
          </button>
          <button
            onClick={disconnectVoice}
            disabled={connection === "disconnected"}
            className="min-h-[2.75rem] px-4 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-red-600/30 active:scale-95 transition-all disabled:opacity-40 text-sm font-medium"
          >
            Disconnect
          </button>
        </div>

        <audio ref={remoteAudioRef} autoPlay className="hidden" />

        <details className="mt-3">
          <summary className="text-xs text-zinc-500 cursor-pointer">Event log (debug, không chứa audio/secret)</summary>
          <pre className="mt-2 text-[10px] text-zinc-600 max-h-40 overflow-y-auto whitespace-pre-wrap">
            {eventLog.length > 0 ? eventLog.join("\n") : "(chưa có event)"}
          </pre>
        </details>
      </div>
    </Card>
  );
}
