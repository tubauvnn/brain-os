// Điểm vào duy nhất mà code ngoài src/lib/project/ nên import.
export { handleProjectRequest, parseOperation } from "./project-agent";
export { getActiveProjectContext, recordProjectEntry } from "./context";
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
