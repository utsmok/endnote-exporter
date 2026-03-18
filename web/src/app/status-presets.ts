import type { BrowserRuntimeInfo } from '../adapters/browser-runtime';
import type { ExportResult } from '../types/export-result';
import type {
  RecoveryGuidance,
  StatusDescriptor,
} from './state';

function createStatus(
  title: string,
  message: string,
  severity: StatusDescriptor['severity'],
  workflowStage: StatusDescriptor['workflowStage'],
  recoveryGuidance: RecoveryGuidance[] = [],
  liveMessage = message,
): StatusDescriptor {
  return {
    liveMessage,
    message,
    recoveryGuidance,
    severity,
    title,
    workflowStage,
  };
}

function createRecoveryGuidance(label: string, detail: string): RecoveryGuidance {
  return { detail, label };
}

export function buildReadyStatus(runtime: BrowserRuntimeInfo): StatusDescriptor {
  return createStatus(
    'Ready to convert',
    runtime.directoryIntake.available
      ? 'Upload a ZIP file to get started. A folder picker is also available in this browser (experimental).'
      : 'Upload a ZIP file to get started.',
    'informational',
    'intake',
  );
}

export function buildUnsupportedLaunchStatus(): StatusDescriptor {
  return createStatus(
    'App not loaded correctly',
    'This app must be served through a local server — it cannot be opened directly as a file.',
    'error',
    'recovery',
    [
      createRecoveryGuidance(
        'Use the local server',
        'Open the app via the Vite dev or preview server instead of opening the HTML file directly.',
      ),
      createRecoveryGuidance(
        'Use the desktop app instead',
        'The Python desktop application remains available if you need to run the exporter outside a browser.',
      ),
    ],
  );
}

export function buildWorkerUnavailableStatus(): StatusDescriptor {
  return createStatus(
    'Browser not supported',
    "Your browser doesn't support the features needed to run this app.",
    'error',
    'recovery',
    [
      createRecoveryGuidance(
        'Check browser extensions',
        'Privacy extensions or enterprise policies may be blocking required browser features. Try disabling them.',
      ),
      createRecoveryGuidance(
        'Try a different browser',
        'Chrome or Edge are the best-supported browsers for this app.',
      ),
    ],
  );
}

export function buildInitialisationFailureStatus(): StatusDescriptor {
  return createStatus(
    'Startup failed',
    'Something went wrong on startup. Try reloading the page.',
    'error',
    'recovery',
    [
      createRecoveryGuidance(
        'Reload the page',
        "A fresh reload often resolves startup issues. Your files won't be affected.",
      ),
      createRecoveryGuidance(
        'Use the desktop app instead',
        'Use the Python desktop application if the issue keeps occurring.',
      ),
    ],
  );
}

export function buildInputRejectedStatus(): StatusDescriptor {
  return createStatus(
    'Invalid file',
    'Please select a ZIP file containing your EndNote library (.enl + .Data folder, or .enlp package contents).',
    'warning',
    'intake',
  );
}

export function buildDirectoryCancelledStatus(): StatusDescriptor {
  return createStatus(
    'No folder selected',
    'No folder was selected. You can still upload a ZIP file.',
    'informational',
    'intake',
  );
}

export function buildConvertingStatus(selectedInputLabel: string): StatusDescriptor {
  return createStatus(
    'Generating Zotero XML',
    `Converting ${selectedInputLabel}…`,
    'informational',
    'conversion',
  );
}

export function buildConversionCompleteStatus(
  result: ExportResult,
  source: 'directory' | 'zip',
): StatusDescriptor {
  const {
    attachmentCount,
    attachmentMode,
    linkedAttachmentCount,
    missingAttachmentPayloadCount,
    skippedRecordCount,
    warnings,
  } = result.metadata;

  const hasDegradedCompletion = warnings.length > 0 || skippedRecordCount > 0 || missingAttachmentPayloadCount > 0;
  const sourceLabel = source === 'directory' ? 'Folder conversion' : 'ZIP conversion';
  const recoveryGuidance: RecoveryGuidance[] = [];

  if (warnings.length > 0 || skippedRecordCount > 0) {
    recoveryGuidance.push(
      createRecoveryGuidance(
        'Review warnings before import',
        'The XML is available, but check warning and skipped-record details before importing into Zotero.',
      ),
    );
  }

  if (attachmentCount > 0 && attachmentMode === 'metadata-only-no-links') {
    recoveryGuidance.push(
      createRecoveryGuidance(
        'PDF links not included',
        "Browsers can't access local file paths automatically. Add a library location in the options if you need PDF links in the exported XML.",
      ),
    );
  }

  if (linkedAttachmentCount > 0 && missingAttachmentPayloadCount > 0) {
    recoveryGuidance.push(
      createRecoveryGuidance(
        'Partial PDF link coverage',
        'Some PDF links were exported, but at least one attachment file was missing from the uploaded ZIP.',
      ),
    );
  }

  if (!hasDegradedCompletion) {
    return createStatus(
      'Conversion complete',
      `${sourceLabel} completed. Review the results and download the XML when you're ready.`,
      'success',
      'review',
      recoveryGuidance,
    );
  }

  return createStatus(
    'Completed with warnings',
    `${sourceLabel} completed with warnings. Review before importing into Zotero.`,
    'warning',
    'review',
    recoveryGuidance,
  );
}

export function buildConversionFailureStatus(source: 'directory' | 'zip'): StatusDescriptor {
  const sourceLabel = source === 'directory' ? 'Folder conversion' : 'ZIP conversion';

  return createStatus(
    'Conversion failed',
    `${sourceLabel} failed. Check the error details below and try again with a valid library ZIP.`,
    'error',
    'recovery',
    [
      createRecoveryGuidance(
        'Try a ZIP file instead',
        'If you used the folder picker, try uploading a ZIP file instead.',
      ),
      createRecoveryGuidance(
        'Check library completeness',
        'Make sure the ZIP contains a valid EndNote library (.enl + .Data folder, or .enlp package contents).',
      ),
    ],
  );
}
