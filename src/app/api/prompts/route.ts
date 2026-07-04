import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const CreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.string().default("general"),
  tags: z.array(z.string()).default([]),
  model: z.string().optional(),
  pinned: z.boolean().default(false),
  access_level: z.number().int().min(0).max(4).default(1),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const prompts = await prisma.prompt.findMany({
      where: category ? { category } : {},
      orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
    });
    return ok(prompts);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    const prompt = await prisma.prompt.create({ data: body });
    await log({ action: "prompt.create", entity: "Prompt", entity_id: prompt.id });
    return ok(prompt, 201);
  } catch (e) {
    return handleError(e);
  }
}
