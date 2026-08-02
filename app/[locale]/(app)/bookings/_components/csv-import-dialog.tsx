"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useGuardedAction } from "@/hooks/use-guarded-action";
import { useRouter } from "@/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
import type { BookingTeamOption } from "../_data/team-options";
import { toast } from "sonner";
import {
  CheckCircleIcon,
  ChevronRightIcon,
  FileTextIcon,
  SheetIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseCsv, stripFormulaGuard } from "@/lib/utils/csv-parse";
import { bookingImportRowSchema } from "@/lib/validators/booking";
import { sessionsAreSameDayInTz } from "@/lib/bookings/session-validation";
import { IMPORT_COLUMNS } from "@/lib/bookings/import-template";
import { FALLBACK_TZ } from "@/lib/utils/timezone";
import type {
  ImportResult,
  DuplicateWarning,
  ImportErrorEntry,
} from "@/app/api/bookings/import/route";
import { ImportResultsDialog } from "./import-results-dialog";
import { cn } from "@/lib/utils";

type ParsedRow = {
  index: number;
  raw: Record<string, string>;
  valid: boolean;
  error: string | null;
  errorField?: string;
  title: string;
  clientName: string;
  startAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultCurrency: string;
  /**
   * Workspace IANA timezone. The preview needs it to answer the same
   * same-day question the route asks at commit — without it a booking that
   * crosses midnight in wall time previews clean and fails on submit.
   */
  workspaceTimezone?: string;
  /**
   * Teams the caller can write to. A picker only appears when there is an
   * actual choice; with one team the route's default already lands there.
   */
  teams?: BookingTeamOption[];
};

export function CsvImportDialog({
  open,
  onClose,
  defaultCurrency,
  workspaceTimezone,
  teams = [],
}: Props) {
  const t = useTranslations("app.bookings.import");
  const tDialog = useTranslations("app.bookings.import.dialog");
  const errMsg = useActionError();
  const tCols = useTranslations("app.bookings.import.columns");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogBodyRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const collapsedDialogHeightRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [showPreviewErrors, setShowPreviewErrors] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
  const [dialogHeight, setDialogHeight] = useState<number | null>(null);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    },
    []
  );

  // Only active teams the caller can write to are real choices.
  const writableTeams = useMemo(
    () => teams.filter((team) => team.isActive && team.isLead),
    [teams]
  );
  const [teamId, setTeamId] = useState<string>("");
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning[] | null>(null);

  // Rows sharing a booking_id are ONE booking, and the route rebuilds its
  // sessions from whatever rows arrive. Importing the good half of a group
  // would therefore delete the sessions belonging to the bad half, so a group
  // is all-or-nothing.
  const blockedGroups = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) {
      const id = r.raw.bookingId?.trim();
      if (!r.valid && id) ids.add(id);
    }
    return ids;
  }, [rows]);

  const validRows = useMemo(
    () => rows.filter((r) => r.valid && !blockedGroups.has(r.raw.bookingId?.trim() ?? "")),
    [rows, blockedGroups]
  );
  const invalidRows = useMemo(
    () => rows.filter((r) => !r.valid || blockedGroups.has(r.raw.bookingId?.trim() ?? "")),
    [rows, blockedGroups]
  );

  const invalidIndexes = useMemo(
    () => new Set(invalidRows.map((r) => r.index)),
    [invalidRows]
  );

  // Preview failures reuse the post-import error dialog rather than a second
  // one: same rows, same raw-row drill-down, and the table cell is too narrow
  // to hold a full message.
  const previewErrors: ImportErrorEntry[] = useMemo(
    () =>
      invalidRows.map((r) => ({
        index: r.index,
        row: r.raw,
        field: r.errorField,
        kind: "validation" as const,
        // A row can be blocked purely because a sibling in its booking_id group
        // failed, in which case it has no error of its own to show.
        message: r.error ?? t("groupBlocked"),
      })),
    [invalidRows, t]
  );

  const { loading: importing, trigger: triggerImport } = useGuardedAction(
    useCallback(async (confirmDuplicates = false) => {
      if (validRows.length === 0) return;

      setImportResult(null);
      const payload = validRows.map((r) => ({
        ...r.raw,
        amountTotal: r.raw.amountTotal || undefined,
        amountDeposit: r.raw.amountDeposit || undefined,
        clientEmail: r.raw.clientEmail || null,
        currency: r.raw.currency || defaultCurrency,
      }));

      const res = await fetch("/api/bookings/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: payload,
          ...(teamId ? { teamId } : {}),
          ...(confirmDuplicates ? { confirmDuplicates: true } : {}),
        }),
      });
      const body = await res.json().catch(() => null);

      // Looks already imported. Nothing was written; ask before proceeding.
      if (res.ok && body?.needsConfirmation) {
        setDuplicateWarning(body.duplicates as DuplicateWarning[]);
        return;
      }

      // A rejected request (429, 403, 400) answers with {error}, not a result.
      // Committing that to state and reading .errors off it throws during the
      // next render and takes the page down with it.
      if (!res.ok || !body || !Array.isArray(body.errors)) {
        toast.error(errMsg(body?.error));
        return;
      }

      const data: ImportResult = body;
      setImportResult(data);

      const written = data.created + data.updated;
      if (written > 0) {
        toast.success(t("success", { count: written }));
        startTransition(() => router.refresh());
      }
      if (data.errors.length > 0) {
        setShowResultsDialog(true);
        if (written === 0) {
          toast.error(tDialog("failedWithDetails"));
        }
      }
    }, [validRows, defaultCurrency, teamId, t, tDialog, errMsg, router, startTransition]),
    {
      onError: () => {
        toast.error(tDialog("failedRetry"));
      },
    }
  );

  // Validate + shape parsed rows for the preview table. Shared by both paths so
  // a CSV and an XLSX produce an identical preview.
  const buildRows = useCallback(
    (csvRows: Record<string, string>[]): ParsedRow[] => {
      return csvRows.map((rawIn, i) => {
        // Undo the exporter's anti-formula apostrophe before anything is shown or
        // sent, so the preview matches what the route will store. Stripping twice
        // is a no-op, so the route keeping its own guard costs nothing.
        const raw = Object.fromEntries(
          Object.entries(rawIn).map(([k, v]) => [k, typeof v === "string" ? stripFormulaGuard(v) : v])
        ) as Record<string, string>;
        const result = bookingImportRowSchema.safeParse({
          ...raw,
          amountTotal: raw.amountTotal || undefined,
          amountDeposit: raw.amountDeposit || undefined,
          clientEmail: raw.clientEmail || null,
        });

        const base = {
          index: i,
          raw,
          title: raw.title ?? "",
          clientName: raw.clientName ?? "",
          startAt: raw.startAt ?? "",
        };

        if (!result.success) {
          const issue = result.error.errors[0];
          return {
            ...base,
            valid: false,
            error: issue?.message ?? "Invalid row",
            errorField: issue?.path?.[0]?.toString(),
          };
        }

        // The schema only compares UTC days, which is blind to a wall-time
        // midnight crossing: 09:00Z–17:00Z is one UTC day but 17:00–01:00 in
        // Manila. The route rejects that at commit, so previewing it as valid
        // is how a clean-looking file failed on submit.
        const tz = workspaceTimezone || FALLBACK_TZ;
        const sameDay = sessionsAreSameDayInTz(
          [{ startAt: result.data.startAt, endAt: result.data.endAt ?? result.data.startAt }],
          tz
        );
        if (!sameDay.ok) {
          return {
            ...base,
            valid: false,
            error: t("crossesMidnight", { tz }),
            errorField: "endAt",
          };
        }

        return { ...base, valid: true, error: null };
      });
    },
    [workspaceTimezone, t]
  );

  const processFile = useCallback(
    (file: File) => {
      const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
      if (!isXlsx && !isCsv) {
        setParseError(t("parseError"));
        return;
      }
      setStructureOpen(false);
      setDialogHeight(null);
      setFileName(file.name);
      setRows([]);
      setImportResult(null);
      setParseError(null);

      // XLSX is binary, so it is parsed server-side rather than shipping a
      // spreadsheet library to the browser. CSV is text and stays local, which
      // keeps the common case a zero-round-trip preview.
      if (isXlsx) {
        const body = new FormData();
        body.append("file", file);
        void fetch("/api/bookings/import", { method: "POST", body })
          .then(async (res) => {
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.rows) {
              setParseError(t("parseError"));
              return;
            }
            setRows(buildRows(data.rows as Record<string, string>[]));
          })
          .catch(() => setParseError(t("parseError")));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          setRows(buildRows(parseCsv(text).rows));
        } catch {
          setParseError(t("parseError"));
        }
      };
      reader.readAsText(file);
    },
    [t, buildRows]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  function handleClose() {
    if (importing) return;
    setRows([]);
    setFileName(null);
    setParseError(null);
    setImportResult(null);
    setShowResultsDialog(false);
    setShowPreviewErrors(false);
    setStructureOpen(false);
    setDialogHeight(null);
    onClose();
  }

  function toggleStructure() {
    const currentHeight = dialogBodyRef.current?.getBoundingClientRect().height;
    if (!currentHeight) {
      setStructureOpen((open) => !open);
      return;
    }

    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);

    if (structureOpen) {
      // The collapsed height was measured before expansion. Keeping the dialog
      // at its current height for one frame gives CSS a numeric start and end
      // value, so closing does not depend on animating to `auto`.
      setDialogHeight(currentHeight);
      setStructureOpen(false);
      animationFrameRef.current = requestAnimationFrame(() => {
        setDialogHeight(collapsedDialogHeightRef.current ?? currentHeight);
        animationFrameRef.current = null;
      });
      return;
    }

    collapsedDialogHeightRef.current = currentHeight;
    setDialogHeight(currentHeight);
    setStructureOpen(true);
    animationFrameRef.current = requestAnimationFrame(() => {
      setDialogHeight(Math.max(currentHeight, window.innerHeight - 48));
      animationFrameRef.current = null;
    });
  }

  const hasRows = rows.length > 0;
  const done = importResult !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          showCloseButton
          style={dialogHeight === null ? undefined : { height: dialogHeight }}
          className={cn(
            "flex max-h-[calc(100dvh-3rem)] w-full max-w-2xl flex-col gap-0 p-0 motion-safe:transition-[height] motion-safe:duration-200 motion-safe:ease-out sm:max-w-2xl"
          )}
        >
          <div ref={dialogBodyRef} className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border px-4 py-3">
              <DialogTitle>{t("title")}</DialogTitle>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
            {!hasRows ? (
              <div
                className={cn(
                  "border border-border",
                  structureOpen && "flex min-h-0 flex-1 flex-col"
                )}
              >
                <button
                  type="button"
                  aria-expanded={structureOpen}
                  onClick={toggleStructure}
                  className="flex w-full shrink-0 items-center gap-1.5 bg-muted px-3 py-2 text-start text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <ChevronRightIcon
                    className={cn("size-3.5 shrink-0 transition-transform", structureOpen && "rotate-90")}
                  />
                  {tDialog("structureTitle")}
                </button>
                {structureOpen ? (
                  <div
                    data-testid="import-structure-scroll"
                    className="min-h-0 flex-1 overflow-y-auto"
                  >
                    <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] border-y border-border bg-muted/90 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm supports-[backdrop-filter]:bg-muted/75">
                      <span>{tDialog("columnHeader")}</span>
                      <span />
                      <span>{tDialog("notesHeader")}</span>
                    </div>
                    {IMPORT_COLUMNS.map((h) => (
                      <div
                        key={h.name}
                        className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-border px-3 py-1.5 text-xs last:border-0"
                      >
                        <span className="font-mono text-foreground">{h.name}</span>
                        <span className="px-2">
                          {h.required ? (
                            <Badge variant="default" className="text-[10px] leading-none">
                              {tDialog("required")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] leading-none">
                              {tDialog("optional")}
                            </Badge>
                          )}
                        </span>
                        <span className="text-muted-foreground">{tDialog(`spec.${h.name}.note`)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {writableTeams.length > 1 ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="import-team" className="text-xs font-medium text-foreground">
                  {tDialog("teamLabel")}
                </label>
                <select
                  id="import-team"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  disabled={importing}
                  className="border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="">{tDialog("teamDefault")}</option>
                  {writableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {!hasRows ? (
              <div
                role="button"
                tabIndex={0}
                aria-label={t("dropzone")}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-colors",
                  dragging
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-border text-muted-foreground hover:border-brand hover:text-brand"
                )}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <UploadIcon className="size-8 opacity-60" />
                <p className="text-sm">{dragging ? t("dropzoneActive") : t("dropzone")}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={onInputChange}
                />
              </div>
            ) : null}

            {parseError ? (
              <p className="text-sm text-destructive">{parseError}</p>
            ) : null}

            {/* Served by the route, not built here: the XLSX is a zip, and
                generating both server-side is what keeps them identical. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href="/api/bookings/import?format=csv"
                download
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <FileTextIcon className="me-1 inline size-3" />
                {t("templateCsv")}
              </a>
              <a
                href="/api/bookings/import?format=xlsx"
                download
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <SheetIcon className="me-1 inline size-3" />
                {t("templateXlsx")}
              </a>
            </div>

            {hasRows ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">
                    {t("preview", { total: rows.length })}
                  </span>
                  {validRows.length > 0 ? (
                    <span className="text-xs text-foreground">
                      {t("validCount", { count: validRows.length })}
                    </span>
                  ) : null}
                  {invalidRows.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowPreviewErrors(true)}
                      className="text-xs text-destructive underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {t("invalidCount", { count: invalidRows.length })}
                    </button>
                  ) : null}
                  <span className="ms-auto text-xs text-muted-foreground">{fileName}</span>
                </div>

                <div className="max-h-64 overflow-auto border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted text-muted-foreground">
                      <tr>
                        <th className="w-8 border-b border-border px-2 py-1.5 text-start font-medium">
                          {tCols("row")}
                        </th>
                        <th className="w-5 border-b border-border px-1 py-1.5" />
                        <th className="border-b border-border px-2 py-1.5 text-start font-medium">
                          {tCols("title")}
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-start font-medium">
                          {tCols("client")}
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-start font-medium">
                          {tCols("start")}
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-start font-medium text-destructive">
                          {tCols("error")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        // Group-blocked rows parse fine on their own but are
                        // still not importable. Showing them with a green tick
                        // contradicted the counts right above the table.
                        const bad = invalidIndexes.has(row.index);
                        return (
                        <tr
                          key={row.index}
                          className={cn(
                            "border-b border-border last:border-0",
                            bad && "bg-destructive/5"
                          )}
                        >
                          <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                            {row.index + 1}
                          </td>
                          <td className="px-1 py-1.5">
                            {bad ? (
                              <XCircleIcon className="size-3.5 text-destructive" />
                            ) : (
                              <CheckCircleIcon className="size-3.5 text-foreground" />
                            )}
                          </td>
                          <td className="max-w-32 truncate px-2 py-1.5">{row.title || "—"}</td>
                          <td className="max-w-28 truncate px-2 py-1.5">{row.clientName || "—"}</td>
                          <td className="px-2 py-1.5 tabular-nums">{row.startAt || "—"}</td>
                          <td className="px-2 py-1.5 text-destructive">
                            {bad ? (
                              // The cell truncates a long message; the dialog
                              // shows it whole alongside the raw row.
                              <button
                                type="button"
                                onClick={() => setShowPreviewErrors(true)}
                                className="text-start underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              >
                                {row.error ?? t("groupBlocked")}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={importing}>
              {done ? tDialog("close") : tDialog("cancel")}
            </Button>

            {hasRows && !done ? (
              validRows.length > 0 ? (
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  // Wrapped: passing the handler directly would hand the click
                  // event in as confirmDuplicates, which is truthy, so the
                  // warning would never be shown.
                  onClick={() => void triggerImport()}
                  loading={importing}
                >
                  {importing ? t("importing") : t("importButton", { count: validRows.length })}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">{t("noValidRows")}</span>
              )
            ) : null}

            {done && importResult ? (
              <div className="flex items-center gap-2">
                {importResult.errors.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResultsDialog(true)}
                  >
                    {tDialog("viewErrors", { n: importResult.errors.length })}
                  </Button>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {t("success", { count: importResult.created })}
                </span>
              </div>
            ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {duplicateWarning ? (
        <Dialog open onOpenChange={(next) => !next && setDuplicateWarning(null)}>
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-md">
            <DialogTitle>{tDialog("duplicateTitle")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {tDialog("duplicateBody", { count: duplicateWarning.length })}
            </p>
            <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto text-sm">
              {duplicateWarning.map((d) => (
                <li key={d.index} className="flex flex-col border border-border px-3 py-2">
                  <span className="font-medium text-foreground">{d.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.teamName
                      ? tDialog("duplicateOnTeam", { team: d.teamName })
                      : tDialog("duplicateNoTeam")}
                  </span>
                </li>
              ))}
            </ul>
            <DialogFooter className="static mx-0 mb-0 border-t-0 bg-transparent p-0 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDuplicateWarning(null)}
                className="min-h-11 sm:min-h-0"
              >
                {tDialog("cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setDuplicateWarning(null);
                  void triggerImport(true);
                }}
                className="min-h-11 sm:min-h-0"
              >
                {tDialog("duplicateContinue")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {importResult && importResult.errors.length > 0 ? (
        <ImportResultsDialog
          open={showResultsDialog}
          onClose={() => setShowResultsDialog(false)}
          errors={importResult.errors}
          summary={{
            created: importResult.created,
            updated: importResult.updated,
            skipped: importResult.skipped,
          }}
        />
      ) : null}

      {previewErrors.length > 0 ? (
        <ImportResultsDialog
          open={showPreviewErrors}
          onClose={() => setShowPreviewErrors(false)}
          errors={previewErrors}
        />
      ) : null}
    </>
  );
}
