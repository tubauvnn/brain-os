import { NextRequest } from "next/server";
import { err, handleError, ok } from "@/lib/api";
import { retryJob } from "@/lib/creative";

type Ctx = { params: { jobId: string } };

// POST /api/creative/render-queue/:jobId/retry — retry thủ công 1 job đã
// "failed" (đã hết max_attempts tự động) — reset attempts, đưa lại về
// "queued" (cần gọi tiếp /render-queue/process để thực thi).
export async function POST(_: NextRequest, { params }: Ctx) {
  try {
    const job = await retryJob(params.jobId);
    return ok(job);
  } catch (e) {
    if (e instanceof Error && e.message.includes("Không tìm thấy")) return err(e.message, 404);
    if (e instanceof Error && e.message.includes("Chỉ retry")) return err(e.message, 409);
    return handleError(e);
  }
}
