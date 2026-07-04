import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const EnrollSchema = z.object({
  person_id: z.string().min(1),
  face_embedding: z.array(z.number()).optional(),
  notes: z.string().optional(),
  // store_raw intentionally NOT accepted — hardcoded false per privacy decision
});

// POST /api/face/enroll
// Enrolls a face embedding for a person. Does NOT store raw images.
export async function POST(req: NextRequest) {
  try {
    const body = EnrollSchema.parse(await req.json());

    const person = await prisma.people.findUnique({ where: { id: body.person_id } });
    if (!person) return err("Người quen không tồn tại", 404);

    const profile = await prisma.faceProfile.upsert({
      where: { person_id: body.person_id },
      update: {
        face_embedding: body.face_embedding ?? Prisma.JsonNull,
        enrolled_at: new Date(),
        notes: body.notes,
        store_raw: false,
      },
      create: {
        person_id: body.person_id,
        face_embedding: body.face_embedding ?? Prisma.JsonNull,
        enrolled_at: new Date(),
        notes: body.notes,
        store_raw: false,
      },
    });

    await log({ action: "face.enroll", entity: "FaceProfile", entity_id: profile.id });

    return ok({
      person_id: body.person_id,
      enrolled: true,
      has_embedding: !!body.face_embedding,
      store_raw: false,
      message: "Đã enroll. Không lưu ảnh gốc.",
    }, 201);
  } catch (e) {
    return handleError(e);
  }
}
