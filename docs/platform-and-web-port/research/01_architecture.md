# Architecture Research Report

Date: 2026-03-18
Repository: `/home/sam/dev/endnote-exporter`

## Scope

Research only. No application code was modified.

This report analyzes the current repository architecture for a two-fold planning initiative:

- **Goal A:** cross-platform desktop correctness and build/distribution strategy for Windows 10/11, macOS Intel, macOS Apple Silicon, and optional Linux
- **Goal B:** hosted web-based port for uploading EndNote library folders / `.zip` / `.enlp` and returning Zotero-compatible XML

Primary sources reviewed:

- `/home/sam/dev/endnote-exporter/endnote_exporter.py`
- `/home/sam/dev/endnote-exporter/gui.py`
- `/home/sam/dev/endnote-exporter/platform_utils.py`
- `/home/sam/dev/endnote-exporter/pyproject.toml`
- `/home/sam/dev/endnote-exporter/README.md`
- `/home/sam/dev/endnote-exporter/.github/workflows/release.yml`
- Supporting repo context in:
  - `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/00_setup.md`
  - `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/06_documentation.md`
  - `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/07_issues_debt.md`

---

## Executive summary

The current codebase is a **small desktop-first Python application** with a clear but uneven split:

- `endnote_exporter.py` contains the **reusable export core**, but it also mixes in logging setup, local filesystem assumptions, `.enlp` path resolution, XML rendering, and comparison tooling.
- `gui.py` is a thin **Tkinter desktop shell** around local file selection, local output saving, and dialog-based status reporting.
- `platform_utils.py` provides **cross-platform helpers**, mainly around Documents folder detection and `.Data` folder lookup.
- `.github/workflows/release.yml` implements a **PyInstaller-based release matrix** for Windows/macOS/Linux, with macOS packaged as Universal2.

For the two goals:

1. **Goal A is feasible without a rewrite**, because the app is already small, uses `pathlib`, and has an existing multi-OS build workflow.
2. **Goal B is blocked by local-disk assumptions more than by XML logic**. The XML transformation itself is reusable, but the current export pipeline assumes:
   - local filesystem access
   - local SQLite reads
   - local output paths
   - native dialogs
   - absolute local PDF paths in generated XML
3. The most important architectural move before or during Goal B would be to extract a **pure export service boundary** that takes an already-prepared library bundle and returns structured results, without owning GUI, logging bootstrap, or disk policy.

---

## Repository structure and responsibilities

### Top-level structure

Current repo shape:

- `/home/sam/dev/endnote-exporter/endnote_exporter.py` — main exporter logic and XML comparison tooling
- `/home/sam/dev/endnote-exporter/gui.py` — Tkinter desktop UI
- `/home/sam/dev/endnote-exporter/platform_utils.py` — platform/path helpers
- `/home/sam/dev/endnote-exporter/pyproject.toml` — Python/package metadata and dependencies
- `/home/sam/dev/endnote-exporter/README.md` — user/developer-facing docs
- `/home/sam/dev/endnote-exporter/.github/workflows/release.yml` — release automation
- `/home/sam/dev/endnote-exporter/testing/RefsEnschede.enlp.zip` — sample archive artifact, not executable tests

### Module responsibility map

| File | Primary responsibility | Reuse value for Goal B | Notes |
|---|---|---:|---|
| `endnote_exporter.py` | Export orchestration, DB reads, record mapping, XML generation, comparison tooling | High for transformation logic; low-to-medium as-is | Core reusable logic exists, but mixed responsibilities make direct reuse awkward |
| `gui.py` | Desktop-only Tkinter UI and file dialogs | Low | Pure desktop shell |
| `platform_utils.py` | Documents folder discovery, path validation, `.Data` lookup | Medium | Some helpers are desktop-specific, some are broadly useful |
| `pyproject.toml` | Package metadata/deps | Low | Useful for environment constraints only |
| `README.md` | Product/support docs | Low | Useful for support and expectation alignment |
| `.github/workflows/release.yml` | Packaging/release matrix | Low for Goal B; high for Goal A | Strongly desktop distribution-specific |

---

## Current architecture: how the app actually works

### End-to-end desktop flow

The desktop flow is straightforward:

1. `gui.py` starts `ExporterApp` (`gui.py:20`)
2. User selects a local `.enl` or `.enlp` file via `filedialog.askopenfilename()` (`gui.py:59`)
3. User chooses a local XML output path via `filedialog.asksaveasfilename()` (`gui.py:110`)
4. GUI calls `export_references_to_xml()` from the core (`gui.py:133`, `endnote_exporter.py:923-925`)
5. `EndnoteExporter.export_references_to_xml()` validates extensions (`endnote_exporter.py:182-200`)
6. `_export()` resolves the library/data location, opens the local SQLite DB, reads refs + file attachments, builds a record dict per ref, serializes XML, writes a local output file, and appends comparison logs (`endnote_exporter.py:204-360`)
7. GUI shows success or warning/error dialogs (`gui.py:140`, `gui.py:153`)

### Internal responsibility split inside `endnote_exporter.py`

`endnote_exporter.py` is the center of gravity.

Key areas:

- **Runtime/log bootstrap**: `endnote_exporter.py:13-46`
- **Input/package resolution**: `_resolve_enl_path()` at `endnote_exporter.py:142-177`
- **Public export entrypoint**: `EndnoteExporter.export_references_to_xml()` at `endnote_exporter.py:182`
- **Export orchestration**: `_export()` at `endnote_exporter.py:204`
- **Record transformation**: `_build_record_dict()` at `endnote_exporter.py:367`
- **XML serialization**: `_dict_to_xml()` at `endnote_exporter.py:659`
- **Comparison/test utility**: `XMLComparator` at `endnote_exporter.py:928`

This means the repo already has a latent architecture split, but it is **all collapsed into one file**.

---

## Reusable parts vs GUI / packaging-specific parts

### Strongest reusable pieces for a future web port

These are the best candidates for reuse in Goal B.

#### 1. Record transformation logic

`EndnoteExporter._build_record_dict()` (`endnote_exporter.py:367+`) is the clearest reusable unit. It:

- maps database rows to export fields
- normalizes timestamps
- maps reference types
- preserves notes/date metadata
- builds URLs, keywords, and optional fields

This logic is mostly independent of Tkinter and mostly independent of packaging.

#### 2. XML serialization logic

`EndnoteExporter._dict_to_xml()` (`endnote_exporter.py:659+`) plus helpers like `create_xml_element()` and `safe_str()` (`endnote_exporter.py:872+`, `endnote_exporter.py:903+`) are reusable for both desktop and web because they transform structured data into XML and sanitize text.

#### 3. SQLite extraction pattern

The query/orchestration in `_export()` is reusable at the concept level:

- `SELECT * FROM refs WHERE trash_state = 0` (`endnote_exporter.py:245`)
- `SELECT refs_id, file_path FROM file_res` (`endnote_exporter.py:249`)

A future web service would still need these queries or their equivalent, assuming the uploaded library format remains the same.

#### 4. `.Data` folder case-insensitive lookup

`find_data_folder()` in `platform_utils.py:31-55` is reusable anywhere a prepared library bundle exists on disk and case sensitivity matters.

### Mostly desktop-specific or packaging-specific pieces

#### 1. Tkinter GUI

Everything in `gui.py` is desktop-specific:

- main app lifecycle: `gui.py:20`
- local file selection: `gui.py:59`
- local save path selection: `gui.py:110`
- message boxes / interactive UI state: `gui.py:105`, `gui.py:140`, `gui.py:153`

This should not be reused for a web port.

#### 2. Documents folder discovery

`get_documents_folder()` and `get_endnote_default_directory()` (`platform_utils.py:58-159`) are useful for desktop UX, but they are largely irrelevant for a hosted service where uploads arrive via HTTP or object storage.

#### 3. Frozen/PyInstaller runtime assumptions

- `endnote_exporter.py:18-28` computes log directories based on whether the app is frozen
- `gui.py:10-17` separately computes a GUI log directory based on frozen vs source run
- `.github/workflows/release.yml` is entirely about packaged desktop artifacts

These are Goal A concerns, not Goal B concerns.

#### 4. XML comparison utility

`XMLComparator` (`endnote_exporter.py:928+`) is valuable for regression testing and parity verification, but it is not part of the end-user export path.

For Goal B, it is better treated as **test/support tooling** than runtime service logic.

---

## Architectural constraints relevant to both goals

### 1. Filesystem access is currently a hard dependency

The current exporter requires a local, readable EndNote library on disk.

Concrete anchors:

- local file chosen in GUI: `gui.py:59-66`
- SQLite DB opened directly from local path: `endnote_exporter.py:242`
- output XML written to local path: `endnote_exporter.py:352-353`
- comparison logs appended to local file: `endnote_exporter.py:264`

#### Implication for Goal A

Desktop packaging must preserve reliable local filesystem access semantics across Windows/macOS/Linux.

#### Implication for Goal B

The web port cannot use the current contract directly. It needs an adapter layer that:

- stages uploads into a controlled working directory or object-backed temporary filesystem
- locates the EndNote DB inside that staged bundle
- returns XML as a downloadable response or blob reference instead of writing to arbitrary local output paths

### 2. There is no temp-directory or archive-extraction pipeline yet

Important finding: the repo contains a sample archive at `/home/sam/dev/endnote-exporter/testing/RefsEnschede.enlp.zip`, but code search found **no first-party archive extraction support** (`zipfile`, explicit unpacking, staged temp workspace management).

#### Implication

Goal B’s proposed inputs—folder upload / `.zip` / `.enlp`—are **not already supported by infrastructure in code**. `.enlp` is only supported when it exists as an already-accessible package directory.

### 3. `.enlp` handling assumes unpacked directory access

`.enlp` support exists, but it is optimistic and directory-based.

Key anchors:

- `_resolve_enl_path()` in `endnote_exporter.py:142-177`
- `_export()` re-derives `.enlp` library naming logic in `endnote_exporter.py:205-212`

Observed behavior:

- If input suffix is `.enlp`, code scans the package directory for `*.enl`
- If it finds one, it derives the library name from that file
- Otherwise it falls back to the first `*.Data` folder found
- “First match wins” is used in both cases

#### Constraint

This is good enough for a well-formed local macOS package, but it is not yet a robust generalized input normalization pipeline.

### 4. Absolute PDF path generation is a major portability constraint

The app intentionally emits absolute PDF paths.

Anchors:

- documented behavior: `README.md:7`
- implementation: `endnote_exporter.py:599-607`
- specific path resolution: `endnote_exporter.py:603`

This is a core architectural constraint because attachment handling is part of the export result.

#### Desktop meaning

Absolute paths make sense when Zotero import happens on the same machine that owns the EndNote library.

#### Hosted-web meaning

Absolute server-side paths are either:

- useless to the user
- a potential information leak
- or a sign that attachment handling needs a different contract entirely

This is one of the sharpest seams between Goal A and Goal B.

### 5. Logging/output path policy is inconsistent across modules

The core and GUI do not agree on log location.

Anchors:

- core log dir setup: `endnote_exporter.py:18-28`
- comparison log file: `endnote_exporter.py:46`
- GUI log dir setup: `gui.py:10-17`
- GUI reads log file at: `gui.py:130`

This matters because a frozen desktop app and a future web service both need deterministic runtime-path behavior, but the current architecture embeds different path policies in two places.

### 6. Broad error handling allows partial exports

The exporter catches broad exceptions inside the main export loop and continues.

Anchors:

- record build/compare/XML write exception handling: `endnote_exporter.py:279-302`
- fallback XML generation chain: `endnote_exporter.py:307-348`
- GUI boundary catch: `gui.py:152-154`

This is not inherently wrong, but it affects product semantics.

#### Goal A implication

Desktop success reporting should be precise when records are skipped.

#### Goal B implication

A hosted service likely needs structured job results such as:

- total records
- exported records
- skipped records
- warnings
- attachment-policy result

---

## Goal A: desktop correctness + build/distribution findings

### Current strengths

#### 1. Existing cross-platform helpers are a good baseline

`platform_utils.py` already handles:

- case-insensitive `.Data` lookup: `platform_utils.py:31`
- Windows Documents detection via `SHGetFolderPathW`: `platform_utils.py:102`
- Linux XDG documents lookup: `platform_utils.py:123`
- fallback EndNote directory selection: `platform_utils.py:153`

This is a solid foundation for desktop correctness.

#### 2. Release automation already builds a 3-OS matrix

The workflow builds on:

- Windows: `.github/workflows/release.yml:16`
- macOS: `.github/workflows/release.yml:16`
- Linux: `.github/workflows/release.yml:16`

It also builds macOS as a Universal2 app:

- step declaration: `.github/workflows/release.yml:49`
- PyInstaller command: `.github/workflows/release.yml:54`

#### 3. README product positioning aligns with Goal A

The repo claims support for:

- Windows 10/11: `README.md:14`
- macOS 12+: `README.md:15`
- Linux: `README.md:16`

### Current weaknesses / risks

#### 1. Build pipeline is distribution-oriented, not verification-oriented

The release workflow packages artifacts but does **not** perform post-build smoke tests.

Anchors:

- dependency install: `.github/workflows/release.yml:29-30`
- build steps: `.github/workflows/release.yml:44-54`
- no artifact launch/import sanity step afterward

#### 2. macOS distribution remains unsigned / unnotarized

The workflow includes user-facing Gatekeeper-bypass guidance rather than signing/notarization.

Relevant lines:

- build/package app: `.github/workflows/release.yml:49-61`
- release note guidance for Gatekeeper bypass: body text after `.github/workflows/release.yml:67`

For Goal A, this means the current strategy is functional but not polished or enterprise-friendly.

#### 3. Runtime path behavior differs in frozen vs source mode

Because log/output-related logic is split and frozen-aware in multiple places, packaged behavior is not fully represented by local source runs.

That increases the value of actual packaged smoke testing on each OS.

#### 4. Linux support policy is slightly ambiguous

`README.md` says Linux is fully supported (`README.md:16`), while the new initiative frames Linux as optional/best-effort in `00_setup.md`.

That is more a planning/support-policy issue than a code bug, but it matters for Goal A scope.

---

## Goal B: hosted web-port findings

### What is already reusable

The future hosted service can likely reuse:

- the mapping rules in `_build_record_dict()` (`endnote_exporter.py:367+`)
- XML generation in `_dict_to_xml()` (`endnote_exporter.py:659+`)
- sanitization helpers (`endnote_exporter.py:872+`, `903+`)
- perhaps query definitions in `_export()` (`endnote_exporter.py:245`, `249`)

### What is not reusable as-is

The following pieces must be replaced, isolated, or wrapped:

- local file dialogs (`gui.py:59`, `110`)
- local path output contract (`endnote_exporter.py:215-219`, `352-353`)
- absolute PDF path policy (`endnote_exporter.py:603`)
- runtime log file policy (`endnote_exporter.py:18-46`, `gui.py:10-17`)
- direct assumption that input is already a local unpacked library structure (`endnote_exporter.py:204-237`)

### Architectural blocker ranking for Goal B

#### Highest blocker: local filesystem contract

The current exporter is not “pure conversion logic”; it is “local library on disk -> local XML on disk.”

#### Second-highest blocker: attachment/path semantics

A hosted product cannot blindly emit absolute server filesystem paths.

#### Third-highest blocker: missing upload normalization pipeline

No archive extraction, no temp-workspace lifecycle, no canonical uploaded-library model.

#### Fourth blocker: coarse result model

The current return shape is effectively `(count, output_path)` (`endnote_exporter.py:359-361`) rather than a structured export report suitable for APIs/jobs.

---

## Refactoring seams likely needed before or during Goal B

These are the most natural seams in the current design.

### Seam 1: input normalization / library staging boundary

**Current state**
Spread across `.enlp` path resolution, file extension validation, direct DB-path assembly, and assumptions that files already exist locally.

Relevant anchors:

- `platform_utils.py:161` — file extension validation helper
- `endnote_exporter.py:142-177` — `.enlp` resolution
- `endnote_exporter.py:222-237` — `.Data` / DB path derivation

**Likely extracted responsibility**
A component that turns one of these inputs:

- `.enl` + sibling `.Data`
- unpacked `.enlp`
- uploaded `.zip`
- uploaded folder bundle

into one canonical prepared library workspace with:

- normalized root path
- canonical library name
- data folder path
- database path
- attachment base path

### Seam 2: pure export service boundary

**Current state**
`_export()` both orchestrates I/O and drives transformation.

Relevant anchors:

- `endnote_exporter.py:204-360`

**Likely extracted responsibility**
A service/function that accepts a prepared library context and returns a structured in-memory export result, for example:

- records exported
- warnings/skips
- XML bytes/string
- attachment references

without deciding where files are read from or written to.

### Seam 3: attachment-reference strategy

**Current state**
Attachment URLs are always absolute local resolved file paths.

Relevant anchors:

- `README.md:7`
- `endnote_exporter.py:599-607`

**Likely extracted responsibility**
A strategy layer controlling how attachments are represented:

- desktop absolute path
- relative path
- omitted
- hosted URL
- exported manifest entry

This seam is probably mandatory for Goal B.

### Seam 4: runtime/config/log path policy

**Current state**
The app computes runtime paths independently in multiple places.

Relevant anchors:

- `endnote_exporter.py:18-46`
- `gui.py:10-17`
- `platform_utils.py:7-29`

**Likely extracted responsibility**
One runtime-environment/config object for:

- log destination
- comparison-log behavior
- temp directory
- source vs frozen behavior
- output strategy

### Seam 5: UI / API adapters over shared service

**Current state**
There is only a Tkinter adapter.

Relevant anchors:

- `gui.py:20+`
- no CLI or service entrypoint in `pyproject.toml`

**Likely extracted responsibility**
Separate adapters:

- desktop GUI adapter
- CLI adapter
- HTTP/web-job adapter

all calling the same export service.

---

## Potential issues

### 1. `endnote_exporter.py` is multi-responsibility and high-risk to change

Because one file holds runtime config, input resolution, export orchestration, transformation, XML rendering, and comparison tooling, even good refactors can create accidental regressions.

### 2. `.enlp` resolution logic is duplicated

There is one helper for `.enlp` resolution (`endnote_exporter.py:142-177`) and then duplicated/parallel logic in `_export()` (`endnote_exporter.py:205-212`).

That creates drift risk.

### 3. Archive support is implied by planning, not implemented in code

The existence of `testing/RefsEnschede.enlp.zip` suggests zipped inputs are part of the problem space, but the codebase does not yet own that workflow.

### 4. Success reporting may overstate completeness

The exporter loops over all refs and can skip records on error, but logs/returns success at the whole-export level (`endnote_exporter.py:279-302`, `359-361`).

### 5. Packaging and runtime concerns are entangled with core logic

This mostly affects maintainability and testability, but it becomes especially important if the same transformation logic must serve both desktop and hosted web flows.

---

## Improvement opportunities

### Near-term improvements with strong planning value

1. **Define a canonical “prepared library” model**
   - root path
   - library name
   - `.Data` path
   - DB path
   - PDF base path
   - source/input type (`.enl`, `.enlp`, `.zip`, uploaded folder)

2. **Define a structured export result model**
   - total refs
   - exported refs
   - skipped refs
   - warning list
   - XML content
   - attachment summary

3. **Separate attachment-policy decisions from record mapping**
   - especially before Goal B design work goes deeper

4. **Introduce a non-GUI entrypoint in planning**
   - even if implementation happens later, the architecture should plan around a CLI/service boundary rather than GUI-first orchestration

5. **Unify runtime path/log policy**
   - this helps Goal A packaging quality and Goal B service observability

### Goal A-specific opportunities

1. Add packaged smoke tests to the release workflow
2. Clarify support policy for Linux
3. Decide between continuing unsigned binaries vs signed/notarized macOS distribution
4. Document artifact strategy: Universal2 only vs split Intel/ARM artifacts

### Goal B-specific opportunities

1. Add explicit archive extraction and temp-workspace lifecycle to the design
2. Define attachment behavior for hosted exports before UX/API design proceeds
3. Treat uploaded libraries as untrusted input and design isolation/cleanup accordingly
4. Reuse XML mapping/serialization logic, but only behind a cleaner service API

---

## Open questions

1. **Input support policy:** Should the future web port accept raw folder uploads, only archives, or both?
2. **Archive policy:** Is `.enlp.zip` an officially supported input for desktop, web, or both?
3. **Attachment policy:** In Goal B, should PDFs be omitted, preserved as downloadable assets, rewritten as hosted URLs, or bundled separately?
4. **Privacy/security policy:** How long may uploaded libraries and PDFs live on the server, if at all?
5. **Result semantics:** Should partial exports be acceptable, and if so, how should warnings/skipped records be reported to users or API clients?
6. **Cross-platform support bar:** Is Linux truly first-class for packaged distribution, or optional/best-effort?
7. **macOS distribution target:** Is unsigned distribution still acceptable, or is Developer ID signing/notarization required?
8. **Service shape for Goal B:** Is the intended web port synchronous for small uploads, asynchronous job-based, or both?

---

## Code examples

### Example 1: desktop GUI directly drives local file I/O

Source:
- `gui.py:59`
- `gui.py:110`
- `gui.py:133`

```python
file_path = filedialog.askopenfilename(...)
...
output_path_str = filedialog.asksaveasfilename(...)
...
count = export_references_to_xml(self.enl_file, output_file)
```

Why it matters:
- Good for desktop UX
- Not reusable for a hosted web port

### Example 2: core exporter opens SQLite directly from local library structure

Source:
- `endnote_exporter.py:222-242`

```python
data_path = find_data_folder(base_path, library_name)
...
db_path = data_path / "sdb" / "sdb.eni"
...
con = sqlite3.connect(db_path)
```

Why it matters:
- Reusable logic exists
- But only after some other layer has normalized/staged the input on disk

### Example 3: attachment references are serialized as absolute local paths

Source:
- `endnote_exporter.py:599-607`

```python
pdf_folder_path = data_path / "PDF"
for file_path in file_mapping[ref.get("id")]:
    full_pdf_path: Path = pdf_folder_path / file_path
    pdf_urls.append(str(full_pdf_path.resolve()))
```

Why it matters:
- This behavior is intentional and useful on desktop
- It is the wrong default for a hosted service

### Example 4: `.enlp` support is present but optimized for local package directories

Source:
- `endnote_exporter.py:142-177`

```python
if suffix == ".enlp":
    package_dir = enl_file_path
    enl_files = list(package_dir.glob("*.enl"))
    if enl_files:
        actual_enl = enl_files[0]
        library_name = actual_enl.stem
        data_path = package_dir / f"{library_name}.Data"
        return package_dir, data_path
```

Why it matters:
- Good local macOS package support
- Not equivalent to archive ingestion or robust uploaded-bundle normalization

---

## Bottom line

### Strongest architecture findings

1. **The transformation heart of the app is reusable**, especially record mapping and XML generation in `endnote_exporter.py`.
2. **The current export contract is desktop-local, not service-oriented**: local file picker in, local XML file out.
3. **Absolute PDF paths are the sharpest product/architecture mismatch between desktop and hosted use cases.**
4. **There is no existing temp/extraction/upload normalization layer**, so Goal B needs more than a frontend; it needs a new ingestion pipeline.
5. **Goal A can build on the existing release matrix and platform helpers**, but artifact verification, log-path consistency, and macOS distribution polish remain important gaps.

In short: the codebase already contains a promising export engine, but it still needs a clearer service boundary and input/attachment policy split before it can comfortably power both a polished desktop app and a hosted web product.
