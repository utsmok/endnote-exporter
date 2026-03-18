import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createController,
  syncSessionStateMarker,
  takeSessionNotice,
} from './controller';
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

  it('persists explicit theme preferences and updates the document theme', () => {
    let state = createInitialState(buildRuntime());
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const documentElement = {
      dataset: {} as Record<string, string>,
      style: {} as Record<string, string>,
    };

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      removeItem,
      setItem,
    });
    vi.stubGlobal('document', {
      documentElement,
    });
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: false })),
    });

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

    controller.handleThemePreferenceChange('dark');

    expect(state.themePreference).toBe('dark');
    expect(state.resolvedTheme).toBe('dark');
    expect(setItem).toHaveBeenCalledWith('endnote-exporter.theme-preference', 'dark');
    expect(documentElement.dataset.theme).toBe('dark');
    expect(documentElement.dataset.themePreference).toBe('dark');
    expect(documentElement.style.colorScheme).toBe('dark');

    controller.handleThemePreferenceChange('system');

    expect(state.themePreference).toBe('system');
    expect(state.resolvedTheme).toBe('light');
    expect(removeItem).toHaveBeenCalledWith('endnote-exporter.theme-preference');
    expect(documentElement.dataset.theme).toBe('light');
    expect(documentElement.dataset.themePreference).toBe('system');
  });

  it('stores only phase markers for private session-loss recovery', () => {
    const storage = {
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    const state = withExportResult(createInitialState(buildRuntime()), buildExportResult());

    syncSessionStateMarker({
      ...state,
      selectedInputLabel: 'sensitive-library.zip',
    }, storage);

    expect(storage.setItem).toHaveBeenCalledOnce();
    const rawValue = storage.setItem.mock.calls[0]?.[1];

    expect(rawValue).toContain('conversion-complete');
    expect(rawValue).not.toContain('sensitive-library.zip');
  });

  it('surfaces a conservative session-loss notice when in-memory review data was cleared', () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({
        phase: 'conversion-complete',
        version: 1,
      })),
      removeItem: vi.fn(),
    };

    const notice = takeSessionNotice(storage);

    expect(notice?.title).toBe('Previous review data was cleared');
    expect(notice?.message).toContain('not restored after page reload');
    expect(storage.removeItem).toHaveBeenCalled();
  });
});
