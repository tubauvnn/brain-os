import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { getRobotDevice, getOrCreateRobotState } from "@/lib/robot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const device = await getRobotDevice();
    if (!device) {
      return NextResponse.json(
        { ok: false, error: "Robot simulator chưa được khởi tạo. Chạy `npm run db:seed` trước." },
        { status: 404 }
      );
    }

    const state = await getOrCreateRobotState(device.id);
    const [recent_events, recent_messages] = await Promise.all([
      prisma.deviceEvent.findMany({
        where: { device_id: device.id },
        orderBy: { created_at: "desc" },
        take: 20,
      }),
      prisma.conversationMessage.findMany({
        where: { device_id: device.id },
        orderBy: { created_at: "desc" },
        take: 30,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      state: {
        device_id: device.id,
        name: device.name,
        status: device.status,
        current_mode: state.mode,
        current_face: state.face,
        battery: state.battery,
        last_command: state.last_command,
        last_command_at: state.last_command_at,
      },
      recent_events,
      recent_messages: recent_messages.reverse(),
    });
  } catch (e) {
    return handleError(e);
  }
}
