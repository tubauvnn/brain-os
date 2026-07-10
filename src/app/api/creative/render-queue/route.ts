import { NextRequest } from "next/server";
import { handleError, ok } from "@/lib/api";
import { listJobs } from "@/lib/creative";

// GET /api/creative/render-queue — progress tracking: liệt kê RenderJob, lọc
// theo status/episodeId.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const episodeId = searchParams.get("episodeId") ?? undefined;
    const jobs = await listJobs({ status, episodeId });
    return ok(jobs);
  } catch (e) {
    return handleError(e);
  }
}
