import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const CreateSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  category: z.string().default("general"),
  access_level: z.number().int().min(0).max(4).default(1),
  source: z.string().optional(),
  project_id: z.string().optional(),
  pinned: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get("project_id");
    const category = searchParams.get("category");
    const tag = searchParams.get("tag");

    const memories = await prisma.memory.findMany({
      where: {
        ...(project_id ? { project_id } : {}),
        ...(category ? { category } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
      },
      orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
      include: { project: true },
    });
    return ok(memories);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    const memory = await prisma.memory.create({ data: body });
    await log({ action: "memory.create", entity: "Memory", entity_id: memory.id });
    return ok(memory, 201);
  } catch (e) {
    return handleError(e);
  }
}
