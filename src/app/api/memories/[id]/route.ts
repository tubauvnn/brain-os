import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  access_level: z.number().int().min(0).max(4).optional(),
  pinned: z.boolean().optional(),
});

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const m = await prisma.memory.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!m) return err("Không tìm thấy", 404);
    return ok(m);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = UpdateSchema.parse(await req.json());
    const m = await prisma.memory.update({ where: { id: params.id }, data: body });
    await log({ action: "memory.update", entity: "Memory", entity_id: params.id });
    return ok(m);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await prisma.memory.delete({ where: { id: params.id } });
    await log({ action: "memory.delete", entity: "Memory", entity_id: params.id });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
