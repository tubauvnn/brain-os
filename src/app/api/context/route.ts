import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

// GET /api/context?project_id=xxx&limit=10
// Returns a consolidated context snapshot for AI agents / robot
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get("project_id") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);

    const [profile, memories, tasks, decisions, devices] = await Promise.all([
      prisma.profile.findFirst({ select: { name: true, alias: true, timezone: true, locale: true } }),
      prisma.memory.findMany({
        where: { ...(project_id ? { project_id } : {}), access_level: { lte: 1 } },
        orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
        take: limit,
        select: { title: true, content: true, tags: true, category: true },
      }),
      prisma.task.findMany({
        where: {
          ...(project_id ? { project_id } : {}),
          status: { in: ["todo", "in_progress"] },
        },
        orderBy: [{ priority: "desc" }],
        take: limit,
        select: { title: true, status: true, priority: true, due_date: true },
      }),
      prisma.decision.findMany({
        where: { ...(project_id ? { project_id } : {}), status: "active" },
        orderBy: { decided_at: "desc" },
        take: 10,
        select: { title: true, rationale: true, outcome: true },
      }),
      prisma.device.findMany({
        where: { status: "online" },
        select: { name: true, device_type: true, status: true, capabilities: true },
      }),
    ]);

    return ok({
      timestamp: new Date().toISOString(),
      project_id: project_id ?? null,
      profile,
      active_tasks: tasks,
      memories,
      decisions,
      online_devices: devices,
    });
  } catch (e) {
    return handleError(e);
  }
}
