import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DeviceManager } from "@/lib/device";

export const dynamic = "force-dynamic";

const DEVICE_TYPES = ["robot", "camera", "speaker", "display", "esp32", "unknown"] as const;

const CommandSchema = z.object({
  deviceId: z.string().min(1).optional(),
  deviceType: z.enum(DEVICE_TYPES),
  command: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  timeoutMs: z.number().int().positive().optional(),
});

// POST /api/device-manager/command — gọi qua Device Manager (runtime
// orchestration). Route CHỈ validate input + gọi Device Manager + trả
// DeviceResult — không tự resolve device, không tự log (Device Manager làm
// tất cả). KHÔNG đụng tới Physical Device Registry (/api/devices).
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body phải là JSON hợp lệ." }, { status: 400 });
  }

  const parsed = CommandSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join(", ");
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }

  const result = await DeviceManager.execute(parsed.data);
  return NextResponse.json(result, { status: 200 });
}
