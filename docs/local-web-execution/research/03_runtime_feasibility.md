# Runtime Feasibility Report for Local Web / On-Device Execution

**Date:** 2026-03-18
**Repository:** `/home/sam/dev/endnote-exporter`
**Scope:** Research only. No application code changes.

## Executive summary

The current repository is a **Python desktop exporter** whose conversion path assumes:

- direct local filesystem access
- direct SQLite access to `sdb/sdb.eni`
- local discovery of `.enl`, `.Data`, and `.enlp` layouts
- generation of absolute PDF paths from the local library root

That contract strongly favors runtimes with reliable local file and directory access.

The highest-feasibility options are:

1. **Browser-local app with WebAssembly-assisted SQLite access**
   - strongest pure local-web path
   - viable if the product accepts capability-based constraints, especially around browser support for directory selection
   - best implemented as **JavaScript UI + SQLite WASM**, not Python-in-browser as the default path

2. **Desktop wrapper runtime (Electron or Tauri)**
   - strongest path for full filesystem fidelity, `.enlp` package handling, and absolute PDF path reconstruction
   - more install friction than a browser app, but materially fewer runtime capability constraints
   - more credible if exact desktop-style behavior must be preserved

The weakest options are:

- **Browser-only JavaScript/HTML without WASM support for SQLite**, because the current exporter depends on SQLite database reads and there is no practical reason to avoid a SQLite WASM layer if running in a browser
- **Single self-contained HTML file as the primary supported distribution**, because it is only realistic under narrow caveats and becomes fragile once WASM, worker, persistence, or cross-browser support requirements are introduced

## Research method

This report combines:

1. **Repository analysis** of the current exporter behavior in:
   - `/home/sam/dev/endnote-exporter/endnote_exporter.py`
   - `/home/sam/dev/endnote-exporter/platform_utils.py`
   - `/home/sam/dev/endnote-exporter/README.md`
2. **Prior repo research** in:
   - `/home/sam/dev/endnote-exporter/docs/local-web-execution/research/00_setup.md`
   - `/home/sam/dev/endnote-exporter/docs/local-web-execution/research/06_documentation.md`
   - `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/01_architecture.md`
   - `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/03_backend.md`
3. **Current external documentation** for browser APIs and runtime/tooling, including:
   - MDN File System API, `showOpenFilePicker()`, `showDirectoryPicker()`, OPFS, secure contexts, and storage quotas
   - SQLite official WASM documentation
   - Pyodide documentation
   - Electron dialog API documentation
   - Tauri dialog and filesystem plugin documentation

## Repo-grounded constraints that control feasibility

### 1. The converter is SQLite-first

Current export logic opens the EndNote database directly via Python `sqlite3`:

- `sqlite3.connect(db_path)` in `/home/sam/dev/endnote-exporter/endnote_exporter.py`
- reads from `refs` and `file_res`
- builds XML from those rows

This means that any browser-local runtime must answer the SQLite question directly. The current conversion path is not a simple text-file transform.

### 2. The converter expects concrete local library shapes

Current supported shapes are effectively:

- `Library.enl` plus sibling `Library.Data/`
- `.enlp` package directory containing equivalent structure
- direct discovery of `sdb/sdb.eni`
- direct access to `PDF/`

This means local runtime feasibility depends not just on opening one file, but on preserving **directory structure**.

### 3. PDF path handling is currently desktop-native

Current logic reconstructs PDF paths as:

- `data_path / "PDF" / file_path`
- serialized as **absolute local paths**

This is easy in a native desktop app. It is much less reliable in a browser runtime because browser file access is permission- and handle-based, not path-authority-based.

### 4. `.enlp` handling is materially different from `.zip`

The existing app treats `.enlp` as an accessible package directory. In browser-local runtimes, `.enlp` may need to be:

- selected as a directory via a directory picker, or
- uploaded as `.zip`, or
- normalized through an intermediate in-browser workspace

That distinction changes the feasibility ranking significantly.

## External runtime findings

## Browser file and directory access

### Current browser reality

MDN indicates:

- the general File System API and OPFS are broadly available in modern browsers
- **`showOpenFilePicker()` and `showDirectoryPicker()` remain limited-availability APIs**
- both picker APIs require **secure contexts** and **transient user activation**
- MDN browser compatibility tables show the picker APIs are supported in Chromium-derived browsers, but not in Firefox or Safari as of the referenced 2025 pages

This matters because the difference between:

- “user selects one archive file” and
- “user selects an EndNote directory tree”

is the difference between broad browser feasibility and Chromium-family-only feasibility.

### OPFS

OPFS is widely available and useful for:

- staging extracted archives
- temporary local persistence
- higher-performance local file access in workers

However:

- OPFS is **origin-private**, not user-visible
- stored data is subject to browser quota and eviction policy
- Safari can proactively evict non-persistent origin data in some circumstances
- OPFS storage is not a substitute for arbitrary user-visible filesystem path authority

### Secure-context implications

MDN notes that secure-context-gated APIs require HTTPS or another trustworthy origin. `file://` URLs are generally described as potentially trustworthy, but that does **not** eliminate per-feature implementation constraints.

In practice, for a serious browser-local app, the supported deployment shape should be assumed to be:

- `https://...`, or
- `http://localhost`, or
- a wrapper runtime

not “open any local HTML file and expect every capability to work identically”.

## SQLite WASM

SQLite’s official WASM documentation establishes that browser-local SQLite is practical, but with constraints:

- SQLite WASM is supported in modern browsers
- basic usage can be simple
- persistence and higher performance require choosing among different storage strategies
- long-running work should run in a **Worker**, not on the main thread
- some deployment modes require **multiple files** (`sqlite3.js`, `sqlite3.wasm`, client JS)
- the SQLite docs explicitly state that browsers may refuse to load WASM from `file://` URLs and recommend use of a web server

### OPFS-backed SQLite WASM

SQLite documents several persistent storage approaches.

Important caveats:

- the main OPFS VFS requires **Worker-thread use**
- the main OPFS VFS requires **COOP/COEP headers** because it depends on `SharedArrayBuffer`
- Safari versions `< 17` are incompatible with the current OPFS VFS implementation
- concurrency is weaker than native desktop concurrency and may degrade quickly with multiple tabs or Workers
- storage limits and eviction remain browser-controlled

SQLite also documents the `opfs-sahpool` VFS:

- should work on all major browsers released since March 2023
- does **not** require COOP/COEP
- offers high performance
- but does **not** support client-transparent multiple simultaneous connections
- introduces a more specialized virtualized storage model

### Practical implication

A browser-local SQLite runtime is feasible, but only if the project accepts:

- worker-based architecture
- capability-specific code paths
- some browser-specific persistence tradeoffs
- a real web-app deployment, not a simplistic single HTML file opened from disk

## Pyodide / Python-in-browser

Pyodide documentation shows:

- Pyodide is viable in modern browsers
- it can run in Web Workers
- the minimal deployment includes multiple runtime assets (`pyodide.js` / `pyodide.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, lockfiles)
- the full distribution is **large** (Pyodide docs describe the full release as **200+ MB**)
- `sqlite3` exists as an **unvendored optional stdlib module** and can be loaded, but is not part of the smallest default runtime payload
- `threading`, `multiprocessing`, and `sockets` are present but not functional in the usual native sense
- mounting the native browser filesystem is an **experimental Chromium-based capability** via `mountNativeFS`

### Practical implication

Pyodide makes **code reuse** more plausible than a full JavaScript rewrite, but it does not eliminate the hard browser constraints:

- filesystem mounting remains Chromium-centric if native directory mounting is needed
- runtime size and startup cost are substantial
- existing Python code would still need adaptation around browser runtime, asset loading, and file-system bridging
- “reuse current Python code unchanged” is not a credible assumption

Pyodide is therefore **feasible but heavy**, and should be treated as a secondary route, not the default recommendation.

## Electron

Electron’s native dialog API supports:

- file selection
- directory selection
- save dialogs
- macOS package handling via `treatPackageAsDirectory`

This gives Electron a clean answer to the hardest browser-only problems:

- selecting a `.enl` file and sibling `.Data/`
- selecting a directory tree directly
- treating `.enlp` package-like layouts as directories on macOS
- reconstructing true filesystem paths for PDF linking

### Practical implication

Electron is highly feasible for local execution because it restores desktop-native file semantics while allowing a web UI.

Its downsides are:

- larger packaged footprint
- higher install friction than browser access
- introduction of a JS/Node desktop stack into a currently Python-first repo
- possible architecture duplication if the current Python core is not reused via a sidecar or service boundary

## Tauri

Tauri’s documentation shows:

- native dialog support for file and directory selection on desktop platforms
- filesystem APIs with explicit permission scopes and security boundaries
- full support on Windows, Linux, and macOS for desktop use
- native paths returned by file dialogs on desktop

This makes Tauri technically capable of the same broad local-file workflows as Electron for the desktop targets that matter here.

### Practical implication

Tauri is technically strong for local execution, but the maintainability tradeoff is different:

- smaller runtime and more security-oriented capability model than Electron
- but greater implementation/tooling complexity if the repo must now combine web frontend + Rust/native integration + existing Python logic or a rewritten core

For this repository specifically, Tauri is attractive **only if a native wrapper is definitely needed** and the team is willing to absorb Rust/toolchain complexity.

## Option-by-option analysis

## Option A — browser-only JavaScript/HTML

### Definition

A browser app using standard web technologies without relying on a Python runtime and without treating SQLite WASM as the default execution layer.

### Feasibility assessment

**Low to medium, depending on what “browser-only” is allowed to include.**

If this option excludes SQLite WASM, it is weak. The repo’s current conversion path depends on direct SQLite reads, and there is no compelling repo-specific evidence that a pure JS non-WASM SQLite path would be simpler or lower risk.

If this option quietly includes a JS-side SQLite implementation compiled to WASM, it stops being Option A and becomes Option B.

### Access to user-selected files/folders

- **Single file selection:** feasible
- **Directory selection:** only realistically strong in Chromium-family browsers because `showDirectoryPicker()` is not broadly available
- **Cross-browser parity:** weak if folder selection is required

### SQLite database access

- weak without SQLite WASM
- current repo behavior suggests SQLite is not optional

### Handling `.enl` / `.Data` / `.enlp` / `.zip`

- `.zip`: feasible, likely the best browser shape
- `.enl` plus `.Data`: awkward unless directory selection is supported
- `.enlp`: awkward unless package contents are normalized through folder selection or archive upload

### PDF path reconstruction

- weak for true desktop-style absolute paths
- possible only as relative or logical references unless the browser provides enough directory context
- Chromium-only directory-handle flows can help, but this is not robust cross-browser behavior

### Performance / memory

- acceptable for modest parsing workloads if all work is kept in JS and memory
- weaker than a WASM-assisted SQLite path for large or I/O-heavy workflows

### UX / install friction

- best in theory: no install, open page, process locally
- in practice, capability prompts and browser-compatibility caveats become visible UX complexity

### Offline support

- possible if the app is cached or served as a PWA-like experience
- weaker if it relies on multi-file runtime assets without an offline packaging strategy

### Ease of packaging / distribution

- strong if delivered as a hosted local-processing page
- weak if trying to preserve desktop-like behavior across all browsers

### Maintainability for this repo

- requires non-trivial JS reimplementation of a Python+SQLite flow
- low direct code reuse from the current Python core

### Verdict

**Not the lead recommendation.** It is only credible if the accepted product contract narrows to archive-first, browser-capability-based workflows and if the runtime is allowed to evolve into a WASM-assisted model.

## Option B — browser-local with WebAssembly for SQLite and/or Python execution

### Definition

A browser-local app that uses WASM where needed:

- SQLite WASM for database reads
- optionally Pyodide if Python reuse is pursued

### Feasibility assessment

**High for SQLite WASM, medium for Pyodide, high overall for a serious local-web direction.**

This is the strongest browser-local runtime family because it directly addresses the SQLite dependency rather than pretending it is optional.

### Access to user-selected files/folders

- still constrained by browser picker availability
- archive-based intake (`.zip`) is the most portable
- directory-based intake remains Chromium-leaning

### SQLite database access

- strong with SQLite WASM
- technically feasible with Pyodide `sqlite3`, but heavier and less attractive than JS + SQLite WASM for an MVP

### Handling `.enl` / `.Data` / `.enlp` / `.zip`

- `.zip`: strongest and most portable browser intake shape
- `.enl` + `.Data`: feasible if folder selection exists, otherwise awkward
- `.enlp`: feasible if supplied as directory or zip; easier as zip

### PDF path reconstruction

- still weaker than desktop wrappers for true absolute filesystem paths
- can reconstruct logical or relative relationships if the app has a coherent selected-root model
- best outcome is likely a **policy change**, not perfect fidelity to today’s absolute desktop path behavior

### Performance / memory

- strongest browser-local performance path
- worker-based execution is appropriate
- OPFS can be useful for staging extracted data and persistent local workspace behavior
- must still respect quota, eviction, and multi-tab/concurrency caveats

### UX / install friction

- much lower install friction than native wrappers
- but browser support must be documented carefully
- “works best in Chromium with folder picker; zip works more broadly” is a realistic message

### Offline support

- good if runtime assets are cached or packaged appropriately
- OPFS can support local persistence
- first-run experience still depends on runtime asset delivery

### Ease of packaging / distribution

- very strong for hosted local-processing distribution
- moderate for fully offline distribution, because runtime assets, workers, and WASM need packaging discipline

### Maintainability for this repo

Two sub-options matter:

#### B1. JavaScript UI + SQLite WASM + targeted port of conversion logic

- lower runtime weight than Pyodide
- higher rewrite cost
- cleaner browser-native architecture
- likely the best long-term browser-local implementation

#### B2. Browser UI + Pyodide + adapted Python core

- more code-reuse potential
- much larger runtime
- more asset/deployment complexity
- browser filesystem reality still not solved magically

### Verdict

**Most viable pure local-web option.** Recommended if the initiative’s core product goal is “no install, local processing, acceptable browser constraints.”

## Option C — self-contained single-file HTML distribution

### Definition

A single `.html` file containing the app.

### Feasibility assessment

**Low as a primary supported distribution.**

This option is attractive in distribution terms but weak in runtime reality once the requirements become concrete.

### Why it is attractive

- zero-install distribution story
- easy to email or host
- conceptually simple

### Why it is weak here

1. SQLite’s own WASM documentation states that browsers may refuse to load WASM from `file://` URLs and recommends use of a web server.
2. Serious browser-local storage/performance paths often depend on:
   - workers
   - WASM files
   - multiple runtime assets
   - sometimes COOP/COEP headers for the main OPFS VFS
3. Pyodide’s runtime is inherently multi-asset and large.
4. Even if `file://` is potentially trustworthy in a secure-context sense, that does not mean all required runtime assets and browser APIs will behave reliably when opened as a loose local file.
5. A single-file HTML that avoids WASM and workers gives up the very tools that make the browser-local conversion path practical.

### Access to user-selected files/folders

- same picker limitations as normal browser delivery
- directory workflows remain browser-dependent

### SQLite database access

- only realistic if SQLite WASM is somehow inlined or avoided
- inlining is technically possible but operationally brittle and not the path official SQLite docs present

### PDF path reconstruction

- no better than the ordinary browser case

### Performance / memory

- poor if forced to avoid workers/WASM
- awkward if assets are heavily inlined into one file

### UX / install friction

- superficially excellent
- operationally fragile if users must switch browsers, disable restrictions, or use specific launch conditions

### Offline support

- can be excellent in the narrow case where everything truly works from one file
- weak once runtime complexity increases

### Ease of packaging / distribution

- best theoretical distribution story
- worst gap between distribution simplicity and technical reality

### Maintainability for this repo

- encourages packaging cleverness instead of explicit runtime design
- high risk of hidden browser-specific failure modes

### Explicit conclusion on single static HTML

A **single static HTML file is not realistic as the primary supported runtime for this project** if any of the following are true:

- SQLite access depends on WASM delivered as separate assets
- the app should work reliably from `file://`
- the app depends on worker-based execution for responsiveness
- the app should support persistent in-browser staging with modern SQLite/OPFS patterns
- the app must be supportable across more than a narrow Chromium-only slice

A single-file HTML is only realistic under narrow caveats:

- it is **served** over localhost/HTTPS, not relied upon as a loose `file://` artifact
- it uses a very small runtime footprint
- it accepts reduced functionality
- it avoids presenting itself as a full-fidelity replacement for the current desktop tool

In other words: **possible as a demo artifact, weak as a product contract**.

## Option D — Electron local app

### Definition

A local desktop app using web technologies plus Electron.

### Feasibility assessment

**High.**

Electron most directly restores the capabilities the current exporter expects.

### Access to user-selected files/folders

- strong
- native dialogs
- file and directory selection are first-class
- macOS package handling support exists

### SQLite database access

- strong
- can access the library as real files on disk
- can reuse mature Node/native or sidecar strategies

### Handling `.enl` / `.Data` / `.enlp` / `.zip`

- strong for all shapes
- `.enlp` is especially much easier than in ordinary browsers

### PDF path reconstruction

- strong
- true local filesystem paths are available after selection
- closest behavioral match to the current Python desktop app

### Performance / memory

- adequate to strong for this workload
- higher app footprint than Tauri or a plain browser app
- runtime overhead is materially larger than a purpose-built native shell

### UX / install friction

- higher than browser-local page
- lower ambiguity because runtime capability is controlled by the app, not the user’s browser

### Offline support

- strong

### Ease of packaging / distribution

- packaging exists, but installers/binaries are required
- larger download sizes than Tauri or plain browser delivery

### Maintainability for this repo

- introduces JS/Node desktop stack in a Python-first repository
- could preserve existing Python logic via a local sidecar, but that creates a mixed architecture
- easier native-file story than browser-only, but not automatically the cleanest repo architecture

### Verdict

**Highly viable if desktop-native behavior must be preserved.** Electron is most compelling as the fallback or escalation path when browser constraints are unacceptable.

## Option E — Tauri local app

### Definition

A local desktop app using a web UI with Tauri’s native shell.

### Feasibility assessment

**Medium-high to high technically; medium for repo fit.**

Tauri can solve the local-file problem nearly as well as Electron for the relevant desktop targets.

### Access to user-selected files/folders

- strong on desktop
- native dialog support
- filesystem plugin support with explicit permission scopes

### SQLite database access

- strong for local desktop execution
- practical if implemented through native commands or a sidecar strategy

### Handling `.enl` / `.Data` / `.enlp` / `.zip`

- strong
- much closer to current desktop expectations than a browser runtime

### PDF path reconstruction

- strong
- native path access makes this straightforward

### Performance / memory

- generally better packaged footprint than Electron
- native-shell approach is attractive for local-only tooling

### UX / install friction

- still requires install/distribution
- smaller footprint helps, but install friction remains materially above browser delivery

### Offline support

- strong

### Ease of packaging / distribution

- better runtime footprint than Electron
- more complex implementation/tooling story for a Python-first repo

### Maintainability for this repo

- requires introducing Rust/native integration concerns
- not an obvious direct reuse path for the current Python core
- better if a browser-local core already exists and Tauri is only acting as a shell

### Verdict

**Viable, but not the first move unless a native shell is already justified.** Tauri is best treated as a second-stage wrapper if a browser-local core proves desirable but browser distribution constraints remain too limiting.

## Comparison table

| Dimension | Browser-only JS/HTML | Browser + WASM | Single-file HTML | Electron | Tauri |
|---|---|---|---|---|---|
| User-selected files | Medium | Medium | Medium | High | High |
| User-selected folders | Low-Medium | Low-Medium | Low-Medium | High | High |
| SQLite access from `sdb.eni` | Low without extra runtime | High | Low | High | High |
| `.enl` + `.Data` shape | Medium with folder support | Medium with folder support | Medium with folder support | High | High |
| `.enlp` handling | Low-Medium | Medium | Low-Medium | High | High |
| `.zip` handling | High | High | High | High | High |
| PDF absolute path reconstruction | Low | Low-Medium | Low | High | High |
| Performance for larger libraries | Medium | High | Low-Medium | High | High |
| Memory profile | Medium | Medium | Medium-Low | Medium-Low | Medium-High |
| UX friction | Low in theory, medium in reality | Low-Medium | Low in theory, medium-high in reality | Medium | Medium |
| Install friction | Low | Low | Lowest in theory | High | High |
| Offline support | Medium | High | Medium | High | High |
| Ease of packaging/distribution | High | High | High in theory, low in practice | Medium | Medium |
| Maintainability for this repo | Low-Medium | Medium | Low | Medium | Medium-Low |
| Overall viability | Medium-Low | **High** | Low | **High** | Medium-High |

## Detailed comparison by requested criteria

## Access to user-selected files/folders

### Browser-only / Browser + WASM / Single-file HTML

- file selection is straightforward
- directory selection is the real constraint
- browser-local folder workflows are strongest in Chromium-family browsers
- if the product must work in Firefox/Safari without caveats, archive-first input is safer than folder-first input

### Electron / Tauri

- native dialogs solve the problem cleanly
- desktop wrappers are substantially stronger for directory-structured inputs

## SQLite database access from EndNote library structure

### Browser-only JS/HTML

- weak without SQLite runtime augmentation

### Browser + WASM

- strong with SQLite WASM
- Pyodide is technically possible but not the preferred default

### Single-file HTML

- weak as a serious SQLite runtime distribution shape

### Electron / Tauri

- strong because native filesystem access restores the current model

## Handling `.enl` / `.Data` / `.enlp` / `.zip` shapes

### Best browser-local input contract

For browser-local distribution, the most robust order is:

1. `.zip`
2. `.enlp` as archive-equivalent input
3. folder selection only where supported
4. `.enl` plus `.Data` as direct folder layout only where native directory access is reliable

### Best native-wrapper input contract

Electron and Tauri can realistically support all four shapes with fewer caveats.

## PDF path reconstruction feasibility

This is the most important functional gap between browser-local and native-wrapper runtimes.

### Browser-local

The current exporter’s absolute-path behavior does not translate cleanly. Browser runtimes are handle-based and origin-scoped, not path-authoritative. Even when a browser app can read the PDFs, it does not necessarily mean it can or should emit meaningful absolute local paths for Zotero import.

### Native wrappers

Electron and Tauri can preserve or closely emulate current absolute-path reconstruction because they can work with actual selected filesystem paths.

### Conclusion

If preserving current absolute PDF linking semantics is a hard requirement, native wrappers are materially stronger than browser-only delivery.

## Performance / memory profile

### Browser-only JS/HTML

- acceptable for smaller libraries and archive parsing
- weaker for direct SQLite-heavy workflows without WASM

### Browser + WASM

- best browser-local performance path
- should use Workers
- can use OPFS for staging/persistence
- still bounded by browser storage and lifecycle behavior

### Pyodide-specific note

- runtime size and startup cost are the main penalty
- Pyodide is most justified by code reuse, not by raw runtime efficiency

### Electron / Tauri

- both strong enough for this workload
- Electron has higher runtime overhead
- Tauri has lighter shipped footprint but greater development complexity

## UX friction and install friction

### Browser-only / Browser + WASM

Advantages:

- no installer
- easiest discovery and trial
- strongest privacy messaging if truly local

Costs:

- browser capability caveats
- permission prompts
- inconsistent folder-selection story across browsers

### Single-file HTML

Advantages:

- superficially the lowest friction

Costs:

- most fragile support story if runtime requirements exceed what one file can reliably provide

### Electron / Tauri

Advantages:

- controlled runtime
- fewer browser-specific surprises

Costs:

- installer/download friction
- desktop release and update burden

## Offline support

### Browser-only / Browser + WASM

- possible and potentially strong
- requires clear caching/packaging story
- OPFS and browser storage can help, but persistence is not identical to a native app

### Single-file HTML

- strongest in narrative, weakest in practical completeness

### Electron / Tauri

- straightforward

## Ease of packaging / distribution

### Best distribution story

- plain hosted browser-local page: easiest for reach
- single-file HTML: easiest in theory, but misleading for this workload
- Electron/Tauri: easiest for guaranteed runtime behavior, hardest for frictionless adoption

## Maintainability for this repo

This criterion is repo-specific, not generic.

### Browser-only JS/HTML

- lowest code reuse from current Python core
- large rewrite pressure

### Browser + WASM

- best long-term browser architecture if willing to port logic
- Pyodide variant improves reuse but increases runtime/deployment complexity

### Electron
n
- technically easy to justify if a web UI is desired and full local-file fidelity matters
- but it introduces a JS/desktop stack on top of a Python-first repo

### Tauri

- likely best packaged footprint of the wrapper options
- highest tooling divergence for a Python-first repo unless used as a thin shell over an already-proven browser-local core

## Issues

1. **Directory-selection support is the main browser-local compatibility limiter.**
2. **Current PDF absolute-path behavior is not naturally portable to browser runtimes.**
3. **Single-file HTML is significantly more constrained than it first appears.**
4. **Pyodide is feasible but heavy; it should not be mistaken for a zero-cost code reuse path.**
5. **Desktop wrappers solve the runtime problem, but not the repo-complexity problem.**
6. **A browser-local product must define whether `.zip` is the primary intake shape.**
7. **Support language must be capability-based, not generic “works in browser” language.**

## Opportunities

1. **Browser + SQLite WASM offers a credible local-first web path** with no mandatory upload of user data.
2. **Archive-first input can reduce browser-compatibility problems** by avoiding folder-selection dependence.
3. **A browser-local core could later be wrapped in Tauri or Electron** if native packaging becomes necessary.
4. **If native wrappers are required, Tauri offers a better footprint story than Electron**, while Electron offers simpler developer familiarity for many web teams.
5. **Pyodide remains a useful contingency** if code reuse proves more valuable than bundle size and startup time.

## Recommendation

## Primary recommendation

The most viable option family is:

### 1. Browser-local app with SQLite WASM as the default technical direction

Recommended shape:

- browser-local web app
- archive-first intake (`.zip` first, `.enlp` archive-equivalent second)
- Worker-based processing
- SQLite WASM for reading `sdb/sdb.eni`
- explicit policy change for PDF handling rather than promising current absolute-path fidelity everywhere

Why this is the strongest option:

- preserves the local-processing goal
- avoids native install friction
- addresses the actual SQLite dependency directly
- is more technically credible than pure JS-without-WASM
- is less operationally awkward than Pyodide-first

### 2. Keep Electron or Tauri as the fallback/escalation path if filesystem fidelity is non-negotiable

Use a native wrapper if any of the following become hard requirements:

- full support for `.enl` + `.Data` direct folder selection across desktop platforms
- preserving desktop-like absolute PDF path reconstruction
- avoiding browser-specific directory-access caveats
- stronger offline/runtime guarantees than the browser can comfortably provide

## Secondary recommendation

If a native shell becomes necessary, prefer the following decision order:

- **Electron** if implementation simplicity and ecosystem familiarity matter more than bundle size
- **Tauri** if smaller packaged footprint and stricter native capability scoping matter more than Rust/toolchain complexity

For this repo specifically, neither wrapper should be the first move unless browser-local constraints are proven unacceptable.

## Options that should not be the primary path

### Browser-only JS/HTML without WASM

Not recommended because the current converter is SQLite-dependent.

### Single-file self-contained HTML

Not recommended as the primary supported distribution because the requirement set is too demanding for that packaging story to remain robust and honest.

## Open questions

1. Is the browser-local MVP allowed to make `.zip` the primary supported input and treat direct folder selection as best-effort?
2. Must browser-local output preserve absolute PDF paths, or can it switch to warnings/relative metadata/manifest behavior?
3. Is Chromium-first support acceptable for MVP if it materially improves local folder workflows?
4. Is the initiative optimizing for **zero install** or for **maximum desktop fidelity**?
5. If a native shell is needed later, is the team more comfortable maintaining JS/Node desktop tooling or Rust/native tooling?
6. Is Pyodide code reuse valuable enough to justify the larger runtime, or is a targeted port of the transformation logic preferable?

## Final conclusion

The runtime feasibility ranking is:

1. **Browser-local with SQLite WASM** — strongest local-web path
2. **Electron local app** — strongest desktop-fidelity fallback
3. **Tauri local app** — viable wrapper with better footprint, but more repo/tooling divergence
4. **Browser-only JS/HTML without WASM emphasis** — weak unless substantially redefined
5. **Single self-contained HTML as the primary supported distribution** — not realistic except under narrow caveats

The highest-confidence strategy is therefore:

- treat **browser-local + SQLite WASM** as the main local-web research direction
- treat **Electron/Tauri** as wrapper/fallback options if browser constraints prove too costly
- explicitly avoid anchoring the initiative on the promise of a **single loose HTML file** unless the scope is narrowed dramatically

## Sources

### Repository sources

- `/home/sam/dev/endnote-exporter/endnote_exporter.py`
- `/home/sam/dev/endnote-exporter/platform_utils.py`
- `/home/sam/dev/endnote-exporter/README.md`
- `/home/sam/dev/endnote-exporter/docs/local-web-execution/research/00_setup.md`
- `/home/sam/dev/endnote-exporter/docs/local-web-execution/research/06_documentation.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/01_architecture.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/03_backend.md`

### External documentation reviewed

- MDN File System API: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
- MDN `showOpenFilePicker()`: https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker
- MDN `showDirectoryPicker()`: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
- MDN OPFS: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
- MDN Secure Contexts: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
- MDN Storage quotas and eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- SQLite WASM index: https://sqlite.org/wasm/doc/trunk/index.md
- SQLite WASM persistence: https://sqlite.org/wasm/doc/trunk/persistence.md
- SQLite WASM FAQ: https://sqlite.org/wasm/doc/trunk/faq.md
- SQLite WASM demo / deployment notes: https://sqlite.org/wasm/doc/trunk/demo-123.md
- Pyodide usage: https://pyodide.org/en/stable/usage/index.html
- Pyodide deployment: https://pyodide.org/en/stable/usage/downloading-and-deploying.html
- Pyodide runtime constraints: https://pyodide.org/en/stable/usage/wasm-constraints.html
- Electron dialog API: https://www.electronjs.org/docs/latest/api/dialog
- Tauri dialog plugin: https://v2.tauri.app/plugin/dialog/
- Tauri filesystem plugin: https://v2.tauri.app/plugin/file-system/
