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

function OnlineBadge({ online }: { online: boolean | undefined }) {
  if (online === undefined) return <Badge variant="default">…</Badge>;
  return online ? <Badge variant="green">online</Badge> : <Badge variant="red">offline</Badge>;
}

export default function RobotOnlinePage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/robotonline/status");
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        // Bỏ qua — card sẽ hiển thị trạng thái "…" nếu chưa fetch được.
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
            <OnlineBadge online={status?.brainos.online} />
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
    </div>
  );
}
