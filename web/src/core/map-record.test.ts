import { describe, expect, it } from 'vitest';

import { mapRecord } from './map-record';
import type { EndnoteReferenceRow } from '../types/query-results';

function buildReferenceRow(
  overrides: Partial<EndnoteReferenceRow> = {},
): EndnoteReferenceRow {
  return {
    abstract: null,
    access_date: null,
    accession_number: null,
    added_to_library: null,
    alt_title: null,
    alternate_title: null,
    author: null,
    author_address: null,
    custom_1: null,
    custom_2: null,
    custom_3: null,
    custom_7: null,
    database_provider: null,
    date: null,
    edition: null,
    electronic_resource_number: null,
    id: 1,
    isbn: null,
    keywords: null,
    label: null,
    language: null,
    name_of_database: null,
    notes: null,
    number: null,
    pages: null,
    place_published: null,
    publisher: null,
    record_last_updated: null,
    reference_type: 0,
    secondary_author: null,
    secondary_title: null,
    section: null,
    short_title: null,
    title: 'Synthetic Title',
    trash_state: 0,
    type_of_work: null,
    url: null,
    volume: null,
    year: null,
    ...overrides,
  };
}

function toLocalIsoSeconds(timestamp: number): string {
  const dt = new Date(timestamp * 1000);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const seconds = String(dt.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

describe('mapRecord', () => {
  it('formats created and modified timestamps as local ISO seconds without timezone drift', () => {
    const timestamp = 1_700_000_000;
    const record = mapRecord(
      buildReferenceRow({
        added_to_library: `${timestamp}.9`,
        notes: 'Timestamp fixture',
        record_last_updated: timestamp,
      }),
    );

    const expected = toLocalIsoSeconds(timestamp);

    expect(record.notes).toContain(`Created: ${expected}`);
    expect(record.notes).toContain(`Modified: ${expected}`);
    expect(record.notes).not.toContain('Z');
    expect(record.notes).not.toContain('.000');
  });

  it('treats a shorter alternate title as the periodical abbreviation for journal records', () => {
    const record = mapRecord(
      buildReferenceRow({
        alternate_title: 'J. Synth. Fixtures',
        reference_type: 0,
        secondary_title: 'Journal of Very Long Synthetic Fixtures',
      }),
    );

    expect(record.periodical).toEqual({
      'abbr-1': 'J. Synth. Fixtures',
      'full-title': 'Journal of Very Long Synthetic Fixtures',
    });
    expect(record['alt-periodical']).toBeUndefined();
  });
});
