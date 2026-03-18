import { test, expect } from '@playwright/test';

import {
  convertFixture,
  gotoApp,
  readDownloadedText,
  summaryLine,
  uploadFixtureZip,
} from './helpers';

test.describe('chromium smoke coverage', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Required only for the supported Chromium baseline.');

  test('downloads XML for the supported ZIP-first success path', async ({ page }) => {
    await convertFixture(page, 'supported-enl-data.zip');

    const downloaded = await readDownloadedText(
      page.getByRole('button', { name: 'Download Zotero XML' }),
      page,
    );

    expect(downloaded.suggestedFilename).toBe('supportedlibrary-zotero-import.xml');
    expect(downloaded.text).toContain('<title>Supported ENL Record</title>');
    expect(downloaded.text).toContain('<rec-number>1</rec-number>');
  });

  test('surfaces browser-local attachment warnings for attachment-bearing fixtures', async ({ page }) => {
    await convertFixture(page, 'attachment-present.zip');

    await expect(summaryLine(page, 'Attachment mode:')).toContainText('metadata-only-no-links');
    await expect(summaryLine(page, 'Attachments detected:')).toContainText('1');
    await expect(summaryLine(page, 'References with attachments:')).toContainText('1');
    await expect(summaryLine(page, 'Warnings:')).toContainText('1');
    await expect(page.getByText(/ATTACHMENT_LINKS_OMITTED/)).toBeVisible();
  });

  test('opens an accessible exported-items modal with title, author, year, and pdf indicator columns', async ({ page }) => {
    await convertFixture(page, 'supported-enl-data.zip');

    await page.getByRole('button', { name: /View Exported Items/ }).click();

    await expect(page.locator('#items-modal')).toBeVisible();
    await expect(page.locator('#items-modal-title')).toContainText('SupportedLibrary');
    await expect(page.locator('.items-table thead')).toContainText('Title');
    await expect(page.locator('.items-table thead')).toContainText('Author');
    await expect(page.locator('.items-table thead')).toContainText('Year');
    await expect(page.locator('.items-table thead')).toContainText('PDF');

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('#items-modal')).toBeHidden();
  });

  test('shows the documented error surface for malformed archives', async ({ page }) => {
    await gotoApp(page);
    await uploadFixtureZip(page, 'malformed-archive.zip');

    await expect(page.getByRole('heading', { name: 'Conversion Failed' })).toBeVisible();
    await expect(page.locator('.error-list')).toContainText(
      'The uploaded file could not be opened as a ZIP archive.',
    );
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
  });
});
