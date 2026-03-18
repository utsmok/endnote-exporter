import { describe, expect, it } from 'vitest';

import {
  getAttachmentsForReference,
  getReferenceCountWithAttachments,
  referenceHasAttachments,
  resolveAttachments,
} from './resolve-attachments';
import type { PreparedLibrary } from './library-types';
import type { EndnoteQueryResult } from '../types/query-results';

function buildLibrary(attachmentPaths: string[] = []): PreparedLibrary {
  return {
    id: 'test-library',
    displayName: 'Test Library',
    sourceKind: 'zip',
    identity: {
      id: 'test-library',
      displayName: 'Test Library',
      stem: 'library',
      libraryFileName: 'library.enl',
      libraryRelativePath: 'library.enl',
      dataDirectoryName: 'library.Data',
      dataDirectoryRelativePath: 'library.Data',
      packageRelativePath: null,
      sourceShape: 'zipped-enl-data',
      archiveFileName: 'library.zip',
    },
    libraryFile: {
      archivePath: 'library.enl',
      relativePath: 'library.enl',
      size: 0,
      source: 'zip-entry',
    },
    database: {
      bytes: new ArrayBuffer(0),
      archivePath: 'library.Data/sdb/sdb.eni',
      relativePath: 'library.Data/sdb/sdb.eni',
    },
    attachments: {
      rootRelativePath: 'library.Data/PDF',
      files: attachmentPaths.map((subtreeRelativePath) => ({
        archivePath: `library.Data/PDF/${subtreeRelativePath}`,
        kind: 'pdf',
        relativePath: `library.Data/PDF/${subtreeRelativePath}`,
        size: 1,
        source: 'zip-entry',
        subtreeRelativePath,
      })),
    },
    files: [],
    fileMap: {},
    warnings: [],
  };
}

function buildQueryResult(
  attachmentsByReferenceId: Record<string, string[]>,
): EndnoteQueryResult {
  const attachmentRows = Object.entries(attachmentsByReferenceId).flatMap(([referenceId, filePaths]) =>
    filePaths.map((filePath) => ({ file_path: filePath, refs_id: Number(referenceId) })),
  );

  return {
    attachmentRows,
    attachmentsByReferenceId,
    databaseArchivePath: '/library.Data/sdb/sdb.eni',
    databaseRelativePath: 'library.Data/sdb/sdb.eni',
    libraryId: 'test-library',
    referenceRows: [],
    summary: {
      attachmentRowCount: attachmentRows.length,
      referenceRowCount: Object.keys(attachmentsByReferenceId).length,
    },
  };
}

describe('resolveAttachments', () => {
  it('handles libraries with no attachments', () => {
    const result = resolveAttachments(buildQueryResult({}), buildLibrary());

    expect(result.mode).toBe('metadata-only-no-links');
    expect(result.linkedAttachmentCount).toBe(0);
    expect(result.totalAttachments).toBe(0);
    expect(result.missingAttachmentPayloadCount).toBe(0);
    expect(result.referenceCountWithAttachments).toBe(0);
    expect(result.byReferenceId).toEqual({});
    expect(result.warnings).toEqual([]);
  });

  it('counts verified attachments without exporting links by default', () => {
    const result = resolveAttachments(
      buildQueryResult({
        '1': ['paper1.pdf', 'supplement.pdf'],
        '2': ['paper2.pdf'],
      }),
      buildLibrary(['paper1.pdf', 'supplement.pdf', 'paper2.pdf']),
    );

    expect(result.mode).toBe('metadata-only-no-links');
    expect(result.linkedAttachmentCount).toBe(0);
    expect(result.totalAttachments).toBe(3);
    expect(result.missingAttachmentPayloadCount).toBe(0);
    expect(result.referenceCountWithAttachments).toBe(2);
    expect(result.byReferenceId[1]?.relativePaths).toEqual(['paper1.pdf', 'supplement.pdf']);
    expect(result.byReferenceId[2]?.relativePaths).toEqual(['paper2.pdf']);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'ATTACHMENT_LINKS_OMITTED' }),
    );
  });

  it('detects missing attachment payloads from unmatched relative paths', () => {
    const result = resolveAttachments(
      buildQueryResult({ '1': ['missing.pdf'] }),
      buildLibrary(),
    );

    expect(result.byReferenceId[1]?.hasMissingPayload).toBe(true);
    expect(result.missingAttachmentPayloadCount).toBe(1);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'ATTACHMENT_PAYLOAD_MISSING' }),
    );
  });

  it('exports verified PDF paths when a user-supplied library location is available', () => {
    const result = resolveAttachments(
      buildQueryResult({ '1': ['group-1/paper.pdf'] }),
      buildLibrary(['group-1/paper.pdf']),
      { baseLibraryPath: 'C:\\Users\\alice\\Documents' },
    );

    expect(result.mode).toBe('base-library-path-links');
    expect(result.linkedAttachmentCount).toBe(1);
    expect(result.byReferenceId[1]?.pdfUrls).toEqual([
      'C:\\Users\\alice\\Documents\\library.Data\\PDF\\group-1\\paper.pdf',
    ]);
    expect(result.warnings).toEqual([]);
  });
});

describe('attachment helpers', () => {
  it('returns attachments for existing references', () => {
    const resolution = resolveAttachments(
      buildQueryResult({ '1': ['paper.pdf'] }),
      buildLibrary(['paper.pdf']),
    );

    expect(getAttachmentsForReference(resolution, 1)?.count).toBe(1);
    expect(getAttachmentsForReference(resolution, 999)).toBeNull();
  });

  it('reports whether references have attachments and how many references have them', () => {
    const resolution = resolveAttachments(
      buildQueryResult({
        '1': ['paper1.pdf'],
        '2': ['paper2.pdf'],
        '3': ['paper3a.pdf', 'paper3b.pdf'],
      }),
      buildLibrary(['paper1.pdf', 'paper2.pdf', 'paper3a.pdf', 'paper3b.pdf']),
    );

    expect(referenceHasAttachments(resolution, 1)).toBe(true);
    expect(referenceHasAttachments(resolution, 4)).toBe(false);
    expect(getReferenceCountWithAttachments(resolution)).toBe(3);
  });
});
