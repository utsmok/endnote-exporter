# Electron fallback distribution note

**Status:** Fallback / follow-on option only
**Task:** T015 — native-wrapper decision package
**Date:** 2026-03-18

## Positioning

Electron is **not** the baseline architecture for local web execution.

The canonical implementation remains the served multi-file browser application documented in:

- [`contracts.md`](../contracts.md)
- [`support-matrix.md`](../support-matrix.md)
- [`release-ops.md`](../release-ops.md)
- [`performance-thresholds.md`](../performance-thresholds.md)

Electron becomes relevant only if the browser-local path hits the wrapper-trigger criteria defined in [`../fallback-decision.md`](../fallback-decision.md), or if the project later decides to add a native distribution channel without changing the browser-first source architecture.

## Why Electron stays a fallback

Electron improves native packaging and local runtime control, but it carries material tradeoffs:

- larger packaged runtime footprint
- bundled Chromium and Node.js runtime maintenance
- update/distribution overhead that does not exist for the served browser baseline
- broader local capability surface than the browser-first MVP contract needs

For those reasons, Electron should be treated as a **follow-on distribution shell** around the browser-local application or shared conversion core, not as the first implementation target.

## When Electron is the stronger wrapper choice

Prefer Electron over Tauri if one or more of the following become dominant:

1. **Implementation speed outweighs runtime size concerns.**
   - The team needs the shortest path from the current web workspace to a packaged desktop runtime.
2. **Node-side automation or ecosystem maturity is a release requirement.**
   - Packaging, updater, installer, IPC, or testing tooling is needed quickly with minimal platform-specific work.
3. **The project needs a Chromium-controlled runtime quickly.**
   - Supportability depends on avoiding browser-family variability and shipping one application-controlled runtime.
4. **The team does not want Rust to become a delivery dependency.**
   - Tauri would introduce Rust build and review requirements the team is not ready to absorb.

## Wrapper-fit summary

| Criterion | Electron assessment |
|---|---|
| Packaging speed | Strong |
| Ecosystem maturity | Strong |
| Contained runtime behavior | Strong |
| Bundle size / installer size | Weak relative to Tauri |
| Native capability minimization | Weaker than Tauri |
| Team familiarity if already web-heavy | Usually strong |

## Recommended package shape if chosen later

If Electron is approved in a later plan, keep the package shape narrow:

1. use the existing `web/` application as the UI surface
2. keep conversion logic in shared runtime-neutral modules where possible
3. use Electron only for the wrapper-specific concerns:
   - application window bootstrap
   - local file selection / native path mediation where explicitly approved
   - native packaging and update channel handling
4. avoid moving conversion semantics into Electron-only code unless browser parity becomes impossible

## Browser-trigger scenarios where Electron can help

Electron is a strong fallback if the browser-local path fails for reasons that a bundled Chromium shell can realistically address, such as:

- repeated supported-flow failures caused by browser-family variability rather than conversion logic
- release pressure to standardize on one Chromium runtime instead of documenting best-effort tiers
- a requirement for desktop packaging, installers, or application-managed updates that the served browser contract does not provide
- the need for controlled native file mediation beyond what browser pickers expose, provided that the product deliberately approves that broader capability surface

Electron is **not** a justified escalation merely because it is familiar or because local apps feel more desktop-like.

## Decision guardrails

If Electron is pursued later:

- do **not** rewrite the current browser-local contract retroactively
- do **not** claim that Electron validates `file://` support for the browser build
- do **not** expand attachment-path promises unless the wrapper plan explicitly changes the attachment policy
- do **not** begin implementation until a separate wrapper-specific plan exists

## Minimum acceptance criteria for any future Electron plan

A future Electron implementation plan should require at least:

1. a written justification tied to one or more wrapper triggers from [`../fallback-decision.md`](../fallback-decision.md)
2. explicit package ownership for:
   - auto-update policy
   - code-signing / notarization expectations
   - installer strategy per OS
3. a security boundary definition for Node/Electron capabilities
4. separate release validation from the browser-served release checklist
5. an explicit rollback path back to the served browser baseline if the wrapper adds unacceptable maintenance cost

## Non-goals for this task

This document does **not** authorize:

- adding Electron dependencies
- creating an Electron workspace
- designing IPC contracts
- broadening the support matrix
- changing the browser-first release posture
