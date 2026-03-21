import { Copy, Check, FileJson, FileCode, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { ScanReport } from "@workspace/api-client-react";

interface ReportExporterProps {
  jobId: string;
  report: ScanReport;
}

export function ReportExporter({ jobId, report }: ReportExporterProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `qa_report_${jobId}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    toast({
      title: "Download Complete",
      description: "JSON report has been downloaded.",
    });
  };

  const handleDownloadHTML = () => {
    window.open(`/api/scan/${jobId}/export/html`, '_blank');
    
    toast({
      title: "Export Initiated",
      description: "Opening HTML report in new tab.",
    });
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    toast({
      title: "Generating PDF",
      description: "This may take a few seconds...",
    });

    try {
      const response = await fetch(`/api/scan/${jobId}/export/pdf`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qa-report-${jobId.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: "Your report has been saved as a PDF.",
      });
    } catch (err) {
      toast({
        title: "PDF Export Failed",
        description: err instanceof Error ? err.message : "Could not generate PDF.",
        variant: "destructive",
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?jobId=${jobId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: "Link Copied",
      description: "Share link copied to clipboard.",
    });
  };

  return (
    <div className="flex flex-wrap gap-3 mt-12 pt-8 border-t">
      <Button onClick={handleDownloadJSON} variant="outline" className="gap-2">
        <FileJson className="w-4 h-4" />
        Export JSON
      </Button>
      <Button onClick={handleDownloadHTML} variant="outline" className="gap-2">
        <FileCode className="w-4 h-4" />
        View HTML
      </Button>
      <Button onClick={handleDownloadPDF} variant="outline" className="gap-2" disabled={pdfLoading}>
        {pdfLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        {pdfLoading ? 'Generating PDF...' : 'Export PDF'}
      </Button>
      <Button onClick={handleCopyLink} variant="secondary" className="gap-2 ml-auto">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        Copy Link
      </Button>
    </div>
  );
}
