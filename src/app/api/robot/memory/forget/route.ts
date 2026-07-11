import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { deleteMemory, getMostRecentMemory } from "@/lib/memory";

export const dynamic = "force-dynamic";

const ForgetSchema = z.object({
  // memoryId tuỳ chọn — không truyền → xoá memory GẦN NHẤT vừa lưu (đồng nhất
  // hành vi với "Quên thông tin vừa lưu." qua chat, xem conversation-agent.ts
  // handleForgetMemory). Truyền memoryId → xoá đúng dòng đó (chỉ khi caller
  // biết chính xác id, không đoán/xoá hàng loạt).
  memoryId: z.string().min(1).optional(),
});

// POST /api/robot/memory/forget — Phase 6B mục 10, cùng chính sách "chỉ xoá
// đúng 1 dòng, luôn xác nhận" như chat. Không trả nguyên nội dung các memory
// khác còn lại (mục 11 — không rò rỉ dữ liệu ngoài phạm vi yêu cầu).
export async function POST(req: NextRequest) {
  try {
    let json: unknown = {};
    try {
      json = await req.json();
    } catch {
      // body rỗng hợp lệ (mặc định xoá memory gần nhất) — chỉ lỗi khi JSON sai cú pháp thật sự.
    }

    const body = ForgetSchema.parse(json);
    const target = body.memoryId ? { id: body.memoryId, title: undefined as string | undefined } : await getMostRecentMemory();

    if (!target) {
      return NextResponse.json({ ok: true, status: "empty", message: "Hiện chưa có gì để quên cả." });
    }

    const deleted = await deleteMemory(target.id);
    await log({
      action: "memory.delete",
      entity: "Memory",
      entity_id: target.id,
      payload: { success: !!deleted, source: "api" },
    });

    if (!deleted) {
      return NextResponse.json({ ok: false, status: "not_found", error: "Không tìm thấy memory để xoá." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, status: "deleted", memory: { id: deleted.id, title: deleted.title } });
  } catch (e) {
    return handleError(e);
  }
}
