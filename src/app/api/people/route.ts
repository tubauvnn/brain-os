import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { toJsonValue } from "@/lib/json";

const CreateSchema = z.object({
  name: z.string().min(1),
  alias: z.string().optional(),
  relation: z.string().optional(),
  notes: z.string().optional(),
  contact: z.record(z.unknown()).optional(),
  access_level: z.number().int().min(0).max(4).default(2),
  tags: z.array(z.string()).default([]),
});

export async function GET() {
  try {
    const people = await prisma.people.findMany({
      orderBy: { name: "asc" },
      include: { face_profile: true },
    });
    return ok(people);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    const person = await prisma.people.create({
      data: { ...body, contact: toJsonValue(body.contact) },
    });
    await log({ action: "people.create", entity: "People", entity_id: person.id });
    return ok(person, 201);
  } catch (e) {
    return handleError(e);
  }
}
