# Backend / Service Architecture Research for Goal B

Date: 2026-03-18
Repository: `/home/sam/dev/endnote-exporter`

## Scope

Research only. This report assesses what backend/service architecture would be required for **Goal B: a hosted web port**, grounded in the current Python desktop application.

Requested focus:
- how easily the current business logic can run headless on a server
- likely service boundaries for upload intake, archive extraction, job processing, storage, XML generation, and download delivery
- security and platform constraints for user-supplied EndNote libraries and archives
- practical Python backend shapes suitable for this repository

## Executive summary

The good news first: the current exporter is already **mostly callable headless**. `gui.py` is a thin Tkinter shell that calls the module-level `export_references_to_xml()` function from `endnote_exporter.py` (`gui.py:5`, `gui.py:80-166`, `endnote_exporter.py:923-925`). That means Goal B does **not** require rewriting the EndNote-to-XML transformation from scratch.

The catch is that the existing exporter is **not yet service-shaped**. It assumes:
- local filesystem input (`endnote_exporter.py:206-242`)
- local filesystem output (`endnote_exporter.py:215-218`, `352-359`)
- local append-only diagnostics files (`endnote_exporter.py:33-46`, `264-302`)
- absolute local PDF paths in the generated XML (`README.md:5-8`, `endnote_exporter.py:598-607`, `807-816`)
- unpacked `.enlp` directory bundles rather than generic uploaded archives (`endnote_exporter.py:142-177`)

So the hosted port should be planned as:

1. **a thin HTTP/API layer for upload, status, and download**
2. **a workspace-normalization layer** that turns uploads into a safe extracted directory tree
3. **an isolated export worker** that runs the current exporter logic against that workspace
4. **a clear attachment policy** for PDFs, because the current absolute-path behavior does not transfer cleanly to the web

The strongest architectural recommendation is a **small Python API + background worker** design rather than a synchronous one-request/one-export service. Uploads and archive extraction are inherently file-heavy, and the exporter currently writes shared logs/comparison files that are awkward under concurrent requests.

## Findings

### 1. The exporter is already callable headless, but only as a file-based job

The current desktop UI is very thin:
- `gui.py:54-78` selects a local `.enl` or `.enlp`
- `gui.py:110-116` selects a local output `.xml` path
- `gui.py:133` calls `export_references_to_xml(self.enl_file, output_file)`

That means the main transformation logic already lives outside the GUI, which is excellent for reuse.

The reusable entry points today are:
- `EndnoteExporter.export_references_to_xml()` (`endnote_exporter.py:182-203`)
- `EndnoteExporter._export()` (`endnote_exporter.py:204-359`)
- module-level wrapper `export_references_to_xml()` (`endnote_exporter.py:923-925`)

From a service perspective, this is promising because the core does **not** depend on Tkinter. It only needs:
- an input path pointing at an EndNote library or package
- an output path to write XML

### 2. The current core is not pure business logic; it is a mixed filesystem job runner

Although headless reuse is possible, the core is not yet a pure “transform bytes to bytes” function.

`endnote_exporter.py` currently does all of the following in one module:
- configures process-global logging sinks on import (`endnote_exporter.py:13-46`)
- resolves `.enlp` package layout (`endnote_exporter.py:142-177`)
- finds the `.Data` folder on disk (`endnote_exporter.py:222`, `platform_utils.py:31-55`)
- opens the SQLite database directly from disk (`endnote_exporter.py:232-242`)
- appends diagnostic comparison JSONL to a shared local file (`endnote_exporter.py:46`, `264-302`)
- writes the XML file to a local destination (`endnote_exporter.py:352-359`)
- computes absolute PDF paths from extracted files on disk (`endnote_exporter.py:598-607`)

This means the easiest hosted-port path is **not** “call the exporter directly on the uploaded bytes.” The practical path is:
1. save upload into an isolated workspace
2. normalize/extract it into the directory structure the exporter expects
3. call the existing exporter against that workspace
4. capture and return the XML artifact

### 3. `.enlp` support helps, but upload normalization is still missing

The current exporter supports `.enlp` as an **unpacked macOS package directory**:
- `_resolve_enl_path()` handles `.enlp` inputs by looking for `*.enl` and `*.Data` inside the package (`endnote_exporter.py:142-177`)
- `_export()` then repeats `.enlp` discovery to derive the library name (`endnote_exporter.py:206-212`)

This is useful, but it is not a complete web-ingestion story.

Important constraints:
- Goal B already expects uploads such as folder, `.zip`, and `.enlp` plus a source path hint (`docs/platform-and-web-port/research/00_setup.md:8`, `137-148`)
- the first-party runtime code reviewed in this repo does **not** currently implement archive extraction
- `testing/RefsEnschede.enlp.zip` exists as a fixture-like artifact, which is a strong hint that zipped package input is realistic for this project

Practical implication: the hosted port needs a new **upload normalization layer** before it can call today’s exporter. That layer must convert one of these user-facing upload shapes:
- raw folder upload
- `.zip` containing `.enl` + `.Data`
- `.zip` containing `.enlp`
- direct `.enlp` package upload, if the frontend/browser can preserve package-directory structure

into one canonical extracted workspace on disk.

### 4. PDF handling is the biggest product + backend policy problem

Current desktop behavior intentionally emits absolute PDF paths:
- the README advertises this as a feature (`README.md:5-8`)
- `_build_record_dict()` constructs `pdf_urls` by joining `data_path / "PDF" / file_path` and serializing `full_pdf_path.resolve()` (`endnote_exporter.py:593-607`)
- `_dict_to_xml()` writes those values into `<pdf-urls>` (`endnote_exporter.py:807-816`)

That is a good desktop convenience, but it becomes a major hosted-service constraint:
- server-local absolute paths are meaningless to the user
- exposing server-local paths is undesirable from a security standpoint
- the server cannot directly access the user’s local PDF locations
- uploaded archives may contain PDFs, but the user may only want XML, not long-term hosted attachment storage

This forces Goal B to choose an explicit attachment strategy. The current repo gives no backend-safe default beyond desktop absolute paths.

## Service boundaries required for Goal B

### 1. Upload intake / validation boundary

**Responsibilities**
- accept uploads and metadata
- validate content type / extension / size
- assign a job ID
- persist the raw upload somewhere safe before extraction

**Repo grounding**
- the current app only validates filename extension, not payload shape (`endnote_exporter.py:188-202`, `platform_utils.py:161-181`)
- the GUI assumes local human-driven file selection (`gui.py:54-78`, `80-116`)

**Practical notes**
- For the web port, the backend contract should be narrower than the desktop UX.
- The simplest API contract is likely one uploaded file (usually a `.zip`) plus metadata, not arbitrary ad hoc filesystem trees.
- If “folder upload” remains a product requirement, the frontend should probably zip it before submission or send a manifest-based multipart upload that the backend reassembles into a temp workspace.

### 2. Archive inspection / extraction boundary

**Responsibilities**
- inspect archive contents before extraction
- reject unsupported or suspicious layouts
- extract into a per-job temp workspace
- determine canonical library root and library name

**Repo grounding**
- the exporter expects an extracted filesystem layout with `.enl`, `.Data`, `sdb/sdb.eni`, and optionally `PDF/` (`CLAUDE.md`, EndNote structure section; `endnote_exporter.py:222-237`)
- `.enlp` handling exists only for unpacked package directories (`endnote_exporter.py:142-177`)

**Practical notes**
- This should be a separate boundary from export itself.
- It should return a normalized structure such as:
  - workspace root
  - canonical `.enl` or `.enlp` path to hand to the exporter
  - detected library name
  - summary of extracted file count / bytes / presence of PDFs

### 3. Job processing boundary

**Responsibilities**
- run export asynchronously
- capture structured results
- isolate filesystem/logging side effects per job
- provide durable status transitions

**Repo grounding**
- the current exporter is synchronous (`endnote_exporter.py:204-359`)
- it writes to shared logs/comparison files configured at import time (`endnote_exporter.py:33-46`, `264-302`)
- it returns a simple tuple `(count, output_path)` rather than a structured job result (`endnote_exporter.py:359-360`)

**Practical notes**
- A worker boundary is strongly recommended because current side effects are global and request duration can be dominated by upload I/O and archive extraction.
- Even if the exporter stays mostly unchanged initially, running it in a separate worker process or isolated container is much cleaner than invoking it inline in the API process.

### 4. Temp storage / file storage boundary

**Responsibilities**
- hold raw upload
- hold extracted workspace
- hold generated XML artifact
- optionally hold logs and result metadata
- delete everything after TTL expiry

**Repo grounding**
- current code assumes local sibling paths around the library and executable (`endnote_exporter.py:215-218`, `352-359`, `33-46`)
- current desktop docs emphasize local desktop behavior, not remote persistence (`README.md:28-41`, `CLAUDE.md`)

**Practical notes**
- Low-scale MVP: per-job temp directory on local disk is acceptable.
- Multi-instance or queue-based deployment: raw uploads and generated XML should move to object storage.
- Extracted workspaces can still live on worker-local ephemeral disk for speed, then be deleted immediately after job completion.

### 5. XML generation boundary

**Responsibilities**
- reuse current field mapping and XML rendering logic
- optionally inject a configurable attachment-path strategy
- emit XML bytes or a file handle

**Repo grounding**
- field mapping and XML rendering are already centralized in `_build_record_dict()` and `_dict_to_xml()` (`endnote_exporter.py:367-824`)
- XML sanitization already exists via `safe_str()` and `INVALID_XML_REGEX` (`endnote_exporter.py:56-60`, `904-919`)

**Practical notes**
- This is the strongest part of the current codebase for reuse.
- For a hosted service, this layer should ideally stop caring where the input came from and where the result is ultimately downloaded from.

### 6. Download delivery boundary

**Responsibilities**
- expose finished XML for download
- optionally package logs/report metadata for support
- enforce one-time or time-limited artifact access

**Repo grounding**
- desktop app writes the XML directly to a chosen destination (`gui.py:110-116`, `endnote_exporter.py:352-359`)
- there is no HTTP or CLI delivery path in the repo today

**Practical notes**
- API should expose `GET /jobs/{id}` for status and `GET /jobs/{id}/download` for XML.
- If attachments are ever re-hosted, they should be delivered separately; they should not be coupled to the XML download endpoint.

## Security and platform constraints

### 1. All uploads must be treated as untrusted archives and untrusted SQLite databases

This is not just a “zip upload” problem. The service will also open a user-supplied SQLite database at `sdb/sdb.eni` (`endnote_exporter.py:232-242`).

Implications:
- export jobs should run in an isolated worker process or container
- the extracted workspace must be outside any shared application directories
- the service should not trust archive member names, symlinks, or internal relative paths
- the service should avoid letting malformed uploads influence any path outside the job workspace

Practical constraint: Goal B should assume that archive extraction and SQLite reading happen inside a disposable sandbox, even if the first implementation is simple.

### 2. Archive extraction must defend against traversal, symlinks, and zip bombs

Because Goal B includes `.zip` uploads (`docs/platform-and-web-port/research/00_setup.md:8`, `137-148`), the backend must explicitly handle:
- `../` path traversal inside archives
- absolute archive member paths
- symlinks or non-regular files
- excessive file counts
- excessive decompressed byte size
- deeply nested directory structures

Practical backend rule set:
- allow only regular files and directories
- enforce maximum compressed size and maximum extracted size
- enforce maximum file count
- reject archive members that escape the job workspace after normalization
- reject archives with multiple competing library roots unless product explicitly supports them

### 3. The current path logic is helpful for desktop, but only partly applicable on the server

Useful reusable parts:
- `find_data_folder()` already handles case-insensitive `.Data` lookup (`platform_utils.py:31-55`)
- `validate_file_extension()` is fine as a basic filename check (`platform_utils.py:161-181`)

But some current assumptions should **not** be reused directly for hosted behavior:
- `Path.resolve()` on PDFs (`endnote_exporter.py:603`) should not leak server paths into XML
- desktop Documents-folder logic (`platform_utils.py:58-158`) is irrelevant for a hosted service
- default output path next to the uploaded library (`endnote_exporter.py:215-218`) should be replaced by job artifact storage

### 4. The source path hint must be treated as metadata, not as a server path to access

Goal B explicitly mentions a source path hint (`docs/platform-and-web-port/research/00_setup.md:8`). In a hosted design, that hint should be treated as a **string used for output rewriting**, not as a real path on the server.

This distinction matters:
- **safe use:** use the hint only to construct emitted PDF references in the XML
- **unsafe use:** joining the hint to server paths and attempting to access the user’s local filesystem

Practical design option:
- the exporter worker can validate attachment existence against the extracted workspace
- but when generating final XML, it can optionally rewrite those PDF paths relative to a user-supplied client-side base path hint

That keeps the hint in the realm of output semantics rather than server-side filesystem access.

### 5. Upload size and retention policy are product-defining backend constraints

The current repo does not document any hosted-service limits yet (`docs/platform-and-web-port/research/06_documentation.md:167-182`, `256-262`). These decisions matter early because EndNote libraries can be attachment-heavy.

Practical planning constraints:
- libraries with PDFs can become large enough that synchronous request handling is fragile
- retention policy affects whether local ephemeral disk is enough or object storage is required
- privacy posture affects logging, support diagnostics, and whether PDFs may be stored after job completion

### 6. Concurrency is a real issue in the current implementation

Today the module configures shared log sinks and a shared comparisons file:
- logger setup at import time (`endnote_exporter.py:13-46`)
- `comparisons.jsonl` shared location (`endnote_exporter.py:46`)
- append mode per run (`endnote_exporter.py:264`)

In a web service, concurrent jobs would interleave log lines and comparison output unless isolation is added.

Practical impact:
- synchronous single-job demos can get away with this temporarily
- any serious hosted deployment needs per-job logging and probably needs the exporter invoked in a worker context rather than as a globally shared in-process library call

## Candidate backend implementation shapes in Python

### Option A: Small synchronous FastAPI service

**Shape**
- FastAPI app handles upload
- request saves upload to temp dir
- service extracts/normalizes input
- service calls current exporter immediately
- response returns XML download when complete

**Why it fits this repo**
- very small codebase
- current exporter is synchronous and dependency-light (`pyproject.toml:1-11`)
- easiest path to a demo or internal prototype

**Why it is limited**
- poor fit for large uploads or long extraction time
- weak story for retries, cleanup, and progress reporting
- concurrency will clash with current global logging/comparison side effects

**When to choose it**
- only for a prototype, internal demo, or very low-traffic single-instance deployment

### Option B: FastAPI API + background worker + object-backed artifacts **(recommended)**

**Shape**
- FastAPI (or similar ASGI app) handles:
  - upload creation
  - status polling
  - artifact download
- worker process handles:
  - archive inspection/extraction
  - workspace normalization
  - export invocation
  - result metadata
- raw uploads and generated XML are stored with TTL
- extracted workspace lives on worker-local temp disk and is deleted after completion

**Why it fits this repo best**
- preserves reuse of current exporter without pretending it is request-safe
- handles large or attachment-heavy jobs better
- matches the natural service boundaries implied by the current file-based exporter
- gives a clean place to enforce archive safety and cleanup policies

**Python stack choices that feel practical here**
- API: FastAPI
- worker queue: RQ, Dramatiq, or Celery-lite equivalent
- storage: local disk first, then S3-compatible storage if multi-instance deployment is needed
- artifact metadata: SQLite/Postgres depending on deployment ambition

**Repo-specific note**
- This is the least risky shape if the goal is to reuse `endnote_exporter.py` early and refactor later.

### Option C: “Worker container per job” / batch-job architecture

**Shape**
- API receives upload and stores it
- each job is executed in a short-lived container or batch task
- container writes XML artifact back to storage
- API serves status and download

**Why it is attractive**
- strongest isolation for untrusted uploads and SQLite parsing
- easy cleanup semantics
- simplifies future scaling if large uploads become common

**Why it may be overkill initially**
- operationally heavier than the repo currently warrants
- more infrastructure than a small Python utility usually needs for MVP

**When to choose it**
- if privacy/isolation requirements are strict from day one
- if the service is expected to process large attachment-heavy archives

## Recommended backend direction

### Recommended architecture

For this repository, the best planning direction is:

1. **Build Goal B as a small Python API plus background worker, not as a direct web wrapper around Tkinter-era file flow.**
2. **Reuse the current export mapping/rendering logic, but only behind a workspace-normalization layer.**
3. **Treat archive extraction, path validation, and cleanup as first-class backend concerns.**
4. **Do not preserve current server-local absolute PDF path behavior.** Instead, choose one explicit policy:
   - MVP-safe: omit PDF attachment paths in hosted exports, or
   - pragmatic compatibility: rewrite them from a user-supplied source path hint, without using that hint for server file access

### Why this direction is strongest

It matches the repo’s current shape:
- the exporter is already callable without the GUI
- the transformation logic is valuable and reusable
- the biggest missing pieces are service plumbing and safety boundaries, not XML business rules

It also avoids the worst mismatch:
- the current code is designed for a single local user on local disk
- a hosted port needs isolated job workspaces, explicit artifact lifecycle, and a deliberate attachment model

## Issues, opportunities, and practical notes that should influence planning

### Issues
- The exporter is headless-callable, but not request-safe due to shared logging/comparison side effects (`endnote_exporter.py:13-46`, `264-302`).
- `.enlp` support assumes unpacked package directories and does not solve generic uploaded archive intake (`endnote_exporter.py:142-177`).
- PDF output semantics are desktop-centric and incompatible with naive hosted deployment (`README.md:5-8`, `endnote_exporter.py:598-607`).
- Return shape is too small for service use; hosted jobs need structured status, counts, warnings, and skipped-record info.

### Opportunities
- The GUI is already thin, so core exporter reuse is realistic (`gui.py:80-166`).
- Field mapping and XML serialization are centralized and worth preserving (`endnote_exporter.py:367-824`).
- `find_data_folder()` is immediately reusable in a normalized extracted workspace (`platform_utils.py:31-55`).
- A worker boundary would let the current exporter remain mostly file-based at first, reducing migration risk.

### Practical notes
- “Folder upload” is likely best normalized to archive upload at the API boundary.
- The backend should define one canonical accepted extracted layout, then adapt all user upload shapes into that layout.
- The job API should surface at least: total refs found, refs exported, refs skipped, warnings, output artifact location, and whether PDFs were omitted or rewritten.
- The current code writes `comparisons.jsonl` for every run. For hosted mode, that should become an optional debug artifact at most, not a default shared file.
- If the source path hint is retained as a feature, document clearly that it is used only to shape emitted XML paths, not to grant the server access to client files.

## Open questions

1. What attachment policy should Goal B use: omit PDFs, rewrite to a client-supplied path hint, or upload/re-host attachments?
2. Is raw browser folder upload truly required, or can the product contract simplify to archive/package uploads only?
3. What maximum upload size and extracted size must be supported?
4. Must uploads be processed ephemerally only, or can artifacts persist briefly for retries/support?
5. Is per-job container isolation required for security/privacy reasons, or is a worker-process sandbox sufficient initially?
6. Should the hosted port support `.enlp.zip` explicitly from day one, given the repo already includes `testing/RefsEnschede.enlp.zip`?
7. Is partial-success export acceptable for hosted jobs, or should any skipped record fail the job?

## Bottom line

Goal B is feasible without rewriting the exporter, but it is **not** a matter of simply putting the current desktop app behind HTTP.

The strongest backend direction is:
- **FastAPI-style API for upload/status/download**
- **background worker for extraction + export**
- **isolated temp workspace per job**
- **explicit PDF attachment policy**
- **short-lived artifact storage with cleanup**

In short: reuse the existing XML/export core, but build a real upload-normalization and job-execution layer around it. That is the cleanest repo-specific path from desktop utility to hosted service.
