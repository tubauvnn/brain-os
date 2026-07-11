import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { createTempImage, sweepExpiredTempImages } from "@/lib/vision/temp-store";
import { ALLOWED_IMAGE_MIME_TYPES } from "@/lib/media";

export const dynamic = "force-dynamic";

const MetaSchema = z.object({
  captureOrigin: z.enum(["camera", "upload"]).default("upload"),
  sessionId: z.string().min(1).max(200).optional(),
});

// POST /api/robot/vision/upload — Phase 6C mục 11. Nhận 1 ảnh (webcam
// snapshot hoặc file upload từ /robot), lưu TẠM (không phải vĩnh viễn — xem
// src/lib/vision/temp-store.ts, tự hết hạn sau ROBOT_VISION_RETENTION_MS).
// Không dùng lại /api/media/upload trực tiếp vì route đó không gắn cờ
// temporary/expiresAt cần cho vòng đời ảnh vision tạm — nhưng DÙNG CHUNG toàn
// bộ storage bên dưới (uploads/media/, bảng MediaFile) qua temp-store.ts.
export async function POST(req: NextRequest) {
  try {
    await sweepExpiredTempImages();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "Thiếu file ảnh (field 'file')." }, { status: 422 });
    }
    if (!ALLOWED_IMAGE_MIME_TYPES[file.type]) {
      return NextResponse.json({ ok: false, error: `Định dạng ảnh không hỗ trợ: ${file.type || "unknown"}. Chỉ nhận JPG/PNG/WEBP.` }, { status: 422 });
    }

    const meta = MetaSchema.parse({
      captureOrigin: form.get("captureOrigin") ?? undefined,
      sessionId: form.get("sessionId") ?? undefined,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalName = file instanceof File ? file.name : "capture";

    let record;
    try {
      record = await createTempImage({
        buffer,
        mimeType: file.type,
        originalName,
        captureOrigin: meta.captureOrigin,
        sessionId: meta.sessionId,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Không lưu được ảnh.";
      return NextResponse.json({ ok: false, error: message }, { status: 422 });
    }

    await log({
      action: "robot.vision.upload",
      entity: "MediaFile",
      entity_id: record.id,
      payload: { captureOrigin: meta.captureOrigin, size: buffer.length, mimeType: file.type },
    });

    return NextResponse.json({ ok: true, imageId: record.id, expiresAt: record.expiresAt }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
