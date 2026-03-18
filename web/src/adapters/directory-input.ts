import {
  normalizeLibraryEntries,
  type NormalizeLibraryEntryInput,
} from '../core/normalize-library';
import type { PreparedLibrary } from '../core/library-types';

export interface DirectoryFileHandleLike {
  getFile(): Promise<File>;
  kind: 'file';
  name: string;
}

export interface DirectoryHandleLike {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<DirectoryEntryHandleLike>;
}

export type DirectoryEntryHandleLike = DirectoryFileHandleLike | DirectoryHandleLike;

export interface DirectoryIntakeCapability {
  available: boolean;
  notes: string[];
}

export interface DirectoryPickerWindowLike {
  isSecureContext: boolean;
  location: {
    protocol: string;
  };
  showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
}

export function detectDirectoryIntakeCapability(
  win: DirectoryPickerWindowLike = window as unknown as DirectoryPickerWindowLike,
): DirectoryIntakeCapability {
  const notes: string[] = [];
  const isServedMode = win.location.protocol !== 'file:';
  const pickerSupported = typeof win.showDirectoryPicker === 'function';

  if (!isServedMode) {
    notes.push('Direct folder intake is disabled for file:// launches. Use the served ZIP-first flow instead.');
  }

  if (!win.isSecureContext) {
    notes.push('Direct folder intake requires a secure context and remains hidden when that capability is unavailable.');
  }

  if (!pickerSupported) {
    notes.push('Direct folder intake is only exposed when the browser provides showDirectoryPicker().');
  }

  if (isServedMode && win.isSecureContext && pickerSupported) {
    notes.push('Direct folder intake is an experimental convenience enhancement. ZIP upload remains the supported baseline path.');
  }

  return {
    available: isServedMode && win.isSecureContext && pickerSupported,
    notes,
  };
}

export async function pickLibraryDirectory(
  win: DirectoryPickerWindowLike = window as unknown as DirectoryPickerWindowLike,
): Promise<DirectoryHandleLike> {
  const capability = detectDirectoryIntakeCapability(win);

  if (!capability.available || !win.showDirectoryPicker) {
    throw new Error(
      capability.notes[0]
        ?? 'Direct folder intake is unavailable in this browser context. ZIP upload remains available.',
    );
  }

  return win.showDirectoryPicker();
}

export async function prepareLibraryFromDirectoryHandle(
  handle: DirectoryHandleLike,
): Promise<PreparedLibrary> {
  const archiveRootPrefix = handle.name.toLowerCase().endsWith('.enlp')
    ? handle.name
    : '';
  const entries = await collectDirectoryEntries(handle, archiveRootPrefix);

  return normalizeLibraryEntries({
    archiveFileName: handle.name,
    entries,
    sourceKind: 'directory',
  });
}

async function collectDirectoryEntries(
  handle: DirectoryHandleLike,
  rootPrefix: string,
): Promise<NormalizeLibraryEntryInput[]> {
  const entries: NormalizeLibraryEntryInput[] = [];
  await walkDirectory(handle, rootPrefix, entries);
  entries.sort((left, right) => left.archivePath.localeCompare(right.archivePath));

  return entries;
}

async function walkDirectory(
  handle: DirectoryHandleLike,
  currentPrefix: string,
  entries: NormalizeLibraryEntryInput[],
): Promise<void> {
  for await (const child of handle.values()) {
    const archivePath = joinArchivePath(currentPrefix, child.name);

    if (child.kind === 'directory') {
      await walkDirectory(child, archivePath, entries);
      continue;
    }

    const file = await child.getFile();
    entries.push({
      archivePath,
      bytes: new Uint8Array(await file.arrayBuffer()),
      source: 'directory-entry',
    });
  }
}

function joinArchivePath(prefix: string, name: string): string {
  return prefix.length > 0 ? `${prefix}/${name}` : name;
}
