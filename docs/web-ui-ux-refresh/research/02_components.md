# Component Research — `web-ui-ux-refresh`

## Scope

This report inventories the current browser-local UI components, their dependencies, and their suitability for a desktop-first editorial utility redesign.

## Findings

### 1. The UI is composed of implicit sections, not reusable components

All visible UI sections are generated in `web/src/app/controller.ts` as string templates. There is no reusable component library, no shared section contract, and no view-level file decomposition.

| Section | Evidence | Current role | Constraint |
|---|---|---|---|
| Hero + worker status | `web/src/app/controller.ts:135-161` | Establishes product framing and worker readiness | Mixes branding, capability status, and help content in one block. |
| Main phase switch | `web/src/app/controller.ts:164-177` | Swaps entire application surface by `phase` | No nested workflow model. |
| ZIP/folder intake surface | `web/src/app/controller.ts:183-308` | Collects ZIP input, directory enhancement, and attachment path input | Too many conceptual responsibilities in one section. |
| Converting state | `web/src/app/controller.ts:312-325` | Displays single progress spinner and file name | No staged progress or severity semantics. |
| Success summary | `web/src/app/controller.ts:328-393` | Displays record counts, attachment counts, warnings, and actions | Density is high, but hierarchy is weak and desktop review affordance is shallow. |
| Results modal | `web/src/app/controller.ts:396-473` | Lists exported item summaries in a modal table | Modal dependency is the dominant review interaction. |
| Error surface | `web/src/app/controller.ts:476-493` | Displays terminal failure state and notes list | Recovery is limited to retry/reset. |
| Warning block | `web/src/app/controller.ts:497-526` | Displays warning list with disclosure copy | There is no formal severity taxonomy beyond warning code strings. |
| Theme toggle | `web/src/app/controller.ts:839-864` | Allows `system` / `light` / `dark` selection | Competent but visually secondary to the overall IA. |

### 2. Intake UX is over-composed for a primary task surface

The intake section currently combines:

- supported ZIP upload (`web/src/app/controller.ts:228-264`)
- drag-and-drop reinforcement (`web/src/app/controller.ts:260-267`)
- optional attachment base path input (`web/src/app/controller.ts:269-297`)
- supported archive disclosure (`web/src/app/controller.ts:298-306`)
- experimental direct-folder enhancement (`web/src/app/controller.ts:183-226`)

This is technically accurate, but it creates an intake surface that asks users to reason about three different concepts before conversion starts:

1. how to provide a library
2. whether the folder picker is available
3. whether PDF links should be emitted

For a desktop-first editorial utility, the first surface should likely privilege one primary action and defer secondary concepts until after library validation or until the user explicitly requests attachment link export.

### 3. The review experience is modal-centric and table-heavy

| Evidence | Technical implication |
|---|---|
| `web/src/app/controller.ts:406-473` | Item review requires a blocking `<dialog>` and `showModal()` interaction. |
| `web/src/app/controller.ts:431-468` | The table is defined inline with fixed columns Title / Author / Journal / Year / PDF / DOI. |
| `web/src/styles.css:710-780` | Modal and table styling assume a large viewport and scrolling container. |
| `web/src/styles.css:756`, `903` | The table has `min-width: 900px` on desktop and `760px` even in the mobile media query. |
| `web/tests/e2e/smoke.spec.ts:60-91` | Coverage explicitly asserts the modal layout and wide-table behavior. |

The current design is not broken for small result sets. It is likely to be weak for large-result review, keyboard-intensive inspection, multi-selection mental models, and desktop comparison workflows.

### 4. Accessibility semantics are partial

#### Present

| Evidence | Semantic status |
|---|---|
| `web/src/app/controller.ts:389` | Inline download error uses `role="alert"`. |
| `web/src/app/controller.ts:406` | Review modal uses `aria-labelledby` and `aria-modal="true"`. |
| `web/src/app/controller.ts:499` | Warnings container uses `role="region"` with `aria-labelledby`. |
| `web/tests/e2e/smoke.spec.ts:60-91` | E2E coverage asserts an accessible modal title and button discoverability. |

#### Absent or incomplete

| Evidence | Gap |
|---|---|
| No match for skip-link patterns in `web/index.html` or `web/src/app/controller.ts` | There is no skip link. |
| No match for `aria-live` or `role="status"` in source | Live progress/status semantics are absent. |
| `web/src/app/controller.ts:431-468` | The results table has no `<caption>` and no descriptive summary for assistive technologies. |
| `web/src/app/controller.ts:150-151`, `317-323` | Status text and spinner are visually present but not announced through a live region. |

This is consistent with the known gaps supplied in the task request.

### 5. The current IA only partially matches the target IA

Target IA requested by the task:

1. hero / primary task
2. workflow strip
3. trust / proof block
4. results area
5. recovery / help

Current IA implementation:

| Current area | Evidence | Alignment |
|---|---|---|
| Hero + status | `web/src/app/controller.ts:135-161` | Partial match. Primary task framing exists, but worker readiness and trust messaging are mixed together. |
| Intake card | `web/src/app/controller.ts:228-308` | Partial match. Primary task is present, but workflow explanation is not visually segmented. |
| Success summary + actions | `web/src/app/controller.ts:350-393` | Partial match. Results summary exists, but proof/trust and recovery/help are not structurally separated. |
| Warning region | `web/src/app/controller.ts:497-526` | Partial match. Recovery/help is subordinate and reactive rather than persistent. |
| Results modal | `web/src/app/controller.ts:406-473` | Partial match. Results exist, but as a secondary modal rather than a primary desktop review area. |

A redesign aligned to the requested IA will require structural reallocation of information, not just styling.

### 6. Desktop ergonomics are underdeveloped

| Evidence | Technical finding |
|---|---|
| `web/src/styles.css:603-617` | Converting state is a single horizontal spinner row, not a workflow strip. |
| `web/src/styles.css:710-780` | Large modal/table structure is optimized for containment, not desk-scale review. |
| `web/src/app/controller.ts:350-381` | Summary metrics are presented as flat cards without priority ordering or analyst-oriented review actions. |
| `web/src/app/controller.ts:378-385` | Only three actions exist after success: download, view items, convert another. |

A desktop-first redesign should likely treat the result set as a first-class workspace rather than a subordinate modal.

### 7. Theme, help, and enhancement affordances are present but diffuse

Tooltips and disclosure blocks are used extensively:

- worker status help (`web/src/app/controller.ts:153-156`)
- folder-picker help (`web/src/app/controller.ts:189-196`)
- ZIP upload help (`web/src/app/controller.ts:236-243`)
- drag-and-drop help (`web/src/app/controller.ts:260-267`)
- attachment path help (`web/src/app/controller.ts:270-286`)
- warnings help (`web/src/app/controller.ts:502-518`)
- runtime/help details (`web/src/app/controller.ts:897-924`)

This indicates an intent to support user interpretation. The problem is placement and prioritization. Help is embedded locally, but there is no persistent trust/proof or recovery/help block in the main IA.

## Improvement opportunities

1. Extract explicit view sections: hero/task, workflow strip, trust/proof, results workspace, recovery/help.
2. Replace modal-dominant results review with an inline desktop review surface or split-pane/drawer pattern.
3. Decouple attachment-link input from the initial intake moment unless the user opts into attachment link export.
4. Add proper live-region semantics, skip link, and table caption/description.
5. Introduce a severity taxonomy that distinguishes informational notes, degradations, warnings, recoverable failures, and terminal failures.

## Open questions

1. Should the direct-folder enhancement remain in the primary intake card, or should it move into an advanced or capability panel?
2. Should item review become an always-visible results pane, or a non-modal dock that can still be collapsed?
3. How much of the current tooltip/disclosure copy should remain inline versus move into a persistent trust/help region?
4. Should PDF-link opt-in remain a free-text path field, or should it become a secondary post-validation step with stronger explanation?

## Risks

1. Removing the modal review pattern will invalidate existing Playwright expectations and may require substantial test updates.
2. Over-segmenting the intake surface could make the UI look more complex rather than simpler if hierarchy is not strict.
3. Moving warning/recovery information too far from the results context could reduce perceived transparency.
4. A new results workspace could perform poorly for large result sets if table rendering is not reconsidered.

## Dependencies

1. Component restructuring depends on changes to `web/src/app/controller.ts` and likely introduction of new view files under `web/src/app/` or `web/src/ui/`.
2. Accessibility improvements depend on markup changes in `web/index.html`, `web/src/app/controller.ts`, and CSS support in `web/src/styles.css`.
3. Any results-surface redesign depends on preserving the existing `ExportResult.metadata.items` contract or extending it deliberately.

## Testing implications

1. Playwright coverage in `web/tests/e2e/smoke.spec.ts` must be updated if modal review becomes inline or non-modal.
2. Accessibility assertions should be added for skip links, live regions, captions, focus order, and keyboard-only review flow.
3. Large-result review ergonomics require at least one stress fixture assertion beyond the current supported single-record flow.
4. Theme and help affordance regressions require snapshot or visual verification because they are currently only lightly asserted.
