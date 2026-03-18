/**
 * Browser-local attachment resolution.
 *
 * Implements the metadata-only attachment policy for browser-local conversion.
 * This module does NOT emit PDF URLs in XML, following the approved MVP policy.
 *
 * @see docs/local-web-execution/attachment-policy.md
 */

import type {
  EndnoteAttachmentRow,
  EndnoteQueryResult,
} from '../types/query-results';
import type { PreparedLibrary } from './library-types';
import type { AttachmentExportOptions, AttachmentMode, ExportWarning } from '../types/export-result';

/**
 * Resolved attachment information for a single reference.
 */
export interface ResolvedAttachments {
  /** Number of attachment rows for this reference */
  count: number;
  /** Stable paths emitted to pdf-urls when the user supplies a library location */
  pdfUrls: string[];
  /** Attachment file paths (relative to PDF root) */
  relativePaths: string[];
  /** Whether any attachment payload is missing from the prepared library */
  hasMissingPayload: boolean;
}

/**
 * Attachment resolution result for the entire library.
 */
export interface AttachmentResolutionResult {
  /** User supplied library location used for PDF links, if any */
  baseLibraryPath?: string;
  /** Attachment mode used */
  mode: AttachmentMode;
  /** Number of pdf-urls emitted from verified attachment paths */
  linkedAttachmentCount: number;
  /** Total attachment count across all references */
  totalAttachments: number;
  /** Number of attachment payloads missing from the prepared library */
  missingAttachmentPayloadCount: number;
  /** Number of references with at least one attachment row */
  referenceCountWithAttachments: number;
  /** Attachments by reference ID */
  byReferenceId: Record<number, ResolvedAttachments>;
  /** Warnings generated during resolution */
  warnings: ExportWarning[];
}

/**
 * Resolves attachments for browser-local conversion.
 *
 * This implements the metadata-only policy:
 * - Detects attachment rows from the database
 * - Tracks attachment presence and missing payloads
 * - Does NOT generate PDF URLs for XML emission
 * - Generates appropriate warnings
 *
 * @param queryResult - Query result from Endnote database
 * @param library - Prepared library with attachment metadata
 * @returns Attachment resolution result
 *
 * @see docs/local-web-execution/attachment-policy.md
 */
export function resolveAttachments(
  queryResult: EndnoteQueryResult,
  library: PreparedLibrary,
  options: AttachmentExportOptions = {},
): AttachmentResolutionResult {
  const baseLibraryPath = options.baseLibraryPath?.trim() || undefined;
  const mode: AttachmentMode = baseLibraryPath
    ? 'base-library-path-links'
    : 'metadata-only-no-links';
  const warnings: ExportWarning[] = [];
  const byReferenceId: Record<number, ResolvedAttachments> = {};
  const preparedAttachmentFiles = buildPreparedAttachmentMap(library);
  const attachmentRoot = baseLibraryPath
    ? resolveAttachmentRoot(baseLibraryPath, library)
    : null;

  let totalAttachments = 0;
  let linkedAttachmentCount = 0;
  let missingPayloadCount = 0;

  // Group attachments by reference ID
  const attachmentsByRef = queryResult.attachmentsByReferenceId;

  // Resolve attachments for each reference
  for (const [refIdStr, filePaths] of Object.entries(attachmentsByRef)) {
    const refId = parseInt(refIdStr, 10);
    if (isNaN(refId)) {
      continue;
    }

    const resolved: ResolvedAttachments = {
      count: filePaths.length,
      pdfUrls: [],
      relativePaths: filePaths,
      hasMissingPayload: false,
    };

    for (const filePath of filePaths) {
      const preparedFile = preparedAttachmentFiles.get(canonicalizeRelativeAttachmentPath(filePath));

      if (!preparedFile) {
        resolved.hasMissingPayload = true;
        missingPayloadCount++;
        continue;
      }

      if (attachmentRoot && preparedFile.kind === 'pdf') {
        resolved.pdfUrls.push(
          joinNativePath(attachmentRoot, ...preparedFile.subtreeRelativePath.split('/')),
        );
        linkedAttachmentCount++;
      }
    }

    byReferenceId[refId] = resolved;
    totalAttachments += filePaths.length;
  }

  // Generate warnings for attachment presence
  if (totalAttachments > 0) {
    if (baseLibraryPath) {
      if (linkedAttachmentCount < totalAttachments) {
        warnings.push({
          code: linkedAttachmentCount > 0 ? 'ATTACHMENT_LINKS_PARTIAL' : 'ATTACHMENT_LINKS_OMITTED',
          message: linkedAttachmentCount > 0
            ? `Exported ${linkedAttachmentCount} verified PDF path(s) using the supplied library location. ${totalAttachments - linkedAttachmentCount} attachment row(s) could not be emitted because the selected ZIP or folder did not contain a matching payload.`
            : 'A library location was supplied, but no verified attachment payloads were available to export as PDF paths.',
        });
      }
    } else {
      warnings.push({
        code: 'ATTACHMENT_LINKS_OMITTED',
        message: `Detected ${totalAttachments} attachment(s) in library. Browser-local conversion omits PDF paths unless you supply a library location yourself.`,
      });
    }
  }

  // Generate warnings for missing payloads
  if (missingPayloadCount > 0) {
    warnings.push({
      code: 'ATTACHMENT_PAYLOAD_MISSING',
      message: `${missingPayloadCount} attachment(s) referenced in the database but the file content was not found in the prepared library.`,
    });
  }

  const referenceCountWithAttachments = Object.values(byReferenceId).filter(
    (attachments) => attachments.count > 0,
  ).length;

  return {
    ...(baseLibraryPath ? { baseLibraryPath } : {}),
    byReferenceId,
    linkedAttachmentCount,
    missingAttachmentPayloadCount: missingPayloadCount,
    mode,
    referenceCountWithAttachments,
    totalAttachments,
    warnings,
  };
}

function buildPreparedAttachmentMap(
  library: PreparedLibrary,
): Map<string, PreparedLibrary['attachments']['files'][number]> {
  return new Map(
    library.attachments.files.map((file) => [
      canonicalizeRelativeAttachmentPath(file.subtreeRelativePath),
      file,
    ]),
  );
}

function canonicalizeRelativeAttachmentPath(relativePath: string): string {
  return relativePath
    .replaceAll('\\', '/')
    .replace(/^PDF\//iu, '')
    .replace(/^\/+/, '')
    .toLowerCase();
}

function resolveAttachmentRoot(baseLibraryPath: string, library: PreparedLibrary): string {
  const trimmedBase = trimTrailingSeparators(baseLibraryPath.trim());
  const baseRoot = trimmedBase.toLowerCase().endsWith('.enl')
    ? dirnameLike(trimmedBase)
    : trimmedBase;

  return joinNativePath(baseRoot, library.identity.dataDirectoryName, 'PDF');
}

function joinNativePath(root: string, ...segments: string[]): string {
  const separator = inferNativeSeparator(root);
  const cleanedRoot = trimTrailingSeparators(root);
  const cleanedSegments = segments
    .flatMap((segment) => segment.split('/'))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (cleanedRoot.length === 0) {
    return cleanedSegments.join(separator);
  }

  return [cleanedRoot, ...cleanedSegments].join(separator);
}

function inferNativeSeparator(path: string): '\\' | '/' {
  return path.includes('\\') || /^\\\\|^[a-z]:/iu.test(path) ? '\\' : '/';
}

function trimTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/gu, '');
}

function dirnameLike(path: string): string {
  const trimmed = trimTrailingSeparators(path);
  const lastSeparatorIndex = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));

  if (lastSeparatorIndex < 0) {
    return '';
  }

  return trimmed.slice(0, lastSeparatorIndex);
}

/**
 * Gets attachment information for a specific reference.
 *
 * @param resolution - Attachment resolution result
 * @param referenceId - Reference ID to look up
 * @returns Resolved attachments or null if none
 */
export function getAttachmentsForReference(
  resolution: AttachmentResolutionResult,
  referenceId: number,
): ResolvedAttachments | null {
  return resolution.byReferenceId[referenceId] || null;
}

/**
 * Checks if a reference has any attachments.
 *
 * @param resolution - Attachment resolution result
 * @param referenceId - Reference ID to check
 * @returns True if the reference has attachments
 */
export function referenceHasAttachments(
  resolution: AttachmentResolutionResult,
  referenceId: number,
): boolean {
  const attachments = resolution.byReferenceId[referenceId];
  return attachments ? attachments.count > 0 : false;
}

/**
 * Gets the total count of references with attachments.
 *
 * @param resolution - Attachment resolution result
 * @returns Number of references that have at least one attachment
 */
export function getReferenceCountWithAttachments(
  resolution: AttachmentResolutionResult,
): number {
  return Object.values(resolution.byReferenceId).filter((a) => a.count > 0)
    .length;
}
