# Web UI/UX Refresh Contract Freeze

**Status:** Frozen for Waves 1-2 implementation
**Date:** 2026-03-18
**Applies to:** `web/` browser-local interface only

## Purpose

This document freezes the redesign contract for the browser-local web interface before structural implementation changes proceed.

The contract is intentionally narrow. It constrains information architecture, vocabulary, visual tone, and non-goals so that the redesign does not drift into a broader product or runtime rewrite.

This document does not alter the worker pipeline, normalization rules, conversion logic, attachment policy, or browser support matrix.

## Frozen information architecture

The browser-local interface will use the following desktop-first section order:

1. **Primary task** — hero and intake surface for the supported ZIP-first conversion path.
2. **Workflow strip** — compact stage framing for intake, preparation, conversion, review, and recovery.
3. **Trust / proof block** — persistent contract messaging for local processing, support tier, attachment policy, and desktop fallback.
4. **Results area** — desktop review workspace for export output, counts, warnings, and item inspection.
5. **Recovery / help** — visible next steps for degraded, unsupported, and failed conditions.

Wave 1 and Wave 2 freeze this order and the vocabulary used to describe it. They do not require the full Wave 3 layout to be present yet.

## Frozen vocabulary

### Workflow vocabulary

| Term | Definition | Usage rule |
|---|---|---|
| Intake | User selection of an approved ZIP archive or capability-gated directory input. | Use for initial file or folder selection only. |
| Preparation | Browser-side validation and preparation of the selected library before XML generation. | Use only for pre-conversion setup work. |
| Conversion | Worker-backed XML generation from the prepared library. | Use for active export processing only. |
| Review | Post-conversion inspection of counts, warnings, and exported item metadata. | Use only after a result exists. |
| Recovery | User-visible next steps after unsupported, degraded, cancelled, or failed conditions. | Use when guidance is required to continue safely. |

### Severity vocabulary

| Term | Definition | Usage rule |
|---|---|---|
| Informational | Neutral status with no action required. | Default for ready, waiting, or explanatory states. |
| Success | Completed state with no material degradation detected. | Use for clean conversion completion only. |
| Warning | Completed or intermediate state with degradation, skipped records, or incomplete attachment behavior that does not invalidate the XML. | Use for degraded success and non-fatal issues. |
| Error | State that blocks the supported path or invalidates the current attempt. | Use for unsupported launch, worker failure, or conversion failure. |

### Capability and proof vocabulary

| Term | Definition | Usage rule |
|---|---|---|
| Supported | Part of the browser-local baseline contract. | Must align with `docs/local-web-execution/contracts.md` and `support-matrix.md`. |
| Experimental | Capability-gated enhancement outside the baseline path. | Use for direct-folder intake only while it remains non-baseline. |
| Unsupported | Outside the browser-local contract. | Use for `file://` launch or missing runtime capabilities. |
| Local processing | Conversion remains in the browser session and worker boundary. | Do not imply upload or hosted-job execution. |
| Attachment path export | Optional PDF link emission derived from user-supplied library location plus verified relative paths. | Do not imply automatic desktop-style path discovery. |
| Desktop fallback | Existing Python application for workflows requiring desktop filesystem behavior. | Keep as explicit fallback language. |

### Degraded-success vocabulary

| Term | Definition | Usage rule |
|---|---|---|
| Completed with warnings | XML generation succeeded but review is required before import. | Preferred label when warnings or skipped records exist. |
| Partial attachment coverage | Attachment rows were detected but not all could be emitted as PDF links. | Use only for attachment-link degradation. |
| Missing attachment payload | Attachment metadata existed but payload content was not present in the selected input. | Use only for verified missing payload cases. |

## Visual implementation constraints

The requested mood cues are frozen as the following implementation constraints:

- **Desktop-first editorial utility dark** means dark surfaces with high contrast, explicit borders, disciplined accent use, and restrained decoration.
- **Reduced blur** means background blur is removed from primary surfaces and not used as a primary style device.
- **Sharper surfaces** means smaller radii, stronger panel separation, and less diffuse shadow treatment.
- **Serif display moments** means a display serif is limited to headline and section-title moments; operational UI remains sans serif.
- **Inter for UI** means controls, tables, form fields, labels, and metadata use an Inter-first sans stack.
- **Display serif selection** is frozen to a Newsreader-first stack with a local serif fallback.
- **Color hierarchy** remains single-accent and semantic. Warning, success, and error colors are reserved for state communication.

## Implementation guardrails

1. Keep the application frameworkless.
2. Preserve the current worker and conversion boundaries.
3. Keep ZIP-first intake visually primary until later waves explicitly change layout density.
4. Treat direct-folder intake as experimental and secondary.
5. Keep local-processing and attachment-path language aligned with the existing browser-local contract.
6. Prefer structured state semantics over ad hoc string checks in the presentation layer.

## Explicit non-goals

The redesign does not include the following:

- novelty navigation patterns
- radial controls, rotated labels, or decorative interaction experiments
- hosted-job, queue, or cloud-processing metaphors
- automatic desktop-style attachment path discovery in the browser
- a worker protocol rewrite by default
- a full application state-machine rewrite by default
- any change to Python desktop exporter behavior

## Completion criteria for Waves 1-2

Waves 1-2 are considered aligned with this contract when:

1. the terminology above is reflected in the UI state model and documentation
2. the visual token system reflects the frozen editorial utility-dark constraints
3. the presentation layer is decomposed into named sections/helpers rather than a single monolithic render path
4. the worker/core behavior remains unchanged
