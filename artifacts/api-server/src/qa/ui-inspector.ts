import { chromium } from 'playwright';
import type { UIIssue, Severity } from './types.js';
import { playwrightEnv } from './playwright-env.js';
import { captureIssueScreenshot } from './screenshot-utils.js';

export async function inspectUI(
  pages: Array<{ url: string }>,
  screenshotsDir?: string
): Promise<UIIssue[]> {
  const issues: UIIssue[] = [];
  let issueCounter = 0;

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      env: playwrightEnv(),
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    for (const { url } of pages) {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Run all detection logic in-page and stamp each problematic element with a
        // unique data-qa-id so Playwright can reliably re-query it for screenshots.
        const pageIssues: Array<{
          severity: string;
          issueType: string;
          description: string;
          impact: string;
          recommendation: string;
          qaId?: string;   // data-qa-id value stamped on the element, if any
          selector?: string; // human-readable selector kept for display purposes
        }> = await page.evaluate((pageUrl) => {
          let idCounter = 0;

          function stamp(el: Element): string {
            const id = `qa-${++idCounter}`;
            (el as HTMLElement).setAttribute('data-qa-id', id);
            return id;
          }

          type RawIssue = {
            severity: string;
            issueType: string;
            description: string;
            impact: string;
            recommendation: string;
            qaId?: string;
            selector?: string;
          };
          const found: RawIssue[] = [];

          // ── Missing Alt Text ──────────────────────────────────────────────
          document.querySelectorAll('img').forEach((img, i) => {
            if (!img.alt || img.alt.trim() === '') {
              const src = img.src ? img.src.substring(0, 80) : '(unknown src)';
              found.push({
                severity: 'Medium',
                issueType: 'Missing Alt Text',
                description: `Image ${i + 1} (src: "${src}") has no alt attribute or an empty one.`,
                impact:
                  'Screen readers announce this image as "image" with no context, making it meaningless to visually-impaired users. Search engines also use alt text to index images, so missing alt text reduces SEO value.',
                recommendation:
                  'Add a descriptive alt attribute that conveys the purpose or content of the image. For purely decorative images use alt="" (empty string) to tell screen readers to skip it. Avoid generic text like "image" or "photo".',
                qaId: stamp(img),
                selector: img.src ? `img[src="${img.src.substring(0, 60)}"]` : `img:nth-child(${i + 1})`,
              });
            }
          });

          // ── Empty Buttons ─────────────────────────────────────────────────
          document.querySelectorAll('button').forEach((btn, i) => {
            const text = btn.textContent?.trim() || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            if (!text && !ariaLabel) {
              found.push({
                severity: 'High',
                issueType: 'Empty Button',
                description: `Button ${i + 1} has no visible text and no aria-label attribute.`,
                impact:
                  'Keyboard-only and screen-reader users cannot determine what this button does. Automated accessibility audits will flag this as a WCAG 2.1 Level A failure (Success Criterion 4.1.2). Clicking an unmarked button by mistake can cause unintended actions.',
                recommendation:
                  'Add meaningful text inside the button element, or add an aria-label attribute (e.g., aria-label="Close dialog"). If the button only contains an icon, pair it with a visually-hidden <span> or use aria-label.',
                qaId: stamp(btn),
                selector: `button:nth-child(${i + 1})`,
              });
            }
          });

          // ── Empty Links ───────────────────────────────────────────────────
          document.querySelectorAll('a').forEach((link, i) => {
            const text = link.textContent?.trim() || '';
            const ariaLabel = link.getAttribute('aria-label') || '';
            if (!text && !ariaLabel) {
              const href = link.href?.substring(0, 80) || 'none';
              found.push({
                severity: 'Medium',
                issueType: 'Empty Link',
                description: `Link ${i + 1} (href: "${href}") has no visible text and no aria-label.`,
                impact:
                  'Screen readers read this link as "link" with no destination hint, so users cannot decide whether to follow it. Search engines treat anchor text as a relevance signal — an empty link passes no keyword value to the linked page.',
                recommendation:
                  'Provide descriptive anchor text (e.g., "View full report") or an aria-label that describes the destination. Avoid generic text like "click here" or "read more" — be specific about where the link goes.',
                qaId: stamp(link),
                selector: `a[href="${link.getAttribute('href')?.substring(0, 80)}"]`,
              });
            }
          });

          // ── Missing Form Labels ───────────────────────────────────────────
          document
            .querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')
            .forEach((input, i) => {
              const id = input.getAttribute('id');
              const ariaLabel = input.getAttribute('aria-label');
              const ariaLabelledby = input.getAttribute('aria-labelledby');
              const hasLabel = id ? document.querySelector(`label[for="${id}"]`) !== null : false;
              if (!hasLabel && !ariaLabel && !ariaLabelledby) {
                const type = input.getAttribute('type') || 'text';
                found.push({
                  severity: 'High',
                  issueType: 'Missing Form Label',
                  description: `Input field ${i + 1} (type="${type}") has no associated <label>, aria-label, or aria-labelledby attribute.`,
                  impact:
                    'Screen readers cannot tell users what to type into this field. This is a WCAG 2.1 Level A violation (Success Criterion 1.3.1 and 3.3.2). Unlabelled fields are also harder to tap accurately on mobile because the touch target for the label is missing.',
                  recommendation:
                    "Add a <label for=\"inputId\"> element whose for attribute matches the input's id. If a visible label is not desired, use aria-label=\"Field purpose\" on the input itself, or aria-labelledby pointing to an existing descriptive element.",
                  qaId: stamp(input),
                  selector: id ? `#${id}` : `input[type="${type}"]`,
                });
              }
            });

          // ── Heading Hierarchy Skip ────────────────────────────────────────
          let prevLevel = 0;
          document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
            const level = parseInt(h.tagName.substring(1));
            if (prevLevel > 0 && level > prevLevel + 1) {
              found.push({
                severity: 'Low',
                issueType: 'Heading Hierarchy Skip',
                description: `Heading level jumps from H${prevLevel} to H${level} — skipping ${level - prevLevel - 1} level(s). Heading text: "${h.textContent?.trim().substring(0, 60)}"`,
                impact:
                  'Screen readers use heading structure to let users navigate the page by section. Skipping levels confuses this outline and breaks WCAG 2.1 Success Criterion 1.3.1. Search engines also use heading hierarchy to understand content structure, so gaps can reduce SEO ranking.',
                recommendation: `Change the H${level} to an H${prevLevel + 1} so the outline is sequential. If you need visual size variation, use CSS classes to style headings rather than skipping levels for presentational purposes.`,
                qaId: stamp(h),
                selector: h.tagName.toLowerCase(),
              });
            }
            prevLevel = level;
          });

          // ── Missing Meta Description ──────────────────────────────────────
          const metaDesc = document.querySelector('meta[name="description"]');
          if (!metaDesc || !metaDesc.getAttribute('content')?.trim()) {
            found.push({
              severity: 'Low',
              issueType: 'Missing Meta Description',
              description: 'This page has no <meta name="description"> tag (or the content is empty).',
              impact:
                'Search engines often display the meta description as the snippet text in search results. Without it, Google generates its own excerpt from page content, which may be irrelevant or unattractive to users — reducing click-through rate.',
              recommendation:
                'Add <meta name="description" content="..."> inside <head> with a concise, keyword-rich summary of the page (ideally 150–160 characters). Each page should have a unique description.',
              // No stamp — <head> has no layout box; skip screenshot
            });
          }

          // ── Missing Page Title ────────────────────────────────────────────
          const title = document.title;
          if (!title || title.trim() === '') {
            found.push({
              severity: 'Medium',
              issueType: 'Missing Page Title',
              description: 'This page has no <title> element, or it is blank.',
              impact:
                'The page title is displayed in browser tabs, bookmarks, and search result headlines. A missing title is a WCAG 2.4.2 Level A failure, makes the tab unidentifiable, and significantly hurts SEO rankings because title content is a top-weighted ranking signal.',
              recommendation:
                'Add <title>Descriptive Page Name — Site Name</title> inside <head>. Keep it under 60 characters and place the most important keyword near the beginning.',
              // No stamp — <head> has no layout box; skip screenshot
            });
          }

          // ── Viewport Overflow ─────────────────────────────────────────────
          const hasHorizontalScroll =
            document.documentElement.scrollWidth > document.documentElement.clientWidth;
          if (hasHorizontalScroll) {
            const overflow =
              document.documentElement.scrollWidth - document.documentElement.clientWidth;
            found.push({
              severity: 'Medium',
              issueType: 'Viewport Overflow',
              description: `Page content is wider than the viewport by ${overflow}px (scrollWidth: ${document.documentElement.scrollWidth}px vs clientWidth: ${document.documentElement.clientWidth}px), causing a horizontal scrollbar.`,
              impact:
                "Horizontal scrolling breaks the reading flow on desktop and is nearly unusable on mobile. Google's mobile-friendliness test penalises pages with viewport overflow, which can lower search rankings. Users often abandon sites with broken layouts.",
              recommendation:
                'Identify the overflowing element (use browser DevTools > computed styles, or add * { outline: 1px solid red }). Common causes: fixed-width containers, long unbreakable text/URLs, or images without max-width: 100%. Apply overflow-x: hidden on the body as a last resort only.',
              qaId: stamp(document.documentElement),
              selector: 'html',
            });
          }

          // ── Overlapping Interactive Elements ──────────────────────────────
          const overlappingResult = (() => {
            const allEls = document.querySelectorAll('button, a, input, select, textarea');
            const rects: Array<{ el: Element; rect: DOMRect }> = [];
            allEls.forEach((el) => {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) rects.push({ el, rect });
            });
            for (let i = 0; i < rects.length && i < 50; i++) {
              for (let j = i + 1; j < rects.length && j < 50; j++) {
                const a = rects[i].rect;
                const b = rects[j].rect;
                const overlap = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
                if (overlap) {
                  return { tag: `${rects[i].el.tagName.toLowerCase()} and ${rects[j].el.tagName.toLowerCase()}`, el: rects[i].el };
                }
              }
            }
            return null;
          })();

          if (overlappingResult) {
            found.push({
              severity: 'High',
              issueType: 'Overlapping Interactive Elements',
              description: `Two interactive elements overlap each other in the viewport: ${overlappingResult.tag}. This was detected at 1280×800 resolution.`,
              impact:
                'When clickable elements overlap, users may accidentally trigger the wrong action. On touchscreens the problem is amplified because touch targets are imprecise. This also breaks keyboard tab order, causing confusion for keyboard-only users.',
              recommendation:
                'Use browser DevTools to identify the overlapping elements and fix their positioning (check for z-index stacking, absolute/fixed positioning, or negative margins). Ensure all interactive elements have a minimum touch target size of 44×44 CSS pixels (WCAG 2.5.5 Level AAA recommendation).',
              qaId: stamp(overlappingResult.el),
              selector: overlappingResult.el.tagName.toLowerCase(),
            });
          }

          void pageUrl; // used only for type annotation
          return found;
        }, url);

        // Capture a highlighted screenshot for each issue that has a stamped qaId,
        // then clean up data attributes. Page is still open at this point.
        const qaIds: string[] = pageIssues.flatMap((i) => (i.qaId ? [i.qaId] : []));

        for (const rawIssue of pageIssues) {
          issueCounter += 1;
          const issueId = `ui-${issueCounter}`;
          let screenshotFile: string | undefined;

          if (screenshotsDir && rawIssue.qaId) {
            screenshotFile = await captureIssueScreenshot(
              page,
              `[data-qa-id="${rawIssue.qaId}"]`,
              issueId,
              screenshotsDir
            );
          }

          issues.push({
            id: issueId,
            page: url,
            severity: rawIssue.severity as Severity,
            issueType: rawIssue.issueType,
            description: rawIssue.description,
            impact: rawIssue.impact,
            recommendation: rawIssue.recommendation,
            selector: rawIssue.selector,
            screenshotFile,
          });
        }

        // Clean up all stamped data-qa-id attributes
        if (qaIds.length > 0) {
          await page.evaluate((ids) => {
            ids.forEach((id) => {
              const el = document.querySelector(`[data-qa-id="${id}"]`);
              if (el) el.removeAttribute('data-qa-id');
            });
          }, qaIds);
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
