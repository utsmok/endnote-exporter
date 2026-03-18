import type {
  ExportWarning,
  ExportWarningCode,
} from '../types/export-result';
import type { StatusSeverity } from './state';

interface SeverityPresentation {
  description: string;
  label: string;
}

export interface WarningSummary {
  code: ExportWarningCode;
  count: number;
  guidance: string;
  messages: string[];
  summary: string;
  title: string;
}

const SEVERITY_PRESENTATION: Record<StatusSeverity, SeverityPresentation> = {
  error: {
    description: 'Action required. The current session cannot continue until the blocking browser or input problem is resolved.',
    label: 'Action required',
  },
  informational: {
    description: 'Support note. The browser-local baseline is available and the current step does not need intervention.',
    label: 'Support note',
  },
  success: {
    description: 'Ready. The export completed without degraded metadata and can move straight to download.',
    label: 'Ready',
  },
  warning: {
    description: 'Review required. Conversion completed or continued, but the result should be checked before import.',
    label: 'Review required',
  },
};

const WARNING_SUMMARY_COPY: Record<ExportWarningCode, Omit<WarningSummary, 'code' | 'count' | 'messages'>> = {
  ATTACHMENT_LINKS_OMITTED: {
    guidance: 'Add a library location only if you want XML items to include local PDF links; metadata-only export is expected in browser-local mode.',
    summary: 'Attachment metadata was preserved, but browser-local export intentionally omitted local PDF links.',
    title: 'PDF links were omitted',
  },
  ATTACHMENT_LINKS_PARTIAL: {
    guidance: 'Compare attachment counts before import and re-run with a validated library path if partial PDF linking is not acceptable.',
    summary: 'Some verified PDF links were emitted, but at least one attachment could not be linked completely.',
    title: 'PDF link coverage is partial',
  },
  ATTACHMENT_PAYLOAD_MISSING: {
    guidance: 'Rebuild or re-export the source library package if those attachments should have been included in the selected input.',
    summary: 'Attachment metadata exists for at least one record, but the selected browser input did not include the payload file.',
    title: 'Attachment payloads were missing',
  },
  INVALID_TIMESTAMP: {
    guidance: 'Spot-check imported notes or timestamps in Zotero if exact created or modified dates are important for this library.',
    summary: 'At least one EndNote timestamp could not be preserved exactly and may require manual review.',
    title: 'Some timestamps could not be preserved exactly',
  },
  RECORD_SKIPPED: {
    guidance: 'Review the skipped-record details before import and consider re-running with a cleaner archive if record loss is unacceptable.',
    summary: 'One or more records could not be converted into Zotero XML and were skipped from the export.',
    title: 'Some records were skipped',
  },
};

const WARNING_ORDER: ExportWarningCode[] = [
  'RECORD_SKIPPED',
  'ATTACHMENT_PAYLOAD_MISSING',
  'ATTACHMENT_LINKS_PARTIAL',
  'ATTACHMENT_LINKS_OMITTED',
  'INVALID_TIMESTAMP',
];

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTooltip(id: string, label: string, text: string): string {
  return `
    <span class="tooltip">
      <button class="tooltip__trigger" type="button" aria-label="${escapeHtml(label)}" aria-describedby="${escapeHtml(id)}">
        <span aria-hidden="true">i</span>
      </button>
      <span class="tooltip__bubble" role="tooltip" id="${escapeHtml(id)}">${escapeHtml(text)}</span>
    </span>
  `;
}

export function renderAttachmentIndicator(hasPdfAttachment: boolean): string {
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

export function getSeverityPresentation(severity: StatusSeverity): SeverityPresentation {
  return SEVERITY_PRESENTATION[severity];
}

export function summarizeWarnings(warnings: ExportWarning[]): WarningSummary[] {
  const groupedWarnings = new Map<ExportWarningCode, ExportWarning[]>();

  warnings.forEach((warning) => {
    const existingWarnings = groupedWarnings.get(warning.code) ?? [];
    existingWarnings.push(warning);
    groupedWarnings.set(warning.code, existingWarnings);
  });

  return WARNING_ORDER
    .filter((code) => groupedWarnings.has(code))
    .map((code) => {
      const grouped = groupedWarnings.get(code) ?? [];
      const copy = WARNING_SUMMARY_COPY[code];

      return {
        code,
        count: grouped.length,
        guidance: copy.guidance,
        messages: grouped.map((warning) => warning.message),
        summary: copy.summary,
        title: copy.title,
      };
    });
}
