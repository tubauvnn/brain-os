import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { toJsonValue } from "@/lib/json";

const LogSchema = z.object({
  action: z.string().min(1),
  entity: z.string().optional(),
  entity_id: z.string().optional(),
  actor: z.string().default("system"),
  device_id: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  ip_address: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity");
    const entity_id = searchParams.get("entity_id");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    const logs = await prisma.activityLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(entity_id ? { entity_id } : {}),
      },
      orderBy: { created_at: "desc" },
      take: limit,
    });
    return ok(logs);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = LogSchema.parse(await req.json());
    const entry = await prisma.activityLog.create({
      data: { ...body, payload: toJsonValue(body.payload) },
    });
    return ok(entry, 201);
  } catch (e) {
    return handleError(e);
  }
}
