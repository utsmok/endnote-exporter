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
  withAttachmentBasePath,
  withDownloadError,
  withExportResult,
  withItemModalOpen,
  withNote,
  withPhase,
  withSelectedInput,
  withStatusMessage,
  type AppState,
} from './state';
import { downloadExportResult } from './download';

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
    state = typeof nextStateOrUpdater === 'function'
      ? nextStateOrUpdater(state)
      : nextStateOrUpdater;

    if (options.render !== false) {
      render(root, state, controller);
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

  render(root, state, controller);

  if (!runtime.isServedMode) {
    updateState({
      ...state,
      phase: 'unsupported-launch',
      statusMessage: 'Open this workspace through the Vite dev or preview server.',
      workerStatus: 'error',
    });
    return;
  }

  if (!runtime.workerSupported) {
    updateState({
      ...state,
      phase: 'worker-error',
      statusMessage: 'Dedicated workers are required for the browser-local pipeline baseline.',
      workerStatus: 'error',
    });
    return;
  }

  try {
    const ready = await workerClient.initialise();
    updateState({
      ...state,
      notes: Array.from(new Set([...state.notes, ...ready.notes])),
      phase: 'selecting-input',
      statusMessage: buildReadyStatusMessage(runtime),
      workerStatus: 'ready',
    });
  } catch (error) {
    updateState({
      ...state,
      notes: [
        ...state.notes,
        error instanceof Error ? error.message : 'Unknown worker initialisation failure.',
      ],
      phase: 'worker-error',
      statusMessage: 'Worker initialisation failed.',
      workerStatus: 'error',
    });
  }
}

function render(root: HTMLElement, state: AppState, controller: Controller): void {
  root.innerHTML = renderApp(state);
  attachController(root, controller);
  syncItemModal(root, state, controller);
}

function renderApp(state: AppState): string {
  return `
    <main class="shell">
      <section class="hero card">
        <p class="eyebrow">EndNote Exporter · Browser-local Conversion</p>
        <h1>Convert EndNote Libraries to Zotero</h1>
        <p class="lede">
          Select an EndNote library ZIP file to convert it locally in your browser.
          Your data never leaves your device.
        </p>
        <div class="status-row">
          <span class="status-chip status-chip--${escapeHtml(state.workerStatus)}">${escapeHtml(state.workerStatus)}</span>
          <span>${escapeHtml(state.statusMessage)}</span>
        </div>
      </section>

      ${renderMainContent(state)}
    </main>
  `;
}

function renderMainContent(state: AppState): string {
  switch (state.phase) {
    case 'selecting-input':
      return renderFileSelection(state);
    case 'converting':
      return renderConverting(state);
    case 'conversion-complete':
      return renderConversionComplete(state);
    case 'conversion-error':
      return renderConversionError(state);
    default:
      return '';
  }
}

function renderFileSelection(state: AppState): string {
  const directFolderSection = state.runtime.directoryIntake.available
    ? `
      <div class="enhancement-card">
        <p class="enhancement-eyebrow">Experimental direct-folder intake</p>
        <p class="instruction enhancement-copy">
          Exposed only when the browser provides a secure-context directory picker. ZIP upload remains the supported baseline path.
        </p>
        <button id="directory-picker-button" class="button button--secondary" type="button">
          Choose Library Folder
        </button>
      </div>
    `
    : `
      <div class="enhancement-card enhancement-card--muted">
        <p class="enhancement-eyebrow">Direct-folder intake unavailable here</p>
        <p class="instruction enhancement-copy">
          ZIP upload remains fully usable. Folder selection is shown only when the browser exposes the required picker capability in a served, secure context.
        </p>
      </div>
    `;

  return `
    <section class="card">
      <h2>Select EndNote Library</h2>
      <p class="instruction">
        Choose a ZIP file containing your EndNote library (.enl + .Data folder or .enlp package). This ZIP-first flow is the supported baseline.
      </p>
      <div class="file-input-wrapper">
        <input
          type="file"
          id="zip-file-input"
          accept=".zip"
          class="file-input"
        />
        <label for="zip-file-input" id="zip-dropzone" class="file-input-label" tabindex="0">
          <span class="file-input-button">Choose ZIP File</span>
          <span class="file-input-text">Drop a ZIP here or choose a file</span>
        </label>
      </div>
      <p class="drop-hint">Drag and drop a ZIP onto the picker above for the same supported ZIP-first workflow.</p>
      <div class="field-group">
        <label class="field-label" for="attachment-base-path">Optional library location for PDF links</label>
        <input
          id="attachment-base-path"
          class="text-input"
          type="text"
          value="${escapeHtml(state.attachmentBasePath)}"
          spellcheck="false"
          autocomplete="off"
          placeholder="/Users/me/Documents or C:\\Users\\me\\Documents\\MyLibrary.enlp"
        />
        <p class="field-help">
          Browsers cannot reveal native absolute paths from file or folder pickers. If you want PDF file paths in the XML, supply the containing library folder yourself (for <code>.enl</code> + <code>.Data</code>) or the full <code>.enlp</code> package path. We will combine that with verified relative attachment paths from the selected ZIP or folder.
        </p>
      </div>
      <div class="help-text">
        <p><strong>Supported formats:</strong></p>
        <ul>
          <li>.zip files containing .enl + .Data folder</li>
          <li>.zip files containing .enlp package contents</li>
        </ul>
      </div>
      ${directFolderSection}
    </section>
  `;
}

function renderConverting(state: AppState): string {
  return `
    <section class="card">
      <h2>Converting Library</h2>
      <p class="instruction">
        Processing <strong>${escapeHtml(state.selectedInputLabel || 'unknown')}</strong>...
      </p>
      <div class="progress-indicator">
        <div class="spinner"></div>
        <span>Converting references and generating Zotero XML...</span>
      </div>
    </section>
  `;
}

function renderConversionComplete(state: AppState): string {
  const result = state.exportResult;
  if (!result) {
    return '';
  }

  const {
    attachmentBaseLibraryPath,
    attachmentCount,
    attachmentMode,
    inputRecordCount,
    items,
    libraryDisplayName,
    linkedAttachmentCount,
    missingAttachmentPayloadCount,
    recordCount,
    referenceCountWithAttachments,
    skippedRecordCount,
    warnings,
  } = result.metadata;

  return `
    <section class="card">
      <h2>Conversion Complete</h2>
      <div class="success-summary">
        <p><strong>Library:</strong> ${escapeHtml(libraryDisplayName)}</p>
        <p><strong>Exported records:</strong> ${recordCount}</p>
        <p><strong>Input rows:</strong> ${inputRecordCount}</p>
        <p><strong>Skipped rows:</strong> ${skippedRecordCount}</p>
        <p><strong>Attachments detected:</strong> ${attachmentCount}</p>
        <p><strong>PDF links exported:</strong> ${linkedAttachmentCount}</p>
        <p><strong>References with attachments:</strong> ${referenceCountWithAttachments}</p>
        <p><strong>Attachment mode:</strong> ${escapeHtml(attachmentMode)}</p>
        ${attachmentBaseLibraryPath
          ? `<p><strong>Library location used:</strong> <code>${escapeHtml(attachmentBaseLibraryPath)}</code></p>`
          : ''
        }
        ${missingAttachmentPayloadCount > 0
          ? `<p><strong>Missing attachment payloads:</strong> ${missingAttachmentPayloadCount}</p>`
          : ''
        }
        ${warnings.length > 0
          ? `<p><strong>Warnings:</strong> ${warnings.length}</p>`
          : '<p><strong>Warnings:</strong> None</p>'
        }
      </div>

      ${warnings.length > 0 ? renderWarnings(warnings) : ''}

      <div class="action-row">
        <button id="download-button" class="button button--primary" type="button">
          Download Zotero XML
        </button>
        <button id="view-items-button" class="button button--secondary" type="button">
          View Exported Items (${items.length})
        </button>
        <button id="convert-another-button" class="button button--secondary" type="button">
          Convert Another Library
        </button>
      </div>

      ${state.downloadErrorMessage
        ? `<p class="inline-error" role="alert">${escapeHtml(state.downloadErrorMessage)}</p>`
        : ''
      }

      ${renderItemModal(state)}
    </section>
  `;
}

function renderItemModal(state: AppState): string {
  if (!state.exportResult) {
    return '';
  }

  const { items, libraryDisplayName } = state.exportResult.metadata;

  return `
    <dialog id="items-modal" class="modal" aria-labelledby="items-modal-title">
      <div class="modal__content">
        <div class="modal__header">
          <div>
            <p class="eyebrow modal__eyebrow">Exported items</p>
            <h3 id="items-modal-title">${escapeHtml(libraryDisplayName)}</h3>
          </div>
          <button id="close-items-modal-button" class="button button--secondary" type="button">
            Close
          </button>
        </div>
        <p class="instruction modal__copy">
          Review the exported records and whether each one includes at least one verified PDF attachment row.
        </p>
        <div class="modal__table-wrap">
          <table class="items-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Author</th>
                <th scope="col">Year</th>
                <th scope="col">PDF</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  <td>${escapeHtml(item.title)}</td>
                  <td>${escapeHtml(item.author)}</td>
                  <td class="tabular-cell">${escapeHtml(item.year)}</td>
                  <td>${item.hasPdfAttachment ? 'Yes' : 'No'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </dialog>
  `;
}

function renderConversionError(state: AppState): string {
  return `
    <section class="card card--error">
      <h2>Conversion Failed</h2>
      <p class="error-message">
        An error occurred while converting your library.
      </p>
      ${state.notes.length > 0
        ? `<ul class="error-list">
            ${state.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
          </ul>`
        : ''
      }
      <button id="retry-button" class="button button--primary" type="button">
        Try Again
      </button>
    </section>
  `;
}

function renderWarnings(warnings: Array<{ code: string; message: string }>): string {
  return `
    <div class="warnings">
      <h3>Warnings</h3>
      <ul class="warning-list">
        ${warnings.map((warning) => `<li><code>${escapeHtml(warning.code)}</code>: ${escapeHtml(warning.message)}</li>`).join('')}
      </ul>
    </div>
  `;
}

interface Controller {
  handleAttachmentBasePathInput: (value: string) => void;
  handleCloseItemsModal: () => void;
  handleDirectoryPick: () => void;
  handleDropZoneKeyDown: (event: KeyboardEvent) => void;
  handleFileSelect: (file: File) => void;
  handleDownload: () => void;
  handleConvertAnother: () => void;
  handleOpenItemsModal: () => void;
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

    handleCloseItemsModal() {
      updateState((currentState) => withItemModalOpen(currentState, false));
    },

    async handleDirectoryPick() {
      try {
        const handle = await pickDirectory();
        updateState((currentState) => withSelectedInput(currentState, `${handle.name}/`));

        const library = await prepareInput({
          handle,
          kind: 'directory-handle',
        });
        const response = await workerClient.convertPreparedLibrary(
          library,
          buildAttachmentOptions(getState()),
        );

        updateState((currentState) => withStatusMessage(
          withExportResult(currentState, response.exportResult),
          response.exportResult.metadata.skippedRecordCount > 0
            ? 'Folder conversion completed with skipped records. Review the warnings before downloading the XML.'
            : 'Folder conversion completed successfully.',
        ));
      } catch (error) {
        if (isPickerAbortError(error)) {
          updateState((currentState) => withStatusMessage(
            currentState,
            'Folder selection cancelled. ZIP upload remains available.',
          ));
          return;
        }

        updateState((currentState) => withStatusMessage(
          withNote(
            withPhase(currentState, 'conversion-error'),
            error instanceof Error ? error.message : 'Unknown directory conversion error.',
          ),
          'Folder conversion failed. ZIP upload remains available as the baseline path.',
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
        updateState((currentState) => withStatusMessage(
          currentState,
          'Please choose a ZIP archive containing your EndNote library.',
        ));
        return;
      }

      updateState((currentState) => withSelectedInput(currentState, file.name));

      try {
        const library = await prepareInput({
          file,
          kind: 'zip-file',
        });
        const response = await workerClient.convertPreparedLibrary(
          library,
          buildAttachmentOptions(getState()),
        );

        updateState((currentState) => withStatusMessage(
          withExportResult(currentState, response.exportResult),
          response.exportResult.metadata.skippedRecordCount > 0
            ? 'Conversion completed with skipped records. Review the warnings before downloading the XML.'
            : 'Conversion completed successfully.',
        ));
      } catch (error) {
        updateState((currentState) => withStatusMessage(
          withNote(
            withPhase(currentState, 'conversion-error'),
            error instanceof Error ? error.message : 'Unknown conversion error.',
          ),
          'Conversion failed. Please try again.',
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
      updateState((currentState) => clearExportResult(currentState));
    },

    handleOpenItemsModal() {
      updateState((currentState) => withItemModalOpen(currentState, true));
    },

    handleRetry() {
      updateState((currentState) => clearExportResult(currentState));
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

  const fileInputText = root.querySelector<HTMLElement>('.file-input-text');
  fileInput?.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (fileInputText) {
      fileInputText.textContent = file ? file.name : 'No file selected';
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
        if (fileInputText) {
          fileInputText.textContent = file.name;
        }
        controller.handleFileSelect(file);
      }
    });
  }

  const downloadButton = root.querySelector<HTMLButtonElement>('#download-button');
  downloadButton?.addEventListener('click', () => controller.handleDownload());

  const viewItemsButton = root.querySelector<HTMLButtonElement>('#view-items-button');
  viewItemsButton?.addEventListener('click', () => controller.handleOpenItemsModal());

  const closeItemsModalButton = root.querySelector<HTMLButtonElement>('#close-items-modal-button');
  closeItemsModalButton?.addEventListener('click', () => controller.handleCloseItemsModal());

  const convertAnotherButton = root.querySelector<HTMLButtonElement>('#convert-another-button');
  convertAnotherButton?.addEventListener('click', () => controller.handleConvertAnother());

  const retryButton = root.querySelector<HTMLButtonElement>('#retry-button');
  retryButton?.addEventListener('click', () => controller.handleRetry());
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function syncItemModal(root: HTMLElement, state: AppState, controller: Controller): void {
  const dialog = root.querySelector<HTMLDialogElement>('#items-modal');

  if (!dialog) {
    return;
  }

  if (state.isItemModalOpen && !dialog.open) {
    dialog.showModal();
  }

  if (!state.isItemModalOpen && dialog.open) {
    dialog.close();
  }

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    controller.handleCloseItemsModal();
  });
}

function buildAttachmentOptions(state: AppState): { baseLibraryPath: string } | undefined {
  const baseLibraryPath = state.attachmentBasePath.trim();

  return baseLibraryPath.length > 0
    ? { baseLibraryPath }
    : undefined;
}

function buildReadyStatusMessage(runtime: AppState['runtime']): string {
  return runtime.directoryIntake.available
    ? 'Worker initialised successfully. Upload a ZIP file to begin conversion, or try the experimental folder picker when appropriate.'
    : 'Worker initialised successfully. Upload a ZIP file to begin conversion.';
}

function isPickerAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
