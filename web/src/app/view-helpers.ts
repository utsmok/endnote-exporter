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
    description: 'Something went wrong. Resolve the issue before continuing.',
    label: 'Action required',
  },
  informational: {
    description: 'No action needed at this step.',
    label: 'Info',
  },
  success: {
    description: "Conversion complete. Download the XML when you're ready.",
    label: 'Ready',
  },
  warning: {
    description: 'Conversion completed with warnings. Check the results before importing into Zotero.',
    label: 'Review required',
  },
};

const WARNING_SUMMARY_COPY: Record<ExportWarningCode, Omit<WarningSummary, 'code' | 'count' | 'messages'>> = {
  ATTACHMENT_LINKS_OMITTED: {
    guidance: 'This is expected — add a library location in the options only if you need PDF links in the exported XML.',
    summary: 'Attachment metadata was preserved, but local PDF links were not included in the export.',
    title: 'PDF links were not included',
  },
  ATTACHMENT_LINKS_PARTIAL: {
    guidance: 'Check the attachment counts and re-run with the correct library path if you need all PDF links included.',
    summary: 'Some PDF links were exported, but at least one attachment could not be fully linked.',
    title: 'PDF link coverage is partial',
  },
  ATTACHMENT_PAYLOAD_MISSING: {
    guidance: 'Re-export the library package if the missing attachments should have been included in the ZIP.',
    summary: 'One or more attachment files were expected but missing from the uploaded ZIP.',
    title: 'Attachment files were missing',
  },
  INVALID_TIMESTAMP: {
    guidance: 'Check dates in Zotero after import if exact timestamps matter for this library.',
    summary: 'At least one EndNote timestamp could not be preserved exactly and may need manual review.',
    title: 'Some timestamps could not be preserved exactly',
  },
  RECORD_SKIPPED: {
    guidance: 'Review skipped records below and re-export from EndNote if any data loss is unacceptable.',
    summary: 'One or more records could not be converted into Zotero XML and were skipped.',
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
