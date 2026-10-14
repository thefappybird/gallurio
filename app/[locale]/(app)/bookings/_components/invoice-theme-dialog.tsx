"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useInvalidateFor } from "@/hooks/use-data-events";
import { toast } from "sonner";
import { useActionError } from "@/lib/i18n/actionError";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { ColorPicker } from "@/components/ui/color-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CheckIcon, Maximize2Icon, XIcon } from "lucide-react";
import {
  INVOICE_THEME_PRESETS,
  invoiceColorsFromBrandKit,
  readableTextOn,
  type InvoiceColors,
  type InvoiceTheme,
  type InvoiceThemePreviewBusiness,
  type InvoiceThemePresetId,
} from "@/lib/invoices/theme";
import { BRAND_KIT_THEME_PRESETS } from "@/lib/page-builder/types";
import { DocumentPreviewDialog } from "@/components/app/document-preview-dialog";
import { SheetResizeHandle, useSheetResize } from "@/components/ui/sheet-resize";
import { updateInvoiceThemeAction } from "../_actions";
import { cn } from "@/lib/utils";

export type InvoiceThemeValue = InvoiceTheme;
export type InvoicePortfolioBrandKit = {
  primaryColor: string;
  accentColor: string;
  foregroundColor: string;
  backgroundColor: string;
};
export type InvoiceSavedTheme = { id: string; name: string } & InvoiceColors;

type Props = {
  open: boolean;
  onClose: () => void;
  initialTheme: InvoiceThemeValue;
  /** Published portfolio colors; null until a portfolio is published. */
  portfolioBrandKit?: InvoicePortfolioBrandKit | null;
  savedThemes?: InvoiceSavedTheme[];
  business?: InvoiceThemePreviewBusiness;
};

type Selection =
  | { kind: "portfolio" }
  | { kind: "preset"; id: InvoiceThemePresetId }
  | { kind: "saved"; id: string }
  | { kind: "custom" };

const FALLBACK_BUSINESS: InvoiceThemePreviewBusiness = {
  name: "Your business",
  logoUrl: "",
  address: "123 Studio Lane, Your City",
  email: "hello@yourbusiness.com",
  currency: "USD",
};

function formatPreviewMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function DocumentPreview({
  kind,
  business,
  theme,
}: {
  kind: "invoice" | "receipt";
  business: InvoiceThemePreviewBusiness;
  theme: InvoiceColors;
}) {
  const isReceipt = kind === "receipt";
  const rows = isReceipt
    ? [
        ["Total", formatPreviewMoney(2400, business.currency)],
        ["Deposit", formatPreviewMoney(600, business.currency)],
        ["Final payment", formatPreviewMoney(1800, business.currency)],
      ]
    : [
        ["Total", formatPreviewMoney(2400, business.currency)],
        ["Deposit paid", formatPreviewMoney(600, business.currency)],
        ["Balance due", formatPreviewMoney(1800, business.currency)],
      ];

  return (
    <article
      aria-label={`${isReceipt ? "Receipt" : "Invoice"} preview`}
      className="flex aspect-[210/297] w-full max-w-[18rem] flex-col overflow-hidden border border-border bg-background text-[7px] leading-tight text-foreground"
    >
      <header className="px-4 py-3" style={{ backgroundColor: theme.main, color: theme.text }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
              {business.logoUrl ? (
                // The workspace logo is a stored Cloudflare Images URL and the
                // preview must use it directly to match the generated PDF.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logoUrl} alt="" className="size-6 shrink-0 object-contain" />
              ) : null}
              <span className="truncate text-[11px] font-bold">{business.name}</span>
            </div>
            <p className="line-clamp-2 opacity-75">{business.address}</p>
          </div>
          <div className="shrink-0 text-end">
            <p className="text-[6px] tracking-[0.18em] opacity-80">{isReceipt ? "RECEIPT" : "INVOICE"}</p>
            <p className="mt-1 text-[10px] font-bold">{isReceipt ? "RCT-000042" : "INV-000042"}</p>
            <p className="mt-0.5 opacity-75">Aug 2, 2026</p>
          </div>
        </div>
      </header>
      <div className="h-1" style={{ backgroundColor: theme.accent }} />

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <div className="grid grid-cols-3 gap-2 border-y border-border py-3 text-[6px]">
          <div>
            <p className="mb-1 font-bold tracking-[0.12em] text-muted-foreground">BILL TO</p>
            <p className="font-semibold">Sophie Reyes</p>
            <p className="text-muted-foreground">sophie@example.com</p>
          </div>
          <div>
            <p className="mb-1 font-bold tracking-[0.12em] text-muted-foreground">EVENT</p>
            <p className="font-semibold">Summer wedding</p>
            <p className="text-muted-foreground">Aug 16, 2026</p>
          </div>
          <div className="hidden sm:block">
            <p className="mb-1 font-bold tracking-[0.12em] text-muted-foreground">LOCATION</p>
            <p className="font-semibold">Garden estate</p>
          </div>
        </div>

        <div className="mt-4">
          {rows.map(([label, value], index) => (
            <div
              key={label}
              className={cn(
                "flex items-center justify-between py-1.5",
                index === rows.length - 1 && "mt-1 border-t border-foreground pt-2 text-[8px] font-bold"
              )}
            >
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        {isReceipt ? (
          <p className="mt-3 text-[6px] text-muted-foreground">Paid in full for Summer wedding.</p>
        ) : null}
      </div>
      <footer className="flex items-end justify-between gap-3 px-4 py-3" style={{ backgroundColor: theme.main, color: theme.text }}>
        <div className="min-w-0 text-[6px] opacity-75">
          <p className="truncate">{business.address}</p>
          <p className="truncate">{business.email}</p>
        </div>
        <p className="shrink-0 text-[10px] font-bold">THANK YOU</p>
      </footer>
      <p className="px-4 py-1.5 text-center text-[5px] text-muted-foreground">Powered by Gallurio</p>
    </article>
  );
}

function ThemeTile({
  label,
  colors,
  selected,
  disabled,
  hint,
  className,
  onSelect,
}: {
  label: string;
  colors?: Pick<InvoiceColors, "main" | "accent">;
  selected: boolean;
  disabled?: boolean;
  hint?: string;
  className?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 items-center gap-2 border border-border bg-background p-2 text-start text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background",
        selected && "border-brand",
        className
      )}
    >
      {colors ? (
        <span className="flex shrink-0">
          <span className="size-5" style={{ background: colors.main }} aria-hidden />
          <span className="size-5" style={{ background: colors.accent }} aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      {selected ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : null}
    </button>
  );
}

function initialSelection(
  theme: InvoiceThemeValue,
  hasPortfolio: boolean,
  savedThemes: InvoiceSavedTheme[]
): Selection {
  if (theme.preset === "portfolio" && hasPortfolio) return { kind: "portfolio" };
  if (theme.preset === "saved" && savedThemes.some((s) => s.id === theme.savedThemeId)) {
    return { kind: "saved", id: theme.savedThemeId as string };
  }
  if ((BRAND_KIT_THEME_PRESETS as readonly string[]).includes(theme.preset)) {
    return { kind: "preset", id: theme.preset as InvoiceThemePresetId };
  }
  // Custom, or a stored portfolio/saved reference whose source is gone: keep the stored colors.
  return { kind: "custom" };
}

export function InvoiceThemeDialog({
  open,
  onClose,
  initialTheme,
  portfolioBrandKit = null,
  savedThemes = [],
  business = FALLBACK_BUSINESS,
}: Props) {
  const t = useTranslations("app.bookings.invoiceThemeDialog");
  const tPreset = useTranslations("app.pageBuilder.brandKit.presets");
  const tCommon = useTranslations("common");
  const invalidateFor = useInvalidateFor();
  const errMsg = useActionError();
  // min 320 (< the shared 360 default): this is the narrowest of the three sheets.
  const resize = useSheetResize({ storageKey: "gw:sheet-w:invoice-theme", defaultWidth: 352, min: 320 });
  const [selection, setSelection] = useState<Selection>(() =>
    initialSelection(initialTheme, Boolean(portfolioBrandKit), savedThemes)
  );
  const [customMain, setCustomMain] = useState(initialTheme.main);
  const [customAccent, setCustomAccent] = useState(initialTheme.accent);
  const [tab, setTab] = useState<"invoice" | "receipt">("invoice");
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const portfolioColors = portfolioBrandKit ? invoiceColorsFromBrandKit(portfolioBrandKit) : null;
  const savedTheme = selection.kind === "saved" ? savedThemes.find((s) => s.id === selection.id) : undefined;
  const colors: InvoiceColors =
    selection.kind === "portfolio" && portfolioColors
      ? portfolioColors
      : selection.kind === "preset"
        ? INVOICE_THEME_PRESETS[selection.id]
        : savedTheme
          ? { main: savedTheme.main, accent: savedTheme.accent, text: savedTheme.text }
          : { main: customMain, accent: customAccent, text: readableTextOn(customMain) };

  async function handleSave() {
    setSaving(true);
    const preset = selection.kind === "preset" ? selection.id : selection.kind;
    const result = await updateInvoiceThemeAction({
      preset,
      ...(selection.kind === "saved" ? { savedThemeId: selection.id } : {}),
      ...colors,
    });
    setSaving(false);
    if ("error" in result) {
      toast.error(errMsg(result.error));
      return;
    }
    onClose();
    invalidateFor({ type: "workspace.updated" });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        {...resize.sheetProps}
        className="h-full w-full gap-0 overflow-hidden p-0 data-resizing:transition-none sm:w-(--sheet-w) sm:max-w-none"
      >
        <SheetResizeHandle resize={resize} />
        <SheetHeader className="relative border-b border-border pe-12">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetClose
            render={<Button type="button" variant="ghost" size="icon-sm" className="absolute end-3 top-3" />}
          >
            <XIcon />
            <span className="sr-only">{t("cancel")}</span>
          </SheetClose>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <ThemeTile
              className="col-span-2"
              label={t("matchPortfolio")}
              colors={portfolioColors ?? undefined}
              selected={selection.kind === "portfolio"}
              disabled={!portfolioBrandKit}
              hint={portfolioBrandKit ? undefined : t("publishFirst")}
              onSelect={() => setSelection({ kind: "portfolio" })}
            />
            {BRAND_KIT_THEME_PRESETS.map((id) => (
              <ThemeTile
                key={id}
                label={tPreset(id)}
                colors={INVOICE_THEME_PRESETS[id]}
                selected={selection.kind === "preset" && selection.id === id}
                onSelect={() => setSelection({ kind: "preset", id })}
              />
            ))}
            {savedThemes.length > 0 ? (
              <>
                <p className="col-span-2 mt-1 text-xs font-medium text-muted-foreground">{t("savedThemes")}</p>
                {savedThemes.map((saved) => (
                  <ThemeTile
                    key={saved.id}
                    label={saved.name}
                    colors={saved}
                    selected={selection.kind === "saved" && selection.id === saved.id}
                    onSelect={() => setSelection({ kind: "saved", id: saved.id })}
                  />
                ))}
              </>
            ) : null}
            <ThemeTile
              className="col-span-2"
              label={t("presets.custom")}
              selected={selection.kind === "custom"}
              onSelect={() => setSelection({ kind: "custom" })}
            />
          </div>
          {selection.kind === "custom" ? (
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger className="flex min-h-11 items-center gap-2 border border-border px-2 py-1.5 text-start text-sm">
                  <span className="size-5 shrink-0 border border-border" style={{ background: customMain }} aria-hidden />
                  {t("mainColor")}
                </PopoverTrigger>
                <PopoverContent className="w-auto" align="start">
                  <ColorPicker value={customMain} onChange={setCustomMain} hexLabel={t("mainColor")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger className="flex min-h-11 items-center gap-2 border border-border px-2 py-1.5 text-start text-sm">
                  <span className="size-5 shrink-0 border border-border" style={{ background: customAccent }} aria-hidden />
                  {t("accentColor")}
                </PopoverTrigger>
                <PopoverContent className="w-auto" align="start">
                  <ColorPicker value={customAccent} onChange={setCustomAccent} hexLabel={t("accentColor")} />
                </PopoverContent>
              </Popover>
            </div>
          ) : null}

          <Tabs value={tab} onValueChange={(v) => setTab(v as "invoice" | "receipt")} className="min-h-0 flex-1 gap-2">
            <TabsList>
              <TabsTab value="invoice" className="flex-1">{t("invoice")}</TabsTab>
              <TabsTab value="receipt" className="flex-1">{t("receipt")}</TabsTab>
            </TabsList>
            {(["invoice", "receipt"] as const).map((kind) => (
              <TabsPanel key={kind} value={kind} className="items-center gap-0">
                <div className="relative flex w-full justify-center">
                  <DocumentPreview kind={kind} business={business} theme={colors} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute end-0 top-0"
                    onClick={() => setExpanded(true)}
                  >
                    <Maximize2Icon />
                    <span className="sr-only">{t("expandPreview")}</span>
                  </Button>
                </div>
              </TabsPanel>
            ))}
          </Tabs>
        </div>

        <SheetFooter className="border-t border-border px-3 py-3 sm:flex-row sm:justify-end">
          <SheetClose render={<Button type="button" variant="ghost" size="sm" />}>
            {t("cancel")}
          </SheetClose>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {t("saveAndApply")}
          </Button>
        </SheetFooter>

        <DocumentPreviewDialog
          open={expanded}
          onOpenChange={setExpanded}
          title={t(tab)}
          closeLabel={tCommon("close")}
        >
          <DocumentPreview kind={tab} business={business} theme={colors} />
        </DocumentPreviewDialog>
      </SheetContent>
    </Sheet>
  );
}
