import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const IdentifySchema = z.object({
  face_embedding: z.array(z.number()).optional(),
  device_id: z.string().optional(),
  // raw_image intentionally NOT accepted
});

// POST /api/face/identify
// MVP stub: returns placeholder match. Real cosine similarity to be added later.
export async function POST(req: NextRequest) {
  try {
    const body = IdentifySchema.parse(await req.json());

    const profiles = await prisma.faceProfile.findMany({
      include: { person: { select: { id: true, name: true, alias: true, relation: true } } },
      where: { face_embedding: { not: Prisma.JsonNull } },
    });

    // MVP: no real vector comparison, return stub
    // TODO: implement cosine similarity when embedding model is chosen
    await log({
      action: "face.identify",
      entity: "FaceProfile",
      device_id: body.device_id,
      payload: { candidates: profiles.length },
    });

    return ok({
      identified: false,
      match: null,
      candidates: profiles.length,
      message: "Identify stub MVP. Cosine similarity chưa implement.",
      note: "POST với face_embedding để so sánh sau khi tích hợp model.",
    });
  } catch (e) {
    return handleError(e);
  }
}
