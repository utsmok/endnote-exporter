import type { ExportWarning } from '../types/export-result';
import {
  formatFileSize,
} from './download';
import {
  type AppState,
  type StatusSeverity,
} from './state';
import {
  escapeHtml,
  renderAttachmentIndicator,
  summarizeWarnings,
} from './view-helpers';

const SEVERITY_LABELS: Record<StatusSeverity, string> = {
  error: 'Action required',
  informational: 'Info',
  success: 'Ready',
  warning: 'Review required',
};

export function renderAppView(state: AppState): string {
  return `
    <main class="app-main-wrapper" id="main-content" tabindex="-1">
      <div
        class="sr-only"
        data-live-region="status"
        aria-live="${state.statusSeverity === 'error' ? 'assertive' : 'polite'}"
        aria-atomic="true"
      >
        ${escapeHtml(state.statusLiveMessage)}
      </div>
      <div class="mockup-container">
        ${renderMainSection(state)}
      </div>
    </main>
  `;
}

function renderMainSection(state: AppState): string {
  switch (state.phase) {
    case 'booting':
      return renderLoadingSection({
        heading: 'Preparing browser-local conversion',
        id: 'primary-task-title',
        message: state.statusMessage,
      });
    case 'converting':
      return renderLoadingSection({
        heading: `Creating XML for ${state.selectedInputLabel || 'your library'}`,
        id: 'primary-task-title',
        message: state.statusMessage,
      });
    case 'conversion-complete':
      return renderResultSection(state);
    case 'unsupported-launch':
    case 'worker-error':
    case 'conversion-error':
      return renderErrorSection(state);
    case 'selecting-input':
    default:
      return renderInputSelectionPanel(state);
  }
}

function renderLoadingSection({
  heading,
  id,
  message,
}: {
  heading: string;
  id: string;
  message: string;
}): string {
  return `
    <section class="main-section" aria-labelledby="${escapeHtml(id)}">
      ${renderPageHeader({
        title: 'Convert EndNote Library to XML',
        copy: '',
        headingId: id,
        kicker: 'Browser-local conversion',
      })}
      <div class="loading-state" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <div class="loading-state__copy">
          <h2>${escapeHtml(heading)}</h2>
          <p>${escapeHtml(message)}</p>
        </div>
      </div>
    </section>
  `;
}

function renderInputSelectionPanel(state: AppState): string {
  const queuedZipFile = state.pendingFile;
  const hasAttachmentBasePath = state.attachmentBasePath.trim().length > 0;
  const canCreateXml = Boolean(queuedZipFile) && hasAttachmentBasePath;
  const canBrowseLibraryFolder = state.runtime.directoryIntake.available;
  const dropzoneState = getDropzoneState(state);
  const fileSummary = queuedZipFile
    ? `${escapeHtml(queuedZipFile.name)} · ${escapeHtml(formatFileSize(queuedZipFile.size))}`
    : 'Drag and drop an EndNote library ZIP here, or click to browse.';

  return `
    <section class="main-section" aria-labelledby="primary-task-title">
      ${renderPageHeader({
        title: 'Convert EndNote Library to XML',
        copy: '',
        headingId: 'primary-task-title',
        kicker: 'Browser-local conversion',
      })}
      <input
        type="file"
        id="zip-file-input"
        accept=".zip"
        class="file-input"
      />
      <label
        for="zip-file-input"
        id="zip-dropzone"
        class="dropzone dropzone--${dropzoneState}"
        tabindex="0"
        aria-describedby="zip-dropzone-help${dropzoneState === 'invalid' ? ' zip-dropzone-error' : ''}"
      >
        <span class="dropzone__label">EndNote library ZIP</span>
        <span class="dropzone__headline">${queuedZipFile ? 'ZIP queued and ready' : 'Select your library ZIP'}</span>
        <span class="dropzone__copy">${fileSummary}</span>
        <span class="dropzone__cta">Choose ZIP</span>
        <span class="dropzone__help" id="zip-dropzone-help">
          ZIP should contain:
          <ul>
           <li>the <code>.enl</code> library file with its matching <code>.Data</code> folder, OR:</li>
           <li>a single <code>.enlp</code> package (often used by MacOS).</li>
          </ul>
          <details class="dropzone__help-details">
            <summary class="dropzone__help-toggle">How to create the ZIP file on Windows</summary>
            <div class="dropzone__help-image">
              <img src="${import.meta.env.BASE_URL}create_zip_windows.png" alt="Instructions for creating a ZIP file from an EndNote library on Windows: Right-click the .enl file and .Data folder, select 'Send to > Compressed (zipped) folder'" />
            </div>
          </details>
        </span>
        ${dropzoneState === 'invalid'
          ? `<span class="dropzone__error" id="zip-dropzone-error" role="alert">${escapeHtml(state.statusMessage)}</span>`
          : ''
        }
      </label>
      <div class="library-location-container">
        <label class="field-label" for="attachment-base-path">Library location for PDF links</label>
        <div class="path-input-group">
          <input
            id="attachment-base-path"
            class="text-input"
            type="text"
            value="${escapeHtml(state.attachmentBasePath)}"
            spellcheck="false"
            autocomplete="off"
            placeholder="/Users/me/Documents/MyLibrary.enlp"
            aria-describedby="attachment-base-path-note submit-help"
          />
          <button
            id="attachment-base-path-browse-button"
            class="button button--secondary"
            type="button"
            ${canBrowseLibraryFolder ? '' : 'disabled'}
            aria-disabled="${canBrowseLibraryFolder ? 'false' : 'true'}"
          >
            Browse to select library folder
          </button>
        </div>
        <p class="path-note" id="attachment-base-path-note">
          Paste the original folder or package path here. Browsers cannot discover native file-system paths automatically.
        </p>
      </div>
      <div class="submit-container" aria-label="ZIP conversion actions">
        <button
          id="remove-file-button"
          class="button button--secondary"
          type="button"
          ${queuedZipFile ? '' : 'disabled'}
          aria-label="Remove queued ZIP file"
        >
          Remove file
        </button>
        <button
          id="create-xml-button"
          class="${canCreateXml ? 'button button--success' : 'button button--disabled'}"
          type="button"
          ${canCreateXml ? '' : 'disabled'}
          aria-disabled="${canCreateXml ? 'false' : 'true'}"
        >
          Create XML
        </button>
      </div>
      <p class="submit-help" id="submit-help" style="display: ${canCreateXml ? 'none' : 'block'};">
        Select a .zip & provide the location to enable the button & proceed.
      </p>
      ${state.runtime.directoryIntake.available
        ? `
          <div class="directory-picker-row">
            <p>Instead of a .zip file, you can also move the .enl file and the .Data folder to a new folder on your computer, and select it here.</p>
            <button id="directory-picker-button" class="button button--secondary" type="button">
              Use folder instead of .zip
            </button>
          </div>
        `
        : ''
      }
    </section>
  `;
}

function renderResultSection(state: AppState): string {
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

  const summaryItems: Array<{ label: string; value: string }> = [
    { label: 'Library', value: escapeHtml(libraryDisplayName) },
    { label: 'Exported records', value: escapeHtml(String(recordCount)) },
    { label: 'Input rows', value: escapeHtml(String(inputRecordCount)) },
    { label: 'Skipped rows', value: escapeHtml(String(skippedRecordCount)) },
    { label: 'Attachments detected', value: escapeHtml(String(attachmentCount)) },
    { label: 'PDF links exported', value: escapeHtml(String(linkedAttachmentCount)) },
    { label: 'References with attachments', value: escapeHtml(String(referenceCountWithAttachments)) },
    { label: 'Missing payloads', value: escapeHtml(String(missingAttachmentPayloadCount)) },
    { label: 'Attachment handling', value: escapeHtml(attachmentMode) },
  ];

  if (attachmentBaseLibraryPath) {
    summaryItems.push({
      label: 'Library location used',
      value: `<code>${escapeHtml(attachmentBaseLibraryPath)}</code>`,
    });
  }

  return `
    <section class="main-section" aria-labelledby="review-workspace-title">
      ${renderPageHeader({
        title: 'Convert EndNote Library to XML',
        copy: '',
        headingId: 'page-title',
        kicker: 'Browser-local conversion',
      })}
      <div class="results-header">
        <div>
          <h2 id="review-workspace-title" tabindex="-1">${escapeHtml(state.statusTitle)}</h2>
          <p>${escapeHtml(state.statusMessage)}</p>
        </div>
        <span class="status-pill status-pill--${escapeHtml(state.statusSeverity)}">${escapeHtml(SEVERITY_LABELS[state.statusSeverity])}</span>
      </div>
      <div class="results-actions">
        <button id="download-button" class="button button--success" type="button">
          Download Zotero XML
        </button>
        <button id="convert-another-button" class="button button--secondary" type="button">
          Convert another library
        </button>
        ${state.downloadErrorMessage
          ? `<p class="inline-error" role="alert">${escapeHtml(state.downloadErrorMessage)}</p>`
          : ''
        }
      </div>
      <table class="summary-table" aria-label="Export summary">
        <tbody>
          ${summaryItems.map((item) => `
            <tr>
              <th scope="row">${item.label}</th>
              <td>${item.value}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${renderWarningsSection(warnings)}
      <details class="records-accordion" open>
        <summary class="accordion-header">
          <span class="accordion-header__copy">
            <strong>Exported records</strong>
            <span>${items.length} item${items.length === 1 ? '' : 's'} ready for review</span>
          </span>
          <span>Toggle</span>
        </summary>
        <div class="accordion-body">
          <div class="table-scroll">
            <table class="records-table">
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
                      <div class="record-title-cell">
                        <span class="record-title">${escapeHtml(item.title)}</span>
                        <span class="record-meta">Record #${escapeHtml(String(item.recordId))}</span>
                      </div>
                    </td>
                    <td>${escapeHtml(item.author)}</td>
                    <td>${escapeHtml(item.journal)}</td>
                    <td class="tabular-cell">${escapeHtml(item.year)}</td>
                    <td>${renderAttachmentIndicator(item.hasPdfAttachment)}</td>
                    <td>${renderSafeDoiValue(item.doi, item.doiUrl)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </section>
  `;
}

function renderErrorSection(state: AppState): string {
  const firstRecoveryLabel = state.recoveryGuidance[0]?.label ?? 'Start over';

  return `
    <section class="error-container" aria-labelledby="page-title">
      ${renderPageHeader({
        centered: true,
        title: 'Convert EndNote Library to XML',
        copy: '',
        headingId: 'page-title',
        kicker: 'Browser-local conversion',
      })}
      <div class="error-box">
        <p class="error-box__label">${escapeHtml(firstRecoveryLabel)}</p>
        <h2 id="recovery-title" tabindex="-1">${escapeHtml(state.statusTitle)}</h2>
        <p class="error-box__message">${escapeHtml(state.statusMessage)}</p>
        ${state.notes.length > 0
          ? `
            <ul class="error-notes">
              ${state.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
            </ul>
          `
          : ''
        }
        <button id="retry-button" class="button button--success" type="button">
          Start over
        </button>
      </div>
    </section>
  `;
}

function renderWarningsSection(warnings: ExportWarning[]): string {
  const warningSummaries = summarizeWarnings(warnings);

  return `
    <section class="warnings-box" aria-labelledby="warnings-title">
      <div>
        <h3 id="warnings-title">Warnings</h3>
        <p>Warnings do not block the XML download, but they are worth checking before import.</p>
      </div>
      ${warningSummaries.length === 0
        ? '<p class="warnings-box__empty">No warnings detected</p>'
        : `
          <ul class="warning-summary-list">
            ${warningSummaries.map((warningSummary) => `
              <li class="warning-summary">
                <div class="warning-summary__header">
                  <strong>${escapeHtml(warningSummary.title)}</strong>
                  <span>${warningSummary.count} item${warningSummary.count === 1 ? '' : 's'}</span>
                </div>
                <p>${escapeHtml(warningSummary.summary)}</p>
                <p><strong>What to do:</strong> ${escapeHtml(warningSummary.guidance)}</p>
                <ul>
                  ${warningSummary.messages.map((message) => `
                    <li><code>${escapeHtml(warningSummary.code)}</code> ${escapeHtml(message)}</li>
                  `).join('')}
                </ul>
              </li>
            `).join('')}
          </ul>
        `
      }
    </section>
  `;
}

function renderPageHeader({
  centered = false,
  copy,
  headingId,
  kicker,
  title,
}: {
  centered?: boolean;
  copy: string;
  headingId: string;
  kicker: string;
  title: string;
}): string {
  const focusableHeading = headingId === 'primary-task-title'
    ? ' tabindex="-1"'
    : '';

  return `
    <header class="page-header${centered ? ' page-header--centered' : ''}">
      <p class="page-kicker">${escapeHtml(kicker)}</p>
      <h1 id="${escapeHtml(headingId)}"${focusableHeading}>${escapeHtml(title)}</h1>
      <p class="page-copy">${escapeHtml(copy)}</p>
    </header>
  `;
}

function getDropzoneState(state: AppState): 'default' | 'invalid' | 'ready' {
  if (state.pendingFile) {
    return 'ready';
  }

  if (state.pendingFileError === 'invalid-type') {
    return 'invalid';
  }

  return 'default';
}

function renderSafeDoiValue(doi: string, doiUrl?: string): string {
  const safeUrl = getSafeExternalUrl(doiUrl);
  const safeDoi = doi.trim().length > 0 ? escapeHtml(doi) : '—';

  if (!safeUrl) {
    return safeDoi;
  }

  return `<a class="doi-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer noopener">${safeDoi}</a>`;
}

function getSafeExternalUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}
