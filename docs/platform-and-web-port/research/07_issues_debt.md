# Issues and Technical Debt Research

Date: 2026-03-18
Repository: `/home/sam/dev/endnote-exporter`

## Scope

Research only. This report focuses on:
- technical debt and fragile assumptions
- TODO/FIXME/HACK-style debt markers and equivalent implicit debt
- duplicated logic and maintainability risks
- cross-platform risks, especially macOS, unsigned binaries, PyInstaller packaging, path normalization, archive/package handling, and GUI-only coupling
- issues that would complicate a hosted web port

## Executive summary

The codebase is small and functional, but it carries several concentrated risks:

1. **Logging and runtime path handling are inconsistent across GUI vs core**, which can hide real errors and complicate packaging/debugging.
2. **The exporter is tightly coupled to local filesystem assumptions** (local SQLite file, local output path, absolute local PDF paths, local log files), which is the single biggest blocker for a hosted web port.
3. **macOS/package support is only partial**: `.enlp` directory bundles are supported, but zipped archives are not, and `.enlp` resolution logic is duplicated and optimistic.
4. **PyInstaller release automation is unsigned/unnotarized and largely unverified**, especially on macOS where users are explicitly told to bypass Gatekeeper.
5. **There is no project test suite or automated packaging smoke test**, despite README claims of full support on macOS/Linux.
6. **`endnote_exporter.py` is a multi-responsibility module (~1100 lines)**, which raises change risk and makes a future desktop/web split harder.

## Findings

### 1. Core and GUI disagree on where logs live

**Severity:** High
**Type:** Technical debt / packaging / observability / duplicated logic

**Evidence**
- `endnote_exporter.py:19-28` computes `_LOG_DIR` from the executable or source file directory and writes `endnote_exporter.log` there.
- `endnote_exporter.py:46` writes `comparisons.jsonl` alongside that core log file.
- `gui.py:10-17` computes a different `_LOG_DIR`:
  - frozen app: `~/.endnote-exporter/logs`
  - source run: `<repo>/logs`
- `gui.py:130` reads `endnote_exporter.log` from the GUI log directory.

**Why this matters**
- In source mode, the core writes to `<repo>/endnote_exporter.log`, while the GUI reads `<repo>/logs/endnote_exporter.log`.
- In frozen mode, the core writes next to the executable, while the GUI reads from the user home directory.
- Result: the GUI can under-report or completely miss exporter warnings/errors.
- This also complicates support, triage, and any future service-side observability.

**Web-port impact**
- Hosted systems need centralized, deterministic logging. The current split makes that refactor harder than it should be.

**Opportunity**
- Centralize runtime/config/log path resolution in one place and have both GUI and exporter consume it.

---

### 2. Local filesystem assumptions are baked into the export flow

**Severity:** High
**Type:** Architecture / web-port blocker / path handling

**Evidence**
- `gui.py:59-66` uses a native file picker for selecting a local `.enl` / `.enlp` file.
- `gui.py:110-115` uses a native save dialog for choosing a local XML output path.
- `endnote_exporter.py:242` opens the EndNote SQLite database directly from a local path.
- `endnote_exporter.py:264` appends to a local `comparisons.jsonl` file.
- `endnote_exporter.py:352-353` writes the export result directly to a local filesystem path.
- `endnote_exporter.py:603` emits absolute PDF paths using `full_pdf_path.resolve()`.

**Why this matters**
- The current design assumes:
  - local disk access
  - a stable user-visible filesystem
  - native dialogs
  - permission to write logs/output near the executable or repo
  - PDF links that only make sense on the same machine
- That is fine for a desktop utility, but it is a poor fit for a hosted web deployment.

**Web-port impact**
This is the biggest hosted-port blocker:
- uploaded libraries would need temp storage or object storage instead of direct disk assumptions
- output should be streamed/downloaded, not written to an arbitrary path
- absolute server-side PDF paths would be useless or dangerous to expose
- the GUI flow would need replacement with HTTP upload/download flows

**Opportunity**
- Split export into a pure transformation layer (`input bundle -> structured export result`) and a thin I/O layer for desktop or web adapters.

---

### 3. `.enlp` support is helpful but incomplete and duplicated

**Severity:** High
**Type:** macOS support / archive support / duplicated logic / fragile assumption

**Evidence**
- `endnote_exporter.py:142-177` defines `_resolve_enl_path()` for `.enlp` packages.
- `endnote_exporter.py:205-212` repeats `.enlp` discovery logic inside `_export()`.
- `endnote_exporter.py:160` uses `list(package_dir.glob("*.enl"))` and takes the first hit.
- `endnote_exporter.py:168` uses `list(package_dir.glob("*.Data"))` and takes the first hit.
- `testing/RefsEnschede.enlp.zip` exists as a test artifact, but there is no code handling `.zip` archives.
- A search for `zipfile`/archive extraction in project code returned no support code.

**Why this matters**
- `.enlp` handling assumes the input is an unpacked macOS package directory, not a zipped/shared archive.
- The code uses “first match wins” logic for `.enl` and `.Data` discovery, which is fragile if package contents are odd, duplicated, or malformed.
- The helper returns `(base_path, data_folder_path)`, but `_export()` re-derives the library name and data path instead of trusting the helper result. That duplication increases drift risk.

**Cross-platform/macOS risk**
- macOS users often share/export packaged content as archives. A hosted web port is even more likely to receive zipped bundles than raw directory bundles.
- The existing logic supports the happy path, not the common transfer formats around that happy path.

**Opportunity**
- Consolidate `.enlp` resolution into one canonical function.
- Decide whether zipped `.enlp` archives are in scope and support them explicitly if they are.

**Open question**
- Should `.enlp.zip` be treated as a supported input format for both desktop and hosted workflows?

---

### 4. Absolute PDF paths are a desktop convenience but a portability liability

**Severity:** High
**Type:** Path normalization / hosted-port blocker / data portability

**Evidence**
- `README.md:7` explicitly states PDF attachments are linked using absolute paths.
- `endnote_exporter.py:599-607` builds PDF URLs from `data_path / "PDF" / file_path` and serializes `full_pdf_path.resolve()`.

**Why this matters**
- Absolute paths are machine-specific.
- `Path.resolve()` can normalize to platform-specific forms and will produce paths that are meaningless on another machine.
- For a hosted service, these paths would either be invalid, reveal server filesystem structure, or require an entirely different attachment transport model.

**Cross-platform risk**
- Path serialization differences across Windows/macOS/Linux can leak into exported XML in subtly different forms.
- If `file_res.file_path` contains unexpected separators or parent traversals, the code trusts it as part of a path join.

**Web-port impact**
- Hosted apps typically need attachment upload, blob/object storage URLs, signed downloads, or omitted attachment references.

**Opportunity**
- Introduce an attachment strategy abstraction: absolute local path, relative path, embedded asset manifest, or hosted URL.

---

### 5. Broad exception handling can hide platform-specific failures and create partial exports

**Severity:** Medium-High
**Type:** Fragile error handling / debugging debt

**Evidence**
- `endnote_exporter.py:279-302` catches broad `Exception` while building/comparing/writing records and continues.
- `endnote_exporter.py:307-348` has a cascade of broad exception fallbacks during XML serialization.
- `gui.py:152-154` catches `Exception` at the UI boundary.
- `platform_utils.py:118-119` and `platform_utils.py:147-148` swallow broad exceptions and fall back silently.

**Why this matters**
- Broad catches are reasonable at the outermost boundary, but here they also occur inside the main export loop.
- The exporter may skip records and still claim success, which can mask data-loss bugs.
- Silent fallback in platform utilities can hide environmental issues on macOS/Linux until a user reports them the hard way.

**Cross-platform risk**
- Platform-specific path and permission errors may degrade into vague warnings or quiet fallbacks instead of actionable failures.

**Opportunity**
- Tighten exception types and structure export results so skipped-record counts and reasons are explicit.

---

### 6. The release pipeline produces unsigned/unnotarized binaries

**Severity:** Medium-High
**Type:** Packaging / macOS support / distribution risk

**Evidence**
- `README.md:22` says macOS users may need security exceptions.
- `README.md:31` explicitly states the Windows `.exe` is unsigned.
- `.github/workflows/release.yml:49-61` builds and zips the macOS app.
- `.github/workflows/release.yml` has **no** `codesign`, `notarytool`, or notarization step.
- `.github/workflows/release.yml:82` tells users to run `xattr -d com.apple.quarantine ...`.

**Why this matters**
- Distribution works, but trust and usability are reduced.
- On macOS this is more than cosmetic; Gatekeeper friction is a real support burden.
- For enterprise or institutional adoption, unsigned binaries are often a non-starter.

**Cross-platform risk**
- The packaging story is weakest on macOS, where binary distribution expectations are stricter.

**Opportunity**
- Add signing/notarization to the release process or publish a clearly supported “script-only” path if signed binaries are out of scope.

**Open question**
- Is distributing unsigned desktop binaries still an acceptable product decision, or should hosted deployment become the primary distribution path?

---

### 7. PyInstaller packaging is minimally verified and has no smoke test step

**Severity:** Medium
**Type:** Release quality / packaging debt

**Evidence**
- `.github/workflows/release.yml:30` installs `pyinstaller` and `loguru` directly with `pip install`.
- `.github/workflows/release.yml:44-54` builds platform binaries.
- The workflow has no post-build smoke test, launch check, import test, or artifact inspection.

**Why this matters**
- Packaging errors, missing Tcl/Tk runtime issues, and frozen-mode path bugs can slip into releases undetected.
- This is especially relevant because frozen-mode behavior differs from source-mode behavior, including log location handling.

**Cross-platform risk**
- Tkinter/PyInstaller combinations are particularly sensitive across OSes.

**Opportunity**
- Add at least one smoke test per OS (artifact exists, binary starts, help/launch path works, or import sanity check).

---

### 8. README support claims appear stronger than the verification evidence

**Severity:** Medium
**Type:** Documentation / support-risk mismatch

**Evidence**
- `README.md:14-16` says Windows, macOS, and Linux are “Fully Supported”.
- `README.md:16` says Linux is “Tested on Ubuntu/Debian”.
- No project tests were found in:
  - `/home/sam/dev/endnote-exporter/testing/**/*.py`
  - `/home/sam/dev/endnote-exporter/tests/**/*.py`
  - `/home/sam/dev/endnote-exporter/*test*.py`
- The `testing/` directory currently contains a sample archive (`testing/RefsEnschede.enlp.zip`) rather than executable tests.

**Why this matters**
- The repo has CI build automation, but not CI validation of runtime behavior.
- Support claims without automated verification increase maintenance risk and user surprise.

**Opportunity**
- Downgrade wording to “supported / intended to work” until there is real matrix validation, or add lightweight regression tests.

---

### 9. `endnote_exporter.py` is carrying too many responsibilities

**Severity:** Medium
**Type:** Maintainability / modularity / web-port blocker

**Evidence**
- `endnote_exporter.py` contains:
  - runtime log configuration (`lines 13-46`)
  - `.enlp` path resolution (`142-177`)
  - export orchestration (`182-355`)
  - record mapping (`367+`)
  - XML rendering (`659+`)
  - XML comparison/reporting (`925+` through end)
- `README.md` and `CLAUDE.md` describe this file as the main core module of roughly ~1100 lines.

**Why this matters**
- The file mixes:
  - app configuration
  - platform/file concerns
  - data extraction
  - transformation rules
  - XML serialization
  - diagnostic comparison tooling
- That makes changes riskier and obscures a natural service boundary for a future web/API layer.

**Web-port impact**
- A hosted port wants a narrow export API, not a module that also bootstraps logging and contains comparison tooling.

**Opportunity**
- Split into exporter/service, xml serialization, attachment handling, platform/runtime config, and comparator/test utilities.

---

### 10. GUI-only entrypoint and native dialogs limit reuse

**Severity:** Medium
**Type:** GUI coupling / product surface limitation / web-port blocker

**Evidence**
- `gui.py:20` defines the main app class.
- `gui.py:59` and `gui.py:110` use native dialogs as the primary I/O contract.
- `gui.py:169-173` is the only obvious runtime entrypoint.
- `pyproject.toml` has no `project.scripts`, `gui-scripts`, or other declared entrypoints.

**Why this matters**
- There is reusable core logic, but operationally the app is still centered around a desktop GUI.
- There is no CLI, service wrapper, or job-style interface.

**Web-port impact**
- A hosted version would need a new interface contract from scratch rather than adapting an existing non-GUI entrypoint.

**Opportunity**
- Add a CLI or programmatic service boundary before any web work. That reduces risk for both desktop automation and hosted deployment.

---

### 11. Path utility layer exists but is only partially integrated

**Severity:** Medium
**Type:** Incomplete abstraction / dead-or-underused code

**Evidence**
- `platform_utils.py:7-27` defines `get_application_path()`, `normalize_path()`, and `is_valid_path()`.
- Search results show these functions are defined in project code but not referenced by runtime modules outside planning docs.

**Why this matters**
- The project added a platform abstraction layer, but core path handling still uses bespoke logic in multiple places.
- This is a classic “started abstraction, not finished integration” debt shape.

**Opportunity**
- Either adopt the utility layer consistently or remove dead abstractions to avoid misleading future maintainers.

---

### 12. Success reporting may overstate export completeness

**Severity:** Medium
**Type:** Data integrity / UX debt

**Evidence**
- `endnote_exporter.py:245-247` loads all non-trash refs.
- `endnote_exporter.py:279-302` may skip individual records on errors.
- `endnote_exporter.py:359` logs `Exported {len(all_refs)} references...`.
- `gui.py:160-163` displays success using `count[0]` from the exporter.

**Why this matters**
- The count returned/logged appears based on all fetched refs, not necessarily successfully serialized refs.
- If records are skipped, success messaging can be misleading.

**Web-port impact**
- Hosted jobs need precise, auditable status: total records, succeeded, skipped, failed reasons.

**Opportunity**
- Return structured export statistics rather than a simple count/path tuple.

## Explicit TODO/FIXME/HACK findings

No first-party `TODO`, `FIXME`, or `HACK` comments were found in the application code files reviewed:
- `/home/sam/dev/endnote-exporter/endnote_exporter.py`
- `/home/sam/dev/endnote-exporter/gui.py`
- `/home/sam/dev/endnote-exporter/platform_utils.py`

That said, the absence of markers does **not** mean low debt. Most debt here is implicit architectural debt rather than commented debt.

## Opportunities

### Near-term, low-risk improvements
- Unify log/config/runtime path handling used by GUI and exporter.
- Remove duplicated `.enlp` resolution logic.
- Report accurate export stats including skipped records.
- Add one or two fixture-based regression tests around `.enl` and `.enlp` input handling.
- Add a post-build smoke test to the GitHub Actions release job.

### Medium-term improvements
- Introduce a non-GUI entrypoint (CLI or service function).
- Separate pure transformation logic from file dialog / filesystem / logging concerns.
- Make attachment handling pluggable instead of always serializing absolute local paths.

### Strategic improvements for a hosted web port
- Define a canonical input model for uploaded libraries (`.enl` + `.Data`, unpacked `.enlp`, maybe zipped `.enlp`).
- Replace local-path output with streamed or object-stored outputs.
- Decide whether attachment links should be omitted, remapped, or uploaded and re-hosted.
- Split desktop-only concerns (Tkinter, native dialogs, local log files) from reusable export logic.

## Open questions

1. **Archive support:** Should `.enlp.zip` be accepted as a supported input, especially for web uploads?
2. **Attachment policy:** In a hosted port, should PDF attachments become hosted URLs, downloadable bundles, or be omitted entirely?
3. **Success semantics:** Should the app fail hard on the first bad record, or succeed with a partial export plus an explicit skipped-record report?
4. **Distribution strategy:** Is continuing to ship unsigned desktop binaries acceptable, or should the project prioritize signed binaries / hosted delivery?
5. **Compatibility claims:** Are there actual manual or automated validation records backing the README’s “Fully Supported” claims for macOS and Linux?
6. **Service boundary:** Is the intended future web port a thin wrapper around existing export logic, or a broader product that also manages attachments and user libraries?

## Summary list of top debt items

1. Inconsistent log-file locations between `gui.py` and `endnote_exporter.py`.
2. Heavy reliance on local filesystem paths, including absolute PDF paths.
3. Partial `.enlp` support with no zipped-archive handling and duplicated resolution logic.
4. Unsigned/unnotarized PyInstaller artifacts, especially on macOS.
5. No project test suite or packaging smoke tests despite broad platform-support claims.
6. Large, multi-responsibility `endnote_exporter.py` that will make a web port harder.
