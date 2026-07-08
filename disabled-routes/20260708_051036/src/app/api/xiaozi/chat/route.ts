import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { verifyXiaoziWebhook, getClientIp, simpleRateLimit } from "@/lib/brain/webhook-auth";
import { handleXiaoziMessage } from "@/lib/brain/xiaozi-handler";

// Webhook backend cho Xiaozi/Xiaozhi (đã có voice/STT/TTS/template riêng).
// Brain OS ở đây theo mô hình template-first:
//   L0: template/skill có sẵn trên Xiaozi tự xử lý phần lớn câu.
//   L1: bridge nội bộ (xiaoziBridgeBrain) — chỉ nhóm liên quan Brain OS/ChinChin/iREC/lệnh robot.
//   L2: OpenAI — CHỈ gọi khi câu "phức tạp" (isComplexRequest) và ENABLE_OPENAI_FALLBACK=true.
// Không xử lý -> trả "xiaozi_template_first" để Xiaozi tự lo bằng template của nó.
// Logic xử lý chính nằm ở src/lib/brain/xiaozi-handler.ts (dùng chung với
// /v1/chat/completions, xem README trong file đó) — route này chỉ lo
// parse/validate body, auth, rate limit, rồi build response theo đúng hợp
// đồng cũ ({ok, reply, speak, robot_say, face, action, provider, ...}).
const ChatSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  message: z.string().min(1).max(2000).optional(),
  deviceId: z.string().min(1).max(200).optional(),
  sessionId: z.string().min(1).max(200).optional(),
  userId: z.string().min(1).max(200).optional(),
  accessLevel: z.number().int().min(0).max(4).optional(),
  intent: z.string().max(200).optional(),
  fromTemplate: z.boolean().optional(),
  meta: z.record(z.unknown()).optional(),
});

const DEFAULT_DEVICE_ID = "xiaozi-robot-1";
const DEFAULT_ACCESS_LEVEL = 3;

export async function POST(req: NextRequest) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Body phải là JSON hợp lệ." }, { status: 400 });
    }

    // Auth trước tiên — request local (curl từ chính VPS) luôn được cho qua để
    // test nội bộ; request public (qua domain) bắt buộc secret hợp lệ. Không
    // log secret ở bất kỳ đâu (kể cả khi từ chối).
    const rawBody = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
    const auth = verifyXiaoziWebhook(req, rawBody);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: "Unauthorized Xiaozi webhook" }, { status: 401 });
    }

    const body = ChatSchema.parse(json);
    const inputText = body.text || body.message;
    if (!inputText) {
      return NextResponse.json(
        { ok: false, error: "Thiếu nội dung: cần một trong hai trường text hoặc message." },
        { status: 400 }
      );
    }

    // Rate limit đơn giản in-memory — ưu tiên deviceId client tự khai (ổn định
    // hơn IP qua NAT/proxy), fallback IP nếu không có.
    const rateLimitKey = body.deviceId || getClientIp(req);
    if (!simpleRateLimit(rateLimitKey)) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    const deviceId = body.deviceId || DEFAULT_DEVICE_ID;
    const sessionId = body.sessionId || `xiaozi-${deviceId}`;
    const accessLevel = body.accessLevel ?? DEFAULT_ACCESS_LEVEL;

    const result = await handleXiaoziMessage({
      text: inputText,
      deviceId,
      sessionId,
      intent: body.intent,
      accessLevel,
      meta: body.meta,
    });

    return NextResponse.json({
      ok: true,
      reply: result.reply,
      speak: result.speak,
      robot_say: result.robot_say,
      face: result.face,
      action: result.action,
      provider: result.provider,
      sessionId: result.sessionId,
      deviceId: result.deviceId,
      latencyMs: result.latencyMs,
    });
  } catch (e) {
    return handleError(e);
  }
}
