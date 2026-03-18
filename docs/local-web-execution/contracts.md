# Local Web Execution MVP Contract

**Status:** Frozen for MVP planning
**Date:** 2026-03-18
**Applies to:** Browser-local conversion surface only

## Purpose

This document defines the minimum product contract for a browser-local EndNote-to-Zotero conversion workflow.

This contract is intentionally narrow. It exists to prevent runtime assumptions, browser support claims, and attachment behavior from drifting ahead of verified implementation work.

This document does not modify the behavior or support status of the existing Python desktop application. The desktop application remains an unaffected fallback surface.

## In-scope product surface

The MVP browser-local product surface is limited to the following:

1. a browser application executed in a served context
2. user-supplied EndNote library input in approved archive shapes
3. local generation of Zotero-compatible XML
4. local delivery of the generated XML artifact to the user
5. explicit warnings for unsupported, degraded, or browser-specific conditions

## Canonical runtime

The canonical runtime for MVP is a served browser application running over one of the following:

- `http://localhost`
- `https://...`

Served mode is the only supported browser runtime contract for MVP. This baseline is required because the planned browser implementation depends on runtime features whose behavior is materially more reliable in a served context, including module loading, workers, and WASM-backed database access.

## Explicit runtime exclusions

The following runtime behaviors are explicitly excluded from the MVP contract:

- direct `file://` launch support
- any claim that a loose local HTML file is a supported runtime
- any claim that optional future single-file packaging implies `file://` support

If a future artifact happens to function when opened from `file://`, that outcome is incidental and non-contractual. It must not be documented or treated as supported behavior unless the support matrix is updated explicitly.

## Input contract

### Baseline intake

ZIP-first intake is the baseline supported input contract for MVP.

The supported baseline is an approved ZIP archive that contains one of the expected EndNote library shapes needed for browser-local preparation, including:

- `.enl` plus sibling `.Data/`
- `.enlp`-equivalent packaged contents after archive inspection

The exact normalization rules are defined in later technical documents. The product contract for MVP is simply that the supported path starts from an approved archive, not from unrestricted raw filesystem access.

### Direct folder selection

Direct folder selection is not part of the baseline MVP contract.

If it is introduced later, it is treated as a progressive enhancement only. In product terms, that means:

- it is capability-gated
- it is not required for a supported end-to-end workflow
- it is never the only supported intake path
- it does not expand the MVP support promise unless the support matrix is updated explicitly

## Output contract

The browser-local MVP produces a downloadable Zotero-compatible XML file as its primary artifact.

Warnings, degraded cases, and unsupported conditions are part of the product surface and must be exposed explicitly rather than left implicit in logs or undocumented behavior.

## Attachment policy baseline

Attachment behavior in browser-local mode is intentionally not identical to the desktop exporter.

The browser-local MVP does not promise desktop-style absolute filesystem path fidelity for attachments. In particular, it does not promise that exported attachment links will preserve or synthesize host absolute PDF paths comparable to the current desktop implementation.

For MVP, attachment handling is defined as a browser-local policy:

- attachment discovery may inform counts, warnings, and result metadata
- attachment handling may preserve only browser-portable or archive-derived semantics
- absence of desktop-style absolute attachment paths in browser-local output is an intentional product decision, not an implementation defect

Any browser-local attachment representation used in implementation must remain consistent with this policy and must be documented explicitly.

## Support vocabulary

The following vocabulary is mandatory for browser-local support claims.

### Supported

The behavior is part of the MVP contract, is intended to work in normal use, and is expected to be covered by routine verification.

### Best effort

The behavior is intentionally allowed but is not part of the strict compatibility baseline. It may work in some environments without the same stability, parity, or troubleshooting commitment as supported behavior.

### Experimental

The behavior is explicitly pre-baseline. It may be exposed for evaluation, but it is not required for product completeness and may change or be removed without preserving compatibility.

### Unsupported

The behavior is outside the MVP product contract. Failures, degraded behavior, or total absence of functionality in this tier are not treated as regressions against the browser-local MVP promise.

## Non-goals for MVP

The following are non-goals for the browser-local MVP:

- desktop-style filesystem semantics in the browser
- universal direct folder or package selection across browsers
- `file://` launch support
- attachment-path parity with the desktop exporter
- changes to the current desktop application behavior

## Fallback boundary

The current Python desktop application remains the fallback product surface for users who require the existing desktop runtime, current attachment-path behavior, or desktop-oriented filesystem handling.

The browser-local MVP is additive work. It does not replace, narrow, or redefine desktop support in this task.
