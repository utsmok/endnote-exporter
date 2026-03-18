import { normalizeZipLibrary, type NormalizeZipLibraryInput } from '../core/normalize-library';
import type { PreparedLibrary } from '../core/library-types';
import {
  pickLibraryDirectory,
  prepareLibraryFromDirectoryHandle,
  type DirectoryHandleLike,
} from './directory-input';

export interface BrowserZipFileInput {
  file: File;
  kind: 'zip-file';
}

export interface BrowserZipBytesInput {
  archiveBytes: ArrayBuffer | Uint8Array;
  archiveFileName: string;
  kind: 'zip-bytes';
}

export interface BrowserDirectoryHandleInput {
  handle: DirectoryHandleLike;
  kind: 'directory-handle';
}

export type BrowserLibraryInput =
  | BrowserDirectoryHandleInput
  | BrowserZipFileInput
  | BrowserZipBytesInput;

export async function prepareLibraryFromBrowserInput(
  input: BrowserLibraryInput,
): Promise<PreparedLibrary> {
  switch (input.kind) {
    case 'directory-handle':
      return prepareLibraryFromDirectoryHandle(input.handle);
    case 'zip-bytes':
      return normalizeZipLibrary({
        archiveBytes: input.archiveBytes,
        archiveFileName: input.archiveFileName,
      });
    case 'zip-file':
      return prepareLibraryFromZipFile(input.file);
    default:
      return assertNever(input);
  }
}

export async function prepareLibraryFromZipFile(
  file: File,
): Promise<PreparedLibrary> {
  const request = await readZipFileInput(file);
  return normalizeZipLibrary(request);
}

async function readZipFileInput(file: File): Promise<NormalizeZipLibraryInput> {
  return {
    archiveBytes: await file.arrayBuffer(),
    archiveFileName: file.name,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported browser input: ${JSON.stringify(value)}`);
}

export { pickLibraryDirectory };
