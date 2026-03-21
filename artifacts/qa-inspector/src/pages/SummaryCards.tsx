import { motion } from "framer-motion";
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
      title: "PAGES SCANNED",
      value: totalPages,
      icon: Layers,
      color: "text-primary",
      borderColor: "border-primary",
      bgColor: "bg-primary/5"
    },
    {
      title: "BROKEN LINKS",
      value: summary.brokenLinks,
      icon: Link2Off,
      color: summary.brokenLinks > 0 ? "text-destructive" : "text-success",
      borderColor: summary.brokenLinks > 0 ? "border-destructive" : "border-success",
      bgColor: summary.brokenLinks > 0 ? "bg-destructive/5" : "bg-success/5"
    },
    {
      title: "UI ISSUES",
      value: summary.uiIssues,
      icon: LayoutTemplate,
      color: summary.uiIssues > 0 ? "text-warning" : "text-success",
      borderColor: summary.uiIssues > 0 ? "border-warning" : "border-success",
      bgColor: summary.uiIssues > 0 ? "bg-warning/5" : "bg-success/5"
    },
    {
      title: "FORM ISSUES",
      value: summary.formIssues,
      icon: TextCursorInput,
      color: summary.formIssues > 0 ? "text-warning" : "text-success",
      borderColor: summary.formIssues > 0 ? "border-warning" : "border-success",
      bgColor: summary.formIssues > 0 ? "bg-warning/5" : "bg-success/5"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, idx) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: idx * 0.1 }}
        >
          <Card className={`border-t-4 border-l-0 border-r-0 border-b-0 ${card.borderColor} ${card.bgColor} rounded-none`}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-mono text-muted-foreground">{card.title}</p>
                  <motion.p 
                    className={`text-5xl font-display font-bold tracking-wider ${card.color}`}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 + (idx * 0.1) }}
                  >
                    {card.value}
                  </motion.p>
                </div>
                <div className={`p-3 rounded-none border ${card.borderColor} bg-background/50`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
