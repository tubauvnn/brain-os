import { localTimelineBuilder } from "./timeline-builder";
import { localMediaComposer } from "./media-composer";
import { localAudioMixer } from "./audio-mixer";
import { localSubtitleRenderer } from "./subtitle-renderer";
import { localVideoExporter } from "./video-exporter";
import type { AudioMixer, MediaComposer, SubtitleRenderer, TimelineBuilder, VideoExporter } from "./types";

// Composition point resolving the concrete "local ffmpeg" implementation for
// each of the 5 provider-neutral contracts — same IoC idea as ImageRouter/
// VoiceRouter (1 file, not per-contract routers, since there's exactly one
// implementation per contract today; mirrors the codebase's own stated
// policy for Model Router: "chỉ 1 Provider đăng ký, chọn nó ... generalize
// dần"). episode-render-service.ts imports only these getters, never the
// concrete impl files directly — a future non-ffmpeg VideoExporter swaps in
// here without touching the orchestration code.

export function getTimelineBuilder(): TimelineBuilder {
  return localTimelineBuilder;
}

export function getMediaComposer(): MediaComposer {
  return localMediaComposer;
}

export function getAudioMixer(): AudioMixer {
  return localAudioMixer;
}

export function getSubtitleRenderer(): SubtitleRenderer {
  return localSubtitleRenderer;
}

export function getVideoExporter(): VideoExporter {
  return localVideoExporter;
}
