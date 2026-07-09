"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Trang test tạm cho Voice Provider vertical slice — KHÔNG phải Voice Agent
// đầy đủ, chỉ để gọi tay /api/voice/generate và quan sát log/lỗi. Chưa gắn
// vào nav-config.ts (đúng tinh thần "ít menu" của IA hiện tại) — truy cập
// trực tiếp qua /voice.

type LogLine = { time: string; message: string; level: "info" | "success" | "error" };

type GenerateResponse = {
  success: boolean;
  provider?: string;
  audioUrl?: string;
  duration?: number;
  cost?: number;
  latencyMs?: number;
  error?: string;
};

function nowLabel() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

export default function VoiceTestPage() {
  const [text, setText] = useState("Xin chào, tôi là Brain OS.");
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<GenerateResponse | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);

  function appendLog(message: string, level: LogLine["level"] = "info") {
    setLogs((prev) => [...prev, { time: nowLabel(), message, level }].slice(-30));
  }

  async function handleGenerate() {
    if (!text.trim() || status === "loading") return;
    setStatus("loading");
    setAudioUrl(null);
    setLastResult(null);
    appendLog(`Gửi yêu cầu — ${text.trim().length} ký tự${voiceId ? `, voiceId=${voiceId}` : ""}${modelId ? `, modelId=${modelId}` : ""}`);

    try {
      const res = await fetch("/api/voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: voiceId.trim() || undefined,
          modelId: modelId.trim() || undefined,
        }),
      });
      const json = (await res.json()) as GenerateResponse;
      setLastResult(json);

      if (!res.ok || !json.success) {
        setStatus("error");
        appendLog(`Lỗi: ${json.error ?? `HTTP ${res.status}`}`, "error");
        return;
      }

      appendLog(`Provider: ${json.provider}`, "info");
      appendLog(`Thành công — latency ${json.latencyMs}ms, audioUrl=${json.audioUrl}`, "success");
      setAudioUrl(json.audioUrl ?? null);
      setStatus("success");
    } catch {
      setStatus("error");
      appendLog("Lỗi: không gọi được /api/voice/generate (network)", "error");
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Voice Generation Test"
        description="Voice Provider vertical slice — ElevenLabs (docs/IMPLEMENTATION_ROADMAP_V1.md)"
        action={
          <Badge variant={status === "success" ? "green" : status === "error" ? "red" : status === "loading" ? "indigo" : "default"}>
            {status}
          </Badge>
        }
      />

      <Card className="mb-4">
        <label className="block text-xs text-zinc-500 mb-1">Text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={5000}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 mb-3"
          placeholder="Nhập text cần đọc..."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Voice ID (để trống dùng mặc định)</label>
            <input
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200"
              placeholder="ELEVENLABS_DEFAULT_VOICE_ID"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Model ID (để trống dùng mặc định)</label>
            <input
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200"
              placeholder="eleven_multilingual_v2"
            />
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!text.trim() || status === "loading"}
          className="px-5 py-2.5 rounded-xl bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 active:scale-95 transition-all disabled:opacity-40 text-sm font-medium"
        >
          {status === "loading" ? "Đang tạo..." : "Generate"}
        </button>
      </Card>

      {audioUrl && (
        <Card className="mb-4">
          <h3 className="text-sm font-medium text-zinc-100 mb-2">Audio</h3>
          <audio controls src={audioUrl} className="w-full" />
          <p className="mt-2 text-[11px] text-zinc-600 font-mono">{audioUrl}</p>
          {lastResult && (
            <p className="mt-1 text-[11px] text-zinc-600">
              provider: {lastResult.provider} · latency: {lastResult.latencyMs}ms
              {typeof lastResult.duration === "number" ? ` · duration: ${lastResult.duration}ms` : ""}
              {typeof lastResult.cost === "number" ? ` · cost: ${lastResult.cost}` : ""}
            </p>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-zinc-100">Logs</h3>
          <button
            onClick={() => setLogs([])}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-red-600/20 hover:text-red-300 transition-all"
          >
            Xoá
          </button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
          {logs.length === 0 && <p className="text-zinc-600">Chưa có log nào.</p>}
          {logs.map((l, i) => (
            <div
              key={i}
              className={
                l.level === "error" ? "text-red-400" : l.level === "success" ? "text-emerald-400" : "text-zinc-400"
              }
            >
              <span className="text-zinc-600">[{l.time}]</span> {l.message}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
