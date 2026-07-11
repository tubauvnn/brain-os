import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { getContinuity, getActiveProjectContext, getProjectById } from "@/lib/project";

export const dynamic = "force-dynamic";

// GET /api/robot/continuity — Phase 6B mục 7/10. Trả continuity record thật
// (src/lib/project/continuity.ts, PHẦN của Project Memory — không phải hệ
// thống lưu trữ mới) + tóm tắt dự án sáng tạo đang mở (nếu có) + todos chưa
// xong. Cùng dữ liệu handleWorkStatus (conversation-agent.ts) dùng để trả
// lời chat — route này chỉ là lối vào JSON trực tiếp, không tính lại gì khác.
export async function GET() {
  try {
    const continuity = await getContinuity();
    const activeProject = continuity.activeProjectId ? await getProjectById(continuity.activeProjectId) : null;
    const projectContext = await getActiveProjectContext();

    return NextResponse.json({
      ok: true,
      continuity,
      activeProject: projectContext
        ? {
            id: projectContext.id,
            name: projectContext.name,
            unfinishedTodos: activeProject?.todos.filter((t) => !t.done).map((t) => t.content) ?? [],
          }
        : null,
    });
  } catch (e) {
    return handleError(e);
  }
}
