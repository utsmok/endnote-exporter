# Local Web Execution Issues and Technical Debt Research

Date: 2026-03-18
Repository: `/home/sam/dev/endnote-exporter`

## Scope

Research only. This report focuses on technical debt and architectural assumptions in the current repo that would complicate a **browser-local / client-side** implementation, with special attention to:

- Python-only logic that may be hard to port
- filesystem and path assumptions
- SQLite access assumptions
- `.enlp` and zipped input assumptions
- attachment/path reconstruction assumptions
- package-size / bundle-size concerns for browser or WASM delivery
- constraints affecting a **single-file HTML** distribution or a **wrapper-based** local distribution

## Executive summary

The repo’s main browser-local blockers are concentrated, not widespread:

1. **The core exporter is still a CPython file-job, not a runtime-neutral conversion engine.** It opens a real SQLite file with Python’s `sqlite3`, relies on `pathlib.Path`, writes logs and comparison files to disk, and is driven by Tkinter-native dialogs.
2. **Input handling assumes an extracted desktop filesystem layout** (`.enl` + `.Data/sdb/sdb.eni` + optional `PDF/`) and only partially supports macOS package inputs. Zipped package/archive intake is still missing.
3. **Attachment handling is desktop-centric**: PDF references are reconstructed from local disk layout and emitted as absolute resolved paths, which does not transfer cleanly to an in-browser runtime.
4. **The exporter currently loads both SQLite result sets and the output XML into memory**, which raises risk for large libraries in WASM/browser environments.
5. **A plain browser build is feasible only with meaningful runtime changes**: browser SQLite/WASM, file-selection APIs, worker-based execution, and likely a new output/storage strategy. A true single-file HTML distribution is especially constrained.

## Findings

### 1. The current app is a desktop Python application first, not a browser-portable core

**Severity:** High
**Type:** Architecture / Python-only runtime assumption / browser-local blocker

**Evidence**

- `pyproject.toml:7-10` requires Python 3.12+ and declares `loguru` and `pyinstaller` as runtime dependencies.
- `README.md:8` markets the product as a **single executable file**.
- `README.md:45` describes the app as Python + Tkinter + PyInstaller.
- `gui.py:59` uses `filedialog.askopenfilename()`.
- `gui.py:110` uses `filedialog.asksaveasfilename()`.
- `endnote_exporter.py:25-28` writes the main log to a local `_LOG_DIR`.
- `endnote_exporter.py:46` writes `comparisons.jsonl` next to that log.

**Why this matters**

The reusable business logic exists, but it is still embedded in a **desktop runtime contract**:

- native dialogs choose input and output locations
- Python’s stdlib and filesystem abstractions are assumed everywhere
- the module configures process-global logging side effects at import time
- output is written to disk rather than returned as an in-memory artifact

That is manageable for desktop, but it means a browser-local port is **not** a simple “wrap current code in HTML” exercise.

**Browser-local impact**

A browser-local version needs at least one of these paths:

- a **JS/WASM reimplementation** of the export core, or
- a **Python-in-WASM** approach such as Pyodide, plus replacements for local file access and SQLite/file I/O assumptions

**Opportunity**

Define a runtime-neutral boundary such as:

`normalized library input -> export result bytes + warnings + attachment manifest`

That would let desktop, browser, Electron, or Tauri each provide their own I/O adapter.

---

### 2. SQLite access is direct-file, CPython-specific, and not shaped for browser memory limits

**Severity:** High
**Type:** SQLite assumption / Python-only logic / browser-local blocker

**Evidence**

- `endnote_exporter.py:232` assumes the database exists at `data_path / "sdb" / "sdb.eni"`.
- `endnote_exporter.py:242` opens that path with `sqlite3.connect(db_path)`.
- `endnote_exporter.py:245` runs `SELECT * FROM refs WHERE trash_state = 0`.
- `endnote_exporter.py:249` runs `SELECT refs_id, file_path FROM file_res`.
- `endnote_exporter.py:246` loads all reference rows with `fetchall()`.
- `endnote_exporter.py:250` loads all attachment rows with `fetchall()`.
- `endnote_exporter.py:260` builds an in-memory XML tree.
- `endnote_exporter.py:304-318` serializes and pretty-prints the **full XML document** in memory via `ET.tostring(...)` and `minidom.parseString(...)`.

**Why this matters**

The exporter assumes a normal local CPython process that can:

- open SQLite directly from a real filesystem path
- hold query results in memory
- hold the generated XML DOM and pretty-printed output in memory

That becomes materially harder in a browser/WASM runtime.

**External validation**

- The `sql.js` project documents that browser SQLite runs via WebAssembly and loads an existing SQLite file from a `Uint8Array`; it also notes that the database is effectively a **virtual database file stored in memory** unless additional persistence machinery is used. It requires shipping both a JS loader and a `.wasm` asset: <https://github.com/sql-js/sql.js>
- SQLite’s official WASM docs describe browser persistence as an OPFS/VFS concern with significant caveats, and the cookbook notes that importing a **WAL-mode** database is not supported in the standard WASM environment because the build lacks the shared-memory support required for that workflow: <https://sqlite.org/wasm/doc/trunk/persistence.md>, <https://sqlite.org/wasm/doc/trunk/cookbook.md>

**Browser-local impact**

This is one of the biggest browser-local risks:

- CPython `sqlite3` on a file path is not the browser execution model
- a browser port will probably need `sql.js`, SQLite WASM, or a Pyodide-compatible path
- large EndNote libraries may cause memory spikes because the current algorithm materializes:
  - all refs
  - all file mappings
  - the XML tree
  - the pretty-printed XML string

**Opportunity**

- Probe whether `sdb.eni` is always a plain SQLite database and whether EndNote ever leaves it in WAL mode.
- Consider a streaming export design for future portability, even if desktop keeps the current implementation initially.

**Open questions**

1. Are real-world EndNote libraries always importable as a single standalone SQLite file, or are WAL/journal sidecars ever required?
2. What maximum library size must a browser-local MVP support before current in-memory assumptions become unacceptable?

---

### 3. Filesystem assumptions are everywhere: extracted layout, OS paths, user Documents folders, writable local disk

**Severity:** High
**Type:** Filesystem/path assumption / browser-local blocker

**Evidence**

- `endnote_exporter.py:205-237` resolves the input to a base path and then looks for `${library_name}.Data/sdb/sdb.eni`.
- `platform_utils.py:31-55` performs case-insensitive `.Data` folder lookup against a real directory.
- `platform_utils.py:58-158` contains OS-specific Documents-folder discovery, including Windows `SHGetFolderPathW` (`platform_utils.py:112`) and Linux `XDG_DOCUMENTS_DIR` (`platform_utils.py:127`, `140`).
- `platform_utils.py:153-158` chooses a default EndNote directory under the user’s Documents folder.
- `gui.py:56` uses that desktop directory as the default picker location.
- `endnote_exporter.py:352-353` writes XML to a chosen filesystem output path.

**Why this matters**

The current code is built around a **user-visible OS filesystem**:

- input has a canonical on-disk shape
- the app can walk directories freely
- the user has a stable Documents folder
- the app may write output, logs, and comparison artifacts to local disk

That contract changes substantially in browser-local execution:

- users provide files/directories through browser APIs
- there is no general-purpose ambient path access
- output is typically downloaded as a `Blob`, not written to an arbitrary path
- a browser cannot recover native absolute source paths from files selected by the user

**External validation**

- MDN documents `showDirectoryPicker()` as **secure-context only**, **experimental**, and unavailable in Firefox and Safari at the time of writing: <https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker>
- MDN documents the File System API/OPFS as secure-context features, with sync access optimized for WebAssembly and available in Workers: <https://developer.mozilla.org/en-US/docs/Web/API/File_System_API>
- Pyodide’s FAQ explicitly notes that browser JS cannot load arbitrary local `file:///...` paths because of browser security rules, and its native filesystem support is described as experimental and Chrome-only in that FAQ’s guidance: <https://pyodide.org/en/stable/usage/faq.html>

**Browser-local impact**

For a browser-local build, the app will need a canonical **input normalization layer** that accepts one of:

- a directory handle
- a `.zip`
- possibly an unpacked `.enlp` selection
- a flat file list + manifest

and reconstructs the internal library layout from those browser-provided objects.

**Opportunity**

Introduce a normalized input model before any browser work:

- `library kind` (`enl+data`, `enlp`, `zip-enl`, `zip-enlp`)
- `database bytes`
- `attachment entries`
- `library name`
- `source-relative attachment paths`

That same model would help wrapper-based local apps too.

---

### 4. `.enlp` support is optimistic, duplicated, and still not archive-shaped

**Severity:** High
**Type:** `.enlp` / archive assumption / browser-local blocker

**Evidence**

- `endnote_exporter.py:142-177` defines `_resolve_enl_path()` for `.enlp` packages.
- That logic uses `glob("*.enl")` and `glob("*.Data")` and takes the first match it finds.
- `endnote_exporter.py:205-212` repeats `.enlp` discovery logic to derive the library name in `_export()`.
- `endnote_exporter.py:188-190` only validates `.enl` and `.enlp` extensions; `.zip` is not accepted.
- The repo contains `testing/RefsEnschede.enlp.zip`, but there is no first-party archive extraction flow in the runtime code.

**Why this matters**

The current implementation supports the **desktop happy path** of selecting:

- a regular `.enl` library file, or
- an unpacked macOS `.enlp` package directory

But browser-local workflows are much more likely to encounter:

- zipped `.enlp`
- zipped `.enl + .Data`
- a browser directory selection that preserves only relative paths
- partial user selections or malformed package trees

The current `.enlp` support is useful, but it is not yet a general input-normalization solution.

**External validation**

MDN’s `showDirectoryPicker()` compatibility matters here because “just select the folder” is not a universal browser contract today, especially if Firefox/Safari support matters: <https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker>

**Browser-local impact**

A browser-local implementation that depends on raw directory selection would be:

- browser-sensitive
- secure-context-sensitive
- more fragile for single-file HTML distribution

A `.zip`-first intake model is therefore much more portable than a raw-folder-only model.

**Opportunity**

- Consolidate `.enlp` resolution in one place.
- Make a product decision about whether `.zip` should become the **canonical browser-local intake format**.

**Open questions**

1. Should browser-local MVP accept only `.zip` to reduce browser API complexity?
2. Should unpacked `.enlp` selection be treated as progressive enhancement rather than baseline support?

---

### 5. Attachment reconstruction assumes a desktop PDF folder and emits absolute machine-local paths

**Severity:** High
**Type:** Attachment/path reconstruction assumption / portability blocker

**Evidence**

- `endnote_exporter.py:599-607` reconstructs PDF paths by joining `data_path / "PDF" / file_path`.
- `endnote_exporter.py:603` serializes each PDF as `str(full_pdf_path.resolve())`.
- `endnote_exporter.py:604-605` checks the resulting local path with `exists()`.
- `README.md:7` explicitly documents absolute PDF paths as a feature.
- `endnote_exporter.py:607` places those values under `urls["pdf-urls"]`.
- `endnote_exporter.py:813-816` writes them out into `<pdf-urls>` XML.

**Why this matters**

This logic makes sense for a same-machine desktop migration, but it bakes in several assumptions:

- attachments live under a `PDF/` folder beside the library database
- `file_res.file_path` can be joined directly into a safe local path
- the final XML should contain **absolute machine-local paths**

That assumption becomes weak or impossible in a browser-local environment.

**Browser-local impact**

A browser-local app cannot rely on persistent native absolute paths. At best it can know:

- the relative path of an attachment within a selected folder/archive
- the user-selected filename / handle
- a downloaded artifact URL or browser-managed blob URL

So attachment semantics need to be redefined. Current options might be:

- omit attachment paths in browser exports
- keep only **source-relative** attachment paths
- include an attachment manifest separate from the XML
- support an optional wrapper-specific local-path rewrite strategy in Electron/Tauri

**Opportunity**

Abstract attachment handling behind an explicit policy instead of hardcoding `Path.resolve()`.

**Open question**

What should a browser-local export promise for PDFs:

- absolute local paths (probably impossible in plain browser)
- relative paths inside the uploaded archive/folder
- no attachment links
- downloaded companion bundle / manifest

---

### 6. The exporter is more memory-heavy than it first appears, which matters more in WASM/browser runtimes

**Severity:** Medium-High
**Type:** Performance / memory / browser-WASM risk

**Evidence**

- `endnote_exporter.py:246` and `250` call `fetchall()` for both main refs and attachment mappings.
- `endnote_exporter.py:260` creates one in-memory XML root for the whole export.
- `endnote_exporter.py:304-318` re-serializes the whole XML tree one or more times during pretty-print and fallback paths.
- `endnote_exporter.py:264-302` also emits per-record comparison JSON during the same export run.

**Why this matters**

On desktop CPython, this is often acceptable. In browser/WASM environments, however:

- memory ceilings are tighter and more user-visible
- copies between JS/WASM/Python heaps can be expensive
- long-running work on the main thread harms responsiveness

**External validation**

- Pyodide’s docs recommend using a Web Worker for long-running computation because WebAssembly on the main thread can make the UI non-responsive: <https://pyodide.org/en/stable/usage/index.html>
- `sql.js` explicitly positions browser SQLite as an in-memory virtual DB unless other persistence tooling is added: <https://github.com/sql-js/sql.js>

**Browser-local impact**

Even if the port is technically feasible, large libraries may feel sluggish or unstable without:

- worker-based execution
- incremental progress reporting
- a more streaming-friendly export algorithm

**Opportunity**

Treat this as a future portability refactor target even if the first browser-local prototype keeps the existing structure.

---

### 7. Current diagnostics and side effects assume writable disk and shared process-global state

**Severity:** Medium
**Type:** Logging / side-effect coupling / browser-local friction

**Evidence**

- `endnote_exporter.py:25-28` creates a log directory and log file on module import.
- `endnote_exporter.py:46` declares a shared `comparisons.jsonl` location.
- `endnote_exporter.py:264` appends comparisons to that file on every export.
- `gui.py:13-17` defines a **different** log directory than the core exporter.
- `gui.py:130` reads warnings/errors from the GUI-selected log location.

**Why this matters**

A browser-local runtime normally does not have a writable application directory in the desktop sense, and it certainly should not rely on one for core success semantics.

The current diagnostic flow also reinforces that the exporter is not yet a pure function. It has ambient side effects that would have to be:

- removed
- redirected to in-memory logs
- or adapted to browser storage/downloaded debug artifacts

**Opportunity**

Make comparison output opt-in debug data, not part of the default export side effects.

---

### 8. Single-file HTML distribution is much harder than the current desktop “single executable” story

**Severity:** Medium-High
**Type:** Distribution / bundle-size / runtime packaging risk

**Evidence from the repo**

- `README.md:8` promises a packaged **single executable file**.
- `.github/workflows/release.yml:47` builds Windows/Linux as `pyinstaller --onefile`.
- `.github/workflows/release.yml:54` builds macOS as a `--onedir` app bundle.

**External validation**

- `showDirectoryPicker()` is secure-context-only and not available in Firefox/Safari per MDN: <https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker>
- Pyodide requires loading `pyodide.js`, and its docs explicitly suggest Web Workers for browser use; its FAQ also notes that direct local `file:///...` loading is blocked by browser security rules: <https://pyodide.org/en/stable/usage/index.html>, <https://pyodide.org/en/stable/usage/faq.html>
- `sql.js` requires shipping a JS loader **plus** a separate `.wasm` file by default: <https://github.com/sql-js/sql.js>
- SQLite’s official WASM persistence docs note that OPFS support is worker-oriented, may require COOP/COEP headers for some VFS modes, and carries Safari/version/concurrency caveats: <https://sqlite.org/wasm/doc/trunk/persistence.md>

**Why this matters**

A true “open one local HTML file and it just works” distribution becomes fragile when the app needs:

- browser file/directory APIs
- JS + WASM runtime assets
- worker scripts
- optional OPFS persistence
- possibly special HTTP headers for the more capable SQLite WASM persistence modes

That does **not** make browser-local impossible. It does mean the single-file HTML story is much rougher than the current PyInstaller story.

**Browser-local impact**

A single-file HTML distribution is likely the **highest-friction** option if the goal includes:

- direct folder selection
- robust cross-browser support
- SQLite/WASM persistence
- worker-based processing

A small static site or wrapper app is probably easier.

**Opportunity**

Keep option ranking realistic:

1. **Static web app (multi-file) over HTTPS / localhost**
2. **Browser + WASM with worker(s)**
3. **Wrapper app (Electron/Tauri)** if path fidelity and local-file semantics matter
4. **Single-file HTML** only if scope is deliberately narrow and browser support expectations are relaxed

**Open question**

Is “single-file HTML” a hard requirement, or merely a desirable distribution ideal?

---

### 9. Wrapper-based local distribution may dodge browser API pain, but the repo is not wrapper-ready yet

**Severity:** Medium
**Type:** Wrapper feasibility / architectural opportunity

**Evidence**

- The repo already assumes local execution and local files (`gui.py`, `platform_utils.py`, `endnote_exporter.py` broadly).
- The current product story is “download a local executable” (`README.md:8`, `.github/workflows/release.yml:47`, `54`).

**Why this matters**

An Electron or Tauri wrapper could solve several plain-browser constraints:

- richer local file/directory access
- better control over output file saving
- more plausible attachment-path rewriting
- less dependence on experimental browser folder-selection APIs

But it would **not** automatically solve the deeper core debt:

- the exporter is still Python-first
- no JS-facing conversion boundary exists yet
- attachment policy is still underspecified outside same-machine desktop usage

**Opportunity**

If plain browser delivery proves too constrained, wrapper-based local distribution is a practical fallback **provided the core is first refactored into a runtime-neutral conversion API**.

---

### 10. There is no executable parity test suite guarding a browser/WASM rewrite path

**Severity:** Medium
**Type:** Validation debt / migration risk

**Evidence**

- No first-party tests were found under `/home/sam/dev/endnote-exporter/tests/**/*.py`.
- No first-party tests were found under `/home/sam/dev/endnote-exporter/testing/**/*.py`.
- The visible `testing/` asset is `testing/RefsEnschede.enlp.zip`, which is a fixture-like artifact, not a test harness.

**Why this matters**

For browser-local work, the riskiest parts are exactly the parts that most need parity tests:

- `.enlp` resolution
- archive normalization
- attachment-path rewriting
- XML output equivalence
- behavior on malformed/missing files

Without that, every browser/WASM iteration will carry avoidable regression risk.

**Opportunity**

Before implementation work, capture a few golden-path fixtures and expected XML outputs so the browser track has something objective to match.

## Issues summary

The most important technical-debt items for browser-local execution are:

1. **Runtime coupling:** exporter logic still assumes CPython + local filesystem + Tkinter-era I/O.
2. **SQLite coupling:** reads a real SQLite file from disk and performs whole-result / whole-XML in-memory processing.
3. **Input-shape debt:** `.enlp` support is partial; zipped inputs remain unsupported in runtime code.
4. **Attachment semantics debt:** absolute local PDF paths are hardcoded into the export behavior.
5. **Distribution mismatch:** the current “single executable” story does not translate cleanly to single-file HTML or browser WASM.
6. **Validation gap:** there is no executable parity test suite for a rewrite or port.

## Opportunities

### Near-term research and design opportunities

- Define a canonical **normalized library input** independent of OS paths.
- Decide whether browser-local intake should be **zip-first**.
- Decide attachment policy early: omit, relative, manifest, or wrapper-specific rewrite.
- Validate whether real-world EndNote libraries ever require WAL/journal handling.
- Capture a handful of golden fixture exports before any porting begins.

### Medium-term architecture opportunities

- Split exporter logic from runtime I/O, logging, and desktop path conventions.
- Replace ambient file writes with an explicit export result object.
- Make attachment handling a strategy, not a hardcoded absolute-path behavior.
- Consider a more streaming-friendly export path for large libraries.

### Product / distribution opportunities

- Prefer a **multi-file static web app** over a “single local HTML file” claim for the first browser-local prototype.
- Keep **Electron/Tauri** as fallback options if plain browser APIs prove too limiting.
- Treat raw folder selection as progressive enhancement; keep `.zip` as the most portable input shape.

## Open questions

1. Is the browser-local MVP allowed to require `.zip` input, or must it support raw folder selection from day one?
2. Are EndNote `sdb.eni` databases always self-contained SQLite files, or do WAL/journal sidecars matter in the wild?
3. What attachment behavior is actually required for Zotero import in a browser-local workflow?
4. Is “single-file HTML” a hard requirement, or would “works locally from a small static web app” satisfy the goal?
5. How large do real user libraries get in practice, especially with PDFs attached?
6. If plain browser support is constrained, is a wrapper app an acceptable fallback while preserving the privacy/local-execution goal?
7. Should parity with desktop XML output be exact, or is a browser-local variant allowed to intentionally differ on attachment-path fields?

## Bottom line

The repo already contains the domain knowledge needed for conversion, but **not yet in a browser-portable shape**. The biggest browser-local risks are:

- direct CPython `sqlite3` + real-filesystem assumptions
- partial/non-archive-shaped input handling
- absolute local attachment paths
- whole-export in-memory processing
- distribution expectations that are much easier in PyInstaller than in single-file HTML/WASM

A browser-local implementation is still plausible, but it will need a deliberate input-normalization layer, a new SQLite/browser runtime strategy, and an explicit attachment policy before implementation begins.
