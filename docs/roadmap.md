# Brain OS Roadmap

This is the authoritative roadmap. Earlier "Phase 5/6/7" naming used during
incremental development has been retired — everything built after the
original Phase 2 (Device Layer) is consolidated into Phase 3 (Agent Runtime).

## Status

- ✅ **Phase 1 — Brain Core** — Complete
- ✅ **Phase 2 — Device Layer** — Complete
- ✅ **Phase 3 — Agent Runtime** — Complete
- ✅ **Phase 4 — Creative Studio** — Core complete (Video Provider deferred)
- ⬜ Phase 5 — Robot OS — Pending
- ⬜ Phase 6 — Automation OS — Pending
- ⬜ Phase 7 — Learning OS — Pending
- ⬜ Phase 8 — Ecosystem — Pending

## Phase 1 — Brain Core ✅

Conversation Agent, Intent Resolver, Model Router (OpenAI), Voice Provider
(ElevenLabs), Memory, Knowledge, Activity Log, health endpoints
(`/api/health`, `/api/health/db`).

## Phase 2 — Device Layer ✅

Device Manager (runtime orchestration, IoC provider registry), Device
Command/Result contracts, Mock Robot Provider, `/api/device-manager/devices`,
`/api/device-manager/command` — kept fully independent from the pre-existing
Physical Device Registry (`/api/devices`).

## Phase 3 — Agent Runtime ✅

Central multi-agent execution layer sitting between Intent Resolver and
agent execution:

- **Task Orchestrator** (`src/lib/orchestrator/orchestrator.ts`) — central
  execution engine, IoC-pure (imports only its own contracts).
- **Agent Registry** (`src/lib/orchestrator/agents/registry.ts`) — the one
  composition root that knows which concrete agents/providers exist.
- **Agent Selection** — `canHandle(intent)` filtering, registration order
  determines multi-step plan order (e.g. a future Character → Image → Video
  → Voice chain requires zero Orchestrator changes).
- **Execution Pipeline** — sequential execution, JSON Execution Plan,
  fail-fast on business failure, output chaining via `payload.previousOutput`.
- **Common Agent interface** (`TaskAgent`: `canHandle`/`execute`/`metadata`)
  — implemented uniformly by all six agents below.
- **Video Agent** — Story/Scene/Prompt planner → mock generator provider.
- **Character/IP Agent** — canonical Character Model + Character Memory +
  Consistency Checker, wired to the official ChinChin visual canon
  (`assets/chinchin/characters/`).
- **Image Agent** — structured Prompt Pack JSON, sources all character data
  from Character Agent (never invents details), canon-locked.
- **Voice Agent** — wraps the existing Voice Provider (ElevenLabs) through
  the Orchestrator; previously a stub reply, now a real execution path.
- **Generic Tool Agent** — deterministic calculator + datetime, proving the
  `TaskAgent` contract generalizes beyond creative agents.
- **Project Context propagation** — `ContextProvider` seam; every agent's
  `Task` automatically carries `payload.projectContext` when a project is
  open, with zero per-agent wiring.
- **Asset propagation** — `AssetProvider` seam; any agent's `Task`
  automatically carries `payload.assets` (character canon image references)
  whenever the input mentions a known character.
- **Error handling** — `agent.execute()` exceptions are caught and converted
  into structured failures; never crash the Orchestrator or the API.
- **Retry mechanism** — bounded retry (2 attempts) on thrown exceptions only,
  never on deterministic business failures.
- **Execution history** — in-memory ring buffer of the last 50 runs,
  `TaskOrchestrator.getExecutionHistory()`.
- **Activity Log** — every stage of every agent's lifecycle logged to
  Postgres (`task.created` → `agent.selected` → `agent.started` →
  `agent.completed` → `task.completed`, plus per-agent detail logs).

All three IoC seams (`ContextProvider`, `ProjectRecorder`, `AssetProvider`)
default to no-ops when unregistered — the Orchestrator's core file never
imports a single concrete agent or provider.

## Phase 4 — Creative Studio ✅ (core)

A real, persistent, cost-aware episode-production pipeline
(`src/lib/creative/`, `src/app/api/creative/**`) sitting alongside Phase 3's
Agent Runtime — additive only, no Phase 1-3 file's behavior changed:

- **Story Agent** (`story/story-agent.ts`) — real content, not a template:
  calls Model Router (`ModelRouter`, Phase 1/3, unmodified) with the
  Character Agent's canonical cast (`resolveCharacters`, Phase 3, unmodified)
  injected as context, so generated dialogue never invents characters outside
  canon. Strict JSON outline (title/logline/theme/scenes/dialogue), parsed
  defensively (Model Router has no JSON mode) — returns a structured error
  rather than throwing or guessing on malformed output.
- **Scene Planner** (`scene-planner/scene-planner.ts`) — pure/deterministic:
  splits the outline into scenes, clamps/redistributes per-scene duration,
  and derives required assets (character IDs cross-checked against Character
  Agent, location, props) per scene.
- **Prompt Builder** (`prompt-builder/prompt-builder.ts`) — merges four
  sources into the final image prompt: character canon (reuses
  `buildPromptPack()` from the Phase 3 Image Agent, unmodified), the active
  project's style (`getActiveProjectContext()`, Phase 3, unmodified),
  location continuity (recalled from Project Memory so repeat locations stay
  visually consistent across scenes), and merged negative prompts.
- **Image Provider** (`image-provider/`) — real generation, **no mock**:
  `openai-image.ts` calls OpenAI's Images API (`gpt-image-1`) directly via
  `fetch`, same raw-REST convention as the Phase 1 Model/Voice providers.
- **Asset Manager** (`asset-manager/`) — exact-match duplicate detection
  (sha256 of prompt + negative prompts + characters + location, scoped per
  project) so a re-rendered scene reuses the existing file instead of paying
  for and storing a new one; canon-consistency warnings from the Character
  Agent are recorded on every asset.
- **Render Queue** (`render-queue/`) — `GeneratedAsset`/`RenderJob` rows in
  Postgres (new, additive schema). Brain OS has no background worker process
  today (documented limitation, see `NEXT.md`), so "asynchronous" here means
  submit (`enqueue`) and execute (`process`) are separate API calls rather
  than a blocking pipeline — bounded automatic retry plus an explicit manual
  retry endpoint for jobs that exhausted their attempts.
- **Cost Manager** (`cost-manager/`) — per-episode image/voice/video/total
  estimate (env-overridable price constants, documented as estimates — no
  Voice/Video Provider is actually called to produce these numbers).
- **Project Memory** (`project-memory/`) — durable, project-scoped record of
  which locations/props/characters/assets have been generated, read directly
  from `GeneratedAsset`; the same data Asset Manager uses for reuse and
  Prompt Builder uses for location continuity.

New Postgres models (`StoryEpisode`, `StoryScene`, `GeneratedAsset`,
`RenderJob`, `CostEstimate`) reference the Phase 7 JSON project store by a
plain `project_id` string (no FK) — deliberately, since that "Project" is a
JSON file store, a different system from the SQL `Project` model.

**Verified end-to-end for real** (not just build-passes): created a story via
a real OpenAI chat call, built a scene prompt merging canon + location,
rendered a real image via OpenAI's Images API and saved it to disk, enqueued
the same scene a second time and confirmed Asset Manager reused the existing
file (0.2s vs ~43s, `cost_usd: 0`, `reused: true`) instead of calling OpenAI
again, computed a cost estimate, and confirmed Project Memory aggregated the
location/props/assets. Phase 3's `image_request`/`video_request` chat intents
were re-verified unchanged.

**Deferred on purpose (stop point):** no Video Provider — episodes end at
"scene images ready," matching the instruction to build Creative Studio's
core and stop before video rendering. No chat/Orchestrator intent wiring
either — Creative Studio is reached via direct REST APIs only, to avoid any
risk of colliding with Phase 3's intent-resolver phrase priorities; wiring it
into the Orchestrator as a `TaskAgent` is a natural, low-risk follow-up.

## Phase 5 — Robot OS (pending)

Not started. Expected to connect Device Manager to real hardware (ESP32),
replacing the Mock Robot Provider with a real provider behind the same
`DeviceProvider` contract.

## Phase 6 — Automation OS (pending)

Not started.

## Phase 7 — Learning OS (pending)

Not started.

## Phase 8 — Ecosystem (pending)

Not started.
