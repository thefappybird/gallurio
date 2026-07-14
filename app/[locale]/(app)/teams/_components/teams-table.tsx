"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  EyeIcon,
  MailPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PowerOffIcon,
  RotateCcwIcon,
  UsersRoundIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TeamRow } from "../_types";

function CardField({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-sm text-foreground", valueClassName)}>{value}</dd>
    </div>
  );
}

type Props = {
  rows: TeamRow[];
  empty: string;
  /** Primary CTA rendered under the empty state (e.g. "Create team"). */
  emptyAction?: ReactNode;
  onDetails: (team: TeamRow) => void;
  onEdit: (team: TeamRow) => void;
  onInvite: (team: TeamRow) => void;
  onDeactivate: (team: TeamRow) => void;
  onReactivate: (team: TeamRow) => void;
  canManage: boolean;
};

export function TeamsTable({
  rows,
  empty,
  emptyAction,
  onDetails,
  onEdit,
  onInvite,
  onDeactivate,
  onReactivate,
  canManage,
}: Props) {
  const t = useTranslations("app.teams");
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);

  function renderActionsMenu(team: TeamRow) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("team.actionsLabel", { name: team.name })}
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuItem onClick={() => onDetails(team)}>
            <EyeIcon className="size-4" />
            {t("table.details")}
          </DropdownMenuItem>
          {team.isActive && (
            <>
              <DropdownMenuItem onClick={() => onEdit(team)}>
                <PencilIcon className="size-4" />
                {t("team.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onInvite(team)}>
                <MailPlusIcon className="size-4" />
                {t("team.invite")}
              </DropdownMenuItem>
            </>
          )}
          {team.isActive && !team.isDefault && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDeactivate(team)}>
                <PowerOffIcon className="size-4" />
                {t("team.deactivate")}
              </DropdownMenuItem>
            </>
          )}
          {!team.isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onReactivate(team)}>
                <RotateCcwIcon className="size-4" />
                {t("team.reactivate")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const columns = useMemo<ColumnDef<TeamRow>[]>(
    () => [
      {
        accessorKey: "color",
        header: () => t("table.col.color"),
        cell: (info) => (
          <span
            aria-hidden="true"
            className="block size-5 border border-border"
            style={{ backgroundColor: info.getValue<string>() }}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: () => t("table.col.name"),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="flex items-center gap-2">
              <span className={cn("font-medium", !row.isActive && "text-muted-foreground")}>
                {info.getValue<string>()}
              </span>
              {row.isDefault && (
                <Badge variant="secondary" className="text-xs">
                  {t("team.defaultBadge")}
                </Badge>
              )}
              {!row.isActive && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {t("team.inactiveBadge")}
                </Badge>
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "memberCount",
        header: () => t("table.col.members"),
        cell: (info) => (
          <span className="tabular-nums text-muted-foreground">
            {t("team.memberCount", { count: info.getValue<number>() })}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("table.col.actions")}</span>,
        cell: (info) => (
          <div className="flex justify-end">
            {canManage && renderActionsMenu(info.row.original)}
          </div>
        ),
        enableSorting: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- renderActionsMenu closes over these same deps every render
    [t, onDetails, onEdit, onInvite, onDeactivate, onReactivate, canManage],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions; React Compiler skips this component intentionally
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return <EmptyState icon={UsersRoundIcon} title={empty} action={emptyAction} />;
  }

  return (
    <>
      <div data-testid="teams-card-list" className="flex flex-col gap-3 lg:hidden">
        {table.getRowModel().rows.map((row) => {
          const team = row.original;
          return (
            <article
              key={team.id}
              role="button"
              tabIndex={0}
              aria-label={t("table.openTeam", { name: team.name })}
              onClick={() => onDetails(team)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDetails(team);
                }
              }}
              className={cn(
                "border border-border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                !team.isActive && "opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="block size-5 shrink-0 border border-border"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className={cn("truncate font-medium", !team.isActive && "text-muted-foreground")}>
                      {team.name}
                    </span>
                    {team.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        {t("team.defaultBadge")}
                      </Badge>
                    )}
                    {!team.isActive && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {t("team.inactiveBadge")}
                      </Badge>
                    )}
                  </span>
                </div>

                {canManage && (
                  <div onClick={(event) => event.stopPropagation()}>
                    {renderActionsMenu(team)}
                  </div>
                )}
              </div>

              <dl className="mt-4 grid gap-3 border-t border-border pt-4">
                <CardField
                  label={t("table.col.members")}
                  value={t("team.memberCount", { count: team.memberCount })}
                  valueClassName="tabular-nums text-muted-foreground"
                />
              </dl>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto border border-border bg-card lg:block">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b border-border bg-muted/30 text-start text-xs uppercase tracking-wide text-muted-foreground"
              >
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-3 py-2 font-medium text-start",
                        canSort && "cursor-pointer select-none",
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort &&
                          (sorted === "asc" ? (
                            <ArrowUpIcon className="size-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon className="size-3" />
                          ) : (
                            <ArrowUpDownIcon className="size-3 opacity-40" />
                          ))}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onDetails(row.original)}
                className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-accent/40"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 py-2.5 align-middle"
                    onClick={(e) => {
                      if (cell.column.id === "actions") e.stopPropagation();
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
