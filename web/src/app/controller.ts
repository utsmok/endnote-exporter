import { createExportWorkerClient } from '../adapters/browser-worker-client';
import { detectBrowserRuntime } from '../adapters/browser-runtime';
import {
  pickLibraryDirectory,
  prepareLibraryFromBrowserInput,
} from '../adapters/browser-input';
import { isLibraryNormalizationError } from '../core/errors';
import {
  clearDownloadError,
  clearExportResult,
  createInitialState,
  withStatus,
  withAttachmentBasePath,
  withDownloadError,
  withExportResult,
  withNote,
  withPendingFile,
  withPhase,
  withSelectedInput,
  withSpecificError,
  type AppState,
} from './state';
import { downloadExportResult } from './download';
import {
  buildConversionCompleteStatus,
  buildConversionFailureStatus,
  buildConvertingStatus,
  buildDirectoryCancelledStatus,
  buildFileTypeErrorStatus,
  buildGenericErrorStatus,
  buildInitialisationFailureStatus,
  buildInputRejectedStatus,
  buildPdfPathErrorStatus,
  buildReadyStatus,
  buildUnsupportedLaunchStatus,
  buildWorkerUnavailableStatus,
} from './status-presets';
import { renderAppView } from './view-sections';

export async function mountApp(root: HTMLElement): Promise<void> {
  const runtime = detectBrowserRuntime();
  let state = createInitialState(runtime);

  const workerClient = createExportWorkerClient();
  globalThis.addEventListener(
    'beforeunload',
    () => {
      workerClient.dispose();
    },
    { once: true },
  );

  let controller!: Controller;

  const updateState = (
    nextStateOrUpdater: AppState | ((currentState: AppState) => AppState),
    options: { render?: boolean } = {},
  ): AppState => {
    const previousState = state;
    state = typeof nextStateOrUpdater === 'function'
      ? nextStateOrUpdater(state)
      : nextStateOrUpdater;

    if (options.render !== false) {
      render(root, state, controller, previousState);
    }

    return state;
  };

  controller = createController({
    download: downloadExportResult,
    getState: () => state,
    pickDirectory: pickLibraryDirectory,
    prepareInput: prepareLibraryFromBrowserInput,
    root,
    updateState,
    workerClient,
  });

  attachSkipLinkFocus();
  render(root, state, controller);

  if (!runtime.isServedMode) {
    updateState((currentState) => withStatus({
      ...currentState,
      phase: 'unsupported-launch',
      workerStatus: 'error',
    }, buildUnsupportedLaunchStatus()));
    return;
  }

  if (!runtime.workerSupported) {
    updateState((currentState) => withStatus({
      ...currentState,
      phase: 'worker-error',
      workerStatus: 'error',
    }, buildWorkerUnavailableStatus()));
    return;
  }

  try {
    const ready = await workerClient.initialise();
    updateState((currentState) => withStatus({
      ...currentState,
      notes: Array.from(new Set([...currentState.notes, ...ready.notes])),
      phase: 'selecting-input',
      workerStatus: 'ready',
    }, buildReadyStatus(runtime)));
  } catch (error) {
    updateState((currentState) => withStatus({
      ...currentState,
      notes: [
        ...currentState.notes,
        error instanceof Error ? error.message : 'Unknown worker initialisation failure.',
      ],
      phase: 'worker-error',
      workerStatus: 'error',
    }, buildInitialisationFailureStatus()));
  }
}

function render(
  root: HTMLElement,
  state: AppState,
  controller: Controller,
  previousState?: AppState,
): void {
  root.innerHTML = renderAppView(state);
  attachController(root, controller);
  focusPhaseTarget(root, state, previousState);
}

interface Controller {
  handleAttachmentBasePathInput: (value: string) => void;
  handleCreateXml: () => Promise<void>;
  handleDirectoryPick: () => void;
  handleDropZoneKeyDown: (event: KeyboardEvent) => void;
  handleFileSelect: (file: File) => void;
  handleDownload: () => void;
  handleConvertAnother: () => void;
  handleRemoveFile: () => void;
  handleRetry: () => void;
}

interface ControllerDependencies {
  download: typeof downloadExportResult;
  getState: () => AppState;
  pickDirectory: typeof pickLibraryDirectory;
  prepareInput: typeof prepareLibraryFromBrowserInput;
  root: HTMLElement;
  updateState: (
    nextStateOrUpdater: AppState | ((currentState: AppState) => AppState),
    options?: { render?: boolean },
  ) => AppState;
  workerClient: ReturnType<typeof createExportWorkerClient>;
}

export function createController({
  download,
  getState,
  pickDirectory,
  prepareInput,
  root,
  updateState,
  workerClient,
}: ControllerDependencies): Controller {
  return {
    handleAttachmentBasePathInput(value: string) {
      updateState((currentState) => withAttachmentBasePath(currentState, value), { render: false });
    },

    async handleCreateXml() {
      const currentState = getState();
      const pendingFile = currentState.pendingFile;

      if (!pendingFile) {
        return;
      }

      const baseLibraryPath = currentState.attachmentBasePath.trim();
      if (baseLibraryPath.length === 0) {
        updateState((stateWithoutPath) => withStatus(
          withSpecificError(
            withPhase(stateWithoutPath, 'conversion-error'),
            'pdf-path',
          ),
          buildPdfPathErrorStatus(),
        ));
        return;
      }

      updateState((stateForConversion) => withStatus(
        withSelectedInput(
          withSpecificError(stateForConversion, null),
          pendingFile.name,
        ),
        buildConvertingStatus(pendingFile.name),
      ));

      try {
        const library = await prepareInput({
          file: pendingFile,
          kind: 'zip-file',
        });
        const response = await workerClient.convertPreparedLibrary(
          library,
          { baseLibraryPath },
        );

        updateState((stateAfterConversion) => withStatus(
          withSpecificError(
            withExportResult(stateAfterConversion, response.exportResult),
            null,
          ),
          buildConversionCompleteStatus(response.exportResult, 'zip'),
        ));
      } catch (error) {
        if (isLibraryNormalizationError(error)) {
          updateState((stateAfterFileFailure) => withStatus(
            withSpecificError(
              withNote(
                withPhase(stateAfterFileFailure, 'conversion-error'),
                error.message,
              ),
              'file',
            ),
            buildFileTypeErrorStatus(),
          ));
          return;
        }

        const detail = error instanceof Error
          ? error.message
          : 'Unknown conversion error.';

        updateState((stateAfterFailure) => withStatus(
          withSpecificError(
            withNote(
              withPhase(stateAfterFailure, 'conversion-error'),
              detail,
            ),
            'generic',
          ),
          buildGenericErrorStatus(detail),
        ));
      }
    },

    async handleDirectoryPick() {
      try {
        const handle = await pickDirectory();
        updateState((currentState) => withStatus(
          withSelectedInput(currentState, `${handle.name}/`),
          buildConvertingStatus(`${handle.name}/`),
        ));

        const library = await prepareInput({
          handle,
          kind: 'directory-handle',
        });
        const response = await workerClient.convertPreparedLibrary(
          library,
          buildAttachmentOptions(getState()),
        );

        updateState((currentState) => withStatus(
          withExportResult(currentState, response.exportResult),
          buildConversionCompleteStatus(response.exportResult, 'directory'),
        ));
      } catch (error) {
        if (isPickerAbortError(error)) {
          updateState((currentState) => withStatus(currentState, buildDirectoryCancelledStatus()));
          return;
        }

        updateState((currentState) => withStatus(
          withNote(
            withPhase(currentState, 'conversion-error'),
            error instanceof Error ? error.message : 'Unknown directory conversion error.',
          ),
          buildConversionFailureStatus('directory'),
        ));
      }
    },

    handleDropZoneKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        root.querySelector<HTMLInputElement>('#zip-file-input')?.click();
      }
    },

    handleFileSelect(file: File) {
      if (!isZipFile(file)) {
        updateState((currentState) => withStatus(
          withSpecificError(
            withPhase(
              withPendingFile(currentState, null, 'invalid-type'),
              'selecting-input',
            ),
            null,
          ),
          buildInputRejectedStatus(),
        ));
        resetFileInput(root);
        return;
      }

      updateState((currentState) => withStatus(
        withSpecificError(
          withPhase(
            withPendingFile(currentState, file),
            'selecting-input',
          ),
          null,
        ),
        buildReadyStatus(currentState.runtime),
      ));
    },

    handleRemoveFile() {
      updateState((currentState) => withStatus(
        withSpecificError(
          withPhase(
            withPendingFile(currentState, null),
            'selecting-input',
          ),
          null,
        ),
        buildReadyStatus(currentState.runtime),
      ));
      resetFileInput(root);
    },

    handleDownload() {
      const currentState = getState();

      if (!currentState.exportResult) {
        updateState((stateWithoutResult) => withDownloadError(
          stateWithoutResult,
          'No export result is available yet. Convert a library before downloading.',
        ));
        return;
      }

      try {
        download(currentState.exportResult);
        updateState((stateAfterDownload) => clearDownloadError(stateAfterDownload));
      } catch (error) {
        updateState((stateAfterFailure) => withDownloadError(
          stateAfterFailure,
          error instanceof Error ? error.message : 'The XML download could not be started.',
        ));
      }
    },

    handleConvertAnother() {
      updateState((currentState) => withStatus(
        clearExportResult(currentState),
        buildReadyStatus(currentState.runtime),
      ));
    },

    handleRetry() {
      updateState((currentState) => withStatus(
        clearExportResult(currentState),
        buildReadyStatus(currentState.runtime),
      ));
    },
  };
}

function attachController(root: HTMLElement, controller: Controller): void {
  const directoryButton = root.querySelector<HTMLButtonElement>('#directory-picker-button');
  directoryButton?.addEventListener('click', () => controller.handleDirectoryPick());

  const fileInput = root.querySelector<HTMLInputElement>('#zip-file-input');
  fileInput?.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      controller.handleFileSelect(file);
      input.value = '';
    }
  });

  const attachmentBasePathInput = root.querySelector<HTMLInputElement>('#attachment-base-path');
  attachmentBasePathInput?.addEventListener('input', (event) => {
    controller.handleAttachmentBasePathInput((event.target as HTMLInputElement).value);
  });

  const dropZone = root.querySelector<HTMLElement>('#zip-dropzone');
  if (dropZone) {
    dropZone.addEventListener('keydown', (event) => controller.handleDropZoneKeyDown(event));

    const setDragActive = (active: boolean) => {
      dropZone.classList.toggle('file-input-label--drag-active', active);
    };

    dropZone.addEventListener('dragenter', (event) => {
      event.preventDefault();
      setDragActive(true);
    });

    dropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      setDragActive(true);
    });

    dropZone.addEventListener('dragleave', (event) => {
      if (event.currentTarget === event.target) {
        setDragActive(false);
      }
    });

    dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      setDragActive(false);

      const file = event.dataTransfer?.files?.[0];
      if (file) {
        controller.handleFileSelect(file);
      }
    });
  }

  const downloadButton = root.querySelector<HTMLButtonElement>('#download-button');
  downloadButton?.addEventListener('click', () => controller.handleDownload());

  const createXmlButton = root.querySelector<HTMLButtonElement>('#create-xml-button');
  createXmlButton?.addEventListener('click', () => {
    void controller.handleCreateXml();
  });

  const removeFileButton = root.querySelector<HTMLButtonElement>('#remove-file-button');
  removeFileButton?.addEventListener('click', () => controller.handleRemoveFile());

  const convertAnotherButton = root.querySelector<HTMLButtonElement>('#convert-another-button');
  convertAnotherButton?.addEventListener('click', () => controller.handleConvertAnother());

  const retryButton = root.querySelector<HTMLButtonElement>('#retry-button');
  retryButton?.addEventListener('click', () => controller.handleRetry());
}

function buildAttachmentOptions(state: AppState): { baseLibraryPath: string } | undefined {
  const baseLibraryPath = state.attachmentBasePath.trim();

  return baseLibraryPath.length > 0
    ? { baseLibraryPath }
    : undefined;
}

function resetFileInput(root: HTMLElement): void {
  const fileInput = root.querySelector<HTMLInputElement>('#zip-file-input');

  if (fileInput) {
    fileInput.value = '';
  }
}

function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip');
}

function isPickerAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function focusPhaseTarget(root: HTMLElement, state: AppState, previousState?: AppState): void {
  if (!previousState || previousState.phase === state.phase) {
    return;
  }

  const targetSelector = state.phase === 'conversion-complete'
    ? '#review-workspace-title'
    : state.phase === 'conversion-error' || state.phase === 'unsupported-launch' || state.phase === 'worker-error'
      ? '#recovery-title'
      : state.phase === 'selecting-input'
        ? '#primary-task-title'
        : undefined;

  if (!targetSelector) {
    return;
  }

  const target = root.querySelector<HTMLElement>(targetSelector);
  target?.focus();
}

function attachSkipLinkFocus(doc: Document = document): void {
  const skipLink = doc.querySelector<HTMLAnchorElement>('.skip-link');

  if (!skipLink || skipLink.dataset.focusBound === 'true') {
    return;
  }

  skipLink.dataset.focusBound = 'true';
  skipLink.addEventListener('click', (event) => {
    const targetId = skipLink.getAttribute('href');
    if (!targetId?.startsWith('#')) {
      return;
    }

    const target = doc.querySelector<HTMLElement>(targetId);
    if (!target) {
      return;
    }

    event.preventDefault();
    target.focus();
    target.scrollIntoView({ block: 'start' });
    doc.defaultView?.history.replaceState(null, '', targetId);
  });
}
