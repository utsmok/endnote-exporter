/**
 * Build structured export results.
 *
 * Assembles the final export result with XML, metadata, and warnings.
 */

import type { EndnoteQueryResult } from '../types/query-results';
import type { PreparedLibrary } from './library-types';
import type {
  AttachmentExportOptions,
  ExportResult,
  ExportResultMetadata,
  ExportItemSummary,
  ExportWarning,
  ConversionStats,
} from '../types/export-result';
import type {
  AttachmentResolutionResult,
  ResolvedAttachments,
} from './resolve-attachments';
import { resolveAttachments } from './resolve-attachments';

/**
 * Export context passed through the conversion pipeline.
 */
export interface ExportContext {
  attachmentOptions: AttachmentExportOptions;
  queryResult: EndnoteQueryResult;
  library: PreparedLibrary;
  attachmentResolution: AttachmentResolutionResult;
  warnings: ExportWarning[];
  startTimeMs: number;
}

export interface ConversionCounts {
  exportedRecordCount: number;
  inputRecordCount: number;
  skippedRecordCount: number;
}

/**
 * Builds export metadata from the conversion context.
 *
 * @param context - Export context
 * @param endTimeMs - End timestamp for performance tracking
 * @returns Export result metadata
 */
export function buildExportMetadata(
  context: ExportContext,
  counts: ConversionCounts,
): ExportResultMetadata {
  const { library, attachmentResolution, warnings } = context;

  return {
    ...(attachmentResolution.baseLibraryPath
      ? { attachmentBaseLibraryPath: attachmentResolution.baseLibraryPath }
      : {}),
    attachmentMode: attachmentResolution.mode,
    attachmentCount: attachmentResolution.totalAttachments,
    inputRecordCount: counts.inputRecordCount,
    items: buildItemSummaries(context),
    linkedAttachmentCount: attachmentResolution.linkedAttachmentCount,
    missingAttachmentPayloadCount: attachmentResolution.missingAttachmentPayloadCount,
    recordCount: counts.exportedRecordCount,
    referenceCountWithAttachments: attachmentResolution.referenceCountWithAttachments,
    skippedRecordCount: counts.skippedRecordCount,
    warnings: [...warnings, ...attachmentResolution.warnings],
    libraryId: library.id,
    libraryDisplayName: library.displayName,
  };
}

/**
 * Builds a complete export result.
 *
 * @param xml - Generated XML string
 * @param context - Export context
 * @returns Complete export result
 */
export function buildExportResult(
  xml: string,
  context: ExportContext,
  counts: ConversionCounts,
): ExportResult {
  const metadata = buildExportMetadata(context, counts);

  return {
    xml,
    metadata,
  };
}

/**
 * Builds conversion statistics from the export result.
 *
 * @param result - Export result
 * @param startTimeMs - Start timestamp
 * @returns Conversion statistics
 */
export function buildConversionStats(
  result: ExportResult,
  startTimeMs: number,
): ConversionStats {
  return {
    recordCount: result.metadata.recordCount,
    attachmentCount: result.metadata.attachmentCount,
    warningCount: result.metadata.warnings.length,
    processingTimeMs: performance.now() - startTimeMs,
  };
}

/**
 * Creates an export context for the conversion pipeline.
 *
 * @param queryResult - Query result from database
 * @param library - Prepared library
 * @returns Export context
 */
export function createExportContext(
  queryResult: EndnoteQueryResult,
  library: PreparedLibrary,
  attachmentOptions: AttachmentExportOptions = {},
): ExportContext {
  const startTimeMs = performance.now();

  const attachmentResolution = resolveAttachments(queryResult, library, attachmentOptions);

  // Initial warnings can be added here if needed
  const warnings: ExportWarning[] = [];

  return {
    attachmentOptions,
    queryResult,
    library,
    attachmentResolution,
    warnings,
    startTimeMs,
  };
}

function buildItemSummaries(context: ExportContext): ExportItemSummary[] {
  return context.queryResult.referenceRows.map((reference) => {
    const attachments = context.attachmentResolution.byReferenceId[reference.id];

    return {
      author: summarizeAuthor(reference.author),
      hasPdfAttachment: Boolean(attachments && attachments.count > 0),
      recordId: reference.id,
      title: typeof reference.title === 'string' && reference.title.trim().length > 0
        ? reference.title.trim()
        : 'Untitled record',
      year: reference.year === null || reference.year === undefined
        ? '—'
        : String(reference.year).trim() || '—',
    };
  });
}

function summarizeAuthor(author: EndnoteQueryResult['referenceRows'][number]['author']): string {
  if (author === null || author === undefined) {
    return '—';
  }

  const firstLine = String(author)
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);

  return firstLine ?? '—';
}

/**
 * Adds a warning to the export context.
 *
 * @param context - Export context
 * @param code - Warning code
 * @param message - Warning message
 * @param recordId - Optional reference ID
 */
export function addWarning(
  context: ExportContext,
  code: ExportWarning['code'],
  message: string,
  recordId?: number,
): void {
  const warning: ExportWarning = { code, message };
  if (recordId !== undefined) {
    warning.recordId = recordId;
  }
  context.warnings.push(warning);
}

/**
 * Checks if a reference has attachments and gets the info.
 *
 * @param context - Export context
 * @param referenceId - Reference ID
 * @returns Attachment info or null
 */
export function getReferenceAttachments(
  context: ExportContext,
  referenceId: number,
): ResolvedAttachments | null {
  return context.attachmentResolution.byReferenceId[referenceId] || null;
}

/**
 * Checks if any attachment payloads are missing.
 *
 * @param context - Export context
 * @returns True if any attachments have missing payloads
 */
export function hasMissingAttachmentPayloads(context: ExportContext): boolean {
  return Object.values(context.attachmentResolution.byReferenceId).some(
    (a) => a.hasMissingPayload,
  );
}
