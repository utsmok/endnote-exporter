import { createExportWorkerClient } from '../adapters/browser-worker-client';
import { detectBrowserRuntime } from '../adapters/browser-runtime';
import {
  pickLibraryDirectory,
  prepareLibraryFromBrowserInput,
} from '../adapters/browser-input';
import {
  clearDownloadError,
  clearExportResult,
  createInitialState,
  withStatus,
  withAttachmentBasePath,
  withDownloadError,
  withExportResult,
  withNote,
  withPhase,
  withSelectedInput,
  type AppState,
} from './state';
import { downloadExportResult } from './download';
import {
  buildConversionCompleteStatus,
  buildConversionFailureStatus,
  buildConvertingStatus,
  buildDirectoryCancelledStatus,
  buildInitialisationFailureStatus,
  buildInputRejectedStatus,
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
  handleDirectoryPick: () => void;
  handleDropZoneKeyDown: (event: KeyboardEvent) => void;
  handleFileSelect: (file: File) => void;
  handleDownload: () => void;
  handleConvertAnother: () => void;
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

    async handleFileSelect(file: File) {
      if (!file.name.endsWith('.zip')) {
        updateState((currentState) => withStatus(currentState, buildInputRejectedStatus()));
        return;
      }

      updateState((currentState) => withStatus(
        withSelectedInput(currentState, file.name),
        buildConvertingStatus(file.name),
      ));

      try {
        const library = await prepareInput({
          file,
          kind: 'zip-file',
        });
        const response = await workerClient.convertPreparedLibrary(
          library,
          buildAttachmentOptions(getState()),
        );

        updateState((currentState) => withStatus(
          withExportResult(currentState, response.exportResult),
          buildConversionCompleteStatus(response.exportResult, 'zip'),
        ));
      } catch (error) {
        updateState((currentState) => withStatus(
          withNote(
            withPhase(currentState, 'conversion-error'),
            error instanceof Error ? error.message : 'Unknown conversion error.',
          ),
          buildConversionFailureStatus('zip'),
        ));
      }
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
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      controller.handleFileSelect(file);
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
