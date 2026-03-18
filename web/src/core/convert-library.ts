/**
 * EndNote to Zotero conversion pipeline.
 *
 * Orchestrates the complete conversion from query results to XML export.
 */

import type { EndnoteQueryResult } from '../types/query-results';
import type { PreparedLibrary } from './library-types';
import type { MappedRecord } from './map-record';
import type { AttachmentExportOptions, ExportResult } from '../types/export-result';
import {
  createExportContext,
  buildExportResult,
  addWarning,
  getReferenceAttachments,
  type ExportContext,
  type ConversionCounts,
} from './build-export-result';
import { mapRecord } from './map-record';
import { buildXmlDocument, serializeRecordXmlFragment } from './export-xml';

/**
 * Converts a prepared library through the full conversion pipeline.
 *
 * This function orchestrates:
 * 1. Creating export context
 * 2. Mapping all records from query results
 * 3. Generating XML from mapped records
 * 4. Building complete export result with metadata
 *
 * @param queryResult - Query results from EndNote database
 * @param library - Prepared library structure
 * @returns Complete export result with XML and metadata
 */
export function convertLibrary(
  queryResult: EndnoteQueryResult,
  library: PreparedLibrary,
  attachmentOptions: AttachmentExportOptions = {},
): ExportResult {
  // Step 1: Create export context with attachment resolution
  const context = createExportContext(queryResult, library, attachmentOptions);

  // Step 2/3: Map and serialize records with Python-style per-record tolerance
  const { counts, xml } = convertRecordsWithTolerance(queryResult, context);

  // Step 4: Build complete export result with metadata
  return buildExportResult(xml, context, counts);
}

/**
 * Maps all EndNote reference records to Zotero format.
 *
 * @param queryResult - Query results from EndNote database
 * @returns Array of mapped records
 */
function convertRecordsWithTolerance(
  queryResult: EndnoteQueryResult,
  context: ExportContext,
): { counts: ConversionCounts; xml: string } {
  const recordFragments: string[] = [];

  for (const ref of queryResult.referenceRows) {
    let mappedRecord: MappedRecord;

    try {
      mappedRecord = mapRecord(ref);
      applyAttachmentUrls(mappedRecord, context, ref.id);
    } catch (error) {
      addWarning(
        context,
        'RECORD_SKIPPED',
        buildRecordSkippedMessage(ref.id, 'mapping', error),
        ref.id,
      );
      continue;
    }

    try {
      recordFragments.push(serializeRecordXmlFragment(mappedRecord));
    } catch (error) {
      addWarning(
        context,
        'RECORD_SKIPPED',
        buildRecordSkippedMessage(ref.id, 'serialization', error),
        ref.id,
      );
    }
  }

  const counts: ConversionCounts = {
    exportedRecordCount: recordFragments.length,
    inputRecordCount: queryResult.referenceRows.length,
    skippedRecordCount: queryResult.referenceRows.length - recordFragments.length,
  };

  return {
    counts,
    xml: buildXmlDocument(recordFragments),
  };
}

function buildRecordSkippedMessage(
  recordId: number,
  stage: 'mapping' | 'serialization',
  error: unknown,
): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Skipped reference ${recordId} during ${stage}: ${detail}`;
}

function applyAttachmentUrls(
  mappedRecord: MappedRecord,
  context: ExportContext,
  referenceId: number,
): void {
  const attachments = getReferenceAttachments(context, referenceId);

  if (!attachments || attachments.pdfUrls.length === 0) {
    return;
  }

  mappedRecord.urls = {
    ...(mappedRecord.urls ?? {}),
    'pdf-urls': attachments.pdfUrls,
  };
}

/**
 * Checks if the conversion result has any warnings.
 *
 * @param result - Export result
 * @returns True if there are warnings
 */
export function conversionHasWarnings(result: ExportResult): boolean {
  return result.metadata.warnings.length > 0;
}

/**
 * Gets a summary of the conversion result.
 *
 * @param result - Export result
 * @returns Summary string
 */
export function getConversionSummary(result: ExportResult): string {
  const { recordCount, attachmentCount, skippedRecordCount, warnings } = result.metadata;
  const parts = [
    `${recordCount} reference${recordCount !== 1 ? 's' : ''}`,
    `${attachmentCount} attachment${attachmentCount !== 1 ? 's' : ''}`,
  ];

  if (skippedRecordCount > 0) {
    parts.push(`${skippedRecordCount} skipped`);
  }

  if (warnings.length > 0) {
    parts.push(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}
