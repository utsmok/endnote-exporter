import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { XMLParser, XMLValidator } from 'fast-xml-parser';

import type {
  DirectoryEntryHandleLike,
  DirectoryFileHandleLike,
  DirectoryHandleLike,
} from '../adapters/directory-input';
import { convertLibrary } from '../core/convert-library';
import { normalizeZipLibrary } from '../core/normalize-library';
import type { PreparedLibrary } from '../core/library-types';
import type { AttachmentExportOptions, ExportResult } from '../types/export-result';
import { queryPreparedLibrary } from '../worker/query-endnote';
import { createSqliteAdapter } from '../worker/sqlite-adapter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const repoRoot = join(__dirname, '..', '..', '..');
export const testingDir = join(repoRoot, 'testing');
export const browserGoldenDir = join(testingDir, 'browser-local', 'golden');
export const endnoteExampleLibraryDirectory = join(testingDir, 'endnote-example-library');
export const endnoteExampleLibraryZip = join(testingDir, 'endnote-example-library.zip');

export const realSampleExpectations = {
  attachmentCount: 122,
  exportedRecordCount: 240,
  inputRecordCount: 240,
  missingAttachmentPayloadCount: 122,
  referenceCountWithAttachments: 107,
} as const;

const parser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
});

export async function readFixtureBytes(filePath: string): Promise<Uint8Array> {
  const buffer = await readFile(filePath);
  return new Uint8Array(buffer);
}

export async function readText(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8');
}

export async function readGoldenFile(fileName: string): Promise<string> {
  return readText(join(browserGoldenDir, fileName));
}

export async function convertZipLibrary(
  archivePath: string,
  options: AttachmentExportOptions = {},
): Promise<{ library: PreparedLibrary; result: ExportResult }> {
  const archiveBytes = await readFixtureBytes(archivePath);
  const library = normalizeZipLibrary({
    archiveBytes,
    archiveFileName: basename(archivePath),
  });

  return {
    library,
    result: await convertPreparedLibrary(library, options),
  };
}

export async function convertPreparedLibrary(
  library: PreparedLibrary,
  options: AttachmentExportOptions = {},
): Promise<ExportResult> {
  const adapter = await createSqliteAdapter({
    databaseBytes: library.database.bytes,
    databaseLabel: library.displayName,
  });

  try {
    const queryResult = queryPreparedLibrary(adapter, library);
    return convertLibrary(queryResult, library, options);
  } finally {
    adapter.close();
  }
}

export function expectValidXml(xml: string): void {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error(JSON.stringify(validation));
  }
}

export function canonicalizeXml(xml: string): unknown {
  return canonicalizeValue(parser.parse(xml));
}

export function stripPdfUrls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripPdfUrls(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'pdf-urls')
        .map(([key, entryValue]) => [key, stripPdfUrls(entryValue)]),
    );
  }

  return value;
}

export function materializePdfRootPlaceholder(xml: string, pdfRoot: string): string {
  return xml.replaceAll('${PDF_ROOT}', pdfRoot.replaceAll('\\', '/'));
}

export function countXmlRecords(xml: string): number {
  return [...xml.matchAll(/<record>/gu)].length;
}

export function createDirectoryHandleFromFileSystem(directoryPath: string): DirectoryHandleLike {
  return {
    kind: 'directory',
    name: basename(directoryPath),
    async *values(): AsyncIterable<DirectoryEntryHandleLike> {
      const entries = await readdir(directoryPath, { withFileTypes: true });
      entries.sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        const entryPath = join(directoryPath, entry.name);
        yield entry.isDirectory()
          ? createDirectoryHandleFromFileSystem(entryPath)
          : createFileHandleFromFileSystem(entryPath);
      }
    },
  };
}

function createFileHandleFromFileSystem(filePath: string): DirectoryFileHandleLike {
  return {
    async getFile(): Promise<File> {
      const buffer = await readFile(filePath);
      return new File([new Uint8Array(buffer)], basename(filePath));
    },
    kind: 'file',
    name: basename(filePath),
  };
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeValue(entry));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([key]) => key !== '?xml')
      .filter(([key, entryValue]) => key !== '#text' || String(entryValue).trim().length > 0)
      .map(([key, entryValue]) => {
        let canonicalized: unknown;

        if (key === '#text') {
          canonicalized = normalizeXmlString(String(entryValue));
        } else if (key === 'notes') {
          canonicalized = normalizeTimestampsInNotes(canonicalizeValue(entryValue));
        } else {
          canonicalized = canonicalizeValue(entryValue);
        }

        if (key === 'keyword' && typeof canonicalized === 'string') {
          const keywords = canonicalized
            .split(/\n+/u)
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);

          return [key, keywords.length <= 1 ? canonicalized : keywords] as const;
        }

        return [key, canonicalized] as const;
      })
      .filter(([key, entryValue]) => {
        if (key === 'urls') {
          return !isEmptyObject(entryValue) && entryValue !== '';
        }

        return !isEmptyObject(entryValue);
      });

    return Object.fromEntries(entries);
  }

  if (typeof value === 'string') {
    return normalizeXmlString(value);
  }

  return value;
}

function normalizeXmlString(value: string): string {
  const normalized = value
    .replace(/&#xD;/giu, '\n')
    .replace(/\r\n/g, '\n');

  return normalized.trim().length === 0 ? '' : normalized;
}

const timestampPattern = /\b(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})\b/gu;

/**
 * Normalizes timestamps in notes fields to UTC for timezone-agnostic comparison.
 * The formatTimestamp function uses local time, so CI (UTC) produces different
 * output than local development (e.g., UTC+2). We normalize to date-only to
 * avoid timezone flakiness in parity tests.
 */
function normalizeTimestampsInNotes(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(timestampPattern, '$1T00:00:00');
}

function isEmptyObject(value: unknown): boolean {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value as Record<string, unknown>).length === 0;
}
