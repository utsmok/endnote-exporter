/**
 * XML generation from mapped records.
 *
 * Ported from Python exporter EndnoteExporter._dict_to_xml().
 */

import type { MappedRecord } from './map-record';
import { escapeXmlAttribute, escapeXmlText } from './sanitize';

/**
 * Journal title normalization map.
 *
 * Source: endnote_exporter.py _dict_to_xml _normalize_journal_title()
 */
const JOURNAL_TITLE_REPLACEMENTS: Record<string, string> = {
  'Science of The Total Environment': 'Science of the Total Environment',
  'PLoS One': 'PLoS ONE',
  'Remote Sensing of Environment': 'Remote sensing of environment',
  'Sustainable cities and society': 'Sustainable Cities and Society',
};

/**
 * Generates XML document from mapped records.
 *
 * @param records - Array of mapped records to serialize
 * @returns Pretty-printed XML string
 */
export function generateExportXml(records: MappedRecord[]): string {
  return prettyPrintXml(
    buildXmlDocument(records.map((record) => serializeRecordXmlFragment(record))),
  );
}

export function buildXmlDocument(recordFragments: string[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<xml>\n  <records>\n';

  for (const fragment of recordFragments) {
    xml += fragment;
  }

  xml += '  </records>\n</xml>';

  return xml;
}

/**
 * Serializes a single record to XML.
 *
 * Exported so the conversion pipeline can preserve Python-style
 * per-record tolerance by validating/serializing records one at a time.
 */
export function serializeRecordXmlFragment(record: MappedRecord): string {
  let xml = '    <record>\n';

  xml += serializeElement('rec-number', record['rec-number'], '      ');
  xml += serializeElement('ref-type', record['ref-type'].value, '      ', {
    name: record['ref-type'].name,
  });
  xml += serializeDates(record.dates);
  xml += serializeTitles(record.titles);

  if (record.contributors) {
    xml += serializeContributors(record.contributors);
  }

  if (record.periodical) {
    xml += serializePeriodical(record.periodical);
  }

  xml += serializeElement('pages', record.pages, '      ');
  xml += serializeElement('volume', record.volume, '      ');
  xml += serializeElement('number', record.number, '      ');
  xml += serializeElement('abstract', record.abstract, '      ');
  xml += serializeElement('isbn', record.isbn, '      ');

  if (record['work-type']) {
    xml += serializeElement('work-type', record['work-type'], '      ');
  }
  if (record.custom7) {
    xml += serializeElement('custom7', record.custom7, '      ');
  }
  if (record.section) {
    xml += serializeElement('section', record.section, '      ');
  }
  if (record.label) {
    xml += serializeElement('label', record.label, '      ');
  }
  if (record['pub-location']) {
    xml += serializeElement('pub-location', record['pub-location'], '      ');
  }
  if (record['alt-periodical']) {
    xml += serializeAltPeriodical(record['alt-periodical']);
  }
  if (record.publisher) {
    xml += serializeElement('publisher', record.publisher, '      ');
  }
  if (record['accession-num']) {
    xml += serializeElement('accession-num', record['accession-num'], '      ');
  }
  if (record['auth-address']) {
    xml += serializeElement('auth-address', record['auth-address'], '      ');
  }
  if (record.custom1) {
    xml += serializeElement('custom1', record.custom1, '      ');
  }
  if (record.custom2) {
    xml += serializeElement('custom2', record.custom2, '      ');
  }
  if (record.custom3) {
    xml += serializeElement('custom3', record.custom3, '      ');
  }
  if (record.edition) {
    xml += serializeElement('edition', record.edition, '      ');
  }
  if (record['electronic-resource-num']) {
    xml += serializeElement('electronic-resource-num', record['electronic-resource-num'], '      ');
  }
  if (record.language) {
    xml += serializeElement('language', record.language, '      ');
  }
  if (record['access-date']) {
    xml += serializeElement('access-date', record['access-date'], '      ');
  }
  if (record.urls) {
    xml += serializeUrls(record.urls);
  }
  if (record.keywords) {
    xml += serializeKeywords(record.keywords);
  }

  xml += serializeElement('notes', record.notes, '      ');
  xml += '    </record>\n';

  return xml;
}

function serializeDates(dates: MappedRecord['dates']): string {
  let xml = '      <dates>\n';

  if (dates.year) {
    xml += serializeElement('year', dates.year, '        ');
  }

  if (dates['pub-dates']) {
    const pubDates = dates['pub-dates'];
    const pubDatesList = Array.isArray(pubDates) ? pubDates : [pubDates];

    for (const pubDate of pubDatesList) {
      xml += '        <pub-dates>\n';
      xml += serializeElement('date', pubDate.date, '          ');
      xml += '        </pub-dates>\n';
    }
  }

  xml += '      </dates>\n';

  return xml;
}

function serializeTitles(titles: MappedRecord['titles']): string {
  let xml = '      <titles>\n';

  xml += serializeElement('title', titles.title, '        ');
  xml += serializeElement('secondary-title', titles['secondary-title'], '        ');

  if (titles['short-title']) {
    xml += serializeElement('short-title', titles['short-title'], '        ');
  }
  if (titles['tertiary-title']) {
    xml += serializeElement('tertiary-title', titles['tertiary-title'], '        ');
  }
  if (titles['alt-title']) {
    xml += serializeElement('alt-title', titles['alt-title'], '        ');
  }

  xml += '      </titles>\n';

  return xml;
}

function serializeContributors(contributors: MappedRecord['contributors']): string {
  if (!contributors) {
    return '';
  }

  let xml = '      <contributors>\n';
  xml += '        <authors>\n';

  for (const author of contributors.authors) {
    xml += serializeElement('author', author, '          ');
  }

  xml += '        </authors>\n';

  if (contributors['secondary-authors']) {
    xml += '        <secondary-authors>\n';
    for (const author of contributors['secondary-authors']) {
      xml += serializeElement('author', author, '          ');
    }
    xml += '        </secondary-authors>\n';
  }

  xml += '      </contributors>\n';

  return xml;
}

function serializePeriodical(periodical: MappedRecord['periodical']): string {
  if (!periodical) {
    return '';
  }

  let xml = '      <periodical>\n';

  xml += serializeElement(
    'full-title',
    normalizeJournalTitle(periodical['full-title']),
    '        ',
  );

  if (periodical['abbr-1']) {
    xml += serializeElement('abbr-1', periodical['abbr-1'], '        ');
  }

  xml += '      </periodical>\n';

  return xml;
}

function serializeAltPeriodical(altPeriodical: MappedRecord['alt-periodical']): string {
  if (!altPeriodical) {
    return '';
  }

  let xml = '      <alt-periodical>\n';

  xml += serializeElement('full-title', altPeriodical['full-title'], '        ');

  if (altPeriodical['abbr-1']) {
    xml += serializeElement('abbr-1', altPeriodical['abbr-1'], '        ');
  }

  xml += '      </alt-periodical>\n';

  return xml;
}

function serializeUrls(urls: MappedRecord['urls']): string {
  if (!urls) {
    return '';
  }

  let xml = '      <urls>\n';

  if (urls['web-urls']) {
    xml += '        <web-urls>\n';
    for (const url of urls['web-urls']) {
      xml += serializeElement('url', url, '          ');
    }
    xml += '        </web-urls>\n';
  }

  if (urls['pdf-urls']) {
    xml += '        <pdf-urls>\n';
    for (const url of urls['pdf-urls']) {
      xml += serializeElement('url', url, '          ');
    }
    xml += '        </pdf-urls>\n';
  }

  xml += '      </urls>\n';

  return xml;
}

function serializeKeywords(keywords: MappedRecord['keywords']): string {
  if (!keywords) {
    return '';
  }

  let xml = '      <keywords>\n';

  for (const keyword of keywords.keyword) {
    xml += serializeElement('keyword', keyword, '        ');
  }

  xml += '      </keywords>\n';

  return xml;
}

function normalizeJournalTitle(title: string): string {
  if (!title) {
    return title;
  }

  return JOURNAL_TITLE_REPLACEMENTS[title] || title;
}

function prettyPrintXml(xml: string): string {
  return xml.endsWith('\n') ? xml : `${xml}\n`;
}

function serializeElement(
  tag: string,
  text: unknown,
  indent: string,
  attributes: Record<string, unknown> = {},
): string {
  const serializedAttributes = Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([name, value]) => ` ${name}="${escapeXmlAttribute(value)}"`)
    .join('');
  const escapedText = escapeXmlText(text);

  if (escapedText.length === 0) {
    return `${indent}<${tag}${serializedAttributes}/>\n`;
  }

  return `${indent}<${tag}${serializedAttributes}>${escapedText}</${tag}>\n`;
}
