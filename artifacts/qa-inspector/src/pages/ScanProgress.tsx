import { useEffect } from "react";
import { CheckSquare, Square, RefreshCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGetScanStatus } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface ScanProgressProps {
  jobId: string;
  onScanComplete: () => void;
}

export function ScanProgress({ jobId, onScanComplete }: ScanProgressProps) {
  const { data: status } = useGetScanStatus(jobId, {
    query: {
      refetchInterval: (query) => {
        const state = query.state.data?.status;
        return state === "completed" || state === "failed" ? false : 2000;
      },
    },
  });

  useEffect(() => {
    if (status?.status === "completed") {
      const timer = setTimeout(() => {
        onScanComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [status?.status, onScanComplete]);

  const progress = status?.progress || 0;
  const steps = status?.steps || [
    { name: "crawling", label: "Crawling Pages", status: "pending" as const },
    { name: "links", label: "Checking Links", status: "pending" as const },
    { name: "ui", label: "UI Inspection", status: "pending" as const },
    { name: "forms", label: "Form Testing", status: "pending" as const },
    { name: "report", label: "Generating Report", status: "pending" as const },
  ];

  if (status?.status === 'failed') {
    return (
      <div className="w-full max-w-2xl mx-auto mt-12">
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-6 text-destructive flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-10 h-10 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Scan Failed</h3>
            <p className="text-sm">{status.error || "An unknown error occurred during the scan."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2 tracking-tight">Scanning...</h2>
        <p className="text-muted-foreground font-mono text-sm">{status?.currentUrl || "Initializing..."}</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="capitalize">{status?.currentStep || "Booting"}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* Steps Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center space-x-3 text-sm">
                  {step.status === "completed" ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : step.status === "running" ? (
                    <RefreshCcw className="w-4 h-4 text-muted-foreground animate-spin" />
                  ) : step.status === "failed" ? (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground/30" />
                  )}
                  
                  <span className={cn(
                    "transition-colors",
                    step.status === "completed" ? "text-foreground" :
                    step.status === "running" ? "text-foreground font-medium" :
                    step.status === "failed" ? "text-destructive" :
                    "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}