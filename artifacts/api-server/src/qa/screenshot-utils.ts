import path from 'path';
import type { Page } from 'playwright';
import type { BoundingBox } from './types.js';
import { logger } from '../lib/logger.js';

export interface CaptureResult {
  filename: string;
  boundingBox?: BoundingBox;
}

/**
 * Captures a full-page screenshot with a red highlight box drawn at the
 * element's absolute position in the document.
 *
 * Workflow:
 *   1. Locate the element via `selector`
 *   2. Scroll it into view so getBoundingClientRect() is accurate
 *   3. Compute the element's absolute page coordinates (rect + scrollOffset)
 *   4. Inject a position:absolute overlay div at those coordinates with a red border
 *   5. Take a full-page screenshot (captures the entire scrollable document)
 *   6. Remove the overlay div
 *   7. Save to `<screenshotsDir>/<jobId>_issue-<issueId>.png`
 *
 * @returns CaptureResult with filename and optional boundingBox, or undefined on failure.
 */
export async function captureIssueScreenshot(
  page: Page,
  selector: string,
  issueId: string,
  screenshotsDir: string
): Promise<CaptureResult | undefined> {
  const jobId = path.basename(screenshotsDir);
  const filename = `${jobId}_issue-${issueId}.png`;
  const filePath = path.join(screenshotsDir, filename);

  const OVERLAY_ID = `qa-overlay-${issueId.replace(/[^a-z0-9]/gi, '-')}`;

  try {
    const element = await page.$(selector);
    if (!element) {
      logger.warn({ selector, issueId }, 'captureIssueScreenshot: element not found, skipping');
      return undefined;
    }

    // Scroll into view so the element has a valid bounding rect
    await element.evaluate((el) =>
      el.scrollIntoView({ behavior: 'instant', block: 'center' })
    );

    // Get absolute document coordinates of the element
    const absBox = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      };
    }, selector);

    if (!absBox || absBox.width <= 0 || absBox.height <= 0) {
      // Element has no layout box — take plain full-page screenshot
      await page.screenshot({ path: filePath, fullPage: true });
      return { filename };
    }

    const boundingBox: BoundingBox = {
      x: Math.round(absBox.left),
      y: Math.round(absBox.top),
      width: Math.round(absBox.width),
      height: Math.round(absBox.height),
    };

    // Inject an absolutely-positioned red highlight overlay into the document
    await page.evaluate(
      ({ box, id }) => {
        const div = document.createElement('div');
        div.id = id;
        div.style.cssText = [
          'position: absolute',
          `top: ${box.top}px`,
          `left: ${box.left}px`,
          `width: ${box.width}px`,
          `height: ${box.height}px`,
          'border: 3px solid red',
          'background: rgba(255, 0, 0, 0.12)',
          'box-shadow: 0 0 0 3px rgba(255,0,0,0.35)',
          'pointer-events: none',
          'z-index: 2147483647',
          'box-sizing: border-box',
        ].join('; ');
        document.body.appendChild(div);
      },
      { box: absBox, id: OVERLAY_ID }
    );

    // Scroll back to the element so it is centered in the viewport
    await element.evaluate((el) =>
      el.scrollIntoView({ behavior: 'instant', block: 'center' })
    );

    // Capture the entire page
    await page.screenshot({ path: filePath, fullPage: true });

    // Remove overlay
    await page.evaluate((id) => {
      document.getElementById(id)?.remove();
    }, OVERLAY_ID);

    return { filename, boundingBox };
  } catch (err) {
    logger.warn(
      { selector, issueId, err: err instanceof Error ? err.message : String(err) },
      'captureIssueScreenshot: failed, skipping screenshot'
    );
    // Attempt overlay cleanup even after failure
    try {
      await page.evaluate((id) => {
        document.getElementById(id)?.remove();
      }, OVERLAY_ID);
    } catch {
      // Ignore cleanup errors
    }
    return undefined;
  }
}
