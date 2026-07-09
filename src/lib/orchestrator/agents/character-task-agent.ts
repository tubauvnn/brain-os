import { resolveCharacters } from "@/lib/character";
import type { AgentMetadata, Task, TaskAgent, TaskAgentResult } from "../types";

// Character Task Agent — ADAPTER mỏng bọc Character Agent (src/lib/character/,
// KHÔNG sửa gì ở đó) để khớp hợp đồng TaskAgent. Orchestrator không bao giờ
// thấy resolveCharacters() trực tiếp — chỉ thấy canHandle/execute/metadata()
// qua adapter này. Cùng pattern video-task-agent.ts.

const SUPPORTED_INTENTS = ["character_request"];

function canHandle(intent: string): boolean {
  return SUPPORTED_INTENTS.includes(intent);
}

async function execute(task: Task): Promise<TaskAgentResult> {
  const output = await resolveCharacters(task.input);
  return {
    success: output.characters.length > 0,
    agent: "character-agent",
    output,
    error: output.characters.length > 0 ? undefined : "no_character_found",
  };
}

function metadata(): AgentMetadata {
  return {
    name: "character-agent",
    supportedIntents: SUPPORTED_INTENTS,
    description: "Resolve Characters",
  };
}

export const characterTaskAgent: TaskAgent = { canHandle, execute, metadata };
