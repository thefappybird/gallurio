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
import { CollapsibleDrawer } from "@/components/ui/collapsible-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookingTeamOption } from "@/app/[locale]/(app)/bookings/_data/team-options";
import type { InquirySessionView } from "./event-request-card";
import {
  approveInquiryBookingAction,
  saveDraftBookingFieldsAction,
  editInquirySessionsAction,
} from "../../_actions";
import {
  overlappingShifts,
  toMinutes,
} from "@/app/[locale]/(app)/bookings/_components/_helpers/calendar-helpers";
import type { InquiryOptimisticPatch } from "@/lib/inquiries/optimistic-patch";
import { useTimeFormat } from "@/lib/time-format/context";
import { formatSessionTimeRange } from "@/lib/inquiries/session-time";
import { useActionError } from "@/lib/i18n/actionError";

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
  sessions?: InquirySessionView[];
  locale?: string;
  hasConflict?: boolean;
  readOnly?: boolean;
  onConverted?: () => void;
  onConvertFailed?: () => void;
  onInquiryChanged?: (inquiryId: string, patch: InquiryOptimisticPatch) => void;
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
  sessions = [],
  locale,
  hasConflict = false,
  readOnly = false,
  onConverted,
  onConvertFailed,
  onInquiryChanged,
}: Props) {
  const t = useTranslations("app.inquiries.detail.bookingDraft");
  const ta = useTranslations("app.inquiries.detail.actions");
  const ts = useTranslations("app.inquiries.detail.sessionsEditor");
  const ter = useTranslations("app.inquiries.detail.eventRequest");
  const tTeam = useTranslations("app.bookings.teamPicker");
  const router = useRouter();
  const timeMode = useTimeFormat();
  const errMsg = useActionError();

  const [total, setTotal] = useState(String(initialTotal));
  const [deposit, setDeposit] = useState(String(initialDeposit));
  const [notes, setNotes] = useState(initialNotes);
  const [teamId, setTeamId] = useState<string | null>(initialTeamId);
  const showTeamPicker = teams.length > 1;
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  // Dirty tracking: snapshot of the last-saved field values.
  // After a successful save the snapshot is reset to the saved values
  // so the Save button disables until the next edit.
  const [snapshot, setSnapshot] = useState({
    total: String(initialTotal),
    deposit: String(initialDeposit),
    notes: initialNotes,
    teamId: initialTeamId ?? null,
  });

  const fieldsLocked = !isOwner || readOnly;

  const isDirty =
    Number(total) !== Number(snapshot.total) ||
    Number(deposit) !== Number(snapshot.deposit) ||
    notes.trim() !== snapshot.notes.trim() ||
    (teamId ?? null) !== (snapshot.teamId ?? null);

  // Sessions editor state
  const [editingSessions, setEditingSessions] = useState(false);
  const [draftSessions, setDraftSessions] = useState<InquirySessionView[]>(sessions);
  const [sessionConflicts, setSessionConflicts] = useState<boolean[]>([]);
  const [sessionsSaving, setSessionsSaving] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  function currentEdits() {
    return { total: Number(total) || 0, deposit: Number(deposit) || 0, notes, teamId };
  }

  function fmtSessionDate(date: string): string {
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? date
      : d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  async function checkSessionConflicts(next: InquirySessionView[]) {
    const checks = next.map(async (s) => {
      try {
        const url = `/api/bookings/shifts-on-date?date=${s.startDate}${bookingId ? `&excludeId=${bookingId}` : ""}`;
        const resp = await fetch(url);
        if (!resp.ok) return false;
        const { shifts } = await resp.json();
        const aStart = toMinutes(s.startTime);
        const aEnd = toMinutes(s.endTime);
        if (aStart === null || aEnd === null) return false;
        return overlappingShifts(shifts, aStart, aEnd).length > 0;
      } catch { return false; }
    });
    setSessionConflicts(await Promise.all(checks));
  }

  async function handleSessionChange(idx: number, field: keyof InquirySessionView, value: string) {
    const next = draftSessions.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    setDraftSessions(next);
    await checkSessionConflicts(next);
  }

  const today = new Date().toISOString().slice(0, 10);
  const hasSessionConflict = sessionConflicts.some(Boolean);
  const hasInvalidSession = draftSessions.some(
    (s) => s.startDate < today || !s.startTime || !s.endTime || s.endTime <= s.startTime
  );
  const canSaveSessions = !hasSessionConflict && !hasInvalidSession && !sessionsSaving;

  async function handleSaveSessions() {
    setSessionsSaving(true);
    setSessionsError(null);
    const result = await editInquirySessionsAction(inquiryId, { sessions: draftSessions });
    setSessionsSaving(false);
    if ("ok" in result && result.ok) {
      setEditingSessions(false);
      toast.success(ts("savedToast"));
    } else if ("error" in result) {
      setSessionsError(result.error);
      toast.error(ts("saveError"));
    }
  }

  function handleDiscardSessions() {
    setDraftSessions(sessions);
    setSessionConflicts([]);
    setSessionsError(null);
    setEditingSessions(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const edits = currentEdits();
      const res = await saveDraftBookingFieldsAction(inquiryId, edits);
      if ("error" in res) { toast.error(t("saveError")); return; }
      toast.success(t("savedToast"));
      // Reset snapshot so Save button disables until next edit.
      setSnapshot({ total, deposit, notes, teamId: teamId ?? null });
      // Propagate optimistic patch to the table row.
      onInquiryChanged?.(inquiryId, { total: edits.total, deposit: edits.deposit, notes: edits.notes });
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setApproved(true); // optimistic banner
    onConverted?.(); // close modal + update table row immediately
    try {
      const res = await approveInquiryBookingAction(inquiryId, currentEdits());
      if ("error" in res) {
        setApproved(false); // revert banner
        onConvertFailed?.(); // revert table row
        toast.error(res.error === "owner_only" ? t("ownerOnly") : t("approveError"));
        return;
      }
      toast.success(ta("approvedToast"));
      if (!onConverted) router.refresh(); // standalone page only
    } catch {
      setApproved(false);
      onConvertFailed?.();
      toast.error(t("approveError"));
    } finally {
      setApproving(false);
    }
  }

  if (bookingMissing) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{t("title")}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("missing")}</p>
        </CardContent>
      </Card>
    );
  }

  if (isConverted || approved) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{t("title")}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="border border-transparent bg-brand px-3 py-2 text-sm text-brand-foreground">
            {t("alreadyConverted")}
          </div>
          {bookingId && (
            <Button variant="outline" size="sm" className="self-start" render={<Link href={`/bookings?detail=${bookingId}`} />}>
              {t("viewBooking")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("title")}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft-total">{t("total")} ({currency})</Label>
            <Input id="draft-total" type="number" inputMode="decimal" min={0} value={total} disabled={fieldsLocked} onChange={(e) => setTotal(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft-deposit">{t("deposit")} ({currency})</Label>
            <Input id="draft-deposit" type="number" inputMode="decimal" min={0} value={deposit} disabled={fieldsLocked} onChange={(e) => setDeposit(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="draft-notes">{t("notes")}</Label>
          <Textarea id="draft-notes" rows={3} value={notes} disabled={fieldsLocked} placeholder={t("notesPlaceholder")} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {showTeamPicker ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="draft-team">{t("team")}</Label>
            <Select<string> value={teamId ?? ""} disabled={fieldsLocked} onValueChange={(v) => setTeamId(v || null)}>
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

        {/* Sessions editor */}
        {sessions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {ter("sessions")}
              </span>
              {!readOnly && !editingSessions ? (
                <button
                  type="button"
                  onClick={() => { setEditingSessions(true); setSessionsError(null); }}
                  className="text-xs underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:underline"
                >
                  {ts("edit")}
                </button>
              ) : null}
            </div>

            {!editingSessions ? (
              <ul className="flex flex-col gap-1">
                {draftSessions.map((s, i) => (
                  <li key={i}>
                    <CollapsibleDrawer
                      title={<span className="text-sm font-medium">{ts("sessionLabel", { n: i + 1 })}</span>}
                      subtitle={
                        <span className="text-xs text-muted-foreground">
                          {fmtSessionDate(s.startDate)}{" · "}
                          {formatSessionTimeRange(
                            { startDate: s.startDate, startTime: s.startTime, endTime: s.endTime },
                            timeMode,
                            "UTC"
                          )}
                        </span>
                      }
                      defaultOpen={i === 0}
                      bodyClassName="max-h-48 overflow-y-auto"
                    >
                      <div className="text-sm tabular-nums">
                        <div>{fmtSessionDate(s.startDate)}</div>
                        <div className="text-muted-foreground">
                          {formatSessionTimeRange(
                            { startDate: s.startDate, startTime: s.startTime, endTime: s.endTime },
                            timeMode,
                            "UTC"
                          )}
                        </div>
                      </div>
                    </CollapsibleDrawer>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-3">
                {draftSessions.map((s, i) => (
                  <CollapsibleDrawer
                    key={i}
                    title={<span className="text-sm font-medium">{ts("sessionLabel", { n: i + 1 })}</span>}
                    subtitle={
                      <span className="text-xs text-muted-foreground">
                        {sessionConflicts[i]
                          ? ts("conflictInline")
                          : formatSessionTimeRange(
                              { startDate: s.startDate, startTime: s.startTime, endTime: s.endTime },
                              timeMode,
                              "UTC"
                            )}
                      </span>
                    }
                    defaultOpen={i === 0}
                    className={sessionConflicts[i] ? "border-destructive" : undefined}
                    bodyClassName="max-h-64 overflow-y-auto"
                  >
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-3 flex flex-col gap-0.5 sm:col-span-1">
                        <label className="text-xs text-muted-foreground">{ts("dateLabel")}</label>
                        <input
                          type="date"
                          value={s.startDate}
                          onChange={(e) => handleSessionChange(i, "startDate", e.target.value)}
                          className="border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-muted-foreground">{ts("startLabel")}</label>
                        <input
                          type="time"
                          value={s.startTime}
                          onChange={(e) => handleSessionChange(i, "startTime", e.target.value)}
                          className="border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-muted-foreground">{ts("endLabel")}</label>
                        <input
                          type="time"
                          value={s.endTime}
                          onChange={(e) => handleSessionChange(i, "endTime", e.target.value)}
                          className="border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                    </div>
                  </CollapsibleDrawer>
                ))}

                {hasSessionConflict && (
                  <p className="text-xs text-destructive">{ts("conflictBlocks")}</p>
                )}
                {hasInvalidSession && !hasSessionConflict && (
                  <p className="text-xs text-destructive">{ts("pastDate")}</p>
                )}
                {sessionsError && !hasSessionConflict && !hasInvalidSession && (
                  <p className="text-xs text-destructive">
                    {sessionsError === "alter_only" ? ts("alterOnlyError") : errMsg(sessionsError)}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveSessions}
                    disabled={!canSaveSessions}
                    className="border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  >
                    {sessionsSaving ? ts("saving") : ts("save")}
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardSessions}
                    className="border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {ts("discard")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!readOnly && !isOwner ? (
          <p className="text-sm text-muted-foreground">{t("ownerOnly")}</p>
        ) : !readOnly ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleApprove}
                loading={approving}
                disabled={hasConflict || saving || approving}
                aria-disabled={hasConflict || saving || approving}
                className="sm:flex-1"
              >
                {approving ? t("approving") : t("approve")}
              </Button>
              <Button
                variant="outline"
                onClick={handleSave}
                loading={saving}
                disabled={!isDirty || saving || approving}
                aria-disabled={!isDirty || saving || approving}
              >
                {saving ? t("saving") : t("save")}
              </Button>
            </div>

            {hasConflict && (
              <p className="text-xs text-destructive" role="alert">
                {t("conflictBlocks")}
              </p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
