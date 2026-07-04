import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  todo: "Chờ",
  in_progress: "Đang làm",
  done: "Xong",
  cancelled: "Huỷ",
};

const STATUS_VARIANT: Record<string, "default" | "indigo" | "green" | "red"> = {
  todo: "default",
  in_progress: "indigo",
  done: "green",
  cancelled: "red",
};

const PRIORITY_LABEL: Record<number, string> = { 1: "Thấp", 2: "Bình thường", 3: "Cao", 4: "Khẩn" };
const PRIORITY_COLOR: Record<number, string> = { 1: "text-zinc-500", 2: "text-zinc-400", 3: "text-amber-400", 4: "text-red-400" };

export default async function TasksPage() {
  const tasks = await prisma.task.findMany({
    orderBy: [{ status: "asc" }, { priority: "desc" }, { created_at: "desc" }],
    include: { project: true },
    where: { parent_id: null },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Tasks" description={`${tasks.length} tasks`} />

      <div className="space-y-2">
        {tasks.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-mono ${PRIORITY_COLOR[t.priority]}`}>
                    P{t.priority}
                  </span>
                  <h3 className="text-sm text-zinc-100">{t.title}</h3>
                </div>
                {t.description && (
                  <p className="text-xs text-zinc-500 line-clamp-1">{t.description}</p>
                )}
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {t.project && <Badge>{t.project.name}</Badge>}
                  {t.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                  {t.due_date && (
                    <span className="text-xs text-zinc-600">
                      {new Date(t.due_date).toLocaleDateString("vi-VN")}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status]}</Badge>
            </div>
          </Card>
        ))}

        {tasks.length === 0 && (
          <p className="text-zinc-600 text-sm">Chưa có task. Thêm qua POST /api/tasks.</p>
        )}
      </div>
    </div>
  );
}
