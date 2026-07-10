import fs from "node:fs/promises";
import path from "node:path";
import { getProjectById } from "@/lib/project";

// Output storage — "one project = one directory" convention (already how
// Phase 7's JSON project store and Phase 4's episode data model both work;
// docs/research/OPENMONTAGE_AUDIT.md §13 confirms this is a sound, standard
// pattern, nothing to port — just a confirmation). Everything lives under
// data/projects/ (already gitignored, /data/ in .gitignore).

const PROJECTS_ROOT = path.join(process.cwd(), "data", "projects");

const COMBINING_DIACRITICS_RANGE_START = 0x0300;
const COMBINING_DIACRITICS_RANGE_END = 0x036f;

function stripDiacritics(input: string): string {
  return Array.from(input.normalize("NFD"))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < COMBINING_DIACRITICS_RANGE_START || code > COMBINING_DIACRITICS_RANGE_END;
    })
    .join("");
}

function slugify(name: string): string {
  const slug = stripDiacritics(name.trim().toLowerCase().replace(/đ/g, "d"))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

// projectId null/không tìm thấy → thư mục "no-project" (episode không gắn
// project nào, Phase 4 vẫn cho phép điều này).
async function resolveProjectSlug(projectId: string | null): Promise<string> {
  if (!projectId) return "no-project";
  const project = await getProjectById(projectId);
  return project ? slugify(project.metadata.name) : slugify(projectId);
}

export type EpisodeRenderPaths = {
  outputDir: string;
  finalPath: string;
  workDir: string;
};

// episodeDirName mặc định = episodeId, nhưng nhận override tường minh (dùng
// cho bài test Step 8, cần đúng path
// data/projects/chinchin/episodes/openmontage-test/final.mp4 theo yêu cầu).
export async function resolveEpisodeRenderPaths(
  projectId: string | null,
  episodeId: string,
  episodeDirName?: string,
): Promise<EpisodeRenderPaths> {
  const projectSlug = await resolveProjectSlug(projectId);
  const outputDir = path.join(PROJECTS_ROOT, projectSlug, "episodes", episodeDirName ?? episodeId);
  const workDir = path.join(outputDir, "_work");
  await fs.mkdir(workDir, { recursive: true });
  return { outputDir, finalPath: path.join(outputDir, "final.mp4"), workDir };
}

export async function cleanupWorkDir(workDir: string): Promise<void> {
  try {
    await fs.rm(workDir, { recursive: true, force: true });
  } catch {
    // Dọn dẹp thất bại không nên làm hỏng kết quả render đã thành công —
    // chỉ bỏ qua, final.mp4 vẫn còn nguyên.
  }
}
