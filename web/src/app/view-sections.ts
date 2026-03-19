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
    <main class="shell" id="main-content" tabindex="-1">
      <div
        class="sr-only"
        data-live-region="status"
        aria-live="${state.statusSeverity === 'error' ? 'assertive' : 'polite'}"
        aria-atomic="true"
      >
        ${escapeHtml(state.statusLiveMessage)}
      </div>
      ${renderHeroSection(state)}
      <section class="shell__main shell__main--stack">
        ${renderMainSection(state)}
      </section>
    </main>
  `;
}

function renderHeroSection(state: AppState): string {
  return `
    <section class="hero card">
      <div class="hero__layout">
        <h1>Convert EndNote Library to XML</h1>
        <p class="lede">
          Convert your EndNote library to Zotero XML in your browser. Upload a library ZIP,
          review the exported records, then download the XML for import into Zotero.
        </p>
        <div class="status-panel">
          <div class="status-row" role="region" aria-labelledby="current-status-title" aria-describedby="current-status-message current-status-severity">
            <div class="status-row__copy">
              <span class="status-chip status-chip--${escapeHtml(state.statusSeverity)}" id="current-status-severity">
                ${escapeHtml(SEVERITY_LABELS[state.statusSeverity])}
              </span>
              <p class="status-row__title" id="current-status-title">${escapeHtml(state.statusTitle)}</p>
              <p class="status-text" id="current-status-message">${escapeHtml(state.statusMessage)}</p>
            </div>
          </div>
          <p class="support-note">${escapeHtml(buildSupportNote(state))}</p>
          ${state.recoveryGuidance.length > 0 ? renderRecoveryGuidance(state) : ''}
        </div>
      </div>
    </section>
    <section class="task-card card">
      ${renderPrimaryTaskPanel(state)}
    </section>
  `;
}

function renderPrimaryTaskPanel(state: AppState): string {
  switch (state.phase) {
    case 'booting':
      return `
        <div class="task-card__header">
          <h2 id="primary-task-title" tabindex="-1">Getting ready…</h2>
          <p class="section-subcopy">Loading the browser workspace and file-processing worker.</p>
        </div>
        <div class="task-card__state task-card__state--progress">
          <div class="spinner" aria-hidden="true"></div>
          <div>
            <p class="task-card__state-title">Initialising</p>
            <p class="task-card__state-copy">${escapeHtml(state.statusMessage)}</p>
          </div>
        </div>
      `;
    case 'converting':
      return `
        <div class="task-card__header">
          <h2 id="primary-task-title" tabindex="-1">Converting your library</h2>
          <p class="section-subcopy">Keep this tab open while the ZIP is processed in memory.</p>
        </div>
        <div class="task-card__state task-card__state--progress">
          <div class="spinner" aria-hidden="true"></div>
          <div>
            <p class="task-card__state-title">${escapeHtml(state.selectedInputLabel || 'Selected ZIP')}</p>
            <p class="task-card__state-copy">${escapeHtml(state.statusMessage)}</p>
          </div>
        </div>
      `;
    case 'conversion-complete':
      return `
        <div class="task-card__header">
          <h2 id="primary-task-title" tabindex="-1">Review, then download</h2>
          <p class="section-subcopy">The review workspace below includes the export summary, warnings, and item table.</p>
        </div>
        <div class="task-card__state">
          <div>
            <p class="task-card__state-title">Results are ready</p>
            <p class="task-card__state-copy">Use the actions below the summary to download the XML or start another conversion.</p>
          </div>
        </div>
      `;
    case 'unsupported-launch':
    case 'worker-error':
    case 'conversion-error':
      return `
        <div class="task-card__header">
          <h2 id="primary-task-title" tabindex="-1">Something went wrong</h2>
          <p class="section-subcopy">Check the recovery details below, then start over when you are ready.</p>
        </div>
        <div class="task-card__state">
          <div>
            <p class="task-card__state-title">Recovery steps are below</p>
            <p class="task-card__state-copy">The error section includes notes and a reset action.</p>
          </div>
        </div>
      `;
    case 'selecting-input':
    default:
      return renderInputSelectionPanel(state);
  }
}

function renderInputSelectionPanel(state: AppState): string {
  const queuedZipFile = state.pendingFile;
  const hasAttachmentBasePath = state.attachmentBasePath.trim().length > 0;
  const canCreateXml = Boolean(queuedZipFile) && hasAttachmentBasePath;
  const dropzoneState = getDropzoneState(state);
  const fileSummary = queuedZipFile
    ? `${escapeHtml(queuedZipFile.name)} · ${escapeHtml(formatFileSize(queuedZipFile.size))}`
    : 'Drop your library ZIP here, or click to browse.';
  const dropzoneTitle = dropzoneState === 'ready'
    ? 'ZIP ready to convert'
    : dropzoneState === 'invalid'
      ? 'That file type is not supported'
      : 'Select your library ZIP';
  const dropzoneMessage = dropzoneState === 'ready'
    ? 'Your ZIP is queued. Add the library path below to include PDF links in the exported XML.'
    : dropzoneState === 'invalid'
      ? escapeHtml(state.statusMessage)
      : 'Accepted ZIPs can contain an .enl library with its matching .Data folder or packaged .enlp contents.';

  return `
    <div class="task-card__header task-card__header--intake">
      <div>
        <p class="section-eyebrow">Browser-local conversion</p>
        <h2 id="primary-task-title" tabindex="-1">Queue an EndNote library ZIP</h2>
      </div>
      <p class="section-subcopy">Upload the library archive, add the original library location for PDF links, then create the Zotero XML when everything looks right.</p>
    </div>
    <div class="intake-panel">
      <input
        type="file"
        id="zip-file-input"
        accept=".zip"
        class="file-input"
      />
      <label
        for="zip-file-input"
        id="zip-dropzone"
        class="upload-dropzone upload-dropzone--${dropzoneState}"
        tabindex="0"
        aria-describedby="zip-dropzone-copy zip-dropzone-help${dropzoneState === 'invalid' ? ' zip-dropzone-error' : ''}"
      >
        <span class="upload-dropzone__art" aria-hidden="true"></span>
        <span class="upload-dropzone__copy">
          <span class="upload-dropzone__eyebrow">Library ZIP</span>
          <span class="upload-dropzone__title" id="zip-dropzone-copy">${dropzoneTitle}</span>
          <span class="upload-dropzone__message">Drag and drop to replace the file at any time.</span>
        </span>
        <span class="upload-dropzone__cta">Browse for ZIP</span>
        <span class="upload-dropzone__summary">${fileSummary}</span>
        <span class="upload-dropzone__help" id="zip-dropzone-help">Accepted ZIPs can contain an <code>.enl</code> library with its matching <code>.Data</code> folder or packaged <code>.enlp</code> contents.</span>
        ${dropzoneState === 'invalid'
          ? `<span class="upload-dropzone__error" id="zip-dropzone-error" role="alert">${escapeHtml(state.statusMessage)}</span>`
          : `<span class="upload-dropzone__status">${dropzoneMessage}</span>`
        }
        ${queuedZipFile
          ? `
            <span class="queued-file" aria-live="polite">
              <span class="queued-file__meta">
                <span class="queued-file__label">Queued file</span>
                <span class="queued-file__name">${escapeHtml(queuedZipFile.name)}</span>
              </span>
              <span class="queued-file__size tabular-cell">${escapeHtml(formatFileSize(queuedZipFile.size))}</span>
            </span>
          `
          : ''
        }
      </label>
      <div class="intake-panel__details">
        <div class="field-group field-group--subdued intake-field-group">
          <label class="field-label" for="attachment-base-path">Library location for PDF links</label>
          <p class="field-help" id="attachment-base-path-help">
            Provide the source library path used to resolve PDF links. Use the containing folder for <code>.enl</code> + <code>.Data</code> libraries, or the full package path for <code>.enlp</code>.
          </p>
          <div class="library-path-control">
            <input
              id="attachment-base-path"
              class="text-input"
              type="text"
              value="${escapeHtml(state.attachmentBasePath)}"
              spellcheck="false"
              autocomplete="off"
              aria-describedby="attachment-base-path-help attachment-base-path-note create-xml-hint"
              placeholder="/Users/me/Documents or C:\\Users\\me\\Documents\\MyLibrary.enlp"
            />
            <button
              class="button button--secondary button--path-browser"
              type="button"
              disabled
              aria-disabled="true"
            >
              Browse to select library folder
            </button>
          </div>
          <p class="button-note" id="attachment-base-path-note">
            Browsers can’t fill this path automatically, so paste the original library folder or package path here.
          </p>
        </div>
        <div class="intake-actions" aria-label="ZIP conversion actions">
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
            class="button button--primary"
            type="button"
            ${canCreateXml ? '' : 'disabled'}
          >
            Create XML
          </button>
        </div>
        <p class="intake-hint" id="create-xml-hint">
          Create XML is enabled after a ZIP is queued and the library location is provided.
        </p>
      </div>
    </div>
    ${state.runtime.directoryIntake.available
      ? `
        <div class="alternate-intake alternate-intake--redesign" role="note">
          <p class="alternate-intake__copy">Folder selection is also available in this browser if you prefer not to create a ZIP first.</p>
          <button id="directory-picker-button" class="button button--secondary" type="button">
            Choose library folder instead
          </button>
        </div>
      `
      : ''
    }
  `;
}

function renderMainSection(state: AppState): string {
  switch (state.phase) {
    case 'booting':
      return renderBootSection(state);
    case 'selecting-input':
      return renderInputSelectionSection();
    case 'converting':
      return renderProgressSection(state);
    case 'conversion-complete':
      return renderResultSection(state);
    case 'unsupported-launch':
    case 'worker-error':
    case 'conversion-error':
      return renderErrorSection(state);
    default:
      return '';
  }
}

function renderBootSection(state: AppState): string {
  return `
    <section class="card section-stack results-shell">
      <div class="section-heading section-heading--stack">
        <div>
          <h2>Preparing review workspace</h2>
          <p class="section-subcopy">${escapeHtml(state.statusMessage)}</p>
        </div>
      </div>
      <div class="progress-indicator">
        <div class="spinner" aria-hidden="true"></div>
        <div class="progress-indicator__copy">
          <p class="progress-indicator__title">Loading browser tools and worker support.</p>
        </div>
      </div>
    </section>
  `;
}

function renderInputSelectionSection(): string {
  return `
    <section class="card section-stack results-shell results-shell--placeholder review-placeholder" aria-labelledby="review-placeholder-title">
      <div class="section-heading section-heading--stack review-placeholder__heading">
        <div>
          <p class="section-eyebrow">Preview workspace</p>
          <h2 id="review-placeholder-title">Results will appear here</h2>
          <p class="section-subcopy">After conversion, this workspace shows the export summary, warnings, and a detailed record table before you download the XML.</p>
        </div>
      </div>
      <div class="review-placeholder__grid" aria-hidden="true">
        <div class="review-placeholder__card"></div>
        <div class="review-placeholder__card review-placeholder__card--tall"></div>
        <div class="review-placeholder__card review-placeholder__card--wide"></div>
      </div>
    </section>
  `;
}

function renderProgressSection(state: AppState): string {
  return `
    <section class="card section-stack results-shell">
      <div class="section-heading section-heading--stack">
        <div>
          <h2>Converting…</h2>
          <p class="section-subcopy">${escapeHtml(state.statusMessage)}</p>
        </div>
      </div>
      <div class="progress-indicator">
        <div class="spinner" aria-hidden="true"></div>
        <div class="progress-indicator__copy">
          <p class="progress-indicator__title">Processing <strong>${escapeHtml(state.selectedInputLabel || 'selected input')}</strong> and generating Zotero XML.</p>
        </div>
      </div>
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

  const summaryItems = [
    { label: 'Library', value: escapeHtml(libraryDisplayName) },
    { label: 'Exported records', value: String(recordCount) },
    { label: 'Input rows', value: String(inputRecordCount) },
    { label: 'Skipped rows', value: String(skippedRecordCount) },
    { label: 'Attachments detected', value: String(attachmentCount) },
    { label: 'PDF links exported', value: String(linkedAttachmentCount) },
    { label: 'References with attachments', value: String(referenceCountWithAttachments) },
    { label: 'Missing payloads', value: String(missingAttachmentPayloadCount) },
    { label: 'Attachment handling', value: escapeHtml(attachmentMode) },
  ];

  return `
    <section class="card section-stack results-shell results-shell--success review-workspace" aria-labelledby="review-workspace-title">
      <div class="section-heading review-workspace__header review-workspace__header--redesign">
        <div>
          <p class="section-eyebrow">Conversion complete</p>
          <h2 id="review-workspace-title" tabindex="-1">Export ready for review</h2>
          <p class="section-subcopy">${escapeHtml(state.statusMessage)}</p>
        </div>
        <span class="result-badge result-badge--${escapeHtml(state.statusSeverity)}">${escapeHtml(SEVERITY_LABELS[state.statusSeverity])}</span>
      </div>
      <div class="review-actions review-actions--top">
        <div class="review-actions__buttons">
          <button id="download-button" class="button button--primary button--full" type="button">
            Download Zotero XML
          </button>
          <button id="convert-another-button" class="button button--secondary button--full" type="button">
            Convert another library
          </button>
        </div>
        <div class="review-actions__copy">
          ${state.downloadErrorMessage
            ? `<p class="inline-error" role="alert">${escapeHtml(state.downloadErrorMessage)}</p>`
            : ''
          }
          ${state.recoveryGuidance.length > 0 ? renderRecoveryGuidance(state, 'card') : ''}
        </div>
      </div>
      <div class="result-summary-grid" role="list" aria-label="Export summary">
        ${summaryItems.map((item) => `
          <article class="summary-stat" role="listitem">
            <p class="summary-stat__label">${item.label}</p>
            <p class="summary-stat__value">${item.value}</p>
          </article>
        `).join('')}
        ${attachmentBaseLibraryPath
          ? `
            <article class="summary-stat summary-stat--wide" role="listitem">
              <p class="summary-stat__label">Library location used</p>
              <p class="summary-stat__value summary-stat__value--path"><code>${escapeHtml(attachmentBaseLibraryPath)}</code></p>
            </article>
          `
          : ''
        }
      </div>
      ${renderWarningsSection(warnings)}
      <details class="records-accordion" open>
        <summary class="records-accordion__summary">
          <span class="records-accordion__summary-copy">
            <span class="records-accordion__summary-title">Exported Records</span>
            <span class="records-accordion__summary-text">Inspect titles, authors, attachment status, and DOI links before download.</span>
          </span>
          <span class="soft-chip">${items.length} exported item${items.length === 1 ? '' : 's'}</span>
        </summary>
        <div class="records-accordion__content">
          <div class="review-workspace__table-wrap">
            <table class="items-table items-table--inline" aria-describedby="review-workspace-description">
              <caption class="items-table__caption">
                Exported items from ${escapeHtml(libraryDisplayName)}.
              </caption>
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
          <p id="review-workspace-description" class="review-workspace__description">
            Review exported records, attachment status, and DOI links before downloading the XML.
          </p>
        </div>
      </details>
    </section>
  `;
}

function renderErrorSection(state: AppState): string {
  return `
    <section class="card card--error section-stack results-shell error-shell error-shell--centered" aria-labelledby="recovery-title">
      <div class="section-heading section-heading--stack error-shell__header error-shell__header--centered">
        <span class="result-badge result-badge--error">Action required</span>
        <div>
          <p class="section-eyebrow">Recovery</p>
          <h2 id="recovery-title" tabindex="-1">Something went wrong</h2>
          <p class="section-subcopy">Review the specific issue below, then start over when you are ready.</p>
        </div>
      </div>
      <div class="error-summary" aria-labelledby="error-summary-title" role="group">
        <p class="error-summary__title" id="error-summary-title">${escapeHtml(state.statusTitle)}</p>
        <p class="error-summary__message">${escapeHtml(state.statusMessage)}</p>
      </div>
      ${state.recoveryGuidance.length > 0 ? renderRecoveryGuidance(state, 'card') : ''}
      ${state.notes.length > 0
        ? `
          <div class="error-notes" aria-labelledby="error-notes-title">
            <h3 id="error-notes-title">Additional details</h3>
            <ul class="error-list">
              ${state.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
            </ul>
          </div>
        `
        : ''
      }
      <div class="error-shell__actions">
        <button id="retry-button" class="button button--primary" type="button">
          Start over
        </button>
      </div>
    </section>
  `;
}

function renderWarningsSection(warnings: ExportWarning[]): string {
  if (warnings.length === 0) {
    return `
      <div class="warnings warnings--redesign warnings--empty" role="region" aria-labelledby="warnings-title">
        <div class="section-heading section-heading--stack section-heading--tight">
          <div>
            <h3 id="warnings-title">Warnings</h3>
            <p class="section-subcopy">Warnings do not block XML download, but they are worth checking before import.</p>
          </div>
        </div>
        <p class="warnings__empty-state">No warnings detected.</p>
      </div>
    `;
  }

  const warningSummaries = summarizeWarnings(warnings);

  return `
    <div class="warnings warnings--redesign" role="region" aria-labelledby="warnings-title">
      <div class="section-heading section-heading--stack section-heading--tight">
        <div>
          <h3 id="warnings-title">Warnings</h3>
          <p class="section-subcopy">Warnings do not block XML download, but they are worth checking before import.</p>
        </div>
      </div>
      <ul class="warning-summary-list">
        ${warningSummaries.map((warningSummary) => `
          <li class="warning-summary">
            <div class="warning-summary__header">
              <p class="warning-summary__title">${escapeHtml(warningSummary.title)}</p>
              <span class="soft-chip">${warningSummary.count} item${warningSummary.count === 1 ? '' : 's'}</span>
            </div>
            <p>${escapeHtml(warningSummary.summary)}</p>
            <p class="warning-summary__guidance"><strong>What to do</strong><span>${escapeHtml(warningSummary.guidance)}</span></p>
            <ul class="warning-list">
              ${warningSummary.messages.map((message) => `<li><code>${escapeHtml(warningSummary.code)}</code> ${escapeHtml(message)}</li>`).join('')}
            </ul>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function renderRecoveryGuidance(state: AppState, tone: 'hero' | 'card' = 'hero'): string {
  return `
    <div class="recovery-panel recovery-panel--${tone}">
      <p class="recovery-panel__title">Recovery guidance</p>
      <ul class="recovery-list">
        ${state.recoveryGuidance.map((item) => `
          <li>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.detail)}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function buildSupportNote(state: AppState): string {
  if (state.workerStatus === 'error') {
    return 'This workspace requires a served page and dedicated worker support.';
  }

  return state.runtime.directoryIntake.available
    ? 'Runs locally in your browser. ZIP upload is recommended, and folder selection is also available here.'
    : 'Runs locally in your browser. Upload a ZIP export of your library to begin.';
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
