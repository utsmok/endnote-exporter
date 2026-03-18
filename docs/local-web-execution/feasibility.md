# SQLite/WASM Feasibility Findings

**Task:** T003 — Run SQLite/WASM feasibility spike and define thresholds
**Date:** 2026-03-18
**Status:** Completed for the initial feasibility gate

## Scope of this spike

This task intentionally used a **narrower-than-full-browser spike**.

Instead of building premature ZIP-first UI, browser routing, and worker orchestration ahead of `T006` and `T007`, the spike proves the smallest technical claim that matters most:

> a worker-based SQLite/WASM runtime can load the approved EndNote `sdb/sdb.eni` payloads from bytes and execute the required `refs` / `file_res` queries successfully.

That is the primary go/no-go question for the browser-first architecture.

## Why this narrower proof was the right minimum

A broader spike would have mixed together several concerns that are not the same risk:

- ZIP intake and normalization policy (`T006`)
- browser worker integration (`T007`)
- XML mapping and emission (`T008`)
- attachment semantics (`T009`)
- user-facing browser UX (`T010`)

Those tasks are important, but they are downstream from the dominant technical gate: **can SQLite-backed EndNote data be read safely in a worker-backed WASM runtime at all?**

This spike isolates that question by using:

- `sql.js` for SQLite/WASM execution
- a dedicated worker-thread worker under `web/scripts/`
- the approved ZIP fixtures from `testing/browser-local/fixtures/`
- the same query shape the browser implementation will need later:
  - `SELECT * FROM refs WHERE trash_state = 0`
  - `SELECT refs_id, file_path FROM file_res`

## Spike implementation

Files added for the spike:

- `web/scripts/run-sqlite-wasm-feasibility.mjs`
- `web/scripts/sqlite-wasm-feasibility-worker.mjs`

Supporting package changes:

- `web/package.json` — added `spike:sqlite-wasm`
- `web/package-lock.json` — updated for `sql.js` and `fflate`

The runner:

1. reads the approved ZIP fixtures directly from `testing/browser-local/fixtures/`
2. extracts `sdb/sdb.eni` from the archive in memory
3. classifies malformed archives and missing-database cases before worker execution
4. sends the extracted database bytes into a fresh worker for each run
5. initializes SQLite/WASM inside the worker
6. opens the database from bytes and executes the required queries
7. records timing and coarse worker memory deltas

## Test method

**Environment used in this session**

- OS: Linux
- Runtime: Node `v25.2.1`
- Package manager: npm `11.7.0`
- SQLite/WASM runtime: `sql.js` `^1.14.1`
- ZIP extraction helper: `fflate` `^0.8.2`

**Important limitation**

The timing and memory observations below are from a **Node worker-thread harness**, not from a served Chromium browser tab.

That means:

- the results are valid evidence that the byte-loading and query model is technically viable
- the results are **not** precise browser UX benchmarks
- memory deltas are coarse `process.memoryUsage()` observations inside a worker, not browser heap telemetry
- browser-specific costs such as asset fetch, worker boot via Vite, and browser memory pressure still need later validation

These measurements should therefore be interpreted as **feasibility evidence**, not release-performance claims.

## Observed results in this session

### Supported fixtures

| Fixture | Archive size | DB size | Rows | Attachment rows | Median total time | Median RSS delta | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| `supported-enl-data` | 12.71 KiB | 12.00 KiB | 1 | 0 | 18.26 ms | 10.88 MiB | Baseline `.enl` + `.Data` shape |
| `supported-enlp-equivalent` | 13.00 KiB | 12.00 KiB | 1 | 0 | 13.19 ms | 1.75 MiB | `.enlp`-equivalent packaged contents |
| `attachment-present` | 13.11 KiB | 12.00 KiB | 1 | 1 | 12.74 ms | 1.75 MiB | Confirms `file_res` rows are queryable |
| `mixed-case-data-lookup` | 12.75 KiB | 12.00 KiB | 1 | 0 | 12.35 ms | 1.75 MiB | Confirms mixed-case `.Data` archive shape is readable |
| `stress-large` | 56.68 KiB | 56.00 KiB | 250 | 0 | 15.24 ms | 7.63 MiB | 250-record stress fixture |

### Expected-failure fixtures

| Fixture | Archive size | Expected classification | Observed outcome | Match |
|---|---:|---|---|---|
| `missing-db` | 576 B | `missing-database` | `missing-database` | Yes |
| `malformed-archive` | 47 B | `malformed-archive` | `malformed-archive` | Yes |

## Interpretation of observed results

### What was proven

The spike proves the following with direct evidence from the approved corpus:

1. **SQLite/WASM is viable for the approved synthetic EndNote fixture set.**
   The worker-loaded `sql.js` runtime successfully opened every supported fixture database from bytes.

2. **The required query pattern is not blocked by the browser-first architecture.**
   Both `refs` and `file_res` queries executed successfully inside the worker.

3. **Package-style and mixed-case fixture shapes do not invalidate the SQLite step.**
   The `.enlp`-equivalent and mixed-case `.Data` fixtures both reached the database query stage successfully once the database entry was extracted.

4. **The failure classifications remain cleanly separable before query execution.**
   `missing-db` and `malformed-archive` can be rejected without inventing ambiguous SQLite-level behavior.

### What was not proven

This task did **not** yet prove:

- served-browser timing in Chromium, Firefox, or Safari
- full ZIP-first normalization semantics
- XML generation cost
- attachment-policy output behavior
- browser memory behavior under much larger real-world libraries
- OPFS or persistent-storage choices

Those remain later tasks.

## Feasibility conclusion

**Conclusion:** the SQLite/WASM worker path is credible enough to keep the browser-first plan alive.

At the end of T003, the technical evidence supports this statement:

> For the approved fixture corpus, a worker-based SQLite/WASM approach can load the EndNote database from bytes and execute the required queries reliably enough that the architecture should proceed to normalization and browser integration work.

That does **not** justify broad runtime promises yet.

The currently observed evidence floor is still small:

- largest tested archive: `56.68 KiB`
- largest tested database payload: `56.00 KiB`
- largest tested record count: `250`

Accordingly, the browser-first path is justified as an implementation direction, but any support claim beyond the approved synthetic fixture envelope should remain provisional until larger approved fixtures are added and re-tested.

## Recommended next-step posture

Proceed with:

- `T006` ZIP-first normalization
- `T007` browser worker integration
- `T008` mapping and XML serialization

Do **not** yet claim:

- support for large real-world libraries
- browser-local parity under heavy memory pressure
- wrapper-free viability for all practical library sizes

Those claims should wait for the continuation thresholds in `performance-thresholds.md` to be validated in a served browser runtime.
