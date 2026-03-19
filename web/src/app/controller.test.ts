import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createController,
} from './controller';
import {
  createInitialState,
  withDownloadError,
  withExportResult,
  type AppState,
} from './state';
import type { BrowserRuntimeInfo } from '../adapters/browser-runtime';
import type { PreparedLibrary } from '../core/library-types';
import type { ExportResult } from '../types/export-result';
import type { ConvertPreparedLibrarySuccessResponse } from '../types/worker';

function buildRuntime(): BrowserRuntimeInfo {
  return {
    directoryIntake: {
      available: false,
      notes: [],
    },
    isSecureContext: true,
    isServedMode: true,
    location: 'http://127.0.0.1:4173/',
    notes: [],
    protocol: 'http:',
    workerSupported: true,
  };
}

function buildExportResult(): ExportResult {
  return {
    xml: '<xml><records/></xml>',
    metadata: {
      attachmentCount: 0,
      attachmentMode: 'metadata-only-no-links',
      inputRecordCount: 1,
      items: [
        {
          author: 'Ada Lovelace',
          doi: '10.1000/test-doi',
          doiUrl: 'https://doi.org/10.1000/test-doi',
          hasPdfAttachment: false,
          journal: 'Journal of Test Automation',
          recordId: 1,
          title: 'Record 1',
          year: '2026',
        },
      ],
      libraryDisplayName: 'Test Library',
      libraryId: 'test-library',
      linkedAttachmentCount: 0,
      missingAttachmentPayloadCount: 0,
      recordCount: 1,
      referenceCountWithAttachments: 0,
      skippedRecordCount: 0,
      warnings: [],
    },
  };
}

function buildPreparedLibrary(): PreparedLibrary {
  return {
    attachments: {
      files: [],
      rootRelativePath: 'TestLibrary.Data/PDF',
    },
    database: {
      archivePath: 'TestLibrary.Data/sdb/sdb.eni',
      bytes: new ArrayBuffer(0),
      relativePath: 'TestLibrary.Data/sdb/sdb.eni',
    },
    displayName: 'Test Library',
    fileMap: {},
    files: [],
    id: 'test-library',
    identity: {
      archiveFileName: 'library.zip',
      dataDirectoryName: 'TestLibrary.Data',
      dataDirectoryRelativePath: 'TestLibrary.Data',
      displayName: 'Test Library',
      id: 'test-library',
      libraryFileName: 'TestLibrary.enl',
      libraryRelativePath: 'TestLibrary.enl',
      packageRelativePath: null,
      sourceShape: 'zipped-enl-data',
      stem: 'TestLibrary',
    },
    libraryFile: {
      archivePath: 'TestLibrary.enl',
      relativePath: 'TestLibrary.enl',
      size: 0,
      source: 'zip-entry',
    },
    sourceKind: 'zip',
    warnings: [],
  };
}

function buildConvertResponse(): ConvertPreparedLibrarySuccessResponse {
  return {
    exportResult: buildExportResult(),
    kind: 'convert-prepared-library',
    ok: true,
    requestId: 'test-request',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createController', () => {
  it('uses the latest state when handling downloads after conversion', () => {
    let state = createInitialState(buildRuntime());
    const download = vi.fn();

    const controller = createController({
      download,
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput: vi.fn(),
      root: { querySelector: () => null } as unknown as HTMLElement,
      updateState: (nextStateOrUpdater) => {
        state = typeof nextStateOrUpdater === 'function'
          ? nextStateOrUpdater(state)
          : nextStateOrUpdater;
        return state;
      },
      workerClient: {
        convertPreparedLibrary: vi.fn(),
        dispose: vi.fn(),
        initialise: vi.fn(),
        queryPreparedLibrary: vi.fn(),
      },
    });

    state = withExportResult(state, buildExportResult());

    controller.handleDownload();

    expect(download).toHaveBeenCalledWith(state.exportResult);
  });

  it('stores an action-local error when download generation fails', () => {
    let state: AppState = withExportResult(
      createInitialState(buildRuntime()),
      buildExportResult(),
    );

    const controller = createController({
      download: () => {
        throw new Error('Synthetic download failure');
      },
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput: vi.fn(),
      root: { querySelector: () => null } as unknown as HTMLElement,
      updateState: (nextStateOrUpdater) => {
        state = typeof nextStateOrUpdater === 'function'
          ? nextStateOrUpdater(state)
          : nextStateOrUpdater;
        return state;
      },
      workerClient: {
        convertPreparedLibrary: vi.fn(),
        dispose: vi.fn(),
        initialise: vi.fn(),
        queryPreparedLibrary: vi.fn(),
      },
    });

    controller.handleDownload();

    expect(state.downloadErrorMessage).toBe('Synthetic download failure');
  });

  it('reports a local error when download is requested before conversion', () => {
    let state = createInitialState(buildRuntime());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput: vi.fn(),
      root: { querySelector: () => null } as unknown as HTMLElement,
      updateState: (nextStateOrUpdater) => {
        state = typeof nextStateOrUpdater === 'function'
          ? nextStateOrUpdater(state)
          : nextStateOrUpdater;
        return state;
      },
      workerClient: {
        convertPreparedLibrary: vi.fn(),
        dispose: vi.fn(),
        initialise: vi.fn(),
        queryPreparedLibrary: vi.fn(),
      },
    });

    controller.handleDownload();

    expect(withDownloadError(state, 'No export result is available yet. Convert a library before downloading.').downloadErrorMessage)
      .toBe(state.downloadErrorMessage);
  });

  it('passes a trimmed attachment base path into ZIP conversion options', async () => {
    let state = createInitialState(buildRuntime());
    const preparedLibrary = buildPreparedLibrary();
    const prepareInput = vi.fn(async () => preparedLibrary);
    const convertPreparedLibrary = vi.fn(async () => buildConvertResponse());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput,
      root: { querySelector: () => null } as unknown as HTMLElement,
      updateState: (nextStateOrUpdater) => {
        state = typeof nextStateOrUpdater === 'function'
          ? nextStateOrUpdater(state)
          : nextStateOrUpdater;
        return state;
      },
      workerClient: {
        convertPreparedLibrary,
        dispose: vi.fn(),
        initialise: vi.fn(),
        queryPreparedLibrary: vi.fn(),
      },
    });

    controller.handleAttachmentBasePathInput('  /Users/me/Documents/MyLibrary.enlp  ');
    await controller.handleFileSelect({ name: 'library.zip' } as File);

    expect(prepareInput).toHaveBeenCalledWith({
      file: expect.objectContaining({ name: 'library.zip' }),
      kind: 'zip-file',
    });
    expect(convertPreparedLibrary).toHaveBeenCalledWith(
      preparedLibrary,
      { baseLibraryPath: '/Users/me/Documents/MyLibrary.enlp' },
    );
  });

  it('omits attachment options when no base path is provided', async () => {
    let state = createInitialState(buildRuntime());
    const preparedLibrary = buildPreparedLibrary();
    const convertPreparedLibrary = vi.fn(async () => buildConvertResponse());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput: vi.fn(async () => preparedLibrary),
      root: { querySelector: () => null } as unknown as HTMLElement,
      updateState: (nextStateOrUpdater) => {
        state = typeof nextStateOrUpdater === 'function'
          ? nextStateOrUpdater(state)
          : nextStateOrUpdater;
        return state;
      },
      workerClient: {
        convertPreparedLibrary,
        dispose: vi.fn(),
        initialise: vi.fn(),
        queryPreparedLibrary: vi.fn(),
      },
    });

    await controller.handleFileSelect({ name: 'library.zip' } as File);

    expect(convertPreparedLibrary).toHaveBeenCalledWith(
      preparedLibrary,
      undefined,
    );
  });
});
