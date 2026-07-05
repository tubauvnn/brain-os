import { prisma } from "@/lib/prisma";
import type { BrainContext, BuildBrainContextParams } from "./types";

// Context cho AI provider — chỉ lấy dữ liệu đã lọc theo access_level, không bao giờ
// gửi toàn bộ database. PrivateMemory chỉ được đưa vào khi accessLevel >= 3 (owner_only).
export async function buildBrainContext({
  projectId,
  accessLevel = 1,
  deviceId,
  limit = 5,
}: BuildBrainContextParams = {}): Promise<BrainContext> {
  const [profile, preferences, memories, privateMemories, decisions, projects, tasks, recentMessages] =
    await Promise.all([
      prisma.profile.findFirst({ select: { name: true, alias: true } }),
      prisma.preference.findMany({
        take: limit,
        orderBy: { updated_at: "desc" },
        select: { key: true, value: true },
      }),
      prisma.memory.findMany({
        where: { ...(projectId ? { project_id: projectId } : {}), access_level: { lte: 1 } },
        orderBy: [{ pinned: "desc" }, { created_at: "desc" }],
        take: limit,
        select: { title: true, content: true },
      }),
      accessLevel >= 3
        ? prisma.privateMemory.findMany({
            orderBy: { created_at: "desc" },
            take: limit,
            select: { title: true, content: true },
          })
        : Promise.resolve([]),
      prisma.decision.findMany({
        where: { ...(projectId ? { project_id: projectId } : {}), status: "active" },
        orderBy: { decided_at: "desc" },
        take: limit,
        select: { title: true, outcome: true },
      }),
      prisma.project.findMany({
        where: { status: "active" },
        orderBy: { pinned: "desc" },
        take: limit,
        select: { name: true, description: true },
      }),
      prisma.task.findMany({
        where: {
          ...(projectId ? { project_id: projectId } : {}),
          status: { in: ["todo", "in_progress"] },
        },
        orderBy: { priority: "desc" },
        take: limit,
        select: { title: true, status: true },
      }),
      deviceId
        ? prisma.conversationMessage.findMany({
            where: { device_id: deviceId },
            orderBy: { created_at: "desc" },
            take: 5,
            select: { role: true, content: true },
          })
        : Promise.resolve([]),
    ]);

  return {
    profile,
    preferences,
    memories,
    private_memories: privateMemories,
    decisions,
    projects,
    tasks,
    recent_messages: recentMessages.reverse(),
  };
}

const MAX_CONTEXT_CHARS = 8000;

export function contextToPromptText(context: BrainContext): string {
  const lines: string[] = [];
  if (context.profile) {
    lines.push(`Chủ hệ thống: ${context.profile.name}${context.profile.alias ? ` (${context.profile.alias})` : ""}`);
  }
  if (context.preferences.length > 0) {
    lines.push("Tuỳ chỉnh hệ thống:");
    context.preferences.forEach((p) => lines.push(`- ${p.key}: ${p.value}`));
  }
  if (context.projects.length > 0) {
    lines.push("Project đang chạy:");
    context.projects.forEach((p) => lines.push(`- ${p.name}${p.description ? `: ${p.description}` : ""}`));
  }
  if (context.tasks.length > 0) {
    lines.push("Task đang mở:");
    context.tasks.forEach((t) => lines.push(`- [${t.status}] ${t.title}`));
  }
  if (context.decisions.length > 0) {
    lines.push("Quyết định gần đây:");
    context.decisions.forEach((d) => lines.push(`- ${d.title}${d.outcome ? ` → ${d.outcome}` : ""}`));
  }
  if (context.memories.length > 0) {
    lines.push("Trí nhớ liên quan:");
    context.memories.forEach((m) => lines.push(`- ${m.title}: ${m.content}`));
  }
  if (context.private_memories.length > 0) {
    lines.push("Trí nhớ riêng tư (chỉ dùng nếu phù hợp, không tiết lộ lan man):");
    context.private_memories.forEach((m) => lines.push(`- ${m.title}: ${m.content}`));
  }
  if (context.recent_messages.length > 0) {
    lines.push("Hội thoại gần đây:");
    context.recent_messages.forEach((m) =>
      lines.push(`- ${m.role === "user" ? "Người dùng" : "Robot"}: ${m.content}`)
    );
  }

  const text = lines.join("\n");
  if (text.length > MAX_CONTEXT_CHARS) {
    return `${text.slice(0, MAX_CONTEXT_CHARS)}\n...(context bị cắt bớt, vượt giới hạn ${MAX_CONTEXT_CHARS} ký tự)`;
  }
  return text;
}
