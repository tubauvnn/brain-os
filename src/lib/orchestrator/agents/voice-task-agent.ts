import { VoiceRouter, DEFAULT_VOICE_PROVIDER } from "@/lib/voice";
import { saveVoiceAudio } from "@/lib/voice/storage";
import type { AgentMetadata, Task, TaskAgent, TaskAgentResult } from "../types";

// Voice Task Agent — ADAPTER mỏng bọc Voice Provider (src/lib/voice/, KHÔNG
// sửa gì ở đó — cùng VoiceRouter/saveVoiceAudio mà /api/voice/generate/route.ts
// đã dùng, không viết lại logic sinh/lưu audio) để khớp hợp đồng TaskAgent.
// Trước Phase 3 (Agent Runtime), intent "voice_request" chỉ có 1 câu trả lời
// cố định trong Conversation Agent — đây là nơi thực thi thật đầu tiên.

const SUPPORTED_INTENTS = ["voice_request"];

// Đồng bộ với VOICE_REQUEST_PHRASES trong src/lib/agent/intent-resolver.ts —
// dùng để bóc phần text cần đọc ra khỏi câu lệnh (vd "đọc câu Xin chào" → "Xin chào").
const TRIGGER_PHRASES = ["nói câu", "đọc câu", "đọc to", "nói to"];

function canHandle(intent: string): boolean {
  return SUPPORTED_INTENTS.includes(intent);
}

function extractTextToSpeak(message: string): string {
  const text = message.trim();
  const lower = text.toLowerCase();
  for (const phrase of TRIGGER_PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx !== -1) {
      const rest = text.slice(idx + phrase.length).trim().replace(/^[:\-–]\s*/, "");
      if (rest) return rest;
    }
  }
  return text;
}

async function execute(task: Task): Promise<TaskAgentResult> {
  const text = extractTextToSpeak(task.input);
  const provider = VoiceRouter.resolve(DEFAULT_VOICE_PROVIDER);
  if (!provider) {
    return { success: false, agent: "voice-agent", error: `Không tìm thấy voice provider "${DEFAULT_VOICE_PROVIDER}".` };
  }

  const result = await provider.generate({ text });
  if (result.status === "error" || !result.audioBuffer) {
    return { success: false, agent: "voice-agent", error: result.error ?? "Sinh audio thất bại." };
  }

  const saved = saveVoiceAudio(result.audioBuffer, result.mimeType ?? "audio/mpeg");
  return {
    success: true,
    agent: "voice-agent",
    output: { provider: provider.name, audioUrl: saved.audioUrl, durationMs: result.durationMs, cost: result.cost, text },
  };
}

function metadata(): AgentMetadata {
  return {
    name: "voice-agent",
    supportedIntents: SUPPORTED_INTENTS,
    description: "Generate Voice Audio",
  };
}

export const voiceTaskAgent: TaskAgent = { canHandle, execute, metadata };
