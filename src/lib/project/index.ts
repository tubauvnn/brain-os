// Điểm vào duy nhất mà code ngoài src/lib/project/ nên import.
export { handleProjectRequest, parseOperation } from "./project-agent";
export { getActiveProjectContext, recordProjectEntry } from "./context";
// getProjectById — additive re-export (function already implemented in
// store.ts, just not previously exposed here) — cần cho Episode Renderer
// (src/lib/creative/renderer/storage.ts) tra cứu TÊN project theo id bất kỳ
// (không chỉ project đang active) để đặt tên thư mục output dễ đọc. Không
// đổi hành vi của bất kỳ export nào đã có.
export { getProjectById } from "./store";
export type {
  Project,
  ProjectMetadata,
  ProjectSummary,
  ProjectContext,
  ProjectOperation,
  ProjectAgentResult,
  Episode,
  ImageReference,
  PromptHistoryEntry,
  GeneratedAssetMetadata,
  Note,
  Todo,
} from "./types";
