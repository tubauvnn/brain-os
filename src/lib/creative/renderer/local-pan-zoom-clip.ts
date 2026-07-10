import { runFfmpeg } from "./ffmpeg";

// Shared pan/zoom clip renderer — extracted from media-composer.ts (pure
// move, zero behavior change) so the SAME implementation backs two callers:
//   1. media-composer.ts's own internal per-scene render (unchanged use).
//   2. src/lib/video/providers/local-pan-zoom.ts — wraps this exact function
//      behind the provider-neutral VideoProvider contract (Phase 5), so
//      "local rendering" is a real, selectable provider peer to OpenMontage/
//      future direct providers, not a hardcoded special case anywhere.
//
// Original work (docs/research/OPENMONTAGE_AUDIT.md §7/§10/§11 — OpenMontage
// has no ffmpeg-based Ken Burns/image code to reference at all). Standard
// public `zoompan` ffmpeg filter only.

const ZOOM_TARGET = 1.15;

export type PanZoomClipInput = {
  imagePath: string;
  durationSeconds: number;
  resolution: { width: number; height: number };
  fps: number;
  outPath: string;
};

export async function renderPanZoomClip(input: PanZoomClipInput): Promise<void> {
  const { width, height } = input.resolution;
  const totalFrames = Math.max(2, Math.round(input.durationSeconds * input.fps));
  const zoomStep = (ZOOM_TARGET - 1) / totalFrames;

  const scaledW = Math.round(width * 1.2);
  const scaledH = Math.round(height * 1.2);

  const vf = [
    `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase`,
    `crop=${scaledW}:${scaledH}`,
    `zoompan=z='min(zoom+${zoomStep.toFixed(6)},${ZOOM_TARGET})':d=1:s=${width}x${height}:fps=${input.fps}`,
    "format=yuv420p",
  ].join(",");

  await runFfmpeg([
    "-loop", "1",
    "-framerate", String(input.fps),
    "-t", input.durationSeconds.toFixed(3),
    "-i", input.imagePath,
    "-vf", vf,
    "-r", String(input.fps),
    "-an",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    input.outPath,
  ]);
}
