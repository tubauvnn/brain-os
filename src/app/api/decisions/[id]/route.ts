import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  rationale: z.string().optional(),
  outcome: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const d = await prisma.decision.findUnique({ where: { id: params.id }, include: { project: true } });
    if (!d) return err("Không tìm thấy", 404);
    return ok(d);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = UpdateSchema.parse(await req.json());
    const d = await prisma.decision.update({ where: { id: params.id }, data: body });
    await log({ action: "decision.update", entity: "Decision", entity_id: params.id });
    return ok(d);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await prisma.decision.delete({ where: { id: params.id } });
    await log({ action: "decision.delete", entity: "Decision", entity_id: params.id });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
