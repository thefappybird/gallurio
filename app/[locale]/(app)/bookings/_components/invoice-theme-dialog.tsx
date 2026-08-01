"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
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
import { CheckIcon, XIcon } from "lucide-react";
import {
  INVOICE_THEME_PRESETS,
  type InvoiceThemePreviewBusiness,
  type InvoiceThemePresetId,
} from "@/lib/invoices/theme";
import { updateInvoiceThemeAction } from "../_actions";
import { cn } from "@/lib/utils";

type ThemeValue = {
  preset: InvoiceThemePresetId | "custom";
  main: string;
  accent: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialTheme: ThemeValue;
  business?: InvoiceThemePreviewBusiness;
};

const PRESET_IDS: InvoiceThemePresetId[] = ["classic", "slate", "navyGold", "forest"];
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
  theme: { main: string; accent: string };
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
      <header className="px-4 py-3 text-white" style={{ backgroundColor: theme.main }}>
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
            <p className="line-clamp-2 text-white/75">{business.address}</p>
          </div>
          <div className="shrink-0 text-end">
            <p className="text-[6px] tracking-[0.18em] text-white/80">{isReceipt ? "RECEIPT" : "INVOICE"}</p>
            <p className="mt-1 text-[10px] font-bold">{isReceipt ? "RCT-000042" : "INV-000042"}</p>
            <p className="mt-0.5 text-white/75">Aug 2, 2026</p>
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
      <footer className="flex items-end justify-between gap-3 px-4 py-3 text-white" style={{ backgroundColor: theme.main }}>
        <div className="min-w-0 text-[6px] text-white/75">
          <p className="truncate">{business.address}</p>
          <p className="truncate">{business.email}</p>
        </div>
        <p className="shrink-0 text-[10px] font-bold">THANK YOU</p>
      </footer>
      <p className="px-4 py-1.5 text-center text-[5px] text-muted-foreground">Powered by Gallurio</p>
    </article>
  );
}

export function InvoiceThemeDialog({ open, onClose, initialTheme, business = FALLBACK_BUSINESS }: Props) {
  const t = useTranslations("app.bookings.invoiceThemeDialog");
  const router = useRouter();
  const errMsg = useActionError();
  const [preset, setPreset] = useState<InvoiceThemePresetId | "custom">(initialTheme.preset);
  const [customMain, setCustomMain] = useState(initialTheme.main);
  const [customAccent, setCustomAccent] = useState(initialTheme.accent);
  const [saving, setSaving] = useState(false);
  const colors = preset === "custom"
    ? { main: customMain, accent: customAccent }
    : INVOICE_THEME_PRESETS[preset];

  async function handleSave() {
    setSaving(true);
    const colors = preset === "custom"
      ? { main: customMain, accent: customAccent }
      : INVOICE_THEME_PRESETS[preset];
    const result = await updateInvoiceThemeAction({ preset, ...colors });
    setSaving(false);
    if ("error" in result) {
      toast.error(errMsg(result.error));
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="h-full w-[min(22rem,calc(100vw-1rem))] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none"
      >
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
          {PRESET_IDS.map((id) => {
            const presetColors = INVOICE_THEME_PRESETS[id];
            return (
              <button
                key={id}
                type="button"
                aria-pressed={preset === id}
                onClick={() => setPreset(id)}
                className={cn(
                  "flex items-center gap-2 border border-border p-2 text-start text-sm",
                  preset === id && "border-brand"
                )}
              >
                <span className="flex">
                  <span className="size-5" style={{ background: presetColors.main }} aria-hidden />
                  <span className="size-5" style={{ background: presetColors.accent }} aria-hidden />
                </span>
                <span className="flex-1">{t(`presets.${id}`)}</span>
                {preset === id ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : null}
            </button>
          );
          })}
          <button
            type="button"
            aria-pressed={preset === "custom"}
            onClick={() => setPreset("custom")}
            className={cn(
              "flex items-center gap-2 border border-border p-2 text-start text-sm",
              preset === "custom" && "border-brand"
            )}
          >
            <span className="flex-1">{t("presets.custom")}</span>
            {preset === "custom" ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : null}
          </button>
          </div>
        {preset === "custom" ? (
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

          <Tabs defaultValue="invoice" className="min-h-0 flex-1 gap-2">
            <TabsList>
              <TabsTab value="invoice" className="flex-1">{t("invoice")}</TabsTab>
              <TabsTab value="receipt" className="flex-1">{t("receipt")}</TabsTab>
            </TabsList>
            <TabsPanel value="invoice" className="items-center gap-0">
              <DocumentPreview kind="invoice" business={business} theme={colors} />
            </TabsPanel>
            <TabsPanel value="receipt" className="items-center gap-0">
              <DocumentPreview kind="receipt" business={business} theme={colors} />
            </TabsPanel>
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
      </SheetContent>
    </Sheet>
  );
}
