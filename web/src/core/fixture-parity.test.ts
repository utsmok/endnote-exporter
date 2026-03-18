import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

import { normalizeZipLibrary } from './normalize-library';
import { convertLibrary } from './convert-library';
import { createSqliteAdapter } from '../worker/sqlite-adapter';
import { queryPreparedLibrary } from '../worker/query-endnote';
import type { ExportResult } from '../types/export-result';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..', '..', '..');
const fixturesDir = join(repoRoot, 'testing', 'browser-local', 'fixtures');
const goldenDir = join(repoRoot, 'testing', 'browser-local', 'golden');

const parser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
});

const exactParityFixtures = [
  {
    archiveFileName: 'supported-enl-data.zip',
    goldenFileName: 'supported-enl-data.xml',
  },
  {
    archiveFileName: 'supported-enlp-equivalent.zip',
    goldenFileName: 'supported-enlp-equivalent.xml',
  },
  {
    archiveFileName: 'mixed-case-data-lookup.zip',
    goldenFileName: 'mixed-case-data-lookup.xml',
  },
] as const;

describe('fixture-backed browser-local parity', () => {
  it.each(exactParityFixtures)(
    'matches approved XML for $archiveFileName',
    async ({ archiveFileName, goldenFileName }) => {
      const result = await convertFixture(archiveFileName);
      const goldenXml = await readText(join(goldenDir, goldenFileName));

      expectValidXml(result.xml);
      expect(canonicalizeXml(result.xml)).toEqual(canonicalizeXml(goldenXml));
      expect(result.metadata.inputRecordCount).toBe(1);
      expect(result.metadata.recordCount).toBe(1);
      expect(result.metadata.skippedRecordCount).toBe(0);
      expect(result.metadata.attachmentCount).toBe(0);
      expect(result.metadata.warnings).toEqual([]);
    },
  );

  it('matches approved divergence for attachment-present', async () => {
    const result = await convertFixture('attachment-present.zip');
    const goldenXml = await readText(join(goldenDir, 'attachment-present.xml'));

    expectValidXml(result.xml);
    expect(result.xml).not.toContain('<pdf-urls>');
    expect(canonicalizeXml(result.xml)).toEqual(
      stripPdfUrls(canonicalizeXml(goldenXml)),
    );
    expect(result.metadata.attachmentMode).toBe('metadata-only-no-links');
    expect(result.metadata.attachmentCount).toBe(1);
    expect(result.metadata.referenceCountWithAttachments).toBe(1);
    expect(result.metadata.missingAttachmentPayloadCount).toBe(0);
    expect(result.metadata.recordCount).toBe(1);
    expect(result.metadata.skippedRecordCount).toBe(0);
    expect(result.metadata.warnings).toContainEqual(
      expect.objectContaining({ code: 'ATTACHMENT_LINKS_OMITTED' }),
    );
  });
});

async function convertFixture(archiveFileName: string): Promise<ExportResult> {
  const archiveBytes = await readFixtureBytes(archiveFileName);
  const library = normalizeZipLibrary({
    archiveBytes,
    archiveFileName,
  });
  const adapter = await createSqliteAdapter({
    databaseBytes: library.database.bytes,
    databaseLabel: library.displayName,
  });

  try {
    const queryResult = queryPreparedLibrary(adapter, library);
    return convertLibrary(queryResult, library);
  } finally {
    adapter.close();
  }
}

async function readFixtureBytes(fileName: string): Promise<Uint8Array> {
  const buffer = await readFile(join(fixturesDir, fileName));
  return new Uint8Array(buffer);
}

async function readText(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8');
}

function expectValidXml(xml: string): void {
  const validation = XMLValidator.validate(xml);
  expect(validation).toBe(true);
}

function canonicalizeXml(xml: string): unknown {
  return canonicalizeValue(parser.parse(xml));
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== '?xml')
        .filter(([key, entryValue]) => key !== '#text' || String(entryValue).trim().length > 0)
        .map(([key, entryValue]) => [
          key,
          key === '#text'
            ? String(entryValue).replace(/\r\n/g, '\n')
            : canonicalizeValue(entryValue),
        ]),
    );
  }

  if (typeof value === 'string') {
    return value.replace(/\r\n/g, '\n');
  }

  return value;
}

function stripPdfUrls(value: unknown): unknown {
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
