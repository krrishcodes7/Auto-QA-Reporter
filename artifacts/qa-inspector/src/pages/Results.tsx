import { motion } from "framer-motion";
import { formatDuration } from "@/lib/utils";
import { SummaryCards } from "./SummaryCards";
import { BugReportTable } from "./BugReportTable";
import { ScreenshotGallery } from "./ScreenshotGallery";
import { ReportExporter } from "./ReportExporter";
import { useGetScanReport, useGetScanScreenshots } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal, Database } from "lucide-react";

interface ResultsProps {
  jobId: string;
  onReset: () => void;
}

export function Results({ jobId, onReset }: ResultsProps) {
  const { data: report, isLoading: isLoadingReport, error: reportError } = useGetScanReport(jobId);
  const { data: screenshots, isLoading: isLoadingScreenshots } = useGetScanScreenshots(jobId);

  if (isLoadingReport) {
    return (
      <div className="w-full max-w-7xl mx-auto mt-8 space-y-8">
        <div className="h-32 border border-primary/20 p-8 flex items-center justify-center bg-card">
          <p className="text-primary font-mono animate-pulse">DECRYPTING RESULTS PAYLOAD...</p>
        </div>
      </div>
    );
  }

  if (reportError || !report) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-12 p-8 border border-destructive bg-destructive/10 text-center">
        <h2 className="text-destructive font-display text-4xl mb-4">CRITICAL DATA LOSS</h2>
        <p className="text-muted-foreground font-mono mb-8">Failed to retrieve inspection report. Session may have expired.</p>
        <button 
          onClick={onReset}
          className="px-6 py-2 bg-transparent border-2 border-destructive text-destructive font-mono hover:bg-destructive hover:text-black transition-colors uppercase"
        >
          RETURN TO CONSOLE
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-7xl mx-auto mt-8 pb-24"
    >
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-primary/30 pb-4">
        <div>
          <h1 className="text-5xl font-display font-bold text-primary tracking-widest text-glow mb-2">INSPECTION REPORT</h1>
          <div className="flex items-center space-x-4 text-sm font-mono text-muted-foreground">
            <span className="flex items-center text-accent"><Terminal className="w-4 h-4 mr-2"/> TARGET: {report.targetUrl}</span>
            <span>|</span>
            <span>TIME: {new Date(report.scannedAt).toLocaleString()}</span>
            <span>|</span>
            <span>DURATION: {formatDuration(report.scanDurationMs)}</span>
          </div>
        </div>
        <button 
          onClick={onReset}
          className="mt-4 md:mt-0 text-sm font-mono text-primary border border-primary px-4 py-2 hover:bg-primary hover:text-black transition-colors"
        >
          NEW INSPECTION
        </button>
      </div>

      <SummaryCards summary={report.summary} totalPages={report.totalPages} />
      
      <BugReportTable report={report} />

      <div className="mt-16">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-primary" />
          <h2 className="text-3xl font-display font-bold text-primary tracking-widest m-0 leading-none">VISUAL LOGS</h2>
        </div>
        {isLoadingScreenshots ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full bg-muted border border-border" />)}
          </div>
        ) : (
          <ScreenshotGallery screenshots={screenshots?.screenshots} />
        )}
      </div>

      <ReportExporter jobId={jobId} report={report} />
    </motion.div>
  );
}
