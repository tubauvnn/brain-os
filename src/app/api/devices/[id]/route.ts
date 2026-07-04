import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { toJsonValue } from "@/lib/json";

const UpdateSchema = z.object({
  name: z.string().optional(),
  status: z.enum(["online", "offline", "idle", "error"]).optional(),
  ip_address: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  meta: z.record(z.unknown()).optional(),
});

type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const d = await prisma.device.findUnique({
      where: { id: params.id },
      include: { events: { take: 20, orderBy: { created_at: "desc" } } },
    });
    if (!d) return err("Không tìm thấy thiết bị", 404);
    return ok(d);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = UpdateSchema.parse(await req.json());
    const d = await prisma.device.update({
      where: { id: params.id },
      data: { ...body, meta: toJsonValue(body.meta), last_seen_at: new Date() },
    });
    return ok(d);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await prisma.device.delete({ where: { id: params.id } });
    await log({ action: "device.delete", entity: "Device", entity_id: params.id });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
