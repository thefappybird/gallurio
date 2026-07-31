"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useActionError } from "@/lib/i18n/actionError";
import { AlertTriangleIcon, PencilIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateInquiryPhoneAction,
  findInquiryClientMatchesAction,
} from "@/app/[locale]/(app)/inquiries/_actions";
import type { InquiryOptimisticPatch } from "@/lib/inquiries/optimistic-patch";

type Props = {
  inquiryId: string;
  name: string;
  email: string;
  phone: string | null;
  preferredContact: string;
  status: string;
  readOnly?: boolean;
  onInquiryChanged?: (inquiryId: string, patch: InquiryOptimisticPatch) => void;
  /**
   * Opens the client-match dialog. Provided only where resolving is possible;
   * when absent the indicator is not rendered at all.
   */
  onResolveClient?: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}

export function ClientInfoCard({ inquiryId, name, email, phone, preferredContact, status, readOnly = false, onInquiryChanged, onResolveClient }: Props) {
  const t = useTranslations("app.inquiries.detail.clientInfo");
  const tMatch = useTranslations("app.inquiries.detail.clientMatch");
  const [hasMatch, setHasMatch] = useState(false);
  const tp = useTranslations("app.inquiries.preferred");
  const errMsg = useActionError();
  const preferredLabel = (() => {
    try { return tp(preferredContact); } catch { return preferredContact; }
  })();

  const locked = readOnly || status === "booked" || status === "converted" || status === "archived";

  // Computed live when this card mounts — i.e. when the inquiry is opened.
  // Nothing is stored, so there is nothing to invalidate. Deliberately absent
  // from the inquiries table: that would need a per-row lookup across the list.
  useEffect(() => {
    if (locked || !onResolveClient) return;
    let cancelled = false;
    void findInquiryClientMatchesAction(inquiryId).then((res) => {
      // Guard against a resolve landing after the modal closed.
      if (!cancelled && "ok" in res) setHasMatch(res.matches.length > 0);
    });
    return () => {
      cancelled = true;
    };
  }, [inquiryId, locked, onResolveClient]);

  const [editingPhone, setEditingPhone] = useState(false);
  const [draftPhone, setDraftPhone] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSavePhone() {
    setSaving(true);
    const res = await updateInquiryPhoneAction(inquiryId, draftPhone);
    setSaving(false);
    if ("error" in res) {
      toast.error(errMsg(res.error));
      return;
    }
    toast.success(t("savedToast"));
    setEditingPhone(false);
    onInquiryChanged?.(inquiryId, { phone: draftPhone });
  }

  function handleCancelPhone() {
    setDraftPhone(phone ?? "");
    setEditingPhone(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        {onResolveClient && hasMatch ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Icon is never the only signal — the warning text and the
                button's accessible name carry the same meaning. */}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangleIcon className="size-3.5 text-destructive" aria-hidden />
              {tMatch("warning")}
            </span>
            <button
              type="button"
              onClick={onResolveClient}
              className="border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {tMatch("resolveButton")}
            </button>
          </div>
        ) : null}
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
              <dd className="mt-1 flex items-center text-sm">
                <span className="break-words">{draftPhone || t("none")}</span>
                {!locked && (
                  <button
                    type="button"
                    aria-label={t("editPhone")}
                    onClick={() => setEditingPhone(true)}
                    className="ms-auto shrink-0 p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:bg-accent/70 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
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
