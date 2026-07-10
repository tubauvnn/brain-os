# OpenMontage — Architecture & License Audit

**Purpose:** determine what, if anything, from OpenMontage can inform Brain OS's
Creative Studio video renderer, without importing AGPLv3 code or obligations
into Brain OS (a separate, proprietary codebase).

**Repository:** `https://github.com/calesthio/OpenMontage`
**Cloned to (research-only, outside Brain OS's git tree):** `/root/vendor/OpenMontage`
**Version audited:** no git tags exist upstream; `setup.py` declares
`version="0.1.0"`, `name="openmontage"`, description *"AI-Orchestrated Video
Production Platform"*. HEAD commit `2ab5773ef760b4906821d36514c59fcdf3b8f641`,
committed 2026-07-09.

**Not added to Brain OS git.** `/root/vendor/` is a sibling directory of
`/root/brain-os/` — it is never inside Brain OS's working tree, so it cannot
be accidentally staged/committed regardless of `.gitignore`.

---

## 1. License — AGPLv3, strict, no exceptions

`LICENSE` (34,523 bytes) is the **stock, unmodified GNU Affero GPL v3 full
text** — standard preamble, all 17 numbered sections, ends with the standard
"How to Apply These Terms" footer. Verified:

- No dual-licensing clause.
- No commercial-exception clause.
- No `COPYING`/`NOTICE` file with supplementary/additional terms.
- No mention of an alternate license anywhere in `README.md`,
  `PROJECT_CONTEXT.md`, `CLAUDE.md`, or `AGENTS.md`.
- **Section 13 (the AGPL's network/remote-interaction clause) is present and
  unmodified** — this is the clause that distinguishes AGPL from plain GPL:
  if a modified version of AGPLv3 code is used to provide a service over a
  network, users interacting with it over the network must be offered the
  corresponding source, even without physical distribution of the binary.

### Legal implications for Brain OS

Brain OS is a separate, proprietary/private application. To avoid triggering
AGPLv3 obligations on Brain OS itself:

1. **No verbatim or near-verbatim copying of OpenMontage source**, at any
   size — not a whole file, not a function, not a filter-chain command
   string, not a JSON Schema file. A derivative work under AGPL is still a
   derivative work whether copied exactly or "lightly edited."
2. **Only architectural understanding may cross the boundary** — module
   boundaries, data-shape ideas (e.g. "a timeline is a flat list of cuts with
   a layer enum"), and *which standard, publicly-documented ffmpeg/ASS/SRT
   techniques exist* (e.g. the `xfade`, `zoompan`, `sidechaincompress`,
   `amix` ffmpeg filters; the SRT/VTT/ASS subtitle formats) are public,
   widely-documented, uncopyrightable techniques — not OpenMontage's
   expression of them. This audit and everything built from it treats
   OpenMontage strictly as **Category C — design reference**, never as a
   source of pasted code, per the instructions given for this task.
3. **No OpenMontage file was and will be copied into `src/` or `docs/`** —
   this document is original prose describing what was found, not excerpted
   source.
4. **Brain OS's own dependencies are unaffected.** OpenMontage's own
   dependencies (see §4) are permissively licensed (MIT/BSD/Apache-2.0) —
   nothing transitively imposes AGPL on a library *OpenMontage* depends on;
   the copyleft applies only to OpenMontage's own `.py`/`.tsx` files, which
   is exactly the part Brain OS is not copying.
5. **Conclusion: safe to proceed as a design reference only**, under the
   discipline above. If Brain OS ever wanted to literally run OpenMontage
   code (not just learn from it), that would require either AGPL-licensing
   Brain OS itself or a separate commercial arrangement with the authors —
   out of scope and not being pursued.

---

## 2. Repository orientation

OpenMontage is **not a conventional callable library** — per its own
`PROJECT_CONTEXT.md`/`AGENT_GUIDE.md`, it is explicitly "Instruction-Driven
(Agent-First)": an LLM coding agent (Claude Code/Codex/Cursor) reads YAML
pipeline manifests (`pipeline_defs/*.yaml`) plus Markdown "director" skill
files (`skills/pipelines/<pipeline>/<stage>-director.md`), then invokes
Python `BaseTool` subclasses itself. Quote from the repo: *"No Python
orchestrator, no Python reviewer, no Python handlers. The agent drives the
pipeline."* Pipeline stage state machine: `idea → script → scene_plan →
assets → edit → compose → publish`.

Stack: Python 3.10+ core (`requirements.txt`) + a separate Node/TypeScript
sub-project `remotion-composer/` (React + Remotion).

Top-level module map:

| Path | What it is |
|---|---|
| `backlot/` | Local FastAPI + SSE "living storyboard" dashboard — project-state viewer, not a render engine |
| `ink-theater/` | Standalone character/mocap puppet-animation toy (BVH clips) — unrelated to episode export |
| `remotion-composer/` | The actual React/Remotion rendering app — the real compositor (§6) |
| `lib/` | Shared Python utilities: path resolution, export-profile table, checkpointing, QA scoring, YAML pipeline loader |
| `tools/` | Concrete `BaseTool` implementations: `video/`, `audio/`, `subtitle/`, `graphics/`, `analysis/`, `enhancement/`, `avatar/`, `character/`, `capture/`, `publishers/`, plus `tool_registry.py`/`base_tool.py` |
| `pipeline_defs/` | 13 YAML pipeline manifests (`animated-explainer`, `cinematic`, `documentary-montage`, `talking-head`, `localization-dub`, etc.) |
| `schemas/` | JSON Schemas for every pipeline artifact (`brief`, `script`, `scene_plan`, `edit_decisions`, `asset_manifest`, `render_report`, `cost_log`, ...) |
| `skills/` | Markdown instruction files driving the LLM agent through each stage |
| `styles/` | YAML "style playbook" presets (`cinematic.yaml`, `anime-ghibli.yaml`, ...) |
| `tests/` | pytest: `contracts/` (per-stage schema tests), `tools/` (per-tool unit tests) |

---

## 3. Dependency graph

**`requirements.txt`** (core): `pyyaml` (MIT), `pydantic` (MIT), `jsonschema`
(MIT), `python-dotenv` (BSD), `Pillow` (MIT-CMU/HPND-like), `numpy` (BSD-3),
`requests` (Apache-2.0), `google-auth` (Apache-2.0), `google-genai`
(Apache-2.0), `openai` (Apache-2.0/MIT), `fastapi` (MIT), `uvicorn` (BSD-3),
`watchfiles` (MIT).

**`requirements-gpu.txt`**: `torch`/`torchaudio`/`torchvision` (BSD-3).

**`requirements-dev.txt`**: `pytest`/`pytest-asyncio` (MIT), `httpx` (BSD-3).

**`remotion-composer/package.json`**: `@remotion/captions`, `@remotion/cli`,
`@remotion/google-fonts`, `@remotion/media`, `@remotion/player`,
`@remotion/transitions`, `remotion` — all under Remotion's own
**source-available "Remotion License"** (not an OSI permissive license; has
revenue/company-size thresholds requiring a paid company license for larger
orgs). Irrelevant to Brain OS since Remotion is not being adopted (§6), but
worth noting for completeness. Also `d3-geo`/`topojson-client`/`world-atlas`
(ISC/BSD, map-related, irrelevant), `react`/`react-dom` (MIT).

**Conclusion:** none of OpenMontage's *dependencies* are themselves
copyleft — the AGPLv3 obligation attaches only to OpenMontage's own source,
which Brain OS is not copying (§1).

---

## 4. Production pipelines & providers

13 YAML pipeline manifests under `pipeline_defs/` define end-to-end recipes
(e.g. `animated-explainer`, `cinematic`, `documentary-montage`,
`avatar-spokesperson`, `talking-head`, `character-animation`,
`localization-dub`). Each stage of a pipeline calls into a `BaseTool`
(`tools/base_tool.py`): common fields `name`, `version`, `tier`,
`capability`, `provider`, `stability`, `execution_mode`, `determinism`,
`dependencies`, `input_schema`, returning a `ToolResult`.

**Providers** are concrete `BaseTool` subclasses per external AI service —
`tools/video/{kling,runway,veo,sora,heygen,wan,...}_video.py` (~20 video-gen
providers), equivalent structures under `tools/graphics/` (image) and
elsewhere for TTS — selected via a capability-first "selector" pattern
(`video_selector`).

**This is architecturally similar to Brain OS's own existing pattern**
(`ModelRouter`/`VoiceRouter`/`ImageRouter`, `TaskAgent` registry — Phase
1/3/4) — same inversion-of-control idea, independently arrived at, different
language. Nothing to port; validates the approach Brain OS already uses.
**Classification: C — design reference only (Brain OS already has this).**

External API keys referenced in `.env.example` (none needed for this task —
all out of scope per "no image-to-video provider yet"): `DASHSCOPE_API_KEY`,
`DOUBAO_SPEECH_API_KEY`, `ELEVENLABS_API_KEY`, `FAL_AI_API_KEY`/`FAL_KEY`,
`GOOGLE_API_KEY`/`GOOGLE_APPLICATION_CREDENTIALS`, `HEYGEN_API_KEY`,
`HF_TOKEN`, `HIGGSFIELD_API_KEY`/`_SECRET`, `OPENAI_API_KEY`,
`PEXELS_API_KEY`, `PIXABAY_API_KEY`, `REPLICATE_API_TOKEN`,
`RUNWAY_API_KEY`, `SUNO_API_KEY`, `UNSPLASH_ACCESS_KEY`, `XAI_API_KEY`.

---

## 5. Timeline engine — `schemas/artifacts/edit_decisions.schema.json`

A flat array of **`cuts`**, each: `id`, `source`, `in_seconds`/`out_seconds`,
`speed`, `layer` (enum `primary`/`overlay`/`background`), `transform`
(`scale`, `position`, free-text `animation` like `"ken-burns-slow-zoom"`,
`crop`), `transition_in`/`transition_out`/`transition_duration`, `reason`
(editorial rationale, free text). Top level also carries `overlays` and a
required `render_runtime` field (enum `remotion`/`hyperframes`/`ffmpeg`) —
i.e. every edit decision list declares up front which renderer will execute
it.

This is a generic EDL-like (Edit Decision List) shape, comparable in spirit
to countless timeline formats (e.g. OpenTimelineIO) — not a novel or
copyrightable structure on its own.

**Classification: B — adapt the *shape* (flat clip list + layer + transform
+ transition fields), not the schema file itself**, into Brain OS's own
`Timeline`/`Clip` TypeScript types, aligned to `StoryScene`.

---

## 6. Remotion usage — the real compositor, and why Brain OS is not adopting it

Remotion is **OpenMontage's primary/default renderer, not an optional
extra.** From `video_compose.py`'s own docstring: *"`remotion` → React-based
frame-accurate render via `npx remotion render`. Handles the existing
scene-component stack, word-level captions, TalkingHead/CinematicRenderer.
**Current default.**"* The `ffmpeg` runtime option is explicitly scoped in
their own docs to *"simple video cuts without composition."*

`remotion-composer/src/` contains hand-built React components (`Root.tsx`,
`Explainer.tsx`, `CinematicRenderer.tsx`, `TalkingHead.tsx`, `TitledVideo.tsx`,
`LyricOverlay.tsx`, `CollageBurst.tsx`). Rendering requires **Node.js + a
headless Chromium** (Remotion's runtime dependency) — a materially heavier
stack than plain ffmpeg, and (separately from the AGPL question) Remotion
itself ships under its own non-OSI source-available license.

**Decisive finding for this task:** OpenMontage's real compositing power —
image handling, Ken Burns/pan-zoom, word-level captions, cinematic layouts —
lives almost entirely inside Remotion, not in their ffmpeg path. This is a
hard architectural fork point.

**Classification: D — reject for Brain OS's vertical slice.** The task
requires "FFmpeg locally for the first implementation" with no Chromium/React
render runtime — Brain OS's renderer is built independently starting from
public ffmpeg technique knowledge, informed only distantly (at the level of
"what capabilities to build," not "how the code looks") by what Remotion
provides here.

---

## 7. FFmpeg usage

Invoked via raw `subprocess` calls (a `BaseTool.run_command()` helper, not a
wrapper library like `fluent-ffmpeg`). The two load-bearing files are
`tools/video/video_compose.py` (trim/scale/pad/concat/subtitle-burn/audio-mux)
and `tools/audio/audio_mixer.py` (mixing/ducking/fades).

**Critical finding:** OpenMontage's ffmpeg compose path **explicitly rejects
still images** — `_compose()` raises an error for any still-image cut,
directing the caller to use `operation='render'` (which auto-routes to
Remotion) instead. **There is no ffmpeg-based Ken Burns/zoompan/crossfade
code anywhere in this repository to adapt** — that capability exists only in
the Remotion path (§6), which Brain OS is not adopting. Brain OS's
image-to-video ffmpeg filter chain (`zoompan` for pan/zoom, `xfade` for
crossfade) has to be written from scratch, using standard, publicly
documented ffmpeg filters — there is nothing OpenMontage-specific to extract
here regardless of license.

What *is* directly analogous and safe to be inspired by (public ffmpeg
mechanics, not OpenMontage expression): scale/pad-to-fit + concat-demuxer for
video-clip stitching, and muxing a final audio track onto a video track with
`-shortest`.

**Classification: B for concat/scale/pad/mux mechanics on video clips (public
ffmpeg technique) — not applicable/no code exists for the image+Ken-Burns
case Brain OS actually needs**, which must be original work.

---

## 8. Subtitle pipeline — `tools/subtitle/subtitle_gen.py`

Pure Python, zero external dependencies. Converts word-level timestamps into
SRT, VTT, or caption JSON. Burn-in for the ffmpeg path happens in
`video_compose.py` via ffmpeg's `subtitles` filter (libass) with an ASS
`force_style` string built from standard **ASS/SSA subtitle-format spec
field names** (`FontName`, `FontSize`, `PrimaryColour`, `OutlineColour`,
`BackColour`, `BorderStyle`, `Outline`, `Shadow`, `MarginV`, `Alignment`) —
these are the public subtitle-format specification's own vocabulary, not
OpenMontage's invention.

**Classification: B — adapt.** SRT generation from timed lines, and ffmpeg's
`subtitles` filter + ASS `force_style` for burn-in, is exactly the right
approach for Brain OS and will be reimplemented in original TypeScript using
the same public SRT/ASS techniques.

---

## 9. Audio pipeline (voice sync, background music, sound effects) — `tools/audio/audio_mixer.py`

FFmpeg-based (hard dependency on the `ffmpeg` binary; optional `pydub` for
richer mixing, falling back to ffmpeg-only otherwise). Capabilities: `mix`,
`duck`, `fade`, `normalize`, `extract_audio`, `segmented_music`. Per-track
`volume=`/`afade=t=in/out:d=` filters combined via
`amix=inputs=N:duration=longest:dropout_transition=2`; ducking uses ffmpeg's
`sidechaincompress` filter to automatically lower music under speech. Both
`amix` and `sidechaincompress` are standard, widely-documented public ffmpeg
filters, not OpenMontage inventions.

No explicit voice/scene "sync engine" was found; timing is implicit — visual
cut timing (`in_seconds`/`out_seconds`) is authored/estimated, and the
narration track is muxed onto the final video with `-shortest` (i.e. the
narration track's real length effectively bounds final duration rather than
driving per-scene visual timing). A separate transcriber tool
(`tools/analysis/transcriber.py`) derives word-level timestamps from the
actual voice audio, which is the closest thing to "sync" — and is the one
idea worth adapting: **deriving subtitle/scene timing from the real voice
MP3's measured duration (via `ffprobe`), not from an estimated duration.**

**Classification: B — adapt** the mixing approach (per-track volume/fade →
`amix` → optional `sidechaincompress` ducking) and the
measure-real-audio-duration idea; **C** for everything else.

---

## 10. Asset management — `schemas/artifacts/asset_manifest.schema.json`

Central manifest: `{version, assets[], total_cost_usd, metadata}`, each asset
carrying `id`, `type` (enum `image|video|audio|narration|music|sfx|...`),
`path`, `source_tool`, `scene_id`, optional `prompt`/`seed`/`model`/
`cost_usd`/`duration_seconds`/`resolution`/`quality_score`.

**Brain OS's Phase 4 `GeneratedAsset` Postgres model already covers this
ground and is arguably more capable** — real relational DB (not a JSON
manifest file), content-hash-based exact-dedup/reuse, character/location/prop
tag columns, per-project scoping. The one useful confirmation: their explicit
`scene_id` linkage on every asset matches what Brain OS already does.

**Classification: B — adapt the `scene_id`-linked, typed-asset pattern
(already substantially present in Brain OS); no code to port, no schema gap
to fill.**

---

## 11. Render architecture / render queue

No dedicated async job-queue/retry scheduler was found. `backlot/server.py`
is a local FastAPI dashboard (`/health`, `/projects`, `/projects/{id}/state`,
an SSE `/projects/{id}/events` stream, thumbnail/media serving) — a **live
storyboard viewer**, not a render-job queue with retry semantics.
`lib/checkpoint.py` handles human-approval pauses between pipeline stages, a
different concept. `RetryPolicy`/`ResumeSupport` exist as declarative fields
on `BaseTool` but no evidence of an implemented executing scheduler was
found.

**Brain OS's own Phase 4 `RenderJob` Postgres model (bounded automatic retry
+ explicit manual retry, submit/process split, per-job status) is already
more concrete and reusable than anything in this repository.** Backlot's
SSE-based progress stream is a reasonable *idea* for progress reporting but
porting a whole FastAPI + file-watcher dashboard is out of scope for this
task.

**Classification: D — reject.** Nothing to adapt beyond the general SSE
progress-reporting idea (C at most), and Brain OS's `render-queue/process`
API (built in Phase 4, extended for video in this task) already fits the
role.

---

## 12. Export presets — `lib/media_profiles.py`

The single most directly "portable" file in the repository, in the sense
that it is a plain data table of **public platform video specifications** —
not creative/copyrightable expression. 9 named presets (`youtube_landscape`,
`youtube_shorts`, `instagram_reels`, `instagram_feed`, `tiktok`, `linkedin`,
`cinematic`, `generic_hd`), each `{width, height, aspect_ratio, fps, codec,
audio_codec, crf, pixel_format, max_file_size_mb?, max_duration_seconds?}`.
Notably `youtube_shorts`/`instagram_reels`/`tiktok` are all `1080×1920` —
confirming the exact "vertical" resolution this task's API contract requests
is a standard, well-known preset, not something borrowed from OpenMontage.

**Classification: B — adapt.** An equivalent `EXPORT_PRESETS` table is
written fresh in original TypeScript (own field names/shape), including a
Brain OS-specific `vertical_1080x1920_25fps` preset matching the task's exact
API contract (`1080x1920 @25fps` — OpenMontage's closest presets are all
`@30fps`, not `@25fps`, so this preset is Brain OS-original regardless).

---

## 13. Output storage

`lib/paths.py`: a single source of truth, `PROJECTS_DIR` (default
`REPO_ROOT/projects`, overridable via an env var) — every intermediate
artifact and the final render live under one project-root directory. Their
own comment: *"the projects root is the most load-bearing path in the
system."*

**Classification: B — adapt the pattern, not code.** Brain OS's task spec
already mandates an equivalent convention
(`data/projects/<project>/episodes/<episode>/final.mp4`), and Phase 4's JSON
project store already follows the same "one project = one directory" idea —
this confirms the convention, nothing to port.

---

## 14. Preview generation

No dedicated fast/low-resolution preview render stage exists as a first-class
pipeline concept. "Preview" only appears as a provider-specific parameter
name inside individual AI-video-provider wrapper files.

**Classification: D — reject / not applicable.** Nothing to adapt.

---

## Summary — reuse classification

| Module area | Class | What Brain OS actually does with it |
|---|---|---|
| Timeline representation | **B** | Original `Timeline`/`Clip` TS types, shape informed by their flat cuts+layer+transform idea |
| Scene composition | **C** | Already covered by Brain OS Scene Planner |
| Media asset ingestion | **B** | `scene_id`-linked typed assets — already substantially present via `GeneratedAsset` |
| Image/video/audio tracks | **C** | Confirms a simple layer model is sufficient; nothing to port |
| Transitions | **D** (their ffmpeg path) / **C** (concept) | Crossfade/pan-zoom written from scratch with public `xfade`/`zoompan` filters |
| Subtitles/captions | **B** | Original TS SRT generator + ffmpeg `subtitles`/ASS burn-in |
| Voice/audio sync | **B** (idea only) | Derive timing from real voice MP3 duration via `ffprobe` |
| Background music/SFX | **B** | Original TS mixer using public `amix`/`sidechaincompress`/`afade` filters |
| FFmpeg command generation | **B** (clips) / original (images) | No image/Ken-Burns ffmpeg code exists upstream to adapt at all |
| Remotion usage | **D** | Rejected outright — Chromium runtime, not appropriate for the vertical slice |
| Providers | **C** | Brain OS already has the equivalent Router/registry pattern |
| Render queue | **D** | Brain OS Phase 4 `RenderJob` already more capable |
| Export presets | **B** | Fresh `EXPORT_PRESETS` table, own field names |
| Output storage | **B** | Pattern confirmation only, already matches Brain OS's `data/projects/` convention |
| Preview generation | **D** | Not present as a real feature to reference |

**Net result: nothing is reused directly (Category A is empty, deliberately —
see §1).** Everything adopted (Category B) is re-implemented as original
TypeScript, informed by architectural understanding of module boundaries and
by public, non-copyrightable ffmpeg/SRT/ASS techniques — never by copying
OpenMontage source. The single largest, useful, non-obvious finding is
negative: **OpenMontage's own ffmpeg path cannot do what this task needs**
(image-based slideshows with pan/zoom/crossfade) — that capability lives
exclusively in their Remotion/Chromium path, which is explicitly out of scope
here. Brain OS's ffmpeg image-to-video pipeline is original work from first
principles, not an adaptation.
