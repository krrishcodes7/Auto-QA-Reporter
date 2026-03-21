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
          type RawIssue = {
            severity: string;
            issueType: string;
            description: string;
            impact: string;
            recommendation: string;
            selector?: string;
          };
          const found: RawIssue[] = [];

          // ── Missing Alt Text ──────────────────────────────────────────────
          const images = document.querySelectorAll('img');
          images.forEach((img, i) => {
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
                selector: img.src
                  ? `img[src="${img.src.substring(0, 60)}"]`
                  : `img:nth-of-type(${i + 1})`,
              });
            }
          });

          // ── Empty Buttons ─────────────────────────────────────────────────
          const buttons = document.querySelectorAll('button');
          buttons.forEach((btn, i) => {
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
                selector: `button:nth-of-type(${i + 1})`,
              });
            }
          });

          // ── Empty Links ───────────────────────────────────────────────────
          const links = document.querySelectorAll('a');
          links.forEach((link, i) => {
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
                selector: `a:nth-of-type(${i + 1})`,
              });
            }
          });

          // ── Missing Form Labels ───────────────────────────────────────────
          const inputs = document.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"])'
          );
          inputs.forEach((input, i) => {
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
                  'Add a <label for="inputId"> element whose for attribute matches the input\'s id. If a visible label is not desired, use aria-label="Field purpose" on the input itself, or aria-labelledby pointing to an existing descriptive element.',
                selector: `input:nth-of-type(${i + 1})`,
              });
            }
          });

          // ── Heading Hierarchy Skip ────────────────────────────────────────
          const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
          let prevLevel = 0;
          headings.forEach((h) => {
            const level = parseInt(h.tagName.substring(1));
            if (prevLevel > 0 && level > prevLevel + 1) {
              found.push({
                severity: 'Low',
                issueType: 'Heading Hierarchy Skip',
                description: `Heading level jumps from H${prevLevel} to H${level} — skipping ${level - prevLevel - 1} level(s). Heading text: "${h.textContent?.trim().substring(0, 60)}"`,
                impact:
                  'Screen readers use heading structure to let users navigate the page by section. Skipping levels confuses this outline and breaks WCAG 2.1 Success Criterion 1.3.1. Search engines also use heading hierarchy to understand content structure, so gaps can reduce SEO ranking.',
                recommendation:
                  `Change the H${level} to an H${prevLevel + 1} so the outline is sequential. If you need visual size variation, use CSS classes to style headings rather than skipping levels for presentational purposes.`,
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
              selector: 'head',
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
              selector: 'head > title',
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
                'Horizontal scrolling breaks the reading flow on desktop and is nearly unusable on mobile. Google\'s mobile-friendliness test penalises pages with viewport overflow, which can lower search rankings. Users often abandon sites with broken layouts.',
              recommendation:
                'Identify the overflowing element (use browser DevTools > computed styles, or add * { outline: 1px solid red }). Common causes: fixed-width containers, long unbreakable text/URLs, or images without max-width: 100%. Apply overflow-x: hidden on the body as a last resort only.',
              selector: 'html',
            });
          }

          // ── Overlapping Interactive Elements ──────────────────────────────
          const overlappingResult = (() => {
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
                const overlap = !(
                  a.right < b.left ||
                  a.left > b.right ||
                  a.bottom < b.top ||
                  a.top > b.bottom
                );
                if (overlap) {
                  return `${rects[i].el.tagName.toLowerCase()} and ${rects[j].el.tagName.toLowerCase()}`;
                }
              }
            }
            return null;
          })();

          if (overlappingResult) {
            found.push({
              severity: 'High',
              issueType: 'Overlapping Interactive Elements',
              description: `Two interactive elements overlap each other in the viewport: ${overlappingResult}. This was detected at 1280×800 resolution.`,
              impact:
                'When clickable elements overlap, users may accidentally trigger the wrong action. On touchscreens the problem is amplified because touch targets are imprecise. This also breaks keyboard tab order, causing confusion for keyboard-only users.',
              recommendation:
                'Use browser DevTools to identify the overlapping elements and fix their positioning (check for z-index stacking, absolute/fixed positioning, or negative margins). Ensure all interactive elements have a minimum touch target size of 44×44 CSS pixels (WCAG 2.5.5 Level AAA recommendation).',
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
            impact: issue.impact,
            recommendation: issue.recommendation,
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
