import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { getTempImage, sweepExpiredTempImages } from "@/lib/vision/temp-store";
import { VISION_MODES, type VisionMode } from "@/lib/vision";
import { analyzeRobotVision } from "@/lib/robot-ai/vision-handler";

export const dynamic = "force-dynamic";

const AnalyzeSchema = z.object({
  imageId: z.string().min(1),
  prompt: z.string().max(2000).optional(),
  mode: z.enum(VISION_MODES as [VisionMode, ...VisionMode[]]).optional(),
  sessionId: z.string().min(1).max(200).optional(),
});

// POST /api/robot/vision/analyze — Phase 6C. Luồng:
//   ảnh (imageId, đã upload trước qua /api/robot/vision/upload) →
//   Vision Provider → RobotAgent (src/lib/robot-ai/vision-handler.ts, gộp
//   Memory/Project Context/Robot Personality/VoiceAgent) → JSON trả về theo
//   đúng schema Phase 6C mục 6.
export async function POST(req: NextRequest) {
  try {
    await sweepExpiredTempImages();

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Body phải là JSON hợp lệ." }, { status: 400 });
    }

    const body = AnalyzeSchema.parse(json);
    const image = await getTempImage(body.imageId);
    if (!image) {
      return NextResponse.json(
        { ok: false, error: "Không tìm thấy ảnh (có thể đã hết hạn) — gửi lại ảnh giúp mình nhé." },
        { status: 404 }
      );
    }

    const output = await analyzeRobotVision({
      image,
      prompt: body.prompt,
      mode: body.mode,
      sessionId: body.sessionId,
    });

    await log({
      action: "robot.vision.analyze",
      entity: "MediaFile",
      entity_id: image.id,
      payload: { visionMode: output.visionMode, imageStored: output.imageStored, hasError: !!output.error },
    });

    return NextResponse.json({ ok: true, ...output });
  } catch (e) {
    return handleError(e);
  }
}
