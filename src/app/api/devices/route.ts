import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { toJsonValue } from "@/lib/json";
import { randomBytes } from "crypto";

const CreateSchema = z.object({
  name: z.string().min(1),
  device_type: z.enum(["robot", "laptop", "camera", "tv", "esp32", "browser", "other"]),
  description: z.string().optional(),
  ip_address: z.string().optional(),
  mac_address: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  meta: z.record(z.unknown()).optional(),
});

export async function GET() {
  try {
    const devices = await prisma.device.findMany({
      orderBy: { updated_at: "desc" },
      include: { _count: { select: { events: true } } },
    });
    return ok(devices);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = CreateSchema.parse(await req.json());
    const token = randomBytes(32).toString("hex");
    const device = await prisma.device.create({
      data: { ...body, meta: toJsonValue(body.meta), token },
    });
    await log({ action: "device.register", entity: "Device", entity_id: device.id });
    return ok({ ...device, token }, 201);
  } catch (e) {
    return handleError(e);
  }
}
