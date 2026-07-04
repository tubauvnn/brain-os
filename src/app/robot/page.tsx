"use client";

import { useCallback, useEffect, useState } from "react";
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

type StatusResponse = {
  ok: boolean;
  state?: RobotStateData;
  recent_events?: DeviceEventDTO[];
  error?: string;
};

type CommandResponse = {
  ok: boolean;
  state?: RobotStateData;
  message?: string;
  error?: string;
};

type LogEntry = {
  id: string;
  time: string;
  command: string;
  message: string;
};

const FACE_EMOJI: Record<RobotFace, string> = {
  idle: "🙂",
  happy: "😄",
  speaking: "😮",
  sleep: "😴",
  surprised: "😲",
  thinking: "🤔",
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

export default function RobotPage() {
  const [state, setState] = useState<RobotStateData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [speakText, setSpeakText] = useState("Xin chào, tôi là ChinChin.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch {
      setError("Không kết nối được API");
    } finally {
      setLoading(false);
    }
  }

  const face = (state?.current_face ?? "idle") as RobotFace;
  const emoji = FACE_EMOJI[face] ?? "🙂";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Robot Simulator"
        description="Robot ảo ChinChin — mô phỏng trên web, chưa nối phần cứng."
      />

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="md:col-span-2 flex flex-col items-center justify-center py-10">
          <div className="text-[120px] leading-none select-none">{emoji}</div>
          <p className="mt-3 text-xs text-zinc-500 font-mono">{state?.current_mode ?? "..."}</p>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-zinc-100 mb-3">Trạng thái</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Kết nối</span>
              <Badge variant={state?.status === "online" ? "green" : "default"}>
                {state?.status ?? "—"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Chế độ</span>
              <span className="text-zinc-300 font-mono">{state?.current_mode ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Biểu cảm</span>
              <span className="text-zinc-300 font-mono">{state?.current_face ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Pin</span>
              <span className="text-zinc-300 font-mono">
                {state ? `${state.battery}%` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Lệnh gần nhất</span>
              <span className="text-zinc-300 font-mono">{state?.last_command ?? "—"}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <h3 className="text-sm font-medium text-zinc-100 mb-3">Điều khiển</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {COMMANDS.map((c) => (
            <button
              key={c.command}
              disabled={loading}
              onClick={() => sendCommand(c.command)}
              className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-200 hover:bg-indigo-600/30 hover:text-indigo-300 transition-colors disabled:opacity-50"
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={speakText}
            onChange={(e) => setSpeakText(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
            placeholder="Nội dung robot sẽ nói..."
          />
          <button
            disabled={loading}
            onClick={() => sendCommand("speak", { text: speakText })}
            className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 transition-colors disabled:opacity-50 shrink-0"
          >
            Nói thử
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-zinc-100 mb-3">Event log</h3>
        {logs.length === 0 && <p className="text-xs text-zinc-600">Chưa có lệnh nào.</p>}
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start gap-3 text-xs border-b border-zinc-900 pb-1.5">
              <span className="text-zinc-600 font-mono shrink-0">
                {new Date(l.time).toLocaleTimeString("vi-VN")}
              </span>
              <span className="text-indigo-300 font-mono shrink-0">{l.command}</span>
              <span className="text-zinc-400">{l.message}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
