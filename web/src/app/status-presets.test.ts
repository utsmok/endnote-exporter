import { describe, expect, it } from 'vitest';

import {
  buildConversionCompleteStatus,
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

    expect(status.title).toBe('Ready for intake');
    expect(status.severity).toBe('informational');
    expect(status.workflowStage).toBe('intake');
    expect(status.message).toContain('ZIP upload is the supported baseline');
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
});
