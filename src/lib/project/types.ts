// Project/Workspace Agent contracts. Brain OS "nhớ" các dự án sáng tạo dài
// hạn — lưu local JSON (Phase 7: "Do NOT implement databases yet"), KHÔNG
// Postgres, KHÔNG external API. Mỗi Project là nguồn ngữ cảnh chung mà Video
// Agent/Image Agent/Character Agent nhận tự động qua Task Orchestrator (xem
// src/lib/orchestrator/), không tự cô lập nữa.

export type ProjectMetadata = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Episode = { id: string; title: string; summary: string; createdAt: string };
export type ImageReference = { id: string; sceneDescription: string; characters: string[]; createdAt: string };
export type PromptHistoryEntry = { id: string; prompt: string; createdAt: string };
export type GeneratedAssetMetadata = { id: string; type: string; description: string; createdAt: string };
export type Note = { id: string; content: string; createdAt: string };
export type Todo = { id: string; content: string; done: boolean; createdAt: string };

// Project Model — đúng 10 mục Phase 7 yêu cầu lưu trữ.
export type Project = {
  metadata: ProjectMetadata;
  storyBible: string;
  characterReferences: string[];
  worldSettings: string;
  episodeHistory: Episode[];
  imageReferences: ImageReference[];
  promptHistory: PromptHistoryEntry[];
  generatedAssetsMetadata: GeneratedAssetMetadata[];
  notes: Note[];
  todos: Todo[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
  episodeCount: number;
  imageReferenceCount: number;
  notesCount: number;
  todosCount: number;
};

// Project Context — bản tóm tắt read-only, Orchestrator tự gắn vào Task của
// MỌI agent (Video/Image/Character/...) khi có project đang mở. Không phải
// toàn bộ Project (tránh rò rỉ dữ liệu không liên quan như notes/todos nội bộ
// vào prompt agent khác).
export type ProjectContext = {
  id: string;
  name: string;
  storyBible: string;
  worldSettings: string;
  characterReferences: string[];
};

export type ProjectOperation =
  | { type: "create"; name: string }
  | { type: "open"; name: string }
  | { type: "save" }
  | { type: "list" }
  | { type: "update"; note: string };

export type ProjectAgentResult =
  | { success: true; operation: "create" | "open" | "save" | "update"; project: ProjectSummary }
  | { success: true; operation: "list"; projects: ProjectSummary[] }
  | { success: false; operation: ProjectOperation["type"]; error: string };
