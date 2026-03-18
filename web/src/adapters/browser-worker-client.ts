import type {
  InitialiseWorkerResponse,
  QueryPreparedLibrarySuccessResponse,
  ConvertPreparedLibrarySuccessResponse,
  WorkerRequest,
  WorkerResponse,
} from '../types/worker';
import type { PreparedLibrary } from '../core/library-types';
import type { AttachmentExportOptions } from '../types/export-result';

export interface ExportWorkerClient {
  dispose(): void;
  initialise(): Promise<InitialiseWorkerResponse>;
  queryPreparedLibrary(library: PreparedLibrary): Promise<QueryPreparedLibrarySuccessResponse>;
  convertPreparedLibrary(
    library: PreparedLibrary,
    attachmentOptions?: AttachmentExportOptions,
  ): Promise<ConvertPreparedLibrarySuccessResponse>;
}

interface PendingRequest {
  reject: (reason?: unknown) => void;
  resolve: (response: WorkerResponse) => void;
}

export function createExportWorkerClient(): ExportWorkerClient {
  const worker = new Worker(new URL('../worker/export-worker.ts', import.meta.url), {
    name: 'endnote-export-worker',
    type: 'module',
  });

  const pendingRequests = new Map<string, PendingRequest>();

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const pending = pendingRequests.get(response.requestId);

    if (!pending) {
      return;
    }

    pendingRequests.delete(response.requestId);

    if (response.ok) {
      pending.resolve(response);
      return;
    }

    pending.reject(new Error(`${response.error}: ${response.detail}`));
  });

  worker.addEventListener('error', (event) => {
    for (const pending of pendingRequests.values()) {
      pending.reject(event.error ?? new Error(event.message));
    }

    pendingRequests.clear();
  });

  function sendRequest<TResponse extends WorkerResponse>(
    request: WorkerRequest,
  ): Promise<TResponse> {
    return new Promise<TResponse>((resolve, reject) => {
      pendingRequests.set(request.requestId, {
        reject,
        resolve: (response) => resolve(response as TResponse),
      });

      worker.postMessage(request);
    });
  }

  return {
    dispose(): void {
      pendingRequests.clear();
      worker.terminate();
    },
    initialise(): Promise<InitialiseWorkerResponse> {
      return sendRequest<InitialiseWorkerResponse>({
        kind: 'initialise',
        requestId: buildRequestId(),
      });
    },
    queryPreparedLibrary(
      library: PreparedLibrary,
    ): Promise<QueryPreparedLibrarySuccessResponse> {
      return sendRequest<QueryPreparedLibrarySuccessResponse>({
        kind: 'query-prepared-library',
        library,
        requestId: buildRequestId(),
      });
    },
    convertPreparedLibrary(
      library: PreparedLibrary,
      attachmentOptions?: AttachmentExportOptions,
    ): Promise<ConvertPreparedLibrarySuccessResponse> {
      return sendRequest<ConvertPreparedLibrarySuccessResponse>({
        ...(attachmentOptions ? { attachmentOptions } : {}),
        kind: 'convert-prepared-library',
        library,
        requestId: buildRequestId(),
      });
    },
  };
}

function buildRequestId(): string {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
