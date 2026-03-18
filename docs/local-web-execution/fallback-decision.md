# Native-wrapper fallback decision record

**Status:** Approved documentation baseline for T015
**Date:** 2026-03-18
**Decision type:** Follow-on / fallback packaging decision record

## Decision statement

Electron and Tauri remain **fallback or follow-on distribution options**, not the baseline architecture.

The current baseline remains:

- served browser runtime over `http://localhost` or `https://...`
- multi-file application shape
- ZIP-first supported intake
- browser-local processing on the user's device
- conservative attachment semantics defined in [`attachment-policy.md`](./attachment-policy.md)

A native wrapper becomes eligible only when the browser-local path hits measurable trigger criteria or when a separately approved product decision introduces requirements that the baseline browser contract intentionally does not satisfy.

## Why this record exists

The project already has:

- a frozen browser-local contract in [`contracts.md`](./contracts.md)
- conservative browser support tiers in [`support-matrix.md`](./support-matrix.md)
- explicit performance and failure thresholds in [`performance-thresholds.md`](./performance-thresholds.md)
- release guidance that keeps the served multi-file browser application canonical in [`release-ops.md`](./release-ops.md)

This record prevents a common failure mode: escalating to Electron or Tauri because they sound more desktop-like, rather than because the browser-first contract actually failed measurable criteria.

## Wrapper trigger criteria

A wrapper review is justified only if **at least one** trigger below is met and the failure remains after ordinary browser-first stabilization work.

### Trigger 1: size-envelope failure at the documented continuation gate

Escalate to wrapper review if the canonical served Chromium path cannot reliably process an approved supported library at or below:

- **1 MiB archive size**, or
- **512 KiB database payload**

with all of the following expected conditions satisfied:

- three consecutive successful attempts are required for the browser path to count as reliable
- no unclassified worker death occurs
- no browser-tab crash occurs
- no partial XML output is produced

This trigger directly adopts the continuation threshold from [`performance-thresholds.md`](./performance-thresholds.md).

### Trigger 2: latency-envelope failure after normal optimization

Escalate to wrapper review if the canonical served Chromium path repeatedly exceeds either documented latency threshold:

- **250 ms median total worker time** for the approved 250-row stress fixture, or
- **2.0 s median total worker time** for an approved 1 MiB-class archive

or if any supported fixture repeatedly exceeds **5.0 s** without a structured, user-visible limit response.

Interpretation rules:

- "repeatedly" means the threshold is exceeded in at least **3 of 5** comparable runs after normal browser-first tuning work
- comparisons must be made on the same fixture class and similar machine conditions
- a single outlier run does not justify a wrapper

### Trigger 3: memory-failure behavior breach

Escalate to wrapper review if approved supported fixtures show any of the following in the canonical served browser runtime:

- repeatable out-of-memory termination without classified error handling
- browser-tab or renderer crash
- worker death that prevents clean retry without full reload
- partial XML output after a memory-related failure

This trigger is behavior-first on purpose. Silent or ambiguous failure is the real blocker, not a raw memory number taken out of context.

### Trigger 4: supportability failure caused by browser variance

Escalate to wrapper review if the supported ZIP-first workflow becomes support-costly because browser-family variance remains materially unresolved, for example:

- Chromium remains stable, but best-effort browsers create a release burden that the project is unwilling to support
- required workers/WASM/module behavior remains inconsistent enough that the supported browser story becomes narrower than the product wants
- release operations require one application-controlled runtime instead of a browser matrix

This trigger must be backed by reproducible validation evidence, not by a general preference for desktop packaging.

### Trigger 5: approved product requirement exceeds the browser contract

Escalate to wrapper review if a later approved product requirement explicitly demands behavior the browser-local MVP contract intentionally excludes, such as:

- a packaged desktop application with installer/update lifecycle
- controlled native-path mediation beyond browser picker semantics
- a release requirement for tighter runtime standardization than a served browser can provide

This trigger does **not** automatically authorize restoring desktop-style behavior. It authorizes wrapper review.

## What does *not* trigger a wrapper

The following are insufficient on their own:

- familiarity with Electron or Tauri
- dislike of served-mode documentation
- preference for a double-clickable app in principle
- incidental `file://` failures, because `file://` is already unsupported
- desire to widen support claims without meeting the browser thresholds
- attachment-path parity aspirations that conflict with the current browser attachment policy but have not been approved as new product requirements

## Decision matrix: Electron vs Tauri once escalation is justified

If a wrapper review is triggered, choose the wrapper according to the dominant constraint.

| Dominant need | Preferred wrapper | Why |
|---|---|---|
| Fastest packaging path from current web workspace | Electron | Faster path to a controlled desktop runtime with mature JS/Node packaging patterns |
| Runtime standardization around a bundled Chromium shell | Electron | Strongest fit when shipping one app-controlled runtime matters most |
| Smaller installer/runtime footprint | Tauri | Better fit when package size materially matters |
| Stricter native capability scoping | Tauri | Better fit when the wrapper should expose fewer native powers |
| Team wants to avoid Rust ownership | Electron | Lower delivery friction for a web-heavy team |
| Team accepts Rust ownership to keep wrapper thin | Tauri | Better fit for a constrained native shell |

## Implementation posture if a wrapper is approved later

Even after escalation, the default package strategy should remain:

1. keep the browser-local application and shared conversion logic conceptually primary
2. keep wrapper code limited to packaging and explicitly approved native mediation
3. avoid forking conversion rules by runtime unless browser parity is impossible
4. update the support matrix explicitly instead of silently reinterpreting browser guarantees

## Rollback boundary

This decision record does **not** change the current release baseline.

Until a later wrapper-specific plan is approved:

- the served multi-file browser application remains canonical
- the Python desktop app remains the unaffected fallback product surface
- no Electron or Tauri dependency should be added
- no wrapper implementation work should begin

See [`rollback.md`](./rollback.md) for the explicit rollback boundaries.

## Required evidence for any future wrapper proposal

A future wrapper proposal should include all of the following before implementation starts:

1. the exact trigger(s) hit from this document
2. the fixture classes and measurements demonstrating the trigger
3. the reason browser-first stabilization was insufficient
4. the chosen wrapper and why it fits better than the alternative
5. the rollout, release, signing, and maintenance ownership model
6. the rollback path if wrapper maintenance becomes unjustified

## Current decision

**Current decision:** remain browser-first.

- Electron: documented as a fallback / follow-on option
- Tauri: documented as a fallback / follow-on option
- Wrapper implementation: **not approved in this task**
