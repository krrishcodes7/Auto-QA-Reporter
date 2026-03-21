import { Layers, Link2Off, LayoutTemplate, TextCursorInput } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ScanSummary } from "@workspace/api-client-react";

interface SummaryCardsProps {
  summary: ScanSummary;
  totalPages: number;
}

export function SummaryCards({ summary, totalPages }: SummaryCardsProps) {
  const cards = [
    {
      title: "Pages Scanned",
      value: totalPages,
      icon: Layers,
      color: "text-foreground",
    },
    {
      title: "Broken Links",
      value: summary.brokenLinks,
      icon: Link2Off,
      color: summary.brokenLinks > 0 ? "text-destructive" : "text-foreground",
    },
    {
      title: "UI Issues",
      value: summary.uiIssues,
      icon: LayoutTemplate,
      color: summary.uiIssues > 0 ? "text-warning" : "text-foreground",
    },
    {
      title: "Form Issues",
      value: summary.formIssues,
      icon: TextCursorInput,
      color: summary.formIssues > 0 ? "text-warning" : "text-foreground",
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      {cards.map((card) => (
        <Card key={card.title} className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className={`text-3xl font-bold tracking-tight ${card.color}`}>
                  {card.value}
                </p>
              </div>
              <div className="p-2 bg-muted/50 rounded-md">
                <card.icon className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}