import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Không dùng wrapper npm (vd fluent-ffmpeg) — gọi binary trực tiếp qua
// child_process, cùng quy ước "raw call, no SDK" đã áp dụng cho mọi provider
// khác trong codebase (src/lib/model/providers/openai.ts,
// src/lib/voice/providers/elevenlabs.ts, src/lib/creative/image-provider/
// providers/openai-image.ts). Yêu cầu binary `ffmpeg`/`ffprobe` có sẵn trên
// máy (đã cài qua apt) — KHÔNG bundle/tải ffmpeg, KHÔNG phải code kế thừa từ
// OpenMontage (xem docs/research/OPENMONTAGE_AUDIT.md — OpenMontage cũng gọi
// ffmpeg qua subprocess thô, nhưng đây là cách làm chuẩn công khai của mọi dự
// án dùng ffmpeg, không phải kỹ thuật riêng của họ).

const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000; // 1 lần gọi ffmpeg cho 1 clip/mix ngắn không nên lâu hơn 5 phút
const MAX_BUFFER_BYTES = 32 * 1024 * 1024;

class FfmpegNotFoundError extends Error {
  constructor(bin: string) {
    super(`Không tìm thấy binary "${bin}" trên hệ thống — cài qua "apt-get install ffmpeg" trước khi dùng Episode Renderer.`);
    this.name = "FfmpegNotFoundError";
  }
}

async function runBinary(bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(bin, args, { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: MAX_BUFFER_BYTES });
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string };
    if (err.code === "ENOENT") throw new FfmpegNotFoundError(bin);
    const stderrTail = (err.stderr ?? "").split("\n").filter(Boolean).slice(-20).join("\n");
    throw new Error(`${bin} thất bại: ${err.message}${stderrTail ? `\n${stderrTail}` : ""}`);
  }
}

export async function runFfmpeg(args: string[]): Promise<void> {
  await runBinary("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
}

type FfprobeFormat = { format?: { duration?: string; size?: string }; streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }> };

async function probeJson(filePath: string): Promise<FfprobeFormat> {
  const { stdout } = await runBinary("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  return JSON.parse(stdout) as FfprobeFormat;
}

// Đo thời lượng THẬT (giây) — dùng để lấy timing chính xác từ file voice mp3
// đã tổng hợp thay vì tin ước lượng của Scene Planner (ý tưởng duy nhất "adapt
// được" từ OpenMontage ở mảng audio sync — xem audit §8/9).
export async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const data = await probeJson(filePath);
  const raw = data.format?.duration;
  const seconds = raw ? Number(raw) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Không đọc được thời lượng media hợp lệ từ "${filePath}".`);
  }
  return seconds;
}

export async function probeVideo(filePath: string): Promise<{ durationSeconds: number; width?: number; height?: number; hasAudio: boolean }> {
  const data = await probeJson(filePath);
  const durationSeconds = Number(data.format?.duration ?? NaN);
  const videoStream = data.streams?.find((s) => s.codec_type === "video");
  const hasAudio = !!data.streams?.some((s) => s.codec_type === "audio");
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Không đọc được thời lượng video hợp lệ từ "${filePath}".`);
  }
  return { durationSeconds, width: videoStream?.width, height: videoStream?.height, hasAudio };
}
