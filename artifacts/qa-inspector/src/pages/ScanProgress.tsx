import { useEffect } from "react";
import { motion } from "framer-motion";
import { Terminal, CheckSquare, Square, RefreshCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGetScanStatus } from "@workspace/api-client-react";

interface ScanProgressProps {
  jobId: string;
  onScanComplete: () => void;
}

export function ScanProgress({ jobId, onScanComplete }: ScanProgressProps) {
  const { data: status, error } = useGetScanStatus(jobId, {
    query: {
      refetchInterval: (query) => {
        const state = query.state.data?.status;
        return state === "completed" || state === "failed" ? false : 2000;
      },
    },
  });

  useEffect(() => {
    if (status?.status === "completed") {
      // Add slight delay for dramatic effect
      const timer = setTimeout(() => {
        onScanComplete();
      }, 1500);
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-4xl mx-auto mt-12"
    >
      <Card className="border-primary/50 shadow-cyan-lg">
        <div className="bg-primary/20 px-4 py-2 border-b border-primary/50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-primary font-mono text-sm">
            <Terminal className="w-4 h-4" />
            <span>sys.term // JOB_ID: {jobId}</span>
          </div>
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
          </div>
        </div>
        
        <CardContent className="p-8 font-mono bg-[#050508] relative overflow-hidden">
          {/* Subtle scanning background line */}
          <div className="absolute inset-0 pointer-events-none scanline opacity-30"></div>

          <div className="space-y-8 relative z-10">
            {/* Header */}
            <div>
              <h2 className="text-2xl text-primary font-bold mb-2">INSPECTION IN PROGRESS <span className="cursor-blink"></span></h2>
              <p className="text-muted-foreground text-sm">Do not terminate connection. Parsing DOM structures.</p>
            </div>

            {/* Current Target */}
            <div className="bg-primary/5 border border-primary/20 p-4">
              <span className="text-xs uppercase text-primary/70 mb-1 block">Current Operation Target</span>
              <p className="text-accent truncate" title={status?.currentUrl || "Initializing..."}>
                {"> "} {status?.currentUrl || "Initializing memory banks..."}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-primary uppercase">{status?.currentStep || "BOOTING"}</span>
                <span className="text-primary">{Math.round(progress)}%</span>
              </div>
              <div className="h-4 w-full bg-secondary border border-primary/30 overflow-hidden relative">
                <motion.div 
                  className="h-full bg-primary relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full h-full" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.2) 10px, rgba(0,0,0,0.2) 20px)' }}></div>
                </motion.div>
              </div>
            </div>

            {/* Steps Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-6 border-t border-primary/20">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center space-x-3 text-sm">
                  {step.status === "completed" ? (
                    <CheckSquare className="w-5 h-5 text-success" />
                  ) : step.status === "running" ? (
                    <RefreshCcw className="w-5 h-5 text-primary animate-spin" />
                  ) : step.status === "failed" ? (
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground" />
                  )}
                  
                  <span className={cn(
                    "uppercase tracking-wider transition-colors",
                    step.status === "completed" ? "text-foreground" :
                    step.status === "running" ? "text-primary font-bold" :
                    step.status === "failed" ? "text-destructive" :
                    "text-muted-foreground"
                  )}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
            
            {status?.status === 'failed' && (
              <div className="p-4 border border-destructive bg-destructive/10 text-destructive mt-6">
                <h3 className="font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>CRITICAL SYSTEM FAILURE</span>
                </h3>
                <p className="text-sm mt-2">{status.error || "Unknown error occurred during scan."}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
