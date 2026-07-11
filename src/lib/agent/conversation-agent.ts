import { randomUUID } from "crypto";
import { log } from "@/lib/logger";
import { recallMemory, getMostRecentMemory, deleteMemory, rememberIfSafe } from "@/lib/memory";
import { recallKnowledge } from "@/lib/knowledge";
import { ModelRouter, DEFAULT_MODEL_PROVIDER } from "@/lib/model";
import { TaskOrchestrator } from "@/lib/orchestrator";
import { getActiveProjectContext, getContinuity, getProjectById } from "@/lib/project";
import { getOwnerContext, findMentionedPeople } from "@/lib/people";
import { loadSessionHistoryText } from "@/lib/brain/session-context";
import { runRobotAgent } from "@/lib/robot-ai/robot-agent";
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
  meta?: Record<string, unknown>;
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
// Phase 6A: thêm Project Context (dự án đang mở, xem src/lib/project/) + lịch
// sử hội thoại trong cùng session (nếu client gửi sessionId, xem
// src/lib/brain/session-context.ts) — cần để trả lời được các câu hỏi kiểu
// "mày nhớ tao đang làm gì không?" bằng ngữ cảnh THẬT, không đoán bừa.
// Phase 6B — recallMemory(message) giờ CHỈ lấy memory liên quan tới câu hỏi
// hiện tại (không dump cả bảng vào prompt, xem src/lib/memory/index.ts), và
// thêm relationship memory (People, xem src/lib/people/) cho người được nhắc
// tới trong câu — cả 2 đều "chỉ lấy cái liên quan", không bơm toàn bộ DB.
//
// Phase 6D — client "robot" (ctx.source === "robot") rẽ sang RobotAgent
// (src/lib/robot-ai/robot-agent.ts): Capability Planner tự quyết định cần
// vision/memory/project/knowledge/device/tool/search nào rồi chạy SONG SONG,
// merge lại — thay hẳn nhánh cố định Memory+Knowledge+Project bên dưới CHỈ
// cho robot. Client khác (web/api/mobile, không có camera/vision UI) vẫn
// dùng đúng nhánh cũ, không đổi hành vi, không hồi quy.
async function handleChat(ctx: ExecutionContext, message: string): Promise<IntentOutcome> {
  if (ctx.source === "robot") {
    const agentResult = await runRobotAgent(message, ctx.sessionId);
    await log({
      action: "robot_agent.completed",
      entity: "ExecutionContext",
      entity_id: ctx.id,
      // capabilitiesUsed chỉ vào log nội bộ — KHÔNG đưa vào meta trả lên
      // route.ts (route.ts không expose meta ra response JSON, nhưng vẫn
      // tránh đặt tên field dễ bị lộ nhầm sau này).
      payload: { capabilitiesUsed: agentResult.capabilitiesUsed },
    });
    return {
      reply: agentResult.reply,
      model: agentResult.model,
      memoryUsed: agentResult.memoryUsed,
      knowledgeUsed: agentResult.knowledgeUsed,
      memoryWritten: false,
    };
  }

  const memory = await recallMemory(message);
  await log({
    action: "memory.read",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { count: memory.items.length, relevanceFiltered: true },
  });

  const knowledge = await recallKnowledge();
  await log({
    action: "knowledge.read",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { count: knowledge.items.length, note: knowledge.note },
  });

  const projectContext = await getActiveProjectContext();
  const historyText = ctx.sessionId ? await loadSessionHistoryText(ctx.sessionId) : "";
  const mentionedPeople = await findMentionedPeople(message);

  const contextText = [
    projectContext ? `Dự án đang mở: ${projectContext.name}${projectContext.storyBible ? `\n${projectContext.storyBible}` : ""}` : "",
    memory.items.length
      ? `Memory liên quan:\n${memory.items.map((m) => `- ${m.title}: ${m.content}`).join("\n")}`
      : "",
    knowledge.items.length
      ? `Knowledge:\n${knowledge.items.map((k) => `- ${k.summary}`).join("\n")}`
      : "",
    mentionedPeople.length
      ? `Người được nhắc tới:\n${mentionedPeople
          .map((p) => `- ${p.name}${p.alias ? ` (${p.alias})` : ""}: quan hệ ${p.relation ?? "chưa rõ"}${p.notes ? `, ghi chú: ${p.notes}` : ""}`)
          .join("\n")}`
      : "",
    historyText ? `Lịch sử hội thoại gần đây (session hiện tại):\n${historyText}` : "",
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

// Cụm kích hoạt "remember" (đồng bộ REMEMBER_PHRASES trong intent-resolver.ts)
// — bóc ra khỏi câu trước khi lưu để Memory.content sạch, không lặp lại
// nguyên văn lệnh ("nhớ rằng tao thích X" → lưu "tao thích X", không lưu cả câu).
const REMEMBER_TRIGGER_PHRASES = ["nhớ rằng", "ghi nhớ giúp tôi", "ghi nhớ giúp", "ghi nhớ", "nhớ giúp", "lưu lại", "từ giờ"];

function stripRememberTrigger(text: string): string {
  const lower = text.toLowerCase();
  for (const phrase of REMEMBER_TRIGGER_PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx !== -1) {
      const rest = text.slice(idx + phrase.length).trim().replace(/^[:\-–,]\s*/, "");
      if (rest) return rest;
    }
  }
  return text.trim();
}

// intent "remember" — ghi thẳng, không gọi model. Chính sách "chặn secret /
// phân loại preference-vs-fact / chống ghi trùng" nằm trong rememberIfSafe()
// (src/lib/memory/index.ts) — DÙNG CHUNG với /api/robot/memory/remember,
// không lặp lại 2 nơi. meta.subtype ("refused"/"duplicate"/"written") cho
// Robot Personality chọn đúng câu xác nhận (xem robot-ai/personality.ts).
async function handleRemember(ctx: ExecutionContext, message: string): Promise<IntentOutcome> {
  const content = stripRememberTrigger(message.trim());
  const outcome = await rememberIfSafe(content, `conversation-agent:${ctx.source}:${ctx.id}`);

  if (outcome.status === "refused") {
    await log({ action: "memory.write.refused", entity: "ExecutionContext", entity_id: ctx.id, payload: { reason: "looks_like_secret" } });
    return {
      reply: "Nội dung này giống thông tin nhạy cảm nên mình không lưu lại.",
      memoryUsed: 0,
      knowledgeUsed: 0,
      memoryWritten: false,
      meta: { subtype: "refused" },
    };
  }

  const deduped = outcome.status === "duplicate";
  await log({
    action: deduped ? "memory.write.duplicate" : "memory.write",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { source: ctx.source, category: outcome.category, memoryId: outcome.item.id, deduped },
  });

  return {
    reply: deduped ? `Mình đã nhớ điều này từ trước rồi: ${outcome.item.content}` : `Đã ghi nhớ: ${outcome.item.content}`,
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: !deduped,
    meta: { subtype: deduped ? "duplicate" : "written", memoryId: outcome.item.id, category: outcome.category },
  };
}

// Câu hỏi về DANH TÍNH người dùng ("tao/tôi/mình là ai") — trả lời từ Profile
// thật (chủ hệ thống), KHÔNG dump Memory chung chung. Khác "mày là ai" (hỏi
// về ROBOT — đi qua intent "chat" bình thường, robot tự giới thiệu).
const IDENTITY_SELF_PHRASES = ["tao là ai", "tôi là ai", "mình là ai"];

// "vừa bảo/nói/nhớ/lưu/dặn" — hỏi về ĐÚNG 1 memory vừa ghi gần nhất (test E
// Phase 6B: "Tao vừa bảo mày nhớ gì?"), khác câu hỏi nhớ chung chung.
const JUST_TOLD_PHRASES = ["vừa bảo", "vừa nói", "vừa nhớ", "vừa lưu", "vừa dặn"];

// intent "recall_memory" — đọc thẳng, không gọi model. Phase 6B: 3 nhánh —
// (1) hỏi danh tính → Profile, (2) hỏi "vừa nhớ gì" → đúng 1 memory gần nhất,
// (3) còn lại → recallMemory(message) CHỈ lấy memory liên quan câu hỏi (xem
// src/lib/memory/index.ts), không dump cả bảng như trước Phase 6B.
async function handleRecallMemory(ctx: ExecutionContext, message: string): Promise<IntentOutcome> {
  const lower = message.trim().toLowerCase();

  if (IDENTITY_SELF_PHRASES.some((p) => lower.includes(p))) {
    const owner = await getOwnerContext();
    await log({ action: "memory.read", entity: "ExecutionContext", entity_id: ctx.id, payload: { source: "profile", found: !!owner } });
    const reply = owner
      ? `Bạn là ${owner.name}${owner.alias ? `, mình hay gọi là ${owner.alias}` : ""}.`
      : "Mình chưa có hồ sơ nào về bạn cả.";
    return { reply, memoryUsed: owner ? 1 : 0, knowledgeUsed: 0, memoryWritten: false, meta: { subtype: "identity" } };
  }

  if (JUST_TOLD_PHRASES.some((p) => lower.includes(p))) {
    const latest = await getMostRecentMemory();
    await log({ action: "memory.read", entity: "ExecutionContext", entity_id: ctx.id, payload: { source: "latest", found: !!latest } });
    const reply = latest ? `Lần gần nhất bạn bảo mình nhớ: ${latest.content}` : "Gần đây bạn chưa bảo mình nhớ gì cả.";
    return { reply, memoryUsed: latest ? 1 : 0, knowledgeUsed: 0, memoryWritten: false, meta: { subtype: "latest" } };
  }

  const memory = await recallMemory(message);
  await log({
    action: "memory.read",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { count: memory.items.length, source: "relevance" },
  });

  const reply = memory.items.length
    ? `Đây là những gì mình nhớ liên quan:\n${memory.items.map((m) => `- ${m.title}: ${m.content}`).join("\n")}`
    : "Mình chưa có memory nào liên quan để nhớ lại.";

  return { reply, memoryUsed: memory.items.length, knowledgeUsed: 0, memoryWritten: false, meta: { subtype: "relevant" } };
}

// intent "forget_memory" — xoá THẲNG memory vừa lưu gần nhất (không xoá hàng
// loạt theo lệnh mơ hồ — xem comment FORGET_MEMORY_PHRASES trong
// intent-resolver.ts). Luôn xác nhận rõ đã quên CÁI GÌ, không im lặng xoá.
async function handleForgetMemory(ctx: ExecutionContext): Promise<IntentOutcome> {
  const latest = await getMostRecentMemory();
  if (!latest) {
    await log({ action: "memory.delete.empty", entity: "ExecutionContext", entity_id: ctx.id, payload: {} });
    return {
      reply: "Hiện chưa có gì để quên cả, trí nhớ đang trống.",
      memoryUsed: 0,
      knowledgeUsed: 0,
      memoryWritten: false,
      meta: { subtype: "empty" },
    };
  }

  const deleted = await deleteMemory(latest.id);
  await log({
    action: "memory.delete",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { memoryId: latest.id, title: latest.title, success: !!deleted },
  });

  // KHÔNG set `error` ở đây dù deleteMemory() trả null — runConversationAgent
  // coi outcome.error là LỖI CỨNG và VỨT BỎ luôn `reply` (xem cuối file), mà
  // ở đây đã có sẵn câu trả lời trung thực giải thích tình huống rồi, không
  // cần rơi xuống FALLBACK_TEXT chung chung.
  return {
    reply: deleted ? `Đã quên: ${deleted.title}` : "Mình không xoá được, thử lại giúp mình nhé.",
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: false,
    meta: deleted ? { subtype: "deleted", detail: deleted.title, deletedMemoryId: deleted.id } : { subtype: "delete_failed" },
  };
}

// intent "work_status" — trả lời từ continuity record THẬT (Phase 6B, xem
// src/lib/project/continuity.ts) + todos chưa xong của dự án sáng tạo đang mở
// (nếu có) — KHÔNG đoán bừa, KHÔNG gọi model (nội dung đã có sẵn, chỉ cần
// Robot Personality diễn đạt lại giọng Chuối ở lớp sau).
async function handleWorkStatus(ctx: ExecutionContext): Promise<IntentOutcome> {
  const continuity = await getContinuity();
  const activeProject = continuity.activeProjectId ? await getProjectById(continuity.activeProjectId) : null;
  const unfinishedTodos = activeProject?.todos.filter((t) => !t.done) ?? [];

  await log({
    action: "continuity.read",
    entity: "ExecutionContext",
    entity_id: ctx.id,
    payload: { phase: continuity.currentPhase, activeProjectId: continuity.activeProjectId, unfinishedTodoCount: unfinishedTodos.length },
  });

  const reply = [
    `Phase hiện tại: ${continuity.currentPhase}.`,
    `Vừa hoàn thành: ${continuity.lastCompletedAction}.`,
    `Đang làm: ${continuity.currentTask}.`,
    `Việc tiếp theo: ${continuity.nextRecommendedAction}.`,
    continuity.blockedBy.length ? `Đang vướng: ${continuity.blockedBy.join(", ")}.` : "Hiện chưa có vướng mắc.",
    unfinishedTodos.length && activeProject
      ? `Việc dang dở trong dự án ${activeProject.metadata.name}: ${unfinishedTodos.map((t) => t.content).join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { reply, memoryUsed: 0, knowledgeUsed: 0, memoryWritten: false, meta: { subtype: "continuity" } };
}

// intent "voice_request" — giao cho Task Orchestrator (Agent Runtime), cùng
// nguyên tắc video_request/character_request/image_request/project_request:
// Conversation Agent KHÔNG tự gọi Voice Provider, chỉ biết Orchestrator.
// Orchestrator chọn voice-task-agent qua canHandle("voice_request"), agent đó
// tự gọi VoiceRouter (src/lib/voice/) — cùng provider mà /api/voice/generate
// dùng, không viết lại logic sinh audio.
async function handleVoiceRequest(message: string): Promise<IntentOutcome> {
  const result = await TaskOrchestrator.run("voice_request", message);

  return {
    reply: JSON.stringify(result, null, 2),
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: false,
  };
}

// intent "robot_command" — giao cho Task Orchestrator, cùng nguyên tắc
// handleVideoRequest/... : Conversation Agent KHÔNG tự nói chuyện với Device
// Manager/Mock Robot, chỉ biết Orchestrator. Orchestrator chọn robot-task-agent
// qua canHandle("robot_command") (src/lib/orchestrator/agents/robot-task-agent.ts,
// agent đó mới thật sự dịch message → Device Command rồi gọi Device Manager).
// finalOutput.message là câu trả lời thật từ Device Provider — dùng thẳng làm
// reply (không JSON.stringify nguyên OrchestratorResult như các handler khác,
// robot chat cần câu người đọc được để nói/hiển thị). meta mang theo command
// thật đã chạy để client (Robot UI) suy ra mood/eyes/action, xem
// src/lib/robot-ai/presentation.ts.
async function handleRobotCommand(message: string): Promise<IntentOutcome> {
  const result = await TaskOrchestrator.run("robot_command", message);
  const output = result.finalOutput as { command?: string; message?: string; data?: Record<string, unknown> } | undefined;

  return {
    reply: result.success ? output?.message : undefined,
    memoryUsed: 0,
    knowledgeUsed: 0,
    memoryWritten: false,
    error: result.success ? undefined : result.error,
    meta: output ? { command: output.command, data: output.data } : undefined,
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

// intent "tool_request" — giao cho Task Orchestrator, cùng nguyên tắc các
// handler khác: Conversation Agent KHÔNG tự chạy tool, chỉ biết Orchestrator.
// Orchestrator chọn tool-task-agent qua canHandle("tool_request") (calculator/
// datetime, xem src/lib/tool/) — chứng minh TaskAgent tổng quát ra ngoài agent
// sáng tạo.
async function handleToolRequest(message: string): Promise<IntentOutcome> {
  const result = await TaskOrchestrator.run("tool_request", message);

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
      return handleRecallMemory(ctx, message);
    case "forget_memory":
      return handleForgetMemory(ctx);
    case "work_status":
      return handleWorkStatus(ctx);
    case "voice_request":
      return handleVoiceRequest(message);
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
    case "tool_request":
      return handleToolRequest(message);
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
    meta: outcome.meta,
  };
}
