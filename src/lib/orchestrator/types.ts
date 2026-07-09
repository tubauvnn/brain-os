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

// projectRecord — tuỳ chọn (Phase 7): agent muốn Orchestrator lưu output của
// nó vào Project đang mở (nếu có) thì set field này, Orchestrator tự gọi
// ProjectRecorder — KHÔNG agent nào tự import Project Agent. category là tên
// field trên Project (vd "episodeHistory"/"imageReferences"), entry là dữ liệu
// tương ứng. Không set → hành vi y hệt trước Phase 7 (không ghi gì).
export type TaskAgentResult = {
  success: boolean;
  agent: string;
  output?: unknown;
  error?: string;
  projectRecord?: { category: string; entry: unknown };
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

// ContextProvider / ProjectRecorder (Phase 7) — 2 contract tuỳ chọn cho phép
// Orchestrator tự gắn Project Context vào Task của MỌI agent, và tự ghi kết
// quả agent lại vào Project đang mở — mà KHÔNG import Project Agent cụ thể
// (giữ nguyên nguyên tắc IoC: orchestrator.ts chỉ import types.ts). Composition
// root (agents/registry.ts) đăng ký implementation thật qua
// setContextProvider()/setProjectRecorder(). Không đăng ký → Orchestrator chạy
// y hệt trước Phase 7 (payload.projectContext luôn null, không ghi gì) —
// tương thích ngược hoàn toàn.
export interface ContextProvider {
  getContext(): Promise<Record<string, unknown> | null>;
}

export interface ProjectRecorder {
  record(projectId: string, category: string, entry: unknown): Promise<void>;
}

// AssetProvider (Agent Runtime) — seam tuỳ chọn thứ 3, cùng nguyên tắc IoC như
// ContextProvider/ProjectRecorder: cho phép Orchestrator tự gắn asset
// reference (vd đường dẫn ảnh canon nhân vật) vào Task của MỌI agent dựa trên
// intent/input, mà KHÔNG agent nào phải tự import Character Agent (hay bất kỳ
// nguồn asset nào khác) để tra cứu asset liên quan. Không đăng ký → hành vi y
// hệt trước khi có seam này (payload.assets luôn null).
export interface AssetProvider {
  getAssets(intent: string, input: string): Promise<Record<string, unknown> | null>;
}

// Execution History — 1 dòng tóm tắt cho mỗi lần TaskOrchestrator.run() chạy
// xong, giữ in-memory (ring buffer, xem orchestrator.ts) để truy vấn nhanh
// không cần query lại ActivityLog/Postgres. Đây là lịch sử THỰC THI (khác
// Activity Log — log chi tiết từng bước, đã có từ Phase 1).
export type ExecutionHistoryEntry = {
  taskId: string;
  intent: string;
  input: string;
  success: boolean;
  agentCount: number;
  latencyMs: number;
  startedAt: string;
};
