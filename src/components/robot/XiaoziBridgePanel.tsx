"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type XiaoziStatus = {
  endpoint: string;
  auth: string;
  authConfigured: boolean;
  providerMode: {
    AI_PROVIDER: string;
    ENABLE_OPENAI_FALLBACK: boolean;
    OPENAI_ONLY_FOR_COMPLEX: boolean;
  };
  database: "connected" | "error";
  samplePayload: { text: string; deviceId: string; accessLevel: number };
};

// "unauthorized-ok"/"unauthorized-unexpected" chỉ dùng cho nút "Test unauthorized"
// (gọi cố ý không kèm secret) — phân biệt với "error" (lỗi thật khi test có secret).
type TestResult = {
  kind: "success" | "error" | "info" | "unauthorized-ok" | "unauthorized-unexpected";
  status?: number;
  provider?: string;
  speak?: string;
  face?: string;
  action?: string;
  message?: string;
};

// Secret chỉ lưu tạm trên trình duyệt admin để bấm nút test — KHÔNG bao giờ do
// server gửi xuống (xem /api/xiaozi/status: không có field secret thật nào).
const SECRET_STORAGE_KEY = "robot_xiaozi_test_secret";
const TEST_DEVICE_ID = "xiaozi-robot-test";

export function XiaoziBridgePanel() {
  const [status, setStatus] = useState<XiaoziStatus | null>(null);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetch("/api/xiaozi/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(SECRET_STORAGE_KEY);
    if (saved) setSecret(saved);
  }, []);

  function handleSecretChange(value: string) {
    setSecret(value);
    localStorage.setItem(SECRET_STORAGE_KEY, value);
  }

  async function runAuthedTest(text: string) {
    if (!secret.trim()) {
      setLastResult({ kind: "info", message: "Nhập XIAOZI_WEBHOOK_SECRET để test public webhook." });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/xiaozi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-brainos-secret": secret },
        body: JSON.stringify({ text, deviceId: TEST_DEVICE_ID, accessLevel: 3 }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setLastResult({
          kind: "success",
          status: res.status,
          provider: data.provider,
          speak: data.speak,
          face: data.face,
          action: data.action,
        });
      } else {
        setLastResult({ kind: "error", status: res.status, message: data.error || "Lỗi không xác định" });
      }
    } catch (e) {
      setLastResult({ kind: "error", message: e instanceof Error ? e.message : "Lỗi không xác định" });
    } finally {
      setTesting(false);
    }
  }

  async function runUnauthorizedTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/xiaozi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Brain OS là gì", deviceId: TEST_DEVICE_ID, accessLevel: 3 }),
      });
      if (res.status === 401) {
        setLastResult({
          kind: "unauthorized-ok",
          status: res.status,
          message: "Unauthorized test OK — webhook đang được bảo vệ.",
        });
      } else {
        setLastResult({
          kind: "unauthorized-unexpected",
          status: res.status,
          message: `Không như mong đợi: request không secret trả về ${res.status} thay vì 401.`,
        });
      }
    } catch (e) {
      setLastResult({ kind: "error", message: e instanceof Error ? e.message : "Lỗi không xác định" });
    } finally {
      setTesting(false);
    }
  }

  const sampleDeviceId = status?.samplePayload.deviceId ?? "xiaozi-robot-1";
  const curlLocal = `curl -i -X POST http://127.0.0.1:3000/api/xiaozi/chat \\\n  -H "Content-Type: application/json" \\\n  -d '{"text":"Brain OS là gì","deviceId":"${sampleDeviceId}","accessLevel":3}'`;
  const curlPublic = `curl -i -X POST ${status?.endpoint ?? "https://os.irec.vn/api/xiaozi/chat"} \\\n  -H "Content-Type: application/json" \\\n  -H "x-brainos-secret: <YOUR_XIAOZI_WEBHOOK_SECRET>" \\\n  -d '{"text":"Brain OS là gì","deviceId":"${sampleDeviceId}","accessLevel":3}'`;

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-medium text-zinc-100">🔌 Xiaozi Bridge</h3>
        <div className="flex items-center gap-1.5">
          {status && <Badge variant={status.database === "connected" ? "indigo" : "red"}>db: {status.database}</Badge>}
          {status && (
            <Badge variant={status.authConfigured ? "green" : "yellow"}>
              auth: {status.authConfigured ? "configured" : "chưa đổi secret"}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px] font-mono text-zinc-400 mb-3">
        <div className="col-span-2 sm:col-span-3">
          Endpoint: <span className="text-zinc-200">{status?.endpoint ?? "…"}</span>
        </div>
        <div className="col-span-2 sm:col-span-3">
          Auth required: <span className="text-zinc-200">yes</span> — Header required:{" "}
          <span className="text-zinc-200">x-brainos-secret</span>
        </div>
        <div>
          AI_PROVIDER: <span className="text-zinc-200">{status?.providerMode.AI_PROVIDER ?? "…"}</span>
        </div>
        <div>
          ENABLE_OPENAI_FALLBACK:{" "}
          <span className="text-zinc-200">{status ? String(status.providerMode.ENABLE_OPENAI_FALLBACK) : "…"}</span>
        </div>
        <div>
          OPENAI_ONLY_FOR_COMPLEX:{" "}
          <span className="text-zinc-200">{status ? String(status.providerMode.OPENAI_ONLY_FOR_COMPLEX) : "…"}</span>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <pre className="text-[10px] bg-zinc-950 border border-zinc-800 rounded-lg p-2 overflow-x-auto text-zinc-400">
          {curlLocal}
        </pre>
        <pre className="text-[10px] bg-zinc-950 border border-zinc-800 rounded-lg p-2 overflow-x-auto text-zinc-400">
          {curlPublic}
        </pre>
      </div>

      <p className="text-[11px] text-zinc-600 mb-3">
        Nếu đang mở trang này qua domain public, mọi request test bên dưới đều cần secret — secret thật không bao
        giờ được server gửi ra trình duyệt (xem <code>/api/xiaozi/status</code>), nên phải tự nhập tay ở đây. Muốn
        lấy secret: xem <code>XIAOZI_WEBHOOK_SECRET</code> trong <code>/root/brain-os/.env</code> trên VPS.
      </p>

      <div className="mb-3">
        <label className="block text-[11px] text-zinc-500 mb-1">Xiaozi secret</label>
        <div className="flex gap-2">
          <input
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => handleSecretChange(e.target.value)}
            placeholder="Nhập XIAOZI_WEBHOOK_SECRET"
            autoComplete="off"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
          />
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-400 hover:bg-zinc-700 transition-colors"
          >
            {showSecret ? "🙈 Ẩn" : "👁️ Hiện"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          disabled={testing || !status}
          onClick={() => runAuthedTest("Brain OS là gì")}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
        >
          Test public
        </button>
        <button
          disabled={testing || !status}
          onClick={() => runAuthedTest("phân tích chiến lược mở rộng ChinChin lên 20 điểm bán")}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
        >
          Test complex
        </button>
        <button
          disabled={testing || !status}
          onClick={() => runAuthedTest("kể chuyện cười đi")}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
        >
          Test template-first
        </button>
        <button
          disabled={testing || !status}
          onClick={runUnauthorizedTest}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-red-600/30 active:scale-95 transition-all disabled:opacity-50"
        >
          Test unauthorized
        </button>
      </div>

      {lastResult && (
        <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 px-3 py-2.5 text-xs text-zinc-400 space-y-1.5">
          {lastResult.kind === "success" && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="indigo">{lastResult.status}</Badge>
                <Badge variant="indigo">{lastResult.provider}</Badge>
                {lastResult.face && <Badge>face: {lastResult.face}</Badge>}
                {lastResult.action && <Badge>action: {lastResult.action}</Badge>}
              </div>
              <div className="text-zinc-300">{lastResult.speak}</div>
            </>
          )}
          {lastResult.kind === "error" && (
            <div className="flex items-center gap-2">
              {lastResult.status != null && <Badge variant="yellow">{lastResult.status}</Badge>}
              <span>{lastResult.message}</span>
            </div>
          )}
          {lastResult.kind === "info" && <div>{lastResult.message}</div>}
          {lastResult.kind === "unauthorized-ok" && (
            <div className="flex items-center gap-2 text-emerald-400">
              <Badge variant="green">{lastResult.status}</Badge>
              <span>{lastResult.message}</span>
            </div>
          )}
          {lastResult.kind === "unauthorized-unexpected" && (
            <div className="flex items-center gap-2 text-red-400">
              <Badge variant="red">{lastResult.status}</Badge>
              <span>{lastResult.message}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
