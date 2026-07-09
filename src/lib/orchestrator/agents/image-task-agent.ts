import { buildPromptPack } from "@/lib/image";
import type { AgentMetadata, Task, TaskAgent, TaskAgentResult } from "../types";

// Image Task Agent — ADAPTER mỏng bọc Image Agent (src/lib/image/, KHÔNG sửa
// gì ở đó) để khớp hợp đồng TaskAgent. Image Agent tự gọi Character Agent
// (src/lib/character/) làm nguồn sự thật cho dữ liệu nhân vật — Orchestrator
// không cần biết chi tiết đó, chỉ thấy canHandle/execute/metadata() qua
// adapter này. Cùng pattern video-task-agent.ts, character-task-agent.ts.

const SUPPORTED_INTENTS = ["image_request"];

function canHandle(intent: string): boolean {
  return SUPPORTED_INTENTS.includes(intent);
}

async function execute(task: Task): Promise<TaskAgentResult> {
  const promptPack = await buildPromptPack(task.input);
  return {
    success: promptPack.characterReferences.length > 0,
    agent: "image-agent",
    output: promptPack,
    error: promptPack.characterReferences.length > 0 ? undefined : "no_character_found",
  };
}

function metadata(): AgentMetadata {
  return {
    name: "image-agent",
    supportedIntents: SUPPORTED_INTENTS,
    description: "Generate Prompt Pack",
  };
}

export const imageTaskAgent: TaskAgent = { canHandle, execute, metadata };
