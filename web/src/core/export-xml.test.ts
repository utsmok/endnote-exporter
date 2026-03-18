import { describe, expect, it } from 'vitest';
import { XMLValidator } from 'fast-xml-parser';

import { generateExportXml } from './export-xml';
import type { MappedRecord } from './map-record';

describe('generateExportXml', () => {
  it('escapes XML special characters in text and attribute values', () => {
    const record: MappedRecord = {
      'rec-number': 7,
      'ref-type': {
        value: 17,
        name: 'Journal "Article" & More',
      },
      dates: {
        year: '2026',
      },
      titles: {
        title: 'Fish & Chips <Synthetic>',
        'secondary-title': 'Fixtures > Fuzzing',
        'short-title': '',
        'alt-title': '',
      },
      pages: '',
      volume: '',
      number: '',
      abstract: '5 < 6 & 7 > 3',
      isbn: '',
      notes: 'Use "quotes" & apostrophes like \'this\'.',
      urls: {
        'web-urls': ['https://example.test/?a=1&b=2'],
      },
    };

    const xml = generateExportXml([record]);

    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain('name="Journal &quot;Article&quot; &amp; More"');
    expect(xml).toContain('<title>Fish &amp; Chips &lt;Synthetic&gt;</title>');
    expect(xml).toContain('<secondary-title>Fixtures &gt; Fuzzing</secondary-title>');
    expect(xml).toContain('<abstract>5 &lt; 6 &amp; 7 &gt; 3</abstract>');
    expect(xml).toContain('<notes>Use "quotes" &amp; apostrophes like \'this\'.</notes>');
    expect(xml).toContain('<url>https://example.test/?a=1&amp;b=2</url>');
  });
});
