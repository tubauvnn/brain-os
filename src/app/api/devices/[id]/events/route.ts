import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { toJsonValue } from "@/lib/json";

const EventSchema = z.object({
  event_type: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const device = await prisma.device.findUnique({ where: { id: params.id } });
    if (!device) return err("Thiết bị không tồn tại", 404);

    const body = EventSchema.parse(await req.json());
    const event = await prisma.deviceEvent.create({
      data: {
        device_id: params.id,
        event_type: body.event_type,
        payload: toJsonValue(body.payload),
      },
    });

    // Update last seen
    await prisma.device.update({
      where: { id: params.id },
      data: { last_seen_at: new Date(), status: "online" },
    });

    return ok(event, 201);
  } catch (e) {
    return handleError(e);
  }
}

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const events = await prisma.deviceEvent.findMany({
      where: { device_id: params.id },
      orderBy: { created_at: "desc" },
      take: 50,
    });
    return ok(events);
  } catch (e) {
    return handleError(e);
  }
}
