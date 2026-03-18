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

  test('defaults to the system theme and persists an explicit theme selection', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await gotoApp(page);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
    await expect(page.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Dark' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Convert EndNote Libraries to Zotero' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');

    await page.getByRole('button', { name: 'System' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  });

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

  test('opens an accessible exported-items modal with wide layout, DOI links, and PDF status icons', async ({ page }) => {
    await convertFixture(page, 'supported-enl-data.zip');

    await page.getByRole('button', { name: /View Exported Items/ }).click();

    await expect(page.locator('#items-modal')).toBeVisible();
    await expect(page.locator('#items-modal-title')).toContainText('SupportedLibrary');
    await expect(page.locator('.items-table thead')).toContainText('Title');
    await expect(page.locator('.items-table thead')).toContainText('Author');
    await expect(page.locator('.items-table thead')).toContainText('Journal');
    await expect(page.locator('.items-table thead')).toContainText('Year');
    await expect(page.locator('.items-table thead')).toContainText('PDF');
    await expect(page.locator('.items-table thead')).toContainText('DOI');
    await expect(page.getByRole('link', { name: '10.1234/example.1' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1234/example.1',
    );
    await expect(page.locator('.attachment-indicator')).toHaveAttribute(
      'aria-label',
      /Verified PDF attachment present|No verified PDF attachment found/,
    );

    const viewport = page.viewportSize();
    const modalBox = await page.locator('.modal__content').boundingBox();

    expect(viewport).not.toBeNull();
    expect(modalBox).not.toBeNull();
    expect(modalBox?.width ?? 0).toBeGreaterThan(((viewport?.width ?? 0) * 0.8));

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
