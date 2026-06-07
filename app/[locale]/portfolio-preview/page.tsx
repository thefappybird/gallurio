import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@measured/puck/rsc";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { puckConfig } from "@/lib/page-builder/config";
import { buildRenderWorkspace, runWithRenderWorkspace } from "@/lib/page-builder/serverContext";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { resolvePublicChromeLocale } from "@/lib/i18n/localeForCountry";
import {
  DEFAULT_BRAND_KIT,
  type PortfolioBrandKit,
  type PortfolioContactConfig,
  type PortfolioHeaderConfig,
  type PuckData,
} from "@/lib/page-builder/types";
import { buildContactLabels } from "@/app/(public)/w/[orgSlug]/_components/buildContactLabels";
import type { SubmitAppearance } from "@/app/(public)/w/[orgSlug]/_components/ContactForm";
import { PortfolioHeader } from "@/app/(public)/w/[orgSlug]/_components/PortfolioHeader";
import { PreviewContactCard } from "./_components/PreviewContactCard";

// Owner-only draft preview — never indexed, always rendered fresh from the
// current (possibly unpublished) draft.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

type PreviewZone = "home" | "gallery" | "contact";
type BrowserPreviewDraft = {
  version?: number;
  data?: Partial<Record<Exclude<PreviewZone, "contact">, PuckData>>;
  brandKit?: PortfolioBrandKit;
  contact?: PortfolioContactConfig;
  formLocale?: string;
  headerConfig?: PortfolioHeaderConfig;
};

function parseZone(value: string | string[] | undefined): PreviewZone {
  return value === "gallery" || value === "contact" ? value : "home";
}

function parseHeaderConfig(value: string | string[] | undefined): PortfolioHeaderConfig | null {
  if (typeof value !== "string" || !value) return null;
  try {
    return JSON.parse(value) as PortfolioHeaderConfig;
  } catch {
    return null;
  }
}

function resolveSubmitAppearance(contact?: PortfolioContactConfig | null): SubmitAppearance {
  const color = contact?.buttonColor
    ? contact.buttonColor.startsWith("#")
      ? contact.buttonColor
      : `var(--pf-color-${contact.buttonColor})`
    : "var(--pf-color-primary)";
  const style = (contact?.buttonStyle || "solid") as SubmitAppearance["style"];
  const textColor = contact?.buttonTextColor
    ? contact.buttonTextColor.startsWith("#")
      ? contact.buttonTextColor
      : `var(--pf-color-${contact.buttonTextColor})`
    : undefined;
  const errorColor = contact?.errorMessageColor
    ? contact.errorMessageColor.startsWith("#")
      ? contact.errorMessageColor
      : `var(--pf-color-${contact.errorMessageColor})`
    : undefined;
  const borderRadius = contact?.buttonRadius
    ? ({ sharp: "0", subtle: "0.25rem", rounded: "0.5rem" }[contact.buttonRadius] ?? "var(--pf-radius)")
    : undefined;
  const border = contact?.buttonBorderWidth
    ? `${contact.buttonBorderWidth}px solid ${
        contact.buttonBorderColor?.startsWith("#")
          ? contact.buttonBorderColor
          : `var(--pf-color-${contact.buttonBorderColor || "foreground"})`
      }`
    : undefined;
  return { color, style, textColor, errorColor, borderRadius, border };
}

function parseDraft(value: string | string[] | undefined): BrowserPreviewDraft | null {
  if (typeof value !== "string" || !value) return null;
  try {
    return JSON.parse(value) as BrowserPreviewDraft;
  } catch {
    return null;
  }
}

/**
 * Chrome-less live preview of the portfolio draft, loaded in an iframe by the
 * page-builder editor. Lives directly under `[locale]` (not `(app)`) so it
 * inherits the providers + brand fonts but NOT the app sidebar — the iframe
 * shows only the rendered page. Reads the draft (no `publishedAt` gate) so the
 * owner previews unpublished work; gated to the workspace owner.
 */
export default async function PortfolioPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ zone?: string | string[]; header?: string | string[]; draft?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const zone = parseZone(sp.zone);
  const draft = parseDraft(sp.draft);
  const liveHeader = parseHeaderConfig(sp.header);

  const { workspace, role } = await requireOrg();
  if (role !== "owner") notFound();

  const pp = workspace.publicPage;
  const brandKit = draft?.brandKit ?? pp?.brandKit ?? DEFAULT_BRAND_KIT;
  const { cssVars, className } = resolveBrandKit(brandKit);

  const tp = await getTranslations("app.pageBuilder.editor.preview");

  const chromeLocale = draft?.formLocale || resolvePublicChromeLocale(workspace);
  const tNav = await getTranslations({ locale: chromeLocale, namespace: "publicPage.nav" });
  const headerConfig =
    draft?.headerConfig ??
    liveHeader ??
    ((pp?.header ?? null) as PortfolioHeaderConfig | null);
  const activePath = zone === "gallery" ? `/w/${workspace.slug}/gallery` : `/w/${workspace.slug}`;

  let body: React.ReactNode;

  if (zone === "contact") {
    const tForm = await getTranslations({ locale: chromeLocale, namespace: "publicPage.inquiryForm" });
    const contact = draft?.contact ?? ((pp?.contact ?? null) as PortfolioContactConfig | null);
    const labels = buildContactLabels(tForm);
    body = (
      <PreviewContactCard
        workspaceSlug={workspace.slug}
        title={contact?.title?.trim() || labels.title}
        description={contact?.description?.trim() || labels.description}
        labels={labels.form}
        submitAppearance={resolveSubmitAppearance(contact)}
      />
    );
  } else {
    const zoneData =
      draft?.data?.[zone] ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((pp?.data as Record<string, unknown> | null | undefined)?.[zone] as any) ??
      null;
    const hasContent =
      zoneData && Array.isArray(zoneData.content) && zoneData.content.length > 0;

    if (!hasContent) {
      body = (
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "var(--pf-font-body)",
            opacity: 0.7,
          }}
        >
          {tp("empty")}
        </div>
      );
    } else {
      const t = await getTranslations({ locale: chromeLocale, namespace: "publicPage.chrome" });
      const renderWorkspace = {
        ...buildRenderWorkspace(workspace),
        locale: chromeLocale,
        chrome: {
          startingFrom: t("startingFrom", { price: "{price}" }),
          gallery: {
            empty: t("gallery.empty"),
            noCollection: t("gallery.noCollection"),
            unavailable: t("gallery.unavailable"),
            error: t("gallery.error"),
            featuredEmpty: t("gallery.featuredEmpty"),
            carouselHint: t("gallery.carouselHint"),
            carouselPrev: t("gallery.carouselPrev"),
            carouselNext: t("gallery.carouselNext"),
          },
        },
      };
      body = runWithRenderWorkspace(renderWorkspace, () => (
        // metadata threads workspace context to every block via props.puck.metadata —
        // the RSC-safe path (AsyncLocalStorage doesn't survive into async block render).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Render data={zoneData} config={puckConfig as any} metadata={{ workspace: renderWorkspace }} />
      ));
    }
  }

  return (
    <div
      style={{ ...(cssVars as React.CSSProperties), minHeight: "100dvh", backgroundColor: "var(--pf-color-bg)", color: "var(--pf-color-fg)" }}
      className={className}
    >
      <PortfolioHeader
        slug={workspace.slug}
        activePath={activePath}
        labels={{
          brand: workspace.name,
          navLandmark: tNav("navLandmark"),
          home: tNav("home"),
          gallery: tNav("gallery"),
          contact: tNav("contact"),
          openMenu: tNav("openMenu"),
          closeMenu: tNav("closeMenu"),
        }}
        config={headerConfig}
      />
      {body}
    </div>
  );
}
