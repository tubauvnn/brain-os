import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { getActiveProjectContext, getContinuity } from "@/lib/project";
import { getOwnerContext } from "@/lib/people";

export const dynamic = "force-dynamic";

// GET /api/robot/memory/status — Phase 6B mục 10. Bản TÓM TẮT an toàn cho
// debug/monitoring, KHÔNG trả nguyên bảng Memory/PrivateMemory (mục 11: "Do
// not expose raw private memory records to the frontend"). Chỉ đếm số dòng +
// vài tiêu đề gần nhất (access_level<=1, cùng bộ lọc recallMemory() dùng cho
// chat — không có gì ở đây mà robot chat không thể tự nói ra khi được hỏi).
// PrivateMemory (access_level mặc định 3) KHÔNG được query ở route này.
export async function GET() {
  try {
    const [memoryCount, recentTitles, peopleCount, owner, continuity, projectContext] = await Promise.all([
      prisma.memory.count({ where: { access_level: { lte: 1 } } }),
      prisma.memory.findMany({
        where: { access_level: { lte: 1 } },
        orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
        take: 5,
        select: { title: true, category: true, created_at: true },
      }),
      prisma.people.count(),
      getOwnerContext(),
      getContinuity(),
      getActiveProjectContext(),
    ]);

    return NextResponse.json({
      ok: true,
      owner: owner ? { name: owner.name, alias: owner.alias } : null,
      memory: { count: memoryCount, recent: recentTitles },
      people: { count: peopleCount },
      activeProject: projectContext ? { id: projectContext.id, name: projectContext.name } : null,
      continuity: {
        currentPhase: continuity.currentPhase,
        currentTask: continuity.currentTask,
        updatedAt: continuity.updatedAt,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
