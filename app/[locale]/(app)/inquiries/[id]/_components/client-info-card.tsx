"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  name: string;
  email: string;
  phone: string | null;
  preferredContact: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}

export function ClientInfoCard({ name, email, phone, preferredContact }: Props) {
  const t = useTranslations("app.inquiries.detail.clientInfo");
  const tp = useTranslations("app.inquiries.preferred");
  const preferredLabel = (() => {
    try {
      return tp(preferredContact);
    } catch {
      return preferredContact;
    }
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          <Row label={t("name")} value={name} />
          <Row label={t("email")} value={email} />
          <Row label={t("phone")} value={phone || t("none")} />
          <Row label={t("preferredContact")} value={preferredLabel} />
        </dl>
      </CardContent>
    </Card>
  );
}
