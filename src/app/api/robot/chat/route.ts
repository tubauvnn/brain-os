import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { getRobotDevice } from "@/lib/robot";
import { generateRobotReply } from "@/lib/ai";

const ChatSchema = z.object({
  text: z.string().min(1).max(2000),
  project_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = ChatSchema.parse(await req.json());

    const device = await getRobotDevice();
    if (!device) {
      return NextResponse.json(
        { ok: false, error: "Robot simulator chưa được khởi tạo. Chạy `npm run db:seed` trước." },
        { status: 404 }
      );
    }

    const userMessage = await prisma.conversationMessage.create({
      data: {
        role: "user",
        content: body.text,
        device_id: device.id,
        project_id: body.project_id,
      },
    });

    // MVP: chưa có auth/session thật nên chưa xác định được "người hỏi" là ai.
    // accessLevel mặc định giữ ở mức thấp (1) để KHÔNG đưa PrivateMemory vào context
    // qua chat cho tới khi có auth thật gắn access_level theo user đăng nhập.
    const { text: replyText, provider, context_used, gemini_error } = await generateRobotReply(body.text, {
      deviceId: device.id,
      projectId: body.project_id,
      accessLevel: 1,
      limit: 5,
    });

    const robotMessage = await prisma.conversationMessage.create({
      data: {
        role: "robot",
        content: replyText,
        provider,
        device_id: device.id,
        project_id: body.project_id,
      },
    });

    await log({
      action: "robot.chat",
      entity: "Device",
      entity_id: device.id,
      device_id: device.id,
      payload: { user_text: body.text, reply: replyText, provider, context_used, gemini_error },
    });

    return NextResponse.json({
      ok: true,
      reply: replyText,
      provider,
      context_used,
      gemini_error,
      user_message_id: userMessage.id,
      robot_message_id: robotMessage.id,
      created_at: robotMessage.created_at,
    });
  } catch (e) {
    return handleError(e);
  }
}
