import { expect, type Locator, type Page } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../../..');
const fixtureRoot = resolve(repoRoot, 'testing/browser-local/fixtures');

export function fixturePath(fileName: string): string {
  return resolve(fixtureRoot, fileName);
}

export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Convert EndNote Libraries to Zotero' }),
  ).toBeVisible();
  await expect(page.getByText(/Worker initialised successfully\./)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'System information' })).toHaveCount(0);
  await expect(page.locator('#attachment-base-path')).toBeVisible();
  await expect(page.locator('#zip-file-input')).toBeVisible();
}

export async function uploadFixtureZip(page: Page, fileName: string): Promise<void> {
  await page.locator('#zip-file-input').setInputFiles(fixturePath(fileName));
}

export async function expectConversionComplete(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'Conversion Complete' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Zotero XML' })).toBeVisible();
}

export async function convertFixture(page: Page, fileName: string): Promise<void> {
  await gotoApp(page);
  await uploadFixtureZip(page, fileName);
  await expectConversionComplete(page);
}

export function summaryLine(page: Page, label: string): Locator {
  return page.locator('.success-summary p').filter({ hasText: label });
}

export async function readDownloadedText(
  locator: Locator,
  page: Page,
): Promise<{ suggestedFilename: string; text: string }> {
  await page.evaluate(() => {
    const globalObject = window as Window & {
      __copilotDownloadCapture?: { suggestedFilename: string | null; text: string | null };
      __copilotDownloadInstalled?: boolean;
    };

    if (globalObject.__copilotDownloadInstalled) {
      globalObject.__copilotDownloadCapture = {
        suggestedFilename: null,
        text: null,
      };
      return;
    }

    globalObject.__copilotDownloadCapture = {
      suggestedFilename: null,
      text: null,
    };

    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource): string => {
      if (object instanceof Blob) {
        void object.text().then((text) => {
          if (globalObject.__copilotDownloadCapture) {
            globalObject.__copilotDownloadCapture.text = text;
          }
        });
      }

      return originalCreateObjectURL(object);
    };

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement): void {
      if (globalObject.__copilotDownloadCapture && this.download) {
        globalObject.__copilotDownloadCapture.suggestedFilename = this.download;
      }

      return originalClick.call(this);
    };

    globalObject.__copilotDownloadInstalled = true;
  });

  await locator.click();

  await page.waitForFunction(() => {
    const globalObject = window as Window & {
      __copilotDownloadCapture?: { suggestedFilename: string | null; text: string | null };
    };

    return Boolean(
      globalObject.__copilotDownloadCapture?.suggestedFilename
        && globalObject.__copilotDownloadCapture?.text,
    );
  });

  const capture = await page.evaluate(() => {
    const globalObject = window as Window & {
      __copilotDownloadCapture?: { suggestedFilename: string | null; text: string | null };
    };

    return globalObject.__copilotDownloadCapture ?? null;
  });

  if (!capture?.suggestedFilename || !capture.text) {
    throw new Error('Expected the browser download flow to capture a filename and XML text.');
  }

  return {
    suggestedFilename: capture.suggestedFilename,
    text: capture.text,
  };
}
