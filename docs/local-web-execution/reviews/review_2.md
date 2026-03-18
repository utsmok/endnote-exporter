# Review Agent 2 — Feasibility and Operational Realism Review

**Date:** 2026-03-18
**Scope reviewed:**
- `docs/local-web-execution/plans/plan_a_conservative.md`
- `docs/local-web-execution/plans/plan_b_balanced.md`

## Executive assessment

Both plans are broadly pointed in the right direction: a browser-local implementation should be **archive-first**, **worker-based**, and **backed by SQLite WASM rather than Pyodide as the default runtime**. However, neither plan is fully operationally complete as written.

- **Plan A** is stronger on scope control and product honesty, but it underspecifies the engineering realities of WASM asset handling, test automation, launch-mode constraints, and long-term maintainability if the team really builds this as plain browser modules.
- **Plan B** is stronger on implementation architecture and maintainability, but it risks expanding the delivery surface too early and is still too soft about the hard boundaries that should trigger wrapper fallback or prevent over-promising browser support.

My recommendation is a **hybrid**:

1. Keep **Plan A’s narrow MVP contract and sequencing discipline**.
2. Adopt **Plan B’s TypeScript + Vite + worker-based source architecture**.
3. Tighten both plans with explicit decisions for:
   - **served-mode vs `file://` behavior**
   - **direct-folder support as a non-MVP enhancement with clear gating**
   - **measured wrapper fallback criteria**
   - **runtime-specific parity rules against the Python reference implementation**

If a single plan must be chosen with minimal editing, **Plan B is the stronger foundation**, but only if it is amended to become more conservative in product promises and escalation criteria. If plan authors are willing to revise, the best outcome is **Plan A scope + Plan B implementation stack**.

## Repo-grounded constraints that any realistic plan must respect

These constraints are not hypothetical; they are visible in the current implementation:

1. **The current exporter is SQLite-first.**
   - `endnote_exporter.py` reads `sdb/sdb.eni` directly via `sqlite3.connect(...)`.
   - Any browser-local path that avoids SQLite WASM is fighting the repo, not following it.

2. **The current input model is directory-structured, not single-file-structured.**
   - The exporter expects `.enl` + sibling `.Data/`, or `.enlp` package contents.
   - This makes raw folder support materially different from archive support.

3. **Current attachment behavior is desktop-native.**
   - PDF URLs are emitted as absolute filesystem paths under `.../PDF/...`.
   - This is not naturally portable to browser-local execution.

4. **The current Python implementation is the only credible parity oracle.**
   - Mapping and XML generation logic are dense and behavior-rich.
   - Porting without a fixture-backed parity contract is high-risk.

5. **`file://` is not a trustworthy product runtime assumption.**
   - SQLite WASM, workers, secure-context-gated APIs, and multi-asset delivery all push the realistic launch model toward **served localhost/HTTPS or wrapper runtime**, not “open this local HTML file and hope”.

These realities should be reflected explicitly in planning, support language, and fallback criteria.

## Detailed critique of Plan A

## Overall judgment

**Plan A is the better delivery strategy, but not yet the better implementation plan.** It is refreshingly disciplined about narrowing the MVP, but it is slightly too optimistic about how simple the browser implementation remains once workers, WASM, packaging, testing, and diagnostics are added.

## What Plan A gets right

1. **Correct product stance for MVP**
   - ZIP-first input is the safest browser-local contract.
   - Chromium-first support is a realistic initial promise.
   - Reduced attachment semantics are the honest browser-local default.

2. **Correct sequencing instinct**
   - Freezing the contract before implementation is essential.
   - Building parity fixtures before porting is the right move.
   - Deferring single-file packaging and wrappers is wise.

3. **Good rollback discipline**
   - Keeping work isolated in `web/` and docs minimizes repo destabilization.
   - Treating wrappers as fallback rather than default avoids premature platform sprawl.

## Feasibility and operational realism concerns

### 1. “Plain HTML/CSS/JavaScript” is undersold as a maintenance choice

The plan frames a framework-light browser app as lower risk. That is only partly true.

For this problem, the hard parts are not component complexity; they are:
- worker lifecycle and messaging
- SQLite WASM asset loading
- bundling worker + WASM artifacts reproducibly
- browser test automation
- launch-mode quirks
- future packaging experiments

A plain-module app can absolutely work, but a fully hand-rolled setup increases the chance of accidental build/deployment complexity later. The plan is conservative on product scope, but **not necessarily conservative on engineering operations**.

### 2. The plan does not make served-mode a hard prerequisite early enough

The plan mentions local dev server support, but it never elevates the runtime distinction strongly enough:

- **served localhost / HTTPS** should be the primary supported browser runtime
- **`file://` should be explicitly unsupported for MVP**
- single-file HTML should not merely be “experimental”; it should be treated as **probable rejection unless proven otherwise**

Without this, the project risks drifting into a misleading distribution story.

### 3. Direct-folder support is delayed, but its long-term position is still fuzzy

Plan A correctly avoids making raw folder selection an MVP requirement. However, it does not define:
- what future evidence would justify adding it
- whether the feature is Chromium-only forever or expected to broaden
- whether `.enlp` direct intake is a distinct product promise from `.zip` intake

That ambiguity creates support risk later.

### 4. The parity concept is still too broad

The plan says the Python exporter is the oracle, which is correct, but it should say **which parts are invariant and which are allowed to diverge by runtime**.

Without that, “parity” can become a trap. For browser-local mode, exact parity is probably realistic for:
- core bibliographic fields
- record counts for supported fixtures
- XML structure for supported fields

But not realistic for:
- absolute PDF path output
- folder-dependent attachment reconstruction semantics
- maybe some runtime metadata or warning surfaces

### 5. The effort estimate is probably optimistic

The stated **20-31 day** total looks light for one engineer if the output is expected to be supportable, documented, and browser-tested.

The biggest underestimation is the interaction among:
- fixture creation
- mapping parity work
- worker/WASM bundling
- cross-browser/launch-mode validation
- support-doc writing

A more operationally realistic range is closer to **5-8 weeks** for a credible MVP, depending on fixture quality and how quickly the team settles the attachment policy.

### 6. Wrapper fallback criteria are directionally right but not measurable enough

The fallback conditions are sensible, but they are still qualitative. “Performance is unacceptable” and “support burden becomes too high” are true statements, but not decision rules.

## Missing considerations in Plan A

1. **Explicit support matrix dimensions**
   - Browser
   - Launch mode (`localhost` / hosted HTTPS / `file://`)
   - Input mode (`.zip`, `.enlp`, folder)
   - Attachment mode
   - Performance envelope

2. **Direct-folder acceptance criteria**
   - Which browsers?
   - Which library layouts?
   - What UX fallback on unsupported browsers?

3. **Wrapper escalation thresholds**
   - What realistic library sizes fail?
   - What browser combinations are acceptable or unacceptable?
   - What parity gaps are disqualifying?

4. **Operational diagnostics**
   - Browser-side logs
   - failure export payloads
   - reproducible debug artifacts

5. **Memory-envelope testing**
   - ZIP extraction + DB bytes + XML blob can create multi-copy memory spikes

## Improvements to Plan A

1. Replace “plain HTML/CSS/JavaScript” with **“small TypeScript app with minimal tooling”**.
2. Move **served-mode requirement** into T001 contract language.
3. Add a formal **parity-rules document** distinguishing:
   - required equivalence
   - accepted runtime divergence
   - unsupported cases
4. Add explicit **direct-folder non-goal wording** for MVP and clear post-MVP entry criteria.
5. Turn T010 wrapper fallback into a measurable decision record with thresholds.
6. Treat single-file HTML as **go/no-go with default bias toward no-go**.
7. Revise schedule language upward to reflect real verification and support work.

## Detailed critique of Plan B

## Overall judgment

**Plan B is the better technical architecture, but it needs stricter product discipline.** It is more believable as something a future maintainer can live with. Its main risk is not technical infeasibility; it is operational breadth.

## What Plan B gets right

1. **Better implementation substrate**
   - TypeScript + Vite + worker structure is a more supportable home for SQLite WASM than an ad hoc plain-JS setup.
   - The plan acknowledges test/lint/CI needs earlier, which is realistic.

2. **Better specification discipline**
   - T003 (`conversion-spec`, `attachment-policy`, `parity-rules`) is one of the best elements across both plans.
   - This directly addresses the actual project risk: under-porting Python behavior.

3. **Better treatment of direct-folder support**
   - Positioning it as a progressive enhancement is correct.
   - Keeping archive-first intake as the baseline contract is the right call.

4. **Better long-term maintainability**
   - A typed codebase with clearer adapters/core/worker separation will age better than a minimal browser prototype if this becomes a supported product.

## Feasibility and operational realism concerns

### 1. The plan risks turning an MVP into a platform program

Plan B is balanced, but it is also the easier plan to accidentally inflate.

It introduces, or strongly implies:
- new JS/TS toolchain
- bundling config
- worker runtime
- browser app workspace
- web test harness
- browser automation
- CI changes
- optional directory intake
- optional packaging evaluation

All of those are reasonable eventually. The risk is that this turns into “build a web product platform” before the core question is answered: **can we reliably match the supported Python behavior for realistic fixtures in a browser-local runtime?**

### 2. It still does not explicitly demote `file://` enough

Like Plan A, Plan B talks about browser-local execution but should more explicitly specify that:
- the canonical runtime is **served**
- `file://` is **not** a supported MVP launch mode
- any single-file artifact is a distribution experiment, not a runtime promise

This matters more in Plan B because Vite + workers + WASM make a loose-file runtime even less credible.

### 3. Browser support wording is still too soft around matrix scope

The plan says limited support wording, which is good, but it should go further and say the support matrix must be **capability-based**, not browser-name-based alone.

For example, the matrix should distinguish:
- ZIP upload support
- `.enlp` upload normalization support
- directory-handle support
- launch mode support
- large-library confidence band

Otherwise, “supported browser” becomes too coarse to be meaningful.

### 4. Wrapper fallback remains under-specified

T012 evaluates packaging, but the plan should be clearer that wrapper work is not just a distribution choice; it is a **runtime escape hatch** for unresolved browser limitations.

That means the plan needs explicit wrapper-trigger conditions such as:
- folder-based workflows required by users but impossible to support credibly in target browsers
- attachment path fidelity required for key user scenarios
- unacceptable browser memory behavior on agreed fixture sizes
- unmanageable support burden from launch-mode/browser differences

### 5. The maintenance burden is real and slightly understated

Plan B is better engineered, but it creates real dual-track maintenance:
- Python reference implementation remains authoritative
- TS browser implementation becomes production code
- docs, fixtures, parity rules, and test harness now span both

That is probably worth it, but it should be called out more bluntly.

## Missing considerations in Plan B

1. **Launch-mode contract**
   - No explicit “served only” or “`file://` unsupported” statement in the tasking.

2. **Support-matrix structure**
   - Needs explicit matrix dimensions rather than generic browser support wording.

3. **Wrapper escalation criteria**
   - The plan needs measurable fallback rules, not just a later evaluation bucket.

4. **Python parity boundaries**
   - “Parity-oriented” is good, but it should name required invariants vs accepted divergences.

5. **Post-MVP direct-folder maintenance cost**
   - Progressive enhancement is correct, but the plan should budget for the documentation and support burden that comes with capability-gated features.

## Improvements to Plan B

1. Add a contract statement in T001: **served localhost/HTTPS is the only supported browser runtime for MVP**.
2. Add a **capability matrix template** to T001/T011.
3. Add explicit **wrapper-trigger thresholds** before T012.
4. Narrow T010 language to avoid implying broad folder support soon after MVP.
5. Make single-file packaging explicitly subordinate to the served multi-file build.
6. Add stronger wording on **dual-maintenance cost** and what must remain shared (fixtures/specs), versus what must remain runtime-specific.

## Complexity comparison across plans

The key difference is not just “simple vs advanced.” It is:
- **Plan A:** lower initial repo/tooling expansion, higher risk of accidental hand-rolled infrastructure
- **Plan B:** higher initial setup cost, lower long-term operational entropy if the feature becomes real

## Comparison matrix

| Dimension | Plan A — Conservative | Plan B — Balanced | Review judgment |
|---|---|---|---|
| MVP scope control | Strong | Moderate | Plan A wins |
| Browser runtime realism | Good | Good | Tie, both need stronger served-mode language |
| Implementation maintainability | Moderate | Strong | Plan B wins |
| Tooling / build discipline | Light | Strong | Plan B wins |
| Risk of overbuilding | Low | Medium-High | Plan A wins |
| Risk of under-engineering worker/WASM delivery | Medium-High | Low-Medium | Plan B wins |
| Direct-folder positioning | Acceptable but vague | Stronger | Plan B wins |
| Support-matrix clarity | Moderate | Moderate | Tie, both need more specificity |
| Wrapper fallback clarity | Moderate | Moderate | Tie, both need measurable triggers |
| Parity-spec discipline | Moderate | Strong | Plan B wins |
| Single-engineer delivery realism | Better | Harder | Plan A wins |
| Long-term supportability if shipped | Moderate | Stronger | Plan B wins |

## Relative implementation complexity

### Plan A

**Relative complexity:** lower initial complexity, medium hidden complexity

Why:
- less tooling
- narrower MVP
- fewer explicit subsystems early

Hidden cost:
- worker/WASM packaging still exists
- test rigor still exists
- plain-JS approach can accumulate ad hoc build and debug burden

### Plan B

**Relative complexity:** medium-high initial complexity, lower structural risk later

Why:
- explicit TS/Vite/test/CI setup
- clearer module boundaries
- more production-realistic delivery baseline

Cost:
- larger up-front investment
- higher chance of schedule stretch if not tightly scoped

### Net complexity conclusion

If the project goal is **prove feasibility fast with minimal blast radius**, Plan A is lighter.

If the goal is **deliver and maintain a browser-local product**, Plan B’s architecture is more realistic even though it is more complex.

## Cross-plan missing considerations

These items should be added regardless of which plan is chosen.

## 1. Direct-folder support needs explicit policy, not just positioning

Both plans correctly avoid making folder support the baseline contract, but neither fully defines:
- whether direct-folder support is considered a Chromium-only enhancement indefinitely
- how `.enlp` directory selection differs from `.zip`/archive normalization in user docs
- whether folder support expands the official support matrix or remains best-effort
- what telemetry/test evidence is required before promoting it

**Recommendation:** define direct-folder support as:
- **post-MVP**
- **capability-gated**
- **non-parity-critical**
- **never the only supported path**

## 2. `file://` vs served-mode behavior must be explicit

This is the biggest planning gap across both documents.

Both plans should explicitly say:
- MVP support is for **served builds only** (`localhost` during development, HTTPS or equivalent for hosted delivery)
- `file://` is **unsupported** for MVP
- single-file HTML, if attempted, is **not evidence that `file://` is a supported runtime**

Without this, support docs and user expectations will drift badly.

## 3. Support matrix promises need more dimensions

A browser support matrix should not just list Chrome/Firefox/Safari. It should distinguish:
- launch mode
- ZIP intake
- `.enlp` intake
- folder intake
- worker/WASM support assumptions
- attachment mode
- tested library-size band

Otherwise, “supported in browser X” will hide meaningful behavioral differences.

## 4. Wrapper fallback criteria need measurable thresholds

Both plans talk about wrapper fallback, but neither converts that into operational criteria. That is risky because wrapper escalation can easily become political rather than evidence-based.

Recommended fallback gates:

1. **Folder workflow gate**
   - If target users require direct folder/package intake on browsers where the feature is not supportable, escalate.

2. **Attachment fidelity gate**
   - If browser-local omission/degradation of PDF path semantics breaks key migration flows, escalate.

3. **Performance gate**
   - If agreed representative fixtures exceed acceptable time or memory envelopes in the browser runtime, escalate.

4. **Support burden gate**
   - If support docs require too many browser-specific exceptions to remain honest and usable, escalate.

## 5. Parity with the Python reference needs runtime-aware boundaries

Both plans say “use Python as the oracle,” but the review strongly recommends splitting parity into three classes:

### Class A — must match
- record inclusion/exclusion for supported fixtures
- core field mapping
- XML structural correctness for supported fields
- deterministic output for repeated runs

### Class B — may differ but must be documented
- attachment link representation
- warning/reporting structure
- browser-specific normalization caveats

### Class C — explicitly unsupported in browser-local MVP
- desktop-style absolute local PDF path fidelity
- any workflow requiring unrestricted native filesystem semantics

This would make implementation and review much less ambiguous.

## Recommended hybrid plan

## Strongest recommendation

The strongest path is a **hybrid of Plan A and Plan B**:

### Keep from Plan A
- narrow ZIP-first MVP
- Chromium-first support language
- explicit reduced attachment policy
- deferred wrappers
- clear rollback isolation
- disciplined sequencing

### Keep from Plan B
- TypeScript + Vite source architecture
- explicit conversion spec / parity rules / attachment-policy docs
- typed worker/core/adapters separation
- stronger automated test posture
- direct-folder support only as progressive enhancement after the core works

## Proposed hybrid execution sequence

1. **Contract first**
   - Define supported runtime as **served multi-file web app**.
   - Define MVP input as **ZIP first**, `.enlp` archive-equivalent second.
   - Mark direct-folder support as non-MVP.
   - Mark `file://` unsupported.

2. **Parity and spec second**
   - Build fixtures and goldens from the Python exporter.
   - Write `conversion-spec.md`, `parity-rules.md`, and `attachment-policy.md` before full porting.

3. **Browser core third**
   - Implement a small **TypeScript/Vite** web app.
   - Use a **worker + SQLite WASM** pipeline.
   - Deliver only XML download and structured warnings.

4. **Verification fourth**
   - Publish a capability-based support matrix.
   - Validate performance on agreed representative fixture sizes.
   - Confirm attachment behavior and support language match actual behavior.

5. **Decision gate fifth**
   - Decide whether to:
     - remain browser-only,
     - add direct-folder enhancement,
     - evaluate wrapper fallback,
     - reject single-file packaging.

## Why this hybrid is stronger than either plan alone

- It preserves **Plan A’s product honesty**.
- It avoids **Plan A’s under-tooled implementation risk**.
- It preserves **Plan B’s maintainability**.
- It avoids **Plan B’s tendency to broaden the project too early**.

In short: it is the best mix of delivery realism and engineering realism.

## Final recommendation

## Recommended choice

**Recommend a hybrid: Plan A scope and sequencing, implemented using Plan B’s TypeScript/Vite/worker/spec structure.**

If forced to choose only one existing document as the starting point, choose **Plan B**, but revise it to be more conservative in runtime promises and fallback triggers.

## Why not Plan A alone?

Because the product stance is strong, but the implementation substrate is too likely to grow accidental complexity once SQLite WASM, workers, testing, and packaging are real.

## Why not Plan B alone, unchanged?

Because it is the easiest plan to turn into a larger platform effort before the core browser-local feasibility question is fully answered.

## Bottom line

The best realistic path is:
- **browser-local first**
- **archive-first intake**
- **served multi-file runtime, not `file://`**
- **TypeScript + worker + SQLite WASM**
- **Python exporter as parity oracle**
- **explicit browser-local divergence for attachments**
- **wrapper fallback only when measured evidence justifies it**

That combination gives the project the best chance of shipping something honest, supportable, and evolvable without pretending the browser is a desktop filesystem in disguise.
