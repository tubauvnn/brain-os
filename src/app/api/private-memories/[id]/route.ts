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
  access_level: z.number().int().min(3).max(4).optional(),
  encrypted: z.boolean().optional(),
});

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const m = await prisma.privateMemory.findUnique({ where: { id: params.id } });
    if (!m) return err("Không tìm thấy", 404);
    return ok(m);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = UpdateSchema.parse(await req.json());
    const m = await prisma.privateMemory.update({ where: { id: params.id }, data: body });
    await log({ action: "private_memory.update", entity: "PrivateMemory", entity_id: params.id });
    return ok(m);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await prisma.privateMemory.delete({ where: { id: params.id } });
    await log({ action: "private_memory.delete", entity: "PrivateMemory", entity_id: params.id });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
