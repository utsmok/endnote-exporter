import { afterEach, describe, expect, it, vi } from 'vitest';

import { createController, syncCreateXmlActionState } from './controller';
import {
  createInitialState,
  withDownloadError,
  withExportResult,
  type AppState,
} from './state';
import { LibraryNormalizationError } from '../core/errors';
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

function buildRoot(fileInputValue = 'queued.zip'): HTMLElement {
  const fileInput = { value: fileInputValue };

  return {
    querySelector: vi.fn((selector: string) => (
      selector === '#zip-file-input'
        ? fileInput
        : null
    )),
  } as unknown as HTMLElement;
}

function buildActionRoot(button: HTMLButtonElement, submitHelp: HTMLElement): ParentNode {
  return {
    querySelector: vi.fn((selector: string) => {
      if (selector === '#create-xml-button') {
        return button;
      }

      if (selector === '.submit-help') {
        return submitHelp;
      }

      return null;
    }),
  } as unknown as ParentNode;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createController', () => {
  it('updates the Create XML button class, disabled state, and submit help visibility from current state', () => {
    const createXmlButton = {
      className: 'button button--disabled',
      disabled: true,
      setAttribute: vi.fn(),
    } as unknown as HTMLButtonElement;
    const submitHelp = {
      style: {
        display: 'block',
      },
    } as unknown as HTMLElement;

    syncCreateXmlActionState(
      buildActionRoot(createXmlButton, submitHelp),
      {
        ...createInitialState(buildRuntime()),
        attachmentBasePath: '/Users/me/Documents/MyLibrary.enlp',
        pendingFile: { name: 'library.zip' } as File,
      },
    );

    expect(createXmlButton.disabled).toBe(false);
    expect(createXmlButton.className).toBe('button button--success');
    expect(createXmlButton.setAttribute).toHaveBeenCalledWith('aria-disabled', 'false');
    expect(submitHelp.style.display).toBe('none');
  });

  it('keeps the Create XML button disabled when the library path is blank', () => {
    const createXmlButton = {
      className: 'button button--success',
      disabled: false,
      setAttribute: vi.fn(),
    } as unknown as HTMLButtonElement;
    const submitHelp = {
      style: {
        display: 'none',
      },
    } as unknown as HTMLElement;

    syncCreateXmlActionState(
      buildActionRoot(createXmlButton, submitHelp),
      {
        ...createInitialState(buildRuntime()),
        attachmentBasePath: '   ',
        pendingFile: { name: 'library.zip' } as File,
      },
    );

    expect(createXmlButton.disabled).toBe(true);
    expect(createXmlButton.className).toBe('button button--disabled');
    expect(createXmlButton.setAttribute).toHaveBeenCalledWith('aria-disabled', 'true');
    expect(submitHelp.style.display).toBe('block');
  });

  it('uses the latest state when handling downloads after conversion', () => {
    let state = createInitialState(buildRuntime());
    const download = vi.fn();

    const controller = createController({
      download,
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput: vi.fn(),
      root: buildRoot(),
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
      root: buildRoot(),
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
      root: buildRoot(),
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

  it('queues a selected ZIP file without converting immediately', () => {
    let state = createInitialState(buildRuntime());
    const prepareInput = vi.fn(async () => buildPreparedLibrary());
    const convertPreparedLibrary = vi.fn(async () => buildConvertResponse());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput,
      root: buildRoot(),
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

    controller.handleFileSelect({ name: 'library.zip', size: 5120 } as File);

    expect(state.pendingFile).toMatchObject({ name: 'library.zip', size: 5120 });
    expect(state.pendingFileError).toBeNull();
    expect(state.phase).toBe('selecting-input');
    expect(prepareInput).not.toHaveBeenCalled();
    expect(convertPreparedLibrary).not.toHaveBeenCalled();
  });

  it('marks invalid file selections without queueing them', () => {
    let state = createInitialState(buildRuntime());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput: vi.fn(),
      root: buildRoot(),
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

    controller.handleFileSelect({ name: 'library.txt' } as File);

    expect(state.pendingFile).toBeNull();
    expect(state.pendingFileError).toBe('invalid-type');
    expect(state.statusTitle).toBe('Invalid file');
  });

  it('requires a path before creating XML and routes to the PDF-path error state', async () => {
    let state = createInitialState(buildRuntime());
    const prepareInput = vi.fn(async () => buildPreparedLibrary());
    const convertPreparedLibrary = vi.fn(async () => buildConvertResponse());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput,
      root: buildRoot(),
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

    controller.handleFileSelect({ name: 'library.zip' } as File);
    controller.handleAttachmentBasePathInput('   ');
    await controller.handleCreateXml();

    expect(state.phase).toBe('conversion-error');
    expect(state.specificErrorType).toBe('pdf-path');
    expect(state.statusTitle).toBe('Library location is required');
    expect(prepareInput).not.toHaveBeenCalled();
    expect(convertPreparedLibrary).not.toHaveBeenCalled();
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
      root: buildRoot(),
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

    controller.handleFileSelect({ name: 'library.zip' } as File);
    controller.handleAttachmentBasePathInput('  /Users/me/Documents/MyLibrary.enlp  ');
    await controller.handleCreateXml();

    expect(prepareInput).toHaveBeenCalledWith({
      file: expect.objectContaining({ name: 'library.zip' }),
      kind: 'zip-file',
    });
    expect(convertPreparedLibrary).toHaveBeenCalledWith(
      preparedLibrary,
      { baseLibraryPath: '/Users/me/Documents/MyLibrary.enlp' },
    );
  });

  it('populates attachment base path from directory browse selection', async () => {
    let state = createInitialState(buildRuntime());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(async () => ({
        kind: 'directory',
        name: 'MyLibrary.enlp',
        values: async function* values() {
          return;
        },
      })),
      prepareInput: vi.fn(),
      root: buildRoot(),
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

    const selectedPath = await controller.handleAttachmentBasePathBrowse();

    expect(selectedPath).toBe('MyLibrary.enlp');
    expect(state.attachmentBasePath).toBe('MyLibrary.enlp');
  });

  it('falls back to selected directory name as baseLibraryPath when manual path is blank', async () => {
    let state = createInitialState(buildRuntime());
    const preparedLibrary = buildPreparedLibrary();
    const prepareInput = vi.fn(async () => preparedLibrary);
    const convertPreparedLibrary = vi.fn(async () => buildConvertResponse());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(async () => ({
        kind: 'directory',
        name: 'MyLibrary.enlp',
        values: async function* values() {
          return;
        },
      })),
      prepareInput,
      root: buildRoot(),
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

    await controller.handleDirectoryPick();

    expect(prepareInput).toHaveBeenCalledWith({
      handle: expect.objectContaining({ name: 'MyLibrary.enlp' }),
      kind: 'directory-handle',
    });
    expect(convertPreparedLibrary).toHaveBeenCalledWith(
      preparedLibrary,
      { baseLibraryPath: 'MyLibrary.enlp' },
    );
    expect(state.attachmentBasePath).toBe('MyLibrary.enlp');
  });

  it('keeps manual attachment base path as precedence for directory conversion options', async () => {
    let state = createInitialState(buildRuntime());
    const preparedLibrary = buildPreparedLibrary();
    const prepareInput = vi.fn(async () => preparedLibrary);
    const convertPreparedLibrary = vi.fn(async () => buildConvertResponse());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(async () => ({
        kind: 'directory',
        name: 'MyLibrary.enlp',
        values: async function* values() {
          return;
        },
      })),
      prepareInput,
      root: buildRoot(),
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

    controller.handleAttachmentBasePathInput('  /Users/me/Documents/ManualPath.enlp  ');
    await controller.handleDirectoryPick();

    expect(convertPreparedLibrary).toHaveBeenCalledWith(
      preparedLibrary,
      { baseLibraryPath: '/Users/me/Documents/ManualPath.enlp' },
    );
    expect(state.attachmentBasePath).toBe('/Users/me/Documents/ManualPath.enlp');
  });

  it('stores the export result after successful ZIP conversion', async () => {
    let state = createInitialState(buildRuntime());
    const preparedLibrary = buildPreparedLibrary();
    const prepareInput = vi.fn(async () => preparedLibrary);
    const convertPreparedLibrary = vi.fn(async () => buildConvertResponse());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput,
      root: buildRoot(),
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

    controller.handleFileSelect({ name: 'library.zip' } as File);
    controller.handleAttachmentBasePathInput('/Users/me/Documents/MyLibrary.enlp');
    await controller.handleCreateXml();

    expect(state.phase).toBe('conversion-complete');
    expect(state.exportResult).toEqual(buildExportResult());
    expect(state.pendingFile).toBeNull();
    expect(state.specificErrorType).toBeNull();
  });

  it('routes normalization failures to the file-specific error state', async () => {
    let state = createInitialState(buildRuntime());

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput: vi.fn(async () => {
        throw new LibraryNormalizationError({
          code: 'MALFORMED_ARCHIVE',
          context: {
            archiveFileName: 'library.zip',
          },
          message: 'Archive could not be read.',
        });
      }),
      root: buildRoot(),
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

    controller.handleFileSelect({ name: 'library.zip' } as File);
    controller.handleAttachmentBasePathInput('/Users/me/Documents/MyLibrary.enlp');
    await controller.handleCreateXml();

    expect(state.phase).toBe('conversion-error');
    expect(state.specificErrorType).toBe('file');
    expect(state.statusTitle).toBe('Library ZIP couldn’t be processed');
    expect(state.notes).toContain('Archive could not be read.');
  });

  it('removes a queued ZIP file and clears the file input value', () => {
    let state = createInitialState(buildRuntime());
    const root = buildRoot('library.zip');
    const zipFileInput = root.querySelector<HTMLInputElement>('#zip-file-input');

    const controller = createController({
      download: vi.fn(),
      getState: () => state,
      pickDirectory: vi.fn(),
      prepareInput: vi.fn(),
      root,
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

    controller.handleFileSelect({ name: 'library.zip' } as File);
    controller.handleRemoveFile();

    expect(state.pendingFile).toBeNull();
    expect(state.pendingFileError).toBeNull();
    expect(state.selectedInputLabel).toBeUndefined();
    expect(zipFileInput?.value).toBe('');
  });
});
