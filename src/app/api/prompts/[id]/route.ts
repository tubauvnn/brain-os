import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  model: z.string().optional(),
  pinned: z.boolean().optional(),
  access_level: z.number().int().min(0).max(4).optional(),
});

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const p = await prisma.prompt.findUnique({ where: { id: params.id } });
    if (!p) return err("Không tìm thấy", 404);
    return ok(p);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = UpdateSchema.parse(await req.json());
    const p = await prisma.prompt.update({ where: { id: params.id }, data: body });
    await log({ action: "prompt.update", entity: "Prompt", entity_id: params.id });
    return ok(p);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await prisma.prompt.delete({ where: { id: params.id } });
    await log({ action: "prompt.delete", entity: "Prompt", entity_id: params.id });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
