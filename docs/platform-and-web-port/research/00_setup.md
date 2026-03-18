# Platform and Web Port Research Setup

## Purpose

This file establishes the initial research context for a two-part initiative in `/home/sam/dev/endnote-exporter`:

- **Goal A:** ensure the desktop app works correctly on Windows 10/11, macOS Intel, macOS Apple Silicon, and optionally Linux, with correct/easy-to-run binaries and special attention to macOS build, distribution, signing, and notarization constraints.
- **Goal B:** design a hosted web-based port where users can upload an EndNote library folder, a `.zip`, or a `.enlp` package plus a source path hint, and receive a downloadable Zotero-compatible XML export.

## Project type

Repository `/home/sam/dev/endnote-exporter` is currently a **Python 3.12+ desktop utility application** with these characteristics:

- Single-repo, small-footprint Python application
- **Tkinter GUI** entry point in `/home/sam/dev/endnote-exporter/gui.py`
- Core export logic in `/home/sam/dev/endnote-exporter/endnote_exporter.py`
- Cross-platform helpers in `/home/sam/dev/endnote-exporter/platform_utils.py`
- Packaging via **PyInstaller**
- Release automation via GitHub Actions workflow `/home/sam/dev/endnote-exporter/.github/workflows/release.yml`

In short: this is a **desktop app first**, not a web app, service, or multi-package monorepo.

## Documentation reviewed

### Required project documentation

- Read `/home/sam/dev/endnote-exporter/CLAUDE.md`
- Searched for `AGENTS.md` in the repository and found **none**

### Relevant context from `/home/sam/dev/endnote-exporter/CLAUDE.md`

Key facts pulled forward for future planning:

- The repo is described as a desktop app to export EndNote libraries to Zotero-compatible XML.
- Main code structure:
	- `/home/sam/dev/endnote-exporter/endnote_exporter.py`
	- `/home/sam/dev/endnote-exporter/gui.py`
	- `/home/sam/dev/endnote-exporter/platform_utils.py`
- Development commands documented in `CLAUDE.md`:
	- `uv run gui.py`
	- `uvx ruff check . --fix`
	- `uvx ruff format .`
	- `uvx ty check .`
	- `pyinstaller --onefile --windowed --name "EndNote Exporter" gui.py`
- Architectural notes already align with Goal A research:
	- Python 3.12+
	- `pathlib.Path` usage throughout
	- PyInstaller-aware executable handling
	- explicit cross-platform considerations for Windows, macOS, Linux
- EndNote format note relevant to both goals:
	- standard `.enl` + `.Data/` folder structure
	- macOS `.enlp` packages contain equivalent structure in a directory bundle

## Existing related docs and plans found

### Cross-platform research/planning artifacts

The repository already contains a substantial cross-platform planning track under `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility/`:

- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility_PLAN.md`
- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility/plans/plan_a_conservative.md`
- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility/plans/plan_b_balanced.md`
- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility/plans/plan_c_aggressive.md`
- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility/research/04_style_patterns.md`
- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility/reviews/review_1.md`
- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility/reviews/review_2.md`

### What those existing docs already cover

From the reviewed documents:

- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility_PLAN.md`
	- recommends **Plan B** with selected conservative elements
	- focuses on `.enlp` support, Documents folder detection, case-sensitive `.Data` lookup issues, README updates, and CI workflow improvements
- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility/reviews/review_2.md`
	- concludes the codebase has strong cross-platform foundations
	- recommends the balanced approach as best risk/reward
	- notes gaps such as limited cross-platform testing evidence and platform-specific behavior validation
- `/home/sam/dev/endnote-exporter/docs/cross-platform-compatibility/research/04_style_patterns.md`
	- documents strong existing use of `pathlib`, UTF-8 handling, and PyInstaller-aware code

### Build/package artifacts relevant to Goal A

- `/home/sam/dev/endnote-exporter/.github/workflows/release.yml`
	- builds on `windows-latest`, `macos-latest`, and `ubuntu-latest`
	- uses PyInstaller for release builds
	- builds macOS as a **Universal2** `.app` bundle and zips it
	- already mentions Gatekeeper bypass guidance for unsigned macOS builds

### Important gap identified

No existing repository documentation was found for:

- a **hosted web port** architecture or rollout plan
- server-side ingestion of uploaded EndNote libraries
- cloud deployment targets
- macOS **code signing**, **notarization**, **Developer ID** workflow, or distribution compliance beyond basic unsigned-app notes

## Suggested scope boundaries

### Goal A: desktop cross-platform compatibility and distribution

Keep Goal A focused on the **existing desktop application** and its packaging/distribution pipeline.

Recommended scope includes:

- runtime compatibility on:
	- Windows 10/11
	- macOS Intel
	- macOS Apple Silicon
	- Linux as optional/best-effort
- packaging outputs and install/run experience for each OS
- CI/CD and release artifact strategy
- PyInstaller platform constraints
- macOS-specific research for:
	- `.app` bundle shape
	- Universal2 vs per-arch builds
	- Gatekeeper behavior
	- Developer ID signing
	- notarization and stapling
	- distribution UX for unsigned vs signed binaries
- verification strategy using representative EndNote libraries (`.enl`, `.enlp`, attached PDFs, case-sensitive filesystems)

Recommended out of scope for Goal A:

- redesigning the desktop UI
- rewriting the exporter architecture unless strictly required for compatibility
- introducing a web frontend/backend into the same execution stream
- broad product changes unrelated to compatibility, packaging, or release quality

### Goal B: hosted web-based port

Keep Goal B focused on **product and technical design** for a new hosted service, not on modifying the current desktop app in-place.

Recommended scope includes:

- input model for uploads:
	- EndNote library folder
	- `.zip`
	- `.enlp` package
	- source path hint metadata
- backend extraction pipeline for uploaded archives/packages
- security model for untrusted uploaded files
- temporary storage, cleanup, and job lifecycle
- XML generation reuse strategy from existing Python exporter logic
- attachment/path handling rules in a hosted context
- constraints around absolute paths in generated XML versus web-hosted workflows
- UX for upload, validation, processing state, and download
- hosting/deployment options, scaling assumptions, and file size limits

Recommended out of scope for Goal B:

- native desktop packaging/signing details already covered by Goal A
- simultaneous full rewrite of the existing desktop tool
- production implementation before architecture, privacy, and file-handling constraints are researched

## Initial research framing recommendation

To keep the next phase clean, treat this initiative as **two linked but separate tracks**:

1. **Desktop platform hardening and distribution track**
2. **Hosted web-port product/architecture track**

The most important shared dependency is validating which parts of `/home/sam/dev/endnote-exporter/endnote_exporter.py` can be reused as a platform-neutral export core.

## Created planning workspace

The following directories were created for this initiative:

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/plans/`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/reviews/`
