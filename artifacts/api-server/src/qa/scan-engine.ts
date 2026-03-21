import path from 'path';
import { crawlSite } from './crawler.js';
import { checkLinks } from './link-checker.js';
import { inspectUI } from './ui-inspector.js';
import { testForms } from './form-tester.js';
import { classifyBug } from './ai-classifier.js';
import { buildReport } from './report-generator.js';
import type { ScanJob, ScanStep } from './types.js';

export const SCREENSHOTS_BASE_DIR = path.join(process.cwd(), '..', '..', 'screenshots');

function makeSteps(): ScanStep[] {
  return [
    { name: 'crawl', status: 'pending', label: 'Crawling Pages' },
    { name: 'links', status: 'pending', label: 'Checking Links' },
    { name: 'ui', status: 'pending', label: 'UI Inspection' },
    { name: 'forms', status: 'pending', label: 'Form Testing' },
    { name: 'report', status: 'pending', label: 'Generating Report' },
  ];
}

function setStepStatus(job: ScanJob, stepName: string, status: ScanStep['status']) {
  const step = job.steps.find((s) => s.name === stepName);
  if (step) step.status = status;
}

export async function runScan(job: ScanJob): Promise<void> {
  const startTime = Date.now();
  const screenshotsDir = path.join(SCREENSHOTS_BASE_DIR, job.jobId);

  job.status = 'running';
  job.steps = makeSteps();

  try {
    const openaiApiKey = process.env['OPENAI_API_KEY'];
    const aiModel = process.env['AI_MODEL'] || 'gpt-4o';
    const envEnableAI = process.env['ENABLE_AI_CLASSIFICATION'] === 'true';
    const enableAI = job.enableAI || envEnableAI;

    // Step 1: Crawl
    setStepStatus(job, 'crawl', 'running');
    job.currentStep = 'Crawling Pages';
    job.progress = 5;

    const { pages, allLinks } = await crawlSite(
      job.url,
      job.maxPages,
      job.jobId,
      screenshotsDir,
      (currentUrl) => {
        job.currentUrl = currentUrl;
      }
    );

    setStepStatus(job, 'crawl', 'completed');
    job.progress = 30;

    if (job.cancelled) return;

    // Step 2: Link checking
    setStepStatus(job, 'links', 'running');
    job.currentStep = 'Checking Links';
    job.currentUrl = undefined;

    let brokenLinks = await checkLinks(allLinks);

    setStepStatus(job, 'links', 'completed');
    job.progress = 50;

    if (job.cancelled) return;

    // Step 3: UI Inspection
    setStepStatus(job, 'ui', 'running');
    job.currentStep = 'UI Inspection';

    const pagesToInspect = pages.slice(0, Math.min(pages.length, 10));
    let uiIssues = await inspectUI(pagesToInspect);

    setStepStatus(job, 'ui', 'completed');
    job.progress = 70;

    if (job.cancelled) return;

    // Step 4: Form Testing
    setStepStatus(job, 'forms', 'running');
    job.currentStep = 'Form Testing';

    const pagesWithForms = pagesToInspect.filter((p) => (p.formsFound || 0) > 0);
    let formIssues = await testForms(pagesWithForms.length > 0 ? pagesWithForms : pagesToInspect.slice(0, 5));

    setStepStatus(job, 'forms', 'completed');
    job.progress = 85;

    // Step 5: AI Classification
    setStepStatus(job, 'report', 'running');
    job.currentStep = 'Generating Report';

    if (enableAI) {
      const classifyAll = async () => {
        for (const link of brokenLinks) {
          const result = await classifyBug(link.linkUrl, 'Broken Link', enableAI, openaiApiKey, aiModel);
          link.aiCategory = result.category;
          link.aiConfidence = result.confidence;
        }
        for (const issue of uiIssues) {
          const result = await classifyBug(issue.description, issue.issueType, enableAI, openaiApiKey, aiModel);
          issue.aiCategory = result.category;
          issue.aiConfidence = result.confidence;
        }
        for (const issue of formIssues) {
          const result = await classifyBug(issue.description, issue.issueType, enableAI, openaiApiKey, aiModel);
          issue.aiCategory = result.category;
          issue.aiConfidence = result.confidence;
        }
      };
      await classifyAll();
    } else {
      // Run heuristic classification always
      for (const link of brokenLinks) {
        const result = await classifyBug(link.linkUrl, 'Broken Link', false);
        link.aiCategory = result.category;
        link.aiConfidence = result.confidence;
      }
      for (const issue of uiIssues) {
        const result = await classifyBug(issue.description, issue.issueType, false);
        issue.aiCategory = result.category;
        issue.aiConfidence = result.confidence;
      }
      for (const issue of formIssues) {
        const result = await classifyBug(issue.description, issue.issueType, false);
        issue.aiCategory = result.category;
        issue.aiConfidence = result.confidence;
      }
    }

    const scanDurationMs = Date.now() - startTime;

    const report = buildReport({
      jobId: job.jobId,
      targetUrl: job.url,
      scannedAt: new Date(job.startedAt).toISOString(),
      scanDurationMs,
      brokenLinks,
      uiIssues,
      formIssues,
      pagesScanned: pages,
    });

    job.report = report;
    setStepStatus(job, 'report', 'completed');
    job.progress = 100;
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.currentStep = 'Scan Complete';
    job.screenshotsDir = screenshotsDir;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    job.status = 'failed';
    job.error = msg;
    job.progress = 100;
    job.currentStep = 'Scan Failed';

    for (const step of job.steps) {
      if (step.status === 'running') step.status = 'failed';
    }
  }
}
