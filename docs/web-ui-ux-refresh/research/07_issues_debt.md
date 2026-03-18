# Issues and Technical Debt Research — `web-ui-ux-refresh`

## Scope

This report identifies structural, accessibility, interaction, and visual debt relevant to a desktop-first UI/UX redesign of the browser-local application.

## Findings

### 1. The principal debt is structural, not commented debt

Searches for `TODO`, `FIXME`, `HACK`, and related markers in the source tree did not reveal material first-party debt markers in `web/src/`. The debt is therefore implicit in structure and behavior rather than explicit in comments.

### 2. `web/src/app/controller.ts` is a high-concentration debt file

| Evidence | Technical finding |
|---|---|
| `web/src/app/controller.ts:28-123` | Application bootstrap, worker initialization, and phase transitions are owned here. |
| `web/src/app/controller.ts:135-526` | All render templates live here. |
| `web/src/app/controller.ts:560-652` | Conversion side effects and input handling live here. |
| `web/src/app/controller.ts:696-816` | Imperative DOM querying and event attachment also live here. |
| `web/src/app/controller.ts:941-1009` | Theme persistence and document mutation also live here. |

This file is the largest single implementation risk for the redesign. A visual refresh that remains entirely inside this file will be feasible but expensive to maintain.

### 3. Known accessibility debt is directly observable

| Evidence | Debt item |
|---|---|
| No skip-link pattern in `web/index.html` or `web/src/app/controller.ts` | Missing skip link. |
| No `aria-live` or `role="status"` pattern in `web/src/app/controller.ts` | Missing live feedback semantics. |
| `web/src/app/controller.ts:406-473` | Modal-heavy results review. |
| `web/src/app/controller.ts:431-468` | Table has headers but no `<caption>` or broader description. |
| `web/src/styles.css:629-640` | Reduced-motion handling only slows spinner and removes some transition duration; it does not redesign interaction motion comprehensively. |

These items correspond closely to the known gaps supplied in the task request.

### 4. Visual debt is concentrated in generic dark-glass styling

| Evidence | Debt item |
|---|---|
| `web/src/styles.css:120-128` | `backdrop-filter: blur(14px)` keeps the primary surface language in a glass pattern the task explicitly wants to reduce. |
| `web/src/styles.css:143-151` | Hero glow produces atmospheric softness rather than precision. |
| `web/src/styles.css:370-389` | Upload card styling is visually generic and consumer-web adjacent. |
| `web/src/styles.css:710-724` | Modal review surface inherits the same softened layering. |

The result is a visually competent but generic dark UI. It does not yet communicate specialist authority or editorial restraint.

### 5. Interaction debt is concentrated in progress, severity, and recovery clarity

| Evidence | Debt item |
|---|---|
| `web/src/app/state.ts:5-13` | State phases are coarse and do not model staged progress. |
| `web/src/app/controller.ts:312-325` | Conversion state is a spinner plus a sentence. |
| `web/src/app/controller.ts:350-393` | Success summary exposes counts but not an explicit severity model or recovery decision tree. |
| `web/src/app/controller.ts:497-526` | Warnings are listed, but taxonomy remains code-string-centric. |
| `web/src/app/controller.ts:476-493` | Error state is terminal and visually simple; recovery/help is minimal. |

The current UI is informative but not highly legible under degraded conditions.

### 6. Desktop ergonomics are under-specified for large result sets

| Evidence | Debt item |
|---|---|
| `web/src/styles.css:756`, `903` | The results table has a wide minimum width and remains horizontally biased. |
| `web/src/app/controller.ts:378-381` | Review remains an optional modal action after success rather than a dedicated desktop workspace. |
| `web/tests/e2e/smoke.spec.ts:60-91` | Current validation treats the wide modal as acceptable baseline behavior. |

This is not inherently incorrect, but it does not satisfy the requested large-result review strategy or desktop-specific review ergonomics planning target.

### 7. Session-loss and continuity behavior are absent

| Evidence | Debt item |
|---|---|
| `web/src/app/state.ts:19-31` | Only theme preference persists across reloads. |
| `web/src/adapters/browser-worker-client.ts:26-95` | In-flight request bookkeeping is lost on unload. |
| `web/src/app/controller.ts:33-38` | Worker client is disposed on `beforeunload` without recovery semantics. |

The redesign request explicitly calls for planning around session-loss behavior. The current implementation does not attempt this.

### 8. Metadata/browser theming polish is incomplete

| Evidence | Debt item |
|---|---|
| `web/index.html:4-27` | The head contains only charset, viewport, inline theme bootstrap, and title. |
| `web/index.html:6` | `viewport` is present. |
| No `theme-color` metadata present | Browser chrome theming is not integrated. |

This is minor from a functional standpoint, but it is directly relevant to the requested polish target.

### 9. Source debt is low in explicit duplication, but high in content duplication inside template strings

Copy relating to ZIP-first baseline, folder-picker experimental status, attachment path explanation, warning explanation, and worker-mode explanation is repeated across hero, intake, tooltip, and disclosure surfaces (`web/src/app/controller.ts:183-308`, `497-526`, `897-935`). This makes messaging drift more likely during future UI iteration.

## Improvement opportunities

1. Decompose the controller into view sections or modules before or during redesign.
2. Introduce a proper accessibility baseline: skip link, live region, captioned review table, stronger focus order, keyboard-specific review path.
3. Replace modal-heavy review with an inline desktop review surface.
4. Tighten the token/surface system and reduce blur/glass reliance.
5. Expand state and worker protocol support for staged progress and recovery semantics.
6. Consolidate explanatory messaging so support/contract language is reusable and consistent.

## Open questions

1. Is the redesign permitted to introduce new files/modules as part of debt reduction, or should architectural change remain minimal?
2. Should large-result review be solved with pagination, chunking, client-side filtering, or a split summary/detail model?
3. How far should session-loss handling go in a local-only browser app without creating privacy or complexity issues?
4. Should the browser-local UI expose raw warning codes by default, or only in a technical-details disclosure?

## Risks

1. Attempting to solve structural debt, IA changes, and visual restyling in one pass could increase delivery risk if sequencing is poor.
2. A purely cosmetic redesign would leave the known accessibility and workflow debt unresolved.
3. Aggressive structural refactoring could destabilize a currently working conversion flow if not isolated carefully from the worker/core pipeline.
4. If messaging consolidation is skipped, contract language drift will continue across tooltips, disclosures, docs, and tests.

## Dependencies

1. Structural debt reduction depends on the chosen plan’s tolerance for file decomposition.
2. Accessibility debt remediation depends on coordinated changes to HTML structure, CSS, and Playwright assertions.
3. Session-loss and staged-progress work depend on state model changes and potentially worker protocol changes.

## Testing implications

1. Debt reduction should be validated with new accessibility and workflow tests, not only with visual review.
2. Any decomposition of `controller.ts` requires render-level regression coverage.
3. Large-result review changes should be validated against stress fixtures, not only single-record fixtures.
4. Browser metadata and reduced-motion polish should receive explicit verification because they currently lack coverage.
