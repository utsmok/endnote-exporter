import { describe, expect, it } from 'vitest';

import {
  getSeverityPresentation,
  summarizeWarnings,
} from './view-helpers';

describe('view helpers', () => {
  it('maps warning codes into grouped recovery-oriented summaries', () => {
    const summaries = summarizeWarnings([
      {
        code: 'RECORD_SKIPPED',
        message: 'Record 8 could not be converted.',
        recordId: 8,
      },
      {
        code: 'RECORD_SKIPPED',
        message: 'Record 11 could not be converted.',
        recordId: 11,
      },
      {
        code: 'ATTACHMENT_PAYLOAD_MISSING',
        message: 'Attachment payload was not present in the selected archive.',
        recordId: 12,
      },
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      count: 2,
      title: 'Some records were skipped',
    });
    expect(summaries[1]).toMatchObject({
      count: 1,
      title: 'Attachment payloads were missing',
    });
  });

  it('describes the warning severity band with explicit review language', () => {
    expect(getSeverityPresentation('warning')).toMatchObject({
      label: 'Review required',
    });
  });
});
