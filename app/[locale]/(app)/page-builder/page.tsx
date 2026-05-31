import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "@/lib/i18n/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import { DEFAULT_BRAND_KIT, type PortfolioBrandKit, type PortfolioContactConfig, type PuckData } from "@/lib/page-builder/types";
import { EditorShell } from "./_components/EditorShell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.pageBuilder");
  return { title: t("title") };
}

const EMPTY_ZONE: PuckData = { content: [], root: {} };

// Strip to plain, serializable JSON before crossing the server→client boundary.
function toPlain<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return fallback;
  }
}

export default async function PageBuilderEntry({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.pageBuilder");

  const { workspace, role } = await requireOrg();

  if (role !== "owner") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ownerOnly")}</p>
      </div>
    );
  }

  // First visit (no seeded home) → guided wizard.
  if (!workspace.publicPage?.data?.home) {
    redirect({ href: "/page-builder/wizard", locale });
  }

  const pp = workspace.publicPage;
  const initialData = {
    home: toPlain<PuckData>(pp?.data?.home, EMPTY_ZONE),
    gallery: toPlain<PuckData>(pp?.data?.gallery, EMPTY_ZONE),
  };
  const initialBrandKit = toPlain<PortfolioBrandKit>(pp?.brandKit, DEFAULT_BRAND_KIT);
  const initialContact = toPlain<PortfolioContactConfig>(pp?.contact, {});
  const publicOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  return (
    <EditorShell
      slug={workspace.slug}
      workspaceName={workspace.name}
      initialData={initialData}
      initialBrandKit={initialBrandKit}
      initialContact={initialContact}
      publicOrigin={publicOrigin}
    />
  );
}
