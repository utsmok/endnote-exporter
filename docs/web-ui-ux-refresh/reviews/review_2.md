# Review 2 — Feasibility-oriented critique of alternative plans

## Scope

This review assesses the three plans from a feasibility and implementation-sequencing perspective, with particular attention to the current repository structure and the likely implementation burden on `web/`.

## Feasibility analysis

### Plan A — Conservative

#### Feasibility

High.

The plan can be implemented largely by editing:

- `web/index.html`
- `web/src/styles.css`
- `web/src/app/controller.ts`
- selected tests and docs

This matches the current architecture. No new major abstractions are required.

#### Missing considerations

1. The plan underestimates the cost of maintaining a redesigned IA inside a monolithic controller.
2. It assumes that modal review can remain acceptable after a desktop-first refresh.
3. It does not solve the mismatch between the task’s large-result review target and the current modal/table pattern.

#### Conclusion

Feasible, but likely insufficiently ambitious for the requested redesign scope.

### Plan B — Balanced

#### Feasibility

Moderate to high.

The plan requires moderate presentation refactoring but does not require replacing the core processing model. This is feasible within the current repository because the browser-local code already has clear boundaries around runtime detection, worker messaging, normalization, and conversion.

#### Missing considerations

1. The plan should state more explicitly that worker/core code changes are optional rather than default.
2. The plan should define a ceiling on view decomposition so the work remains frameworkless and bounded.
3. The plan should call out performance acceptance criteria for the inline results workspace.

#### Conclusion

Feasible and proportionate, provided scope discipline is enforced.

### Plan C — Aggressive

#### Feasibility

Moderate at best.

The plan is technically possible, but it compounds multiple risk domains at once:

- presentation architecture rewrite
- state model rewrite
- worker protocol expansion
- test rewrite
- documentation rewrite

This is difficult to justify when the current conversion core is already working and the redesign objective is concentrated on UI/UX.

#### Missing considerations

1. It does not define rollback points between architectural and visual work.
2. It does not specify how long old and new presentation surfaces would coexist.
3. It underestimates the verification burden introduced by worker protocol changes.

#### Conclusion

Feasible only if the repository accepts a significantly larger change program than the task appears to require.

## Comparison matrix

| Criterion | Plan A | Plan B | Plan C |
|---|---|---|---|
| Short-term feasibility | High | Moderate-high | Moderate |
| Structural payoff | Low | High | Very high |
| Change surface area | Small | Medium | Large |
| Test rewrite burden | Low | Medium | High |
| Risk of schedule expansion | Low | Medium | High |
| Fit to requested planning targets | Moderate | High | High |

## Recommendation

Recommend **Plan B**, with explicit feasibility constraints:

1. **Do not refactor worker protocol by default.** Treat worker progress events as an optional extension only if the new IA cannot represent progress honestly using existing state transitions.
2. **Limit decomposition to the presentation layer.** The redesign should extract view sections and perhaps helper modules, but should not introduce a broad internal framework.
3. **Make inline results review mandatory.** This is the clearest gap between current UI and requested desktop ergonomics.
4. **Keep session-loss behavior conservative.** Prefer clear messaging and recoverability boundaries over aggressive persistence of sensitive in-memory data.

## Suggested improvements to each plan

### Improve Plan A by

- explicitly acknowledging that results review remains the main unresolved gap
- adding a firm statement that the plan is a tactical refresh, not a comprehensive redesign

### Improve Plan B by

- defining a maximum decomposition scope
- defining explicit performance and accessibility acceptance criteria for the new review workspace
- sequencing worker changes behind UI validation rather than ahead of it

### Improve Plan C by

- splitting architecture and protocol work into separate optional waves
- adding sharper rollback boundaries
- reducing default commitment to protocol/state-machine expansion

## Open questions

1. Is the repository owner optimizing for fastest acceptable refresh or for a longer-lived browser-local UI foundation?
2. Should the inline results workspace support filtering/search in the same wave, or only improved reading/review ergonomics?
3. What degree of session-loss mitigation is acceptable under the local-only privacy posture?

## Risks

1. A balanced plan without explicit scope boundaries can become an aggressive plan in practice.
2. If inline review is postponed, the redesign will miss one of the most important desktop-specific targets.
3. If state model expansion is too shallow, staged progress and degraded states will remain semantically weak.

## Dependencies

1. The recommended approach depends on treating the worker/core pipeline as stable infrastructure.
2. It also depends on updating tests and docs in lockstep with the UI restructure.
3. Performance validation for review surfaces depends on stress fixtures already present in the repository.

## Testing implications

1. The chosen plan should include a dedicated acceptance suite for keyboard path, zoom, reduced motion, and results review.
2. Large-result handling should be validated using the existing stress fixture path or an equivalent expanded dataset.
3. Any optional worker protocol change should be gated behind new unit/integration tests before UI dependency is introduced.
