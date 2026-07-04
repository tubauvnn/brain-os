import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const CreateSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().optional(),
  outcome: z.string().optional(),
  status: z.string().default("active"),
  project_id: z.string().optional(),
  tags: z.array(z.string()).default([]),
  decided_at: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get("project_id");
    const decisions = await prisma.decision.findMany({
      where: project_id ? { project_id } : {},
      orderBy: { decided_at: "desc" },
      include: { project: true },
    });
    return ok(decisions);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    const d = await prisma.decision.create({
      data: { ...body, decided_at: body.decided_at ? new Date(body.decided_at) : new Date() },
    });
    await log({ action: "decision.create", entity: "Decision", entity_id: d.id });
    return ok(d, 201);
  } catch (e) {
    return handleError(e);
  }
}
