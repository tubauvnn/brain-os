import { randomUUID } from "crypto";
import { log } from "@/lib/logger";
import { recallMemory, writeMemory } from "@/lib/memory";
import { recallKnowledge } from "@/lib/knowledge";
import { ModelRouter, DEFAULT_MODEL_PROVIDER } from "@/lib/model";
import { DeviceManager } from "@/lib/device";
import { TaskOrchestrator } from "@/lib/orchestrator";
import { resolveIntent, type Intent } from "./intent-resolver";
import type { ConversationInput, ConversationResult, ExecutionContext } from "./types";

// Conversation Agent — điểm vào DUY NHẤT cho mọi tương tác, dùng chung bởi mọi
// client tương lai (Web/Robot/Voice/Mobile/API). Agent chỉ ĐIỀU PHỐI, không tự
// gọi ElevenLabs/OpenAI/Claude (luôn qua src/lib/model/) và không tự query
// Prisma cho Memory/Knowledge (luôn qua src/lib/memory/, src/lib/knowledge/).
//
//     User → Conversation Agent → Intent Resolver → Memory / Knowledge / Model Router → Response
//
// KHÔNG multi-agent, KHÔNG planning, KHÔNG workflow — Intent Resolver chỉ chọn
// ĐÚNG MỘT nhánh xử lý cố định cho mỗi request (switch, không suy luận nhiều
// bước, không gọi lại chính nó).

type IntentOutcome = {
  reply?: string;
  model?: string;
  memoryUsed: number;
  knowledgeUsed: number;
  memoryWritten: boolean;
  error?: string;
};

function createExecutionContext(input: ConversationInput): ExecutionContext {
  return {
    id: randomUUID(),
    source: input.source ?? "api",
    sessionId: input.sessionId,
    startedAt: Date.now(),
  };
}

// intent "chat" — luồng đầy đủ đã có từ vertical slice trước: Memory → Knowledge → Model.
async function handleChat(ctx: ExecutionContext, message: string): Promise<IntentOutcome> {
  const memory = await recallMemory();
  await log({
    action: "memory.read",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { count: memory.items.length },
  });

  const knowledge = await recallKnowledge();
  await log({
    action: "knowledge.read",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { count: knowledge.items.length, note: knowledge.note },
  });

  const contextText = [
    memory.items.length
      ? `Memory:\n${memory.items.map((m) => `- ${m.title}: ${m.content}`).join("\n")}`
      : "",
    knowledge.items.length
      ? `Knowledge:\n${knowledge.items.map((k) => `- ${k.summary}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const provider = ModelRouter.resolve(DEFAULT_MODEL_PROVIDER);
  if (!provider) {
    return {
      memoryUsed: memory.items.length,
      knowledgeUsed: knowledge.items.length,
      memoryWritten: false,
      error: `Không tìm thấy model provider "${DEFAULT_MODEL_PROVIDER}".`,
    };
  }

  await log({
    action: "model.selected",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { provider: provider.name },
  });

  const result = await provider.generate({ message, context: contextText });
  if (result.status === "error" || !result.reply) {
    return {
      memoryUsed: memory.items.length,
      knowledgeUsed: knowledge.items.length,
      memoryWritten: false,
      error: result.error ?? "Sinh phản hồi thất bại.",
    };
  }

  return {
    reply: result.reply,
    model: result.model,
    memoryUsed: memory.items.length,
    knowledgeUsed: knowledge.items.length,
    memoryWritten: false,
  };
}

// intent "remember" — ghi thẳng, không gọi model.
async function handleRemember(ctx: ExecutionContext, message: string): Promise<IntentOutcome> {
  const content = message.trim();
  await writeMemory(content, `conversation-agent:${ctx.source}:${ctx.id}`);
  await log({
    action: "memory.write",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { source: ctx.source },
  });

  return {
    reply: `Đã ghi nhớ: ${content}`,
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: true,
  };
}

// intent "recall_memory" — đọc thẳng, không gọi model.
async function handleRecallMemory(ctx: ExecutionContext): Promise<IntentOutcome> {
  const memory = await recallMemory();
  await log({
    action: "memory.read",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { count: memory.items.length },
  });

  const reply = memory.items.length
    ? `Đây là những gì mình nhớ:\n${memory.items.map((m) => `- ${m.title}: ${m.content}`).join("\n")}`
    : "Mình chưa có memory nào liên quan để nhớ lại.";

  return { reply, memoryUsed: memory.items.length, knowledgeUsed: 0, memoryWritten: false };
}

// intent "voice_request" — CHỈ báo nhận diện, KHÔNG gọi Voice Provider (voice là
// hạ tầng riêng, xem src/lib/voice/ — wiring vào Agent là bước sau).
function handleVoiceRequest(): IntentOutcome {
  return {
    reply:
      "Mình nhận ra bạn muốn nghe giọng nói. Khả năng Voice đã có sẵn (Voice Provider, /api/voice/generate) nhưng Conversation Agent chưa gọi tới ở bước này.",
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: false,
  };
}

// intent "robot_command" — dịch message sang 1 Device Command cố định (không
// suy luận nhiều bước) rồi giao cho Device Manager (src/lib/device/) thực thi.
// Conversation Agent KHÔNG tự nói chuyện với Mock Robot Device — luôn qua
// Device Manager, đúng kiến trúc Conversation Agent → Intent Resolver →
// Device Manager → Device Provider. Lifecycle logging (received/resolved/
// started/completed|failed) do Device Manager tự làm, không log trùng ở đây.
const ROBOT_STATUS_WORDS = ["trạng thái", "status"];

function buildRobotDeviceCommand(message: string): { command: string; payload?: Record<string, unknown> } {
  const text = message.trim().toLowerCase();
  if (ROBOT_STATUS_WORDS.some((w) => text.includes(w))) {
    return { command: "status" };
  }
  return { command: "greet", payload: { text: message.trim() } };
}

async function handleRobotCommand(message: string): Promise<IntentOutcome> {
  const { command, payload } = buildRobotDeviceCommand(message);
  const result = await DeviceManager.execute({ deviceType: "robot", command, payload });

  return {
    reply: result.message,
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: false,
  };
}

// intent "video_request" — giao cho Task Orchestrator (src/lib/orchestrator/),
// KHÔNG gọi VideoAgent trực tiếp (Phase 4: Conversation Agent chỉ biết
// Orchestrator, Orchestrator tự chọn agent qua canHandle(intent)). Orchestrator
// tự chạy Agent Selection → Agent Execution (VideoAgent → Story Planner →
// Scene Planner → Prompt Generator → Provider) và trả unified result — trả
// nguyên JSON đó làm reply (giữ contract ConversationResult không đổi).
async function handleVideoRequest(message: string): Promise<IntentOutcome> {
  const result = await TaskOrchestrator.run("video_request", message);

  return {
    reply: JSON.stringify(result, null, 2),
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: false,
  };
}

// intent "character_request" — giao cho Task Orchestrator, cùng nguyên tắc
// handleVideoRequest: Conversation Agent KHÔNG tự gọi Character Agent, chỉ
// biết Orchestrator. Orchestrator chọn character-task-agent qua
// canHandle("character_request") rồi trả unified result (Character Memory +
// Consistency Checker output) làm reply.
async function handleCharacterRequest(message: string): Promise<IntentOutcome> {
  const result = await TaskOrchestrator.run("character_request", message);

  return {
    reply: JSON.stringify(result, null, 2),
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: false,
  };
}

// intent "image_request" — giao cho Task Orchestrator, cùng nguyên tắc
// handleVideoRequest/handleCharacterRequest: Conversation Agent KHÔNG tự gọi
// Image Agent, chỉ biết Orchestrator. Orchestrator chọn image-task-agent qua
// canHandle("image_request"); Image Agent tự xin canon từ Character Agent bên
// trong nó, Orchestrator/Conversation Agent không cần biết chi tiết đó.
async function handleImageRequest(message: string): Promise<IntentOutcome> {
  const result = await TaskOrchestrator.run("image_request", message);

  return {
    reply: JSON.stringify(result, null, 2),
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: false,
  };
}

// intent "project_request" — giao cho Task Orchestrator, cùng nguyên tắc các
// handler khác: Conversation Agent KHÔNG tự gọi Project Agent, chỉ biết
// Orchestrator. Orchestrator chọn project-task-agent qua
// canHandle("project_request") để create/open/save/update/list dự án (JSON
// local, xem src/lib/project/).
async function handleProjectRequest(message: string): Promise<IntentOutcome> {
  const result = await TaskOrchestrator.run("project_request", message);

  return {
    reply: JSON.stringify(result, null, 2),
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: false,
  };
}

// intent "unknown" — fallback an toàn, không đoán bừa, không gọi model.
function handleUnknown(): IntentOutcome {
  return {
    reply: "Mình chưa hiểu rõ ý bạn, bạn có thể nói lại rõ hơn không?",
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: false,
  };
}

async function routeByIntent(ctx: ExecutionContext, intent: Intent, message: string): Promise<IntentOutcome> {
  switch (intent) {
    case "remember":
      return handleRemember(ctx, message);
    case "recall_memory":
      return handleRecallMemory(ctx);
    case "voice_request":
      return handleVoiceRequest();
    case "robot_command":
      return handleRobotCommand(message);
    case "video_request":
      return handleVideoRequest(message);
    case "character_request":
      return handleCharacterRequest(message);
    case "image_request":
      return handleImageRequest(message);
    case "project_request":
      return handleProjectRequest(message);
    case "unknown":
      return handleUnknown();
    case "chat":
    default:
      return handleChat(ctx, message);
  }
}

export async function runConversationAgent(input: ConversationInput): Promise<ConversationResult> {
  const ctx = createExecutionContext(input);

  await log({
    action: "conversation.received",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { source: ctx.source, sessionId: ctx.sessionId ?? null, messageLength: input.message.length },
  });

  const intent = resolveIntent(input.message);
  await log({
    action: "intent.resolved",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { intent },
  });

  const outcome = await routeByIntent(ctx, intent, input.message);
  const latencyMs = Date.now() - ctx.startedAt;

  if (outcome.error || !outcome.reply) {
    await log({
      action: "conversation.failed",
      entity: "ExecutionContext",
      entity_id: ctx.id,
      payload: { intent, error: outcome.error, latencyMs },
    });
    return {
      success: false,
      contextId: ctx.id,
      intent,
      memoryUsed: outcome.memoryUsed,
      knowledgeUsed: outcome.knowledgeUsed,
      memoryWritten: outcome.memoryWritten,
      latencyMs,
      error: outcome.error ?? "Xử lý thất bại.",
    };
  }

  await log({
    action: "response.produced",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { intent, model: outcome.model, replyLength: outcome.reply.length },
  });

  await log({
    action: "conversation.completed",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: {
      intent,
      latencyMs,
      memoryUsed: outcome.memoryUsed,
      knowledgeUsed: outcome.knowledgeUsed,
      memoryWritten: outcome.memoryWritten,
    },
  });

  return {
    success: true,
    contextId: ctx.id,
    intent,
    reply: outcome.reply,
    model: outcome.model,
    memoryUsed: outcome.memoryUsed,
    knowledgeUsed: outcome.knowledgeUsed,
    memoryWritten: outcome.memoryWritten,
    latencyMs,
  };
}
