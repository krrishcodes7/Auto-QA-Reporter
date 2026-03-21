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
      {/* Background image loaded directly from public via URL base path */}
      <div 
        className="fixed inset-0 z-[-1] opacity-20 pointer-events-none mix-blend-screen"
        style={{ 
          backgroundImage: `url(${import.meta.env.BASE_URL}images/cyber-grid.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      {/* Top Navigation Bar - Industrial style */}
      <nav className="w-full border-b border-primary/20 py-4 flex justify-between items-center mb-4 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary text-black font-bold font-display flex items-center justify-center text-xl shadow-cyan">
            QA
          </div>
          <span className="font-mono font-bold tracking-widest text-primary hidden sm:inline-block">INSPECTOR_PROTOCOL v1.0</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-success animate-pulse"></div> SYS_ONLINE</span>
          <span className="hidden sm:inline-block">{new Date().toISOString().split('T')[0]}</span>
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

      <footer className="w-full py-6 mt-auto border-t border-primary/20 text-center font-mono text-xs text-muted-foreground z-10 bg-background/80 backdrop-blur-sm">
        AUTONOMOUS QA SYSTEM // BUILT FOR HIGH-PERFORMANCE WEB TESTING
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
