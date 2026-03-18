# Browser-local troubleshooting

**Status:** Current implementation troubleshooting for the served browser-local workflow
**Applies to:** `web/` browser-local conversion surface

## Start here

Before you dig into a specific symptom, check these first:

1. open the app in **served mode** (`http://localhost` or `https://...`)
2. use a **ZIP** archive first; treat folder picking as optional and experimental
3. prefer a current **Chromium-class** browser for the supported baseline
4. if attachments matter, decide whether you want to leave PDF links omitted or supply a library location explicitly

If a workflow still depends on desktop-style filesystem behavior, use the Python desktop app instead.

## The app opens but immediately says served mode is required

### Symptoms

You see one of these messages:

- `Open this workspace through the Vite dev or preview server.`
- `Served mode is the canonical launch contract; file:// is intentionally unsupported.`

### Cause

The current browser-local implementation does not support direct `file://` launch.

### What to do

- open the app from a local server or HTTPS deployment instead of double-clicking `index.html`
- if you are working from this repository, use the served workflow documented in [`release-ops.md`](./release-ops.md)
- do not treat an incidental `file://` success in one browser as supported behavior

## The page loads but conversion never becomes ready

### Symptoms

You see one of these messages:

- `Dedicated workers are required for the browser-local pipeline baseline.`
- `Worker initialisation failed.`

### Cause

The implementation depends on dedicated workers. If workers are unavailable or startup fails, conversion does not proceed.

### What to do

- retry in a current Chromium-based browser first
- make sure you are in served mode, not `file://`
- reload the page and retry once
- if the problem is specific to one browser family, fall back to the supported Chromium ZIP-first path

## The ZIP file is rejected immediately

### Symptoms

You may see messages such as:

- `Please choose a ZIP archive containing your EndNote library.`
- `The uploaded file could not be opened as a ZIP archive.`
- `The archive shape is unsupported for the browser-local MVP.`
- `Archive shape looks valid, but the prepared library is missing sdb/sdb.eni.`

### Common causes and fixes

#### Wrong file type selected

Cause:

- you selected something other than a `.zip`

Fix:

- re-export or repackage the EndNote library as a ZIP and upload that ZIP file

#### The file has a `.zip` suffix but is not a readable ZIP archive

Cause:

- the archive is corrupt, incomplete, or was renamed without being zipped properly

Fix:

- recreate the ZIP from the original library contents
- avoid ad hoc renaming of non-ZIP files to `.zip`

#### The ZIP does not contain a supported EndNote shape

Cause:

- the archive does not contain exactly one supported root `.enl` library plus sibling `.Data/`, or one supported `.enlp` package layout

Fix:

- ensure the ZIP contains either:
  - `MyLibrary.enl` and `MyLibrary.Data/...`, or
  - `MyLibrary.enlp/...` containing the packaged library contents
- avoid mixing unrelated top-level files with a packaged `.enlp` root

#### The ZIP is missing the database

Cause:

- `sdb/sdb.eni` is not present where the app expects it

Fix:

- confirm the selected library is complete before zipping
- verify that the `.Data` directory contains `sdb/sdb.eni`
- if the ZIP was created manually, rebuild it from the intact EndNote library

## The folder picker button is missing

### Symptoms

You see:

- `Direct-folder intake unavailable here`

### Cause

Direct folder intake is **experimental** and shown only when the browser provides `showDirectoryPicker()` in a served, secure context.

### What to do

- use ZIP upload; it remains the supported baseline path
- if you were expecting the folder picker, switch to a secure served context and a browser that exposes the directory-picker API
- do not block on folder intake if ZIP upload already works

## I chose a folder and then nothing happened

### Symptoms

You may see:

- `Folder selection cancelled. ZIP upload remains available.`
- `Folder conversion failed. ZIP upload remains available as the baseline path.`

### Cause

Either the picker was cancelled or the selected folder could not be normalized into a supported library shape.

### What to do

- retry with the full library folder or package root
- if the folder route continues to fail, ZIP the same library and use the supported ZIP-first flow

## The conversion succeeds, but PDF links are missing from the XML

### Symptoms

The summary shows:

- `Attachment mode: metadata-only-no-links`
- a warning with code `ATTACHMENT_LINKS_OMITTED`

### Cause

This is the default browser-local behavior. The browser does not automatically reveal native absolute filesystem paths from file or folder pickers.

### What to do

- if you only need the bibliographic export, no action is required
- if you want PDF paths emitted, enter a value in **Optional library location for PDF links** and reconvert
- use the folder containing the `.enl` file and sibling `.Data`, or the full `.enlp` package path

## I supplied a library location, but only some PDF links were exported

### Symptoms

You may see:

- `ATTACHMENT_LINKS_PARTIAL`
- `ATTACHMENT_PAYLOAD_MISSING`
- a non-zero `Missing attachment payloads` count in the summary

### Cause

The app only emits PDF paths when it can verify attachment payloads from the selected ZIP or folder input. If payloads are missing or do not match the database metadata, links are omitted.

### What to do

- confirm the selected ZIP or folder actually includes the expected `PDF/` attachment files
- confirm the supplied library location matches the same library you uploaded
- rebuild the ZIP from a complete EndNote library if attachment files were omitted

## The conversion succeeds, but some records were skipped

### Symptoms

The summary shows a non-zero **Skipped rows** count or warns that conversion completed with skipped records.

### Cause

The browser-local pipeline tolerates some record-level problems by exporting the rows it can and surfacing warnings for the ones it skipped.

### What to do

- review the warnings shown in the UI
- use **View Exported Items** to review the items that were emitted
- if the skipped rows are unacceptable, compare against the desktop app for the same library

## The XML download does not start

### Symptoms

You may see:

- `No export result is available yet. Convert a library before downloading.`
- `The generated XML is empty, so there is nothing to download.`
- `The browser document body is unavailable, so the download could not be started.`
- `The XML download could not be started.`

### What to do

- make sure the conversion completed successfully before selecting **Download Zotero XML**
- retry the download once after the result summary is visible
- check whether the browser blocked the download or placed it in a default downloads folder you were not expecting
- retry in the supported Chromium baseline if the issue is browser-specific

## Browser support feels inconsistent

### Cause

That can happen if the workflow moves outside the documented support tier.

### Current interpretation

- **Supported:** Chromium-class, served mode, ZIP-first workflow
- **Best effort:** Firefox or Safari/WebKit, served mode, ZIP-first workflow
- **Experimental:** direct folder selection
- **Unsupported:** `file://` launch and browser contexts lacking the required worker/WASM/module behavior

See the full matrix in [`support-matrix.md`](./support-matrix.md).

## Large library or performance concerns

The current public docs should remain conservative.

The browser-first architecture passed the initial feasibility gate, but the documented tested envelope is still small. The threshold document explicitly says not to promise broad large-library support yet.

### What to do

- start with a representative smaller library if you are trying the browser-local path for the first time
- if a large or complex library is critical, keep the desktop app available as the fallback path
- if you are validating release readiness, use the thresholds in [`performance-thresholds.md`](./performance-thresholds.md)

## Troubleshooting checklist for bug reports

When filing a browser-local bug, include:

- browser family and version
- whether the app was opened from `http://localhost`, `https://...`, or mistakenly from `file://`
- whether you used ZIP upload or folder intake
- the exact visible error or warning code
- whether you supplied a library location for PDF links
- whether the same library works in the Python desktop application

## Related documents

- [`user-guide.md`](./user-guide.md)
- [`support-matrix.md`](./support-matrix.md)
- [`attachment-policy.md`](./attachment-policy.md)
- [`performance-thresholds.md`](./performance-thresholds.md)
- [`release-ops.md`](./release-ops.md)
