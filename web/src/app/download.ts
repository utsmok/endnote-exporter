/**
 * Browser download orchestration.
 *
 * Handles triggering file downloads in the browser for exported XML.
 */

import type { ExportResult } from '../types/export-result';

/**
 * Download options.
 */
export interface DownloadOptions {
  filename?: string;
  mimeType?: string;
}

/**
 * Default download options for Zotero XML files.
 */
const DEFAULT_DOWNLOAD_OPTIONS: Required<DownloadOptions> = {
  filename: 'zotero-import.xml',
  mimeType: 'application/xml',
};

/**
 * Triggers a browser download for the exported XML.
 *
 * Creates a blob, generates a temporary object URL, and triggers
 * a download through a hidden anchor element.
 *
 * @param exportResult - Export result containing XML to download
 * @param options - Optional download configuration
 */
export function downloadExportResult(
  exportResult: ExportResult,
  options: DownloadOptions = {},
): void {
  if (exportResult.xml.trim().length === 0) {
    throw new Error('The generated XML is empty, so there is nothing to download.');
  }

  if (!document.body) {
    throw new Error('The browser document body is unavailable, so the download could not be started.');
  }

  const resolvedOptions = { ...DEFAULT_DOWNLOAD_OPTIONS, ...options };

  // Generate filename from library metadata if not provided
  const filename = options.filename
    ? options.filename
    : generateFilename(exportResult);

  // Create blob from XML content
  const blob = new Blob([exportResult.xml], {
    type: resolvedOptions.mimeType,
  });

  // Create object URL and trigger download
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Generates a download filename from export result metadata.
 *
 * @param exportResult - Export result
 * @returns Generated filename
 */
function generateFilename(exportResult: ExportResult): string {
  const { libraryDisplayName, libraryId } = exportResult.metadata;

  // Sanitize library name for filename
  const sanitizedName = libraryDisplayName
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  const baseName = sanitizedName || libraryId;
  return `${baseName}-zotero-import.xml`;
}

/**
 * Formats a file size in bytes to a human-readable string.
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Gets the size of the export result in bytes.
 *
 * @param exportResult - Export result
 * @returns Size in bytes
 */
export function getExportSize(exportResult: ExportResult): number {
  return new Blob([exportResult.xml]).size;
}
