import { chromium } from 'playwright';
import type { UIIssue, Severity } from './types.js';

export async function inspectUI(pages: Array<{ url: string }>): Promise<UIIssue[]> {
  const issues: UIIssue[] = [];

  const extraLibPath = '/nix/store/24w3s75aa2lrvvxsybficn8y3zxd27kp-mesa-libgbm-25.1.0/lib';
  const ldPath = process.env['LD_LIBRARY_PATH']
    ? `${extraLibPath}:${process.env['LD_LIBRARY_PATH']}`
    : extraLibPath;

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      env: { ...process.env, LD_LIBRARY_PATH: ldPath } as Record<string, string>,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    for (const { url } of pages) {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const pageIssues: UIIssue[] = await page.evaluate((pageUrl) => {
          const found: Array<{ severity: string; issueType: string; description: string; selector?: string }> = [];

          const images = document.querySelectorAll('img');
          images.forEach((img, i) => {
            if (!img.alt || img.alt.trim() === '') {
              found.push({
                severity: 'Medium',
                issueType: 'Missing Alt Text',
                description: `Image #${i + 1} is missing alt text (accessibility issue)`,
                selector: img.src ? `img[src="${img.src.substring(0, 60)}"]` : `img:nth-of-type(${i + 1})`,
              });
            }
          });

          const buttons = document.querySelectorAll('button');
          buttons.forEach((btn, i) => {
            const text = btn.textContent?.trim() || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            if (!text && !ariaLabel) {
              found.push({
                severity: 'High',
                issueType: 'Empty Button',
                description: `Button #${i + 1} has no text content or aria-label (unusable for screen readers)`,
                selector: `button:nth-of-type(${i + 1})`,
              });
            }
          });

          const links = document.querySelectorAll('a');
          links.forEach((link, i) => {
            const text = link.textContent?.trim() || '';
            const ariaLabel = link.getAttribute('aria-label') || '';
            if (!text && !ariaLabel) {
              found.push({
                severity: 'Medium',
                issueType: 'Empty Link',
                description: `Link #${i + 1} has no text content (href: ${link.href?.substring(0, 60) || 'none'})`,
                selector: `a:nth-of-type(${i + 1})`,
              });
            }
          });

          const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
          inputs.forEach((input, i) => {
            const id = input.getAttribute('id');
            const ariaLabel = input.getAttribute('aria-label');
            const ariaLabelledby = input.getAttribute('aria-labelledby');
            const hasLabel = id ? document.querySelector(`label[for="${id}"]`) !== null : false;
            if (!hasLabel && !ariaLabel && !ariaLabelledby) {
              found.push({
                severity: 'High',
                issueType: 'Missing Form Label',
                description: `Input field #${i + 1} (type: ${input.getAttribute('type') || 'text'}) has no associated label`,
                selector: `input:nth-of-type(${i + 1})`,
              });
            }
          });

          const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
          let prevLevel = 0;
          headings.forEach((h) => {
            const level = parseInt(h.tagName.substring(1));
            if (prevLevel > 0 && level > prevLevel + 1) {
              found.push({
                severity: 'Low',
                issueType: 'Heading Hierarchy Skip',
                description: `Heading hierarchy jumps from H${prevLevel} to H${level} (skips levels, bad for accessibility/SEO)`,
                selector: h.tagName.toLowerCase(),
              });
            }
            prevLevel = level;
          });

          const metaDesc = document.querySelector('meta[name="description"]');
          if (!metaDesc || !metaDesc.getAttribute('content')?.trim()) {
            found.push({
              severity: 'Low',
              issueType: 'Missing Meta Description',
              description: 'Page has no meta description tag (impacts SEO)',
              selector: 'head',
            });
          }

          const title = document.title;
          if (!title || title.trim() === '') {
            found.push({
              severity: 'Medium',
              issueType: 'Missing Page Title',
              description: 'Page has no title tag (critical for SEO and accessibility)',
              selector: 'head > title',
            });
          }

          const hasHorizontalScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;
          if (hasHorizontalScroll) {
            found.push({
              severity: 'Medium',
              issueType: 'Viewport Overflow',
              description: `Page has horizontal overflow (scrollWidth: ${document.documentElement.scrollWidth}px vs clientWidth: ${document.documentElement.clientWidth}px)`,
              selector: 'html',
            });
          }

          const overlappingIssues = (() => {
            const allElements = document.querySelectorAll('button, a, input, select, textarea');
            const rects: Array<{ el: Element; rect: DOMRect }> = [];
            allElements.forEach((el) => {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                rects.push({ el, rect });
              }
            });

            for (let i = 0; i < rects.length && i < 50; i++) {
              for (let j = i + 1; j < rects.length && j < 50; j++) {
                const a = rects[i].rect;
                const b = rects[j].rect;
                const overlap = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
                if (overlap) {
                  return `${rects[i].el.tagName.toLowerCase()} and ${rects[j].el.tagName.toLowerCase()}`;
                }
              }
            }
            return null;
          })();

          if (overlappingIssues) {
            found.push({
              severity: 'High',
              issueType: 'Overlapping Interactive Elements',
              description: `Interactive elements are overlapping: ${overlappingIssues}`,
            });
          }

          return found.map((issue) => ({ ...issue, page: pageUrl }));
        }, url);

        for (const issue of pageIssues) {
          issues.push({
            page: issue.page as string,
            severity: issue.severity as Severity,
            issueType: issue.issueType,
            description: issue.description,
            selector: issue.selector,
          });
        }
      } catch {
        // Skip failed pages
      } finally {
        await page.close();
      }
    }

    await context.close();
  } finally {
    if (browser) await browser.close();
  }

  return issues;
}
