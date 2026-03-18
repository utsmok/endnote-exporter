# Local web execution rollback boundaries

**Status:** Active rollback guidance for T015 and later follow-on packaging work
**Date:** 2026-03-18

## Purpose

This document defines the rollback boundaries for browser-local packaging follow-on work.

Its main job is to keep three surfaces separate:

1. the existing Python desktop application
2. the canonical served multi-file browser-local application
3. any future Electron or Tauri wrapper work

That separation is critical because wrapper evaluation is optional. The project must be able to reject or unwind wrapper work without destabilizing the baseline browser-local contract or the existing desktop application.

## Boundary statement

The current rollback baseline is:

- **desktop baseline:** the Python desktop application remains supported and unaffected
- **browser baseline:** the served multi-file browser application remains the canonical local-web architecture
- **wrapper status:** Electron and Tauri remain documentation-only follow-on options until a separate implementation plan is approved

## Explicit rollback rules

### Rule 1: wrapper documentation is reversible with no product-surface loss

If wrapper follow-on work is deprioritized, the project may delete or archive:

- [`distribution/electron.md`](./distribution/electron.md)
- [`distribution/tauri.md`](./distribution/tauri.md)
- [`fallback-decision.md`](./fallback-decision.md)

without changing the current served browser contract or the desktop application.

### Rule 2: wrapper implementation must not redefine the browser baseline implicitly

If a later wrapper spike or implementation starts, it must not silently change any of the following baseline documents unless the support contract is intentionally revised:

- [`contracts.md`](./contracts.md)
- [`support-matrix.md`](./support-matrix.md)
- [`attachment-policy.md`](./attachment-policy.md)
- [`release-ops.md`](./release-ops.md)

If a wrapper experiment requires broader promises than those documents allow, the correct response is an explicit contract change review, not silent drift.

### Rule 3: browser rollback remains independent of wrapper rollback

If wrapper work fails, the project should:

- keep the served browser build and docs intact
- remove wrapper dependencies, packaging files, and release notes
- leave fixture, parity, and browser validation assets in place unless they were wrapper-specific

If browser-local work later narrows or stalls, the project should:

- keep the existing Python desktop app unchanged
- preserve parity fixtures, support analysis, and decision records
- stop short of wrapper implementation unless the measurable triggers justify it

### Rule 4: desktop behavior is not a hidden dependency of wrapper planning

Wrapper decision work must not assume that the desktop app will be retired, merged, or behaviorally rewritten as part of the wrapper effort.

The desktop application remains a separate fallback product surface unless a later migration plan explicitly says otherwise.

## Rollback scenarios

### Scenario A: reject wrapper follow-on work entirely

Use this rollback if:

- browser-first remains good enough
- wrapper maintenance cost is unjustified
- no approved product requirement needs a native package

Rollback action:

- retain these browser-local documents and code paths:
  - `docs/local-web-execution/contracts.md`
  - `docs/local-web-execution/support-matrix.md`
  - `docs/local-web-execution/release-ops.md`
  - `web/`
- archive or remove wrapper-only decision artifacts if desired
- keep `T015` as historical documentation of the decision

### Scenario B: wrapper spike starts and proves unjustified

Use this rollback if:

- the wrapper does not solve the measured trigger condition
- the wrapper adds unacceptable complexity, security surface, or release burden
- browser-first optimization proves sufficient after all

Rollback action:

- remove the wrapper spike workspace and dependencies
- revert wrapper-specific CI, packaging, and release automation
- keep browser-local conversion logic in shared/runtime-neutral modules where possible
- keep the baseline support matrix conservative and unchanged unless explicitly revised

### Scenario C: browser-local support narrows, but wrapper is still not approved

Use this rollback if:

- browser-local remains viable only for the narrow documented path
- the project cannot justify wrapper investment yet

Rollback action:

- keep the served browser path limited to its supported ZIP-first scope
- downgrade overreaching claims before release
- continue directing desktop-semantics workflows to the Python app

### Scenario D: a wrapper is approved later but must remain thin

This is not a full rollback. It is a containment rule.

If a wrapper is implemented later, rollback must remain possible by keeping these boundaries intact:

- conversion semantics stay in shared or browser-neutral modules where practical
- wrapper code owns packaging, windowing, and explicitly approved native mediation only
- wrapper-specific changes do not become hidden prerequisites for the served browser build

## Files and ownership boundaries

| Surface | Should remain independent | Rollback implication |
|---|---|---|
| Python desktop app | Yes | Browser or wrapper work can be rolled back without changing desktop behavior |
| `web/` browser workspace | Yes | Wrapper work can be removed while keeping the browser-local baseline |
| wrapper-specific workspace or config | Yes | Should be removable without breaking `web/` or Python desktop |
| support and contract docs | Yes | Must change only through explicit contract review |

## Release-boundary rules

Until a wrapper is formally implemented and approved:

- release notes must not imply native package availability
- the support matrix must not imply Electron or Tauri support
- troubleshooting guidance must continue to point users to the served browser path or the desktop app, not to a non-existent wrapper

## Current effect of T015

T015 adds decision documentation only.

It does **not**:

- add a wrapper runtime
- change release operations
- alter supported launch modes
- broaden attachment semantics
- change the existing desktop fallback posture
