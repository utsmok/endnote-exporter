# Component Research Report

Date: 2026-03-18
Repository: `/home/sam/dev/endnote-exporter`

## Scope

Research only. This report maps the current components relevant to both:

- **desktop hardening** of the existing Tkinter/PyInstaller application, and
- a potential **backend/web-service port** that reuses as much exporter logic as practical.

The focus is on:

1. source files related to export logic, GUI, platform handling, packaging/build, and tests
2. dependencies among these components
3. existing and implicit interfaces/contracts
4. the current end-to-end user flow for exporting a selected EndNote library
5. seams where the current desktop-first design would need splitting or wrapping for a backend/web service

## Executive summary

The current application has three runtime code components and two release/distribution components:

1. **GUI shell** — `gui.py`
2. **Export engine** — `endnote_exporter.py`
3. **Platform/path helpers** — `platform_utils.py`
4. **Packaging metadata** — `pyproject.toml`
5. **Release automation** — `.github/workflows/release.yml`

The strongest current boundary is:

- `gui.py` handles **user interaction and desktop dialogs**
- `endnote_exporter.py` handles **library reading, record mapping, and XML generation**
- `platform_utils.py` handles **platform-aware path resolution and extension validation**

However, `endnote_exporter.py` is still a **thick module** that mixes several concerns:

- runtime logging setup
- `.enl` / `.enlp` path resolution
- SQLite access
- record transformation rules
- XML serialization
- comparison/debug tooling

That means the codebase already contains a reusable export core, but it is not yet isolated as a clean service boundary. For a web/backend port, the most important split would be to separate:

- **pure export/transformation logic**
from
- **desktop filesystem/UI/runtime concerns**

## File inventory

### Core export logic

- `/home/sam/dev/endnote-exporter/endnote_exporter.py`
  - main exporter class: `EndnoteExporter` (`endnote_exporter.py:181`)
  - compatibility wrapper: `export_references_to_xml(...)` (`endnote_exporter.py:923`)
  - comparison/debug helper: `XMLComparator` (`endnote_exporter.py:928`)
  - XML helper functions and timestamp/string normalization helpers (`endnote_exporter.py:864`, `883`, `904`)

### GUI / desktop interaction

- `/home/sam/dev/endnote-exporter/gui.py`
  - main UI class: `ExporterApp` (`gui.py:20`)
  - file-selection flow: `select_file()` (`gui.py:54`)
  - export execution flow: `run_export()` (`gui.py:80`)
  - desktop entrypoint: `if __name__ == "__main__":` (`gui.py:169`)

### Platform handling / path helpers

- `/home/sam/dev/endnote-exporter/platform_utils.py`
  - `.Data` folder lookup: `find_data_folder(...)` (`platform_utils.py:31`)
  - documents-folder detection: `get_documents_folder()` (`platform_utils.py:58`)
  - Windows documents-folder API wrapper: `_get_windows_documents_folder()` (`platform_utils.py:102`)
  - XDG/Linux documents-folder lookup: `_get_xdg_documents_folder()` (`platform_utils.py:123`)
  - EndNote default directory lookup: `get_endnote_default_directory()` (`platform_utils.py:153`)
  - extension validation: `validate_file_extension(...)` (`platform_utils.py:161`)
  - path helpers currently defined but not clearly integrated into runtime flow: `get_application_path()`, `normalize_path()`, `is_valid_path()` (`platform_utils.py:7`, `14`, `22`)

### Packaging / build / release

- `/home/sam/dev/endnote-exporter/pyproject.toml`
  - project metadata and runtime dependencies (`pyproject.toml:1-16`)
- `/home/sam/dev/endnote-exporter/.github/workflows/release.yml`
  - cross-platform release workflow (`release.yml:1-86`)
- `/home/sam/dev/endnote-exporter/README.md`
  - product/runtime behavior and developer instructions (`README.md:1-49`)
- `/home/sam/dev/endnote-exporter/CLAUDE.md`
  - repository architecture summary and dev/build commands (`CLAUDE.md:1-59`)

### Tests / fixtures / validation artifacts

- `/home/sam/dev/endnote-exporter/testing/RefsEnschede.enlp.zip`
  - sample archive/fixture artifact; useful for manual validation and future test coverage
- No first-party executable test modules were found in the repository inventory outside generated directories (`.venv`, `.ruff_cache`, `.git`).
  - Notably absent: `tests/`, `testing/*.py`, `test_*.py`, or `*_test.py` files.
- There is an **in-code comparison utility** rather than a project test suite:
  - `XMLComparator` (`endnote_exporter.py:928`)
  - `compare_xml_files(...)` (`endnote_exporter.py:1266`)

## Current dependency map

### Runtime dependency graph

```text
GUI/Desktop
  gui.py
    ├─ imports export API from endnote_exporter.py
    ├─ imports default-directory helper from platform_utils.py
    ├─ depends on tkinter / ttk / native file dialogs
    └─ depends on local log file inspection for warning surfacing

Export engine
  endnote_exporter.py
    ├─ imports find_data_folder() from platform_utils.py
    ├─ imports validate_file_extension() from platform_utils.py
    ├─ depends on sqlite3 and EndNote on-disk DB layout
    ├─ depends on xml.etree + minidom for XML generation
    ├─ depends on pathlib for local filesystem access
    ├─ depends on loguru for runtime logging
    └─ writes XML + comparison JSONL to local disk

Platform utilities
  platform_utils.py
    ├─ depends on pathlib and sys
    ├─ conditionally depends on ctypes on Windows
    └─ depends on os/XDG environment on Linux
```

### Packaging / release dependency graph

```text
pyproject.toml
  ├─ declares Python >= 3.12
  ├─ declares loguru
  └─ declares pyinstaller

release.yml
  ├─ installs pyinstaller + loguru
  ├─ builds gui.py as the packaged entrypoint
  ├─ creates onefile builds for Windows/Linux
  ├─ creates a macOS Universal2 onedir app bundle
  └─ publishes artifacts to GitHub Releases
```

### Concrete import / call relationships

- `gui.py` imports the top-level export function from `endnote_exporter.py` (`gui.py:5`)
- `gui.py` imports `get_endnote_default_directory()` from `platform_utils.py` (`gui.py:7`)
- `gui.py` calls `get_endnote_default_directory()` during file selection (`gui.py:56`)
- `gui.py` calls `export_references_to_xml(self.enl_file, output_file)` to perform the export (`gui.py:133`)
- `endnote_exporter.py` imports `find_data_folder` and `validate_file_extension` from `platform_utils.py` (`endnote_exporter.py:14`)
- `endnote_exporter.py` validates the selected library and output extensions before running export (`endnote_exporter.py:188`, `195`)
- `endnote_exporter.py` calls `find_data_folder(...)` to discover the EndNote `.Data` directory (`endnote_exporter.py:222`)
- `release.yml` builds `gui.py` directly with PyInstaller (`release.yml:47`, `54`)

## Component boundaries

### 1. Desktop shell: `gui.py`

**Primary responsibility**

Provide a minimal desktop UX for:

- choosing an EndNote library (`.enl` or `.enlp`)
- choosing an XML output file path
- invoking the export engine
- showing success/error/warning dialogs

**Evidence**

- UI class starts at `gui.py:20`
- file open dialog at `gui.py:59`
- selected path becomes `self.enl_file` at `gui.py:69`
- save dialog at `gui.py:110`
- export call at `gui.py:133`
- warning dialog path at `gui.py:140-149`
- failure dialog at `gui.py:153`
- success state update at `gui.py:160-165`
- module entrypoint at `gui.py:169`

**Observations**

- This is a **thin adapter** over the exporter, which is good.
- But it still owns a small amount of execution policy, especially warning counting via local log-file inspection (`gui.py:81`, `131`, `134-149`).
- The UI contract is fully native-desktop: file dialogs in, file dialogs out.

**Desktop hardening relevance**

- important for platform-specific dialog behavior and end-user ergonomics
- packaged entrypoint used by PyInstaller

**Web-port relevance**

- should not be reused directly
- its responsibilities would need replacement by HTTP/API upload/download/job-status interfaces

### 2. Export engine: `endnote_exporter.py`

**Primary responsibility**

Translate an EndNote library on disk into a Zotero-compatible XML export.

**Sub-responsibilities currently co-located**

1. runtime logging configuration (`endnote_exporter.py:16-46`)
2. EndNote package/library path resolution (`endnote_exporter.py:142-177`)
3. export orchestration (`endnote_exporter.py:182-360`)
4. record mapping / field normalization (`endnote_exporter.py:367-657`)
5. XML serialization (`endnote_exporter.py:659-824`)
6. comparison/debug tooling (`endnote_exporter.py:826-1268`)

**Key entrypoints**

- class method `EndnoteExporter.export_references_to_xml(...)` (`endnote_exporter.py:182`)
- module-level compatibility wrapper `export_references_to_xml(...)` (`endnote_exporter.py:923`)

**Internal pipeline anchors**

- extension validation at `endnote_exporter.py:188-198`
- actual export begins in `_export(...)` (`endnote_exporter.py:204`)
- output path selection logic at `endnote_exporter.py:215`
- `.Data` folder lookup at `endnote_exporter.py:222`
- SQLite database path assembly at `endnote_exporter.py:232`
- SQLite connection at `endnote_exporter.py:242`
- record query at `endnote_exporter.py:245`
- attachment/file query at `endnote_exporter.py:249`
- per-record loop at `endnote_exporter.py:272`
- record transformation call at `endnote_exporter.py:276`
- XML emission call at `endnote_exporter.py:297`
- XML file write at `endnote_exporter.py:352`
- return tuple at `endnote_exporter.py:360`

**Desktop hardening relevance**

- this is the most critical runtime component
- all cross-platform file/path handling eventually funnels through here
- output correctness and logging behavior live here

**Web-port relevance**

- this is the most reusable component, but not in its current fully mixed form
- the best future backend boundary is hidden inside this module, not yet formalized as a clean service API

### 3. Platform adapter layer: `platform_utils.py`

**Primary responsibility**

Abstract a small set of platform-specific path/discovery behaviors.

**Concrete functions in use**

- `find_data_folder(...)` (`platform_utils.py:31`) — used by exporter
- `get_endnote_default_directory()` (`platform_utils.py:153`) — used by GUI
- `validate_file_extension(...)` (`platform_utils.py:161`) — used by exporter

**Platform-specific logic**

- documents folder detection begins at `platform_utils.py:58`
- Windows-specific SHGetFolderPath wrapper at `platform_utils.py:102`
- Linux/XDG-specific discovery at `platform_utils.py:123`

**Observations**

- This module is the clearest existing “adapter” layer in the codebase.
- It already expresses the right idea for desktop hardening: isolate OS-specific behavior.
- Only some of the available helpers are used at runtime; the abstraction is partial rather than complete.

**Desktop hardening relevance**

- high: it contains the path behaviors most likely to differ across Windows/macOS/Linux

**Web-port relevance**

- mixed: server-side processing still needs path helpers, but not user-Documents discovery
- `find_data_folder(...)` and extension validation remain relevant; desktop-only “default directory” logic does not

### 4. Packaging/release layer

#### `pyproject.toml`

**Primary responsibility**

Define runtime/tooling metadata.

**Evidence**

- Python floor `>=3.12` (`pyproject.toml:7`)
- runtime deps include `loguru` and `pyinstaller` (`pyproject.toml:8-11`)
- dev dependency group contains `ruff` (`pyproject.toml:14-16`)

#### `.github/workflows/release.yml`

**Primary responsibility**

Build and publish packaged desktop artifacts.

**Evidence**

- workflow starts at `release.yml:1`
- OS matrix at `release.yml:15-16`
- dependency installation at `release.yml:30`
- Windows/Linux PyInstaller build using `gui.py` at `release.yml:44-47`
- macOS Universal2 build using `gui.py` at `release.yml:49-54`
- release publication via `softprops/action-gh-release` at `release.yml:63-67`

**Desktop hardening relevance**

- very high: this is the shipping path
- confirms that **`gui.py` is the packaged runtime entrypoint**, not a CLI or service wrapper

**Web-port relevance**

- low direct reuse
- high architectural signal: there is currently **no non-GUI entrypoint being exercised in release automation**

### 5. Validation/testing assets

**What exists**

- `testing/RefsEnschede.enlp.zip` — fixture-like input artifact
- `XMLComparator` in `endnote_exporter.py` — manual/differential validation utility

**What does not exist**

- no first-party automated test module inventory in the repo outside generated directories
- no dedicated packaging smoke tests in the release workflow

**Implication**

- validation is currently closer to **manual/manual-assisted comparison** than executable regression coverage
- for a web/backend split, this matters because the export core has no isolated test harness yet

## Existing interfaces and contracts

The project has a mix of explicit and implicit contracts.

### Explicit contracts

#### A. Desktop-to-exporter call contract

**Interface**

- `export_references_to_xml(enl_file_path: Path, output_file: Path)` (`endnote_exporter.py:923`)
- wraps `EndnoteExporter.export_references_to_xml(...)` (`endnote_exporter.py:182`)

**Observed contract**

Inputs:
- `enl_file_path`: expected to be a local `Path` to `.enl` or `.enlp`
- `output_file`: local `Path` where XML should be written

Output:
- tuple of `(count, output_path)` where current implementation returns `len(all_refs), output_path` (`endnote_exporter.py:360`)

Failure mode:
- raises exceptions for invalid extension, missing `.Data`, missing DB, and other runtime failures

**Why it matters**

- This is the closest thing to a reusable application/service API that already exists.
- But it is still a **filesystem-in / filesystem-out** contract, not a transport-neutral export contract.

#### B. Platform utility contracts

- `find_data_folder(base_path: Path, library_name: str) -> Path | None` (`platform_utils.py:31`)
- `get_endnote_default_directory() -> Path` (`platform_utils.py:153`)
- `validate_file_extension(path: Path, expected: str | list[str]) -> bool` (`platform_utils.py:161`)

These are simple and already serviceable as internal contracts.

### Implicit contracts

#### A. EndNote library on-disk layout contract

The exporter assumes a library layout described in repo docs and encoded in the code:

- standard library: `<Library>.enl` + `<Library>.Data/`
- database path: `<Library>.Data/sdb/sdb.eni` (`endnote_exporter.py:232`)
- attachments under `<Library>.Data/PDF/` (used inside `_build_record_dict(...)`)

For `.enlp` packages, the code assumes:

- the selected `.enlp` path is a directory-like package
- package contains either a `*.enl` or a `*.Data` folder (`endnote_exporter.py:142-177`)

#### B. Database schema contract

The exporter relies on specific SQLite objects and columns:

- `SELECT * FROM refs WHERE trash_state = 0` (`endnote_exporter.py:245`)
- `SELECT refs_id, file_path FROM file_res` (`endnote_exporter.py:249`)

This implies a schema contract with at least:

- table `refs`
- column `trash_state`
- table `file_res`
- columns `refs_id`, `file_path`
- a long list of expected `refs` columns consumed in `_build_record_dict(...)`, such as:
  - `id`
  - `reference_type`
  - `year`
  - `title`
  - `secondary_title`
  - `author`
  - `keywords`
  - `url`
  - `notes`
  - various custom/accession/address/date fields

This is a critical backend-port dependency: a web service must preserve or emulate the same extracted schema.

#### C. Output-format contract

The exporter assumes a Zotero-compatible XML shape rooted like this:

- `<xml><records><record>...`
- record-building performed in `_dict_to_xml(...)` (`endnote_exporter.py:659`)
- XML element creation normalized through `create_xml_element(...)` (`endnote_exporter.py:864`)

There is also an implicit contract that certain fields are nested in specific ways:

- `ref-type` with numeric value + name attribute
- nested `dates`, `titles`, `contributors`, `urls`, `keywords`, `periodical`
- `notes` used to preserve created/modified metadata

#### D. Attachment-path contract

The current exporter emits absolute PDF paths by resolving paths under the local `PDF` folder during `_build_record_dict(...)`.

That is an implicit contract for the desktop product, but a likely incompatibility for a hosted service.

#### E. Logging/observability contract

Two log contracts currently exist in practice:

- core exporter writes logs and `comparisons.jsonl` near the executable or module path (`endnote_exporter.py:16-46`)
- GUI inspects a log file in its own `_LOG_DIR` to decide whether to show warning dialogs (`gui.py:10-17`, `81-99`, `131-149`)

This is an important cross-cutting contract because the GUI partially treats the log file as an API.

## Current end-to-end flow: selected EndNote library through the system

This is how the system works today.

### 1. User selects an EndNote library in the GUI

- `ExporterApp.select_file()` starts at `gui.py:54`
- the initial browse directory is chosen by `get_endnote_default_directory()` (`gui.py:56`, `platform_utils.py:153-158`)
- a native open-file dialog is shown with `.enl` and `.enlp` filters (`gui.py:59-66`)
- selected path is stored as `self.enl_file = Path(file_path)` (`gui.py:69`)
- the GUI updates status text and enables the export button (`gui.py:70-78`)

### 2. User chooses where to save the XML output

- `ExporterApp.run_export()` starts at `gui.py:80`
- if no library has been selected, the GUI stops with `messagebox.showerror(...)` (`gui.py:105`)
- a default filename like `<library>_zotero_export.xml` is proposed (`gui.py:108`)
- a native save dialog is shown at `gui.py:110-115`
- selected destination becomes `output_file = Path(output_path_str)` (`gui.py:122`)

### 3. GUI invokes the export engine

- the GUI flips button state to “Exporting...” (`gui.py:125`)
- it snapshots pre-run warning/error count from a local log file via `count_errors()` (`gui.py:81-99`, `131`)
- it calls `export_references_to_xml(self.enl_file, output_file)` (`gui.py:133`)

### 4. Exporter validates and resolves the library structure

- top-level export validation occurs in `EndnoteExporter.export_references_to_xml(...)` (`endnote_exporter.py:182-201`)
- input extension is checked for `.enl` or `.enlp` (`endnote_exporter.py:188`)
- output extension is validated/warned on (`endnote_exporter.py:195`)
- `_export(...)` begins (`endnote_exporter.py:204`)
- `.enlp` vs standard library path resolution is handled by `_resolve_enl_path(...)` (`endnote_exporter.py:142-177`) plus additional `_export(...)` logic (`endnote_exporter.py:206-212`)
- `.Data` directory is resolved via `find_data_folder(...)` (`endnote_exporter.py:222`, `platform_utils.py:31-55`)
- SQLite DB path is assembled as `data_path / "sdb" / "sdb.eni"` (`endnote_exporter.py:232`)

### 5. Exporter reads EndNote data from SQLite

- SQLite connection opens at `endnote_exporter.py:242`
- references are loaded with `SELECT * FROM refs WHERE trash_state = 0` (`endnote_exporter.py:245`)
- attachment rows are loaded with `SELECT refs_id, file_path FROM file_res` (`endnote_exporter.py:249`)
- attachment rows are grouped into `file_mapping` keyed by reference ID (`endnote_exporter.py:252-255`)

### 6. Exporter transforms records into an intermediate Python dict structure

- XML root and `<records>` container are created (`endnote_exporter.py:260-261`)
- comparisons log is opened once (`endnote_exporter.py:264`)
- the exporter iterates `for row in all_refs:` (`endnote_exporter.py:272`)
- each DB row is turned into a `ref` dict and then `record_dict` via `_build_record_dict(...)` (`endnote_exporter.py:273-277`, `367-657`)

`_build_record_dict(...)` is the true heart of the conversion logic. It applies rules for:

- reference-type mapping
- date parsing/normalization
- title nesting
- contributor parsing
- periodical/abbreviation handling
- publisher/accession/custom fields
- keyword splitting
- URL and PDF attachment construction
- note construction including created/modified metadata

### 7. Exporter serializes each record into XML

- comparison/debug payload is created via `_create_comparison(...)` (`endnote_exporter.py:282-288`, `826-862`)
- comparison rows are written to `comparisons.jsonl` (`endnote_exporter.py:290-291`)
- XML nodes are emitted via `_dict_to_xml(record_dict, records)` (`endnote_exporter.py:297`, `659-824`)
- element creation is normalized through `create_xml_element(...)` (`endnote_exporter.py:864-880`)

### 8. Exporter writes the final XML file and returns to the GUI

- XML tree is pretty-printed using `minidom` with fallbacks (`endnote_exporter.py:303-350`)
- final XML is written using `with output_path.open("w", encoding="utf-8")` (`endnote_exporter.py:352`)
- exporter returns `(len(all_refs), output_path)` (`endnote_exporter.py:360`)

### 9. GUI converts exporter result + log delta into user feedback

- GUI re-reads the log file after export (`gui.py:134`)
- if warning/error count increased, the GUI may show a warning dialog (`gui.py:135-149`)
- on exception, it shows an error dialog and resets UI state (`gui.py:153-157`)
- on success, it hides the export button, shows a success message, and re-enables “Select another library...” (`gui.py:160-165`)

## Interfaces most relevant to a backend/web service

The future backend/web port does not need to reuse the GUI, but it does need to preserve several contracts.

### Preserve / extract

1. **Library parsing/export contract**
   - today represented by `export_references_to_xml(...)` (`endnote_exporter.py:923`)
   - should evolve into a transport-neutral service API

2. **EndNote structure resolution logic**
   - `.enl` / `.enlp` detection and `.Data` discovery
   - today split across `_resolve_enl_path(...)` (`endnote_exporter.py:142`) and `find_data_folder(...)` (`platform_utils.py:31`)

3. **Schema-to-record mapping rules**
   - concentrated in `_build_record_dict(...)` (`endnote_exporter.py:367`)
   - this is the most important reusable logic for output compatibility

4. **XML serialization rules**
   - concentrated in `_dict_to_xml(...)` (`endnote_exporter.py:659`) and `create_xml_element(...)` (`endnote_exporter.py:864`)

5. **Comparison/validation utility**
   - `XMLComparator` (`endnote_exporter.py:928`) could become part of a regression/test harness for desktop + web parity

### Replace / wrap

1. **Desktop file dialogs**
   - replace `filedialog.askopenfilename(...)` (`gui.py:59`) and `filedialog.asksaveasfilename(...)` (`gui.py:110`) with upload/download or API endpoints

2. **Filesystem output contract**
   - replace `output_file: Path` + `with output_path.open(...)` (`endnote_exporter.py:352`) with streamed response, temp object, or blob-store result

3. **Local log-file inspection as warning transport**
   - replace `count_errors()` log scraping (`gui.py:81-99`, `131-149`) with structured result metadata

4. **Desktop-specific default-directory behavior**
   - `get_endnote_default_directory()` (`platform_utils.py:153`) is useful only for desktop browsing UX

## Components that should be split or wrapped for backend/web use

### 1. Split the export engine into clearer layers

Today, `endnote_exporter.py` bundles several layers together.

#### Suggested conceptual split

- **input resolution layer**
  - `.enl` / `.enlp` / future archive handling
  - data-folder and DB-path discovery
- **data access layer**
  - SQLite reads from `refs` and `file_res`
- **mapping layer**
  - `_build_record_dict(...)`
- **serialization layer**
  - `_dict_to_xml(...)`, `create_xml_element(...)`
- **runtime/diagnostics layer**
  - logging setup and `comparisons.jsonl`
- **comparison/test utility layer**
  - `XMLComparator`

#### Why this matters

For desktop hardening, this lowers change risk.
For web/backend work, it creates the service boundary that currently does not exist.

### 2. Wrap filesystem assumptions behind an adapter

Current exporter behavior is tightly bound to local paths:

- selected input is a local file path
- `.Data` folder must exist on local disk
- DB is opened via local SQLite path
- output is written to a local XML path
- attachments are emitted as absolute local PDF paths
- logs and comparison files are written locally

A backend/web service would need an adapter for:

- temp workspace creation
- unpacked upload handling
- archive extraction if supported
- output delivery
- attachment-link policy
- cleanup

### 3. Separate result reporting from logs

The GUI currently infers warnings/errors by reading a log file before and after export.

That works as a desktop workaround, but it is a poor service contract. A backend/web wrapper would need a structured export result, ideally including:

- total records seen
- records successfully serialized
- skipped/error count
- warning list or capped warning summary
- output artifact reference

### 4. Isolate desktop-only concerns

These should remain desktop-only adapters and not leak into reusable core logic:

- Tkinter widgets and dialogs in `gui.py`
- default Documents/EndNote browse directory in `platform_utils.py:153`
- PyInstaller runtime/log-path concerns currently configured inside `endnote_exporter.py`

## Issues affecting component reuse

### 1. Export core is reusable, but not cleanly packaged as a service boundary

The reusable logic exists, but the module boundary is too broad. `endnote_exporter.py` mixes transformation logic with runtime setup and debug tooling.

### 2. `.enlp` support exists, but input normalization is not unified

There is a dedicated helper `_resolve_enl_path(...)` (`endnote_exporter.py:142`), but `_export(...)` still performs extra `.enlp`-specific logic (`endnote_exporter.py:206-212`). That duplication weakens the component boundary around input resolution.

### 3. Validation is comparison-oriented, not test-suite-oriented

`XMLComparator` is a useful validation asset, but it is embedded in the runtime module rather than exposed through a dedicated test harness.

### 4. Packaging and execution center on `gui.py`

The release workflow packages `gui.py` directly (`release.yml:47`, `54`), confirming that the product boundary is still “desktop app” rather than “shared core with multiple adapters”.

### 5. Test boundary is underdeveloped

The fixture archive under `testing/` is promising, but there is no executable test layer around the exporter, platform helpers, or packaged runtime.

## Opportunities

### Immediate opportunities for desktop hardening

1. Treat `platform_utils.py` as the formal home for path/platform abstractions and finish integrating that boundary.
2. Keep `gui.py` thin; avoid pushing more execution or business logic into the desktop layer.
3. Promote `XMLComparator` into a clearer validation asset for fixture-based regression checking.
4. Add executable tests around:
   - `.enl` vs `.enlp` path resolution
   - `find_data_folder(...)`
   - representative export fixtures
   - comparison of produced XML against known-good outputs

### Immediate opportunities for a web/backend port

1. Extract a transport-neutral export service from `endnote_exporter.py`.
2. Preserve `_build_record_dict(...)` and `_dict_to_xml(...)` logic as the compatibility core.
3. Introduce an input-normalization boundary for:
   - unpacked `.enl` + `.Data`
   - unpacked `.enlp`
   - possibly uploaded archives
4. Replace local output path writing with a returned string/bytes/artifact abstraction.
5. Replace absolute local attachment paths with an explicit attachment-link policy.

## Open questions

1. **What is the intended backend input contract?**
   - raw folder upload
   - `.enlp` upload
   - `.zip` upload
   - all of the above

2. **Should the current `export_references_to_xml(Path, Path)` contract remain the canonical API, or become a desktop adapter around a new lower-level export service?**

3. **What should happen to PDF attachments in a hosted environment?**
   - omit them
   - upload and re-host them
   - include them in a downloadable package
   - keep references only in a manifest

4. **Should `XMLComparator` remain a runtime-side utility, or move into a dedicated testing/validation module?**

5. **Does the web/backend version need strict parity with current desktop XML output, or is some output-policy divergence acceptable for attachments and path semantics?**

6. **Is `.enlp.zip` intended to become a supported input format?**
   - the repository already contains `testing/RefsEnschede.enlp.zip`, which suggests this scenario matters operationally

## Bottom line

### Main component boundaries

- **`gui.py`** = desktop adapter and user interaction shell
- **`endnote_exporter.py`** = export engine plus a large amount of currently co-located runtime/mapping/serialization/comparison logic
- **`platform_utils.py`** = path/platform adapter layer
- **`release.yml` + `pyproject.toml`** = packaging/distribution boundary
- **`testing/RefsEnschede.enlp.zip` + `XMLComparator`** = current validation assets

### Main dependencies

- GUI depends on exporter + platform utilities
- exporter depends on platform utilities + SQLite + XML libraries + local filesystem structure
- release pipeline depends on `gui.py` as the packaged entrypoint
- there is no separate CLI/service boundary being exercised today

### Most important reuse seam for a web/backend port

The most valuable reusable core is inside `endnote_exporter.py`, especially:

- `_build_record_dict(...)` (`endnote_exporter.py:367`)
- `_dict_to_xml(...)` (`endnote_exporter.py:659`)
- the surrounding library/DB resolution logic

The most important architectural work for a web/backend port is therefore **not** rewriting the mapping rules; it is **extracting them from desktop filesystem, dialog, logging, and packaging assumptions**. In other words: the exporter logic is portable, but the current runtime shell is gloriously local-disk-shaped.
