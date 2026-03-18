import type { PreparedLibrary } from '../core/library-types';
import type { EndnoteQueryResult } from './query-results';
import type { AttachmentExportOptions, ExportResult } from './export-result';

export type WorkerStatus = 'starting' | 'ready' | 'error';

export interface WorkerCapabilities {
  normalisedLibraryBoundary: true;
  servedModeRequired: true;
  sqliteWorkerQueries: true;
  workerPipelineBoundary: true;
}

export interface InitialiseWorkerRequest {
  kind: 'initialise';
  requestId: string;
}

export interface ConvertPreparedLibraryRequest {
  attachmentOptions?: AttachmentExportOptions;
  kind: 'convert-prepared-library';
  library: PreparedLibrary;
  requestId: string;
}

export interface QueryPreparedLibraryRequest {
  kind: 'query-prepared-library';
  library: PreparedLibrary;
  requestId: string;
}

export type WorkerRequest =
  | ConvertPreparedLibraryRequest
  | InitialiseWorkerRequest
  | QueryPreparedLibraryRequest;

export interface InitialiseWorkerResponse {
  capabilities: WorkerCapabilities;
  kind: 'initialised';
  notes: string[];
  ok: true;
  requestId: string;
  version: string;
}

export interface ConvertPreparedLibrarySuccessResponse {
  exportResult: ExportResult;
  kind: 'convert-prepared-library';
  ok: true;
  requestId: string;
}

export interface ConvertPreparedLibraryFailureResponse {
  detail: string;
  error: 'CONVERSION_FAILED';
  kind: 'convert-prepared-library';
  ok: false;
  requestId: string;
}

export interface QueryPreparedLibrarySuccessResponse {
  kind: 'query-prepared-library';
  ok: true;
  queryResult: EndnoteQueryResult;
  requestId: string;
}

export interface QueryPreparedLibraryFailureResponse {
  detail: string;
  error: 'QUERY_FAILED';
  kind: 'query-prepared-library';
  ok: false;
  requestId: string;
}

export interface WorkerErrorResponse {
  detail: string;
  error: 'UNKNOWN_REQUEST';
  kind: 'error';
  ok: false;
  requestId: string;
}

export type WorkerResponse =
  | InitialiseWorkerResponse
  | ConvertPreparedLibrarySuccessResponse
  | ConvertPreparedLibraryFailureResponse
  | QueryPreparedLibraryFailureResponse
  | QueryPreparedLibrarySuccessResponse
  | WorkerErrorResponse;
