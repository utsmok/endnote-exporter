# Documentation Research Report

## Scope

This report reviews the current repository documentation for the new two-goal initiative defined in `docs/platform-and-web-port/research/00_setup.md`:

- **Goal A:** desktop cross-platform compatibility and distribution
- **Goal B:** hosted web-based port design

The focus here is documentation coverage only; no application code was reviewed for implementation correctness beyond what the docs already claim.

## Documents reviewed

### Core project and build/release docs

- `README.md` — product positioning, supported platforms, usage, developer instructions (`README.md:3,14-16,20,24,30-31,45,48-49`)
- `CLAUDE.md` — repo structure, development commands, architectural notes, packaging notes (`CLAUDE.md:20,26,34,39,53,58-59`)
- `pyproject.toml` — Python/runtime dependency declarations (`pyproject.toml:7,9-10`)
- `.github/workflows/release.yml` — current release/build automation and release notes (`.github/workflows/release.yml:16,49,54,60-61,71-80`)

### Existing cross-platform planning artifacts

- `docs/cross-platform-compatibility_PLAN.md` — integrated implementation plan and status (`docs/cross-platform-compatibility_PLAN.md:14,31,34,58-61,695-702,747,813-819`)
- `docs/cross-platform-compatibility/plans/plan_a_conservative.md` (`.../plan_a_conservative.md:33-37,116-117,145`)
- `docs/cross-platform-compatibility/plans/plan_b_balanced.md` (`.../plan_b_balanced.md:287-289,296-298,363`)
- `docs/cross-platform-compatibility/plans/plan_c_aggressive.md` (`.../plan_c_aggressive.md:16-20,503,589,598`)
- `docs/cross-platform-compatibility/research/04_style_patterns.md` (`.../04_style_patterns.md:255-271,481-490,514-520,659-666`)
- `docs/cross-platform-compatibility/reviews/review_1.md` (`.../review_1.md:345,376,457`)
- `docs/cross-platform-compatibility/reviews/review_2.md` (`.../review_2.md:29-32,72-75,163,435-439,447-450`)

### Existing two-goal setup doc

- `docs/platform-and-web-port/research/00_setup.md` — initial framing for Goal A / Goal B (`docs/platform-and-web-port/research/00_setup.md:7-8,74,90-97,101-153`)

## High-level finding

The repository already has **strong and fairly mature documentation for Goal A**, especially under `docs/cross-platform-compatibility*`, but it has only **initial framing/scoping for Goal B** in `docs/platform-and-web-port/research/00_setup.md`.

There is also a notable documentation mismatch: some documents already describe cross-platform support as complete, while planning artifacts still read like forward-looking implementation plans, and the `README.md` developer instructions still contain stale command/file references.

## What is already covered

### Goal A: desktop cross-platform compatibility and distribution

This area is already covered in substantial depth.

#### 1. The repo now documents cross-platform product support

`README.md` presents the application as a Windows/macOS/Linux desktop app and includes a supported-platforms table (`README.md:3,14-16`) plus macOS/Linux notes (`README.md:20,24`).

#### 2. Core release automation is documented and present

The release workflow builds on all three OSes (`.github/workflows/release.yml:16`), builds macOS separately as a Universal2 app (`.github/workflows/release.yml:49,54`), packages the `.app` as a zip (`.github/workflows/release.yml:60-61`), and publishes release notes that mention:

- Windows/macOS/Linux support (`.github/workflows/release.yml:71-72`)
- `.enl` and `.enlp` support (`.github/workflows/release.yml:75`)
- platform-aware Documents handling (`.github/workflows/release.yml:76`)
- case-insensitive `.Data` lookup (`.github/workflows/release.yml:77`)
- unsigned macOS Gatekeeper bypass instructions (`.github/workflows/release.yml:80`)

#### 3. The cross-platform planning track is detailed and reusable

The integrated plan identifies the major historical pain points and constraints:

- hard-coded Documents folder (`docs/cross-platform-compatibility_PLAN.md:14,59`)
- missing `.enlp` support (`docs/cross-platform-compatibility_PLAN.md:14,58,203,210,245-250`)
- case-sensitive `.Data` folder lookup (`docs/cross-platform-compatibility_PLAN.md:60`)
- Windows-only documentation (`docs/cross-platform-compatibility_PLAN.md:61`)
- constraint to keep Python 3.12+ and current dependency posture (`docs/cross-platform-compatibility_PLAN.md:31,34`)

The plan also records that README and CI updates were completed (`docs/cross-platform-compatibility_PLAN.md:813-819`), which matters because these artifacts are no longer just speculative planning—they are partially historical records now.

#### 4. Existing research already captures assumptions and testing expectations

`04_style_patterns.md` documents a strong cross-platform baseline via `pathlib`, UTF-8 encoding, and PyInstaller-aware packaging (`.../04_style_patterns.md:255-271,659-666`), while also flagging previous assumptions such as Windows-centric docs and unclear macOS/Linux testing evidence (`.../04_style_patterns.md:481-490`).

The same document and the plan variants also preserve useful test checklists for platform validation (`.../04_style_patterns.md:514-520`, `.../plan_b_balanced.md:287-289,296-298`, `.../plan_a_conservative.md:116-117`).

#### 5. `00_setup.md` already refines Goal A scope beyond the older cross-platform plan

The setup doc explicitly reframes Goal A around:

- Windows 10/11
- macOS Intel
- macOS Apple Silicon
- optional Linux
- easy-to-run binaries
- macOS signing/notarization concerns

See `docs/platform-and-web-port/research/00_setup.md:7,101-122`.

### Goal B: hosted web-based port

Coverage here is currently light and mostly limited to scoping.

#### What exists

`00_setup.md` clearly defines the web-port objective and the intended input shapes: folder upload, `.zip`, `.enlp`, and a source-path hint (`docs/platform-and-web-port/research/00_setup.md:8,131-148`). It also already lists several correct problem areas:

- backend extraction pipeline (`.../00_setup.md:142`)
- security model for untrusted uploads (`.../00_setup.md:143`)
- job lifecycle and cleanup (same section)
- XML-generation reuse strategy (same section)
- UX for upload/validation/processing/download (`.../00_setup.md:148`)

#### What does **not** exist yet

`00_setup.md` itself explicitly says no repository documentation was found for:

- hosted web-port architecture/rollout
- server-side ingestion of uploaded libraries
- cloud deployment targets
- macOS signing/notarization workflow beyond unsigned-app notes

See `docs/platform-and-web-port/research/00_setup.md:90-97`.

That assessment still appears accurate from the current repo contents.

## Key assumptions already embedded in the docs

The current documentation corpus repeatedly assumes the following:

1. **Python 3.12+ remains the floor** (`CLAUDE.md:39`, `pyproject.toml:7`, `.github/workflows/release.yml:24`).
2. **The existing PyInstaller-based desktop packaging flow remains in place** (`CLAUDE.md:34`, `docs/cross-platform-compatibility_PLAN.md:34`, `.github/workflows/release.yml:44-54`).
3. **No major dependency expansion is desired for desktop hardening** (`docs/cross-platform-compatibility_PLAN.md:31`).
4. **`.enlp` support is essential for complete macOS support** (`docs/cross-platform-compatibility_PLAN.md:47,203,210,245-250`; `CLAUDE.md:53,58`).
5. **Linux is supportable for export/use even if EndNote itself is not native there** (`docs/cross-platform-compatibility/reviews/review_2.md:435-439`).
6. **Absolute PDF paths are part of current XML behavior**, which becomes a design problem for a hosted web port (`README.md:6`; Goal B scoping in `docs/platform-and-web-port/research/00_setup.md:145-148`).
7. **Cross-platform work should be incremental rather than a rewrite**, with Plan B repeatedly favored over aggressive redesign (`docs/cross-platform-compatibility/reviews/review_1.md:360,376`; `.../review_2.md:12,29-32`; `.../plan_b_balanced.md:363`).

## What remains missing relative to the new two-goal request

### Missing for Goal A

Despite good coverage, the new request asks specifically for distribution quality on macOS Intel/Apple Silicon and special attention to signing/notarization. Current docs still leave gaps here.

#### Missing topics

1. **End-to-end signed macOS release process**
   - No document explains Developer ID certificates, notarization, stapling, CI secret management, or how release artifacts change once signed.
   - Current workflow only documents unsigned distribution and Gatekeeper bypass (`.github/workflows/release.yml:80`).

2. **Artifact strategy clarity**
   - The workflow builds a Universal2 `.app` and zips it (`.github/workflows/release.yml:49,54,60-61`), but there is no dedicated doc explaining why Universal2 was chosen over separate Intel/ARM builds, what the support policy is, or how to verify the resulting bundle on each architecture.

3. **Platform verification procedure**
   - Older planning artifacts include test checklists (`.../04_style_patterns.md:514-520`, `.../plan_b_balanced.md:287-298`), but there is no current, consolidated “release readiness” document for actual desktop verification, artifact smoke tests, or reproducible QA steps.

4. **Linux support policy precision**
   - `README.md` says “Fully Supported” and “Tested on Ubuntu/Debian” (`README.md:16`), while `00_setup.md` calls Linux optional (`docs/platform-and-web-port/research/00_setup.md:7`) and review docs treat Linux more as export-capable than first-class EndNote-hosting territory (`.../review_2.md:435-439`). The support bar should be clarified.

5. **Current-state vs historical-plan distinction**
   - `docs/cross-platform-compatibility_PLAN.md` says implementation is complete (`...:813-819`), but it still reads like an implementation plan rather than an archived decision record. A short “status snapshot” doc would reduce confusion.

### Missing for Goal B

This is the much larger gap.

#### Missing topics

1. **No architecture doc for the hosted service**
   - No backend/frontend/service decomposition
   - No job model
   - No queue/worker strategy
   - No storage model

2. **No threat model or upload safety guidance**
   - `00_setup.md` names the concern (`.../00_setup.md:143`) but there is no follow-on documentation for archive bombs, package traversal, malware scanning boundaries, or file size/time limits.

3. **No product-level rules for attachment/path semantics**
   - A hosted service cannot rely on desktop-style absolute PDF paths without a documented policy for:
     - rejecting attachments
     - rewriting paths
     - omitting links
     - producing downloadable bundles
   - This is one of the most important unresolved design questions for Goal B.

4. **No privacy/data retention/compliance doc**
   - There is no documentation for temporary storage duration, deletion guarantees, logging restrictions, or whether uploaded libraries/PDFs are retained at all.

5. **No deployment/operations options analysis**
   - No guidance on candidate hosting targets, upload limits, worker isolation, archive unpacking strategy, or cost assumptions.

6. **No UX flow documentation**
   - `00_setup.md` says the UX should cover upload, validation, processing state, and download (`.../00_setup.md:148`), but there are no user flows, error states, or API contract sketches.

## Documentation issues found

### 1. Stale developer run instructions in `README.md`

`README.md` still tells developers to run `python endnote_exporter_gui.py` or `uv run endnote_exporter_gui.py` (`README.md:48`), but the repository guidance in `CLAUDE.md` points to `gui.py` (`CLAUDE.md:26,34`).

This is a concrete documentation bug and could mislead anyone trying to run or package the project from source.

### 2. Dependency wording is misleading

`README.md` says “The script has no external dependencies” (`README.md:48`), while `pyproject.toml` explicitly declares `loguru` and `pyinstaller` (`pyproject.toml:9-10`).

This may be trying to describe end-user runtime simplicity rather than contributor setup, but as written it is inaccurate for developers.

### 3. Mixed support messaging for Linux

- `README.md` says Linux is fully supported (`README.md:16`)
- `00_setup.md` frames Linux as optional for the new initiative (`docs/platform-and-web-port/research/00_setup.md:7`)
- `review_2.md` treats Linux as export-only and not a blocker for lack of native EndNote (`.../review_2.md:435-439`)

This should be normalized into one explicit support statement.

### 4. Current release docs stop at unsigned macOS distribution

The workflow/release notes help users bypass Gatekeeper for unsigned builds (`.github/workflows/release.yml:80`), but the new request requires attention to signing/notarization. There is still no operational documentation for that path.

## Opportunities

1. **Reuse the cross-platform planning track as Goal A background material**
   - The most reusable sources are:
     - `docs/cross-platform-compatibility_PLAN.md`
     - `docs/cross-platform-compatibility/research/04_style_patterns.md`
     - `docs/cross-platform-compatibility/reviews/review_2.md`
   - Together they already capture pain points, preferred approach (Plan B), platform assumptions, and candidate validation checklists.

2. **Promote `00_setup.md` into an index doc for the new initiative**
   - It already frames Goal A vs Goal B cleanly (`docs/platform-and-web-port/research/00_setup.md:7-8,101-153`).
   - It can serve as the canonical bridge between older cross-platform work and the new hosted-port track.

3. **Add a desktop release operations doc**
   - A dedicated doc could consolidate:
     - artifact matrix
     - verification checklist
     - unsigned vs signed macOS distribution
     - signing/notarization prerequisites
     - release QA steps

4. **Create a web-port architecture research sequence**
   - Suggested next documents:
     - `07_web-architecture.md`
     - `08_upload-and-security.md`
     - `09_attachment-path-policy.md`
     - `10_operations-and-hosting.md`

5. **Convert old plans into “historical context + current status” format**
   - Since `docs/cross-platform-compatibility_PLAN.md` now reports completion (`...:813-819`), a short archival summary would help distinguish what is done from what is still open.

## Open questions

### Goal A

1. Is Linux meant to be **best-effort** or truly **fully supported** for packaged binaries?
2. Is the release target for macOS still unsigned downloads, or is signed/notarized distribution now required?
3. If notarization is required, who owns the Apple Developer account / Developer ID assets and CI secrets?
4. Is Universal2 the long-term distribution strategy, or should Intel/ARM artifacts be split for size/debuggability?
5. What exact desktop QA matrix is required before a release is considered done?

### Goal B

1. What should happen to PDF attachments in a hosted export, given the current desktop behavior relies on absolute file paths?
2. Are uploads processed entirely ephemerally, or can jobs/libraries persist for retries and support diagnostics?
3. What maximum upload/archive size must be supported?
4. Is the hosted service anonymous/self-serve, authenticated, or intended only as an internal/research tool?
5. What privacy/compliance guarantees are required for uploaded libraries and PDFs?
6. Does the first web version need synchronous export only, or async jobs with progress and later download?
7. Should the hosted service accept raw folders directly, or only archives/package uploads plus metadata?

## Bottom line

### Most reusable prior planning

The strongest reusable prior material is the existing cross-platform compatibility track:

- `docs/cross-platform-compatibility_PLAN.md` for pain points, constraints, and task decomposition
- `docs/cross-platform-compatibility/research/04_style_patterns.md` for technical rationale and validation checklist
- `docs/cross-platform-compatibility/reviews/review_2.md` for a concise risk/reward framing and support-policy nuances

These docs already cover most of Goal A’s **engineering background**.

### Biggest documentation gaps

The biggest gaps relative to the new request are:

1. **No real Goal B architecture/security/privacy/operations documentation yet**
2. **No signed/notarized macOS release operations documentation for Goal A**
3. **A few stale or conflicting current-state docs**, especially `README.md` developer instructions and Linux support messaging

In short: Goal A has a solid reusable paper trail; Goal B is still mostly a carefully written placeholder. The docs are giving us a map for desktop hardening, but only a compass for the hosted port.
