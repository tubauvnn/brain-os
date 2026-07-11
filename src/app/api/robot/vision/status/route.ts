import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { VisionRouter, DEFAULT_VISION_PROVIDER } from "@/lib/vision";
import { sweepExpiredTempImages } from "@/lib/vision/temp-store";

export const dynamic = "force-dynamic";

// GET /api/robot/vision/status — Phase 6C mục 11. Bản tóm tắt an toàn: có
// vision provider khả dụng không (đủ OPENAI_API_KEY), còn bao nhiêu ảnh tạm
// đang giữ, retention hiện tại. KHÔNG trả path/URL ảnh cụ thể nào (mục 9 —
// không để lộ ảnh riêng tư qua endpoint trạng thái).
export async function GET() {
  try {
    const deletedExpired = await sweepExpiredTempImages();
    const provider = VisionRouter.resolve(DEFAULT_VISION_PROVIDER);
    const available = !!provider && !!process.env.OPENAI_API_KEY;

    const candidates = await prisma.mediaFile.findMany({
      where: { source_type: { in: ["camera", "upload"] } },
      select: { metadata: true },
      take: 200,
    });
    const pendingTempImages = candidates.filter((m) => (m.metadata as { temporary?: boolean } | null)?.temporary === true).length;

    return NextResponse.json({
      ok: true,
      provider: provider?.name ?? null,
      available,
      reason: available ? undefined : "OPENAI_API_KEY chưa được cấu hình.",
      retentionMs: Number(process.env.ROBOT_VISION_RETENTION_MS) || 30 * 60 * 1000,
      pendingTempImages,
      sweptExpiredJustNow: deletedExpired,
    });
  } catch (e) {
    return handleError(e);
  }
}
