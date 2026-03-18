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
  withSessionNotice,
  withTheme,
  withAttachmentBasePath,
  withDownloadError,
  withExportResult,
  withNote,
  withPhase,
  withSelectedInput,
  type AppState,
  type ResolvedTheme,
  type SessionNotice,
  type ThemePreference,
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

const THEME_STORAGE_KEY = 'endnote-exporter.theme-preference';
const SESSION_STATE_STORAGE_KEY = 'endnote-exporter.session-state';
const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#11161d',
  light: '#f3eee6',
};

type SessionStateMarkerPhase = 'conversion-complete' | 'converting';

interface SessionStateMarker {
  phase: SessionStateMarkerPhase;
  version: 1;
}

export async function mountApp(root: HTMLElement): Promise<void> {
  const runtime = detectBrowserRuntime();
  let state = initialiseThemeState(createInitialState(runtime));
  state = withSessionNotice(state, takeSessionNotice());

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

    syncSessionStateMarker(state);

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
  syncSessionStateMarker(state);
  render(root, state, controller);

  const themeMediaQuery = getThemeMediaQuery();
  themeMediaQuery?.addEventListener('change', () => {
    updateState((currentState) => {
      if (currentState.themePreference !== 'system') {
        return currentState;
      }

      const resolvedTheme = resolveThemePreference('system');
      applyDocumentTheme('system', resolvedTheme);
      return withTheme(currentState, 'system', resolvedTheme);
    });
  });

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
  handleThemePreferenceChange: (themePreference: ThemePreference) => void;
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

    handleThemePreferenceChange(themePreference) {
      const resolvedTheme = resolveThemePreference(themePreference);
      persistThemePreference(themePreference);
      applyDocumentTheme(themePreference, resolvedTheme);
      updateState((currentState) => withTheme(currentState, themePreference, resolvedTheme));
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

  const themeButtons = root.querySelectorAll<HTMLButtonElement>('[data-theme-preference]');
  themeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const themePreference = button.dataset.themePreference;
      if (themePreference === 'system' || themePreference === 'light' || themePreference === 'dark') {
        controller.handleThemePreferenceChange(themePreference);
      }
    });
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

function initialiseThemeState(state: AppState): AppState {
  const themePreference = readStoredThemePreference();
  const resolvedTheme = resolveThemePreference(themePreference);
  applyDocumentTheme(themePreference, resolvedTheme);
  return withTheme(state, themePreference, resolvedTheme);
}

function readStoredThemePreference(): ThemePreference {
  if (typeof document !== 'undefined') {
    const documentPreference = document.documentElement.dataset.themePreference;
    if (
      documentPreference === 'system'
      || documentPreference === 'light'
      || documentPreference === 'dark'
    ) {
      return documentPreference;
    }
  }

  if (typeof localStorage === 'undefined') {
    return 'system';
  }

  try {
    const storedValue = localStorage.getItem(THEME_STORAGE_KEY);
    return storedValue === 'light' || storedValue === 'dark' ? storedValue : 'system';
  } catch {
    return 'system';
  }
}

function persistThemePreference(themePreference: ThemePreference): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    if (themePreference === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY);
      return;
    }

    localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  } catch {
    // Ignore storage write failures and continue with the in-memory theme selection.
  }
}

function resolveThemePreference(themePreference: ThemePreference): ResolvedTheme {
  if (themePreference === 'light' || themePreference === 'dark') {
    return themePreference;
  }

  return getThemeMediaQuery()?.matches ? 'dark' : 'light';
}

function applyDocumentTheme(themePreference: ThemePreference, resolvedTheme: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = themePreference;
  document.documentElement.style.colorScheme = resolvedTheme;

  const themeColorMeta = 'querySelector' in document
    ? document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    : null;
  themeColorMeta?.setAttribute('content', THEME_COLORS[resolvedTheme]);
}

function getThemeMediaQuery(): MediaQueryList | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return undefined;
  }

  return window.matchMedia('(prefers-color-scheme: dark)');
}

export function syncSessionStateMarker(
  state: AppState,
  storage: Pick<Storage, 'removeItem' | 'setItem'> | undefined = getSessionStorage(),
): void {
  if (!storage) {
    return;
  }

  if (state.phase === 'converting' || state.phase === 'conversion-complete') {
    storage.setItem(SESSION_STATE_STORAGE_KEY, JSON.stringify({
      phase: state.phase,
      version: 1,
    } satisfies SessionStateMarker));
    return;
  }

  storage.removeItem(SESSION_STATE_STORAGE_KEY);
}

export function createSessionNoticeFromMarker(phase: SessionStateMarkerPhase): SessionNotice {
  if (phase === 'converting') {
    return {
      message: 'A previous in-memory conversion was interrupted. For privacy, progress is not restored after refresh or tab replacement.',
      recoveryGuidance: [
        {
          detail: 'Choose the same ZIP again to restart conversion in this served session.',
          label: 'Re-select the library ZIP',
        },
        {
          detail: 'Keep this tab open until the review workspace appears so the in-memory result is available for download.',
          label: 'Avoid refreshing during conversion',
        },
      ],
      severity: 'warning',
      title: 'Previous session was interrupted',
    };
  }

  return {
    message: 'A previous in-memory review workspace was cleared. Export results are intentionally not restored after refresh to keep browser-local data ephemeral.',
    recoveryGuidance: [
      {
        detail: 'Run the same ZIP again if you still need to inspect the result or download a fresh XML file.',
        label: 'Re-run the ZIP when needed',
      },
      {
        detail: 'Download the XML promptly after review if you do not want to repeat the browser-local conversion step.',
        label: 'Finish download in the same session',
      },
    ],
    severity: 'warning',
    title: 'Previous review data was cleared',
  };
}

export function takeSessionNotice(
  storage: Pick<Storage, 'getItem' | 'removeItem'> | undefined = getSessionStorage(),
): SessionNotice | undefined {
  if (!storage) {
    return undefined;
  }

  try {
    const rawMarker = storage.getItem(SESSION_STATE_STORAGE_KEY);
    storage.removeItem(SESSION_STATE_STORAGE_KEY);

    if (!rawMarker) {
      return undefined;
    }

    const marker = JSON.parse(rawMarker) as Partial<SessionStateMarker>;

    if (marker.phase !== 'converting' && marker.phase !== 'conversion-complete') {
      return undefined;
    }

    return createSessionNoticeFromMarker(marker.phase);
  } catch {
    storage.removeItem(SESSION_STATE_STORAGE_KEY);
    return undefined;
  }
}

function getSessionStorage(): Storage | undefined {
  if (typeof sessionStorage === 'undefined') {
    return undefined;
  }

  return sessionStorage;
}
