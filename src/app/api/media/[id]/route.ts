import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const media = await prisma.mediaFile.findUnique({ where: { id: params.id } });
    if (!media) return err("Không tìm thấy media", 404);
    return ok(media);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    const media = await prisma.mediaFile.findUnique({ where: { id: params.id } });
    if (!media) return err("Không tìm thấy media", 404);

    try {
      fs.unlinkSync(path.join(process.cwd(), media.path));
    } catch {
      // File đã mất/không tồn tại — vẫn tiếp tục xoá record.
    }

    await prisma.mediaFile.delete({ where: { id: params.id } });
    await log({
      action: "media.delete",
      entity: "MediaFile",
      entity_id: params.id,
      payload: { filename: media.filename },
    });

    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
