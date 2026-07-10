import fs from "node:fs/promises";
import path from "node:path";
import type { SubtitleRenderResult, SubtitleRenderer as SubtitleRendererContract, Timeline, TimelineSubtitleCue } from "./types";

// Local SubtitleRenderer — original TypeScript writing the public SRT
// format, plus an ffmpeg `subtitles` filter (libass) burn-in string built
// from standard ASS/SSA style-spec field names (FontName/FontSize/
// PrimaryColour/OutlineColour/BorderStyle/Outline/Shadow/MarginV/Alignment —
// the subtitle format specification's own public vocabulary). The audit
// (docs/research/OPENMONTAGE_AUDIT.md §8) rated "SRT generation + ffmpeg
// subtitles filter + ASS force_style" as B — adapt the APPROACH; this file
// does not contain any OpenMontage code.

function pad(n: number, width = 2): string {
  return String(Math.floor(n)).padStart(width, "0");
}

function toSrtTimestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = Math.floor(clamped % 60);
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

function buildSrt(cues: TimelineSubtitleCue[]): string {
  return cues
    .map((cue, i) => {
      const number = i + 1;
      const start = toSrtTimestamp(cue.startSeconds);
      const end = toSrtTimestamp(Math.max(cue.endSeconds, cue.startSeconds + 0.5));
      const text = `${cue.character}: ${cue.text}`;
      return `${number}\n${start} --> ${end}\n${text}\n`;
    })
    .join("\n");
}

// Escape path cho tham số `subtitles=<path>` của ffmpeg — dấu `:` và `\`
// trong đường dẫn cần escape đúng cú pháp filtergraph, gotcha công khai đã
// biết của ffmpeg (không riêng gì OpenMontage).
function escapeFfmpegFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function buildBurnFilter(srtPath: string): string {
  const escaped = escapeFfmpegFilterPath(srtPath);
  const style = [
    "FontName=Arial",
    "FontSize=20",
    "PrimaryColour=&H00FFFFFF",
    "OutlineColour=&H00000000",
    "BorderStyle=1",
    "Outline=2",
    "Shadow=0",
    "MarginV=80",
    "Alignment=2",
  ].join(",");
  return `subtitles='${escaped}':force_style='${style}'`;
}

async function render(timeline: Timeline, workDir: string): Promise<SubtitleRenderResult> {
  const srtPath = path.join(workDir, "subtitles.srt");
  const srt = buildSrt(timeline.subtitleCues);
  await fs.writeFile(srtPath, srt, "utf-8");
  return { srtPath, burnFilter: buildBurnFilter(srtPath) };
}

export const localSubtitleRenderer: SubtitleRendererContract = { name: "local-srt-subtitle-renderer", render };
