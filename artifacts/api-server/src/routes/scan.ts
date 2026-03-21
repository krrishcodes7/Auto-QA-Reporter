import { Router, type IRouter, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { runScan, SCREENSHOTS_BASE_DIR } from '../qa/scan-engine.js';
import { generateHtmlReport } from '../qa/report-generator.js';
import type { ScanJob } from '../qa/types.js';

const router: IRouter = Router();

const jobs = new Map<string, ScanJob>();

const MAX_CONCURRENT_SCANS = 3;

function getRunningScansCount(): number {
  let count = 0;
  for (const job of jobs.values()) {
    if (job.status === 'pending' || job.status === 'running') count++;
  }
  return count;
}

router.post('/scan', async (req: Request, res: Response) => {
  const { url, maxPages = 20, enableAI = false } = req.body as {
    url?: string;
    maxPages?: number;
    enableAI?: boolean;
  };

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol');
  } catch {
    res.status(400).json({ error: 'Invalid URL — must be a full http/https URL' });
    return;
  }

  if (getRunningScansCount() >= MAX_CONCURRENT_SCANS) {
    res.status(429).json({ error: 'Too many concurrent scans. Please wait for an existing scan to finish.' });
    return;
  }

  const jobId = randomUUID();
  const job: ScanJob = {
    jobId,
    url: parsedUrl.toString(),
    maxPages: Math.min(Math.max(Number(maxPages) || 20, 1), 50),
    enableAI: Boolean(enableAI),
    status: 'pending',
    progress: 0,
    currentStep: 'Queued',
    steps: [],
    startedAt: new Date().toISOString(),
  };

  jobs.set(jobId, job);

  // Run in background (non-blocking)
  runScan(job).catch((err: unknown) => {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
  });

  res.json({ jobId, status: 'pending', message: 'Scan started' });
});

router.delete('/scan/:jobId', (req: Request, res: Response) => {
  const job = jobs.get(req.params['jobId']!);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  if (job.status === 'completed' || job.status === 'failed') {
    res.status(400).json({ error: 'Cannot cancel a finished scan' });
    return;
  }

  job.cancelled = true;
  job.status = 'failed';
  job.error = 'Scan cancelled by user';
  job.completedAt = new Date().toISOString();
  job.currentStep = 'Cancelled';

  for (const step of job.steps) {
    if (step.status === 'running' || step.status === 'pending') {
      step.status = 'failed';
    }
  }

  res.json({ jobId: job.jobId, status: 'cancelled' });
});

router.get('/scan/:jobId/status', (req: Request, res: Response) => {
  const job = jobs.get(req.params['jobId']!);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    currentUrl: job.currentUrl,
    steps: job.steps,
    error: job.error,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });
});

router.get('/scan/:jobId/report', (req: Request, res: Response) => {
  const job = jobs.get(req.params['jobId']!);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  if (job.status !== 'completed' || !job.report) {
    res.status(202).json({ error: 'Report not ready yet', status: job.status });
    return;
  }

  res.json(job.report);
});

router.get('/scan/:jobId/screenshots', async (req: Request, res: Response) => {
  const job = jobs.get(req.params['jobId']!);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const screenshotsDir = path.join(SCREENSHOTS_BASE_DIR, job.jobId);
  let files: string[] = [];

  try {
    const entries = await fs.readdir(screenshotsDir);
    files = entries.filter((f) => f.endsWith('.png'));
  } catch {
    files = [];
  }

  const screenshots = files.map((filename) => {
    const pageUrl =
      job.report?.pagesScanned.find((p) => p.screenshotFile === filename)?.url ||
      filename.replace(`${job.jobId}_`, '').replace(/_/g, '/').replace('.png', '');

    return {
      filename,
      url: `/api/screenshots/${encodeURIComponent(filename)}`,
      pageUrl,
    };
  });

  res.json({ jobId: job.jobId, screenshots });
});

router.get('/scan/:jobId/export/html', (req: Request, res: Response) => {
  const job = jobs.get(req.params['jobId']!);
  if (!job || !job.report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const html = generateHtmlReport(job.report);
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="qa-report-${job.jobId.substring(0, 8)}.html"`);
  res.send(html);
});

router.get('/screenshots/:filename', async (req: Request, res: Response) => {
  const filename = decodeURIComponent(req.params['filename']!);

  if (filename.includes('..') || filename.includes('/')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }

  const jobId = filename.split('_')[0];
  if (!jobId) {
    res.status(400).json({ error: 'Invalid filename format' });
    return;
  }

  const filePath = path.join(SCREENSHOTS_BASE_DIR, jobId, filename);

  try {
    await fs.access(filePath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const content = await fs.readFile(filePath);
    res.send(content);
  } catch {
    res.status(404).json({ error: 'Screenshot not found' });
  }
});

export default router;
