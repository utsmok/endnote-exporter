# Test Research: current posture, gaps, and opportunities

## Scope

This document is a **research-only** assessment of the current testing posture for `/home/sam/dev/endnote-exporter`.

It covers:
- existing test files, fixtures, helpers, and validation workflows
- CI/release validation currently in place
- coverage gaps, especially around cross-platform paths, macOS package handling, packaging/release verification, and future web-port concerns
- suggested ways to organize tests for **Goal A** (desktop cross-platform hardening) and **Goal B** (hosted web port)

Context for the two goals comes from `docs/platform-and-web-port/research/00_setup.md:7-8,101-153`.

---

## Findings

### 1. There is effectively no first-party automated test suite today

Current repository structure shows no `tests/` package and no first-party test modules under the project root. The only project-owned item inside `testing/` is:

- `testing/RefsEnschede.enlp.zip`

Supporting evidence:
- root structure contains `testing/` but no `tests/` directory
- `testing/` currently contains only `RefsEnschede.enlp.zip`
- prior repo research already noted the same gap in `docs/platform-and-web-port/research/07_issues_debt.md:23,198-216,382`

This means the project currently has **fixture data without executable tests**.

### 2. No test framework or coverage tooling is configured in project metadata

`pyproject.toml` declares runtime dependencies and a single dev dependency group entry for Ruff, but no `pytest`, `coverage`, `pytest-cov`, `tox`, or equivalent:

- `pyproject.toml:8-10` — runtime dependencies are `loguru` and `pyinstaller`
- `pyproject.toml:16` — dev dependency group currently contains `ruff>=0.13.0`

There is therefore no repository-declared test runner, no coverage threshold, and no standardized command for running tests.

### 3. Quality checks are documented, but not test-oriented

`CLAUDE.md` documents developer commands for:
- launching the GUI: `CLAUDE.md:26`
- Ruff lint/fix and formatting: `CLAUDE.md:29-30`
- type checking with `ty`: `CLAUDE.md:31`
- building with PyInstaller: `CLAUDE.md:34`

These are useful for static quality and packaging, but they do **not** provide behavioral verification.

### 4. CI is release/build automation, not test automation

The only workflow found is `.github/workflows/release.yml`.

Relevant behaviors:
- tag-triggered only: `.github/workflows/release.yml:7-8`
- OS matrix build on Windows/macOS/Linux: `.github/workflows/release.yml:16`
- dependency installation via direct `pip install pyinstaller loguru`: `.github/workflows/release.yml:30`
- PyInstaller build steps: `.github/workflows/release.yml:44-56`
- release publishing: `.github/workflows/release.yml:63-64`

Notably absent from the workflow:
- no lint step
- no type-check step
- no unit/integration test step
- no coverage collection
- no post-build smoke test
- no artifact validation beyond “build and upload”

This aligns with the earlier documentation gap already called out in `docs/platform-and-web-port/research/07_issues_debt.md:198-216`.

### 5. The repo does contain a few reusable *test seams*, but they are not being exercised

Even without a test suite, the code already exposes useful units/helpers that are testable in isolation:

#### `platform_utils.py`
- `platform_utils.py:7` — `get_application_path()`
- `platform_utils.py:14` — `normalize_path()`
- `platform_utils.py:22` — `is_valid_path()`
- `platform_utils.py:31` — `find_data_folder()`
- `platform_utils.py:58` — `get_documents_folder()`
- `platform_utils.py:102` — `_get_windows_documents_folder()`
- `platform_utils.py:123` — `_get_xdg_documents_folder()`
- `platform_utils.py:153` — `get_endnote_default_directory()`
- `platform_utils.py:161` — `validate_file_extension()`

#### `endnote_exporter.py`
- `endnote_exporter.py:142` — `_resolve_enl_path()`
- `endnote_exporter.py:182-195` — input/output extension validation in `export_references_to_xml()`
- `endnote_exporter.py:206-242` — path resolution, `.Data` lookup, and SQLite DB path construction
- `endnote_exporter.py:603` — absolute PDF path resolution
- `endnote_exporter.py:928` — `XMLComparator`
- `endnote_exporter.py:1266` — `compare_xml_files()` helper

#### `gui.py`
- `gui.py:56` — `get_endnote_default_directory()` integration in file selection
- `gui.py:60-64` — file dialog support for both `*.enl` and `*.enlp`
- `gui.py:81-95` — nested `count_errors()` helper that parses log output
- `gui.py:131-134` — GUI/export integration boundary

These are all plausible candidates for unit or integration tests, but none are currently wired into automated verification.

### 6. The only fixture currently present appears mismatched with the current database-path assumption

The current export path logic assumes the EndNote database lives at:
- `endnote_exporter.py:232` — `data_path / "sdb" / "sdb.eni"`

However, the only project fixture archive, `testing/RefsEnschede.enlp.zip`, expands to a structure containing:
- `RefsEnschede.enlp/RefsEnschede.enl`
- `RefsEnschede.enlp/RefsEnschede.Data/rdb/...`
- `RefsEnschede.enlp/RefsEnschede.Data/tdb/...`

and **does not show an `sdb/sdb.eni` path**.

That creates an important research finding:
- either the fixture is for a different/older EndNote package layout than the current exporter expects,
- or the exporter currently does not support all real-world `.enlp` variants that the fixture suggests are relevant.

This is especially important for:
- macOS package support
- backward compatibility claims
- any Goal B plan to accept `.enlp` packages or `.zip` uploads

### 7. README support claims are much stronger than the verification evidence

The README presents broad support claims:
- `README.md:10-16` — Windows, macOS, and Linux marked “Fully Supported”
- `README.md:22` — macOS security exceptions note
- `README.md:30` — users are directed to download release artifacts

But there is no matching automated validation record in the repo for those claims:
- no unit/integration tests
- no package smoke tests
- no artifact inspection
- no release readiness checklist checked into CI

There is also a small developer-doc drift worth noting:
- `README.md:45-48` says the script has “no external dependencies”
- `pyproject.toml:8-10` declares `loguru` and `pyinstaller`

That mismatch is not itself a test issue, but it makes contributor expectations around local validation less clear.

---

## Issues

### 1. Cross-platform path logic is largely unverified

High-value path logic currently has no automated coverage:
- `platform_utils.py:31-54` — case-insensitive `.Data` lookup with `PermissionError` swallow path
- `platform_utils.py:58-100` — platform-specific Documents folder discovery and fallback chain
- `platform_utils.py:102-121` — Windows `SHGetFolderPathW` path lookup
- `platform_utils.py:123-151` — Linux/XDG Documents discovery from environment and `user-dirs.dirs`
- `platform_utils.py:153-158` — EndNote default directory derivation
- `platform_utils.py:161-178` — extension validation logic

Biggest missing scenarios:
- non-English / non-default Windows Documents locations
- Linux `XDG_DOCUMENTS_DIR` override and malformed `user-dirs.dirs`
- macOS fallback behavior when `~/Documents` does not exist
- case-sensitive filesystems and mixed-case `.Data` names
- permission-denied during directory enumeration

### 2. macOS package handling is only partially evidenced

`.enlp` support exists in code and GUI selection:
- `gui.py:63-64`
- `endnote_exporter.py:142-171`
- `endnote_exporter.py:206-213`

But there are no tests covering:
- package with embedded `.enl` and matching `.Data`
- package with no `.enl` but one `.Data` folder (fallback branch)
- package with multiple `.enl` files
- package with mixed-case `.Data` naming
- package with missing `sdb/sdb.eni`
- package ZIP extraction workflows relevant to Goal B

The lone fixture suggests that “real” `.enlp` inputs may not always match the exporter’s current `sdb/sdb.eni` assumption.

### 3. Packaging/release verification is a major blind spot

Current workflow behavior is “build and publish,” not “verify and publish”:
- `.github/workflows/release.yml:44-56` builds artifacts
- `.github/workflows/release.yml:63-64` publishes them

Missing checks include:
- executable exists at expected path after build
- binary/app launches successfully
- Tkinter import works in packaged artifact
- app bundle structure is sane on macOS
- universal2 artifact really contains both architectures
- release artifact can perform a smoke export against a tiny fixture
- unsigned macOS artifact behavior is at least documented by a reproducible QA checklist

### 4. Goal B-relevant upload/archive scenarios are almost entirely untested today

`00_setup.md` defines Goal B as accepting a library folder, `.zip`, or `.enlp` package (`docs/platform-and-web-port/research/00_setup.md:8,133-148`), but current test assets and code validation do not cover that future surface.

Specifically untested today:
- archive extraction and normalization
- uploaded path hint interpretation
- zip bomb / oversized archive handling
- archive traversal safety (`..`, absolute paths, symlinks)
- portability policy for attachment references
- replacing desktop absolute PDF paths with a hosted-storage model

### 5. Existing comparison utility is not integrated into any regression harness

`XMLComparator` and `compare_xml_files()` exist at `endnote_exporter.py:928-1266`, which is promising, but there is no test harness or golden-file workflow around them.

That means the project already has the beginnings of a regression oracle, but not an automated way to use it.

---

## Opportunities

### 1. Start with a pragmatic Goal A test pyramid

A practical desktop-focused structure could be:

```text
tests/
  unit/
    test_platform_utils.py
    test_path_resolution.py
    test_file_validation.py
    test_xml_helpers.py
  integration/
    test_export_enl.py
    test_export_enlp.py
    test_xml_regression.py
  fixtures/
    enl/
    enlp/
    xml/
  release/
    test_packaged_artifact_smoke.py
```

Suggested mapping:
- `tests/unit/test_platform_utils.py`
  - `platform_utils.py:7-178`
  - use monkeypatching for `sys.platform`, environment variables, and filesystem fixtures
- `tests/unit/test_path_resolution.py`
  - `endnote_exporter.py:142-232`
  - focus on `.enl`, `.enlp`, `.Data` lookup, and DB-path derivation
- `tests/integration/test_export_enl.py`
  - small representative `.enl` + `.Data` fixture with `sdb/sdb.eni`
- `tests/integration/test_export_enlp.py`
  - representative `.enlp` fixture(s), ideally covering more than one package layout if both are supported
- `tests/integration/test_xml_regression.py`
  - use `XMLComparator` to compare exporter output to checked-in goldens
- `tests/release/test_packaged_artifact_smoke.py`
  - artifact existence + startup + minimal export smoke checks per OS

This matches the repo’s own earlier planning direction:
- `docs/cross-platform-compatibility/reviews/review_1.md:367,369,391,446`
- `docs/cross-platform-compatibility/reviews/review_2.md:136,265,366,380,409`
- `docs/cross-platform-compatibility/plans/plan_b_balanced.md` already sketches `tests/test_platform_utils.py`, `tests/test_exporter.py`, and `tests/test_gui.py`

### 2. Reuse `XMLComparator` as the regression engine

Instead of inventing a full assertion layer from scratch, the current comparator can anchor XML-regression tests:
- golden EndNote XML output or previously approved exporter XML
- compare exported XML and fail on unexpected structural/content diffs
- selectively ignore known-noisy fields using the existing ignore list in `XMLComparator`

This is one of the highest-leverage existing assets in the codebase.

### 3. Upgrade CI from release-only to validate-then-release

A safer pipeline shape for Goal A would be:
1. lint + type-check on push/PR
2. unit/integration tests on push/PR across OS matrix where practical
3. build artifacts on tag
4. run post-build smoke verification before publishing release

Minimum improvement even before a full suite exists:
- add one smoke test per OS, as already recommended in `docs/platform-and-web-port/research/07_issues_debt.md:216,354`

### 4. Turn the existing fixture archive into a clarified fixture set

`testing/RefsEnschede.enlp.zip` is valuable, but currently ambiguous.

It would be more useful if the fixture strategy explicitly distinguished:
- “supported current package layout” fixtures
- “legacy/alternate package layout” fixtures
- “expected-to-fail” malformed fixtures
- tiny deterministic fixtures for CI
- larger realism fixtures for manual or optional integration runs

For Goal B, zipped fixtures will be essential anyway, so this area has strong reuse potential.

### 5. Keep Goal B test organization separate from Goal A desktop packaging tests

A sensible future Goal B-oriented structure would be:

```text
tests_web/
  unit/
    test_archive_intake.py
    test_package_normalization.py
    test_attachment_policy.py
  integration/
    test_upload_zip.py
    test_upload_enlp.py
    test_job_lifecycle.py
  security/
    test_path_traversal.py
    test_archive_limits.py
    test_reject_unsupported_layouts.py
  e2e/
    test_export_download_flow.py
```

Why separate it from Goal A:
- Goal A is still fundamentally desktop + PyInstaller + native path behavior
- Goal B introduces upload safety, archive extraction, temp storage, and hosted attachment semantics
- mixing those concerns too early would blur failure attribution and slow progress

---

## How tests could be organized for both goals

### Goal A: desktop cross-platform compatibility and distribution

Recommended priorities:

1. **Unit tests first**
   - `platform_utils.py`
   - file extension validation
   - `.enl` / `.enlp` path resolution
   - `.Data` discovery

2. **Integration tests second**
   - export a tiny `.enl` fixture end-to-end
   - export a tiny `.enlp` fixture end-to-end
   - assert output XML shape and/or compare against golden XML

3. **Release smoke tests third**
   - run on built artifacts in CI
   - verify packaged app/binary exists and starts
   - ideally run one small export smoke test per OS

4. **Manual platform checklist retained for edge environments**
   - Gatekeeper behavior
   - localized Windows Documents resolution
   - macOS Intel vs Apple Silicon user experience
   - Linux Tkinter packaging/distribution variance

### Goal B: hosted web port

Recommended priorities:

1. **Archive intake unit tests**
   - `.zip`, `.enlp`, raw folder normalization
   - supported vs unsupported package layouts
   - source path hint parsing

2. **Security and robustness tests**
   - path traversal
   - unexpected symlinks
   - huge archives / file count limits
   - malformed uploads

3. **Service integration tests**
   - upload -> extraction -> export -> downloadable XML
   - temp file cleanup
   - job failure handling

4. **Attachment/path policy tests**
   - current desktop behavior uses absolute PDF paths (`README.md:6`, `endnote_exporter.py:603`)
   - Goal B will need explicit tests for whatever replaces that behavior (uploaded attachments, stored blobs, omitted attachment links, etc.)

5. **End-to-end browser/API tests later**
   - only after upload and processing contracts are settled

---

## Open questions

1. **What `.enlp` layouts must be supported in practice?**
   The existing fixture archive looks different from the code’s `sdb/sdb.eni` assumption. Is that fixture representative of a real library variant that must work?

2. **Should Goal A support `.zip` inputs at all, or is that strictly Goal B?**
   `testing/RefsEnschede.enlp.zip` exists today, but the app currently accepts `.enl` and `.enlp`, not `.zip`.

3. **What is the desired minimum confidence bar for desktop releases?**
   Is artifact existence enough, or should each OS artifact perform a real smoke export in CI before release publishing?

4. **What level of macOS validation is expected?**
   Build-only? Launch-only? Universal2 arch verification? Gatekeeper/manual notarization workflow?

5. **Should XML regression be based on golden files, `XMLComparator`, or both?**
   The comparator already exists, but golden inputs/outputs and acceptance criteria are not yet formalized.

6. **How small can the canonical CI fixtures be made?**
   Cross-platform release smoke tests will be easier to run consistently if there is at least one tiny deterministic library per supported layout.

7. **For Goal B, what is the intended attachment policy?**
   The current exporter writes absolute local PDF paths. A hosted service cannot safely or meaningfully reuse that behavior unchanged.

---

## Bottom line

Current test posture is **very weak**:
- no first-party automated test suite
- no configured test runner or coverage tooling
- no CI validation beyond building and publishing release artifacts
- one promising comparator utility and one ambiguous fixture archive, but no harness around either

The biggest gaps are:
1. **untested cross-platform path logic**
2. **untested/macOS package-layout ambiguity**
3. **no packaging/release smoke verification**
4. **no test foundation for Goal B archive/upload behavior**

The good news: the code already exposes several clean, testable seams, and the repo’s earlier planning documents already point toward a sensible incremental test strategy for Goal A. Goal B should reuse the export core where possible, but its upload/archive/security tests should be organized as a clearly separate track.
