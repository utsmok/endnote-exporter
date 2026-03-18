import { describe, expect, it } from 'vitest';

import {
  detectDirectoryIntakeCapability,
  prepareLibraryFromDirectoryHandle,
  type DirectoryEntryHandleLike,
  type DirectoryFileHandleLike,
  type DirectoryHandleLike,
} from './directory-input';

describe('detectDirectoryIntakeCapability', () => {
  it('enables direct-folder intake only in secure served contexts with a picker', () => {
    const capability = detectDirectoryIntakeCapability({
      isSecureContext: true,
      location: { protocol: 'https:' },
      showDirectoryPicker: async () => createDirectoryHandle('Empty', []),
    });

    expect(capability.available).toBe(true);
    expect(capability.notes).toContain(
      'Direct folder intake is an experimental convenience enhancement. ZIP upload remains the supported baseline path.',
    );
  });

  it('keeps direct-folder intake unavailable when the picker capability is missing', () => {
    const capability = detectDirectoryIntakeCapability({
      isSecureContext: true,
      location: { protocol: 'https:' },
    });

    expect(capability.available).toBe(false);
    expect(capability.notes).toContain(
      'Direct folder intake is only exposed when the browser provides showDirectoryPicker().',
    );
  });
});

describe('prepareLibraryFromDirectoryHandle', () => {
  it('normalizes a direct .enl + .Data folder selection using directory-entry sources', async () => {
    const handle = createDirectoryHandle('SelectedLibrary', [
      createFileNode('SupportedLibrary.enl', [1, 2, 3]),
      createDirectoryNode('SupportedLibrary.Data', [
        createDirectoryNode('sdb', [
          createFileNode('sdb.eni', [4, 5, 6]),
        ]),
        createDirectoryNode('PDF', [
          createDirectoryNode('group-1', [
            createFileNode('paper.pdf', [7, 8, 9]),
          ]),
        ]),
      ]),
    ]);

    const library = await prepareLibraryFromDirectoryHandle(handle);

    expect(library.sourceKind).toBe('directory');
    expect(library.identity.packageRelativePath).toBeNull();
    expect(library.identity.libraryRelativePath).toBe('SupportedLibrary.enl');
    expect(library.database.relativePath).toBe('SupportedLibrary.Data/sdb/sdb.eni');
    expect(library.libraryFile.source).toBe('directory-entry');
    expect(library.attachments.files[0]?.relativePath).toBe(
      'SupportedLibrary.Data/PDF/group-1/paper.pdf',
    );
    expect(library.attachments.files[0]?.source).toBe('directory-entry');
  });

  it('treats a selected .enlp directory as a packaged library root', async () => {
    const handle = createDirectoryHandle('PackageLibrary.enlp', [
      createFileNode('PackageLibrary.enl', [1, 2, 3]),
      createDirectoryNode('PackageLibrary.Data', [
        createDirectoryNode('sdb', [
          createFileNode('sdb.eni', [4, 5, 6]),
        ]),
      ]),
    ]);

    const library = await prepareLibraryFromDirectoryHandle(handle);

    expect(library.sourceKind).toBe('directory');
    expect(library.identity.packageRelativePath).toBe('PackageLibrary.enlp');
    expect(library.identity.libraryRelativePath).toBe('PackageLibrary.enl');
    expect(library.database.archivePath).toBe(
      'PackageLibrary.enlp/PackageLibrary.Data/sdb/sdb.eni',
    );
    expect(library.database.relativePath).toBe('PackageLibrary.Data/sdb/sdb.eni');
    expect(library.files.every((file) => file.source === 'directory-entry')).toBe(true);
  });
});

interface MockFileNode {
  bytes: ArrayBuffer;
  kind: 'file';
  name: string;
}

interface MockDirectoryNode {
  children: MockNode[];
  kind: 'directory';
  name: string;
}

type MockNode = MockDirectoryNode | MockFileNode;

function createDirectoryNode(name: string, children: MockNode[]): MockDirectoryNode {
  return { children, kind: 'directory', name };
}

function createFileNode(name: string, bytes: number[]): MockFileNode {
  return { bytes: Uint8Array.from(bytes).buffer.slice(0), kind: 'file', name };
}

function createDirectoryHandle(name: string, children: MockNode[]): DirectoryHandleLike {
  return toDirectoryHandle(createDirectoryNode(name, children));
}

function toDirectoryHandle(node: MockDirectoryNode): DirectoryHandleLike {
  return {
    kind: 'directory',
    name: node.name,
    async *values(): AsyncIterable<DirectoryEntryHandleLike> {
      for (const child of node.children) {
        yield child.kind === 'directory' ? toDirectoryHandle(child) : toFileHandle(child);
      }
    },
  };
}

function toFileHandle(node: MockFileNode): DirectoryFileHandleLike {
  return {
    async getFile(): Promise<File> {
      return new File([node.bytes], node.name);
    },
    kind: 'file',
    name: node.name,
  };
}
