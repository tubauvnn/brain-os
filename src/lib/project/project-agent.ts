import { randomUUID } from "crypto";
import {
  createProject,
  findProjectByName,
  getActiveProject,
  listProjects,
  saveProject,
  setActiveProjectId,
} from "./store";
import type { Project, ProjectAgentResult, ProjectOperation, ProjectSummary } from "./types";

// Project Agent — deterministic (KHÔNG gọi model/API ngoài, cùng nguyên tắc
// Intent Resolver/Video Planner): tách message thành 1 trong 5 operation
// (create/open/save/update/list) bằng khớp cụm từ, rồi gọi store.ts (JSON
// storage). "update" là fallback an toàn cho câu không khớp create/open/save/
// list — ghi thành 1 note vào project đang mở, không bịa hành vi khác.

const CREATE_PHRASES = ["tạo dự án", "tạo project", "create project"];
const OPEN_PHRASES = ["mở dự án", "mở project", "open project"];
const SAVE_PHRASES = ["lưu dự án", "save project"];
const LIST_PHRASES = ["danh sách dự án", "list project", "list projects"];

function matchNameAfter(original: string, lower: string, phrases: string[]): string | null {
  for (const phrase of phrases) {
    const idx = lower.indexOf(phrase);
    if (idx !== -1) {
      return original.slice(idx + phrase.length).trim().replace(/^[:\-–]\s*/, "");
    }
  }
  return null;
}

export function parseOperation(message: string): ProjectOperation {
  const text = message.trim();
  const lower = text.toLowerCase();

  const createName = matchNameAfter(text, lower, CREATE_PHRASES);
  if (createName !== null) return { type: "create", name: createName || "Dự án mới" };

  const openName = matchNameAfter(text, lower, OPEN_PHRASES);
  if (openName !== null) return { type: "open", name: openName };

  if (LIST_PHRASES.some((p) => lower.includes(p))) return { type: "list" };
  if (SAVE_PHRASES.some((p) => lower.includes(p))) return { type: "save" };

  return { type: "update", note: text };
}

function summarize(p: Project): ProjectSummary {
  return {
    id: p.metadata.id,
    name: p.metadata.name,
    updatedAt: p.metadata.updatedAt,
    episodeCount: p.episodeHistory.length,
    imageReferenceCount: p.imageReferences.length,
    notesCount: p.notes.length,
    todosCount: p.todos.length,
  };
}

export async function handleProjectRequest(message: string): Promise<ProjectAgentResult> {
  const op = parseOperation(message);

  switch (op.type) {
    case "create": {
      const project = await createProject(op.name);
      return { success: true, operation: "create", project: summarize(project) };
    }

    case "open": {
      const project = await findProjectByName(op.name);
      if (!project) return { success: false, operation: "open", error: `Không tìm thấy dự án "${op.name}".` };
      await setActiveProjectId(project.metadata.id);
      return { success: true, operation: "open", project: summarize(project) };
    }

    case "save": {
      const project = await getActiveProject();
      if (!project) return { success: false, operation: "save", error: "Chưa có dự án nào đang mở." };
      const saved = await saveProject(project);
      return { success: true, operation: "save", project: summarize(saved) };
    }

    case "list": {
      const projects = await listProjects();
      return { success: true, operation: "list", projects: projects.map(summarize) };
    }

    case "update": {
      const project = await getActiveProject();
      if (!project) return { success: false, operation: "update", error: "Chưa có dự án nào đang mở để cập nhật." };
      project.notes.push({ id: randomUUID(), content: op.note, createdAt: new Date().toISOString() });
      const saved = await saveProject(project);
      return { success: true, operation: "update", project: summarize(saved) };
    }
  }
}
