/// <reference lib="webworker" />

import type {
  ConvertPreparedLibraryRequest,
  ConvertPreparedLibrarySuccessResponse,
  ConvertPreparedLibraryFailureResponse,
  InitialiseWorkerResponse,
  QueryPreparedLibraryFailureResponse,
  QueryPreparedLibraryRequest,
  QueryPreparedLibrarySuccessResponse,
  WorkerErrorResponse,
  WorkerRequest,
  WorkerResponse,
} from '../types/worker';
import type { ExportResult } from '../types/export-result';
import { queryPreparedLibrary } from './query-endnote';
import { createSqliteAdapter } from './sqlite-adapter';
import { convertLibrary } from '../core/convert-library';

const scope = self as DedicatedWorkerGlobalScope;

scope.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handleRequest(event.data)
    .then((response) => {
      scope.postMessage(response);
    })
    .catch((error: unknown) => {
      scope.postMessage(buildUnhandledErrorResponse(error));
    });
});

async function handleRequest(request: WorkerRequest): Promise<WorkerResponse> {
  switch (request.kind) {
    case 'initialise':
      return buildInitialiseResponse(request.requestId);
    case 'convert-prepared-library':
      return buildConvertPreparedLibraryResponse(request);
    case 'query-prepared-library':
      return buildQueryPreparedLibraryResponse(request);
    default:
      return buildUnknownRequestResponse(request);
  }
}

function buildInitialiseResponse(requestId: string): InitialiseWorkerResponse {
  return {
    capabilities: {
      normalisedLibraryBoundary: true,
      servedModeRequired: true,
      sqliteWorkerQueries: true,
      workerPipelineBoundary: true,
    },
    kind: 'initialised',
    notes: [
      'Served-mode Vite workspace is active.',
      'Prepared-library inputs are the worker-facing boundary.',
      'SQLite/WASM database queries execute inside the dedicated worker.',
    ],
    ok: true,
    requestId,
    version: '0.1.0',
  };
}

async function buildConvertPreparedLibraryResponse(
  request: ConvertPreparedLibraryRequest,
): Promise<ConvertPreparedLibrarySuccessResponse | ConvertPreparedLibraryFailureResponse> {
  let adapter = null;

  try {
    // Step 1: Query the database
    adapter = await createSqliteAdapter({
      databaseBytes: request.library.database.bytes,
      databaseLabel: request.library.displayName,
    });

    const queryResult = queryPreparedLibrary(adapter, request.library);

    // Step 2: Run the full conversion pipeline
    const exportResult = convertLibrary(queryResult, request.library, request.attachmentOptions);

    return {
      exportResult,
      kind: 'convert-prepared-library',
      ok: true,
      requestId: request.requestId,
    };
  } catch (error) {
    return {
      detail: formatErrorDetail(error),
      error: 'CONVERSION_FAILED',
      kind: 'convert-prepared-library',
      ok: false,
      requestId: request.requestId,
    };
  } finally {
    adapter?.close();
  }
}

async function buildQueryPreparedLibraryResponse(
  request: QueryPreparedLibraryRequest,
): Promise<QueryPreparedLibrarySuccessResponse | QueryPreparedLibraryFailureResponse> {
  let adapter = null;

  try {
    adapter = await createSqliteAdapter({
      databaseBytes: request.library.database.bytes,
      databaseLabel: request.library.displayName,
    });

    return {
      kind: 'query-prepared-library',
      ok: true,
      queryResult: queryPreparedLibrary(adapter, request.library),
      requestId: request.requestId,
    };
  } catch (error) {
    return {
      detail: formatErrorDetail(error),
      error: 'QUERY_FAILED',
      kind: 'query-prepared-library',
      ok: false,
      requestId: request.requestId,
    };
  } finally {
    adapter?.close();
  }
}

function buildUnknownRequestResponse(
  request: never,
): WorkerErrorResponse {
  return {
    detail: `Unhandled worker request: ${JSON.stringify(request)}`,
    error: 'UNKNOWN_REQUEST',
    kind: 'error',
    ok: false,
    requestId: 'unknown-request',
  };
}

function buildUnhandledErrorResponse(error: unknown): WorkerErrorResponse {
  return {
    detail: formatErrorDetail(error),
    error: 'UNKNOWN_REQUEST',
    kind: 'error',
    ok: false,
    requestId: 'worker-unhandled-error',
  };
}

function formatErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export {};
