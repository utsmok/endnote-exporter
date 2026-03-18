import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { normalizeZipLibrary } from '../core/normalize-library';
import { createSqliteAdapter } from './sqlite-adapter';
import { queryPreparedLibrary } from './query-endnote';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..', '..', '..');
const fixturesDir = join(repoRoot, 'testing', 'browser-local', 'fixtures');

const supportedFixtures = [
  {
    archiveFileName: 'supported-enl-data.zip',
    expected: {
      attachmentRowCount: 0,
      referenceRowCount: 1,
      title: 'Supported ENL Record',
    },
  },
  {
    archiveFileName: 'supported-enlp-equivalent.zip',
    expected: {
      attachmentRowCount: 0,
      referenceRowCount: 1,
      title: 'Supported ENLP Package',
    },
  },
  {
    archiveFileName: 'attachment-present.zip',
    expected: {
      attachmentRowCount: 1,
      referenceRowCount: 1,
      title: 'Attachment Present Record',
    },
  },
  {
    archiveFileName: 'mixed-case-data-lookup.zip',
    expected: {
      attachmentRowCount: 0,
      referenceRowCount: 1,
      title: 'Mixed Case Data Folder',
    },
  },
  {
    archiveFileName: 'stress-large.zip',
    expected: {
      attachmentRowCount: 0,
      referenceRowCount: 250,
      title: 'Stress Fixture Record 001',
    },
  },
] as const;

describe('queryPreparedLibrary', () => {
  it.each(supportedFixtures)(
    'returns structured rows for $archiveFileName',
    async ({ archiveFileName, expected }) => {
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
        const result = queryPreparedLibrary(adapter, library);

        expect(result.summary.referenceRowCount).toBe(expected.referenceRowCount);
        expect(result.summary.attachmentRowCount).toBe(expected.attachmentRowCount);
        expect(result.referenceRows[0]?.title).toBe(expected.title);
        expect(result.databaseArchivePath).toBe(library.database.archivePath);
        expect(result.databaseRelativePath).toBe(library.database.relativePath);

        if (expected.attachmentRowCount > 0) {
          expect(Object.keys(result.attachmentsByReferenceId)).toHaveLength(1);
          expect(result.attachmentRows[0]?.file_path.toLowerCase()).toContain('.pdf');
        } else {
          expect(result.attachmentRows).toHaveLength(0);
          expect(result.attachmentsByReferenceId).toEqual({});
        }
      } finally {
        adapter.close();
      }
    },
  );
});

async function readFixtureBytes(fileName: string): Promise<Uint8Array> {
  const filePath = join(fixturesDir, fileName);
  const buffer = await readFile(filePath);
  return new Uint8Array(buffer);
}
