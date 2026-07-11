import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { rememberIfSafe } from "@/lib/memory";

export const dynamic = "force-dynamic";

const RememberSchema = z.object({
  content: z.string().min(1).max(2000),
});

// POST /api/robot/memory/remember — Phase 6B mục 10. Lối vào TRỰC TIẾP cùng
// chính sách "remember" mà chat dùng (rememberIfSafe(), src/lib/memory/) —
// không viết lại logic ghi nhớ ở đây, không tạo hệ thống memory thứ 2. Dùng
// khi 1 client khác (không phải /robot chat) cần ghi nhớ mà không qua NLU
// (vd tool nội bộ, script). Trả về đủ để caller biết chuyện gì đã xảy ra,
// không trả nguyên object Memory (giữ tối giản, tránh rò rỉ field thừa).
export async function POST(req: NextRequest) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Body phải là JSON hợp lệ." }, { status: 400 });
    }

    const body = RememberSchema.parse(json);
    const outcome = await rememberIfSafe(body.content, "api:robot/memory/remember");

    if (outcome.status === "refused") {
      await log({ action: "memory.write.refused", entity: "Memory", payload: { reason: "looks_like_secret" } });
      return NextResponse.json({ ok: true, status: "refused", reason: "Nội dung giống thông tin nhạy cảm, không lưu." });
    }

    await log({
      action: outcome.status === "duplicate" ? "memory.write.duplicate" : "memory.write",
      entity: "Memory",
      entity_id: outcome.item.id,
      payload: { category: outcome.category, source: "api" },
    });

    return NextResponse.json({
      ok: true,
      status: outcome.status,
      memory: { id: outcome.item.id, title: outcome.item.title, category: outcome.category },
    });
  } catch (e) {
    return handleError(e);
  }
}
