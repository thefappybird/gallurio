import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/lib/i18n/navigation";
import { CalendarCheck2Icon, MessageSquareIcon, UserPlusIcon } from "lucide-react";
import { DashboardInfoHint } from "./dashboard-info-hint";

type Props = {
  title: string;
  labels: { booking: string; client: string; inquiry: string };
};

export function QuickAdd({ title, labels }: Props) {
  // Booking + client open their create modals via the ?add=1 deep-link.
  // Inquiries are inbound only (no in-app create), so that link reviews them.
  const actions = [
    { href: "/bookings?add=1" as const, label: labels.booking, icon: CalendarCheck2Icon },
    { href: "/clients?add=1" as const, label: labels.client, icon: UserPlusIcon },
    { href: "/inquiries" as const, label: labels.inquiry, icon: MessageSquareIcon },
  ];

  return (
    <Card className="h-full rounded-[var(--radius)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <DashboardInfoHint hint="quickAdd" />
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {actions.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
