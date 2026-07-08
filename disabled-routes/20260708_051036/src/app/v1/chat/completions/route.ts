import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { verifyXiaoziWebhook, simpleRateLimit } from "@/lib/brain/webhook-auth";
import { handleXiaoziMessage } from "@/lib/brain/xiaozi-handler";

// Bridge OpenAI-compatible cho Xiaozi/Xiaozhi — nhiều app Xiaozhi chỉ cho nhập
// "Base URL / API Key / Model" kiểu OpenAI, không có chỗ nhập header/body tuỳ
// biến như /api/xiaozi/chat. Endpoint này giả lập đúng hợp đồng
// `POST /v1/chat/completions` của OpenAI nhưng bên trong gọi lại chung
// `handleXiaoziMessage()` (xem src/lib/brain/xiaozi-handler.ts) — không xử lý
// AI thật ở đây, chỉ chuyển đổi request/response cho khớp format.
const DEVICE_ID = "xiaozhi-openai-compatible";
const SESSION_ID = `openai-compatible-${DEVICE_ID}`;
const DEFAULT_MODEL = "brainos-local";
const DEFAULT_ACCESS_LEVEL = 3;

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const CompletionSchema = z.object({
  model: z.string().optional(),
  messages: z.array(MessageSchema).min(1),
  stream: z.boolean().optional(),
});

function openaiError(message: string, type: string, status: number) {
  return NextResponse.json({ error: { message, type } }, { status });
}

function sseChunk(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return openaiError("Body phải là JSON hợp lệ.", "invalid_request_error", 400);
  }

  // Auth dùng lại đúng logic webhook Xiaozi (XIAOZI_WEBHOOK_SECRET, Bearer
  // hoặc x-brainos-secret, local bypass để test nội bộ) — chỉ đổi hình dạng
  // lỗi trả về cho khớp convention OpenAI. Không log secret.
  const rawBody = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  const auth = verifyXiaoziWebhook(req, rawBody);
  if (!auth.ok) {
    return openaiError("Unauthorized Brain OS compatible API", "unauthorized", 401);
  }

  const parsed = CompletionSchema.safeParse(json);
  if (!parsed.success) {
    return openaiError("Body không hợp lệ: cần field `messages` (mảng, ít nhất 1 phần tử).", "invalid_request_error", 400);
  }
  const body = parsed.data;

  const lastUserMessage = [...body.messages].reverse().find((m) => m.role === "user");
  if (!lastUserMessage || !lastUserMessage.content.trim()) {
    return openaiError("Không tìm thấy tin nhắn role=\"user\" nào trong `messages`.", "invalid_request_error", 400);
  }

  // Rate limit dùng chung 1 bucket cho mọi client OpenAI-compatible gọi vào
  // đây (deviceId cố định, xem ghi chú DEVICE_ID phía trên) — nếu sau này có
  // nhiều thiết bị Xiaozhi cùng dùng cầu nối này, cân nhắc đổi key theo IP.
  if (!simpleRateLimit(DEVICE_ID)) {
    return openaiError("Too many requests", "rate_limit_exceeded", 429);
  }

  const model = body.model || DEFAULT_MODEL;

  const result = await handleXiaoziMessage({
    text: lastUserMessage.content,
    deviceId: DEVICE_ID,
    sessionId: SESSION_ID,
    accessLevel: DEFAULT_ACCESS_LEVEL,
  });

  const content = result.speak || result.robot_say || result.reply;
  const id = `chatcmpl-brainos-${randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  if (body.stream) {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            sseChunk({
              id,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }],
            })
          )
        );
        controller.enqueue(
          encoder.encode(
            sseChunk({
              id,
              object: "chat.completion.chunk",
              created,
              model,
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            })
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  return NextResponse.json({
    id,
    object: "chat.completion",
    created,
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  });
}
