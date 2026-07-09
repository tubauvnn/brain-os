import { randomUUID } from "crypto";
import { log } from "@/lib/logger";
import type {
  AgentMetadata,
  AssetProvider,
  ContextProvider,
  ExecutionHistoryEntry,
  ExecutionPlan,
  ExecutionStep,
  OrchestratorResult,
  ProjectRecorder,
  Task,
  TaskAgent,
  TaskAgentResult,
} from "./types";

// Task Orchestrator — CENTRAL EXECUTION ENGINE:
//
//     Conversation Agent → Intent Resolver → Task Orchestrator →
//     Agent Selection → Agent Execution → Response
//
// QUAN TRỌNG — Inversion of Control (cùng nguyên tắc Device Manager/Video
// Agent, src/lib/device/device-manager.ts, src/lib/video/video-agent.ts): file
// này CHỈ import types.ts (contract). KHÔNG import bất kỳ TaskAgent cụ thể nào
// (VideoAgent/ImageAgent/CharacterAgent/RobotAgent/...). Agent cụ thể nào tồn
// tại + đăng ký ra sao là việc của agents/registry.ts (composition root) —
// thêm agent mới KHÔNG được sửa file này.

const agents: TaskAgent[] = [];

// 3 seam tuỳ chọn (mặc định null = tắt, hành vi y hệt khi chưa đăng ký gì).
// KHÔNG import agent/provider cụ thể nào ở đây — chỉ giữ contract,
// implementation thật đăng ký qua setXxx() ở composition root (agents/registry.ts).
let contextProvider: ContextProvider | null = null;
let projectRecorder: ProjectRecorder | null = null;
let assetProvider: AssetProvider | null = null;

const MAX_ATTEMPTS = 2; // 1 lần thử đầu + 1 lần thử lại — CHỈ khi agent.execute() THROW.
const MAX_HISTORY = 50;
const executionHistory: ExecutionHistoryEntry[] = [];

function register(agent: TaskAgent): void {
  agents.push(agent);
}

function setContextProvider(provider: ContextProvider | null): void {
  contextProvider = provider;
}

function setProjectRecorder(recorder: ProjectRecorder | null): void {
  projectRecorder = recorder;
}

function setAssetProvider(provider: AssetProvider | null): void {
  assetProvider = provider;
}

function listAgents(): AgentMetadata[] {
  return agents.map((a) => a.metadata());
}

function getExecutionHistory(): ExecutionHistoryEntry[] {
  return executionHistory;
}

// Agent Selection — mọi agent có canHandle(intent) === true, theo đúng thứ tự
// đăng ký ở composition root. 1 agent khớp = plan 1 bước (VideoAgent hôm nay).
// Nhiều agent khớp = plan nhiều bước (Character → Image → Video → Voice sau
// này) — KHÔNG cần đổi hàm này khi có thêm agent.
function selectAgents(intent: string): TaskAgent[] {
  return agents.filter((a) => a.canHandle(intent));
}

function buildPlan(intent: string, selected: TaskAgent[]): ExecutionPlan {
  const steps: ExecutionStep[] = selected.map((a, i) => {
    const meta = a.metadata();
    return { step: i + 1, agent: meta.name, task: meta.description ?? meta.name };
  });
  return { intent, steps };
}

// Error handling + Retry mechanism (Agent Runtime) — bọc agent.execute() để
// 1 exception KHÔNG BAO GIỜ làm sập cả run()/API. CHỈ retry khi agent.execute()
// THROW (lỗi hạ tầng/bất ngờ) — KHÔNG retry khi agent trả về success:false một
// cách bình thường (đó là thất bại nghiệp vụ xác định — vd "device_not_found",
// thử lại không đổi kết quả). Lưu ý cho agent thật sau này (Veo/Kling/...): nếu
// execute() có side effect KHÔNG idempotent, cân nhắc thiết kế lại trước khi
// dựa vào retry này.
async function executeWithRetry(agent: TaskAgent, task: Task, taskId: string): Promise<TaskAgentResult> {
  const agentName = agent.metadata().name;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await agent.execute(task);
    } catch (e) {
      lastError = e;
      const message = e instanceof Error ? e.message : "Lỗi không xác định khi thực thi agent.";
      await log({
        action: attempt < MAX_ATTEMPTS ? "agent.retry" : "agent.error",
        entity: "Task",
        entity_id: taskId,
        payload: { agent: agentName, attempt, maxAttempts: MAX_ATTEMPTS, error: message },
      });
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Lỗi không xác định khi thực thi agent.";
  return { success: false, agent: agentName, error: message };
}

// Agent Execution — chạy tuần tự (Requirement 1: "execute sequentially").
// Output của bước trước được đưa vào payload.previousOutput của Task ở bước
// sau — đây là cơ chế duy nhất cho phép chuỗi nhiều agent hoạt động mà không
// đổi code Orchestrator. Dừng ngay khi 1 bước thất bại (fail-fast), không
// chạy tiếp bước dựa trên output chưa có.
async function run(intent: string, input: string, payload?: Record<string, unknown>): Promise<OrchestratorResult> {
  const taskId = randomUUID();
  const startedAt = Date.now();

  // Project Context + Asset Propagation (nếu có provider đăng ký) lấy 1 lần,
  // gắn vào MỌI Task bên dưới — agent nào không đọc payload.projectContext/
  // payload.assets thì đơn giản bỏ qua, không lỗi.
  const projectContext = contextProvider ? await contextProvider.getContext() : null;
  const assets = assetProvider ? await assetProvider.getAssets(intent, input) : null;

  await log({
    action: "task.created",
    entity: "Task",
    entity_id: taskId,
    payload: { intent, input, hasProjectContext: !!projectContext, hasAssets: !!assets },
  });

  const selected = selectAgents(intent);
  const plan = buildPlan(intent, selected);

  if (selected.length === 0) {
    const error = `Không tìm thấy agent nào xử lý intent "${intent}".`;
    await log({ action: "task.completed", entity: "Task", entity_id: taskId, payload: { success: false, intent, error } });
    executionHistory.unshift({
      taskId,
      intent,
      input,
      success: false,
      agentCount: 0,
      latencyMs: Date.now() - startedAt,
      startedAt: new Date(startedAt).toISOString(),
    });
    if (executionHistory.length > MAX_HISTORY) executionHistory.length = MAX_HISTORY;
    return { success: false, intent, plan, outputs: [], error };
  }

  const outputs: TaskAgentResult[] = [];
  let previousOutput: unknown;
  let success = true;

  for (const agent of selected) {
    const meta = agent.metadata();

    await log({ action: "agent.selected", entity: "Task", entity_id: taskId, payload: { agent: meta.name, intent } });

    const task: Task = { id: taskId, intent, input, payload: { ...payload, previousOutput, projectContext, assets } };

    await log({ action: "agent.started", entity: "Task", entity_id: taskId, payload: { agent: meta.name } });

    const result = await executeWithRetry(agent, task, taskId);
    outputs.push(result);

    await log({
      action: "agent.completed",
      entity: "Task",
      entity_id: taskId,
      payload: { agent: meta.name, success: result.success, error: result.error ?? null },
    });

    if (!result.success) {
      success = false;
      break;
    }

    // Phase 7 — agent tự nguyện gắn projectRecord vào result muốn Orchestrator
    // lưu lại vào Project đang mở. Không có project đang mở/không có recorder
    // đăng ký → bỏ qua im lặng (KHÔNG lỗi, KHÔNG chặn execution).
    if (result.projectRecord && projectContext && projectRecorder) {
      await projectRecorder.record(String(projectContext.id), result.projectRecord.category, result.projectRecord.entry);
    }

    previousOutput = result.output;
  }

  await log({
    action: "task.completed",
    entity: "Task",
    entity_id: taskId,
    payload: { success, intent, agentCount: outputs.length },
  });

  executionHistory.unshift({
    taskId,
    intent,
    input,
    success,
    agentCount: outputs.length,
    latencyMs: Date.now() - startedAt,
    startedAt: new Date(startedAt).toISOString(),
  });
  if (executionHistory.length > MAX_HISTORY) executionHistory.length = MAX_HISTORY;

  return {
    success,
    intent,
    plan,
    outputs,
    finalOutput: outputs.length ? outputs[outputs.length - 1].output : undefined,
    error: success ? undefined : outputs[outputs.length - 1]?.error,
  };
}

// KHÔNG đăng ký agent nào ở đây — xem agents/registry.ts (composition root),
// nơi DUY NHẤT ghép agent cụ thể rồi gọi register().
export const TaskOrchestrator = {
  register,
  setContextProvider,
  setProjectRecorder,
  setAssetProvider,
  listAgents,
  getExecutionHistory,
  selectAgents,
  run,
};
