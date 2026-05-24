import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils/format-currency";

type ClientLike = {
  _id: { toString(): string };
  name: string;
  totalSpent?: number;
};

type Props = {
  clients: ClientLike[];
  currency: string;
  locale: string;
  title: string;
  empty: string;
};

export function TopClientsBar({ clients, currency, locale, title, empty }: Props) {
  const max = Math.max(1, ...clients.map((c) => c.totalSpent ?? 0));

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-0">
        {clients.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {clients.map((c, i) => {
              const spent = c.totalSpent ?? 0;
              const pct = (spent / max) * 100;
              return (
                <li
                  key={c._id.toString()}
                  className="group/row flex flex-col gap-1 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex size-5 shrink-0 items-center justify-center border border-border bg-muted text-[10px] font-semibold text-muted-foreground transition-colors group-hover/row:bg-primary group-hover/row:text-primary-foreground group-hover/row:border-primary">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">{c.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground transition-colors group-hover/row:text-foreground">
                      {formatMoney(spent, currency, locale)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted transition-all duration-300 ease-out group-hover/row:h-2.5">
                    <div
                      className="h-full bg-primary transition-colors duration-300 ease-out group-hover/row:bg-foreground"
                      style={{ width: `${Math.max(2, pct)}%` }}
                      aria-hidden
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
