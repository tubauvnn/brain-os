# Changelog

## Episode Renderer Core — 2026-07-10

Closes the loop on Creative Studio (Phase 4): a story's rendered scene images
+ dialogue can now be turned into an actual playable MP4, locally, via
FFmpeg — no cloud video-generation provider involved yet.

**Added**

- `src/lib/creative/renderer/` — five provider-neutral contracts
  (`TimelineBuilder`, `MediaComposer`, `AudioMixer`, `SubtitleRenderer`,
  `VideoExporter`), each with one concrete "local ffmpeg" implementation:
  - Per-dialogue-line voice synthesis (reuses the existing ElevenLabs Voice
    Provider, character → voice ID resolved via the existing Character
    Agent), timed from real measured audio duration rather than estimates.
  - Image-to-video composition via `zoompan` (pan/zoom) and `xfade`
    (crossfade) — standard public ffmpeg filters.
  - Audio mixing (`adelay`/`amix`, optional `sidechaincompress` ducking under
    background music if a local file is supplied — none is fabricated or
    downloaded).
  - Vietnamese SRT subtitle generation + ffmpeg `subtitles` burn-in.
  - Final MP4 mux/export with a `vertical_1080x1920_25fps` preset (and
    horizontal/square variants).
- `POST /api/creative/episode/render` — turns an already-story-and-image-ready
  episode into a final MP4. Requires scene images to already be rendered
  (via the existing Render Queue); does not duplicate that step.
- `EpisodeRenderJob` Postgres model (additive) — durable per-render audit
  trail (status/progress/output path/duration/cost).
- `docs/research/OPENMONTAGE_AUDIT.md` — architecture/license audit of
  `github.com/calesthio/OpenMontage` (AGPLv3), used as a design reference
  only. Its decisive finding: OpenMontage's real image-compositing power
  lives in Remotion (a Chromium-dependent renderer, their default) — their
  ffmpeg-only path explicitly rejects still images, so there was no
  ffmpeg/Ken-Burns code to adapt. This renderer is original TypeScript,
  informed only by public ffmpeg/SRT/ASS techniques.

**Fixed (found via real test render)**

- `AudioMixer`'s voice-only mix wasn't padded to the full timeline duration,
  so the final mux's `-shortest` flag silently truncated a crossfaded
  59.6s video down to ~39s. Fixed with an `apad=whole_dur=...` filter.

**Verified**

- Real end-to-end render using ChinChin canon characters, Story Agent
  output, real OpenAI-generated scene images, real ElevenLabs voice, and
  burned-in Vietnamese subtitles → `data/projects/chinchin/episodes/
  openmontage-test/final.mp4` (1080×1920, h264/aac, 59.6s).
- No Phase 1-4 regression (`/robot`, existing chat intents, existing
  Creative Studio APIs all unchanged).

**Deferred on purpose** — no video-generation provider (Veo/Kling/Wan/
fal.ai) yet; no chat/Orchestrator intent wiring (REST API only, to avoid
touching Phase 3's intent-resolver priorities).
