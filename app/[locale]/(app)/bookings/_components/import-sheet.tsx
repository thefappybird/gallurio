"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useGuardedAction } from "@/hooks/use-guarded-action";
import { useRouter } from "@/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
import type { BookingTeamOption } from "../_data/team-options";
import { toast } from "sonner";
import {
  CheckCircleIcon,
  FileTextIcon,
  Loader2Icon,
  SheetIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { parseCsv } from "@/lib/utils/csv-parse";
import { bookingImportRowSchema } from "@/lib/validators/booking";
import { sessionsAreSameDayInTz } from "@/lib/bookings/session-validation";
import {
  MAPPABLE_FIELDS,
  applyMapping,
  autoMapColumns,
  collectUnmappedEnumValues,
  requiredFieldsSatisfied,
  type ColumnMapping,
} from "@/lib/bookings/import-mapping";
import { isAmbiguousDateColumn, type DateOrder } from "@/lib/bookings/import-normalize";
import { FALLBACK_TZ } from "@/lib/utils/timezone";
import type {
  ImportResult,
  DuplicateWarning,
  ImportErrorEntry,
} from "@/app/api/bookings/import/route";
import { ImportResultsDialog } from "./import-results-dialog";
import { ImportColumnMapping } from "./import-column-mapping";
import { ImportValueMapping } from "./import-value-mapping";
import { cn } from "@/lib/utils";

type Step = "upload" | "map" | "values" | "preview";

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
   * Workspace IANA timezone. Both the preview and date coercion need it — a
   * bare "2026-06-15" has to land on the workspace's day, not the browser's.
   */
  workspaceTimezone?: string;
  /**
   * Teams the caller can write to. A picker only appears when there is an
   * actual choice; with one team the route's default already lands there.
   */
  teams?: BookingTeamOption[];
};

export function ImportSheet({
  open,
  onClose,
  defaultCurrency,
  workspaceTimezone,
  teams = [],
}: Props) {
  const t = useTranslations("app.bookings.import");
  const tDialog = useTranslations("app.bookings.import.dialog");
  const tSteps = useTranslations("app.bookings.import.steps");
  const tNav = useTranslations("app.bookings.import.nav");
  const tCoerce = useTranslations("app.bookings.import.coerce");
  const errMsg = useActionError();
  const tCols = useTranslations("app.bookings.import.columns");
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const timeZone = workspaceTimezone || FALLBACK_TZ;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  // Drives which way a step animates in. Purely presentational.
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(() => autoMapColumns([]));
  const [valueMap, setValueMap] = useState<Record<string, Record<string, string>>>({});
  const [dateOrder, setDateOrder] = useState<DateOrder>("MDY");
  const [autoMapped, setAutoMapped] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [showPreviewErrors, setShowPreviewErrors] = useState(false);

  const writableTeams = useMemo(
    () => teams.filter((team) => team.isActive && team.isLead),
    [teams]
  );
  const [teamId, setTeamId] = useState<string>("");
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning[] | null>(null);

  const resetImportState = useCallback(() => {
    setStep("upload");
    setDirection("forward");
    setHeaders([]);
    setSourceRows([]);
    setMapping(autoMapColumns([]));
    setValueMap({});
    setDateOrder("MDY");
    setAutoMapped(false);
    setParsing(false);
    setFileName(null);
    setParseError(null);
    setImportResult(null);
    setShowResultsDialog(false);
    setShowPreviewErrors(false);
    setTeamId("");
    setDuplicateWarning(null);
  }, []);

  // ── mapping-derived data ───────────────────────────────────────────────────

  const unmapped = useMemo(
    () => (sourceRows.length ? collectUnmappedEnumValues(sourceRows, mapping) : []),
    [sourceRows, mapping]
  );

  // A suggestion the dropdown shows as pre-selected has to actually be what
  // applyMapping resolves against, or a value the UI showed as already
  // matched still fails to import as unrecognized. Derived, not stored: an
  // entry the user has actually answered (present in valueMap, even as "")
  // always wins over the guess.
  const effectiveValueMap = useMemo(() => {
    const merged: Record<string, Record<string, string>> = {};
    for (const [field, answers] of Object.entries(valueMap)) merged[field] = { ...answers };
    for (const entry of unmapped) {
      if (entry.suggestion === null) continue;
      if (merged[entry.field]?.[entry.value] !== undefined) continue;
      merged[entry.field] = { ...merged[entry.field], [entry.value]: entry.suggestion };
    }
    return merged;
  }, [valueMap, unmapped]);

  /** Which column each choice field reads, so the value step can name it. */
  const enumSourceColumns = useMemo(() => {
    const out: Record<string, string> = {};
    for (const field of MAPPABLE_FIELDS) {
      const assignment = mapping[field.key];
      if (assignment && "source" in assignment) out[field.key] = assignment.source;
    }
    return out;
  }, [mapping]);

  /**
   * A sample value from the FIRST ambiguous mapped date column (startAt
   * checked before endAt), or null if none is ambiguous. One global value,
   * not per-field: if both startAt and endAt are mapped and only one is
   * genuinely ambiguous, the single dateOrder toggle still renders on both
   * date cards. Shown so the order question is about their data rather than
   * an abstract preference.
   */
  const ambiguousDateExample = useMemo(() => {
    for (const key of ["startAt", "endAt"]) {
      const assignment = mapping[key];
      if (!assignment || !("source" in assignment)) continue;
      const column = sourceRows.map((r) => r[assignment.source] ?? "");
      if (isAmbiguousDateColumn(column)) return column.find((v) => v.trim()) ?? null;
    }
    return null;
  }, [mapping, sourceRows]);

  const mappedRows = useMemo(
    () =>
      sourceRows.length
        ? applyMapping(sourceRows, mapping, { timeZone, dateOrder, valueMap: effectiveValueMap })
        : [],
    [sourceRows, mapping, timeZone, dateOrder, effectiveValueMap]
  );

  /**
   * Validate the normalized rows for the preview. A mapping issue is reported
   * first: it explains the failure in the user's own words ("we could not read
   * 'to be confirmed' as an amount"), where the schema would only say a
   * required field was missing.
   */
  const rows: ParsedRow[] = useMemo(
    () =>
      mappedRows.map((mapped, i) => {
        const raw = mapped.values;
        const base = {
          index: i,
          raw,
          title: raw.title ?? "",
          clientName: raw.clientName ?? "",
          startAt: raw.startAt ?? "",
        };

        const issue = mapped.issues[0];
        if (issue) {
          return {
            ...base,
            valid: false,
            error: tCoerce(issue.reason, { field: issue.field, value: issue.value }),
            errorField: issue.field,
          };
        }

        const result = bookingImportRowSchema.safeParse({
          ...raw,
          amountTotal: raw.amountTotal || undefined,
          amountDeposit: raw.amountDeposit || undefined,
          clientEmail: raw.clientEmail || null,
        });
        if (!result.success) {
          const first = result.error.errors[0];
          return {
            ...base,
            valid: false,
            error: first?.message ?? "Invalid row",
            errorField: first?.path?.[0]?.toString(),
          };
        }

        // The schema only compares UTC days, which is blind to a wall-time
        // midnight crossing: 09:00Z–17:00Z is one UTC day but 17:00–01:00 in
        // Manila. The route rejects that at commit, so previewing it as valid
        // is how a clean-looking file failed on submit.
        const sameDay = sessionsAreSameDayInTz(
          [{ startAt: result.data.startAt, endAt: result.data.endAt ?? result.data.startAt }],
          timeZone
        );
        if (!sameDay.ok) {
          return {
            ...base,
            valid: false,
            error: t("crossesMidnight", { tz: timeZone }),
            errorField: "endAt",
          };
        }

        return { ...base, valid: true, error: null };
      }),
    [mappedRows, timeZone, t, tCoerce]
  );

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
        message: r.error ?? t("groupBlocked"),
      })),
    [invalidRows, t]
  );

  // ── steps ──────────────────────────────────────────────────────────────────

  // The value step only exists when the file actually has values we cannot
  // read, so a clean file never sees an empty screen.
  const steps: Step[] = useMemo(
    () =>
      unmapped.length > 0
        ? ["upload", "map", "values", "preview"]
        : ["upload", "map", "preview"],
    [unmapped.length]
  );
  const stepIndex = Math.max(0, steps.indexOf(step));

  const goTo = useCallback((next: Step, how: "forward" | "back") => {
    setDirection(how);
    setStep(next);
  }, []);

  const goNext = useCallback(() => {
    const next = steps[stepIndex + 1];
    if (next) goTo(next, "forward");
  }, [steps, stepIndex, goTo]);

  const goBack = useCallback(() => {
    const previous = steps[stepIndex - 1];
    if (previous) goTo(previous, "back");
  }, [steps, stepIndex, goTo]);

  // ── import ─────────────────────────────────────────────────────────────────

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
        toast.success(t("success", { bookings: written, shifts: data.shifts }));
        startTransition(() => router.refresh());
        // A clean import is complete. Leave a partial import open so its
        // actionable errors stay available; otherwise return the owner to the
        // refreshed booking view rather than making them dismiss this sheet.
        if (data.errors.length === 0) {
          resetImportState();
          onClose();
        }
      }
      if (data.errors.length > 0) {
        setShowResultsDialog(true);
        if (written === 0) {
          toast.error(tDialog("failedWithDetails"));
        }
      }
    }, [validRows, defaultCurrency, teamId, t, tDialog, errMsg, router, startTransition, resetImportState, onClose]),
    {
      onError: () => {
        toast.error(tDialog("failedRetry"));
      },
    }
  );

  // The sheet stays locked while anything is in flight: the import itself, and
  // then the router refresh that repopulates the table behind it. Reporting
  // success while the list is still stale is what makes an import feel broken.
  const busy = importing || refreshing;

  // ── file intake ────────────────────────────────────────────────────────────

  const receive = useCallback(
    (nextHeaders: string[], nextRows: Record<string, string>[]) => {
      const auto = autoMapColumns(nextHeaders);
      const complete = requiredFieldsSatisfied(auto);
      setHeaders(nextHeaders);
      setSourceRows(nextRows);
      setMapping(auto);
      setAutoMapped(complete);
      // A file that already speaks our language (our template, or a Gallurio
      // export) goes straight to the preview, exactly as it always did. The
      // mapping step is still one click away.
      setDirection("forward");
      setStep(complete && collectUnmappedEnumValues(nextRows, auto).length === 0 ? "preview" : "map");
    },
    []
  );

  const processFile = useCallback(
    (file: File) => {
      const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
      if (!isXlsx && !isCsv) {
        setParseError(t("parseError"));
        return;
      }
      setFileName(file.name);
      setHeaders([]);
      setSourceRows([]);
      setImportResult(null);
      setParseError(null);
      setValueMap({});

      // XLSX is binary, so it is parsed server-side rather than shipping a
      // spreadsheet library to the browser. That round-trip is the one real
      // wait in this flow, so the mapping step shows a skeleton meanwhile.
      if (isXlsx) {
        setParsing(true);
        setDirection("forward");
        setStep("map");
        const body = new FormData();
        body.append("file", file);
        void fetch("/api/bookings/import", { method: "POST", body })
          .then(async (res) => {
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.rows) {
              setParseError(t("parseError"));
              setStep("upload");
              return;
            }
            receive(
              (data.headers as string[]) ?? [],
              data.rows as Record<string, string>[]
            );
          })
          .catch(() => {
            setParseError(t("parseError"));
            setStep("upload");
          })
          .finally(() => setParsing(false));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const parsed = parseCsv(text);
          receive(parsed.headers, parsed.rows);
        } catch {
          setParseError(t("parseError"));
        }
      };
      reader.readAsText(file);
    },
    [t, receive]
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
    if (busy) return;
    resetImportState();
    onClose();
  }

  const done = importResult !== null;
  const canContinue = step === "map" ? requiredFieldsSatisfied(mapping) && !parsing : true;

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="right"
          showCloseButton
          // The default right-side sheet is w-3/4 capped at sm, which leaves
          // the mapping grid a single cramped column. Full width on a phone,
          // wide enough for two columns from sm up.
          className="flex w-full! flex-col gap-0 p-0 sm:max-w-2xl"
        >
          <div className="border-b border-border px-4 py-3">
            <SheetTitle>{t("title")}</SheetTitle>
            <StepRail
              steps={steps}
              current={stepIndex}
              label={(s) => tSteps(s)}
              position={tSteps("position", { current: stepIndex + 1, total: steps.length })}
            />
          </div>

          <div className="@container relative min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div
              key={step}
              data-direction={direction}
              className={cn(
                "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
                direction === "forward"
                  ? "motion-safe:slide-in-from-bottom-3"
                  : "motion-safe:slide-in-from-top-3"
              )}
            >
              {step === "upload" ? (
                <UploadStep
                  dragging={dragging}
                  setDragging={setDragging}
                  onDrop={onDrop}
                  onPick={() => fileInputRef.current?.click()}
                  inputRef={fileInputRef}
                  onInputChange={onInputChange}
                  parseError={parseError}
                  labels={{
                    dropzone: t("dropzone"),
                    dropzoneActive: t("dropzoneActive"),
                    templateCsv: t("templateCsv"),
                    templateXlsx: t("templateXlsx"),
                  }}
                />
              ) : null}

              {step === "map" ? (
                <ImportColumnMapping
                  headers={headers}
                  sampleRow={sourceRows[0]}
                  rowCount={sourceRows.length}
                  mapping={mapping}
                  onChange={setMapping}
                  dateOrder={dateOrder}
                  onDateOrderChange={setDateOrder}
                  ambiguousDateExample={ambiguousDateExample}
                  loading={parsing}
                />
              ) : null}

              {step === "values" ? (
                <ImportValueMapping
                  unmapped={unmapped}
                  valueMap={effectiveValueMap}
                  onChange={setValueMap}
                  sourceColumns={enumSourceColumns}
                />
              ) : null}

              {step === "preview" ? (
                <PreviewStep
                  rows={rows}
                  validCount={validRows.length}
                  invalidCount={invalidRows.length}
                  invalidIndexes={invalidIndexes}
                  fileName={fileName}
                  autoMapped={autoMapped}
                  onReviewMapping={() => goTo("map", "back")}
                  onShowErrors={() => setShowPreviewErrors(true)}
                  writableTeams={writableTeams}
                  teamId={teamId}
                  setTeamId={setTeamId}
                  disabled={busy}
                  labels={{
                    preview: t("preview", { total: rows.length }),
                    valid: t("validCount", { count: validRows.length }),
                    invalid: t("invalidCount", { count: invalidRows.length }),
                    reviewMapping: tNav("reviewMapping"),
                    reviewMappingAction: tNav("reviewMappingAction"),
                    groupBlocked: t("groupBlocked"),
                    teamLabel: tDialog("teamLabel"),
                    teamDefault: tDialog("teamDefault"),
                    col: (k: "row" | "title" | "client" | "start" | "error") => tCols(k),
                  }}
                />
              ) : null}
            </div>

            {busy ? (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-xs"
              >
                <Loader2Icon className="size-6 animate-spin text-brand" />
                <p className="text-sm text-muted-foreground">
                  {importing ? tNav("committing") : tNav("refreshing")}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={stepIndex > 0 && !done ? goBack : handleClose}
              disabled={busy}
            >
              {stepIndex > 0 && !done ? tNav("back") : done ? tDialog("close") : tDialog("cancel")}
            </Button>

            {step !== "preview" && step !== "upload" ? (
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={goNext}
                disabled={!canContinue}
              >
                {tNav("continue")}
              </Button>
            ) : null}

            {step === "preview" && !done ? (
              validRows.length > 0 ? (
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  // Wrapped: passing the handler directly would hand the click
                  // event in as confirmDuplicates, which is truthy, so the
                  // warning would never be shown.
                  onClick={() => void triggerImport()}
                  loading={busy}
                >
                  {busy ? t("importing") : t("importButton", { count: validRows.length })}
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
                  {t("success", {
                    bookings: importResult.created + importResult.updated,
                    shifts: importResult.shifts,
                  })}
                </span>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

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

/** Where you are and how far is left, without stealing room from the content. */
function StepRail({
  steps,
  current,
  label,
  position,
}: {
  steps: Step[];
  current: number;
  label: (step: Step) => string;
  position: string;
}) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <ol className="flex min-w-0 flex-1 items-center gap-1.5">
        {steps.map((s, i) => (
          <li key={s} className="flex min-w-0 flex-1 flex-col gap-1">
            <span
              aria-hidden="true"
              className={cn(
                "h-0.5 w-full motion-safe:transition-colors",
                i <= current ? "bg-brand" : "bg-border"
              )}
            />
            <span
              className={cn(
                "truncate text-xs",
                i === current ? "font-medium text-foreground" : "text-muted-foreground"
              )}
              aria-current={i === current ? "step" : undefined}
            >
              {label(s)}
            </span>
          </li>
        ))}
      </ol>
      <span className="sr-only">{position}</span>
    </div>
  );
}

function UploadStep({
  dragging,
  setDragging,
  onDrop,
  onPick,
  inputRef,
  onInputChange,
  parseError,
  labels,
}: {
  dragging: boolean;
  setDragging: (next: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onPick: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  parseError: string | null;
  labels: {
    dropzone: string;
    dropzoneActive: string;
    templateCsv: string;
    templateXlsx: string;
  };
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={labels.dropzone}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-12 text-center motion-safe:transition-colors",
          dragging
            ? "border-brand bg-brand/5 text-brand"
            : "border-border text-muted-foreground hover:border-brand hover:text-brand"
        )}
        onClick={onPick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onPick();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <UploadIcon className="size-8 opacity-60" />
        <p className="text-sm">{dragging ? labels.dropzoneActive : labels.dropzone}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={onInputChange}
        />
      </div>

      {parseError ? <p className="text-sm text-destructive">{parseError}</p> : null}

      {/* Served by the route, not built here: the XLSX is a zip, and
          generating both server-side is what keeps them identical. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <a
          href="/api/bookings/import?format=csv"
          download
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <FileTextIcon className="me-1 inline size-3" />
          {labels.templateCsv}
        </a>
        <a
          href="/api/bookings/import?format=xlsx"
          download
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <SheetIcon className="me-1 inline size-3" />
          {labels.templateXlsx}
        </a>
      </div>
    </div>
  );
}

function PreviewStep({
  rows,
  validCount,
  invalidCount,
  invalidIndexes,
  fileName,
  autoMapped,
  onReviewMapping,
  onShowErrors,
  writableTeams,
  teamId,
  setTeamId,
  disabled,
  labels,
}: {
  rows: ParsedRow[];
  validCount: number;
  invalidCount: number;
  invalidIndexes: Set<number>;
  fileName: string | null;
  autoMapped: boolean;
  onReviewMapping: () => void;
  onShowErrors: () => void;
  writableTeams: BookingTeamOption[];
  teamId: string;
  setTeamId: (next: string) => void;
  disabled: boolean;
  labels: {
    preview: string;
    valid: string;
    invalid: string;
    reviewMapping: string;
    reviewMappingAction: string;
    groupBlocked: string;
    teamLabel: string;
    teamDefault: string;
    col: (k: "row" | "title" | "client" | "start" | "error") => string;
  };
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* A file whose COLUMNS we matched without asking still says so, and
          offers to reopen that column-mapping step — silently guessing and
          never mentioning it is how a wrong column reaches the database
          unnoticed. autoMapped only covers the column step; a file can still
          land on the value step afterward if it has unrecognized enum values. */}
      {autoMapped ? (
        <div className="flex flex-wrap items-center gap-2 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <CheckCircleIcon className="size-3.5 shrink-0 text-brand" />
          <span>{labels.reviewMapping}</span>
          <button
            type="button"
            onClick={onReviewMapping}
            className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {labels.reviewMappingAction}
          </button>
        </div>
      ) : null}

      {writableTeams.length > 1 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="import-team" className="text-xs font-medium text-foreground">
            {labels.teamLabel}
          </label>
          <select
            id="import-team"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={disabled}
            className="border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">{labels.teamDefault}</option>
            {writableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">{labels.preview}</span>
        {validCount > 0 ? <span className="text-xs text-foreground">{labels.valid}</span> : null}
        {invalidCount > 0 ? (
          <button
            type="button"
            onClick={onShowErrors}
            className="text-xs text-destructive underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {labels.invalid}
          </button>
        ) : null}
        <span className="ms-auto text-xs text-muted-foreground">{fileName}</span>
      </div>

      <div className="overflow-auto border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th className="w-8 border-b border-border px-2 py-1.5 text-start font-medium">
                {labels.col("row")}
              </th>
              <th className="w-5 border-b border-border px-1 py-1.5" />
              <th className="border-b border-border px-2 py-1.5 text-start font-medium">
                {labels.col("title")}
              </th>
              <th className="border-b border-border px-2 py-1.5 text-start font-medium">
                {labels.col("client")}
              </th>
              <th className="border-b border-border px-2 py-1.5 text-start font-medium">
                {labels.col("start")}
              </th>
              <th className="border-b border-border px-2 py-1.5 text-start font-medium text-destructive">
                {labels.col("error")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              // Group-blocked rows parse fine on their own but are still not
              // importable. Showing them with a green tick contradicted the
              // counts right above the table.
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
                      // The cell truncates a long message; the dialog shows it
                      // whole alongside the raw row.
                      <button
                        type="button"
                        onClick={onShowErrors}
                        className="text-start underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {row.error ?? labels.groupBlocked}
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
  );
}
