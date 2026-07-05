import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { getRobotDevice } from "@/lib/robot";
import { askOpenAI } from "@/lib/brain/openai-provider";
import { SYSTEM_CONTEXT } from "@/lib/brain/system-context";
import { FALLBACK_REPLY } from "@/lib/brain/reply-schema";
import { ensureSession, loadSessionHistoryText } from "@/lib/brain/session-context";
import { xiaoziBridgeBrain } from "@/lib/brain/xiaozi-bridge-brain";
import { isComplexRequest } from "@/lib/brain/complexity";
import { toJsonValue } from "@/lib/json";
import { verifyXiaoziWebhook, getClientIp, simpleRateLimit } from "@/lib/brain/webhook-auth";

// Webhook backend cho Xiaozi/Xiaozhi (đã có voice/STT/TTS/template riêng).
// Brain OS ở đây theo mô hình template-first:
//   L0: template/skill có sẵn trên Xiaozi tự xử lý phần lớn câu.
//   L1: bridge nội bộ (xiaoziBridgeBrain) — chỉ nhóm liên quan Brain OS/ChinChin/iREC/lệnh robot.
//   L2: OpenAI — CHỈ gọi khi câu "phức tạp" (isComplexRequest) và ENABLE_OPENAI_FALLBACK=true.
// Không xử lý -> trả "xiaozi_template_first" để Xiaozi tự lo bằng template của nó.
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
const MAX_TOTAL_CONTEXT_CHARS = 8000;
const HISTORY_LIMIT = 20;

function combineContext(base: string, history: string): string {
  const combined = history ? `${base}\n\nLịch sử hội thoại gần đây (session hiện tại):\n${history}` : base;
  if (combined.length <= MAX_TOTAL_CONTEXT_CHARS) return combined;
  return `${combined.slice(0, MAX_TOTAL_CONTEXT_CHARS)}\n...(context bị cắt bớt, vượt giới hạn ${MAX_TOTAL_CONTEXT_CHARS} ký tự)`;
}

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

    const startedAt = Date.now();
    const deviceId = body.deviceId || DEFAULT_DEVICE_ID;
    const sessionId = body.sessionId || `xiaozi-${deviceId}`;
    const accessLevel = body.accessLevel ?? DEFAULT_ACCESS_LEVEL;

    // Session/device là best-effort — Xiaozi gửi id tự do (không chắc đã tồn tại
    // trong DB), lỗi ở bước này không được làm hỏng chat.
    const sessionReady = await ensureSession(sessionId);

    let device: Awaited<ReturnType<typeof getRobotDevice>> | null = null;
    try {
      device = await getRobotDevice(deviceId);
    } catch {
      device = null;
    }

    // Lấy câu user nói gần nhất trong phiên (trước khi lưu câu hiện tại) để trả
    // lời được nhóm "tao vừa nói gì" trong bridge nội bộ.
    let previousUserText = "";
    if (sessionReady) {
      try {
        const prevMsg = await prisma.conversationMessage.findFirst({
          where: { session_id: sessionId, role: "user" },
          orderBy: { created_at: "desc" },
          select: { content: true },
        });
        previousUserText = prevMsg?.content ?? "";
      } catch {
        previousUserText = "";
      }
    }

    try {
      await prisma.conversationMessage.create({
        data: {
          role: "user",
          content: inputText,
          source: "xiaozi",
          provider: "xiaozi",
          metadata: toJsonValue({
            deviceId,
            sessionId,
            intent: body.intent ?? null,
            accessLevel,
            meta: body.meta ?? null,
          }),
          device_id: device?.id,
          session_id: sessionReady ? sessionId : undefined,
        },
      });
    } catch {
      // bỏ qua — không để lỗi lưu lịch sử làm hỏng response chat
    }

    const bridgeResult = xiaoziBridgeBrain({
      text: inputText,
      deviceId,
      sessionId,
      intent: body.intent,
      accessLevel,
      meta: { ...(body.meta ?? {}), previousUserText },
    });

    type FinalResult = {
      reply: string;
      speak: string;
      robot_say: string;
      face: string;
      action: string;
      provider: string;
    };

    let result: FinalResult;
    let complex = false;

    if (bridgeResult.matched) {
      result = bridgeResult;
    } else {
      complex = isComplexRequest(inputText);
      const openaiEnabled = process.env.ENABLE_OPENAI_FALLBACK === "true";

      if (complex && openaiEnabled) {
        try {
          const historyText = sessionReady ? await loadSessionHistoryText(sessionId, HISTORY_LIMIT) : "";
          const context = combineContext(SYSTEM_CONTEXT, historyText);
          const openaiReply = await askOpenAI(inputText, context);
          result = { ...openaiReply, speak: openaiReply.robot_say, provider: "openai" };
        } catch (e) {
          const message = e instanceof Error ? e.message : "Lỗi không xác định khi gọi OpenAI";
          result = {
            reply: FALLBACK_REPLY.reply,
            speak: FALLBACK_REPLY.robot_say,
            robot_say: FALLBACK_REPLY.robot_say,
            face: FALLBACK_REPLY.face,
            action: FALLBACK_REPLY.action,
            provider: "fallback",
          };
          // Không log/in API key — chỉ log message lỗi ngắn.
          await log({
            action: "xiaozi.openai_error",
            payload: { error: message.slice(0, 300) },
          });
        }
      } else if (complex && !openaiEnabled) {
        result = {
          reply: "Việc này cần não nâng cao, hiện tôi chưa bật OpenAI.",
          speak: "Việc này cần não nâng cao, hiện tôi chưa bật OpenAI.",
          robot_say: "Việc này cần não nâng cao, hiện tôi chưa bật OpenAI.",
          face: "sad",
          action: "none",
          provider: "fallback_complex_disabled",
        };
      } else {
        result = {
          reply: "No Brain OS action required.",
          speak: "Câu này Xiaozi có thể xử lý bằng mẫu sẵn.",
          robot_say: "Câu này Xiaozi có thể xử lý bằng mẫu sẵn.",
          face: "idle",
          action: "none",
          provider: "xiaozi_template_first",
        };
      }
    }

    const latencyMs = Date.now() - startedAt;

    try {
      await prisma.conversationMessage.create({
        data: {
          role: "robot",
          content: result.reply,
          source: "xiaozi",
          provider: result.provider,
          metadata: toJsonValue({
            robot_say: result.robot_say,
            face: result.face,
            action: result.action,
            matched: bridgeResult.matched,
            complex,
            latencyMs,
          }),
          device_id: device?.id,
          session_id: sessionReady ? sessionId : undefined,
        },
      });
    } catch {
      // bỏ qua — không để lỗi lưu lịch sử làm hỏng response chat
    }

    if (device) {
      await log({
        action: "xiaozi.chat",
        entity: "Device",
        entity_id: device.id,
        device_id: device.id,
        payload: { input_text: inputText, provider: result.provider, session_id: sessionId, access_level: accessLevel },
      });
    }

    return NextResponse.json({
      ok: true,
      reply: result.reply,
      speak: result.speak,
      robot_say: result.robot_say,
      face: result.face,
      action: result.action,
      provider: result.provider,
      sessionId,
      deviceId,
      latencyMs,
    });
  } catch (e) {
    return handleError(e);
  }
}
