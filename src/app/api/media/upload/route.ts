import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MEDIA_UPLOAD_DIR,
  ensureMediaDir,
  generateMediaFilename,
  mediaRelativePath,
} from "@/lib/media";

const MetaSchema = z.object({
  source_type: z.enum(["camera", "upload", "robot", "tablet"]),
  device_id: z.string().optional(),
  project_id: z.string().optional(),
  person_id: z.string().optional(),
  access_level: z.coerce.number().int().min(0).max(4).default(3),
});

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return err("Thiếu file ảnh (field 'file')", 422);
    }
    if (!ALLOWED_IMAGE_MIME_TYPES[file.type]) {
      return err(`Định dạng ảnh không hỗ trợ: ${file.type || "unknown"}`, 422);
    }

    const meta = MetaSchema.parse({
      source_type: form.get("source_type") ?? undefined,
      device_id: form.get("device_id") ?? undefined,
      project_id: form.get("project_id") ?? undefined,
      person_id: form.get("person_id") ?? undefined,
      access_level: form.get("access_level") ?? undefined,
    });

    ensureMediaDir();
    const filename = generateMediaFilename(file.type);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(MEDIA_UPLOAD_DIR, filename), buffer);

    const originalName = file instanceof File ? file.name : filename;

    const media = await prisma.mediaFile.create({
      data: {
        filename,
        original_name: originalName,
        mime_type: file.type,
        size: buffer.length,
        path: mediaRelativePath(filename),
        source_type: meta.source_type,
        device_id: meta.device_id,
        project_id: meta.project_id,
        person_id: meta.person_id,
        access_level: meta.access_level,
      },
    });

    await log({
      action: "robot_camera_capture",
      entity: "MediaFile",
      entity_id: media.id,
      device_id: meta.device_id,
      payload: {
        source_type: meta.source_type,
        mime_type: media.mime_type,
        size: media.size,
      },
    });

    return ok(media, 201);
  } catch (e) {
    return handleError(e);
  }
}
