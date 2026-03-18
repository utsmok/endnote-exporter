# Browser-local Parity Rules

**Status:** Drafted for MVP implementation guidance
**Date:** 2026-03-18
**Oracle:** Current Python exporter plus T002 fixture corpus and goldens

## Purpose

This document classifies browser-local parity expectations into three explicit classes:

- **must match**
- **may differ but must be documented**
- **explicitly unsupported in browser-local MVP**

The goal is to stop parity discussions from collapsing into an unbounded demand for desktop equivalence. Browser-local work is required to match the Python exporter where doing so is runtime-neutral and product-relevant, and is allowed to diverge only where the runtime contract makes equivalence invalid or misleading.

## Parity authority

The parity authority for MVP is:

1. `endnote_exporter.py` for current semantic behavior
2. `testing/browser-local/fixture-manifest.json` for approved fixture classifications
3. checked-in T002 goldens for supported fixtures
4. this document and `attachment-policy.md` for approved browser-local divergence

If these sources disagree, the resolution order is:

1. fixture manifest failure classification and supported fixture list
2. explicit divergence policy documents
3. Python exporter behavior

This ordering prevents accidental inheritance of desktop-only assumptions that are already rejected by the browser-local contract.

## Fixture classes

The current approved fixture classes are:

| Fixture ID | Class | Current comparison model |
|---|---|---|
| `supported-enl-data` | supported | normalized exact XML |
| `supported-enlp-equivalent` | supported | normalized exact XML |
| `attachment-present` | supported with attachment divergence | normalized exact XML in Python oracle; browser-local follows approved attachment divergence |
| `mixed-case-data-lookup` | supported | normalized exact XML |
| `stress-large` | stress / supported for later threshold work | normalized exact XML |
| `missing-db` | expected failure | failure classification |
| `malformed-archive` | expected failure | failure classification |

## Must match

The following behaviors are mandatory parity targets for browser-local MVP.

### 1. Supported input shape classification

Browser-local normalization must recognize the approved fixture shapes consistently with the current contract:

- `.enl` plus sibling `.Data/`
- `.enlp`-equivalent packaged contents
- case-insensitive `.Data` lookup where applicable

### 2. Failure-class semantics for known rejected inputs

For known rejected inputs, browser-local behavior must match the failure class even if the exact runtime error object differs.

Required failure classes:

- `missing-database`
- `malformed-archive`

User-visible browser wording may differ, but internal classification and test expectation must remain stable.

### 3. Record inclusion and exclusion rules

The browser-local implementation must preserve:

- `trash_state = 0` inclusion behavior
- exclusion of trashed rows
- identical record counts for supported fixtures, subject only to explicitly approved divergence

### 4. Core bibliographic mapping

For supported records, the browser-local conversion must preserve the Python exporter’s behavior for:

- `rec-number`
- `ref-type` numeric mapping and `name` attribute
- `dates/year`
- `dates/pub-dates/date`
- `titles/title`
- `titles/secondary-title`
- `titles/short-title`
- `titles/alt-title`
- `titles/tertiary-title` fallback rule
- contributors and secondary authors
- scalar bibliographic fields such as pages, volume, number, abstract, publisher, pub-location, edition, DOI, language, accession number, and custom fields currently emitted
- keyword splitting behavior
- access-date formatting behavior
- notes composition with created/modified metadata lines

### 5. XML structure and ordering

For supported fields that remain in scope, browser-local XML must preserve:

- root shape: `<xml><records><record>...`
- per-record element ordering documented in `conversion-spec.md`
- deterministic output for the same normalized input
- XML legality after sanitization

### 6. Empty-element vs omitted-element behavior

Where the Python exporter emits an empty element rather than omitting the field, browser-local XML must do the same unless a specific divergence is approved.

Examples from the current oracle:

- empty `pages`
- empty `volume`
- empty `number`
- empty `abstract`
- empty `isbn`
- empty `secondary-title`

### 7. Note metadata semantics

The browser-local implementation must preserve the Python note semantics for supported records:

- original note text remains first
- `Created:` and `Modified:` metadata lines are appended after a blank line when present
- no unrelated warnings are injected into `<notes>` unless such mutation is explicitly approved later

### 8. Fixture determinism

For supported non-attachment fixture cases, comparison should remain normalized exact XML, not semantic-only comparison.

The `supported-enl-data`, `supported-enlp-equivalent`, and `mixed-case-data-lookup` fixtures are the primary must-match anchors.

## May differ but must be documented

The following differences are acceptable for browser-local MVP only when they are explicit in docs, tests, and user-facing warnings or result metadata.

### 1. Attachment link representation

The desktop exporter emits absolute filesystem paths in `<pdf-urls>`.

Browser-local MVP is allowed to diverge here because:

- the browser does not own a stable host filesystem path contract
- emitting synthetic absolute paths would be misleading
- preserving unusable links would create false parity

The approved initial behavior is defined in `attachment-policy.md`.

### 2. Warning surface and result metadata

The Python exporter relies on logging side effects for several degraded states.

Browser-local MVP may replace logging-only behavior with structured warnings and result metadata, provided that:

- the divergence is explicit
- the warning does not silently alter core bibliographic field output
- tests assert the documented browser-local result contract

### 3. Output destination mechanics

Desktop export writes to a filesystem path. Browser-local export will produce a downloadable artifact instead.

This is a runtime delivery difference, not a conversion-semantic regression.

### 4. Attachment-presence reporting

Desktop behavior treats attachment presence as URL emission. Browser-local MVP may instead surface attachment counts, statuses, or warnings outside the XML, as long as the behavior matches `attachment-policy.md`.

### 5. Diagnostic side effects

The desktop exporter writes comparison logs and runtime logs. Browser-local MVP does not need to reproduce:

- `comparisons.jsonl`
- desktop log-file placement
- PyInstaller-specific logging behavior

These are implementation side effects, not parity requirements.

## Explicitly unsupported in browser-local MVP

The following behaviors are outside the browser-local MVP contract and must not be treated as parity defects.

### 1. Desktop-style absolute PDF path fidelity

Browser-local MVP does not support preserving or synthesizing desktop absolute attachment paths comparable to:

- `/Users/.../Library.Data/PDF/...`
- `C:\...\Library.Data\PDF\...`
- any other host-native absolute path form

### 2. Raw desktop filesystem semantics

Browser-local MVP does not promise:

- unrestricted direct folder traversal
- arbitrary host path reconstruction
- durable access to files after the browser session unless explicitly implemented later

### 3. `file://` runtime support

Any parity argument that depends on launching the browser app from `file://` is out of scope for MVP.

### 4. Unapproved intake shapes

Inputs outside the frozen contract are unsupported, including unrestricted assumptions about loose files or package layouts not covered by the approved normalization rules.

### 5. Desktop-specific operational side effects

Browser-local MVP does not need to reproduce desktop-specific behavior such as:

- output file placement heuristics tied to the source library directory
- frozen-app log locations
- OS-specific default Documents-folder behaviors unrelated to conversion semantics

## Test implications

### Supported fixtures

For supported fixtures without attachment divergence, browser-local tests should use exact XML comparison after approved normalizations.

### Attachment fixture

For `attachment-present`, browser-local tests should split assertions into two buckets:

1. **must match**
   - record count
   - bibliographic fields
   - notes semantics
   - web URL behavior
2. **approved divergence**
   - no desktop absolute-path parity requirement for `pdf-urls`
   - required structured warning / metadata assertions per `attachment-policy.md`

### Failure fixtures

For `missing-db` and `malformed-archive`, tests should assert stable failure classification rather than over-fitting to Python exception text.

## Change-control rule

Any new browser-local divergence must be added to this document before it is treated as accepted behavior.

Absent such documentation, the default expectation is **must match**.
