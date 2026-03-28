import { useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, ExternalLink, Filter, Lightbulb, AlertTriangle, Wrench, Tag, Camera, X, Maximize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ScanReport } from "@workspace/api-client-react";

interface BugReportTableProps {
  report: ScanReport;
}

type UnifiedIssue = {
  id: string;
  type: 'Link' | 'UI' | 'Form';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  page: string;
  issueType: string;
  description: string;
  impact?: string;
  recommendation?: string;
  owaspCategory?: string;
  fixSuggestion?: string;
  aiCategory?: string;
  details: any;
};

type SeverityFilter = 'All' | 'Critical' | 'High' | 'Medium' | 'Low';

function ScreenshotLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={onClose}
        aria-label="Close fullscreen"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[95vw] max-h-[92vh] object-contain rounded shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function BugReportTable({ report }: BugReportTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('All');
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; alt: string } | null>(null);

  const unifiedIssues: UnifiedIssue[] = [
    ...(report.brokenLinks || []).map((link, i) => ({
      id: `link-${i}`,
      type: 'Link' as const,
      severity: (link.statusCode >= 500 || link.statusCode === 404 ? 'High' : 'Medium') as 'Critical' | 'High' | 'Medium' | 'Low',
      page: link.sourcePage,
      issueType: `Broken Link (${link.statusType})`,
      description: `Link to "${link.linkUrl}" returned HTTP ${link.statusCode || 'N/A'}${link.error ? ` — ${link.error}` : ''}.`,
      impact: link.impact,
      recommendation: link.recommendation,
      owaspCategory: link.owaspCategory,
      fixSuggestion: link.fixSuggestion,
      aiCategory: link.aiCategory,
      details: link,
    })),
    ...(report.uiIssues || []).map((ui, i) => ({
      id: `ui-${i}`,
      type: 'UI' as const,
      severity: ui.severity as 'Critical' | 'High' | 'Medium' | 'Low',
      page: ui.page,
      issueType: ui.issueType,
      description: ui.description,
      impact: ui.impact,
      recommendation: ui.recommendation,
      owaspCategory: ui.owaspCategory,
      fixSuggestion: ui.fixSuggestion,
      aiCategory: ui.aiCategory,
      details: ui,
    })),
    ...(report.formIssues || []).map((form, i) => ({
      id: `form-${i}`,
      type: 'Form' as const,
      severity: form.severity as 'Critical' | 'High' | 'Medium' | 'Low',
      page: form.page,
      issueType: form.issueType,
      description: form.description,
      impact: form.impact,
      recommendation: form.recommendation,
      owaspCategory: form.owaspCategory,
      fixSuggestion: form.fixSuggestion,
      aiCategory: form.aiCategory,
      details: form,
    })),
  ].sort((a, b) => {
    const sevScore: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return (sevScore[b.severity] ?? 0) - (sevScore[a.severity] ?? 0);
  });

  const severityCounts = {
    All: unifiedIssues.length,
    Critical: unifiedIssues.filter(i => i.severity === 'Critical').length,
    High: unifiedIssues.filter(i => i.severity === 'High').length,
    Medium: unifiedIssues.filter(i => i.severity === 'Medium').length,
    Low: unifiedIssues.filter(i => i.severity === 'Low').length,
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'Critical': return <Badge className="bg-purple-700 hover:bg-purple-800 text-white">Critical</Badge>;
      case 'High': return <Badge variant="destructive">High</Badge>;
      case 'Medium': return <Badge variant="secondary" className="bg-warning/20 text-warning hover:bg-warning/30">Medium</Badge>;
      case 'Low': return <Badge variant="secondary">Low</Badge>;
      default: return <Badge variant="outline">{sev}</Badge>;
    }
  };

  const openLightbox = (src: string, alt: string) => {
    setLightboxSrc({ src, alt });
  };

  const renderTable = (issues: UnifiedIssue[]) => {
    const filtered = severityFilter === 'All' ? issues : issues.filter(i => i.severity === severityFilter);

    if (filtered.length === 0) {
      return (
        <div className="p-12 text-center border rounded-md mt-4 bg-muted/30">
          <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No issues found for the current filter.</p>
        </div>
      );
    }

    return (
      <div className="mt-4 border rounded-md overflow-hidden bg-card text-sm">
        <div className="grid grid-cols-12 gap-4 p-3 border-b bg-muted/50 font-medium text-muted-foreground">
          <div className="col-span-2">Severity</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-3">Source Page</div>
          <div className="col-span-4">Issue</div>
          <div className="col-span-1 text-right"></div>
        </div>
        <div className="divide-y">
          {filtered.map((issue) => (
            <div key={issue.id} className="flex flex-col hover:bg-muted/30 transition-colors">
              <div
                className="grid grid-cols-12 gap-4 p-3 items-center cursor-pointer"
                onClick={() => setExpandedRow(expandedRow === issue.id ? null : issue.id)}
              >
                <div className="col-span-2">{getSeverityBadge(issue.severity)}</div>
                <div className="col-span-2 text-muted-foreground text-xs">{issue.issueType}</div>
                <div className="col-span-3 truncate text-foreground font-mono text-xs" title={issue.page}>{issue.page}</div>
                <div className="col-span-4 truncate text-muted-foreground text-xs" title={issue.description}>{issue.description}</div>
                <div className="col-span-1 flex justify-end">
                  {expandedRow === issue.id
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {expandedRow === issue.id && (
                <div className="bg-muted/20 p-5 border-t text-sm space-y-4">

                  {/* Issue type + classification row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Type:</span>
                      <span className="text-xs font-semibold">{issue.issueType}</span>
                    </div>
                    {getSeverityBadge(issue.severity)}
                    {issue.aiCategory && (
                      <Badge variant="secondary" className="font-normal text-xs">{issue.aiCategory}</Badge>
                    )}
                    {issue.owaspCategory && (
                      <span className="text-xs bg-red-900/60 text-red-200 border border-red-700/50 px-2 py-0.5 rounded font-mono">
                        {issue.owaspCategory}
                      </span>
                    )}
                  </div>

                  {/* What was found */}
                  <div className="rounded-md border bg-background p-4 space-y-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What was found</span>
                    </div>
                    <p className="text-sm leading-relaxed">{issue.description}</p>
                    <div className="pt-2">
                      <span className="text-xs text-muted-foreground">Detected on: </span>
                      <a
                        href={issue.page}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 font-mono text-xs break-all"
                      >
                        {issue.page} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </div>
                  </div>

                  {/* Impact */}
                  {issue.impact && (
                    <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Why it matters</span>
                      </div>
                      <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">{issue.impact}</p>
                    </div>
                  )}

                  {/* Recommendation */}
                  {issue.recommendation && (
                    <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">How to fix</span>
                      </div>
                      <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-200">{issue.recommendation}</p>
                    </div>
                  )}

                  {/* AI / Heuristic Fix Suggestion */}
                  {issue.fixSuggestion && (
                    <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Suggested Fix</span>
                      </div>
                      <pre className="text-sm leading-relaxed text-blue-900 dark:text-blue-200 whitespace-pre-wrap break-words font-sans">
                        {issue.fixSuggestion}
                      </pre>
                    </div>
                  )}

                  {/* Full-page highlighted screenshot */}
                  {issue.details.screenshotFile && (
                    <div className="rounded-md border bg-background p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page Screenshot</span>
                          <span className="text-xs text-muted-foreground">(red box marks the issue)</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() =>
                            openLightbox(
                              `/api/screenshots/${encodeURIComponent(issue.details.screenshotFile)}`,
                              `Full page screenshot for: ${issue.issueType}`
                            )
                          }
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          Fullscreen
                        </Button>
                      </div>
                      <div
                        className="cursor-zoom-in"
                        onClick={() =>
                          openLightbox(
                            `/api/screenshots/${encodeURIComponent(issue.details.screenshotFile)}`,
                            `Full page screenshot for: ${issue.issueType}`
                          )
                        }
                      >
                        <img
                          src={`/api/screenshots/${encodeURIComponent(issue.details.screenshotFile)}`}
                          alt={`Full page screenshot for: ${issue.issueType}`}
                          className="rounded border border-border w-full max-h-80 object-cover object-top bg-muted hover:opacity-90 transition-opacity"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}

                  {/* Fallback: no enrichment yet (old reports) */}
                  {!issue.impact && !issue.recommendation && (
                    <div className="rounded-md border bg-background p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Technical Details</span>
                      </div>
                      <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all font-mono">
                        {JSON.stringify(issue.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-12">
      {/* Fullscreen lightbox overlay */}
      {lightboxSrc && (
        <ScreenshotLightbox
          src={lightboxSrc.src}
          alt={lightboxSrc.alt}
          onClose={() => setLightboxSrc(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <h2 className="text-xl font-semibold m-0">Issues Log</h2>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-1">Severity:</span>
          {(['All', 'Critical', 'High', 'Medium', 'Low'] as SeverityFilter[]).map((sev) => (
            <Button
              key={sev}
              variant={severityFilter === sev ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setSeverityFilter(sev)}
            >
              {sev}
              {severityCounts[sev] > 0 && (
                <span className="ml-1 opacity-70">({severityCounts[sev]})</span>
              )}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="justify-start">
          <TabsTrigger value="all">All Issues ({unifiedIssues.length})</TabsTrigger>
          <TabsTrigger value="links">Broken Links ({report.brokenLinks?.length || 0})</TabsTrigger>
          <TabsTrigger value="ui">UI Issues ({report.uiIssues?.length || 0})</TabsTrigger>
          <TabsTrigger value="forms">Form Issues ({report.formIssues?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">{renderTable(unifiedIssues)}</TabsContent>
        <TabsContent value="links">{renderTable(unifiedIssues.filter(i => i.type === 'Link'))}</TabsContent>
        <TabsContent value="ui">{renderTable(unifiedIssues.filter(i => i.type === 'UI'))}</TabsContent>
        <TabsContent value="forms">{renderTable(unifiedIssues.filter(i => i.type === 'Form'))}</TabsContent>
      </Tabs>
    </div>
  );
}
