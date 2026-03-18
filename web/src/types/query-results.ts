export type EndnoteFieldValue = number | string | null;

export interface EndnoteReferenceRow {
  abstract: EndnoteFieldValue;
  access_date: EndnoteFieldValue;
  accession_number: EndnoteFieldValue;
  added_to_library: EndnoteFieldValue;
  alt_title: EndnoteFieldValue;
  alternate_title: EndnoteFieldValue;
  author: EndnoteFieldValue;
  author_address: EndnoteFieldValue;
  custom_1: EndnoteFieldValue;
  custom_2: EndnoteFieldValue;
  custom_3: EndnoteFieldValue;
  custom_7: EndnoteFieldValue;
  database_provider: EndnoteFieldValue;
  date: EndnoteFieldValue;
  edition: EndnoteFieldValue;
  electronic_resource_number: EndnoteFieldValue;
  id: number;
  isbn: EndnoteFieldValue;
  keywords: EndnoteFieldValue;
  label: EndnoteFieldValue;
  language: EndnoteFieldValue;
  name_of_database: EndnoteFieldValue;
  notes: EndnoteFieldValue;
  number: EndnoteFieldValue;
  pages: EndnoteFieldValue;
  place_published: EndnoteFieldValue;
  publisher: EndnoteFieldValue;
  record_last_updated: EndnoteFieldValue;
  reference_type: number | null;
  secondary_author: EndnoteFieldValue;
  secondary_title: EndnoteFieldValue;
  section: EndnoteFieldValue;
  short_title: EndnoteFieldValue;
  title: EndnoteFieldValue;
  trash_state: number;
  type_of_work: EndnoteFieldValue;
  url: EndnoteFieldValue;
  volume: EndnoteFieldValue;
  year: EndnoteFieldValue;
}

export interface EndnoteAttachmentRow {
  file_path: string;
  refs_id: number;
}

export interface EndnoteQuerySummary {
  attachmentRowCount: number;
  referenceRowCount: number;
}

export interface EndnoteQueryResult {
  attachmentRows: EndnoteAttachmentRow[];
  attachmentsByReferenceId: Record<string, string[]>;
  databaseArchivePath: string;
  databaseRelativePath: string;
  libraryId: string;
  referenceRows: EndnoteReferenceRow[];
  summary: EndnoteQuerySummary;
}
