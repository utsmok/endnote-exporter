import { test, expect } from '@playwright/test';

import { convertFixture, gotoApp, summaryLine } from './helpers';

test.describe('browser support matrix baseline', () => {
  test('keeps the served ZIP-first workflow usable across claimed browser tiers', async ({ page }) => {
    await convertFixture(page, 'supported-enl-data.zip');

    await expect(summaryLine(page, 'Library')).toContainText('SupportedLibrary');
    await expect(summaryLine(page, 'Exported records')).toContainText('1');
    await expect(summaryLine(page, 'Input rows')).toContainText('1');
    await expect(summaryLine(page, 'Skipped rows')).toContainText('0');
    await expect(page.getByRole('heading', { name: 'Warnings' })).toHaveCount(0);
  });

  test('keeps the supported ZIP-first affordance visible even when direct-folder intake is unavailable', async ({ page, browserName }) => {
    await gotoApp(page);

    await expect(
      page.getByText('Accepted ZIPs can contain an .enl library with its matching .Data folder or packaged .enlp contents.'),
    ).toBeVisible();
    await expect(page.getByText('Choose ZIP file')).toBeVisible();

    if (browserName === 'chromium') {
      await expect(page.getByRole('button', { name: 'Choose library folder instead' })).toBeVisible();
      return;
    }

    await expect(page.getByRole('button', { name: 'Choose library folder instead' })).toHaveCount(0);
  });
});
