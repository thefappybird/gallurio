"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useAppWorkspaceId } from "@/components/app/app-query-provider";
import { queryKeys } from "@/lib/query/keys";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMemberActivityAction } from "../_member-action";
import type { MemberSummary, TeamRow } from "../_types";

type Props = {
  member: MemberSummary | null;
  teams: TeamRow[];
  ownerWorkosUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
type Activity = { id: string; entity: string; action: string; createdAt: string };

export function MemberDetailsDialog({ member, teams, ownerWorkosUserId, open, onOpenChange }: Props) {
  const locale = useLocale();
  const t = useTranslations("app.teams.members.details");
  const ownerT = useTranslations("app.teams.members");
  const [tab, setTab] = useState<"details" | "history">("details");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const workspaceId = useAppWorkspaceId();
  const userId = member?.workosUserId;

  // Filters are part of the key, so each filter set is its own cursor-paginated
  // result set and a superseded response can never land in the current one.
  const history = useInfiniteQuery({
    queryKey: queryKeys(workspaceId).memberActivity(userId, { from, to, action }),
    queryFn: async ({ pageParam }) => {
      const result = await getMemberActivityAction({
        workosUserId: userId!,
        cursor: pageParam,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
        action: action || undefined,
      });
      if ("error" in result) throw new Error(result.error);
      return result;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: Boolean(open && userId && tab === "history"),
  });
  const items: Activity[] = history.data?.pages.flatMap((p) => p.items) ?? [];
  const cursor = history.hasNextPage;
  const loading = history.isPending || history.isFetching;

  useEffect(() => {
    if (!open) {
      void Promise.resolve().then(() => {
        setTab("details");
        setFrom("");
        setTo("");
        setAction("");
      });
    }
  }, [open]);

  if (!member) return null;

  const memberTeams = member.teams
    .map((membership) => teams.find((team) => team.id === membership.teamId))
    .filter((team): team is TeamRow => Boolean(team));
  const stats = member.bookingStats ?? { completed: 0, active: 0, future: 0 };
  const name = member.name || member.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {name}
            {member.workosUserId === ownerWorkosUserId && (
              <span className="border border-border bg-muted px-1.5 py-0.5 text-xs font-medium">
                {ownerT("ownerBadge")}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{member.email}</DialogDescription>
        </DialogHeader>

        <div className="flex border-b border-border" role="tablist" aria-label={t("tabsLabel")}>
          <Button role="tab" aria-selected={tab === "details"} variant={tab === "details" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("details")}>
            {t("tabs.details")}
          </Button>
          <Button role="tab" aria-selected={tab === "history"} variant={tab === "history" ? "secondary" : "ghost"} size="sm" onClick={() => setTab("history")}>
            {t("tabs.history")}
          </Button>
        </div>

        {tab === "details" ? (
          <div className="flex flex-col gap-5">
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("teams")}</p>
              <div className="flex flex-wrap gap-1.5">
                {memberTeams.map((team) => <span key={team.id} className="border px-2 py-1 text-xs font-medium" style={{ borderColor: team.color, backgroundColor: team.color }}>{team.name}</span>)}
                {memberTeams.length === 0 && <span className="text-sm text-muted-foreground">{t("noTeams")}</span>}
              </div>
            </section>
            <section className="grid grid-cols-3 gap-3">
              <Stat label={t("completed")} value={stats.completed} />
              <Stat label={t("workingNow")} value={stats.active} />
              <Stat label={t("future")} value={stats.future} />
            </section>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs font-medium" htmlFor="history-from-date">
                {t("fromDate")}
                <Input id="history-from-date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium" htmlFor="history-to-date">
                {t("toDate")}
                <Input id="history-to-date" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium" htmlFor="history-action">
                {t("action")}
                <select id="history-action" className="h-9 border border-input bg-background px-2 text-sm" value={action} onChange={(event) => setAction(event.target.value)}>
                  <option value="">{t("allActions")}</option>
                  <option value="created">{t("actions.created")}</option>
                  <option value="updated">{t("actions.updated")}</option>
                  <option value="deleted">{t("actions.deleted")}</option>
                  <option value="status_changed">{t("actions.statusChanged")}</option>
                  <option value="payment_added">{t("actions.paymentAdded")}</option>
                </select>
              </label>
            </div>
            {history.isError ? (
              <div role="alert" className="flex items-center justify-between gap-2 border border-border px-3 py-3">
                <p className="text-sm text-destructive">{t("loadError")}</p>
                <Button variant="outline" size="sm" onClick={() => void history.refetch()} disabled={history.isFetching}>
                  {t("retry")}
                </Button>
              </div>
            ) : loading && items.length === 0 ? (
              <HistorySkeleton label={t("loadingHistory")} />
            ) : (
              <ul className="divide-y divide-border border border-border">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="capitalize">{item.entity} {item.action.replaceAll("_", " ")}</span>
                    <time className="shrink-0 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time>
                  </li>
                ))}
                {!loading && items.length === 0 && <li className="px-3 py-6 text-sm text-muted-foreground">{t("noActivity")}</li>}
              </ul>
            )}
            {cursor && <Button variant="outline" size="sm" onClick={() => void history.fetchNextPage()} disabled={loading}>{history.isFetchingNextPage ? t("loading") : t("loadMore")}</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistorySkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-2 border border-border p-3" role="status" aria-label={label}>
      {[0, 1, 2].map((row) => <div key={row} className="h-5 animate-pulse bg-muted" />)}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>;
}
