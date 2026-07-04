import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  due_date: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const t = await prisma.task.findUnique({
      where: { id: params.id },
      include: { project: true, subtasks: true },
    });
    if (!t) return err("Không tìm thấy", 404);
    return ok(t);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = UpdateSchema.parse(await req.json());
    const t = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...body,
        due_date: body.due_date ? new Date(body.due_date) : body.due_date === null ? null : undefined,
      },
    });
    await log({ action: "task.update", entity: "Task", entity_id: params.id, payload: { status: t.status } });
    return ok(t);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await prisma.task.delete({ where: { id: params.id } });
    await log({ action: "task.delete", entity: "Task", entity_id: params.id });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
