# Documentation Research Report for Browser-Local / Local-Web Execution

Date: 2026-03-18
Repository: `/home/sam/dev/endnote-exporter`

## Scope

Research only. No application code was modified.

This report reviews the existing documentation corpus relevant to a **browser-local / local-web implementation** of the EndNote exporter, with emphasis on:

- what existing documentation is reusable
- what must be rewritten or newly created
- support language and product promises
- privacy claims and offline/local-only messaging
- distribution options for:
  - plain webpage
  - single self-contained HTML
  - Electron
  - Tauri

Primary inputs reviewed:

- `/home/sam/dev/endnote-exporter/README.md`
- `/home/sam/dev/endnote-exporter/docs/local-web-execution/research/00_setup.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port_PLAN.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/00_setup.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/01_architecture.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/02_components.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/03_backend.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/05_tests.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/06_documentation.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/07_issues_debt.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/plans/plan_a_conservative.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/plans/plan_b_balanced.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/plans/plan_c_aggressive.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/reviews/review_1.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/reviews/review_2.md`

## Executive summary

A useful amount of the existing hosted-web documentation is reusable for the browser-local initiative, but mostly as **engineering background**, not as final user-facing product documentation.

The strongest reusable material already covers:

1. the need for a **runtime-neutral export boundary**
2. the importance of **attachment/path policy**
3. the need to **freeze support, privacy, retention, and warning semantics before shipping**
4. the need for **tests, golden fixtures, and careful support wording**

The biggest documentation gaps for a browser-local implementation are:

1. **No browser-local product docs yet** for what “local-only” actually guarantees
2. **No privacy statement** tailored to client-side execution, local storage, optional uploads, or wrapper runtimes
3. **No support matrix** for browser/runtime combinations
4. **No decision records** choosing among plain webpage, single HTML, Electron, and Tauri
5. **No runbooks** for distribution, bug reporting, or support boundaries for browser-local delivery

In short: the repo has a good hosted-web planning spine and a good initial local-web framing doc, but it still needs a dedicated browser-local documentation set before any support or privacy claims should be made publicly.

## What existing documentation is reusable

### 1. `docs/local-web-execution/research/00_setup.md` is the best current starting point

This is the strongest directly reusable document for the browser-local track.

Most valuable reusable parts:

- It already frames the initiative as **browser-local / client-side** (`docs/local-web-execution/research/00_setup.md:5`).
- It explicitly states the intended product posture:
  - process the library on the user’s own device (`docs/local-web-execution/research/00_setup.md:9`)
  - avoid server-side upload by default (`docs/local-web-execution/research/00_setup.md:10`)
- It already identifies the attachment-policy seam caused by absolute PDF paths (`docs/local-web-execution/research/00_setup.md:47`, `128`).
- It explicitly says prior hosted research is reusable around normalization and shared-core planning (`docs/local-web-execution/research/00_setup.md:94`, `112`, `144`, `160`).
- It already enumerates the option families that matter for distribution:
  - plain browser app (`docs/local-web-execution/research/00_setup.md:214`, `230`)
  - browser + WASM (`docs/local-web-execution/research/00_setup.md:250`)
  - single self-contained HTML (`docs/local-web-execution/research/00_setup.md:274`, `278`)
  - Electron (`docs/local-web-execution/research/00_setup.md:297`, `301`)
  - Tauri (`docs/local-web-execution/research/00_setup.md:321`, `325`)
- It already gives a ranking that is documentation-friendly and product-friendly: browser-only first, wrappers only if needed (`docs/local-web-execution/research/00_setup.md:348-351`).

**Assessment:** highly reusable and should remain the browser-local planning index.

### 2. The hosted-web architecture docs are reusable as background, not as promises

The following docs are reusable because they identify cross-cutting concerns that remain true even when execution moves from hosted to local:

- `docs/platform-and-web-port/research/01_architecture.md`
- `docs/platform-and-web-port/research/02_components.md`
- `docs/platform-and-web-port/research/03_backend.md`
- `docs/platform-and-web-port/research/05_tests.md`
- `docs/platform-and-web-port/research/07_issues_debt.md`

Most reusable insights:

- the exporter logic is reusable, but its runtime contract is too local-filesystem-shaped (`docs/platform-and-web-port/research/01_architecture.md:428-434`; summarized in `docs/platform-and-web-port/research/03_backend.md:27-34`)
- attachment semantics are a product decision, not just an implementation detail (`docs/platform-and-web-port/research/03_backend.md:103-109`, `377-379`)
- upload/input normalization should converge on one canonical prepared-library model (`docs/platform-and-web-port_PLAN.md:257-262`)
- warning / partial-success semantics need to be explicit (`docs/platform-and-web-port_PLAN.md:199`, `207`, `421`)
- tests and golden fixtures must land before refactors (`docs/platform-and-web-port/reviews/review_1.md:33`, `145`, `376`; `docs/platform-and-web-port/reviews/review_2.md:24`, `547`)

What is **not** directly reusable:

- hosted API / worker / retention instructions as final browser-local product docs
- any phrasing that implies user libraries are uploaded to a service by default
- any hosted privacy wording that centers server retention rather than on-device processing

**Assessment:** reusable as engineering rationale; must be reframed before it becomes local-web documentation.

### 3. The existing documentation-gap analysis is reusable and still accurate

`docs/platform-and-web-port/research/06_documentation.md` is especially reusable because it already identifies documentation process problems that also matter for the browser-local track:

- stale run instructions in `README.md` (`docs/platform-and-web-port/research/06_documentation.md:189-196`; source issue visible at `README.md:48`)
- mixed Linux support messaging (`docs/platform-and-web-port/research/06_documentation.md:203-211`; source claim at `README.md:16`)
- no product-level attachment/path rules (`docs/platform-and-web-port/research/06_documentation.md:170-177`)
- no privacy / retention / compliance doc (`docs/platform-and-web-port/research/06_documentation.md:178-182`)
- no signed/notarized macOS release ops doc (`docs/platform-and-web-port/research/06_documentation.md:139-141`, `209-211`)
- the bottom-line gap summary is still useful: no real Goal B architecture/privacy/ops docs, and no release-ops doc for macOS signing (`docs/platform-and-web-port/research/06_documentation.md:280-281`)

**Assessment:** highly reusable as a model for how to structure the new browser-local documentation report and backlog.

### 4. The plan/review docs are reusable as documentation backlog generators

These docs already name the missing docs/runbooks that a serious product track needs:

- desktop release matrix / support policy (`docs/platform-and-web-port/plans/plan_a_conservative.md:66`)
- desktop release ops (`docs/platform-and-web-port/plans/plan_a_conservative.md:71`, `201`)
- macOS signing/notarization doc (`docs/platform-and-web-port/plans/plan_a_conservative.md:72`, `202`)
- attachment policy doc (`docs/platform-and-web-port/plans/plan_a_conservative.md:76`, `203`; `docs/platform-and-web-port_PLAN.md:373`)
- web MVP runbook (`docs/platform-and-web-port/plans/plan_a_conservative.md:75`, `204`; `docs/platform-and-web-port_PLAN.md:390`)
- deployment / rollback docs (`docs/platform-and-web-port/plans/plan_a_conservative.md:78`, `205`; `docs/platform-and-web-port_PLAN.md:419-421`)

The reviews are especially reusable because they tighten product-language discipline:

- freeze support, retention, parity, and attachment contracts early (`docs/platform-and-web-port/reviews/review_1.md:356-357`, `375-376`; `docs/platform-and-web-port/reviews/review_2.md:22-24`, `277-279`)
- be skeptical of browser folder upload as a public promise (`docs/platform-and-web-port/reviews/review_1.md:251-255`; `docs/platform-and-web-port/reviews/review_2.md:230-231`, `524`, `592`)
- define user-visible messaging for omitted or partial attachments (`docs/platform-and-web-port/reviews/review_2.md:117-118`, `150-153`, `469-473`, `528`)
- treat privacy/retention as product policy, not just engineering (`docs/platform-and-web-port/reviews/review_1.md:268-275`; `docs/platform-and-web-port/reviews/review_2.md:134-138`, `450-463`)

**Assessment:** very reusable as source material for decision records and support policy docs.

## Documentation issues and limits in the current corpus

### 1. `README.md` is desktop-first and currently unsafe to reuse for browser-local messaging

Current README messaging is strongly desktop-specific:

- describes the product as a desktop app for Windows/macOS/Linux (`README.md:3`)
- advertises absolute PDF path linking (`README.md:7`)
- emphasizes “single executable” distribution (`README.md:8`)
- claims all three desktop platforms are fully supported (`README.md:14-16`)
- tells users to download release binaries with no installation (`README.md:30`)
- notes the Windows `.exe` is unsigned (`README.md:31`)

Problems for browser-local reuse:

- browser-local distribution is not a single executable
- browser-local execution may not preserve current absolute-path behavior
- browser-local support should not inherit desktop support claims automatically
- `README.md` still contains stale developer run instructions referring to `endnote_exporter_gui.py` (`README.md:48`)

**Conclusion:** `README.md` can supply product history and desktop context, but it should not be treated as ready-made language for a browser-local launch.

### 2. Hosted-web docs sometimes assume a server and must be carefully reframed

Examples of hosted assumptions that should not leak into browser-local messaging:

- isolated job workspaces and upload normalization (`docs/platform-and-web-port/research/03_backend.md:29-34`, `88-92`)
- API upload/status/download model (`docs/platform-and-web-port/research/03_backend.md:212`)
- retention and object storage tradeoffs (`docs/platform-and-web-port/research/03_backend.md:181-183`, `271-278`)
- hosted privacy/retention runbooks as a shipping requirement (`docs/platform-and-web-port_PLAN.md:423-429`, `504`)

These are useful comparisons, but browser-local docs must not accidentally imply that uploads are normal or required.

### 3. There is no support-language baseline yet for browser-local delivery

The current browser-local setup doc is correctly cautious, but it is research-only and does not yet define a support matrix for:

- supported browsers
- required browser capabilities (directory picker, File System Access API, OPFS, WASM, worker support)
- local-file context vs hosted-page context
- wrapper runtimes such as Electron and Tauri

That matters because the existing repo already has support-language drift on desktop:

- `README.md` says Linux is fully supported (`README.md:16`)
- the prior documentation research flagged that this wording may exceed current evidence (`docs/platform-and-web-port/research/06_documentation.md:203-211`)

**Conclusion:** browser-local support wording needs to start conservative and capability-based.

## Special focus areas

### Support language

#### Reusable

- The plan and review docs repeatedly recommend freezing a support matrix before shipping (`docs/platform-and-web-port/plans/plan_a_conservative.md:66`; `docs/platform-and-web-port/reviews/review_1.md:375`; `docs/platform-and-web-port/reviews/review_2.md:24`, `539-540`).
- The local-web setup doc already frames the option ranking conservatively instead of over-promising (`docs/local-web-execution/research/00_setup.md:348-351`).

#### Gap

No browser-local support language exists yet for statements such as:

- “supported browsers”
- “best effort” vs “officially supported” wrappers
- whether `file://` opening is supported for single HTML distribution
- whether plain webpage support requires a hosted static site rather than a local file

#### Recommendation

Do **not** reuse desktop “Fully Supported” language. Use a capability-based matrix such as:

- supported browsers / tested browsers
- supported local delivery modes
- known limitations by delivery mode
- “best effort” wrapper support until validated

### Privacy claims

#### Reusable

The hosted docs and reviews already teach the right discipline:

- privacy/retention must be defined explicitly before launch (`docs/platform-and-web-port_PLAN.md:19`, `71`, `126`, `423-429`, `504`)
- reviews say privacy/deletion guarantees and user warnings must be explicit (`docs/platform-and-web-port/reviews/review_1.md:268-275`; `docs/platform-and-web-port/reviews/review_2.md:24`, `31`, `138`, `450-463`)

#### Gap

There is no browser-local privacy statement describing:

- what stays on-device
- whether any files are uploaded by default
- whether temporary browser storage is used
- whether telemetry/crash reporting exists
- whether wrapper runtimes change the privacy posture
- whether optional features may contact a server

#### Recommendation

Create a browser-local privacy doc before any public messaging. It should be explicit about defaults and exceptions. “Offline/local-only” is a promise that deserves receipts, not vibes.

### Offline / local-only messaging

#### Reusable

The local-web setup doc already establishes the correct intent:

- process on the user’s own device whenever possible (`docs/local-web-execution/research/00_setup.md:9`)
- avoid server-side upload by default (`docs/local-web-execution/research/00_setup.md:10`)
- true offline / no-upload constraints require dedicated research (`docs/local-web-execution/research/00_setup.md:190-200`)

#### Gap

No document yet defines what “offline” means for each option:

- plain webpage served from a site
- single HTML opened locally
- Electron wrapper
- Tauri wrapper

The documentation also does not yet distinguish:

- **no upload by default**
- **fully offline capable**
- **works only when served over HTTP/HTTPS**
- **works only with wrapper-granted filesystem access**

#### Recommendation

Add a dedicated messaging doc that bans vague language such as “private” or “offline” unless it specifies the exact transport/storage behavior per distribution mode.

### Distribution options: plain webpage, single HTML, Electron, Tauri

#### Existing reusable material

The browser-local setup doc already does an excellent job listing the options and the main questions:

- plain JavaScript/HTML app (`docs/local-web-execution/research/00_setup.md:214`, `230`)
- single-file self-contained HTML (`docs/local-web-execution/research/00_setup.md:274`, `278`)
- Electron (`docs/local-web-execution/research/00_setup.md:297`, `301`, `312-318`)
- Tauri (`docs/local-web-execution/research/00_setup.md:321`, `325`, `335-342`)

#### Gap

There is still no decision record or support doc that answers:

- which option is preferred for MVP
- which option is recommended to users
- whether multiple distribution modes will coexist
- what support boundaries differ by mode
- how updates are delivered by mode
- which privacy/support disclaimers differ by mode

#### Recommendation

Treat distribution as an explicit product decision and document it with ADRs or equivalent. Otherwise support language will drift fast.

## What new docs, runbooks, and decision records are required

The following docs appear necessary for a credible browser-local documentation set.

### A. Decision records / ADRs

1. **`docs/local-web-execution/adrs/001-distribution-mode.md`**
   - choose primary MVP distribution mode
   - compare plain webpage vs single HTML vs Electron vs Tauri
   - define fallback/secondary options

2. **`docs/local-web-execution/adrs/002-privacy-and-local-processing-guarantees.md`**
   - define exactly what “local-only” and “offline” mean
   - define any exceptions
   - define whether browser storage is used

3. **`docs/local-web-execution/adrs/003-attachment-path-policy.md`**
   - define whether PDF references are omitted, preserved as metadata, or rewritten
   - define user-visible warnings and partial-success semantics

4. **`docs/local-web-execution/adrs/004-support-matrix.md`**
   - browsers, versions, required APIs, wrapper runtimes
   - “supported” vs “best effort” wording

5. **`docs/local-web-execution/adrs/005-folder-input-contract.md`**
   - decide whether raw folder selection is promised
   - define ZIP/package fallback behavior
   - capture the review guidance to be skeptical of folder-upload promises (`docs/platform-and-web-port/reviews/review_1.md:251-255`; `docs/platform-and-web-port/reviews/review_2.md:230-231`, `592`)

### B. User-facing docs

1. **`docs/local-web-execution/user-guide.md`**
   - how to use the browser-local app
   - what files the user must choose
   - known limitations

2. **`docs/local-web-execution/privacy.md`**
   - plain-language privacy statement
   - on-device processing defaults
   - local storage behavior
   - optional remote interactions, if any

3. **`docs/local-web-execution/support-matrix.md`**
   - browser and wrapper support table
   - tested combinations
   - unsupported scenarios

4. **`docs/local-web-execution/troubleshooting.md`**
   - browser capability problems
   - file access issues
   - large-library limitations
   - attachment limitations

### C. Distribution-specific runbooks

1. **`docs/local-web-execution/distribution/plain-webpage.md`**
   - how the app is served
   - browser requirements
   - what works only over HTTP/HTTPS

2. **`docs/local-web-execution/distribution/single-html.md`**
   - local file opening behavior
   - browser restrictions
   - what is and is not supported under `file://`

3. **`docs/local-web-execution/distribution/electron.md`**
   - packaging/update/support model
   - privacy implications of wrapper APIs
   - desktop support expectations

4. **`docs/local-web-execution/distribution/tauri.md`**
   - packaging/update/support model
   - Rust/toolchain implications for maintainers
   - platform support expectations

### D. Maintainer / operator runbooks

1. **`docs/local-web-execution/release-ops.md`**
   - publishing flow for the chosen distribution modes
   - versioning and rollback

2. **`docs/local-web-execution/support-playbook.md`**
   - what artifacts/logs a user can provide
   - what privacy-safe diagnostics are acceptable

3. **`docs/local-web-execution/bug-reporting.md`**
   - bug template guidance for browser/runtime issues
   - how to report browser and wrapper version information

4. **`docs/local-web-execution/security-considerations.md`**
   - local file handling assumptions
   - third-party library / WASM considerations
   - any optional network dependencies

## Findings

1. The existing browser-local setup doc is strong and reusable as the initiative anchor (`docs/local-web-execution/research/00_setup.md:5-10`, `214-218`, `348-351`).
2. The hosted-web research is reusable primarily for **structure and discipline**, not for final browser-local wording (`docs/platform-and-web-port/research/03_backend.md:27-34`; `docs/platform-and-web-port_PLAN.md:126-128`).
3. Existing docs already warn that support, privacy, retention, and attachment semantics must be frozen early (`docs/platform-and-web-port_PLAN.md:199`, `205`, `423-429`; `docs/platform-and-web-port/reviews/review_1.md:356-357`; `docs/platform-and-web-port/reviews/review_2.md:24`, `277-279`).
4. The current `README.md` is too desktop-specific and partially stale to reuse unchanged for a browser-local product (`README.md:3-8`, `14-16`, `30-31`, `48`).
5. Distribution-mode analysis exists in outline form but has not yet become a concrete documentation decision or support policy (`docs/local-web-execution/research/00_setup.md:214-351`).

## Issues

1. **No browser-local privacy statement exists yet.**
2. **No browser-local support matrix exists yet.**
3. **No distribution decision record exists yet** for plain webpage vs single HTML vs Electron vs Tauri.
4. **No user-facing wording exists yet** for what “offline”, “local-only”, or “no-upload” actually mean.
5. **The desktop README currently over-anchors user expectations** around desktop binaries and absolute-path attachment behavior (`README.md:7-8`, `30-31`).
6. **Folder-selection promises are still risky** and should not become public support language until the product contract is frozen (`docs/platform-and-web-port/reviews/review_1.md:251-255`; `docs/platform-and-web-port/reviews/review_2.md:230-231`, `592`).

## Opportunities

1. Reuse the existing local-web setup doc as the root index and expand it into a proper documentation tree.
2. Reuse the hosted-web plan/review material as source material for ADRs rather than re-researching every policy question from scratch.
3. Use the already-identified missing doc types from the hosted track as templates:
   - attachment policy (`docs/platform-and-web-port_PLAN.md:373`, `381`)
   - release ops (`docs/platform-and-web-port_PLAN.md:288`, `304`)
   - runbooks and rollback (`docs/platform-and-web-port_PLAN.md:390`, `419-421`)
4. Start support messaging conservatively and capability-first instead of repeating the desktop “Fully Supported” pattern too early.
5. Treat distribution choice as a documentation deliverable, not just an engineering decision.

## Open questions

1. Which distribution mode is the intended MVP default:
   - plain webpage
   - single self-contained HTML
   - Electron
   - Tauri
   - or a staged combination?
2. Is “offline” a hard product requirement for the first release, or only “no server upload by default”?
3. Will the browser-local app require being served over HTTP/HTTPS, or must local `file://` opening be supported?
4. Are wrapper runtimes fallback options only, or first-class supported products?
5. What should happen to PDF attachment references in local-web mode if browser file paths cannot safely mirror desktop behavior?
6. Is raw folder selection a required public feature, or can ZIP/package workflows be the documented fallback?
7. What level of browser support evidence is required before using terms like “supported” rather than “experimental” or “best effort”?
8. Will any analytics, update checks, crash reporting, or remote asset fetches exist, and if so, how are they disclosed without undermining the “local-only” message?

## Bottom line

### Most reusable content

The most reusable current content is:

- `docs/local-web-execution/research/00_setup.md` for initiative framing and option taxonomy
- `docs/platform-and-web-port/research/03_backend.md` and related docs for attachment-policy and runtime-boundary reasoning
- `docs/platform-and-web-port/reviews/review_1.md` and `review_2.md` for contract-first discipline, privacy caution, and support-language restraint

### Biggest gaps

The biggest documentation gaps for a browser-local implementation are:

1. **privacy/local-processing documentation**
2. **support-matrix and capability-based support language**
3. **distribution-mode decision records**
4. **user-facing offline/no-upload messaging**
5. **distribution-specific release/support runbooks**

The existing docs give a strong map of the problem. They do **not** yet provide the browser-local product promises that users, maintainers, and reviewers would need before launch.
