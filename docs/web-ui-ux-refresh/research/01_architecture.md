# Architecture Research — `web-ui-ux-refresh`

## Scope

This report documents the current browser-local application architecture in `web/` and the desktop oracle boundary that constrains UI/UX redesign work. The repository is Full Stack by configuration (`pyproject.toml:1-14`, `web/package.json:1-33`), but the redesign implementation surface is concentrated in the TypeScript browser-local application under `web/`.

## Findings

### 1. Runtime bootstrap is intentionally narrow and browser-capability-gated

| Area | Evidence | Technical finding |
|---|---|---|
| Document bootstrap | `web/index.html:4-27` | The document precomputes theme state before application mount using `localStorage`, `matchMedia('(prefers-color-scheme: dark)')`, and `data-theme` attributes. The document head contains only charset and viewport metadata. There is no `theme-color` metadata, no browser chrome theming metadata, and no preloaded font strategy. |
| Application mount | `web/src/main.ts:1-8` | The UI entrypoint is a minimal mount wrapper that imports global CSS and calls `mountApp(root)`. There is no route layer, no component registry, and no hydration boundary. |
| Runtime detection | `web/src/adapters/browser-runtime.ts:17-45` | The application treats served mode, secure context, worker support, and directory-picker availability as first-class runtime facts. This is materially relevant to UX because unsupported/degraded states are not incidental; they are part of the product contract. |

The bootstrap model is operationally correct for the browser-local contract, but it couples user-facing readiness closely to capability probes instead of staged task-oriented progress.

### 2. The controller is the dominant architectural boundary

| Area | Evidence | Technical finding |
|---|---|---|
| Controller bootstrap and worker init | `web/src/app/controller.ts:28-123` | `mountApp()` owns runtime detection, worker lifecycle, state creation, rendering, event attachment, and theme synchronization. |
| Rendering | `web/src/app/controller.ts:135-526` | All primary UI surfaces are rendered as string templates within one file: hero, input selection, converting state, success summary, warnings, modal review table, and error state. |
| Interaction handlers | `web/src/app/controller.ts:560-652` | File upload, directory picking, conversion dispatch, success/error messaging, and retry/reset are handled in the same controller module as markup generation. |
| DOM event wiring | `web/src/app/controller.ts:696-816` | The same file performs ad hoc DOM querying and imperative listener attachment after each render. |
| Theme persistence | `web/src/app/controller.ts:941-1009` | Theme persistence logic, document mutation, and media-query handling are also owned by the controller rather than by a separate presentation or platform layer. |

The practical result is a controller-centric architecture rather than a component-oriented one. This is serviceable for the current surface area, but it is the primary structural constraint for a substantial UI refresh. A redesign that adds more states without changing this boundary will increase maintenance cost and regression risk.

### 3. State is intentionally small but semantically coarse

| Area | Evidence | Technical finding |
|---|---|---|
| App state model | `web/src/app/state.ts:5-120` | `AppState` contains phase, notes, status message, selected input label, attachment base path, modal state, worker state, theme preference, and final export result. |
| Phase model | `web/src/app/state.ts:5-13` | The phase model is linear: `booting`, `ready`, `unsupported-launch`, `worker-error`, `selecting-input`, `converting`, `conversion-complete`, `conversion-error`. |
| Result handling | `web/src/app/state.ts:91-120` | Successful conversion is modeled as a terminal result object rather than as a staged review workflow. |

The state model is sufficient for a single-step conversion flow. It is not sufficient for richer staged progress UX, differentiated severity semantics, session-loss handling, or large-result review ergonomics without expansion.

### 4. The browser-local "backend" is a dedicated worker, not a server surface

| Area | Evidence | Technical finding |
|---|---|---|
| Worker client | `web/src/adapters/browser-worker-client.ts:26-95` | The main thread communicates with a dedicated worker through a request/response client with pending request bookkeeping. |
| Worker capabilities | `web/src/worker/export-worker.ts:45-58` | The worker explicitly advertises `normalisedLibraryBoundary`, `servedModeRequired`, `sqliteWorkerQueries`, and `workerPipelineBoundary`. |
| Worker request handling | `web/src/worker/export-worker.ts:24-111` | The worker exposes `initialise`, `query-prepared-library`, and `convert-prepared-library`. Responses are one-shot. There is no progressive status emission. |
| Query layer | `web/src/worker/query-endnote.ts:8-147` | SQLite queries are performed entirely in the worker against `refs` and `file_res`, then projected into typed result structures. |

From a UX perspective, this means the redesign must present progress for a strictly local asynchronous pipeline. Server-job metaphors would be inaccurate unless the worker protocol is extended.

### 5. Library normalization is a strong existing contract

| Area | Evidence | Technical finding |
|---|---|---|
| ZIP normalization | `web/src/core/normalize-library.ts:37-544` | The normalization layer converts ZIP or directory input into a `PreparedLibrary` with identity, file map, database bytes, and attachment subtree metadata. |
| Archive failure taxonomy | `web/src/core/normalize-library.ts:148-153`, `528-544` | The normalization layer already distinguishes `MALFORMED_ARCHIVE`, `UNSUPPORTED_ARCHIVE_SHAPE`, and `MISSING_DATABASE`. |
| Attachment subtree | `web/src/core/normalize-library.ts:324-345` | Attachment discovery is derived from a normalized `PDF/` subtree beneath the resolved `.Data` directory. |

This is a useful boundary for redesign work because intake UX can be changed without changing the prepared-library contract, provided the new surface still resolves into the same normalized shape.

### 6. Conversion semantics are intentionally tolerant and metadata-rich

| Area | Evidence | Technical finding |
|---|---|---|
| Conversion orchestration | `web/src/core/convert-library.ts:22-116` | Conversion is staged as export context creation → record mapping → XML serialization → result building. |
| Per-record tolerance | `web/src/core/convert-library.ts:47-89` | Mapping and serialization failures skip individual records rather than failing the entire export. Warning code `RECORD_SKIPPED` captures the degraded outcome. |
| Export metadata | `web/src/core/build-export-result.ts:38-77`, `103-225` | Result metadata includes item summaries, warning lists, attachment counts, linked attachment counts, and skipped-record counts. |
| Attachment resolution | `web/src/core/resolve-attachments.ts:58-141` | Attachment handling already distinguishes `metadata-only-no-links` from `base-library-path-links` and emits warnings for omitted or partial links. |

This pipeline already contains the semantics needed for a more trustworthy review experience. The problem is not absence of useful data. The problem is information architecture and interaction framing.

### 7. The desktop exporter remains the parity oracle and domain constraint

| Area | Evidence | Technical finding |
|---|---|---|
| Desktop export entrypoint | `endnote_exporter.py:181-286` | The Python exporter validates input shape, resolves `.enl` / `.enlp`, reads SQLite directly, and builds XML in one process. |
| Date and field mapping | `endnote_exporter.py:382-607` | The desktop exporter preserves domain-specific field mapping, dates-in-notes behavior, and PDF path logic. |
| XML emission | `endnote_exporter.py:813-815` | Desktop XML emits `<pdf-urls>` with absolute filesystem paths. |
| GUI wrapper | `gui.py:17-153` | The desktop GUI is thin and imperative, built around file selection and warning counting from logs. |

The redesign must not imply capabilities that the browser-local path does not have. The browser-local UX is not a skin over the desktop runtime. It is a different runtime with a narrower attachment contract.

## Architectural implications for redesign planning

1. The current architecture already has a strong data pipeline boundary (`PreparedLibrary` → worker query → conversion result). The redesign should preserve that boundary.
2. The current controller is the main architectural liability for UI-scale work. Any plan beyond superficial restyling should introduce presentation modules or view sections.
3. Staged progress, severity taxonomy, recovery/help, and session-loss behavior will require state model expansion and likely worker protocol expansion.
4. The redesign should avoid adding a server-like orchestration layer because the actual product contract is explicitly browser-local.

## Improvement opportunities

1. Introduce view-level modules so the controller no longer owns all markup, event wiring, and theme logic.
2. Separate structural layout concerns from conversion semantics.
3. Convert one-shot terminal surfaces into a staged desktop workflow: intake → preparation → conversion → review → export.
4. Preserve the prepared-library and worker boundaries while expanding event/state granularity.

## Open questions

1. Should staged progress remain simulated from main-thread phase transitions, or should the worker protocol be extended to emit real sub-stage progress events?
2. Should the redesign remain strictly frameworkless, or is a minimal internal view abstraction acceptable if it reduces controller entropy?
3. Should theme state remain document-bootstrap-only, or should browser chrome theming metadata be updated dynamically as theme changes?
4. Should large-result review remain entirely in-memory, or should the UI page or chunk item summaries for large libraries?

## Risks

1. A purely visual refresh on top of `web/src/app/controller.ts` will increase file size and reduce maintainability.
2. A structural refactor that ignores the existing worker boundary risks entangling UI work with conversion correctness.
3. Introducing staged progress without protocol support may create misleading semantics if labels imply more precision than the runtime can currently supply.
4. Divergence from the documented browser-local contract would create contradictions with `docs/local-web-execution/*.md` and reduce user trust.

## Dependencies

1. The redesign must remain consistent with `docs/local-web-execution/contracts.md`, `support-matrix.md`, and `attachment-policy.md`.
2. Any UI changes that introduce staged progress or persistent session state may require updates to `web/src/app/state.ts`, `web/src/adapters/browser-worker-client.ts`, and `web/src/worker/export-worker.ts`.
3. Any structural UI refactor will affect `web/src/app/controller.test.ts`, Playwright coverage in `web/tests/e2e/`, and potentially the fixture-based parity harness.

## Testing implications

1. Architectural refactoring should be accompanied by granular view-level tests or at minimum controller render tests; current controller tests do not cover rendering structure.
2. Worker protocol changes require integration coverage at the adapter/client boundary.
3. Any redesign that changes review surfaces must update Playwright expectations for modal presence, item review, and summary lines.
4. Contract-critical behavior—served-mode gating, ZIP-first baseline, attachment warning semantics—must remain covered regardless of visual direction.
