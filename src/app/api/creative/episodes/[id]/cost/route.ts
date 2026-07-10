import { NextRequest } from "next/server";
import { err, handleError, ok } from "@/lib/api";
import { estimateEpisodeCost } from "@/lib/creative";

type Ctx = { params: { id: string } };

// POST /api/creative/episodes/:id/cost — Cost Manager: (re)tính và lưu 1 dòng
// CostEstimate mới (image/voice/video/tổng, đều là ƯỚC LƯỢNG — xem
// src/lib/creative/cost-manager/cost-manager.ts).
export async function POST(_: NextRequest, { params }: Ctx) {
  try {
    const estimate = await estimateEpisodeCost(params.id);
    return ok(estimate, 201);
  } catch (e) {
    if (e instanceof Error && e.message.includes("No StoryEpisode found")) {
      return err("Không tìm thấy episode.", 404);
    }
    return handleError(e);
  }
}
