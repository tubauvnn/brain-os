import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [memCount, taskCount, projectCount, deviceCount, recentLogs, activeTasks, recentMemories] =
    await Promise.all([
      prisma.memory.count(),
      prisma.task.count({ where: { status: { in: ["todo", "in_progress"] } } }),
      prisma.project.count({ where: { status: "active" } }),
      prisma.device.count({ where: { status: "online" } }),
      prisma.activityLog.findMany({ take: 6, orderBy: { created_at: "desc" } }),
      prisma.task.findMany({ where: { status: { in: ["todo", "in_progress"] } }, take: 5, orderBy: { created_at: "desc" }, include: { project: true } }),
      prisma.memory.findMany({ take: 4, orderBy: { created_at: "desc" }, where: { pinned: true } }),
    ]);

  const stats = [
    { label: "Trí nhớ", value: memCount, href: "/memories", color: "text-indigo-400" },
    { label: "Task đang chạy", value: taskCount, href: "/tasks", color: "text-amber-400" },
    { label: "Project active", value: projectCount, href: "/projects", color: "text-emerald-400" },
    { label: "Thiết bị online", value: deviceCount, href: "/devices", color: "text-pink-400" },
  ];

  const taskStatusLabel: Record<string, string> = {
    todo: "Chờ",
    in_progress: "Đang làm",
    done: "Xong",
    cancelled: "Huỷ",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Brain OS</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:border-zinc-600 transition-colors">
              <div className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active tasks */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Tasks đang mở</h2>
          <div className="space-y-2">
            {activeTasks.length === 0 && (
              <p className="text-zinc-600 text-sm">Không có task nào.</p>
            )}
            {activeTasks.map((t) => (
              <Card key={t.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{t.title}</p>
                  {t.project && <p className="text-xs text-zinc-600">{t.project.name}</p>}
                </div>
                <Badge variant={t.status === "in_progress" ? "indigo" : "default"}>
                  {taskStatusLabel[t.status]}
                </Badge>
              </Card>
            ))}
            <Link href="/tasks" className="text-xs text-indigo-400 hover:text-indigo-300">Xem tất cả →</Link>
          </div>
        </div>

        {/* Pinned memories */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Trí nhớ ghim</h2>
          <div className="space-y-2">
            {recentMemories.length === 0 && (
              <p className="text-zinc-600 text-sm">Chưa có trí nhớ nào được ghim.</p>
            )}
            {recentMemories.map((m) => (
              <Card key={m.id}>
                <p className="text-sm text-zinc-200 font-medium">{m.title}</p>
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{m.content}</p>
              </Card>
            ))}
            <Link href="/memories" className="text-xs text-indigo-400 hover:text-indigo-300">Xem tất cả →</Link>
          </div>
        </div>

        {/* Recent logs */}
        <div className="md:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Hoạt động gần đây</h2>
          <Card>
            {recentLogs.length === 0 && (
              <p className="text-zinc-600 text-sm">Chưa có hoạt động nào.</p>
            )}
            <div className="space-y-2">
              {recentLogs.map((l) => (
                <div key={l.id} className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-600 font-mono text-xs shrink-0">
                    {new Date(l.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-indigo-400 font-mono text-xs shrink-0">{l.action}</span>
                  {l.entity && <span className="text-zinc-500 text-xs">{l.entity} {l.entity_id ? `#${l.entity_id.slice(0, 6)}` : ""}</span>}
                </div>
              ))}
            </div>
          </Card>
          <Link href="/logs" className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 inline-block">Xem logs →</Link>
        </div>
      </div>
    </div>
  );
}
