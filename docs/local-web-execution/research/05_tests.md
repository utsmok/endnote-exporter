# Test Research for local browser-first execution

## Scope

This document assesses the current testing posture of `/home/sam/dev/endnote-exporter` and defines the testing strategy required if the project adds a **local-execution web implementation**.

It covers four candidate runtime families identified in `docs/local-web-execution/research/00_setup.md:216-218,274-351`:

1. browser-only web app
2. single-file self-contained HTML app
3. Electron desktop wrapper
4. Tauri desktop wrapper

The focus is **research only**. No application code changes are proposed here.

---

## Findings

### 1. Current repo test posture is weak and desktop-biased

There is still no first-party automated test suite in the repository:

- `pyproject.toml:8-16` declares runtime dependencies (`loguru`, `pyinstaller`) and one dev dependency (`ruff>=0.13.0`), but no `pytest`, coverage tooling, browser automation stack, or desktop E2E harness.
- `.github/workflows/release.yml:16,30,44,49,63` builds and publishes tagged artifacts on Windows/macOS/Linux, but does not run unit tests, integration tests, browser automation, or post-build smoke verification.
- `README.md:14-16` claims Windows/macOS/Linux are “Fully Supported”, while `README.md:45,48` still describes the app as core-library-only and dependency-free, which no longer matches `pyproject.toml:9-10`.

This mirrors the earlier repo-wide test findings already recorded in `docs/platform-and-web-port/research/05_tests.md:23-68` and `docs/platform-and-web-port/research/07_issues_debt.md:23,198-216,382`.

### 2. The existing codebase does expose reusable validation seams

Even though the repo lacks a harness, several code locations are testable and should anchor any future parity suite:

- `endnote_exporter.py:142` — `_resolve_enl_path(...)` resolves `.enl` vs `.enlp`
- `endnote_exporter.py:182` — `EndnoteExporter.export_references_to_xml(...)`
- `endnote_exporter.py:232` — hard-coded SQLite path assumption `data_path / "sdb" / "sdb.eni"`
- `endnote_exporter.py:603` — current PDF attachment behavior emits absolute paths
- `endnote_exporter.py:923` — module-level `export_references_to_xml(...)` entrypoint
- `endnote_exporter.py:928` — `XMLComparator`
- `endnote_exporter.py:1266` — `compare_xml_files(...)`
- `platform_utils.py:31` — `find_data_folder(...)`
- `platform_utils.py:58` — `get_documents_folder(...)`
- `platform_utils.py:102` — Windows Documents lookup via `SHGetFolderPathW`
- `platform_utils.py:123` — Linux/XDG documents lookup
- `platform_utils.py:153` — `get_endnote_default_directory(...)`
- `platform_utils.py:161` — `validate_file_extension(...)`
- `gui.py:20,54,62,80,133` — desktop UI boundary and export trigger

For a browser-local implementation, these seams matter because the business-critical invariant is **XML export parity**, not UI parity.

### 3. Existing local-web research already identifies the hardest test implications

`docs/local-web-execution/research/00_setup.md` already narrows the problem correctly:

- browser-local execution changes the attachment/path contract (`00_setup.md:47,114-128`)
- SQLite access becomes a first-class feasibility and runtime question (`00_setup.md:179-188`)
- candidate runtime families explicitly include browser-only, WASM-assisted browser, single-file HTML, Electron, and Tauri (`00_setup.md:216-218,250-351`)
- option ranking currently prefers browser-only first, wrappers second (`00_setup.md:348-351`)

Testing strategy therefore needs to verify both:

1. **transformation parity** against current exporter behavior, and
2. **runtime-specific intake/output behavior** for each delivery model.

### 4. The current fixture story is not sufficient for browser-local work

The only project-owned fixture-like asset is still `testing/RefsEnschede.enlp.zip`, with no executable tests around it. Prior repo research recorded that this archive appears to expand to:

- `RefsEnschede.enlp/RefsEnschede.enl`
- `RefsEnschede.enlp/RefsEnschede.Data/rdb/...`
- `RefsEnschede.enlp/RefsEnschede.Data/tdb/...`

See `docs/platform-and-web-port/research/05_tests.md:108-117`.

That is important because current exporter logic expects the database at `endnote_exporter.py:232` as `sdb/sdb.eni`. One of the following must therefore be true:

- the existing fixture represents a layout the current exporter does not actually support,
- the fixture is stale or incomplete,
- or EndNote package variants exist and the future test corpus must explicitly distinguish them.

Browser-local work magnifies this issue because browser and wrapper runtimes will need deterministic fixture packaging for `.enl`, unpacked `.enlp`, and zipped `.enlp` shapes.

### 5. Browser-local implementations need two layers of testing, not one

For every candidate runtime, the test strategy should be split into:

1. **core parity tests**
   - input normalization
   - SQLite reading/parsing
   - XML generation
   - attachment-link behavior
   - error reporting for malformed libraries

2. **runtime adapter tests**
   - browser or desktop file selection behavior
   - archive/folder intake UX
   - generated XML download/save behavior
   - packaging and startup smoke checks

If those layers are mixed together too early, failures will be difficult to attribute.

### 6. Official external docs suggest materially different testing feasibility by runtime

#### Browser file-system APIs

MDN documents the File System API as available only in **secure contexts** and usable from workers, with directory and file handles obtained from APIs such as `showOpenFilePicker()` and `showDirectoryPicker()`. It also documents OPFS as a local, origin-private storage layer suitable for large local files and in-place writes. Secure-context documentation notes that `http://localhost` is potentially trustworthy for local development, and `file://` is also generally treated as potentially trustworthy, but browser behavior still requires verification in real products.

Sources:
- https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
- https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts

Testing implication: browser-local and single-file strategies must be tested under the exact origin model they promise to users, not only under a dev server.

#### Electron automation

Playwright documents experimental Electron automation with `electron.launch(...)`, access to the first window, main-process evaluation, screenshots, downloads, traces, and videos.

Source:
- https://playwright.dev/docs/api/class-electron

Testing implication: Electron has a comparatively strong automated integration-testing story, especially for launch-and-drive desktop workflows.

#### Playwright browser test configuration

Playwright documents multi-project browser matrices, retries on CI, `webServer` startup, trace capture, screenshots, and snapshot configuration.

Source:
- https://playwright.dev/docs/test-configuration

Testing implication: browser-only and single-file web strategies have a mature E2E harness available immediately.

#### Tauri testing

Tauri v2 documents:

- unit/integration testing with a **mock runtime**, where native webviews are not executed
- end-to-end testing via **WebDriver**
- an explicit caveat that **macOS does not provide a desktop WebDriver client**

Source:
- https://v2.tauri.app/develop/tests/

Testing implication: Tauri’s automated test story is materially weaker than Electron for cross-platform desktop E2E, especially on macOS.

---

## Issues

### 1. There is no canonical golden-fixture regression harness yet

The repo already contains a potentially valuable comparator (`endnote_exporter.py:928-1266`), but there is no checked-in harness that says:

- these are the supported input shapes,
- these are the goldens,
- these output differences are allowed,
- and these differences are regressions.

For a browser-local port, this is the largest missing prerequisite.

### 2. The attachment contract is currently desktop-specific

Current behavior writes absolute PDF paths into exported XML (`endnote_exporter.py:603`). `docs/local-web-execution/research/00_setup.md:114-128` already flags this as a design question.

Testing implication: every future runtime must define one of the following and lock it with fixtures:

- preserve absolute paths where available
- emit relative metadata only
- omit attachment URLs
- emit wrapper-specific/local-sandbox URLs
- require an explicit user path hint before writing attachment links

Without this decision, XML regression tests will remain unstable.

### 3. Raw folder support is attractive but test-expensive

Existing local-web research keeps browser folder selection in scope (`docs/local-web-execution/research/00_setup.md:230-248`), but prior review work already warns that browser folder upload and packaging UX vary across environments (`docs/platform-and-web-port/reviews/review_1.md:251-257`, `docs/platform-and-web-port/reviews/review_2.md:230-231,523-524`).

Testing implication: if browser folder upload is a product promise, it becomes a compatibility surface of its own. If the product instead normalizes to **zip/package upload first**, the automated test matrix becomes much simpler.

### 4. Single-file HTML is not just “browser-only, but simpler”

A single-file HTML delivery promise changes test obligations:

- startup must work when opened directly from disk, not only behind a dev server
- asset bundling must not depend on multi-file paths or service-worker assumptions
- local-origin browser quirks must be validated in practice
- save/download behavior must be tested when the app is launched from `file://` and when it is served from `localhost`

This makes single-file delivery harder to verify than a normal browser app, even if the app logic is smaller.

### 5. Tauri introduces the highest test-system complexity per unit of product value

From a testing perspective, Tauri adds:

- Rust-native build/toolchain complexity
- dual-surface testing (frontend + native bridge)
- separate mock-runtime and WebDriver test layers
- a documented macOS E2E gap for desktop WebDriver

This does not make Tauri infeasible, but it does make it the most demanding option to verify rigorously for a small repo that currently has no test foundation at all.

---

## Opportunities

### 1. Use one shared parity corpus across all future runtimes

The most robust approach is to build a **runtime-neutral corpus** first and reuse it across browser-only, single-file HTML, Electron, and Tauri.

Recommended fixture families:

```text
fixtures/
  canonical/
    enl_minimal/
    enlp_minimal/
    enlp_zip_minimal/
  edge/
    mixed_case_data_dir/
    missing_db/
    no_pdfs/
    malformed_package/
    legacy_layout_candidate/
  stress/
    large_attachment_index/
    large_reference_count/
  golden_xml/
    *.xml
  metadata/
    *.json
```

Each fixture should record:

- input shape
- expected supported/unsupported status
- expected warning/error class
- expected XML golden, if successful
- attachment policy mode expected in output

This directly builds on earlier repo recommendations for deterministic fixtures and goldens (`docs/platform-and-web-port/plans/plan_a_conservative.md:69-70`, `docs/platform-and-web-port/plans/plan_b_balanced.md:130,241`, `docs/platform-and-web-port/plans/plan_c_aggressive.md:175,366-369`).

### 2. Promote XML parity to the primary acceptance gate

For this product, the most valuable regression contract is:

> given the same normalized EndNote fixture, every supported runtime emits XML that is equivalent to the approved baseline.

That can be implemented by either:

- reusing `XMLComparator` semantics, or
- canonicalizing XML and comparing normalized DOM/content directly.

The current comparator is a useful starting point because it already knows how to ignore some noisy fields and compare nested structures (`endnote_exporter.py:928-1266`).

### 3. Keep browser automation focused on artifact correctness, not just visuals

Browser automation should verify:

- selected file or archive is accepted/rejected correctly
- conversion completes or fails with the expected class of error
- XML download is produced
- downloaded XML matches the golden/parity expectation

Screenshots are useful for smoke-level UI regressions, but for this project they should remain secondary to **artifact-level assertions**.

### 4. Electron has the best automation story among the desktop-wrapper options

Because Playwright can launch Electron directly and drive the first window, Electron supports a straightforward automated workflow:

- boot app
- inject or select fixtures
- trigger conversion
- capture downloaded/saved XML
- compare XML with goldens
- collect traces, screenshots, and videos when failing

If wrapper-based local execution becomes necessary, Electron is the easier option to test thoroughly.

### 5. Browser-only web apps can be tested well if the supported input contract is narrow

If the browser implementation uses **zip/package upload** as the primary intake path, then Playwright can cover most of the runtime surface with a standard browser matrix and file-upload automation.

If the browser implementation requires direct folder selection or complex File System Access API flows from day one, the E2E harness becomes more environment-sensitive.

From a testing-risk perspective, the narrowest stable MVP contract is:

- accept `.zip` and/or `.enlp`
- optionally add browser-folder intake later
- compare produced XML against the same shared goldens

---

## Recommended testing strategy by runtime

### Browser-only web app

#### Recommended stack

- unit/integration: runtime-language-native test runner
- E2E/browser automation: Playwright
- regression oracle: shared golden XML corpus
- optional visual smoke: Playwright screenshots

#### Test layers

1. **pure logic/unit tests**
   - package normalization
   - SQLite/WASM access layer, if used
   - XML serialization and error mapping
   - attachment policy

2. **browser integration tests**
   - upload/select supported fixture formats
   - conversion success/failure behavior
   - XML download contents
   - warning surface for unsupported layouts

3. **browser matrix tests**
   - Chromium
   - Firefox
   - WebKit

4. **security/robustness tests**
   - malformed package
   - oversized archive
   - traversal-like member names in zip fixtures
   - missing database / missing `.Data`

#### Key implication

Browser-only testing is feasible and mature **if the intake contract is zip/package-centric**. It becomes significantly harder if directory-picker support is a first-class MVP promise.

### Single-file HTML app

#### Recommended stack

- same logic and parity layers as browser-only
- Playwright for served-mode E2E
- additional smoke harness for direct `file://` opening

#### Additional tests required

1. **served mode**
   - run via `localhost` and exercise the standard E2E suite

2. **local file mode**
   - open the generated HTML directly from disk
   - verify startup, supported input path, conversion, and save/download behavior
   - verify whether any secure-context-dependent or origin-dependent functionality degrades

3. **packaging assertions**
   - single generated HTML really contains or locates all required runtime assets
   - no hidden dependency on service worker or extra local asset paths if the product promise is “single file”

#### Key implication

Single-file HTML needs **two execution modes** in test coverage. That makes it riskier than a normal browser app from a QA perspective.

### Electron wrapper

#### Recommended stack

- unit tests for renderer/preload/main-process boundaries
- Playwright Electron automation for integration/E2E
- packaged-artifact smoke tests on Windows/macOS/Linux

#### Test layers

1. **renderer/unit tests**
   - browser-side UI and normalization logic

2. **main/preload integration tests**
   - filesystem bridge behavior
   - save dialog/download abstraction
   - path-resolution behavior for local libraries

3. **Electron E2E**
   - launch application with Playwright
   - select or inject fixtures
   - trigger export
   - assert XML parity
   - collect traces/screenshots on failure

4. **release smoke tests**
   - verify packaged app launches on each OS
   - verify minimal conversion on built artifacts
   - verify macOS Intel/Apple Silicon distribution policy if both are promised

#### Key implication

Electron is the strongest wrapper option **from a testability standpoint**.

### Tauri wrapper

#### Recommended stack

- unit/integration tests using Tauri mock runtime
- WebDriver-based E2E where supported
- package/build smoke tests on all target OSes

#### Test layers

1. **frontend/unit tests**
   - same as browser UI layer

2. **mock-runtime tests**
   - native command and permission boundary behavior without launching real webviews

3. **WebDriver E2E**
   - desktop E2E on Windows/Linux
   - mobile if ever relevant

4. **macOS-specific fallback verification**
   - launch/package smoke tests
   - manual or custom non-WebDriver checks, because Tauri documents no desktop WebDriver client on macOS

#### Key implication

Tauri can be tested, but not as uniformly as Electron. macOS automation is the decisive weakness.

---

## Fixture handling strategy

### 1. Split fixtures by purpose

Recommended fixture classes:

- **tiny deterministic CI fixtures**
  - minimal `.enl` + `.Data`
  - minimal `.enlp`
  - minimal `.enlp.zip`
- **expected-failure fixtures**
  - missing DB
  - missing `.Data`
  - malformed zip
  - unsupported legacy layout candidate
- **realism fixtures**
  - sanitized real exports with more fields and attachments
- **stress fixtures**
  - larger SQLite DB or archive for performance/memory testing

### 2. Treat zipped fixtures as first-class

This repo already contains `testing/RefsEnschede.enlp.zip`, and prior work repeatedly treats `.zip` as realistic for future intake (`docs/platform-and-web-port/research/03_backend.md:84-92`, `docs/platform-and-web-port/reviews/review_2.md:177-178,523-524`).

That means the fixture program should explicitly support:

- unpacked `.enlp`
- `.zip` containing `.enlp`
- `.zip` containing `.enl` + `.Data`

### 3. Keep goldens stable and explainable

Each successful fixture should produce:

- approved XML golden
- optional normalized JSON summary for easier diff review
- optional comparator output for debugging

The key point is that failures should tell maintainers **which semantic field changed**, not just that a blob of XML drifted.

---

## Browser automation considerations

### Recommended default harness

Use Playwright as the main automation surface for:

- browser-only app
- single-file HTML app
- Electron wrapper

Reasons:

- multi-browser matrix support
- downloads, screenshots, traces, videos
- CI-friendly configuration via `projects`, `retries`, `webServer`, and artifact capture
- Electron automation support from the same tool family

Source:
- https://playwright.dev/docs/test-configuration
- https://playwright.dev/docs/api/class-electron

### Practical automation guidance

1. Prefer **upload/selectable archives** over native directory-pickers for CI-critical flows.
2. Capture and inspect the **downloaded XML artifact** in E2E tests.
3. Use screenshots only for smoke-level UI coverage.
4. Treat any “works only in Chromium with directory picker” flow as a compatibility risk requiring separate policy and support wording.

---

## Regression testing against XML output

### Recommended parity model

The regression suite should compare every future runtime against a shared baseline using one of two approaches:

1. **Python exporter as current oracle**
   - generate approved goldens from the current exporter for stable fixtures
   - future runtimes must match those goldens unless an intentional contract change is approved

2. **golden XML as product oracle**
   - once approved, goldens become the contract regardless of runtime

The second model is healthier long term, but the first is the fastest way to bootstrap the suite.

### Required parity cases

At minimum, regression tests should cover:

- basic bibliographic fields
- multi-author records
- missing optional fields
- attachment presence/absence
- `.enl` vs `.enlp` normalization parity
- package/archive failure cases
- whatever attachment-path policy becomes official

### Existing repo leverage

`XMLComparator` already gives the repo a strong head start for semantic diffing (`endnote_exporter.py:928-1266`). It should be treated as a validation asset, whether or not it remains in the runtime module.

---

## Cross-platform verification strategy

### Baseline

The repo already has a release matrix on:

- Windows
- macOS
- Linux

See `.github/workflows/release.yml:16`.

That is a useful starting point, but the future matrix must distinguish **logic parity** from **distribution verification**.

### Recommended verification matrix

#### Browser-only

- browser matrix: Chromium, Firefox, WebKit
- OS smoke: Linux in CI by default, Windows/macOS as added confidence if local file interactions are product-critical
- explicit secure-context execution on `localhost`

#### Single-file HTML

- same browser matrix as browser-only
- explicit `file://` smoke on every browser/OS combination officially supported
- separate served-mode and direct-open test jobs

#### Electron

- dev-mode E2E via Playwright on CI
- packaged-artifact smoke on Windows/macOS/Linux
- macOS architecture-specific checks if Intel and Apple Silicon are both supported

#### Tauri

- mock-runtime tests on all CI platforms
- WebDriver E2E on Windows/Linux
- build/package smoke on macOS plus manual or custom launch checks

### Key implication

If the project wants the **lowest verification burden**, the ranking is:

1. browser-only with zip/package upload MVP
2. Electron wrapper
3. single-file HTML
4. Tauri wrapper

This ranking is based on testing/verification cost, not product UX alone.

---

## Open questions

1. **What EndNote package layouts are actually in scope?**
   The repo’s only archive fixture appears inconsistent with `endnote_exporter.py:232` and should be classified before any golden harness is built.

2. **What attachment policy is the product willing to guarantee outside the current desktop path model?**
   This must be decided before XML parity expectations can be finalized.

3. **Is raw browser folder selection a hard requirement, or can MVP normalize around `.zip` / `.enlp` inputs first?**
   This one decision heavily changes the E2E matrix complexity.

4. **Does “single-file HTML” mean direct `file://` use is an explicit support promise?**
   If yes, that support claim needs dedicated cross-browser direct-open smoke coverage.

5. **If a wrapper is needed, is testability more important than runtime size?**
   If yes, Electron currently has the stronger testing story; if binary footprint dominates, Tauri remains interesting but costlier to verify.

6. **Should the future parity oracle be the existing Python exporter, approved golden XML, or both?**
   This affects how intentional output changes are reviewed and approved.

7. **What is the minimum cross-platform confidence bar for releases?**
   Build-only, launch-only, or fixture-backed export smoke per target OS?

---

## Bottom line

The current repo is missing the prerequisite test foundation for any local browser-first port:

- no automated first-party tests
- no golden fixtures
- no browser automation
- no packaged smoke validation
- one ambiguous `.enlp.zip` fixture and one useful comparator utility, but no harness around either

The most important testing implication is this:

> the next major investment should not be UI implementation first; it should be a **shared fixture + golden XML parity harness** that every runtime candidate can reuse.

After that foundation exists, the testing burden differs materially by runtime:

- **browser-only** is very testable if input support stays narrow (`.zip` / `.enlp` first)
- **single-file HTML** adds non-trivial direct-open compatibility verification
- **Electron** has the strongest automated desktop QA story
- **Tauri** has the weakest cross-platform E2E story, especially on macOS

From a testing and verification standpoint alone, the safest path is:

1. build shared fixtures and XML goldens first
2. validate a browser-only zip/package MVP second
3. use Electron as the first wrapper fallback if browser constraints become unacceptable
4. treat Tauri as the higher-complexity option unless binary-size goals clearly dominate
