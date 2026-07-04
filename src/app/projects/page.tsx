import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "green" | "yellow" | "default" | "red"> = {
  active: "green",
  paused: "yellow",
  completed: "default",
  archived: "red",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Tạm dừng",
  completed: "Hoàn thành",
  archived: "Lưu trữ",
};

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
    include: {
      _count: { select: { tasks: true, memories: true, decisions: true } },
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Projects" description={`${projects.length} projects`} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <h3 className="text-sm font-semibold text-zinc-100">{p.name}</h3>
                {p.pinned && <span className="text-indigo-400 text-xs">◆</span>}
              </div>
              <Badge variant={STATUS_VARIANT[p.status] ?? "default"}>
                {STATUS_LABEL[p.status]}
              </Badge>
            </div>
            {p.description && (
              <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{p.description}</p>
            )}
            <div className="flex gap-4 text-xs text-zinc-600">
              <span>{p._count.tasks} tasks</span>
              <span>{p._count.memories} mem</span>
              <span>{p._count.decisions} dec</span>
            </div>
            <p className="text-xs text-zinc-700 font-mono mt-2">/{p.slug}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
