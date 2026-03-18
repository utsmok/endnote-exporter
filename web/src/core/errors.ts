export type LibraryNormalizationErrorCode =
  | 'MALFORMED_ARCHIVE'
  | 'MISSING_DATABASE'
  | 'UNSUPPORTED_ARCHIVE_SHAPE';

export type LibraryFailureClassification =
  | 'malformed-archive'
  | 'missing-database'
  | 'unsupported-archive-shape';

export interface LibraryNormalizationErrorContext {
  archiveFileName: string;
  availableTopLevelEntries?: string[];
  expectedDataDirectory?: string;
  expectedDatabasePath?: string;
  packageRelativePath?: string;
  reason?: string;
}

export interface LibraryNormalizationErrorOptions {
  cause?: unknown;
  code: LibraryNormalizationErrorCode;
  context: LibraryNormalizationErrorContext;
  message: string;
}

const FAILURE_CLASSIFICATIONS: Record<
  LibraryNormalizationErrorCode,
  LibraryFailureClassification
> = {
  MALFORMED_ARCHIVE: 'malformed-archive',
  MISSING_DATABASE: 'missing-database',
  UNSUPPORTED_ARCHIVE_SHAPE: 'unsupported-archive-shape',
};

export class LibraryNormalizationError extends Error {
  readonly code: LibraryNormalizationErrorCode;
  readonly context: LibraryNormalizationErrorContext;
  readonly failureClassification: LibraryFailureClassification;

  constructor(options: LibraryNormalizationErrorOptions) {
    super(options.message, options.cause ? { cause: options.cause } : undefined);

    this.name = 'LibraryNormalizationError';
    this.code = options.code;
    this.context = options.context;
    this.failureClassification = FAILURE_CLASSIFICATIONS[options.code];
  }
}

export function isLibraryNormalizationError(
  error: unknown,
): error is LibraryNormalizationError {
  return error instanceof LibraryNormalizationError;
}
