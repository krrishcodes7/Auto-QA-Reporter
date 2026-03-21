import { useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle, FileCode2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ScanReport, UIIssue, BrokenLink, FormIssue } from "@workspace/api-client-react";

interface BugReportTableProps {
  report: ScanReport;
}

type UnifiedIssue = {
  id: string;
  type: 'Link' | 'UI' | 'Form';
  severity: 'High' | 'Medium' | 'Low';
  page: string;
  description: string;
  aiCategory?: string;
  details: any;
};

export function BugReportTable({ report }: BugReportTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Normalize issues into a unified format for the "All" tab
  const unifiedIssues: UnifiedIssue[] = [
    ...(report.brokenLinks || []).map((link, i) => ({
      id: `link-${i}`,
      type: 'Link' as const,
      severity: link.statusCode >= 500 || link.statusCode === 404 ? 'High' : 'Medium' as any,
      page: link.sourcePage,
      description: `Broken link to ${link.linkUrl} (${link.statusCode})`,
      aiCategory: link.aiCategory,
      details: link,
    })),
    ...(report.uiIssues || []).map((ui, i) => ({
      id: `ui-${i}`,
      type: 'UI' as const,
      severity: ui.severity,
      page: ui.page,
      description: ui.description,
      aiCategory: ui.aiCategory,
      details: ui,
    })),
    ...(report.formIssues || []).map((form, i) => ({
      id: `form-${i}`,
      type: 'Form' as const,
      severity: form.severity,
      page: form.page,
      description: form.description,
      aiCategory: form.aiCategory,
      details: form,
    })),
  ].sort((a, b) => {
    // Sort High > Medium > Low
    const sevScore = { High: 3, Medium: 2, Low: 1 };
    return sevScore[b.severity as keyof typeof sevScore] - sevScore[a.severity as keyof typeof sevScore];
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'High': return <Badge variant="destructive" className="animate-pulse">CRITICAL</Badge>;
      case 'Medium': return <Badge variant="warning">WARNING</Badge>;
      case 'Low': return <Badge variant="default">MINOR</Badge>;
      default: return <Badge variant="outline">{sev}</Badge>;
    }
  };

  const renderTable = (issues: UnifiedIssue[]) => {
    if (issues.length === 0) {
      return (
        <div className="p-12 text-center border-2 border-dashed border-border mt-4">
          <FileCode2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono uppercase tracking-widest">No anomalies detected in this category.</p>
        </div>
      );
    }

    return (
      <div className="mt-4 border border-border overflow-hidden bg-card">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-muted/50 font-bold font-mono text-xs uppercase text-primary tracking-wider">
          <div className="col-span-2">Severity</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-3">Source Page</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-1 text-right">Details</div>
        </div>
        <div className="divide-y divide-border/50">
          {issues.map((issue) => (
            <div key={issue.id} className="flex flex-col hover:bg-white/5 transition-colors">
              <div 
                className="grid grid-cols-12 gap-4 p-4 items-center cursor-pointer font-mono text-sm"
                onClick={() => setExpandedRow(expandedRow === issue.id ? null : issue.id)}
              >
                <div className="col-span-2">{getSeverityBadge(issue.severity)}</div>
                <div className="col-span-2 text-muted-foreground">[{issue.type}]</div>
                <div className="col-span-3 truncate text-accent" title={issue.page}>{issue.page}</div>
                <div className="col-span-4 truncate" title={issue.description}>{issue.description}</div>
                <div className="col-span-1 text-right flex justify-end">
                  {expandedRow === issue.id ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </div>
              </div>
              
              {/* Expanded Details */}
              {expandedRow === issue.id && (
                <div className="bg-black/60 p-6 border-t border-border/50 font-mono text-sm">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div>
                        <span className="text-muted-foreground block mb-1">FULL DESCRIPTION:</span>
                        <p className="text-foreground">{issue.description}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-1">SOURCE URL:</span>
                        <a href={issue.page} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          {issue.page} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      {issue.aiCategory && (
                        <div>
                          <span className="text-muted-foreground block mb-1">AI CLASSIFICATION:</span>
                          <Badge variant="secondary" className="border-primary/50 text-primary">{issue.aiCategory}</Badge>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-background border border-border p-4">
                      <span className="text-muted-foreground block mb-2 text-xs">RAW DATA / SELECTOR:</span>
                      <pre className="text-xs text-accent overflow-x-auto whitespace-pre-wrap word-break">
                        {JSON.stringify(issue.details, null, 2)}
                      </pre>
                    </div>
                  </div>
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
      <div className="flex items-center gap-3 mb-6">
        <AlertCircle className="w-6 h-6 text-primary" />
        <h2 className="text-3xl font-display font-bold text-primary tracking-widest m-0 leading-none">ANOMALY LOG</h2>
      </div>
      
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">ALL ISSUES ({unifiedIssues.length})</TabsTrigger>
          <TabsTrigger value="links">BROKEN LINKS ({report.brokenLinks?.length || 0})</TabsTrigger>
          <TabsTrigger value="ui">UI ISSUES ({report.uiIssues?.length || 0})</TabsTrigger>
          <TabsTrigger value="forms">FORM ISSUES ({report.formIssues?.length || 0})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          {renderTable(unifiedIssues)}
        </TabsContent>
        <TabsContent value="links">
          {renderTable(unifiedIssues.filter(i => i.type === 'Link'))}
        </TabsContent>
        <TabsContent value="ui">
          {renderTable(unifiedIssues.filter(i => i.type === 'UI'))}
        </TabsContent>
        <TabsContent value="forms">
          {renderTable(unifiedIssues.filter(i => i.type === 'Form'))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
