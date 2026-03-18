# Browser-local Conversion Specification

**Status:** Drafted from current Python exporter behavior
**Date:** 2026-03-18
**Oracle:** `endnote_exporter.py` (`EndnoteExporter`)
**Applies to:** Browser-local implementation planning and parity tests

## Purpose

This document extracts the conversion semantics of the current Python exporter into an implementation-guiding specification.

The Python desktop exporter is the behavioral oracle for supported conversion semantics. Browser-local work should preserve these semantics unless a divergence is explicitly allowed in `parity-rules.md` or `attachment-policy.md`.

This document is intentionally technical. It describes current behavior, not an idealized redesign.

## Scope boundary

This specification covers:

- library path resolution rules relevant to conversion correctness
- database selection and record inclusion rules
- field mapping from EndNote SQLite rows into XML record structures
- XML emission order, sanitization, and empty-element behavior
- record-level error tolerance currently present in the Python exporter

This specification does not define browser intake UX, support tiers, or browser attachment divergence policy. Those are defined separately.

## Source behavior summary

The current exporter:

1. validates the selected library extension as `.enl` or `.enlp`
2. resolves the corresponding `.Data` directory and `sdb/sdb.eni` SQLite database
3. queries:
   - `refs` rows where `trash_state = 0`
   - all `file_res` rows for attachment mapping
4. maps each surviving row into an in-memory record dictionary
5. emits a Zotero-compatible XML document rooted at `<xml><records>...`
6. writes pretty-printed XML in UTF-8

The exporter treats the local filesystem as authoritative. Browser-local implementations must preserve the conversion semantics while replacing filesystem assumptions only where explicitly allowed.

## Input and library resolution

### Accepted library extensions

The desktop oracle accepts the following input extensions, case-insensitively:

- `.enl`
- `.enlp`

Any other suffix raises `ValueError` before conversion begins.

### `.enl` resolution

For a standard `.enl` library:

- `library_name = enl_file_path.stem`
- `base_path = enl_file_path.parent`
- expected data directory name is `"{library_name}.Data"`

The current implementation resolves the data directory through `find_data_folder()`:

1. exact directory name match first
2. case-insensitive directory-name scan second

This case-insensitive fallback is part of the behavioral contract and is required by the `mixed-case-data-lookup` fixture.

### `.enlp` resolution

For a macOS package-style `.enlp` input:

- the package directory is treated as the base path
- the exporter searches for a `*.enl` file inside the package
- if found, the internal `.enl` stem determines the expected `.Data` directory name
- if no internal `.enl` is found, the exporter falls back to the first `*.Data` directory inside the package
- if neither exists, export fails with `FileNotFoundError`

The browser-local implementation must preserve support for `.enlp`-equivalent packaged contents after normalization.

### Database location

After resolving the data directory, the database path is fixed as:

- `{data_path}/sdb/sdb.eni`

If the `.Data` directory is not found, export aborts with `FileNotFoundError`.
If `sdb/sdb.eni` is missing, export aborts with `FileNotFoundError`.

These are contract-level failure classes, not recoverable warnings.

## Database selection rules

### Reference query

The exporter reads references using:

- `SELECT * FROM refs WHERE trash_state = 0`

The selection rule is therefore:

- records with `trash_state = 0` are eligible for output
- records with any non-zero trash state are excluded completely

No additional filtering is applied at SQL level.

### Attachment query

The exporter reads attachment rows using:

- `SELECT refs_id, file_path FROM file_res`

Each `file_res.file_path` value is grouped by `refs_id` and later resolved relative to the library PDF root:

- `{data_path}/PDF/{file_path}`

The Python exporter includes attachment URLs even if the referenced file is missing on disk. Missing files are logged, but the record is still exported.

## Output document structure

The emitted XML document has the following top-level structure:

- `<xml>`
  - `<records>`
    - zero or more `<record>` elements

One `<record>` is emitted for each successfully converted reference row.

If an individual row fails during record mapping or XML emission, that row is skipped and export continues for the remaining rows.

## Record mapping rules

### Required per-record base fields

Every successfully emitted record starts with:

1. `<rec-number>` from `refs.id`
2. `<ref-type>` from mapped reference type
3. `<dates>`
4. `<titles>`

The current emission order is significant for fixture parity and should be preserved.

### Reference type mapping

The Python exporter attempts `int(ref["reference_type"])`. Invalid or missing values fall back to `0`.

The current mapping table is:

| Raw `reference_type` | Emitted numeric `ref-type` | Emitted `name` attribute |
|---|---:|---|
| `0` | `17` | `Journal Article` |
| `1` | `6` | `Book` |
| `2` | `32` | `Thesis` |
| `3` | `10` | `Conference Proceedings` |
| `7` | `5` | `Book Section` |
| `10` | `27` | `Report` |
| `22` | `31` | `Statute` |
| `31` | `13` | `Generic` |
| `37` | `34` | `Unpublished Work` |
| `43` | `56` | `Blog` |
| `46` | `57` | `Serial` |
| `48` | `59` | `Dataset` |

If a raw integer is not found in the map, the exporter emits that integer directly and leaves the `name` attribute empty unless a matching name exists in the name table.

### Timestamp handling

The exporter reads `added_to_library` and `record_last_updated` and passes each value through `format_timestamp()`.

Current behavior:

- `None`, `0`, and empty string are treated as absent
- digit strings are parsed as integers
- float-like strings are coerced to integer seconds if possible
- invalid values are ignored rather than raising
- successful parse uses local `datetime.fromtimestamp()` and ISO 8601 seconds precision

These timestamps are not emitted as dedicated XML date fields. They are appended into `<notes>` metadata lines as:

- `Created: {iso}`
- `Modified: {iso}`

### Dates block

The `<dates>` element is always emitted.

Contained fields:

- `<year>` only when `refs.year` is truthy
- `<pub-dates><date>...</date></pub-dates>` only when `refs.date` is truthy

Publication date is preserved as the raw string from the database.

### Titles block

The `<titles>` element is always emitted.

Contained fields:

- `<title>` from `refs.title`
- `<secondary-title>` from `refs.secondary_title`
- `<short-title>` only when non-empty
- `<tertiary-title>` only in the conference fallback case described below
- `<alt-title>` only when non-empty

### Contributors

`<contributors>` is emitted only when `refs.author` is truthy.

Current parsing behavior:

- primary authors are split on line breaks only
- each non-empty line becomes one `<author>` inside `<contributors><authors>`

Secondary authors:

- source field: `refs.secondary_author`
- string values are normalized by replacing `\r` with `\n`, splitting on newline, and trimming blank lines
- emitted as `<contributors><secondary-authors><author>...`

There is no author parsing on semicolons or commas.

### Serial / periodical handling

The exporter emits `<periodical>` only in limited cases.

Current rule:

- emit when `secondary_title` exists and mapped `ref-type == 17`
- also emit when `secondary_title` exists and its lowercase text contains `"advances in"`

When emitted:

- `<full-title>` comes from `secondary_title`
- a known title normalization table is applied at XML emission time for several journal names
- `<abbr-1>` may be injected from `short_title` or a small hard-coded abbreviation map when the abbreviation looks reasonable

### Alternate periodical handling

The exporter may build `<alt-periodical>` from `alternate_title` or `alt_title`.

Current behavior:

- if alternate title is shorter than `secondary_title`, it may be treated as an abbreviation
- otherwise it is treated as an alternate full title
- for mapped journal records (`ref-type == 17`), a known abbreviation match may produce both `full-title` and `abbr-1`
- for non-journal mapped records, any computed `alt-periodical` is removed before emission

### Conference / tertiary-title fallback

For mapped types associated with proceedings or serial-like conference material (`3`, `10`, `46` raw types after current logic), the exporter uses the following fallback:

- if `secondary_title` is empty and alternate title exists, emit `<titles><tertiary-title>{alternate_title}</tertiary-title>`

### Scalar bibliographic fields

The exporter currently maps the following database fields directly when present:

| Database field | XML field |
|---|---|
| `pages` | `pages` |
| `volume` | `volume` |
| `number` | `number` |
| `abstract` | `abstract` |
| `electronic_resource_number` | `electronic-resource-num` |
| `language` | `language` |
| `type_of_work` | `work-type` |
| `custom_7` | `custom7` |
| `custom_3` | `custom3` |
| `section` | `section` |
| `label` | `label` |
| `place_published` | `pub-location` |
| `publisher` | `publisher` |
| `accession_number` | `accession-num` |
| `custom_1` | `custom1` |
| `custom_2` | `custom2` |
| `edition` | `edition` |
| `name_of_database` | `remote-database-name` |
| `database_provider` | `remote-database-provider` |

### ISBN handling

If `isbn` is present:

- the raw string is preserved
- `\r\n` and `\n` are normalized to carriage return (`\r`) before XML emission

This behavior exists to match existing EndNote-style XML line-ending behavior.

### Author address handling

If `author_address` is present:

- leading and trailing whitespace is stripped
- `\r\n` and `\n` are normalized to carriage return (`\r`)
- emitted as `auth-address`

### URL handling

If `refs.url` is present:

- whitespace-separated tokens become `<web-urls><url>...` entries

This is a whitespace split, not a line-preserving or comma-preserving strategy.

If attachment rows exist for the reference:

- each `file_res.file_path` is resolved against `{data_path}/PDF/`
- the resolved absolute filesystem path is stringified and emitted in `<pdf-urls><url>...`
- missing files do not suppress output; they only produce debug logging

Desktop absolute PDF path emission is a current oracle behavior, but browser-local divergence is allowed only as documented in the attachment policy.

### Keyword handling

Keyword parsing uses `_split_keywords()` with the following behavior:

- if the field contains line breaks, split on lines
- else if the field contains semicolons, split on semicolons
- else preserve the full string as one keyword, including commas if present

This behavior is intentionally conservative. Comma-separated strings are not expanded into multiple keywords.

Keywords are emitted as:

- `<keywords><keyword>...`

### Access date handling

If `access_date` is present:

- numeric values and digit strings are parsed as epoch seconds and formatted as `YYYY-MM-DD HH:MM:SS`
- non-numeric values are emitted as raw strings
- parse failures fall back to raw string emission

### Notes composition

`<notes>` is always emitted.

Current composition algorithm:

1. start with an empty metadata list
2. append `Created: ...` if `added_to_library` parsed successfully
3. append `Modified: ...` if `record_last_updated` parsed successfully
4. join metadata lines with newline
5. if `refs.notes` is non-empty after trimming:
   - emit `original_notes + "\n\n" + metadata_block`
6. otherwise emit only the metadata block

The exporter does not create a separate attachment-note element.

## XML emission order

Within each `<record>`, the current emitter writes elements in this order:

1. `rec-number`
2. `ref-type`
3. `dates`
4. `titles`
5. `contributors` (conditional)
6. `periodical` (conditional)
7. `pages`
8. `volume`
9. `number`
10. `abstract`
11. `isbn`
12. `work-type` (conditional)
13. `custom7` (conditional)
14. `section` (conditional)
15. `label` (conditional)
16. `pub-location` (conditional)
17. `alt-periodical` (conditional)
18. `publisher` (conditional)
19. `accession-num` (conditional)
20. `auth-address` (conditional)
21. `custom1` (conditional)
22. `custom2` (conditional)
23. `custom3` (conditional)
24. `edition` (conditional)
25. `electronic-resource-num` (conditional)
26. `language` (conditional)
27. `access-date` (conditional)
28. `urls` (conditional)
29. `keywords` (conditional)
30. `notes`

For fixture parity, later implementations should preserve this order unless a divergence is explicitly approved.

## Sanitization and empty-element behavior

### Text sanitization

All emitted text and attribute values pass through `safe_str()`.

Current behavior:

- coerce to string
- trim leading and trailing whitespace
- remove XML-illegal characters outside XML 1.0 allowed ranges
- if sanitization fails, fall back to empty string

### Empty elements

Several elements are emitted even when their value is empty because the current emitter unconditionally creates them:

- `pages`
- `volume`
- `number`
- `abstract`
- `isbn`
- `titles/secondary-title`
- `notes`
- `dates`
- `titles`

This produces self-closing elements in fixtures where the field is absent.

Other blocks are conditional and omitted entirely when absent, including:

- `contributors`
- `periodical`
- `alt-periodical`
- `urls`
- `keywords`
- many scalar optional fields

## Error tolerance

The current exporter is not all-or-nothing at record level.

### Hard failures that abort export

The export aborts for:

- invalid library suffix
- missing `.Data` directory
- missing `sdb/sdb.eni`
- SQLite open failures

### Per-record failures that skip a record

The exporter logs and skips a single record when either of these per-row stages raises:

- `_build_record_dict()`
- `_dict_to_xml()`

This is part of current behavior, although the browser-local MVP should aim to avoid silent record loss for supported fixtures.

## Fixture anchors for this specification

The following fixtures exercise the current contract and should remain the first-line parity anchors:

- `supported-enl-data`
  - baseline journal-like record mapping
  - dates, contributors, keywords, DOI, web URL
- `supported-enlp-equivalent`
  - package-like library handling
  - book mapping and sparse optional fields
- `attachment-present`
  - attachment detection and current desktop PDF URL behavior
- `mixed-case-data-lookup`
  - case-insensitive `.Data` folder resolution
- `stress-large`
  - deterministic multi-record volume for future threshold work
- `missing-db`
  - missing database failure classification
- `malformed-archive`
  - malformed ZIP failure classification at normalization stage

## Implementation guidance for later browser work

Later browser-local modules should treat this document as the source of truth for:

- data normalization targets before mapping
- deterministic record serialization
- fixture-based parity expectations

Any intentional departure from this behavior must be added to `parity-rules.md` before implementation is treated as complete.
