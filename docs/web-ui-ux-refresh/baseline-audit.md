# Web UI/UX Refresh Baseline Audit

**Status:** Captured before Waves 1-2 implementation
**Date:** 2026-03-18
**Applies to:** Existing browser-local UI in `web/` prior to the Wave 1-2 refresh

## Purpose

This document records the current-state audit and acceptance baselines for the browser-local interface.

The baseline is derived from the implementation present in `web/index.html`, `web/src/styles.css`, `web/src/app/controller.ts`, and `web/src/app/state.ts` before the Wave 1-2 redesign changes were applied.

## Current-state audit

### 1. Hero and visual system

Observed state:

- The interface uses a soft dark-glass presentation with strong gradients, glow treatment, wide radii, and background blur on primary cards.
- The visual language is visually polished but does not match the requested editorial utility-dark tone.
- Headings and operational UI share the same sans-serif stack; there is no serif display moment.
- Browser metadata theming is limited to dataset-driven `color-scheme`; `theme-color` is not managed.

Baseline deficiencies:

- Contrast hierarchy is weaker than required for a utility-first desktop surface.
- Surface separation depends too heavily on blur and glow.
- Typography does not distinguish display hierarchy from operational UI.

### 2. Information architecture and intake surface

Observed state:

- The top-level surface contains hero copy, status, ZIP intake, optional path input, disclosure content, and optional direct-folder intake within a single broad rendering path.
- ZIP-first remains visible, but the intake card already contains a substantial amount of secondary explanation.
- Capability messaging is accurate but dispersed across tooltips and disclosures rather than framed as a stable proof surface.

Baseline deficiencies:

- Section boundaries are weak at the controller level.
- Primary and secondary actions are visually closer than required for the target desktop hierarchy.
- Information architecture vocabulary is implicit rather than frozen.

### 3. Progress and status semantics

Observed state:

- The state model exposes terminal phases such as booting, selecting input, converting, complete, and error.
- Worker status is limited to `starting`, `ready`, and `error`.
- User-facing status copy is a single string without structured severity or stage semantics.
- The converting surface uses a generic spinner message rather than an explicit staged-progress model.

Baseline deficiencies:

- No first-class severity taxonomy exists.
- No first-class workflow stage vocabulary exists.
- Recovery guidance is embedded in scattered copy instead of structured state.

### 4. Results review ergonomics

Observed state:

- Successful conversion surfaces counts inline and uses a modal dialog for item review.
- The modal contains the primary review table and remains the dominant inspection surface.
- The results table does not include a caption or descriptive table framing.

Baseline deficiencies:

- Review is modal-first rather than desk-scale.
- Desktop ergonomics are constrained by the modal boundary.
- Review semantics are incomplete for future accessibility remediation.

### 5. Accessibility and motion baseline

Observed state:

- No skip link is present.
- Status and progress copy are not exposed through an explicit live-region strategy.
- Reduced-motion handling only reduces transition duration and slows the spinner.
- Focus styling exists for controls, but the keyboard path remains shaped around the modal review surface.

Baseline deficiencies:

- Accessibility remediation has not yet been applied structurally.
- Reduced-motion behavior is incomplete.
- Keyboard review flow is still coupled to the modal path.

## Acceptance baselines

### Wave 1 acceptance baseline

Wave 1 is complete when:

1. redesign vocabulary is frozen in documentation
2. information architecture order is frozen in documentation
3. severity, degraded-success, and capability terms are fixed and reusable
4. current-state deficiencies and acceptance targets are documented without changing the product contract

### Wave 2 acceptance baseline

Wave 2 is complete when:

1. the soft glass token system is replaced with sharper editorial utility-dark tokens
2. browser metadata theming includes coherent `theme-color` handling
3. the presentation layer is decomposed into named view sections/helpers
4. state can express workflow stage, severity, and structured recovery guidance without changing the worker core

## Verification references

Implementation references used for this baseline:

- `web/index.html`
- `web/src/styles.css`
- `web/src/app/controller.ts`
- `web/src/app/state.ts`
- `docs/local-web-execution/contracts.md`
- `docs/local-web-execution/support-matrix.md`
- `docs/local-web-execution/attachment-policy.md`

## Deferred items

The following remain intentionally deferred to later waves:

- full workflow-strip presentation
- inline desktop review workspace
- upload simplification and proof-block integration
- skip link and live-region remediation
- table captioning and large-result resilience
- session-loss handling
