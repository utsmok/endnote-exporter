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
    await expect(page.getByRole('heading', { name: 'Convert EndNote Libraries to Zotero XML' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');

    await page.getByRole('button', { name: 'System' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  });

  test('shows the desktop-first intake hierarchy with workflow and trust blocks before conversion', async ({ page }) => {
    await gotoApp(page);

    await expect(page.getByRole('heading', { name: 'Start with a library ZIP' })).toBeVisible();
    await expect(page.getByText('ZIP-first stays primary')).toBeVisible();
    await expect(page.getByText('PDF links are opt-in')).toBeVisible();
    await expect(page.getByText('Desktop review workspace')).toBeVisible();
  });

  test('supports a skip link and exposes live status text for keyboard users', async ({ page }) => {
    await gotoApp(page);

    await page.locator('.skip-link').focus();
    await expect(page.locator('.skip-link')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    await expect(page.locator('[data-live-region="status"]')).toContainText('ZIP upload is the supported baseline');
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

    await expect(page.getByText('metadata-only-no-links')).toBeVisible();
    await expect(summaryLine(page, 'Attachments detected')).toContainText('1');
    await expect(summaryLine(page, 'References with attachments')).toContainText('1');
    await expect(page.getByRole('heading', { name: 'Warnings' })).toBeVisible();
    await expect(page.getByText('PDF links were omitted')).toBeVisible();
  });

  test('renders an inline exported-items workspace with DOI links and PDF status icons', async ({ page }) => {
    await convertFixture(page, 'supported-enl-data.zip');

    await expect(page.locator('#items-modal')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Review workspace' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SupportedLibrary' })).toBeVisible();
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
    await expect(page.locator('.items-table__caption')).toContainText('Inline desktop review workspace');

    const viewport = page.viewportSize();
    const workspaceBox = await page.locator('.review-workspace__table-card').boundingBox();

    expect(viewport).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    expect(workspaceBox?.width ?? 0).toBeGreaterThan(((viewport?.width ?? 0) * 0.45));
  });

  test('keeps the inline review workspace usable with larger text at desk-scale widths', async ({ page }) => {
    await page.setViewportSize({ width: 980, height: 1180 });
    await convertFixture(page, 'supported-enl-data.zip');

    await page.addStyleTag({ content: 'html { font-size: 125%; }' });

    await expect(page.getByRole('button', { name: 'Download Zotero XML' })).toBeVisible();
    await expect(page.locator('.review-workspace__table-wrap')).toBeVisible();
    await expect(page.locator('#review-workspace-description')).toContainText('larger text or browser zoom');
  });

  test('surfaces a privacy-aligned session-loss notice after refresh clears in-memory review data', async ({ page }) => {
    await convertFixture(page, 'supported-enl-data.zip');

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Start with a library ZIP' })).toBeVisible();
    await expect(page.getByText('Previous review data was cleared')).toBeVisible();
    await expect(page.getByText('intentionally not restored after refresh')).toBeVisible();
  });

  test('broadly reduces motion when the user prefers reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoApp(page);

    await expect(page.getByRole('button', { name: 'Choose ZIP file' })).toBeVisible();

    const transitionDuration = await page.locator('.button').evaluate((element) => {
      return window.getComputedStyle(element).transitionDuration;
    });

    expect(transitionDuration).toBe('0s');
  });

  test('shows the documented error surface for malformed archives', async ({ page }) => {
    await gotoApp(page);
    await uploadFixtureZip(page, 'malformed-archive.zip');

    await expect(page.getByRole('heading', { name: 'Recovery required' })).toBeVisible();
    await expect(page.locator('.error-list')).toContainText(
      'The uploaded file could not be opened as a ZIP archive.',
    );
    await expect(page.getByRole('button', { name: 'Reset to supported baseline' })).toBeVisible();
  });
});
