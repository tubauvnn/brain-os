import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { toJsonValue } from "@/lib/json";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  alias: z.string().optional(),
  relation: z.string().optional(),
  notes: z.string().optional(),
  contact: z.record(z.unknown()).optional(),
  access_level: z.number().int().min(0).max(4).optional(),
  tags: z.array(z.string()).optional(),
});

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const p = await prisma.people.findUnique({ where: { id: params.id }, include: { face_profile: true } });
    if (!p) return err("Không tìm thấy", 404);
    return ok(p);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = UpdateSchema.parse(await req.json());
    const p = await prisma.people.update({
      where: { id: params.id },
      data: { ...body, contact: toJsonValue(body.contact) },
    });
    await log({ action: "people.update", entity: "People", entity_id: params.id });
    return ok(p);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await prisma.people.delete({ where: { id: params.id } });
    await log({ action: "people.delete", entity: "People", entity_id: params.id });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
