// Điểm vào duy nhất mà code ngoài src/lib/orchestrator/ nên import — không
// import trực tiếp từ orchestrator.ts/agents/* ở nơi khác.
//
// Side-effect import: đăng ký toàn bộ agent đã biết vào Task Orchestrator (xem
// agents/registry.ts, composition root).
import "./agents/registry";

export { TaskOrchestrator } from "./orchestrator";
export type {
  Task,
  TaskAgent,
  TaskAgentResult,
  AgentMetadata,
  ExecutionPlan,
  ExecutionStep,
  OrchestratorResult,
} from "./types";
