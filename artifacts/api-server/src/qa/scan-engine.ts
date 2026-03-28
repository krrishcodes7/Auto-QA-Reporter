import path from 'path';
import fs from 'fs/promises';
import { crawlSite } from './crawler.js';
import { checkLinks } from './link-checker.js';
import { inspectUI } from './ui-inspector.js';
import { testForms } from './form-tester.js';
import { classifyBug } from './ai-classifier.js';
import { mapOwasp } from './owasp-mapper.js';
import { buildReport } from './report-generator.js';
import type { ScanJob, ScanReport, ScanStep } from './types.js';

export const SCREENSHOTS_BASE_DIR = path.join(process.cwd(), '..', '..', 'screenshots');

export async function loadReportFromDisk(jobId: string): Promise<ScanReport | null> {
  try {
    const reportPath = path.join(SCREENSHOTS_BASE_DIR, jobId, 'report.json');
    const raw = await fs.readFile(reportPath, 'utf-8');
    return JSON.parse(raw) as ScanReport;
  } catch {
    return null;
  }
}

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
    let uiIssues = await inspectUI(pagesToInspect, screenshotsDir);

    setStepStatus(job, 'ui', 'completed');
    job.progress = 70;

    if (job.cancelled) return;

    // Step 4: Form Testing
    setStepStatus(job, 'forms', 'running');
    job.currentStep = 'Form Testing';

    const pagesWithForms = pagesToInspect.filter((p) => (p.formsFound || 0) > 0);
    let formIssues = await testForms(
      pagesWithForms.length > 0 ? pagesWithForms : pagesToInspect.slice(0, 5),
      screenshotsDir
    );

    setStepStatus(job, 'forms', 'completed');
    job.progress = 85;

    // Step 5: AI Classification
    setStepStatus(job, 'report', 'running');
    job.currentStep = 'Generating Report';

    // Apply OWASP mapping and fix suggestions to all issues (always, regardless of AI mode)
    for (const link of brokenLinks) {
      const owasp = mapOwasp('Broken Link', link.linkUrl);
      link.owaspCategory = owasp.owaspCategory;
      link.fixSuggestion = owasp.fixSuggestion;
    }
    for (const issue of uiIssues) {
      const owasp = mapOwasp(issue.issueType, issue.description);
      issue.owaspCategory = owasp.owaspCategory;
      // Override severity if OWASP maps to a higher level (e.g. Critical)
      const sevRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      if (sevRank[owasp.severity] > sevRank[issue.severity]) {
        issue.severity = owasp.severity;
      }
    }
    for (const issue of formIssues) {
      const owasp = mapOwasp(issue.issueType, issue.description);
      issue.owaspCategory = owasp.owaspCategory;
      const sevRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      if (sevRank[owasp.severity] > sevRank[issue.severity]) {
        issue.severity = owasp.severity;
      }
    }

    // Run AI or heuristic classification (also populates fixSuggestion)
    if (enableAI) {
      const classifyAll = async () => {
        for (const link of brokenLinks) {
          const result = await classifyBug(link.linkUrl, 'Broken Link', enableAI, openaiApiKey, aiModel);
          link.aiCategory = result.category;
          link.aiConfidence = result.confidence;
          if (result.fixSuggestion) link.fixSuggestion = result.fixSuggestion;
        }
        for (const issue of uiIssues) {
          const result = await classifyBug(issue.description, issue.issueType, enableAI, openaiApiKey, aiModel);
          issue.aiCategory = result.category;
          issue.aiConfidence = result.confidence;
          if (result.fixSuggestion) issue.fixSuggestion = result.fixSuggestion;
        }
        for (const issue of formIssues) {
          const result = await classifyBug(issue.description, issue.issueType, enableAI, openaiApiKey, aiModel);
          issue.aiCategory = result.category;
          issue.aiConfidence = result.confidence;
          if (result.fixSuggestion) issue.fixSuggestion = result.fixSuggestion;
        }
      };
      await classifyAll();
    } else {
      // Run heuristic classification always (also generates fix suggestions)
      for (const link of brokenLinks) {
        const result = await classifyBug(link.linkUrl, 'Broken Link', false);
        link.aiCategory = result.category;
        link.aiConfidence = result.confidence;
        if (result.fixSuggestion) link.fixSuggestion = result.fixSuggestion;
      }
      for (const issue of uiIssues) {
        const result = await classifyBug(issue.description, issue.issueType, false);
        issue.aiCategory = result.category;
        issue.aiConfidence = result.confidence;
        if (result.fixSuggestion) issue.fixSuggestion = result.fixSuggestion;
      }
      for (const issue of formIssues) {
        const result = await classifyBug(issue.description, issue.issueType, false);
        issue.aiCategory = result.category;
        issue.aiConfidence = result.confidence;
        if (result.fixSuggestion) issue.fixSuggestion = result.fixSuggestion;
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

    // Persist report to disk so it survives server restarts
    try {
      const reportPath = path.join(screenshotsDir, 'report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    } catch {
      // Non-fatal: report is still in memory for this session
    }
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
