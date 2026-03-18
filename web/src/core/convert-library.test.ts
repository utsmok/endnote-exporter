import { afterEach, describe, expect, it, vi } from 'vitest';

import { convertLibrary } from './convert-library';
import type { PreparedLibrary } from './library-types';
import type { EndnoteQueryResult, EndnoteReferenceRow } from '../types/query-results';
import * as mapRecordModule from './map-record';
import * as exportXmlModule from './export-xml';

function buildReferenceRow(
  id: number,
  overrides: Partial<EndnoteReferenceRow> = {},
): EndnoteReferenceRow {
  return {
    abstract: null,
    access_date: null,
    accession_number: null,
    added_to_library: null,
    alt_title: null,
    alternate_title: null,
    author: 'Ada Lovelace',
    author_address: null,
    custom_1: null,
    custom_2: null,
    custom_3: null,
    custom_7: null,
    database_provider: null,
    date: null,
    edition: null,
    electronic_resource_number: null,
    id,
    isbn: null,
    keywords: null,
    label: null,
    language: null,
    name_of_database: null,
    notes: null,
    number: null,
    pages: null,
    place_published: null,
    publisher: null,
    record_last_updated: null,
    reference_type: 0,
    secondary_author: null,
    secondary_title: 'Journal of Fixtures',
    section: null,
    short_title: null,
    title: `Record ${id}`,
    trash_state: 0,
    type_of_work: null,
    url: null,
    volume: null,
    year: '2026',
    ...overrides,
  };
}

function buildLibrary(): PreparedLibrary {
  return {
    attachments: {
      files: [],
      rootRelativePath: 'TestLibrary.Data/PDF',
    },
    database: {
      archivePath: 'TestLibrary.Data/sdb/sdb.eni',
      bytes: new ArrayBuffer(0),
      relativePath: 'TestLibrary.Data/sdb/sdb.eni',
    },
    displayName: 'Test Library',
    fileMap: {},
    files: [],
    id: 'prepared-library:zipped-enl-data:test-library',
    identity: {
      archiveFileName: 'test-library.zip',
      dataDirectoryName: 'TestLibrary.Data',
      dataDirectoryRelativePath: 'TestLibrary.Data',
      displayName: 'Test Library',
      id: 'prepared-library:zipped-enl-data:test-library',
      libraryFileName: 'TestLibrary.enl',
      libraryRelativePath: 'TestLibrary.enl',
      packageRelativePath: null,
      sourceShape: 'zipped-enl-data',
      stem: 'TestLibrary',
    },
    libraryFile: {
      archivePath: 'TestLibrary.enl',
      relativePath: 'TestLibrary.enl',
      size: 0,
      source: 'zip-entry',
    },
    sourceKind: 'zip',
    warnings: [],
  };
}

function buildQueryResult(referenceRows: EndnoteReferenceRow[]): EndnoteQueryResult {
  return {
    attachmentRows: [],
    attachmentsByReferenceId: {},
    databaseArchivePath: 'TestLibrary.Data/sdb/sdb.eni',
    databaseRelativePath: 'TestLibrary.Data/sdb/sdb.eni',
    libraryId: 'prepared-library:zipped-enl-data:test-library',
    referenceRows,
    summary: {
      attachmentRowCount: 0,
      referenceRowCount: referenceRows.length,
    },
  };
}

describe('convertLibrary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips mapping failures per record instead of failing the whole export', () => {
    const originalMapRecord = mapRecordModule.mapRecord;
    vi.spyOn(mapRecordModule, 'mapRecord').mockImplementation((ref) => {
      if (ref.id === 2) {
        throw new Error('synthetic mapping failure');
      }

      return originalMapRecord(ref);
    });

    const result = convertLibrary(
      buildQueryResult([buildReferenceRow(1), buildReferenceRow(2)]),
      buildLibrary(),
    );

    expect(result.metadata.inputRecordCount).toBe(2);
    expect(result.metadata.recordCount).toBe(1);
    expect(result.metadata.skippedRecordCount).toBe(1);
    expect(result.metadata.warnings).toContainEqual(
      expect.objectContaining({
        code: 'RECORD_SKIPPED',
        recordId: 2,
      }),
    );
    expect(result.xml).toContain('<rec-number>1</rec-number>');
    expect(result.xml).not.toContain('<rec-number>2</rec-number>');
  });

  it('skips serialization failures per record instead of failing the whole export', () => {
    const originalSerialize = exportXmlModule.serializeRecordXmlFragment;
    vi.spyOn(exportXmlModule, 'serializeRecordXmlFragment').mockImplementation((record) => {
      if (record['rec-number'] === 2) {
        throw new Error('synthetic serialization failure');
      }

      return originalSerialize(record);
    });

    const result = convertLibrary(
      buildQueryResult([buildReferenceRow(1), buildReferenceRow(2)]),
      buildLibrary(),
    );

    expect(result.metadata.inputRecordCount).toBe(2);
    expect(result.metadata.recordCount).toBe(1);
    expect(result.metadata.skippedRecordCount).toBe(1);
    expect(result.metadata.warnings).toContainEqual(
      expect.objectContaining({
        code: 'RECORD_SKIPPED',
        recordId: 2,
      }),
    );
    expect(result.xml).toContain('<rec-number>1</rec-number>');
    expect(result.xml).not.toContain('<rec-number>2</rec-number>');
  });

  it('emits pdf-urls when a user-supplied library location and verified attachment payload are available', () => {
    const library = buildLibrary();
    library.attachments.files.push({
      archivePath: 'TestLibrary.Data/PDF/group-1/paper.pdf',
      kind: 'pdf',
      relativePath: 'TestLibrary.Data/PDF/group-1/paper.pdf',
      size: 10,
      source: 'zip-entry',
      subtreeRelativePath: 'group-1/paper.pdf',
    });

    const result = convertLibrary(
      {
        ...buildQueryResult([buildReferenceRow(1)]),
        attachmentRows: [{ refs_id: 1, file_path: 'group-1/paper.pdf' }],
        attachmentsByReferenceId: {
          '1': ['group-1/paper.pdf'],
        },
        summary: {
          attachmentRowCount: 1,
          referenceRowCount: 1,
        },
      },
      library,
      { baseLibraryPath: '/Users/alice/Documents' },
    );

    expect(result.metadata.attachmentMode).toBe('base-library-path-links');
    expect(result.metadata.linkedAttachmentCount).toBe(1);
    expect(result.xml).toContain('<pdf-urls>');
    expect(result.xml).toContain('/Users/alice/Documents/TestLibrary.Data/PDF/group-1/paper.pdf');
  });
});
