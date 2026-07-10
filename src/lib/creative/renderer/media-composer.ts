import fs from "node:fs/promises";
import path from "node:path";
import { runFfmpeg, probeVideo } from "./ffmpeg";
import { renderPanZoomClip } from "./local-pan-zoom-clip";
import type { MediaComposeResult, MediaComposer as MediaComposerContract, Timeline } from "./types";

// Local MediaComposer — ORIGINAL work, not adapted from OpenMontage.
// docs/research/OPENMONTAGE_AUDIT.md §7/§10/§11 found their ffmpeg path
// explicitly REJECTS still images (routes to Remotion/Chromium instead,
// which Brain OS is not adopting) — there is no image/Ken-Burns/xfade ffmpeg
// code in that repo at all to reference. This implementation uses only
// standard, publicly documented ffmpeg filters: `zoompan` for pan/zoom and
// `xfade` for crossfade, chained across N clips with the well-known public
// xfade-chaining offset formula (each transition's offset = running output
// duration so far minus the crossfade length).
//
// Known limitation (documented, not hidden): crossfading shortens total
// output duration by (clipCount-1) * crossfadeDurationSeconds versus the
// Timeline's raw/pre-crossfade cumulative offsets that voice/subtitle cues
// use — with a small crossfade (0.4s) and a handful of scenes this drift is
// under ~1s over a short episode, acceptable for this vertical slice. Longer
// multi-scene episodes would need voice/subtitle cues recomputed against the
// post-crossfade timeline — noted as follow-up work.

// Công thức xfade chuỗi công khai, chuẩn ffmpeg (không phải kỹ thuật riêng
// của OpenMontage — xem docs/research/OPENMONTAGE_AUDIT.md §6, họ không có
// đoạn code này): offset của transition thứ k = tổng thời lượng output tích
// luỹ tới lúc đó trừ đi độ dài crossfade.
function buildCrossfadeFilter(clipDurations: number[], crossfadeSeconds: number): { filterComplex: string; outputLabel: string; totalDurationSeconds: number } {
  if (clipDurations.length === 1) {
    return { filterComplex: "", outputLabel: "0:v", totalDurationSeconds: clipDurations[0] };
  }

  let running = clipDurations[0];
  let prevLabel = "0:v";
  const parts: string[] = [];

  for (let i = 1; i < clipDurations.length; i++) {
    const offset = Math.max(0, running - crossfadeSeconds);
    const outLabel = i === clipDurations.length - 1 ? "vout" : `v${i}`;
    parts.push(`[${prevLabel}][${i}:v]xfade=transition=fade:duration=${crossfadeSeconds.toFixed(3)}:offset=${offset.toFixed(3)}[${outLabel}]`);
    running = running + clipDurations[i] - crossfadeSeconds;
    prevLabel = outLabel;
  }

  return { filterComplex: parts.join(";"), outputLabel: "vout", totalDurationSeconds: running };
}

async function compose(timeline: Timeline, workDir: string, precomposedClips?: Record<string, string>): Promise<MediaComposeResult> {
  if (timeline.clips.length === 0) throw new Error("Timeline không có clip nào để compose.");

  const clipsDir = path.join(workDir, "clips");
  await fs.mkdir(clipsDir, { recursive: true });

  const clipPaths: string[] = [];
  for (const clip of timeline.clips) {
    const precomposed = precomposedClips?.[clip.sceneId];
    if (precomposed) {
      clipPaths.push(precomposed);
      continue;
    }
    const outPath = path.join(clipsDir, `scene-${String(clip.index).padStart(3, "0")}.mp4`);
    await renderPanZoomClip({ imagePath: clip.imagePath, durationSeconds: clip.durationSeconds, resolution: timeline.resolution, fps: timeline.fps, outPath });
    clipPaths.push(outPath);
  }

  const visualPath = path.join(workDir, "visual.mp4");
  const durations = timeline.clips.map((c) => c.durationSeconds);

  if (clipPaths.length === 1) {
    await fs.copyFile(clipPaths[0], visualPath);
  } else {
    const { filterComplex, outputLabel } = buildCrossfadeFilter(durations, timeline.crossfadeDurationSeconds);
    const inputArgs = clipPaths.flatMap((p) => ["-i", p]);
    await runFfmpeg([
      ...inputArgs,
      "-filter_complex", filterComplex,
      "-map", `[${outputLabel}]`,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", String(timeline.fps),
      visualPath,
    ]);
  }

  const probed = await probeVideo(visualPath);
  return { videoPath: visualPath, durationSeconds: probed.durationSeconds };
}

export const localMediaComposer: MediaComposerContract = { name: "local-ffmpeg-media-composer", compose };
