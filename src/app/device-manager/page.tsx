"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Trang test tạm cho Device Manager vertical slice (Phase 2) — KHÔNG phải
// Physical Device Registry (/devices, bảng Device/Postgres). Chỉ để gọi tay
// /api/device-manager/* và quan sát log/lỗi, cùng tinh thần trang /voice.
// Chưa gắn vào nav-config.ts — truy cập trực tiếp qua /device-manager.

type DeviceDescriptor = {
  id: string;
  name: string;
  type: string;
  provider: string;
  status: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
};

type DeviceResult = {
  success: boolean;
  deviceId?: string;
  deviceType: string;
  command: string;
  status: string;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
  latencyMs: number;
};

type LogLine = { time: string; message: string; level: "info" | "success" | "error" };

function nowLabel() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

export default function DeviceManagerTestPage() {
  const [devices, setDevices] = useState<DeviceDescriptor[]>([]);
  const [deviceType, setDeviceType] = useState("robot");
  const [command, setCommand] = useState("greet");
  const [text, setText] = useState("Xin chào, chào mừng đến với ChinChin.");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lastResult, setLastResult] = useState<DeviceResult | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);

  function appendLog(message: string, level: LogLine["level"] = "info") {
    setLogs((prev) => [...prev, { time: nowLabel(), message, level }].slice(-30));
  }

  async function loadDevices() {
    try {
      const res = await fetch("/api/device-manager/devices");
      const json = (await res.json()) as { devices: DeviceDescriptor[] };
      setDevices(json.devices ?? []);
    } catch {
      appendLog("Lỗi: không tải được danh sách device (network)", "error");
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  async function handleSend() {
    if (status === "loading") return;
    setStatus("loading");
    setLastResult(null);
    appendLog(`Gửi lệnh "${command}" tới deviceType="${deviceType}"`);

    try {
      const res = await fetch("/api/device-manager/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceType,
          command,
          payload: text.trim() ? { text: text.trim() } : undefined,
        }),
      });
      const json = (await res.json()) as DeviceResult;
      setLastResult(json);

      if (!res.ok || !json.success) {
        setStatus("error");
        appendLog(`${json.message ?? `HTTP ${res.status}`}${json.error ? ` (${json.error})` : ""}`, "error");
        return;
      }

      appendLog(`${json.message} — latency ${json.latencyMs}ms`, "success");
      setStatus("success");
    } catch {
      setStatus("error");
      appendLog("Lỗi: không gọi được /api/device-manager/command (network)", "error");
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Device Manager Test"
        description="Device Manager vertical slice (Phase 2) — Mock Robot Provider, tách biệt Physical Device Registry (/devices)"
        action={
          <Badge variant={status === "success" ? "green" : status === "error" ? "red" : status === "loading" ? "indigo" : "default"}>
            {status}
          </Badge>
        }
      />

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-zinc-100">Registered devices</h3>
          <button
            onClick={loadDevices}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-all"
          >
            Refresh
          </button>
        </div>
        <div className="space-y-2">
          {devices.length === 0 && <p className="text-zinc-600 text-sm">Chưa có device nào.</p>}
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-mono">{d.id}</span>
              <span className="text-zinc-500">{d.type} · {d.provider}</span>
              <Badge variant={d.status === "mock" ? "indigo" : "default"}>{d.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Device type</label>
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200"
            >
              <option value="robot">robot</option>
              <option value="camera">camera</option>
              <option value="speaker">speaker</option>
              <option value="display">display</option>
              <option value="esp32">esp32</option>
              <option value="unknown">unknown</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Command</label>
            <select
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200"
            >
              <option value="greet">greet</option>
              <option value="speak">speak</option>
              <option value="status">status</option>
              <option value="move_placeholder">move_placeholder</option>
            </select>
          </div>
        </div>
        <label className="block text-xs text-zinc-500 mb-1">payload.text</label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 mb-3"
          placeholder="Xin chào, chào mừng đến với ChinChin."
        />
        <button
          onClick={handleSend}
          disabled={status === "loading"}
          className="px-5 py-2.5 rounded-xl bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 active:scale-95 transition-all disabled:opacity-40 text-sm font-medium"
        >
          {status === "loading" ? "Đang gửi..." : "Send command"}
        </button>
      </Card>

      {lastResult && (
        <Card className="mb-4">
          <h3 className="text-sm font-medium text-zinc-100 mb-2">Last result</h3>
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono">{JSON.stringify(lastResult, null, 2)}</pre>
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
