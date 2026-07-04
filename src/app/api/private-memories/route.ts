import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const CreateSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  category: z.string().default("vault"),
  access_level: z.number().int().min(3).max(4).default(3),
  encrypted: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const items = await prisma.privateMemory.findMany({
      where: category ? { category } : {},
      orderBy: { created_at: "desc" },
    });
    return ok(items);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    const item = await prisma.privateMemory.create({ data: body });
    await log({ action: "private_memory.create", entity: "PrivateMemory", entity_id: item.id });
    return ok(item, 201);
  } catch (e) {
    return handleError(e);
  }
}
