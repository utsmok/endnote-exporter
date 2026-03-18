import type { ExportWarning } from '../types/export-result';
import {
  type AppState,
  type StatusSeverity,
  type ThemePreference,
  type WorkflowStage,
} from './state';
import {
  escapeHtml,
  getSeverityPresentation,
  renderAttachmentIndicator,
  renderTooltip,
  summarizeWarnings,
} from './view-helpers';

const SEVERITY_LABELS: Record<StatusSeverity, string> = {
  error: 'Action required',
  informational: 'Info',
  success: 'Ready',
  warning: 'Review required',
};

const WORKFLOW_STAGE_LABELS: Record<WorkflowStage, string> = {
  boot: 'Boot',
  conversion: 'Conversion',
  intake: 'Intake',
  preparation: 'Preparation',
  recovery: 'Recovery',
  review: 'Review',
};

const WORKFLOW_STRIP_STEPS: Array<{
  detail: string;
  key: 'intake' | 'preparation' | 'conversion' | 'review';
  label: string;
}> = [
  {
    detail: 'Upload your EndNote library as a ZIP file.',
    key: 'intake',
    label: '1 · Upload',
  },
  {
    detail: 'Your library structure and attachments are checked.',
    key: 'preparation',
    label: '2 · Prepare',
  },
  {
    detail: 'The XML for Zotero is generated in the browser.',
    key: 'conversion',
    label: '3 · Convert',
  },
  {
    detail: 'Review your exported records, then download the XML.',
    key: 'review',
    label: '4 · Review',
  },
];

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
        ${renderWorkflowStrip(state)}
        ${renderTrustSection(state)}
        ${renderMainSection(state)}
      </section>
    </main>
  `;
}

function renderHeroSection(state: AppState): string {
  return `
    <section class="hero card">
      <div class="hero__layout">
        <div class="hero__column hero__column--intro">
          <div class="hero__header">
            <div class="hero__copy">
              <p class="eyebrow">EndNote Exporter</p>
              <h1>Convert EndNote Library to XML</h1>
              <p class="lede">
                Convert your EndNote library to Zotero XML — right in your browser, with nothing uploaded to a server. Upload your library ZIP, review the exported records, then download the XML to import into Zotero.
              </p>
            </div>
            ${renderThemeToggle(state)}
          </div>
          <div class="status-panel">
            <div class="status-row" role="region" aria-labelledby="current-status-title" aria-describedby="current-status-message current-status-severity">
              <div class="status-row__copy">
                <div class="chip-row">
                  <span class="status-chip status-chip--${escapeHtml(state.statusSeverity)}" id="current-status-severity">${escapeHtml(SEVERITY_LABELS[state.statusSeverity])}</span>
                  <span class="stage-pill">Stage · ${escapeHtml(WORKFLOW_STAGE_LABELS[state.workflowStage])}</span>
                </div>
                <p class="status-row__title" id="current-status-title">${escapeHtml(state.statusTitle)}</p>
                <p class="status-text" id="current-status-message">${escapeHtml(state.statusMessage)}</p>
              </div>
              ${renderTooltip(
                'worker-status-help',
                'How does it work?',
                buildWorkerTooltip(state),
              )}
            </div>
            ${state.recoveryGuidance.length > 0 ? renderRecoveryGuidance(state) : ''}
            ${renderStatusDetails(state)}
          </div>
        </div>
        <aside class="hero__column hero__column--task">
          <div class="task-card">
            ${renderPrimaryTaskPanel(state)}
          </div>
        </aside>
      </div>
    </section>
  `;
}

function renderPrimaryTaskPanel(state: AppState): string {
  switch (state.phase) {
    case 'booting':
      return `
        <div class="task-card__header">
          <p class="eyebrow">Starting up</p>
          <h2 id="primary-task-title" tabindex="-1">Getting ready…</h2>
          <p class="instruction section-subcopy">
            Loading in the background. File upload will appear here once ready.
          </p>
        </div>
        <div class="task-card__state task-card__state--progress">
          <div class="spinner" aria-hidden="true"></div>
          <div>
            <p class="task-card__state-title">Initialising…</p>
            <p class="task-card__state-copy">${escapeHtml(state.statusMessage)}</p>
          </div>
        </div>
      `;
    case 'converting':
      return `
        <div class="task-card__header">
          <p class="eyebrow">Primary task</p>
          <h2 id="primary-task-title" tabindex="-1">Converting your library</h2>
          <p class="instruction section-subcopy">
            Your library is being processed. Results will appear in the review area below.
          </p>
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
          <p class="eyebrow">Primary task complete</p>
          <h2 id="primary-task-title" tabindex="-1">Review, then download</h2>
          <p class="instruction section-subcopy">
            Check the results below, then download the XML when you're happy.
          </p>
        </div>
        <div class="task-card__state">
          <div>
            <p class="task-card__state-title">Your results are ready below</p>
            <p class="task-card__state-copy">
              Download and reset buttons are in the results section below.
            </p>
          </div>
        </div>
      `;
    case 'unsupported-launch':
    case 'worker-error':
    case 'conversion-error':
      return `
        <div class="task-card__header">
          <p class="eyebrow">Recovery</p>
          <h2 id="primary-task-title" tabindex="-1">Something went wrong</h2>
          <p class="instruction section-subcopy">
            Check the error details below, then try again.
          </p>
        </div>
        <div class="task-card__state">
          <div>
            <p class="task-card__state-title">Use the Reset button below</p>
            <p class="task-card__state-copy">
              Error details and the reset button are in the section below.
            </p>
          </div>
        </div>
      `;
    case 'selecting-input':
    default:
      return renderInputSelectionPanel(state);
  }
}

function renderInputSelectionPanel(state: AppState): string {
  const directorySection = state.runtime.directoryIntake.available
    ? `
      <div class="secondary-option-card">
        <div class="section-heading section-heading--tight">
          <div>
            <div class="section-heading__title">
              <p class="enhancement-eyebrow">Folder upload</p>
              ${renderTooltip(
                'directory-intake-help',
                'About folder upload',
                'Folder upload is only available in browsers that support the required folder picker feature.',
              )}
            </div>
            <p class="instruction section-subcopy">
              Use this to select your EndNote library folder directly instead of creating a ZIP.
            </p>
          </div>
          <span class="soft-chip">Experimental</span>
        </div>
        <button id="directory-picker-button" class="button button--secondary button--full" type="button">
          Choose library folder instead
        </button>
      </div>
    `
    : `
      <div class="secondary-option-card secondary-option-card--muted">
        <div class="section-heading section-heading--tight">
          <div>
            <div class="section-heading__title">
              <p class="enhancement-eyebrow">Folder upload not available</p>
              ${renderTooltip(
                'directory-intake-unavailable-help',
                'About folder upload',
                'Folder upload requires browser features not available here. Use ZIP upload instead.',
              )}
            </div>
            <p class="instruction section-subcopy">
              Upload a ZIP file to proceed.
            </p>
          </div>
          <span class="soft-chip">Not available</span>
        </div>
      </div>
    `;

  const fileInputText = state.selectedInputLabel
    ? `Current selection: ${escapeHtml(state.selectedInputLabel)}`
    : 'Drop your library ZIP here, or click to browse.';

  return `
    <div class="task-card__header">
      <p class="eyebrow">Primary task</p>
      <h2 id="primary-task-title" tabindex="-1">Start with a library ZIP</h2>
      <p class="instruction section-subcopy">
        Upload your EndNote library as a ZIP, check the results, then download the Zotero XML.
      </p>
    </div>
    <div class="file-input-wrapper file-input-wrapper--task-card">
      <input
        type="file"
        id="zip-file-input"
        accept=".zip"
        class="file-input"
      />
      <label for="zip-file-input" id="zip-dropzone" class="file-input-label file-input-label--task-card" tabindex="0">
        <span class="file-input-button">Choose ZIP file</span>
        <span class="file-input-text">${fileInputText}</span>
      </label>
    </div>
    <div class="inline-meta-row" role="note">
      <span class="inline-meta-pill">Drag-and-drop supported</span>
      <span class="inline-meta-pill">Runs locally in your browser</span>
      ${renderTooltip(
        'zip-upload-help',
        'Accepted file formats',
        'Upload a ZIP that contains either an .enl library plus matching .Data folder or an .enlp package export.',
      )}
    </div>
    <div class="secondary-options">
      <div class="secondary-options__header">
        <div>
          <p class="secondary-options__eyebrow">Secondary options</p>
          <p class="instruction section-subcopy">
            These options are only needed in specific cases.
          </p>
        </div>
      </div>
      <div class="field-group field-group--subdued">
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
        <p class="field-help">
          Browsers can't access your file system paths automatically. Only add this if you want PDF links in the exported XML.
        </p>
        <details class="disclosure disclosure--compact">
          <summary>Accepted ZIP formats</summary>
          <div class="disclosure__content">
            <ul>
              <li><code>.zip</code> files containing <code>.enl</code> + <code>.Data</code></li>
              <li><code>.zip</code> files containing <code>.enlp</code>-equivalent packaged contents</li>
              <li>Use a containing folder path for <code>.enl</code> + <code>.Data</code> libraries, or the full package path for <code>.enlp</code></li>
            </ul>
          </div>
        </details>
      </div>
      ${directorySection}
    </div>
  `;
}

function renderWorkflowStrip(state: AppState): string {
  return `
    <section class="card workflow-strip" aria-labelledby="workflow-strip-title">
      <div class="section-heading section-heading--tight">
        <div>
          <div class="section-heading__title">
            <h2 id="workflow-strip-title">How it works</h2>
            <span class="soft-chip">${escapeHtml(state.statusTitle)}</span>
          </div>
          <p class="instruction section-subcopy">
            ${escapeHtml(state.statusMessage)}
          </p>
        </div>
      </div>
      <div class="workflow-strip__grid" role="list" aria-label="Conversion workflow stages">
        ${WORKFLOW_STRIP_STEPS.map((step, index) => renderWorkflowStepCard(state, step.label, step.detail, index, step.key)).join('')}
      </div>
    </section>
  `;
}

function renderWorkflowStepCard(
  state: AppState,
  label: string,
  detail: string,
  index: number,
  key: 'intake' | 'preparation' | 'conversion' | 'review',
): string {
  const stateClass = getWorkflowStepState(state, key, index);
  const badge = stateClass === 'complete'
    ? 'Done'
    : stateClass === 'active'
      ? 'Now'
      : 'Later';

  return `
    <article class="workflow-step workflow-step--${stateClass}" role="listitem">
      <div class="workflow-step__meta">
        <span class="workflow-step__badge">${badge}</span>
        <span class="workflow-step__label">${escapeHtml(label)}</span>
      </div>
      <p class="workflow-step__detail">${escapeHtml(detail)}</p>
    </article>
  `;
}

function getWorkflowStepState(
  state: AppState,
  key: 'intake' | 'preparation' | 'conversion' | 'review',
  index: number,
): 'active' | 'complete' | 'upcoming' {
  const order = ['intake', 'preparation', 'conversion', 'review'] as const;
  const defaultIndex = state.workflowStage === 'boot'
    ? 0
    : state.workflowStage === 'intake'
      ? 0
      : state.workflowStage === 'preparation'
        ? 1
        : state.workflowStage === 'conversion'
          ? 2
          : state.workflowStage === 'review'
            ? 3
            : 2;

  const targetIndex = order.indexOf(key);

  if (state.workflowStage === 'recovery') {
    if (state.phase === 'unsupported-launch' || state.phase === 'worker-error') {
      return index === 0 ? 'active' : 'upcoming';
    }

    if (state.phase === 'conversion-error') {
      if (targetIndex < 2) {
        return 'complete';
      }

      return index === 2 ? 'active' : 'upcoming';
    }
  }

  if (targetIndex < defaultIndex) {
    return 'complete';
  }

  if (targetIndex === defaultIndex) {
    return 'active';
  }

  return 'upcoming';
}

function renderTrustSection(state: AppState): string {
  const folderCapabilityCopy = state.runtime.directoryIntake.available
    ? 'Folder upload is also available in this browser, but ZIP upload is the recommended method.'
    : "Folder upload isn't available in this browser. Use ZIP upload instead.";

  return `
    <section class="card trust-grid" aria-labelledby="trust-grid-title">
      <div class="section-heading section-heading--tight">
        <div>
          <div class="section-heading__title">
            <h2 id="trust-grid-title">How your data is handled</h2>
            <span class="soft-chip">Privacy</span>
          </div>
          <p class="instruction section-subcopy">
            Your library files never leave your browser — conversion runs entirely on your device.
          </p>
        </div>
      </div>
      <div class="trust-grid__cards">
        <article class="trust-card">
          <p class="trust-card__eyebrow">Local only</p>
          <h3>Runs entirely in your browser</h3>
          <p>Your library files are never sent to a server. Conversion happens in your browser.</p>
        </article>
        <article class="trust-card">
          <p class="trust-card__eyebrow">File format</p>
          <h3>ZIP upload is the main method</h3>
          <p>${escapeHtml(folderCapabilityCopy)}</p>
        </article>
        <article class="trust-card">
          <p class="trust-card__eyebrow">PDF attachments</p>
          <h3>PDF links are opt-in</h3>
          <p>Attachment metadata is always preserved. To include local PDF links in the output, add your library path in the options — browsers can't access local paths automatically.</p>
        </article>
        <article class="trust-card">
          <p class="trust-card__eyebrow">Desktop app</p>
          <h3>Desktop exporter remains available</h3>
          <p>Use the Python desktop application if you need capabilities not available in the browser version.</p>
        </article>
      </div>
    </section>
  `;
}

function renderMainSection(state: AppState): string {
  switch (state.phase) {
    case 'booting':
      return renderBootSection(state);
    case 'selecting-input':
      return renderInputSelectionSection(state);
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
      <div class="section-heading section-heading--tight">
        <div>
          <div class="section-heading__title">
            <h2>Getting ready…</h2>
            <span class="soft-chip">Stage · ${escapeHtml(WORKFLOW_STAGE_LABELS[state.workflowStage])}</span>
          </div>
          <p class="instruction section-subcopy">${escapeHtml(state.statusMessage)}</p>
        </div>
      </div>
      <div class="progress-indicator">
        <div class="spinner" aria-hidden="true"></div>
        <div class="progress-indicator__copy">
          <p class="progress-indicator__stage">Starting up</p>
          <p class="progress-indicator__title">Loading…</p>
        </div>
      </div>
    </section>
  `;
}

function renderInputSelectionSection(state: AppState): string {
  return `
    <section class="card section-stack results-shell results-shell--placeholder">
      <div class="section-heading">
        <div>
          <div class="section-heading__title">
            <h2>Review area</h2>
            ${renderTooltip(
              'review-workspace-help',
              'What appears here',
              'The results area shows a summary, any warnings, and your exported records after conversion is complete.',
            )}
          </div>
          <p class="instruction section-subcopy">
            Convert a ZIP above to see your exported records here, including DOI links and PDF attachment status.
          </p>
        </div>
        <div class="chip-row">
          <span class="soft-chip">Inline review</span>
        </div>
      </div>
      <div class="workspace-empty-state">
        <div class="workspace-empty-state__card">
          <p class="workspace-empty-state__eyebrow">What lands here</p>
          <h3>Summary, warnings, and exported records</h3>
          <p>
            After conversion, this area shows the library summary, any warnings, and the full list of exported records.
          </p>
        </div>
        <div class="workspace-empty-state__card">
          <p class="workspace-empty-state__eyebrow">Why it matters</p>
          <h3>Check results before import</h3>
          <p>
            Check titles, authors, journals, years, DOI links, and PDF attachment status before downloading the XML.
          </p>
        </div>
      </div>
    </section>
  `;
}

function renderProgressSection(state: AppState): string {
  return `
    <section class="card section-stack results-shell">
      <div class="section-heading section-heading--tight">
        <div>
          <div class="section-heading__title">
            <h2>Converting…</h2>
            <span class="soft-chip">Stage · ${escapeHtml(WORKFLOW_STAGE_LABELS[state.workflowStage])}</span>
          </div>
          <p class="instruction section-subcopy">${escapeHtml(state.statusMessage)}</p>
        </div>
      </div>
      <div class="progress-indicator">
        <div class="spinner" aria-hidden="true"></div>
        <div class="progress-indicator__copy">
          <p class="progress-indicator__stage">In progress</p>
          <p class="progress-indicator__title">Processing <strong>${escapeHtml(state.selectedInputLabel || 'selected input')}</strong> — generating Zotero XML.</p>
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
      <div class="section-heading">
        <div>
          <div class="section-heading__title">
            <h2 id="review-workspace-title" tabindex="-1">Review workspace</h2>
            <span class="status-chip status-chip--${escapeHtml(state.statusSeverity)}">${escapeHtml(SEVERITY_LABELS[state.statusSeverity])}</span>
          </div>
          <p class="instruction section-subcopy">${escapeHtml(state.statusMessage)}</p>
        </div>
        <div class="chip-row">
          <span class="soft-chip">Stage · ${escapeHtml(WORKFLOW_STAGE_LABELS[state.workflowStage])}</span>
          <span class="soft-chip">${escapeHtml(attachmentMode)}</span>
        </div>
      </div>
      <div class="review-workspace__layout ${items.length >= 24 ? 'review-workspace__layout--dense' : ''}">
        <aside class="review-workspace__sidebar">
          <div class="success-summary">
            <p><strong>Library</strong>${escapeHtml(libraryDisplayName)}</p>
            <p><strong>Exported records</strong>${recordCount}</p>
            <p><strong>Input rows</strong>${inputRecordCount}</p>
            <p><strong>Skipped rows</strong>${skippedRecordCount}</p>
            <p><strong>Attachments detected</strong>${attachmentCount}</p>
            <p><strong>PDF links exported</strong>${linkedAttachmentCount}</p>
            <p><strong>References with attachments</strong>${referenceCountWithAttachments}</p>
            <p><strong>Missing payloads</strong>${missingAttachmentPayloadCount}</p>
            ${attachmentBaseLibraryPath
              ? `<p><strong>Library location used</strong><code>${escapeHtml(attachmentBaseLibraryPath)}</code></p>`
              : ''
            }
          </div>
          <div class="action-row action-row--stacked">
            <button id="download-button" class="button button--primary button--full" type="button">
              Download Zotero XML
            </button>
            <button id="convert-another-button" class="button button--secondary button--full" type="button">
              Convert another library
            </button>
          </div>
          ${state.downloadErrorMessage
            ? `<p class="inline-error" role="alert">${escapeHtml(state.downloadErrorMessage)}</p>`
            : ''
          }
          ${state.recoveryGuidance.length > 0 ? renderRecoveryGuidance(state, 'card') : ''}
          ${warnings.length > 0 ? renderWarnings(warnings) : ''}
        </aside>
        <div class="review-workspace__table-card">
          <div class="review-workspace__table-header">
            <div>
              <p class="eyebrow review-workspace__eyebrow">Exported items</p>
              <h3>${escapeHtml(libraryDisplayName)}</h3>
              <p class="instruction review-workspace__copy">
                Check your exported records before downloading the XML. The table scrolls if needed.
              </p>
            </div>
            <div class="modal__meta-row">
              <span class="soft-chip">${items.length} exported item${items.length === 1 ? '' : 's'}</span>
              ${renderTooltip(
                'doi-link-help',
                'How DOI links behave',
                'When the exporter can derive a canonical DOI URL, the DOI opens in a new tab. Otherwise the raw DOI value is shown as text.',
              )}
            </div>
          </div>
          ${items.length >= 24
            ? `<p id="review-workspace-scale-note" class="review-workspace__scale-note">Large library — the table scrolls so you can review all records before downloading.</p>`
            : ''}
          <div class="review-workspace__table-wrap ${items.length >= 24 ? 'review-workspace__table-wrap--dense' : ''}">
            <table class="items-table items-table--inline" aria-describedby="review-workspace-description${items.length >= 24 ? ' review-workspace-scale-note' : ''}">
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
          <p id="review-workspace-description" class="review-workspace__description">
            Review exported records, attachment status, and DOI links before downloading the XML.
          </p>
        </div>
      </div>
    </section>
  `;
}

function renderErrorSection(state: AppState): string {
  return `
    <section class="card card--error section-stack results-shell">
      <div class="section-heading section-heading--tight">
        <div>
          <div class="section-heading__title">
            <h2 id="recovery-title" tabindex="-1">Something went wrong</h2>
            <span class="status-chip status-chip--${escapeHtml(state.statusSeverity)}">${escapeHtml(SEVERITY_LABELS[state.statusSeverity])}</span>
          </div>
          <p class="instruction section-subcopy">${escapeHtml(state.statusMessage)}</p>
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
      <ul class="warning-summary-list">
        ${warningSummaries.map((warningSummary) => `
          <li class="warning-summary">
            <div class="warning-summary__header">
              <span class="status-chip status-chip--warning">Review required</span>
              <span class="soft-chip">${warningSummary.count} item${warningSummary.count === 1 ? '' : 's'}</span>
            </div>
            <p class="warning-summary__title">${escapeHtml(warningSummary.title)}</p>
            <p>${escapeHtml(warningSummary.summary)}</p>
            <p class="warning-summary__guidance"><strong>What to do</strong>${escapeHtml(warningSummary.guidance)}</p>
            <details class="disclosure disclosure--warning disclosure--compact">
              <summary>Technical detail</summary>
              <div class="disclosure__content">
                <ul class="warning-list">
                  ${warningSummary.messages.map((message) => `<li><code>${escapeHtml(warningSummary.code)}</code>: ${escapeHtml(message)}</li>`).join('')}
                </ul>
              </div>
            </details>
          </li>
        `).join('')}
      </ul>
      <details class="disclosure disclosure--warning disclosure--compact">
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

function renderStatusDetails(state: AppState): string {
  if (state.workerStatus === 'error') {
    return `
      <details class="disclosure disclosure--hero">
        <summary>Troubleshooting</summary>
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
      <summary>How this app works</summary>
      <div class="disclosure__content">
        <p>
          ZIP upload is the main method. Folder upload is available in some browsers as an optional alternative.
        </p>
        <p>
          Processing runs in the background to keep the interface responsive during conversion.
        </p>
      </div>
    </details>
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

function renderCapabilitySupportCard(state: AppState): string {
  const degradedBySecureContext = !state.runtime.isSecureContext;
  const directoryUnavailable = !state.runtime.directoryIntake.available;
  const severity = degradedBySecureContext ? 'warning' : 'informational';
  const title = degradedBySecureContext
    ? 'Limited browser capability'
    : directoryUnavailable
      ? 'Using ZIP upload'
      : 'Folder upload available';
  const message = degradedBySecureContext
    ? 'This browser session has limited secure-context feature support. ZIP upload remains available.'
    : directoryUnavailable
      ? 'Folder upload is not available in this browser. Use ZIP upload to proceed.'
      : 'Folder upload is available as an optional alternative to ZIP upload.';
  const guidanceItems = state.runtime.notes.length > 0
    ? state.runtime.notes.map((note, index) => ({
        detail: note,
        label: `Browser note ${index + 1}`,
      }))
    : [
        {
          detail: 'Attachment paths still require a manual library location when you want XML output to include local PDF links.',
          label: 'Attachment links stay opt-in',
        },
      ];

  return `
    <article class="support-card support-card--${severity}">
      <p class="support-card__eyebrow">Capability state</p>
      <h3>${escapeHtml(title)}</h3>
      <p class="support-card__copy">${escapeHtml(message)}</p>
      <ul class="support-card__list">
        ${guidanceItems.map((item) => `
          <li>
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.detail)}</span>
          </li>
        `).join('')}
      </ul>
    </article>
  `;
}

function buildWorkerTooltip(state: AppState): string {
  if (state.workerStatus === 'error') {
    return 'The worker encountered an error.';
  }

  return state.runtime.directoryIntake.available
    ? 'Upload a ZIP file to get started. A folder picker is also available in this browser.'
    : 'Upload a ZIP file to convert your EndNote library.'
}
