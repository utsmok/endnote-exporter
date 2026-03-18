import { describe, expect, it, vi } from 'vitest';

import { createController } from './controller';
import {
  createInitialState,
  withDownloadError,
  withExportResult,
  type AppState,
} from './state';
import type { BrowserRuntimeInfo } from '../adapters/browser-runtime';
import type { ExportResult } from '../types/export-result';

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
          hasPdfAttachment: false,
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
});
