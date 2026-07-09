import { handleProjectRequest } from "@/lib/project";
import type { AgentMetadata, Task, TaskAgent, TaskAgentResult } from "../types";

// Project Task Agent — ADAPTER mỏng bọc Project Agent (src/lib/project/,
// KHÔNG sửa gì ở đó) để khớp hợp đồng TaskAgent, xử lý intent
// "project_request" (create/open/save/update/list qua ngôn ngữ tự nhiên).
// Cùng pattern video-task-agent.ts, character-task-agent.ts, image-task-agent.ts.

const SUPPORTED_INTENTS = ["project_request"];

function canHandle(intent: string): boolean {
  return SUPPORTED_INTENTS.includes(intent);
}

async function execute(task: Task): Promise<TaskAgentResult> {
  const result = await handleProjectRequest(task.input);
  return {
    success: result.success,
    agent: "project-agent",
    output: result,
    error: result.success ? undefined : result.error,
  };
}

function metadata(): AgentMetadata {
  return {
    name: "project-agent",
    supportedIntents: SUPPORTED_INTENTS,
    description: "Manage Project",
  };
}

export const projectTaskAgent: TaskAgent = { canHandle, execute, metadata };
