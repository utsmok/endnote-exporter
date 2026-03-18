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

export type ThemePreference = 'system' | 'light' | 'dark';

export type ResolvedTheme = 'light' | 'dark';

export type WorkflowStage = 'boot' | 'intake' | 'preparation' | 'conversion' | 'review' | 'recovery';

export type StatusSeverity = 'informational' | 'success' | 'warning' | 'error';

export interface RecoveryGuidance {
  detail: string;
  label: string;
}

export interface SessionNotice {
  message: string;
  recoveryGuidance: RecoveryGuidance[];
  severity: StatusSeverity;
  title: string;
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
  resolvedTheme: ResolvedTheme;
  runtime: BrowserRuntimeInfo;
  selectedInputLabel?: string;
  sessionNotice: SessionNotice | undefined;
  statusLiveMessage: string;
  statusMessage: string;
  statusSeverity: StatusSeverity;
  statusTitle: string;
  themePreference: ThemePreference;
  workflowStage: WorkflowStage;
  workerStatus: WorkerStatus;
  exportResult?: ExportResult;
}

export function createInitialState(runtime: BrowserRuntimeInfo): AppState {
  const statusMessage = runtime.isServedMode
    ? 'Bootstrapping the worker-backed served-mode workspace.'
    : 'Served mode is required; file:// launch is intentionally unsupported.';

  return {
    attachmentBasePath: '',
    downloadErrorMessage: undefined,
    isItemModalOpen: false,
    notes: [...runtime.notes],
    phase: 'booting',
    recoveryGuidance: [],
    resolvedTheme: 'dark',
    runtime,
    sessionNotice: undefined,
    statusLiveMessage: statusMessage,
    statusMessage,
    statusSeverity: 'informational',
    statusTitle: 'Initialising workspace',
    themePreference: 'system',
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

export function withTheme(
  state: AppState,
  themePreference: ThemePreference,
  resolvedTheme: ResolvedTheme,
): AppState {
  return {
    ...state,
    resolvedTheme,
    themePreference,
  };
}

export function withSessionNotice(state: AppState, sessionNotice?: SessionNotice): AppState {
  return {
    ...state,
    sessionNotice,
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
    sessionNotice: undefined,
  };
}

export function withSelectedInput(state: AppState, label: string): AppState {
  return {
    ...state,
    downloadErrorMessage: undefined,
    selectedInputLabel: label,
    phase: 'converting',
    sessionNotice: undefined,
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
    sessionNotice: undefined,
  };
}
