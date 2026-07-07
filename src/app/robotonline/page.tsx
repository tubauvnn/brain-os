"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type StatusResponse = {
  ok: boolean;
  brainos: { online: boolean; domain: string };
  xiaozhi: {
    httpOta: { host: string; port: number; online: boolean };
    websocket: { host: string; port: number; online: boolean };
    public: boolean;
  };
  bridge: {
    openaiCompatibleBaseUrl: string;
    model: string;
    xiaoziWebhook: string;
  };
};

function OnlineBadge({ online, checking }: { online: boolean | undefined; checking: boolean }) {
  if (online === undefined) return <Badge variant="default">{checking ? "…" : "lỗi"}</Badge>;
  return online ? <Badge variant="green">online</Badge> : <Badge variant="red">offline</Badge>;
}

export default function RobotOnlinePage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [checking, setChecking] = useState(true);

  // Chạy sau khi mounted — UI tĩnh phía dưới render ngay không đợi kết quả
  // check này, tránh domain public bị treo response chờ fetch nội bộ xong.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/robotonline/status", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as StatusResponse;
        if (!cancelled) {
          setStatus(data);
          setChecking(false);
        }
      } catch {
        // Không throw ra ngoài — chỉ đánh dấu hết "đang kiểm tra" để badge
        // hiện "lỗi" thay vì treo mãi ở "…".
        if (!cancelled) setChecking(false);
      }
    }
    load();
    const interval = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader title="Robot Online" description="Xiaozhi real server + Brain OS bridge" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-zinc-100">Brain OS</span>
            <OnlineBadge online={status?.brainos.online} checking={checking} />
          </div>
          <p className="text-sm text-zinc-500 font-mono">{status?.brainos.domain ?? "https://os.irec.vn"}</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-zinc-100">Xiaozhi HTTP/OTA</span>
            <OnlineBadge online={status?.xiaozhi.httpOta.online} />
          </div>
          <p className="text-sm text-zinc-500 font-mono">127.0.0.1:8003</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-zinc-100">Xiaozhi WebSocket</span>
            <OnlineBadge online={status?.xiaozhi.websocket.online} />
          </div>
          <p className="text-sm text-zinc-500 font-mono">127.0.0.1:8000</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-zinc-100">Brain OS Bridge</span>
            <Badge variant="indigo">v1</Badge>
          </div>
          <p className="text-sm text-zinc-500 font-mono">
            {status?.bridge.openaiCompatibleBaseUrl ?? "https://os.irec.vn/v1"}
          </p>
        </Card>
      </div>

      <div className="flex gap-4 mt-6 text-sm">
        <Link href="/robot" className="text-indigo-400 hover:text-indigo-300">
          ← Robot simulator
        </Link>
        <Link href="/xiaozhi" className="text-indigo-400 hover:text-indigo-300">
          ← Xiaozhi
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-100 mb-3">🎙️ Demo Client Voice</h2>

        <Card>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-zinc-100">Xiaozhi server</span>
            <Badge variant={status?.xiaozhi.httpOta.online || status?.xiaozhi.websocket.online ? "green" : "default"}>
              {status?.xiaozhi.httpOta.online || status?.xiaozhi.websocket.online ? "running local-only" : "chưa xác định"}
            </Badge>
          </div>
          <p className="text-sm text-zinc-500 mb-3">
            Voice client: <span className="text-zinc-400">chưa kết nối (not connected yet)</span> — cần chạy
            py-xiaozhi trên máy có mic/loa thật, VPS này không có phần cứng âm thanh.
          </p>

          <p className="text-sm text-zinc-400 font-medium mb-1">Hướng dẫn nhanh (SSH tunnel):</p>
          <pre className="text-xs bg-zinc-900 text-zinc-300 rounded p-3 overflow-x-auto mb-3">
{`ssh -N \\
  -L 8000:127.0.0.1:8000 \\
  -L 8003:127.0.0.1:8003 \\
  root@42.96.12.122 -p 26266`}
          </pre>
          <p className="text-sm text-zinc-500 mb-3">
            Client config (py-xiaozhi, sau khi tunnel đã mở):
            <br />
            WebSocket: <span className="font-mono text-zinc-400">ws://127.0.0.1:8000/xiaozhi/v1/</span>
            <br />
            OTA/API: <span className="font-mono text-zinc-400">http://127.0.0.1:8003/xiaozhi/ota/</span>
          </p>

          <p className="text-sm text-zinc-400 font-medium mb-1">Brain OS LLM bridge:</p>
          <p className="text-sm text-zinc-500 mb-3">
            Base URL: <span className="font-mono text-zinc-400">https://os.irec.vn/v1</span>
            <br />
            Model: <span className="font-mono text-zinc-400">brainos-local</span>
            <br />
            API Key: <span className="font-mono text-zinc-400">XIAOZI_WEBHOOK_SECRET</span> (đọc trong{" "}
            <span className="font-mono text-zinc-400">.env</span> trên VPS, không hiển thị ở đây)
          </p>

          <p className="text-xs text-amber-400">
            ⚠️ Không mở port 8000/8003 public trực tiếp. Proxy public (qua os.irec.vn hoặc subdomain riêng) chỉ
            nên làm sau khi đã xác nhận rõ auth/protocol — xem docs/XIAOZHI_CLIENT_DEMO.md.
          </p>
        </Card>
      </div>
    </div>
  );
}
