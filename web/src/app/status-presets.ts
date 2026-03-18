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
    'Ready for intake',
    runtime.directoryIntake.available
      ? 'ZIP upload is the supported baseline. The folder picker is available as an experimental capability in this browser.'
      : 'ZIP upload is the supported baseline for this browser session.',
    'informational',
    'intake',
  );
}

export function buildUnsupportedLaunchStatus(): StatusDescriptor {
  return createStatus(
    'Served mode required',
    'Open this workspace through the Vite dev or preview server. Direct file launch is intentionally unsupported.',
    'error',
    'recovery',
    [
      createRecoveryGuidance(
        'Serve the workspace',
        'Use the canonical served-mode launch path instead of opening the application with file://.',
      ),
      createRecoveryGuidance(
        'Use the desktop fallback when required',
        'The Python desktop exporter remains the fallback for workflows that need desktop runtime behavior.',
      ),
    ],
  );
}

export function buildWorkerUnavailableStatus(): StatusDescriptor {
  return createStatus(
    'Worker support unavailable',
    'Dedicated workers are required for the browser-local pipeline baseline in served mode.',
    'error',
    'recovery',
    [
      createRecoveryGuidance(
        'Check browser capability',
        'Verify that the current browser context allows ES module workers and that privacy tooling is not blocking them.',
      ),
      createRecoveryGuidance(
        'Retry in a supported browser',
        'Chromium-class served-mode execution remains the primary browser-local baseline.',
      ),
    ],
  );
}

export function buildInitialisationFailureStatus(): StatusDescriptor {
  return createStatus(
    'Worker initialisation failed',
    'The browser-local pipeline could not be initialised. Review the recovery notes and retry in a clean served session.',
    'error',
    'recovery',
    [
      createRecoveryGuidance(
        'Reload the served session',
        'A clean reload often resolves transient worker bootstrap failures without changing local input data.',
      ),
      createRecoveryGuidance(
        'Fall back to the desktop exporter if required',
        'Use the Python desktop application when the browser runtime remains blocked.',
      ),
    ],
  );
}

export function buildInputRejectedStatus(): StatusDescriptor {
  return createStatus(
    'ZIP archive required',
    'Choose a ZIP archive that contains either an .enl library with its sibling .Data directory or packaged .enlp contents.',
    'warning',
    'intake',
  );
}

export function buildDirectoryCancelledStatus(): StatusDescriptor {
  return createStatus(
    'Folder selection cancelled',
    'No folder was selected. ZIP upload remains available as the supported baseline path.',
    'informational',
    'intake',
  );
}

export function buildConvertingStatus(selectedInputLabel: string): StatusDescriptor {
  return createStatus(
    'Generating Zotero XML',
    `Preparing and converting ${selectedInputLabel} inside the worker-backed browser-local pipeline.`,
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
        'The XML is available, but warning and skipped-record details should be checked before import into Zotero.',
      ),
    );
  }

  if (attachmentCount > 0 && attachmentMode === 'metadata-only-no-links') {
    recoveryGuidance.push(
      createRecoveryGuidance(
        'Supply a library location only if PDF links are required',
        'Browser-local mode does not auto-discover native absolute paths. Add a library location only when exported PDF links are needed.',
      ),
    );
  }

  if (linkedAttachmentCount > 0 && missingAttachmentPayloadCount > 0) {
    recoveryGuidance.push(
      createRecoveryGuidance(
        'Check partial attachment coverage',
        'Some verified PDF links were emitted, but at least one attachment payload was missing from the selected input.',
      ),
    );
  }

  if (!hasDegradedCompletion) {
    return createStatus(
      'Conversion complete',
      `${sourceLabel} completed successfully. Review the workspace and download the XML when ready.`,
      'success',
      'review',
      recoveryGuidance,
    );
  }

  return createStatus(
    'Completed with warnings',
    `${sourceLabel} completed, but review is required before import because degradation was detected in the result metadata.`,
    'warning',
    'review',
    recoveryGuidance,
  );
}

export function buildConversionFailureStatus(source: 'directory' | 'zip'): StatusDescriptor {
  const sourceLabel = source === 'directory' ? 'Folder conversion' : 'ZIP conversion';

  return createStatus(
    `${sourceLabel} failed`,
    `${sourceLabel} could not be completed in the current browser session. Review the error notes and retry with a validated library input.`,
    'error',
    'recovery',
    [
      createRecoveryGuidance(
        'Retry with the supported baseline path',
        'Prefer the ZIP-first path when folder intake is unavailable or unstable in the current browser.',
      ),
      createRecoveryGuidance(
        'Verify library completeness',
        'Malformed archives, incomplete library layouts, or blocked worker execution can invalidate the current attempt.',
      ),
    ],
  );
}
