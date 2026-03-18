# Architecture Research Report: browser-local / client-side converter

Date: 2026-03-18
Repository: `/home/sam/dev/endnote-exporter`

## Scope

Research only. No application code was modified.

This report evaluates the feasibility and architectural implications of a **browser-local / client-side implementation** of the EndNote-to-Zotero converter. The target is a **local-only web product** where conversion occurs on the user’s device by default, without requiring server-side upload of the full library.

This report reuses prior repository research from:

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port_PLAN.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/01_architecture.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/02_components.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/03_backend.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/04_style_patterns.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/05_tests.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/06_documentation.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/07_issues_debt.md`
- `/home/sam/dev/endnote-exporter/docs/local-web-execution/research/00_setup.md`

It also incorporates limited feasibility validation from current external documentation:

- MDN File System API and `showDirectoryPicker()` documentation
- Pyodide file system and native filesystem mounting documentation
- `sql.js` documentation
- Electron dialog API documentation
- Tauri dialog plugin documentation

## Executive Summary

The current repository is **desktop-first Python**, with the transformation core concentrated in `endnote_exporter.py` and a thin Tkinter shell in `gui.py`. The codebase contains a reusable **conversion specification**, but not a reusable **browser runtime**.

The strongest conclusions are:

1. **The current Python module is not directly browser-ready.** Its core export path assumes local `Path` objects, direct `sqlite3` access, local output paths, local logs, and absolute local PDF paths.
2. **The most reusable intellectual asset is the transformation behavior**, especially record mapping and XML serialization semantics embodied in `EndnoteExporter._build_record_dict()` and `EndnoteExporter._dict_to_xml()`.
3. **A true browser-local product is most credible as a JavaScript/TypeScript implementation with SQLite-in-WASM and worker-based execution**, using the existing Python code as the reference specification rather than as the primary runtime.
4. **Pyodide/Python-in-browser is technically possible for a spike or parity harness, but weak as the primary product architecture** because browser filesystem mounting is experimental/Chromium-biased and because it preserves too much of the current file-system-shaped execution model.
5. **If “browser-local” proves too constrained in practice, a local wrapper remains viable**, with **Tauri preferred over Electron** on footprint grounds, while Electron remains the operationally simpler JavaScript-only wrapper.
6. The minimum seams needed for a local-only web product are relatively clear: **input normalization**, **database row access**, **record mapping**, **XML emission**, **attachment policy**, and **runtime adapter** boundaries.

## Primary Sources Reviewed

### Repository architecture and runtime files

- `/home/sam/dev/endnote-exporter/endnote_exporter.py`
- `/home/sam/dev/endnote-exporter/gui.py`
- `/home/sam/dev/endnote-exporter/platform_utils.py`
- `/home/sam/dev/endnote-exporter/pyproject.toml`
- `/home/sam/dev/endnote-exporter/README.md`
- `/home/sam/dev/endnote-exporter/.github/workflows/release.yml`

### Key code anchors

#### Export core

- logging bootstrap: `endnote_exporter.py:33-46`
- `.enlp` path resolution helper: `endnote_exporter.py:142`
- exporter class: `endnote_exporter.py:181`
- public export entrypoint: `endnote_exporter.py:182`
- main export orchestration: `endnote_exporter.py:204`
- direct SQLite connection: `endnote_exporter.py:242`
- shared comparison log write: `endnote_exporter.py:264`
- absolute PDF path serialization: `endnote_exporter.py:603`
- module-level wrapper: `endnote_exporter.py:923`
- XML comparison helper: `endnote_exporter.py:928`

#### Desktop UI

- GUI import of export function: `gui.py:5`
- GUI log directory policy: `gui.py:13-17`
- GUI class: `gui.py:20`
- local file picker: `gui.py:59`
- warning scraping from log file: `gui.py:81`
- local save dialog: `gui.py:110`
- GUI invocation of exporter: `gui.py:133`

#### Platform helpers

- `.Data` discovery: `platform_utils.py:31`
- documents-folder detection: `platform_utils.py:58`
- default EndNote directory: `platform_utils.py:153`
- extension validation: `platform_utils.py:161`

#### Packaging metadata and release flow

- Python floor: `pyproject.toml:7`
- runtime dependencies: `pyproject.toml:8-10`
- Ruff dev dependency: `pyproject.toml:16`
- desktop support claims: `README.md:3`, `README.md:14-16`
- absolute PDF-path behavior documentation: `README.md:7`
- stale developer run instructions: `README.md:45-49`
- release OS matrix: `release.yml:16`
- dependency install: `release.yml:30`
- Windows/Linux PyInstaller build: `release.yml:47`
- macOS Universal2 build: `release.yml:54`
- release publication: `release.yml:64`
- unsigned macOS quarantine guidance: `release.yml:82`

## Current Architecture Relevant to Browser-Local Execution

### 1. The repository is Python desktop application first

The codebase currently targets:

- Python 3.12+ (`pyproject.toml:7`)
- Tkinter GUI (`gui.py:20`, `README.md:45`)
- PyInstaller-based desktop packaging (`pyproject.toml:10`, `release.yml:47`, `release.yml:54`)

There is no JavaScript frontend, no browser runtime, no web worker model, no service worker, and no browser storage abstraction in the repository.

### 2. The transformation core is real, but it is embedded inside a file-system-shaped job runner

`endnote_exporter.py` does not merely transform rows into XML. It also:

- configures process-global logging (`endnote_exporter.py:33-46`)
- resolves `.enlp` packages from local directory structures (`endnote_exporter.py:142`)
- builds local output paths (`endnote_exporter.py:204+`)
- opens SQLite directly from disk (`endnote_exporter.py:242`)
- appends comparison JSONL to local files (`endnote_exporter.py:264`)
- emits absolute local PDF paths (`endnote_exporter.py:603`)

This is the key architectural fact for browser-local planning. The code already defines output semantics, but the runtime contract is **local filesystem in, local filesystem out**.

### 3. The GUI is thin and should be treated as non-reusable

`gui.py` is structurally useful as evidence that the converter already has a headless core, but not as a reusable browser asset:

- local file picker: `gui.py:59`
- local save dialog: `gui.py:110`
- warning handling via log scraping: `gui.py:81`, `gui.py:130-134`
- export call into core: `gui.py:133`

This entire file is desktop adapter logic.

### 4. The current platform abstraction is only partially useful for browser work

`platform_utils.py` contains a clean desktop/platform seam, but most of it is irrelevant for browser-local execution:

Reusable in concept:

- `.Data` lookup semantics: `platform_utils.py:31`
- extension validation: `platform_utils.py:161`

Not reusable for browser:

- documents-folder logic: `platform_utils.py:58`
- default EndNote directory: `platform_utils.py:153`
- Windows `SHGetFolderPathW` path lookup: `platform_utils.py:102`

## What Is Most Reusable for a Browser-Local Implementation

### High-value reusable pieces

#### 1. Record mapping behavior in `EndnoteExporter._build_record_dict()`

This is the most valuable reusable unit in the repository, even if it is not directly executable in the browser as-is.

It defines:

- reference type mapping
- date handling
- contributor parsing
- title and periodical rules
- keyword and URL mapping
- custom field preservation
- notes/date metadata emission
- attachment URL behavior

This logic should be treated as the **compatibility specification** for any browser-local rewrite.

#### 2. XML emission semantics in `EndnoteExporter._dict_to_xml()`

The XML nesting model is already explicit in the repository and should be preserved as much as possible for parity.

This includes:

- `<record>` structure
- nested `dates`, `titles`, `contributors`, `periodical`, `urls`, and `keywords`
- attribute form for `ref-type`
- XML sanitization through `create_xml_element()` and `safe_str()`

#### 3. Input-shape knowledge

The repo already encodes the critical input shapes:

- `.enl` plus sibling `.Data`
- `.enlp` package directories
- SQLite DB under `sdb/sdb.eni`
- PDFs under `PDF/`

Even if the browser runtime changes completely, this input-shape knowledge remains reusable.

#### 4. Comparison/parity utility

`XMLComparator` (`endnote_exporter.py:928`) is not a runtime asset for the browser product, but it is useful for validating parity between current Python output and a future browser-local implementation.

### Low-value or non-reusable pieces

#### 1. Tkinter UI and native-dialog flow

- `gui.py:20-173`

This should be replaced, not ported.

#### 2. Runtime/log path strategy

- `endnote_exporter.py:33-46`
- `gui.py:13-17`

The current log model is already inconsistent across desktop components. It is not a good substrate for browser-local execution.

#### 3. Desktop attachment-path policy

- `README.md:7`
- `endnote_exporter.py:603`

Absolute local PDF paths are an intentionally desktop-local behavior. They are not transferable unchanged to a browser-local product.

## What Is Tightly Bound to Python, Tkinter, or Native Filesystem Assumptions

### Python-bound or CPython-shaped behavior

- direct `sqlite3` module usage: `endnote_exporter.py:242`
- Python standard-library XML generation and pretty-printing
- process-global `loguru` logging
- `Path`-centric runtime assumptions throughout `endnote_exporter.py`

### Tkinter-specific behavior

- file selection: `gui.py:59`
- output save dialog: `gui.py:110`
- warning/error display via message boxes
- UI state transitions tied to synchronous export completion

### Native filesystem assumptions

- `.enlp` directory traversal using `Path.glob()` (`endnote_exporter.py:142+`)
- case-insensitive `.Data` discovery on a live local filesystem (`platform_utils.py:31`)
- direct reading from `<Library>.Data/sdb/sdb.eni` (`endnote_exporter.py:242`)
- absolute local PDF path emission (`endnote_exporter.py:603`)
- local output file creation (`endnote_exporter.py:352`)

These assumptions are compatible with desktop packaging, but they are not browser primitives.

## Browser Runtime Feasibility Findings

### 1. Browser-local directory access is possible, but not universally portable

MDN’s documentation indicates:

- `showDirectoryPicker()` requires a **secure context** and **transient user activation**.
- It is marked **experimental**.
- Browser support is materially uneven: Chromium-family support exists, but Firefox and Safari support is absent on the specific `showDirectoryPicker()` page reviewed.

Implication:

- A browser-local product can support **directory selection** well in Chromium-class browsers.
- It cannot assume a universal “pick the whole EndNote package/folder” flow across all browsers.
- Therefore, a browser-local architecture should keep **ZIP upload** as a first-class fallback, not merely as a convenience.

### 2. Browser storage and worker support are sufficient for a serious local pipeline

MDN’s File System API documentation indicates:

- OPFS exists for origin-private local storage.
- file and directory handles can be serialized into IndexedDB.
- worker access exists for relevant APIs.
- `FileSystemSyncAccessHandle` is specifically useful in worker/WASM-heavy flows.

Implication:

- A browser-local pipeline can use **worker + OPFS / IndexedDB / in-memory staging** for unpacked content and intermediate outputs.
- This is strong evidence in favor of a **worker-based architecture**, especially for SQLite and XML generation workloads.

### 3. Pyodide can mount browser file systems, but the model is explicitly experimental and Chromium-dependent

Pyodide documentation indicates:

- its default filesystem is in-memory MEMFS
- IDBFS can persist browser-side data
- native filesystem mounting in the browser uses the File System Access API
- `mountNativeFS()` is experimental and tied to browser support constraints
- the native-file-system path was documented as Chromium-only in the referenced documentation

Implication:

- Pyodide can support a browser-local proof of concept.
- It is a weak basis for a universal product promise because its cleanest “mount a directory and pretend it is local disk” path inherits the same browser support constraints as `showDirectoryPicker()`.
- It also preserves the file-system-shaped execution model rather than reshaping the product around browser-native constraints.

### 4. SQLite-in-WASM is clearly feasible in the browser

`sql.js` documentation indicates:

- SQLite is compiled to WebAssembly / JavaScript for browser use
- an existing SQLite file can be loaded from `Uint8Array`
- it can run in the browser and in Web Workers
- databases can be exported as typed arrays
- the project explicitly supports importing an existing SQLite database file selected by the user
- the project also warns that database files are loaded into memory and that native bindings are preferable for very large direct-on-disk access

Implication:

- The SQLite database at `sdb/sdb.eni` is **not a fundamental blocker** for a browser-local implementation.
- The architectural issue is **performance and memory discipline**, not feasibility.
- This strongly supports a **browser worker + SQLite-in-WASM** architecture.

### 5. Local wrappers remain straightforward and technically credible

Electron documentation confirms:

- native open/save dialogs support file and directory selection
- macOS-specific options include `treatPackageAsDirectory`
- file paths are returned to the application directly

Tauri documentation confirms:

- desktop dialogs return filesystem paths on Linux, Windows, and macOS
- file and directory pickers are supported on those desktop platforms

Implication:

- If pure browser-local constraints become unacceptable, **Electron and Tauri are both viable local wrappers**.
- These wrappers reduce browser API fragility substantially because they return native paths rather than browser file handles.

## Architecture Shape Comparison

## 1. Direct JavaScript / TypeScript Reimplementation

### Definition

Reimplement the converter in JavaScript/TypeScript, using the current Python code as the specification. The browser app would parse user-selected files or a ZIP, load the EndNote SQLite DB, reproduce mapping behavior, and emit Zotero-compatible XML entirely in the client.

### Strengths

- aligns naturally with a browser-local product
- avoids Python-in-browser startup and packaging overhead
- creates the cleanest long-term browser-native architecture
- allows web-worker-first execution and browser-native UX
- best chance of cross-browser support when paired with file-upload / ZIP fallback instead of directory-handle dependence

### Weaknesses

- requires a real port of the transformation logic
- parity risk is non-trivial because `_build_record_dict()` contains many special cases
- requires deliberate recreation of XML semantics
- any Python-specific convenience logic becomes specification work rather than reusable runtime code

### Reuse profile against this repo

Reusable mostly as specification:

- `endnote_exporter.py:181-923`
- especially record mapping semantics and XML structure

Not reusable as runtime:

- direct `sqlite3` access
- `Path`-based traversal
- `loguru` logging bootstrap
- Tkinter UI

### Assessment

This is a strong long-term architecture. It is not the cheapest short-term spike, but it is the best match for an actual browser-local product.

## 2. Python-in-Browser via WASM / Pyodide

### Definition

Run a Python build in the browser and adapt the current export logic to operate against Pyodide’s virtual filesystem or experimental native filesystem mounting.

### Strengths

- highest apparent code reuse potential
- useful for parity experiments and rapid feasibility spikes
- preserves existing Python mapping logic longer
- good for building a browser-based regression harness against the current exporter behavior

### Weaknesses

- Pyodide filesystem model is not the same as native desktop paths
- native filesystem mounting inherits experimental / Chromium-only limitations
- large bundle and startup overhead relative to a targeted JS/TS converter
- current code still assumes direct `sqlite3` file access, output paths, logs, and PDF path semantics
- likely results in awkward adaptation rather than a clean browser-native architecture

### Reuse profile against this repo

Potentially reusable with adaptation:

- mapping and XML logic
- some helper logic

Still problematic:

- local `Path` assumptions
- runtime logging behavior
- file output policy
- attachment policy
- likely need to replace or rework some filesystem code even if Python remains

### Assessment

This is best viewed as a **research/prototyping path**, not the recommended production architecture.

## 3. SQLite-in-Browser / WASM-Assisted Architecture

### Definition

A browser-native application centered on:

- ZIP or directory ingestion on the client
- extraction and staging in memory or OPFS
- SQLite-in-WASM in a Web Worker
- JS/TS reimplementation of transformation and XML emission
- browser download or save-to-file output

This is distinct from “direct JS/TS reimplementation” because it explicitly treats **SQLite/WASM + worker orchestration + browser storage** as the architecture center.

### Strengths

- best alignment with current input reality, since EndNote data is SQLite-backed
- explicit worker boundary keeps heavy parsing off the main thread
- OPFS/IndexedDB gives a place for temporary staging without server upload
- works well with browser ZIP upload even when directory APIs are unavailable
- can load the SQLite file directly from a `Uint8Array`
- can scale better than a naïve all-in-main-thread browser app

### Weaknesses

- still requires porting mapping logic to JS/TS
- performance depends on library size and whole-database-in-memory behavior
- attachment-heavy, very large libraries may still stress browser memory
- browser directory-handle UX remains uneven across browsers

### Reuse profile against this repo

Best reuse pattern:

- treat `endnote_exporter.py` as the reference behavior
- port the mapping constants and XML rules
- preserve `XMLComparator` as parity validation on the Python side

### Assessment

This is the **strongest pure browser-local architecture** for the stated product goal.

## 4. Local Wrapper Architectures: Electron / Tauri

### Definition

A local desktop-distributed shell with web UI, keeping execution on-device while using native desktop dialogs and filesystem paths.

### Strengths

- much simpler path/package handling than a browser tab
- native directory/file pickers remove many browser API constraints
- macOS packages like `.enlp` are easier to handle as true filesystem objects
- keeps the privacy story strong because execution remains local
- can be used either with a JS/TS converter or with a retained Python sidecar/CLI

### Weaknesses

- not a pure browser product anymore
- distribution complexity re-enters the problem
- update/signing/notarization burden remains
- Electron has larger footprint; Tauri adds Rust/toolchain complexity

### Electron-specific notes

- operationally simpler for a JavaScript team
- larger application footprint
- native dialogs and file paths are straightforward

### Tauri-specific notes

- lighter runtime footprint
- better fit if the goal is “small local app with web UI”
- introduces Rust/native shell complexity
- still requires a deliberate strategy for reusing or replacing Python core logic

### Assessment

This is the **best fallback** if true browser-local delivery cannot meet compatibility or performance goals. If a wrapper is accepted, **Tauri is likely the better long-term product shape**, while **Electron is likely the easier prototype shape**.

## Comparative Ranking

| Architecture shape | Product fit for browser-local goal | Code reuse | Runtime risk | Delivery risk | Overall assessment |
|---|---:|---:|---:|---:|---|
| Direct JS/TS reimplementation | High | Medium | Medium | Medium | Strong long-term option |
| Python-in-browser / Pyodide | Medium | Medium-High | High | High | Good spike, weak product default |
| SQLite-in-browser / WASM-assisted | High | Medium | Medium | Medium | Strongest browser-local option |
| Electron wrapper | Medium | Medium-High | Low-Medium | Medium-High | Good fallback if browser constraints bite |
| Tauri wrapper | Medium | Medium | Low-Medium | Medium | Best wrapper fallback if native shell is acceptable |

## Strongest Recommended Direction

### Primary recommendation

For a **true browser-local product**, prefer:

1. **Browser-native TypeScript implementation**
2. **SQLite-in-WASM inside a worker**
3. **ZIP upload as a required path** and **directory selection as an opportunistic enhancement where supported**
4. **the current Python exporter as the parity oracle/specification**, not as the primary runtime

### Secondary recommendation

Use **Pyodide only as a spike path** to answer parity or feasibility questions quickly, not as the primary architecture.

### Fallback recommendation

If testing reveals unacceptable browser limitations for real user libraries, shift to a **local wrapper**. Prefer **Tauri** if application size and product polish matter more; prefer **Electron** if implementation speed with a JavaScript stack matters more.

## Minimum Architectural Seams Required for a Local-Only Web Product

### 1. Prepared-library normalization seam

The product needs a canonical in-memory model independent of how the user supplied the library:

- `.enl` + `.Data`
- `.enlp`
- ZIP of either of the above
- directory-handle selection when supported

Minimum fields:

- library identifier / root name
- normalized path map or virtual file map
- DB blob / DB location
- PDF base subtree
- input type metadata

### 2. Database row-access seam

The export mapping logic should stop caring whether rows came from:

- Python `sqlite3`
- `sql.js`
- a wrapper-native SQLite binding
- a future Rust helper

The current code conflates row access and export orchestration inside `_export()` (`endnote_exporter.py:204`, `endnote_exporter.py:242`). That should become an explicit seam.

### 3. Record-mapping seam

The behavior currently encoded in `_build_record_dict()` should become the formal domain layer.

This is the most important seam to preserve for parity.

### 4. XML-emission seam

The XML generation should become a pure function over record structures.

The current code already points in that direction conceptually, but it is still embedded in `endnote_exporter.py`.

### 5. Attachment-policy seam

This is mandatory.

The product must distinguish at least these modes:

- preserve desktop-style absolute paths where local wrapper/native access makes that meaningful
- emit relative metadata only
- omit attachment URLs and warn
- optionally rewrite from client-local hints if explicitly supported

The current hard-coded behavior (`README.md:7`, `endnote_exporter.py:603`) should not remain the only policy.

### 6. Export-result/reporting seam

The current return shape is effectively `(count, output_path)`.

A local web product needs structured output such as:

- total records found
- records exported
- records skipped
- warnings
- attachment mode used
- generated XML blob/string

### 7. Runtime adapter seam

The browser/runtime layer should own:

- directory picker or ZIP/file input
- worker communication
- browser storage / OPFS / IndexedDB staging
- “download XML” or “save file” interaction

This must be separate from the mapping and XML logic.

## Proposed Target Shape for the Browser-Local Product

### Recommended reference architecture

```text
Browser UI
  ├─ Input adapters
  │   ├─ ZIP upload
  │   ├─ File/folder handles when supported
  │   └─ Save/download adapter
  ├─ Worker boundary
  │   └─ conversion-worker
  │       ├─ archive/package normalization
  │       ├─ SQLite-in-WASM loader
  │       ├─ EndNote row extraction
  │       ├─ record mapping
  │       ├─ XML emission
  │       └─ structured result + warnings
  └─ optional staging
      ├─ OPFS / IndexedDB
      └─ in-memory fast path
```

### Why this shape fits the repository

It preserves the part of the current codebase that matters most:

- the transformation rules
- the XML structure
- the input-shape knowledge

while removing the parts that are fundamentally desktop-local:

- Tkinter dialogs
- process-global logs
- local output paths
- direct desktop `Path` ownership

## Potential Issues

### 1. The Python exporter is dense and specification extraction will take care

The repository’s most reusable logic is concentrated in one large module. Porting by reading only the happy path would miss many field-specific behaviors.

### 2. Browser API promises can easily outrun compatibility reality

A product promise like “select your EndNote folder directly in any browser” would be materially riskier than “upload ZIP or select a folder in supported Chromium browsers.”

### 3. Large libraries may stress pure browser memory models

`sql.js` explicitly loads databases in memory. Attachment-heavy workflows will require careful staging and user guidance.

### 4. Attachment semantics remain unresolved

The current application’s absolute-path behavior is incompatible with a clean browser-local UX unless there is a clear interpretation strategy.

### 5. `.enlp` packaging variants still need explicit fixture validation

Earlier repo research already identified ambiguity around package layouts and fixture realism. A browser-local architecture should not assume one rigid happy-path package shape without fixture coverage.

## Improvement Opportunities

### 1. Extract a language-neutral conversion spec from the Python code

Promote stable mapping artifacts out of executable Python where practical:

- reference type map
- field-presence rules
- output nesting rules
- attachment mode semantics

A JSON/YAML spec or generated fixtures would reduce drift between runtimes.

### 2. Build parity fixtures before choosing the final runtime

Use the current Python exporter plus `XMLComparator` to define golden outputs for:

- `.enl`
- `.enlp`
- ZIP-normalized inputs
- malformed/edge-case records

### 3. Prefer ZIP as the universal interchange shape

Even if folder picking is supported in some browsers, ZIP is the most portable input contract for a browser-local product.

### 4. Add a headless domain model even if the browser product is built elsewhere

A small internal spec boundary in the Python repo would simplify parity testing and future maintenance even if no application code changes are made immediately.

### 5. Keep wrapper fallback open

Research should not assume browser-only success before fixture and performance validation. Tauri/Electron remain valuable contingency paths.

## Open Questions

1. What minimum browser support is required for the first local-web release?
   - Chromium only?
   - Chromium plus ZIP fallback on all browsers?
   - a PWA expectation?
2. Are absolute PDF links still a product requirement, or can browser-local exports omit/reshape attachment references?
3. Must the product support direct folder/package selection, or is ZIP upload sufficient for MVP?
4. What maximum library/database size must be supported locally in-browser?
5. Are `.enlp` package variants beyond the current happy path required for MVP?
6. Is a local wrapper considered acceptable if pure browser execution fails on compatibility or memory grounds?
7. Should parity be exact for XML output, or are attachment/link semantics allowed to diverge for browser-local mode?

## Code Examples

### Example 1: current local-disk coupling in the core exporter

Source:
- `endnote_exporter.py:204`
- `endnote_exporter.py:242`
- `endnote_exporter.py:352`

```python
class EndnoteExporter:
    def _export(self, enl_file_path: Path, output_file: Path):
        ...
        db_path = data_path / "sdb" / "sdb.eni"
        con = sqlite3.connect(db_path)
        ...
        with output_path.open("w", encoding="utf-8") as f:
            f.write(pretty_xml)
```

Why it matters:
- this is not browser-native execution
- a browser-local version needs DB bytes / virtual files, not native `Path` ownership

### Example 2: current desktop attachment policy

Source:
- `endnote_exporter.py:603`

```python
pdf_urls.append(str(full_pdf_path.resolve()))
```

Why it matters:
- this is reasonable for same-machine desktop import
- it is not an acceptable default contract for a browser-local web product

### Example 3: current desktop adapter boundary

Source:
- `gui.py:59`
- `gui.py:110`
- `gui.py:133`

```python
file_path = filedialog.askopenfilename(...)
output_path_str = filedialog.asksaveasfilename(...)
count = export_references_to_xml(self.enl_file, output_file)
```

Why it matters:
- confirms the exporter core is headless-callable
- also confirms the product is currently local-dialog-shaped rather than browser-shaped

### Example 4: recommended domain seams for a browser-local rewrite

```ts
interface PreparedLibrary {
  inputKind: 'enl-data' | 'enlp' | 'zip' | 'directory-handle';
  libraryName: string;
  dbBytes: Uint8Array;
  pdfFiles: Map<string, Uint8Array | File>;
  metadata: Record<string, string>;
}

interface ExportResult {
  totalRecords: number;
  exportedRecords: number;
  skippedRecords: number;
  warnings: string[];
  attachmentMode: 'absolute' | 'relative' | 'omit';
  xml: string;
}
```

Why it matters:
- this is the minimum contract split needed to stop the runtime from owning the domain model

## Bottom Line

The current repository contains a **valuable export specification**, not a browser-ready engine.

The strongest architecture conclusion is:

- **For a true browser-local product, prefer a TypeScript/browser-native implementation built around SQLite-in-WASM and workers.**
- **Use the existing Python exporter as the behavior oracle and parity test target.**
- **Use Pyodide only for rapid feasibility spikes or parity experiments.**
- **Keep Tauri/Electron as a fallback if browser compatibility or memory limits are unacceptable.**

In other words: the browser-local path is feasible, but the correct reuse strategy is **semantic reuse**, not naive runtime reuse.
