import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PipelineCounts } from "../_data/dashboard-metrics";

type Props = {
  counts: PipelineCounts;
  title: string;
  labels: { inquiries: string; booked: string };
};

export function PipelineFunnel({ counts, title, labels }: Props) {
  const total = Math.max(counts.inquiries + counts.booked, 1);
  const segments = [
    { label: labels.inquiries, value: counts.inquiries, className: "bg-muted text-muted-foreground" },
    { label: labels.booked, value: counts.booked, className: "bg-brand text-brand-foreground" },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex h-9 w-full overflow-hidden border border-border">
          {segments.map((s) => {
            const pct = (s.value / total) * 100;
            return (
              <div
                key={s.label}
                className={`flex items-center justify-center text-xs font-medium ${s.className}`}
                style={{ width: `${pct}%`, minWidth: s.value > 0 ? "2.5rem" : "0" }}
              >
                {s.value > 0 ? s.value : null}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {segments.map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold">{s.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
