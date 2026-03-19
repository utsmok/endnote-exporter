# EndNote Exporter Web App — Redesign Implementation Plan

## Executive Summary

**Goal**: Convert the current single-page state-based UI into a two-page flow with explicit navigation and improved UX.

**Current Architecture**: Vanilla TypeScript with template literal HTML rendering, single-page state machine.

**Target Architecture**: Same core architecture, but with:
- Explicit "Initial Page" → "Results Page" navigation
- Form validation before enabling conversion
- Visual file upload state management
- Error state separation by type
- Results page with accordion-style records display

**Implementation Effort**: ~2-3 days

---

## Phase 1: Architecture & State Management Changes

### 1.1 New State Structure

**Current State** (`src/app/state.ts`):
```typescript
export type AppPhase =
  | 'booting'
  | 'ready'
  | 'unsupported-launch'
  | 'worker-error'
  | 'selecting-input'
  | 'converting'
  | 'conversion-complete'
  | 'conversion-error';
```

**New State**:
```typescript
export type AppPhase =
  | 'booting'
  | 'ready'
  | 'unsupported-launch'
  | 'worker-error'
  | 'initial-page'        // NEW: Combined selecting-input + file validation
  | 'converting'
  | 'results-page'        // NEW: Replaces conversion-complete
  | 'error-file'          // NEW: File-specific errors
  | 'error-pdf-path'      // NEW: PDF path-specific errors
  | 'error-generic';      // NEW: Generic errors

export interface InitialPageState {
  uploadedFile: File | null;
  uploadedFileName: string;
  libraryPath: string;
  isFileValid: boolean;
  isPathValid: boolean;
  canProceed: boolean;  // Both file and path valid
  dropzoneState: 'idle' | 'drag-active' | 'error' | 'success';
}

export interface ResultsPageState {
  isAccordionExpanded: boolean;
  selectedRecordId: number | null;
}
```

**Changes to `AppState` interface**:
```typescript
export interface AppState {
  // Existing fields remain...
  phase: AppPhase;

  // NEW: Page-specific state
  initialPage?: InitialPageState;
  resultsPage?: ResultsPageState;

  // MODIFIED: Error state separation
  errorType?: 'file' | 'pdf-path' | 'generic';
}
```

### 1.2 New State Updaters

Add to `src/app/state.ts`:

```typescript
// Initial page state management
export function withInitialPageState(
  state: AppState,
  updates: Partial<InitialPageState>
): AppState {
  const currentInitialPage = state.initialPage || {
    uploadedFile: null,
    uploadedFileName: '',
    libraryPath: '',
    isFileValid: false,
    isPathValid: false,
    canProceed: false,
    dropzoneState: 'idle',
  };

  const updated = {
    ...currentInitialPage,
    ...updates,
  };

  // Auto-calculate canProceed
  updated.canProceed = updated.isFileValid && updated.isPathValid;

  return {
    ...state,
    initialPage: updated,
  };
}

export function withUploadedFile(state: AppState, file: File | null): AppState {
  return withInitialPageState(state, {
    uploadedFile: file,
    uploadedFileName: file?.name || '',
    isFileValid: file !== null,
    dropzoneState: file !== null ? 'success' : 'idle',
  });
}

export function withLibraryPath(state: AppState, path: string): AppState {
  const isPathValid = path.trim().length > 0;
  return withInitialPageState(state, {
    libraryPath: path,
    isPathValid,
  });
}

export function withDropzoneState(
  state: AppState,
  dropzoneState: InitialPageState['dropzoneState']
): AppState {
  return withInitialPageState(state, { dropzoneState });
}

export function resetInitialPage(state: AppState): AppState {
  return {
    ...state,
    initialPage: {
      uploadedFile: null,
      uploadedFileName: '',
      libraryPath: '',
      isFileValid: false,
      isPathValid: false,
      canProceed: false,
      dropzoneState: 'idle',
    },
  };
}

// Results page state management
export function withResultsPageState(
  state: AppState,
  updates: Partial<ResultsPageState>
): AppState {
  const currentResultsPage = state.resultsPage || {
    isAccordionExpanded: false,
    selectedRecordId: null,
  };

  return {
    ...state,
    resultsPage: {
      ...currentResultsPage,
      ...updates,
    },
  };
}

export function toggleAccordion(state: AppState): AppState {
  const currentExpanded = state.resultsPage?.isAccordionExpanded || false;
  return withResultsPageState(state, { isAccordionExpanded: !currentExpanded });
}

// Error-specific transitions
export function withFileError(state: AppState, message: string): AppState {
  return {
    ...withStatus(withPhase(state, 'error-file'), {
      message,
      severity: 'error',
      title: 'File Error',
      workflowStage: 'recovery',
    }),
    errorType: 'file',
  };
}

export function withPdfPathError(state: AppState, message: string): AppState {
  return {
    ...withStatus(withPhase(state, 'error-pdf-path'), {
      message,
      severity: 'error',
      title: 'PDF Path Error',
      workflowStage: 'recovery',
    }),
    errorType: 'pdf-path',
  };
}

export function withGenericError(state: AppState, message: string): AppState {
  return {
    ...withStatus(withPhase(state, 'error-generic'), {
      message,
      severity: 'error',
      title: 'An Error Occurred',
      workflowStage: 'recovery',
    }),
    errorType: 'generic',
  };
}
```

### 1.3 Modified State Transitions

Update existing functions in `src/app/state.ts`:

```typescript
// Modify withExportResult to transition to results-page
export function withExportResult(state: AppState, result: ExportResult): AppState {
  return {
    ...state,
    downloadErrorMessage: undefined,
    exportResult: result,
    isItemModalOpen: false,
    phase: 'results-page',  // Changed from 'conversion-complete'
    resultsPage: {
      isAccordionExpanded: false,
      selectedRecordId: null,
    },
  };
}

// Modify clearExportResult to return to initial-page
export function clearExportResult(state: AppState): AppState {
  const {
    exportResult: _removed,
    selectedInputLabel: _selectedInputLabel,
    ...rest
  } = state;

  return {
    ...rest,
    downloadErrorMessage: undefined,
    isItemModalOpen: false,
    phase: 'initial-page',  // Changed from 'selecting-input'
    initialPage: resetInitialPage(rest).initialPage,
  };
}
```

---

## Phase 2: Controller Changes

### 2.1 Modified Controller Interface

Update `src/app/controller.ts`:

```typescript
interface Controller {
  // NEW: Initial page handlers
  handleFileDrop: (file: File) => void;
  handleFileSelect: (file: File) => void;
  handleRemoveFile: () => void;
  handleLibraryPathInput: (path: string) => void;
  handleDropZoneDragEnter: () => void;
  handleDropZoneDragLeave: () => void;
  handleDropZoneDrop: (file: File) => void;

  // MODIFIED: Renamed from handleConvert
  handleCreateXml: () => Promise<void>;

  // Existing handlers (kept)
  handleDownload: () => void;
  handleConvertAnother: () => void;
  handleRetry: () => void;

  // NEW: Results page handlers
  handleAccordionToggle: () => void;
}
```

### 2.2 Updated Controller Implementation

Add to `createController()` in `src/app/controller.ts`:

```typescript
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
    // NEW: Initial page handlers
    handleFileDrop(file: File) {
      if (!file.name.endsWith('.zip')) {
        updateState((currentState) =>
          withDropzoneState(
            withFileError(currentState, 'Please upload a valid .zip file'),
            'error'
          )
        );
        return;
      }

      updateState((currentState) =>
        withDropzoneState(
          withUploadedFile(currentState, file),
          'success'
        )
      );
    },

    handleFileSelect(file: File) {
      this.handleFileDrop(file);
    },

    handleRemoveFile() {
      updateState((currentState) =>
        withDropzoneState(
          withUploadedFile(currentState, null),
          'idle'
        )
      );

      // Reset file input
      const fileInput = root.querySelector<HTMLInputElement>('#zip-file-input');
      if (fileInput) {
        fileInput.value = '';
      }
    },

    handleLibraryPathInput(path: string) {
      updateState((currentState) => withLibraryPath(currentState, path));
    },

    handleDropZoneDragEnter() {
      updateState((currentState) =>
        withDropzoneState(currentState, 'drag-active')
      );
    },

    handleDropZoneDragLeave() {
      updateState((currentState) =>
        withDropzoneState(currentState, 'idle')
      );
    },

    handleDropZoneDrop(file: File) {
      this.handleFileDrop(file);
      updateState((currentState) =>
        withDropzoneState(currentState, 'success')
      );
    },

    // MODIFIED: Renamed from handleDirectoryPick/handleFileSelect logic
    async handleCreateXml() {
      const currentState = getState();

      if (!currentState.initialPage?.canProceed) {
        return;
      }

      const file = currentState.initialPage.uploadedFile;
      if (!file) {
        updateState((s) => withFileError(s, 'No file selected'));
        return;
      }

      updateState((currentState) => withStatus(
        withPhase(currentState, 'converting'),
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
        // Determine error type
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown conversion error';

        if (errorMessage.includes('PDF') || errorMessage.includes('path')) {
          updateState((currentState) => withStatus(
            withPhase(currentState, 'error-pdf-path'),
            buildPdfPathErrorStatus(errorMessage),
          ));
        } else if (errorMessage.includes('ZIP') || errorMessage.includes('file')) {
          updateState((currentState) => withStatus(
            withPhase(currentState, 'error-file'),
            buildFileErrorStatus(errorMessage),
          ));
        } else {
          updateState((currentState) => withStatus(
            withNote(
              withPhase(currentState, 'error-generic'),
              errorMessage
            ),
            buildConversionFailureStatus('zip'),
          ));
        }
      }
    },

    // EXISTING: Keep as-is
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

    // NEW: Results page handlers
    handleAccordionToggle() {
      updateState((currentState) => toggleAccordion(currentState));
    },
  };
}
```

### 2.3 New Status Presets

Add to `src/app/status-presets.ts`:

```typescript
export function buildFileErrorStatus(message: string): StatusDescriptor {
  return {
    message,
    severity: 'error',
    title: 'File Error',
    workflowStage: 'recovery',
    recoveryGuidance: [
      {
        label: 'Check file format',
        detail: 'Ensure the file is a valid .zip archive containing an EndNote library.',
      },
      {
        label: 'Try again',
        detail: 'Select a different file or create a new ZIP of your library.',
      },
    ],
  };
}

export function buildPdfPathErrorStatus(message: string): StatusDescriptor {
  return {
    message,
    severity: 'error',
    title: 'PDF Path Error',
    workflowStage: 'recovery',
    recoveryGuidance: [
      {
        label: 'Verify the path',
        detail: 'Check that the library path matches your actual file system location.',
      },
      {
        label: 'Leave it optional',
        detail: 'You can leave the path blank to convert without PDF links.',
      },
    ],
  };
}
```

### 2.4 Updated Event Attachment

Modify `attachController()` in `src/app/controller.ts`:

```typescript
function attachController(root: HTMLElement, controller: Controller): void {
  // REMOVE: Old directory picker attachment (no longer needed)

  // MODIFY: File input handler
  const fileInput = root.querySelector<HTMLInputElement>('#zip-file-input');
  fileInput?.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      controller.handleFileSelect(file);
    }
  });

  // NEW: Remove file button
  const removeFileButton = root.querySelector<HTMLButtonElement>('#remove-file-button');
  removeFileButton?.addEventListener('click', () => controller.handleRemoveFile());

  // MODIFY: Library path input
  const libraryPathInput = root.querySelector<HTMLInputElement>('#library-path-input');
  libraryPathInput?.addEventListener('input', (event) => {
    controller.handleLibraryPathInput((event.target as HTMLInputElement).value);
  });

  // NEW: Create XML button
  const createXmlButton = root.querySelector<HTMLButtonElement>('#create-xml-button');
  createXmlButton?.addEventListener('click', () => controller.handleCreateXml());

  // MODIFY: Dropzone handlers (updated state management)
  const dropZone = root.querySelector<HTMLElement>('#zip-dropzone');
  if (dropZone) {
    dropZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        root.querySelector<HTMLInputElement>('#zip-file-input')?.click();
      }
    });

    dropZone.addEventListener('dragenter', (event) => {
      event.preventDefault();
      controller.handleDropZoneDragEnter();
    });

    dropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
    });

    dropZone.addEventListener('dragleave', (event) => {
      if (event.currentTarget === event.target) {
        controller.handleDropZoneDragLeave();
      }
    });

    dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        controller.handleDropZoneDrop(file);
      }
    });
  }

  // KEEP: Download and convert another buttons
  const downloadButton = root.querySelector<HTMLButtonElement>('#download-button');
  downloadButton?.addEventListener('click', () => controller.handleDownload());

  const convertAnotherButton = root.querySelector<HTMLButtonElement>('#convert-another-button');
  convertAnotherButton?.addEventListener('click', () => controller.handleConvertAnother());

  // KEEP: Retry button
  const retryButton = root.querySelector<HTMLButtonElement>('#retry-button');
  retryButton?.addEventListener('click', () => controller.handleRetry());

  // NEW: Accordion toggle
  const accordionToggle = root.querySelector<HTMLElement>('#accordion-toggle');
  accordionToggle?.addEventListener('click', () => controller.handleAccordionToggle());
}
```

---

## Phase 3: View Rendering Changes

### 3.1 New View Sections Structure

Create new file `src/app/initial-page.ts`:

```typescript
import type { AppState } from './state';
import { escapeHtml } from './view-helpers';

export function renderInitialPage(state: AppState): string {
  const initialPage = state.initialPage;

  if (!initialPage) {
    return renderErrorState('Initial page state not initialized');
  }

  const {
    uploadedFileName,
    libraryPath,
    isFileValid,
    isPathValid,
    canProceed,
    dropzoneState,
  } = initialPage;

  return `
    <main class="shell initial-page" id="main-content" tabindex="-1">
      <div class="hero-card">
        <h1 class="hero-title">Convert EndNote Library to XML</h1>
        <p class="hero-subtitle">
          Upload your EndNote library ZIP and enter the library path to generate Zotero-compatible XML.
        </p>
      </div>

      <div class="task-card">
        ${renderDropzone(dropzoneState, uploadedFileName)}
        ${renderLibraryPathInput(libraryPath)}
        ${renderCreateXmlButton(canProceed)}
      </div>
    </main>
  `;
}

function renderDropzone(
  state: 'idle' | 'drag-active' | 'error' | 'success',
  fileName: string
): string {
  const stateClass = `dropzone--${state}`;

  if (state === 'success') {
    return `
      <div class="dropzone ${stateClass}" id="zip-dropzone" tabindex="0" role="button" aria-label="File uploaded">
        <div class="dropzone-content">
          <span class="dropzone-icon dropzone-icon--success">✓</span>
          <div class="dropzone-text">
            <span class="dropzone-filename">${escapeHtml(fileName)}</span>
            <span class="dropzone-status">File uploaded successfully</span>
          </div>
          <button id="remove-file-button" class="dropzone-remove" type="button" aria-label="Remove file">
            ×
          </button>
        </div>
        <input type="file" id="zip-file-input" accept=".zip" class="file-input" />
      </div>
      <div class="alternate-option">
        <span class="alternate-option-text">or choose a different file</span>
        <button class="button button--secondary" type="button" onclick="document.getElementById('zip-file-input').click()">
          Choose ZIP file
        </button>
      </div>
    `;
  }

  if (state === 'error') {
    return `
      <div class="dropzone ${stateClass}" id="zip-dropzone" tabindex="0" role="button" aria-label="Upload ZIP file">
        <div class="dropzone-content">
          <span class="dropzone-icon dropzone-icon--error">✕</span>
          <div class="dropzone-text">
            <span class="dropzone-title">Upload Error</span>
            <span class="dropzone-status">Please upload a valid .zip file</span>
          </div>
        </div>
        <input type="file" id="zip-file-input" accept=".zip" class="file-input" />
      </div>
    `;
  }

  // Default: idle or drag-active
  return `
    <div class="dropzone ${stateClass}" id="zip-dropzone" tabindex="0" role="button"
         aria-label="Upload EndNote library ZIP file">
      <div class="dropzone-content">
        <span class="dropzone-icon">📁</span>
        <div class="dropzone-text">
          <span class="dropzone-title">Drop your EndNote library ZIP here</span>
          <span class="dropzone-subtitle">or click to browse</span>
        </div>
      </div>
      <input type="file" id="zip-file-input" accept=".zip" class="file-input" />
    </div>
  `;
}

function renderLibraryPathInput(value: string): string {
  return `
    <div class="input-group">
      <label class="input-label" for="library-path-input">
        Library path on your device
      </label>
      <p class="input-help">
        Enter the path to your EndNote library folder. This helps link PDFs in the exported XML.
      </p>
      <input
        id="library-path-input"
        class="text-input"
        type="text"
        value="${escapeHtml(value)}"
        placeholder="e.g., /Users/me/Documents or C:\\Users\\me\\Documents\\MyLibrary"
        spellcheck="false"
        autocomplete="off"
      />
    </div>
  `;
}

function renderCreateXmlButton(enabled: boolean): string {
  if (!enabled) {
    return `
      <div class="button-container">
        <button
          id="create-xml-button"
          class="button button--primary button--full button--disabled"
          type="button"
          disabled
        >
          Create XML file
        </button>
        <span class="button-helper">
          Please select a ZIP file and library path first
        </span>
      </div>
    `;
  }

  return `
    <div class="button-container">
      <button
        id="create-xml-button"
        class="button button--primary button--full"
        type="button"
      >
        Create XML file
      </button>
    </div>
  `;
}

function renderErrorState(message: string): string {
  return `
    <main class="shell error-page" id="main-content" tabindex="-1">
      <div class="error-card">
        <h1>Error</h1>
        <p>${escapeHtml(message)}</p>
        <button id="retry-button" class="button button--primary" type="button">
          Start over
        </button>
      </div>
    </main>
  `;
}
```

Create new file `src/app/results-page.ts`:

```typescript
import type { AppState } from './state';
import { escapeHtml, renderAttachmentIndicator } from './view-helpers';

export function renderResultsPage(state: AppState): string {
  const result = state.exportResult;
  const isExpanded = state.resultsPage?.isAccordionExpanded || false;

  if (!result) {
    return renderErrorState('No export result available');
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
    <main class="shell results-page" id="main-content" tabindex="-1">
      <!-- Success Header -->
      <div class="success-header">
        <span class="status-chip status-chip--success">Success</span>
        <p class="success-message">
          Your library has been successfully processed! Download the XML & import it in Zotero.
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button id="download-button" class="button button--primary" type="button">
          <span class="button-icon">⬇</span>
          Download Zotero XML
        </button>
        <button id="convert-another-button" class="button button--secondary" type="button">
          <span class="button-icon">↺</span>
          Convert Another Library
        </button>
      </div>

      <!-- Export Summary -->
      <section class="summary-section">
        <h2 class="section-title">Export Summary</h2>
        <div class="summary-grid">
          ${renderSummaryItem('Library', libraryDisplayName)}
          ${renderSummaryItem('Exported records', String(recordCount))}
          ${renderSummaryItem('Input rows', String(inputRecordCount))}
          ${renderSummaryItem('Skipped rows', String(skippedRecordCount))}
          ${renderSummaryItem('Attachments detected', String(attachmentCount))}
          ${renderSummaryItem('PDF links exported', String(linkedAttachmentCount))}
          ${renderSummaryItem('References with attachments', String(referenceCountWithAttachments))}
          ${renderSummaryItem('Missing payloads', String(missingAttachmentPayloadCount))}
        </div>
      </section>

      <!-- Warnings -->
      ${warnings.length > 0 ? renderWarnings(warnings) : renderNoWarnings()}

      <!-- Records Accordion -->
      <section class="accordion-section">
        <button
          id="accordion-toggle"
          class="accordion-header"
          aria-expanded="${isExpanded}"
          aria-controls="accordion-content"
        >
          <div class="accordion-header-left">
            <h3 class="accordion-title">Exported Records</h3>
            <span class="accordion-subtitle">${items.length} records</span>
          </div>
          <span class="accordion-icon">${isExpanded ? '▼' : '▶'}</span>
        </button>
        <div
          id="accordion-content"
          class="accordion-content"
          ${isExpanded ? '' : 'hidden'}
        >
          ${renderRecordsTable(items)}
        </div>
      </section>
    </main>
  `;
}

function renderSummaryItem(label: string, value: string): string {
  return `
    <div class="summary-item">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
}

function renderNoWarnings(): string {
  return `
    <section class="warnings-section">
      <h2 class="section-title">Warnings</h2>
      <div class="warning-box warning-box--empty">
        <span>No warnings detected</span>
      </div>
    </section>
  `;
}

function renderWarnings(warnings: any[]): string {
  return `
    <section class="warnings-section">
      <h2 class="section-title">Warnings</h2>
      <div class="warning-box">
        <p>${warnings.length} warning(s) detected during conversion.</p>
        <ul>
          ${warnings.map((w) => `<li>${escapeHtml(w.message)}</li>`).join('')}
        </ul>
      </div>
    </section>
  `;
}

function renderRecordsTable(items: any[]): string {
  return `
    <table class="records-table" role="table">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Title</th>
          <th scope="col">Year</th>
          <th scope="col">PDF</th>
          <th scope="col">DOI</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => `
          <tr>
            <td class="table-cell-number">${index + 1}</td>
            <td class="table-cell-title">
              <div class="title-primary">${escapeHtml(item.title)}</div>
              <div class="title-secondary">Record #${item.recordId}</div>
            </td>
            <td class="table-cell-year">${escapeHtml(item.year)}</td>
            <td class="table-cell-pdf">${renderAttachmentIndicator(item.hasPdfAttachment)}</td>
            <td class="table-cell-doi">
              ${item.doiUrl
                ? `<a href="${escapeHtml(item.doiUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(item.doi)}</a>`
                : escapeHtml(item.doi)
              }
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderErrorState(message: string): string {
  return `
    <main class="shell error-page" id="main-content" tabindex="-1">
      <div class="error-card">
        <h1>Error</h1>
        <p>${escapeHtml(message)}</p>
        <button id="retry-button" class="button button--primary" type="button">
          Start over
        </button>
      </div>
    </main>
  `;
}
```

Create new file `src/app/error-pages.ts`:

```typescript
import type { AppState } from './state';
import { escapeHtml } from './view-helpers';

export function renderFileError(state: AppState): string {
  return renderErrorPage(
    'File Error',
    state.statusMessage,
    'The uploaded file could not be processed. Please check the file format and try again.',
    [
      { label: 'Check file format', detail: 'Ensure the file is a valid .zip archive' },
      { label: 'Try again', detail: 'Select a different file' },
    ]
  );
}

export function renderPdfPathError(state: AppState): string {
  return renderErrorPage(
    'PDF Path Error',
    state.statusMessage,
    'There was an issue with the provided library path.',
    [
      { label: 'Verify the path', detail: 'Check that the library path is correct' },
      { label: 'Leave it optional', detail: 'You can leave the path blank to convert without PDF links' },
    ]
  );
}

export function renderGenericError(state: AppState): string {
  return renderErrorPage(
    'An Error Occurred',
    state.statusMessage,
    'Something went wrong during conversion.',
    [
      { label: 'Try again', detail: 'Start over with a new conversion' },
    ]
  );
}

function renderErrorPage(
  title: string,
  message: string,
  description: string,
  guidance: Array<{ label: string; detail: string }>
): string {
  return `
    <main class="shell error-page" id="main-content" tabindex="-1">
      <div class="error-card">
        <span class="error-icon">⚠</span>
        <h1 class="error-title">${escapeHtml(title)}</h1>
        <p class="error-message">${escapeHtml(message)}</p>
        <p class="error-description">${escapeHtml(description)}</p>

        ${guidance.length > 0 ? `
          <div class="error-guidance">
            <h2>What to do</h2>
            <ul>
              ${guidance.map((g) => `
                <li>
                  <strong>${escapeHtml(g.label)}</strong>
                  <span>${escapeHtml(g.detail)}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        <button id="retry-button" class="button button--primary" type="button">
          Start Over
        </button>
      </div>
    </main>
  `;
}
```

### 3.2 Modified Main View Router

Update `renderAppView()` in `src/app/view-sections.ts`:

```typescript
export function renderAppView(state: AppState): string {
  // Route to appropriate page based on phase
  switch (state.phase) {
    case 'initial-page':
      return renderInitialPage(state);

    case 'results-page':
      return renderResultsPage(state);

    case 'error-file':
      return renderFileError(state);

    case 'error-pdf-path':
      return renderPdfPathError(state);

    case 'error-generic':
      return renderGenericError(state);

    case 'booting':
    case 'converting':
      // Keep existing loading views
      return `
        <main class="shell" id="main-content" tabindex="-1">
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            ${escapeHtml(state.statusLiveMessage)}
          </div>
          ${state.phase === 'booting' ? renderBootSection(state) : renderProgressSection(state)}
        </main>
      `;

    case 'unsupported-launch':
    case 'worker-error':
      // Keep existing error views
      return `
        <main class="shell" id="main-content" tabindex="-1">
          ${renderHeroSection(state)}
          <section class="shell__main">
            ${renderErrorSection(state)}
          </section>
        </main>
      `;

    default:
      // Fallback to initial page
      return renderInitialPage(state);
  }
}
```

---

## Phase 4: CSS Styling

### 4.1 Design System Variables

Update `src/styles.css` variables (additions):

```css
:root {
  /* Existing variables... */

  /* NEW: Page-specific colors */
  --color-success: #04a635;
  --color-success-bg: #e8f5e9;
  --color-error: #ed592f;
  --color-error-bg: #ffebee;
  --color-warning: #efbe00;
  --color-warning-bg: #fff8db;

  /* NEW: Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* NEW: Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

### 4.2 Initial Page Styles

Add to `src/styles.css`:

```css
/* Initial Page */
.initial-page {
  max-width: 781px;
  margin: 0 auto;
  padding: 48px;
}

.hero-card {
  background: var(--bg-surface);
  padding: 32px;
  margin-bottom: 24px;
}

.hero-title {
  color: var(--text-primary);
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 8px 0;
  font-family: 'Source Sans Pro', sans-serif;
}

.hero-subtitle {
  color: var(--text-secondary);
  font-size: 16px;
  margin: 0;
}

.task-card {
  background: var(--bg-soft);
  border: 1px solid var(--border-subtle);
  padding: 8px;
}

/* Dropzone */
.dropzone {
  background: var(--bg-surface);
  border: 2px dashed var(--cc-dark-slate-blue);
  border-radius: var(--radius-md);
  min-height: 259px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.dropzone:hover,
.dropzone--drag-active {
  border-color: var(--accent);
  background: #fff8f3;
}

.dropzone--success {
  border-style: solid;
  border-color: var(--color-success);
  background: var(--color-success-bg);
}

.dropzone--error {
  border-style: solid;
  border-color: var(--color-error);
  background: var(--color-error-bg);
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.dropzone-icon {
  font-size: 48px;
}

.dropzone-icon--success {
  color: var(--color-success);
}

.dropzone-icon--error {
  color: var(--color-error);
}

.dropzone-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dropzone-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.dropzone-subtitle {
  font-size: 14px;
  color: var(--text-muted);
}

.dropzone-filename {
  font-weight: 600;
  color: var(--text-primary);
}

.dropzone-status {
  font-size: 14px;
  color: var(--text-muted);
}

.dropzone-remove {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  font-size: 32px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropzone-remove:hover {
  color: var(--color-error);
}

.alternate-option {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: center;
}

.alternate-option-text {
  color: var(--text-muted);
  font-size: 14px;
}

/* Input Group */
.input-group {
  margin-top: 16px;
}

.input-label {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.input-help {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 8px 0;
}

.text-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: 16px;
  font-family: inherit;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.text-input:focus {
  outline: 3px solid var(--cc-dark-turquoise);
  outline-offset: 2px;
}

/* Button Container */
.button-container {
  margin-top: 16px;
}

.button--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg-muted);
  color: var(--text-muted);
}

.button-helper {
  display: block;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.button-icon {
  margin-right: 8px;
}
```

### 4.3 Results Page Styles

Add to `src/styles.css`:

```css
/* Results Page */
.results-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 48px;
}

/* Success Header */
.success-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.status-chip--success {
  background: var(--color-success);
  color: white;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.success-message {
  color: var(--text-primary);
  font-size: 14px;
  margin: 0;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

/* Sections */
.summary-section,
.warnings-section,
.accordion-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 2px 0;
}

/* Summary Grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  background: var(--bg-soft);
  border: 1px solid var(--border-subtle);
  padding: 2px;
}

.summary-item {
  background: var(--bg-surface);
  border: 1px solid transparent;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.summary-item strong {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
}

.summary-item span {
  font-size: 14px;
  color: var(--text-primary);
  overflow-wrap: anywhere;
  text-align: right;
}

/* Warnings */
.warning-box {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  padding: 16px 20px;
  border-radius: var(--radius-sm);
}

.warning-box--empty {
  color: var(--text-primary);
}

/* Accordion */
.accordion-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-soft);
  border: 1px solid var(--border-subtle);
  padding: 16px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: inherit;
}

.accordion-header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.accordion-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.accordion-subtitle {
  font-size: 14px;
  color: var(--text-muted);
}

.accordion-icon {
  color: var(--cc-dark-slate-blue);
  font-size: 18px;
  font-weight: 700;
}

.accordion-content {
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  border-top: none;
  overflow: hidden;
}

/* Records Table */
.records-table {
  width: 100%;
  border-collapse: collapse;
}

.records-table thead {
  background: var(--cc-dark-slate-blue);
  color: white;
}

.records-table th {
  padding: 10px;
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.records-table tbody tr {
  background: var(--bg-soft);
}

.records-table tbody tr:nth-child(even) {
  background: var(--bg-surface);
}

.records-table td {
  padding: 10px;
  border-top: 1px solid var(--border-subtle);
}

.table-cell-number {
  width: 50px;
  text-align: center;
}

.table-cell-title {
  width: auto;
}

.title-primary {
  font-weight: 600;
  color: var(--text-primary);
}

.title-secondary {
  font-size: 12px;
  color: var(--text-muted);
}

.table-cell-year {
  width: 80px;
}

.table-cell-pdf {
  width: 70px;
  text-align: center;
}

.table-cell-doi {
  width: 120px;
}
```

### 4.4 Error Page Styles

Add to `src/styles.css`:

```css
/* Error Pages */
.error-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 48px;
}

.error-card {
  background: var(--bg-surface);
  border: 2px solid var(--color-error);
  padding: 48px;
  text-align: center;
}

.error-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.error-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-error);
  margin: 0 0 16px 0;
}

.error-message {
  font-size: 18px;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.error-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 24px 0;
}

.error-guidance {
  text-align: left;
  background: var(--bg-soft);
  padding: 16px;
  border-radius: var(--radius-sm);
  margin-bottom: 24px;
}

.error-guidance h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px 0;
}

.error-guidance ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.error-guidance li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.error-guidance li:last-child {
  margin-bottom: 0;
}

.error-guidance strong {
  font-weight: 600;
  color: var(--text-primary);
}

.error-guidance span {
  font-size: 14px;
  color: var(--text-secondary);
}
```

---

## Phase 5: Implementation Checklist

### 5.1 File Changes Summary

**New Files to Create**:
1. `src/app/initial-page.ts` - Initial page view renderer
2. `src/app/results-page.ts` - Results page view renderer
3. `src/app/error-pages.ts` - Error page renderers

**Files to Modify**:
1. `src/app/state.ts` - Add new state types and updaters
2. `src/app/controller.ts` - Update controller with new handlers
3. `src/app/status-presets.ts` - Add new error status presets
4. `src/app/view-sections.ts` - Update main view router
5. `src/styles.css` - Add new page styles

### 5.2 Implementation Order

**Week 1, Day 1: State & Controller**
- [ ] Add new state types to `state.ts`
- [ ] Implement new state updaters
- [ ] Update controller with new handlers
- [ ] Add new status presets

**Week 1, Day 2: Views**
- [ ] Create `initial-page.ts` with dropzone, input, and button
- [ ] Create `results-page.ts` with summary, warnings, and accordion
- [ ] Create `error-pages.ts` with three error variants
- [ ] Update `view-sections.ts` to route to new views

**Week 1, Day 3: Styling**
- [ ] Add initial page styles to `styles.css`
- [ ] Add results page styles to `styles.css`
- [ ] Add error page styles to `styles.css`
- [ ] Test responsive behavior

**Week 2, Day 1: Testing & Refinement**
- [ ] Test file upload flow
- [ ] Test error states
- [ ] Test accordion toggle
- [ ] Test "convert another" flow
- [ ] Fix any bugs
- [ ] Accessibility audit

### 5.3 Testing Checklist

**Initial Page**:
- [ ] Dropzone shows drag state on dragenter
- [ ] Dropzone accepts valid .zip files
- [ ] Dropzone rejects non-.zip files
- [ ] Uploaded file shows success state with filename
- [ ] Remove file button clears file input
- [ ] Library path input accepts text
- [ ] "Create XML" button disabled when file/path missing
- [ ] "Create XML" button enabled when both present
- [ ] Clicking "Create XML" starts conversion

**Results Page**:
- [ ] Success header displays correctly
- [ ] Download button downloads XML
- [ ] "Convert another" returns to initial page
- [ ] Summary grid displays all 8 metrics
- [ ] Warnings section shows when warnings exist
- [ ] "No warnings" message shows when no warnings
- [ ] Accordion collapsed by default
- [ ] Accordion expands on click
- [ ] Accordion collapses on second click
- [ ] Table displays all records correctly
- [ ] PDF indicators show correct state
- [ ] DOI links are clickable

**Error Pages**:
- [ ] File error page displays for file issues
- [ ] PDF path error page displays for path issues
- [ ] Generic error page displays for other errors
- [ ] All error pages show relevant guidance
- [ ] "Start over" button returns to initial page

**Accessibility**:
- [ ] All interactive elements are keyboard accessible
- [ ] Focus management works correctly
- [ ] Screen reader announcements work
- [ ] Color contrast meets WCAG AA
- [ ] Touch targets are at least 44×44px

---

## Phase 6: Migration Strategy

### 6.1 Backwards Compatibility

**No breaking changes** to:
- Core conversion logic (`src/core/`)
- Worker implementation (`src/worker/`)
- Export result types (`src/types/`)
- Browser adapters (`src/adapters/`)

**Changes limited to**:
- UI layer only (`src/app/`)
- CSS styling (`src/styles.css`)

### 6.2 Rollback Plan

If issues arise:
1. Keep existing view code in `view-sections.ts` as `render*Legacy()` functions
2. Add feature flag to switch between old/new UI
3. Roll back by changing `renderAppView()` to use legacy functions

### 6.3 Progressive Enhancement

**Minimum Viable Implementation**:
1. Implement state changes first (no UI)
2. Add basic view routing (static pages)
3. Add interactive elements (file upload, accordion)
4. Polish styling and animations

**Future Enhancements** (out of scope for now):
- Loading spinner during conversion
- Progress bar for large files
- Animations between pages
- Record detail view (modal/expandable rows)
- Partial success handling

---

## Phase 7: Edge Cases & Validation

### 7.1 File Upload Validation

**Already handled** (existing code):
- File type validation (`.zip` only)
- File read errors

**New validation needed**:
- File size limits (if any)
- ZIP structure validation
- Corrupted ZIP handling

### 7.2 Library Path Validation

**Current approach**: No validation (user's responsibility)

**Consider adding**:
- Basic format validation (e.g., not empty)
- OS-specific path format hints
- Warning for obvious invalid formats

### 7.3 Error Classification

**Current error handling**:
```typescript
// Distinguish error types by message content
if (errorMessage.includes('PDF') || errorMessage.includes('path')) {
  // PDF path error
} else if (errorMessage.includes('ZIP') || errorMessage.includes('file')) {
  // File error
} else {
  // Generic error
}
```

**Improvement**: Add error codes to `buildConversionFailureStatus()`:
```typescript
export type ConversionErrorCode =
  | 'FILE_INVALID'
  | 'FILE_CORRUPTED'
  | 'PATH_INVALID'
  | 'PATH_INACCESSIBLE'
  | 'CONVERSION_FAILED'
  | 'UNKNOWN';
```

---

## Phase 8: Performance Considerations

### 8.1 Rendering Performance

**Current approach**: Re-render entire app on state change

**Optimization needed**:
- Only re-render changed sections
- Use event delegation for dynamic elements
- Debounce rapid input events (e.g., path input)

### 8.2 Bundle Size

**Current size**: ~150KB (minified)

**Expected increase**: +20-30KB (new views, styles)

**Mitigation**:
- Reuse existing helper functions
- Share styles across pages
- Avoid duplicate icon fonts

---

## Phase 9: Accessibility Requirements

### 9.1 Keyboard Navigation

**Must support**:
- Tab through all interactive elements
- Enter/Space to activate buttons and dropzone
- Escape to close modals (if any)
- Arrow keys for accordion (future enhancement)

### 9.2 Screen Reader Support

**Must announce**:
- Page changes (initial → results → error)
- File upload success/failure
- Accordion state changes
- Form validation errors

**Implementation**:
```html
<div aria-live="polite" class="sr-only">
  ${escapeHtml(state.statusLiveMessage)}
</div>
```

### 9.3 Focus Management

**Requirements**:
- Focus moves to new page on navigation
- Focus returns to triggering element on "back"
- No focus traps
- Visible focus indicators

---

## Phase 10: Browser Compatibility

### 10.1 Target Browsers

**Current support**:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**No changes required** - new UI uses same APIs

### 10.2 Feature Detection

**Already handled** (existing code):
- Web Worker support
- File System Access API
- Drag-and-drop API

---

## Conclusion

This implementation plan provides a complete roadmap for converting the current single-page UI to the new two-page flow design. The changes are focused on the UI layer only, minimizing risk to the core conversion logic.

**Estimated timeline**: 3-4 days
**Risk level**: Low (isolated to UI layer)
**Test coverage**: Existing unit tests pass; new E2E tests needed

**Next steps**:
1. Review and approve this plan
2. Create feature branch
3. Implement in phases (state → views → styles)
4. Test thoroughly
5. Deploy and monitor
