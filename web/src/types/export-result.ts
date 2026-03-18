/**
 * Export result types.
 *
 * Defines the structure of export results for browser-local conversion.
 */

/**
 * Attachment mode used during export.
 *
 * Defines how attachments were handled in the export.
 * This will be fully implemented in T009.
 */
export type AttachmentMode =
  | 'metadata-only-no-links' // No links, just counts (MVP browser-local)
  | 'base-library-path-links'; // User supplied base path + verified relative attachment paths

/**
 * Export warning codes.
 *
 * Indicates specific warnings that occurred during export.
 */
export type ExportWarningCode =
  | 'ATTACHMENT_PAYLOAD_MISSING' // Attachment metadata exists but payload was not present
  | 'ATTACHMENT_LINKS_OMITTED' // Attachment links were not emitted (browser-local)
  | 'ATTACHMENT_LINKS_PARTIAL' // Some verified attachment links were emitted, but not all attachment rows could be exported
  | 'RECORD_SKIPPED' // A record was skipped due to processing error
  | 'INVALID_TIMESTAMP'; // A timestamp could not be parsed

/**
 * Individual export warning.
 */
export interface ExportWarning {
  code: ExportWarningCode;
  message: string;
  recordId?: number; // Reference ID if applicable
}

export interface AttachmentExportOptions {
  baseLibraryPath?: string;
}

export interface ExportItemSummary {
  author: string;
  hasPdfAttachment: boolean;
  recordId: number;
  title: string;
  year: string;
}

/**
 * Export result metadata.
 *
 * Contains counts, warnings, and metadata about the export.
 */
export interface ExportResultMetadata {
  attachmentMode: AttachmentMode;
  attachmentBaseLibraryPath?: string;
  inputRecordCount: number;
  recordCount: number;
  skippedRecordCount: number;
  attachmentCount: number;
  linkedAttachmentCount: number;
  missingAttachmentPayloadCount: number;
  referenceCountWithAttachments: number;
  items: ExportItemSummary[];
  warnings: ExportWarning[];
  libraryId: string;
  libraryDisplayName: string;
}

/**
 * Complete export result.
 *
 * Contains the generated XML and metadata about the export.
 */
export interface ExportResult {
  xml: string;
  metadata: ExportResultMetadata;
}

/**
 * Statistics about the conversion process.
 */
export interface ConversionStats {
  recordCount: number;
  attachmentCount: number;
  warningCount: number;
  processingTimeMs: number;
}
