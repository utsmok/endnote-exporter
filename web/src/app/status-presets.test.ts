import { describe, expect, it } from 'vitest';

import {
  buildConversionCompleteStatus,
  buildFileTypeErrorStatus,
  buildGenericErrorStatus,
  buildPdfPathErrorStatus,
  buildReadyStatus,
} from './status-presets';
import type { BrowserRuntimeInfo } from '../adapters/browser-runtime';
import type { ExportResult } from '../types/export-result';

function buildRuntime(directoryAvailable = false): BrowserRuntimeInfo {
  return {
    directoryIntake: {
      available: directoryAvailable,
      notes: [],
    },
    isSecureContext: true,
    isServedMode: true,
    location: 'http://127.0.0.1:4173/',
    notes: [],
    protocol: 'http:',
    workerSupported: true,
  };
}

function buildExportResult(overrides: Partial<ExportResult['metadata']> = {}): ExportResult {
  return {
    xml: '<xml><records/></xml>',
    metadata: {
      attachmentCount: 0,
      attachmentMode: 'metadata-only-no-links',
      inputRecordCount: 1,
      items: [],
      libraryDisplayName: 'Test Library',
      libraryId: 'test-library',
      linkedAttachmentCount: 0,
      missingAttachmentPayloadCount: 0,
      recordCount: 1,
      referenceCountWithAttachments: 0,
      skippedRecordCount: 0,
      warnings: [],
      ...overrides,
    },
  };
}

describe('status presets', () => {
  it('describes the ready state using intake-stage semantics', () => {
    const status = buildReadyStatus(buildRuntime(true));

    expect(status.title).toBe('Ready to convert');
    expect(status.severity).toBe('informational');
    expect(status.workflowStage).toBe('intake');
    expect(status.message).toContain('Upload a ZIP file to get started');
  });

  it('marks degraded completion as warning severity with recovery guidance', () => {
    const status = buildConversionCompleteStatus(buildExportResult({
      attachmentCount: 2,
      missingAttachmentPayloadCount: 1,
      skippedRecordCount: 1,
      warnings: [
        {
          code: 'RECORD_SKIPPED',
          message: 'Record 7 could not be converted.',
        },
      ],
    }), 'zip');

    expect(status.title).toBe('Completed with warnings');
    expect(status.severity).toBe('warning');
    expect(status.workflowStage).toBe('review');
    expect(status.recoveryGuidance).toHaveLength(2);
  });

  it('describes the missing library path error with recovery semantics', () => {
    const status = buildPdfPathErrorStatus();

    expect(status.title).toBe('Library location is required');
    expect(status.severity).toBe('error');
    expect(status.workflowStage).toBe('recovery');
    expect(status.message).toContain('original EndNote library folder or .enlp package path');
  });

  it('describes invalid library ZIP failures as file-specific recovery errors', () => {
    const status = buildFileTypeErrorStatus();

    expect(status.title).toBe('Library ZIP couldn’t be processed');
    expect(status.severity).toBe('error');
    expect(status.workflowStage).toBe('recovery');
    expect(status.message).toContain('complete EndNote library');
  });

  it('preserves provided detail for generic conversion errors', () => {
    const status = buildGenericErrorStatus('Unexpected worker failure');

    expect(status.title).toBe('The XML couldn’t be created');
    expect(status.severity).toBe('error');
    expect(status.workflowStage).toBe('recovery');
    expect(status.message).toBe('Unexpected worker failure');
  });
});
