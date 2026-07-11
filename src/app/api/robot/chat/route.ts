import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { getRobotDevice } from "@/lib/robot";
import { ensureSession, countSessionMessages } from "@/lib/brain/session-context";
import { toJsonValue } from "@/lib/json";
import { runConversationAgent } from "@/lib/agent/conversation-agent";
import { checkLanguageGuard } from "@/lib/robot-ai/language-guard";
import { deriveRobotPresentation, type RobotPresentation } from "@/lib/robot-ai/presentation";
import { applyRobotPersonality } from "@/lib/robot-ai/personality";
import type { RobotChatResult, RobotProvider } from "@/lib/robot-ai/types";

// Phase 6A — /robot không còn tự trả lời qua local-skills.ts/demo-scenarios.ts
// (kịch bản gõ sẵn) hay openai-provider.ts (gọi thẳng OpenAI, bỏ qua Memory/
// Knowledge/Project Context). Route này giờ CHỈ là 1 client mỏng của Brain OS:
//
//   Robot UI → route này → Conversation Agent → Intent Resolver →
//   (Memory/Knowledge/Project Context cho chat, hoặc Task Orchestrator →
//   Robot Agent → Device Manager cho lệnh robot) → ConversationResult →
//   Robot Personality (giọng Chuối, xem robot-ai/personality.ts) → VoiceAgent
//
// Route CHỈ làm: validate input, chặn rác STT (language guard, không phải nội
// dung bịa), gọi Conversation Agent, dịch ConversationResult sang
// mood/action/eyes/mouth cho UI (deriveRobotPresentation — thuần presentation,
// không tạo nội dung trả lời), CHO CÂU TRẢ LỜI ĐI QUA Robot Personality trước
// khi trả về (field `reply` cuối cùng LUÔN đã qua lớp này — client chỉ đọc
// đúng field này để gửi sang VoiceAgent/ElevenLabs, không có đường nào khác),
// và lưu lịch sử hội thoại (ConversationMessage, dùng lại bởi chính
// Conversation Agent cho lượt hỏi tiếp theo trong cùng session).

const ChatSchema = z.object({
  message: z.string().min(1).max(2000).optional(),
  text: z.string().min(1).max(2000).optional(),
  content: z.string().min(1).max(2000).optional(),
  project_id: z.string().optional(),
  device_id: z.string().optional(),
  deviceId: z.string().optional(),
  access_level: z.number().int().min(0).max(4).optional(),
  accessLevel: z.number().int().min(0).max(4).optional(),
  sessionId: z.string().min(1).max(200).optional(),
  source: z.enum(["voice", "text"]).optional(),
  sttMode: z.enum(["browser", "openai"]).optional(),
  sttProvider: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  confidence: z.number().nullable().optional(),
});

const DEFAULT_ROBOT_DEVICE_ID = "dev-robot-simulator";
const DEFAULT_ACCESS_LEVEL = 3;

const FALLBACK_TEXT = "Chuối chưa kết nối được não Brain OS, bạn thử lại giúp mình nhé.";

// intent thật (chat/remember/recall_memory/robot_command/...) → RobotProvider
// hiển thị debug. Không có "openai" cứng cho mọi câu — chỉ chat/recall dùng
// Model Router (hiện là "openai"), robot_command/remember không gọi model.
function resolveProviderLabel(usedModel: boolean): RobotProvider {
  return usedModel ? "openai" : "local";
}

export async function POST(req: NextRequest) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Body phải là JSON hợp lệ." }, { status: 400 });
    }

    const body = ChatSchema.parse(json);
    const userText = body.message ?? body.text ?? body.content;
    if (!userText) {
      return NextResponse.json(
        { ok: false, error: "Thiếu nội dung tin nhắn: cần một trong các trường message, text hoặc content." },
        { status: 400 }
      );
    }

    const deviceId = body.deviceId ?? body.device_id ?? DEFAULT_ROBOT_DEVICE_ID;
    const accessLevel = body.accessLevel ?? body.access_level ?? DEFAULT_ACCESS_LEVEL;
    const source = body.source ?? "text";

    // Session best-effort: id do client tự sinh (localStorage), upsert trước
    // khi Conversation Agent dùng nó để load lịch sử (xem handleChat trong
    // conversation-agent.ts) và trước khi ConversationMessage dùng làm khoá ngoại.
    let sessionId: string | null = null;
    if (body.sessionId) {
      const ok = await ensureSession(body.sessionId);
      if (ok) sessionId = body.sessionId;
    }

    let device: Awaited<ReturnType<typeof getRobotDevice>> | null = null;
    try {
      device = await getRobotDevice(deviceId);
    } catch {
      device = null;
    }

    const userProvider =
      source === "voice" ? body.sttProvider || (body.sttMode === "browser" ? "browser_stt" : "openai_transcribe") : "manual";

    const startedAt = Date.now();

    // Language guard chạy TRƯỚC Conversation Agent — chặn rác STT (script lạ)
    // trước khi tốn round-trip Memory/Model, không phải nội dung trả lời bịa.
    const guarded = checkLanguageGuard(userText);
    const agentResult = guarded ? null : await runConversationAgent({ message: userText, source: "robot", sessionId: sessionId ?? undefined });
    const latencyMs = Date.now() - startedAt;

    const rawReply = guarded ? guarded.reply : agentResult?.reply ?? FALLBACK_TEXT;
    const intent = guarded ? "unknown" : agentResult?.intent ?? "unknown";
    const usedModel = !guarded && !!agentResult?.model;
    const presentation: RobotPresentation = guarded
      ? {
          mood: guarded.mood,
          action: guarded.action,
          eyes: guarded.eyes ?? "center",
          mouth: guarded.mouth ?? "idle",
          brainNote: "language guard",
        }
      : deriveRobotPresentation(intent, agentResult ?? { success: false, error: "Không gọi được Conversation Agent." });
    const provider: RobotProvider = guarded ? "local" : agentResult?.success ? resolveProviderLabel(usedModel) : "fallback";
    const errorText = guarded ? undefined : agentResult?.success ? undefined : agentResult?.error ?? "Xử lý thất bại.";

    // Robot Personality — LUÔN chạy trước khi trả lời (trừ language guard,
    // vốn đã là 1 câu cố định đúng giọng, viết tay riêng cho đúng tình huống
    // "nghe không rõ script lạ"). Chỉ đổi cách nói, không đổi sự thật — xem
    // src/lib/robot-ai/personality.ts.
    const reply = guarded
      ? rawReply
      : await applyRobotPersonality(rawReply, {
          userText,
          intent,
          command: typeof agentResult?.meta?.command === "string" ? agentResult.meta.command : undefined,
          subtype: typeof agentResult?.meta?.subtype === "string" ? agentResult.meta.subtype : undefined,
          detail: typeof agentResult?.meta?.detail === "string" ? agentResult.meta.detail : undefined,
          success: agentResult?.success ?? false,
        });

    let userMessageId: string | undefined;
    try {
      const userMessage = await prisma.conversationMessage.create({
        data: {
          role: "user",
          content: userText,
          source,
          provider: userProvider,
          metadata: toJsonValue({
            sessionId: body.sessionId ?? null,
            sttMode: body.sttMode ?? null,
            durationMs: body.durationMs ?? null,
            confidence: body.confidence ?? null,
            accessLevel,
          }),
          device_id: device?.id,
          project_id: body.project_id,
          session_id: sessionId ?? undefined,
        },
      });
      userMessageId = userMessage.id;
    } catch {
      // bỏ qua — không để lỗi lưu lịch sử làm hỏng response chat
    }

    let robotMessageId: string | undefined;
    let createdAt: Date | undefined;
    try {
      const robotMessage = await prisma.conversationMessage.create({
        data: {
          role: "robot",
          content: reply,
          provider,
          metadata: toJsonValue({
            intent,
            rawReply: rawReply !== reply ? rawReply : undefined,
            mood: presentation.mood,
            action: presentation.action,
            eyes: presentation.eyes,
            mouth: presentation.mouth,
            hardwareCommand: presentation.hardwareCommand,
            suggestedNextActions: presentation.suggestedNextActions,
            brainNote: presentation.brainNote,
            latencyMs,
          }),
          device_id: device?.id,
          project_id: body.project_id,
          session_id: sessionId ?? undefined,
        },
      });
      robotMessageId = robotMessage.id;
      createdAt = robotMessage.created_at;
    } catch {
      // bỏ qua — không để lỗi lưu lịch sử làm hỏng response chat
    }

    if (device) {
      await log({
        action: "robot.chat",
        entity: "Device",
        entity_id: device.id,
        device_id: device.id,
        payload: { user_text: userText, intent, access_level: accessLevel, session_id: sessionId, provider, reply, error: errorText },
      });
    }

    const sessionMessageCount = sessionId ? await countSessionMessages(sessionId) : null;

    const response: RobotChatResult & Record<string, unknown> = {
      ok: true,
      provider,
      model: agentResult?.model,
      reply,
      rawReply: rawReply !== reply ? rawReply : undefined,
      mood: presentation.mood,
      action: presentation.action,
      eyes: presentation.eyes,
      mouth: presentation.mouth,
      hardwareCommand: presentation.hardwareCommand,
      suggestedNextActions: presentation.suggestedNextActions,
      brainNote: presentation.brainNote,
      error: errorText,
      user_message_id: userMessageId,
      robot_message_id: robotMessageId,
      created_at: createdAt,
      session_id: sessionId,
      session_message_count: sessionMessageCount,
      latency_ms: latencyMs,
      intent,
    };

    return NextResponse.json(response);
  } catch (e) {
    return handleError(e);
  }
}
