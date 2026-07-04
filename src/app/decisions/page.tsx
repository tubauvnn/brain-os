import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const decisions = await prisma.decision.findMany({
    orderBy: { decided_at: "desc" },
    include: { project: true },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Quyết định" description={`${decisions.length} quyết định được ghi nhận`} />

      <div className="space-y-3">
        {decisions.map((d) => (
          <Card key={d.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">{d.title}</h3>
                {d.rationale && (
                  <p className="text-xs text-zinc-500 mb-1">
                    <span className="text-zinc-600">Lý do: </span>{d.rationale}
                  </p>
                )}
                {d.outcome && (
                  <p className="text-xs text-zinc-400">
                    <span className="text-zinc-600">Kết quả: </span>{d.outcome}
                  </p>
                )}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {d.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                  {d.project && <Badge variant="indigo">{d.project.name}</Badge>}
                </div>
              </div>
              <div className="shrink-0 text-right space-y-1">
                <Badge variant={d.status === "active" ? "green" : "default"}>{d.status}</Badge>
                <p className="text-xs text-zinc-700">{new Date(d.decided_at).toLocaleDateString("vi-VN")}</p>
              </div>
            </div>
          </Card>
        ))}

        {decisions.length === 0 && (
          <p className="text-zinc-600 text-sm">Chưa có quyết định. Thêm qua POST /api/decisions.</p>
        )}
      </div>
    </div>
  );
}
