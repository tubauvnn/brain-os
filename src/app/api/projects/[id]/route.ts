import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
  color: z.string().optional(),
  pinned: z.boolean().optional(),
});

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const p = await prisma.project.findUnique({
      where: { id: params.id },
      include: { tasks: true, decisions: true, _count: { select: { memories: true } } },
    });
    if (!p) return err("Không tìm thấy", 404);
    return ok(p);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = UpdateSchema.parse(await req.json());
    const p = await prisma.project.update({ where: { id: params.id }, data: body });
    await log({ action: "project.update", entity: "Project", entity_id: params.id });
    return ok(p);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await prisma.project.delete({ where: { id: params.id } });
    await log({ action: "project.delete", entity: "Project", entity_id: params.id });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
