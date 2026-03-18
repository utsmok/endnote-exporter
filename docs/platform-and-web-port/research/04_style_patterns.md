# Style and Pattern Research for Platform and Web Port

## Research Date

2026-03-18

## Scope

Research only. No application code was modified.

Files reviewed:

- `/home/sam/dev/endnote-exporter/endnote_exporter.py`
- `/home/sam/dev/endnote-exporter/gui.py`
- `/home/sam/dev/endnote-exporter/platform_utils.py`
- `/home/sam/dev/endnote-exporter/pyproject.toml`
- `/home/sam/dev/endnote-exporter/.github/workflows/release.yml`
- `/home/sam/dev/endnote-exporter/README.md`
- `/home/sam/dev/endnote-exporter/CLAUDE.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/00_setup.md`
- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility_PLAN.md`
- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility/research/04_style_patterns.md`

---

## Executive Summary

The repository has a clear, pragmatic style:

1. **Thin desktop UI, heavy core logic**
   - `gui.py` is a relatively small Tkinter shell around the exporter (`/home/sam/dev/endnote-exporter/gui.py:20`, `:62`, `:81`, `:169`).
   - `endnote_exporter.py` contains the bulk of business logic, XML generation, logging setup, helpers, and comparison utilities (`/home/sam/dev/endnote-exporter/endnote_exporter.py:33`, `:181`, `:204`, `:928`, `:1266`).

2. **Platform-specific behavior is intentionally isolated**
   - Cross-platform path and file conventions live in `platform_utils.py` (`/home/sam/dev/endnote-exporter/platform_utils.py:31`, `:58`, `:153`, `:161`).
   - This is the strongest current pattern to preserve for additional desktop/platform work.

3. **The project is explicitly desktop-first, not web-first**
   - The research setup says the repo is a desktop app first, not a service or monorepo (`/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/00_setup.md:21`).
   - The same doc recommends treating desktop hardening and a hosted web port as separate tracks (`/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/00_setup.md:159`).

4. **CI favors simple, direct release automation over elaborate build orchestration**
   - One GitHub Actions matrix job builds for Windows, macOS, and Linux (`/home/sam/dev/endnote-exporter/.github/workflows/release.yml:16`).
   - Packaging is done directly with PyInstaller commands rather than via custom scripts (`/home/sam/dev/endnote-exporter/.github/workflows/release.yml:47`, `:54`).

---

## Findings

### 1. Code organization favors a small-number-of-files layout

The repository still follows a compact script-style architecture rather than a multi-package application.

Evidence:

- `CLAUDE.md` documents the project as a small set of primary files under the repo root (`/home/sam/dev/endnote-exporter/CLAUDE.md:5`, `:16`).
- The exporter class, XML helpers, constants, and comparison utility all live in one module (`/home/sam/dev/endnote-exporter/endnote_exporter.py:63`, `:80`, `:96`, `:181`, `:864`, `:928`, `:1266`).
- The GUI is kept in its own file and imports only the exporter entry point plus platform helpers (`/home/sam/dev/endnote-exporter/gui.py:5`, `:7`, `:20`).

Interpretation:

- The preferred style is **simple and centralized**, with only a few top-level files.
- New work should preserve the existing separation by concern, but avoid unnecessary framework-style sprawl unless the repo genuinely outgrows the current footprint.

### 2. Naming conventions are standard modern Python

The codebase uses conventional Python naming consistently.

Evidence:

- Classes use `CapWords`: `EndnoteExporter`, `XMLComparator`, `ExporterApp` (`/home/sam/dev/endnote-exporter/endnote_exporter.py:181`, `:928`; `/home/sam/dev/endnote-exporter/gui.py:20`).
- Functions and methods use `snake_case`: `_resolve_enl_path`, `export_references_to_xml`, `find_data_folder`, `get_documents_folder`, `validate_file_extension` (`/home/sam/dev/endnote-exporter/endnote_exporter.py:142`, `:182`, `:923`; `/home/sam/dev/endnote-exporter/platform_utils.py:31`, `:58`, `:161`).
- Internal/helper functions are prefixed with `_` when intended as private details (`/home/sam/dev/endnote-exporter/endnote_exporter.py:102`, `:115`, `:134`, `:142`; `/home/sam/dev/endnote-exporter/platform_utils.py:102`, `:123`).

Interpretation:

- Future implementation plans should continue using conventional Python names rather than inventing app-specific naming schemes.
- A future web service should follow the same pattern: public workflow entry points without leading underscores, low-level helpers hidden behind `_private` functions or internal modules.

### 3. Type hints and `Path`-centric APIs are part of the house style

The docs and code agree that modern Python typing and `pathlib.Path` are preferred.

Evidence:

- `CLAUDE.md` explicitly says the codebase uses `pathlib.Path` exclusively (`/home/sam/dev/endnote-exporter/CLAUDE.md:40`).
- `Path` is imported at the top of all main Python modules (`/home/sam/dev/endnote-exporter/endnote_exporter.py:1`, `/home/sam/dev/endnote-exporter/platform_utils.py:3`).
- Public utility functions return `Path` or `Path | None` (`/home/sam/dev/endnote-exporter/platform_utils.py:7`, `:31`, `:58`, `:102`, `:123`, `:153`).
- Helper functions use modern inline type syntax such as `str | None`, `tuple[int, list[str]]`, `list[Any]` (`/home/sam/dev/endnote-exporter/endnote_exporter.py:102`, `:115`, `:134`; `/home/sam/dev/endnote-exporter/gui.py:81`).

Interpretation:

- Future desktop and web work should keep file/path APIs in `Path` form internally and only convert to string at integration boundaries.
- If a web service is introduced, uploaded content handling should still be normalized to `Path` objects within the processing layer for consistency.

### 4. The code is defensive and explicit around IO, sanitization, and logging

The exporter shows a recurring pattern: validate inputs, sanitize values, log extensively, degrade gracefully.

Evidence:

- Loguru is configured centrally with rotation, async-safe queueing, and rich diagnostics (`/home/sam/dev/endnote-exporter/endnote_exporter.py:31`, `:33`, `:38`, `:39`, `:41`, `:42`).
- Invalid XML characters are stripped via a compiled regex and `safe_str()` helper (`/home/sam/dev/endnote-exporter/endnote_exporter.py:56`, `:904`).
- Input/output extensions are validated before export (`/home/sam/dev/endnote-exporter/endnote_exporter.py:182`; `/home/sam/dev/endnote-exporter/platform_utils.py:161`).
- File writes use explicit UTF-8 and `Path.open()` (`/home/sam/dev/endnote-exporter/endnote_exporter.py:264`, `:352`).
- The GUI counts warnings/errors after an export and surfaces them in a user-facing dialog (`/home/sam/dev/endnote-exporter/gui.py:81`, `:140`).

Interpretation:

- The repo prefers **defensive pragmatism** over minimalism.
- Future plans should preserve input validation, explicit encodings, and structured logs—especially important if web uploads are added.

### 5. Desktop-platform work is expected to flow through `platform_utils.py`

The current style strongly suggests a preferred home for OS-specific concerns.

Evidence:

- `gui.py` depends on `get_endnote_default_directory()` instead of hard-coding a documents path (`/home/sam/dev/endnote-exporter/gui.py:7`).
- `endnote_exporter.py` imports `find_data_folder()` and `validate_file_extension()` from the platform helper module (`/home/sam/dev/endnote-exporter/endnote_exporter.py:14`).
- `platform_utils.py` already owns application path detection, case-insensitive folder lookup, documents-directory discovery, and extension validation (`/home/sam/dev/endnote-exporter/platform_utils.py:7`, `:31`, `:58`, `:153`, `:161`).

Interpretation:

- For future desktop/platform implementation, **do not scatter platform branches across GUI and exporter logic**.
- The established style is to push platform decisions into a narrow helper layer and keep core export logic largely platform-neutral.

### 6. GitHub Actions patterns are simple, matrix-based, and release-oriented

The CI workflow is straightforward and easy to reason about.

Evidence:

- One matrix covers all target operating systems (`/home/sam/dev/endnote-exporter/.github/workflows/release.yml:16`).
- The workflow matches the Python baseline from the project config (`/home/sam/dev/endnote-exporter/.github/workflows/release.yml:27`; `/home/sam/dev/endnote-exporter/pyproject.toml:7`).
- Dependency installation is direct and minimal (`/home/sam/dev/endnote-exporter/pyproject.toml:8-10`; `/home/sam/dev/endnote-exporter/.github/workflows/release.yml:30`).
- Packaging diverges only where platform differences require it: onefile for Windows/Linux, onedir universal2 app for macOS (`/home/sam/dev/endnote-exporter/.github/workflows/release.yml:47`, `:54`, `:60-61`).
- Release publishing is delegated to `softprops/action-gh-release` (`/home/sam/dev/endnote-exporter/.github/workflows/release.yml:64`).

Interpretation:

- Future CI changes should stay **incremental and explicit**.
- Plans should prefer matrix expansion, isolated OS-specific branches, and direct commands over introducing a custom release framework too early.

### 7. Documentation has a recognizable planning/reporting structure

The docs under `docs/` use a repeatable style that implementation plans should preserve.

Evidence:

- `00_setup.md` uses clear purpose/scope framing and explicit scope boundaries (`/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/00_setup.md`).
- The cross-platform plan opens with date, status, recommended approach, goals, and phased task breakdown (`/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility_PLAN.md:6`).
- `CLAUDE.md` acts as a concise maintainer-oriented technical reference with sections for project structure, development commands, and architecture notes (`/home/sam/dev/endnote-exporter/CLAUDE.md:5`, `:22`, `:37`, `:55`).
- `README.md` is user-facing and organized by platform support, platform-specific notes, and a contributor section (`/home/sam/dev/endnote-exporter/README.md:10`, `:18`, `:43`).

Interpretation:

- Future plans/research docs should keep using: **executive summary → findings/issues → opportunities → open questions**.
- Operational docs should keep a strong distinction between developer-facing reference (`CLAUDE.md`), user-facing guidance (`README.md`), and initiative-specific research/plans (`docs/...`).

### 8. The current style suggests a preferred structure for desktop work

The codebase strongly suggests this shape for future desktop/platform changes:

- GUI stays thin and event-oriented (`/home/sam/dev/endnote-exporter/gui.py:20`, `:62`, `:169`).
- Export/business logic stays outside the GUI entrypoint (`/home/sam/dev/endnote-exporter/gui.py:5`; `/home/sam/dev/endnote-exporter/endnote_exporter.py:181`).
- Platform-specific logic stays in helper utilities (`/home/sam/dev/endnote-exporter/platform_utils.py:58`, `:153`).
- Packaging details stay in GitHub Actions and PyInstaller commands (`/home/sam/dev/endnote-exporter/.github/workflows/release.yml:47`, `:54`).

Assessment:

- The repo does **not** suggest embedding more platform logic directly in the GUI.
- It **does** suggest continuing to isolate platform detection and packaging behavior away from export logic.

### 9. The current style suggests a cautious structure for a future web service

The repo’s docs already hint at the right boundary.

Evidence:

- The project is described as desktop-first, not a service/monorepo (`/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/00_setup.md:21`).
- Desktop hardening and hosted web port work are explicitly recommended as separate tracks (`/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/00_setup.md:159`).

Assessment:

- A future web service should **reuse exporter logic**, but **not** be folded directly into `gui.py` or PyInstaller-specific paths.
- The style of the current repo suggests a boundary like:
  - reusable export core
  - desktop entrypoint
  - web/service entrypoint
- Whether that lives in one repo or two is still open, but the current style argues for **separation by runtime concern**, not by premature framework adoption.

---

## Issues

### 1. `README.md` contains stale developer instructions

Evidence:

- The README says the app uses only the core library (`/home/sam/dev/endnote-exporter/README.md:45`), but `pyproject.toml` declares `loguru` and `pyinstaller` dependencies (`/home/sam/dev/endnote-exporter/pyproject.toml:8-10`).
- The README tells contributors to run `endnote_exporter_gui.py` (`/home/sam/dev/endnote-exporter/README.md:48`), but the actual entrypoint documented elsewhere is `gui.py` (`/home/sam/dev/endnote-exporter/CLAUDE.md:26`).

Why it matters:

- Future plans should treat `CLAUDE.md` and the actual code layout as more authoritative than the current README developer section.

### 2. Build naming is not fully consistent across docs and workflow

Evidence:

- `CLAUDE.md` shows `pyinstaller --onefile --windowed --name "EndNote Exporter" gui.py` (`/home/sam/dev/endnote-exporter/CLAUDE.md:34`).
- The workflow produces `endnote-exporter.exe`, `endnote-exporter`, and `endnote-exporter-macos.zip` (`/home/sam/dev/endnote-exporter/.github/workflows/release.yml:37`, `:39`, `:41`, `:60-61`).

Why it matters:

- Future implementation plans that touch packaging/distribution should explicitly decide which naming convention is canonical.

### 3. `endnote_exporter.py` is functionally cohesive but structurally dense

Evidence:

- The file combines logging setup, constants, exporter logic, XML helpers, and an XML comparison utility (`/home/sam/dev/endnote-exporter/endnote_exporter.py:33`, `:63`, `:181`, `:864`, `:928`, `:1266`).

Why it matters:

- This is manageable today, but it is the main obstacle to clean reuse by a future web service.
- For planning purposes, the reusable export core is present, but it is not yet sharply separated from adjacent concerns.

### 4. CI is minimal and release-focused, not validation-heavy

Evidence:

- `CLAUDE.md` documents local quality commands for Ruff and type checking (`/home/sam/dev/endnote-exporter/CLAUDE.md:29-31`).
- The GitHub workflow shown is focused on build-and-release steps (`/home/sam/dev/endnote-exporter/.github/workflows/release.yml:16-64`) and does not show those quality gates.

Why it matters:

- Future implementation plans should not assume CI currently enforces the same local quality workflow documented for contributors.

---

## Opportunities

### 1. Preserve the current desktop boundary model

Best-fit pattern for future desktop work:

- Keep `gui.py` as a thin UI controller.
- Keep platform decisions in `platform_utils.py`.
- Keep export transformations in a reusable core.

This is already the most consistent architectural pattern in the repository.

### 2. Extract a runtime-neutral export core before serious web work

The current codebase already points in this direction:

- desktop-first app
- separate tracks for desktop and web research
- reusable exporter logic inside `endnote_exporter.py`

A future web service plan should preserve behavior while isolating:

- archive/package ingestion
- temporary storage and cleanup
- upload validation/security
- service/API concerns

from the XML conversion logic itself.

### 3. Align documentation around one authoritative developer workflow

The strongest current developer-source-of-truth is:

- `CLAUDE.md` development commands (`/home/sam/dev/endnote-exporter/CLAUDE.md:26`, `:29-31`)
- `pyproject.toml` dependency definitions (`/home/sam/dev/endnote-exporter/pyproject.toml:7-16`)

Plans that touch build, QA, or onboarding should reconcile README drift instead of copying it forward.

### 4. Reuse the existing docs pattern for future initiative artifacts

The existing research/plan documents already support a nice planning cadence:

- setup/context doc
- research notes
- plan doc
- review docs

That structure is worth preserving for the platform-and-web-port track.

---

## Open Questions

1. **Should the future web service live in this repo or as a separate deployment repo?**
   - The docs lean toward separate tracks, but not yet toward a specific repository boundary.

2. **What is the desired seam for reuse from `endnote_exporter.py`?**
   - Export transformation only?
   - Archive unpacking and path normalization too?
   - XML comparison tooling as a shared validation utility?

3. **How should PDF path handling work in a hosted service?**
   - The current exporter uses absolute file paths for local reliability (`README.md:6`, plus exporter URL/path-building behavior in `/home/sam/dev/endnote-exporter/endnote_exporter.py:181-352`).
   - A hosted service may need a different attachment strategy or an explicit “desktop-compatible export” mode.

4. **Should CI adopt the documented local quality commands?**
   - `CLAUDE.md` documents Ruff and type-checking commands (`/home/sam/dev/endnote-exporter/CLAUDE.md:29-31`), but the current workflow is release-centric.

5. **Which packaging name is canonical?**
   - Human-readable `EndNote Exporter` from maintainer docs or machine-friendly `endnote-exporter` from release automation?

---

## Recommended Conventions to Preserve

### Preserve as-is

- `pathlib.Path`-first file/path APIs
- standard Python naming (`CapWords`, `snake_case`, `_private_helpers`)
- explicit UTF-8 and defensive sanitization/logging
- thin GUI / heavy core / isolated platform utility split
- small, explicit GitHub Actions matrix with only necessary OS-specific branching
- clear documentation separation: README vs CLAUDE vs initiative docs

### Improve carefully, without changing the overall style

- reconcile stale README developer instructions
- define a canonical packaging name across docs and workflow
- isolate reusable export-core boundaries before adding web-specific runtime concerns
- consider adding CI quality checks that mirror documented local commands

---

## Bottom Line

The most important repo convention is this:

> **Keep runtime-specific code thin and keep the export logic reusable.**

Today that shows up as:

- `gui.py` for desktop interaction
- `platform_utils.py` for OS differences
- `endnote_exporter.py` for the actual export behavior
- one simple release workflow for packaging

For future work, the safest plan is to preserve that pattern and treat a hosted web service as a separate runtime boundary rather than an extension of the Tkinter app.
