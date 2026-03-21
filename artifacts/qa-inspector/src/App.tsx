import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import { UrlInput } from "./pages/UrlInput";
import { ScanProgress } from "./pages/ScanProgress";
import { Results } from "./pages/Results";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type AppState = "IDLE" | "SCANNING" | "RESULTS";

function MainApp() {
  const [appState, setAppState] = useState<AppState>("IDLE");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Check URL parameters on mount in case someone shared a link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobParam = params.get('jobId');
    if (jobParam) {
      setCurrentJobId(jobParam);
      setAppState("RESULTS");
    }
  }, []);

  const handleScanStarted = (jobId: string) => {
    setCurrentJobId(jobId);
    setAppState("SCANNING");
    // Update URL without refreshing
    window.history.pushState({}, '', `?jobId=${jobId}`);
  };

  const handleScanComplete = () => {
    setAppState("RESULTS");
  };

  const handleReset = () => {
    setAppState("IDLE");
    setCurrentJobId(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col px-4 sm:px-6 lg:px-8">
      {/* Top Navigation Bar - Simple minimal style */}
      <nav className="w-full border-b border-border py-4 flex justify-between items-center mb-8 z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg tracking-tight">QA Inspector</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-success"></div>
          <span>Online</span>
        </div>
      </nav>

      <main className="flex-grow flex flex-col relative z-10 w-full">
        {appState === "IDLE" && (
          <UrlInput onScanStarted={handleScanStarted} />
        )}
        
        {appState === "SCANNING" && currentJobId && (
          <ScanProgress jobId={currentJobId} onScanComplete={handleScanComplete} />
        )}
        
        {appState === "RESULTS" && currentJobId && (
          <Results jobId={currentJobId} onReset={handleReset} />
        )}
      </main>

      <footer className="w-full py-6 mt-auto text-center text-sm text-muted-foreground z-10">
        Automated Website Analysis
      </footer>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MainApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;