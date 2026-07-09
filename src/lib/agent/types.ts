import type { Intent } from "./intent-resolver";

export type ConversationSource = "web" | "robot" | "voice" | "mobile" | "api";

export type ExecutionContext = {
  id: string;
  source: ConversationSource;
  sessionId?: string;
  startedAt: number;
};

export type ConversationInput = {
  message: string;
  source?: ConversationSource;
  sessionId?: string;
};

export type ConversationResult = {
  success: boolean;
  contextId: string;
  intent: Intent;
  reply?: string;
  model?: string;
  memoryUsed: number;
  knowledgeUsed: number;
  memoryWritten: boolean;
  latencyMs: number;
  error?: string;
};
