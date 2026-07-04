import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const CreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
  color: z.string().default("#6366f1"),
  icon: z.string().optional(),
  pinned: z.boolean().default(false),
});

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
      include: { _count: { select: { tasks: true, memories: true } } },
    });
    return ok(projects);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    const project = await prisma.project.create({ data: body });
    await log({ action: "project.create", entity: "Project", entity_id: project.id });
    return ok(project, 201);
  } catch (e) {
    return handleError(e);
  }
}
