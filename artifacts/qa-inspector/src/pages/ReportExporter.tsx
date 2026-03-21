import { Download, Copy, Check, FileJson, FileCode } from "lucide-react";
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

  const handleDownloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `qa_report_${jobId}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    toast({
      title: "DOWNLOAD COMPLETE",
      description: "JSON report payload secured.",
    });
  };

  const handleDownloadHTML = () => {
    // We would ideally call the API for the HTML, but since it returns text/html, 
    // an easy way is to trigger a download directly from the URL.
    window.open(`/api/scan/${jobId}/export/html`, '_blank');
    
    toast({
      title: "EXPORT INITIATED",
      description: "HTML report compiling.",
    });
  };

  const handleCopyLink = () => {
    // Generate a theoretical share link (assuming app root + ?job=ID)
    const url = `${window.location.origin}${window.location.pathname}?jobId=${jobId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: "LINK COPIED",
      description: "Coordinates copied to clipboard.",
    });
  };

  return (
    <div className="flex flex-wrap gap-4 mt-8 pt-8 border-t border-border">
      <Button onClick={handleDownloadJSON} variant="outline" className="gap-2 bg-card">
        <FileJson className="w-4 h-4" />
        DOWNLOAD JSON DATA
      </Button>
      <Button onClick={handleDownloadHTML} variant="outline" className="gap-2 bg-card">
        <FileCode className="w-4 h-4" />
        EXPORT HTML REPORT
      </Button>
      <Button onClick={handleCopyLink} variant="secondary" className="gap-2 ml-auto">
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        COPY SHARE LINK
      </Button>
    </div>
  );
}
