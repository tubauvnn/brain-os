import fs from "fs/promises";
import path from "path";
import { getActiveProjectId } from "./store";

// Continuity record — Phase 6B. "Nối bộ nhớ quan hệ và trạng thái công việc
// vào Chuối." Đây là 1 RECORD trong CÙNG Project Memory (data/projects/,
// src/lib/project/store.ts) — không phải 1 hệ thống lưu trữ mới: cùng thư
// mục, cùng kiểu file JSON, cùng nguyên tắc với "_active.json" (con trỏ dự
// án đang mở) đã có sẵn từ Phase 7. Khác với per-project file (nội dung
// sáng tạo: storyBible/episodeHistory/...), file này theo dõi tiến độ CÔNG
// VIỆC XÂY DỰNG Brain OS/Robot OS (phase/task/blocker) — 1 record duy nhất,
// không phải theo từng project sáng tạo.

const CONTINUITY_PATH = path.join(process.cwd(), "data", "projects", "_continuity.json");

export type ContinuityState = {
  activeProjectId: string | null;
  currentPhase: string;
  currentTask: string;
  lastCompletedAction: string;
  nextRecommendedAction: string;
  blockedBy: string[];
  updatedAt: string;
};

// Giá trị khởi tạo lần đầu — phản ánh tiến độ THẬT tại thời điểm Phase 6B bắt
// đầu (xác nhận qua git log, không bịa). Sau lần đọc đầu tiên, file được ghi
// lại và mọi lần sau đọc thẳng từ đĩa — updateContinuity() (gọi qua
// /api/robot/continuity hoặc agent nội bộ) là cách DUY NHẤT thay đổi từ đây.
const SEED_CONTINUITY: Omit<ContinuityState, "activeProjectId" | "updatedAt"> = {
  currentPhase: "Phase 6B — Relationship Memory & Continuity",
  currentTask: "Nối bộ nhớ quan hệ (People) và trạng thái công việc (continuity record) vào Chuối",
  lastCompletedAction:
    "Phase 6A hoàn tất: /robot dùng pipeline Brain OS thật (Conversation Agent → Intent Resolver → Orchestrator/Memory/Device Manager) và có Robot Personality layer",
  nextRecommendedAction: "Kiểm thử đầy đủ Phase 6B rồi cập nhật roadmap cho bước tiếp theo",
  blockedBy: [],
};

async function ensureDir(): Promise<void> {
  await fs.mkdir(path.dirname(CONTINUITY_PATH), { recursive: true });
}

// activeProjectId LUÔN lấy giá trị SỐNG từ Project Memory (getActiveProjectId())
// mỗi lần đọc, không lưu cứng trong file — tránh lệch khi người dùng đổi dự
// án đang mở ở nơi khác (vd /projects) mà không qua updateContinuity().
export async function getContinuity(): Promise<ContinuityState> {
  const liveActiveProjectId = await getActiveProjectId();
  try {
    const raw = await fs.readFile(CONTINUITY_PATH, "utf-8");
    const parsed = JSON.parse(raw) as ContinuityState;
    return { ...parsed, activeProjectId: liveActiveProjectId };
  } catch {
    const seeded: ContinuityState = {
      ...SEED_CONTINUITY,
      activeProjectId: liveActiveProjectId,
      updatedAt: new Date().toISOString(),
    };
    await ensureDir();
    await fs.writeFile(CONTINUITY_PATH, JSON.stringify(seeded, null, 2), "utf-8");
    return seeded;
  }
}

export async function updateContinuity(patch: Partial<Omit<ContinuityState, "updatedAt">>): Promise<ContinuityState> {
  const current = await getContinuity();
  const next: ContinuityState = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await ensureDir();
  await fs.writeFile(CONTINUITY_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
