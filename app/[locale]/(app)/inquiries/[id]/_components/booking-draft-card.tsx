"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, Link } from "@/lib/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookingTeamOption } from "@/app/[locale]/(app)/bookings/_data/team-options";
import {
  approveInquiryBookingAction,
  saveDraftBookingFieldsAction,
} from "../../_actions";

type Props = {
  inquiryId: string;
  isOwner: boolean;
  isConverted: boolean;
  bookingMissing: boolean;
  bookingId: string | null;
  currency: string;
  initialTotal: number;
  initialDeposit: number;
  initialNotes: string;
  teams?: BookingTeamOption[];
  initialTeamId?: string | null;
};

export function BookingDraftCard({
  inquiryId,
  isOwner,
  isConverted,
  bookingMissing,
  bookingId,
  currency,
  initialTotal,
  initialDeposit,
  initialNotes,
  teams = [],
  initialTeamId = null,
}: Props) {
  const t = useTranslations("app.inquiries.detail.bookingDraft");
  const ta = useTranslations("app.inquiries.detail.actions");
  const tTeam = useTranslations("app.bookings.teamPicker");
  const router = useRouter();

  const [total, setTotal] = useState(String(initialTotal));
  const [deposit, setDeposit] = useState(String(initialDeposit));
  const [notes, setNotes] = useState(initialNotes);
  const [teamId, setTeamId] = useState<string | null>(initialTeamId);
  const showTeamPicker = teams.length > 1;
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  // Optimistic: once approved we flip to a success banner immediately.
  const [approved, setApproved] = useState(false);

  function currentEdits() {
    return {
      total: Number(total) || 0,
      deposit: Number(deposit) || 0,
      notes,
      teamId,
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await saveDraftBookingFieldsAction(inquiryId, currentEdits());
      if ("error" in res) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("savedToast"));
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setApproved(true); // optimistic
    try {
      const res = await approveInquiryBookingAction(inquiryId, currentEdits());
      if ("error" in res) {
        setApproved(false); // rollback
        toast.error(res.error === "owner_only" ? t("ownerOnly") : t("approveError"));
        return;
      }
      toast.success(ta("approvedToast"));
      router.refresh();
    } catch {
      setApproved(false);
      toast.error(t("approveError"));
    } finally {
      setApproving(false);
    }
  }

  // ── No linked draft (rollback artifact / legacy inquiry) ──
  if (bookingMissing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("missing")}</p>
        </CardContent>
      </Card>
    );
  }

  // ── Already approved (read-only confirmation) ──
  if (isConverted || approved) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="border border-transparent bg-brand px-3 py-2 text-sm text-brand-foreground">
            {t("alreadyConverted")}
          </div>
          {bookingId && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              render={<Link href={`/bookings?detail=${bookingId}`} />}
            >
              {t("viewBooking")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Editable draft ──
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft-total">
              {t("total")} ({currency})
            </Label>
            <Input
              id="draft-total"
              type="number"
              inputMode="decimal"
              min={0}
              value={total}
              disabled={!isOwner}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft-deposit">
              {t("deposit")} ({currency})
            </Label>
            <Input
              id="draft-deposit"
              type="number"
              inputMode="decimal"
              min={0}
              value={deposit}
              disabled={!isOwner}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="draft-notes">{t("notes")}</Label>
          <Textarea
            id="draft-notes"
            rows={3}
            value={notes}
            disabled={!isOwner}
            placeholder={t("notesPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {showTeamPicker ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft-team">{t("team")}</Label>
            <Select<string>
              value={teamId ?? ""}
              disabled={!isOwner}
              onValueChange={(v) => setTeamId(v || null)}
            >
              <SelectTrigger id="draft-team">
                <SelectValue placeholder={tTeam("allTeams")} />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.isActive ? team.name : `${team.name} (${tTeam("inactive")})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {!isOwner ? (
          <p className="text-sm text-muted-foreground">{t("ownerOnly")}</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleApprove} loading={approving} disabled={saving} className="sm:flex-1">
              {approving ? t("approving") : t("approve")}
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              loading={saving}
              disabled={approving}
            >
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
