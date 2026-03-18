import { test, expect } from '@playwright/test';

import { convertFixture, gotoApp, summaryLine } from './helpers';

test.describe('browser support matrix baseline', () => {
  test('keeps the served ZIP-first workflow usable across claimed browser tiers', async ({ page }) => {
    await convertFixture(page, 'supported-enl-data.zip');

    await expect(summaryLine(page, 'Library:')).toContainText('SupportedLibrary');
    await expect(summaryLine(page, 'Exported records:')).toContainText('1');
    await expect(summaryLine(page, 'Input rows:')).toContainText('1');
    await expect(summaryLine(page, 'Skipped rows:')).toContainText('0');
    await expect(page.getByText('Warnings: None')).toBeVisible();
  });

  test('keeps the supported ZIP-first affordance visible even when direct-folder intake is unavailable', async ({ page, browserName }) => {
    await gotoApp(page);

    await expect(
      page.getByText('Upload a ZIP that contains either an .enl library plus matching .Data folder or an .enlp package export.'),
    ).toBeVisible();
    await expect(page.getByText('Choose ZIP file')).toBeVisible();

    if (browserName === 'chromium') {
      await expect(page.getByText(/Experimental direct-folder intake|Direct-folder intake unavailable here/)).toBeVisible();
      return;
    }

    await expect(page.getByText('Direct-folder intake unavailable here')).toBeVisible();
  });
});
