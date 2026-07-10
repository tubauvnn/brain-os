// Điểm vào duy nhất mà code ngoài src/lib/creative/ (API routes) nên import —
// không import trực tiếp từ story/scene-planner/prompt-builder/... ở nơi
// khác. Cùng quy ước src/lib/video/index.ts, src/lib/image/index.ts (Phase
// 3, không sửa).

export { createEpisode, getEpisode, listEpisodes } from "./episode-service";
export { buildScenePrompt } from "./prompt-builder/prompt-builder";
export { enqueueSceneJob, processQueue, retryJob, listJobs } from "./render-queue/render-queue";
export { estimateEpisodeCost, getLatestCostEstimate } from "./cost-manager/cost-manager";
export { listAssets } from "./asset-manager/asset-manager";
export { publicUrlForPath } from "./asset-manager/storage";
export { getProjectCreativeMemory } from "./project-memory/project-memory";
export { renderEpisode } from "./renderer/episode-render-service";

export type { StoryOutline, StoryDialogueLine, StorySceneSeed, StoryAgentResult } from "./story/types";
export type { PlannedScene, ScenePlan } from "./scene-planner/types";
export type { ScenePromptInput, ScenePromptResult } from "./prompt-builder/types";
export type { ProjectCreativeMemory, ProjectCreativeAssetSummary } from "./project-memory/types";
export type { RenderEpisodeInput, RenderEpisodeResult } from "./renderer/episode-render-service";
