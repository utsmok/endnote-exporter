# Local Web Execution Support Matrix

**Status:** Frozen for MVP planning
**Date:** 2026-03-18

## Purpose

This document defines the initial browser-local support tiers for MVP planning.

The matrix is capability-based and runtime-based. Browser-family labels are secondary to launch mode, intake mode, and required platform features.

This document applies only to the browser-local conversion surface. It does not alter the support status of the existing Python desktop application.

## Support vocabulary

| Tier | Meaning |
|---|---|
| Supported | Part of the MVP contract and intended for routine use. |
| Best effort | Allowed but not held to the same compatibility or troubleshooting commitment as the baseline path. |
| Experimental | Pre-baseline capability that may change or be removed without compatibility guarantees. |
| Unsupported | Outside the MVP contract. |

## Runtime matrix

| Dimension | Case | Tier | Notes |
|---|---|---|---|
| Launch mode | Served over `http://localhost` | Supported | Canonical local development and local-serving mode for MVP. |
| Launch mode | Served over `https://...` | Supported | Equivalent served-mode contract for hosted or packaged delivery that preserves required browser capabilities. |
| Launch mode | Direct `file://` launch | Unsupported | Not a supported MVP runtime. Successful ad hoc use is non-contractual. |
| Source layout | Multi-file served application | Supported | Canonical runtime shape for MVP. |
| Source layout | Optional future single-file packaging | Experimental | Not part of the MVP baseline and not evidence of `file://` support. |

## Intake matrix

| Dimension | Case | Tier | Notes |
|---|---|---|---|
| Primary intake | Approved ZIP archive containing `.enl` + `.Data/` layout | Supported | Baseline browser-local intake path. |
| Primary intake | Approved ZIP archive containing `.enlp`-equivalent contents | Supported | Included in the ZIP-first baseline contract. |
| Intake mode | Direct folder selection via browser capability | Experimental | Progressive enhancement only. Exposed only in served, secure contexts where the browser provides `showDirectoryPicker()`. ZIP-first remains the baseline supported path. |
| Intake mode | Folder-only workflow with no ZIP fallback | Unsupported | The browser-local MVP must retain a ZIP-first path. |
| Intake shape | Malformed archive or incomplete library shape | Unsupported | Expected to fail with explicit errors or warnings. |

## Browser-family matrix

| Browser family and conditions | Tier | Notes |
|---|---|---|
| Chromium-class current stable, served mode, ZIP-first workflow | Supported | Primary target for the browser-local MVP. |
| Firefox current stable, served mode, ZIP-first workflow | Best effort | No direct-folder requirement is implied. Browser-local runtime support remains capability-dependent. |
| Safari/WebKit current stable, served mode, ZIP-first workflow | Best effort | No direct-folder requirement is implied. Browser-local runtime support remains capability-dependent. |
| Browsers lacking required ES module, worker, or WASM behavior for the implementation | Unsupported | Capability failure overrides browser-family labeling. |

## Feature policy matrix

| Feature or behavior | Tier | Notes |
|---|---|---|
| Local XML generation and download in served mode | Supported | Core browser-local product behavior. |
| Inline desktop review workspace during the active session | Supported | Review happens inline after conversion rather than through a blocking modal. |
| Explicit warnings for degraded or unsupported cases | Supported | Warning surfacing is part of the product contract. |
| Browser-local attachment handling without desktop absolute-path fidelity | Supported | Intentional browser-local policy. |
| User-supplied library location for PDF path export | Supported | The browser does not discover native absolute paths. The user must supply the library location, and only verified relative attachment paths from the selected ZIP/folder are emitted. |
| Automatic restoration of prior review data after refresh or tab replacement | Unsupported | The current browser-local surface keeps review data ephemeral and does not promise cross-refresh result continuity. |
| Automatic desktop-style absolute PDF path discovery from browser pickers | Unsupported | Browsers do not generally reveal native absolute paths from file or folder pickers. |
| Direct folder selection as a convenience enhancement | Experimental | Capability-gated, secure-context-only, and non-parity-critical. Current UI exposes it only when the required directory picker API is available. |

## Interpretation rules

1. A supported browser-family row does not upgrade unsupported launch modes or unsupported features.
2. Direct folder selection does not become supported by working incidentally in one browser build.
3. Optional future packaging work does not expand the support contract unless this matrix is updated explicitly.
4. Capability failure takes precedence over browser-brand naming.
5. The Python desktop application remains the recommended fallback for workflows that require desktop filesystem behavior or current absolute attachment-path behavior.
