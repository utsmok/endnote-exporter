import type { BrowserRuntimeInfo } from '../adapters/browser-runtime';
import type { WorkerStatus } from '../types/worker';
import type { ExportResult } from '../types/export-result';

export type AppPhase =
  | 'booting'
  | 'ready'
  | 'unsupported-launch'
  | 'worker-error'
  | 'selecting-input'
  | 'converting'
  | 'conversion-complete'
  | 'conversion-error';

export type WorkflowStage = 'boot' | 'intake' | 'preparation' | 'conversion' | 'review' | 'recovery';

export type StatusSeverity = 'informational' | 'success' | 'warning' | 'error';

export interface RecoveryGuidance {
  detail: string;
  label: string;
}

export interface StatusDescriptor {
  liveMessage?: string;
  message: string;
  recoveryGuidance?: RecoveryGuidance[];
  severity: StatusSeverity;
  title: string;
  workflowStage: WorkflowStage;
}

export interface AppState {
  attachmentBasePath: string;
  downloadErrorMessage: string | undefined;
  isItemModalOpen: boolean;
  notes: string[];
  phase: AppPhase;
  recoveryGuidance: RecoveryGuidance[];
  runtime: BrowserRuntimeInfo;
  selectedInputLabel?: string;
  statusLiveMessage: string;
  statusMessage: string;
  statusSeverity: StatusSeverity;
  statusTitle: string;
  workflowStage: WorkflowStage;
  workerStatus: WorkerStatus;
  exportResult?: ExportResult;
}

export function createInitialState(runtime: BrowserRuntimeInfo): AppState {
  const statusMessage = runtime.isServedMode
    ? 'Getting ready…'
    : 'This app must be served through a local server — it cannot be opened directly as a file.';

  return {
    attachmentBasePath: '',
    downloadErrorMessage: undefined,
    isItemModalOpen: false,
    notes: [...runtime.notes],
    phase: 'booting',
    recoveryGuidance: [],
    runtime,
    statusLiveMessage: statusMessage,
    statusMessage,
    statusSeverity: 'informational',
    statusTitle: 'Initialising workspace',
    workflowStage: 'boot',
    workerStatus: 'starting',
  };
}

export function withPhase(state: AppState, phase: AppPhase): AppState {
  return { ...state, phase };
}

export function withAttachmentBasePath(state: AppState, attachmentBasePath: string): AppState {
  return { ...state, attachmentBasePath };
}

export function withStatus(state: AppState, status: StatusDescriptor): AppState {
  return {
    ...state,
    recoveryGuidance: status.recoveryGuidance ?? [],
    statusLiveMessage: status.liveMessage ?? status.message,
    statusMessage: status.message,
    statusSeverity: status.severity,
    statusTitle: status.title,
    workflowStage: status.workflowStage,
  };
}

export function withDownloadError(state: AppState, message: string): AppState {
  return { ...state, downloadErrorMessage: message };
}

export function clearDownloadError(state: AppState): AppState {
  const { downloadErrorMessage: _removed, ...rest } = state;
  return { ...rest, downloadErrorMessage: undefined };
}

export function withItemModalOpen(state: AppState, isItemModalOpen: boolean): AppState {
  return { ...state, isItemModalOpen };
}

export function withStatusMessage(state: AppState, message: string): AppState {
  return {
    ...state,
    statusLiveMessage: message,
    statusMessage: message,
  };
}

export function withNote(state: AppState, note: string): AppState {
  return { ...state, notes: [...state.notes, note] };
}

export function withExportResult(state: AppState, result: ExportResult): AppState {
  return {
    ...state,
    downloadErrorMessage: undefined,
    exportResult: result,
    isItemModalOpen: false,
    phase: 'conversion-complete',
  };
}

export function withSelectedInput(state: AppState, label: string): AppState {
  return {
    ...state,
    downloadErrorMessage: undefined,
    selectedInputLabel: label,
    phase: 'converting',
  };
}

export function clearExportResult(state: AppState): AppState {
  const {
    exportResult: _removed,
    selectedInputLabel: _selectedInputLabel,
    ...rest
  } = state;

  return {
    ...rest,
    downloadErrorMessage: undefined,
    isItemModalOpen: false,
    phase: 'selecting-input',
  };
}
