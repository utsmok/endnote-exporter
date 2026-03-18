# Style and Pattern Research for Local Web Execution

Date: 2026-03-18
Repository: `/home/sam/dev/endnote-exporter`

## Scope

Research only. No application code was modified.

This report reviews:

1. current code style and organization patterns in the repo
2. style and structure conventions that transfer well to a browser-local implementation
3. places where a different style is more appropriate for a browser-first, single-file HTML, or lightweight-wrapper approach
4. browser-platform best practices that materially affect the recommendation

## Sources reviewed

### Repository sources

- `/home/sam/dev/endnote-exporter/CLAUDE.md:3-42`
- `/home/sam/dev/endnote-exporter/README.md:14-16`
- `/home/sam/dev/endnote-exporter/README.md:45-48`
- `/home/sam/dev/endnote-exporter/pyproject.toml:7-16`
- `/home/sam/dev/endnote-exporter/gui.py:7-20`
- `/home/sam/dev/endnote-exporter/gui.py:54-80`
- `/home/sam/dev/endnote-exporter/gui.py:80-165`
- `/home/sam/dev/endnote-exporter/endnote_exporter.py:33-46`
- `/home/sam/dev/endnote-exporter/endnote_exporter.py:56-96`
- `/home/sam/dev/endnote-exporter/endnote_exporter.py:142-182`
- `/home/sam/dev/endnote-exporter/endnote_exporter.py:204-360`
- `/home/sam/dev/endnote-exporter/endnote_exporter.py:367-824`
- `/home/sam/dev/endnote-exporter/endnote_exporter.py:923-928`
- `/home/sam/dev/endnote-exporter/platform_utils.py:7-161`
- `/home/sam/dev/endnote-exporter/.github/workflows/release.yml:15-64`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/01_architecture.md:32-36`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/04_style_patterns.md:38-40`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/04_style_patterns.md:255-264`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/plans/plan_b_balanced.md:27`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/plans/plan_a_conservative.md:405`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/plans/plan_c_aggressive.md:175`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/reviews/review_1.md:33`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/reviews/review_2.md:22`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/reviews/review_2.md:507`
- `/home/sam/dev/endnote-exporter/docs/local-web-execution/research/00_setup.md:10`
- `/home/sam/dev/endnote-exporter/docs/local-web-execution/research/00_setup.md:94`
- `/home/sam/dev/endnote-exporter/docs/local-web-execution/research/00_setup.md:226-351`

### External references

- MDN JavaScript Modules: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules>
- MDN `showDirectoryPicker()`: <https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker>
- MDN Secure Contexts: <https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts>
- MDN File System API: <https://developer.mozilla.org/en-US/docs/Web/API/File_System_API>

---

## Executive summary

The repository’s strongest transferable style is **thin runtime shell + reusable conversion core + narrowly isolated platform helpers**.

That pattern should carry into any browser-local implementation, but with one major adjustment: the current code is **path-and-filesystem centric**, while a browser-first implementation should become **handle/blob/buffer centric** at the runtime boundary.

The best-fit implementation style for this repo is:

1. keep a small, understandable codebase
2. preserve a runtime-neutral export core
3. replace Python-style platform helpers with browser/wrapper adapters
4. prefer a small multi-file browser app over a single giant HTML file for the real implementation
5. treat a single-file HTML app as a constrained distribution variant, not the default architecture

The planning docs already point in this direction: extract a runtime-neutral core first (`plan_b_balanced.md:27`), stay desktop-first and verification-first while expanding runtime options (`plan_a_conservative.md:405`), and add golden-fixture parity discipline early (`plan_c_aggressive.md:175`, `review_1.md:33`, `review_2.md:507`).

---

## Findings

### 1. The repo prefers a compact top-level layout with explicit file responsibilities

The current project is intentionally small and root-level rather than package-heavy.

Evidence:

- `CLAUDE.md:3-17` describes the repo as a short list of primary files.
- `gui.py:20` contains the desktop shell class `ExporterApp`.
- `endnote_exporter.py:181` contains the main exporter class `EndnoteExporter`.
- `platform_utils.py:31`, `:58`, `:153`, `:161` isolate reusable filesystem/platform helpers.
- `.github/workflows/release.yml:15-64` keeps packaging concerns outside the runtime modules.

Implication for local-web work:

- A browser-local implementation should also stay small and legible.
- The repo does **not** suggest adopting a large framework or monorepo structure by default.
- A minimal browser app can still be modular without becoming elaborate.

### 2. The dominant architectural pattern is “thin adapter, heavy core”

This is the single most important pattern to preserve.

Evidence:

- `gui.py:54-80` owns file selection and UI state changes.
- `gui.py:133` calls `export_references_to_xml(self.enl_file, output_file)` rather than embedding export logic in the GUI.
- `endnote_exporter.py:204-360` owns the end-to-end export pipeline.
- `endnote_exporter.py:367-824` contains the actual field mapping and XML serialization logic.
- Prior research explicitly recommends extracting a runtime-neutral export core before web work (`docs/platform-and-web-port/research/04_style_patterns.md:255-264`, `plan_b_balanced.md:27`).

What transfers cleanly:

- browser UI should be thin
- browser or wrapper-specific file access should live in an adapter
- conversion logic should remain isolated from UI and storage concerns

What should change:

- the browser adapter should not pass around `Path` objects or assume sibling folders on disk
- instead, it should normalize user input into a runtime-neutral “prepared library” model built from file handles, blobs, relative paths, or extracted virtual files

### 3. Naming and coding style are straightforward and modern, and mostly portable conceptually

Evidence:

- Class names use `CapWords`: `ExporterApp` (`gui.py:20`), `EndnoteExporter` (`endnote_exporter.py:181`), `XMLComparator` (`endnote_exporter.py:928`).
- Functions and methods use `snake_case`: `_resolve_enl_path()` (`endnote_exporter.py:142`), `export_references_to_xml()` (`endnote_exporter.py:182`, `:923`), `find_data_folder()` (`platform_utils.py:31`), `validate_file_extension()` (`platform_utils.py:161`).
- Private helpers use `_` prefixes consistently.
- Modern typing is used across the codebase, e.g. `tuple[Path, Path]`, `Path | None`, `str | None` (`endnote_exporter.py:102`, `:142`; `platform_utils.py:31`, `:102`).

What transfers cleanly:

- descriptive, conventional naming
- small public API surface with internal helpers hidden behind private names
- explicit utility helpers instead of “magic” inline logic

What changes in browser code:

- types would move from `Path`, `dict`, and row tuples toward `FileSystemHandle`, `File`, `Blob`, `Uint8Array`, and plain data objects
- if implemented in TypeScript or strongly typed JavaScript, the equivalent convention should be `PascalCase` for classes/types and `camelCase` for functions/variables, but the same clarity rule still applies

### 4. The repo favors defensive IO, explicit validation, and structured diagnostics

Evidence:

- Loguru is configured centrally in `endnote_exporter.py:33-46`.
- XML sanitization is centralized in `INVALID_XML_REGEX` and `safe_str()` (`endnote_exporter.py:56`, `:916`).
- Export entry validates input and output extensions at `endnote_exporter.py:182-200`.
- `platform_utils.py:161-176` centralizes extension validation.
- `gui.py:80-99` and `gui.py:134-149` surface warnings/errors from logs rather than silently ignoring issues.

What transfers cleanly:

- keep validation at runtime boundaries
- preserve a single place for sanitization
- return structured warnings alongside results
- prefer explicit “prepared input -> convert -> emit output” stages

What should change:

- a browser implementation should return warnings as structured data, not infer them by scraping a log file
- use browser-visible progress/error state instead of desktop modal dialogs and post-hoc log counting

### 5. The repo’s strongest cross-platform pattern is isolation of environment-specific behavior

Evidence:

- `platform_utils.py:58-153` isolates document-folder and OS-specific path logic.
- `platform_utils.py:31-55` isolates `.Data` folder discovery behavior.
- `gui.py:56` calls `get_endnote_default_directory()` rather than hard-coding it locally.
- `endnote_exporter.py:14` imports `find_data_folder` and `validate_file_extension` from the helper layer.

What transfers cleanly:

- browser-first or wrapper implementations should also isolate environment details
- that layer simply changes identity:
  - browser app: file picker / drag-drop / OPFS adapter
  - single-file HTML: inline picker + ZIP/file-only adapter
  - Electron/Tauri wrapper: native filesystem bridge adapter

What should change:

- environment adapters should stop exposing “where on disk is Documents?” style functions
- instead, expose “how do I obtain a library input?” and “how do I save the generated XML?”

### 6. The docs consistently recommend separation of runtime concerns and incremental extraction

Evidence:

- `docs/local-web-execution/research/00_setup.md:10` says the local-web track should avoid server-side upload by default.
- `docs/local-web-execution/research/00_setup.md:94` says browser work still needs a runtime-neutral conversion boundary.
- `docs/local-web-execution/research/00_setup.md:226-351` explicitly frames browser-only, single-file HTML, Electron, and Tauri as separate option families.
- `docs/platform-and-web-port/research/01_architecture.md:32-36` describes the repo as a small desktop-first Python app with an uneven split.
- `review_2.md:22` recommends starting with desktop-first hardening before broader runtime expansion.
- `review_1.md:33` and `review_2.md:507` recommend contract-first and golden-fixture discipline before deep refactoring.

Implication:

- style guidance for a browser-local implementation should be conservative and extraction-first, not “rewrite everything into a SPA framework.”

### 7. External browser guidance materially changes the recommendation for single-file HTML and directory-based UX

#### 7a. Native JavaScript modules are appropriate for a browser-first implementation

MDN’s JavaScript modules guide says modern browsers support modules natively and recommends organizing code into modules rather than one oversized script. It also notes that module-based apps should generally be tested via a local web server, and that loading module HTML directly via `file://` runs into CORS/security issues.

Implication:

- a **multi-file browser app using native ES modules** is the cleanest implementation style
- a **single-file HTML app** is possible, but only if it avoids depending on external module files at runtime
- a real maintainable codebase should not be architected as one massive inline script just to satisfy a distribution fantasy

#### 7b. Directory-picker UX cannot be the only ingestion path

MDN’s `showDirectoryPicker()` page says:

- it is available only in secure contexts
- it requires transient user activation
- it has limited browser availability, with no support listed for Firefox or Safari at the time of review

Implication:

- directory-first UX can be a progressive enhancement in Chromium-class browsers
- it should not be the only supported input path for a browser-local implementation
- ZIP upload or selected-file bundle input must remain part of the design if wide browser support matters

#### 7c. Secure-context rules complicate the “just open a local HTML file” story

MDN Secure Contexts explains that powerful APIs are restricted to secure contexts and notes that `file://` URLs are generally considered potentially trustworthy, but practical support still depends on the specific API and browser implementation. Combined with the module guide’s warning about module loading via `file://`, this means the simple local-file story is uneven.

Implication:

- a single HTML file may work for some limited scenarios
- but “open from disk in any browser and get full folder access + module structure” is too optimistic
- if directory handles or richer filesystem flows are important, a served browser app or a thin wrapper app is a more reliable style target

#### 7d. File System API and OPFS are useful support tools, not the whole architecture

MDN File System API documentation shows that:

- handles can be obtained from pickers and drag/drop
- OPFS is useful for local sandboxed storage and worker-friendly processing
- handles can be serialized into IndexedDB
- workers are a reasonable place for heavy file operations and synchronous access handles in OPFS

Implication:

- a browser-local implementation should likely keep UI on the main thread and move heavy parsing/SQLite work into a worker
- OPFS is a good staging area or cache, but should not become an excuse to overcomplicate the MVP

---

## What should transfer cleanly

### Preserve these conventions

1. **Thin runtime shell over shared conversion logic**
   - Current precedent: `gui.py:54-133` vs `endnote_exporter.py:204-824`
   - Browser equivalent: `main.js` or `app.js` orchestrates input and progress; conversion logic lives elsewhere.

2. **Narrow environment adapter layer**
   - Current precedent: `platform_utils.py:31-161`
   - Browser equivalent: `input-adapter`, `output-adapter`, `storage-adapter`, optional `worker-adapter`.

3. **Explicit normalization step before conversion**
   - Current precedent: `_resolve_enl_path()` and `.Data` lookup in `endnote_exporter.py:142-177` and `platform_utils.py:31-55`
   - Browser equivalent: normalize selected files/handles/zip entries into a single prepared library model.

4. **Centralized sanitization and output shaping**
   - Current precedent: `INVALID_XML_REGEX`, `safe_str()`, `_dict_to_xml()` in `endnote_exporter.py:56`, `:659-824`, `:916`
   - Browser equivalent: one `xml/` or `serialization/` module, not scattered escaping logic in UI code.

5. **Verification-first culture**
   - Current precedent in planning docs: `plan_c_aggressive.md:175`, `review_1.md:33`, `review_2.md:507`
   - Browser equivalent: fixture-based parity tests against current exporter behavior before UI polish.

### Style notes that still fit

- keep modules small and purpose-specific
- prefer descriptive names over terse abstractions
- keep packaging/build concerns outside runtime logic
- keep docs separated by audience: user docs, developer docs, research/planning docs

---

## Where a different style is more appropriate

### 1. Do not carry over the Python “one dense core module” shape literally

`endnote_exporter.py` is functionally valuable but structurally dense: logging bootstrap, constants, path resolution, export orchestration, mapping, XML serialization, and comparison utilities all live together (`endnote_exporter.py:33-46`, `:56-96`, `:142-182`, `:204-824`, `:928+`).

For browser-local work, a cleaner split is more appropriate because:

- async boundaries matter more
- worker handoff matters more
- module loading ergonomics matter more
- future WASM/SQLite integration will benefit from isolation

Recommendation:

- keep the conceptual “shared core,” but split the implementation into a few small modules

### 2. Path-first APIs should become virtual-file-first APIs

The current desktop style is strongly `Path`-centric, by design (`CLAUDE.md:39`; `platform_utils.py:7-161`).

That does **not** transfer directly to the browser.

Recommendation:

- browser core boundary should accept a normalized structure like:
  - logical relative path
  - file content accessor
  - directory traversal accessor
  - metadata
- only wrapper implementations should convert native filesystem concepts into that structure

### 3. Browser UI should be stateful and async-friendly, not modal-dialog centric

The Tkinter UI style in `gui.py` is event-driven and modal, which fits desktop.

For browser-local work, a different interaction style is better:

- visible steps and progress states
- inline validation and warnings
- download/save actions instead of desktop save dialogs
- recoverable partial state if parsing takes time

### 4. A single-file HTML app should optimize for distribution, not codebase authoring

MDN module guidance and secure-context constraints make it clear that a maintainable browser app should normally be authored as modules and then optionally bundled into a single-file distribution if desired.

Recommendation:

- author multi-file
- optionally build single-file
- do not make “everything inline forever” the primary source layout unless the project intentionally chooses a tiny-demo scope

---

## Recommended organization by implementation option

### A. Minimal browser-first codebase

Best fit for the real implementation if browser-local feasibility is confirmed.

Suggested structure:

```text
local-web/
├── index.html
├── styles.css
├── src/
│   ├── main.js                 # bootstraps UI, wires events, progress, downloads
│   ├── app-state.js            # small state container / status model
│   ├── ui/
│   │   ├── controls.js         # buttons, forms, visibility, status messaging
│   │   └── results.js          # warnings, counts, download links
│   ├── adapters/
│   │   ├── browser-input.js    # file picker, drag-drop, optional directory picker
│   │   ├── browser-output.js   # Blob creation, download/save flows
│   │   └── storage.js          # optional OPFS/IndexedDB staging
│   ├── core/
│   │   ├── normalize-library.js
│   │   ├── read-endnote-db.js
│   │   ├── map-record.js
│   │   ├── build-export.js
│   │   └── export-xml.js
│   ├── workers/
│   │   └── export-worker.js    # optional heavy parsing/SQLite work
│   └── lib/
│       └── shared-types.js     # shared shapes/contracts, if needed
└── tests/
    ├── fixtures/
    └── parity/
```

Why this matches repo style:

- still small and explicit
- preserves thin-shell/core separation
- replaces `platform_utils.py` with adapter modules rather than spreading browser APIs everywhere
- gives a natural home for worker-only code

### B. Single-file HTML app

Use only if distribution simplicity is more important than long-term maintainability.

Suggested source strategy:

```text
single-file-app/
├── src/
│   ├── app.js
│   ├── core/
│   ├── adapters/
│   └── template.html
└── dist/
    └── endnote-exporter-local.html
```

Recommended rule:

- **author in modules, build to one HTML artifact**

If the project insists on a hand-authored single file, keep it organized internally:

1. HTML shell
2. inline CSS
3. one inline `<script type="module">`
4. clear section markers inside the script:
   - constants/config
   - UI wiring
   - input normalization
   - conversion logic hooks
   - output/download logic

Cautions:

- directory-picker support remains browser-limited
- local `file://` behavior for module-based code is awkward
- large WASM or multi-library payloads make this style less attractive quickly

Best use:

- narrow MVP
- ZIP/file upload first
- simple “choose input -> convert -> download XML” flow

### C. Lightweight wrapper app

Best fit if browser-only execution is feasible in principle but browser UX/API limits are too sharp.

Suggested structure:

```text
wrapper-app/
├── ui/                        # shared web UI assets
│   ├── index.html
│   ├── styles.css
│   └── src/
│       ├── main.js
│       ├── core/
│       └── adapters/
├── wrapper/
│   ├── electron/             # or tauri/
│   └── bridge/               # native filesystem bridge only
└── tests/
```

Style guidance:

- keep the wrapper thin
- avoid moving conversion logic into wrapper-native code unless browser constraints force it
- the wrapper’s job should be filesystem capability and packaging, not business-logic ownership

For this repo, a lightweight wrapper fits the existing style better than a large multi-runtime platform rewrite.

---

## Issues

### 1. The strongest reusable logic is present, but too concentrated in one file

`endnote_exporter.py` is the right conceptual core but the wrong structural target for browser code as-is.

Why it matters:

- browser/runtime boundaries will be harder to isolate cleanly
- worker offloading becomes awkward
- future SQLite/WASM integration will be harder to stage

### 2. Current conventions are heavily filesystem-shaped

The current codebase correctly assumes local disk access, `Path` operations, and sibling folders. That assumption is perfect for desktop but not transferable unchanged to the browser.

Why it matters:

- blindly copying this style into browser code would produce a leaky abstraction
- the browser implementation needs a different boundary object model

### 3. Single-file HTML has higher practical friction than it first appears

Because of native module behavior, secure-context requirements, and limited directory-picker support, a single-file HTML artifact is better treated as a packaging target than the canonical source structure.

### 4. Browser capability differences argue against a directory-only UX

`showDirectoryPicker()` support limitations mean any browser-first implementation must have a second ingestion path if cross-browser support matters.

### 5. Repo documentation already shows some drift, which is a warning for any new runtime track

Evidence:

- `README.md:45-48` says the app uses only the core library and refers to `endnote_exporter_gui.py`
- `pyproject.toml:7-16` and `CLAUDE.md:26`, `:39` show the actual current toolchain and entrypoint

Why it matters:

- local-web work should choose one authoritative implementation/developer doc path early, or the new track will drift too

---

## Opportunities

### 1. Use the current repo’s best pattern as the foundation

The right inheritance is:

- thin shell
- shared conversion core
- narrow runtime adapters
- build/distribution outside the runtime

That pattern already works for desktop and can map cleanly to browser-local work.

### 2. Introduce one normalized library contract and reuse it everywhere

A browser-local implementation would benefit from a central contract such as:

- library identity
- logical file tree
- DB access source
- attachment access source
- warnings collected during normalization

That would let browser, single-file, and wrapper variants share the same conversion code.

### 3. Make worker boundaries part of the style, not a later optimization

Because heavy parsing and possible SQLite/WASM use are plausible, a browser-local implementation should reserve a clear place for worker-based execution from the start.

### 4. Preserve parity discipline early

The planning docs already emphasize contract-first and golden-fixture work (`plan_c_aggressive.md:175`, `review_1.md:33`, `review_2.md:507`). That is especially important if logic is ported from Python to browser code.

### 5. Build once, package many

A modular browser-first source layout can support:

- served browser app
- bundled single-file HTML distribution
- Electron wrapper
- Tauri wrapper

without changing the conversion-core style each time.

---

## Open questions

1. **What is the canonical normalized input shape for browser-local execution?**
   File handles, extracted ZIP entries, OPFS-staged files, or an abstract virtual tree?

2. **Does broad browser support matter more than direct folder selection?**
   If yes, ZIP/file-based ingestion must remain first-class.

3. **Will the browser-local implementation be authored in plain JavaScript or TypeScript?**
   Either can fit the repo’s preference for explicitness, but the choice affects module contracts and testing style.

4. **Will a single-file HTML artifact be a development target or only a release artifact?**
   The recommendation here is release artifact only.

5. **If a wrapper is needed, should it be Electron or Tauri?**
   Style-wise, both should remain thin; the real decision is tooling complexity vs packaging/runtime convenience.

6. **How much of the current Python mapping logic will be ported verbatim versus re-specified through fixture-driven behavior?**
   The latter is safer if browser and desktop must remain behaviorally aligned.

---

## Recommended implementation style guidance

### Strong recommendation

For this repo, the best implementation style is:

- **author as a small multi-file browser app**
- **extract and preserve a runtime-neutral conversion core**
- **keep browser/wrapper concerns in thin adapters**
- **use fixture-driven parity tests as a hard gate**
- **treat single-file HTML as an optional packaging format, not the canonical code layout**

### Practical hierarchy

1. **Primary source layout:** minimal browser-first modular app
2. **Optional distribution format:** bundled single-file HTML
3. **Fallback runtime:** thin Electron or Tauri wrapper if browser APIs prove too restrictive

### Short version

Preserve the repo’s current best habit — **thin shell, reusable core, isolated environment helpers** — but translate it into browser terms: **thin UI, reusable conversion modules, isolated browser/wrapper adapters, and worker-friendly boundaries**.

That is the cleanest way to stay faithful to the existing project style without forcing browser code to pretend it still lives on a desktop filesystem.
