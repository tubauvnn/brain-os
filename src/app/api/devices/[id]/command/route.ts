import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, handleError } from "@/lib/api";
import { log } from "@/lib/logger";

const CommandSchema = z.object({
  command: z.string().min(1),
  args: z.record(z.unknown()).optional(),
  timeout_ms: z.number().int().default(5000),
});

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const device = await prisma.device.findUnique({ where: { id: params.id } });
    if (!device) return err("Thiết bị không tồn tại", 404);

    const body = CommandSchema.parse(await req.json());

    // Log command as event
    const event = await prisma.deviceEvent.create({
      data: {
        device_id: params.id,
        event_type: "command",
        payload: {
          command: body.command,
          args: body.args ?? null,
          timeout_ms: body.timeout_ms,
        } as Prisma.InputJsonValue,
      },
    });

    await log({
      action: "device.command",
      entity: "Device",
      entity_id: params.id,
      payload: { command: body.command },
    });

    // MVP: command is queued, not executed in real-time
    // Future: push via WebSocket/MQTT to actual device
    return ok({
      event_id: event.id,
      device_id: params.id,
      command: body.command,
      status: "queued",
      message: "Lệnh đã ghi nhận. Thiết bị sẽ xử lý khi kết nối.",
    }, 202);
  } catch (e) {
    return handleError(e);
  }
}
