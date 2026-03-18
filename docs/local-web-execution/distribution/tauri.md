# Tauri fallback distribution note

**Status:** Fallback / follow-on option only
**Task:** T015 — native-wrapper decision package
**Date:** 2026-03-18

## Positioning

Tauri is **not** the baseline architecture for local web execution.

The baseline remains the served multi-file browser application and its conservative support contract. Tauri is relevant only if the project later needs a native wrapper after the browser-local path has already been proven too narrow, too unstable, or too support-costly under the measurable criteria in [`../fallback-decision.md`](../fallback-decision.md).

## Why Tauri stays a fallback

Tauri can reduce runtime footprint and constrain native capabilities more tightly than Electron, but it introduces its own costs:

- Rust build and release toolchain ownership
- native-side integration complexity that does not exist in the served browser baseline
- additional packaging, signing, and updater decisions
- a different operational surface from the current browser-first release model

That makes Tauri appropriate as a **follow-on native packaging strategy**, not as the first implementation target.

## When Tauri is the stronger wrapper choice

Prefer Tauri over Electron if one or more of the following become dominant:

1. **Runtime size and installation footprint matter materially.**
   - The project needs a smaller packaged desktop application than a bundled Electron runtime would typically allow.
2. **Capability scoping must stay tight.**
   - The wrapper should expose only narrowly approved native operations rather than a broad Node-enabled desktop shell.
3. **The team is willing to own a Rust delivery surface.**
   - Build, review, and release operations can absorb Rust-based wrapper code responsibly.
4. **A native wrapper is required, but the product still wants the web UI to remain conceptually primary.**
   - The project wants a thin native shell rather than a desktop app identity that centers the wrapper runtime itself.

## Wrapper-fit summary

| Criterion | Tauri assessment |
|---|---|
| Runtime footprint | Strong |
| Native capability minimization | Strong |
| Web-to-native packaging speed | Moderate |
| Tooling maturity for common desktop patterns | Good, but often less turnkey than Electron |
| Need for Rust ownership | High |
| Team fit if currently web-only | Variable |

## Recommended package shape if chosen later

If Tauri is approved in a later plan, keep the package shape narrow:

1. keep `web/` as the primary UI/application workspace
2. keep conversion rules and output semantics in shared runtime-neutral modules where possible
3. use Tauri only for wrapper-specific concerns:
   - application shell/bootstrap
   - explicitly approved native file mediation
   - packaging, signing, and updater concerns
4. avoid forking conversion behavior merely because native commands are available

## Browser-trigger scenarios where Tauri can help

Tauri is a strong fallback if the browser-local path needs native mediation, but the project wants to stay conservative about wrapper capabilities and runtime size, for example:

- the served browser contract cannot provide the required file-selection or path-confirmation workflow within supportable UX limits
- the project needs a packaged desktop runtime with smaller distribution size than Electron is likely to provide
- supportability benefits from a native wrapper, but security review prefers a narrower capability boundary than a Node-enabled shell

Tauri is **not** justified simply because it is smaller in principle. A measurable wrapper trigger must still exist.

## Decision guardrails

If Tauri is pursued later:

- do **not** change the baseline browser-first architecture retroactively
- do **not** assume a native wrapper upgrades unsupported browser behaviors into the browser support matrix
- do **not** use Tauri as a pretext to bypass the attachment-policy contract without explicit approval
- do **not** begin implementation until a separate wrapper-specific plan exists

## Minimum acceptance criteria for any future Tauri plan

A future Tauri implementation plan should require at least:

1. a written justification tied to one or more wrapper triggers from [`../fallback-decision.md`](../fallback-decision.md)
2. explicit ownership of Rust toolchain, CI, signing, and update operations
3. a capability manifest describing exactly which native operations are exposed
4. separate release validation from the served browser release checklist
5. an explicit rollback path back to the served browser baseline if wrapper maintenance cost outweighs the packaging benefit

## Non-goals for this task

This document does **not** authorize:

- adding Tauri dependencies
- creating a Rust workspace
- defining native commands
- broadening the support matrix
- changing the current browser-local release posture
