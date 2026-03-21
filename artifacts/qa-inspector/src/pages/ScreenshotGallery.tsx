import { useState } from "react";
import { Maximize2, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ScreenshotListScreenshotsItem } from "@workspace/api-client-react";

interface ScreenshotGalleryProps {
  screenshots?: ScreenshotListScreenshotsItem[];
}

export function ScreenshotGallery({ screenshots = [] }: ScreenshotGalleryProps) {
  const [selectedImg, setSelectedImg] = useState<ScreenshotListScreenshotsItem | null>(null);

  if (!screenshots.length) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-border mt-8">
        <p className="text-muted-foreground font-mono uppercase tracking-widest">No visual data captured in this sector.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {screenshots.map((img, idx) => (
          <Card 
            key={idx} 
            className="group relative overflow-hidden cursor-pointer border-border hover:border-primary transition-colors"
            onClick={() => setSelectedImg(img)}
          >
            <div className="aspect-[4/3] bg-muted relative">
              <img 
                src={img.url} 
                alt={`Screenshot of ${img.pageUrl}`} 
                className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                <Maximize2 className="w-10 h-10 text-primary" />
              </div>
            </div>
            <div className="p-3 border-t border-border group-hover:border-primary transition-colors bg-card/90 font-mono text-xs truncate">
              {img.pageUrl}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedImg} onOpenChange={(open) => !open && setSelectedImg(null)}>
        <DialogContent className="max-w-5xl w-[90vw] p-0 border-primary bg-black/95">
          <DialogHeader className="p-4 border-b border-primary/30 bg-card">
            <DialogTitle className="text-lg">VISUAL CAPTURE</DialogTitle>
            <DialogDescription className="text-xs truncate">{selectedImg?.pageUrl}</DialogDescription>
          </DialogHeader>
          <div className="relative w-full max-h-[70vh] overflow-auto bg-black p-4">
            {selectedImg && (
              <img 
                src={selectedImg.url} 
                alt="Full size screenshot" 
                className="w-full h-auto"
              />
            )}
          </div>
          <div className="p-4 border-t border-primary/30 bg-card flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => window.open(selectedImg?.pageUrl, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              OPEN TARGET URL
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
