import {
  detectDirectoryIntakeCapability,
  type DirectoryIntakeCapability,
  type DirectoryPickerWindowLike,
} from './directory-input';

export interface BrowserRuntimeInfo {
  directoryIntake: DirectoryIntakeCapability;
  isSecureContext: boolean;
  isServedMode: boolean;
  location: string;
  notes: string[];
  protocol: string;
  workerSupported: boolean;
}

export function detectBrowserRuntime(win: Window = window): BrowserRuntimeInfo {
  const notes: string[] = [];
  const protocol = win.location.protocol;
  const isServedMode = protocol !== 'file:';
  const workerSupported = 'Worker' in win;
  const directoryIntake = detectDirectoryIntakeCapability(
    win as unknown as DirectoryPickerWindowLike,
  );

  if (!isServedMode) {
    notes.push('Served mode is the canonical launch contract; file:// is intentionally unsupported.');
  }

  if (!workerSupported) {
    notes.push('Dedicated workers are unavailable in this browser context.');
  }

  if (!win.isSecureContext) {
    notes.push('This session is not a secure context; future progressive enhancements may remain disabled.');
  }

  return {
    directoryIntake,
    isSecureContext: win.isSecureContext,
    isServedMode,
    location: win.location.href,
    notes,
    protocol,
    workerSupported,
  };
}
