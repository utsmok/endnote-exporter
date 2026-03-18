/**
 * Core record mapping logic.
 *
 * Ported from Python exporter EndnoteExporter._build_record_dict().
 */

import type { EndnoteReferenceRow } from '../types/query-results';
import {
  JOURNAL_ABBREVS,
  CONFERENCE_REF_TYPES,
  JOURNAL_ARTICLE_REF_TYPE,
  ENDNOTE_REF_TYPE_MAP,
  REF_TYPE_NAMES,
} from './reference-type-map';
import { normalizeToCr, normalizeNewlines, isReasonableAbbr } from './sanitize';

/**
 * Converts an EndnoteFieldValue to a string.
 */
function asString(value: string | number | null): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

/**
 * Converts an EndnoteFieldValue to a string or null.
 */
function asStringOrNull(value: string | number | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

/**
 * Represents a mapped EndNote record ready for XML serialization.
 *
 * Source: endnote_exporter.py _build_record_dict() return value
 */
export interface MappedRecord {
  'rec-number': number;
  'ref-type': { value: number; name: string };
  dates: {
    year?: string;
    'pub-dates'?: { date: string } | { date: string }[];
  };
  titles: {
    title?: string | null;
    'secondary-title'?: string | null;
    'short-title'?: string;
    'alt-title'?: string;
    'tertiary-title'?: string;
  };
  contributors?: {
    authors: string[];
    'secondary-authors'?: string[];
  };
  periodical?: {
    'full-title': string;
    'abbr-1'?: string;
  };
  'alt-periodical'?: {
    'full-title'?: string;
    'abbr-1'?: string;
  };
  pages?: string | null;
  volume?: string | null;
  number?: string | null;
  abstract?: string | null;
  isbn?: string;
  'electronic-resource-num'?: string;
  language?: string;
  'work-type'?: string;
  custom7?: string;
  section?: string;
  label?: string;
  'pub-location'?: string;
  publisher?: string;
  'accession-num'?: string;
  'auth-address'?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
  edition?: string;
  urls?: {
    'web-urls'?: string[];
    'pdf-urls'?: string[];
  };
  keywords?: {
    keyword: string[];
  };
  'remote-database-name'?: string;
  'remote-database-provider'?: string;
  'access-date'?: string;
  notes: string;
}

/**
 * Maps an EndNote reference row to a structured record for XML emission.
 *
 * @param ref - The EndNote reference row from the database query
 * @returns A mapped record ready for XML serialization
 *
 * Source: endnote_exporter.py _build_record_dict()
 */
export function mapRecord(ref: EndnoteReferenceRow): MappedRecord {
  const record: MappedRecord = {
    'rec-number': ref.id,
    'ref-type': mapReferenceType(ref.reference_type),
    dates: buildDates(ref),
    titles: buildTitles(ref),
    notes: buildNotes(ref),
  };

  // Contributors (conditional on author presence)
  if (ref.author) {
    const contributors = buildContributors(ref);
    if (contributors) {
      record.contributors = contributors;
    }
  }

  // Periodical (conditional on mapped type and secondary_title)
  const mappedRefType = record['ref-type'].value;
  if (ref.secondary_title && shouldEmitPeriodical(asString(ref.secondary_title), mappedRefType)) {
    record.periodical = { 'full-title': asString(ref.secondary_title) };
  }

  // Scalar bibliographic fields (always emitted, may be empty)
  record.pages = asStringOrNull(ref.pages);
  record.volume = asStringOrNull(ref.volume);
  record.number = asStringOrNull(ref.number);
  record.abstract = asStringOrNull(ref.abstract);

  // ISBN with newline normalization
  if (ref.isbn) {
    record.isbn = normalizeToCr(asString(ref.isbn));
  }

  // Electronic resource number (DOI)
  if (ref.electronic_resource_number) {
    record['electronic-resource-num'] = asString(ref.electronic_resource_number);
  }

  // Language
  if (ref.language) {
    record.language = asString(ref.language);
  }

  // Work type
  if (ref.type_of_work) {
    record['work-type'] = asString(ref.type_of_work);
  }

  // Custom fields
  if (ref.custom_7) {
    record.custom7 = asString(ref.custom_7);
  }
  if (ref.custom_3) {
    record.custom3 = asString(ref.custom_3);
  }
  if (ref.section) {
    record.section = asString(ref.section);
  }
  if (ref.label) {
    record.label = asString(ref.label);
  }

  // Publication location
  if (ref.place_published) {
    record['pub-location'] = asString(ref.place_published);
  }

  const altTitle = ref.alternate_title || ref.alt_title;
  const shortTitle = ref.short_title;
  const secondaryTitle = ref.secondary_title;

  if (altTitle) {
    const altTitleStr = asString(altTitle);

    try {
      if (
        secondaryTitle
        && altTitleStr.trim().length < asString(secondaryTitle).trim().length
      ) {
        if (record.periodical) {
          record.periodical['abbr-1'] = altTitleStr;
        } else {
          record['alt-periodical'] = { 'abbr-1': altTitleStr };
        }
      } else {
        const altPeriodical: MappedRecord['alt-periodical'] = {
          'full-title': altTitleStr,
        };

        if (shortTitle && isReasonableAbbr(asString(shortTitle))) {
          altPeriodical['abbr-1'] = asString(shortTitle);
        }

        record['alt-periodical'] = altPeriodical;
      }
    } catch {
      record['alt-periodical'] = { 'full-title': altTitleStr };
    }
  } else if (
    record.periodical
    && shortTitle
    && isReasonableAbbr(asString(shortTitle))
  ) {
    record.periodical['abbr-1'] = asString(shortTitle);
  }

  // Known journal abbreviation mapping
  if (
    record.periodical &&
    record.periodical['full-title'] &&
    !record.periodical['abbr-1']
  ) {
    const fullTitle = record.periodical['full-title'];
    const knownAbbr = JOURNAL_ABBREVS[fullTitle];
    if (knownAbbr && isReasonableAbbr(knownAbbr)) {
      record.periodical['abbr-1'] = knownAbbr;
    }
  }

  // If alt-title matches known abbreviation, emit alt-periodical (journal only)
  if (
    mappedRefType === JOURNAL_ARTICLE_REF_TYPE &&
    altTitle &&
    record.periodical &&
    record.periodical['full-title']
  ) {
    const fullTitle = record.periodical['full-title'];
    const knownAbbr = JOURNAL_ABBREVS[fullTitle];
    const altTitleValue = asString(altTitle).trim();

    if (knownAbbr && altTitleValue === knownAbbr && isReasonableAbbr(knownAbbr)) {
      record['alt-periodical'] = {
        'full-title': fullTitle,
        'abbr-1': knownAbbr,
      };
    }
  }

  // Remove alt-periodical for non-journal records
  if (mappedRefType !== JOURNAL_ARTICLE_REF_TYPE && record['alt-periodical']) {
    delete record['alt-periodical'];
  }

  // Tertiary-title fallback for conference/proceedings types
  if (
    (CONFERENCE_REF_TYPES.has(mappedRefType) || mappedRefType === 10) &&
    !ref.secondary_title &&
    altTitle
  ) {
    record.titles['tertiary-title'] = asString(altTitle);
  }

  // Publisher
  if (ref.publisher) {
    record.publisher = asString(ref.publisher);
  }

  // Accession number
  if (ref.accession_number) {
    record['accession-num'] = asString(ref.accession_number);
  }

  // Author address with newline normalization
  if (ref.author_address) {
    record['auth-address'] = normalizeToCr(asString(ref.author_address).trim());
  }

  // Custom fields
  if (ref.custom_1) {
    record.custom1 = asString(ref.custom_1);
  }
  if (ref.custom_2) {
    record.custom2 = asString(ref.custom_2);
  }

  // Edition
  if (ref.edition) {
    record.edition = asString(ref.edition);
  }

  // URLs (conditional)
  const urls = buildUrls(ref);
  if (urls) {
    record.urls = urls;
  }

  // Keywords (conditional)
  if (ref.keywords) {
    const keywords = splitKeywords(ref.keywords);
    if (keywords.length > 0) {
      record.keywords = { keyword: keywords };
    }
  }

  // Remote database fields
  if (ref.name_of_database) {
    record['remote-database-name'] = asString(ref.name_of_database);
  }
  if (ref.database_provider) {
    record['remote-database-provider'] = asString(ref.database_provider);
  }

  // Access date
  if (ref.access_date) {
    record['access-date'] = formatAccessDate(asString(ref.access_date));
  }

  return record;
}

/**
 * Maps a raw EndNote reference_type to a Zotero-compatible ref-type.
 */
function mapReferenceType(
  rawRefType: number | null,
): { value: number; name: string } {
  let parsedType = 0;

  if (rawRefType !== null && rawRefType !== undefined) {
    try {
      parsedType = Number(rawRefType);
    } catch {
      // Fall back to 0 (will be mapped to 17)
      parsedType = 0;
    }
  }

  const mapped = ENDNOTE_REF_TYPE_MAP[parsedType] ?? parsedType;

  return {
    value: mapped,
    name: REF_TYPE_NAMES[mapped] || '',
  };
}

/**
 * Builds the dates block for a record.
 */
function buildDates(ref: EndnoteReferenceRow): MappedRecord['dates'] {
  const dates: MappedRecord['dates'] = {};

  if (ref.year) {
    dates.year = asString(ref.year);
  }

  if (ref.date) {
    dates['pub-dates'] = { date: asString(ref.date) };
  }

  return dates;
}

/**
 * Builds the titles block for a record.
 */
function buildTitles(ref: EndnoteReferenceRow): MappedRecord['titles'] {
  return {
    title: asStringOrNull(ref.title),
    'secondary-title': asStringOrNull(ref.secondary_title),
    'short-title': asString(ref.short_title) || '',
    'alt-title': asString(ref.alternate_title || ref.alt_title) || '',
  };
}

/**
 * Builds the contributors block for a record.
 */
function buildContributors(ref: EndnoteReferenceRow): MappedRecord['contributors'] {
  const contributors: MappedRecord['contributors'] = {
    authors: splitAuthors(ref.author!),
  };

  if (ref.secondary_author) {
    contributors['secondary-authors'] = splitSecondaryAuthors(ref.secondary_author);
  }

  return contributors;
}

/**
 * Determines whether to emit a periodical element.
 */
function shouldEmitPeriodical(secondaryTitle: string, mappedRefType: number): boolean {
  if (!secondaryTitle) {
    return false;
  }

  // Emit for journal articles
  if (mappedRefType === JOURNAL_ARTICLE_REF_TYPE) {
    return true;
  }

  // Emit for titles containing "advances in"
  const lowerTitle = secondaryTitle.toLowerCase();
  if (lowerTitle.includes('advances in')) {
    return true;
  }

  return false;
}

/**
 * Builds the URLs block for a record.
 *
 * Browser-local mode does NOT emit PDF URLs.
 * Attachment links are omitted per the metadata-only policy.
 *
 * @see docs/local-web-execution/attachment-policy.md
 */
function buildUrls(ref: EndnoteReferenceRow): MappedRecord['urls'] | undefined {
  const urls: MappedRecord['urls'] = {};

  // Web URLs from the url field
  if (ref.url) {
    urls['web-urls'] = asString(ref.url)
      .trim()
      .split(/\s+/)
      .filter((u) => u.length > 0);
  }

  // PDF URLs are deliberately NOT emitted in browser-local mode
  // Per attachment policy: metadata-only, no XML attachment links
  // Attachments are tracked in export metadata but not in the XML

  return Object.keys(urls).length > 0 ? urls : undefined;
}

/**
 * Splits author field on line breaks.
 */
function splitAuthors(authorField: string | number): string[] {
  return normalizeNewlines(asString(authorField))
    .trim()
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/**
 * Splits secondary author field with normalization.
 */
function splitSecondaryAuthors(secondaryAuthor: string | number | null): string[] {
  if (!secondaryAuthor) {
    return [];
  }

  const normalized = normalizeNewlines(asString(secondaryAuthor));
  if (!normalized) {
    return [];
  }

  return normalized
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/**
 * Splits keywords into a list.
 *
 * Source: endnote_exporter.py _split_keywords()
 */
function splitKeywords(raw: string | number | null): string[] {
  if (!raw) {
    return [];
  }

  const s = asString(raw);

  // If explicit newline-separated, split on lines
  if (s.includes('\n') || s.includes('\r')) {
    return s
      .split(/\r?\n/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  // If semicolon-separated, split on semicolons
  if (s.includes(';')) {
    return s
      .split(';')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  // Otherwise preserve comma-separated raw string as single entry
  const trimmed = s.trim();
  return trimmed ? [trimmed] : [];
}

/**
 * Formats an access date value.
 *
 * @param accessRaw - The raw access_date value from the database
 * @returns Formatted date string or raw string as fallback
 *
 * Source: endnote_exporter.py _build_record_dict (access_date handling)
 */
function formatAccessDate(accessRaw: string): string {
  if (!accessRaw) {
    return '';
  }

  try {
    // Numeric epoch -> format human readable
    const isNumeric = /^\d+$/.test(accessRaw);

    if (isNumeric) {
      const timestamp = parseInt(accessRaw, 10);
      const dt = timestampToDateTime(timestamp);
      if (dt) {
        return formatDateTime(dt);
      }
    }

    // Fallback to raw string
    return accessRaw;
  } catch {
    return accessRaw;
  }
}

/**
 * Converts a Unix timestamp to a Date object.
 *
 * Returns null for invalid timestamps.
 */
function timestampToDateTime(timestamp: number): Date | null {
  if (timestamp === 0) {
    return null;
  }

  try {
    return new Date(timestamp * 1000);
  } catch {
    return null;
  }
}

/**
 * Formats a Date object as "YYYY-MM-DD HH:MM:SS".
 */
function formatDateTime(dt: Date): string {
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const seconds = String(dt.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Builds the notes block with created/modified metadata.
 */
function buildNotes(ref: EndnoteReferenceRow): string {
  const metadataLines: string[] = [];

  const addedIso = formatTimestamp(ref.added_to_library);
  if (addedIso) {
    metadataLines.push(`Created: ${addedIso}`);
  }

  const modifiedIso = formatTimestamp(ref.record_last_updated);
  if (modifiedIso) {
    metadataLines.push(`Modified: ${modifiedIso}`);
  }

  const metadataBlock = metadataLines.join('\n');
  const originalNotes = asString(ref.notes).trim() || '';

  if (originalNotes) {
    return `${originalNotes}\n\n${metadataBlock}`;
  }

  return metadataBlock;
}

/**
 * Formats a timestamp field as ISO 8601.
 *
 * @param ts - The timestamp value from the database (number, string, or null)
 * @returns ISO 8601 string or empty string
 *
 * Source: endnote_exporter.py format_timestamp()
 */
function formatTimestamp(ts: string | number | null): string {
  if (ts === null || ts === undefined || ts === '' || ts === 0) {
    return '';
  }

  try {
    let timestamp: number;

    if (typeof ts === 'number') {
      timestamp = Math.floor(ts);
    } else if (typeof ts === 'string') {
      if (/^\d+$/.test(ts)) {
        timestamp = parseInt(ts, 10);
      } else {
        // Try float-like parsing
        const floatVal = parseFloat(ts);
        if (!isNaN(floatVal)) {
          timestamp = Math.floor(floatVal);
        } else {
          return '';
        }
      }
    } else {
      return '';
    }

    if (timestamp === 0) {
      return '';
    }

    const dt = new Date(timestamp * 1000);
    if (Number.isNaN(dt.getTime())) {
      return '';
    }

    return formatLocalIsoSeconds(dt);
  } catch {
    return '';
  }
}

function formatLocalIsoSeconds(dt: Date): string {
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const seconds = String(dt.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
