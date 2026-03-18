# Single-file HTML packaging evaluation

**Task:** T014 — Evaluate optional single-file HTML packaging
**Date:** 2026-03-18
**Status:** Completed
**Decision:** **No-go** for the current implementation

## Purpose

This document evaluates whether the current browser-local implementation can be packaged into a **single-file HTML artifact** without creating a new runtime contract that would be difficult to support honestly.

This is an evaluation only. It does **not** add or implement single-file packaging.

## Evaluation standard

The decision standard for T014 is intentionally conservative:

> reject single-file packaging unless the current implementation already supports it credibly, or can support it with minor packaging-only changes that do not create a new unsupportable runtime contract.

In particular, a single-file artifact is **not** acceptable if it would require the project to quietly change any of the following without new validation and support commitments:

- the served-mode runtime contract
- the worker-loading contract
- the WASM asset-loading contract
- browser support expectations
- troubleshooting and release guidance

## Current architecture actually in use

The current implementation is a **served multi-file Vite application** with a worker-based conversion pipeline.

### Source/runtime facts

1. The application explicitly treats **served mode** as the supported launch contract.
   - `web/src/adapters/browser-runtime.ts` marks `file://` as intentionally unsupported.
   - `web/src/app/state.ts` and `web/src/app/controller.ts` refuse to proceed when the app is not in served mode.
   - `docs/local-web-execution/contracts.md`, `support-matrix.md`, `user-guide.md`, `troubleshooting.md`, and `release-ops.md` all repeat the same contract.

2. The conversion pipeline depends on a **dedicated module worker**.
   - `web/src/adapters/browser-worker-client.ts` constructs the worker with:
     - `new Worker(new URL('../worker/export-worker.ts', import.meta.url), { type: 'module' })`
   - `web/src/app/controller.ts` treats missing worker support as a blocking runtime failure.

3. SQLite access depends on a **separately resolved WASM asset**.
   - `web/src/worker/sqlite-adapter.ts` imports:
     - `sql.js/dist/sql-wasm.wasm?url`
   - the adapter passes a URL-returning `locateFile(...)` callback into `initSqlJs(...)`
   - this is an explicit multi-asset loading contract, not an inlined-WASM contract

4. The current release and test posture validates the **served multi-file build**, not a single-file runtime variant.
   - `playwright.config.ts` starts Vite on `http://127.0.0.1:4173`
   - `docs/local-web-execution/release-ops.md` says the support contract is about the served result, not direct `file://` launch of built files

### Actual build output from this session

Running `npm run build` under `web/` in this session produced these emitted files:

- `dist/index.html`
- `dist/assets/index-D8MRUEsk.js`
- `dist/assets/index-DBlqYMNX.css`
- `dist/assets/export-worker-BM8GRjWN.js`
- `dist/assets/sql-wasm-UFUCzYNW.wasm`

Observed sizes from the same build:

- main JS: `32.04 kB`
- worker JS: `59.65 kB`
- CSS: `6.15 kB`
- WASM: `659.73 kB`

The produced `dist/index.html` references served assets under the configured base path:

- `/endnote-exporter/assets/index-D8MRUEsk.js`
- `/endnote-exporter/assets/index-DBlqYMNX.css`

That is consistent with the current deployment model and inconsistent with a “drop one HTML file anywhere and open it” promise.

## What would have to change for single-file packaging to work

For the current app to become a credible single-file HTML artifact, the project would need more than a bundler convenience pass.

At minimum, it would need a proven answer for all of the following:

1. **Worker delivery**
   - The current worker is emitted as its own file.
   - A single-file artifact would need either:
     - a blob/data-URL worker bootstrap, or
     - an alternative worker-loading strategy,
   - and that path would need browser-matrix validation.

2. **WASM delivery**
   - The current SQLite runtime resolves a separate `.wasm` URL.
   - A single-file variant would need to inline or reconstruct the WASM payload at runtime.
   - That is not just packaging trivia; it changes loading behavior, memory behavior, and troubleshooting surface.

3. **Launch-mode support language**
   - Users will reasonably infer that “single HTML” means “open directly from disk.”
   - The current product contract explicitly says the opposite.
   - Supporting a single-file artifact while still rejecting `file://` would be possible in theory, but it would be confusing and would need a separate support story.

4. **Asset base-path assumptions**
   - The current Vite config sets `base: '/endnote-exporter/'`.
   - The built HTML currently expects served assets under that base path.
   - A single-file mode would need its own packaging and validation path rather than reusing the existing build output as-is.

5. **Support and troubleshooting burden**
   - The current docs consistently tell operators to use served mode.
   - A single-file mode would require its own user guidance, troubleshooting rules, and release checks.
   - Without that, the project would create a second runtime mode that users will try first and support cannot defend cleanly.

## Decision

## No-go

The project should **reject optional single-file HTML packaging for the current implementation**.

This is a conservative **no-go**, not because single-file packaging is theoretically impossible, but because the **current implementation does not credibly support it without creating a new runtime contract**.

## Rationale

The rejection is based on the current repository state:

1. **The canonical runtime is deliberately served and multi-file.**
   That is not accidental; it is encoded in source, docs, release guidance, and tests.

2. **The runtime depends on separately loaded worker and WASM assets.**
   The current code and build output prove that the application is not presently a self-contained single-document runtime.

3. **A single-file variant would introduce a new support surface.**
   It would require new worker/WASM loading mechanics, new browser validation, and new operator guidance.

4. **Current validation does not cover the artifact shape that single-file packaging would require.**
   The Playwright and release flow validate served Vite output only.

5. **Accepting single-file packaging now would blur the important distinction between local processing and local-file launch.**
   That would directly conflict with the current conservative documentation posture.

## What this decision does and does not mean

### What it means

- the **supported browser-local distribution remains the served multi-file build**
- `web/dist/` remains a served static artifact, not a double-clickable local-file product
- T014 is complete because the go/no-go decision is now documented

### What it does not mean

- it does **not** prove that single-file packaging is impossible forever
- it does **not** block a future experimental spike if the team explicitly chooses to fund:
  - worker bootstrap redesign
  - WASM inlining/loading experiments
  - separate smoke validation
  - separate documentation and support language

## Revisit conditions

Re-open this decision only if all of the following are true:

1. the team wants a **separate experimental distribution mode**, not a silent extension of the baseline contract
2. the worker can be loaded without relying on a separately served worker file in the claimed runtime
3. the SQLite WASM payload can be loaded without relying on a separately served `.wasm` file in the claimed runtime
4. the claimed launch model is explicit:
   - served single-file artifact, or
   - local-file launch, but not ambiguous marketing between the two
5. the mode has its own smoke validation and user-facing troubleshooting guidance

Until those conditions are met, single-file HTML should remain rejected.
