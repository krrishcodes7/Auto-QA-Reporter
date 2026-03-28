import type { ScanReport, BrokenLink, UIIssue, FormIssue, PageScanned } from './types.js';

function severityColor(severity: string): string {
  if (severity === 'Critical') return '#7c3aed';
  if (severity === 'High') return '#ef4444';
  if (severity === 'Medium') return '#f59e0b';
  return '#22c55e';
}

function statusColor(statusType: string): string {
  if (statusType === 'Not Found' || statusType === 'Client Error') return '#ef4444';
  if (statusType === 'Server Error') return '#ef4444';
  if (statusType === 'Timeout/Error') return '#f59e0b';
  if (statusType === 'Redirect') return '#f59e0b';
  return '#22c55e';
}

export function buildReport(params: {
  jobId: string;
  targetUrl: string;
  scannedAt: string;
  scanDurationMs: number;
  brokenLinks: BrokenLink[];
  uiIssues: UIIssue[];
  formIssues: FormIssue[];
  pagesScanned: PageScanned[];
}): ScanReport {
  const totalBugs = params.brokenLinks.length + params.uiIssues.length + params.formIssues.length;

  const allIssuesWithSeverity = [
    ...params.uiIssues.map((i) => i.severity),
    ...params.formIssues.map((i) => i.severity),
  ];

  const brokenLinksBySeverity = params.brokenLinks.map((l) => {
    if (l.statusCode === 0 || l.statusType === 'Timeout/Error') return 'Medium';
    if (l.statusCode >= 500) return 'High';
    return 'Medium';
  });

  const allSeverities = [...allIssuesWithSeverity, ...brokenLinksBySeverity];

  const criticalCount = allSeverities.filter((s) => s === 'Critical').length;
  const highCount = allSeverities.filter((s) => s === 'High').length;
  const mediumCount = allSeverities.filter((s) => s === 'Medium').length;
  const lowCount = allSeverities.filter((s) => s === 'Low').length;

  const healthScore = Math.max(
    0,
    100 - criticalCount * 15 - highCount * 10 - mediumCount * 4 - lowCount * 1
  );

  return {
    jobId: params.jobId,
    targetUrl: params.targetUrl,
    scannedAt: params.scannedAt,
    totalPages: params.pagesScanned.length,
    scanDurationMs: params.scanDurationMs,
    summary: {
      totalBugs,
      brokenLinks: params.brokenLinks.length,
      uiIssues: params.uiIssues.length,
      formIssues: params.formIssues.length,
      healthScore,
      severityCounts: {
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
      },
    },
    brokenLinks: params.brokenLinks,
    uiIssues: params.uiIssues,
    formIssues: params.formIssues,
    pagesScanned: params.pagesScanned,
  };
}

export function generateHtmlReport(report: ScanReport): string {
  const fmtDate = new Date(report.scannedAt).toLocaleString();
  const scanSecs = (report.scanDurationMs / 1000).toFixed(1);

  const allIssues = [
    ...report.brokenLinks.map((l) => ({
      type: 'Broken Link',
      severity: l.statusCode >= 500 ? 'High' : 'Medium',
      page: l.sourcePage,
      description: `${l.linkUrl} — ${l.statusType} (${l.statusCode || 'No response'})`,
      selector: '',
      aiCategory: l.aiCategory,
    })),
    ...report.uiIssues.map((i) => ({
      type: i.issueType,
      severity: i.severity,
      page: i.page,
      description: i.description,
      selector: i.selector || '',
      aiCategory: i.aiCategory,
    })),
    ...report.formIssues.map((i) => ({
      type: i.issueType,
      severity: i.severity,
      page: i.page,
      description: i.description,
      selector: i.formSelector,
      aiCategory: i.aiCategory,
    })),
  ];

  const issueRows = allIssues
    .map(
      (issue) => `
    <tr>
      <td><span class="badge" style="background:${severityColor(issue.severity)}">${issue.severity}</span></td>
      <td>${issue.type}</td>
      <td class="url">${issue.page}</td>
      <td>${issue.description}</td>
      <td class="mono">${issue.selector}</td>
      ${issue.aiCategory ? `<td>${issue.aiCategory}</td>` : '<td>—</td>'}
    </tr>`
    )
    .join('');

  const brokenLinkRows = report.brokenLinks
    .map(
      (l) => `
    <tr>
      <td><span class="badge" style="background:${statusColor(l.statusType)}">${l.statusCode || '?'}</span></td>
      <td>${l.statusType}</td>
      <td class="url">${l.sourcePage}</td>
      <td class="url">${l.linkUrl}</td>
      ${l.error ? `<td class="mono">${l.error}</td>` : '<td>—</td>'}
    </tr>`
    )
    .join('');

  const pageRows = report.pagesScanned
    .map(
      (p) => `
    <tr>
      <td class="url">${p.url}</td>
      <td><span class="badge" style="background:${p.statusCode === 200 ? '#22c55e' : '#ef4444'}">${p.statusCode}</span></td>
      <td>${p.title || '—'}</td>
      <td>${p.loadTimeMs ?? '—'}ms</td>
      <td>${p.linksFound ?? 0}</td>
      <td>${p.formsFound ?? 0}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QA Report — ${report.targetUrl}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #ffffff;
    --surface: #f8fafc;
    --surface2: #f1f5f9;
    --border: #e2e8f0;
    --accent: #1e40af;
    --amber: #b45309;
    --red: #dc2626;
    --green: #16a34a;
    --purple: #7c3aed;
    --text: #0f172a;
    --muted: #64748b;
    --badge-text: #ffffff;
  }
  body { background: var(--bg); color: var(--text); font-family: Georgia, 'Times New Roman', serif; padding: 2rem; font-size: 0.9rem; line-height: 1.5; }
  h1, h2, h3 { font-family: Arial, Helvetica, sans-serif; }
  .header { border-bottom: 3px solid var(--accent); padding-bottom: 1.25rem; margin-bottom: 2rem; }
  .header h1 { font-size: 2rem; color: var(--accent); }
  .header .meta { color: var(--muted); font-size: 0.8rem; margin-top: 0.4rem; font-family: monospace; }
  .header .target { color: var(--text); font-size: 0.95rem; margin-top: 0.2rem; font-weight: bold; font-family: monospace; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
  .kpi-card { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--border); padding: 1rem; border-radius: 4px; }
  .kpi-card .label { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.08em; font-family: Arial, sans-serif; font-weight: 600; }
  .kpi-card .value { font-size: 2.2rem; font-weight: 700; margin-top: 0.2rem; font-family: Arial, sans-serif; }
  .kpi-card.total { border-left-color: var(--accent); }
  .kpi-card.total .value { color: var(--accent); }
  .kpi-card.links { border-left-color: var(--red); }
  .kpi-card.links .value { color: var(--red); }
  .kpi-card.ui { border-left-color: var(--amber); }
  .kpi-card.ui .value { color: var(--amber); }
  .kpi-card.forms { border-left-color: var(--purple); }
  .kpi-card.forms .value { color: var(--purple); }
  .kpi-card.health { border-left-color: var(--green); }
  .kpi-card.health .value { color: var(--green); }
  .severity-bar { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; background: var(--surface2); border: 1px solid var(--border); padding: 0.75rem 1rem; border-radius: 4px; font-family: Arial, sans-serif; }
  .sev-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; }
  .sev-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  section { margin-bottom: 2.5rem; page-break-inside: avoid; }
  section h2 { font-size: 1.2rem; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid var(--border); padding-bottom: 0.4rem; margin-bottom: 1rem; font-family: Arial, sans-serif; }
  table { width: 100%; border-collapse: collapse; font-size: 0.78rem; font-family: Arial, sans-serif; }
  th { background: var(--surface2); color: var(--muted); text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.08em; padding: 0.5rem 0.7rem; text-align: left; border: 1px solid var(--border); font-weight: 700; }
  td { padding: 0.5rem 0.7rem; border: 1px solid var(--border); background: var(--bg); vertical-align: top; color: var(--text); }
  tr:nth-child(even) td { background: var(--surface); }
  .badge { display: inline-block; padding: 0.2rem 0.5rem; font-size: 0.68rem; font-weight: 700; color: var(--badge-text); letter-spacing: 0.04em; border-radius: 3px; }
  .url { font-size: 0.68rem; word-break: break-all; max-width: 200px; font-family: monospace; color: var(--muted); }
  .mono { font-family: monospace; font-size: 0.72rem; }
  .detail-block { margin-top: 0.3rem; font-size: 0.75rem; color: var(--muted); font-style: italic; }
  .footer { border-top: 1px solid var(--border); margin-top: 2rem; padding-top: 0.75rem; color: var(--muted); font-size: 0.72rem; font-family: Arial, sans-serif; }
  .empty { color: var(--muted); font-style: italic; padding: 0.75rem 0; }
  @media print {
    body { background: #ffffff !important; color: #000000 !important; }
    td { background: #ffffff !important; color: #000000 !important; }
    tr:nth-child(even) td { background: #f8fafc !important; }
  }
</style>
</head>
<body>
<div class="header">
  <h1>&#x2699; Autonomous QA Inspector Report</h1>
  <div class="target">Target: ${report.targetUrl}</div>
  <div class="meta">
    Job ID: ${report.jobId} &nbsp;|&nbsp;
    Scanned: ${fmtDate} &nbsp;|&nbsp;
    Duration: ${scanSecs}s &nbsp;|&nbsp;
    Pages: ${report.totalPages}
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi-card total"><div class="label">Total Bugs</div><div class="value">${report.summary.totalBugs}</div></div>
  <div class="kpi-card links"><div class="label">Broken Links</div><div class="value">${report.summary.brokenLinks}</div></div>
  <div class="kpi-card ui"><div class="label">UI Issues</div><div class="value">${report.summary.uiIssues}</div></div>
  <div class="kpi-card forms"><div class="label">Form Issues</div><div class="value">${report.summary.formIssues}</div></div>
</div>

<div class="severity-bar">
  <strong style="color:#64748b;text-transform:uppercase;font-size:0.75rem">Severity:</strong>
  ${(report.summary.severityCounts.critical ?? 0) > 0 ? `<div class="sev-item"><div class="sev-dot" style="background:#7c3aed"></div><span>${report.summary.severityCounts.critical} Critical</span></div>` : ''}
  <div class="sev-item"><div class="sev-dot" style="background:#ef4444"></div><span>${report.summary.severityCounts.high} High</span></div>
  <div class="sev-item"><div class="sev-dot" style="background:#f59e0b"></div><span>${report.summary.severityCounts.medium} Medium</span></div>
  <div class="sev-item"><div class="sev-dot" style="background:#22c55e"></div><span>${report.summary.severityCounts.low} Low</span></div>
</div>

<section>
  <h2>All Issues (${allIssues.length})</h2>
  ${allIssues.length === 0 ? '<div class="empty">No issues found — site looks clean!</div>' : `
  <table>
    <thead><tr><th>Severity</th><th>Type</th><th>Page</th><th>Description</th><th>Selector</th><th>AI Category</th></tr></thead>
    <tbody>${issueRows}</tbody>
  </table>`}
</section>

<section>
  <h2>Broken Links (${report.brokenLinks.length})</h2>
  ${report.brokenLinks.length === 0 ? '<div class="empty">No broken links found.</div>' : `
  <table>
    <thead><tr><th>Status</th><th>Type</th><th>Source Page</th><th>Link URL</th><th>Error</th></tr></thead>
    <tbody>${brokenLinkRows}</tbody>
  </table>`}
</section>

<section>
  <h2>Pages Scanned (${report.totalPages})</h2>
  <table>
    <thead><tr><th>URL</th><th>Status</th><th>Title</th><th>Load Time</th><th>Links</th><th>Forms</th></tr></thead>
    <tbody>${pageRows}</tbody>
  </table>
</section>

<div class="footer">
  Generated by Autonomous QA Inspector &mdash; ${fmtDate}
</div>
</body>
</html>`;
}
