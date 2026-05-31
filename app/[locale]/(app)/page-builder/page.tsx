import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { redirect, Link } from "@/lib/i18n/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default async function PageBuilderEntry({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.pageBuilder");

  const { workspace, role } = await requireOrg();

  // Owner-only surface. Staff get a clear notice rather than a redirect loop.
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

  // Editor placeholder until Phase 9. The portfolio exists and is editable via
  // re-running setup; the full drag-and-drop editor lands next.
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("editorComingSoon")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("editPlaceholderHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              render={<a href={`/w/${workspace.slug}`} target="_blank" rel="noreferrer" />}
            >
              {t("openPublicPage")}
            </Button>
            <Button variant="ghost" render={<Link href="/page-builder/wizard" />}>
              {t("rerunWizard")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
