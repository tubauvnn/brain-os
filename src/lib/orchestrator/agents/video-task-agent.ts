import { VideoAgent } from "@/lib/video";
import type { AgentMetadata, Task, TaskAgent, TaskAgentResult } from "../types";

// Video Task Agent — ADAPTER mỏng bọc VideoAgent (src/lib/video/, KHÔNG sửa gì
// ở đó) để khớp hợp đồng TaskAgent. Orchestrator không bao giờ thấy
// VideoAgent.generate() trực tiếp — chỉ thấy canHandle/execute/metadata() qua
// adapter này. Agent tương lai (ImageAgent/CharacterAgent/RobotAgent/...) viết
// adapter tương tự trong thư mục này, không đổi VideoAgent lẫn Orchestrator.

const SUPPORTED_INTENTS = ["video_request"];

function canHandle(intent: string): boolean {
  return SUPPORTED_INTENTS.includes(intent);
}

async function execute(task: Task): Promise<TaskAgentResult> {
  const plan = await VideoAgent.generate({ prompt: task.input });
  const success = plan.status !== "failed";
  return {
    success,
    agent: "video-agent",
    output: plan,
    error: plan.error,
    // Phase 7 — Orchestrator tự ghi vào episodeHistory của project đang mở
    // (nếu có), Video Agent/VideoAgent.generate() không cần biết Project Agent
    // tồn tại.
    projectRecord: success ? { category: "episodeHistory", entry: { title: plan.title, summary: `Video plan — ${plan.scenes.length} cảnh, ${plan.durationSeconds}s.` } } : undefined,
  };
}

function metadata(): AgentMetadata {
  return {
    name: "video-agent",
    supportedIntents: SUPPORTED_INTENTS,
    description: "Generate Video",
  };
}

export const videoTaskAgent: TaskAgent = { canHandle, execute, metadata };
