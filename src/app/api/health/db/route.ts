import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Health check DB cho Brain OS — dùng để giám sát Postgres còn sống/còn đúng
// schema hay không (vd sau khi đổi hạ tầng volume/container).
// Schema hiện tại không có model Agent/AgentRun — trả null thay vì bịa số 0.
export async function GET() {
  try {
    const [conversationMessages, conversationSessions] = await Promise.all([
      prisma.conversationMessage.count(),
      prisma.conversationSession.count(),
    ]);

    return NextResponse.json({
      ok: true,
      database: "connected",
      counts: {
        conversationMessages,
        conversationSessions,
        agents: null,
        agentRuns: null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định khi kết nối database";
    return NextResponse.json({ ok: false, database: "error", error: message }, { status: 503 });
  }
}
