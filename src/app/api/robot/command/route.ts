import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { toJsonValue } from "@/lib/json";
import { ROBOT_COMMANDS, applyRobotCommand, getRobotDevice, getOrCreateRobotState } from "@/lib/robot";

const CommandSchema = z.object({
  command: z.enum(ROBOT_COMMANDS),
  payload: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = CommandSchema.parse(await req.json());

    const device = await getRobotDevice();
    if (!device) {
      return NextResponse.json(
        { ok: false, error: "Robot simulator chưa được khởi tạo. Chạy `npm run db:seed` trước." },
        { status: 404 }
      );
    }

    const current = await getOrCreateRobotState(device.id);
    const result = applyRobotCommand(body.command, body.payload, {
      battery: current.battery,
      face: current.face,
    });

    const updated = await prisma.robotState.update({
      where: { device_id: device.id },
      data: {
        mode: result.mode,
        face: result.face,
        battery: result.battery,
        last_command: body.command,
        last_command_at: new Date(),
      },
    });

    // Ghi lại event trên chính Device model hiện có — robot chỉ là 1 Device.
    await prisma.deviceEvent.create({
      data: {
        device_id: device.id,
        event_type: "robot_command",
        payload: toJsonValue({
          command: body.command,
          payload: body.payload,
          message: result.message,
        }),
      },
    });

    await log({
      action: "robot.command",
      entity: "Device",
      entity_id: device.id,
      device_id: device.id,
      payload: { command: body.command, message: result.message },
    });

    return NextResponse.json({
      ok: true,
      state: {
        device_id: device.id,
        name: device.name,
        status: device.status,
        current_mode: updated.mode,
        current_face: updated.face,
        battery: updated.battery,
        last_command: updated.last_command,
        last_command_at: updated.last_command_at,
      },
      message: result.message,
    });
  } catch (e) {
    return handleError(e);
  }
}
