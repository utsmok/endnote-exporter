# Browser-local Attachment Policy

**Status:** Implemented MVP policy
**Date:** 2026-03-18
**Applies to:** Browser-local conversion only
**Desktop oracle reference:** Python exporter currently emits absolute `<pdf-urls>` paths resolved from `{library}.Data/PDF/`

## Purpose

This document defines the browser-local attachment behavior for the current implementation.

The desktop exporter treats the local filesystem as authoritative and emits resolved absolute PDF paths inside the XML. That behavior is valid for the desktop runtime and invalid as an automatic browser promise because browsers generally do not expose native absolute paths from file or folder pickers.

The browser-local implementation therefore keeps a conservative default while allowing an explicit opt-in path mode when the user supplies the missing filesystem context.

## Policy statement

### Mode 1: default metadata-only, no XML attachment links

This is the default browser-local behavior.

In this mode:

- attachment rows are detected from the normalized library input
- attachment presence influences result metadata and warnings
- browser-local XML does **not** emit `<pdf-urls>` entries
- browser-local XML does **not** synthesize fake absolute paths, blob URLs, session URLs, or pseudo-portable placeholders as attachment links

### Mode 2: user-supplied library location + verified relative attachment paths

This mode is opt-in.

In this mode:

- the browser still does **not** discover native absolute paths on its own
- the user supplies the missing native path context explicitly
- the exporter combines that user-supplied location with **verified relative attachment paths** found in the selected ZIP or folder input
- only verified attachment payloads are emitted to `<pdf-urls>`
- unmatched or missing attachment payloads remain omitted and generate warnings

The supported user-supplied location inputs are:

- the folder containing the `.enl` file and sibling `.Data/` directory, or
- the full `.enlp` package path

## Rationale

The default policy is intentionally conservative for the following reasons:

1. a browser session does not provide a stable, portable equivalent to the desktop exporter’s absolute filesystem path contract
2. a path-looking string that cannot be relied upon after download would be misleading rather than useful
3. automatic attachment-path parity is explicitly de-scoped by the MVP contract
4. attachment detection remains valuable for counts, warnings, and later escalation decisions even when link export is disabled
5. the opt-in mode is honest only because it depends on user-supplied path context and verified relative payload matches from the selected ZIP or folder input

## Input-side attachment discovery

Attachment discovery remains derived from the same logical source used by the desktop exporter:

- `file_res.refs_id`
- `file_res.file_path`
- attachment root conceptually anchored at `PDF/`

For browser-local normalization and conversion:

- each attachment entry preserves the database-relative `file_path`
- the prepared library model tracks normalized archive-relative and folder-relative attachment locations
- missing attachment files are recorded as warnings rather than silently ignored

## XML behavior

### Required behavior

When a record has one or more attachment rows:

- keep all supported non-attachment XML mapping behavior unchanged
- preserve `<web-urls>` behavior if regular URLs exist
- omit `<pdf-urls>` entirely when the user did not provide a library location
- emit `<pdf-urls>` only when the user provided a library location and the attachment payload could be verified from the selected ZIP or folder input

### Disallowed behavior

The following are not allowed in browser-local XML:

- automatic discovery of host absolute filesystem paths from browser pickers
- guessed or synthesized local paths that are not anchored to user-supplied location context
- transient blob/object URLs embedded as if they were stable attachment references
- `${PDF_ROOT}` placeholders in user-facing browser output

`${PDF_ROOT}` remains a test-fixture normalization mechanism for checked-in Python goldens only. It is not a browser-local export format.

## Notes behavior

Attachment warnings must **not** be injected into the exported `<notes>` field.

Warnings belong in browser-local result metadata and UI surfaces, not inside the bibliographic note field.

## Result metadata requirements

Browser-local export results must expose attachment information explicitly outside the XML.

The minimum required semantics are:

- `attachmentMode`: `"metadata-only-no-links"` or `"base-library-path-links"`
- total attachment row count detected from the library
- linked attachment count actually emitted to `<pdf-urls>`
- per-record or aggregate indication that attachments were present
- warning when attachment rows are present but no user-supplied location was provided
- warning when an attachment row references a missing payload in the prepared library
- warning when only a subset of attachment rows could be emitted as verified PDF paths

## User-visible warning policy

If any attachment rows are detected, the browser-local UI or result surface must communicate that:

- attachments were detected
- the browser does not auto-discover native absolute paths from pickers
- PDF paths are exported only when the user supplies the missing library location
- the XML remains valid for the supported bibliographic conversion scope

If any attachment payload referenced by metadata is missing from the prepared library, the warning must additionally state that attachment content was incomplete.

## Fixture and test implications

### `attachment-present`

This fixture remains mandatory.

Required browser-local assertions:

- record count matches the oracle
- bibliographic XML fields other than attachment links match the oracle
- `<web-urls>` remain intact
- `<pdf-urls>` are omitted by default
- `<pdf-urls>` may be present only when the user supplied a library location and the payload path was verified from the selected ZIP or folder input
- attachment result metadata reports detected attachment rows and emitted PDF links separately
- warnings indicate the approved browser-local limitation or partial-link behavior as applicable

### Missing attachment payload case

When attachment metadata exists but the file payload is absent:

- the export may still succeed for bibliographic output
- result metadata must mark the attachment as missing
- warnings must disclose the missing payload
- no `<pdf-urls>` entry is emitted for the missing payload

## Explicit non-goals

The browser-local attachment policy still does not attempt to provide:

- automatic desktop-style absolute path discovery from browser input controls
- packaging of attachment binaries alongside XML
- guaranteed downstream import parity for incorrect user-supplied locations
- post-download reattachment workflows

Those topics may be evaluated later, but they are outside MVP.
