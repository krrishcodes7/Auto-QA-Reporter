import { useState } from "react";
import { Globe, SlidersHorizontal, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useStartScan } from "@workspace/api-client-react";

interface UrlInputProps {
  onScanStarted: (jobId: string) => void;
}

export function UrlInput({ onScanStarted }: UrlInputProps) {
  const [url, setUrl] = useState("https://example.com");
  const [maxPages, setMaxPages] = useState(20);
  const [enableAI, setEnableAI] = useState(true);

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

  return (
    <div className="w-full max-w-xl mx-auto mt-20">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2 tracking-tight">
          QA Inspector
        </h1>
        <p className="text-muted-foreground">Automated website analysis</p>
      </div>

      <Card>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* URL Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Website URL
              </label>
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
              {/* Max Pages Slider */}
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

              {/* AI Toggle */}
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

            {/* Action Button */}
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
                  <span>Start Scan</span>
                )}
              </Button>
              {startScanMutation.isError && (
                <p className="text-destructive text-sm mt-3 text-center">
                  Failed to initialize scan. Please try again.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}