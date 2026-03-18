# Local Web Execution Research Setup

## Purpose

This file establishes the initial research context for a new initiative in `/home/sam/dev/endnote-exporter` focused on a **browser-local / client-side implementation** of the EndNote-to-Zotero converter.

The core product goal is different from the earlier hosted-web work:

- process the user’s EndNote library **on the user’s own device whenever possible**
- avoid server-side upload of the full library by default
- preserve a simple distribution story for non-technical users
- reuse the repository’s existing export knowledge without prematurely committing to a hosted service architecture

This track should be treated as a **separate research-and-planning stream** from `/home/sam/dev/endnote-exporter/docs/platform-and-web-port_PLAN.md` and `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/`.

## Project type

Repository `/home/sam/dev/endnote-exporter` is currently a **Python 3.12+ desktop utility application**.

Evidence:

- `/home/sam/dev/endnote-exporter/pyproject.toml` exists, so this repo is currently **backend/desktop-oriented Python**, not a JavaScript frontend repo
- `/home/sam/dev/endnote-exporter/gui.py` provides a **Tkinter GUI** entrypoint
- `/home/sam/dev/endnote-exporter/endnote_exporter.py` contains the **core export logic**
- `/home/sam/dev/endnote-exporter/platform_utils.py` contains **cross-platform filesystem helpers**
- `/home/sam/dev/endnote-exporter/CLAUDE.md` describes packaging via **PyInstaller** and positions the codebase as a desktop app first

In short: the current codebase is **Python desktop application first**, with no existing browser/web runtime in the repo.

## Required repo setup checks completed

### Project documentation read

- Read `/home/sam/dev/endnote-exporter/CLAUDE.md`
- Searched for `AGENTS.md` in `/home/sam/dev/endnote-exporter` and found **no `AGENTS.md` files**

### Relevant baseline from `/home/sam/dev/endnote-exporter/CLAUDE.md`

Important facts that carry into this new research track:

- the app reads EndNote libraries from local filesystem structures
- expected library shapes are:
  - `MyLibrary.enl`
  - `MyLibrary.Data/`
  - macOS `.enlp` package bundles containing equivalent structure
- the current implementation is tightly aligned with **local files, local paths, and desktop packaging**
- current XML output includes **absolute PDF paths**, which is acceptable for desktop but becomes a major design question for any browser-local or web-facing alternative

## Existing related docs and plans found

The existing planning track under `/home/sam/dev/endnote-exporter/docs/platform-and-web-port*` is highly relevant, even though its main Goal B assumed a **hosted web port**.

### Consolidated plan

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port_PLAN.md`

### Existing research reports

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/00_setup.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/01_architecture.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/02_components.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/03_backend.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/04_style_patterns.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/05_tests.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/06_documentation.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/07_issues_debt.md`

### Existing alternative plans

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/plans/plan_a_conservative.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/plans/plan_b_balanced.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/plans/plan_c_aggressive.md`

### Existing reviews

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/reviews/review_1.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/reviews/review_2.md`

## What prior research can be reused

A surprisingly large amount of the earlier hosted-web research is still reusable because it already identifies the real seams between the current desktop exporter and any new runtime.

### Reusable with minimal reframing

#### 1. Export-core reuse analysis

These documents already identify that the XML/export logic is the most portable part of the system and that GUI/runtime concerns should be separated from the transformation core:

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/01_architecture.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/02_components.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/04_style_patterns.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/07_issues_debt.md`

This is directly reusable for browser-local planning because a browser implementation will also need a **runtime-neutral conversion boundary**.

#### 2. Input-shape and normalization concerns

These existing docs already identify the main input shapes and the need for one canonical normalized model:

- `.enl` + `.Data/`
- `.enlp`
- `.zip`
- possible browser folder selection

Most relevant files:

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/00_setup.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/01_architecture.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/03_backend.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/07_issues_debt.md`

Even though the earlier track framed this as server-side upload normalization, the **shape-normalization problem itself** is still the same for client-side execution.

#### 3. Attachment/path policy questions

The earlier work correctly identified that current absolute PDF path behavior does not transfer cleanly outside the desktop app.

Most relevant files:

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/03_backend.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/06_documentation.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/07_issues_debt.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port_PLAN.md`

This remains reusable, but the browser-local track should reinterpret the question as:

- can emitted attachment paths remain meaningful when conversion happens in-browser?
- should attachment references be omitted, preserved as relative metadata, or rewritten from a user-provided client-side hint?

#### 4. Test-planning structure

The earlier research already outlines fixture and scenario planning for:

- `.zip` inputs
- `.enlp` inputs
- folder-like inputs
- malformed layout cases
- parity/regression testing

Most relevant file:

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/research/05_tests.md`

That structure should carry forward almost unchanged, except that browser-local work will need **client-side runtime and browser compatibility cases** instead of hosted API lifecycle cases.

#### 5. Scope caution from earlier reviews

The earlier reviews contain very reusable strategic guidance:

- keep the MVP narrow
- be skeptical of first-class raw browser folder upload promises
- settle attachment/privacy/input contracts early
- avoid turning the repo into an overbuilt platform project too soon

Most relevant files:

- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/reviews/review_1.md`
- `/home/sam/dev/endnote-exporter/docs/platform-and-web-port/reviews/review_2.md`

This guidance is especially useful here because browser-local execution is attractive precisely when it avoids service/ops sprawl.

## What must be expanded or re-researched for the browser-local goal

The earlier hosted-web work cannot simply be reused as-is because the new initiative changes the execution model in fundamental ways.

### 1. Browser capability research is now first-class

The previous planning track was mostly about a **Python-hosted service**. The new track must expand research into browser/runtime capabilities such as:

- browser directory selection support
- browser file APIs for preserving package/folder structure
- IndexedDB / OPFS / in-memory temporary workspace options
- browser limits for large SQLite-ish libraries and attachment-heavy archives
- streaming unzip / parsing options in-browser
- performance and memory limits on typical end-user devices

This area is mostly **new research**, not covered sufficiently in the existing hosted-web documents.

### 2. SQLite access strategy for client-side execution

The current exporter reads a local SQLite database (`sdb/sdb.eni`) from Python. For browser-local execution, this becomes a pivotal feasibility question:

- can the EndNote database be read directly from JavaScript in-browser?
- does it require a WASM SQLite layer?
- would reusing Python logic require Pyodide or another Python-in-WASM approach?
- is a partial reimplementation of the export logic more practical than trying to run the current Python stack in-browser?

The earlier documents explain why a service boundary is needed, but they do **not** fully answer the browser-local database/runtime feasibility question.

### 3. True offline / no-upload product constraints

Hosted-web planning focused on:

- upload normalization
- worker jobs
- retention
- server cleanup
- hosted API / service operations

For browser-local execution, the research needs to shift toward:

- what data never leaves the device
- whether any optional remote features exist
- how to communicate privacy guarantees clearly
- whether outputs are downloaded immediately or staged locally in browser storage
- whether extremely large libraries need a wrapper runtime instead of a plain browser page

The old privacy discussion is useful background, but it must be reframed from **server retention risk** to **local-processing guarantees and fallback behavior**.

### 4. Distribution feasibility for non-hosted delivery

This initiative specifically needs fresh research into distribution forms that the earlier hosted-web track only touched indirectly:

- plain JavaScript/HTML app
- single self-contained HTML distribution
- WASM-assisted browser app
- Electron wrapper
- Tauri wrapper

This comparison is mostly **new work** for this track.

## Scope boundaries for option families

The new initiative should keep the option space explicit so later research stays disciplined.

### Option A: browser-only JavaScript/HTML app

**Definition**

A web app that runs entirely in the browser using standard web technologies, with local file/directory selection and client-side parsing/conversion.

**In scope**

- plain HTML/CSS/JavaScript or a very lightweight frontend stack
- browser file/directory input APIs
- local conversion without server upload by default
- immediate XML download back to the user

**Main research questions**

- can browser APIs preserve enough EndNote folder/package structure reliably?
- can the EndNote SQLite content be read directly in JavaScript, or is extra runtime support required?
- what are the memory/performance limits for realistic libraries?

**Out of scope for this option**

- depending on a remote backend for the core conversion path
- assuming Node/Electron filesystem APIs

### Option B: browser-local implementation with WebAssembly

**Definition**

A browser app that still runs locally on the client, but uses WASM to fill capability gaps such as SQLite access, archive handling, or reuse of existing transformation logic.

**In scope**

- SQLite/WASM tooling
- archive/WASM helpers if needed
- possibly compiling a focused conversion core to WASM
- preserving browser-local execution while accepting a larger technical bundle

**Main research questions**

- is WASM required only for SQLite, or for a larger portion of the pipeline?
- is Pyodide/Python-in-browser feasible, or would a targeted reimplementation be simpler?
- what bundle size and startup costs are acceptable?

**Out of scope for this option**

- drifting into a hosted-service architecture just because WASM exists
- treating WASM as mandatory if simpler JavaScript-only execution is viable

### Option C: single-file self-contained HTML distribution

**Definition**

A single HTML file, ideally usable locally, containing the UI and client-side logic with no installation step beyond opening the file in a browser.

**In scope**

- simplest possible distribution model
- embedded scripts/styles/assets when feasible
- optional use of browser-local storage only

**Main research questions**

- do modern browsers allow the necessary local file/directory interactions from a self-contained page?
- can required JS/WASM assets fit comfortably into a single-file delivery story?
- are there browser security restrictions that make this fragile or browser-specific?

**Out of scope for this option**

- assuming service workers, build pipelines, or multi-file asset hosting unless the “single-file” claim is explicitly relaxed
- assuming large native-like filesystem capabilities that browsers may not expose from a local file context

### Option D: Electron local wrapper

**Definition**

A desktop-distributed wrapper that uses web technologies for UI but runs locally with desktop filesystem access via Electron.

**In scope**

- local processing on the user’s machine
- richer filesystem access than a plain browser tab
- potentially easier folder/package handling for `.enl`, `.Data`, and `.enlp`
- browser-like UX without a hosted backend

**Main research questions**

- does Electron materially simplify local file handling enough to justify its packaging size?
- can a simple local wrapper reduce browser API constraints without overcomplicating the product?
- should Electron only be a fallback if true browser-only execution is too constrained?

**Out of scope for this option**

- treating Electron as the default answer before browser-local feasibility is tested
- adding unnecessary account/sync/server features

### Option E: Tauri local wrapper

**Definition**

A local desktop wrapper using web UI plus a Rust/native shell, intended to provide local execution with smaller distribution overhead than Electron.

**In scope**

- local-only processing with desktop filesystem access
- lightweight desktop wrapper exploration if browser-only execution is not sufficient
- comparison against Electron on footprint and user simplicity

**Main research questions**

- does Tauri’s smaller runtime outweigh the extra Rust/toolchain complexity for this repo?
- would a Tauri shell simplify local library access enough to beat pure browser delivery?
- does this option fit a repo that is currently Python-first, or would it create too much implementation/tooling sprawl?

**Out of scope for this option**

- introducing a large multi-language architecture before simpler options are evaluated
- assuming Tauri is simpler operationally just because the shipped binary is smaller

## Recommended framing for the next research phase

Treat this initiative as a **local-execution-first feasibility study** with a clear ranking of option families:

1. **Browser-only JavaScript/HTML** if direct client-side library parsing is feasible
2. **Browser + WASM** if browser-only needs help for SQLite or archive handling
3. **Single-file HTML** if it remains compatible with the required browser APIs and asset size
4. **Electron or Tauri** only if browser constraints make plain browser delivery impractical while local execution remains the product goal

This ranking keeps the new track aligned with the user goal of **avoiding server-side upload of the full library whenever possible**.

## Created planning workspace

The following directories were created for this new initiative:

- `/home/sam/dev/endnote-exporter/docs/local-web-execution/research/`
- `/home/sam/dev/endnote-exporter/docs/local-web-execution/plans/`
- `/home/sam/dev/endnote-exporter/docs/local-web-execution/reviews/`
