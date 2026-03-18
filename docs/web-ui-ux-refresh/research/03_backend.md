# Backend / Processing Research — `web-ui-ux-refresh`

## Scope

The repository is Full Stack, but the browser-local redesign does not target a hosted API. This report documents the processing surfaces that function as the effective backend for the browser-local UI: dedicated worker orchestration, SQLite/WASM querying, and the Python desktop exporter used as the parity oracle.

## Findings

### 1. There is no HTTP API for the browser-local product surface

| Evidence | Technical finding |
|---|---|
| `web/package.json:10-22` | The `web/` workspace defines Vite, Vitest, and Playwright scripts only. There are no API-route scripts or service-runtime dependencies. |
| `web/src/adapters/browser-runtime.ts:17-45` | Runtime gating is browser capability-based, not request/response service-based. |
| `web/src/worker/export-worker.ts:24-111` | The effective "backend" is a dedicated worker that handles typed requests locally. |

This is significant for UX planning. The redesign must communicate local processing truthfully. Phrases or flows that imply upload-job-server orchestration would be factually incorrect.

### 2. The worker owns the browser-local processing contract

| Area | Evidence | Technical finding |
|---|---|---|
| Capability declaration | `web/src/worker/export-worker.ts:45-58` | The worker advertises `servedModeRequired`, `sqliteWorkerQueries`, and `workerPipelineBoundary`. |
| Conversion request handling | `web/src/worker/export-worker.ts:61-84` | Conversion is executed as a one-shot request: open SQLite adapter → query DB → convert library → return `ExportResult`. |
| Query request handling | `web/src/worker/export-worker.ts:86-108` | The worker can query a prepared library independently of full conversion, but the current UI does not exploit this for staged preview or early validation. |
| Error handling | `web/src/worker/export-worker.ts:111-149` | Failures collapse into broad `CONVERSION_FAILED`, `QUERY_FAILED`, or `UNKNOWN_REQUEST` responses. |

The processing contract is operationally correct but coarse for richer progress UX. There is no progress event stream, no stage enumeration, and no intermediate validation channel surfaced to the UI.

### 3. SQLite access is simple and deterministic

| Area | Evidence | Technical finding |
|---|---|---|
| Query set | `web/src/worker/query-endnote.ts:8-14` | The worker executes only two queries: one over `refs`, one over `file_res`. |
| Projection | `web/src/worker/query-endnote.ts:16-147` | Query results are projected into typed reference rows and attachment rows before leaving the worker. |
| Summary counts | `web/src/worker/query-endnote.ts:21-28` | The query result includes record and attachment counts that could support pre-export trust/proof or progress messaging. |

The query layer is not a bottleneck from a complexity perspective. It is a strong candidate for exposing richer staged feedback to the main thread if the worker protocol is expanded.

### 4. Failure classes already exist, but the UI underuses them

| Error class | Evidence | Current UI use |
|---|---|---|
| `MALFORMED_ARCHIVE` | `web/src/core/normalize-library.ts:148-153` | Surfaced as terminal conversion error after input submission. |
| `UNSUPPORTED_ARCHIVE_SHAPE` | `web/src/core/normalize-library.ts:528-533` | Surfaced as terminal conversion error. |
| `MISSING_DATABASE` | `web/src/core/normalize-library.ts:542-544` | Surfaced as terminal conversion error. |
| `ATTACHMENT_LINKS_OMITTED`, `ATTACHMENT_LINKS_PARTIAL`, `ATTACHMENT_PAYLOAD_MISSING`, `RECORD_SKIPPED`, `INVALID_TIMESTAMP` | `web/src/types/export-result.ts:13-27` | Surfaced as warnings in result metadata and the success screen. |

The effective backend already emits domain-meaningful degradations. The redesign should not invent a separate taxonomy; it should normalize and present the existing taxonomy more clearly.

### 5. The desktop exporter remains the authoritative non-browser processing implementation

| Area | Evidence | Technical finding |
|---|---|---|
| SQLite read | `endnote_exporter.py:242-257` | The desktop exporter reads the SQLite database directly and maps records in-process. |
| Attachment path behavior | `endnote_exporter.py:590-607`, `813-815` | Desktop mode resolves `<pdf-urls>` to absolute paths from the real filesystem. |
| Date preservation | `endnote_exporter.py:382-390`, `623-650` | Desktop mode preserves additional metadata and writes date notes used by downstream tooling. |

The browser-local redesign must continue to communicate that attachment behavior is intentionally narrower unless the user supplies a library base path.

### 6. There is no session persistence or resumability in the browser-local backend boundary

| Evidence | Technical finding |
|---|---|
| `web/src/app/state.ts:19-31` | State exists only in memory plus theme preference persistence. |
| `web/src/adapters/browser-worker-client.ts:26-95` | Pending requests are in-memory only. |
| `web/src/worker/export-worker.ts:24-111` | The worker returns full responses and is terminated on `beforeunload`; there is no recovery protocol. |

This is directly relevant to the requested session-loss behavior planning target.

## Improvement opportunities

1. Extend the worker protocol with staged progress events: normalizing, opening database, querying, mapping, serializing, ready for review.
2. Surface pre-export query summaries earlier so the UI can build trust and capability framing before final XML generation.
3. Introduce a consistent severity model that maps backend error/warning codes to user-facing categories.
4. Add optional lightweight session persistence for prepared-library metadata or result summaries if the product wants soft recovery after accidental refresh.

## Open questions

1. Is protocol expansion for progress events acceptable within the current frameworkless architecture, or should staged progress remain UI-simulated until implementation pressure justifies it?
2. Should the redesign expose a query-preview step before conversion completion, given that the worker already supports `query-prepared-library`?
3. Should session-loss handling store only descriptive state, or should it attempt to preserve recoverable results when the page remains open?
4. Should failure codes be shown directly to the user, or translated into a controlled severity vocabulary with optional technical disclosure?

## Risks

1. If the redesign assumes server-like capabilities, the resulting UI will misrepresent the actual browser-local execution model.
2. Adding protocol complexity without tests could destabilize a currently simple worker boundary.
3. Session persistence of prepared-library data could create memory or privacy concerns if implemented carelessly.
4. Exposing too much low-level error detail could make the UI harder for non-technical users to interpret.

## Dependencies

1. Progress UX and staged review depend on `web/src/worker/export-worker.ts`, `web/src/adapters/browser-worker-client.ts`, and `web/src/types/worker.ts`.
2. Severity taxonomy work depends on existing warning/error codes in `web/src/types/export-result.ts` and normalization error handling.
3. Any recovery model must remain consistent with `docs/local-web-execution/privacy.md` and the local-only processing contract.

## Testing implications

1. Protocol changes require unit and integration tests at both worker and adapter layers.
2. Warning/error mapping changes require explicit UI assertions in Playwright so semantic regressions are visible.
3. Session-loss or persistence work requires new tests that simulate reloads, unloads, and incomplete conversion states.
4. Query-preview or staged-progress UI requires worker-response fixtures or mock message streams to avoid brittle browser-only tests.
