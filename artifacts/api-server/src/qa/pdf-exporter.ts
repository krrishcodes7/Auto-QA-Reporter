import { chromium } from 'playwright';
import { generateHtmlReport } from './report-generator.js';
import type { ScanReport } from './types.js';

const ldPath = `/nix/store/24w3s75aa2lrvvxsybficn8y3zxd27kp-mesa-libgbm-25.1.0/lib${process.env['LD_LIBRARY_PATH'] ? `:${process.env['LD_LIBRARY_PATH']}` : ''}`;

export async function generatePdfReport(report: ScanReport): Promise<Buffer> {
  const html = generateHtmlReport(report);

  const browser = await chromium.launch({
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: ldPath } as Record<string, string>,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
