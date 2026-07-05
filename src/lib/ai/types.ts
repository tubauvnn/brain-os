export type BrainContext = {
  profile: { name: string; alias: string | null } | null;
  preferences: { key: string; value: string }[];
  memories: { title: string; content: string }[];
  private_memories: { title: string; content: string }[];
  decisions: { title: string; outcome: string | null }[];
  projects: { name: string; description: string | null }[];
  tasks: { title: string; status: string }[];
  recent_messages: { role: "user" | "robot"; content: string }[];
};

export type BuildBrainContextParams = {
  projectId?: string;
  accessLevel?: number;
  deviceId?: string;
  limit?: number;
};

export type AiProviderName = "gemini" | "fallback";

// Provider trả về cho client có thêm "fallback_429" — phân biệt fallback do chưa
// cấu hình Gemini với fallback do Gemini bị rate-limit (429).
export type ResponseProvider = AiProviderName | "fallback_429";

export type AiReply = { text: string; provider: AiProviderName };

export interface AiProvider {
  name: AiProviderName;
  generateReply(userText: string, context: BrainContext): Promise<string>;
}
