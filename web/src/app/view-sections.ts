import type { ExportWarning } from '../types/export-result';
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
  const fileInputText = state.selectedInputLabel
    ? `Current selection: ${escapeHtml(state.selectedInputLabel)}`
    : 'Drop your library ZIP here, or click to browse.';

  return `
    <div class="task-card__header">
      <h2 id="primary-task-title" tabindex="-1">Start with a library ZIP</h2>
      <p class="section-subcopy">ZIP upload is the primary workflow. Review results inline before downloading the XML.</p>
    </div>
    <div class="file-input-wrapper file-input-wrapper--task-card">
      <input
        type="file"
        id="zip-file-input"
        accept=".zip"
        class="file-input"
      />
      <label for="zip-file-input" id="zip-dropzone" class="file-input-label file-input-label--task-card" tabindex="0">
        <span class="file-input-kicker">Upload EndNote library ZIP</span>
        <span class="file-input-button">Choose ZIP file</span>
        <span class="file-input-text">${fileInputText}</span>
        <span class="file-input-help">Accepted ZIPs can contain an <code>.enl</code> library with its matching <code>.Data</code> folder or packaged <code>.enlp</code> contents.</span>
      </label>
    </div>
    <div class="field-group field-group--subdued">
      <label class="field-label" for="attachment-base-path">Optional library location for PDF links</label>
      <p class="field-help">
        Add this only if you want the exported XML to include local PDF file links.
        Use the containing folder for <code>.enl</code> + <code>.Data</code> libraries, or the full package path for <code>.enlp</code>.
      </p>
      <input
        id="attachment-base-path"
        class="text-input"
        type="text"
        value="${escapeHtml(state.attachmentBasePath)}"
        spellcheck="false"
        autocomplete="off"
        placeholder="/Users/me/Documents or C:\\Users\\me\\Documents\\MyLibrary.enlp"
      />
    </div>
    ${state.runtime.directoryIntake.available
      ? `
        <div class="alternate-intake" role="note">
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
    <section class="card section-stack results-shell results-shell--placeholder" aria-labelledby="review-placeholder-title">
      <div class="section-heading section-heading--stack">
        <div>
          <h2 id="review-placeholder-title">Review workspace</h2>
          <p class="section-subcopy">After conversion, this area will show the summary, any warnings, and the exported records table.</p>
        </div>
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

  return `
    <section class="card section-stack results-shell" aria-labelledby="review-workspace-title">
      <div class="section-heading review-workspace__header">
        <div>
          <h2 id="review-workspace-title" tabindex="-1">Review workspace</h2>
          <p class="section-subcopy">${escapeHtml(state.statusMessage)}</p>
        </div>
        <span class="status-chip status-chip--${escapeHtml(state.statusSeverity)}">${escapeHtml(SEVERITY_LABELS[state.statusSeverity])}</span>
      </div>
      <div class="review-workspace__top">
        <div class="success-summary">
          <p><strong>Library</strong><span>${escapeHtml(libraryDisplayName)}</span></p>
          <p><strong>Exported records</strong><span>${recordCount}</span></p>
          <p><strong>Input rows</strong><span>${inputRecordCount}</span></p>
          <p><strong>Skipped rows</strong><span>${skippedRecordCount}</span></p>
          <p><strong>Attachments detected</strong><span>${attachmentCount}</span></p>
          <p><strong>PDF links exported</strong><span>${linkedAttachmentCount}</span></p>
          <p><strong>References with attachments</strong><span>${referenceCountWithAttachments}</span></p>
          <p><strong>Missing payloads</strong><span>${missingAttachmentPayloadCount}</span></p>
          <p><strong>Attachment handling</strong><span>${escapeHtml(attachmentMode)}</span></p>
          ${attachmentBaseLibraryPath
            ? `<p class="success-summary__wide"><strong>Library location used</strong><code>${escapeHtml(attachmentBaseLibraryPath)}</code></p>`
            : ''
          }
        </div>
        <div class="review-actions">
          <button id="download-button" class="button button--primary button--full" type="button">
            Download Zotero XML
          </button>
          <button id="convert-another-button" class="button button--secondary button--full" type="button">
            Convert another library
          </button>
          ${state.downloadErrorMessage
            ? `<p class="inline-error" role="alert">${escapeHtml(state.downloadErrorMessage)}</p>`
            : ''
          }
          ${state.recoveryGuidance.length > 0 ? renderRecoveryGuidance(state, 'card') : ''}
        </div>
      </div>
      ${warnings.length > 0 ? renderWarnings(warnings) : ''}
      <div class="review-workspace__table-card">
        <div class="review-workspace__table-header">
          <div>
            <h3>${escapeHtml(libraryDisplayName)}</h3>
            <p class="review-workspace__copy">
              Review exported records, attachment status, and DOI links before downloading the XML.
            </p>
          </div>
          <span class="soft-chip">${items.length} exported item${items.length === 1 ? '' : 's'}</span>
        </div>
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
        <p id="review-workspace-description" class="review-workspace__description">
          Review exported records, attachment status, and DOI links before downloading the XML.
        </p>
      </div>
    </section>
  `;
}

function renderErrorSection(state: AppState): string {
  return `
    <section class="card card--error section-stack results-shell">
      <div class="section-heading section-heading--stack">
        <div>
          <h2 id="recovery-title" tabindex="-1">Something went wrong</h2>
          <p class="section-subcopy">${escapeHtml(state.statusMessage)}</p>
        </div>
      </div>
      ${state.recoveryGuidance.length > 0 ? renderRecoveryGuidance(state, 'card') : ''}
      ${state.notes.length > 0
        ? `<ul class="error-list">
            ${state.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
          </ul>`
        : ''
      }
      <button id="retry-button" class="button button--primary" type="button">
        Start over
      </button>
    </section>
  `;
}

function renderWarnings(warnings: ExportWarning[]): string {
  const warningSummaries = summarizeWarnings(warnings);

  return `
    <div class="warnings" role="region" aria-labelledby="warnings-title">
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
