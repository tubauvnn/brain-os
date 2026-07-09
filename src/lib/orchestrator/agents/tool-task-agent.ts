import { runTool } from "@/lib/tool";
import type { AgentMetadata, Task, TaskAgent, TaskAgentResult } from "../types";

// Tool Task Agent — ADAPTER mỏng bọc Generic Tool Agent (src/lib/tool/, KHÔNG
// sửa gì ở đó). Chứng minh TaskAgent tổng quát hoá ra ngoài agent sáng tạo
// (Video/Image/Character) — cùng pattern mọi adapter khác trong thư mục này.

const SUPPORTED_INTENTS = ["tool_request"];

function canHandle(intent: string): boolean {
  return SUPPORTED_INTENTS.includes(intent);
}

async function execute(task: Task): Promise<TaskAgentResult> {
  const result = await runTool(task.input);
  return {
    success: result.success,
    agent: "tool-agent",
    output: result,
    error: result.error,
  };
}

function metadata(): AgentMetadata {
  return {
    name: "tool-agent",
    supportedIntents: SUPPORTED_INTENTS,
    description: "Generic Tool Execution",
  };
}

export const toolTaskAgent: TaskAgent = { canHandle, execute, metadata };
