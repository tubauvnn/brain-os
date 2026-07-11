import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { toJsonValue } from "@/lib/json";
import { getRobotDevice } from "@/lib/robot";

export const dynamic = "force-dynamic";

// POST /api/robot/voice/session — Phase 6I mục 12 "Conversation session".
// NGUỒN SỰ THẬT của phiên voice vẫn là localStorage phía client (giống hệt
// sessionId/autoSpeak/lịch sử chat đã làm từ Phase 6A — mục 12 "Survive
// browser refresh WITHOUT auto-starting the microphone" tự nhiên đúng luôn
// vì localStorage không tự bật mic khi đọc lại) — route này CHỈ ghi lại 1
// bản log phía server (DeviceEvent, cùng cơ chế "presence.*"/"social.*"/
// "brain.*" các phase trước) để có dấu vết cho DeviceManager thật sau này,
// KHÔNG phải nơi lưu trạng thái phiên thật, không chặn UI nếu lỗi.
const SessionSchema = z.object({
  sessionId: z.string().min(1).max(200),
  handsFreeEnabled: z.boolean().optional(),
  turn: z.number().int().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = SessionSchema.parse(await req.json());
    const device = await getRobotDevice();
    if (!device) {
      return NextResponse.json({ ok: false, error: "Robot simulator chưa được khởi tạo. Chạy `npm run db:seed` trước." }, { status: 404 });
    }

    const event = await prisma.deviceEvent.create({
      data: { device_id: device.id, event_type: "voice.session", payload: toJsonValue(body) },
    });

    return NextResponse.json({ ok: true, state: event, message: "Đã ghi nhận phiên voice." }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
