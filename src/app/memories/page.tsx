import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const ACCESS_LABEL: Record<number, string> = {
  0: "public",
  1: "known",
  2: "family",
  3: "owner",
  4: "confirm",
};

export default async function MemoriesPage() {
  const memories = await prisma.memory.findMany({
    orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
    include: { project: true },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Trí nhớ" description={`${memories.length} mục`} />

      <div className="space-y-3">
        {memories.map((m) => (
          <Card key={m.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {m.pinned && <span className="text-indigo-400 text-xs">◆</span>}
                  <h3 className="text-sm font-medium text-zinc-100">{m.title}</h3>
                </div>
                <p className="text-sm text-zinc-400 line-clamp-3">{m.content}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {m.tags.map((tag) => (
                    <Badge key={tag} variant="default">{tag}</Badge>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right space-y-1">
                <Badge variant="indigo">{ACCESS_LABEL[m.access_level] ?? m.access_level}</Badge>
                {m.project && (
                  <p className="text-xs text-zinc-600">{m.project.name}</p>
                )}
                <p className="text-xs text-zinc-700">
                  {new Date(m.created_at).toLocaleDateString("vi-VN")}
                </p>
              </div>
            </div>
          </Card>
        ))}

        {memories.length === 0 && (
          <p className="text-zinc-600 text-sm">Chưa có trí nhớ nào. Thêm qua API POST /api/memories.</p>
        )}
      </div>
    </div>
  );
}
