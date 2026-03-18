import type { PreparedLibrary } from '../core/library-types';
import type {
  EndnoteAttachmentRow,
  EndnoteFieldValue,
  EndnoteQueryResult,
  EndnoteReferenceRow,
} from '../types/query-results';
import type { SqliteAdapter, SqliteRow } from './sqlite-adapter';

const REFERENCE_QUERY = 'SELECT * FROM refs WHERE trash_state = 0 ORDER BY id ASC';
const ATTACHMENT_QUERY =
  'SELECT refs_id, file_path FROM file_res ORDER BY refs_id ASC, file_path ASC';

const FIELD_VALUE_DECODER = new TextDecoder();

export function queryPreparedLibrary(
  adapter: SqliteAdapter,
  library: PreparedLibrary,
): EndnoteQueryResult {
  const referenceRows = adapter.queryRows(REFERENCE_QUERY).map(projectReferenceRow);
  const attachmentRows = adapter.queryRows(ATTACHMENT_QUERY).map(projectAttachmentRow);

  return {
    attachmentRows,
    attachmentsByReferenceId: buildAttachmentMap(attachmentRows),
    databaseArchivePath: library.database.archivePath,
    databaseRelativePath: library.database.relativePath,
    libraryId: library.id,
    referenceRows,
    summary: {
      attachmentRowCount: attachmentRows.length,
      referenceRowCount: referenceRows.length,
    },
  };
}

function projectReferenceRow(row: SqliteRow): EndnoteReferenceRow {
  return {
    abstract: readFieldValue(row, 'abstract'),
    access_date: readFieldValue(row, 'access_date'),
    accession_number: readFieldValue(row, 'accession_number'),
    added_to_library: readFieldValue(row, 'added_to_library'),
    alt_title: readFieldValue(row, 'alt_title'),
    alternate_title: readFieldValue(row, 'alternate_title'),
    author: readFieldValue(row, 'author'),
    author_address: readFieldValue(row, 'author_address'),
    custom_1: readFieldValue(row, 'custom_1'),
    custom_2: readFieldValue(row, 'custom_2'),
    custom_3: readFieldValue(row, 'custom_3'),
    custom_7: readFieldValue(row, 'custom_7'),
    database_provider: readFieldValue(row, 'database_provider'),
    date: readFieldValue(row, 'date'),
    edition: readFieldValue(row, 'edition'),
    electronic_resource_number: readFieldValue(row, 'electronic_resource_number'),
    id: readRequiredInteger(row, 'id'),
    isbn: readFieldValue(row, 'isbn'),
    keywords: readFieldValue(row, 'keywords'),
    label: readFieldValue(row, 'label'),
    language: readFieldValue(row, 'language'),
    name_of_database: readFieldValue(row, 'name_of_database'),
    notes: readFieldValue(row, 'notes'),
    number: readFieldValue(row, 'number'),
    pages: readFieldValue(row, 'pages'),
    place_published: readFieldValue(row, 'place_published'),
    publisher: readFieldValue(row, 'publisher'),
    record_last_updated: readFieldValue(row, 'record_last_updated'),
    reference_type: readOptionalInteger(row, 'reference_type'),
    secondary_author: readFieldValue(row, 'secondary_author'),
    secondary_title: readFieldValue(row, 'secondary_title'),
    section: readFieldValue(row, 'section'),
    short_title: readFieldValue(row, 'short_title'),
    title: readFieldValue(row, 'title'),
    trash_state: readRequiredInteger(row, 'trash_state'),
    type_of_work: readFieldValue(row, 'type_of_work'),
    url: readFieldValue(row, 'url'),
    volume: readFieldValue(row, 'volume'),
    year: readFieldValue(row, 'year'),
  };
}

function projectAttachmentRow(row: SqliteRow): EndnoteAttachmentRow {
  return {
    file_path: readRequiredString(row, 'file_path'),
    refs_id: readRequiredInteger(row, 'refs_id'),
  };
}

function buildAttachmentMap(
  attachmentRows: EndnoteAttachmentRow[],
): Record<string, string[]> {
  const attachmentsByReferenceId: Record<string, string[]> = {};

  for (const row of attachmentRows) {
    const key = String(row.refs_id);
    const existing = attachmentsByReferenceId[key];

    if (existing) {
      existing.push(row.file_path);
      continue;
    }

    attachmentsByReferenceId[key] = [row.file_path];
  }

  return attachmentsByReferenceId;
}

function readFieldValue(row: SqliteRow, column: string): EndnoteFieldValue {
  const value = row[column];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (value instanceof Uint8Array) {
    return FIELD_VALUE_DECODER.decode(value);
  }

  return String(value);
}

function readRequiredInteger(row: SqliteRow, column: string): number {
  const value = row[column];

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^-?\d+$/u.test(value)) {
    return Number.parseInt(value, 10);
  }

  throw new Error(`Expected integer column ${column}, received ${describeValue(value)}.`);
}

function readOptionalInteger(row: SqliteRow, column: string): number | null {
  const value = row[column];

  if (value === null || value === undefined || value === '') {
    return null;
  }

  return readRequiredInteger(row, column);
}

function readRequiredString(row: SqliteRow, column: string): string {
  const value = readFieldValue(row, column);

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  throw new Error(`Expected string column ${column}, received ${describeValue(value)}.`);
}

function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (value instanceof Uint8Array) {
    return 'Uint8Array';
  }

  return typeof value;
}
