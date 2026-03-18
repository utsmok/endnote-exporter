# Component Research Report: local-only browser/web implementation

Date: 2026-03-18
Repository: `/home/sam/dev/endnote-exporter`
Scope: Research only — no application code changes

## Purpose

This report maps the current components and data flow relevant to a **local-only browser/web implementation** of the EndNote exporter.

It focuses on:

1. the current flow from selected EndNote library to generated XML
2. which responsibilities should become browser-side modules
3. which responsibilities are better treated as optional wrapper-only modules
4. which responsibilities from the hosted-web planning track disappear entirely in a local-web model
5. component boundaries for:
   - browser-only
   - single-file HTML
   - Electron
   - Tauri

This report builds on:

- current code in `endnote_exporter.py`, `gui.py`, and `platform_utils.py`
- prior hosted-web / platform planning under `docs/platform-and-web-port*`
- local-web setup research in `docs/local-web-execution/research/00_setup.md`

## Sources reviewed

### Current runtime code

- `gui.py:20` — `ExporterApp`
- `gui.py:54` — `select_file()`
- `gui.py:80` — `run_export()`
- `gui.py:133` — GUI calls `export_references_to_xml(...)`
- `gui.py:169` — desktop entrypoint
- `endnote_exporter.py:142` — `_resolve_enl_path(...)`
- `endnote_exporter.py:181` — `EndnoteExporter`
- `endnote_exporter.py:182` — `export_references_to_xml(...)`
- `endnote_exporter.py:204` — `_export(...)`
- `endnote_exporter.py:222` — `.Data` folder lookup
- `endnote_exporter.py:232` — DB path assembly: `sdb/sdb.eni`
- `endnote_exporter.py:245` — `SELECT * FROM refs WHERE trash_state = 0`
- `endnote_exporter.py:249` — `SELECT refs_id, file_path FROM file_res`
- `endnote_exporter.py:352` — XML file write
- `endnote_exporter.py:367` — `_build_record_dict(...)`
- `endnote_exporter.py:603` — absolute PDF path reconstruction
- `endnote_exporter.py:659` — `_dict_to_xml(...)`
- `endnote_exporter.py:864` — `create_xml_element(...)`
- `endnote_exporter.py:883` — `format_timestamp(...)`
- `endnote_exporter.py:904` — `safe_str(...)`
- `endnote_exporter.py:923` — module-level `export_references_to_xml(...)`
- `endnote_exporter.py:928` — `XMLComparator`
- `platform_utils.py:31` — `find_data_folder(...)`
- `platform_utils.py:58` — `get_documents_folder()`
- `platform_utils.py:153` — `get_endnote_default_directory()`
- `platform_utils.py:161` — `validate_file_extension(...)`

### Product and release context

- `README.md:7` — desktop output includes absolute PDF paths
- `README.md:14-16` — current platform support claims
- `.github/workflows/release.yml:16` — Windows/macOS/Linux build matrix
- `.github/workflows/release.yml:47` — Windows/Linux PyInstaller build via `gui.py`
- `.github/workflows/release.yml:54` — macOS Universal2 PyInstaller build via `gui.py`
- `.github/workflows/release.yml:64` — GitHub release publishing

### Existing platform/web planning

- `docs/platform-and-web-port_PLAN.md` — consolidated plan centered on shared-core extraction and hosted worker model
- `docs/platform-and-web-port/research/01_architecture.md` — current architecture and reusable seams
- `docs/platform-and-web-port/research/02_components.md` — existing component map for desktop + hosted work
- `docs/platform-and-web-port/research/03_backend.md` — hosted API/worker architecture analysis
- `docs/platform-and-web-port/research/07_issues_debt.md` — current debt around local-file assumptions, `.enlp`, logging, attachment paths
- `docs/platform-and-web-port/plans/plan_a_conservative.md` — desktop-first, narrow hosted seam
- `docs/platform-and-web-port/plans/plan_b_balanced.md` — shared-core + headless boundary + worker model
- `docs/platform-and-web-port/reviews/review_1.md` and `review_2.md` — recommend Plan B with Plan A sequencing and early contract/fixture guardrails

### Local-web framing

- `docs/local-web-execution/research/00_setup.md:179-185` — browser-local SQLite feasibility questions
- `docs/local-web-execution/research/00_setup.md:226-244` — browser-only option
- `docs/local-web-execution/research/00_setup.md:254-272` — browser + WASM option
- `docs/local-web-execution/research/00_setup.md:278-294` — single-file HTML option
- `docs/local-web-execution/research/00_setup.md:297-318` — Electron option
- `docs/local-web-execution/research/00_setup.md:321-339` — Tauri option

## Executive summary

The current exporter already has a usable **three-stage pipeline**:

1. **desktop file selection** in `gui.py`
2. **library normalization + SQLite reads** in `endnote_exporter.py` and `platform_utils.py`
3. **record mapping + XML serialization** in `endnote_exporter.py`

For a **local-only browser/web implementation**, the important conclusion is:

- the **GUI layer** is easy to replace
- the **SQLite access + workspace normalization layer** is the hardest portability seam
- the **mapping + XML generation layer** is the most reusable conceptual core

In other words:

- `gui.py` should become browser UI / wrapper UI
- `_resolve_enl_path(...)`, `find_data_folder(...)`, DB-path assembly, and SQL queries become a **local-workspace ingestion module**
- `_build_record_dict(...)` and `_dict_to_xml(...)` become the **shared conversion spec** to preserve
- hosted-only concerns from the earlier web plans — upload intake, server job lifecycle, artifact retention, cleanup, server-local path hiding — mostly disappear in a true local-only model

The biggest architectural decision for local-web is **where SQLite and local filesystem access live**:

- **browser-only / single-file HTML**: most likely browser UI + WASM SQLite + browser file APIs
- **Electron / Tauri**: wrapper can own filesystem access and possibly SQLite access, leaving the renderer/UI closer to a normal web app

## Current component map

### 1. Desktop shell

**Current component:** `gui.py`

Primary responsibilities:

- choose the EndNote library from local disk (`gui.py:54`, `gui.py:59`)
- choose output XML path (`gui.py:80`, `gui.py:110`)
- call the exporter (`gui.py:133`)
- render user-facing success/error/warning state (`gui.py:135-165`)

Local-web interpretation:

- this component is **not reusable as code**
- but its responsibilities are reusable as product functions:
  - choose input
  - start conversion
  - surface warnings
  - deliver XML download

### 2. Library/workspace resolver

**Current components:**

- `_resolve_enl_path(...)` in `endnote_exporter.py:142`
- `find_data_folder(...)` in `platform_utils.py:31`
- DB-path assembly in `endnote_exporter.py:222-232`
- extension validation in `platform_utils.py:161`

Primary responsibilities:

- distinguish `.enl` vs `.enlp`
- derive library name
- locate `<Library>.Data`
- locate `sdb/sdb.eni`
- validate that the local package layout is usable

Local-web interpretation:

- this becomes a **workspace normalizer**
- it is one of the most important boundaries to preserve conceptually
- it should be designed around an abstract input workspace, not around Tkinter or PyInstaller

### 3. SQLite extraction layer

**Current component:** `_export(...)` in `endnote_exporter.py:204`

Primary responsibilities:

- open SQLite DB at `data_path / "sdb" / "sdb.eni"` (`endnote_exporter.py:232-242`)
- query references (`endnote_exporter.py:245`)
- query attachment file mappings (`endnote_exporter.py:249`)
- build an in-memory `file_mapping` keyed by reference id (`endnote_exporter.py:252-255`)

Local-web interpretation:

- this is the hardest portability boundary
- browser-only variants likely need a **WASM SQLite adapter**
- Electron/Tauri variants may shift this responsibility into the native/wrapper layer

### 4. Mapping / transformation layer

**Current component:** `_build_record_dict(...)` in `endnote_exporter.py:367`

Primary responsibilities:

- map DB row fields into export-ready structure
- normalize titles, contributors, dates, periodicals, keywords, notes, custom fields
- map reference types
- reconstruct attachment URLs
- preserve created/modified metadata in notes

Local-web interpretation:

- this is the best candidate for a **shared conversion spec**
- even if reimplemented in JavaScript/TypeScript, this logic is the parity target
- this should remain runtime-neutral

### 5. XML writer / sanitizer

**Current components:**

- `_dict_to_xml(...)` — `endnote_exporter.py:659`
- `create_xml_element(...)` — `endnote_exporter.py:864`
- `format_timestamp(...)` — `endnote_exporter.py:883`
- `safe_str(...)` — `endnote_exporter.py:904`

Primary responsibilities:

- build Zotero-compatible XML structure
- sanitize XML text and attributes
- serialize nested structures consistently

Local-web interpretation:

- this is also highly portable
- browser-only variants can implement this entirely client-side
- wrapper variants should keep it in the renderer/shared layer, not in the native shell

### 6. Validation / parity tooling

**Current component:** `XMLComparator` in `endnote_exporter.py:928`

Primary responsibilities:

- compare produced XML against a known-good export
- support parity testing during refactors or new runtime work

Local-web interpretation:

- not a runtime component
- should become test-only parity tooling for browser/wrapper implementations

### 7. Platform-specific desktop helpers

**Current component:** `platform_utils.py`

Primary responsibilities:

- documents-folder discovery (`platform_utils.py:58`)
- EndNote default directory (`platform_utils.py:153`)
- extension validation (`platform_utils.py:161`)
- `.Data` folder lookup (`platform_utils.py:31`)

Local-web interpretation:

- `find_data_folder(...)` and extension validation remain useful conceptually
- documents-folder discovery is mostly **desktop-wrapper-only** or removable

## Current data flow: selected EndNote library to generated XML

### Step 1: user selects local input

- Desktop app starts in `ExporterApp` (`gui.py:20`)
- `select_file()` chooses `.enl` or `.enlp` via native dialog (`gui.py:54-66`)
- default browse directory is derived from `get_endnote_default_directory()` (`gui.py:56`, `platform_utils.py:153`)

**Local-web impact:**
- browser-only variants replace this with file/directory selection UI
- Electron/Tauri may retain native file dialogs, but this becomes wrapper-only UX

### Step 2: user chooses XML output destination

- `run_export()` uses `filedialog.asksaveasfilename(...)` (`gui.py:80`, `gui.py:110`)
- selected output becomes `output_file = Path(output_path_str)` (`gui.py:122`)

**Local-web impact:**
- browser-only variants should produce XML in memory and trigger download
- wrapper variants may optionally allow explicit save path selection, but that should be adapter-only behavior

### Step 3: desktop UI hands off to exporter API

- GUI calls `export_references_to_xml(self.enl_file, output_file)` (`gui.py:133`)
- module-level wrapper forwards into `EndnoteExporter.export_references_to_xml(...)` (`endnote_exporter.py:923`, `endnote_exporter.py:182`)

**Local-web impact:**
- this becomes the natural seam for a new runtime-neutral export function
- new local-web implementations should preserve the conceptual contract, but not the file-path-in / file-path-out shape

### Step 4: input validation and library normalization

- validate `.enl` / `.enlp` input (`endnote_exporter.py:188`)
- validate output extension (`endnote_exporter.py:195`)
- `_resolve_enl_path(...)` handles `.enlp` package layout (`endnote_exporter.py:142-177`)
- `_export(...)` resolves `base_path` and library name (`endnote_exporter.py:204-218`)
- `find_data_folder(...)` locates `<Library>.Data` (`endnote_exporter.py:222`, `platform_utils.py:31`)
- DB path is fixed as `data_path / "sdb" / "sdb.eni"` (`endnote_exporter.py:232`)

**Local-web impact:**
- browser and wrapper variants still need this exact normalization stage
- this should become a standalone “prepare local workspace” module

### Step 5: DB access and attachment lookup

- SQLite opens directly from local path (`endnote_exporter.py:242`)
- refs query: `SELECT * FROM refs WHERE trash_state = 0` (`endnote_exporter.py:245`)
- attachment query: `SELECT refs_id, file_path FROM file_res` (`endnote_exporter.py:249`)
- file mappings are accumulated in memory (`endnote_exporter.py:252-255`)

**Local-web impact:**
- browser-only variants need a client-side DB reader, very likely SQLite in WASM
- wrapper variants may read the DB from native code or Node/Rust helpers, then pass rows to shared mapping code

### Step 6: row-to-record transformation

- loop over refs begins at `endnote_exporter.py:272`
- each row becomes a Python dict (`endnote_exporter.py:273`)
- `_build_record_dict(...)` produces normalized export data (`endnote_exporter.py:276`, `367`)

This includes:

- reference-type mapping
- timestamp normalization via `format_timestamp(...)` (`endnote_exporter.py:883`)
- author parsing
- keyword parsing
- title/periodical handling
- note synthesis
- URL creation
- PDF path reconstruction

**Local-web impact:**
- this should live in shared browser-side code where possible
- it is the main parity surface to preserve across all variants

### Step 7: PDF path reconstruction

- `file_res.file_path` values are joined under `data_path / "PDF"` in `_build_record_dict(...)`
- output uses `full_pdf_path.resolve()` (`endnote_exporter.py:603`)
- README documents absolute PDF path behavior (`README.md:7`)

**Local-web impact:**
- current desktop behavior is not a drop-in fit for browser delivery
- this should become an explicit attachment-path policy module

### Step 8: XML tree generation

- `_dict_to_xml(...)` emits record XML (`endnote_exporter.py:659`)
- `create_xml_element(...)` handles sanitized element creation (`endnote_exporter.py:864`)
- `safe_str(...)` removes invalid XML characters (`endnote_exporter.py:904`)

**Local-web impact:**
- fully portable to browser-side generation
- this should remain in shared runtime-neutral code, not native wrappers

### Step 9: XML output and desktop feedback

- XML is pretty-printed and written to disk (`endnote_exporter.py:303-352`)
- GUI reports success/warnings via dialogs (`gui.py:135-165`)

**Local-web impact:**
- disk write should become a download/save action
- warnings should become structured UI output, not log-file scraping

## Component translation for a local-web model

## Which responsibilities become browser-side modules?

These should move into the browser/UI bundle wherever feasible.

### A. Local workspace manifest + input inspector

Derived from:

- `gui.py:54-66`
- `endnote_exporter.py:142-177`
- `platform_utils.py:161`

Responsibility:

- accept selected files/folders/archives
- identify whether input is `.enl`, `.enlp`, or archive-backed bundle
- create a canonical in-browser workspace manifest

### B. Archive/package normalizer

Derived from:

- `_resolve_enl_path(...)` (`endnote_exporter.py:142`)
- `find_data_folder(...)` (`platform_utils.py:31`)

Responsibility:

- normalize `.enl`, `.enlp`, and archive inputs to a consistent virtual file tree
- find `.Data`, `sdb/sdb.eni`, and `PDF/`

### C. SQLite query adapter

Derived from:

- `_export(...)` DB section (`endnote_exporter.py:232-255`)

Responsibility:

- open the EndNote DB locally
- run the equivalent of:
  - `SELECT * FROM refs WHERE trash_state = 0`
  - `SELECT refs_id, file_path FROM file_res`
- return structured rows for mapping

Note:
- browser-only variants likely require WASM here

### D. Record mapping engine

Derived from:

- `_build_record_dict(...)` (`endnote_exporter.py:367`)

Responsibility:

- convert DB rows into runtime-neutral export records
- preserve current field semantics

### E. Attachment path policy module

Derived from:

- current absolute-path logic (`endnote_exporter.py:603`, `README.md:7`)

Responsibility:

- decide how attachment references are emitted in local-web mode
- likely modes:
  - omit
  - relative metadata only
  - client-hint rewrite
  - wrapper-native absolute path mode

### F. XML serializer + sanitizer

Derived from:

- `_dict_to_xml(...)` (`endnote_exporter.py:659`)
- `create_xml_element(...)` (`endnote_exporter.py:864`)
- `safe_str(...)` (`endnote_exporter.py:904`)

Responsibility:

- generate final XML entirely client-side

### G. Download/export delivery UI

Derived from:

- current save-dialog + success-state responsibilities in `gui.py:80-165`

Responsibility:

- preview warnings
- trigger XML download
- optionally offer report download

## Which responsibilities become optional wrapper-only modules?

These are useful in Electron/Tauri, but should not be required for pure browser variants.

### A. Native file picker / filesystem adapter

Current analog:

- `gui.py:54-66`
- `platform_utils.py:58-158`

Wrapper-only role:

- open native folder/file dialogs
- read large local files more efficiently than browser APIs
- optionally keep “open library from default location” UX

### B. Native path policy and local absolute attachment mode

Current analog:

- `endnote_exporter.py:603`
- `README.md:7`

Wrapper-only role:

- if local wrapper has trusted local filesystem access, it can offer a compatibility mode that emits absolute local paths
- this should remain optional and explicit

### C. Native archive and SQLite bridge

Wrapper-only role:

- Electron: Node/native module side
- Tauri: Rust command layer

Purpose:

- reduce bundle size / memory pressure in renderer
- avoid shipping full SQLite/WASM if native wrapper already has local capability

### D. OS integration and distribution

Current analog:

- `.github/workflows/release.yml:16,47,54,64`

Wrapper-only role:

- installers
- auto-updates
- file associations
- native permissions / sandbox tuning

## Which responsibilities can be removed entirely in a true local-web model?

These come mostly from the earlier hosted-web plans and are not needed if processing stays on-device.

### A. Server upload intake and archive safety boundary

Hosted-web plans emphasize:

- upload normalization
- archive rejection rules
- path traversal defense at server boundary
- API upload routes
- worker job submission

In local-web mode:

- user still selects local archives/files
- but there is **no server upload surface** to protect
- archive validation still matters for robustness, but not for multi-tenant server safety

### B. Worker/job queue and artifact retention layer

Hosted-web plans center on:

- worker jobs
- status polling
- temp workspace TTL
- artifact download endpoints
- rollback/cleanup operations

In local-web mode:

- all of this largely disappears
- conversion can be synchronous or local-background on the user device
- there is no server artifact store or retention policy by default

### C. Privacy/retention runbooks for uploaded content

Hosted-web plans require:

- deletion guarantees
- upload retention rules
- logging policy for user uploads

In local-web mode:

- the privacy story becomes much simpler: “data stays on device”
- only local browser storage / wrapper temp files need policy discussion

### D. Service API and deployment surface

Not needed for a true local-only model:

- upload/status/download API
- background service deployment
- reverse proxy/body-size tuning
- server observability stack

## Variant-specific component boundaries

## 1. Browser-only

Relevant local-web framing:

- `docs/local-web-execution/research/00_setup.md:226-244`
- `docs/local-web-execution/research/00_setup.md:179-185`

### Boundary shape

**Browser UI / app shell**
- file or directory selection
- conversion controls
- warnings and download UX

**Virtual workspace layer**
- in-memory or browser-backed file tree
- `.enl` / `.enlp` / archive normalization
- data-folder discovery

**SQLite access layer**
- likely SQLite/WASM
- runs entirely in browser

**Mapping + XML layer**
- shared client-side logic
- direct port of `_build_record_dict(...)` and `_dict_to_xml(...)`

### Main constraint

- SQLite access and archive handling likely require WASM or similarly heavy client runtime

### Best suited responsibilities

- UI
- normalization
- mapping
- XML generation
- local download

### Least suited responsibilities

- native path preservation
- default Documents-folder UX
- huge-library handling without memory pressure

## 2. Single-file HTML

Relevant local-web framing:

- `docs/local-web-execution/research/00_setup.md:278-294`

### Boundary shape

Same as browser-only, but with stricter packaging constraints:

**Embedded UI + logic bundle**
- all logic in one self-contained HTML file if possible

**Lightweight local storage use**
- minimal reliance on multi-file assets or install steps

### Main constraint

- bundle size and browser local-file restrictions are tighter
- large WASM/runtime payloads work against the “single-file” promise

### Best suited responsibilities

- small UI
- XML serialization
- lightweight normalization

### Risky responsibilities

- very large WASM SQLite runtime
- complex archive pipelines
- heavy dependency stacks

### Practical conclusion

- single-file HTML is attractive for distribution, but only if the SQLite/archive story stays lightweight enough
- otherwise this variant may be too constrained compared with normal browser app or wrapper approaches

## 3. Electron

Relevant local-web framing:

- `docs/local-web-execution/research/00_setup.md:297-318`

### Boundary shape

**Renderer/UI layer**
- normal web UI
- warnings/download flow

**Preload / IPC boundary**
- controlled bridge to local filesystem and optional native helpers

**Main-process native layer**
- file dialogs
- archive extraction if desired
- local path handling
- possibly SQLite access

### Best fit

- preserve a web UI while avoiding fragile browser file API limits
- optionally support “desktop-compatible absolute PDF path mode” because local filesystem access is available

### Responsibilities that can stay outside renderer

- filesystem traversal
- archive unpacking
- path normalization
- maybe SQLite opening

### Tradeoff

- simplest route to desktop-like local access with web tech
- largest distribution footprint of the local-web options

## 4. Tauri

Relevant local-web framing:

- `docs/local-web-execution/research/00_setup.md:321-339`

### Boundary shape

**Web UI layer**
- same general UI role as browser/Electron renderer

**Rust/native command boundary**
- filesystem access
- archive handling
- maybe SQLite/native parsing
- OS integration

### Best fit

- smaller footprint than Electron
- strong local-only story with native filesystem capability

### Responsibilities likely to move native-side

- file system walking
- archive extraction
- high-volume local I/O
- maybe DB access

### Tradeoff

- leaner shipped app than Electron
- more implementation/toolchain complexity because the current repo is Python-first, not Rust-first

## Responsibility split by variant

| Responsibility | Browser-only | Single-file HTML | Electron | Tauri |
|---|---|---|---|---|
| File selection UI | Browser | Browser | Wrapper/native dialog | Wrapper/native dialog |
| Workspace normalization | Browser | Browser, constrained | Shared or native | Shared or native |
| SQLite access | Browser, likely WASM | Browser, likely WASM and bundle-sensitive | Native/Node or renderer | Native/Rust or renderer |
| Record mapping | Browser/shared | Browser/shared | Shared renderer/core | Shared renderer/core |
| XML generation | Browser/shared | Browser/shared | Shared renderer/core | Shared renderer/core |
| Absolute local PDF compatibility mode | Hard / limited | Hard / limited | Easy optional mode | Easy optional mode |
| Default Documents-folder logic | Not applicable | Not applicable | Optional wrapper feature | Optional wrapper feature |
| Server upload/job lifecycle | Removed | Removed | Removed | Removed |
| Privacy/retention ops | Minimal local-only | Minimal local-only | Minimal local-only | Minimal local-only |
| Installer/update/distribution | None or static hosting | None or file distribution | Wrapper-owned | Wrapper-owned |

## Findings

### 1. The current code already contains a usable conversion specification

The best reusable logic is concentrated in:

- `_build_record_dict(...)` — `endnote_exporter.py:367`
- `_dict_to_xml(...)` — `endnote_exporter.py:659`
- `create_xml_element(...)` — `endnote_exporter.py:864`
- `safe_str(...)` — `endnote_exporter.py:904`

These should drive parity for any browser or wrapper implementation.

### 2. The biggest portability problem is not XML generation; it is local SQLite and workspace access

The local-web setup already identified SQLite access as a pivotal feasibility question (`docs/local-web-execution/research/00_setup.md:179-185`). The current code confirms that:

- DB access is direct SQLite file access (`endnote_exporter.py:232-245`)
- input normalization assumes a real local filesystem (`endnote_exporter.py:142-232`, `platform_utils.py:31`)

### 3. Attachment handling is the sharpest product seam

Current desktop behavior uses absolute local paths (`endnote_exporter.py:603`, `README.md:7`).

That suggests local-web variants need an explicit policy:

- browser-only and single-file HTML likely cannot promise the current desktop behavior cleanly
- Electron/Tauri can, but should make it an explicit compatibility mode rather than a hidden default

### 4. Hosted-web planning is still highly reusable — mostly as negative space

The hosted-web documents were useful because they already separated:

- input normalization
- runtime-neutral export core
- attachment policy
- runtime adapters

But for local-web, the hosted-only layers are mostly removed:

- upload endpoints
- queue/worker jobs
- server temp storage
- retention/cleanup ops

### 5. Earlier plan/review guidance still applies

The strongest prior recommendation — Plan B architecture with Plan A sequencing and early fixture guardrails — still fits the local-web track conceptually:

- keep the scope narrow
- define attachment semantics early
- lock parity with fixtures
- avoid overbuilding until SQLite/runtime feasibility is proven

## Issues

### 1. The current exporter contract is file-path-in / file-path-out

- GUI expects local file selection and local save destination (`gui.py:59`, `gui.py:110`)
- exporter writes XML directly to disk (`endnote_exporter.py:352`)

For local-web, this should become **workspace-in / XML-bytes-out**.

### 2. Logging/reporting is desktop-shaped and not suitable for browser UX

- core log file at `endnote_exporter.py:28`
- comparison log at `endnote_exporter.py:46`
- GUI log scraping at `gui.py:130-149`

Browser and wrapper UX need structured warnings, not file-based log inference.

### 3. Some platform utilities become dead weight in pure browser mode

- `get_documents_folder()` (`platform_utils.py:58`)
- `get_endnote_default_directory()` (`platform_utils.py:153`)

These make sense only in desktop/wrapper variants.

### 4. Current `.enlp` logic is still optimistic and local-directory-based

- `_resolve_enl_path(...)` (`endnote_exporter.py:142-177`)
- extra `.enlp` logic inside `_export(...)` (`endnote_exporter.py:204-218`)

Local-web normalization should be more explicit and variant-independent.

## Opportunities

### 1. Treat mapping + XML logic as the portable core

Do not begin by porting the whole app shape. Begin by preserving:

- `_build_record_dict(...)`
- `_dict_to_xml(...)`
- sanitization helpers

### 2. Define one canonical local-workspace model

A single normalized local workspace should represent:

- selected files/folders/archives
- derived library name
- `.Data` root
- DB location
- PDF folder

This can serve browser-only and wrapper variants alike.

### 3. Keep native wrapper responsibilities narrow

For Electron/Tauri, the wrapper should own:

- native file access
- optional archive unpacking
- optional SQLite/native I/O

But the core record mapping and XML rules should stay in shared code.

### 4. Use `XMLComparator` only as parity infrastructure

- keep it out of runtime design
- use it to confirm that local-web implementations preserve output behavior where intended

## Open questions

1. **Browser-only feasibility:** Is browser-side SQLite access practical enough for realistic EndNote libraries, or does local-web quickly require WASM or a wrapper?
2. **Single-file HTML honesty:** Can the project still honestly promise a single-file distribution once SQLite/archive support is included?
3. **Attachment behavior:** Which modes are acceptable for local-web?
   - omit PDF links
   - emit relative metadata only
   - rewrite from user hint
   - preserve absolute local paths in wrapper variants only
4. **Input contract:** Should browser variants support raw folder selection, `.enlp`, `.zip`, or all of the above?
5. **Wrapper threshold:** At what point do Electron/Tauri become simpler than fighting browser file API and SQLite limitations?
6. **Parity target:** Must local-web output be byte-identical to current desktop XML, or only semantically equivalent aside from attachment-path policy?
7. **Native bridge choice:** If a wrapper is required, is Electron’s simpler JS ecosystem worth the footprint, or is Tauri’s smaller runtime worth the extra Rust complexity?

## Bottom line

The current exporter decomposes cleanly into three practical local-web boundaries:

1. **UI / input selection** — today in `gui.py`, should become browser or wrapper UI
2. **workspace + SQLite ingestion** — today split across `_resolve_enl_path(...)`, `find_data_folder(...)`, and `_export(...)`; this is the hardest portability seam
3. **record mapping + XML writing** — today in `_build_record_dict(...)` and `_dict_to_xml(...)`; this is the portable core to preserve

The shortest summary is:

- **Browser-only / single-file HTML** live or die on client-side filesystem + SQLite feasibility.
- **Electron / Tauri** move the hard parts — filesystem and possibly SQLite — into the wrapper, making the renderer mostly a normal web app.
- **Hosted-only components from earlier plans mostly disappear** in a true local-only model.

The most important component boundary to preserve going forward is:

> **local workspace ingestion** → **record mapping** → **XML generation**

with **attachment-path policy** treated as an explicit cross-cutting concern rather than hidden inside the mapping step.
