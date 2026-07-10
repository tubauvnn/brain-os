import type { ExportPreset } from "./types";

// Export preset table — original values (own field names/shape). Informed by
// the audit's finding (docs/research/OPENMONTAGE_AUDIT.md §12) that these are
// public, factual platform video specs (not copyrightable expression) shared
// across every video tool, not something borrowed from OpenMontage.
// "vertical_1080x1920_25fps" matches this task's exact API contract
// (OpenMontage's closest presets are the same 1080x1920 resolution but at
// 30fps, not 25fps — so this preset is Brain OS-specific regardless).

export const EXPORT_PRESETS: Record<string, ExportPreset> = {
  vertical_1080x1920_25fps: {
    name: "vertical_1080x1920_25fps",
    width: 1080,
    height: 1920,
    fps: 25,
    videoCodec: "libx264",
    audioCodec: "aac",
    crf: 20,
    pixelFormat: "yuv420p",
  },
  horizontal_1920x1080_25fps: {
    name: "horizontal_1920x1080_25fps",
    width: 1920,
    height: 1080,
    fps: 25,
    videoCodec: "libx264",
    audioCodec: "aac",
    crf: 20,
    pixelFormat: "yuv420p",
  },
  square_1080x1080_25fps: {
    name: "square_1080x1080_25fps",
    width: 1080,
    height: 1080,
    fps: 25,
    videoCodec: "libx264",
    audioCodec: "aac",
    crf: 20,
    pixelFormat: "yuv420p",
  },
};

const FORMAT_TO_PRESET_KEY: Record<string, string> = {
  vertical: "vertical_1080x1920_25fps",
  horizontal: "horizontal_1920x1080_25fps",
  square: "square_1080x1080_25fps",
};

// Request body luôn truyền resolution/fps tường minh (đúng hợp đồng API) —
// preset ở đây chỉ cho width/height/fps mặc định + các tham số encode
// (codec/crf/pixelFormat) theo "format", resolution/fps thật lấy từ request.
export function buildExportPreset(format: string, resolution: { width: number; height: number }, fps: number): ExportPreset {
  const base = EXPORT_PRESETS[FORMAT_TO_PRESET_KEY[format] ?? "vertical_1080x1920_25fps"];
  return { ...base, width: resolution.width, height: resolution.height, fps };
}
