import path from 'path';
import type { Page } from 'playwright';
import { logger } from '../lib/logger.js';

/**
 * Captures a screenshot of a specific element, highlighted with a red outline.
 *
 * Workflow:
 *   1. Locate the element via `selector`
 *   2. Scroll it into view
 *   3. Inject a red outline + semi-transparent red background via page.evaluate()
 *   4. Take either a cropped element screenshot (preferred) or full-page fallback
 *   5. Remove the injected styles
 *   6. Save to `<screenshotsDir>/<jobId>_issue-<issueId>.png`
 *
 * The filename is prefixed with the jobId (the base name of screenshotsDir) so the
 * existing `/api/screenshots/:filename` endpoint can resolve the correct subdirectory.
 *
 * @returns The filename (not full path), or undefined on failure.
 */
export async function captureIssueScreenshot(
  page: Page,
  selector: string,
  issueId: string,
  screenshotsDir: string
): Promise<string | undefined> {
  // Derive jobId from the directory name so the serving endpoint can locate the file
  const jobId = path.basename(screenshotsDir);
  const filename = `${jobId}_issue-${issueId}.png`;
  const filePath = path.join(screenshotsDir, filename);

  try {
    // Locate element — skip if not found
    const element = await page.$(selector);
    if (!element) {
      logger.warn({ selector, issueId }, 'captureIssueScreenshot: element not found, skipping');
      return undefined;
    }

    // Scroll element into view so it is visible in the viewport
    await element.evaluate((el) =>
      el.scrollIntoView({ behavior: 'instant', block: 'center' })
    );

    // Inject highlight styles — red outline + faint red background
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      (el as HTMLElement).dataset['qaHighlight'] = 'true';
      (el as HTMLElement).style.setProperty('outline', '3px solid red', 'important');
      (el as HTMLElement).style.setProperty('outline-offset', '2px', 'important');
      (el as HTMLElement).style.setProperty(
        'background-color',
        'rgba(255, 0, 0, 0.1)',
        'important'
      );
    }, selector);

    // Prefer a cropped element screenshot; fall back to full-page if bounding box unavailable
    const box = await element.boundingBox();
    if (box && box.width > 0 && box.height > 0) {
      // Add a small padding around the element for context
      const padding = 16;
      await page.screenshot({
        path: filePath,
        clip: {
          x: Math.max(0, box.x - padding),
          y: Math.max(0, box.y - padding),
          width: box.width + padding * 2,
          height: box.height + padding * 2,
        },
      });
    } else {
      // Element has no layout box (e.g., <head>) — take a full-page screenshot instead
      await page.screenshot({ path: filePath, fullPage: true });
    }

    // Clean up injected highlight styles so subsequent captures are not affected
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      delete (el as HTMLElement).dataset['qaHighlight'];
      (el as HTMLElement).style.removeProperty('outline');
      (el as HTMLElement).style.removeProperty('outline-offset');
      (el as HTMLElement).style.removeProperty('background-color');
    }, selector);

    return filename;
  } catch (err) {
    logger.warn(
      { selector, issueId, err: err instanceof Error ? err.message : String(err) },
      'captureIssueScreenshot: failed, skipping screenshot'
    );
    // Attempt style cleanup even after failure
    try {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return;
        (el as HTMLElement).style.removeProperty('outline');
        (el as HTMLElement).style.removeProperty('outline-offset');
        (el as HTMLElement).style.removeProperty('background-color');
      }, selector);
    } catch {
      // Ignore cleanup errors
    }
    return undefined;
  }
}
