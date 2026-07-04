import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const logs = await prisma.activityLog.findMany({
    orderBy: { created_at: "desc" },
    take: 100,
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Activity Logs" description={`${logs.length} mục gần nhất`} />

      <Card>
        <div className="font-mono text-xs space-y-1.5">
          {logs.map((l) => (
            <div key={l.id} className="flex gap-3 items-start border-b border-zinc-800/50 pb-1.5">
              <span className="text-zinc-600 shrink-0 w-32">
                {new Date(l.created_at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit" })}
              </span>
              <span className="text-indigo-400 shrink-0 w-28">{l.action}</span>
              {l.entity && (
                <span className="text-zinc-500 shrink-0 w-24">{l.entity}</span>
              )}
              {l.entity_id && (
                <span className="text-zinc-700">#{l.entity_id.slice(0, 8)}</span>
              )}
              <span className="text-zinc-600">{l.actor}</span>
            </div>
          ))}

          {logs.length === 0 && (
            <p className="text-zinc-600">Chưa có log. Logs được tạo tự động khi thực hiện các hành động qua API.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
