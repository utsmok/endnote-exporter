import { describe, expect, it } from 'vitest';

import {
  canonicalizeXml,
  convertZipLibrary,
  countXmlRecords,
  endnoteExampleLibraryZip,
  expectValidXml,
  materializePdfRootPlaceholder,
  readGoldenFile,
  realSampleExpectations,
  stripPdfUrls,
  testingDir,
} from '../test/repo-fixtures';

const fixturesDir = `${testingDir}/browser-local/fixtures`;

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
      const { result } = await convertZipLibrary(`${fixturesDir}/${archiveFileName}`);
      const goldenXml = await readGoldenFile(goldenFileName);

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
    const { result } = await convertZipLibrary(`${fixturesDir}/attachment-present.zip`);
    const goldenXml = await readGoldenFile('attachment-present.xml');

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

  it('matches the checked-in real-sample golden for the zip path while omitting unresolved PDF links', async () => {
    const { library, result } = await convertZipLibrary(endnoteExampleLibraryZip, {
      baseLibraryPath: '/virtual/grietha.enl',
    });
    const goldenXml = await readGoldenFile('endnote-example-library.xml');

    expect(library.attachments.files).toEqual([]);
    expectValidXml(result.xml);
    expect(result.xml).not.toContain('<pdf-urls>');
    expect(canonicalizeXml(result.xml)).toEqual(canonicalizeXml(goldenXml));
    expect(countXmlRecords(result.xml)).toBe(realSampleExpectations.exportedRecordCount);
    expect(result.metadata.inputRecordCount).toBe(realSampleExpectations.inputRecordCount);
    expect(result.metadata.recordCount).toBe(realSampleExpectations.exportedRecordCount);
    expect(result.metadata.attachmentCount).toBe(realSampleExpectations.attachmentCount);
    expect(result.metadata.referenceCountWithAttachments).toBe(
      realSampleExpectations.referenceCountWithAttachments,
    );
    expect(result.metadata.missingAttachmentPayloadCount).toBe(
      realSampleExpectations.missingAttachmentPayloadCount,
    );
    expect(result.metadata.linkedAttachmentCount).toBe(0);
    expect(result.metadata.attachmentMode).toBe('base-library-path-links');
    expect(result.metadata.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ATTACHMENT_LINKS_OMITTED' }),
        expect.objectContaining({ code: 'ATTACHMENT_PAYLOAD_MISSING' }),
      ]),
    );
  });

  it('emits verified PDF file paths when a payload-backed fixture is converted with a library base path', async () => {
    const baseLibraryPath = '/virtual/AttachmentLibrary.enl';
    const { result } = await convertZipLibrary(`${fixturesDir}/attachment-present.zip`, {
      baseLibraryPath,
    });
    const goldenXml = await readGoldenFile('attachment-present.xml');

    expectValidXml(result.xml);
    expect(canonicalizeXml(result.xml)).toEqual(
      canonicalizeXml(
        materializePdfRootPlaceholder(
          goldenXml,
          '/virtual/AttachmentLibrary.Data/PDF',
        ),
      ),
    );
    expect(result.xml).toContain('<pdf-urls>');
    expect(result.metadata.attachmentMode).toBe('base-library-path-links');
    expect(result.metadata.linkedAttachmentCount).toBe(1);
    expect(result.metadata.missingAttachmentPayloadCount).toBe(0);
    expect(result.metadata.warnings).toEqual([]);
  });
});
