"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateInquiryPhoneAction } from "@/app/[locale]/(app)/inquiries/_actions";

type Props = {
  inquiryId: string;
  name: string;
  email: string;
  phone: string | null;
  preferredContact: string;
  status: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}

export function ClientInfoCard({ inquiryId, name, email, phone, preferredContact, status }: Props) {
  const t = useTranslations("app.inquiries.detail.clientInfo");
  const tp = useTranslations("app.inquiries.preferred");
  const preferredLabel = (() => {
    try { return tp(preferredContact); } catch { return preferredContact; }
  })();

  const locked = status === "booked" || status === "converted" || status === "archived";
  const [editingPhone, setEditingPhone] = useState(false);
  const [draftPhone, setDraftPhone] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSavePhone() {
    setSaving(true);
    const res = await updateInquiryPhoneAction(inquiryId, draftPhone);
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setEditingPhone(false);
  }

  function handleCancelPhone() {
    setDraftPhone(phone ?? "");
    setEditingPhone(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          <Row label={t("name")} value={name} />
          <Row label={t("email")} value={email} />
          <div className="py-2 first:pt-0 last:pb-0">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("phone")}</dt>
            {editingPhone ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="tel"
                  value={draftPhone}
                  onChange={(e) => setDraftPhone(e.target.value)}
                  className="min-w-0 flex-1 border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSavePhone}
                  disabled={saving}
                  className="shrink-0 border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  {t("savePhone")}
                </button>
                <button
                  type="button"
                  onClick={handleCancelPhone}
                  className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  {t("cancelEdit")}
                </button>
              </div>
            ) : (
              <dd className="flex items-center gap-2 text-sm break-words">
                <span>{draftPhone || t("none")}</span>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => setEditingPhone(true)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:underline"
                  >
                    {t("editPhone")}
                  </button>
                )}
              </dd>
            )}
          </div>
          <Row label={t("preferredContact")} value={preferredLabel} />
        </dl>
      </CardContent>
    </Card>
  );
}
