import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { LibraryNormalizationError } from './errors';
import { normalizeZipLibrary } from './normalize-library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, '../../../testing/browser-local/fixtures');

const supportedFixtures = [
  {
    archiveFileName: 'supported-enl-data.zip',
    expected: {
      attachmentPaths: [],
      dataDirectoryRelativePath: 'SupportedLibrary.Data',
      displayName: 'SupportedLibrary',
      libraryRelativePath: 'SupportedLibrary.enl',
      packageRelativePath: null,
      sourceShape: 'zipped-enl-data',
    },
  },
  {
    archiveFileName: 'supported-enlp-equivalent.zip',
    expected: {
      attachmentPaths: [],
      dataDirectoryRelativePath: 'PackageLibrary.Data',
      displayName: 'PackageLibrary',
      libraryRelativePath: 'PackageLibrary.enl',
      packageRelativePath: 'PackageLibrary.enlp',
      sourceShape: 'zipped-enlp-package',
    },
  },
  {
    archiveFileName: 'attachment-present.zip',
    expected: {
      attachmentPaths: ['AttachmentLibrary.Data/PDF/group-1/paper.pdf'],
      dataDirectoryRelativePath: 'AttachmentLibrary.Data',
      displayName: 'AttachmentLibrary',
      libraryRelativePath: 'AttachmentLibrary.enl',
      packageRelativePath: null,
      sourceShape: 'zipped-enl-data',
    },
  },
  {
    archiveFileName: 'mixed-case-data-lookup.zip',
    expected: {
      attachmentPaths: [],
      dataDirectoryRelativePath: 'CaseSensitiveLibrary.dAtA',
      displayName: 'CaseSensitiveLibrary',
      libraryRelativePath: 'CaseSensitiveLibrary.enl',
      packageRelativePath: null,
      sourceShape: 'zipped-enl-data',
    },
  },
  {
    archiveFileName: 'stress-large.zip',
    expected: {
      attachmentPaths: [],
      dataDirectoryRelativePath: 'StressLibrary.Data',
      displayName: 'StressLibrary',
      libraryRelativePath: 'StressLibrary.enl',
      packageRelativePath: null,
      sourceShape: 'zipped-enl-data',
    },
  },
] as const;

describe('normalizeZipLibrary', () => {
  for (const fixture of supportedFixtures) {
    it(`normalizes ${fixture.archiveFileName} deterministically`, async () => {
      const archiveBytes = await readFixtureBytes(fixture.archiveFileName);

      const first = normalizeZipLibrary({
        archiveBytes,
        archiveFileName: fixture.archiveFileName,
      });
      const second = normalizeZipLibrary({
        archiveBytes,
        archiveFileName: fixture.archiveFileName,
      });

      expect(summarisePreparedLibrary(first)).toEqual(summarisePreparedLibrary(second));
      expect(first.displayName).toBe(fixture.expected.displayName);
      expect(first.identity.sourceShape).toBe(fixture.expected.sourceShape);
      expect(first.identity.libraryRelativePath).toBe(fixture.expected.libraryRelativePath);
      expect(first.identity.dataDirectoryRelativePath).toBe(
        fixture.expected.dataDirectoryRelativePath,
      );
      expect(first.identity.packageRelativePath).toBe(
        fixture.expected.packageRelativePath,
      );
      expect(first.database.relativePath).toBe(
        `${fixture.expected.dataDirectoryRelativePath}/sdb/sdb.eni`,
      );
      expect(first.database.bytes.byteLength).toBeGreaterThan(0);
      expect(first.files.map((file) => file.relativePath)).toEqual(
        [...first.files.map((file) => file.relativePath)].sort((left, right) =>
          left.localeCompare(right),
        ),
      );
      expect(first.attachments.rootRelativePath).toBe(
        `${fixture.expected.dataDirectoryRelativePath}/PDF`,
      );
      expect(first.attachments.files.map((file) => file.relativePath)).toEqual(
        fixture.expected.attachmentPaths,
      );
      expect(first.fileMap[first.database.relativePath]).toEqual({
        archivePath: first.database.archivePath,
        relativePath: first.database.relativePath,
        size: first.fileMap[first.database.relativePath]?.size,
        source: 'zip-entry',
      });
      expect(first.warnings).toEqual([]);
    });
  }

  it('classifies missing databases with a structured error', async () => {
    const archiveBytes = await readFixtureBytes('missing-db.zip');

    expect(() =>
      normalizeZipLibrary({
        archiveBytes,
        archiveFileName: 'missing-db.zip',
      }),
    ).toThrowError(LibraryNormalizationError);

    try {
      normalizeZipLibrary({
        archiveBytes,
        archiveFileName: 'missing-db.zip',
      });
      throw new Error('Expected missing-db.zip to fail normalization.');
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryNormalizationError);

      const normalizationError = error as LibraryNormalizationError;
      expect(normalizationError.code).toBe('MISSING_DATABASE');
      expect(normalizationError.failureClassification).toBe('missing-database');
      expect(normalizationError.context.expectedDatabasePath).toBe(
        'MissingDatabase.Data/sdb/sdb.eni',
      );
    }
  });

  it('classifies malformed archives with a structured error', async () => {
    const archiveBytes = await readFixtureBytes('malformed-archive.zip');

    try {
      normalizeZipLibrary({
        archiveBytes,
        archiveFileName: 'malformed-archive.zip',
      });
      throw new Error('Expected malformed-archive.zip to fail normalization.');
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryNormalizationError);

      const normalizationError = error as LibraryNormalizationError;
      expect(normalizationError.code).toBe('MALFORMED_ARCHIVE');
      expect(normalizationError.failureClassification).toBe('malformed-archive');
    }
  });

  it('rejects unsupported archive shapes with a structured error', () => {
    const archiveBytes = zipSync({
      'Wrapper/UnsupportedLibrary.Data/sdb/sdb.eni': new Uint8Array([1, 2, 3]),
      'Wrapper/UnsupportedLibrary.enl': new Uint8Array([4, 5, 6]),
    });

    try {
      normalizeZipLibrary({
        archiveBytes,
        archiveFileName: 'unsupported-wrapper.zip',
      });
      throw new Error('Expected unsupported-wrapper.zip to fail normalization.');
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryNormalizationError);

      const normalizationError = error as LibraryNormalizationError;
      expect(normalizationError.code).toBe('UNSUPPORTED_ARCHIVE_SHAPE');
      expect(normalizationError.failureClassification).toBe(
        'unsupported-archive-shape',
      );
    }
  });
});

async function readFixtureBytes(archiveFileName: string): Promise<Uint8Array> {
  const buffer = await readFile(resolve(fixturesDir, archiveFileName));
  return new Uint8Array(buffer);
}

function summarisePreparedLibrary(
  library: ReturnType<typeof normalizeZipLibrary>,
): object {
  return {
    attachmentFiles: library.attachments.files.map((file) => ({
      kind: file.kind,
      relativePath: file.relativePath,
      subtreeRelativePath: file.subtreeRelativePath,
    })),
    attachmentRootRelativePath: library.attachments.rootRelativePath,
    database: {
      archivePath: library.database.archivePath,
      byteLength: library.database.bytes.byteLength,
      relativePath: library.database.relativePath,
    },
    displayName: library.displayName,
    filePaths: library.files.map((file) => file.relativePath),
    id: library.id,
    identity: {
      dataDirectoryRelativePath: library.identity.dataDirectoryRelativePath,
      libraryRelativePath: library.identity.libraryRelativePath,
      packageRelativePath: library.identity.packageRelativePath,
      sourceShape: library.identity.sourceShape,
      stem: library.identity.stem,
    },
    warnings: library.warnings,
  };
}
