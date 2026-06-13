import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/lib/i18n/navigation";
import { CalendarCheck2Icon, MessageSquareIcon, UserPlusIcon } from "lucide-react";

type Props = {
  title: string;
  labels: { booking: string; client: string; inquiry: string };
};

export function QuickAdd({ title, labels }: Props) {
  const actions = [
    { href: "/bookings/new" as const, label: labels.booking, icon: CalendarCheck2Icon },
    { href: "/clients/new" as const, label: labels.client, icon: UserPlusIcon },
    { href: "/inquiries/new" as const, label: labels.inquiry, icon: MessageSquareIcon },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {actions.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
