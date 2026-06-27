"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TeamRow } from "../_types";

type Props = {
  rows: TeamRow[];
  empty: string;
  onDetails: (team: TeamRow) => void;
  onEdit: (team: TeamRow) => void;
  onInvite: (team: TeamRow) => void;
  onDeactivate: (team: TeamRow) => void;
  onReactivate: (team: TeamRow) => void;
};

export function TeamsTable({
  rows,
  empty,
  onDetails,
  onEdit,
  onInvite,
  onDeactivate,
  onReactivate,
}: Props) {
  const t = useTranslations("app.teams");
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);

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
        cell: (info) => {
          const team = info.row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("team.actionsLabel", { name: team.name })}
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
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDeactivate(team)}
                      >
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
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [t, onDetails, onEdit, onInvite, onDeactivate, onReactivate],
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
    return (
      <div className="border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border bg-card">
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
  );
}
