import { useEffect } from "react";
import { formatDuration } from "@/lib/utils";
import { SummaryCards } from "./SummaryCards";
import { BugReportTable } from "./BugReportTable";
import { ScreenshotGallery } from "./ScreenshotGallery";
import { ReportExporter } from "./ReportExporter";
import { saveCompletedScan } from "./UrlInput";
import { useGetScanReport, useGetScanScreenshots } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Image as ImageIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultsProps {
  jobId: string;
  onReset: () => void;
  onRescan: (url: string) => void;
}

export function Results({ jobId, onReset, onRescan }: ResultsProps) {
  const { data: report, isLoading: isLoadingReport, error: reportError } = useGetScanReport(jobId);
  const { data: screenshots, isLoading: isLoadingScreenshots } = useGetScanScreenshots(jobId);

  useEffect(() => {
    if (report) {
      saveCompletedScan(
        report.jobId,
        report.targetUrl,
        report.summary.totalBugs,
        report.summary.healthScore ?? 100,
      );
    }
  }, [report]);

  if (isLoadingReport) {
    return (
      <div className="w-full max-w-5xl mx-auto mt-8 space-y-8">
        <div className="h-32 border p-8 flex items-center justify-center bg-card rounded-md">
          <p className="text-muted-foreground animate-pulse">Loading results...</p>
        </div>
      </div>
    );
  }

  if (reportError || !report) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-12 p-8 border border-destructive/20 bg-destructive/5 text-center rounded-md">
        <h2 className="text-destructive font-semibold text-2xl mb-4">Error Loading Report</h2>
        <p className="text-muted-foreground mb-8">Failed to retrieve inspection report. Session may have expired.</p>
        <Button onClick={onReset} variant="outline">
          Start New Scan
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto mt-8 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-4 border-b">
        <div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Inspection Report</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center text-foreground font-medium"><Globe className="w-4 h-4 mr-2"/> {report.targetUrl}</span>
            <span className="hidden md:inline text-border">|</span>
            <span>{new Date(report.scannedAt).toLocaleString()}</span>
            <span className="hidden md:inline text-border">|</span>
            <span>Duration: {formatDuration(report.scanDurationMs)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <Button
            onClick={() => onRescan(report.targetUrl)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Re-scan
          </Button>
          <Button onClick={onReset} variant="secondary" size="sm">
            New Scan
          </Button>
        </div>
      </div>

      <SummaryCards summary={report.summary} totalPages={report.totalPages} />
      
      <BugReportTable report={report} />

      <div className="mt-16">
        <div className="flex items-center gap-2 mb-6">
          <ImageIcon className="w-5 h-5" />
          <h2 className="text-xl font-semibold m-0">Screenshots</h2>
        </div>
        {isLoadingScreenshots ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full bg-muted border rounded-md" />)}
          </div>
        ) : (
          <ScreenshotGallery screenshots={screenshots?.screenshots} />
        )}
      </div>

      <ReportExporter jobId={jobId} report={report} />
    </div>
  );
}
