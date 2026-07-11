import { NextRequest, NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { deleteTempImage } from "@/lib/vision/temp-store";

export const dynamic = "force-dynamic";

// DELETE /api/robot/vision/temp/:id — nút "Remove image" ở /robot. CHỈ xoá
// nếu ảnh vẫn còn cờ temporary=true (deleteTempImage tự chặn xoá ảnh đã lưu
// vĩnh viễn, xem src/lib/vision/temp-store.ts).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteTempImage(params.id);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Không tìm thấy ảnh tạm để xoá (có thể đã hết hạn hoặc đã được lưu vĩnh viễn)." }, { status: 404 });
    }

    await log({ action: "robot.vision.temp.delete", entity: "MediaFile", entity_id: params.id, payload: {} });
    return NextResponse.json({ ok: true, deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
