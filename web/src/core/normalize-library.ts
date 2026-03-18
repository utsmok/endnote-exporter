import { unzipSync } from 'fflate';

import {
  LibraryNormalizationError,
  type LibraryNormalizationErrorContext,
} from './errors';
import type {
  AttachmentKind,
  LibrarySourceKind,
  PreparedAttachmentFile,
  PreparedDatabaseFile,
  PreparedLibrary,
  PreparedLibraryFile,
  PreparedLibraryIdentity,
  PreparedFileSource,
  PreparedLibraryShape,
} from './library-types';

export interface NormalizeZipLibraryInput {
  archiveBytes: ArrayBuffer | Uint8Array;
  archiveFileName: string;
}

interface ArchiveEntry {
  archivePath: string;
  bytes: Uint8Array;
  size: number;
  source: PreparedFileSource;
}

export interface NormalizeLibraryEntryInput {
  archivePath: string;
  bytes: Uint8Array;
  source: PreparedFileSource;
}

export interface NormalizeLibraryEntriesInput {
  archiveFileName: string;
  entries: NormalizeLibraryEntryInput[];
  sourceKind: LibrarySourceKind;
}

interface ResolvedLibraryShape {
  dataDirectoryRelativePath: string;
  databaseArchivePath: string;
  identity: PreparedLibraryIdentity;
  libraryFileArchivePath: string;
  packageRelativePath: string | null;
  relativeFiles: ArchiveEntry[];
  sourceShape: PreparedLibraryShape;
}

export function normalizeZipLibrary(
  input: NormalizeZipLibraryInput,
): PreparedLibrary {
  const archiveEntries = readArchiveEntries(input);

  return normalizeLibraryEntries({
    archiveFileName: input.archiveFileName,
    entries: archiveEntries,
    sourceKind: 'zip',
  });
}

export function normalizeLibraryEntries(
  input: NormalizeLibraryEntriesInput,
): PreparedLibrary {
  const archiveEntries = input.entries
    .map((entry) => ({
      archivePath: canonicalizeArchivePath(entry.archivePath),
      bytes: entry.bytes,
      size: entry.bytes.byteLength,
      source: entry.source,
    }))
    .filter((entry) => entry.archivePath.length > 0 && !entry.archivePath.endsWith('/'))
    .sort((left, right) => left.archivePath.localeCompare(right.archivePath));
  const resolved = resolveApprovedLibraryShape(archiveEntries, input.archiveFileName);
  const files = resolved.relativeFiles
    .map((entry) => toPreparedLibraryFile(entry, resolved.packageRelativePath))
    .sort(comparePreparedFiles);

  const fileMap = Object.fromEntries(
    files.map((file) => [file.relativePath, file]),
  );
  const libraryFile = fileMap[resolved.identity.libraryRelativePath];

  if (!libraryFile) {
    throw buildUnsupportedShapeError(input.archiveFileName, {
      availableTopLevelEntries: collectTopLevelEntries(archiveEntries),
      reason: `Resolved library entry ${resolved.identity.libraryRelativePath} was not present after normalisation.`,
    });
  }

  const databaseEntry = resolved.relativeFiles.find(
    (entry) => entry.archivePath === resolved.databaseArchivePath,
  );

  if (!databaseEntry) {
    throw buildMissingDatabaseError(input.archiveFileName, {
      availableTopLevelEntries: collectTopLevelEntries(archiveEntries),
      expectedDataDirectory: resolved.identity.dataDirectoryRelativePath,
      expectedDatabasePath: stripPackagePrefix(
        resolved.databaseArchivePath,
        resolved.packageRelativePath,
      ),
      ...(resolved.packageRelativePath
        ? { packageRelativePath: resolved.packageRelativePath }
        : {}),
      reason: 'Resolved library shape did not include the expected database entry.',
    });
  }

  const database = toPreparedDatabaseFile(databaseEntry, resolved.packageRelativePath);
  const attachments = buildAttachmentSubtree(files, resolved.dataDirectoryRelativePath);

  return {
    attachments,
    database,
    displayName: resolved.identity.displayName,
    fileMap,
    files,
    id: resolved.identity.id,
    identity: resolved.identity,
    libraryFile,
    sourceKind: input.sourceKind,
    warnings: [],
  };
}

function readArchiveEntries(
  input: NormalizeZipLibraryInput,
): NormalizeLibraryEntryInput[] {
  try {
    const archive = unzipSync(toUint8Array(input.archiveBytes));

    return Object.entries(archive)
      .map(([entryName, entryBytes]) => {
        return {
          archivePath: entryName,
          bytes: entryBytes,
          source: 'zip-entry',
        } satisfies NormalizeLibraryEntryInput;
      })
      .sort((left, right) => left.archivePath.localeCompare(right.archivePath));
  } catch (error) {
    throw new LibraryNormalizationError({
      cause: error,
      code: 'MALFORMED_ARCHIVE',
      context: {
        archiveFileName: input.archiveFileName,
        reason: 'The uploaded file has a .zip suffix but could not be opened as a ZIP archive.',
      },
      message: 'The uploaded file could not be opened as a ZIP archive.',
    });
  }
}

function resolveApprovedLibraryShape(
  archiveEntries: ArchiveEntry[],
  archiveFileName: string,
): ResolvedLibraryShape {
  const fileEntries = archiveEntries;
  const rootEnlFiles = fileEntries.filter(
    (entry) => !entry.archivePath.includes('/') && isLibraryFilePath(entry.archivePath),
  );
  const packageRoots = collectPackageRoots(fileEntries);
  const rootEnlFile = rootEnlFiles[0];
  const packageRoot = packageRoots[0];

  if (rootEnlFiles.length === 1 && packageRoots.length === 0 && rootEnlFile) {
    return resolveRootEnlShape({
      archiveFileName,
      archiveEntries,
      fileEntries,
      libraryEntry: rootEnlFile,
    });
  }

  if (rootEnlFiles.length === 0 && packageRoots.length === 1 && packageRoot) {
    return resolvePackagedEnlpShape({
      archiveFileName,
      archiveEntries,
      fileEntries,
      packageRoot,
    });
  }

  throw buildUnsupportedShapeError(archiveFileName, {
    availableTopLevelEntries: collectTopLevelEntries(archiveEntries),
    reason:
      'Archive must contain exactly one supported root .enl library or one supported .enlp package.',
  });
}

function resolveRootEnlShape({
  archiveEntries,
  archiveFileName,
  fileEntries,
  libraryEntry,
}: {
  archiveEntries: ArchiveEntry[];
  archiveFileName: string;
  fileEntries: ArchiveEntry[];
  libraryEntry: ArchiveEntry;
}): ResolvedLibraryShape {
  const stem = getStem(libraryEntry.archivePath);
  const expectedDataDirectory = `${stem}.Data`;
  const dataDirectory = resolveDataDirectory({
    entries: archiveEntries,
    expectedDataDirectory,
  });

  if (!dataDirectory) {
      throw buildMissingDatabaseError(archiveFileName, {
      availableTopLevelEntries: collectTopLevelEntries(archiveEntries),
      expectedDataDirectory,
        expectedDatabasePath: `${expectedDataDirectory}/sdb/sdb.eni`,
        reason: 'Archive identified a root .enl library but did not contain the expected sibling .Data directory.',
    });
  }

  const databaseArchivePath = `${dataDirectory}/sdb/sdb.eni`;

  if (!fileEntries.some((entry) => entry.archivePath === databaseArchivePath)) {
    throw buildMissingDatabaseError(archiveFileName, {
      availableTopLevelEntries: collectTopLevelEntries(archiveEntries),
      expectedDataDirectory,
      expectedDatabasePath: databaseArchivePath,
    });
  }

  return {
    dataDirectoryRelativePath: dataDirectory,
    databaseArchivePath,
    identity: buildLibraryIdentity({
      archiveFileName,
      dataDirectoryRelativePath: dataDirectory,
      displayName: stem,
      libraryRelativePath: libraryEntry.archivePath,
      packageRelativePath: null,
      sourceShape: 'zipped-enl-data',
      stem,
    }),
    libraryFileArchivePath: libraryEntry.archivePath,
    packageRelativePath: null,
    relativeFiles: fileEntries,
    sourceShape: 'zipped-enl-data',
  };
}

function resolvePackagedEnlpShape({
  archiveEntries,
  archiveFileName,
  fileEntries,
  packageRoot,
}: {
  archiveEntries: ArchiveEntry[];
  archiveFileName: string;
  fileEntries: ArchiveEntry[];
  packageRoot: string;
}): ResolvedLibraryShape {
  const packagePrefix = `${packageRoot}/`;

  if (!fileEntries.every((entry) => entry.archivePath.startsWith(packagePrefix))) {
    throw buildUnsupportedShapeError(archiveFileName, {
      availableTopLevelEntries: collectTopLevelEntries(archiveEntries),
      packageRelativePath: packageRoot,
      reason: 'The archive mixes a package-style .enlp root with unrelated top-level files.',
    });
  }

  const packageEntries = archiveEntries
    .filter((entry) => entry.archivePath.startsWith(packagePrefix))
    .map((entry) => ({
      archivePath: stripPackagePrefix(entry.archivePath, packageRoot),
      bytes: entry.bytes,
      size: entry.size,
      source: entry.source,
    }));
  const packageLibraryEntries = packageEntries.filter((entry) =>
    isLibraryFilePath(entry.archivePath),
  );

  if (packageLibraryEntries.length > 1) {
    throw buildUnsupportedShapeError(archiveFileName, {
      availableTopLevelEntries: collectTopLevelEntries(archiveEntries),
      packageRelativePath: packageRoot,
      reason: 'Supported .enlp package archives may contain only one library .enl entry.',
    });
  }

  const packageLibraryEntry = packageLibraryEntries[0] ?? null;
  const stem = packageLibraryEntry
    ? getStem(packageLibraryEntry.archivePath)
    : inferStemFromFirstDataDirectory(packageEntries);

  if (!stem) {
    throw buildUnsupportedShapeError(archiveFileName, {
      availableTopLevelEntries: collectTopLevelEntries(archiveEntries),
      packageRelativePath: packageRoot,
      reason: 'Could not resolve a packaged .enl entry or fallback .Data directory inside the .enlp root.',
    });
  }

  const expectedDataDirectory = `${stem}.Data`;
  const dataDirectory = resolveDataDirectory({
    entries: packageEntries,
    expectedDataDirectory,
    fallbackToFirstDataDirectory: !packageLibraryEntry,
  });

  if (!dataDirectory) {
    throw buildMissingDatabaseError(archiveFileName, {
      availableTopLevelEntries: collectTopLevelEntries(archiveEntries),
      expectedDataDirectory,
      expectedDatabasePath: `${expectedDataDirectory}/sdb/sdb.eni`,
      packageRelativePath: packageRoot,
      reason: 'Packaged .enlp archive identified a library shell but did not contain the expected .Data directory.',
    });
  }

  const databaseRelativePath = `${dataDirectory}/sdb/sdb.eni`;
  const databaseArchivePath = `${packageRoot}/${databaseRelativePath}`;

  if (!fileEntries.some((entry) => entry.archivePath === databaseArchivePath)) {
    throw buildMissingDatabaseError(archiveFileName, {
      availableTopLevelEntries: collectTopLevelEntries(archiveEntries),
      expectedDataDirectory,
      expectedDatabasePath: databaseRelativePath,
      packageRelativePath: packageRoot,
    });
  }

  const libraryRelativePath = packageLibraryEntry?.archivePath ?? `${stem}.enl`;

  return {
    dataDirectoryRelativePath: dataDirectory,
    databaseArchivePath,
    identity: buildLibraryIdentity({
      archiveFileName,
      dataDirectoryRelativePath: dataDirectory,
      displayName: stem,
      libraryRelativePath,
      packageRelativePath: packageRoot,
      sourceShape: 'zipped-enlp-package',
      stem,
    }),
    libraryFileArchivePath: `${packageRoot}/${libraryRelativePath}`,
    packageRelativePath: packageRoot,
    relativeFiles: fileEntries,
    sourceShape: 'zipped-enlp-package',
  };
}

function buildLibraryIdentity({
  archiveFileName,
  dataDirectoryRelativePath,
  displayName,
  libraryRelativePath,
  packageRelativePath,
  sourceShape,
  stem,
}: {
  archiveFileName: string;
  dataDirectoryRelativePath: string;
  displayName: string;
  libraryRelativePath: string;
  packageRelativePath: string | null;
  sourceShape: PreparedLibraryShape;
  stem: string;
}): PreparedLibraryIdentity {
  return {
    archiveFileName,
    dataDirectoryName: getTopLevelSegment(dataDirectoryRelativePath),
    dataDirectoryRelativePath,
    displayName,
    id: `prepared-library:${sourceShape}:${stem.toLowerCase()}`,
    libraryFileName: getBaseName(libraryRelativePath),
    libraryRelativePath,
    packageRelativePath,
    sourceShape,
    stem,
  };
}

function buildAttachmentSubtree(
  files: PreparedLibraryFile[],
  dataDirectoryRelativePath: string,
): PreparedLibrary['attachments'] {
  const rootRelativePath = `${dataDirectoryRelativePath}/PDF`;
  const prefix = `${rootRelativePath}/`;
  const attachmentFiles = files
    .filter((file) => file.relativePath.startsWith(prefix))
    .map((file) => ({
      ...file,
      kind: detectAttachmentKind(file.relativePath),
      subtreeRelativePath: file.relativePath.slice(prefix.length),
    }))
    .sort(comparePreparedFiles) satisfies PreparedAttachmentFile[];

  return {
    files: attachmentFiles,
    rootRelativePath,
  };
}

function detectAttachmentKind(relativePath: string): AttachmentKind {
  return relativePath.toLowerCase().endsWith('.pdf') ? 'pdf' : 'other';
}

function toPreparedLibraryFile(
  entry: ArchiveEntry,
  packageRelativePath: string | null,
): PreparedLibraryFile {
  return {
    archivePath: entry.archivePath,
    relativePath: stripPackagePrefix(entry.archivePath, packageRelativePath),
    size: entry.size,
    source: entry.source,
  };
}

function toPreparedDatabaseFile(
  entry: ArchiveEntry,
  packageRelativePath: string | null,
): PreparedDatabaseFile {
  return {
    archivePath: entry.archivePath,
    bytes: entry.bytes.slice().buffer,
    relativePath: stripPackagePrefix(entry.archivePath, packageRelativePath),
  };
}

function resolveDataDirectory({
  entries,
  expectedDataDirectory,
  fallbackToFirstDataDirectory = false,
}: {
  entries: ArchiveEntry[];
  expectedDataDirectory: string;
  fallbackToFirstDataDirectory?: boolean;
}): string | null {
  const candidates = collectTopLevelEntries(entries).filter((segment) =>
    segment.toLowerCase().endsWith('.data'),
  );
  const exactMatch = candidates.find((segment) => segment === expectedDataDirectory);

  if (exactMatch) {
    return exactMatch;
  }

  const caseInsensitiveMatch = candidates.find(
    (segment) => segment.toLowerCase() === expectedDataDirectory.toLowerCase(),
  );

  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch;
  }

  return fallbackToFirstDataDirectory ? (candidates[0] ?? null) : null;
}

function inferStemFromFirstDataDirectory(entries: ArchiveEntry[]): string | null {
  const firstDataDirectory = collectTopLevelEntries(entries).find((segment) =>
    segment.toLowerCase().endsWith('.data'),
  );

  return firstDataDirectory
    ? firstDataDirectory.slice(0, firstDataDirectory.length - '.Data'.length)
    : null;
}

function collectPackageRoots(entries: ArchiveEntry[]): string[] {
  return collectTopLevelEntries(entries).filter((segment) =>
    segment.toLowerCase().endsWith('.enlp'),
  );
}

function collectTopLevelEntries(entries: ArchiveEntry[]): string[] {
  return Array.from(
    new Set(
      entries.map((entry) => getTopLevelSegment(entry.archivePath)),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function canonicalizeArchivePath(entryName: string): string {
  return entryName.replaceAll('\\', '/').replace(/^\.\//u, '').replace(/^\/+/, '');
}

function stripPackagePrefix(path: string, packageRelativePath: string | null): string {
  if (!packageRelativePath) {
    return path;
  }

  const prefix = `${packageRelativePath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function isLibraryFilePath(path: string): boolean {
  return path.toLowerCase().endsWith('.enl') && !path.endsWith('/');
}

function getStem(path: string): string {
  const baseName = getBaseName(path);
  return baseName.slice(0, baseName.length - '.enl'.length);
}

function getBaseName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

function getTopLevelSegment(path: string): string {
  const [segment] = path.split('/');
  return segment ?? path;
}

function toUint8Array(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function buildUnsupportedShapeError(
  archiveFileName: string,
  context: Omit<LibraryNormalizationErrorContext, 'archiveFileName'>,
): LibraryNormalizationError {
  return new LibraryNormalizationError({
    code: 'UNSUPPORTED_ARCHIVE_SHAPE',
    context: {
      archiveFileName,
      ...context,
    },
    message: 'The archive shape is unsupported for the browser-local MVP.',
  });
}

function buildMissingDatabaseError(
  archiveFileName: string,
  context: Omit<LibraryNormalizationErrorContext, 'archiveFileName'>,
): LibraryNormalizationError {
  return new LibraryNormalizationError({
    code: 'MISSING_DATABASE',
    context: {
      archiveFileName,
      ...context,
    },
    message: 'Archive shape looks valid, but the prepared library is missing sdb/sdb.eni.',
  });
}

function comparePreparedFiles(
  left: Pick<PreparedLibraryFile, 'relativePath'>,
  right: Pick<PreparedLibraryFile, 'relativePath'>,
): number {
  return left.relativePath.localeCompare(right.relativePath);
}
