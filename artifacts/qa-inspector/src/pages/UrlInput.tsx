import { useState, useEffect } from "react";
import { Globe, SlidersHorizontal, BrainCircuit, History, ExternalLink, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useStartScan } from "@workspace/api-client-react";

interface UrlInputProps {
  onScanStarted: (jobId: string) => void;
  initialUrl?: string;
}

interface ScanHistoryItem {
  jobId: string;
  url: string;
  scannedAt: string;
  totalBugs: number;
  healthScore: number;
}

const HISTORY_KEY = "qa-inspector-history";
const MAX_HISTORY = 8;

function loadHistory(): ScanHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToHistory(item: ScanHistoryItem) {
  try {
    const history = loadHistory().filter(h => h.jobId !== item.jobId);
    const updated = [item, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
}

export function saveCompletedScan(jobId: string, url: string, totalBugs: number, healthScore: number) {
  saveToHistory({
    jobId,
    url,
    scannedAt: new Date().toISOString(),
    totalBugs,
    healthScore,
  });
}

const DEMO_JOB_ID = "394d6243-302a-4f69-b303-fc56118c7012";
const DEMO_URL = "https://books.toscrape.com/";

export function UrlInput({ onScanStarted, initialUrl }: UrlInputProps) {
  const [url, setUrl] = useState(initialUrl || "https://example.com");
  const [maxPages, setMaxPages] = useState(20);
  const [enableAI, setEnableAI] = useState(true);
  const [history, setHistory] = useState<ScanHistoryItem[]>(() => loadHistory());

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
    }
  }, [initialUrl]);

  const startScanMutation = useStartScan({
    mutation: {
      onSuccess: (data) => {
        onScanStarted(data.jobId);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    startScanMutation.mutate({ data: { url, maxPages, enableAI } });
  };

  const handleDeleteHistory = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(h => h.jobId !== jobId);
    setHistory(updated);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleClearAll = () => {
    clearHistory();
    setHistory([]);
  };

  const healthColor = (score: number) =>
    score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-destructive";

  return (
    <div className="w-full max-w-xl mx-auto mt-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 tracking-tight">
          QA Inspector
        </h1>
        <p className="text-muted-foreground">Automated website analysis</p>
      </div>

      <div
        className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 cursor-pointer hover:bg-primary/10 transition-colors"
        onClick={() => onScanStarted(DEMO_JOB_ID)}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 shrink-0" />
            Try the live demo
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {DEMO_URL} — 324 issues found across 8 pages
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-primary/30 text-primary hover:bg-primary/10"
          onClick={(e) => { e.stopPropagation(); onScanStarted(DEMO_JOB_ID); }}
        >
          View report
        </Button>
      </div>

      <Card>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Website URL</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 pt-2">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <label className="flex items-center space-x-2 font-medium">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Max Pages</span>
                  </label>
                  <span className="text-muted-foreground">{maxPages} pages</span>
                </div>
                <Slider
                  min={5}
                  max={50}
                  step={5}
                  value={[maxPages]}
                  onValueChange={(v) => setMaxPages(v[0])}
                />
              </div>

              <div className="flex items-center justify-between border rounded-md p-4 bg-muted/20">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium flex items-center space-x-2">
                    <BrainCircuit className="w-4 h-4" />
                    <span>AI Classification</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Use AI for bug severity & pattern classification
                  </p>
                </div>
                <Switch
                  checked={enableAI}
                  onCheckedChange={setEnableAI}
                />
              </div>
            </div>

            <div className="pt-4">
              <Button 
                type="submit" 
                className="w-full"
                disabled={startScanMutation.isPending}
              >
                {startScanMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                    <span>Initializing...</span>
                  </>
                ) : (
                  <span>{initialUrl ? 'Re-scan Site' : 'Start Scan'}</span>
                )}
              </Button>
              {startScanMutation.isError && (
                <p className="text-destructive text-sm mt-3 text-center">
                  {(startScanMutation.error as any)?.payload?.error || 'Failed to initialize scan. Please try again.'}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <History className="w-4 h-4" />
              <span>Recent Scans</span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2" onClick={handleClearAll}>
              Clear all
            </Button>
          </div>
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.jobId}
                className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-muted/30 transition-colors group"
              >
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setUrl(item.url)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono truncate text-foreground">{item.url}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.scannedAt).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.totalBugs} bugs</span>
                    <span className={`text-xs font-medium ${healthColor(item.healthScore)}`}>
                      Score: {item.healthScore}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="View report"
                    onClick={() => {
                      window.history.pushState({}, '', `?jobId=${item.jobId}`);
                      window.location.reload();
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    title="Remove"
                    onClick={(e) => handleDeleteHistory(item.jobId, e)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
