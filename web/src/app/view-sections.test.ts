import { describe, expect, it } from 'vitest';

import { renderAppView } from './view-sections';
import { createInitialState, withAttachmentBasePath, withExportResult, withPendingFile, withStatus, type AppState } from './state';
import type { BrowserRuntimeInfo } from '../adapters/browser-runtime';
import type { ExportResult } from '../types/export-result';

function buildRuntime(): BrowserRuntimeInfo {
  return {
    directoryIntake: {
      available: false,
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
      attachmentBaseLibraryPath: '/Users/me/Documents/MyLibrary.enlp',
      attachmentCount: 2,
      attachmentMode: 'base-library-path-links',
      inputRecordCount: 2,
      items: [
        {
          author: 'Ada Lovelace',
          doi: '10.1000/test-doi',
          doiUrl: 'javascript:alert(1)',
          hasPdfAttachment: true,
          journal: 'Journal of Test Automation',
          recordId: 1,
          title: 'Record 1',
          year: '2026',
        },
      ],
      libraryDisplayName: 'Test Library',
      libraryId: 'test-library',
      linkedAttachmentCount: 2,
      missingAttachmentPayloadCount: 0,
      recordCount: 1,
      referenceCountWithAttachments: 1,
      skippedRecordCount: 0,
      warnings: [
        {
          code: 'RECORD_SKIPPED',
          message: 'Record 3 could not be converted.',
          recordId: 3,
        },
      ],
      ...overrides,
    },
  };
}

function buildSelectingState(): AppState {
  return withStatus(
    {
      ...createInitialState(buildRuntime()),
      phase: 'selecting-input',
      workerStatus: 'ready',
    },
    {
      message: 'Upload a ZIP file to get started.',
      severity: 'informational',
      title: 'Ready to convert',
      workflowStage: 'intake',
    },
  );
}

describe('renderAppView', () => {
  it('renders the redesigned input panel with disabled actions by default', () => {
    const view = renderAppView(buildSelectingState());

    expect(view).toContain('id="zip-file-input"');
    expect(view).toContain('id="zip-dropzone"');
    expect(view).toContain('id="remove-file-button"');
    expect(view).toContain('id="create-xml-button"');
    expect(view).toContain('id="attachment-base-path"');
    expect(view).toContain('Browse to select library folder');
    expect(view).toMatch(/Browse to select library folder[\s\S]*disabled/);
    expect(view).toContain('upload-dropzone--default');
    expect(view).toContain('Create XML');
    expect(view).toMatch(/id="create-xml-button"[^>]*disabled/);
  });

  it('renders the queued-file success state with formatted size and enabled create action', () => {
    const queuedState = withAttachmentBasePath(
      withPendingFile(buildSelectingState(), { name: 'library.zip', size: 1536 } as File),
      '/Users/me/Documents/MyLibrary.enlp',
    );
    const state = withStatus(queuedState, {
      message: 'library.zip is ready. Add the library location to include PDF links, then create the XML.',
      severity: 'success',
      title: 'ZIP queued',
      workflowStage: 'intake',
    });

    const view = renderAppView(state);

    expect(view).toContain('upload-dropzone--ready');
    expect(view).toContain('library.zip');
    expect(view).toContain('1.5 KB');
    expect(view).toContain('id="create-xml-button"');
    expect(view).not.toMatch(/id="create-xml-button"[^>]*disabled/);
  });

  it('renders the invalid file state when intake validation fails', () => {
    const state = withStatus(
      withPendingFile(buildSelectingState(), null, 'invalid-type'),
      {
        message: 'Please select a ZIP file containing your EndNote library (.enl + .Data folder, or .enlp package contents).',
        severity: 'warning',
        title: 'Invalid file',
        workflowStage: 'intake',
      },
    );

    const view = renderAppView(state);

    expect(view).toContain('upload-dropzone--invalid');
    expect(view).toContain('role="alert"');
    expect(view).toContain('Please select a ZIP file containing your EndNote library');
  });

  it('renders a results accordion and strips unsafe DOI href values', () => {
    const state = withStatus(
      withExportResult(buildSelectingState(), buildExportResult()),
      {
        message: 'ZIP conversion completed. Review the results and download the XML when you\'re ready.',
        severity: 'success',
        title: 'Conversion complete',
        workflowStage: 'review',
      },
    );

    const view = renderAppView(state);

    expect(view).toContain('<details class="records-accordion" open>');
    expect(view).toContain('id="download-button"');
    expect(view).toContain('id="convert-another-button"');
    expect(view).toContain('Warnings');
    expect(view).not.toContain('href="javascript:alert(1)"');
    expect(view).toContain('10.1000/test-doi');
  });

  it('renders a neutral warnings empty state when no warnings are present', () => {
    const state = withStatus(
      withExportResult(buildSelectingState(), buildExportResult({ warnings: [] })),
      {
        message: 'ZIP conversion completed. Review the results and download the XML when you\'re ready.',
        severity: 'success',
        title: 'Conversion complete',
        workflowStage: 'review',
      },
    );

    const view = renderAppView(state);

    expect(view).toContain('Warnings');
    expect(view).toContain('No warnings detected.');
  });

  it('renders the redesigned error panel from state status text and recovery action', () => {
    const errorState = withStatus(
      {
        ...buildSelectingState(),
        notes: ['Worker initialisation failed.'],
        phase: 'worker-error',
        recoveryGuidance: [
          {
            detail: 'Reload the page and try again.',
            label: 'Reload the page',
          },
        ],
      },
      {
        message: 'Something went wrong on startup. Try reloading the page.',
        recoveryGuidance: [
          {
            detail: 'Reload the page and try again.',
            label: 'Reload the page',
          },
        ],
        severity: 'error',
        title: 'Startup failed',
        workflowStage: 'recovery',
      },
    );

    const view = renderAppView(errorState);

    expect(view).toContain('Something went wrong');
    expect(view).toContain('Startup failed');
    expect(view).toContain('Something went wrong on startup. Try reloading the page.');
    expect(view).toContain('id="retry-button"');
  });
});
