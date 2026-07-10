# VideoProvider — provider-neutral image-to-video contract

Phase 5. `src/lib/video/provider-types.ts` defines the ONLY contract Brain OS
orchestration calls for image-to-video generation:

```ts
interface VideoProvider {
  readonly name: string;
  createVideo(input: CreateVideoInput): Promise<VideoJob>;
  getJob(jobId: string): Promise<VideoJob>;
  cancelJob(jobId: string): Promise<VideoJob>;
  estimateCost(input: CreateVideoInput): Promise<CostEstimateResult>;
  healthCheck(): Promise<HealthCheckResult>;
}
```

`createVideo()` returns immediately with a job (`queued`/`running`, or
already `completed` — nothing in the contract requires work to be slow).
Callers poll `getJob()` until a terminal status (`completed`/`failed`/
`cancelled`). This is the same async-job shape regardless of whether the
underlying work takes 200ms (local rendering) or several minutes (a real
cloud video-generation API).

## Architecture — OpenMontage is one adapter, not the center

```
VideoProvider (Brain OS contract, src/lib/video/provider-types.ts)
        |
        |-- OpenMontageAdapter (providers/openmontage.ts)
        |         |
        |         '-- OpenMontage (external, AGPLv3) -> whichever downstream
        |             AI provider IT has configured (Fal.ai/Veo/Kling/Wan/
        |             MiniMax/Runway/Higgsfield/HeyGen/...)
        |
        |-- LocalPanZoomVideoProvider (providers/local-pan-zoom.ts)
        |         '-- local ffmpeg pan/zoom (no AI motion, always available)
        |
        '-- (future) direct providers — Veo/Kling/Wan/fal.ai/MiniMax calling
              their own REST APIs directly, bypassing OpenMontage entirely
```

`src/lib/video/video-provider-registry.ts` holds an **ordered list** and
exposes `selectHealthyProvider()` — the first provider whose `healthCheck()`
passes wins. Callers (`src/lib/creative/renderer/scene-video-provider.ts`)
only ever call this selection function — never a concrete provider file,
never a name-based branch. "Falling back to local rendering" is not special
cased anywhere: the local provider being selected *is* the fallback, through
the exact same code path as any other provider.

This is deliberate, per explicit direction: **OpenMontage must never be the
canonical/central VideoProvider.** It is one interchangeable adapter. A
future direct provider (calling Fal.ai/Veo/Kling/Wan/MiniMax's own REST API,
with no dependency on OpenMontage at all) is exactly as valid, registered the
same way, with zero changes to the contract, the registry's selection logic,
or `scene-video-provider.ts`.

## Adding a new provider

1. New file `src/lib/video/providers/<name>.ts` implementing `VideoProvider`.
   No other file in `src/lib/video/` or `src/lib/creative/renderer/` may
   name or import this file except the registry.
2. One line in `video-provider-registry.ts`'s `PROVIDERS` array, in whatever
   priority order makes sense (e.g. a fast/cheap real provider before a
   slower/pricier one, or before the OpenMontage adapter if you'd rather
   Brain OS call that vendor directly).
3. Nothing else changes — `scene-video-provider.ts`, `episode-render-
   service.ts`, and `media-composer.ts` are all already provider-agnostic.

## OpenMontageAdapter — what it actually does and doesn't do

OpenMontage (`https://github.com/calesthio/OpenMontage`, GNU AGPLv3) has no
video-generation model of its own — it's an orchestration framework that
routes to downstream AI providers via their own API keys, or a local GPU
model. `docs/research/OPENMONTAGE_AUDIT.md` has the full architecture/license
audit; this section covers the Phase 5 integration specifically.

**No OpenMontage source is copied into Brain OS.** The adapter
(`src/lib/video/providers/openmontage.ts`) runs OpenMontage as a separate OS
process — the same arm's-length relationship Brain OS already has with the
`ffmpeg` binary:

- `/root/vendor/OpenMontage/brainos_bridge.py` — a small Brain OS-authored
  glue script (NOT part of OpenMontage, NOT committed to Brain OS git — it
  lives next to the OpenMontage checkout, outside Brain OS's source tree)
  that imports OpenMontage's real `tools.tool_registry` /
  `tools.video.video_selector.VideoSelector` classes and exposes three CLI
  subcommands (`health`, `estimate`, `create`) as JSON.
- `VideoSelector` is OpenMontage's own capability-level router: it
  auto-discovers every registered `capability="video_generation"` tool
  (19 found in the current checkout: kling/veo/runway/wan/minimax/heygen/
  higgsfield/sora/hunyuan/cogvideo/...) and its own `get_status()` returns
  AVAILABLE if *any* of them is. Calling this ONE tool (not a specific
  vendor file) keeps `OpenMontageAdapter` vendor-agnostic even as
  OpenMontage itself gains/loses downstream providers.
- Setup required to actually generate real video through this adapter:
  `/root/vendor/OpenMontage/.venv` (already created, `pip install -r
  requirements.txt`), plus **at least one downstream provider credential**
  in `/root/vendor/OpenMontage/.env` — the simplest is `FAL_KEY` (unlocks
  Veo/Kling/MiniMax/Recraft through one fal.ai key). Without one,
  `healthCheck()` correctly and honestly reports `available: false` — this
  project's standing rule is "no mock provider," so `createVideo()` fails
  with a clear, real reason rather than fabricating a clip.
- Job tracking: `createVideo()` spawns the bridge's `create` subcommand
  detached, writes `data/video-jobs/<jobId>/{status.json,pid.txt}` (already
  covered by the repo's `/data/` gitignore rule — no Postgres model needed,
  this is provider-internal bookkeeping). `getJob()` reads `status.json`;
  `cancelJob()` sends `SIGTERM` to the recorded PID.
- **Credential isolation (real bug found and fixed during Phase 5 testing):**
  the subprocess is spawned with an explicitly minimal environment (`PATH`/
  `HOME` only, `isolatedEnv()` in `openmontage.ts`) — NOT Brain OS's full
  `process.env`. Node's `spawn()`/`execFile()` inherit the parent's full
  environment by default; the first real test run before this fix showed
  Brain OS's own `OPENAI_API_KEY` (configured for chat/image generation)
  leaking into the child process, which made OpenMontage's `sora_video` tool
  think it had a valid credential, get selected by `VideoSelector`, and
  attempt a real call — it only failed on a duration-parameter validation
  error before any billed generation occurred (no cost incurred, verified via
  the job status files). OpenMontage must only ever see credentials it was
  deliberately configured with in its own `.env` file (loaded by its own
  `tools/base_tool.py::_load_dotenv()`), never Brain OS's.

## LocalPanZoomVideoProvider

Wraps the Episode Renderer Core's existing ffmpeg pan/zoom clip renderer
(`src/lib/creative/renderer/local-pan-zoom-clip.ts`, extracted from
`media-composer.ts`, zero behavior change) behind the `VideoProvider`
contract. Always healthy (only needs the `ffmpeg` binary), zero cost, no AI
motion — this is what actually renders scenes in this deployment right now,
since no downstream key is configured.
