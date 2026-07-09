import { getActiveProjectContext, recordProjectEntry } from "@/lib/project";
import type { ContextProvider, ProjectRecorder } from "../types";

// Project Integration — 2 adapter mỏng bọc Project Agent (src/lib/project/,
// KHÔNG sửa gì ở đó) để khớp 2 seam tuỳ chọn của Orchestrator (ContextProvider/
// ProjectRecorder, xem orchestrator.ts). Đây là NƠI DUY NHẤT Orchestrator
// "biết" Project Agent tồn tại — qua composition root (registry.ts), không
// phải import trực tiếp trong orchestrator.ts.

async function getContext(): Promise<Record<string, unknown> | null> {
  return getActiveProjectContext();
}

async function record(projectId: string, category: string, entry: unknown): Promise<void> {
  await recordProjectEntry(projectId, category, entry);
}

export const projectContextProvider: ContextProvider = { getContext };
export const projectRecorder: ProjectRecorder = { record };
