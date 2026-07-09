import { randomUUID } from "crypto";
import { log } from "@/lib/logger";
import type {
  AgentMetadata,
  ExecutionPlan,
  ExecutionStep,
  OrchestratorResult,
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

function register(agent: TaskAgent): void {
  agents.push(agent);
}

function listAgents(): AgentMetadata[] {
  return agents.map((a) => a.metadata());
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

// Agent Execution — chạy tuần tự (Requirement 1: "execute sequentially").
// Output của bước trước được đưa vào payload.previousOutput của Task ở bước
// sau — đây là cơ chế duy nhất cho phép chuỗi nhiều agent hoạt động mà không
// đổi code Orchestrator. Dừng ngay khi 1 bước thất bại (fail-fast), không
// chạy tiếp bước dựa trên output chưa có.
async function run(intent: string, input: string, payload?: Record<string, unknown>): Promise<OrchestratorResult> {
  const taskId = randomUUID();

  await log({ action: "task.created", entity: "Task", entity_id: taskId, payload: { intent, input } });

  const selected = selectAgents(intent);
  const plan = buildPlan(intent, selected);

  if (selected.length === 0) {
    const error = `Không tìm thấy agent nào xử lý intent "${intent}".`;
    await log({ action: "task.completed", entity: "Task", entity_id: taskId, payload: { success: false, intent, error } });
    return { success: false, intent, plan, outputs: [], error };
  }

  const outputs: TaskAgentResult[] = [];
  let previousOutput: unknown;
  let success = true;

  for (const agent of selected) {
    const meta = agent.metadata();

    await log({ action: "agent.selected", entity: "Task", entity_id: taskId, payload: { agent: meta.name, intent } });

    const task: Task = { id: taskId, intent, input, payload: { ...payload, previousOutput } };

    await log({ action: "agent.started", entity: "Task", entity_id: taskId, payload: { agent: meta.name } });

    const result = await agent.execute(task);
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
    previousOutput = result.output;
  }

  await log({
    action: "task.completed",
    entity: "Task",
    entity_id: taskId,
    payload: { success, intent, agentCount: outputs.length },
  });

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
  listAgents,
  selectAgents,
  run,
};
