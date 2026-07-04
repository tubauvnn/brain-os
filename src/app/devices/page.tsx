import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "green" | "red" | "yellow" | "default"> = {
  online: "green",
  offline: "default",
  idle: "yellow",
  error: "red",
};

const TYPE_ICON: Record<string, string> = {
  robot: "◎",
  laptop: "▣",
  camera: "◉",
  tv: "▤",
  esp32: "◈",
  browser: "◻",
  other: "◇",
};

export default async function DevicesPage() {
  const devices = await prisma.device.findMany({
    orderBy: { updated_at: "desc" },
    include: { _count: { select: { events: true } } },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Thiết bị" description={`${devices.length} thiết bị đăng ký`} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map((d) => (
          <Card key={d.id}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{TYPE_ICON[d.device_type] ?? "◇"}</span>
                <div>
                  <h3 className="text-sm font-medium text-zinc-100">{d.name}</h3>
                  <p className="text-xs text-zinc-600 font-mono">{d.device_type}</p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[d.status] ?? "default"}>{d.status}</Badge>
            </div>
            {d.description && (
              <p className="text-xs text-zinc-500 mb-2">{d.description}</p>
            )}
            {d.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {d.capabilities.map((c) => <Badge key={c}>{c}</Badge>)}
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-zinc-700">
              <span>{d._count.events} events</span>
              {d.ip_address && <span>{d.ip_address}</span>}
              {d.last_seen_at && (
                <span>last seen {new Date(d.last_seen_at).toLocaleTimeString("vi-VN")}</span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
