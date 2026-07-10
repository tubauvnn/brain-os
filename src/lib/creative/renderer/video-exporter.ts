import fs from "node:fs/promises";
import path from "node:path";
import { probeVideo, runFfmpeg } from "./ffmpeg";
import type { VideoExportInput, VideoExportResult, VideoExporter as VideoExporterContract } from "./types";

// Local VideoExporter — final mux: silent visual track (MediaComposer) +
// mixed audio track (AudioMixer) + subtitle burn filter (SubtitleRenderer) +
// export preset params, in one ffmpeg call. Original TypeScript, standard
// ffmpeg mux/encode flags only.
async function exportVideo(input: VideoExportInput): Promise<VideoExportResult> {
  await fs.mkdir(path.dirname(input.outputPath), { recursive: true });

  const { preset } = input;
  await runFfmpeg([
    "-i", input.visualTrackPath,
    "-i", input.audioTrackPath,
    "-vf", `${input.subtitle.burnFilter},scale=${preset.width}:${preset.height}`,
    "-map", "0:v",
    "-map", "1:a",
    "-c:v", preset.videoCodec,
    "-crf", String(preset.crf),
    "-pix_fmt", preset.pixelFormat,
    "-r", String(preset.fps),
    "-c:a", preset.audioCodec,
    "-b:a", "192k",
    "-shortest",
    input.outputPath,
  ]);

  const probed = await probeVideo(input.outputPath);
  return { outputPath: input.outputPath, durationSeconds: probed.durationSeconds };
}

export const localVideoExporter: VideoExporterContract = { name: "local-ffmpeg-video-exporter", export: exportVideo };
