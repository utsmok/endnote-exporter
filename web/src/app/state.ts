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

export interface AppState {
  attachmentBasePath: string;
  downloadErrorMessage: string | undefined;
  isItemModalOpen: boolean;
  notes: string[];
  phase: AppPhase;
  runtime: BrowserRuntimeInfo;
  selectedInputLabel?: string;
  statusMessage: string;
  workerStatus: WorkerStatus;
  exportResult?: ExportResult;
}

export function createInitialState(runtime: BrowserRuntimeInfo): AppState {
  return {
    attachmentBasePath: '',
    downloadErrorMessage: undefined,
    isItemModalOpen: false,
    notes: [...runtime.notes],
    phase: 'booting',
    runtime,
    statusMessage: runtime.isServedMode
      ? 'Bootstrapping the worker-backed served-mode workspace.'
      : 'Served mode is required; file:// launch is intentionally unsupported.',
    workerStatus: 'starting',
  };
}

export function withPhase(state: AppState, phase: AppPhase): AppState {
  return { ...state, phase };
}

export function withAttachmentBasePath(state: AppState, attachmentBasePath: string): AppState {
  return { ...state, attachmentBasePath };
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
  return { ...state, statusMessage: message };
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
