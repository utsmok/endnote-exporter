# Review 1: Local Web Execution Plans

**Reviewer:** Review Agent 1
**Date:** 2026-03-18
**Scope:** Review of the browser-local / client-side initiative plans in `docs/local-web-execution/plans/`

Reviewed plans:

- `plan_a_conservative.md`
- `plan_b_balanced.md`

This review focuses on whether the browser-local initiative is technically credible, product-honest, and appropriately sized for the current repository: a compact Python desktop exporter with dense exporter logic, minimal dependencies, and no existing browser runtime.

---

## Executive assessment

Both plans are thoughtful and materially better than a naive “just port it to the browser” approach. Both also correctly identify the biggest truth of this initiative: the hard part is **not** making a page with an upload button; the hard part is safely and credibly reproducing EndNote parsing and Zotero XML generation inside a constrained browser runtime.

### High-level judgment

- **Plan A** is the safest way to test browser-local viability without overcommitting. It is the better plan if the team wants a **narrow, low-drama, Chromium-first MVP** and is willing to explicitly reduce attachment semantics.
- **Plan B** is the stronger long-term implementation plan for a real browser-local product because it invests in a **maintainable TypeScript/browser architecture**, stronger specification work, and a more realistic testing and release posture.
- If forced to choose one plan as written, **Plan B is the better foundation**.
- If optimizing for delivery confidence and scope control, the best answer is a **hybrid: Plan A’s contract discipline and constrained MVP, implemented using Plan B’s technical architecture and verification model**.

---

## What each plan gets right

Before critiquing details, it is worth noting the shared strengths.

### Shared strengths across both plans

1. **They reject server-side conversion as the default path.**
   That is correct for the stated initiative. A browser-local approach keeps privacy messaging simpler and avoids building backend upload/processing infrastructure prematurely.

2. **They treat the current Python exporter as the behavior oracle.**
   This is essential. The existing exporter defines what “correct” means today, even if its implementation is not directly portable.

3. **They treat SQLite/WASM as the technical crux rather than hiding from it.**
   EndNote data lives in `sdb/sdb.eni`; any serious browser-local implementation must confront client-side SQLite execution.

4. **They explicitly downgrade desktop attachment assumptions.**
   This is one of the most important product-honesty decisions in the entire initiative. Browser-local execution cannot safely pretend it has desktop file path semantics.

5. **They sequence packaging/distribution after core feasibility.**
   Also correct. Single-file HTML is a distribution question, not the source architecture.

---

## Detailed critique by plan

## Plan A — Conservative

### Strengths

1. **Best scope discipline**
   Plan A is excellent at saying “no” early:
   - no hosted backend
   - no wrapper-first path
   - no broad browser promises
   - no raw folder-selection requirement for MVP
   - no single-file HTML commitment up front

   That discipline matches the current repo and reduces the chance of an attractive-but-fragile prototype.

2. **Correct MVP contract bias: ZIP-first, Chromium-first**
   This is the most realistic browser contract for a first release. ZIP upload is broadly supportable, testable, and avoids tying MVP viability to uneven folder API support.

3. **Low integration risk with the existing project**
   Keeping the browser app isolated in `web/` is smart. It gives the initiative a rollback boundary and avoids destabilizing the desktop path while feasibility is still unknown.

4. **Good instinct on worker isolation**
   Running ZIP handling, SQLite reads, and conversion work off the main thread is non-negotiable for a usable browser implementation.

5. **Strong rollback and fallback language**
   The plan is unusually honest about the possibility that browser-local constraints may prove unacceptable and that wrappers might become necessary later.

6. **Right skepticism toward single-file HTML**
   Plan A treats single-file packaging as an experiment rather than a promise. That is exactly right.

### Weaknesses

1. **Too little emphasis on a formal conversion specification**
   Plan A uses the Python exporter as an oracle, but does not go far enough in extracting and freezing the mapping/parity rules before implementation. That creates a risk of “fixture-driven cargo culting,” where the JS implementation passes a small fixture set while still under-specifying important transformation behavior.

2. **Fixture set may be too narrow for safe confidence**
   The proposed fixture baseline is good for bootstrapping, but too small for a product-facing MVP. Missing or underemphasized cases include:
   - mixed-case `.Data` directory resolution
   - attachment edge cases with multiple file records
   - malformed but partially recoverable libraries
   - larger libraries that stress memory/time limits
   - field/mapping edge cases from `_build_record_dict()`-style logic

3. **Plain-JS source architecture may become a false economy**
   For a tiny prototype, plain browser modules are fine. For a conversion tool with workers, WASM assets, typed result models, warning classes, and testable mapping logic, plain JS is likely to age poorly. The plan avoids framework sprawl, which is good, but it may also avoid too much tooling.

4. **“Reduced attachment semantics” is directionally correct but product-incomplete**
   Plan A says browser mode should not emit desktop-style absolute PDF paths. Correct. But it stops short of specifying what users should actually expect instead:
   - no attachment nodes at all?
   - bibliographic-only export plus warnings?
   - source-relative metadata that Zotero may or may not use?
   - a sidecar manifest for later re-linking?

   Without a sharper contract, attachment behavior risks becoming a vague disappointment rather than an explicit product choice.

5. **Underdeveloped offline/distribution story**
   Plan A says “local processing” and defers single-file HTML, but does not clearly distinguish:
   - **local processing** from
   - **offline-capable delivery** from
   - **double-clickable local file execution**.

   Those are not the same thing in browsers. A static app served from a dev server or hosted site can still process data locally while not being meaningfully offline in distribution terms.

6. **SQLite/WASM feasibility is treated as medium risk when it may be the gating risk**
   For small fixtures, browser SQLite is plausible. For realistic libraries, it may be the dominant constraint due to memory duplication, ZIP decompression overhead, and worker/WASM loading details. Plan A acknowledges the issue but slightly understates how central it is.

### Overall assessment

Plan A is the **best plan for a disciplined feasibility-first MVP**. It is weakest where the initiative needs a maintainable source architecture and stronger upfront definition of parity, attachments, and browser/offline semantics.

---

## Plan B — Balanced

### Strengths

1. **Best implementation architecture**
   Vite + TypeScript + Web Worker + SQLite/WASM is the most credible source architecture of the two plans. It fits the technical problem:
   - worker-heavy pipeline
   - richer typing around warnings/results/errors
   - more maintainable module boundaries
   - easier WASM/asset handling than a hand-rolled plain-JS setup

2. **Best emphasis on conversion-spec extraction**
   T003 (“Extract conversion specification and parity rules”) is one of the strongest tasks in either plan. This is exactly the kind of work that prevents accidental divergence from the Python exporter.

3. **More realistic about long-term maintainability**
   The browser initiative is not just a demo; it introduces a second runtime surface. TypeScript, structured tests, CI, and explicit types make that much more supportable.

4. **Better testing and hardening posture**
   Plan B is stronger on layered testing:
   - unit tests
   - integration tests
   - browser automation
   - release/support documentation

   That is important because browser-local correctness issues will often hide at the seams between archive normalization, DB access, mapping, and browser UX.

5. **Better distribution analysis**
   Plan B treats single-file packaging and wrappers as optional downstream packaging modes. That framing is more mature than designing around one artifact shape prematurely.

6. **Better articulation of progressive enhancement for folder input**
   Direct folder intake is appropriately treated as optional capability, not baseline product contract.

### Weaknesses

1. **Higher setup and repo-complexity cost**
   Plan B is more maintainable in the medium term, but it gets there by adding a full browser workspace, web build tooling, test tooling, and CI surface. For this repository, that is a real cost, not just an aesthetic preference.

2. **MVP may be slightly overbuilt if feasibility fails early**
   If SQLite/WASM or browser-memory behavior proves unacceptable on realistic fixtures, Plan B risks spending too much time on good architecture around a path that still cannot meet product expectations.

3. **Still insufficiently specific on attachment product semantics**
   Plan B is better than A in structure, but it still stops short of turning attachment handling into a concrete MVP product decision. It says attachment policy must be explicit, which is true, but not exactly which user-visible attachment modes are acceptable.

4. **Browser compatibility risk is acknowledged but not operationalized enough**
   The plan says limited browser matrix and progressive enhancement, but it should go further and define decision thresholds such as:
   - what makes Chromium-only acceptable for MVP?
   - what specifically is promised on Firefox/Safari?
   - when does folder support move from “experimental” to “supported”?

5. **Performance risk for large libraries needs explicit acceptance gates**
   Plan B mentions representative larger/stress fixtures, which is good, but does not fully define shipping thresholds such as:
   - max tested archive size
   - max tested record count
   - acceptable conversion latency bands
   - memory-failure behavior and user messaging

6. **Offline wording still needs tightening**
   Like Plan A, it risks allowing “browser-local” and “offline” to blur together. If the app is served from a website and downloads worker/WASM assets at runtime, it is local-processing but not necessarily offline-capable in a user-meaningful sense.

### Overall assessment

Plan B is the **best plan for a supportable browser-local product**, provided the team keeps the first milestone narrow. Its main weakness is not architecture; it is the risk of investing heavily before SQLite/WASM feasibility and realistic library-size behavior are proven.

---

## Head-to-head comparison

## Comparison matrix

| Dimension | Plan A | Plan B | Commentary |
|---|---|---|---|
| **Fit to current repo** | **High** | Medium-High | A introduces the least new machinery; B adds a proper browser workspace and toolchain. |
| **MVP scope discipline** | **Very High** | High | A is better at refusing convenience features early. |
| **Technical maintainability** | Medium | **High** | B’s TypeScript/tooling approach is a better long-term fit for workers + WASM + typed result models. |
| **Parity/spec discipline** | Medium | **High** | B more explicitly extracts conversion rules before porting. |
| **Browser compatibility honesty** | High | High | Both are reasonably conservative, though both could be sharper on exact support language. |
| **SQLite/WASM readiness** | Medium | **Medium-High** | Both rely on it; B is better architected for it, but neither fully proves it yet. |
| **Attachment-policy clarity** | Medium-Low | Medium | Both acknowledge the issue; neither fully turns it into a crisp user contract. |
| **Offline-claim hygiene** | Medium | Medium | Both need tighter wording about local processing vs offline-capable delivery. |
| **Packaging/distribution realism** | **High** | **High** | Both appropriately defer single-file and wrapper work until later. |
| **Rollback simplicity** | **Very High** | High | A’s isolation and minimalism make rollback easier. |
| **Likelihood of a clean prototype quickly** | **High** | Medium-High | A wins on shortest credible path. |
| **Likelihood of a supportable v1** | Medium | **High** | B has the better medium-term operating model. |

### Direct comparison

#### Where Plan A is better

- defining a narrow MVP contract
- minimizing repo disruption
- delaying all “nice UX” features until core feasibility exists
- preserving clear rollback boundaries

#### Where Plan B is better

- maintainable source architecture
- extracting conversion semantics before porting too far
- building a real browser test/release posture
- supporting future distribution modes without redesigning the source tree

#### Practical conclusion

- If the question is **“How do we learn fastest with minimal commitment?”**, choose **Plan A**.
- If the question is **“How do we build the browser-local initiative so it can survive beyond an experiment?”**, choose **Plan B**.
- For this repository and initiative, the best answer is **Plan B with Plan A’s scope restraints**.

---

## Risk vs reward

## Plan A

- **Risk:** Low to Medium
- **Reward:** Medium
- **Best case:** a credible, honest, Chromium-first ZIP-upload MVP with limited attachment support and minimal repo blast radius
- **Main failure mode:** the prototype works for toy fixtures but becomes awkward to extend or underspecified in important mapping/attachment edge cases

### Risk/reward judgment

Plan A offers the best **learning-per-unit-risk**. It is ideal if the team wants a reversible experiment. It is less ideal if the initiative is already expected to become a maintained product surface.

## Plan B

- **Risk:** Medium
- **Reward:** High
- **Best case:** a supportable browser-local product foundation with strong parity discipline, better tooling, and a credible path to progressive enhancement and optional packaging modes
- **Main failure mode:** spending too much effort on architecture and tooling before proving that realistic browser-local SQLite behavior is good enough

### Risk/reward judgment

Plan B has the best **risk-adjusted long-term value**. It carries more upfront cost than A, but if the browser-local initiative is serious, those costs are mostly the right costs.

## Net assessment

- **Lowest implementation risk:** Plan A
- **Highest practical reward:** Plan B
- **Best risk-adjusted recommendation:** **Hybrid leaning toward Plan B**

---

## Important issues not fully addressed

These issues matter regardless of which plan is chosen. They are the places where browser-local dreams often meet browser-local reality.

## 1. Browser compatibility is still underspecified

Both plans correctly avoid promising universal browser support, but neither fully translates that caution into a product-ready support contract.

### Missing or underdefined points

1. **Exact browser/API support tiers**
   The plans should explicitly separate:
   - fully supported
   - supported with reduced UX
   - experimental
   - unsupported

2. **Directory access differences**
   This matters because:
   - Chromium supports richer local file/directory capabilities
   - Firefox is materially weaker here
   - Safari support is more constrained and inconsistent for some file/directory workflows

3. **Execution mode differences**
   A browser app may work when hosted over HTTP but fail or degrade when opened from `file://`, especially with workers and WASM. That matters for any offline or single-file packaging story.

### Recommendation

Create a support matrix that explicitly covers:

- archive upload support by browser
- `.enlp` normalization support by browser
- direct folder selection support by browser
- worker + WASM loading constraints
- `file://` vs local server vs hosted delivery behavior

---

## 2. SQLite/WASM feasibility is the primary technical gate, not just another task

Both plans correctly include SQLite/WASM work, but neither elevates it enough as the **go/no-go driver**.

### Why this is a bigger issue than the plans imply

A realistic browser-local conversion may involve:

- loading a ZIP archive into memory
- inflating archive contents in memory
- extracting DB bytes into memory
- loading the DB into a WASM SQLite engine
- materializing result rows
- generating XML in memory

That can create multiple live copies of large data structures. On larger libraries, this is where the effort can collapse.

### Missing or underdefined points

- tested library-size envelope
- record-count envelope
- memory ceilings or failure thresholds
- timeout expectations
- user-visible behavior when limits are exceeded
- whether the worker can be terminated cleanly on runaway/failed conversions

### Recommendation

Introduce an explicit **feasibility gate before major porting effort**:

- load representative small, medium, and stress fixtures in a worker
- record peak memory symptoms and elapsed time
- define a ship/no-ship envelope for MVP
- decide whether browser-local remains viable before expanding UI and packaging work

In other words: make SQLite/WASM earn its keep early.

---

## 3. Attachment semantics need a sharper product decision

This is one of the most important unresolved areas.

### The current gap

Both plans say browser-local mode should not preserve desktop absolute paths. Correct. But they do not fully define what users actually receive instead.

### Why this matters

Attachment behavior strongly influences whether users perceive the conversion as:

- a full migration tool,
- a metadata-only exporter, or
- a useful but limited browser utility.

Those are different products.

### Questions that need explicit answers

1. Does browser-local MVP export:
   - bibliographic metadata only?
   - metadata plus attachment references?
   - metadata plus a sidecar manifest for later manual relinking?

2. Are attachments omitted always, or only when safe linking semantics are unavailable?

3. If warnings are shown, are they merely advisory, or do they redefine the supported contract?

4. Is there a future wrapper mode specifically intended to restore stronger attachment fidelity?

### Recommendation

Define attachment modes explicitly, for example:

- **Mode A: Metadata-only export**
- **Mode B: Metadata + non-importable attachment metadata for user reference**
- **Mode C: Wrapper/native mode for stronger local file fidelity**

That would turn a fuzzy limitation into an explicit product choice.

---

## 4. Offline claims need much tighter language

“Runs locally in the browser” is not the same as “works offline.” Both plans are at risk of letting those blur together.

### Important distinction

A browser-local app may still require:

- an initial hosted page load
- worker scripts fetched over HTTP
- WASM assets fetched over HTTP
- a local dev server or static server for correct execution

That is local processing, but not necessarily offline-ready distribution.

### Missing or underdefined points

- whether offline means “after first load,” “with service worker,” or “never promised”
- whether the app is expected to function from a zipped artifact, local server, or hosted URL
- whether single-file HTML is considered the offline story or merely an experimental packaging convenience

### Recommendation

Use three separate terms in docs and product wording:

- **local processing** — data stays in the browser runtime
- **offline-capable** — app can function without network after proper installation/caching
- **local file launch** — app can be opened directly from disk via `file://`

Do not imply one when only another is true.

---

## 5. Packaging/distribution is still underexplained

Both plans wisely defer distribution details, but the initiative still needs clearer success criteria here.

### Single-file HTML caveats are bigger than they look

A “single-file HTML” variant sounds convenient, but browsers make it tricky when the app depends on:

- workers
- WASM binaries
- module graphs
- blob URLs or object URLs
- origin-sensitive fetch behavior

### Missing or underdefined points

- whether single-file HTML must support workers/WASM without a server
- whether the packaged artifact is expected to work under `file://`
- whether “single-file” can still rely on embedded or generated blob URLs
- how troubleshooting/support burden will be handled when user launch method differs

### Recommendation

Treat distribution modes as separately validated products:

1. **Canonical mode:** hosted static site or local static-server build
2. **Optional mode:** packaged multi-file offline bundle
3. **Experimental mode:** single-file HTML only if all worker/WASM/loading constraints are actually proven
4. **Fallback/native mode:** wrapper only if browser-local product goals remain unsatisfied

Single-file should not be called “supported” merely because a demo build can be produced.

---

## 6. `.enlp` and ZIP normalization need more concrete rules

Both plans are directionally correct on ZIP/archive-first ingestion, but the normalization contract still needs more precision.

### Missing or underdefined points

- exact accepted archive layouts
- case sensitivity rules for `.Data` directories and internal paths
- duplicate/ambiguous root handling
- behavior when expected files exist multiple times
- how much malformed-but-recoverable behavior is intended versus hard failure

### Recommendation

Write a normalization contract that includes examples of:

- accepted input shapes
- rejected input shapes
- tolerated recoveries
- warning-generating but successful shapes

Without this, ZIP handling can become a messy nest of “helpful” heuristics.

---

## 7. Security and privacy wording is incomplete even for a browser-local product

Even without server-side uploads, privacy wording still matters.

### Missing or underdefined points

- whether any files are cached in browser storage
- whether crash/error reporting includes filenames or metadata
- whether the app uses analytics at all
- how temporary in-memory data is handled conceptually for user trust messaging

### Recommendation

Publish a minimal privacy model for browser-local mode covering:

- no file upload to server (if true)
- no persistent storage by default (if true)
- exactly what, if anything, is cached
- what browser limitations might still expose filenames in the UI or local download flows

---

## Best recommendation

## Recommended approach: Hybrid

The strongest path is a **hybrid that uses Plan B as the implementation base and Plan A as the scope governor**.

### Keep from Plan A

1. **ZIP-first MVP contract**
   Make archive upload the baseline product contract.

2. **Chromium-first support posture**
   Do not overpromise. Treat other browsers as explicit follow-on validation work.

3. **Strict de-prioritization of folder APIs**
   Raw folder intake should remain progressive enhancement, not launch criteria.

4. **Hard skepticism toward single-file HTML**
   Keep it strictly post-MVP and evidence-driven.

5. **Clear wrapper fallback trigger**
   If browser-local cannot satisfy product goals for realistic libraries or attachment expectations, say so and escalate deliberately.

### Keep from Plan B

1. **Vite + TypeScript source architecture**
   This is the better long-term engineering choice for workers, WASM, typed results, and maintainability.

2. **Conversion-spec extraction before deep porting**
   This reduces silent divergence from the Python exporter.

3. **Layered testing model**
   Unit + integration + browser automation is the right structure.

4. **Multi-mode distribution analysis only after core proof**
   Good packaging decisions depend on verified runtime behavior.

### Add to both plans

1. **Early SQLite/WASM feasibility gate**
   Before much UI work, prove the worker + DB + memory behavior on realistic fixtures.

2. **Sharper attachment product modes**
   Define exactly what browser-local users get.

3. **Explicit support-tier matrix**
   Browser + API + launch-mode expectations should be written before release claims.

4. **Precise offline language**
   Separate local processing from offline capability.

---

## Concrete recommended execution order

1. **Freeze contract**
   - ZIP-first
   - Chromium-first
   - explicit attachment mode
   - explicit non-goals
   - explicit offline wording

2. **Build parity/spec artifacts**
   - fixture corpus
   - goldens
   - conversion spec
   - normalization contract

3. **Run SQLite/WASM feasibility spike first**
   - worker loading
   - DB open/query
   - timing/memory on small/medium/stress fixtures
   - go/no-go threshold

4. **Only then build the canonical browser app**
   - TypeScript
   - worker bridge
   - normalization layer
   - mapping/XML core
   - minimal UI

5. **Ship a narrow MVP**
   - ZIP upload
   - XML download
   - explicit warnings
   - constrained browser support

6. **Evaluate packaging after runtime proof**
   - hosted static build first
   - optional offline bundle second
   - single-file HTML only if truly supportable
   - wrapper only if browser-local misses core product needs

---

## Final decision statement

If only one plan can be selected, choose **Plan B**.

If the team is willing to refine the plan before implementation, choose a **Plan B + Plan A hybrid**:

- **Plan B** for architecture, maintainability, and testability
- **Plan A** for MVP scope discipline, browser-support honesty, and fallback boundaries

### Why this is the best answer

Because the browser-local initiative needs two things at once:

1. **discipline not to overpromise**, and
2. **enough engineering structure to survive success**.

Plan A gives more of the first. Plan B gives more of the second. The hybrid gives the best odds of finishing something real instead of either underbuilding or overbuilding.

---

## Concise recommendation summary

**Recommendation:** Use **Plan B as the core implementation plan**, but narrow it with **Plan A’s contract discipline**: ZIP-first, Chromium-first, folder APIs as progressive enhancement, and no single-file or wrapper commitments before proof. Add one missing gate up front: **validate SQLite/WASM memory and performance on realistic fixtures before major porting work**. If that gate passes, proceed with the TypeScript/worker architecture; if it fails, reconsider browser-local scope or escalate to a wrapper path.
