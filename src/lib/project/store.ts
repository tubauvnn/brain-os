import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { Episode, ImageReference, Project, PromptHistoryEntry } from "./types";

// Local JSON storage — Phase 7: "Do NOT implement databases yet". Mỗi Project
// là 1 file JSON riêng trong data/projects/, cộng 1 file con trỏ
// (_active.json) lưu project nào đang "mở" — persistent qua restart, không
// dựa vào state in-memory. Thư mục data/ đã thêm vào .gitignore (dữ liệu
// runtime của người dùng, không phải source code).

const DATA_DIR = path.join(process.cwd(), "data", "projects");
const ACTIVE_POINTER_PATH = path.join(DATA_DIR, "_active.json");

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function projectFilePath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createProject(name: string): Promise<Project> {
  await ensureDir();
  const now = nowIso();
  const project: Project = {
    metadata: { id: randomUUID(), name, createdAt: now, updatedAt: now },
    storyBible: "",
    characterReferences: [],
    worldSettings: "",
    episodeHistory: [],
    imageReferences: [],
    promptHistory: [],
    generatedAssetsMetadata: [],
    notes: [],
    todos: [],
  };
  await fs.writeFile(projectFilePath(project.metadata.id), JSON.stringify(project, null, 2), "utf-8");
  await setActiveProjectId(project.metadata.id);
  return project;
}

export async function saveProject(project: Project): Promise<Project> {
  await ensureDir();
  project.metadata.updatedAt = nowIso();
  await fs.writeFile(projectFilePath(project.metadata.id), JSON.stringify(project, null, 2), "utf-8");
  return project;
}

export async function getProjectById(id: string): Promise<Project | null> {
  try {
    const raw = await fs.readFile(projectFilePath(id), "utf-8");
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export async function listProjects(): Promise<Project[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const projects: Project[] = [];
  for (const file of files) {
    if (!file.endsWith(".json") || file === "_active.json") continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
      projects.push(JSON.parse(raw) as Project);
    } catch {
      // file hỏng/không đọc được — bỏ qua, không chặn list.
    }
  }
  return projects.sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));
}

export async function findProjectByName(name: string): Promise<Project | null> {
  const all = await listProjects();
  const lower = name.trim().toLowerCase();
  return all.find((p) => p.metadata.name.trim().toLowerCase() === lower) ?? null;
}

export async function setActiveProjectId(id: string | null): Promise<void> {
  await ensureDir();
  await fs.writeFile(ACTIVE_POINTER_PATH, JSON.stringify({ activeProjectId: id }, null, 2), "utf-8");
}

export async function getActiveProjectId(): Promise<string | null> {
  try {
    const raw = await fs.readFile(ACTIVE_POINTER_PATH, "utf-8");
    return (JSON.parse(raw) as { activeProjectId: string | null }).activeProjectId;
  } catch {
    return null;
  }
}

export async function getActiveProject(): Promise<Project | null> {
  const id = await getActiveProjectId();
  if (!id) return null;
  return getProjectById(id);
}

// Ghi kết quả 1 agent (Video/Image/Character/...) vào lịch sử project đang
// mở — cơ chế DUY NHẤT khiến các agent đó "không còn hoạt động cô lập" theo
// đúng yêu cầu Phase 7. category không khớp field nào → bỏ qua an toàn, không
// phá cấu trúc project.
export async function recordToProject(projectId: string, category: string, entry: unknown): Promise<void> {
  const project = await getProjectById(projectId);
  if (!project) return;
  const now = nowIso();

  switch (category) {
    case "episodeHistory": {
      const e = entry as Partial<Episode>;
      project.episodeHistory.push({ id: randomUUID(), title: e.title ?? "", summary: e.summary ?? "", createdAt: now });
      break;
    }
    case "imageReferences": {
      const e = entry as Partial<ImageReference>;
      project.imageReferences.push({
        id: randomUUID(),
        sceneDescription: e.sceneDescription ?? "",
        characters: e.characters ?? [],
        createdAt: now,
      });
      break;
    }
    case "promptHistory": {
      const e = entry as Partial<PromptHistoryEntry>;
      project.promptHistory.push({ id: randomUUID(), prompt: e.prompt ?? "", createdAt: now });
      break;
    }
    case "characterReferences": {
      const names = Array.isArray(entry) ? (entry as string[]) : [String(entry)];
      project.characterReferences = Array.from(new Set([...project.characterReferences, ...names]));
      break;
    }
    default:
      return;
  }

  await saveProject(project);
}
