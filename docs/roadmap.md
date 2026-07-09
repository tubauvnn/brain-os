# Brain OS Roadmap

This is the authoritative roadmap. Earlier "Phase 5/6/7" naming used during
incremental development has been retired — everything built after the
original Phase 2 (Device Layer) is consolidated into Phase 3 (Agent Runtime).

## Status

- ✅ **Phase 1 — Brain Core** — Complete
- ✅ **Phase 2 — Device Layer** — Complete
- ✅ **Phase 3 — Agent Runtime** — Complete
- ⬜ Phase 4 — Creative Studio — Pending
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

## Phase 4 — Creative Studio (pending)

Not started. Expected to build on the Agent Runtime's multi-step execution
plans (e.g. a real Character → Image → Video → Voice chain producing an
actual rendered asset), and to replace the Video/Image Agents' mock
generator providers with real rendering backends (Veo/Kling/DALL·E/etc.)
without changing the Orchestrator or Conversation Agent.

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
