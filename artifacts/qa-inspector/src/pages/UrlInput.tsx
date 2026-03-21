import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Globe, ShieldAlert, SlidersHorizontal, BrainCircuit } from "lucide-react";
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-3xl mx-auto mt-20"
    >
      <div className="text-center mb-12 relative">
        <ShieldAlert className="w-16 h-16 text-primary mx-auto mb-4 opacity-80" />
        <h1 className="text-6xl font-display font-bold text-primary mb-2 tracking-widest text-glow" data-text="AUTONOMOUS QA">
          AUTONOMOUS QA
        </h1>
        <h2 className="text-2xl font-mono text-muted-foreground tracking-[0.3em]">INSPECTION PROTOCOL</h2>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-32 bg-primary/5 blur-[100px] -z-10 rounded-full"></div>
      </div>

      <Card className="p-1">
        <div className="border border-primary/30 p-8 bg-black/40">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* URL Input */}
            <div className="space-y-3">
              <label className="flex items-center space-x-2 text-sm font-bold font-mono text-primary uppercase tracking-wider">
                <Globe className="w-4 h-4" />
                <span>Target Coordinates (URL)</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 font-mono text-primary font-bold">
                  {">"}
                </div>
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  required
                  className="pl-10 h-16 text-lg tracking-wider"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              {/* Max Pages Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-mono text-muted-foreground">
                  <label className="flex items-center space-x-2 uppercase tracking-wider text-primary">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Crawl Depth</span>
                  </label>
                  <span className="text-primary font-bold">{maxPages} PGs</span>
                </div>
                <Slider
                  min={5}
                  max={50}
                  step={5}
                  value={[maxPages]}
                  onValueChange={(v) => setMaxPages(v[0])}
                  className="py-4"
                />
              </div>

              {/* AI Toggle */}
              <div className="space-y-4 flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-sm font-mono text-primary uppercase tracking-wider">
                    <BrainCircuit className="w-4 h-4" />
                    <span>Neural Network Classify</span>
                  </label>
                  <Switch
                    checked={enableAI}
                    onCheckedChange={setEnableAI}
                  />
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  Utilize GPT-4o for bug severity & pattern classification.
                </p>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-6">
              <Button 
                type="submit" 
                size="lg" 
                className="w-full h-16 text-xl tracking-[0.2em] group relative overflow-hidden"
                disabled={startScanMutation.isPending}
              >
                <div className="absolute inset-0 w-full h-full bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0"></div>
                <span className="relative z-10 flex items-center space-x-3">
                  {startScanMutation.isPending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                      <span>INITIALIZING...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-6 h-6 fill-current" />
                      <span>INITIATE INSPECTION</span>
                    </>
                  )}
                </span>
              </Button>
              {startScanMutation.isError && (
                <p className="text-destructive font-mono text-sm mt-4 text-center">
                  ERR: FAILED TO INITIALIZE SCAN.
                </p>
              )}
            </div>
          </form>
        </div>
      </Card>
    </motion.div>
  );
}
