import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { toJsonValue } from "@/lib/json";
import { getRobotDevice } from "@/lib/robot";

// Passthrough tương đương /api/devices/:id/events nhưng tự resolve robot device.
// ESP32 thật sau này có thể gọi endpoint này hoặc /api/devices/:id/events trực tiếp.
const EventSchema = z.object({
  event_type: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = EventSchema.parse(await req.json());

    const device = await getRobotDevice();
    if (!device) {
      return NextResponse.json(
        { ok: false, error: "Robot simulator chưa được khởi tạo. Chạy `npm run db:seed` trước." },
        { status: 404 }
      );
    }

    const event = await prisma.deviceEvent.create({
      data: {
        device_id: device.id,
        event_type: body.event_type,
        payload: toJsonValue(body.payload),
      },
    });

    await prisma.device.update({
      where: { id: device.id },
      data: { last_seen_at: new Date(), status: "online" },
    });

    await log({
      action: "robot.event",
      entity: "Device",
      entity_id: device.id,
      device_id: device.id,
      payload: { event_type: body.event_type },
    });

    return NextResponse.json(
      { ok: true, state: event, message: "Event đã ghi nhận." },
      { status: 201 }
    );
  } catch (e) {
    return handleError(e);
  }
}
