import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { toJsonValue } from "@/lib/json";
import { getRobotDevice } from "@/lib/robot";

export const dynamic = "force-dynamic";

// POST /api/robot/voice/interrupt — Phase 6I mục 5 "Barge-in". QUAN TRỌNG:
// việc DỪNG ÂM THANH THẬT xảy ra hoàn toàn phía client (audio.pause()/
// window.speechSynthesis.cancel(), đồng bộ, tức thì — mục "Target browser
// interruption latency: under 250ms") TRƯỚC KHI gọi route này. Route này
// KHÔNG phải cơ chế ngắt — chỉ ghi log best-effort (DeviceEvent) sau khi đã
// ngắt xong, y hệt logSocialAction/logBrainAction các phase trước
// (fire-and-forget, lỗi mạng không ảnh hưởng trải nghiệm).
const InterruptSchema = z.object({
  sessionId: z.string().min(1).max(200),
  reason: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = InterruptSchema.parse(await req.json());
    const device = await getRobotDevice();
    if (!device) {
      return NextResponse.json({ ok: false, error: "Robot simulator chưa được khởi tạo. Chạy `npm run db:seed` trước." }, { status: 404 });
    }

    const event = await prisma.deviceEvent.create({
      data: { device_id: device.id, event_type: "voice.interrupt", payload: toJsonValue(body) },
    });

    return NextResponse.json({ ok: true, state: event, message: "Đã ghi nhận barge-in." }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
