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
  withTheme,
  withAttachmentBasePath,
  withDownloadError,
  withExportResult,
  withItemModalOpen,
  withNote,
  withPhase,
  withSelectedInput,
  withStatusMessage,
  type AppState,
  type ResolvedTheme,
  type ThemePreference,
} from './state';
import { downloadExportResult } from './download';

const THEME_STORAGE_KEY = 'endnote-exporter.theme-preference';

export async function mountApp(root: HTMLElement): Promise<void> {
  const runtime = detectBrowserRuntime();
  let state = initialiseThemeState(createInitialState(runtime));

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
        <div class="hero__glow" aria-hidden="true"></div>
        <div class="hero__header">
          <div class="hero__copy">
            <p class="eyebrow">EndNote Exporter · Browser-local workspace</p>
            <h1>Convert EndNote Libraries to Zotero</h1>
            <p class="lede">
              Convert locally in a calmer browser workspace with richer metadata review,
              system-aware theming, and XML generation that stays on your device.
            </p>
          </div>
          ${renderThemeToggle(state)}
        </div>
        <div class="status-panel">
          <div class="status-row">
            <span class="status-chip status-chip--${escapeHtml(state.workerStatus)}">${escapeHtml(state.workerStatus)}</span>
            <span class="status-text">${escapeHtml(state.statusMessage)}</span>
            ${renderTooltip(
              'worker-status-help',
              'How browser-local mode works',
              buildWorkerTooltip(state),
            )}
          </div>
          ${renderStatusDetails(state)}
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
        <div class="section-heading section-heading--tight">
          <div class="section-heading__title">
            <p class="enhancement-eyebrow">Experimental direct-folder intake</p>
            ${renderTooltip(
              'directory-intake-help',
              'When direct-folder intake appears',
              'Folder selection is offered only in served, secure browser contexts that expose the required directory picker APIs.',
            )}
          </div>
          <span class="soft-chip">Progressive enhancement</span>
        </div>
        <details class="disclosure disclosure--compact disclosure--embedded">
          <summary>When should I use the folder picker?</summary>
          <div class="disclosure__content">
            <p>
              Use it only when you already have a local library folder available and your browser exposes the picker.
              ZIP upload remains the supported baseline flow and should be preferred for consistent cross-browser behavior.
            </p>
          </div>
        </details>
        <button id="directory-picker-button" class="button button--secondary" type="button">
          Choose Library Folder
        </button>
      </div>
    `
    : `
      <div class="enhancement-card enhancement-card--muted">
        <div class="section-heading section-heading--tight">
          <p class="enhancement-eyebrow">Direct-folder intake unavailable here</p>
          ${renderTooltip(
            'directory-intake-unavailable-help',
            'Why the folder picker is unavailable',
            'ZIP upload remains fully supported. The folder picker stays hidden unless the browser exposes the required secure-context capability.',
          )}
        </div>
      </div>
    `;

  return `
    <section class="card">
      <div class="section-heading">
        <div>
          <div class="section-heading__title">
            <h2>Select EndNote Library</h2>
            ${renderTooltip(
              'zip-upload-help',
              'How to start a conversion',
              'Upload a ZIP that contains either an .enl library plus matching .Data folder or an .enlp package export.',
            )}
          </div>
          <p class="instruction section-subcopy">
            ZIP upload stays the supported baseline, while the optional folder picker appears only when the browser can safely support it.
          </p>
        </div>
        <div class="chip-row">
          <span class="soft-chip">Local-only processing</span>
          <span class="soft-chip">ZIP-first</span>
        </div>
      </div>
      <div class="file-input-wrapper">
        <input
          type="file"
          id="zip-file-input"
          accept=".zip"
          class="file-input"
        />
        <label for="zip-file-input" id="zip-dropzone" class="file-input-label" tabindex="0">
          <span class="file-input-button">Choose ZIP file</span>
          <span class="file-input-text">
            Drop a validated library ZIP here or browse for one from your device.
          </span>
        </label>
      </div>
      <div class="inline-meta-row" role="note">
        <span class="inline-meta-pill">Drag-and-drop supported</span>
        ${renderTooltip(
          'drag-and-drop-help',
          'Drag and drop support',
          'Dropping a ZIP onto the upload surface uses the same validated ZIP-first conversion flow as the file picker.',
        )}
      </div>
      <div class="field-group">
        <div class="field-label-row">
          <label class="field-label" for="attachment-base-path">Optional library location for PDF links</label>
          ${renderTooltip(
            'attachment-base-path-tip',
            'Why add a library path?',
            'Use this only if you want exported XML items to include PDF file links that point back to your local EndNote library.',
          )}
        </div>
        <input
          id="attachment-base-path"
          class="text-input"
          type="text"
          value="${escapeHtml(state.attachmentBasePath)}"
          spellcheck="false"
          autocomplete="off"
          placeholder="/Users/me/Documents or C:\\Users\\me\\Documents\\MyLibrary.enlp"
        />
        <details class="disclosure">
          <summary>How PDF library paths work</summary>
          <div class="disclosure__content">
            <p>
              Browsers do not expose native absolute paths from file or folder pickers. If you want PDF links in the exported XML,
              provide the containing library folder yourself for <code>.enl</code> + <code>.Data</code> libraries, or the full <code>.enlp</code> package path.
            </p>
            <p>
              The exporter combines that base location with verified relative attachment paths discovered inside the selected ZIP or folder.
            </p>
          </div>
        </details>
      </div>
      <details class="disclosure disclosure--compact">
        <summary>Supported archive shapes</summary>
        <div class="disclosure__content">
          <ul>
            <li><code>.zip</code> files containing <code>.enl</code> + <code>.Data</code></li>
            <li><code>.zip</code> files containing <code>.enlp</code> package contents</li>
          </ul>
        </div>
      </details>
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
    <dialog id="items-modal" class="modal" aria-labelledby="items-modal-title" aria-modal="true">
      <div class="modal__content">
        <div class="modal__header">
          <div>
            <p class="eyebrow modal__eyebrow">Exported items</p>
            <h3 id="items-modal-title">${escapeHtml(libraryDisplayName)}</h3>
            <p class="instruction modal__copy">
              Review title, author, publication context, DOI metadata, and verified PDF status before importing the XML.
            </p>
          </div>
          <button id="close-items-modal-button" class="button button--secondary" type="button">
            Close
          </button>
        </div>
        <div class="modal__intro">
          <div class="modal__meta-row">
            <span class="soft-chip">${items.length} exported item${items.length === 1 ? '' : 's'}</span>
            ${renderTooltip(
              'doi-link-help',
              'How DOI links behave',
              'When the exporter can derive a canonical DOI URL, the DOI opens in a new tab. Otherwise the raw DOI value is shown as text.',
            )}
          </div>
        </div>
        <div class="modal__table-wrap">
          <table class="items-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Author</th>
                <th scope="col">Journal</th>
                <th scope="col">Year</th>
                <th scope="col">PDF</th>
                <th scope="col">DOI</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr>
                  <td>
                    <div class="item-meta">
                      <span class="item-meta__primary">${escapeHtml(item.title)}</span>
                      <span class="item-meta__secondary">Record #${escapeHtml(String(item.recordId))}</span>
                    </div>
                  </td>
                  <td>
                    <div class="item-meta">
                      <span class="item-meta__primary">${escapeHtml(item.author)}</span>
                    </div>
                  </td>
                  <td>${escapeHtml(item.journal)}</td>
                  <td class="tabular-cell">${escapeHtml(item.year)}</td>
                  <td>
                    ${renderAttachmentIndicator(item.hasPdfAttachment)}
                  </td>
                  <td>
                    ${item.doiUrl
                      ? `<a class="doi-link" href="${escapeHtml(item.doiUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(item.doi)}</a>`
                      : escapeHtml(item.doi)
                    }
                  </td>
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
    <div class="warnings" role="region" aria-labelledby="warnings-title">
      <div class="section-heading section-heading--tight">
        <div class="section-heading__title">
          <h3 id="warnings-title">Warnings</h3>
          ${renderTooltip(
            'warnings-help',
            'What warnings mean',
            'Warnings flag records or attachments that need a quick review before import. They do not block XML download.',
          )}
        </div>
      </div>
      <ul class="warning-list">
        ${warnings.map((warning) => `<li><code>${escapeHtml(warning.code)}</code>: ${escapeHtml(warning.message)}</li>`).join('')}
      </ul>
      <details class="disclosure disclosure--warning">
        <summary>Why am I seeing warnings?</summary>
        <div class="disclosure__content">
          <p>
            Warning codes usually mean that an attachment payload was missing, a timestamp was malformed,
            or a record could not be converted without being skipped.
          </p>
          <p>
            Review the list above before importing so you know whether any follow-up cleanup is needed in Zotero or in the original EndNote library.
          </p>
        </div>
      </details>
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

function renderThemeToggle(state: AppState): string {
  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  const preferenceCaption = state.themePreference === 'system'
    ? `Following system (${state.resolvedTheme})`
    : `Locked to ${state.resolvedTheme}`;

  return `
    <div class="theme-toggle" role="group" aria-label="Theme preference">
      <span class="theme-toggle__label">Appearance</span>
      <div class="theme-toggle__controls">
        ${themeOptions.map((option) => `
          <button
            class="theme-toggle__button ${state.themePreference === option.value ? 'theme-toggle__button--active' : ''}"
            type="button"
            data-theme-preference="${option.value}"
            aria-pressed="${state.themePreference === option.value ? 'true' : 'false'}"
          >
            ${option.label}
          </button>
        `).join('')}
      </div>
      <span class="theme-toggle__caption">${escapeHtml(preferenceCaption)}</span>
    </div>
  `;
}

function renderTooltip(id: string, label: string, text: string): string {
  return `
    <span class="tooltip">
      <button class="tooltip__trigger" type="button" aria-label="${escapeHtml(label)}" aria-describedby="${escapeHtml(id)}">
        <span aria-hidden="true">i</span>
      </button>
      <span class="tooltip__bubble" role="tooltip" id="${escapeHtml(id)}">${escapeHtml(text)}</span>
    </span>
  `;
}

function renderAttachmentIndicator(hasPdfAttachment: boolean): string {
  const label = hasPdfAttachment
    ? 'Verified PDF attachment present'
    : 'No verified PDF attachment found';

  return `
    <span
      class="attachment-indicator ${hasPdfAttachment ? 'attachment-indicator--present' : 'attachment-indicator--absent'}"
      role="img"
      aria-label="${label}"
      title="${label}"
    >
      <span class="attachment-indicator__icon" aria-hidden="true">${hasPdfAttachment ? '✓' : '—'}</span>
    </span>
  `;
}

function renderStatusDetails(state: AppState): string {
  if (state.workerStatus === 'error') {
    return `
      <details class="disclosure disclosure--hero">
        <summary>Troubleshooting browser support</summary>
        <div class="disclosure__content">
          <p>
            This workspace requires a served page and dedicated worker support. Open the app through the Vite dev or preview server instead of <code>file://</code>.
          </p>
          <p>
            If workers are blocked, check the browser version, privacy extensions, or enterprise policies that may disable worker execution.
          </p>
        </div>
      </details>
    `;
  }

  return `
    <details class="disclosure disclosure--hero">
      <summary>What browser-local mode includes</summary>
      <div class="disclosure__content">
        <p>
          ZIP upload is the stable baseline path. Directory intake is optional and appears only when the browser exposes secure-context picker APIs.
        </p>
        <p>
          The worker keeps heavy processing off the main thread while the UI remains responsive during conversion.
        </p>
      </div>
    </details>
  `;
}

function buildWorkerTooltip(state: AppState): string {
  if (state.workerStatus === 'error') {
    return 'Served mode and dedicated worker support are required for the browser-local conversion pipeline.';
  }

  return state.runtime.directoryIntake.available
    ? 'ZIP upload is the supported baseline; the folder picker is a progressive enhancement when the browser supports it.'
    : 'The worker is ready. ZIP upload is available everywhere this served browser-local workspace is supported.';
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
}

function getThemeMediaQuery(): MediaQueryList | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return undefined;
  }

  return window.matchMedia('(prefers-color-scheme: dark)');
}
