// Episode Renderer contracts — provider-neutral, same IoC shape as
// ImageGeneratorProvider/VoiceProvider (src/lib/creative/image-provider/,
// src/lib/voice/, both Phase 1/3/4, unmodified): interface first, concrete
// "local ffmpeg" implementation second (registry.ts). A future non-ffmpeg
// VideoExporter (e.g. a cloud render service) implements the same interface
// without callers changing. Original design — informed by, but not copied
// from, OpenMontage (see docs/research/OPENMONTAGE_AUDIT.md, AGPLv3, design
// reference only).

export type TimelineSubtitleCue = {
  index: number;
  character: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
};

export type TimelineVoiceCue = {
  index: number;
  character: string;
  audioPath: string;
  startSeconds: number;
  durationSeconds: number;
  costUsd?: number;
};

export type TimelineClip = {
  sceneId: string;
  index: number;
  imagePath: string;
  startSeconds: number;
  durationSeconds: number;
};

// Timeline — raw/pre-crossfade cumulative offsets (clips concatenated with
// zero overlap). MediaComposer applies crossfadeDurationSeconds itself when
// compositing; voice/subtitle cues intentionally use these SAME raw offsets
// (not crossfade-shortened ones) — see media-composer.ts for the known,
// documented small-drift tradeoff this implies over many scenes.
export type Timeline = {
  episodeId: string;
  clips: TimelineClip[];
  voiceCues: TimelineVoiceCue[];
  subtitleCues: TimelineSubtitleCue[];
  totalDurationSeconds: number;
  crossfadeDurationSeconds: number;
  resolution: { width: number; height: number };
  fps: number;
};

export type ExportPreset = {
  name: string;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  crf: number;
  pixelFormat: string;
};

export type TimelineSceneInput = {
  id: string;
  index: number;
  imagePath: string;
  estimatedDurationSeconds: number;
  dialogue: Array<{ character: string; line: string }>;
};

export type TimelineBuildInput = {
  episodeId: string;
  scenes: TimelineSceneInput[];
  resolution: { width: number; height: number };
  fps: number;
  // Thư mục làm việc tạm — TimelineBuilder cần ghi voice mp3 tổng hợp ra đĩa
  // để đo thời lượng thật (ffprobe) trước khi trả Timeline.
  workDir: string;
};

export interface TimelineBuilder {
  readonly name: string;
  build(input: TimelineBuildInput): Promise<Timeline>;
}

export type MediaComposeResult = { videoPath: string; durationSeconds: number };
export interface MediaComposer {
  readonly name: string;
  compose(timeline: Timeline, workDir: string): Promise<MediaComposeResult>;
}

export type AudioMixResult = { audioPath: string; durationSeconds: number };
export interface AudioMixer {
  readonly name: string;
  mix(timeline: Timeline, workDir: string, musicPath?: string | null): Promise<AudioMixResult>;
}

export type SubtitleRenderResult = { srtPath: string; burnFilter: string };
export interface SubtitleRenderer {
  readonly name: string;
  render(timeline: Timeline, workDir: string): Promise<SubtitleRenderResult>;
}

export type VideoExportInput = {
  visualTrackPath: string;
  audioTrackPath: string;
  subtitle: SubtitleRenderResult;
  preset: ExportPreset;
  outputPath: string;
};
export type VideoExportResult = { outputPath: string; durationSeconds: number };
export interface VideoExporter {
  readonly name: string;
  export(input: VideoExportInput): Promise<VideoExportResult>;
}
