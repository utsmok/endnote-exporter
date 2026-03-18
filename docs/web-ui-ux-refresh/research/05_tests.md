# Test Research — `web-ui-ux-refresh`

## Scope

This report inventories automated coverage relevant to the browser-local UI, identifies quality gates already in place, and documents the gaps that matter to a desktop-first UI/UX redesign.

## Findings

### 1. The browser-local workspace has established unit and E2E infrastructure

| Area | Evidence | Technical finding |
|---|---|---|
| Package scripts | `web/package.json:10-22` | The workspace defines build, typecheck, Vitest, Playwright smoke, and browser-matrix scripts. |
| Vitest config | `web/vitest.config.ts:1-6` | Unit tests run in a Node environment across `src/**/*.{test,spec}.ts`. |
| Playwright config | `playwright.config.ts:1-46` | E2E coverage runs against `web/tests/e2e`, with Chromium, Firefox, and WebKit projects, served through Vite. |

This is a healthy baseline for a UI redesign because the repository already accepts browser-level verification as part of the product surface.

### 2. Core conversion logic is substantially better covered than UI rendering structure

| Coverage area | Evidence | Observation |
|---|---|---|
| Normalization | `web/src/core/normalize-library.test.ts:73-184` | Approved archive shapes and normalization failures are covered. |
| Mapping / XML / export result | `web/src/core/map-record.test.ts:65-...`, `web/src/core/export-xml.test.ts:7-...`, `web/src/core/build-export-result.test.ts:67-410` | Conversion semantics and metadata assembly have broad unit coverage. |
| Attachment resolution | `web/src/core/resolve-attachments.test.ts:78-...` | Attachment omission and partial-link logic are covered. |
| End-to-end core parity | `web/src/core/fixture-parity.test.ts:33-94` | Fixture-backed browser-local parity is explicitly asserted. |
| Worker query path | `web/src/worker/query-endnote.test.ts:59-...` | Worker-side DB projection logic is covered. |

The core pipeline is already guarded. The redesign planning focus should therefore be on UI-state, accessibility, and interaction coverage rather than on re-proving conversion semantics from scratch.

### 3. Controller tests are narrow and behavior-specific

| Evidence | Technical finding |
|---|---|
| `web/src/app/controller.test.ts:63-214` | Controller tests cover download behavior and theme persistence, but do not assert render structure, IA, keyboard navigation, live regions, or accessibility semantics. |
| `web/src/app/controller.test.ts:53-54` | Test data includes warnings and counts but is not used to validate review hierarchy or severity presentation. |

A major UI refactor will need additional view tests or controller render assertions. Current coverage will not catch most IA regressions.

### 4. Playwright smoke coverage is useful but currently aligned to the existing modal/table design

| Evidence | Technical finding |
|---|---|
| `web/tests/e2e/smoke.spec.ts:11-35` | Covers system theme default and explicit theme persistence. |
| `web/tests/e2e/smoke.spec.ts:37-48` | Covers XML download in the supported ZIP-first path. |
| `web/tests/e2e/smoke.spec.ts:50-58` | Covers attachment warning presentation. |
| `web/tests/e2e/smoke.spec.ts:60-91` | Explicitly asserts the accessible exported-items modal, wide layout, DOI links, and PDF status icons. |
| `web/tests/e2e/smoke.spec.ts:93-100` | Covers malformed archive error surface. |

This suite is relevant but also reveals redesign coupling. Replacing the modal-heavy review pattern will require intentional Playwright updates.

### 5. Browser matrix coverage is conservative and contract-aligned

| Evidence | Technical finding |
|---|---|
| `web/tests/e2e/browser-matrix.spec.ts:5-29` | The matrix suite checks the served ZIP-first baseline across claimed browser tiers and verifies that ZIP affordance remains visible when direct-folder intake is unavailable. |

This is aligned with the documented support matrix. The redesign must preserve this baseline or update both tests and docs deliberately.

### 6. Fixture infrastructure is strong and should be reused for redesign verification

| Area | Evidence | Technical finding |
|---|---|---|
| Browser-local fixture corpus | `testing/browser-local/fixtures/`, `testing/browser-local/golden/` | The repository already contains deterministic browser-local fixtures and goldens. |
| Helper harness | `web/src/test/repo-fixtures.ts:18-157` | Shared helpers load fixtures, run conversion, validate XML, materialize PDF placeholders, and build file-system-like directory handles. |
| E2E helpers | `web/tests/e2e/helpers.ts:26-47` | Shared utilities upload fixture ZIPs, convert fixtures, locate summary lines, and read downloaded XML. |
| Repo memory | `memories/repo/testing.md:1-2` | The sample library has 264 DB refs and 122 attachment rows across 107 refs, but no checked-in PDF payloads; missing-payload behavior is therefore a first-class test concern. |

This is a suitable base for visual verification, stress review, and contract-preserving redesign work.

## Coverage gaps relevant to the redesign request

### Accessibility and semantics

1. No automated assertions for skip-link presence.
2. No automated assertions for `aria-live` / status announcement behavior.
3. No automated assertions for table captions or descriptive review context.
4. No keyboard-path tests covering intake → conversion → review → download without mouse input.

### Motion and resilience

1. No reduced-motion E2E assertions, despite CSS adjustments at `web/src/styles.css:629-640`.
2. No zoom or large-text coverage.
3. No session-loss / refresh-interruption tests.

### Results ergonomics and proof

1. No large-result review tests beyond basic fixtures.
2. No visual regression or screenshot-based review of desktop layout.
3. No assertions for staged progress semantics because the UI currently exposes only a spinner and terminal state.
4. No severity-taxonomy tests beyond raw warning-code visibility.

### Metadata and browser chrome

1. No assertions for document metadata beyond theme persistence attributes.
2. No test coverage for `theme-color` or other browser-chrome theming because those metadata tags do not currently exist.

## Improvement opportunities

1. Add structural render tests for major sections if the controller remains frameworkless.
2. Add Playwright coverage for keyboard flow, live updates, skip link, captioned results review, and large-text resilience.
3. Add screenshot or snapshot verification for the desktop-first layout and dark-theme hierarchy.
4. Add session-loss and refresh interruption scenarios if the redesign introduces recoverable state.

## Open questions

1. Should visual regression be added through Playwright screenshots, or should verification remain manual plus semantic assertions?
2. If the modal review pattern is replaced, should tests cover virtualized or chunked list behavior for large result sets?
3. Should an accessibility engine be introduced, or should the redesign rely on explicit semantic assertions only?
4. Should theme/browser metadata be tested in E2E once browser-chrome theming is introduced?

## Risks

1. UI redesign work can outpace test redesign work, leaving the conversion core strongly covered but the product surface weakly guarded.
2. Replacing modal review without updating E2E coverage would silently remove the current accessibility assertions.
3. Visual adjustments could regress contrast or focus affordances with little immediate automated signal.
4. Large-result ergonomics could degrade without being noticed because current fixtures emphasize correctness more than review-scale stress.

## Dependencies

1. Additional UI tests depend on the eventual markup structure chosen by the redesign plan.
2. Large-result review tests depend on fixture strategy and possibly new helper utilities.
3. Session-loss tests depend on whether the redesign introduces persistence or staged recoverability.

## Testing implications

1. Any chosen plan must reserve explicit work for expanding Playwright and controller/view coverage.
2. Accessibility and resilience requirements in the task should be translated directly into automated acceptance criteria.
3. Fixture-backed conversion parity should remain intact as a non-negotiable regression layer while UI tests evolve.
4. Visual verification should be part of the plan because the redesign objective is materially visual and ergonomic, not only functional.
