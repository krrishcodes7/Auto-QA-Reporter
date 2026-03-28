import { Layers, Link2Off, LayoutTemplate, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ScanSummary } from "@workspace/api-client-react";

interface SummaryCardsProps {
  summary: ScanSummary;
  totalPages: number;
}

function HealthScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-destructive";
  const label = score >= 80 ? "Good" : score >= 50 ? "Fair" : "Poor";
  return (
    <div className="flex flex-col items-center justify-center">
      <span className={`text-3xl font-bold tracking-tight ${color}`}>{score}</span>
      <span className={`text-xs font-medium mt-0.5 ${color}`}>{label}</span>
    </div>
  );
}

function SeverityPill({
  count,
  label,
  colorClass,
}: {
  count: number;
  label: string;
  colorClass: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold ${colorClass}`}>
      <span>{label}</span>
      <span className="opacity-80">({count})</span>
    </div>
  );
}

export function SummaryCards({ summary, totalPages }: SummaryCardsProps) {
  if (!summary) return null;
  const healthScore = summary.healthScore ?? 100;
  const severityCounts = summary.severityCounts ?? { critical: 0, high: 0, medium: 0, low: 0 };
  const criticalCount = severityCounts.critical ?? 0;

  const cards = [
    {
      title: "Health Score",
      value: null,
      icon: ShieldCheck,
      color: healthScore >= 80 ? "text-green-500" : healthScore >= 50 ? "text-yellow-500" : "text-destructive",
      custom: <HealthScoreRing score={healthScore} />,
    },
    {
      title: "Pages Scanned",
      value: totalPages,
      icon: Layers,
      color: "text-foreground",
      custom: null,
    },
    {
      title: "Broken Links",
      value: summary.brokenLinks,
      icon: Link2Off,
      color: summary.brokenLinks > 0 ? "text-destructive" : "text-foreground",
      custom: null,
    },
    {
      title: "UI / Form Issues",
      value: summary.uiIssues + summary.formIssues,
      icon: LayoutTemplate,
      color: (summary.uiIssues + summary.formIssues) > 0 ? "text-warning" : "text-foreground",
      custom: null,
    },
  ];

  return (
    <div className="mb-10 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  {card.custom ? (
                    card.custom
                  ) : (
                    <p className={`text-3xl font-bold tracking-tight ${card.color}`}>
                      {card.value}
                    </p>
                  )}
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Severity breakdown bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span className="font-medium">Severity breakdown:</span>
        </div>
        {criticalCount > 0 && (
          <SeverityPill
            count={criticalCount}
            label="Critical"
            colorClass="bg-purple-900/40 text-purple-200 border-purple-700/50"
          />
        )}
        <SeverityPill
          count={severityCounts.high}
          label="High"
          colorClass="bg-red-900/30 text-red-300 border-red-700/50"
        />
        <SeverityPill
          count={severityCounts.medium}
          label="Medium"
          colorClass="bg-yellow-900/30 text-yellow-300 border-yellow-700/50"
        />
        <SeverityPill
          count={severityCounts.low}
          label="Low"
          colorClass="bg-muted/60 text-muted-foreground border-border"
        />
      </div>
    </div>
  );
}
