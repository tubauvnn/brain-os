import { NextRequest } from "next/server";
import { err, handleError, ok } from "@/lib/api";
import { enqueueSceneJob } from "@/lib/creative";

type Ctx = { params: { id: string } };

// POST /api/creative/scenes/:id/render — Render Queue: enqueue 1 RenderJob
// (status "queued"). KHÔNG tự chạy — gọi POST /api/creative/render-queue/process
// để thực thi thật (đúng thiết kế "nộp việc" tách khỏi "chạy việc", xem
// src/lib/creative/render-queue/render-queue.ts).
export async function POST(_: NextRequest, { params }: Ctx) {
  try {
    const job = await enqueueSceneJob(params.id);
    return ok(job, 201);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Không tìm thấy scene")) return err(e.message, 404);
    return handleError(e);
  }
}
