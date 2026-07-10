import path from "node:path";
import { runFfmpeg } from "./ffmpeg";
import type { AudioMixResult, AudioMixer as AudioMixerContract, Timeline } from "./types";

// Local AudioMixer — original TypeScript, using only standard public ffmpeg
// filters (`adelay`, `amix`, `sidechaincompress`, `volume`, `atrim`). The
// three-tier approach (per-line delay-placement → amix → optional
// sidechaincompress ducking under music) mirrors the SHAPE of what the audit
// found in OpenMontage's tools/audio/audio_mixer.py (docs/research/
// OPENMONTAGE_AUDIT.md §9, rated "B — adapt the approach"), but every filter
// name/parameter here is public ffmpeg vocabulary, not their code. No music
// is fabricated or downloaded — `musicPath` is only used when the caller
// explicitly supplies a local, already-licensed file.

const MUSIC_VOLUME = 0.15;

async function silence(totalDurationSeconds: number, outPath: string): Promise<AudioMixResult> {
  await runFfmpeg([
    "-f", "lavfi",
    "-i", "anullsrc=r=44100:cl=stereo",
    "-t", totalDurationSeconds.toFixed(3),
    "-c:a", "aac",
    outPath,
  ]);
  return { audioPath: outPath, durationSeconds: totalDurationSeconds };
}

async function musicOnly(musicPath: string, totalDurationSeconds: number, outPath: string): Promise<AudioMixResult> {
  await runFfmpeg([
    "-stream_loop", "-1",
    "-i", musicPath,
    "-filter_complex", `[0:a]volume=${MUSIC_VOLUME},atrim=0:${totalDurationSeconds.toFixed(3)}[out]`,
    "-map", "[out]",
    "-t", totalDurationSeconds.toFixed(3),
    "-c:a", "aac",
    outPath,
  ]);
  return { audioPath: outPath, durationSeconds: totalDurationSeconds };
}

async function mix(timeline: Timeline, workDir: string, musicPath?: string | null): Promise<AudioMixResult> {
  const outPath = path.join(workDir, "audio.m4a");
  const totalDuration = timeline.totalDurationSeconds;

  if (timeline.voiceCues.length === 0) {
    return musicPath ? musicOnly(musicPath, totalDuration, outPath) : silence(totalDuration, outPath);
  }

  const inputArgs: string[] = [];
  const delayed: string[] = [];
  timeline.voiceCues.forEach((cue, i) => {
    inputArgs.push("-i", cue.audioPath);
    const delayMs = Math.max(0, Math.round(cue.startSeconds * 1000));
    delayed.push(`[${i}:a]adelay=${delayMs}:all=1[a${i}]`);
  });
  const voiceLabels = timeline.voiceCues.map((_, i) => `[a${i}]`).join("");

  // apad=whole_dur — amix's natural output chỉ dài tới hết clip thoại CUỐI
  // CÙNG (vd cảnh cuối chỉ có 3s thoại thì amix dừng ở đó), trong khi video
  // track (MediaComposer) luôn dài đúng totalDurationSeconds. Không pad ở
  // đây sẽ khiến `-shortest` ở bước mux cuối (video-exporter.ts) cắt cụt
  // video theo audio ngắn hơn — bug thật đã phát hiện khi test bằng dữ liệu
  // ChinChin thật (video 59.6s bị cắt còn ~39s). Pad tới đúng
  // totalDurationSeconds đảm bảo audio LUÔN đủ dài bằng video.
  const filterParts = [
    ...delayed,
    `${voiceLabels}amix=inputs=${timeline.voiceCues.length}:duration=longest:dropout_transition=2,volume=${timeline.voiceCues.length},apad=whole_dur=${totalDuration.toFixed(3)}[voices]`,
  ];

  let finalLabel = "voices";
  if (musicPath) {
    const musicIndex = timeline.voiceCues.length;
    inputArgs.push("-stream_loop", "-1", "-i", musicPath);
    filterParts.push(`[${musicIndex}:a]volume=${MUSIC_VOLUME}[musicvol]`);
    // Duck nhạc nền dưới lời thoại: sidechaincompress dùng [voices] làm tín
    // hiệu điều khiển để nén [musicvol] mỗi khi có thoại — kỹ thuật ffmpeg
    // công khai, không phải mã của OpenMontage.
    filterParts.push(`[musicvol][voices]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=300[ducked]`);
    filterParts.push(`[voices][ducked]amix=inputs=2:duration=longest:dropout_transition=2[out]`);
    finalLabel = "out";
  }

  await runFfmpeg([
    ...inputArgs,
    "-filter_complex", filterParts.join(";"),
    "-map", `[${finalLabel}]`,
    "-t", totalDuration.toFixed(3),
    "-c:a", "aac",
    outPath,
  ]);

  return { audioPath: outPath, durationSeconds: totalDuration };
}

export const localAudioMixer: AudioMixerContract = { name: "local-ffmpeg-audio-mixer", mix };
