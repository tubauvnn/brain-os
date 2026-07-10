import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CostEstimateResult, CreateVideoInput, HealthCheckResult, VideoJob, VideoProvider } from "../provider-types";

// OpenMontageAdapter — ONE implementation of VideoProvider, not the center
// of this architecture. It delegates entirely to OpenMontage
// (https://github.com/calesthio/OpenMontage, GNU AGPLv3), which is itself an
// ORCHESTRATION framework with no video-generation model of its own — it
// routes to whichever downstream AI provider (Fal.ai/Veo/Kling/Wan/MiniMax/
// Runway/Higgsfield/HeyGen/...) has credentials configured in ITS OWN .env.
// This file knows nothing about any of those downstream vendors — it only
// speaks OpenMontage's tool contract (via the bridge script below). Direct
// providers that skip OpenMontage entirely (calling Fal/Veo/Kling APIs
// themselves) are equally valid VideoProvider implementations and would
// live as sibling files here — see docs/VIDEO_PROVIDER.md.
//
// Attribution / license: OpenMontage is licensed GNU AGPLv3. No OpenMontage
// source is copied into Brain OS (a separate, proprietary codebase) — this
// adapter runs OpenMontage as an independent OS process (subprocess, JSON
// over stdout/files), the same arm's-length relationship Brain OS already
// has with the `ffmpeg` binary. See docs/research/OPENMONTAGE_AUDIT.md for
// the full license analysis and docs/VIDEO_PROVIDER.md for how this adapter
// is wired. The bridge script it invokes
// (OPENMONTAGE_DIR/brainos_bridge.py) is a small Brain OS-authored glue
// script that lives next to the OpenMontage checkout, outside Brain OS's
// git tree — never committed here.

const execFileAsync = promisify(execFile);

const DEFAULT_OPENMONTAGE_DIR = "/root/vendor/OpenMontage";
const SYNC_CALL_TIMEOUT_MS = 20_000; // health/estimate — pure local scoring, no network call, should be fast
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;

function openMontageDir(): string {
  return process.env.OPENMONTAGE_DIR || DEFAULT_OPENMONTAGE_DIR;
}

function pythonBin(): string {
  return path.join(openMontageDir(), ".venv", "bin", "python3");
}

function bridgeScript(): string {
  return path.join(openMontageDir(), "brainos_bridge.py");
}

function jobsRoot(): string {
  return path.join(process.cwd(), "data", "video-jobs");
}

// KHÔNG kế thừa process.env đầy đủ khi spawn subprocess — Node's
// spawn()/execFile() mặc định truyền NGUYÊN process.env của Brain OS
// (gồm OPENAI_API_KEY/ELEVENLABS_API_KEY dùng cho chat/ảnh/giọng nói) cho
// tiến trình con. Phát hiện THẬT khi test: OpenMontage's sora_video tool coi
// OPENAI_API_KEY bị "leak" này là credential hợp lệ, tự báo available, và
// VideoSelector chọn nó gọi thật (chỉ thất bại do validate duration trước
// khi tốn phí, may mắn, KHÔNG phải do cô lập đúng). OpenMontage chỉ được
// phép thấy credential nó TỰ cấu hình trong .env riêng của nó (đọc qua
// _load_dotenv() trong tools/base_tool.py) — không phải credential của
// Brain OS. Chỉ truyền PATH/HOME (cần để tìm binary/tìm venv), không truyền
// bất kỳ biến môi trường nào khác của Brain OS.
function isolatedEnv(): NodeJS.ProcessEnv {
  // NODE_ENV không phải secret, không ảnh hưởng gì tới Python/OpenMontage —
  // chỉ đưa vào vì @types/node khai NODE_ENV là field bắt buộc của
  // NodeJS.ProcessEnv, không phải vì cần thiết.
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV };
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.HOME) env.HOME = process.env.HOME;
  return env;
}

function jobDir(jobId: string): string {
  return path.join(jobsRoot(), jobId);
}

async function runBridgeSync(args: string[]): Promise<{ stdout: string; ok: boolean; error?: string }> {
  try {
    const { stdout } = await execFileAsync(pythonBin(), [bridgeScript(), ...args], {
      timeout: SYNC_CALL_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
      env: isolatedEnv(),
    });
    return { stdout, ok: true };
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string };
    if (err.code === "ENOENT") {
      return { stdout: "", ok: false, error: `Không tìm thấy OpenMontage venv/python tại "${pythonBin()}" — chưa setup (xem docs/VIDEO_PROVIDER.md).` };
    }
    const stderrTail = (err.stderr ?? "").split("\n").filter(Boolean).slice(-10).join("\n");
    return { stdout: "", ok: false, error: `OpenMontage bridge lỗi: ${err.message}${stderrTail ? `\n${stderrTail}` : ""}` };
  }
}

type BridgeHealthJson = { available: boolean; status: string; providers: Array<{ name: string; provider: string; status: string }> };
type BridgeEstimateJson = { costUsd: number; estimatedRuntimeSeconds: number; healthy: boolean };
type BridgeStatusJson = { status: string; progress: number; outputPath?: string; costUsd?: number; durationSeconds?: number; error?: string };

async function healthCheck(): Promise<HealthCheckResult> {
  const result = await runBridgeSync(["health"]);
  if (!result.ok) return { available: false, reason: result.error };

  let parsed: BridgeHealthJson;
  try {
    parsed = JSON.parse(result.stdout) as BridgeHealthJson;
  } catch {
    return { available: false, reason: "OpenMontage bridge trả về JSON không hợp lệ." };
  }

  if (!parsed.available) {
    const checked = parsed.providers.map((p) => p.name).join(", ");
    return {
      available: false,
      reason: `Không có downstream video-generation provider nào khả dụng trong OpenMontage (đã kiểm tra: ${checked}). Cấu hình 1 API key (vd FAL_KEY) trong ${openMontageDir()}/.env để bật.`,
      details: { providers: parsed.providers },
    };
  }

  return { available: true, details: { providers: parsed.providers } };
}

async function estimateCost(input: CreateVideoInput): Promise<CostEstimateResult> {
  const args = ["estimate", "--prompt", input.prompt];
  if (input.imagePath) args.push("--image", input.imagePath);
  if (input.durationSeconds) args.push("--duration", String(input.durationSeconds));
  if (input.aspectRatio) args.push("--aspect-ratio", input.aspectRatio);

  const result = await runBridgeSync(args);
  if (!result.ok) return { costUsd: 0, healthy: false };

  try {
    const parsed = JSON.parse(result.stdout) as BridgeEstimateJson;
    return { costUsd: parsed.costUsd, estimatedRuntimeSeconds: parsed.estimatedRuntimeSeconds, healthy: parsed.healthy };
  } catch {
    return { costUsd: 0, healthy: false };
  }
}

async function readStatusFile(id: string): Promise<BridgeStatusJson | null> {
  try {
    const raw = await fs.readFile(path.join(jobDir(id), "status.json"), "utf-8");
    return JSON.parse(raw) as BridgeStatusJson;
  } catch {
    return null;
  }
}

function mapStatus(status: string): VideoJob["status"] {
  if (status === "running" || status === "queued" || status === "completed" || status === "failed" || status === "cancelled") return status;
  return "failed";
}

async function createVideo(input: CreateVideoInput): Promise<VideoJob> {
  // Kiểm tra health TRƯỚC — nếu không có provider nào khả dụng, trả lỗi rõ
  // ràng NGAY, không tốn 1 subprocess Python cho việc chắc chắn sẽ fail
  // (health/estimate/create đều tự chạy check này, nhưng làm ở đây tránh
  // spawn tiến trình con detached vô ích).
  const health = await healthCheck();
  const jobId = randomUUID();

  if (!health.available) {
    return { jobId, status: "failed", progress: 0, error: health.reason ?? "OpenMontage không khả dụng." };
  }

  const dir = jobDir(jobId);
  await fs.mkdir(dir, { recursive: true });

  const args = [
    bridgeScript(),
    "create",
    "--job-dir", dir,
    "--prompt", input.prompt,
    "--output", input.outputPath,
  ];
  if (input.imagePath) args.push("--image", input.imagePath);
  if (input.durationSeconds) args.push("--duration", String(input.durationSeconds));
  if (input.aspectRatio) args.push("--aspect-ratio", input.aspectRatio);

  const child = spawn(pythonBin(), args, { detached: true, stdio: "ignore", env: isolatedEnv() });
  child.unref();
  await fs.writeFile(path.join(dir, "pid.txt"), String(child.pid ?? ""), "utf-8");

  return { jobId, status: "queued", progress: 0 };
}

async function getJob(jobId: string): Promise<VideoJob> {
  const status = await readStatusFile(jobId);
  if (!status) return { jobId, status: "queued", progress: 0 };

  return {
    jobId,
    status: mapStatus(status.status),
    progress: status.progress,
    outputPath: status.outputPath,
    costUsd: status.costUsd,
    durationSeconds: status.durationSeconds,
    error: status.error,
  };
}

async function cancelJob(jobId: string): Promise<VideoJob> {
  const dir = jobDir(jobId);
  try {
    const pidRaw = await fs.readFile(path.join(dir, "pid.txt"), "utf-8");
    const pid = Number(pidRaw.trim());
    if (Number.isFinite(pid) && pid > 0) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Tiến trình đã kết thúc rồi — không sao, coi như cancel thành công.
      }
    }
  } catch {
    // Không có pid.txt — job chưa từng spawn hoặc đã dọn dẹp, vẫn đánh dấu cancelled.
  }

  const cancelled: BridgeStatusJson = { status: "cancelled", progress: 0, error: "Đã huỷ theo yêu cầu." };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "status.json"), JSON.stringify(cancelled), "utf-8");

  return { jobId, status: "cancelled", progress: 0 };
}

export const openMontageAdapter: VideoProvider = {
  name: "openmontage-adapter",
  createVideo,
  getJob,
  cancelJob,
  estimateCost,
  healthCheck,
};
