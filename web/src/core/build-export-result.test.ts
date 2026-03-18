/**
 * Tests for export result building.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { EndnoteQueryResult } from '../types/query-results';
import type { EndnoteReferenceRow } from '../types/query-results';
import type { PreparedLibrary } from './library-types';
import type { AttachmentExportOptions, ExportResult } from '../types/export-result';
import {
  createExportContext,
  buildExportResult,
  buildExportMetadata,
  buildConversionStats,
  addWarning,
  getReferenceAttachments,
  hasMissingAttachmentPayloads,
} from './build-export-result';

function buildReferenceRow(
  overrides: Partial<EndnoteReferenceRow> = {},
): EndnoteReferenceRow {
  return {
    abstract: null,
    access_date: null,
    accession_number: null,
    added_to_library: null,
    alt_title: null,
    alternate_title: null,
    author: null,
    author_address: null,
    custom_1: null,
    custom_2: null,
    custom_3: null,
    custom_7: null,
    database_provider: null,
    date: null,
    edition: null,
    electronic_resource_number: null,
    id: 1,
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
    secondary_title: null,
    section: null,
    short_title: null,
    title: 'Synthetic Title',
    trash_state: 0,
    type_of_work: null,
    url: null,
    volume: null,
    year: null,
    ...overrides,
  };
}

describe('Export context and result building', () => {
  let queryResult: EndnoteQueryResult;
  let library: PreparedLibrary;

  beforeEach(() => {
    queryResult = {
      attachmentRows: [
        { refs_id: 1, file_path: 'paper1.pdf' },
        { refs_id: 2, file_path: 'paper2.pdf' },
      ],
      attachmentsByReferenceId: {
        '1': ['paper1.pdf'],
        '2': ['paper2.pdf'],
      },
      databaseArchivePath: '/library.Data/sdb/sdb.eni',
      databaseRelativePath: 'library.Data/sdb/sdb.eni',
      libraryId: 'test-library',
      referenceRows: [
        buildReferenceRow({
          author: 'Ada Lovelace\nCharles Babbage',
          electronic_resource_number: '10.1000/example-doi',
          id: 1,
          secondary_title: 'Journal of Browser-local Fixtures',
          title: 'Record One',
          year: '2026',
        }),
        buildReferenceRow({
          author: null,
          electronic_resource_number: 'https://doi.org/10.1000/example-two',
          id: 2,
          secondary_title: null,
          title: '',
          year: null,
        }),
      ],
      summary: {
        attachmentRowCount: 2,
        referenceRowCount: 2,
      },
    };

    library = {
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
        files: [
          {
            archivePath: 'library.Data/PDF/paper1.pdf',
            kind: 'pdf',
            relativePath: 'library.Data/PDF/paper1.pdf',
            size: 10,
            source: 'zip-entry',
            subtreeRelativePath: 'paper1.pdf',
          },
          {
            archivePath: 'library.Data/PDF/paper2.pdf',
            kind: 'pdf',
            relativePath: 'library.Data/PDF/paper2.pdf',
            size: 12,
            source: 'zip-entry',
            subtreeRelativePath: 'paper2.pdf',
          },
        ],
      },
      files: [],
      fileMap: {},
      warnings: [],
    };
  });

  describe('createExportContext', () => {
    it('should create export context with attachment resolution', () => {
      const context = createExportContext(queryResult, library);

      expect(context.queryResult).toEqual(queryResult);
      expect(context.library).toEqual(library);
      expect(context.attachmentResolution.mode).toBe('metadata-only-no-links');
      expect(context.attachmentResolution.linkedAttachmentCount).toBe(0);
      expect(context.attachmentResolution.totalAttachments).toBe(2);
      expect(context.warnings).toHaveLength(0);
      expect(context.startTimeMs).toBeGreaterThan(0);
    });

    it('should include attachment warnings in resolution', () => {
      const context = createExportContext(queryResult, library);

      expect(context.attachmentResolution.warnings).toHaveLength(1);
      const warning = context.attachmentResolution.warnings[0];
      expect(warning).toBeDefined();
      if (warning) {
        expect(warning.code).toBe('ATTACHMENT_LINKS_OMITTED');
      }
    });
  });

  describe('buildExportMetadata', () => {
    it('should build metadata from context', () => {
      const context = createExportContext(queryResult, library);
      const metadata = buildExportMetadata(context, {
        exportedRecordCount: 2,
        inputRecordCount: 2,
        skippedRecordCount: 0,
      });

      expect(metadata.attachmentMode).toBe('metadata-only-no-links');
      expect(metadata.inputRecordCount).toBe(2);
      expect(metadata.items).toEqual([
        {
          author: 'Ada Lovelace',
          doi: '10.1000/example-doi',
          doiUrl: 'https://doi.org/10.1000/example-doi',
          hasPdfAttachment: true,
          journal: 'Journal of Browser-local Fixtures',
          recordId: 1,
          title: 'Record One',
          year: '2026',
        },
        {
          author: '—',
          doi: '10.1000/example-two',
          doiUrl: 'https://doi.org/10.1000/example-two',
          hasPdfAttachment: true,
          journal: '—',
          recordId: 2,
          title: 'Untitled record',
          year: '—',
        },
      ]);
      expect(metadata.linkedAttachmentCount).toBe(0);
      expect(metadata.recordCount).toBe(2);
      expect(metadata.skippedRecordCount).toBe(0);
      expect(metadata.attachmentCount).toBe(2);
      expect(metadata.referenceCountWithAttachments).toBe(2);
      expect(metadata.missingAttachmentPayloadCount).toBe(0);
      expect(metadata.libraryId).toBe('test-library');
      expect(metadata.libraryDisplayName).toBe('Test Library');
      expect(metadata.warnings).toHaveLength(1);
    });

    it('should include custom warnings', () => {
      const context = createExportContext(queryResult, library);
      addWarning(context, 'RECORD_SKIPPED', 'Test warning', 123);

      const metadata = buildExportMetadata(context, {
        exportedRecordCount: 1,
        inputRecordCount: 2,
        skippedRecordCount: 1,
      });

      expect(metadata.warnings).toHaveLength(2);
      const firstWarning = metadata.warnings[0];
      expect(firstWarning).toBeDefined();
      if (firstWarning) {
        expect(firstWarning.code).toBe('RECORD_SKIPPED');
        expect(firstWarning.recordId).toBe(123);
      }
      // Attachment warnings come after custom warnings
      const secondWarning = metadata.warnings[1];
      expect(secondWarning).toBeDefined();
      if (secondWarning) {
        expect(secondWarning.code).toBe('ATTACHMENT_LINKS_OMITTED');
      }
    });
  });

  describe('buildExportResult', () => {
    it('should build complete export result', () => {
      const context = createExportContext(queryResult, library);
      const xml = '<xml><records></records></xml>';

      const result = buildExportResult(xml, context, {
        exportedRecordCount: 2,
        inputRecordCount: 2,
        skippedRecordCount: 0,
      });

      expect(result.xml).toBe(xml);
      expect(result.metadata.attachmentMode).toBe('metadata-only-no-links');
      expect(result.metadata.inputRecordCount).toBe(2);
      expect(result.metadata.linkedAttachmentCount).toBe(0);
      expect(result.metadata.recordCount).toBe(2);
      expect(result.metadata.skippedRecordCount).toBe(0);
      expect(result.metadata.attachmentCount).toBe(2);
    });
  });

  describe('buildConversionStats', () => {
    it('should build conversion statistics', () => {
      const context = createExportContext(queryResult, library);
      const xml = '<xml><records></records></xml>';
      const result = buildExportResult(xml, context, {
        exportedRecordCount: 2,
        inputRecordCount: 2,
        skippedRecordCount: 0,
      });
      const startTimeMs = context.startTimeMs;

      const stats = buildConversionStats(result, startTimeMs);

      expect(stats.recordCount).toBe(2);
      expect(stats.attachmentCount).toBe(2);
      expect(stats.warningCount).toBe(1);
      expect(stats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('addWarning', () => {
    it('should add warning to context', () => {
      const context = createExportContext(queryResult, library);

      addWarning(context, 'INVALID_TIMESTAMP', 'Invalid timestamp', 456);

      expect(context.warnings).toHaveLength(1);
      const warning = context.warnings[0];
      expect(warning).toBeDefined();
      if (warning) {
        expect(warning.code).toBe('INVALID_TIMESTAMP');
        expect(warning.message).toBe('Invalid timestamp');
        expect(warning.recordId).toBe(456);
      }
    });

    it('should add warning without record ID', () => {
      const context = createExportContext(queryResult, library);

      addWarning(context, 'RECORD_SKIPPED', 'Record skipped');

      expect(context.warnings).toHaveLength(1);
      const warning = context.warnings[0];
      expect(warning).toBeDefined();
      if (warning) {
        expect('recordId' in warning).toBe(false);
      }
    });
  });

  describe('getReferenceAttachments', () => {
    it('should return attachments for reference', () => {
      const context = createExportContext(queryResult, library);

      const attachments = getReferenceAttachments(context, 1);

      expect(attachments).not.toBeNull();
      expect(attachments?.count).toBe(1);
      expect(attachments?.relativePaths).toEqual(['paper1.pdf']);
    });

    it('should return null for reference without attachments', () => {
      const context = createExportContext(queryResult, library);

      const attachments = getReferenceAttachments(context, 999);

      expect(attachments).toBeNull();
    });
  });

  describe('hasMissingAttachmentPayloads', () => {
    it('should return false when all payloads present', () => {
      const context = createExportContext(queryResult, library);

      expect(hasMissingAttachmentPayloads(context)).toBe(false);
    });

    it('should return true when payloads are missing', () => {
      library.attachments.files = [];

      const context = createExportContext(queryResult, library);

      expect(hasMissingAttachmentPayloads(context)).toBe(true);
    });
  });

  describe('ExportResult type checking', () => {
    it('should produce valid ExportResult', () => {
      const context = createExportContext(queryResult, library);
      const xml = '<xml><records></records></xml>';
      const result = buildExportResult(xml, context, {
        exportedRecordCount: 2,
        inputRecordCount: 2,
        skippedRecordCount: 0,
      });

      // Type check: ensure result conforms to ExportResult interface
      const metadata = result.metadata;
      const typedResult: ExportResult = {
        xml: result.xml,
        metadata: {
          ...(metadata.attachmentBaseLibraryPath
            ? { attachmentBaseLibraryPath: metadata.attachmentBaseLibraryPath }
            : {}),
          attachmentMode: metadata.attachmentMode,
          inputRecordCount: metadata.inputRecordCount,
          recordCount: metadata.recordCount,
          skippedRecordCount: metadata.skippedRecordCount,
          attachmentCount: metadata.attachmentCount,
          linkedAttachmentCount: metadata.linkedAttachmentCount,
          missingAttachmentPayloadCount: metadata.missingAttachmentPayloadCount,
          referenceCountWithAttachments: metadata.referenceCountWithAttachments,
          items: metadata.items,
          warnings: metadata.warnings,
          libraryId: metadata.libraryId,
          libraryDisplayName: metadata.libraryDisplayName,
        },
      };

      expect(typedResult.xml).toBe(xml);
      expect(typedResult.metadata.attachmentMode).toBe('metadata-only-no-links');
    });

    it('should carry user-supplied attachment path metadata when links are exported', () => {
      const options: AttachmentExportOptions = {
        baseLibraryPath: '/Users/alice/Documents',
      };
      const context = createExportContext(queryResult, library, options);

      const result = buildExportResult('<xml/>', context, {
        exportedRecordCount: 0,
        inputRecordCount: 0,
        skippedRecordCount: 0,
      });

      expect(result.metadata.attachmentMode).toBe('base-library-path-links');
      expect(result.metadata.attachmentBaseLibraryPath).toBe('/Users/alice/Documents');
      expect(result.metadata.linkedAttachmentCount).toBe(2);
    });
  });
});
