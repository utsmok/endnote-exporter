# Review 1 — Comparative critique of alternative plans

## Scope

This review compares Plan A (Conservative), Plan B (Balanced), and Plan C (Aggressive) against the research corpus and the explicit task constraints.

## Evaluation criteria

1. Alignment with requested desktop-first editorial utility direction
2. Ability to close the known UX/accessibility gaps
3. Preservation of the browser-local contract
4. Maintainability improvement relative to current controller concentration
5. Delivery risk and test burden

## Plan-by-plan critique

### Plan A — Conservative

#### Strengths

1. Correctly preserves the proven worker and conversion boundaries.
2. Low file churn reduces the chance of destabilizing the current application.
3. Sufficient for immediate style correction, skip-link/live-region remediation, and reduction of glass-heavy presentation.
4. Appropriate if schedule tolerance is very narrow.

#### Weaknesses

1. It does not sufficiently address the central architectural finding: `web/src/app/controller.ts` is already a high-concentration debt file.
2. It only partially addresses the modal-heavy results review problem. The research corpus indicates that large-result review ergonomics are not solved by richer summaries alone.
3. It leaves staged progress, recovery, and session-loss behavior constrained by the current coarse state model.
4. The requested IA shift would be implemented inside the existing monolithic render file, which is likely to reduce long-term clarity.

#### Assessment

Plan A is viable, but it is better understood as a tactical refresh than a comprehensive redesign.

### Plan B — Balanced

#### Strengths

1. It directly addresses the main structural constraint without refactoring the worker/core pipeline.
2. It aligns best with the requested IA by permitting real section decomposition and an inline desktop review workspace.
3. It leaves room for staged progress, severity taxonomy, and recovery/help improvements without demanding a full state-machine rewrite.
4. It creates a maintainable path for typography, token, and IA changes to remain coherent over time.

#### Weaknesses

1. It introduces non-trivial file churn in the presentation layer and therefore requires discipline to avoid sliding toward Plan C.
2. It still leaves ambiguity around whether worker progress semantics remain UI-derived or protocol-derived.
3. It requires broad test updates because Playwright currently encodes the modal review pattern.

#### Assessment

Plan B is the strongest fit to the research findings and the user’s planning targets. It solves the right problems at the right layer.

### Plan C — Aggressive

#### Strengths

1. It provides the best long-term technical architecture for future UI growth.
2. It is the strongest answer for large-result review, session-loss behavior, and staged progress precision.
3. It would produce the cleanest separation between state, worker protocol, and presentation.

#### Weaknesses

1. It exceeds the evidence-based minimum required to satisfy the redesign task.
2. It expands risk into worker protocol and state-machine redesign, although the current worker/core pipeline is not the principal problem.
3. It carries the largest test rewrite burden and the largest schedule risk.
4. It risks turning a UI/UX redesign into a near-replatforming of the presentation layer.

#### Assessment

Plan C is technically coherent but strategically excessive for the present objective.

## Comparison matrix

| Criterion | Plan A | Plan B | Plan C |
|---|---|---|---|
| Contract preservation | Strong | Strong | Moderate-strong |
| Accessibility gap closure | Moderate | Strong | Strong |
| Desktop review ergonomics | Moderate | Strong | Very strong |
| Maintainability improvement | Low | Strong | Very strong |
| Delivery confidence | Strong | Moderate-strong | Low-moderate |
| Risk of overreach | Low | Moderate | High |

## Risk vs reward assessment

- **Plan A** has favorable risk but limited reward.
- **Plan B** has acceptable risk and high reward.
- **Plan C** has high reward but exceeds the likely risk budget for a redesign focused on `web/`.

## Recommendation

Recommend **Plan B as the base approach**, with two constraints:

1. preserve Plan A’s discipline around contract fidelity and avoidance of unnecessary worker/core churn
2. borrow only selective Plan C elements where they are clearly justified by the task, specifically:
   - explicit desktop review workspace instead of modal-first review
   - improved stage semantics if they can be implemented without disproportionate protocol churn

## Suggested hybridization

Recommended hybrid:

- **From Plan A:** minimal disruption to worker/conversion core; do not broaden runtime promises; keep scope centered on `web/`
- **From Plan B:** view decomposition, IA rebuild, inline review workspace, severity/recovery model, accessibility remediation
- **From Plan C:** only the subset of architectural tightening needed to support large-result review and session-loss messaging; do not commit to a full state-machine or protocol rewrite unless implementation evidence forces it

## Open questions

1. Is inline desktop review considered mandatory for the redesign, or acceptable as a later wave after a lighter IA refresh?
2. Can staged progress be represented honestly without worker protocol expansion?
3. How much file decomposition is desirable before maintainability gains flatten out?

## Risks

1. If Plan B is executed without strict scope control, it can drift into Plan C.
2. If Plan B is over-constrained to preserve the current controller, it can degrade into Plan A with insufficient maintainability gain.
3. If review ergonomics are not prioritized early, the redesign may still leave the largest desktop-specific gap unresolved.

## Dependencies

1. A hybrid recommendation depends on sequencing presentation refactor work before aggressive protocol changes.
2. It also depends on coordinated updates to tests and documentation, because the current browser-local docs are already precise.

## Testing implications

1. Choose Plan B only if the project accepts new E2E coverage for inline review and keyboard flow.
2. Keep parity and conversion tests unchanged where possible to isolate redesign risk to the UI layer.
3. Add visual verification because the chosen approach is materially visual, not merely structural.
