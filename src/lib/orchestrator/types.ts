// Task Orchestrator contracts — cùng pattern Model Router / Voice Router /
// Device Manager / Video Agent (src/lib/model, src/lib/voice, src/lib/device,
// src/lib/video): interface trước, agent cụ thể sau. Orchestrator KHÔNG biết
// VideoAgent/ImageAgent/RobotAgent... cụ thể nào — chỉ biết TaskAgent
// (contract dưới đây). Agent thật đăng ký qua agents/registry.ts (composition
// root), giống hệt nguyên tắc IoC đã áp dụng cho Device Manager (Phase 2) và
// Video Agent (Phase 3).

// Task — đơn vị công việc Orchestrator giao cho 1 TaskAgent thực thi. payload
// có thể chứa previousOutput (output của agent liền trước trong 1 execution
// plan nhiều bước) — cho phép chuỗi agent (Character → Image → Video → Voice)
// hoạt động mà không đổi contract này.
export type Task = {
  id: string;
  intent: string;
  input: string;
  payload?: Record<string, unknown>;
};

export type TaskAgentResult = {
  success: boolean;
  agent: string;
  output?: unknown;
  error?: string;
};

export type AgentMetadata = {
  name: string;
  supportedIntents: string[];
  description?: string;
};

// TaskAgent — hợp đồng DUY NHẤT mọi agent phải implement để Orchestrator biết
// tới. Agent hiện có (VideoAgent) và agent tương lai (ImageAgent/
// CharacterAgent/RobotAgent/VoiceAgent/SEOAgent/SocialAgent/CameraAgent) đều
// implement contract này qua 1 adapter mỏng trong agents/ — Orchestrator
// không bao giờ import agent cụ thể.
export interface TaskAgent {
  canHandle(intent: string): boolean;
  execute(task: Task): Promise<TaskAgentResult>;
  metadata(): AgentMetadata;
}

// Execution Plan — biểu diễn JSON của thứ tự agent sẽ chạy cho 1 intent. Có
// thể có 1 bước (VideoAgent hôm nay) hoặc nhiều bước (Character → Image →
// Video → Voice sau này) mà KHÔNG cần đổi code Orchestrator — số bước hoàn
// toàn phụ thuộc số agent có canHandle(intent) === true, theo đúng thứ tự
// đăng ký ở composition root.
export type ExecutionStep = {
  step: number;
  agent: string;
  task: string;
};

export type ExecutionPlan = {
  intent: string;
  steps: ExecutionStep[];
};

// Unified Result — kết quả cuối cùng Orchestrator trả về cho Conversation Agent.
export type OrchestratorResult = {
  success: boolean;
  intent: string;
  plan: ExecutionPlan;
  outputs: TaskAgentResult[];
  finalOutput?: unknown;
  error?: string;
};
