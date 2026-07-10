import { NextRequest } from "next/server";
import { ok, err, handleError } from "@/lib/api";
import { getEpisode } from "@/lib/creative";

type Ctx = { params: { id: string } };

// GET /api/creative/episodes/:id — episode + scenes (kèm render jobs + asset
// đã sinh cho từng scene) + cost estimate gần nhất (nếu đã tính).
export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const episode = await getEpisode(params.id);
    if (!episode) return err("Không tìm thấy episode.", 404);
    return ok(episode);
  } catch (e) {
    return handleError(e);
  }
}
