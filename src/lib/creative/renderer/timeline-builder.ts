import path from "node:path";
import { synthesizeDialogueLines } from "./voice-synthesis";
import type { Timeline, TimelineBuildInput, TimelineBuilder as TimelineBuilderContract, TimelineClip, TimelineSubtitleCue, TimelineVoiceCue } from "./types";

// Local TimelineBuilder — original design (docs/research/OPENMONTAGE_AUDIT.md
// §5 rates OpenMontage's edit_decisions.schema.json shape "B: adapt the
// shape, not the file" — this is that adaptation: a flat, ordered clip list
// with cumulative offsets, informed by but not copied from their EDL). Per
// scene: synthesize each dialogue line's voice (voice-synthesis.ts) to get
// REAL measured duration, lay lines out back-to-back with a small gap, then
// take the scene's slot duration as max(actual voice time, Scene Planner's
// estimate) — a scene never gets cut off mid-line.

const LINE_GAP_SECONDS = 0.35;
const SCENE_PADDING_SECONDS = 0.6;
const DEFAULT_CROSSFADE_SECONDS = 0.4;

async function build(input: TimelineBuildInput): Promise<Timeline> {
  const voiceWorkDir = path.join(input.workDir, "voice");

  const clips: TimelineClip[] = [];
  const voiceCues: TimelineVoiceCue[] = [];
  const subtitleCues: TimelineSubtitleCue[] = [];

  let cumulativeOffset = 0;
  let globalLineIndex = 0;

  for (const scene of input.scenes) {
    const lineInputs = scene.dialogue.map((d, i) => ({ index: globalLineIndex + i, character: d.character, text: d.line }));
    const synthesized = lineInputs.length ? await synthesizeDialogueLines(lineInputs, voiceWorkDir) : [];

    let lineOffset = cumulativeOffset;
    for (const line of synthesized) {
      voiceCues.push({ index: line.index, character: line.character, audioPath: line.audioPath, startSeconds: lineOffset, durationSeconds: line.durationSeconds, costUsd: line.costUsd });
      subtitleCues.push({ index: line.index, character: line.character, text: line.text, startSeconds: lineOffset, endSeconds: lineOffset + line.durationSeconds });
      lineOffset += line.durationSeconds + LINE_GAP_SECONDS;
    }

    const voiceSpanSeconds = synthesized.length > 0 ? lineOffset - cumulativeOffset - LINE_GAP_SECONDS + SCENE_PADDING_SECONDS : 0;
    const sceneDuration = Math.max(voiceSpanSeconds, scene.estimatedDurationSeconds);

    clips.push({ sceneId: scene.id, index: scene.index, imagePath: scene.imagePath, startSeconds: cumulativeOffset, durationSeconds: sceneDuration });

    cumulativeOffset += sceneDuration;
    globalLineIndex += lineInputs.length;
  }

  return {
    episodeId: input.episodeId,
    clips,
    voiceCues,
    subtitleCues,
    totalDurationSeconds: cumulativeOffset,
    // Chỉ crossfade khi có >=2 clip — 1 clip đơn không có gì để chuyển cảnh.
    crossfadeDurationSeconds: clips.length > 1 ? DEFAULT_CROSSFADE_SECONDS : 0,
    resolution: input.resolution,
    fps: input.fps,
  };
}

export const localTimelineBuilder: TimelineBuilderContract = { name: "local-ffmpeg-timeline-builder", build };
