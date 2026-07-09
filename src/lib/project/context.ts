import { getActiveProject, recordToProject } from "./store";
import type { ProjectContext } from "./types";

// Cầu nối duy nhất giữa Project Agent và Task Orchestrator's ContextProvider/
// ProjectRecorder (src/lib/orchestrator/types.ts) — Orchestrator chỉ biết 2
// contract đó, KHÔNG import store.ts trực tiếp (giữ IoC, xem
// agents/project-integration.ts).

export async function getActiveProjectContext(): Promise<ProjectContext | null> {
  const project = await getActiveProject();
  if (!project) return null;
  return {
    id: project.metadata.id,
    name: project.metadata.name,
    storyBible: project.storyBible,
    worldSettings: project.worldSettings,
    characterReferences: project.characterReferences,
  };
}

export async function recordProjectEntry(projectId: string, category: string, entry: unknown): Promise<void> {
  await recordToProject(projectId, category, entry);
}
