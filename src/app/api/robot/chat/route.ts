import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/api";
import { log } from "@/lib/logger";
import { getRobotDevice } from "@/lib/robot";
import { askCliAgents } from "@/lib/brain/cli-agent-router";
import { SYSTEM_CONTEXT } from "@/lib/brain/system-context";
import { ensureSession, loadSessionHistoryText, countSessionMessages } from "@/lib/brain/session-context";
import { toJsonValue } from "@/lib/json";
import { matchLocalSkill } from "@/lib/robot-ai/local-skills";
import { askRobotOpenAI } from "@/lib/robot-ai/openai-provider";
import type { RobotAction, RobotChatResult, RobotMood, RobotMouth } from "@/lib/robot-ai/types";

const ChatSchema = z.object({
  message: z.string().min(1).max(2000).optional(),
  text: z.string().min(1).max(2000).optional(),
  content: z.string().min(1).max(2000).optional(),
  project_id: z.string().optional(),
  device_id: z.string().optional(),
  deviceId: z.string().optional(),
  access_level: z.number().int().min(0).max(4).optional(),
  accessLevel: z.number().int().min(0).max(4).optional(),
  // true = dùng CLI agent router (Codex/Claude/Gemini CLI, chậm hơn) thay vì
  // OpenAI API (nhanh, mặc định) — xem phiên 18 trong STATE.md.
  deep: z.boolean().optional(),
  // Phiên 21: session để robot nhớ ngữ cảnh trong cùng 1 cuộc hội thoại + debug info.
  sessionId: z.string().min(1).max(200).optional(),
  source: z.enum(["voice", "text"]).optional(),
  sttMode: z.enum(["browser", "openai"]).optional(),
  sttProvider: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  confidence: z.number().nullable().optional(),
});

const DEFAULT_ROBOT_DEVICE_ID = "dev-robot-simulator";
const DEFAULT_ACCESS_LEVEL = 3;
const MAX_TOTAL_CONTEXT_CHARS = 8000;
// "history tối đa 6 lượt" cho prompt OpenAI ~ 6 cặp user/robot = 12 dòng.
const OPENAI_HISTORY_LIMIT = 12;

const FALLBACK_TEXT = "Chuối chưa kết nối được não AI, nhưng phần điều khiển robot vẫn chạy.";

function combineContext(base: string, history: string): string {
  const combined = history ? `${base}\n\nLịch sử hội thoại gần đây (session hiện tại):\n${history}` : base;
  if (combined.length <= MAX_TOTAL_CONTEXT_CHARS) return combined;
  return `${combined.slice(0, MAX_TOTAL_CONTEXT_CHARS)}\n...(context bị cắt bớt, vượt giới hạn ${MAX_TOTAL_CONTEXT_CHARS} ký tự)`;
}

// CLI agent router (chế độ deep=true) vẫn chạy trên schema cũ (face/action, xem
// src/lib/brain/reply-schema.ts) — quy đổi best-effort sang mood/action/eyes/mouth
// mới để response luôn theo đúng 1 schema, không phá tính năng deep mode cũ.
const LEGACY_FACE_TO_MOOD: Record<string, RobotMood> = {
  idle: "idle",
  happy: "happy",
  thinking: "thinking",
  sad: "error",
};
const LEGACY_FACE_TO_MOUTH: Record<string, RobotMouth> = {
  idle: "idle",
  happy: "smile",
  thinking: "thinking",
  sad: "idle",
};
const LEGACY_ACTION_TO_ROBOT_ACTION: Record<string, RobotAction> = {
  none: "none",
  wave: "greet",
  nod: "smile",
};

type ResolvedReply = Omit<RobotChatResult, "ok">;

async function resolveReply(userText: string, context: string, deep: boolean): Promise<ResolvedReply> {
  const localMatch = matchLocalSkill(userText);
  if (localMatch) {
    const { ok: _ok, ...rest } = localMatch;
    return rest;
  }

  if (deep) {
    const cli = await askCliAgents(userText, context);
    return {
      provider: cli.provider,
      reply: cli.reply,
      mood: LEGACY_FACE_TO_MOOD[cli.face] ?? "idle",
      action: LEGACY_ACTION_TO_ROBOT_ACTION[cli.action] ?? "none",
      eyes: "center",
      mouth: LEGACY_FACE_TO_MOUTH[cli.face] ?? "idle",
      error: cli.errors.length > 0 ? cli.errors.join(" | ").slice(0, 500) : undefined,
    };
  }

  try {
    const openaiResult = await askRobotOpenAI(userText, context);
    return { ...openaiResult, provider: "openai" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định khi gọi OpenAI";
    return {
      provider: "fallback",
      reply: FALLBACK_TEXT,
      mood: "error",
      action: "none",
      eyes: "center",
      mouth: "idle",
      error: message,
    };
  }
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
    // accessLevel giữ lại trong schema để tương thích API / auth thật sau này —
    // context gửi cho AI hiện là SYSTEM_CONTEXT (+ lịch sử session), chưa lọc theo access_level.
    const accessLevel = body.accessLevel ?? body.access_level ?? DEFAULT_ACCESS_LEVEL;
    const source = body.source ?? "text";

    // Session là best-effort: id do client tự sinh (localStorage `robot_session_id`),
    // phải upsert trước khi dùng làm khoá ngoại cho ConversationMessage. Nếu tạo
    // thất bại (DB lỗi), coi như không có session — chat vẫn hoạt động bình thường,
    // chỉ mất phần nhớ ngữ cảnh + lưu lịch sử theo phiên.
    let sessionId: string | null = null;
    let historyText = "";
    if (body.sessionId) {
      const ok = await ensureSession(body.sessionId);
      if (ok) {
        sessionId = body.sessionId;
        historyText = await loadSessionHistoryText(sessionId, OPENAI_HISTORY_LIMIT);
      }
    }

    // DB (device) là best-effort — nếu lookup lỗi, vẫn lưu message được (chỉ
    // thiếu device_id), miễn Postgres còn sống. Không còn gate việc lưu theo
    // "phải có device" như trước, vì giờ session_id là khoá chính cho ngữ cảnh.
    let device: Awaited<ReturnType<typeof getRobotDevice>> | null = null;
    try {
      device = await getRobotDevice(deviceId);
    } catch {
      device = null;
    }

    // provider trên message user ghi rõ nguồn nhận dạng: "manual" (gõ tay),
    // "openai_transcribe"/"browser_stt" (voice, ưu tiên sttProvider client gửi
    // — cụ thể hơn — rồi mới suy từ sttMode nếu thiếu).
    const userProvider =
      source === "voice" ? body.sttProvider || (body.sttMode === "browser" ? "browser_stt" : "openai_transcribe") : "manual";

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

    const context = combineContext(SYSTEM_CONTEXT, historyText);
    const startedAt = Date.now();
    const result = await resolveReply(userText, context, body.deep === true);
    const latencyMs = Date.now() - startedAt;

    let robotMessageId: string | undefined;
    let createdAt: Date | undefined;
    try {
      const robotMessage = await prisma.conversationMessage.create({
        data: {
          role: "robot",
          content: result.reply,
          provider: result.provider,
          metadata: toJsonValue({
            mood: result.mood,
            action: result.action,
            eyes: result.eyes,
            mouth: result.mouth,
            hardwareCommand: result.hardwareCommand,
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
        payload: { user_text: userText, deep: body.deep === true, access_level: accessLevel, session_id: sessionId, ...result },
      });
    }

    const sessionMessageCount = sessionId ? await countSessionMessages(sessionId) : null;

    const response: RobotChatResult & Record<string, unknown> = {
      ok: true,
      provider: result.provider,
      model: result.model,
      reply: result.reply,
      mood: result.mood,
      action: result.action,
      eyes: result.eyes,
      mouth: result.mouth,
      hardwareCommand: result.hardwareCommand,
      error: result.error,
      user_message_id: userMessageId,
      robot_message_id: robotMessageId,
      created_at: createdAt,
      session_id: sessionId,
      session_message_count: sessionMessageCount,
      latency_ms: latencyMs,
    };

    return NextResponse.json(response);
  } catch (e) {
    return handleError(e);
  }
}
