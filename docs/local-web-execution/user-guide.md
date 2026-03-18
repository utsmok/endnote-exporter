# Browser-local user guide

**Status:** Current implementation guide for the served browser-local workflow
**Applies to:** `web/` browser-local conversion surface

## What this guide covers

This guide describes the current browser-local workflow conservatively.

It does **not** replace the existing Python desktop application. The desktop app remains the fallback for workflows that require established desktop filesystem behavior or the desktop exporter's current automatic absolute PDF-path behavior.

## Runtime model at a glance

| Topic | Current behavior |
|---|---|
| Local processing | Your selected EndNote library is processed in the browser runtime on your device. The baseline flow does not send library contents to a project-controlled conversion backend. |
| Offline-capable behavior | Conversion itself runs locally after the application has loaded. Initial load or reload still requires the served application assets to be available. The current build is **not** documented as a standalone offline-first web app. |
| Supported launch mode | Open the app in **served mode** over `http://localhost` or `https://...`. |
| `file://` launch | **Unsupported.** Opening `index.html` directly from disk is outside the product contract. |
| Baseline intake | ZIP upload containing an approved EndNote library shape. |
| Direct folder intake | **Experimental** progressive enhancement only. It appears only when the browser exposes the required directory-picker capability in a served, secure context. |

For the formal policy documents, see:

- [`contracts.md`](./contracts.md)
- [`privacy.md`](./privacy.md)
- [`support-matrix.md`](./support-matrix.md)
- [`attachment-policy.md`](./attachment-policy.md)

## Before you start

Prepare one of the currently approved input shapes:

1. a `.zip` containing a root `.enl` file and sibling `.Data/` directory, or
2. a `.zip` containing `.enlp`-equivalent packaged contents

The ZIP-first path is the supported baseline. If you currently have a loose library folder on disk, package it as a ZIP if the folder picker is unavailable or if you want the most predictable path.

## Supported and best-effort browser tiers

Use the support tiers conservatively:

| Browser/runtime combination | Tier | Notes |
|---|---|---|
| Chromium-class current stable in served mode with ZIP-first intake | Supported | Primary target. |
| Firefox current stable in served mode with ZIP-first intake | Best effort | No direct-folder promise. |
| Safari/WebKit current stable in served mode with ZIP-first intake | Best effort | No direct-folder promise. |
| Any browser launched via `file://` | Unsupported | Even if it appears to load, it is outside the support contract. |
| Direct folder selection in any browser | Experimental | Capability-gated convenience only, not the baseline promise. |

If you need the least surprising path, use a current Chromium-based browser and a ZIP file.

## Converting a library

### 1. Open the application in served mode

Use one of these supported launch shapes:

- a locally served instance such as `http://localhost:...`
- an HTTPS deployment that serves the built application files

Do **not** open the app by double-clicking `index.html` from disk.

After the workspace becomes ready, the desktop-first UI presents:

- one primary ZIP-first task surface
- a visible workflow strip
- a persistent trust/capability block
- an initially empty inline review workspace that fills after conversion

### 2. Select your input

You can use either of the following:

- **Supported baseline:** choose or drag-and-drop a `.zip` file
- **Experimental:** choose **Library Folder** only if that button is visible in the UI

The direct-folder button is intentionally hidden when the browser context does not expose the required capability.

### 3. Optional: supply a library location for PDF links

The field labeled **Optional library location for PDF links** appears under the secondary options area and controls whether `<pdf-urls>` entries are emitted.

If you leave it blank:

- the export still processes bibliographic data
- attachment rows are still counted
- the XML omits `<pdf-urls>`
- the result summary warns that PDF links were omitted

If you fill it in:

- the browser still does **not** discover native paths automatically
- you are explicitly providing the missing native path context
- the exporter combines your supplied location with **verified relative attachment paths** found in the selected ZIP or folder input
- unmatched or missing payloads remain omitted and produce warnings

Use one of these forms:

- for `.enl` + `.Data`: the folder containing the `.enl` file and sibling `.Data` directory
- for `.enlp`: the full `.enlp` package path

Examples:

- `/Users/me/Documents/MyLibrary`
- `C:\Users\me\Documents\MyLibrary.enlp`

## What you see after conversion

After a successful run, the UI reports:

- library name
- exported record count
- input row count
- skipped row count
- attachment counts
- linked PDF count
- attachment mode used
- warnings, if any

The result lands in an inline desktop review workspace rather than a modal dialog.

That workspace includes:

- summary metrics and warning groupings in a left-side review rail
- download and reset actions adjacent to the review surface
- an exported-items table with title, author, journal, year, PDF status, and DOI behaviour

You can then:

- **Download Zotero XML**
- inspect the inline review workspace before import
- **Convert another library** to reset the screen for the next run

## Download behavior

The current browser-local output artifact is a downloadable XML file.

The filename is derived from the library display name when possible, for example:

- `supportedlibrary-zotero-import.xml`

The download is generated locally in the browser from the conversion result.

## Attachment behavior

### Default behavior

The default attachment mode is:

- `metadata-only-no-links`

This means:

- attachment rows may still be detected from the EndNote database
- the summary can report attachment presence
- the XML does **not** emit `<pdf-urls>` entries unless you supplied a library location

### Opt-in path-link mode

If you provide a library location and the selected ZIP or folder includes matching attachment payloads, the attachment mode becomes:

- `base-library-path-links`

In that mode, the XML can include verified PDF paths built from:

1. your supplied base path, and
2. verified relative attachment paths found in the selected input

The exporter does **not** synthesize fake paths, blob URLs, or placeholders.

### When warnings appear

You should expect warnings when:

- attachment rows were found but no library location was supplied
- only some attachments could be matched to payloads in the selected ZIP or folder
- attachment metadata referenced files that were not present in the selected input
- some records were skipped during conversion

## Offline and privacy notes

The important distinction is:

- **local processing**: yes, the conversion runs locally in the browser runtime on your device
- **offline-first application**: no, that is not the current support claim
- **server-side conversion requirement**: no, not for the baseline flow

If you are using a hosted served build, the app assets themselves may still be delivered over the network like any other static website. That does not change the baseline conversion model into a hosted conversion service.

Current session behavior is intentionally conservative:

- theme preference may persist between visits
- conversion and review data are treated as in-memory session state
- if you refresh or replace the tab, the previous review workspace is intentionally not restored
- if you still need the XML after a refresh, rerun the same ZIP and download again in the new session

For the formal statement, see [`privacy.md`](./privacy.md).

## When to use the desktop app instead

Prefer the Python desktop application if you need any of the following:

- established desktop filesystem behavior
- the current desktop exporter's automatic absolute attachment-path behavior
- a workflow that cannot rely on a served browser session
- behavior outside the documented browser-local support matrix

## Related documents

- [`support-matrix.md`](./support-matrix.md)
- [`privacy.md`](./privacy.md)
- [`attachment-policy.md`](./attachment-policy.md)
- [`troubleshooting.md`](./troubleshooting.md)
- [`release-ops.md`](./release-ops.md)
