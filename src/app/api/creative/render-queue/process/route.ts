import { NextRequest } from "next/server";
import { z } from "zod";
import { handleError, ok } from "@/lib/api";
import { processQueue } from "@/lib/creative";

const ProcessSchema = z.object({ limit: z.number().int().min(1).max(10).default(1) });

// POST /api/creative/render-queue/process — thực thi tối đa `limit` job đang
// chờ NGAY BÂY GIỜ (mặc định 1). Đây là nơi DUY NHẤT thực sự gọi Image
// Provider thật (OpenAI Images API) — mỗi job xử lý có thể tốn phí thật, trừ
// khi Asset Manager phát hiện tái dùng được (xem
// src/lib/creative/render-queue/render-queue.ts).
export async function POST(req: NextRequest) {
  try {
    let raw: unknown = {};
    try {
      raw = await req.json();
    } catch {
      // body rỗng hợp lệ — dùng limit mặc định.
    }
    const { limit } = ProcessSchema.parse(raw ?? {});
    const result = await processQueue(limit);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
