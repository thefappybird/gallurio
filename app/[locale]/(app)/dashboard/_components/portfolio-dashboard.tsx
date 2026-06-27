import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";

// Placeholder shell — the portfolio analytics reads + charts land in a later
// phase (Phase 4). Kept intentionally minimal so the tab switches cleanly today.
export async function PortfolioDashboard() {
  const t = await getTranslations("app.dashboard");

  return (
    <Card className="rounded-[var(--radius)]">
      <CardContent className="flex min-h-40 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {t("portfolio.analyticsSoon")}
      </CardContent>
    </Card>
  );
}
