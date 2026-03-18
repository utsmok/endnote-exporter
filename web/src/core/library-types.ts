export type LibrarySourceKind = 'zip' | 'directory';
export type PreparedFileSource = 'zip-entry' | 'directory-entry';
export type AttachmentKind = 'pdf' | 'other';
export type PreparedLibraryShape = 'zipped-enl-data' | 'zipped-enlp-package';
export type NormalizationWarningCode = 'ATTACHMENT_PAYLOAD_MISSING';

export interface NormalizationWarning {
  code: NormalizationWarningCode;
  message: string;
  relativePath?: string;
}

export interface PreparedDatabaseFile {
  bytes: ArrayBuffer;
  archivePath: string;
  relativePath: string;
}

export interface PreparedLibraryFile {
  archivePath: string;
  relativePath: string;
  size: number;
  source: PreparedFileSource;
}

export interface PreparedAttachmentFile extends PreparedLibraryFile {
  kind: AttachmentKind;
  subtreeRelativePath: string;
}

export interface PreparedAttachmentSubtree {
  files: PreparedAttachmentFile[];
  rootRelativePath: string;
}

export interface PreparedLibraryIdentity {
  archiveFileName: string;
  dataDirectoryName: string;
  dataDirectoryRelativePath: string;
  displayName: string;
  id: string;
  libraryFileName: string;
  libraryRelativePath: string;
  packageRelativePath: string | null;
  sourceShape: PreparedLibraryShape;
  stem: string;
}

export interface PreparedLibrary {
  attachments: PreparedAttachmentSubtree;
  database: PreparedDatabaseFile;
  displayName: string;
  fileMap: Record<string, PreparedLibraryFile>;
  files: PreparedLibraryFile[];
  id: string;
  identity: PreparedLibraryIdentity;
  libraryFile: PreparedLibraryFile;
  sourceKind: LibrarySourceKind;
  warnings: NormalizationWarning[];
}
